// 주간테스트 v2 — 그 주에 배운 지문으로 보는 모의고사형 객관식 시험지.
// 규격서: 레포 루트 Weekly-Test.md (2026-09-17 사장님 확정). v1(격자·어법 3종·단어·해석)은 폐기했다.
//
//  · 유형 7종: 대의·일치·어법·어휘·무관 = 사내 엔진 / 순서·삽입 = 이 파일의 코드(정답이 원문 안에서 정해진다).
//  · 선생님은 지문과 **지문당 문항 수**만 고른다. 어떤 지문에 어떤 유형을 줄지는 코드가 정하되,
//    시험 전체로 유형이 고르게, 정답 번호 ①~⑤도 고르게 나오게 한다. 배점은 없다.
//  · 문항마다 ① 프롬프트로 그 문항만 재생성 ② 텍스트 직접 수정 이 된다.
//  · 양식은 평가원 양식(Saas pyeonggawon 스킬의 frame.hwpx)을 HTML 로 똑같이 그린다 — 화면에서 바로 고치고,
//    한글이 없는 PC·맥에서도 인쇄·PDF 가 돼야 해서다. 정답지는 맨 뒤.

// ── 유형 ─────────────────────────────────────────────────────────
// 시험지 안의 순서도 이 배열 순서(= 모의고사 번호 순서)를 따른다.
const WT_TYPES = [
  { k: 'gist', label: '대의', no: '18~24', eng: true },
  { k: 'fact', label: '일치', no: '26', eng: true },
  { k: 'grammar', label: '어법', no: '29', eng: true },
  { k: 'vocab', label: '어휘', no: '30', eng: true },
  { k: 'irrelevant', label: '무관', no: '35', eng: true },
  { k: 'order', label: '순서', no: '36~37', eng: false },
  { k: 'insert', label: '삽입', no: '38~39', eng: false },
];
const WT_TYPE = {};
WT_TYPES.forEach((t, i) => { WT_TYPE[t.k] = Object.assign({ idx: i }, t); });

// 유형마다 지문에 필요한 최소 문장 수. 모자라면 그 지문에는 그 유형을 주지 않는다.
const WT_MIN_SENT = { gist: 3, fact: 3, grammar: 3, vocab: 3, irrelevant: 5, order: 4, insert: 6 };   // 무관 = 원문 4문장 + 끼울 1문장(엔진 규칙)

const WT_GIST_SUBS = [
  { k: 'purpose', label: '목적', stem: '다음 글의 목적으로 가장 적절한 것은?' },
  { k: 'claim', label: '주장', stem: '다음 글에서 필자가 주장하는 바로 가장 적절한 것은?' },
  { k: 'point', label: '요지', stem: '다음 글의 요지로 가장 적절한 것은?' },
  { k: 'topic', label: '주제', stem: '다음 글의 주제로 가장 적절한 것은?' },
  { k: 'title', label: '제목', stem: '다음 글의 제목으로 가장 적절한 것은?' },
];
const WT_FACT_SUBS = [
  { k: 'mismatch', label: '불일치', stem: '다음 글의 내용과 일치하지 않는 것은?' },
  { k: 'match', label: '일치', stem: '다음 글의 내용과 일치하는 것은?' },
];
const WT_STEMS = {
  grammar: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?',
  vocab: '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?',
  irrelevant: '다음 글에서 전체 흐름과 관계 없는 문장은?',
  order: '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?',
  insert: '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?',
};
function wtStem(type, sub) {
  const list = type === 'gist' ? WT_GIST_SUBS : type === 'fact' ? WT_FACT_SUBS : null;
  if (list) { const s = list.filter(x => x.k === sub)[0]; return s ? s.stem : list[type === 'gist' ? 3 : 0].stem; }
  return WT_STEMS[type] || '';
}
const WT_CIRC = ['①', '②', '③', '④', '⑤'];
/** 정답 값 → 동그라미. 복수정답은 번호를 이어 붙여 저장하므로(35) 한 자리씩 바꾼다(③⑤). 없으면 ''. */
const wtCirc = (a) => String(a || '').split('').map(d => WT_CIRC[Number(d) - 1] || '').join('');
// 모의고사 순서 배열 선지(고정). 문자열 = 정답일 때의 덩어리 순서.
const WT_ORDER_KEYS = ['ACB', 'BAC', 'BCA', 'CAB', 'CBA'];
const WT_ORDER_CHOICES = WT_ORDER_KEYS.map(s => '(' + s[0] + ') - (' + s[1] + ') - (' + s[2] + ')');

// ── 시드 난수 ─────────────────────────────────────────────────────
// 같은 선택·같은 시드면 같은 배치가 나와야 한다('다시 섞기' 전까지 화면이 흔들리지 않게).
function wtRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function wtShuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// ── 배치: 어떤 지문에 어떤 유형을 줄지 ───────────────────────────────
// 1) 전체 문항 수 N 을 7유형에 고르게 나눈다(나머지는 시드로 고른 유형에).
// 2) 제약이 큰 지문(문장이 짧아 낼 수 있는 유형이 적은 지문)부터, 남은 개수가 많은 유형을 준다.
//    한 지문에 같은 유형은 두 번 주지 않는다.
// 3) 정답 번호 목표를 ①~⑤ 고르게 섞어 문항 순서대로 붙인다.
function wtPlan(sheets, perPassage, seed) {
  const rnd = wtRng(seed * 9973 + 17);
  const pass = sheets.map((sh, no) => {
    const n = (sh.rawSentences || []).filter(s => String(s || '').trim()).length;
    const elig = WT_TYPES.filter(t => n >= WT_MIN_SENT[t.k]).map(t => t.k);
    return { sh, no, n, elig, want: Math.min(perPassage, elig.length) };
  });
  const N = pass.reduce((s, p) => s + p.want, 0);
  const left = {};
  const base = Math.floor(N / WT_TYPES.length), rem = N % WT_TYPES.length;
  WT_TYPES.forEach(t => { left[t.k] = base; });
  wtShuffle(WT_TYPES.map(t => t.k), rnd).slice(0, rem).forEach(k => { left[k] += 1; });
  const tie = {};
  wtShuffle(WT_TYPES.map(t => t.k), rnd).forEach((k, i) => { tie[k] = i; });

  const out = [];
  pass.slice().sort((a, b) => (a.elig.length - b.elig.length) || (a.no - b.no)).forEach(p => {
    const pick = p.elig.slice().sort((a, b) => (left[b] - left[a]) || (tie[a] - tie[b])).slice(0, p.want);
    pick.forEach(k => { left[k] -= 1; out.push({ key: p.sh.key, no: p.no, type: k }); });
  });
  out.sort((a, b) => (WT_TYPE[a.type].idx - WT_TYPE[b.type].idx) || (a.no - b.no));

  // 정답 번호: 1~5 를 고르게 깔고 섞은 뒤, 같은 번호가 연달아 붙은 곳을 뒤쪽과 바꿔 흩는다.
  // **어법은 뺀다**(사장님 지시 2026-09-17). 어법은 루시가 오류 자리를 스스로 골라 번호를 맞출 수 없으므로
  // 목표 번호를 주지 않고, 나머지 유형끼리만 고르게 나눈다.
  const aimed = out.filter(p => p.type !== 'grammar');
  let ans = wtShuffle(Array.from({ length: aimed.length }, (_, i) => (i % 5) + 1), rnd);
  for (let i = 1; i < ans.length; i++) {
    if (ans[i] !== ans[i - 1]) continue;
    for (let j = i + 1; j < ans.length; j++) {
      if (ans[j] !== ans[i - 1] && (j + 1 >= ans.length || ans[i] !== ans[j + 1])) { const t = ans[i]; ans[i] = ans[j]; ans[j] = t; break; }
    }
  }
  // 일치는 불일치·일치를 번갈아 낸다(모의고사처럼 불일치가 먼저).
  let factN = 0, ai = 0;
  return out.map((p) => ({
    id: p.key + '#' + p.type, key: p.key, no: p.no, type: p.type,
    target: p.type === 'grammar' ? 0 : ans[ai++],
    sub: p.type === 'fact' ? WT_FACT_SUBS[(factN++) % 2].k : ''
  }));
}

