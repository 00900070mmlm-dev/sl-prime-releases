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
// ── 밑줄 ─────────────────────────────────────────────────────────
// 한글의 밑줄은 글자가 아니라 **글자 모양**이다: header.xml 의 <hh:charPr id="N"> 안에 <hh:underline type="BOTTOM" …/> 가 있고,
// 본문의 <hp:run charPrIDRef="N"> 이 그 모양을 쓴다. 글자(<hp:t>)만 읽으면 밑줄이 통째로 사라진다
// (2026-11-13 중등 주간테스트 — '밑줄 친 부분이 나머지와 다른 것' 문항에 밑줄이 하나도 없었다).
// 밑줄 구간은 **보이지 않는 글자 두 개**(U+2063 시작 · U+2064 끝)로 글자 사이에 끼워 둔다 — 문항 모양(문자열)을 안 바꾸고
// payload·채점 링크까지 그대로 흘러가고, 이 표시를 모르는 화면에서는 그냥 안 보인다.
const HX_UL_ON = '\u2063', HX_UL_OFF = '\u2064';
/** 밑줄 표시를 뗀 맨글자. 구조 판단(번호·선지·묶음)과 AI 대조는 전부 이쪽으로 한다. */
function hxPlain(s) { return String(s == null ? '' : s).replace(/[\u2063\u2064]/g, ''); }
function hxUlDecode(s) {
  const t = String(s == null ? '' : s), flags = [];
  let plain = '', on = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t.charAt(i);
    if (ch === HX_UL_ON) on = true;
    else if (ch === HX_UL_OFF) on = false;
    else { plain += ch; flags.push(on); }
  }
  return { plain: plain, flags: flags };
}
function hxUlEncode(plain, flags) {
  let out = '', on = false;
  for (let i = 0; i < plain.length; i++) {
    const f = !!flags[i] && plain.charAt(i) !== '\n';     // 줄을 넘는 밑줄은 줄마다 끊는다
    if (f !== on) { out += f ? HX_UL_ON : HX_UL_OFF; on = f; }
    out += plain.charAt(i);
  }
  return on ? out + HX_UL_OFF : out;
}
/** 표시가 든 글에서 맨글자 기준 [a, b) 만 잘라 낸다(밑줄은 그 안에 걸린 만큼만 따라온다). */
function hxUlSlice(marked, a, b) {
  const d = hxUlDecode(marked);
  return hxUlEncode(d.plain.slice(a, b), d.flags.slice(a, b));
}
/** header.xml → 밑줄이 켜진 글자 모양 번호 { id: true } */
function hxUnderlined(headXml) {
  const ul = {};
  String(headXml || '').split('<hh:charPr ').slice(1).forEach(function (c) {
    const id = c.match(/^[^>]*?\bid="(\d+)"/);
    const u = c.match(/<hh:underline\b[^>]*>/);
    if (id && u && /type="BOTTOM"/.test(u[0])) ul[id[1]] = true;
  });
  return ul;
}
// 줄 머리의 번호·선지 기호·(A)·[보기] — 여기까지 밑줄이 걸려 온 것은 선생님이 넓게 긁은 것이다(실측: '① His' 가 통째로 밑줄).
const HX_UL_LABEL = /^\s*(?:[①②③④⑤]|\d{1,2}\s*[.)]|\([A-Ea-e]\)|\[[^\]]{0,12}\])\s*/;
/** 문단 하나의 (맨글자, 밑줄 여부) → 표시가 든 글. 머리 기호·구간 양끝 공백·글자 없는 구간에서는 밑줄을 뗀다. */
function hxUlTidy(plain, flags) {
  const lab = plain.match(HX_UL_LABEL);
  if (lab) for (let i = 0; i < lab[0].length; i++) flags[i] = false;
  for (let i = 0; i < plain.length;) {
    if (!flags[i]) { i++; continue; }
    let j = i; while (j < plain.length && flags[j]) j++;
    let a = i, b = j;
    while (a < b && /\s/.test(plain.charAt(a))) flags[a++] = false;
    while (b > a && /\s/.test(plain.charAt(b - 1))) flags[--b] = false;
    // 화살표·문장부호뿐인 구간은 밑줄로 치지 않는다 — 요약 문항의 '↓' 가 구조 판단에 쓰인다
    if (a < b && !/[0-9A-Za-z가-힣ㄱ-ㅎⓐ-ⓩ_]/.test(plain.slice(a, b))) for (let k = a; k < b; k++) flags[k] = false;
    i = j;
  }
  const lead = plain.length - plain.replace(/^\s+/, '').length;
  const end = plain.replace(/\s+$/, '').length;
  return end <= lead ? '' : hxUlEncode(plain.slice(lead, end), flags.slice(lead, end));
}
/** section XML → 문단 글자 배열(문서 순서. 표 안 문단도 제자리에 들어온다).
 *  ul(밑줄 글자 모양 번호)을 주면 밑줄 구간에 표시를 끼운 글로 돌려준다 — 문단 수·자리는 맨글자 판과 똑같다. */
