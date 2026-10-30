// 한글 시험지(HWPX) → 문항 JSON 변환기
// 강사가 넘긴 주간테스트 시험지 .hwpx 를 읽어 문항 단위로 쪼갠다(사장님 2026-10-22).
// 쓰는 곳: 16-wtadmin.js 의 시험지 등록 창.
//
// **의존성 없음.** zip 해제는 브라우저·Electron 의 DecompressionStream('deflate-raw'),
// XML 은 정규식으로 읽는다(DOMParser 를 쓰지 않는 이유: node 로도 그대로 돌려 시험할 수 있게).
//
// **.hwpx 만 받는다**(2026-10-23 사장님). 이름이 아니라 **알맹이**로 확인한다 — zip 이 아니면 거절하고
// 한글에서 hwpx 로 저장하는 방법을 안내한다(등록 창이 안내 상자를 띄운다).
// HWPX 는 그냥 zip 이고 본문은 Contents/section<N>.xml 이다. 실측한 SL PRIME 시험지 구조:
//   section0  문제지   머리글(실시일·출제교사·시간) → [1-3] 묶음 지시문(출처) → 지문(표 안) →
//                      'N. 발문' → 선지 ①~⑤
//   section1  정답·해설 표 — 번호 / 정답 / 해설(여러 문단)
//   section2  빠른 정답 찾기(번호 10개 + 정답 10개가 번갈아) — section1 이 있으면 안 쓴다
//
// 한 지문에 여러 문항이 걸리면([1-3]) 그 문항들이 **같은 지문을 공유**한다(shared=true).

const HX_CIRC = '①②③④⑤';

// ── zip ──────────────────────────────────────────────────────────
/** deflate-raw 를 풀어 Uint8Array 로. 브라우저·Electron·node 18+ 공통. */
async function hxInflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}
/** zip 바이트 → Map(경로 → Uint8Array). 중앙 디렉터리만 읽는다(store·deflate, zip64 아님). */
const HX_CFB_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];   // 옛 .hwp = MS 복합문서(CFB)
async function hxZipEntries(ab) {
  const b = new Uint8Array(ab);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65536); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('hwpx 가 아니거나 파일이 깨졌습니다(zip 끝 표시 없음).');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('zip 중앙 디렉터리가 깨졌습니다.');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder('utf-8').decode(b.subarray(p + 46, p + 46 + nameLen));
    if (dv.getUint32(lho, true) !== 0x04034b50) throw new Error('zip 항목 머리가 깨졌습니다: ' + name);
    const lNameLen = dv.getUint16(lho + 26, true);
    const lExtraLen = dv.getUint16(lho + 28, true);
    const from = lho + 30 + lNameLen + lExtraLen;
    const raw = b.subarray(from, from + csize);
    if (!name.endsWith('/')) {
      if (method === 0) out.set(name, raw);
      else if (method === 8) out.set(name, await hxInflate(raw));
      else throw new Error('지원하지 않는 압축 방식입니다(' + method + '): ' + name);
    }
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

// ── XML → 문단 ───────────────────────────────────────────────────
function hxUnesc(t) {
  return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(Number(d)); })
    .replace(/&amp;/g, '&');
}
/** section XML → 문단 글자 배열(문서 순서. 표 안 문단도 제자리에 들어온다). */
function hxParas(xml) {
  return xml.split('<hp:p ').slice(1).map(function (p) {
    const ts = p.match(/<hp:t>[\s\S]*?<\/hp:t>/g) || [];
    // '<hp:t>' 6자 · '</hp:t>' 7자 — 길이를 틀리면 글자가 한 칸씩 밀린다
    return ts.map(function (t) { return hxUnesc(t.slice(6, -7)); }).join('')
      .replace(/ /g, ' ').trim();
  });
}