// ── 순서·삽입: 앱 코드로 만든다 ─────────────────────────────────────
// variant 가 바뀌면(재생성) 자르는 자리를 바꾼다. target = 원하는 정답 번호.
function wtMakeOrder(sents, target, variant) {
  const n = sents.length;
  if (n < 4) return null;
  const v = variant || 0;
  let given = (n >= 8 ? 2 : 1) + (v % 2 === 1 ? (n >= 8 ? -1 : 1) : 0);
  given = Math.max(1, Math.min(given, n - 3));
  const rest = sents.slice(given), m = rest.length;
  const size = [0, 1, 2].map(i => Math.floor(m / 3) + (i < (m % 3) ? 1 : 0));
  // 남는 문장을 어느 덩어리에 붙일지도 variant 로 돌린다
  const rot = (v >> 1) % 3;
  const sz = [size[(0 + rot) % 3], size[(1 + rot) % 3], size[(2 + rot) % 3]];
  const groups = [];
  let at = 0;
  sz.forEach(s => { groups.push(rest.slice(at, at + s).join(' ')); at += s; });
  const t = Math.min(5, Math.max(1, target || 1));
  const seq = WT_ORDER_KEYS[t - 1];            // 원문 순서대로 붙일 이름
  const parts = ['A', 'B', 'C'].map(L => ({ label: L, text: groups[seq.indexOf(L)] }));
  return {
    type: 'order', sub: '', stem: WT_STEMS.order,
    given: sents.slice(0, given).join(' '), parts, passage: '',
    choices: WT_ORDER_CHOICES.slice(), answer: t,
    explanation: '주어진 글 다음에 (' + seq[0] + ') → (' + seq[1] + ') → (' + seq[2] + ') 순서로 이어져야 흐름이 자연스럽다.',
    variant: v
  };
}
function wtMakeInsert(sents, target, variant) {
  const n = sents.length;
  if (n < 6) return null;
  const t = Math.min(5, Math.max(1, target || 1));
  // 뺄 문장 r: 표시할 다섯 자리 안에 정답 자리가 t 번째로 들어가려면 t ≤ r ≤ n-6+t
  const lo = Math.max(1, t), hi = Math.min(n - 1, n - 6 + t);
  if (lo > hi) return null;
  const span = hi - lo + 1, mid = lo + Math.floor(span / 2);
  const r = lo + ((mid - lo + (variant || 0)) % span);
  const R = sents.filter((_, i) => i !== r);
  const g = r - 1;                                // 정답 자리 = R[g] 다음
  const first = g - (t - 1);
  const marks = {};
  for (let k = 0; k < 5; k++) marks[first + k] = WT_CIRC[k];
  const passage = R.map((s, i) => s + (marks[i] ? ' ( ' + marks[i] + ' )' : '')).join(' ');
  return {
    type: 'insert', sub: '', stem: WT_STEMS.insert,
    given: sents[r], parts: null, passage, choices: null, answer: t,
    explanation: '주어진 문장은 ( ' + WT_CIRC[t - 1] + ' ) 자리에 들어가야 앞뒤 흐름이 이어진다.',
    variant: variant || 0
  };
}

// ── 엔진 ─────────────────────────────────────────────────────────
// 문항 하나 = 호출 하나(Weekly-Test.md §5). 처음 만들 때도, 한 문항만 재생성할 때도 같은 호출이다.
// 인증은 우리 Supabase 세션 토큰을 그대로 넘긴다. 지문은 key 만 주면 엔진이 passages 에서 읽는다.
const WT_ENGINE_URL = 'https://eobeop-engine-953800611742.us-central1.run.app';
// 한 번에 몇 문항을 동시에 만드는가. 문항 하나가 엔진 인스턴스 하나를 통째로 쓴다(Cloud Run concurrency=1)
// — 늘려도 서로 느려지지 않고 인스턴스가 늘 뿐이다. 어법이 60~70초라 3이면 7문항에 3분 가까이 걸렸다.
// 품질(프리스캔·블라인드 풀이 2명)은 그대로 두고 **동시 실행으로만** 시간을 줄이기로 했다(2026-09-23 사장님 결정).
// 16 = 흔한 시험지(지문 7~8개 × 지문당 2문항)를 **한 바퀴에** 끝내는 크기. 엔진 최대 인스턴스는 40.
const WT_POOL = 16;

async function wtToken() {
  const { data } = await SB.auth.getSession();
  const token = data && data.session && data.session.access_token;
  if (!token) throw new Error('로그인 세션이 없습니다. 다시 로그인해 주세요.');
  return token;
}
// 엔진 본문의 <u>…</u> → 편집용 {…}. 나머지 태그는 걷어내고 엔티티만 되돌린다.
function wtFromHtml(html) {
  return String(html || '')
    .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '{$1}')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
async function wtEngineItem(req, signal, retried) {
  const token = await wtToken();
  const body = { key: req.key, type: req.type };
  if (req.sub) body.sub = req.sub;
  if (req.target) body.answer = req.target;
  if (req.prompt && req.prompt.trim()) body.prompt = req.prompt.trim();
  const r = await fetch(WT_ENGINE_URL + '/weekly-item', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body)
  });
  // 502·503·504 는 엔진이 아니라 앞단(Cloud Run)이 낸 것이다 — 문항을 못 만든 게 아니라 못 닿은 것이라
  // 한 번만 다시 부른다. 엔진이 낸 실패(422)는 다시 불러도 같으므로 그대로 올린다.
  if ((r.status === 502 || r.status === 503 || r.status === 504) && !retried) return wtEngineItem(req, signal, true);
  // /weekly-item 이 엔진에 생기기 전까지 어법은 기존 밑줄형 엔드포인트로 받는다(프롬프트는 반영 안 됨).
  if (r.status === 404 && req.type === 'grammar') return wtGrammarFallback(req, token, signal);
  let d = null;
  try { d = await r.json(); } catch (e) { d = null; }
  if (!r.ok || !d || !d.item) {
    if (r.status === 404) throw new Error('엔진에 아직 이 유형이 없습니다 (/weekly-item 준비 중)');
    if (r.status === 502 || r.status === 503 || r.status === 504) throw new Error('엔진이 제때 답하지 않았습니다 (' + r.status + ') — 다시 만들어 보세요');
    throw new Error('엔진 ' + r.status + ((d && d.error) ? ' — ' + d.error : ''));
  }
  const it = d.item;
  const sub = it.sub || req.sub || '';
  return {
    type: req.type, sub,
    stem: String(it.stem || wtStem(req.type, sub)),
    given: it.given ? String(it.given) : '', parts: null,
    passage: wtFromHtml(it.passage),
    choices: Array.isArray(it.choices) && it.choices.length ? it.choices.slice(0, 5).map(c => String(c || '')) : null,
    answer: Math.min(5, Math.max(1, Number(it.answer) || 1)),
    explanation: String(it.explanation || ''),
    // 엔진 경고: 풀이 모델과 답이 어긋남 · 정답 번호를 못 맞춤 · 어법은 지시문 미반영 등 — 편집기에 그대로 보여 준다
    warns: Array.isArray(d.warns) ? d.warns.map(String) : []
  };
}
async function wtGrammarFallback(req, token, signal) {
  const r = await fetch(WT_ENGINE_URL + '/generate-key', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ keys: [req.key] })
  });
  if (!r.ok) throw new Error('엔진 ' + r.status);
  const d = await r.json();
  const row = (d.items || []).filter(x => x && x.key === req.key)[0];
  const it = row && row.item;
  if (!it || !it.passage_html) {
    const f = (d.fails || [])[0];
    throw new Error((f && (f.why || f.error)) || '엔진이 이 지문의 어법 문항을 만들지 못했습니다');
  }
  return {
    type: 'grammar', sub: '', stem: WT_STEMS.grammar, given: '', parts: null,
    passage: wtFromHtml(it.passage_html), choices: null,
    answer: Math.min(5, Math.max(1, Number(it.answer) || 1)),
    explanation: String(it.explanation_ko || '') + (it.correction ? ' (' + it.correction + ')' : ''),
    warns: req.prompt && req.prompt.trim() ? ['엔진에 /weekly-item 이 아직 없어 기존 어법 경로로 받았습니다 — 지시문은 반영되지 않았습니다'] : []
  };
}