function hxParas(xml, ul) {
  return xml.split('<hp:p ').slice(1).map(function (p) {
    if (ul) {
      // run 을 차례로 따라가며 글자마다 밑줄 여부를 적는다. 표를 품은 문단은 run 밖 글자가 섞여 오므로 </hp:run> 에서 끈다.
      const re = /<hp:run\b[^>]*?charPrIDRef="(\d+)"|<\/hp:run>|<hp:t>([\s\S]*?)<\/hp:t>/g;
      let m, on = false, plain = '';
      const flags = [];
      while ((m = re.exec(p)) !== null) {
        if (m[1] !== undefined) on = !!ul[m[1]];
        else if (m[2] === undefined) on = false;
        else { const t = hxUnesc(m[2]).replace(/ /g, ' '); plain += t; for (let i = 0; i < t.length; i++) flags.push(on); }
      }
      return flags.indexOf(true) < 0 ? plain.trim() : hxUlTidy(plain, flags);
    }
    const ts = p.match(/<hp:t>[\s\S]*?<\/hp:t>/g) || [];
    // '<hp:t>' 6자 · '</hp:t>' 7자 — 길이를 틀리면 글자가 한 칸씩 밀린다
    return ts.map(function (t) { return hxUnesc(t.slice(6, -7)); }).join('')
      .replace(/ /g, ' ').trim();
  });
}
/** AI 가 다시 쪼갠 글(밑줄 표시 없음)에 **원문의 밑줄을 되붙인다.** 줄이 원문 문단과 똑같거나,
 *  원문 문단에서 머리 기호(①·N.·(A))만 뗀 것과 똑같을 때만 — 어설프게 맞추면 엉뚱한 낱말에 밑줄이 간다. */
