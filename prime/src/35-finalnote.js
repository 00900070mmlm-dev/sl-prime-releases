// 파이널노트 — 교재 제작(04-studio.js 의 tbKind === 'finalnote') 틀.
// 2026-11-26 사장님 — "앱에 파이널노트 제작을 교재제작에 넣어야 해, N개·최중요·3분그래머는 거기서 나올거야", "분석서도 교재제작에서 분석서 파트에서".
//   · 왼쪽 자료 판에서 고른 지문(sheets)이 범위다. 학교·학년을 고르면 엔진의 기준 시험지 칸과 표지 색이 정해진다.
//   · 파트(순서 고정): 쌩본문 · 주제정리 · 한문장배열 · 최중요어법 · N개찾기 · 3분 그래머(강 범위 6강 이상 · 문항 수 — 비우면 강 수만큼, 강 수를 넘지 못한다) · 분석서.
//     앱이 바로 그리는 것 = 쌩본문 · 한문장배열. 엔진이 만드는 것 = 주제정리(topic3) · 최중요어법(jungyo) · N개찾기(ncha) · 3분 그래머(g3min) · 분석서(abook).
//   · 「엔진으로 만들기」는 engine_jobs(scripts/engine_jobs_schema.sql)에 파트마다 한 줄(queued)을 적고 깨우기 주소(29-exammaker.js 의 emKick)를 부른다.
//     클라우드 작업자(exam-lab/worker.mjs ③)가 모듈을 돌려 result 에 JSON 을 넣으면 여기서 읽어 시트로 그린다. 진행은 10초마다 다시 읽는다.
//   · 책 id(book_id) = 학교·학년·고른 지문 key 의 해시(uuid 꼴) — 같은 범위를 다시 열면 전에 만든 결과가 그대로 붙는다. 범위가 바뀌면 다른 책이다.
//   · 조판은 finalnote/scripts/build.mjs 를 React 로 옮긴 것: 680px 한 단(N개찾기는 329px 두 단)으로 블록 높이를 실측해 쪽에 채우고(Hcap 1040),
//     파트마다 간지 2면(파트 표지 · 목차) + 홀수쪽 시작(메모 면으로 맞춤) + 미러 마진 + 쪽번호. 교재는 인쇄물 — 메모 줄은 진짜 선, 그라데이션·그림자 없음.
//   · 분석서는 엔진이 낸 PDF(저장소 jobs/<일 id>/<n>/analysis.pdf)를 pdf.js 로 쪽마다 그려 시트로 넣는다(모의고사 앱의 MePdfDoc 과 같은 방식).
//   · 표지의 「글자 속 하늘」(시안 77번)은 아직 안 넣었다 — 파트 표지의 큰 번호를 연회색으로 둔다.
const FN_KINDS = ['고1', '고2', '고3'];
const FN_SCHOOLS = ['원당고', '아라고', '이음고'];
const FN_PARTS = [
  { k: 'raw', l: '쌩본문', en: 'PASSAGES' }, { k: 'topic3', l: '주제정리', en: 'KEY TOPICS', job: true }, { k: 'order', l: '한문장배열', en: 'SENTENCE ORDER' },
  { k: 'jungyo', l: '최중요어법', en: 'KEY GRAMMAR', job: true }, { k: 'ncha', l: 'N개찾기', en: 'FIND THE ERRORS', job: true },
  { k: 'g3min', l: '3분 그래머', en: '3-MINUTE GRAMMAR', job: true }, { k: 'abook', l: '분석서', en: 'ANALYSIS', job: true }
];
const FN_COLOR = { 원당고고1: '#0f5a96', 원당고고2: '#111111', 아라고고1: '#8c7355', 아라고고2: '#14213d' };   // finalnote/scripts/build.mjs 의 T77 — 표지·간지 색
const FN_BUSY = ['queued', 'running', 'stopping'];
const FN_CIRC = ['①', '②', '③', '④', '⑤'];
const FN_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 책 id — 학교·학년·지문 key 를 uuid 꼴로 해시(같은 범위 = 같은 책) */
function fnBookId(school, grade, keys) {
  const s = school + '|' + grade + '|' + keys.slice().sort().join('|');
  const h = (seed) => { let x = seed >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return ('00000000' + x.toString(16)).slice(-8); };
  const hex = h(0x811c9dc5) + h(0x1b873593) + h(0xcc9e2d51) + h(0x85ebca6b);
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-4' + hex.slice(13, 16) + '-a' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
}
const fnLoad = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const fnSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/** 파이널노트 상태 + 엔진 일 — App(04-studio.js)이 한 번 부르고 FinalnoteBar·FinalnoteSheets 에 넘긴다 */
function useFinalnote({ sheets, userName, active }) {
  const [school, setSchool] = useState(() => fnLoad('fn_school', '원당고'));
  const [grade, setGrade] = useState(() => fnLoad('fn_grade', '고1'));
  const [parts, setParts] = useState(() => fnLoad('fn_parts', ['raw', 'topic3', 'order', 'ncha']));
  const [g3, setG3] = useState(() => fnLoad('fn_g3', { from: 46, to: 60 }));
  const [jobs, setJobs] = useState([]);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => { fnSave('fn_school', school); fnSave('fn_grade', grade); fnSave('fn_parts', parts); fnSave('fn_g3', g3); }, [school, grade, parts, g3]);
  const keys = sheets.map(s => s.key);
  const bookId = keys.length ? fnBookId(school, grade, keys) : null;
  // 지문을 하나씩 고를 때마다 책 id 가 바뀌어 조회가 여러 번 나간다 — 느린 옛 조회가 늦게 돌아와 새 결과를 덮지 않게 마지막 요청만 받는다(실측: 3분 그래머 결과가 있는데 ○ 로 떴다)
  const reqRef = useRef(0);
  const reload = () => {
    if (!bookId || !active) return Promise.resolve();
    const my = ++reqRef.current;
    return SB.from('engine_jobs').select('id,kind,title,params,status,progress,result,note,cost,minutes,created_at,updated_at').eq('book_id', bookId).order('created_at', { ascending: false })
      .then(({ data, error }) => { if (my !== reqRef.current) return; if (error) { setErr(error.message || String(error)); return; } setErr(''); setJobs(data || []); });
  };
  useEffect(() => { setJobs([]); reload(); }, [bookId, active]);
  useEffect(() => { if (tick) reload(); }, [tick]);
  const busy = jobs.some(j => FN_BUSY.indexOf(j.status) >= 0);
  useEffect(() => { if (!busy || !active) return; const t = setInterval(() => setTick(x => x + 1), 10000); return () => clearInterval(t); }, [busy, active]);
  // 종류마다 가장 나중 일 하나
  const latest = {}; jobs.forEach(j => { if (!latest[j.kind]) latest[j.kind] = j; });
  const make = (kinds) => {
    if (!bookId) return Promise.resolve();
    const rows = kinds.map(k => {
      const title = '파이널노트 ' + school + ' ' + grade + ' · ' + (FN_PARTS.find(p => p.k === k) || {}).l;
      const params = k === 'g3min' ? { from: +g3.from, to: +g3.to, ...(+g3.n ? { n: +g3.n } : {}) } : { keys, book: { school, grade } };   // n = 문항 수(비우면 강 수만큼 — 2026-11-26 사장님 "분량을 지정할 수 있게")
      return { kind: k, school, grade, title, params, status: 'queued', book_id: bookId, created_by: userName || null };
    });
    return SB.from('engine_jobs').insert(rows).then(({ error }) => { if (error) { setErr(error.message || String(error)); return; } if (typeof emKick === 'function') emKick(); setTick(x => x + 1); });
  };
  const setStatus = (job, status) => SB.from('engine_jobs').update({ status, updated_at: new Date().toISOString() }).eq('id', job.id).then(() => { if (status === 'queued' && typeof emKick === 'function') emKick(); setTick(x => x + 1); });
  return { school, setSchool, grade, setGrade, parts, setParts, g3, setG3, jobs, latest, busy, err, bookId, keys, make, stop: (job) => setStatus(job, 'stopping'), requeue: (job) => setStatus(job, 'queued'), reload: () => setTick(x => x + 1) };
}