// ── 문제지 읽기 ──────────────────────────────────────────────────
function hxIsChoice(t) { return HX_CIRC.indexOf(t.charAt(0)) >= 0; }
/** 맨 끝의 (…) 를 출처로 떼어 낸다. 괄호 안에 괄호가 있어도 된다 — '(고2 YBM(박) 영어 Ⅱ 4과 지문 2)' */
function hxTailParen(s) {
  const m = s.match(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/);
  return m ? { head: s.slice(0, m.index).trim(), paren: m[1].trim() } : { head: s.trim(), paren: '' };
}
function hxHeader(ps) {
  const h = {};
  ps.forEach(function (t) {
    let m = t.match(/실시일\s*:\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (m) h.date = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = t.match(/출제교사\s*:\s*(\S+)/); if (m) h.teacher = m[1];
    m = t.match(/시간\s*:\s*(\d+)\s*분/); if (m) h.minutes = Number(m[1]);
  });
  return h;
}
/** 문제지(section0) 문단 → 문항 배열 */
function hxItems(ps) {
  const items = [];
  let group = null, cur = null;
  const push = function () { if (cur) { items.push(cur); cur = null; } };
  let gap = false;                 // 직전에 빈 줄이 있었나 — 덩어리 경계다
  for (let i = 0; i < ps.length; i++) {
    const t = ps[i];
    if (!t) { gap = true; continue; }
    // [1-3] 다음 글을 읽고 물음에 답하시오. (출처)
    let m = t.match(/^\[(\d+)\s*[-~]\s*(\d+)\]\s*(.*)$/);
    if (m) {
      push();
      const sp = hxTailParen(m[3]);
      // label 은 원문 표기 그대로 쓴다 — '[20~21]' 을 '[20-21]' 로 바꾸지 않는다
      gap = false;
      group = { label: m[0].slice(0, m[0].indexOf(']') + 1), from: Number(m[1]), to: Number(m[2]), lead: sp.head, source: sp.paren, passage: [], pi: i };
      continue;
    }
    // N. 발문 (출처)
    m = t.match(/^(\d{1,2})\.\s*(.+)$/);
    if (m && Number(m[1]) <= 60 && (!cur || Number(m[1]) === cur.no + 1)) {
      push();
      const sp = hxTailParen(m[2]);
      // 괄호가 출처처럼 보일 때만 뗀다(발문 안의 '(A), (B)' 같은 괄호를 뺏기지 않게)
      const looksSource = sp.paren && /지문|과\s|과$|고\d|중\d|영어|모의|학년/.test(sp.paren);
      const no = Number(m[1]);
      const inGroup = !!(group && no >= group.from && no <= group.to);
      cur = {
        no: no,
        prompt: looksSource ? sp.head : t.replace(/^\d{1,2}\.\s*/, '').trim(),
        source: looksSource ? sp.paren : (inGroup ? group.source : ''),
        lead: inGroup ? group.lead : '',
        gFrom: inGroup ? group.from : 0, gTo: inGroup ? group.to : 0,
        gLabel: inGroup ? group.label : '',
        pi: inGroup ? group.pi : i,          // 원문에서 이 문항(묶음이면 묶음 머리)이 시작하는 문단
        piEnd: i,
        passage: inGroup ? group.passage.slice() : [],
        shared: inGroup, given: [], choices: [], answer: 0, explain: '',
      };
      gap = false;
      continue;
    }
    if (!cur) { if (group) group.passage.push(t); continue; }
    if (hxIsChoice(t)) { cur.choices.push(t.slice(1).trim()); cur.piEnd = i; continue; }
    // 선지가 이미 나온 뒤의 글자는 다음 덩어리(다음 문항의 지문)다
    if (cur.choices.length) { push(); if (group) group.passage.push(t); continue; }
    // 빈 줄로 갈린 덩어리 단위로 담는다 — 첫 덩어리가 지문, 그 뒤는 주어진 글.
    // (묶음 문항은 지문을 공유하므로 전부 주어진 글로 간다)
    cur.piEnd = i;
    // 요약 문항의 화살표는 빈 줄이 없어도 경계다 — 지문 / ↓ / 요약문 이 붙어 나온다(실측).
    if (/^[↓⇩⬇]+$/.test(t)) gap = true;
    const first = !cur.shared && !cur.blocks;
    if (first) cur.blocks = 1;
    else if (gap) cur.blocks = (cur.blocks || 0) + 1;
    if (!cur.shared && cur.blocks === 1) cur.passage.push(t);
    else cur.given.push(t);
    gap = false;
  }
  push();
  return items;
}
/** 정답 칸 글자 → 정답 값. 하나면 그 번호(③ → 3), **복수정답이면 번호를 작은 것부터 이어 붙인다**(③, ⑤ → 35).
 *  (2026-10-26 사장님 — '틀린 것을 모두 고르시오' 같은 문항.) 서버 채점은 '학생 답 = 정답' 한 줄이라,
 *  학생 쪽도 같은 방식으로 이어 붙여 보내면 정답을 전부, 그것만 골라야 맞는다. 동그라미 말고 다른 글자가 섞이면 0. */
function hxPick(s) {
  const t = String(s || '').trim();
  if (!/^[①②③④⑤](\s*[,·、/]?\s*[①②③④⑤])*$/.test(t)) return 0;
  const ds = [];
  for (const ch of t) { const k = HX_CIRC.indexOf(ch); if (k >= 0 && ds.indexOf(k + 1) < 0) ds.push(k + 1); }
  return Number(ds.sort().join(''));
}
/** 정답·해설(section1 표: 번호 / 정답 / 해설…) → { 번호: {answer, explain} } */
function hxAnswers(ps) {
  const out = {};
  for (let i = 0; i < ps.length; i++) {
    const n = ps[i].match(/^(\d{1,2})$/);
    if (!n || !ps[i + 1] || !hxPick(ps[i + 1])) continue;
    const ex = [];
    for (let j = i + 2; j < ps.length && !/^\d{1,2}$/.test(ps[j]); j++) if (ps[j]) ex.push(ps[j]);
    out[Number(n[1])] = { answer: hxPick(ps[i + 1]), explain: ex.join('\n') };
  }
  return out;
}
/** 빠른 정답 찾기(section2: 번호 여러 개 → 빈 줄 → 정답 여러 개) — section1 이 없을 때만 쓴다. */
function hxQuickAnswers(ps) {
  const out = {};
  let nums = [];
  for (let i = 0; i < ps.length; i++) {
    const t = ps[i];
    if (/^\d{1,2}$/.test(t)) { if (!nums.pending) nums.push(Number(t)); continue; }
    if (hxPick(t) && nums.length) {
      const picks = [];
      let j = i;
      for (; j < ps.length && (!ps[j] || hxPick(ps[j])); j++) if (ps[j]) picks.push(hxPick(ps[j]));
      nums.forEach(function (no, k) { if (picks[k]) out[no] = { answer: picks[k], explain: '' }; });
      nums = []; i = j - 1;
    }
  }
  return out;
}

/** **.hwpx 만 받는다**(2026-10-23 사장님 — 한글 문서는 일절 받지 말고 변환 방법을 안내할 것).
 *  알맹이로 확인한다: zip 이 아니면 어떤 이름이든 거절하고 변환 방법을 돌려준다. → 구역별 문단 배열 */
async function hxSections(ab) {
  const b = new Uint8Array(ab);
  const isZip = b.length > 4 && b[0] === 0x50 && b[1] === 0x4b;   // PK
  if (!isZip) {
    const cfb = b.length > 8 && HX_CFB_SIG.every(function (v, i) { return b[i] === v; });
    throw new Error((cfb ? '옛 한글 문서(.hwp)입니다. ' : '한글 표준 문서(.hwpx)가 아닙니다. ') + '한글에서 「파일 → 다른 이름으로 저장 → 한글 표준 (*.hwpx)」로 저장한 뒤 그 파일을 넣어 주세요.');
  }
  const zip = await hxZipEntries(ab);
  const names = [...zip.keys()].filter(function (n) { return /^Contents\/section\d+\.xml$/.test(n); })
    .sort(function (a, b2) { return Number(a.match(/\d+/)[0]) - Number(b2.match(/\d+/)[0]); });
  if (!names.length) throw new Error('hwpx 안에 본문(Contents/section0.xml)이 없습니다.');
  return names.map(function (n) { return hxParas(new TextDecoder('utf-8').decode(zip.get(n))); });
}

/** '1.(정답) ③' 다음 줄에 '(해설) …' 이 오는 **줄글 답지**.
 *  표도 '빠른 정답 찾기'도 없이 이렇게만 적힌 답지가 있다(2026-10-25 실측).
 *  해설은 **다음 번호가 나올 때까지 전부** 가져간다 — 표를 읽는 hxAnswers 와 같은 규칙이다.
 *  중간에 빈 줄이 있어도 끊지 않는다. 끊으면 긴 해설의 뒷부분을 잃는다. */
function hxInlineAnswers(ps) {
  const out = {};
  const head = /^(\d{1,3})\s*[.)]\s*\(\s*정답\s*\)\s*([①②③④⑤](?:\s*[,·、/]?\s*[①②③④⑤])*)/;
  const starts = [];
  for (let i = 0; i < ps.length; i++) {
    const m = String(ps[i] || '').trim().match(head);
    if (m) starts.push({ no: Number(m[1]), pick: hxPick(m[2]), at: i });
  }
  starts.forEach(function (s, k) {
    const end = k + 1 < starts.length ? starts[k + 1].at : ps.length;
    const ex = [];
    for (let j = s.at + 1; j < end; j++) {
      const t = String(ps[j] || '').trim();
      if (t) ex.push(t.replace(/^\(\s*해설\s*\)\s*/, ''));
    }
    out[s.no] = { answer: s.pick, explain: ex.join('\n') };
  });
  return out;
}

