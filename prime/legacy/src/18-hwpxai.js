// 규칙으로 쪼갠 시험지를 Claude 가 검사하고, 틀린 덩어리만 다시 쪼갠다 (사장님 2026-10-22)
//
//   ① 17-hwpx.js 의 규칙 파서가 쪼갠다 (공짜·즉시)
//   ② Claude 가 원문과 대조해 **잘못 쪼갠 덩어리만** 집는다
//   ③ 집힌 덩어리만 Claude 가 다시 쪼갠다
//   ④ **되돌아온 글자가 원문에 그대로 있는지 기계로 확인**하고, 하나라도 없으면 버리고 규칙 결과를 쓴다
//
// ④ 가 이 구조의 핵심이다. 모델이 '다시 쪼갠다' 는 것은 글자를 새로 쓸 수 있다는 뜻이고,
// 이 레포의 규칙은 **본문을 창작·의역하지 않는다** 이다. 그래서 모델을 믿지 않고 대조한다 —
// 모델이 한 글자라도 지어내면 그 덩어리는 통째로 버린다.
//
// 키는 app_config.anthropic_api_key (10-illust.js 의 illGetConfig 를 그대로 쓴다. 코드에 키를 넣지 않는다).
// 모델이 돌려준 말은 **자료**지 지시가 아니다 — 코드가 따르지 않고, 대조를 통과한 글자만 쓴다.

const AC_URL = 'https://api.anthropic.com/v1/messages';
const AC_VER = '2023-06-01';
// 둘 다 Opus 5.5 — 사장님 지시(2026-10-22). 싼 모델로 내리지 않는다.
const AC_CHECK_MODEL = 'claude-opus-5-5';
const AC_FIX_MODEL = 'claude-opus-5-5';
const AC_POOL = 6;                            // 동시에 보낼 덩어리 수

/** 한 번 호출. 429·5xx 는 조금 기다렸다 다시 부른다. */
async function acCall(key, model, body, signal) {
  for (let a = 0; a < 4; a++) {
    const res = await fetch(AC_URL, {
      method: 'POST', signal: signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': AC_VER,
        // 렌더러(브라우저·Electron)에서 직접 부르려면 이 헤더가 있어야 한다
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(Object.assign({ model: model }, body)),
    });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && a < 3) {
      await new Promise(function (r) { setTimeout(r, 1500 * (a + 1)); });
      continue;
    }
    const t = await res.text();
    throw new Error('Claude ' + res.status + ' — ' + t.slice(0, 200));
  }
}
/** 구조화 출력(JSON)만 받는다. */
function acJson(data) {
  const parts = (data && data.content) || [];
  const txt = parts.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  try { return JSON.parse(txt); } catch (e) { throw new Error('응답을 읽지 못했습니다.'); }
}

/** 문항을 지문 묶음 단위 덩어리로 나눈다 — 통째로 보내면 느리고 틀린다(실측). */
function acChunks(parsed) {
  // 같은 지문(pi)에 걸린 문항은 **붙어 있지 않아도** 한 덩어리다 — "1지문 5문항" 양식은 [1-5] 묶음 사이에
  // 자기 지문을 따로 가진 문항(4번 무관·5번 순서)이 끼어 있어, 이어진 것끼리만 묶으면 10번이 혼자 떨어져
  // 원문엔 6~9번이 있는데 쪼갠 결과엔 없다고 오탐한다(2026-11-02 실측: 15건 전부 그것).
  const out = [], byPi = {};
  (parsed.items || []).forEach(function (it) {
    const c = byPi[it.pi];
    if (c) { c.items.push(it); c.piEnd = Math.max(c.piEnd, it.piEnd); }
    else { byPi[it.pi] = { pi: it.pi, piEnd: it.piEnd, items: [it] }; out.push(byPi[it.pi]); }
  });
  return out;
}
/** 덩어리의 원문 — 묶음 머리(지시문·지문)와 **이 덩어리 문항들의 자리**만 잇는다. 사이에 낀 다른 문항은 뺀다.
 *  qi 가 없는 옛 결과(보관된 payload)는 예전처럼 처음부터 끝까지 통째로. */