function fnJobLabel(j) {
  if (!j) return '아직 안 만듦';
  const p = j.progress || {};
  if (j.status === 'queued') return '작업자를 기다리는 중';
  if (j.status === 'running') return '만드는 중' + (p.total ? ' ' + (p.done || 0) + '/' + p.total : p.done ? ' ' + p.done : '') + (p.spent ? ' · $' + p.spent : '');
  if (j.status === 'stopping') return '멈추는 중';
  if (j.status === 'stopped') return '멈춤';
  if (j.status === 'error') return '실패' + (j.note ? ' — ' + j.note : '');
  if (j.status === 'done') { const r = j.result || {}; const n = r.items ? r.items.length : r.part1 ? r.part1.items.length : 0; return '끝 · ' + n + '개' + (j.cost ? ' · $' + j.cost : ''); }
  return j.status;
}

/** 도구 막대 — 학교·학년·파트·강 범위·만들기·진행 */
function FinalnoteBar({ fn, K, T, chipStyle, sheetsN }) {
  const jobParts = fn.parts.filter(k => (FN_PARTS.find(p => p.k === k) || {}).job);
  const redo = k => !fn.latest[k] || ['error', 'stopped'].indexOf(fn.latest[k].status) >= 0;
  // 「엔진으로 만들기」= 분석서를 뺀 파트들(작업자가 같은 책끼리 동시에 돌린다) · 「분석서 만들기」= 분석서만(독립 실행, 지문은 동시에) — 2026-11-26 사장님
  const g3N = (+fn.g3.to || 0) - (+fn.g3.from || 0) + 1; const g3bad = fn.parts.indexOf('g3min') >= 0 && g3N < 6;   // 3분 그래머 범위는 5강을 넘어야 한다(2026-11-26 사장님 — "최소 5개 초과")
  const todo = jobParts.filter(k => k !== 'abook' && redo(k));
  // 분석서는 지문 몇 개가 실패한 채 끝날 수 있다(result.failed) — 그때는 같은 일을 다시 줄 세운다(남은 중간 산출물로 싸게 다시 돈다)
  const ab = fn.latest.abook; const abFailed = !!(ab && ab.status === 'done' && ab.result && (ab.result.failed || []).length);
  const abookTodo = fn.parts.indexOf('abook') >= 0 && (redo('abook') || abFailed);
  const sel = { height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid ' + K.control, background: 'transparent', color: T.text, fontSize: '13px' };
  const num = { width: '44px', height: '30px', padding: '0 6px', borderRadius: '6px', border: '1px solid ' + K.control, background: 'transparent', color: T.text, fontSize: '13px', textAlign: 'center' };
  return (
    <React.Fragment>
      <select style={sel} value={fn.school} onChange={e => fn.setSchool(e.target.value)}>{FN_SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}</select>
      <select style={sel} value={fn.grade} onChange={e => fn.setGrade(e.target.value)}>{FN_KINDS.map(g => <option key={g} value={g}>{g}</option>)}</select>
      {FN_PARTS.map(p => {
        const on = fn.parts.indexOf(p.k) >= 0; const j = p.job && on ? fn.latest[p.k] : null;
        const dot = !p.job || !on ? null : !j ? '○' : j.status === 'done' ? '●' : FN_BUSY.indexOf(j.status) >= 0 ? '◐' : '✕';
        return (
          <button key={p.k} style={chipStyle(on)} title={p.job ? fnJobLabel(j) : '앱이 바로 그립니다'}
            onClick={() => fn.setParts(ps => (ps.indexOf(p.k) >= 0 ? ps.filter(k => k !== p.k) : FN_PARTS.map(x => x.k).filter(k => ps.indexOf(k) >= 0 || k === p.k)))}>
            {p.l}{dot ? <span style={{ marginLeft: '5px', fontSize: '9px', color: j && j.status === 'error' ? K.neg : 'inherit', opacity: 0.8 }}>{dot}</span> : null}
          </button>
        );
      })}
      {fn.parts.indexOf('g3min') >= 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', color: T.textDim }}>
          <input style={num} type="number" min="1" max="80" value={fn.g3.from} onChange={e => fn.setG3(g => ({ ...g, from: +e.target.value }))} />~
          <input style={num} type="number" min="1" max="80" value={fn.g3.to} onChange={e => fn.setG3(g => ({ ...g, to: +e.target.value }))} />강
          <span style={{ marginLeft: '6px' }}>·</span>
          <input style={num} type="number" min="1" max={Math.max(1, (+fn.g3.to || 0) - (+fn.g3.from || 0) + 1)} placeholder={String(Math.max(1, (+fn.g3.to || 0) - (+fn.g3.from || 0) + 1))} value={fn.g3.n || ''} onChange={e => fn.setG3(g => ({ ...g, n: e.target.value === '' ? '' : Math.max(1, Math.min(+e.target.value, (+g.to || 0) - (+g.from || 0) + 1)) }))} title="문항 수 — 비우면 강 수만큼(강 수를 넘을 수 없다: 문항마다 대표 강 하나)" />문항
        </span>
      )}
      {g3bad && <span style={{ fontSize: '12px', color: K.neg }}>3분 그래머 범위는 6강 이상이어야 합니다</span>}
      <button style={{ ...chipStyle(false), fontWeight: 600, opacity: !sheetsN || !todo.length || g3bad ? 0.5 : 1 }} disabled={!sheetsN || !todo.length || g3bad}
        title={!sheetsN ? '왼쪽에서 지문을 고르세요' : g3bad ? '3분 그래머 범위를 6강 이상으로' : !todo.length ? '만들 파트가 없습니다(이미 만들었거나 만드는 중)' : todo.map(k => (FN_PARTS.find(p => p.k === k) || {}).l).join(' · ') + ' 을 클라우드에서 만듭니다'}
        onClick={() => { if (!todo.length || g3bad) return; if (!confirm(todo.map(k => (FN_PARTS.find(p => p.k === k) || {}).l).join(' · ') + ' 을 엔진으로 만듭니다(동시에).\n' + fn.school + ' ' + fn.grade + ' · 지문 ' + sheetsN + '개\n(모델 비용이 듭니다)')) return; fn.make(todo); }}>
        엔진으로 만들기{todo.length ? ' (' + todo.length + ')' : ''}
      </button>
      {fn.parts.indexOf('abook') >= 0 && <button style={{ ...chipStyle(false), fontWeight: 600, opacity: !sheetsN || !abookTodo ? 0.5 : 1 }} disabled={!sheetsN || !abookTodo}
        title={!sheetsN ? '왼쪽에서 지문을 고르세요' : abFailed ? '못 만든 지문 ' + ab.result.failed.length + '개를 다시 만듭니다' : !abookTodo ? '분석서는 이미 만들었거나 만드는 중' : '분석서만 따로 만듭니다(독립 실행 · 지문은 동시에)'}
        onClick={() => { if (!abookTodo) return; if (abFailed) { if (confirm('못 만든 지문 ' + ab.result.failed.length + '개를 다시 만듭니다(된 것은 그대로).')) fn.requeue(ab); return; } if (!confirm('분석서를 엔진으로 만듭니다 — 지문 ' + sheetsN + '개(동시에).\n' + fn.school + ' ' + fn.grade + '\n(지문당 0.35달러쯤)')) return; fn.make(['abook']); }}>
        {abFailed ? '분석서 다시 만들기 (' + ab.result.failed.length + ')' : '분석서 만들기'}
      </button>}
      {fn.busy && <span style={{ fontSize: '12px', color: T.textDim }}>{jobParts.filter(k => fn.latest[k] && FN_BUSY.indexOf(fn.latest[k].status) >= 0).map(k => (FN_PARTS.find(p => p.k === k) || {}).l + ' ' + fnJobLabel(fn.latest[k])).join(' · ')}</span>}
      {fn.busy && <button style={chipStyle(false)} onClick={() => jobParts.forEach(k => { const j = fn.latest[k]; if (j && (j.status === 'queued' || j.status === 'running')) fn.stop(j); })}>멈추기</button>}
      {fn.err && <span style={{ fontSize: '12px', color: K.neg }}>{/engine_jobs/.test(fn.err) ? 'engine_jobs 표가 없습니다 — scripts/engine_jobs_schema.sql 을 먼저 실행' : fn.err}</span>}
    </React.Fragment>
  );
}

