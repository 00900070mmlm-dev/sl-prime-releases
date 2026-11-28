// ============================================================
// 시험지 관리 (홈 → 시험지 관리) — 학교 원본 시험지를 닮은 동형 시험지를 AI 가 문항 하나씩 만들어 조립한다
//
// 2026-11-19 사장님: 시안(design/exam-maker/)대로 "앱에 적용시켜 놔(개발자만 쓸 수 있게)" · 작업자는 처음엔 "이 맥", 같은 날 "엔진 쪽으로 옮기자"(클라우드).
// 화면 다섯: 첫 화면(급 → 학교 → 학년 → 그 칸의 기준 시험지 · 만든 시험지) → 만들기 → 진행 → 문항 검수 → 내보내기.
//
// 출제는 이 화면에서 돌지 않는다 — 20분~1시간·한 장 10~16달러이고 키가 렌더러에 있으면 안 된다.
// 이 화면은 DB 에 일을 적고(exam_originals.state / exam_papers.status = 'queued') 깨우기 주소를 부른다. 클라우드 출제 작업
// (Cloud Run 작업 exam-worker — exam-lab/worker.mjs --once, 배포는 exam-lab/cloud/deploy.sh)이 받아 돌린 뒤 결과를 다시 적는다(같은 날 사장님 — "엔진 쪽으로 옮기자"). 이 화면은 몇 초마다 다시 읽어 진행을 보여 준다.
// 문항은 한 문항이 한 줄(exam_items) — 한 문항씩 아카이빙한다(사장님 — "한 문항씩 만들어서 조립", "소중하게 아카이빙").
// 만든 문항을 통째로 다시 내는 버튼은 없다(사장님 — "다시 내는건 막아"). 문항을 누르면 고치는 길이 둘이다(2026-11-20 사장님 —
// "1.직접수정 2.AI로 직접 프롬포트 입력하여 수정"): 직접 수정 · AI 로 수정(지시를 적으면 Claude 가 그 문항만 고쳐 보여 주고, '적용'을 눌러야 저장된다 — emAiEdit).
// 시험지 양식: 학교 양식(28-schoolsheets.js — 원당고·이음고) 또는 평가원 양식(13-weekly.js). 표지는 시험 이름만(QR·선생님 이름 없음).
// 원본 시험지 글·문항은 DB 에만 있다(앱 코드는 공개 번들로 나간다). 스키마: scripts/exam_maker_schema.sql. 권한 키 'exammaker'(개발자만).
// ============================================================

const EM_LEVELS = [   // 난이도는 원본 시험지 대비(케이스 9 기준 — 2026-11-20 사장님 "그냥 9 회귀로 가자"). 학력평가 잣대의 절대 정의는 3단계 탈락이 너무 많아 되돌렸다
  { k: 1, name: '쉬움', def: '원본 시험지의 같은 유형 문항보다 조금 쉽게', cost: [9, 14] },
  { k: 2, name: '보통', def: '원본 시험지의 같은 유형 문항과 같은 수준', cost: [10, 15] },
  { k: 3, name: '어려움', def: '원본 시험지의 같은 유형 문항보다 어렵게', cost: [14, 20] },
];
const EM_KRW = 1400;   // 예상 비용을 원으로 보여 줄 때의 환산(LUCY 사용량과 같은 값 — 2026-11-20 사장님: "예상비용은 한화로")
const EM_FORMS = { 원당고: 'wondang', 이음고: 'ieum' };
// 3분 그래머(2026-11-25 사장님 — 원당고2): 학교 문법 교재 '3분 그래머'(1~80강) 범위를 고르면, 장문 묶음이 아닌 어법 문항 하나를 무작위로 골라
// 그 강들의 구조로 낸다(엔진 exam-lab/run.mjs 의 C.g3 — 변형자가 구조를 옳은 형태로 넣고 출제자가 그 문장들에 오류를 심는다). 체크박스로 켜고 끈다
const EM_G3 = { '원당고|고2': true }, EM_G3_MAX = 80;   // 학교 양식이 있는 학교(28-schoolsheets.js). 그 밖은 평가원 양식
const EM_KIND = { grammar: '어법', vocab: '어휘', insert: '삽입', irrelevant: '무관', order: '순서', blank: '빈칸', summary: '요약', gist: '대의', match: '일치', mood: '심경', connective: '연결사', reference: '지칭', writing: '서답형', other: '기타' };
// 학교는 정해져 있다(2026-11-20 사장님 — "원당고,아라고,이음고를 정형화해버리는거지", "중등도 있어야 해 — 원당중,아라중,이음중"). 학교·학년 칸마다 기준 시험지 하나를 두고 새 시험지는 늘 그것을 따른다 — 매번 원본을 올리지 않는다
const EM_SCHOOLS = { 고등: ['원당고', '아라고', '이음고'], 중등: ['원당중', '아라중', '이음중'] };
const EM_GRADES = { 중등: ['중1', '중2', '중3'], 고등: ['고1', '고2', '고3'] };
const EM_CIRC = ['①', '②', '③', '④', '⑤'];
const EM_BUSY = ['queued', 'running', 'stopping'];
// 출제 작업 깨우기(Cloud Run 서비스 exam-trigger — exam-lab/cloud/). 일을 DB 에 적은 뒤 부르면 클라우드 작업이 바로 뜬다.
// 실패해도 그만이다 — 10분마다 예약 실행이 다시 잡는다(이 맥에서 worker.mjs 를 켜 둬도 받는다).
const EM_TRIGGER_URL = 'https://exam-trigger-404448536321.us-central1.run.app';
function emKick() {
  if (!EM_TRIGGER_URL) return;
  SB.auth.getSession().then(({ data }) => { const t = data && data.session && data.session.access_token; if (t) return fetch(EM_TRIGGER_URL + '/kick', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }); }).catch(() => {});
}

function emErr(e) {
  const m = String((e && (e.message || e.details)) || e || '');
  if (/exam_(originals|papers|items)/.test(m) && /(does not exist|schema cache|not find)/i.test(m)) return 'DB 표가 아직 없습니다 — scripts/exam_maker_schema.sql 을 실행해야 합니다';
  return m || '알 수 없는 오류';
}
/** 분석(exam-lab analysis.json) → 화면용 */
function emAnalysis(an) {
  const types = (an && an.types) || [];
  const tOf = id => types.filter(t => t.id === id)[0] || {};
  return {
    overview: (an && an.exam && an.exam.overview) || '',
    notes: (an && an.exam && an.exam.notes) || '',
    rows: ((an && an.items) || []).map(it => ({ no: it.no, kind: EM_KIND[tOf(it.type_id).kind] || '', name: tOf(it.type_id).name || '', group: it.group || '', answer: it.answer })),
    types: types.map(t => ({ kind: EM_KIND[t.kind] || t.kind, name: t.name, nos: t.item_nos || [], stem: String(t.stem || '').split(' / ')[0], rule: t.answer_rule || '' })),
  };
}
/** 유형 구성 한 줄 — 어법 4 · 삽입 3 … */
function emMix(types) {
  const c = {}; (types || []).forEach(t => { const k = EM_KIND[t.kind] || t.kind; c[k] = (c[k] || 0) + (Number(t.count) || 0); });
  return Object.keys(c).sort((a, b) => c[b] - c[a]).map(k => k + ' ' + c[k]).join(' · ');
}
const emDate = s => { const d = new Date(s); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; };
/** 번호 묶기 — [25,26,27,28,35] → '25~28·35' */
const emNums = (a) => { const out = []; (a || []).slice().sort((x, y) => x - y).forEach(n => { const l = out[out.length - 1]; if (l && n === l[1] + 1) l[1] = n; else out.push([n, n]); }); return out.map(([x, y]) => (x === y ? '' + x : x + '~' + y)).join('·'); };
const emScopeText = s => s.kind === 'mock' ? s.year + ' ' + s.grade + ' ' + s.month + ' 모의고사 ' + s.from + '~' + s.to + '번' + ((s.skip || []).length ? '(' + emNums(s.skip) + '번 제외)' : '') : s.kind === 'extra' ? '추가 지문 ' + s.school + ' ' + (s.units || []).join('·') : s.book + ' ' + (s.lessons || []).join('·') + (s.noAppendix ? '(부록 제외)' : '');

// 표지 — 시험 이름만(QR·선생님 이름 없음). 평가원 표지의 배경(weekly-cover.svg)에 이름 자리 없이 제목 한 줄
const EM_SHEET = { position: 'relative', width: '794px', height: '1123px', margin: '0 auto', background: '#fff', color: '#000', overflow: 'hidden' };
function EmTitleCover({ title }) {
  const d = WT_COVER.date;
  return (
    <div data-sheet="" style={EM_SHEET}>
      <img src="assets/weekly-cover.svg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: (d.baseline - WT_COVER_BASE * d.size) + 'pt', textAlign: 'center', fontFamily: WT_COVER_FONT, fontWeight: 600, fontSize: d.size + 'pt', lineHeight: 1, letterSpacing: d.track + 'em', transform: 'translateX(' + d.dx + 'pt)', color: WT_COVER.color, whiteSpace: 'nowrap' }}>{title}</div>
    </div>
  );
}

// ── AI 로 수정 — 문항 하나를 선생님 지시대로 고친다(2026-11-20 사장님). 키는 app_config.anthropic_api_key(18-hwpxai.js 의 acCall·acJson 을 같이 쓴다).
// 밑줄 표시(U+2063·U+2064 — 안 보이는 글자)는 모델이 잃어버리기 쉬워 <u>…</u> 로 바꿔 보내고 받아서 되돌린다.
const EM_AI_MODEL = 'claude-opus-5-5';
const emU = (s) => String(s == null ? '' : s).replace(/⁣/g, '<u>').replace(/⁤/g, '</u>');
const emUn = (s) => String(s == null ? '' : s).replace(/<u>/g, '⁣').replace(/<\/u>/g, '⁤');
/** 해설 맨 앞의 (출처) — 출처 안에 괄호가 또 있어(YBM(박) 영어 Ⅱ 4과) 짝을 세어 끝을 찾는다. 첫 ')' 에서 끊으면 '(YBM(박)' 만 떼어 직접 수정 때 출처가 깨졌다 */
const emExpHead = (it) => { const s = String((it && it.explanation) || ''); if (s[0] !== '(') return ''; let d = 0; for (let k = 0; k < s.length; k++) { if (s[k] === '(') d++; else if (s[k] === ')' && --d === 0) return s.slice(0, k + 1) + (s.slice(k + 1).match(/^\s*/) || [''])[0]; } return ''; };
/** it = 지금 문항 · ctx = { kind, shared(묶음의 윗글 — 이 문항에 지문이 없을 때), orig(원문) } → { item, note } */
async function emAiEdit(it, ctx, prompt) {
  const key = await illGetConfig('anthropic_api_key');
  if (!key) throw new Error('Anthropic API 키가 없습니다 — app_config.anthropic_api_key 를 넣어야 합니다.');
  const head = emExpHead(it);
  const cur = {
    stem: String(it.stem || '').trim(), passage: emU(it.passage), given: emU(it.given), parts: (it.parts || []).map(p => emU(p.text).trim()),
    choices: (it.choices || []).map(emU), answer: String(it.answer == null ? '' : it.answer), explanation: String(it.explanation || '').slice(head.length),
  };
  const data = await acCall(key, EM_AI_MODEL, {
    max_tokens: 16000,   // Opus 5.5 는 생각을 끌 수 없다 — 생각 토큰까지 이 안에 든다
    system: '너는 한국 고등학교 영어 내신 시험 문항을 선생님의 지시대로 고치는 출제 보조다. 지시한 것만 고치고 나머지는 한 글자도 바꾸지 않는다. 고친 뒤에도 정답은 하나로 분명해야 하고 해설은 고친 문항과 맞아야 한다.',
    messages: [{ role: 'user', content: [
      '아래 문항을 [선생님 지시]대로 고쳐서 문항 전체를 같은 모양으로 돌려준다.', '',
      '[규칙]',
      '· 지시가 요구하지 않은 칸은 받은 글자 그대로 돌려준다(지문·주어진 글·발문·선지·해설 전부).',
      '· <u>…</u> 는 시험지의 밑줄이다. 그대로 두고, 밑줄 친 말을 바꿀 때는 새 말에 <u>…</u> 를 친다. 지문 속 ①~⑤·ⓐ~ⓕ·( ① ) 같은 번호 표시와 (A)(B) 빈칸은 지시가 없으면 그대로 둔다.',
      '· 선지 개수는 바꾸지 않는다. 빈 문자열인 선지(번호만 있는 선지)는 빈 문자열 그대로 둔다. parts(순서 문항의 (A)(B)(C) 단락)의 개수도 그대로.',
      '· 정답 번호는 지시가 없으면 바꾸지 않는다. 고친 결과 정답이 달라져야만 할 때에만 바꾼다. answer 는 "1"~"5"(여러 개가 정답이면 작은 번호부터 이어 붙인 "35"), 서답형이면 빈 문자열.',
      '· 발문 끝의 배점([4.3점])은 그대로 둔다.',
      '· 해설은 "정답 ③. …" 꼴의 한국어다. 문항이 바뀌어 해설이 틀어지면 해설도 맞게 고친다.',
      '· 이 문항에 없는 칸(빈 문자열·빈 배열로 온 칸)은 빈 채로 돌려준다.',
      '· note 에는 무엇을 어떻게 고쳤는지 한국어 한두 문장으로 적는다. 지시대로 고칠 수 없으면 아무것도 고치지 말고 note 에 까닭을 적는다.', '',
      '[유형] ' + (ctx.kind || ''),
      ctx.shared ? '\n[윗글 — 이 문항이 같이 쓰는 지문. 읽기만 하고 고치지 않는다]\n' + emU(ctx.shared) : '',
      ctx.orig ? '\n[변형 전 원문 — 참고용]\n' + ctx.orig : '',
      '', '[문항]', JSON.stringify(cur, null, 1), '', '[선생님 지시]', prompt,
    ].join('\n') }],
    output_config: { format: { type: 'json_schema', schema: {
      type: 'object',
      properties: {
        stem: { type: 'string' }, passage: { type: 'string' }, given: { type: 'string' }, parts: { type: 'array', items: { type: 'string' } },
        choices: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' }, explanation: { type: 'string' }, note: { type: 'string' },
      },
      required: ['stem', 'passage', 'given', 'parts', 'choices', 'answer', 'explanation', 'note'], additionalProperties: false,
    } } },
  });
  if (data && data.stop_reason === 'max_tokens') throw new Error('AI 답이 중간에 끊겼습니다 — 지시를 나눠서 다시 요청해 주세요.');
  if (data && data.stop_reason === 'refusal') throw new Error('AI 가 이 요청을 거절했습니다 — 지시를 바꿔 다시 요청해 주세요.');
  if (window.console && data && data.usage) console.info('[시험지 관리] AI 수정 사용량', data.usage);
  const j = acJson(data);
  // 모양이 달라졌으면 버린다 — 시험지 양식이 선지 5개·단락 수를 믿고 그린다
  const ch = Array.isArray(j.choices) ? j.choices : [];
  if (ch.length !== cur.choices.length) throw new Error('AI 가 선지 개수를 바꿔 돌려줬습니다 — 다시 요청해 주세요.');
  if ((j.parts || []).length !== cur.parts.length) throw new Error('AI 가 단락 수를 바꿔 돌려줬습니다 — 다시 요청해 주세요.');
  const ans = String(j.answer || '').trim();
  if (cur.answer === '' ? ans !== '' : !/^[1-5]{1,5}$/.test(ans)) throw new Error('AI 가 돌려준 정답 번호를 읽지 못했습니다 — 다시 요청해 주세요.');
  const item = Object.assign({}, it, {
    stem: (String(it.stem || '').match(/^\s*/) || [''])[0] + String(j.stem || '').trim(),
    choices: ch.map((c, i) => (cur.choices[i] === '' ? it.choices[i] : emUn(c))), answer: ans,
    explanation: head + String(j.explanation || '').trim(), rev: (it.rev || 0) + 1,
  });
  if (it.passage != null) item.passage = emUn(j.passage) || it.passage;
  if (it.given != null) item.given = emUn(j.given) || it.given;
  if (it.parts) item.parts = it.parts.map((p, i) => Object.assign({}, p, { text: (String(p.text).match(/^\s*/) || [''])[0] + emUn(j.parts[i]).trim() }));
  const same = ['stem', 'passage', 'given', 'answer', 'explanation'].every(k => item[k] === it[k]) && JSON.stringify(item.choices) === JSON.stringify(it.choices) && JSON.stringify(item.parts) === JSON.stringify(it.parts);
  return { item, note: String(j.note || '').trim(), same };
}