function acRaw(parsed, c) {
  const ps = parsed.paras || [];
  if (c.items.some(function (x) { return x.qi == null; })) return ps.slice(c.pi, c.piEnd + 1).join('\n');
  const first = Math.min.apply(null, c.items.map(function (x) { return x.qi; }));
  const parts = c.pi < first ? [ps.slice(c.pi, first).join('\n')] : [];
  c.items.forEach(function (x) { parts.push(ps.slice(x.qi, x.piEnd + 1).join('\n')); });
  return parts.join('\n');
}
function acPlain(s) { return String(s == null ? '' : s).replace(/[\u2063\u2064]/g, ''); }
/** 우리가 쪼갠 결과 — 모델에게 보여 줄 모양 */
function acMine(c) {
  return c.items.map(function (it) {
    return {
      // 밑줄 표시(보이지 않는 글자)는 떼고 보낸다 — 모델이 볼 것이 아니고, 원문(paras)도 맨글자다
      번호: it.no, 묶음지시문: it.lead || '', 출처: it.source || '', 발문: it.prompt,
      지문: (it.passage || []).map(acPlain), 지문공유: !!it.shared, 주어진글: (it.given || []).map(acPlain),
      선지: (it.choices || []).map(acPlain), 정답: it.answer || null,
    };
  });
}

// 유형은 **닫힌 목록**으로 받는다 — 매번 다른 말로 오면 집계가 안 된다(월간 레포트가 이걸 쓴다).
// 모의고사형(앞 11개)과 내신 문법형(뒤 5개)을 함께 담았다.
// '용법'(쓰임·역할을 묻는 것)은 **어법에 합친다**(2026-10-23 사장님) — 수능·모의고사에는
// 용법 유형이 따로 없고 내신 문법 시험에만 나온다. 레포트에서 한 덩어리로 본다.
const AC_TYPES = ['대의', '일치', '어법', '어휘', '빈칸', '무관', '순서', '삽입', '요약', '지칭', '심경',
  '영작', '배열', '오류수정', '기타'];

const AC_RULES = [
  '· 한 지문에 여러 문항이 걸리면([1-3]) 그 문항들은 지문을 공유한다. 지문공유=true 인 문항의 지문 칸이 비어 있는 것은 정상이다.',
  '· 묶음([1-5]) 안이라도 발문이 "윗글"이 아니라 "다음 글"·"주어진 글"·"글의 흐름으로 보아" 이고 발문 밑에 자기 글이 있는 문항은',
  '  **자기 지문을 따로 가진 문항**이다(무관·순서·삽입·빈칸 판). 지문공유=false 에 자기 글이 지문 칸에 있는 것이 정상이고, 묶음지시문이 비어 있어도 된다.',
  '· **번호가 지문 안에 박히는 유형**(무관="전체 흐름과 관계 없는 문장", 삽입="주어진 문장이 들어가기에", 순서, 어법·어휘의 밑줄형 등)은',
  '  원문에서도 선지 줄이 ①②③④⑤ 번호뿐이고 글이 없다. 그래서 선지 다섯 개가 모두 빈 문자열인 것이 **정상**이다.',
  '  이런 유형에서 "선지가 비었다"고 지적하면 안 된다 — 지문 안의 ①~⑤ 문장을 선지로 옮겨 적는 것도 잘못이다.',
  '· 순서 문항의 (A)(B)(C) 와 요약 문항의 요약문은 지문이 아니라 주어진글에 둔다.',
  '· 맞춤법·띄어쓰기·줄바꿈 차이는 문제가 아니다.',
  '· **문제를 직접 풀지 마라.** 정답은 시험지 뒤쪽 정답표에서 따로 읽은 값이고, 아래 원문 조각에는 정답 근거가 없다.',
  '  네가 푼 답과 다르다는 이유로 정답을 지적하면 안 된다. 정답은 보지 않아도 된다.',
].join('\n');