// 한 문항 만들기 — 유형에 따라 코드 또는 엔진.
async function wtBuild(req, sh, signal) {
  const sents = (sh.rawSentences || []).filter(s => String(s || '').trim());
  if (req.type === 'order' || req.type === 'insert') {
    const f = req.type === 'order' ? wtMakeOrder : wtMakeInsert;
    const d = f(sents, req.target, req.variant || 0);
    if (!d) throw new Error('문장이 모자라 ' + WT_TYPE[req.type].label + ' 문항을 만들 수 없습니다');
    return d;
  }
  return wtEngineItem(req, signal);
}

// ── 날짜 · 범위 ─────────────────────────────────────────────────
// 학년도는 3월에 시작한다 → 1·2월에 만든 시험지는 전년도.
function wtDateTitle(ts) {
  const d = new Date(ts || Date.now());
  const y = d.getFullYear(), m = d.getMonth() + 1;
  return (m <= 2 ? y - 1 : y) + '학년도 ' + m + '월 ' + d.getDate() + '일 주간테스트';
}
function wtAutoRange(sheets) {
  const seen = [];
  sheets.forEach(sh => {
    // 모의고사(key = mock|학년|연도|월|번호)는 학년·연도·월만 쓴다 — '전국연합학력평가'·문항 번호는 넣지 않는다(사장님 지시).
    const k = String(sh.key || '').split('|');
    const s = k[0] === 'mock' && k.length >= 4
      ? [k[1], k[2], k[3]].join(' ')
      : String(sh.passageSource || '').replace(/\s*\d+번?$/, '').trim();
    if (s && seen.indexOf(s) < 0) seen.push(s);
  });
  return seen.join(', ');
}

// ── 본문 조각 렌더 ────────────────────────────────────────────────
// {낱말} = 밑줄. 등장 순서대로 ①~⑤ 를 앞에 붙인다(번호는 밑줄 밖).
function wtRich(text) {
  const s = String(text || ''), out = [], re = /\{([^{}]*)\}/g;
  let last = 0, m, n = 0, i = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(<React.Fragment key={'t' + (i++)}>{s.slice(last, m.index)}</React.Fragment>);
    out.push(<React.Fragment key={'u' + (i++)}><span className="wt-cn">{WT_CIRC[n] || ''}</span><span className="wt-u">{m[1]}</span></React.Fragment>);
    n++; last = m.index + m[0].length;
  }
  if (last < s.length) out.push(<React.Fragment key={'t' + (i++)}>{s.slice(last)}</React.Fragment>);
  return out;
}

const WT_SERIF = "'Times New Roman', Batang, 'Noto Serif KR', serif";
const WT_SANS = "'Spoqa Han Sans Neo', 'Malgun Gothic', sans-serif";
const WT_CSS = ''
  + '.wt{color:#000;font-family:' + WT_SERIF + ';font-size:12.4px;line-height:1.62;word-break:keep-all;overflow-wrap:break-word}'
  + '.wt-item{padding-bottom:22px}'
  + '.wt-lead{font-size:12.6px;line-height:1.5;margin-bottom:6px}'
  + '.wt-arrow{text-align:center;margin:4px 0}'
  + '.wt-stem{font-size:12.6px;line-height:1.5;margin-bottom:6px}'
  + '.wt-stem b{font-family:' + WT_SANS + ';font-weight:700;margin-right:4px}'
  + '.wt-given{border:1px solid #000;padding:6px 8px;text-align:justify;margin:0 0 6px}'
  + '.wt-psg{text-align:justify;padding-left:6px}'
  + '.wt-part{text-align:justify;margin-top:5px;padding-left:6px}'
  + '.wt-part b{font-weight:400;margin-right:4px}'
  + '.wt-u{text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}'
  + '.wt-cn{margin-right:1px}'
  + '.wt-ins{font-weight:700;white-space:nowrap}'
  + '.wt-ch{margin-top:6px;padding-left:6px}'
  + '.wt-ch div{padding-left:1.25em;text-indent:-1.25em;box-sizing:border-box}'
  + '.wt-ch.grid{display:flex;flex-wrap:wrap}.wt-ch.grid div{width:50%}'
  + '.wt-ph{border:1px dashed #b0b0b5;padding:10px;color:#86868b;font-family:' + WT_SANS + ';font-size:11px;line-height:1.5}'
  + '.wt-ans table{border-collapse:collapse;width:100%;font-size:11.5px;margin-bottom:14px}'
  + '.wt-ans th,.wt-ans td{border:1px solid #000;padding:3px 6px;text-align:center}'
  + '.wt-ans th{font-family:' + WT_SANS + ';font-weight:700;background:#f2f2f2}'
  + '.wt-exp{margin-bottom:10px;font-size:11.8px;line-height:1.6}'
  + '.wt-exp b{font-family:' + WT_SANS + '}'
  + '@media screen{.wt-click{cursor:pointer;border-radius:3px;transition:background .12s}.wt-click:hover{background:rgba(0,102,204,0.05)}'
  + '.wt-sel{background:rgba(0,102,204,0.08)!important;box-shadow:0 0 0 2px rgba(0,102,204,0.55)}'
  // 표지·백지는 PDF 저장·인쇄에만 나온다(사장님 지시) — 화면에서는 시험지부터 보이게 숨긴다
  + '.wt-print-only{display:none!important}}'
  + wtMakingCss();   // 함수 선언은 호이스팅되므로 아래에 있어도 여기서 부를 수 있다

// ── 문항 제작 중 표시 ──────────────────────────────────────────────
// 글자만 띄운다 — 애니메이션·상자 없음(사장님 지시). 검정 글자, 포인트색 쓰지 않음.
// 무엇을(유형) 어느 지문으로 만드는지, 재생성이면 선생님 지시문을 보여 준다.
function wtMakingCss() {
  return '.wtMk{display:flex;flex-direction:column;gap:2px;padding:2px 2px 4px;font-family:' + WT_SANS + ';color:#000}'
    + '.wtMkLabel{font-size:12px;font-weight:700;letter-spacing:-.2px}'
    + '.wtMkPrompt{font-size:11px;line-height:1.45;overflow-wrap:anywhere}';
}
// 무슨 유형을 만드는지 적는다. 대의 종류는 엔진이 고르기 전엔 모르므로 유형만.
function wtMakingTag(it) {
  const t = WT_TYPE[it.type];
  const subs = it.type === 'gist' ? WT_GIST_SUBS : it.type === 'fact' ? WT_FACT_SUBS : null;
  const sub = subs ? (subs.filter(s => s.k === it.sub)[0] || {}).label : '';
  return (t ? t.label : it.type) + (sub ? ' · ' + sub : '') + ' 문항';
}
function WtItemMaking({ it }) {
  const prompt = it.prompt && String(it.prompt).trim();
  return (
    <div className="wtMk" role="status">
      <span className="wtMkLabel">{wtMakingTag(it)} 제작 중</span>
      <span className="wtMkPrompt">{prompt ? '“' + prompt + '”' : (it.src ? it.src + ' 지문으로 만들고 있습니다' : '지문을 읽고 만들고 있습니다')}</span>
    </div>
  );
}