function hxRemark(text, marked) {
  const src = (marked || []).filter(function (m) { return m.indexOf(HX_UL_ON) >= 0; }).map(function (m) { return { m: m, p: hxPlain(m) }; });
  if (!src.length) return text;
  return String(text == null ? '' : text).split('\n').map(function (line) {
    const t = line.trim();
    if (!t || t.indexOf(HX_UL_ON) >= 0) return line;
    for (let i = 0; i < src.length; i++) {
      const s = src[i];
      if (s.p === t) return s.m;
      const lab = s.p.match(HX_UL_LABEL);
      if (lab && s.p.slice(lab[0].length) === t) return hxUlSlice(s.m, lab[0].length, s.p.length);
    }
    return line;
  }).join('\n');
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
/** 문제지(section0) 문단 → 문항 배열. 문단에 밑줄 표시가 들어 있어도 된다 —
 *  **구조 판단(t)은 맨글자로**, 담는 글(tu)은 표시가 든 채로. 발문·출처·묶음 지시문은 맨글자로 둔다
 *  (발문 글자를 보고 유형·복수정답을 가르는 곳이 여럿이라). 발문의 밑줄('옳지 않은')은 promptU 에 따로 싣는다. */
function hxItems(ps) {
  const items = [];
  let group = null, cur = null;
  const push = function () {
    if (!cur) return;
    // **묶음 안에서 자기 글을 따로 가진 문항은 공유 지문을 쓰지 않는다**(2026-11-02 원당고2 실전모의고사 — "1지문 5문항" 양식).
    // [1-5] 묶음인데 1~3번만 '윗글의 …' 로 공유 지문을 쓰고, 4번 무관·5번 순서·9번 삽입·20번 빈칸은
    // 발문 밑에 **자기 지문**(번호를 박은 판·(A)(B)(C) 판)을 따로 싣는다. 발문에 '윗글' 이 없고 발문 밑에 글이 있으면 그쪽이다.
    // 삽입은 주어진 문장 한 줄만 있고 본문은 윗글일 수 있으니 두 문단 이상일 때만 자기 지문으로 본다.
    if (cur.shared && !/윗글/.test(cur.prompt) && cur.given.length >= (/주어진 문장이 들어가/.test(cur.prompt) ? 2 : 1)) {
      cur.shared = false; cur.lead = ''; cur.gFrom = 0; cur.gTo = 0; cur.gLabel = '';
      cur.pi = cur.qi; cur.passage = cur.given; cur.given = [];
    }
    if (!cur.shared) {
      // 빈 줄 없이 붙어 온 자기 지문을 모양으로 가른다 — 순서: (A)~(E) 단락부터 주어진글 · 요약: ↓ 부터 주어진글 · 삽입: 첫 문단이 주어진 문장.
      // 발문으로 유형을 확인하고 가른다 — '(A) …… (B)' 같은 빈칸 보조줄을 단락으로 잡지 않게(실측: 원당고1 17번).
      const a = /순서/.test(cur.prompt) ? cur.passage.findIndex(function (t) { return /^\([A-E]\)/.test(t); }) : -1;
      const r = cur.passage.indexOf('↓');
      const cut = a > 0 ? a : (r > 0 ? r : -1);
      if (cut > 0) { cur.given = cur.passage.slice(cut).concat(cur.given); cur.passage = cur.passage.slice(0, cut); }
      else if (/주어진 문장이 들어가/.test(cur.prompt) && cur.passage.length >= 2 && !cur.given.length) { cur.given = [cur.passage[0]]; cur.passage = cur.passage.slice(1); }
    }
    items.push(cur); cur = null;
  };
  let gap = false;                 // 직전에 빈 줄이 있었나 — 덩어리 경계다
  for (let i = 0; i < ps.length; i++) {
    const tu = ps[i], t = hxPlain(tu);
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
    // 마침표를 빠뜨린 번호('14 다음 중 …' — 2026-11-01 실측)는 **바로 다음 번호이고 발문 말로 시작할 때만** 문항으로 본다.
    // 지문 속 '10 minutes later' 같은 숫자를 문항으로 잡지 않기 위해서다.
    if (!m && cur) {
      const m2 = t.match(/^(\d{1,2})[)번]?\s+((?:다음|윗글|위\s*글|아래|글의|밑줄|빈칸|괄호|우리말|어법|주어진|각\s|두\s|세\s)\S*.*)$/);
      if (m2 && Number(m2[1]) === cur.no + 1) m = m2;
    }
    // 번호 상한 99 — 60 으로 막아 두었더니 75문항짜리 확정범위 모고의 61번부터가 통째로 빠졌다(2026-11-01 실측)
    if (m && Number(m[1]) <= 99 && (!cur || Number(m[1]) === cur.no + 1)) {
      push();
      const sp = hxTailParen(m[2]);
      // 괄호가 출처처럼 보일 때만 뗀다(발문 안의 '(A), (B)' 같은 괄호를 뺏기지 않게)
      const looksSource = sp.paren && /지문|과\s|과$|고\d|중\d|영어|모의|학년/.test(sp.paren);
      const no = Number(m[1]);
      const inGroup = !!(group && no >= group.from && no <= group.to);
      cur = {
        no: no,
        prompt: looksSource ? sp.head : t.replace(/^\d{1,2}[.)번]?\s*/, '').trim(),
        source: looksSource ? sp.paren : (inGroup ? group.source : ''),
        lead: inGroup ? group.lead : '',
        gFrom: inGroup ? group.from : 0, gTo: inGroup ? group.to : 0,
        gLabel: inGroup ? group.label : '',
        pi: inGroup ? group.pi : i,          // 원문에서 이 문항(묶음이면 묶음 머리)이 시작하는 문단
        qi: i,                               // 이 문항의 번호 줄 — AI 검사가 묶음 원문을 문항별로 잘라 보낼 때 쓴다
        piEnd: i,
        passage: inGroup ? group.passage.slice() : [],
        shared: inGroup, given: [], choices: [], answer: 0, explain: '',
      };
      if (tu !== t) {
        const at = t.indexOf(cur.prompt);
        const pu = at < 0 ? '' : hxUlSlice(tu, at, at + cur.prompt.length);
        if (pu.indexOf(HX_UL_ON) >= 0) cur.promptU = pu;
      }
      gap = false;
      continue;
    }
    if (!cur) { if (group) group.passage.push(tu); continue; }
    if (hxIsChoice(t)) { cur.choices.push(tu.slice(1).trim()); cur.piEnd = i; continue; }
    // 선지 바로 밑의 '→ …' 줄은 **그 선지의 둘째 줄**이다(2026-11-12 실측 — 중1 5과 9번 '문장의 전환이 바르지 않은 것':
    // ① I'll bring you the thick coat. / → I'll bring the thick coat to you.). 다음 문항의 지문으로 보면 선지가 ① 하나로 잘린다.
    // 빈 줄 없이 붙어 있고 화살표로 시작할 때만 — 요약 문항의 '↓' 는 방향이 달라 걸리지 않는다.
    if (cur.choices.length && !gap && /^[→⇒➡➜➔=]/.test(t)) { cur.choices[cur.choices.length - 1] += String.fromCharCode(10) + tu; cur.piEnd = i; continue; }
    // 선지가 이미 나온 뒤의 글자는 다음 덩어리(다음 문항의 지문)다
    if (cur.choices.length) { push(); if (group) group.passage.push(tu); continue; }
    // 빈 줄로 갈린 덩어리 단위로 담는다 — 첫 덩어리가 지문, 그 뒤는 주어진 글.
    // (묶음 문항은 지문을 공유하므로 전부 주어진 글로 간다)
    cur.piEnd = i;
    // 요약 문항의 화살표는 빈 줄이 없어도 경계다 — 지문 / ↓ / 요약문 이 붙어 나온다(실측).
    if (/^[↓⇩⬇]+$/.test(t)) gap = true;
    const first = !cur.shared && !cur.blocks;
    if (first) cur.blocks = 1;
    else if (gap) cur.blocks = (cur.blocks || 0) + 1;
    if (!cur.shared && cur.blocks === 1) cur.passage.push(tu);
    else cur.given.push(tu);
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
/** 정답 칸 앞에 붙은 라벨 — '(정답) ③' · '정답: ③' · '답 ③' — 을 떼고 hxPick. 표·빠른 정답의 칸에도 라벨을 적는 선생님이 있다. */
const HX_ANS_LABEL = /^\s*(?:\(\s*정답\s*\)|\[\s*정답\s*\]|정답|답)?\s*[:：]?\s*/;
function hxPickAns(s) { return hxPick(String(s || '').replace(HX_ANS_LABEL, '')); }
/** 정답·해설(section1 표: 번호 / 정답 / 해설…) → { 번호: {answer, explain} } */
function hxAnswers(ps) {
  const out = {};
  for (let i = 0; i < ps.length; i++) {
    const n = ps[i].match(/^(\d{1,2})\s*[.)번]?$/);
    if (!n || !ps[i + 1] || !hxPickAns(ps[i + 1])) continue;
    const ex = [];
    for (let j = i + 2; j < ps.length && !/^\d{1,2}\s*[.)번]?$/.test(ps[j]); j++) if (ps[j]) ex.push(ps[j]);
    out[Number(n[1])] = { answer: hxPickAns(ps[i + 1]), explain: ex.join('\n') };
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
    if (hxPickAns(t) && nums.length) {
      const picks = [];
      let j = i;
      for (; j < ps.length && (!ps[j] || hxPickAns(ps[j])); j++) if (ps[j]) picks.push(hxPickAns(ps[j]));
      nums.forEach(function (no, k) { if (picks[k]) out[no] = { answer: picks[k], explain: '' }; });
      nums = []; i = j - 1;
    }
  }
  return out;
}