/** 구역 여러 개에서 정답을 긁는다 — 해설 표 → 빠른 정답 찾기 → 줄글 답지 순으로 본다. */
function hxAnswersFrom(sections) {
  let ans = {};
  sections.forEach(function (ps) {
    const a = hxAnswers(ps);
    if (Object.keys(a).length > Object.keys(ans).length) ans = a;
  });
  if (!Object.keys(ans).length) sections.forEach(function (ps) {
    const a = hxQuickAnswers(ps);
    if (Object.keys(a).length > Object.keys(ans).length) ans = a;
  });
  if (!Object.keys(ans).length) sections.forEach(function (ps) {
    const a = hxInlineAnswers(ps);
    if (Object.keys(a).length > Object.keys(ans).length) ans = a;
  });
  return ans;
}

/** 답지만 든 파일(ArrayBuffer) → { 번호: {answer, explain} }. 합본이 아닐 때 따로 올려 받는다.
 *  답지 파일은 구역 0 부터가 정답이라 **모든 구역**을 본다(합본은 구역 0 이 문제지라 빼고 본다). */
async function hwpxAnswersOnly(ab) {
  const secs = await hxSections(ab);
  const ans = hxAnswersFrom(secs);
  if (!Object.keys(ans).length) throw new Error('이 파일에서 정답을 찾지 못했습니다. 정답표가 든 답지 파일인지 확인해 주세요.');
  return ans;
}