// ── 조판 ──────────────────────────────────────────────────────
const FN_SANS = '"Inter","Spoqa Han Sans Neo","Apple SD Gothic Neo",Arial,sans-serif';
function fnCss(PC) {
  // finalnote/scripts/build.mjs 의 css(77 내지 — 푸른 틴트를 무채색으로) 를 .fn-book 아래로 옮긴 것
  return `
.fn-book,.fn-measure{color:#1d1d1f;font-family:${FN_SANS};font-size:12.5px}
.fn-book .blk,.fn-measure .blk{margin:0 0 14px}
.fn-book .psub,.fn-measure .psub{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:0 0 6px;padding-bottom:5px;border-bottom:1px solid #d9d9d9}
.fn-book .psub .pn,.fn-measure .psub .pn{font-size:15px;font-weight:800;color:${PC};white-space:nowrap}.fn-book .psub .pt,.fn-measure .psub .pt{font-size:11px;font-weight:700;color:#1d1d1f;line-height:1.2}.fn-book .psub .psrc,.fn-measure .psub .psrc{margin-left:auto;font-size:9.5px;font-weight:600;color:#a1a1a6;white-space:nowrap}
.fn-book .raw,.fn-measure .raw{font-size:16.5px;text-align:justify;text-indent:1.6em;line-height:2.15}
.fn-book .rawS,.fn-measure .rawS{font-size:13.5px;text-align:justify;text-indent:1.4em;line-height:1.9}
.fn-book .qpsg,.fn-measure .qpsg{font-size:12.4px;text-align:justify;text-indent:1.1em;line-height:1.72;margin:0 0 6px}
.fn-book .ask,.fn-measure .ask{font-size:11.6px;font-weight:700;margin:2px 0 6px}
.fn-book ol.t3l,.fn-measure ol.t3l{list-style:none;margin:0;padding:0}.fn-book ol.t3l li,.fn-measure ol.t3l li{position:relative;padding:5px 0 5px 24px;border-bottom:1px solid #ececec}.fn-book ol.t3l li:last-child,.fn-measure ol.t3l li:last-child{border-bottom:0}
.fn-book ol.t3l .tn,.fn-measure ol.t3l .tn{position:absolute;left:2px;top:5px;font-size:12.4px;font-weight:800;color:${PC}}.fn-book ol.t3l .ten,.fn-measure ol.t3l .ten{font-size:12.6px;font-weight:600;line-height:1.5;color:#1d1d1f}.fn-book ol.t3l .tko,.fn-measure ol.t3l .tko{font-size:11.4px;color:#6e6e73;line-height:1.45;margin-top:2px}
.fn-book ul.order,.fn-measure ul.order{list-style:none;margin:0;padding:0}.fn-book ul.order li,.fn-measure ul.order li{padding:5px 2px;border-bottom:1px solid #ececec;font-size:12.2px;line-height:1.45}.fn-book ul.order li .lb,.fn-measure ul.order li .lb{display:inline-block;min-width:22px;font-weight:800;color:${PC}}
.fn-book .oans,.fn-measure .oans{margin:9px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:5px}.fn-book .oans .lab,.fn-measure .oans .lab{font-size:11px;font-weight:700;margin-right:6px}
.fn-book .obox,.fn-measure .obox{display:inline-block;width:27px;height:23px;border:1.2px solid #bdbdbd;border-radius:4px;background:#fff}.fn-book .oar,.fn-measure .oar{color:#9a9a9a;font-weight:700;font-size:12px}
.fn-book .akh2,.fn-measure .akh2{font-size:16px;font-weight:800;color:${PC};border-bottom:2px solid ${PC};padding-bottom:5px}
.fn-book .ap,.fn-measure .ap{padding:6px 10px;border:1px solid #dcdcdc;border-radius:6px;font-size:11.7px;line-height:1.55}.fn-book .ap .apn,.fn-measure .ap .apn{font-weight:800;color:${PC};display:inline-block;min-width:44px;margin-right:6px}.fn-book .ap .seq,.fn-measure .ap .seq{color:${PC};font-weight:700;letter-spacing:0.5px}
.fn-book .apP,.fn-measure .apP{padding:9px 12px;border:1px solid #dcdcdc;border-radius:6px}.fn-book .apsub,.fn-measure .apsub{display:flex;align-items:baseline;gap:10px;margin:0 0 5px;padding-bottom:4px;border-bottom:1px solid #ececec}.fn-book .apsub .apn,.fn-measure .apsub .apn{font-size:14px;font-weight:800;color:${PC}}.fn-book .apsub .apcnt,.fn-measure .apsub .apcnt{font-size:11.5px;font-weight:800}.fn-book .apsub .psrc,.fn-measure .apsub .psrc{color:#a1a1a6;font-size:10px}
.fn-book .apsg,.fn-measure .apsg{font-size:12.2px;text-align:justify;text-indent:1.1em;line-height:1.75}.fn-book .apsg .fix,.fn-measure .apsg .fix{color:#d40000;font-weight:800}
.fn-book .jhead,.fn-measure .jhead{font-size:13.5px;font-weight:800;color:${PC};margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid #d9d9d9}
.fn-book .jitem,.fn-measure .jitem{font-size:11.8px;line-height:1.68;margin:0 0 6px;text-align:justify}
.fn-book .blk.jb,.fn-measure .blk.jb{margin:0}.fn-book .jwrap,.fn-measure .jwrap{padding:0 0 58px}.fn-book .jwrap .jitem,.fn-measure .jwrap .jitem{margin-bottom:2px}
.fn-book .jq,.fn-measure .jq{font-size:11.5px;color:#1d1d1f;margin:3px 0 0;font-weight:700}.fn-book .ja,.fn-measure .ja{display:flex;align-items:flex-end;gap:8px;margin:30px 0 0;font-size:11.5px}.fn-book .ja i,.fn-measure .ja i{flex:1;border-bottom:1px solid #1d1d1f;height:1px;margin-bottom:2px}
.fn-book .apP2,.fn-measure .apP2{padding:8px 12px;border:1px solid #dcdcdc;border-radius:6px;margin:0 0 10px}
.fn-book .jans,.fn-measure .jans{font-size:11.5px;line-height:1.6;margin:0 0 3px}.fn-book .jans .jw,.fn-measure .jans .jw{color:#c0392b;font-weight:700}.fn-book .jans .jr,.fn-measure .jans .jr{color:${PC};font-weight:800}.fn-book .jans.jaA,.fn-measure .jans.jaA{color:#3a3a3a;font-size:11px;margin:0 0 5px}
.fn-book .g3h,.fn-measure .g3h{font-size:12px;color:#1d1d1f;padding:6px 0 7px;border-bottom:1.5px solid ${PC};display:flex;gap:10px;align-items:baseline}.fn-book .g3h b,.fn-measure .g3h b{font-size:14px;color:${PC};letter-spacing:.5px}.fn-book .g3h span,.fn-measure .g3h span{margin-left:auto;font-size:11px;color:#86868b}
.fn-book .g3opt,.fn-measure .g3opt{display:flex;flex-wrap:wrap;gap:4px 22px;font-size:12.2px;margin:4px 0 0}
.fn-book .g3q,.fn-measure .g3q{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px;padding:6px 0}.fn-book .g3q b,.fn-measure .g3q b{color:${PC};margin-right:3px}
.fn-book .g3b,.fn-measure .g3b{font-weight:600;white-space:nowrap}
.fn-book .g3m,.fn-measure .g3m{font-size:11.3px;line-height:1.58;margin:3px 0 0}.fn-book .g3m b,.fn-measure .g3m b{font-weight:800;margin-right:4px}.fn-book .g3m b.bad,.fn-measure .g3m b.bad{color:#c0392b}
.fn-book .grid2{display:flex;gap:22px;align-items:flex-start}.fn-book .gcol{flex:1;min-width:0}
.fn-book .cell,.fn-measure .cell{margin:0 0 12px}.fn-book .cell .psub .pn,.fn-measure .cell .psub .pn{font-size:14px}.fn-book .cell .qpsg,.fn-measure .cell .qpsg{font-size:10.6px;text-indent:1em;line-height:1.62;margin:0}
.fn-book .cell .ask,.fn-measure .cell .ask{font-size:10.6px}.fn-book .cell .ncnt,.fn-measure .cell .ncnt{font-size:11px;font-weight:800;color:${PC};margin:11px 0 0}
.fn-book .cell .ntbl,.fn-measure .cell .ntbl{border-collapse:collapse;margin:15px auto 0;width:88%}
.fn-book .cell .ntbl th,.fn-measure .cell .ntbl th{background:#f1f1f1;border:1px solid #bdbdbd;font-size:10px;font-weight:800;padding:4px 5px;text-align:center;width:50%}
.fn-book .cell .ntbl td,.fn-measure .cell .ntbl td{border:1px solid #cccccc;height:31px}
.fn-book .qpsg u,.fn-measure .qpsg u{text-decoration:none;border-bottom:1.3px solid #1d1d1f}
.fn-book .memo{height:100%;display:flex;flex-direction:column}.fn-book .memo-h{font-size:13px;font-weight:700;color:#86868b;margin-bottom:10px}.fn-book .memo-lines{flex:1;min-height:0;overflow:hidden}.fn-book .memo-lines i{display:block;height:38px;border-bottom:1px solid #e5e5ea}
.fn-book .strip{position:absolute;left:0;right:0;top:0;height:7px;background:${PC}}
.fn-book .rfoot{position:absolute;left:38px;right:38px;bottom:16px;font:600 9.5px/1 "Inter",sans-serif;letter-spacing:1.6px;color:#a1a1a6}
.fn-book .pnum{position:absolute;left:38px;right:38px;bottom:16px;font-size:11px;color:#86868b}
.fn-book .band{position:absolute;left:0;top:0;width:100%;height:101px;background:${PC};color:#fff}
.fn-book .band .bt{position:absolute;left:56px;top:30px;font:800 40px/1 "Inter",sans-serif;letter-spacing:-.5px}
.fn-book .band .bs{position:absolute;right:56px;top:33px;text-align:right;font:700 13.5px/1.4 "Spoqa Han Sans Neo","Apple SD Gothic Neo",sans-serif}
.fn-book .pno{position:absolute;left:52px;top:190px;font:900 300px/.86 "Inter",sans-serif;letter-spacing:-12px;color:#e5e5ea}
.fn-book .pen{position:absolute;left:58px;top:510px;font:600 14px/1 "Inter",sans-serif;letter-spacing:3.4px;color:${PC}}
.fn-book .pko{position:absolute;left:56px;top:540px;font:800 56px/1.1 "Spoqa Han Sans Neo","Apple SD Gothic Neo",sans-serif;letter-spacing:-1.6px;color:#1d1d1f}
.fn-book .pbr{position:absolute;left:58px;top:630px;width:64px;height:3px;background:${PC}}
.fn-book .pgs{position:absolute;left:58px;top:656px;font-size:14px;line-height:1.9;color:#6e6e73}
.fn-book .pft{position:absolute;left:58px;right:58px;bottom:40px;display:flex;justify-content:space-between;font:600 10.5px/1 "Inter",sans-serif;letter-spacing:1.8px;color:#1d1d1f}
.fn-book .cls{position:absolute;left:56px;right:56px;top:180px}
.fn-book .crow7{display:flex;align-items:baseline;gap:22px;padding:14px 0;border-bottom:1px solid #e5e5ea}
.fn-book .crow7 .n{flex:none;width:64px;font:900 40px/1 "Inter",sans-serif;color:#d1d1d6}
.fn-book .crow7 .t{flex:1;font:500 19px/1.2 "Spoqa Han Sans Neo","Apple SD Gothic Neo",sans-serif;color:#c7c7cc}
.fn-book .crow7 .e{flex:none;font:600 10.5px/1 "Inter",sans-serif;letter-spacing:1.8px;color:#c7c7cc}
.fn-book .crow7.on{border-bottom:1.5px solid ${PC}}.fn-book .crow7.on .n{color:${PC}}.fn-book .crow7.on .t{font-weight:800;font-size:24px;color:#1d1d1f}.fn-book .crow7.on .e{color:${PC}}
.fn-book .ph{margin-top:40px;padding:16px 18px;border:1px dashed #bdbdbd;border-radius:8px;color:#6e6e73;font-size:12.5px;line-height:1.7}
`;
}
const fnPsub = (no, eng, src) => <div className="psub"><span className="pn">{no}</span><span className="pt">{eng}</span><span className="psrc">{src}</span></div>;
const fnShortSrc = (sh) => sh.txtHead || sh.passageSource || '';   // '고1 25년 10월 20번' 꼴(04-studio 의 txtHead)
const fnNo = (sh, i) => sh.passageNum !== '' && sh.passageNum != null ? sh.passageNum + '번' : String(i + 1).padStart(2, '0');