/** ② 이 덩어리를 제대로 쪼갰는지 본다 → { ok, problems[] } */
async function acCheck(key, parsed, c, signal) {
  const data = await acCall(key, AC_CHECK_MODEL, {
    max_tokens: 2048,
    system: '너는 한글 시험지가 문항 단위로 제대로 쪼개졌는지 원문과 대조하는 검수자다. 고치지 말고 어긋난 데만 집어라. 지어내지 마라.',
    messages: [{ role: 'user', content: [
      '아래 원문을 규칙(정규식)으로 쪼갠 결과가 맞는지 보라.', '', '[서식 규칙]', AC_RULES, '',
      '[보는 것] 발문·지문·선지·출처의 **글자**가 원문과 맞는가, 지문이 옆 문항 것으로 붙지 않았는가, 통째로 빠진 문항이 있는가.',
      '[보지 않는 것] 정답 번호. 문제의 난이도·품질. 내용이 옳은지.',
      '',
      '[유형] 문항마다 유형을 아래에서 **하나** 고른다. 쪼개기가 맞든 틀리든 유형은 항상 채운다.',
      '  ' + AC_TYPES.join(' · '),
      '  발문 글자만 보고 찍지 마라. 지문과 선지까지 보고 **실제로 무엇을 묻는지**로 판단하라.',
      '  예: "빈칸에 들어갈 말을 고르시오" 라도 선지가 one/any/every 처럼 문법 요소면 빈칸이 아니라 **어법**이다.',
      '      "우리말을 영어로 옮긴 것" 은 영작, "주어진 말을 배열" 은 배열, "밑줄 친 부분을 바르게 고치시오" 는 오류수정.',
      '  **쓰임·역할을 묻는 것(용법)도 어법으로 본다** — "밑줄 친 부분과 쓰임이 다른 것", "재귀대명사의 역할" 같은 것.',
      '  어디에도 안 맞으면 기타.',
      '', '=== 원문 ===', acRaw(parsed, c), '', '=== 쪼갠 결과 ===', JSON.stringify(acMine(c), null, 1),
    ].join('\n') }],
    output_config: { format: { type: 'json_schema', schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        problems: { type: 'array', items: { type: 'object', properties: {
          no: { type: 'integer' }, kind: { type: 'string' }, detail: { type: 'string' },
        }, required: ['no', 'kind', 'detail'], additionalProperties: false } },
        types: { type: 'array', items: { type: 'object', properties: {
          no: { type: 'integer' }, type: { type: 'string', enum: AC_TYPES },
        }, required: ['no', 'type'], additionalProperties: false } },
      },
      required: ['ok', 'problems', 'types'], additionalProperties: false,
    } } },
  }, signal);
  const j = acJson(data);
  return {
    ok: j.ok !== false,
    problems: Array.isArray(j.problems) ? j.problems : [],
    types: Array.isArray(j.types) ? j.types : [],
  };
}

/** ③ 이 덩어리를 다시 쪼갠다 → items[] (우리 파서와 같은 모양) */
async function acFix(key, parsed, c, problems, signal) {
  const data = await acCall(key, AC_FIX_MODEL, {
    max_tokens: 8192,
    system: '너는 한글 시험지를 문항 단위로 쪼개는 일만 한다. **원문의 글자를 그대로 복사**하라. 고치거나 다듬거나 번역하거나 요약하지 마라. 원문에 없는 글자를 쓰면 결과 전체가 버려진다.',
    messages: [{ role: 'user', content: [
      '아래 원문을 문항 단위로 쪼개라.', '', '[서식 규칙]', AC_RULES, '',
      '[앞선 검수가 지적한 것]', problems.map(function (p) { return '· ' + p.no + '번 [' + p.kind + '] ' + p.detail; }).join('\n') || '· (없음)',
      '', '지문·발문·선지는 원문 문장을 **글자 그대로** 옮겨라. 번호(N.)와 선지 기호(①~⑤)는 떼고 내용만 담아라.',
      '', '=== 원문 ===', acRaw(parsed, c),
    ].join('\n') }],
    output_config: { format: { type: 'json_schema', schema: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: {
        no: { type: 'integer' },
        lead: { type: 'string' }, source: { type: 'string' }, prompt: { type: 'string' },
        passage: { type: 'array', items: { type: 'string' } },
        given: { type: 'array', items: { type: 'string' } },
        choices: { type: 'array', items: { type: 'string' } },
        shared: { type: 'boolean' },
      }, required: ['no', 'lead', 'source', 'prompt', 'passage', 'given', 'choices', 'shared'], additionalProperties: false } } },
      required: ['items'], additionalProperties: false,
    } } },
  }, signal);
  const j = acJson(data);
  return Array.isArray(j.items) ? j.items : [];
}