/** **.hwpx 만 받는다**(2026-10-23 사장님 — 한글 문서는 일절 받지 말고 변환 방법을 안내할 것).
 *  알맹이로 확인한다: zip 이 아니면 어떤 이름이든 거절하고 변환 방법을 돌려준다. → 구역별 문단 배열 */
async function hxSections(ab) { return (await hxSectionsRaw(ab)).secs; }
/** → { secs: 구역별 맨글자 문단, marked0: 구역 0(문제지)의 밑줄 표시가 든 문단(밑줄이 없는 파일이면 null) } */
async function hxSectionsRaw(ab) {
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
  const xmls = names.map(function (n) { return new TextDecoder('utf-8').decode(zip.get(n)); });
  const headXml = zip.get('Contents/header.xml');
  const ul = headXml ? hxUnderlined(new TextDecoder('utf-8').decode(headXml)) : {};
  return { secs: xmls.map(function (x) { return hxParas(x); }), marked0: Object.keys(ul).length ? hxParas(xmls[0], ul) : null };
}

/** **줄글 답지** — 번호와 정답이 한 줄에 적힌 꼴 전부(2026-10-25 · 2026-11-01 실측으로 넓힘).
 *    '1.(정답) ③'  ·  '1. 정답: ③'  ·  '1) 정답 ③'  ·  '1번 답: ③'  ·  '교과서문제1. 정답: ①'(머리글이 같은 문단에 붙어 옴)  ·  '01    정답  ①'(앞 0 · 라벨 뒤 빈칸만 — 실전모의고사 답지)
 *  라벨(정답/답)이 있으면 줄 어디에 있든 잡는다 — 한글 문서는 머리글·본문이 한 문단으로 붙어 나오는 일이 흔하다.
 *  해설은 **다음 번호가 나올 때까지 전부** 가져간다 — 표를 읽는 hxAnswers 와 같은 규칙이다.
 *  중간에 빈 줄이 있어도 끊지 않는다. 끊으면 긴 해설의 뒷부분을 잃는다. '[해설]'·'(해설)'·'해설:' 머리말만 뗀다. */