/** 블록 묶음 만들기 — 파트마다 { single: [JSX…], cells: [JSX…](2단), answers: [JSX…] } */
function fnBlocks(part, { sheets, latest, g3, PC }) {
  const job = latest[part]; const R = job && job.status === 'done' ? (job.result || {}) : null;
  const ph = (t) => [<div className="blk ph" key="ph">{t}</div>];
  const need = (what) => ph(what + ' — ' + (job ? fnJobLabel(job) : '아직 안 만들었습니다. 「엔진으로 만들기」를 누르세요.'));
  if (part === 'raw') return { single: sheets.map((sh, i) => ({ el: <div className="blk" key={'raw' + i}>{fnPsub(fnNo(sh, i), sh.passageEng || sh.passageTitle, fnShortSrc(sh))}<div className="raw">{sh.rawText}</div></div>, alt: <div className="blk" key={'rawS' + i}>{fnPsub(fnNo(sh, i), sh.passageEng || sh.passageTitle, fnShortSrc(sh))}<div className="rawS">{sh.rawText}</div></div>, onePage: true })) };
  if (part === 'order') {
    const single = sheets.map((sh, i) => <div className="blk" key={'o' + i}>{fnPsub(fnNo(sh, i), sh.passageEng || sh.passageTitle, fnShortSrc(sh))}<div className="ask">다음 문장들을 글의 흐름에 맞게 배열하시오.</div>
      <ul className="order">{sh.orderItems.map((it, k) => <li key={k}><span className="lb">{it.label}</span>{it.en}</li>)}</ul>
      <div className="oans"><span className="lab">배열 순서</span>{sh.orderItems.map((_, k) => <React.Fragment key={k}>{k ? <span className="oar">→</span> : null}<span className="obox"></span></React.Fragment>)}</div></div>);
    const answers = [<div className="blk akh2" key="h">정답 · 한문장배열</div>, ...sheets.map((sh, i) => <div className="blk ap" key={'oa' + i}><span className="apn">{fnNo(sh, i)}</span> <span className="psrc" style={{ marginRight: '6px', color: '#a1a1a6', fontSize: '10px' }}>{fnShortSrc(sh)}</span> <span className="seq">{sh.answerSeq}</span></div>)];
    return { single, answers };
  }
  if (part === 'topic3') {
    if (!R) return { single: need('주제정리') };
    const by = {}; (R.items || []).forEach(it => { if (it.key) by[it.key] = it; });
    const rows = sheets.map((sh, i) => ({ sh, i, t: by[sh.key] })).filter(x => x.t);
    if (!rows.length) return { single: ph('주제정리 결과에 이 지문들이 없습니다(범위가 바뀌었으면 다시 만듭니다).') };
    return { single: rows.map(({ sh, i, t }) => <div className="blk t3" key={'t' + i}>{fnPsub(fnNo(sh, i), sh.passageEng || sh.passageTitle, fnShortSrc(sh))}<ol className="t3l">{t.topics.map((c, ci) => <li key={ci}><span className="tn">{ci + 1}</span><div className="ten">{c.en}</div><div className="tko">{c.ko}</div></li>)}</ol></div>) };
  }
  if (part === 'jungyo') {
    if (!R) return { single: need('최중요어법') };
    const groups = R.items || []; if (!groups.length) return { single: ph('최중요어법 결과가 비어 있습니다.') };
    const exP = (l, k) => /^Q\d*\s*:/.test(l) ? <div className="jq" key={k}>{l}</div> : /^A\d*\s*:\s*$/.test(l) ? <div className="ja" key={k}><span>{l.trim()}</span><i></i></div> : <div className="ja" key={k}>{l}</div>;
    const single = groups.flatMap((g, gi) => g.items.map((it, k) => <div className="blk jb" key={'j' + gi + '-' + k}>{k === 0 ? <React.Fragment>{gi === 0 ? <div className="ask" style={{ marginBottom: '9px' }}>다음 본문에서 어법/어휘가 틀린 부분을 모두 찾아서 옳게 고치시오.</div> : null}<div className="jhead">{g.title}</div></React.Fragment> : null}
      <div className="jwrap"><div className="jitem">{it.n ? it.n + ') ' : ''}{it.text}</div>{(it.extra || []).map(exP)}</div></div>));
    const ansLine = (l, k) => { if (/^[AQ]\d*\s*:/.test(l)) return <div className="jans jaA" key={k}>{l}</div>; const i = l.indexOf('→'); if (i < 0) return <div className="jans" key={k}>{l}</div>; const left = l.slice(0, i), right = l.slice(i + 1); const nm = left.match(/^(\s*\d+[.)]\s*)?([\s\S]*)$/); return <div className="jans" key={k}>{nm[1] || ''}<span className="jw">{nm[2].trim()}</span> → <span className="jr">{right.trim()}</span></div>; };
    const answers = [<div className="blk akh2" key="h">정답 · 최중요어법</div>, ...groups.map((g, gi) => <div className="blk apP2" key={'ja' + gi}><div className="jhead">{g.title}</div>{(g.araw || []).map(ansLine)}</div>)];
    return { single, answers };
  }
  if (part === 'ncha') {
    if (!R) return { single: need('N개찾기') };
    const items = (R.items || []).filter(r => !r.fail); if (!items.length) return { single: ph('N개찾기 결과가 비어 있습니다.') };
    const label = r => (String(r.source || '').match(/(\S+)$/) || [])[1] || r.id, srcOf = r => String(r.source || '').replace(/\s*\S+$/, '');
    const cells = items.map((r, i) => <div className="cell" key={'n' + i}>{fnPsub(label(r), r.topic || '', srcOf(r))}<div className="ask">{r.pairs.some(p => p.kind === 'vocab') ? '어법·어휘상 틀린 부분을 모두 찾아 고치시오.' : '어법상 틀린 부분을 모두 찾아 고치시오.'}</div><div className="qpsg">{r.problem}</div><div className="ncnt">틀린 것 : {r.count}개</div>
      <table className="ntbl"><tbody><tr><th>틀린 것</th><th>수정</th></tr>{Array.from({ length: r.count }, (_, k) => <tr key={k}><td></td><td></td></tr>)}</tbody></table></div>);
    // 답지 — 옳은 지문에서 고친 자리만 빨갛게(엔진 결과의 sents = 옳은 문장, pairs[].s = 문장 번호, right = 옳은 어구)
    const fixed = r => (r.sents || []).map((s, si) => { const ps = (r.pairs || []).filter(p => p.s === si + 1); let parts = [s]; ps.forEach(p => { parts = parts.flatMap(x => { if (typeof x !== 'string') return [x]; const k = x.indexOf(p.right); return k < 0 ? [x] : [x.slice(0, k), <span className="fix" key={p.right + k}>{p.right}</span>, x.slice(k + p.right.length)]; }); }); return <React.Fragment key={si}>{parts}{' '}</React.Fragment>; });
    const answers = [<div className="blk akh2" key="h">정답 · N개찾기</div>, ...items.map((r, i) => <div className="blk apP" key={'na' + i}><div className="apsub"><span className="apn">{label(r)}</span><span className="psrc">{srcOf(r)}</span><span className="apcnt">틀린 것 {r.count}개</span></div><div className="apsg">{fixed(r)}</div></div>)];
    return { cells, answers };
  }
  if (part === 'g3min') {
    if (!R) return { single: need('3분 그래머') };
    const parts = [R.part1, R.part2].filter(Boolean); if (!parts.length || !R.part1.items.length) return { single: ph('3분 그래머 결과가 비어 있습니다.') };
    const G3P = '다음 글의 표시된 부분 중, 어법상 옳지 않은 것만을 있는 대로 고른 것은?';
    const psg = t => { const out = []; const re = /\{([a-e])\}([\s\S]*?)\{\/\1\}/g; let last = 0, m; while ((m = re.exec(t))) { out.push(t.slice(last, m.index), '(' + m[1] + ') ', <u key={m.index}>{m[2]}</u>); last = m.index + m[0].length; } out.push(t.slice(last)); return out; };
    // 단락형(괄호 고르기 — 원조 16~30강 부록 꼴, 2026-11-26): 지문의 {{A}} 자리에 (A) [x / y] 를 넣는다. 보기 순서는 엔진이 정해 둔 choices 그대로
    const G3A = '다음 글의 (A), (B), (C)의 각 괄호 안에서 어법상 알맞은 것을 고르시오.';
    const abcPsg = it => String(it.passage).split(/\{\{([ABC])\}\}/).map((x, i) => i % 2 ? <b className="g3b" key={i}>({x}) [{(it.choices[x] || []).filter(Boolean).join(' / ')}]</b> : x);
    const single = parts.flatMap(d => [<div className="blk g3h" key={'g3h' + d.part}><b>PART {d.part}</b> {d.part === 2 ? '문장 전체에 표시 — 어느 낱말이 걸렸는지 모르는 채로 문장을 통째로 본다' : '판단이 걸린 부분에만 표시'}<span>{String(d.range || '').split(' · ')[0]}</span></div>,
      ...d.items.map(it => <div className="blk g3" key={'g3' + d.part + '-' + it.num}>{fnPsub(String(it.num).padStart(2, '0'), '', '3분 그래머 ' + String(d.range || '').split(' · ')[0] + ' · 파트' + d.part)}{it.type === 'abc'
        ? <React.Fragment><div className="ask">{G3A}</div><div className="qpsg">{abcPsg(it)}</div></React.Fragment>
        : <React.Fragment><div className="ask">{G3P}</div><div className="qpsg">{psg(it.passage)}</div><div className="g3opt">{it.options.map((o, k) => <span key={k}>{FN_CIRC[k]} {o}</span>)}</div></React.Fragment>}</div>)]);
    const answers = [<div className="blk akh2" key="h">정답 · 3분 그래머 <span style={{ fontSize: '11px', color: '#86868b', fontWeight: 600 }}>파트 1·2 같은 문항</span></div>,
      <div className="blk g3q" key="q">{R.part1.items.map(it => <span key={it.num}><b>{String(it.num).padStart(2, '0')}</b> {it.type === 'abc' ? ['A', 'B', 'C'].map(k => it.answer_parts[k]).join(' · ') : FN_CIRC[it.answer - 1]}</span>)}</div>,
      ...R.part1.items.map(it => it.type === 'abc'
        ? <div className="blk apP" key={'g3a' + it.num}><div className="apsub"><span className="apn">{String(it.num).padStart(2, '0')}</span><span className="apcnt">정답 {['A', 'B', 'C'].map(k => '(' + k + ') ' + it.answer_parts[k]).join('  ')}</span></div>{['A', 'B', 'C'].map(k => <div className="g3m" key={k}><b>({k}) {it.answer_parts[k]}</b> {it.reasons[k]}</div>)}</div>
        : <div className="blk apP" key={'g3a' + it.num}><div className="apsub"><span className="apn">{String(it.num).padStart(2, '0')}</span><span className="apcnt">정답 {FN_CIRC[it.answer - 1]} {it.options[it.answer - 1]}</span></div>{it.marks.map(m => <div className="g3m" key={m.label}><b className={m.ok ? '' : 'bad'}>({m.label}) {m.ok ? '옳음' : '틀림 → ' + m.fix}</b> {m.reason}</div>)}</div>)];
    return { single, answers };
  }
  return { single: ph(part) };
}