// 문항 하나를 조각(발문·주어진 글·본문·선지)으로 — 한 단을 넘는 긴 문항은 조각 단위로 나눠 담는다.
function wtItemParts(it, num) {
  const parts = [];
  // 지문 덩어리는 두 자리에 올 수 있어 함수로 둔다 — 묶음 머리는 발문 **위**, 단독 문항은 발문 아래.
  const psgEl = (key) => {
      const txt = it.type === 'insert'
        ? String(it.passage).split(/(\(\s*[①②③④⑤]\s*\))/).map((seg, i) => /^\(\s*[①②③④⑤]\s*\)$/.test(seg) ? <span className="wt-ins" key={i}>{seg}</span> : <React.Fragment key={i}>{seg}</React.Fragment>)
        : wtRich(it.passage);
    return <div className="wt-psg" key={key}>{txt}</div>;
  };
  // 한 지문에 여러 문항이 걸린 묶음([20~21])은 지시문과 지문이 첫 발문 위에 온다.
  const grouped = !!it.lead;
  if (grouped) {
    parts.push(<div className="wt-lead" key="l">{it.lead}</div>);
    if (it.passage) parts.push(psgEl('bg'));
  }
  parts.push(<div className="wt-stem" key="s"><b>{num}.</b>{it.stem}</div>);
  if (it.status === 'busy') {
    parts.push(<WtItemMaking it={it} key="making" />);
    return parts;
  }
  if (it.status === 'cancelled') {
    parts.push(<div className="wt-ph" key="ph">만들기를 취소했습니다. 문항을 눌러 다시 만드세요.</div>);
    return parts;
  }
  if (it.status === 'error' || !it.status || it.status === 'idle') {
    parts.push(<div className="wt-ph" key="ph">{'문항을 만들지 못했습니다' + (it.error ? ' — ' + it.error : '') + '. 문항을 눌러 다시 만드세요.'}</div>);
    return parts;
  }
  // 삽입·순서는 상자가 지문 앞, 요약은 지문 뒤(화살표와 함께)에 온다 — 평가원 양식 그대로
  if (it.given && !it.givenAfter) parts.push(<div className="wt-given" key="g">{it.given}</div>);
  // 순서 문항은 type 이 아니라 parts 로 가른다 — 올린 .hwpx 문항(hwpxToItems)은 type 이 비어 있어서
  // 예전엔 (A)(B)(C) 단락이 통째로 빠졌다(2026-10-26 고2 27번). 채점 링크 쪽(web/grade)도 parts 로 본다.
  if (it.parts) {
    it.parts.forEach(p => parts.push(<div className="wt-part" key={'p' + p.label}><b>({p.label})</b>{p.text}</div>));
  } else if (it.passage && !grouped) {
    parts.push(psgEl('b'));
  }
  if (it.given && it.givenAfter) {
    if (it.arrow) parts.push(<div className="wt-arrow" key="ar">↓</div>);
    parts.push(<div className="wt-given" key="g2">{it.given}</div>);
  }
  if (it.choices && it.choices.length) {
    parts.push(<div className={'wt-ch' + (it.type === 'order' || it.parts ? ' grid' : '')} key="c">{it.choices.map((c, i) => <div key={i}>{WT_CIRC[i]} {c}</div>)}</div>);
  }
  return parts;
}

// ── 표지 (PDF·인쇄 1쪽) ──────────────────────────────────────────────
// 디자이너 표지(scripts/assets/weekly-cover-source.pdf)에서 선생님 이름·날짜·이름 캡슐만 지운 벡터 배경
// (app/assets/weekly-cover.svg) 위에, 같은 글꼴(Pretendard, 부분집합 번들)로 이름·날짜를 다시 쓴다.
// 좌표는 scripts/build-weekly-cover.py 가 원본에서 뽑은 값(pt). 표지가 정확히 A4(595.28pt = 794px)라 CSS pt 로 그대로 쓴다.
// 표지를 바꾸면 스크립트를 다시 돌리고 출력된 좌표로 이 값을 고친다.
// 자간(track)·dx 는 원본 PDF 렌더와 앱 렌더를 픽셀로 겹쳐 맞춘 값이다(잉크 폭·위치 일치).
// dx: 원본 날짜 줄은 끝 공백까지 가운데 정렬돼 있어 보이는 글자가 3.75pt 왼쪽에 있다 — 같게 옮긴다.
const WT_COVER = {
  color: '#221815',
  name: { size: 19.23, baseline: 81.15, capX: 54.56, capY: 57.5, capH: 33.3, padX: 14.63, track: 0.017 },   // 선생님 이름 + 캡슐
  date: { size: 24.54, baseline: 131.91, track: -0.012, dx: -3.75 },                                                   // 'YYYY학년도 M월 D일 주간테스트'(가운데)
  // 채점 링크 QR — 오른쪽 여백은 이름 캡슐의 왼쪽 여백(54.56pt)과 맞춘다.
  // 29모듈 QR 을 56pt(≈19.8mm)로 두면 한 칸이 0.68mm 라 폰으로 잘 읽힌다.
  qr: { size: 56, top: 42, right: 54.56, cap: 7 },
};
// Pretendard 는 ascent 0.952 · descent 0.241(em) → line-height 1 인 글자 상자 위에서 기준선까지 0.855em.
// 이걸로 원본과 같은 기준선에 글자를 놓는다.
const WT_COVER_BASE = 0.85547;
const WT_COVER_FONT = "'Pretendard WT', 'Spoqa Han Sans Neo', 'Malgun Gothic', sans-serif";
function WeeklyTestCover({ teacher, dateTitle, style }) {
  // 표지는 화면에서 숨겨져 있어 글꼴을 쓰는 곳이 없다 → 인쇄 전에 미리 받아 둔다(안 그러면 대체 글꼴로 찍힐 수 있다)
  React.useEffect(() => {
    try { document.fonts.load("900 20px 'Pretendard WT'"); document.fonts.load("600 20px 'Pretendard WT'"); } catch (e) { /* 글꼴 API 없음 */ }
  }, []);
  const n = WT_COVER.name, d = WT_COVER.date, ink = WT_COVER.color;
  const nameTop = n.baseline - WT_COVER_BASE * n.size;
  return (
    <div data-sheet="" className="wt-print-only" style={style}>
      <img src="assets/weekly-cover.svg" alt="" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />
      {/* 이름 캡슐 — 이름 길이만큼 늘어난다. 테두리 검정(사장님 지시).
          원본 좌표는 선의 가운데(경로) 기준이라 1pt 선의 바깥 끝은 0.5pt 밖이다 → 상자를 0.5pt 키워 맞춘다. */}
      <div style={{ position: 'absolute', left: (n.capX - 0.5) + 'pt', top: (n.capY - 0.5) + 'pt', height: (n.capH + 1) + 'pt', boxSizing: 'border-box',
        border: '1pt solid ' + ink, borderRadius: ((n.capH + 1) / 2) + 'pt', padding: (nameTop - (n.capY - 0.5) - 1) + 'pt ' + (n.padX - 0.5) + 'pt 0',
        fontFamily: WT_COVER_FONT, fontWeight: 900, fontSize: n.size + 'pt', lineHeight: 1, letterSpacing: n.track + 'em', color: ink, whiteSpace: 'nowrap' }}>
        {(teacher || '홍길동') + 'T'}
      </div>
      {/* 채점 링크 QR — 학생이 폰으로 찍어 바로 채점한다. 주소가 하나뿐이라 그림도 하나다. */}
      <div style={{ position: 'absolute', right: WT_COVER.qr.right + 'pt', top: WT_COVER.qr.top + 'pt', width: WT_COVER.qr.size + 'pt', textAlign: 'center' }}>
        <img src="assets/grade-qr.svg" alt="채점 링크" style={{ display: 'block', width: '100%', height: WT_COVER.qr.size + 'pt' }} />
        <div style={{ fontFamily: WT_COVER_FONT, fontWeight: 600, fontSize: WT_COVER.qr.cap + 'pt', lineHeight: 1.5, color: ink, letterSpacing: '-0.02em' }}>채점 링크</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: (d.baseline - WT_COVER_BASE * d.size) + 'pt', textAlign: 'center',
        fontFamily: WT_COVER_FONT, fontWeight: 600, fontSize: d.size + 'pt', lineHeight: 1, letterSpacing: d.track + 'em', transform: 'translateX(' + d.dx + 'pt)', color: ink, whiteSpace: 'nowrap' }}>
        {dateTitle}
      </div>
    </div>
  );
}

// ── 시험지 ───────────────────────────────────────────────────────
// 평가원 양식(frame.hwpx 실측, A4 = 794×1123px):
//  첫 쪽 = 학년도 제목 · 교사 캡슐 · 영어 영역 · 쪽 번호 · 가로줄(y≈209) · 왼단 맨 위 안내 상자
//  이어지는 쪽 = 얇은 머리글 + 가로줄(y≈96) · 모든 쪽 = 2단 + 가운데 세로줄 + 아래 가운데 '현재/전체' 쪽 표시
// 가운데 세로선 = 쪽 가운데 397px(틀 PDF 실측), 좌우 여백 80px 로 대칭.
// 단 폭은 306px 로 둔다(사장님 지시 — 틀의 297px 보다 조금 넓다). 단 사이 22px → 왼단 80~386 | 오른단 408~714.
// (처음엔 틀 이미지를 눈으로 재서 오른쪽 여백이 5px 좁고 선이 3px 오른쪽에 있었다)
const WT_G = { W: 794, H: 1123, L: 80, R: 714, COLW: 306, GAP: 22, RULE1: 209, RULEN: 96, BOTTOM: 1008, BOXGAP: 14 };
WT_G.COL2 = WT_G.L + WT_G.COLW + WT_G.GAP;
WT_G.MID = WT_G.L + WT_G.COLW + Math.round(WT_G.GAP / 2);