const HX_PICKS = '[①②③④⑤](?:\\s*[,·、/]?\\s*[①②③④⑤])*';
const HX_INLINE_LABELED = new RegExp('(\\d{1,3})\\s*[.)번]?\\s*(?:\\(\\s*정답\\s*\\)|\\[\\s*정답\\s*\\]|정답|답)\\s*[:：]?\\s*(' + HX_PICKS + ')(?![①②③④⑤])', 'g');
function hxInlineAnswers(ps) {
  const out = {};
  const starts = [];   // { no, pick, at(문단), from(그 문단에서 정답 뒤 글이 시작하는 자리), head(문단에서 번호 앞 글) }
  for (let i = 0; i < ps.length; i++) {
    const t = String(ps[i] || '');
    HX_INLINE_LABELED.lastIndex = 0;
    let m;
    while ((m = HX_INLINE_LABELED.exec(t))) {
      // 번호 바로 앞이 숫자면(예: '2024. 11. 정답') 번호가 아니다
      if (m.index > 0 && /\d/.test(t.charAt(m.index - 1))) continue;
      const pick = hxPick(m[2]);
      if (!pick) continue;
      starts.push({ no: Number(m[1]), pick: pick, at: i, from: m.index + m[0].length, idx: m.index });
    }
  }
  // 머리말 떼기 — (해설) · [해설] · 해설: · 「해설   …」(라벨 뒤에 빈칸만 — 2026-11-01 실전모의고사 답지)
  const strip = function (t) { return t.replace(/^(?:\(\s*해설\s*\)|\[\s*해설\s*\]|해설\s*[:：]|해설(?=\s))\s*/, '').trim(); };
  starts.forEach(function (s, k) {
    const next = starts[k + 1];
    const ex = [];
    const line = String(ps[s.at] || '');
    // 같은 문단에 다음 번호가 또 있으면(한 줄에 여러 쌍) 거기까지만 이 문항의 글이다
    const sameLine = next && next.at === s.at;
    const tail = line.slice(s.from, sameLine ? next.idx : undefined);
    if (tail.trim()) ex.push(tail);
    if (!sameLine) {
      const endAt = next ? next.at : ps.length;
      for (let j = s.at + 1; j < endAt; j++) if (String(ps[j] || '').trim()) ex.push(ps[j]);
      // 다음 번호가 문단 머리가 아니라 중간에 있으면 그 앞 글은 이 문항의 해설이다
      if (next) { const head = String(ps[next.at] || '').slice(0, next.idx); if (head.trim()) ex.push(head); }
    }
    out[s.no] = { answer: s.pick, explain: ex.map(strip).filter(Boolean).join('\n') };
  });
  return out;
}