// ── 지어낸 글자 막기 ──────────────────────────────────────────────
/** 대조용으로 공백·따옴표 차이를 지운다(원문과 모델 출력의 사소한 차이는 봐준다). */
function acNorm(s) {
  return String(s == null ? '' : s)
    .replace(/[‘’“”]/g, "'")
    .replace(/[\s ]+/g, '')
    .trim();
}
/** 모델이 돌려준 글자가 전부 원문에 있나. 하나라도 없으면 false(그 덩어리는 버린다). */
function acVerbatim(items, rawText) {
  const hay = acNorm(rawText);
  const bad = [];
  items.forEach(function (it) {
    const probe = [it.prompt].concat(it.passage || [], it.given || [], it.choices || []);
    probe.forEach(function (t) {
      const n = acNorm(t);
      if (n.length >= 4 && hay.indexOf(n) < 0) bad.push({ no: it.no, text: String(t).slice(0, 40) });
    });
  });
  return bad;
}

/** 모델이 다시 쪼갠 문항을 **규칙 파서와 같은 모양**으로 맞춰 갈아 끼운다 → 갈아 끼운 수.
 *  모델 결과와 코드가 부딪히던 자리를 전부 여기서 맞춘다(2026-11-02 사장님 — "코드랑 충돌이 없게").
 *   · 묶음 표기: 모델은 지시문에 '[1-5]' 를 붙여 오는데 파서는 gLabel 에 따로 둔다 — 떼어서 gLabel 로. 안 떼면 화면에 '[1-5] [1-5] …' 로 겹친다(실측).
 *   · 공유를 푼 문항(자기 지문): 지시문·묶음 표기를 비운다 — 남아 있으면 그 문항이 묶음 머리인 줄 안다.
 *   · 공유로 돌린 문항: 묶음 표기가 없으면 같은 덩어리의 것을 물려받는다.
 *   · 묶음 지문은 **공유하는 문항에만** 채운다 — 순서·삽입처럼 자기 지문을 가진 문항에 넣으면 그림이 깨진다(실측: 5·13·22·35번).
 *   · 정답은 건드리지 않는다 — 시험지 뒤 정답표에서 읽은 값이고, 이 조각에는 근거가 없다.
 *   · 밑줄: 모델이 돌려준 글에는 밑줄 표시가 없다. marked(이 덩어리 원문의 밑줄 표시가 든 문단)를 주면 되붙인다(17-hwpx.js 의 hxRemark). */
function acApplyFix(items, got, c, marked) {
  const re = function (t) { return (marked && typeof hxRemark === 'function') ? hxRemark(t, marked) : t; };
  let n = 0;
  const LABEL = /^\s*(\[\s*(\d+)\s*[-~]\s*(\d+)\s*\])\s*/;
  const inherit = c.items.filter(function (x) { return x.gLabel; })[0];
  got.forEach(function (g) {
    const old = items.filter(function (x) { return x.no === g.no; })[0];
    if (!old) return;
    const m = String(g.lead || '').match(LABEL);
    old.prompt = g.prompt; old.source = g.source || old.source;
    old.lead = String(g.lead || old.lead || '').replace(LABEL, '').trim();
    old.passage = (g.passage || []).map(re); old.given = (g.given || []).map(re); old.choices = (g.choices || []).map(re);
    old.shared = !!g.shared;
    // 발문이 '윗글' 이면 공유 문항이다 — 모델이 묶음 첫 문항에 지문을 주면서 공유를 풀어 보낸 일이 있다(실측: 6·16·36번).
    // 그러면 다음 문항이 묶음 머리가 되어 지문이 두 번 찍힌다. 발문이 말해 주는 것을 모델 플래그보다 믿는다.
    if (!old.shared && /윗글/.test(old.prompt) && c.items.some(function (x) { return x !== old && x.shared; })) old.shared = true;
    if (!old.shared) { old.lead = ''; old.gLabel = ''; old.gFrom = 0; old.gTo = 0; }
    else if (m) { old.gLabel = m[1]; old.gFrom = Number(m[2]); old.gTo = Number(m[3]); }
    else if (!old.gLabel && inherit) { old.gLabel = inherit.gLabel; old.gFrom = inherit.gFrom; old.gTo = inherit.gTo; }
    old.aiFixed = true;
    n++;
  });
  const psg = c.items.filter(function (x) { return x.shared && (x.passage || []).length; })[0];
  if (psg && c.items.length > 1) c.items.forEach(function (x) { if (x.shared && !(x.passage || []).length) x.passage = psg.passage.slice(); });
  return n;
}