/** .hwpx 파일(ArrayBuffer) → { head, items, paras }. paras 는 문제지 원문 문단(AI 검사가 대조에 쓴다). */
async function hwpxParse(ab) {
  const secs = await hxSections(ab);
  const head = hxHeader(secs[0]);
  const items = hxItems(secs[0]);

  // 정답: 해설 표가 있으면 그쪽, 없으면 빠른 정답 찾기. 문제지 구역(0)은 빼고 본다.
  const ans = hxAnswersFrom(secs.slice(1));
  items.forEach(function (it) {
    const a = ans[it.no];
    if (a) { it.answer = a.answer; it.explain = a.explain; }
  });

  // 규칙과 다르다고 경고하지 않는다(2026-10-22 사장님) — 선지가 번호뿐인 유형(삽입·순서),
  // 지문을 공유하는 묶음 문항처럼 **정상인데 규칙과 다른 모양**이 흔해서 경고가 더 헷갈렸다.
  // 읽은 결과는 등록 창의 '30문항 · 정답 30개' 와 '시험지 보기' 로 직접 확인한다.
  return { head: head, items: items, paras: secs[0] };
}

// ── 우리 양식으로 조립 ───────────────────────────────────────────
// hwpxParse 의 결과를 13-weekly.js 의 WeeklyTestSheets 가 그리는 문항 모양으로 옮긴다.
// 필요한 칸: { id, status:'done', stem, lead, given, passage, parts, choices, answer, explanation }
//
// 원본 시험지를 그대로 되살리는 것이 목적이라 지어내지 않는다:
//   · 한 지문에 걸린 묶음([1-3])은 **첫 문항에만** 지시문과 지문을 둔다 — 종이에 그렇게 찍혀 있다.
//   · 단독 문항은 출처를 발문 끝 괄호로 되돌린다(원본이 그 자리에 찍는다).
//   · 순서 문항의 (A)(B)(C) 는 parts 로 보내야 renderer 가 두 칸으로 배치한다.