/** **번호와 동그라미만** 늘어놓은 답지 — '1. ③' · '1 ③' · '1) ③  2) ①  3) ⑤'(한 줄에 여러 쌍).
 *  라벨이 없어 오탐 여지가 있으므로 **문단 전체가 쌍으로만** 이루어진 줄만 본다(마지막 수단). */
const HX_PAIR = new RegExp('(\\d{1,3})\\s*[.)번]?\\s*[:：]?\\s*(' + HX_PICKS + ')', 'g');
const HX_PAIR_LINE = new RegExp('^(?:\\s*\\d{1,3}\\s*[.)번]?\\s*[:：]?\\s*' + HX_PICKS + '\\s*[,;|]?\\s*)+$');
function hxBareAnswers(ps) {
  const out = {};
  ps.forEach(function (t) {
    t = String(t || '').trim();
    if (!t || !HX_PAIR_LINE.test(t)) return;
    HX_PAIR.lastIndex = 0;
    let m;
    while ((m = HX_PAIR.exec(t))) { const p = hxPick(m[2]); if (p && !out[Number(m[1])]) out[Number(m[1])] = { answer: p, explain: '' }; }
  });
  return out;
}

/** 구역 여러 개에서 정답을 긁는다 — 해설 표 → 빠른 정답 찾기 → 줄글 답지 → 번호·동그라미만 적힌 줄 순.
 *  **먼저 걸린 방식이 으뜸이고, 거기 없는 번호는 뒤 방식에서 채운다**(2026-11-01). 예전엔 하나만 썼는데,
 *  해설이 두 문항뿐이고 '빠른 정답' 목록이 40개인 답지를 올리면 2개만 읽혔다. 이미 있는 번호는 덮지 않는다
 *  (해설이 달린 쪽을 지킨다). 구역마다 같은 방식으로 읽은 결과도 같은 규칙으로 합친다. */
function hxAnswersFrom(sections) {
  const readers = [hxAnswers, hxQuickAnswers, hxInlineAnswers, hxBareAnswers];
  const ans = {};
  readers.forEach(function (read) {
    sections.forEach(function (ps) {
      const a = read(ps);
      Object.keys(a).forEach(function (no) { if (!ans[no]) ans[no] = a[no]; });
    });
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

/** .hwpx 파일(ArrayBuffer) → { head, items, paras, parasU }. paras 는 문제지 원문 문단(AI 검사가 대조에 쓴다 — 맨글자),
 *  parasU 는 같은 문단에 밑줄 표시가 든 판(AI 가 다시 쪼갠 문항에 밑줄을 되붙일 때 쓴다). */
async function hwpxParse(ab) {
  const raw = await hxSectionsRaw(ab);
  const secs = raw.secs;
  const parasU = raw.marked0 || secs[0];
  const head = hxHeader(secs[0]);
  const items = hxItems(parasU);

  // 정답: 해설 표가 있으면 그쪽, 없으면 빠른 정답 찾기. 문제지 구역(0)은 빼고 본다.
  const ans = hxAnswersFrom(secs.slice(1));
  items.forEach(function (it) {
    const a = ans[it.no];
    if (a) { it.answer = a.answer; it.explain = a.explain; }
  });

  // 규칙과 다르다고 경고하지 않는다(2026-10-22 사장님) — 선지가 번호뿐인 유형(삽입·순서),
  // 지문을 공유하는 묶음 문항처럼 **정상인데 규칙과 다른 모양**이 흔해서 경고가 더 헷갈렸다.
  // 읽은 결과는 등록 창의 '30문항 · 정답 30개' 와 '시험지 보기' 로 직접 확인한다.
  return { head: head, items: items, paras: secs[0], parasU: parasU };
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
    // 발문의 밑줄('옳지 않은')은 promptU 에 있다. AI 검사가 발문을 고쳤으면 옛 것이라 안 쓴다.
    const pr = (it.promptU && hxPlain(it.promptU) === it.prompt) ? it.promptU : it.prompt;
    const stem = it.shared ? pr : pr + srcTail;

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