/** ①~④ 전체. onStep(진행글) 으로 상태를 알려 준다. → { problems, fixed, rejected, checked } */
async function hwpxAiReview(parsed, onStep, signal) {
  const key = await illGetConfig('anthropic_api_key');
  if (!key) throw new Error('Anthropic API 키가 없습니다 — 관리자가 app_config.anthropic_api_key 를 넣어야 합니다.');
  const chunks = acChunks(parsed);
  const say = onStep || function () {};

  // ② 검사 — 동시에 AC_POOL 개씩
  const checks = new Array(chunks.length);
  let done = 0, next = 0;
  await Promise.all(new Array(Math.min(AC_POOL, chunks.length)).fill(0).map(async function () {
    for (;;) {
      const i = next++;
      if (i >= chunks.length) return;
      try { checks[i] = await acCheck(key, parsed, chunks[i], signal); }
      catch (e) { checks[i] = { ok: true, problems: [], error: String((e && e.message) || e) }; }   // 실패는 '문제없음' 으로 둔다 — 못 봤다고 멀쩡한 걸 갈아엎지 않는다
      say('대조 ' + (++done) + '/' + chunks.length);
    }
  }));

  // 유형을 문항에 붙인다 — 쪼개기가 맞든 틀리든 유형은 항상 받는다.
  // 목록에 없는 말이 오면 버린다(집계가 깨지지 않게).
  let typed = 0;
  checks.forEach(function (r, i) {
    if (!r || !r.types) return;
    r.types.forEach(function (t) {
      if (AC_TYPES.indexOf(t.type) < 0) return;
      const it = chunks[i].items.filter(function (x) { return x.no === t.no; })[0];
      if (it) { it.aiType = t.type; typed++; }
    });
  });

  const flagged = [];
  checks.forEach(function (r, i) { if (r && !r.ok && r.problems.length) flagged.push({ i: i, problems: r.problems }); });
  // 대조하지 못한 곳은 **문항 번호**로 돌려준다(화면에 그대로 보여 주려고)
  const unchecked = [];
  checks.forEach(function (r, i) {
    if (r && r.error) chunks[i].items.forEach(function (it) { unchecked.push(it.no); });
  });
  if (!flagged.length) return { checked: chunks.length, problems: [], fixed: 0, rejected: [], unchecked: unchecked, typed: typed };

  // ③ 집힌 덩어리만 다시 쪼갠다 → ④ 원문 대조 후 교체
  let fixed = 0;
  const rejected = [];
  const problems = [];
  for (let k = 0; k < flagged.length; k++) {
    const f = flagged[k];
    const c = chunks[f.i];
    f.problems.forEach(function (p) { problems.push(p); });
    say('다시 쪼개는 중 ' + (k + 1) + '/' + flagged.length);
    let got = [];
    try { got = await acFix(key, parsed, c, f.problems, signal); }
    catch (e) { rejected.push({ nos: c.items.map(function (x) { return x.no; }), why: String((e && e.message) || e) }); continue; }
    const bad = acVerbatim(got, acRaw(parsed, c));
    if (bad.length) {
      rejected.push({ nos: c.items.map(function (x) { return x.no; }), why: '원문에 없는 글자가 섞였습니다(' + bad[0].no + '번 "' + bad[0].text + '…")' });
      continue;
    }
    // 통과 — 그 덩어리의 문항을 갈아 끼운다(원래 자리·문단 번호는 유지)
    fixed += acApplyFix(parsed.items, got, c, parsed.parasU ? parsed.parasU.slice(c.pi, c.piEnd + 1) : null);
  }
  return { checked: chunks.length, problems: problems, fixed: fixed, rejected: rejected, unchecked: unchecked, typed: typed };
}