/** 발문으로 유형 꼬리표를 짐작한다(정답지에만 쓴다. 못 알아보면 빈 값). */
function hxTypeLabel(prompt) {
  const q = String(prompt || '');
  if (/어법/.test(q)) return '어법';
  if (/낱말의 쓰임|어휘/.test(q)) return '어휘';
  if (/요약/.test(q)) return '요약';
  if (/빈칸/.test(q)) return '빈칸';
  if (/순서/.test(q)) return '순서';
  if (/주어진 문장/.test(q)) return '삽입';
  if (/흐름과 관계 없는|무관한/.test(q)) return '무관';
  if (/일치하지 않는|일치하는/.test(q)) return '일치';
  if (/제목/.test(q)) return '제목';
  if (/주제/.test(q)) return '주제';
  if (/요지|주장|목적/.test(q)) return '대의';
  if (/지칭|가리키는/.test(q)) return '지칭';
  if (/심경|분위기/.test(q)) return '심경';
  return '';
}

/** hwpxParse 결과 → WeeklyTestSheets 용 문항 배열 */
function hwpxToItems(parsed) {
  const items = (parsed && parsed.items) || [];
  const firstOfGroup = {};        // 묶음의 첫 문항 번호만 지시문·지문을 갖는다
  items.forEach(function (it) {
    if (!it.shared) return;
    const key = it.source + '|' + (it.passage[0] || '');
    if (firstOfGroup[key] === undefined) firstOfGroup[key] = it.no;
  });

  return items.map(function (it, i) {
    const key = it.source + '|' + (it.passage[0] || '');
    const head = !it.shared || firstOfGroup[key] === it.no;

    // 순서 문항: 주어진 글은 상자에, (A)(B)(C) 는 parts 로 — 내신은 (D)(E) 까지 가는 4·5단락 순서도 있다(2026-10-26 고2 28번)
    const parts = [];
    const rest = [];
    (it.given || []).forEach(function (g) {
      const m = g.match(/^\(([A-E])\)\s*([\s\S]*)$/);
      if (m) parts.push({ label: m[1], text: m[2].trim() });
      else rest.push(g);
    });

    let given = '', passage = '', givenAfter = false, arrow = false;
    if (parts.length) {
      given = (it.passage || []).join('\n');            // 순서: 주어진 글 = 상자, (A)(B)(C) = parts
      if (rest.length) given = (given ? given + '\n' : '') + rest.join('\n');
    } else {
      passage = head ? (it.passage || []).join('\n') : '';
      // 요약 문항은 지문 **뒤에** 화살표와 요약문 상자가 온다(평가원 양식)
      const body = rest.filter(function (t) { return t !== '↓'; });
      arrow = rest.length !== body.length;
      given = body.join('\n');
      givenAfter = arrow;
    }

    // 묶음 머리 / 단독 문항의 출처
    const srcTail = it.source ? ' (' + it.source + ')' : '';
    const lead = (it.shared && head)
      ? ((it.gLabel || ('[' + (it.gFrom || it.no) + '-' + (it.gTo || it.no) + ']')) + ' ' + (it.lead || '다음 글을 읽고 물음에 답하시오.') + srcTail)
      : '';
    const stem = it.shared ? it.prompt : it.prompt + srcTail;

    return {
      // 유형은 AI 검사가 매긴 것을 먼저 쓴다 — 규칙(hxTypeLabel)은 발문 글자만 봐서
      // 내신 문법형을 잘못 찍는다(실측: '빈칸에 들어갈 말' 이 실제로는 어법).
      id: 'hx' + it.no, status: 'done', type: '', typeLabel: it.aiType || hxTypeLabel(it.prompt),
      lead: lead, stem: stem, given: given, passage: passage,
      givenAfter: givenAfter, arrow: arrow,
      parts: parts.length ? parts : null,
      choices: it.choices || [], answer: it.answer || 0,
      explanation: it.explain || '', rev: 0,
    };
  });
}