/** 분석서 PDF 를 쪽 그림으로 — 저장소 jobs/<id>/<n>/analysis.pdf (pdf.js) */
function useAbookPages(job) {
  const [pages, setPages] = useState([]);
  const key = job && job.status === 'done' ? job.id : '';
  useEffect(() => {
    let dead = false; setPages([]);
    if (!key) return;
    (async () => {
      try {
        if (!window.pdfjsLib) return; window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        const out = [];
        for (const it of (job.result && job.result.items) || []) {
          if (!it.ok || !it.pdf) continue;
          const { data, error } = await SB.storage.from('exam').download(it.pdf); if (error || !data) continue;
          const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await data.arrayBuffer()) }).promise;
          for (let i = 1; i <= doc.numPages; i++) { if (dead) return; const page = await doc.getPage(i); const vp = page.getViewport({ scale: 2 * 794 / page.getViewport({ scale: 1 }).width }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; out.push(c.toDataURL('image/png')); }
        }
        if (!dead) setPages(out);
      } catch (e) { console.warn('분석서 PDF 읽기 실패', e); }
    })();
    return () => { dead = true; };
  }, [key]);
  return pages;
}

const FN_HCAP = 1040, FN_GAP = 14, FN_CAP2 = 1030;
function fnPack(hs) { const P = []; let c = [], ch = 0; hs.forEach((h, i) => { const need = (c.length ? FN_GAP : 0) + h; if (c.length && ch + need > FN_HCAP) { P.push(c); c = []; ch = 0; } c.push(i); ch += (c.length > 1 ? FN_GAP : 0) + h; }); if (c.length) P.push(c); return P; }
function fnPack2(hs) { const pages = []; let pg = null; hs.forEach((h, i) => { if (!pg) pg = { A: [], B: [], hA: 0, hB: 0 }; if (pg.hA + (pg.A.length ? 12 : 0) + h <= FN_CAP2) { pg.A.push(i); pg.hA += (pg.A.length > 1 ? 12 : 0) + h; } else if (pg.hB + (pg.B.length ? 12 : 0) + h <= FN_CAP2) { pg.B.push(i); pg.hB += (pg.B.length > 1 ? 12 : 0) + h; } else { pages.push(pg); pg = { A: [i], B: [], hA: h, hB: 0 }; } }); if (pg && (pg.A.length || pg.B.length)) pages.push(pg); return pages; }