function WeeklyTestSheets({ items, teacher, range, dateTitle, selId, onSelect, withAnswers }) {
  // 기본은 붙인다(출제 화면은 선생님이 정답을 봐야 한다). 학생에게 줄 시험지를 뽑는 곳에서만 끈다.
  const showAns = withAnswers !== false;
  const measRef = React.useRef(null);
  const [meas, setMeas] = React.useState(null);
  const done = items.filter(it => it.status === 'done');
  // 시험 범위가 바뀌면 안내 상자 높이가 달라지므로 같이 다시 잰다
  const measKey = items.map(it => it.id + ':' + it.status + ':' + (it.rev || 0)).join('|') + '#' + (range || '');

  // 정답지 조각: 정답 표(10칸씩) + 문항별 해설
  const ansBlocks = React.useMemo(() => {
    if (!done.length) return [];
    const rows = [];
    for (let i = 0; i < items.length; i += 5) rows.push(items.slice(i, i + 5));
    const bl = [];
    bl.push({ el: (<table><tbody>{rows.map((row, ri) => (
      <React.Fragment key={ri}>
        <tr>{row.map((it) => <th key={it.id}>{items.indexOf(it) + 1}</th>)}</tr>
        <tr>{row.map((it) => <td key={it.id}>{it.status === 'done' ? wtCirc(it.answer) : '-'}</td>)}</tr>
      </React.Fragment>))}</tbody></table>) });
    items.forEach((it, i) => {
      if (it.status !== 'done') return;
      const t = WT_TYPE[it.type] || { label: it.typeLabel || '' };
      const subL = it.type === 'gist' ? ((WT_GIST_SUBS.filter(s => s.k === it.sub)[0] || {}).label || '') : '';
      const tag = t.label ? '[' + t.label + (subL ? '·' + subL : '') + ']' : '';
      bl.push({ el: (<div className="wt-exp"><b>{i + 1}. {wtCirc(it.answer)}</b>{tag ? <span style={{ color: '#555' }}> {tag}</span> : null} {it.explanation}</div>) });
    });
    return bl;
  }, [measKey, items]);

  React.useLayoutEffect(() => {
    const c = measRef.current; if (!c) return;
    const itemEls = Array.from(c.querySelectorAll('[data-wt-item]'));
    const itemH = itemEls.map(el => {
      const kids = Array.from(el.children);
      const tops = kids.map(k => k.offsetTop - el.offsetTop);
      return { total: el.offsetHeight, parts: kids.map((k, j) => ((j + 1 < kids.length ? tops[j + 1] : el.offsetHeight) - tops[j])) };
    });
    const ansH = Array.from(c.querySelectorAll('[data-wt-ans]')).map(el => el.offsetHeight + 4);
    const boxEl = c.querySelector('[data-wt-box]');
    setMeas({ key: measKey, itemH, ansH, boxH: boxEl ? boxEl.offsetHeight : 46 });
  }, [measKey, ansBlocks]);

  // 첫 쪽 안내 상자 — 범위가 길면 줄을 바꿔 아래로 늘어난다(말줄임 없음). 측정용과 실제 그림이 같은 정의를 쓴다.
  const infoBoxStyle = { width: WT_G.COLW + 'px', boxSizing: 'border-box', border: '1px solid #000', padding: '4px 8px', fontFamily: WT_SANS, fontSize: '11px', lineHeight: 1.55, wordBreak: 'keep-all', overflowWrap: 'break-word' };
  const infoBoxBody = (
    <React.Fragment>
      <div>SL PRIME 주간테스트 시험지입니다</div>
      <div>시험 범위는 〔 {range || '    '} 〕 입니다</div>
    </React.Fragment>
  );
  if (!items.length) return null;
  // 글자를 고칠 때마다 다시 잰다. 재는 동안 시트를 비우면 문서 높이가 줄어 스크롤이 튀므로,
  // 문항 수가 같으면 직전 측정값으로 계속 그린다(곧바로 새 값으로 바뀐다).
  const stale = !meas || meas.itemH.length !== items.length || (meas.ansH.length !== ansBlocks.length && meas.key !== measKey);

  const measure = (
    // 인쇄에서는 숨긴다(data-noprint) — 화면 밖에 있어도 높이는 차지해서, 1단으로 쌓인 이 상자가 2단 시트보다 길면
    // 인쇄 끝에 빈 쪽이 붙었다(실측: 지문 7개×7문항에서 빈 쪽 5장). 높이 재기는 화면에서만 하므로 지장 없다.
    <div data-noprint="" style={{ position: 'absolute', left: '-99999px', top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
      <div ref={measRef} className="wt" style={{ width: WT_G.COLW + 'px', display: 'flow-root' }}>
        {items.map((it, i) => <div key={it.id} data-wt-item="" className="wt-item">{wtItemParts(it, i + 1)}</div>)}
        <div className="wt-ans">{ansBlocks.map((b, i) => <div key={i} data-wt-ans="">{b.el}</div>)}</div>
        <div data-wt-box="" style={infoBoxStyle}>{infoBoxBody}</div>
      </div>
    </div>
  );
  if (stale) return <React.Fragment><style>{WT_CSS}</style>{measure}</React.Fragment>;

  // 단 흘려 담기 — 단 = {page, col}. 첫 쪽 왼단은 안내 상자만큼 아래서 시작한다.
  const colTop = (page, col, exam) => (page === 0 && exam) ? (WT_G.RULE1 + 12 + (col === 0 ? (meas.boxH || 46) + WT_G.BOXGAP : 0)) : (WT_G.RULEN + 12);
  const flow = (blocks, firstBox) => {
    const pages = [];
    let page = 0, col = 0, used = 0;
    const cap = () => WT_G.BOTTOM - colTop(page, col, firstBox);
    const cell = () => { while (pages.length <= page) pages.push([[], []]); return pages[page][col]; };
    const next = () => { if (col === 0) col = 1; else { col = 0; page += 1; } used = 0; };
    blocks.forEach(b => {
      if (used > 0 && used + b.h > cap()) next();
      if (b.h <= cap() || !b.parts) { cell().push({ b, parts: null }); used += b.h; return; }
      // 한 단보다 긴 문항 → 조각 단위로 나눠 담는다
      let chunk = [];
      b.parts.forEach((ph, j) => {
        if (used + ph > cap() && (used > 0 || chunk.length)) { if (chunk.length) cell().push({ b, parts: chunk }); chunk = []; next(); }
        chunk.push(j); used += ph;
      });
      if (chunk.length) cell().push({ b, parts: chunk });
      used += 22;
    });
    if (!pages.length) pages.push([[], []]);
    return pages;
  };
  const examPages = flow(items.map((it, i) => ({ it, i, h: meas.itemH[i].total, parts: meas.itemH[i].parts })), true);
  const ansPages = ansBlocks.length ? flow(ansBlocks.map((b, i) => ({ ans: b, h: meas.ansH[i] || 20, parts: null })), false) : [];

  const sheetStyle = { position: 'relative', width: WT_G.W + 'px', height: WT_G.H + 'px', margin: '0 auto 28px', background: '#fff', color: '#000', border: '1px solid #e0e0e0', boxShadow: 'rgba(0,0,0,0.1) 0px 12px 44px', overflow: 'hidden' };
  const abs = (x) => Object.assign({ position: 'absolute' }, x);
  const footer = (p, total) => (
    <div style={abs({ left: WT_G.MID - 25, top: 1028, width: 50, height: 22, border: '1px solid #000', fontFamily: WT_SERIF, fontSize: '12px', background: 'linear-gradient(to bottom right, transparent calc(50% - 0.6px), #000 50%, transparent calc(50% + 0.6px))' })}>
      <span style={abs({ left: 5, top: -1 })}>{p}</span>
      <span style={abs({ right: 5, bottom: -1 })}>{total}</span>
    </div>
  );
  const header = (p, kind) => {
    if (p === 0 && kind === 'exam') return (
      <React.Fragment>
        <div style={abs({ left: 0, right: 0, top: 86, textAlign: 'center', fontFamily: WT_SANS, fontSize: '21px', letterSpacing: '-0.3px' })}>{dateTitle}</div>
        <div style={abs({ right: WT_G.W - WT_G.R + 4, top: 74, fontFamily: WT_SERIF, fontSize: '38px', fontWeight: 700, lineHeight: 1 })}>1</div>
        <div style={abs({ left: WT_G.L, top: 151, height: 26, padding: '0 14px', border: '1.3px solid #000', borderRadius: '13px', display: 'flex', alignItems: 'center', fontFamily: 'Batang, ' + WT_SERIF, fontSize: '17px', fontWeight: 700, whiteSpace: 'nowrap' })}>{(teacher || '홍길동') + 'T'}</div>
        <div style={abs({ left: 0, right: 0, top: 138, textAlign: 'center', fontFamily: WT_SANS, fontSize: '44px', fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.1 })}>영어 영역</div>
        <div style={abs({ left: WT_G.L, width: WT_G.R - WT_G.L, top: WT_G.RULE1, height: 0, borderTop: '1.4px solid #000' })} />
        <div style={abs(Object.assign({ left: WT_G.L, top: WT_G.RULE1 + 12 }, infoBoxStyle))}>{infoBoxBody}</div>
      </React.Fragment>
    );
    const odd = p % 2 === 0;
    const label = kind === 'ans' ? '주간테스트 정답 및 해설' : '영어 영역';
    return (
      <React.Fragment>
        <div style={abs({ left: 0, right: 0, top: 60, textAlign: 'center', fontFamily: WT_SANS, fontSize: kind === 'ans' ? '17px' : '15px', fontWeight: 700 })}>{label}</div>
        <div style={abs(Object.assign({ top: 52, fontFamily: WT_SERIF, fontSize: '28px', fontWeight: 700, lineHeight: 1 }, odd ? { right: WT_G.W - WT_G.R + 2 } : { left: WT_G.L + 2 }))}>{p + 1}</div>
        <div style={abs({ left: WT_G.L, width: WT_G.R - WT_G.L, top: WT_G.RULEN, height: 0, borderTop: '1.4px solid #000' })} />
      </React.Fragment>
    );
  };
  const renderPage = (cols, p, total, kind) => {
    const ruleTop = p === 0 && kind === 'exam' ? WT_G.RULE1 : WT_G.RULEN;
    return (
      <div data-sheet="" key={kind + p} style={sheetStyle}>
        {header(p, kind)}
        <div style={abs({ left: WT_G.MID, top: ruleTop, width: 0, height: WT_G.BOTTOM + 6 - ruleTop, borderLeft: '1px solid #000' })} />
        {cols.map((cells, ci) => (
          <div key={ci} className={'wt' + (kind === 'ans' ? ' wt-ans' : '')} style={abs({ left: ci === 0 ? WT_G.L : WT_G.COL2, top: colTop(p, ci, kind === 'exam'), width: WT_G.COLW })}>
            {cells.map((c, k) => {
              if (c.b.ans) return <div key={k} style={{ paddingBottom: '4px' }}>{c.b.ans.el}</div>;
              const it = c.b.it, all = wtItemParts(it, c.b.i + 1);
              const shown = c.parts ? c.parts.map(j => all[j]) : all;
              return (
                <div key={k} className={'wt-item wt-click' + (selId === it.id ? ' wt-sel' : '')} onClick={() => onSelect(it.id)} style={c.parts && c.parts[c.parts.length - 1] !== all.length - 1 ? { paddingBottom: 0 } : null}>
                  {shown}
                </div>
              );
            })}
          </div>
        ))}
        {footer(p + 1, total)}
      </div>
    );
  };

  return (
    <React.Fragment>
      <style>{WT_CSS}</style>
      {measure}
      {/* PDF·인쇄 전용: 1쪽 표지(선생님 이름·날짜 연동) · 2쪽 백지 · 3쪽부터 시험지. 시험지 쪽 표시(n/N)는 표지·백지를 세지 않는다 */}
      <WeeklyTestCover teacher={teacher} dateTitle={dateTitle} style={sheetStyle} />
      <div data-sheet="" className="wt-print-only" style={sheetStyle} />
      {examPages.map((cols, p) => renderPage(cols, p, examPages.length, 'exam'))}
      {showAns && ansPages.map((cols, p) => renderPage(cols, p, ansPages.length, 'ans'))}
    </React.Fragment>
  );
}

// ── 화면 상태는 모드를 바꿔도 남긴다 ─────────────────────────────────
// 엔진 호출에는 돈과 시간이 든다. 다른 모드에 다녀왔다고 만든 문항이 날아가면 안 된다.
const WT_STORE = { perPassage: 1, seed: 1, teacher: null, range: null, items: [], madeAt: null, madeKeys: '', selId: null };
// 저장소를 고치는 곳은 여기 하나 — 화면(React 상태)이 아니라 저장소가 원본이다.
// 예전엔 React 상태를 고치면서 저장소에 베꼈는데, 만드는 도중에 다른 모드로 가면(화면이 사라지면) 뒤늦게 온
// 결과가 버려져 문항이 '제작 중'에 영원히 멈췄다. 이제는 결과가 저장소에 먼저 들어가고, 떠 있는 화면에 알린다.
const WT_LISTEN = new Set();
function wtSet(patch) {
  Object.assign(WT_STORE, typeof patch === 'function' ? patch(WT_STORE) : patch);
  const snap = Object.assign({}, WT_STORE);
  WT_LISTEN.forEach(fn => fn(snap));
}
// 진행 중인 만들기 — 취소하면 gen 을 올리고 요청을 끊는다. gen 이 바뀐 뒤 도착한 결과는 버린다.
// (엔진 쪽 작업은 요청을 끊어도 서버에서 끝까지 돌 수 있다 — 결과를 안 쓸 뿐이다.)
const WT_RUN = { gen: 0, ctrls: new Set() };

function WeeklyTestPane({ sheets, dark, T, PC, userName }) {
  const [st, setSt] = React.useState(() => Object.assign({}, WT_STORE));
  React.useEffect(() => { WT_LISTEN.add(setSt); setSt(Object.assign({}, WT_STORE)); return () => { WT_LISTEN.delete(setSt); }; }, []);
  const set = wtSet;
  const teacher = st.teacher == null ? (userName || '') : st.teacher;
  const range = st.range == null ? wtAutoRange(sheets) : st.range;
  const keys = sheets.map(s => s.key).join('|');
  const plan = React.useMemo(() => wtPlan(sheets, st.perPassage, st.seed), [keys, st.perPassage, st.seed]);
  const items = st.items;
  const sel = items.filter(it => it.id === st.selId)[0] || null;
  const sheetByKey = {};
  sheets.forEach(sh => { sheetByKey[sh.key] = sh; });
  const busyN = items.filter(it => it.status === 'busy').length;
  const stale = items.length > 0 && st.madeKeys !== keys;

  const patchItem = (id, patch) => set(prev => ({ items: prev.items.map(it => it.id === id ? Object.assign({}, it, typeof patch === 'function' ? patch(it) : patch) : it) }));

  const runOne = async (it, extra) => {
    const sh = sheetByKey[it.key];
    if (!sh) { patchItem(it.id, { status: 'error', error: '지문이 선택에서 빠졌습니다' }); return; }
    const gen = WT_RUN.gen, ctrl = new AbortController();
    WT_RUN.ctrls.add(ctrl);
    // 재생성이 취소되면 원래 문항으로 돌아가야 하므로 직전 상태를 기억해 둔다
    patchItem(it.id, (cur) => ({ status: 'busy', error: '', prevStatus: cur.status === 'busy' ? cur.prevStatus : cur.status }));
    try {
      const d = await wtBuild(Object.assign({ key: it.key, type: it.type, sub: it.sub, target: it.target, variant: it.variant || 0, prompt: it.prompt || '' }, extra || {}), sh, ctrl.signal);
      if (gen !== WT_RUN.gen) return;                 // 취소된 뒤 도착한 결과는 버린다
      patchItem(it.id, (cur) => Object.assign({}, d, { status: 'done', error: '', warns: d.warns || [], rev: (cur.rev || 0) + 1, sub: d.sub || cur.sub }));
    } catch (e) {
      if (gen !== WT_RUN.gen) return;
      patchItem(it.id, { status: 'error', error: e.message });
    } finally {
      WT_RUN.ctrls.delete(ctrl);
    }
  };
  // 만들기 취소 — 대기 중인 문항은 시작하지 않고, 진행 중인 요청은 끊는다.
  // 새로 만들던 문항은 '취소됨', 재생성하던 문항은 원래 내용으로 돌아간다.
  const cancelAll = () => {
    WT_RUN.gen += 1;
    WT_RUN.ctrls.forEach(c => { try { c.abort(); } catch (e) { /* 이미 끝남 */ } });
    WT_RUN.ctrls.clear();
    set(prev => ({ items: prev.items.map(it => it.status !== 'busy' ? it
      : Object.assign({}, it, { status: it.prevStatus === 'done' ? 'done' : 'cancelled', error: '' })) }));
  };
  const generateAll = async () => {
    if (!plan.length) return;
    if (items.length && !window.confirm('만들어 둔 문항을 모두 지우고 새로 만듭니다. 계속할까요?')) return;
    // src = 제작 중 표시에 쓸 지문 이름(모의고사는 '고1 2025년 9월 20번'처럼 짧게)
    const srcOf = (key) => { const k = String(key).split('|'); if (k[0] === 'mock' && k.length >= 5) return [k[1], k[2], k[3], k[4] + '번'].join(' '); const sh = sheetByKey[key]; return sh ? String(sh.passageSource || '') : ''; };
    const fresh = plan.map(p => ({ id: p.id, key: p.key, no: p.no, type: p.type, sub: p.sub, target: p.target, stem: wtStem(p.type, p.sub), status: 'busy', prompt: '', variant: 0, rev: 0, src: srcOf(p.key) }));
    set({ items: fresh, madeAt: Date.now(), madeKeys: keys, selId: null });
    const code = fresh.filter(it => !WT_TYPE[it.type].eng), eng = fresh.filter(it => WT_TYPE[it.type].eng);
    code.forEach(it => runOne(it));
    const queue = eng.slice(), gen = WT_RUN.gen;
    const worker = async () => { for (;;) { if (gen !== WT_RUN.gen) return; const it = queue.shift(); if (!it) return; await runOne(it); } };
    await Promise.all(Array.from({ length: Math.min(WT_POOL, queue.length) }, worker));
  };

  if (!sheets.length) {
    return (
      <div style={{ maxWidth: '520px', margin: '90px auto 0', textAlign: 'center', padding: '38px 32px', borderRadius: '18px', background: T.emptyCardBg, border: '1px solid ' + T.panelBorder }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: T.text }}>지문을 선택하세요</div>
        <div style={{ fontSize: '13.5px', color: T.textDim, marginTop: '10px', lineHeight: 1.65 }}>왼쪽에서 이번 주에 배운 지문을 체크하고<br />지문당 문항 수를 고르면 평가원 양식 시험지가 만들어집니다.</div>
      </div>
    );
  }

  const card = { maxWidth: '860px', margin: '0 auto 18px', padding: '16px 20px', borderRadius: '16px', background: T.emptyCardBg, border: '1px solid ' + T.panelBorder, color: T.text };
  const inp = { fontFamily: 'inherit', fontSize: '12.5px', color: T.text, background: dark ? 'rgba(255,255,255,0.05)' : '#fff', border: '1px solid ' + T.divider, borderRadius: '7px', padding: '6px 9px', outline: 'none', boxSizing: 'border-box' };
  const btn = (primary, disabled) => ({ padding: primary ? '8px 18px' : '6px 12px', borderRadius: '9px', border: primary ? 'none' : '1px solid ' + T.divider, background: primary ? (disabled ? pcTint(PC, 0.55) : PC) : 'transparent', color: primary ? '#fff' : T.text, fontSize: primary ? '13px' : '12px', fontWeight: primary ? 700 : 500, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer' });
  const lab = { fontSize: '12px', color: T.textDim, whiteSpace: 'nowrap' };

  // 분포 요약(계획 기준)
  const dist = {};
  plan.forEach(p => { dist[p.type] = (dist[p.type] || 0) + 1; });
  const ansDist = [0, 0, 0, 0, 0];
  (items.length ? items.filter(it => it.status === 'done').map(it => it.answer) : plan.map(p => p.target)).forEach(a => { if (a >= 1 && a <= 5) ansDist[a - 1]++; });
  const skipped = sheets.filter(sh => (sh.rawSentences || []).filter(s => String(s || '').trim()).length < 3);

  return (
    <div>
      {/* ── 설정 ── */}
      <div data-noprint="" style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 18px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>주간테스트</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={lab}>지문당 문항</span>
            <select value={st.perPassage} onChange={e => set({ perPassage: Number(e.target.value) })} style={Object.assign({}, inp, { width: '64px' })}>
              {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={lab}>선생님</span>
            <input value={teacher} onChange={e => set({ teacher: e.target.value })} placeholder="이름" spellCheck={false} style={Object.assign({}, inp, { width: '96px' })} />
            <span style={lab}>T</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '220px' }}>
            <span style={lab}>시험 범위</span>
            <input value={range} onChange={e => set({ range: e.target.value })} spellCheck={false} style={Object.assign({}, inp, { flex: 1 })} />
            {st.range != null && <button onClick={() => set({ range: null })} style={btn(false)} title="선택한 지문으로 다시 채우기">자동</button>}
          </label>
        </div>

        <div style={{ marginTop: '12px', fontSize: '12px', color: T.textDim, lineHeight: 1.7 }}>
          지문 {sheets.length - skipped.length}개 × {st.perPassage}문항 = <b style={{ color: T.text }}>{plan.length}문항</b>
          &nbsp;·&nbsp;유형 {WT_TYPES.map(t => t.label + ' ' + (dist[t.k] || 0)).join(' · ')}
          &nbsp;·&nbsp;정답 {WT_CIRC.map((c, i) => c + ansDist[i]).join(' ')}
          {skipped.length > 0 && <div style={{ color: '#d9480f' }}>영어 원문이 없거나 너무 짧아 뺀 지문 {skipped.length}개: {skipped.map(s => s.passageSource).join(', ')}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button onClick={generateAll} disabled={!plan.length || busyN > 0} style={btn(true, !plan.length || busyN > 0)}>
            {busyN > 0 ? '만드는 중… (' + (items.length - busyN) + '/' + items.length + ')' : items.length ? '새로 만들기' : '문항 만들기'}
          </button>
          {busyN > 0 && <button onClick={cancelAll} style={btn(false)} title="대기 중인 문항은 시작하지 않고, 만들고 있는 문항은 멈춥니다">만들기 취소</button>}
          <button onClick={() => set({ seed: st.seed + 1 })} disabled={busyN > 0} style={btn(false, busyN > 0)} title="유형·정답 번호 배치를 다시 섞습니다">배치 다시 섞기</button>
          {stale && <span style={{ fontSize: '12px', color: '#d9480f' }}>선택한 지문이 바뀌었습니다 — '새로 만들기'를 누르면 반영됩니다.</span>}
          {items.length > 0 && !stale && <span style={{ fontSize: '12px', color: T.textDim }}>시험지의 문항을 누르면 고칠 수 있습니다.</span>}
        </div>

        {items.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
            {items.map((it, i) => {
              const on = st.selId === it.id;
              const col = it.status === 'error' ? '#e03131' : (it.status === 'busy' || it.status === 'cancelled') ? T.textFaint : T.text;
              return (
                <button key={it.id} onClick={() => set({ selId: on ? null : it.id })}
                  style={{ padding: '4px 9px', borderRadius: '7px', fontSize: '11.5px', fontFamily: 'inherit', cursor: 'pointer', color: col, border: '1px solid ' + (on ? PC : T.divider), background: on ? pcTint(PC, 0.86) : 'transparent' }}>
                  {i + 1}. {WT_TYPE[it.type].label} {it.status === 'busy' ? '…' : it.status === 'error' ? '실패' : it.status === 'cancelled' ? '취소' : WT_CIRC[it.answer - 1]}{it.status === 'done' && it.warns && it.warns.length ? <span style={{ color: '#d9480f', fontWeight: 700 }} title={it.warns.join(' / ')}> !</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <WeeklyTestSheets items={items} teacher={teacher} range={range} dateTitle={wtDateTitle(st.madeAt)} selId={st.selId} onSelect={(id) => set({ selId: id })} />
      )}

      {sel && <WeeklyTestEditor key={sel.id} it={sel} num={items.indexOf(sel) + 1} dark={dark} T={T} PC={PC}
        onClose={() => set({ selId: null })}
        onPatch={(patch) => patchItem(sel.id, patch)}
        onRegen={(extra) => runOne(sel, extra)} />}
    </div>
  );
}

// ── 문항 편집기 ───────────────────────────────────────────────────
// ① 프롬프트로 이 문항만 재생성 ② 텍스트 직접 수정. 인쇄에는 나오지 않는다.
function WeeklyTestEditor({ it, num, dark, T, PC, onClose, onPatch, onRegen }) {
  const [prompt, setPrompt] = React.useState(it.prompt || '');
  const t = WT_TYPE[it.type];
  const busy = it.status === 'busy';
  const inp = { fontFamily: 'inherit', fontSize: '12.5px', color: T.text, background: dark ? 'rgba(255,255,255,0.05)' : '#fff', border: '1px solid ' + T.divider, borderRadius: '7px', padding: '6px 9px', outline: 'none', width: '100%', boxSizing: 'border-box', lineHeight: 1.55 };
  const lab = { fontSize: '11.5px', fontWeight: 600, color: T.textDim, margin: '12px 0 4px' };
  const small = { fontSize: '11px', color: T.textFaint, marginTop: '3px', lineHeight: 1.5 };
  const edit = (patch) => onPatch(cur => Object.assign({}, patch, { rev: (cur.rev || 0) + 1 }));
  const changeType = (k) => { onPatch({ type: k, sub: k === 'fact' ? 'mismatch' : '', stem: wtStem(k, k === 'fact' ? 'mismatch' : ''), variant: 0 }); onRegen({ type: k, sub: k === 'fact' ? 'mismatch' : '', variant: 0, prompt: '' }); };
  const subs = it.type === 'gist' ? WT_GIST_SUBS : it.type === 'fact' ? WT_FACT_SUBS : null;

  return (
    <div data-noprint="" style={{ position: 'fixed', right: '18px', top: '96px', bottom: '18px', width: '380px', zIndex: 40, display: 'flex', flexDirection: 'column', borderRadius: '16px', background: dark ? 'rgba(30,31,36,0.97)' : 'rgba(255,255,255,0.98)', border: '1px solid ' + T.divider, boxShadow: '0 18px 48px rgba(0,0,0,0.22)', color: T.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px 10px', borderBottom: '1px solid ' + T.divider }}>
        <div style={{ fontSize: '15px', fontWeight: 700 }}>{num}번 문항</div>
        <div style={{ fontSize: '12px', color: T.textDim }}>{t.label} · 모의고사 {t.no}번형</div>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: T.textDim, fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ overflowY: 'auto', padding: '4px 16px 16px' }}>
        {/* ① 재생성 */}
        <div style={lab}>유형</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <select value={it.type} disabled={busy} onChange={e => changeType(e.target.value)} style={Object.assign({}, inp, { width: '50%' })}>
            {WT_TYPES.map(x => <option key={x.k} value={x.k}>{x.label}</option>)}
          </select>
          {subs && (
            <select value={it.sub || ''} disabled={busy} onChange={e => { onPatch({ sub: e.target.value, stem: wtStem(it.type, e.target.value) }); }} style={Object.assign({}, inp, { width: '50%' })}>
              {it.type === 'gist' && <option value="">엔진이 고름</option>}
              {subs.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}
            </select>
          )}
        </div>
        <div style={lab}>이 문항만 다시 만들기</div>
        <textarea rows={3} value={prompt} disabled={busy} onChange={e => setPrompt(e.target.value)} placeholder={t.eng ? '예) 수일치 말고 관계사로 내 줘 / 선지를 더 헷갈리게' : '순서·삽입은 코드가 만들어서 지시문은 반영되지 않고, 자르는 자리만 바뀝니다.'} style={Object.assign({}, inp, { resize: 'vertical' })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
          <button disabled={busy} onClick={() => { onPatch({ prompt }); onRegen({ prompt, sub: it.sub, variant: (it.variant || 0) + 1 }); }}
            style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: busy ? pcTint(PC, 0.55) : PC, color: '#fff', fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}>
            {busy ? '만드는 중…' : '재생성'}
          </button>
          {it.status === 'error' && <span style={{ fontSize: '11.5px', color: '#e03131' }}>{it.error}</span>}
        </div>
        {it.status === 'done' && it.warns && it.warns.length > 0 && (
          <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '8px', background: dark ? 'rgba(217,72,15,0.14)' : '#fff4e6', border: '1px solid rgba(217,72,15,0.35)', fontSize: '11.5px', lineHeight: 1.55, color: dark ? '#ffc078' : '#a8420c' }}>
            <b>엔진 확인 필요</b>
            {it.warns.map((w, i) => <div key={i}>· {w}</div>)}
          </div>
        )}

        {/* ② 직접 수정 */}
        {it.status === 'done' && (
          <React.Fragment>
            <div style={{ height: '1px', background: T.divider, margin: '16px 0 2px' }} />
            <div style={lab}>발문</div>
            <input value={it.stem} onChange={e => edit({ stem: e.target.value })} style={inp} />
            {(it.type === 'order' || it.type === 'insert' || it.given) && (
              <React.Fragment>
                <div style={lab}>{it.type === 'insert' ? '주어진 문장' : '주어진 글'}</div>
                <textarea rows={3} value={it.given || ''} onChange={e => edit({ given: e.target.value })} style={Object.assign({}, inp, { resize: 'vertical' })} />
              </React.Fragment>
            )}
            {it.type === 'order' && it.parts ? it.parts.map((p, j) => (
              <React.Fragment key={p.label}>
                <div style={lab}>({p.label})</div>
                <textarea rows={4} value={p.text} onChange={e => { const parts = it.parts.map((x, k) => k === j ? Object.assign({}, x, { text: e.target.value }) : x); edit({ parts }); }} style={Object.assign({}, inp, { resize: 'vertical' })} />
              </React.Fragment>
            )) : (
              <React.Fragment>
                <div style={lab}>본문</div>
                <textarea rows={9} value={it.passage || ''} onChange={e => edit({ passage: e.target.value })} style={Object.assign({}, inp, { resize: 'vertical' })} />
                {(it.type === 'grammar' || it.type === 'vocab') && <div style={small}>밑줄은 <b>{'{낱말}'}</b> 처럼 중괄호로 감쌉니다. 등장 순서대로 ①~⑤ 번호가 붙습니다.</div>}
                {it.type === 'insert' && <div style={small}>자리 표시는 <b>( ① )</b> 형태 그대로 둡니다.</div>}
                {it.type === 'irrelevant' && <div style={small}>문장 앞의 ①~⑤ 가 선지입니다.</div>}
              </React.Fragment>
            )}
            {it.choices && (
              <React.Fragment>
                <div style={lab}>선지</div>
                {it.choices.map((c, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '13px', width: '16px' }}>{WT_CIRC[j]}</span>
                    <input value={c} onChange={e => { const choices = it.choices.map((x, k) => k === j ? e.target.value : x); edit({ choices }); }} style={inp} />
                  </div>
                ))}
              </React.Fragment>
            )}
            <div style={lab}>정답</div>
            <select value={it.answer} onChange={e => edit({ answer: Number(e.target.value) })} style={Object.assign({}, inp, { width: '90px' })}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{WT_CIRC[n - 1]}</option>)}
            </select>
            <div style={lab}>해설</div>
            <textarea rows={4} value={it.explanation || ''} onChange={e => edit({ explanation: e.target.value })} style={Object.assign({}, inp, { resize: 'vertical' })} />
          </React.Fragment>
        )}
      </div>
    </div>
  );
}