// ── 주간테스트로 등록(2026-11-20 사장님 — "시험지 관리에서 만든 문항 주간테스트로도 등록할 수 있게") ──
// 주간테스트(weekly_tests.payload.items)는 앱이 .hwpx 를 읽은 모양이다(17-hwpx.js 의 hxItems 결과). 채점 링크·성적표·문항 팝업·오답 시험지가 전부 그 모양을 읽는다.
// 그래서 시험지 관리의 문항(시트 모양 — exam_items.item)을 그 모양으로 되돌려 싣는다. hwpxToItems 의 거꾸로다:
//   묶음 = shared + gLabel + 같은 passage · 순서 = passage [주어진 글] + given ['(A) …'] · 요약 = given ['↓', 요약문] · 삽입 = given [주어진 문장]
// 배점([4.3점])은 뗀다(주간테스트는 배점을 쓰지 않는다). 시험지 모양 그대로는 payload.sheet 에 따로 싣고 주간테스트 관리의 '시험지 보기'가 그것으로 그린다
const EM_WK_TYPE = { 연결사: '빈칸', 서답형: '영작' };   // 주간테스트 유형 목록(AC_TYPES)에 없는 이름
function emWeeklyItems(rows) {
  const plain = (t) => String(t == null ? '' : t).replace(/[\u2063\u2064]/g, '');
  const paras = (t) => String(t || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  const byUnit = {}; rows.forEach(r => { if (r.unit) (byUnit[r.unit] = byUnit[r.unit] || []).push(r); });
  return rows.map(r => {
    const it = r.item, grp = (r.unit && byUnit[r.unit]) || [r];
    const head = grp.filter(x => x.item.passage)[0];
    const own = !!(it.parts && it.parts.length) || (!!it.passage && r !== head);   // 묶음 안에 있어도 자기 글을 가진 문항
    const sharedUnit = grp.length > 1 && !!head && grp.some(x => x !== head && !x.item.passage && !(x.item.parts && x.item.parts.length));
    const stemU = String(it.stem || '').replace(/\s*\[\s*\d+(\.\d+)?\s*점\s*\]/g, '').trim();
    const o = { no: r.no, prompt: plain(stemU), source: '', aiType: EM_WK_TYPE[r.kind] || r.kind || '기타', choices: (it.choices || []).map(c => String(c == null ? '' : c).trim()),
      answer: Number(String(it.answer == null ? '' : it.answer).replace(/\D/g, '')) || 0, explain: String(it.explanation || '').slice(emExpHead(it).length).trim(), passage: [], given: [], shared: false };
    if (stemU !== o.prompt) o.promptU = stemU;
    if (it.parts && it.parts.length) { o.passage = paras(it.given); o.given = it.parts.map(p => '(' + p.label + ') ' + String(p.text || '').trim()); return o; }
    const shared = sharedUnit && !own;
    o.passage = paras(shared ? head.item.passage : it.passage);
    if (it.given) o.given = (it.arrow || it.givenAfter ? ['↓'] : []).concat(paras(it.given));
    if (shared) {
      const sh = grp.filter(x => x === head || (!x.item.passage && !(x.item.parts && x.item.parts.length)));
      const m = String(head.item.lead || '').match(/^\s*[\[【]\s*(\d+)\s*[~\-–]\s*(\d+)\s*[\]】]\s*(.*)$/);
      o.shared = true; o.gFrom = m ? +m[1] : sh[0].no; o.gTo = m ? +m[2] : sh[sh.length - 1].no; o.gLabel = '[' + o.gFrom + '~' + o.gTo + ']'; o.lead = (m && m[3].trim()) || '다음 글을 읽고 물음에 답하시오.';
    }
    return o;
  });
}

function ExamMakerApp({ dark, userName }) {
  const K = TT(dark);
  const [screen, setScreen] = useState('home');      // home · make · prog · review · out
  const [level, setLevel] = useState('고등');
  const [pick, setPick] = useState(null);            // { school, grade }
  const [origs, setOrigs] = useState(null);
  const [papers, setPapers] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [dlg, setDlg] = useState(null);              // { kind:'reg'|'an'|'src'|'stop'|'del'|'wk', … }
  const [busy, setBusy] = useState(false);
  const [mk, setMk] = useState(null);                // 만들기 { origId, level, form, title, scope:[…] }
  const [paperId, setPaperId] = useState(null);
  const [items, setItems] = useState(null);          // exam_items 줄
  const [sel, setSel] = useState(0);
  const [edit, setEdit] = useState(null);            // 직접 수정 중 { stem, choices, answer, exp }
  const [ai, setAi] = useState(null);                // AI 로 수정 중 { no, prompt, busy, draft, note, err }
  const [out, setOut] = useState(null);              // 내보내기 { title, form, term, date, ans }
  const say = (m) => { setMsg(m); setTimeout(() => setMsg((x) => (x === m ? '' : x)), 2800); };

  const load = () => Promise.all([
    SB.from('exam_originals').select('id,level,school,grade,year,term,exam,label,file_path,file_name,ans_path,state,note,items,pages,source,created_at,types:analysis->types').order('created_at', { ascending: false }),
    SB.from('exam_papers').select('id,original_id,school,grade,title,level,form,range,status,progress,note,cost,minutes,cfg,created_at').order('created_at', { ascending: false }),
  ]).then(([a, b]) => {
    if (a.error) throw a.error; if (b.error) throw b.error;
    setOrigs(a.data || []); setPapers(b.data || []); setErr('');
  }).catch((e) => setErr(emErr(e)));
  useEffect(() => { load(); }, []);
  // 작업자가 돌리는 일이 있으면 몇 초마다 다시 읽는다
  const working = (origs || []).some(o => o.state === 'queued' || o.state === 'busy') || (papers || []).some(p => EM_BUSY.indexOf(p.status) >= 0);
  useEffect(() => { if (!working) return; const t = setInterval(load, 5000); return () => clearInterval(t); }, [working]);

  const paper = (papers || []).filter(p => p.id === paperId)[0] || null;
  const origOf = (p) => (origs || []).filter(o => p && o.id === p.original_id)[0] || null;
  const loadItems = (id) => SB.from('exam_items').select('id,no,kind,unit,src,item,detail,confirmed').eq('paper_id', id).order('no').then(({ data, error }) => { if (error) throw error; setItems(data || []); }).catch((e) => setErr(emErr(e)));
  const openPaper = (p) => {
    setPaperId(p.id); setSel(0); setEdit(null); setAi(null); setItems(null);
    if (p.status === 'done') { loadItems(p.id); setScreen('review'); } else setScreen('prog');
  };
  useEffect(() => { if (paper && paper.status === 'done' && screen === 'prog' && !items) loadItems(paper.id); }, [paper && paper.status]);

  // ── 모양 ──
  const btn = (primary, off) => ({ height: '32px', padding: '0 14px', border: primary ? '1px solid ' + K.ink : '1px solid ' + K.control, cursor: off ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '13px', borderRadius: K.rCtl + 'px', background: primary ? K.ink : 'transparent', color: primary ? K.inkText : K.text, fontWeight: primary ? 600 : 400, opacity: off ? 0.6 : 1, whiteSpace: 'nowrap', transition: K.ease });
  const tbtn = (danger) => ({ height: '28px', padding: '0 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', color: danger ? K.neg : K.text, borderRadius: K.rCtl + 'px', whiteSpace: 'nowrap' });
  const card = { background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', padding: '20px', minWidth: 0 };
  const h2 = { fontSize: '16px', fontWeight: 600, margin: 0 };
  const sub = { fontSize: '12px', color: K.muted };
  const lab = { fontSize: '12px', color: K.muted, margin: '0 0 6px' };
  const def = { fontSize: '12px', color: K.muted, marginTop: '8px' };
  const chead = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' };
  const inputS = { height: '32px', border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', background: K.surface, color: K.text, padding: '0 10px', fontSize: '13.5px', fontFamily: 'inherit', boxSizing: 'border-box' };
  const th = { height: '36px', textAlign: 'left', fontSize: '12px', fontWeight: 400, color: K.muted, padding: '0 12px', whiteSpace: 'nowrap' };
  const td = { height: '40px', padding: '0 12px', borderTop: '1px solid ' + K.border };
  const seg = (value, opts, onChange, full) => (
    <div style={{ display: full ? 'flex' : 'inline-flex', background: K.raised, borderRadius: K.rCtl + 'px', padding: '2px', gap: '2px' }}>
      {opts.map(([v, t]) => <button key={v} onClick={() => onChange(v)} style={{ flex: full ? 1 : 'none', height: '28px', padding: '0 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', background: value === v ? K.surface : 'transparent', color: value === v ? K.text : K.muted, fontWeight: value === v ? 600 : 400, whiteSpace: 'nowrap', transition: K.ease }}>{t}</button>)}
    </div>
  );
  const box = (on) => <span style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1px solid ' + (on ? K.ink : K.control), background: on ? K.ink : K.surface, display: 'inline-grid', placeItems: 'center', flex: 'none', color: K.inkText, fontSize: '11px', lineHeight: 1 }}>{on ? '✓' : ''}</span>;
  const veil = (width, children) => (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) setDlg(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.28)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
      <div role="dialog" style={{ width: (width || 520) + 'px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto', background: K.surface, color: K.text, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', padding: '24px', boxShadow: '0 8px 24px rgba(0,0,0,.08)', boxSizing: 'border-box' }}>{children}</div>
    </div>
  );

  // ── 파일 · 원본 ──
  const openFile = (p) => SB.storage.from('exam').createSignedUrl(p, 600).then(({ data, error }) => { if (error || !data) throw error || new Error('주소를 못 만들었습니다'); window.open(data.signedUrl, '_blank'); }).catch((e) => setErr('파일을 열지 못했습니다 — ' + emErr(e)));
  const upload = (id, file, name) => {
    const ext = (file.name.match(/\.(pdf|hwpx)$/i) || ['', 'pdf'])[1].toLowerCase();
    const p = 'orig/' + id + '/' + name + '.' + ext;
    return SB.storage.from('exam').upload(p, file, { upsert: true, contentType: ext === 'pdf' ? 'application/pdf' : 'application/octet-stream' }).then(({ error }) => { if (error) throw error; return p; });
  };
  const requeue = (o, patch) => SB.from('exam_originals').update(Object.assign({ state: 'queued', note: null, updated_at: new Date().toISOString() }, patch || {})).eq('id', o.id).then(({ error }) => { if (error) throw error; emKick(); setDlg(null); load(); });

  // ======================= 1. 첫 화면 =======================
  const homeView = () => {
    const mine = (origs || []).filter(o => o.level === level);
    // 학교는 정해진 목록(EM_SCHOOLS) — 목록에 없는 학교로 등록된 것이 있으면 뒤에 붙여 감추지 않는다
    const schools = EM_SCHOOLS[level].concat(mine.map(o => o.school).filter((s, i, a) => a.indexOf(s) === i && EM_SCHOOLS[level].indexOf(s) < 0).sort());
    const firstHas = mine.filter(o => o.state === 'done')[0] || mine[0];   // 처음엔 기준 시험지가 있는 칸을 연다
    const cur = pick && schools.indexOf(pick.school) >= 0 ? pick : (firstHas ? { school: firstHas.school, grade: firstHas.grade } : { school: schools[0], grade: EM_GRADES[level][0] });
    // 칸의 기준 시험지 = 분석이 끝난 것 가운데 가장 나중에 올린 것. 그보다 나중에 올려 아직 분석 중·확인 필요인 것(바꾸는 중)은 그 위에 같이 보인다. 그 전 것은 DB 에 남지만 화면에는 안 나온다
    const slot = mine.filter(o => o.school === cur.school && o.grade === cur.grade);   // 나중에 올린 것부터(load 의 정렬)
    const baseAt = slot.findIndex(o => o.state === 'done');
    const base = baseAt >= 0 ? slot[baseAt] : null;
    const list = baseAt >= 0 ? slot.slice(0, baseAt + 1) : slot;
    const changing = list.some(o => o !== base);
    const made = (papers || []).filter(p => p.school === cur.school && p.grade === cur.grade);
    // 등록 창 — 학교·학년은 왼쪽에서 고른 칸(2026-11-20 사장님 — "이미 좌측 캡슐들에서 학교,학년을 선택했으니까")
    const openReg = () => setDlg({ kind: 'reg', level, school: cur.school, grade: cur.grade, year: new Date().getFullYear(), term: new Date().getMonth() >= 7 ? 2 : 1, exam: '중간고사', file: null, ans: null });
    const ST = (o) => o.state === 'queued' ? <span style={{ color: K.warn }}>작업자를 기다리는 중</span> : o.state === 'busy' ? <span style={{ color: K.warn }}>분석 중</span>
      : o.state === 'check' ? <span><span style={{ color: K.neg }}>확인 필요</span> — {o.note}</span> : o.state === 'error' ? <span><span style={{ color: K.neg }}>분석 실패</span> — {o.note}</span> : <span style={{ color: K.pos }}>분석 끝남</span>;
    // 목록의 상태 — 단계와 지금까지 쓴 돈을 우리말로(처음 설계 단계에는 묶음 수가 없어 '0/?' 로만 보여 아무 일도 없는 것 같았다 — 2026-11-19 사장님)
    const pStage = (g) => !g || !g.stage || g.stage === 'fit' ? '설계 중' : g.stage === 'final' ? '마무리 중' : '출제 중 ' + (g.done || 0) + '/' + (g.n || '?') + '묶음';
    const pST = (p) => p.status === 'done' ? '끝남' : p.status === 'queued' ? '작업자를 기다리는 중' : p.status === 'running' ? pStage(p.progress) : p.status === 'stopping' ? '멈추는 중' : p.status === 'stopped' ? '멈춤' : '오류';
    return (
      <div data-mstack="" style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: '12px', alignItems: 'start' }}>
        <section data-mpane="" style={Object.assign({}, card, { padding: '8px' })}>
          <div style={{ padding: '4px 4px 10px' }}>{seg(level, [['중등', '중등'], ['고등', '고등']], (v) => { setLevel(v); setPick(null); }, true)}</div>
          {schools.map(s => {
            const so = mine.filter(o => o.school === s);
            return (
              <div key={s}>
                <div style={{ display: 'flex', alignItems: 'center', height: '36px', padding: '0 10px', fontSize: '13.5px', fontWeight: 600 }}>{s}</div>
                {EM_GRADES[level].map(g => {
                  const n = so.filter(o => o.grade === g && o.state === 'done').length, on = cur.school === s && cur.grade === g;
                  return <div key={g} onClick={() => setPick({ school: s, grade: g })} style={{ display: 'flex', alignItems: 'center', height: '34px', padding: '0 10px 0 22px', borderRadius: K.rCtl + 'px', fontSize: '13.5px', cursor: 'pointer', background: on ? K.active : 'transparent', fontWeight: on ? 600 : 400, color: n ? K.text : K.grey }}>{g}<span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 400, color: K.muted }}>{n ? '' : '없음'}</span></div>;
                })}
              </div>
            );
          })}
        </section>
        <div style={{ display: 'grid', gap: '12px', minWidth: 0 }}>
          <section style={card}>
            <div style={chead}>
              <h2 style={h2}>{cur.school} {cur.grade} 기준 시험지</h2>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                {!list.length ? <button style={btn(true)} onClick={openReg}>기준 시험지 등록</button> : base && !changing ? <button style={tbtn()} onClick={openReg}>기준 시험지 바꾸기</button> : null}
              </div>
            </div>
            {!list.length && <div style={{ padding: '28px 0 8px', textAlign: 'center', color: K.muted, fontSize: '13.5px' }}>{cur.school} {cur.grade} 기준 시험지가 아직 없습니다.</div>}
            {list.map((o, i) => (
              <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 20px', padding: '14px 0', borderTop: i ? '1px solid ' + K.border : 'none', paddingTop: i ? '14px' : 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{o.label}</div>
                <div style={{ gridRow: '1 / span 2', gridColumn: 2, display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {(o.state === 'done' || o.state === 'check' || o.state === 'error') && <button style={tbtn()} onClick={() => openAnalysis(o)}>{o.state === 'done' ? '분석 보기' : '확인하기'}</button>}
                  {o === base && <button style={btn(true)} onClick={() => startMake(o)}>새 시험지 만들기</button>}
                </div>
                <div style={{ fontSize: '12px', color: K.muted }} className="num">{o.items ? o.items + '문항 · ' : ''}{o.pages ? o.pages + '쪽 · ' : ''}{o.source || (/\.hwpx$/i.test(o.file_path || '') ? '한글(.hwpx)' : 'PDF')} · {emDate(o.created_at)} 등록 · {ST(o)}{o.types && o.state === 'done' ? ' — ' + emMix(o.types) : ''}</div>
              </div>
            ))}
          </section>
          <section style={card}>
            <div style={chead}><h2 style={h2}>만든 시험지</h2><span style={sub} className="num">{made.length}개</span></div>
            {!made.length ? <div style={{ padding: '28px 0 8px', textAlign: 'center', color: K.muted, fontSize: '13.5px' }}>이 학년으로 만든 시험지가 없습니다.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead><tr><th style={th}>시험지 · 범위</th><th style={th}>난이도</th><th style={th}>상태</th><th style={Object.assign({}, th, { textAlign: 'right' })}>비용</th><th style={th}>만든 날</th><th style={th}></th></tr></thead>
                  <tbody>{made.map(p => (
                    <tr key={p.id}>
                      <td style={Object.assign({}, td, { paddingTop: '8px', paddingBottom: '8px', minWidth: '170px' })}>{p.title}<div style={{ fontSize: '12px', color: K.muted }}>{p.range}</div></td>
                      <td style={Object.assign({}, td, { whiteSpace: 'nowrap' })}>{p.level}단계 {(EM_LEVELS[p.level - 1] || {}).name}</td>
                      <td style={Object.assign({}, td, { whiteSpace: 'nowrap', color: p.status === 'error' ? K.neg : p.status === 'done' ? K.text : K.warn })}>{pST(p)}</td>
                      <td style={Object.assign({}, td, { textAlign: 'right', whiteSpace: 'nowrap' })} className="num">{p.cost != null ? Number(p.cost).toFixed(2) + '달러' : p.progress && p.progress.spent ? Number(p.progress.spent).toFixed(2) + '달러까지' : ''}</td>
                      <td style={Object.assign({}, td, { whiteSpace: 'nowrap', color: K.muted })} className="num">{emDate(p.created_at)}</td>
                      <td style={Object.assign({}, td, { textAlign: 'right', paddingRight: 0, whiteSpace: 'nowrap' })}><button style={tbtn()} onClick={() => openPaper(p)}>{p.status === 'done' ? '열기' : '진행 보기'}</button>{EM_BUSY.indexOf(p.status) < 0 && <button style={tbtn(true)} onClick={() => setDlg({ kind: 'del', id: p.id })}>삭제</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  };
  const openAnalysis = (o) => {
    setDlg({ kind: 'an', id: o.id, an: null });
    SB.from('exam_originals').select('analysis').eq('id', o.id).single().then(({ data, error }) => { if (error) throw error; setDlg((d) => (d && d.id === o.id ? Object.assign({}, d, { an: data.analysis }) : d)); }).catch((e) => setErr(emErr(e)));
  };
  const regSave = (d) => {
    const label = d.year + '년 ' + d.term + '학기 ' + d.exam;
    const school = String(d.school || '').trim();
    if (!school) return setErr('학교 이름을 적어 주세요');
    if ((origs || []).some(o => o.school === school && o.grade === d.grade && o.label === label)) return setErr(school + ' ' + d.grade + ' ' + label + ' 은 이미 등록돼 있습니다');
    const id = crypto.randomUUID(); setBusy(true);
    upload(id, d.file, 'exam').then((fp) => (d.ans ? upload(id, d.ans, 'answer') : Promise.resolve(null)).then((ap) => SB.from('exam_originals').insert({
      id, level: d.level, school, grade: d.grade, year: d.year, term: d.term, exam: d.exam, label, bank_school: EM_FORMS[school] || null,
      file_path: fp, file_name: d.file.name, ans_path: ap, ans_name: d.ans ? d.ans.name : null, state: 'queued', created_by: userName,
    }))).then(({ error }) => {
      if (error) throw error;
      emKick(); setDlg(null); setLevel(d.level); setPick({ school, grade: d.grade }); load(); say(school + ' ' + d.grade + ' ' + label + '을 등록했습니다 — 작업자가 분석합니다');
    }).catch((e) => setErr('등록하지 못했습니다 — ' + emErr(e))).finally(() => setBusy(false));
  };
  const regDlg = (d) => {
    const set = (k, v) => setDlg(Object.assign({}, d, { [k]: v }));
    const drop = (k, title, hint) => (
      <label style={{ display: 'block', border: '1px ' + (d[k] ? 'solid' : 'dashed') + ' ' + K.control, borderRadius: K.rCard + 'px', padding: d[k] ? '12px' : '18px', textAlign: 'center', fontSize: '13.5px', color: d[k] ? K.text : K.muted, cursor: 'pointer' }}>
        <input type="file" accept=".pdf,.hwpx" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) set(k, f); }} />
        {d[k] ? <span><b style={{ fontWeight: 600 }}>{d[k].name}</b> — 바꾸려면 누른다</span> : <span><b style={{ fontWeight: 600, color: K.text }}>{title}</b>{hint && <div style={{ marginTop: '6px', fontSize: '12px' }}>{hint}</div>}</span>}
      </label>
    );
    return (
      veil(520, <React.Fragment>
        <div style={Object.assign({}, chead, { marginBottom: '18px' })}><h2 style={h2}>{d.school} {d.grade} 기준 시험지 등록</h2></div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><p style={lab}>연도</p><select value={d.year} onChange={(e) => set('year', +e.target.value)} style={inputS}>{[0, 1, 2, 3].map(k => new Date().getFullYear() - k).map(y => <option key={y} value={y}>{y}년</option>)}</select></div>
          <div><p style={lab}>학기</p>{seg(d.term, [[1, '1학기'], [2, '2학기']], (v) => set('term', v))}</div>
          <div><p style={lab}>시험</p>{seg(d.exam, [['중간고사', '중간고사'], ['기말고사', '기말고사']], (v) => set('exam', v))}</div>
        </div>
        <p style={Object.assign({}, lab, { marginTop: '14px' })}>시험지 파일</p>
        {drop('file', '시험지 스캔 PDF 업로드')}
        <p style={Object.assign({}, lab, { marginTop: '12px' })}>답지 파일 (선택)</p>
        {drop('ans', '답지 업로드')}
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button style={btn(false)} onClick={() => setDlg(null)}>취소</button>
          <button style={btn(true, !d.file || busy)} disabled={!d.file || busy} onClick={() => regSave(d)}>{busy ? '올리는 중…' : '등록하고 분석'}</button>
        </div>
      </React.Fragment>)
    );
  };
  const anDlg = (d) => {
    const o = (origs || []).filter(x => x.id === d.id)[0]; if (!o) return null;
    const A = d.an ? emAnalysis(d.an) : null;
    return (
      veil(A ? 1000 : 640, <React.Fragment>
        <div style={Object.assign({}, chead, { marginBottom: '6px' })}>
          <h2 style={h2}>{o.school} {o.grade} {o.label} — 분석</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {o.file_path && <button style={btn(false)} onClick={() => openFile(o.file_path)}>원본 파일 열기</button>}
            <button style={btn(false)} onClick={() => setDlg(null)}>닫기</button>
          </div>
        </div>
        <div style={Object.assign({}, def, { margin: '0 0 16px' })}>{o.items ? o.items + '문항 · ' : ''}{o.pages ? o.pages + '쪽 · ' : ''}{o.source || ''} · {emDate(o.created_at)} 등록</div>
        {(o.state === 'check' || o.state === 'error') && (
          <div style={{ border: '1px solid ' + K.neg, borderRadius: K.rCard + 'px', padding: '14px', fontSize: '13.5px', marginBottom: '16px' }}>
            <b style={{ color: K.neg }}>확인할 곳</b> — {o.note}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <label style={Object.assign({}, btn(false), { display: 'inline-flex', alignItems: 'center' })}>답지 넣기
                <input type="file" accept=".pdf,.hwpx" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; upload(o.id, f, 'answer').then((ap) => requeue(o, { ans_path: ap, ans_name: f.name })).then(() => say('답지를 넣었습니다 — 다시 분석합니다')).catch((e2) => setErr(emErr(e2))); }} /></label>
              <button style={btn(false)} onClick={() => requeue(o).then(() => say('다시 분석합니다')).catch((e) => setErr(emErr(e)))}>다시 분석</button>
            </div>
          </div>
        )}
        {!A ? <div style={{ padding: '24px 0', textAlign: 'center', color: K.muted, fontSize: '13.5px' }}>{d.an === null && o.state !== 'error' ? <SlLoading size={40} /> : '분석 내용이 없습니다.'}</div> : (
          <React.Fragment>
            <p style={lab}>시험지 전체</p>
            <div style={{ fontSize: '13.5px', marginBottom: '18px' }}>{A.overview}</div>
            <div data-mstack="" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', alignItems: 'start' }}>
              <div><p style={lab}>문항별 유형</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}><thead><tr><th style={th}>번호</th><th style={th}>유형</th><th style={th}>묶음</th><th style={Object.assign({}, th, { textAlign: 'right' })}>정답</th></tr></thead>
                  <tbody>{A.rows.map(r => <tr key={r.no}><td style={td} className="num">{r.no}</td><td style={td}>{r.kind}</td><td style={Object.assign({}, td, { color: K.muted })} className="num">{r.group}</td><td style={Object.assign({}, td, { textAlign: 'right' })} className="num">{typeof r.answer === 'number' ? (EM_CIRC[r.answer - 1] || r.answer) : r.answer ? '서답형' : <span style={{ color: K.neg }}>없음</span>}</td></tr>)}</tbody></table></div>
              <div><p style={lab}>유형별 출제 방식 — 새 시험지가 따르는 것</p>
                {A.types.map((t, i) => <div key={i} style={{ borderTop: '1px solid ' + K.border, padding: '12px 0', fontSize: '13px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{t.kind} · {t.name} <span style={{ color: K.muted, fontWeight: 400, fontSize: '12px' }} className="num">{t.nos.join(', ')}번</span></div>
                  <div style={{ color: K.muted, fontSize: '12px', margin: '2px 0 6px' }}>발문 — {t.stem}</div><div>{t.rule}</div></div>)}
              </div>
            </div>
            {o.state === 'done' && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}><button style={btn(true)} onClick={() => { setDlg(null); startMake(o); }}>새 시험지 만들기</button></div>}
          </React.Fragment>
        )}
      </React.Fragment>)
    );
  };

  // ======================= 2. 만들기 =======================
  // 그 학년의 지문 키(모의고사·교과서 + 학교별 지문 — 학교별은 키에 학년이 셋째 칸이라 전부 읽어 쓰는 쪽에서 가른다). 학년마다 한 번만 읽는다
  const keyCache = useRef({});
  const gradeKeys = (grade) => keyCache.current[grade] || (keyCache.current[grade] = (async () => {
    const keys = [];
    for (const pre of ['mock|' + grade + '|', 'book|' + grade + '|', 'school|']) for (let i = 0; ; i += 1000) {
      const { data, error } = await SB.from('passages').select('key').like('key', pre + '%').range(i, i + 999);
      if (error) throw error; keys.push(...data.map(r => r.key)); if (data.length < 1000) break;
    }
    return keys;
  })().catch((e) => { delete keyCache.current[grade]; throw e; }));
  /** 저장된 범위 한 줄(exam_papers.scope)의 지문 수를 지금 DB 로 다시 센다 */
  const scopeN = (row, keys) => {
    if (row.kind === 'mock') { const skip = row.skip || []; return keys.filter(k => { const p = k.split('|'); const n = +p[4]; return p[0] === 'mock' && p[1] === row.grade && p[2] === row.year && p[3] === row.month && n >= row.from && n <= row.to && skip.indexOf(n) < 0; }).length; }
    if (row.kind === 'book') return keys.filter(k => { const p = k.split('|'); return p[0] === 'book' && p[1] === row.grade && p[2] === row.book && (row.lessons || []).indexOf(p[3]) >= 0 && !(row.noAppendix && /^부록/.test(p[4] || '')); }).length;
    if (row.kind === 'extra') return keys.filter(k => { const p = k.split('|'); return p[0] === 'school' && p[1] === row.school && p[2] === row.grade && (row.units || []).indexOf(p.slice(3).join('|')) >= 0; }).length;
    return 0;
  };
  const startMake = (o) => {
    const d = new Date();
    // 시험 범위는 그 학교·학년으로 마지막에 만든 시험지의 것을 먼저 띄운다(2026-11-20 사장님 — "시험범위는 직전범위를 항상 띄워줘 자동으로", "학교별 학년별로 달라야").
    // 그사이 범위를 손댔으면(줄이 생겼으면) 덮지 않는다. 지문 수는 지금 DB 로 다시 센다 — 0 이 된 줄(지문이 지워졌다)은 뺀다
    Promise.all([SB.from('exam_papers').select('scope, cfg').eq('school', o.school).eq('grade', o.grade).not('scope', 'is', null).order('created_at', { ascending: false }).limit(1), gradeKeys(o.grade)]).then(([r, keys]) => {
      if (r.error) throw r.error;
      const rows = (((r.data || [])[0] || {}).scope || []).map(x => Object.assign({}, x, { on: true, n: scopeN(x, keys) })).filter(x => x.n > 0);
      if (rows.length) setMk((m) => (m && m.origId === o.id && !m.scope.length ? Object.assign({}, m, { scope: rows, fromLast: true }) : m));
      const g3 = (((r.data || [])[0] || {}).cfg || {}).g3;   // 직전 3분 그래머 범위(켜져 있던 것만)
      if (g3 && g3.on !== false && +g3.from && +g3.to) setMk((m) => (m && m.origId === o.id && !m.g3Touched ? Object.assign({}, m, { g3: { on: true, from: +g3.from, to: +g3.to } }) : m));
    }).catch(() => {});
    setMk({ origId: o.id, level: 2, form: EM_FORMS[o.school] ? 'school' : 'wt', title: (d.getMonth() + 1 <= 2 ? d.getFullYear() - 1 : d.getFullYear()) + '학년도 ' + o.school + ' ' + o.grade + ' 파이널 테스트', scope: [], sets: 1, g3: EM_G3[o.school + '|' + o.grade] ? { on: true, from: 0, to: 0 } : null });
    setScreen('make');
  };
  const makeView = () => {
    const o = (origs || []).filter(x => x.id === mk.origId)[0];
    const L = EM_LEVELS[mk.level - 1];
    const n = mk.scope.filter(s => s.on).reduce((a, s) => a + s.n, 0);
    const short = o && n < (o.items || 0);
    const sets = mk.sets || 1;
    // 여러 세트는 같은 지문을 같은 유형으로 두 번 내지 않는다 — 한 유형의 문항 수 × 세트 수만큼은 지문이 있어야 한다
    const kc = {}; ((o && o.types) || []).forEach(t => { const k = EM_KIND[t.kind] || t.kind; kc[k] = (kc[k] || 0) + (Number(t.count) || 0); });
    const topKind = Object.keys(kc).sort((a, b) => kc[b] - kc[a])[0];
    const thin = !short && sets > 1 && topKind && kc[topKind] * sets > n;
    const g3bad = !!(mk.g3 && mk.g3.on && !(mk.g3.from && mk.g3.to && mk.g3.from <= mk.g3.to));   // 3분 그래머를 켰으면 범위가 있어야 한다
    const set = (patch) => setMk(Object.assign({}, mk, patch));
    return (
      <div data-mstack="" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: '12px', alignItems: 'start' }}>
        <section style={card}>
          <div style={chead}><h2 style={h2}>{o ? o.school + ' ' + o.grade + ' · ' + o.label : '새 시험지'}</h2>{o && <span style={sub} className="num">{o.items}문항{o.types ? ' · ' + emMix(o.types) : ''}</span>}</div>
          <p style={lab}>난이도</p>
          {seg(mk.level, EM_LEVELS.map(x => [x.k, x.k + '단계 ' + x.name]), (v) => set({ level: v }))}
          <div style={def}>{L.def}. 검수자 둘이 원본과 견주어 판정한다.</div>
          <p style={Object.assign({}, lab, { marginTop: '20px' })}>양식</p>
          {seg(mk.form, (o && EM_FORMS[o.school] ? [['school', o.school]] : []).concat([['wt', '평가원']]), (v) => set({ form: v }))}
          <div style={def}>{mk.form === 'school' ? '학교 원본 시험지와 같은 머리·쪽 번호·문항 번호' : '2단 평가원 양식'}. 내보낼 때 바꿀 수 있다.</div>
          <p style={Object.assign({}, lab, { marginTop: '20px' })}>시험 이름 — 표지에 들어간다</p>
          <input value={mk.title} onChange={(e) => set({ title: e.target.value })} style={Object.assign({}, inputS, { width: '100%' })} />
          <p style={Object.assign({}, lab, { marginTop: '20px' })}>세트 수</p>
          {seg(sets, [1, 2, 3].map(k => [k, k + '세트']), (v) => set({ sets: v }))}
          {mk.g3 && <React.Fragment>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', cursor: 'pointer' }} onClick={() => set({ g3: Object.assign({}, mk.g3, { on: !mk.g3.on }), g3Touched: true })}>{box(mk.g3.on)}<span style={{ fontSize: '13.5px', fontWeight: mk.g3.on ? 600 : 400 }}>3분 그래머 문항 넣기</span></div>
            {mk.g3.on && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              <select value={mk.g3.from || ''} onChange={(e) => set({ g3: Object.assign({}, mk.g3, { from: +e.target.value }), g3Touched: true })} style={inputS}><option value="">시작 강</option>{Array.from({ length: EM_G3_MAX }, (_, i) => <option key={i} value={i + 1}>{i + 1}강</option>)}</select>
              <span style={{ color: K.muted }}>~</span>
              <select value={mk.g3.to || ''} onChange={(e) => set({ g3: Object.assign({}, mk.g3, { to: +e.target.value }), g3Touched: true })} style={inputS}><option value="">끝 강</option>{Array.from({ length: EM_G3_MAX }, (_, i) => <option key={i} value={i + 1}>{i + 1}강</option>)}</select>
            </div>}
            <div style={def}>{mk.g3.on ? '장문 묶음이 아닌 어법 문항 하나를 무작위로 골라 고른 강들의 구조로 낸다 — 지문을 바꿔 쓸 때 강 구조를 넣고, 그 문장들에 밑줄을 그어 오류를 심는다.' : '끄면 어법 문항을 모두 원본 꼴대로 낸다.'}</div>
          </React.Fragment>}
          <div style={def}>{sets > 1 ? '같은 범위로 시험지 ' + sets + '장을 만든다 — 이름 뒤에 1세트·2세트…가 붙고 차례로 만든다. 설계할 때부터 세트끼리 같은 지문을 같은 유형으로 내지 않는다.' : '같은 범위로 여러 장을 만들려면 세트 수를 늘린다.'}</div>
        </section>
        <section style={card}>
          <div style={chead}><h2 style={h2}>시험 범위</h2><span style={sub} className="num">{n}지문 · 이 가운데 문항 수에 맞게 고른다{mk.fromLast ? ' · 직전 범위' : ''}</span>
            <div style={{ marginLeft: 'auto' }}><button style={btn(false)} onClick={() => setDlg({ kind: 'src', grade: o ? o.grade : '고2', school: o ? o.school : '', tab: 'mock', keys: null })}>범위 더하기</button></div></div>
          {!mk.scope.length && <div style={{ padding: '28px 0 8px', textAlign: 'center', color: K.muted, fontSize: '13.5px' }}>'범위 더하기'로 이번 시험 범위의 모의고사·교과서를 넣어 주세요.<br />모의고사·교과서가 아닌 지문(학교에서 따로 나눠 준 추가 지문)이 범위에 있으면 '추가 지문'에서 꼭 넣는다 — 안 넣으면 그 지문에서는 문항이 나오지 않는다.</div>}
          {mk.scope.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', borderTop: i ? '1px solid ' + K.border : 'none', cursor: 'pointer' }} onClick={() => set({ scope: mk.scope.map((x, j) => (j === i ? Object.assign({}, x, { on: !x.on }) : x)) })}>
              {box(s.on)}
              <div style={{ minWidth: 0 }}><div style={{ fontWeight: s.on ? 600 : 400, color: s.on ? K.text : K.grey }}>{s.kind === 'mock' ? s.year + ' ' + s.grade + ' ' + s.month + ' 모의고사' : s.kind === 'extra' ? '추가 지문 · ' + s.school : s.book}</div><div style={{ fontSize: '12px', color: K.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.kind === 'mock' ? s.from + '~' + s.to + '번' + ((s.skip || []).length ? ' · ' + emNums(s.skip) + '번 제외' : '') : s.kind === 'extra' ? (s.units || []).join(' · ') : s.lessons.join(' · ') + (s.noAppendix ? ' · 부록 제외' : '')}</div></div>
              <span style={{ marginLeft: 'auto', fontSize: '13px', color: K.muted, whiteSpace: 'nowrap' }} className="num">{s.n}지문</span>
              <button style={tbtn(true)} onClick={(e) => { e.stopPropagation(); set({ scope: mk.scope.filter((x, j) => j !== i) }); }}>빼기</button>
            </div>
          ))}
        </section>
        <section style={Object.assign({}, card, { gridColumn: '1 / -1' })}>
          <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div><p style={lab}>예상 비용</p><div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 }} className="num">{(L.cost[0] * sets * EM_KRW).toLocaleString('ko-KR')}~{(L.cost[1] * sets * EM_KRW).toLocaleString('ko-KR')}<small style={{ fontSize: '14px', fontWeight: 400, color: K.muted }}> 원{sets > 1 ? ' · ' + sets + '세트' : ''}</small></div></div>
            <div><p style={lab}>예상 시간</p><div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 }} className="num">{20 * sets}<small style={{ fontSize: '14px', fontWeight: 400, color: K.muted }}> 분 안팎</small></div></div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: short || thin || !n || g3bad ? K.neg : K.muted }}>{!n ? '시험 범위를 넣어 주세요' : g3bad ? '3분 그래머 범위(시작 강 ~ 끝 강)를 골라 주세요' : short ? '범위의 지문(' + n + '개)이 문항 수(' + o.items + ')보다 적다' : thin ? topKind + ' ' + kc[topKind] + '문항 × ' + sets + '세트를 겹치지 않게 내기에는 지문(' + n + '개)이 모자란다' : '시작하면 클라우드에서 만든다 — 앱을 닫아도 된다'}</span>
              <button style={Object.assign({}, btn(true, short || thin || !n || g3bad || busy), { height: '36px', fontSize: '14px' })} disabled={short || thin || !n || g3bad || busy || !String(mk.title).trim()} onClick={startPaper}>출제 시작</button>
            </div>
          </div>
        </section>
      </div>
    );
  };
  const startPaper = () => {
    const o = (origs || []).filter(x => x.id === mk.origId)[0]; const scope = mk.scope.filter(s => s.on).map(s => { const c = Object.assign({}, s); delete c.on; delete c.n; return c; });
    const sets = mk.sets || 1, group = sets > 1 ? crypto.randomUUID() : null, title = String(mk.title).trim();
    const g3 = mk.g3 && mk.g3.on ? { on: true, from: mk.g3.from, to: mk.g3.to } : null;
    setBusy(true);
    // 세트마다 시험지 한 줄. 차례로 넣는다 — 작업자가 만든 순서대로 잡으므로 1세트부터 돈다. 같은 묶음(cfg.set.group)끼리는 작업자가 지문·유형 겹침을 막는다
    const add = (k, first) => (k > sets ? Promise.resolve(first) : SB.from('exam_papers').insert({ original_id: o.id, school: o.school, grade: o.grade, title: sets > 1 ? title + ' ' + k + '세트' : title, level: mk.level, form: mk.form, scope, range: scope.map(emScopeText).join(' · ') + (g3 ? ' · 3분 그래머 ' + g3.from + '~' + g3.to + '강' : ''), status: 'queued', created_by: userName, cfg: Object.assign(group ? { set: { group, no: k, of: sets } } : {}, g3 ? { g3 } : {}) }).select('id').single()
      .then(({ data, error }) => { if (error) throw error; return add(k + 1, first || data.id); }));
    add(1, null).then((id) => { emKick(); return load().then(() => { if (sets > 1) { setScreen('home'); say(sets + '세트를 줄 세웠습니다 — 1세트부터 차례로 만듭니다'); } else { setPaperId(id); setScreen('prog'); } }); })
      .catch((e) => { setErr('출제를 시작하지 못했습니다 — ' + emErr(e)); load(); }).finally(() => setBusy(false));
  };
  // 범위 더하기 — 모의고사(회차 여럿 · 번호를 눌러 넣고 뺀다) · 교과서 · 추가 지문(모의고사·교과서로 나뉘지 않는 지문 = 앱의 학교별 지문 `school|학교|학년|지문`). 2026-11-20 사장님:
  // "모의고사는 제외번호를 직접 누를 수 있게 하고 범위추가를 자유롭게", "모의고사 3개년도 넣을 수 있도록", "가끔 추가지문 있는 학교도 있어서 주의가 필요해"
  // 더해도 창은 닫히지 않는다 — 닫기를 누를 때까지 이어서 더한다.
  const srcDlg = (d) => {
    const set = (patch) => setDlg(Object.assign({}, d, patch));
    if (!d.keys) return veil(620, <div style={{ padding: '24px 0' }}><SlLoading size={40} text="지문 목록을 불러오는 중…" /></div>);
    const mocks = {}, books = {}, extras = {}, apps = {};   // apps = 교과서 과마다 부록 지문 수
    d.keys.forEach(k => { const p = k.split('|'); if (p[0] === 'school') { if (p[2] === d.grade) (extras[p[1]] = extras[p[1]] || []).push(p.slice(3).join('|')); return; } if (p[0] === 'mock') { const n = +p[4]; if (!(n > 0)) return; const m = (mocks[p[2]] = mocks[p[2]] || {}); (m[p[3]] = m[p[3]] || []).push(n); } else if (p[0] === 'book') { const b = (books[p[2]] = books[p[2]] || {}); b[p[3]] = (b[p[3]] || 0) + 1; if (/^부록/.test(p[4] || '')) { const a = (apps[p[2]] = apps[p[2]] || {}); a[p[3]] = (a[p[3]] || 0) + 1; } } });
    const years = Object.keys(mocks).sort().reverse();
    const rounds = d.rounds || [];                       // 고른 회차 — '2026년|10월'
    const rOn = (y, m) => rounds.indexOf(y + '|' + m) >= 0;
    // 번호는 회차마다 따로 고른다(2026-11-20 사장님 — "뭐는 20번부터 24번, 또 다음년도껀 30번에서 35번 이럴 수도 있는거"). offBy = { '2026년|10월': [뺀 번호] }
    const allOf = (r) => { const [y, m] = r.split('|'); return ((mocks[y] && mocks[y][m]) || []).slice().sort((a, b) => a - b); };
    const offOf = (r) => (d.offBy && d.offBy[r]) || allOf(r).filter(n => n < 21 || n > 40 || (n >= 25 && n <= 28));   // 처음엔 21~40번에서 도표·안내문(25~28)을 뺀 것
    const setOff = (r, off) => set({ offBy: Object.assign({}, d.offBy || {}, { [r]: off }) });
    const numsOf = (r) => { const off = offOf(r); return allOf(r).filter(n => off.indexOf(n) < 0); };
    const shown = rounds.slice().sort().reverse();
    const mockN = rounds.reduce((a, r) => a + numsOf(r).length, 0);
    const bookNames = Object.keys(books).sort(); const book = d.book || bookNames[0];
    const lessons = book ? Object.keys(books[book]).sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99)) : []; const lsel = d.lessons || [];
    // 부록 켜고 끄기(2026-11-20 사장님 — "교과서 부록을 켜고끌 수 있도록"). 끄면 그 과들의 본문 지문만 범위에 든다(단원 이름이 '부록'으로 시작하는 지문을 뺀다)
    const appOn = d.appendix !== false;
    const appOf = (l) => (apps[book] && apps[book][l]) || 0;
    const lesN = (l) => ((books[book] && books[book][l]) || 0) - (appOn ? 0 : appOf(l));
    const bookApp = lsel.reduce((a, l) => a + appOf(l), 0), bookHasApp = lessons.some(l => appOf(l) > 0);
    const bookN = lsel.reduce((a, l) => a + lesN(l), 0);
    // 추가 지문(같은 날 사장님 — "모의고사/교과서로 분리가 안되는 지문을 추가지문이라 정의하고 저기에 다 모아서 선택할 수 있게"). 그 학년의 학교별 지문을 학교마다 모아 보여 준다 — 원본의 학교가 맨 위
    const xSchools = Object.keys(extras).sort((a, b) => (b.indexOf(d.school || '-') === 0) - (a.indexOf(d.school || '-') === 0) || a.localeCompare(b, 'ko'));
    const xNat = (a, b) => a.localeCompare(b, 'ko', { numeric: true });
    const xSel = d.xSel || {};   // { 학교: [지문 이름] }
    const xN = Object.keys(xSel).reduce((a, k) => a + xSel[k].length, 0);
    // 같은 회차·같은 교과서·같은 이름의 추가 지문을 다시 더하면 그 줄을 바꾼다(두 번 들어가지 않게)
    const same = (a, b) => a.kind === b.kind && (a.kind === 'mock' ? a.year === b.year && a.month === b.month && a.grade === b.grade : a.kind === 'book' ? a.book === b.book : a.school === b.school);
    const add = (rows, patch) => { setMk((m) => Object.assign({}, m, { scope: m.scope.filter(x => !rows.some(r => same(r, x))).concat(rows.map(r => Object.assign({ on: true }, r))) })); set(patch); say('시험 범위에 ' + rows.reduce((a, r) => a + r.n, 0) + '지문을 더했습니다'); };
    const addMock = () => add(rounds.slice().sort().map(r => { const [y, m] = r.split('|'); const ns = numsOf(r); if (!ns.length) return null; const from = ns[0], to = ns[ns.length - 1]; const skip = []; for (let k = from; k <= to; k++) if (ns.indexOf(k) < 0) skip.push(k); return { kind: 'mock', grade: d.grade, year: y, month: m, from, to, skip, n: ns.length }; }).filter(Boolean), { rounds: [] });
    const chip = (on) => ({ height: '28px', minWidth: '34px', padding: '0 8px', border: '1px solid ' + (on ? K.ink : K.control), borderRadius: K.rCtl + 'px', background: on ? K.ink : 'transparent', color: on ? K.inkText : K.muted, fontFamily: 'inherit', fontSize: '12.5px', fontWeight: on ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: K.ease });
    const inScope = mk.scope.filter(x => x.on).reduce((a, x) => a + x.n, 0);
    return (
      veil(620, <React.Fragment>
        <div style={chead}><h2 style={h2}>범위 더하기</h2><span style={sub} className="num">{d.grade} · 지금 범위 {inScope}지문</span><div style={{ marginLeft: 'auto' }}><button style={btn(false)} onClick={() => setDlg(null)}>닫기</button></div></div>
        {seg(d.tab, [['mock', '모의고사'], ['book', '교과서'], ['extra', '추가 지문']], (v) => set({ tab: v }))}
        {d.tab === 'mock' ? (!years.length ? <div style={{ padding: '24px 0', color: K.muted, fontSize: '13.5px' }}>{d.grade} 모의고사 지문이 없습니다.</div> : (
          <div style={{ marginTop: '16px' }}>
            <p style={lab}>회차 — 여러 개를 고를 수 있다</p>
            <div style={{ display: 'grid', gap: '6px' }}>
              {years.map(y => (
                <div key={y} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ width: '52px', fontSize: '13px', color: K.muted }} className="num">{y}</span>
                  {Object.keys(mocks[y]).sort((a, b) => parseInt(a) - parseInt(b)).map(m => <button key={m} style={chip(rOn(y, m))} onClick={() => set({ rounds: rOn(y, m) ? rounds.filter(r => r !== y + '|' + m) : rounds.concat([y + '|' + m]) })}>{m}</button>)}
                </div>
              ))}
            </div>
            <p style={Object.assign({}, lab, { marginTop: '16px' })}>번호 — 회차마다 눌러서 넣고 뺀다 (검은 칸 = 범위에 넣는 번호)</p>
            {!shown.length && <div style={{ fontSize: '13px', color: K.muted, padding: '6px 0' }}>회차를 고르면 그 회차의 번호가 여기에 뜬다.</div>}
            <div style={{ display: 'grid', gap: '12px' }}>
              {shown.map(r => { const off = offOf(r), ns = allOf(r), n = ns.length - ns.filter(x => off.indexOf(x) >= 0).length; return (
                <div key={r}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }} className="num">{r.replace('|', ' ')}</span><span style={{ fontSize: '12px', color: K.muted }} className="num">{n}지문</span>
                    <span style={{ marginLeft: 'auto' }}><button style={tbtn()} onClick={() => setOff(r, [])}>전부 넣기</button><button style={tbtn()} onClick={() => setOff(r, ns.slice())}>전부 빼기</button></span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {ns.map(x => { const on = off.indexOf(x) < 0; return <button key={x} className="num" style={chip(on)} onClick={() => setOff(r, on ? off.concat([x]) : off.filter(k => k !== x))}>{x}</button>; })}
                  </div>
                </div>
              ); })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '14px' }}><span style={{ fontSize: '13px', color: K.muted }} className="num">{rounds.length ? rounds.length + '회차 · ' + mockN + '지문' : '회차를 골라 주세요'}</span>
              <button style={Object.assign({}, btn(true, !mockN), { marginLeft: 'auto' })} disabled={!mockN} onClick={addMock}>더하기</button></div>
          </div>
        )) : d.tab === 'book' ? (!bookNames.length ? <div style={{ padding: '24px 0', color: K.muted, fontSize: '13.5px' }}>{d.grade} 교과서 지문이 없습니다.</div> : (
          <div style={{ marginTop: '16px' }}>
            <p style={lab}>교과서</p>
            <select value={book} onChange={(e) => set({ book: e.target.value, lessons: [] })} style={Object.assign({}, inputS, { width: '100%' })}>{bookNames.map(b => <option key={b}>{b}</option>)}</select>
            <p style={Object.assign({}, lab, { marginTop: '14px' })}>과</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '6px 12px' }}>
              {lessons.map(l => { const on = lsel.indexOf(l) >= 0; return <div key={l} onClick={() => set({ lessons: on ? lsel.filter(x => x !== l) : lsel.concat([l]) })} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding: '4px 0' }}>{box(on)}{l}<span style={{ color: K.muted, fontSize: '12px' }} className="num">{lesN(l)}</span></div>; })}
            </div>
            {bookHasApp && <div onClick={() => set({ appendix: !appOn })} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '13px', cursor: 'pointer' }}>{box(appOn)}부록 넣기<span style={{ color: K.muted, fontSize: '12px' }} className="num">{lsel.length ? '고른 과의 부록 ' + bookApp + '지문' : '과마다 딸린 부록 지문'}</span></div>}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '18px' }}><span style={{ fontSize: '13px', color: K.muted }} className="num">{bookN}지문</span>
              <button style={Object.assign({}, btn(true, !bookN), { marginLeft: 'auto' })} disabled={!bookN} onClick={() => add([Object.assign({ kind: 'book', grade: d.grade, book, lessons: lessons.filter(l => lsel.indexOf(l) >= 0), n: bookN }, appOn ? null : { noAppendix: true })], { lessons: [] })}>더하기</button></div>
          </div>
        )) : (
          <div style={{ marginTop: '16px' }}>
            <div style={Object.assign({}, def, { margin: '0 0 14px' })}>모의고사·교과서로 나뉘지 않는 지문(학교에서 따로 나눠 준 지문 등) — 앱의 학교별 지문에 올라 있는 {d.grade} 것.</div>
            {!xSchools.length && <div style={{ padding: '10px 0 14px', color: K.muted, fontSize: '13.5px' }}>{d.grade} 추가 지문이 없습니다.</div>}
            <div style={{ display: 'grid', gap: '16px' }}>
              {xSchools.map(sc => { const us = extras[sc].slice().sort(xNat), cur = xSel[sc] || []; const put = (list) => { const nx = Object.assign({}, xSel); if (list.length) nx[sc] = list; else delete nx[sc]; set({ xSel: nx }); }; return (
                <div key={sc}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{sc}</span><span style={{ fontSize: '12px', color: K.muted }} className="num">{us.length}지문</span>
                    <span style={{ marginLeft: 'auto' }}><button style={tbtn()} onClick={() => put(us.slice())}>전부 넣기</button><button style={tbtn()} onClick={() => put([])}>전부 빼기</button></span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px 12px' }}>
                    {us.map(u => { const on = cur.indexOf(u) >= 0; return <div key={u} onClick={() => put(on ? cur.filter(x => x !== u) : cur.concat([u]))} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding: '4px 0' }}>{box(on)}{u}</div>; })}
                  </div>
                </div>
              ); })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '18px' }}><span style={{ fontSize: '13px', color: K.muted }} className="num">{xN}지문</span>
              <button style={Object.assign({}, btn(true, !xN), { marginLeft: 'auto' })} disabled={!xN} onClick={() => add(Object.keys(xSel).map(sc => ({ kind: 'extra', grade: d.grade, school: sc, units: xSel[sc].slice().sort(xNat), n: xSel[sc].length })), { xSel: {} })}>더하기</button></div>
          </div>
        )}
      </React.Fragment>)
    );
  };

  // 범위 더하기 창이 열리면 그 학년의 지문 키를 읽는다(gradeKeys)
  useEffect(() => {
    if (!dlg || dlg.kind !== 'src' || dlg.keys) return;
    let off = false; const grade = dlg.grade;
    gradeKeys(grade).then((keys) => { if (!off) setDlg((x) => (x && x.kind === 'src' ? Object.assign({}, x, { keys }) : x)); }).catch((e) => { if (!off) { setErr(emErr(e)); setDlg(null); } });
    return () => { off = true; };
  }, [dlg && dlg.kind, dlg && dlg.grade]);

  // ======================= 3. 진행 =======================
  const progView = () => {
    if (!paper) return <SlLoading />;
    const P = paper.progress || {}; const units = P.units || []; const n = P.n || units.length; const done = P.done || 0;
    const fin = paper.status === 'done'; const st = paper.status;
    const steps = [['분석', '등록할 때 해 둔 것', 1], ['적합도·설계', P.stage === 'fit' ? '짜는 중' : st === 'queued' ? '' : '끝', st === 'queued' ? 0 : P.stage === 'fit' ? 0.5 : 1], ['유형 배정', n ? n + '묶음' : '', n ? 1 : 0],
      ['출제·평가', n ? done + '/' + n + '묶음' : '', n ? done / n : 0], ['정답 번호 맞춤', fin ? '①~⑤ 고르게' : '', fin ? 1 : 0], ['시험지로 조립', fin ? (paper.form === 'school' ? paper.school + ' 양식' : '평가원 양식') : '', fin ? 1 : 0]];
    const head = fin ? '다 만들었습니다 — 시험지로 조립했습니다' : st === 'queued' ? '작업자를 기다리는 중' : st === 'stopping' ? '멈추는 중' : st === 'stopped' ? '멈췄습니다 — ' + done + '/' + n + '묶음 통과' : st === 'error' ? '멈췄습니다 — 오류'
      : !P.stage || P.stage === 'fit' ? '설계하는 중' : P.stage === 'final' ? '마무리하는 중' : '만드는 중 — ' + done + '/' + n + '묶음 통과';
    // 속 기록 한 줄(영어 유형 이름이 섞인다) 대신 단계마다 하는 일을 우리말로
    const doing = !P.stage || P.stage === 'fit' ? '지문마다 어떤 유형이 맞는지 보고 출제 설계를 짠다 — 끝나면 묶음이 정해진다'
      : P.stage === 'final' ? '정답 번호를 고르게 맞추고 시험지 전체를 검사한다' : '묶음마다 출제하고 검수자 둘이 검사한다 — 떨어지면 지적대로 다시 만든다';
    const why = st === 'queued' ? '클라우드 출제 작업이 곧 받아 시작한다(늦어도 10분 안)' : st === 'error' ? paper.note : fin ? (paper.minutes ? paper.minutes + '분 · ' : '') + Number(paper.cost || 0).toFixed(2) + '달러' : st === 'stopped' ? '이어서 만들면 통과한 묶음은 그대로 두고 남은 것부터 한다' : doing;
    const setStatus = (s) => SB.from('exam_papers').update({ status: s, updated_at: new Date().toISOString() }).eq('id', paper.id).then(({ error }) => { if (error) throw error; if (s === 'queued') emKick(); setDlg(null); load(); }).catch((e) => setErr(emErr(e)));
    return (
      <React.Fragment>
        <section style={card}>
          <div style={chead}>
            <h2 style={h2}>{head}</h2><span style={sub}>{why}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              {fin ? <button style={btn(true)} onClick={() => { loadItems(paper.id); setScreen('review'); }}>문항 검수</button>
                : st === 'stopped' || st === 'error' ? <button style={btn(true)} onClick={() => setStatus('queued')}>이어서 만들기</button>
                  : st === 'stopping' ? null : <button style={tbtn(true)} onClick={() => setDlg({ kind: 'stop', setStatus })}>멈추기</button>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {steps.map(([t, d2, f]) => (
              <div key={t} style={{ paddingRight: '12px' }}>
                <div style={{ height: '3px', background: K.raised, marginBottom: '10px', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}><i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.round(f * 100) + '%', background: K.ink }} /></div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{t}</div><div style={{ fontSize: '12px', color: K.muted, marginTop: '2px' }} className="num">{d2 || ' '}</div>
              </div>
            ))}
          </div>
        </section>
        <div data-mstack="" style={{ display: 'grid', gridTemplateColumns: '1fr minmax(260px, 320px)', gap: '12px', alignItems: 'start' }}>
          <section style={card}>
            <div style={chead}><h2 style={h2}>묶음</h2><span style={sub}>지문 하나가 한 묶음 · 한 지문에 문항이 여럿이면 함께 만든다</span></div>
            {!units.length ? <div style={{ padding: '20px 0', textAlign: 'center', color: K.muted, fontSize: '13.5px' }}>{st === 'queued' ? '시작하면 묶음이 여기에 뜬다' : '지문마다 어떤 유형이 맞는지 보고 설계하는 중 — 끝나면 묶음이 뜬다'}</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead><tr><th style={th}>문항</th><th style={th}>유형</th><th style={th}>지문</th><th style={th}>상태</th></tr></thead>
                <tbody>{units.map(u => <tr key={u.id}><td style={Object.assign({}, td, { whiteSpace: 'nowrap' })} className="num">{u.nos.join('·')}번</td><td style={td}>{u.kinds.join(' · ')}</td><td style={Object.assign({}, td, { color: K.muted })}>{u.src}</td>
                  <td style={Object.assign({}, td, { whiteSpace: 'nowrap', color: u.ok ? K.pos : st === 'running' ? K.warn : K.muted })}>{u.ok ? '통과' : st === 'running' ? '만드는 중' : st === 'stopped' || st === 'error' ? '멈춤' : '기다리는 중'}</td></tr>)}</tbody>
              </table>
            )}
          </section>
          <section style={card}>
            <div style={chead}><h2 style={h2}>쓴 돈</h2></div>
            <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 }} className="num">{Number(P.spent || 0).toFixed(2)}<small style={{ fontSize: '14px', fontWeight: 400, color: K.muted }}> 달러</small></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', marginTop: '12px' }}><tbody>{(P.by || []).map(([k, v]) => <tr key={k}><td style={Object.assign({}, td, { paddingLeft: 0 })}>{k}</td><td style={Object.assign({}, td, { textAlign: 'right', paddingRight: 0 })} className="num">{Number(v).toFixed(2)}</td></tr>)}</tbody></table>
            <div style={def}>난이도별 상한(1단계 15 · 2단계 17 · 3단계 20달러)에 닿으면 그 자리에서 멈추고 만든 데까지 남긴다.</div>
          </section>
        </div>
      </React.Fragment>
    );
  };
  const stopDlg = (d) => (
    veil(520, <React.Fragment>
      <div style={chead}><h2 style={h2}>만들기를 멈출까요?</h2></div>
      <div style={{ fontSize: '13.5px' }}>지금까지 통과한 묶음은 남는다. 만들던 묶음에 쓴 돈은 돌아오지 않는다.</div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}><button style={btn(false)} onClick={() => setDlg(null)}>계속 만들기</button><button style={btn(true)} onClick={() => d.setStatus('stopping')}>멈추기</button></div>
    </React.Fragment>)
  );

  // 만든 시험지 삭제(2026-11-20 사장님) — 문항(exam_items)은 DB 가 같이 지운다(on delete cascade). 이어 만들기용 실행 폴더도 치운다. 되돌릴 수 없다
  const delPaper = (p) => {
    setBusy(true);
    SB.from('exam_papers').delete().eq('id', p.id).then(({ error }) => {
      if (error) throw error;
      SB.storage.from('exam').remove(['runs/' + p.id + '.tgz']).catch(() => {});
      if (paperId === p.id) { setPaperId(null); setItems(null); setScreen('home'); }
      setPapers((papers || []).filter(x => x.id !== p.id)); setDlg(null); say('「' + p.title + '」을 지웠습니다');
    }).catch((e) => setErr('지우지 못했습니다 — ' + emErr(e))).finally(() => setBusy(false));
  };
  const delDlg = (d) => {
    const p = (papers || []).filter(x => x.id === d.id)[0]; if (!p) return null;
    return veil(520, <React.Fragment>
      <div style={chead}><h2 style={h2}>이 시험지를 지울까요?</h2></div>
      <div style={{ fontSize: '13.5px' }}><b style={{ fontWeight: 600 }}>{p.title}</b><div style={{ fontSize: '12px', color: K.muted, marginTop: '2px' }}>{p.range}</div></div>
      <div style={{ fontSize: '13.5px', marginTop: '12px' }}>만든 문항과 고친 내용까지 함께 지워지고 <b style={{ color: K.neg, fontWeight: 600 }}>되돌릴 수 없습니다.</b> 원본 시험지는 그대로 남습니다.</div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}><button style={btn(false)} onClick={() => setDlg(null)}>취소</button><button style={Object.assign({}, btn(true, busy), { background: K.neg, borderColor: K.neg, color: '#fff' })} disabled={busy} onClick={() => delPaper(p)}>{busy ? '지우는 중…' : '삭제'}</button></div>
    </React.Fragment>);
  };

  // ======================= 4. 문항 검수 =======================
  const schoolForm = (form) => form === 'school' && paper && EM_FORMS[paper.school];
  const sheetItems = (draft) => (items || []).map(r => (draft && draft.no === r.no && draft.draft ? draft.draft : r.item));
  const saveItem = (no, patch, okMsg) => {
    const r = (items || []).filter(x => x.no === no)[0]; if (!r) return Promise.resolve();
    const next = Object.assign({}, r, patch);
    setItems((items || []).map(x => (x.no === no ? next : x)));
    return SB.from('exam_items').update(Object.assign({}, patch, { edited_by: userName, updated_at: new Date().toISOString() })).eq('id', r.id).then(({ error }) => { if (error) throw error; if (okMsg) say(okMsg); }).catch((e) => { setErr('저장하지 못했습니다 — ' + emErr(e)); setItems(items); });
  };
  const reviewView = () => {
    if (!paper || !items) return <SlLoading text="문항을 불러오는 중…" />;
    const N = items.length, nc = items.filter(r => r.confirmed).length;
    const r = items.filter(x => x.no === sel)[0]; const it = r && r.item; const D = r && r.detail;
    const dist = [1, 2, 3, 4, 5].map(k => items.filter(x => +x.item.answer === k).length);
    const rates = items.filter(x => x.detail).map(x => x.detail.rate); const avg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
    const confirmAll = () => { const ids = items.filter(x => !x.confirmed).map(x => x.id); setItems(items.map(x => Object.assign({}, x, { confirmed: true }))); SB.from('exam_items').update({ confirmed: true, edited_by: userName, updated_at: new Date().toISOString() }).in('id', ids).then(({ error }) => { if (error) throw error; say(ids.length + '문항을 확정했습니다'); }).catch((e) => { setErr(emErr(e)); loadItems(paper.id); }); };
    const confirm = () => {
      const on = !r.confirmed; saveItem(r.no, { confirmed: on });
      if (on) { const nx = items.map(x => x.no).filter(n => n > r.no && !items.filter(y => y.no === n)[0].confirmed)[0]; if (nx) setSel(nx); }
    };
    let side = null;
    if (r && edit) {
      const E2 = (patch) => setEdit(Object.assign({}, edit, patch));
      side = (
        <section style={Object.assign({}, card, { position: 'sticky', top: 0, maxHeight: 'calc(100vh - 150px)', overflow: 'auto' })}>
          <div style={chead}><h2 style={h2}>{r.no}번 직접 수정</h2><div style={{ marginLeft: 'auto' }}><button style={tbtn()} onClick={() => setEdit(null)}>취소</button></div></div>
          <p style={lab}>발문</p><input value={edit.stem} onChange={(e) => E2({ stem: e.target.value })} style={Object.assign({}, inputS, { width: '100%' })} />
          {edit.choices.map((c, i) => <div key={i}><p style={Object.assign({}, lab, { marginTop: '10px' })}>{EM_CIRC[i]}{c == null ? ' — 번호만 있는 선지' : ''}</p>
            <input value={c == null ? '' : c} disabled={c == null} onChange={(e) => E2({ choices: edit.choices.map((x, j) => (j === i ? e.target.value : x)) })} style={Object.assign({}, inputS, { width: '100%' })} /></div>)}
          {it.answer !== '' && <React.Fragment><p style={Object.assign({}, lab, { marginTop: '10px' })}>정답</p>{seg(edit.answer, EM_CIRC.map((c, i) => [i + 1, c]), (v) => E2({ answer: v }))}</React.Fragment>}
          <p style={Object.assign({}, lab, { marginTop: '10px' })}>해설</p>
          <textarea value={edit.exp} onChange={(e) => E2({ exp: e.target.value })} rows={7} style={Object.assign({}, inputS, { width: '100%', height: 'auto', padding: '8px 10px', resize: 'vertical' })} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}><button style={btn(true)} onClick={() => {
            const keepUl = (old, nw) => (String(old).replace(/[⁣⁤]/g, '') === nw ? old : nw);   // 글자를 안 바꾼 선지는 밑줄 표시를 그대로 둔다
            const item = Object.assign({}, it, { stem: (String(it.stem).match(/^\s*/) || [''])[0] + edit.stem.trim(), choices: (it.choices || []).map((c, i) => (c ? keepUl(c, edit.choices[i]) : c)), answer: it.answer === '' ? '' : String(edit.answer), rev: (it.rev || 0) + 1 });
            const head = emExpHead(it);
            item.explanation = head + edit.exp;
            saveItem(r.no, { item, detail: Object.assign({}, D || {}, { exp: edit.exp }) }, r.no + '번을 고쳤습니다').then(() => setEdit(null));
          }}>저장</button></div>
          <div style={def}>정답 번호를 바꾸면 정답 분포도 바뀐다. 지문(원문)은 고치지 않는다.</div>
        </section>
      );
    } else if (r && ai && ai.no === r.no) {
      const A2 = (patch) => setAi((x) => (x && x.no === r.no ? Object.assign({}, x, patch) : x));
      const base = ai.draft || it;   // 초안이 있으면 그 위에 이어서 고친다
      const ask = () => {
        const prompt = String(ai.prompt || '').trim(); if (!prompt || ai.busy) return;
        // 지문이 없는 문항(묶음의 둘째부터)은 같은 묶음의 윗글을 읽을거리로 같이 보낸다
        const shared = base.passage ? '' : ((items.filter(x => x.unit === r.unit && x.item.passage)[0] || {}).item || {}).passage || '';
        const orig = D && D.orig ? String(D.orig).replace(/<[^>]+>/g, '') : '';
        A2({ busy: true, err: '' });
        emAiEdit(base, { kind: r.kind, shared, orig }, prompt)
          .then((res) => A2(res.same ? { busy: false, note: res.note, err: '고친 곳이 없습니다' + (res.note ? ' — ' + res.note : '') } : { busy: false, draft: res.item, note: res.note, prompt: '' }))
          .catch((e) => A2({ busy: false, err: String((e && e.message) || e) }));
      };
      const apply = () => {
        const exp = String(ai.draft.explanation || '').slice(emExpHead(ai.draft).length);
        saveItem(r.no, { item: ai.draft, detail: Object.assign({}, D || {}, { exp }) }, r.no + '번을 고쳤습니다').then(() => setAi(null));
      };
      side = (
        <section style={Object.assign({}, card, { position: 'sticky', top: 0, maxHeight: 'calc(100vh - 150px)', overflow: 'auto' })}>
          <div style={chead}><h2 style={h2}>{r.no}번 AI로 수정</h2><div style={{ marginLeft: 'auto' }}><button style={tbtn()} onClick={() => setAi(null)}>취소</button></div></div>
          {ai.draft && <React.Fragment>
            <div style={{ fontSize: '13.5px', fontWeight: 600 }}>고친 문항이 왼쪽 시험지에 보입니다</div>
            {ai.note && <div style={{ fontSize: '13px', marginTop: '6px' }}>{ai.note}</div>}
            <p style={Object.assign({}, lab, { marginTop: '14px' })}>정답</p>
            <div style={{ fontSize: '13.5px' }} className="num">{ai.draft.answer !== '' ? String(ai.draft.answer).split('').map(c => EM_CIRC[+c - 1] || c).join('') : '서답형'}{String(ai.draft.answer) !== String(it.answer) && <span style={{ color: K.neg }}> — 바뀜(전 {String(it.answer).split('').map(c => EM_CIRC[+c - 1] || c).join('')})</span>}</div>
            <p style={Object.assign({}, lab, { marginTop: '14px' })}>해설</p>
            <div style={{ fontSize: '13px', whiteSpace: 'pre-line' }}>{String(ai.draft.explanation || '').slice(emExpHead(ai.draft).length)}</div>
            <div style={{ display: 'flex', gap: '8px', margin: '16px 0 20px' }}>
              <button style={btn(false, ai.busy)} disabled={ai.busy} onClick={() => A2({ draft: null, note: '', err: '' })}>되돌리기</button>
              <button style={Object.assign({}, btn(true, ai.busy), { marginLeft: 'auto' })} disabled={ai.busy} onClick={apply}>적용</button>
            </div>
          </React.Fragment>}
          <p style={lab}>{ai.draft ? '더 고칠 곳 — 지금 보이는 문항에 이어서 고친다' : '어떻게 고칠지 적는다'}</p>
          <textarea value={ai.prompt} onChange={(e) => A2({ prompt: e.target.value })} rows={5} disabled={ai.busy} placeholder={'예) ③번 선지를 정답과 더 헷갈리게 바꿔 줘\n예) 해설에 오답 풀이를 선지마다 넣어 줘'} style={Object.assign({}, inputS, { width: '100%', height: 'auto', padding: '8px 10px', resize: 'vertical', lineHeight: 1.5 })} />
          {ai.err && <div style={{ fontSize: '12.5px', color: K.neg, marginTop: '8px' }}>{ai.err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}><button style={btn(!ai.draft, ai.busy || !String(ai.prompt || '').trim())} disabled={ai.busy || !String(ai.prompt || '').trim()} onClick={ask}>{ai.busy ? 'AI가 고치는 중…' : '수정 요청'}</button></div>
          <div style={def}>이 문항만 고친다. '적용'을 누르기 전에는 저장되지 않는다. 한 번 요청에 100원 안팎(Claude).</div>
        </section>
      );
    } else if (r) {
      side = (
        <section style={Object.assign({}, card, { position: 'sticky', top: 0, maxHeight: 'calc(100vh - 150px)', overflow: 'auto' })}>
          <div style={chead}><h2 style={h2}>{r.no}번 · {r.kind}</h2><span style={sub}>{it.answer !== '' ? '정답 ' + (EM_CIRC[+it.answer - 1] || it.answer) : '서답형'}{r.confirmed ? <span style={{ color: K.pos }}> · 확정함</span> : ''}</span><div style={{ marginLeft: 'auto' }}><button style={tbtn()} onClick={() => setSel(0)}>닫기</button></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
            <button style={btn(false)} onClick={() => setEdit({ stem: String(it.stem).trim(), choices: (it.choices || []).map(c => (c ? String(c).replace(/[⁣⁤]/g, '') : null)), answer: +it.answer || 1, exp: (D && D.exp) || '' })}>직접 수정</button>
            <button style={btn(false)} onClick={() => setAi({ no: r.no, prompt: '', busy: false, draft: null, note: '', err: '' })}>AI로 수정</button>
          </div>
          {D ? <React.Fragment>
            <p style={lab}>지문 · 변형률</p>
            <div style={{ fontSize: '13.5px' }}>{r.src} · <b className="num">{D.rate}%</b> <span style={{ fontSize: '12px', color: K.muted }}>{D.gist ? '대의 파악 — 첫 문장만 바꿈' : '원문 ' + D.words + '낱말 중'}</span></div>
            <p style={Object.assign({}, lab, { marginTop: '14px' })}>원문 — <b style={{ color: K.neg, fontWeight: 700 }}>빨간 굵은 글자</b> = 변형된 곳</p>
            <div className="em-src" style={{ font: "400 13px/1.6 Georgia, 'Times New Roman', serif", maxHeight: '280px', overflow: 'auto', border: '1px solid ' + K.border, borderRadius: K.rCtl + 'px', padding: '10px 12px' }} dangerouslySetInnerHTML={{ __html: D.orig }} />
            <p style={Object.assign({}, lab, { marginTop: '14px' })}>출제 의도</p><div style={{ fontSize: '13px' }}>{D.intent}</div>
            <p style={Object.assign({}, lab, { marginTop: '14px' })}>해설</p><div style={{ fontSize: '13px', whiteSpace: 'pre-line' }}>{D.exp}</div>
          </React.Fragment> : <div style={{ fontSize: '13px', color: K.muted }}>이 문항은 상세 기록이 없습니다.</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button style={Object.assign({}, btn(!r.confirmed), { marginLeft: 'auto' })} onClick={confirm}>{r.confirmed ? '확정 풀기' : '확정하고 다음 문항'}</button>
          </div>
          <div style={def}>고친 것·확정한 것은 한 문항씩 바로 저장된다.</div>
        </section>
      );
    }
    return (
      <React.Fragment>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{paper.title}</span>
          <span style={{ fontSize: '13px', color: K.muted }} className="num">{N}문항 · {paper.level}단계 {(EM_LEVELS[paper.level - 1] || {}).name} · 평균 변형률 {avg}% · 정답 {dist.map((d2, i) => EM_CIRC[i] + d2).join(' ')} · <b style={{ color: K.text }}>확정 {nc}/{N}</b></span>
          <span style={{ marginLeft: 'auto', fontSize: '13px', color: K.muted }}>{sel ? '' : '문항을 누르면 고칠 수 있다'}</span>
          {nc < N && <button style={btn(false)} onClick={confirmAll}>남은 {N - nc}문항 확정</button>}
          <button style={btn(true)} onClick={openOut}>내보내기</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: side ? 'minmax(0, 1fr) 420px' : 'minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>
          <div className="em-sheets" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 150px)', padding: '4px 0 20px' }}>
            {schoolForm(paper.form) ? <SchoolSheets items={sheetItems(ai)} cfg={Object.assign({}, paper.cfg || {}, { school: EM_FORMS[paper.school], noAns: true })} sel={sel} onPick={(n) => { setSel(n); setEdit(null); setAi(null); }} />
              : <WeeklyTestSheets items={sheetItems(ai)} teacher="" range="" dateTitle={paper.title} info={[paper.title + ' 시험지입니다']} withAnswers={false} noQr={true} selId={it ? it.id : null} onSelect={(id) => { const x = items.filter(y => y.item.id === id)[0]; if (x) { setSel(x.no); setEdit(null); setAi(null); } }} />}
          </div>
          {side}
        </div>
      </React.Fragment>
    );
  };

  // ======================= 5. 내보내기 =======================
  // 정답지는 늘 붙인다(2026-11-20 사장님 — "그냥 무조건 붙여". 붙인다/뺀다 고르기와 '순서' 안내를 뺐다)
  const openOut = () => { const c = paper.cfg || {}; setOut({ title: paper.title, form: paper.form, term: c.term || '', date: c.date || '', ans: true }); setScreen('out'); };
  const saveOut = (o) => SB.from('exam_papers').update({ title: o.title, form: o.form, cfg: Object.assign({}, paper.cfg || {}, { term: o.term, date: o.date }), updated_at: new Date().toISOString() }).eq('id', paper.id)
    .then(({ error }) => { if (error) throw error; setPapers((papers || []).map(p => (p.id === paper.id ? Object.assign({}, p, { title: o.title, form: o.form, cfg: Object.assign({}, p.cfg || {}, { term: o.term, date: o.date }) }) : p))); }).catch((e) => setErr(emErr(e)));
  // 주간테스트로 등록 — 주차·반·선생님을 정해 weekly_tests 에 한 줄 넣는다. 그 뒤는 주간테스트 관리의 일이다(채점 링크 · 성적 · 시험지 보기).
  // 시험지 모양(학교 양식·머리글)은 내보내기 화면에서 정한 그대로 payload.sheet 에 실린다. 같은 시험지를 여러 번 등록하는 것은 막지 않는다(반·주차가 다를 수 있다)
  const wkSave = (d) => {
    const title = String(d.title || '').trim();
    if (!title) return setErr('시험 이름을 적어 주세요');
    if (!d.classIds.length) return setErr('이 시험지를 볼 반을 하나 이상 골라 주세요');
    const form = out.form === 'school' && EM_FORMS[paper.school] ? EM_FORMS[paper.school] : null;
    const payload = { source: 'exam', file: '시험지 관리 · ' + paper.title, head: {}, items: emWeeklyItems(items),
      sheet: { paper_id: paper.id, form, cfg: Object.assign({}, paper.cfg || {}, { term: out.term, date: out.date }), title, items: sheetItems() } };
    setBusy(true);
    SB.from('weekly_tests').insert({ owner_name: userName, title, week_start: d.week, teacher: String(d.teacher || '').trim() || null, range_text: paper.range || null, item_count: items.length, class_ids: d.classIds, payload })
      .then(({ error }) => { if (error) throw error; setErr(''); setDlg(null); say('주간테스트로 등록했습니다 — 주간테스트 관리에서 채점 링크와 성적을 봅니다'); })
      .catch((e) => setErr('등록하지 못했습니다 — ' + emErr(e))).finally(() => setBusy(false));
  };
  const wkDlg = (d) => {
    const set = (patch) => setDlg(Object.assign({}, d, patch));
    return veil(820, <React.Fragment>
      <div style={chead}><h2 style={h2}>주간테스트로 등록</h2><span style={sub} className="num">{items ? items.length : 0}문항</span></div>
      <div data-mstack="" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: '20px', alignItems: 'start' }}>
        <div>
          <p style={lab}>시험 이름 — 표지에 이 이름이 찍힌다</p>
          <input value={d.title} onChange={(e) => set({ title: e.target.value })} style={Object.assign({}, inputS, { width: '100%' })} />
          <p style={Object.assign({}, lab, { marginTop: '14px' })}>주차</p>
          <select value={d.week} onChange={(e) => set({ week: e.target.value })} style={Object.assign({}, inputS, { width: '100%' })}>{waWeekOptions(16).map(w => <option key={w} value={w}>{waWeekName(w)} ({waWeekSpan(w)})</option>)}</select>
          <p style={Object.assign({}, lab, { marginTop: '14px' })}>선생님 — 표지에 들어간다</p>
          <input value={d.teacher} onChange={(e) => set({ teacher: e.target.value })} style={Object.assign({}, inputS, { width: '100%' })} />
          <div style={def}>등록하면 고른 반 학생들의 채점 링크에 이 시험지가 뜬다. 성적·시험지 보기는 주간테스트 관리에서 한다.</div>
        </div>
        <div>
          <BkClassTree owner={d.teacher} value={d.classIds} onChange={(v) => set({ classIds: v })} dark={dark} T={K} label="이 시험지를 볼 반" emptyHint="반을 하나 이상 골라 주세요." />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
        <button style={btn(false)} onClick={() => setDlg(null)}>취소</button>
        <button style={btn(true, busy || !d.classIds.length)} disabled={busy || !d.classIds.length} onClick={() => wkSave(d)}>{busy ? '등록하는 중…' : '등록'}</button>
      </div>
    </React.Fragment>);
  };
  const outView = () => {
    if (!paper || !items || !out) return <SlLoading />;
    const school = schoolForm(out.form);
    const setO = (patch, save) => { const o = Object.assign({}, out, patch); setOut(o); if (save) saveOut(o); };
    const printNow = () => { const nm = String(out.title || '시험지').replace(/[\\/:*?"<>|]/g, ' ').trim(); if (window.desktopSavePDF) return window.desktopSavePDF(nm + '.pdf'); const prev = document.title; document.title = nm; window.print(); document.title = prev; };
    return (
      <div data-row="" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: '12px', alignItems: 'start' }}>
        <section data-noprint="" style={card}>
          <div style={chead}><h2 style={h2}>시험지 내보내기</h2></div>
          <p style={lab}>시험 이름 — 표지에 들어간다</p>
          <input value={out.title} onChange={(e) => setO({ title: e.target.value })} onBlur={() => saveOut(out)} style={Object.assign({}, inputS, { width: '100%' })} />
          <p style={Object.assign({}, lab, { marginTop: '20px' })}>양식</p>
          {seg(out.form, (EM_FORMS[paper.school] ? [['school', paper.school]] : []).concat([['wt', '평가원']]), (v) => setO({ form: v }, true))}
          {school && <React.Fragment>
            <p style={Object.assign({}, lab, { marginTop: '20px' })}>시험지 머리 — 1쪽 학교 양식에 들어간다</p>
            <input value={out.term} onChange={(e) => setO({ term: e.target.value })} onBlur={() => saveOut(out)} placeholder="2026학년도 2학기 기말고사" style={Object.assign({}, inputS, { width: '100%' })} />
            <input value={out.date} onChange={(e) => setO({ date: e.target.value })} onBlur={() => saveOut(out)} placeholder="2026년 11월 20일 1교시" style={Object.assign({}, inputS, { width: '100%', marginTop: '8px' })} />
          </React.Fragment>}
          <div style={{ marginTop: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button style={Object.assign({}, btn(true), { height: '36px', fontSize: '14px' })} onClick={printNow}>PDF 받기</button>
            <button style={Object.assign({}, btn(false), { height: '36px', fontSize: '14px' })} onClick={() => setDlg({ kind: 'wk', title: out.title, week: waMonday(waToday()), teacher: userName || '', classIds: [] })}>주간테스트로 등록</button>
          </div>
        </section>
        <section data-main="" style={Object.assign({}, card, { padding: '16px' })}>
          <div data-noprint="" style={Object.assign({}, chead, { margin: '0 4px 12px' })}><h2 style={h2}>미리보기</h2><span style={sub}>인쇄되는 그대로</span></div>
          <div data-scroll="" className="em-out" style={{ background: K.ground, borderRadius: K.rCard + 'px', overflow: 'auto', maxHeight: 'calc(100vh - 170px)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <EmTitleCover title={out.title} />
            <div data-sheet="" style={EM_SHEET} />
            {school ? <SchoolSheets items={sheetItems()} cfg={Object.assign({}, paper.cfg || {}, { school: EM_FORMS[paper.school], term: out.term, date: out.date, noAns: !out.ans })} />
              : <div className="em-nocover"><WeeklyTestSheets items={sheetItems()} teacher="" range="" dateTitle={out.title} info={[out.title + ' 시험지입니다']} withAnswers={false} noQr={true} /></div>}
            {out.ans && <WeeklyTestSheets items={sheetItems()} teacher="" range="" dateTitle={out.title} answersOnly={true} noQr={true} ansLabel={out.title + ' 정답 및 해설'} ansPlain={true} />}
          </div>
        </section>
      </div>
    );
  };

  // ======================= 틀 =======================
  const TITLES = { home: '학교·학년별 기준 시험지', make: '새 시험지', prog: paper ? paper.title + ' — 만드는 중' : '', review: paper ? paper.title + ' — 문항 검수' : '', out: paper ? paper.title + ' — 내보내기' : '' };
  let body = null;
  if (!origs || !papers) body = err ? null : <SlLoading />;
  else if (screen === 'make' && mk) body = makeView();
  else if (screen === 'prog') body = progView();
  else if (screen === 'review') body = reviewView();
  else if (screen === 'out') body = outView();
  else body = homeView();
  return (
    <div data-root="" style={{ minHeight: '100vh', background: K.ground, color: K.text, fontFamily: TT_FONT }}>
      <style>{'.em-src .chg{color:' + K.neg + ';font-weight:700}.em-sheets [data-sheet],.em-out [data-sheet]{border:1px solid #e0e0e0;box-shadow:rgba(0,0,0,.1) 0 12px 44px;margin:0 auto 28px}.em-out [data-sheet]{margin:0 auto!important}.em-out>*{flex:none}'
        + '.em-sheets .wt-psg,.em-out .wt-psg{text-indent:1.5em}.em-sheets .wt-given,.em-out .wt-given{white-space:pre-line}.em-nocover .wt-print-only{display:none!important}'
        + '@media print{.em-out{gap:0!important;padding:0!important}}'}</style>
      <nav data-noprint="" style={{ height: '46px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px', borderBottom: '1px solid ' + K.border }}>
        {screen !== 'home' && <button style={btn(false)} onClick={() => { setScreen(screen === 'out' ? 'review' : 'home'); setDlg(null); setEdit(null); setAi(null); }}>‹ {screen === 'out' ? '문항 검수' : '처음으로'}</button>}
        <span style={{ fontSize: '16px', fontWeight: 600 }}>시험지 관리</span>
        <span style={{ fontSize: '13px', color: K.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>› {TITLES[screen]}</span>
      </nav>
      <div data-main="" style={{ padding: '16px 20px 28px', display: 'grid', gap: '12px' }}>
        {err && <div data-noprint="" style={{ border: '1px solid ' + K.neg, color: K.neg, borderRadius: K.rCard + 'px', padding: '10px 14px', fontSize: '13px', display: 'flex', gap: '12px', alignItems: 'center', background: K.surface }}>{err}<button style={Object.assign({}, tbtn(), { marginLeft: 'auto' })} onClick={() => { setErr(''); load(); }}>다시 읽기</button></div>}
        {body}
      </div>
      {dlg && dlg.kind === 'reg' && regDlg(dlg)}
      {dlg && dlg.kind === 'an' && anDlg(dlg)}
      {dlg && dlg.kind === 'src' && srcDlg(dlg)}
      {dlg && dlg.kind === 'stop' && stopDlg(dlg)}
      {dlg && dlg.kind === 'del' && delDlg(dlg)}
      {dlg && dlg.kind === 'wk' && paper && items && out && wkDlg(dlg)}
      {msg && <div data-noprint="" style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', background: K.ink, color: K.inkText, borderRadius: K.rCard + 'px', padding: '10px 16px', fontSize: '13px', zIndex: 70 }}>{msg}</div>}
    </div>
  );
}