/** 시트 조판 — 교재 제작 파이널노트 틀의 본체 */
function FinalnoteSheets({ fn, sheets, academyName }) {
  const PC = FN_COLOR[fn.school + fn.grade] || '#1d1d1f';
  const parts = FN_PARTS.filter(p => fn.parts.indexOf(p.k) >= 0);
  const built = parts.map(p => ({ ...p, b: fnBlocks(p.k, { sheets, latest: fn.latest, g3: fn.g3, PC }) }));
  const abookPages = useAbookPages(fn.parts.indexOf('abook') >= 0 ? fn.latest.abook : null);
  // 실측 — 한 단 블록(680px)과 두 단 셀(329px)을 화면 밖에 그려 높이를 잰다
  const measRef = useRef(null); const [H, setH] = useState(null);
  const sig = JSON.stringify([fn.school, fn.grade, fn.parts, fn.g3, sheets.map(s => s.key), parts.map(p => (fn.latest[p.k] || {}).updated_at || '')]);
  useLayoutEffect(() => { setH(null); }, [sig]);
  useLayoutEffect(() => {
    if (H || !measRef.current) return;
    const m = measRef.current; const h = {};
    m.querySelectorAll('[data-m]').forEach(el => { h[el.getAttribute('data-m')] = el.getBoundingClientRect().height; });
    setH(h);
  });
  const gist = (() => { const seen = []; sheets.forEach(sh => { const l = sh.bookGrp && sh.bookGrp.label; if (l && seen.indexOf(l) < 0) seen.push(l); }); return seen; })();
  const bookName = fn.school + ' ' + fn.grade.replace('고', '') + '학년';
  // 측정용
  const measure = (
    <div ref={measRef} className="fn-measure" style={{ position: 'absolute', left: '-20000px', top: 0, width: '680px', visibility: 'hidden', pointerEvents: 'none' }} data-noprint="">
      {built.flatMap((p, pi) => [
        ...(p.b.single || []).map((x, i) => <div key={p.k + 's' + i} data-m={p.k + ':s:' + i}>{x.el || x}</div>),
        ...(p.b.single || []).filter(x => x.alt).map((x, i) => <div key={p.k + 'alt' + i} data-m={p.k + ':alt:' + i}>{x.alt}</div>),
        ...(p.b.answers || []).map((x, i) => <div key={p.k + 'a' + i} data-m={p.k + ':a:' + i}>{x}</div>),
        ...(p.b.cells || []).map((x, i) => <div key={p.k + 'c' + i} data-m={p.k + ':c:' + i} style={{ width: '329px' }}>{x}</div>)
      ])}
    </div>
  );
  if (!H) return <div className="fn-book"><style>{fnCss(PC)}</style>{measure}</div>;
  // 쪽 만들기
  const pages = []; const padEven = () => { if (pages.length % 2 === 1) pages.push({ kind: 'memo' }); };
  built.forEach((p, pi) => {
    const n = pi + 1; pages.push({ kind: 'part', n, p }); pages.push({ kind: 'toc', n, p });
    const hs = k => (i) => H[p.k + ':' + k + ':' + i] || 0;
    if (p.b.single && p.b.single.length) {
      if (p.b.single[0].onePage) p.b.single.forEach((x, i) => pages.push({ kind: 'content', els: [hs('s')(i) > 1030 && x.alt ? x.alt : (x.el || x)] }));
      else fnPack(p.b.single.map((_, i) => hs('s')(i))).forEach(idx => pages.push({ kind: 'content', els: idx.map(i => p.b.single[i].el || p.b.single[i]) }));
    }
    if (p.b.cells && p.b.cells.length) fnPack2(p.b.cells.map((_, i) => hs('c')(i))).forEach(pg => pages.push({ kind: 'content', els: [<div className="grid2" key="g"><div className="gcol">{pg.A.map(i => p.b.cells[i])}</div><div className="gcol">{pg.B.map(i => p.b.cells[i])}</div></div>] }));
    if (p.b.answers && p.b.answers.length) fnPack(p.b.answers.map((_, i) => hs('a')(i))).forEach(idx => pages.push({ kind: 'content', els: idx.map(i => p.b.answers[i]) }));
    if (p.k === 'abook') { const j = fn.latest.abook; if (abookPages.length) abookPages.forEach((src, i) => pages.push({ kind: 'img', src })); else pages.push({ kind: 'content', els: [<div className="blk ph" key="ph">{'분석서 — ' + (j ? (j.status === 'done' ? 'PDF 를 읽는 중…' : fnJobLabel(j)) : '아직 안 만들었습니다. 「엔진으로 만들기」를 누르세요.')}</div>] }); }
    padEven();
  });
  const sheet = (idx, child, extra) => {
    const right = idx % 2 === 0 ? 76 : 38, left = idx % 2 === 0 ? 38 : 76;
    return <div key={idx} data-sheet="" style={{ position: 'relative', width: '794px', maxWidth: 'none', margin: '0 auto 28px', height: '1123px', minHeight: '1123px', background: '#ffffff', color: '#1d1d1f', border: '1px solid #e0e0e0', borderRadius: '2px', boxShadow: 'rgba(0,0,0,0.1) 0px 12px 44px', overflow: 'hidden', padding: extra && extra.noPad ? 0 : '36px ' + right + 'px 30px ' + left + 'px' }}>{child}</div>;
  };
  const foot = (idx) => <React.Fragment><div className="pnum" style={{ textAlign: idx % 2 === 0 ? 'left' : 'right' }}>{idx + 1}</div><div className="strip"></div><div className="rfoot" style={{ textAlign: idx % 2 === 0 ? 'right' : 'left' }}>FINAL NOTE · {bookName}</div></React.Fragment>;
  const band = (k) => <div className="band"><div className="bt">FINAL NOTE</div><div className="bs">{bookName} · 2학기 기말<br />{k}</div></div>;
  return (
    <div className="fn-book">
      <style>{fnCss(PC)}</style>
      {measure}
      {pages.map((pg, idx) => {
        if (pg.kind === 'part') return sheet(idx, <React.Fragment>{band('PART ' + String(pg.n).padStart(2, '0'))}<div className="pno">{String(pg.n).padStart(2, '0')}</div><div className="pen">{pg.p.en}</div><div className="pko">{pg.p.l}</div><div className="pbr"></div><div className="pgs">{gist.map((g, gi) => <div key={gi}>{g}</div>)}</div><div className="pft"><span>{academyName || 'SL PRIME'}</span><span>ENGLISH · {new Date().getFullYear()}</span></div></React.Fragment>, { noPad: true });
        if (pg.kind === 'toc') return sheet(idx, <React.Fragment>{band('CONTENTS')}<div className="cls">{built.map((p, i) => <div key={p.k} className={'crow7' + (i + 1 === pg.n ? ' on' : '')}><span className="n">{String(i + 1).padStart(2, '0')}</span><span className="t">{p.l}</span><span className="e">{p.en}</span></div>)}</div><div className="pft"><span>{academyName || 'SL PRIME'}</span><span>ENGLISH · {new Date().getFullYear()}</span></div></React.Fragment>, { noPad: true });
        if (pg.kind === 'memo') return sheet(idx, <React.Fragment><div className="memo"><div className="memo-h">메모</div><div className="memo-lines">{Array.from({ length: 30 }, (_, i) => <i key={i}></i>)}</div></div>{foot(idx)}</React.Fragment>);
        if (pg.kind === 'img') return sheet(idx, <React.Fragment><img src={pg.src} alt="" style={{ display: 'block', width: '794px', height: '1123px' }} />{foot(idx)}</React.Fragment>, { noPad: true });
        return sheet(idx, <React.Fragment>{pg.els}{foot(idx)}</React.Fragment>);
      })}
    </div>
  );
}
