// ============================================================
// 클리닉 (홈 → 클리닉) — 신UI 전용
//
// 2026-11-19 사장님: 4시~11시를 한 시간씩 가로선으로 나누고, 시간마다 클리닉에 오는 학생의
// 이름 · 전화번호 · 그날 해야 할 일 · 비고를 본다. 하루 단위로 넘긴다. 시안은 design/clinic/.
//   · **일단 이음점만**(반 이름이 `이음(` 으로 시작하는 반의 담임 · 학생 — waBranchOf).
//   · 담임마다 색(전체명단과 같은 rsTeacherColors), 한 시간 안에서 과목끼리 붙는다(영어 → 수학 → …).
//     위의 담임 체크박스를 끄면 그 선생님 학생이 가려진다.
//   · 한 번 넣은 클리닉은 저절로 이어진다 — 월·수 / 화·목 짝(월에 넣으면 수, 수에 넣으면 다음 월 …).
//     저절로 생긴 날의 「해야 할 일」은 비어 있고, 비고(아이에 대한 것)는 이어진다.
//   · 금·토에는 제목(「조교 클리닉」)이 그 자리에서 캡슐(담임 클리닉 · 조교 클리닉 · 전체)로 바뀐다.
//     담임 클리닉은 매주 같은 요일로 이어지고, 금·토의 조교 클리닉은 그날 하루뿐이다.
//   · 이름을 누르면 요일 · 시간을 옮긴다(옛 줄은 그날에서 끊고 새 줄을 만든다 — 지난 기록이 남는다).
//   · 학생 추가는 이름 또는 초성으로 찾는다. 아무것도 안 치면 목록이 없고, 그날 이미 든 학생은 안 뜬다.
//   · 글은 칸을 벗어날 때 저장한다. 저장 버튼 없음.
// 학생 · 전화번호 · 담임은 ACA 동기화본에서 읽는다. 여기서 쓰는 표는 clinic 하나 — scripts/clinic_schema.sql.
// ============================================================

const CL_WD = ['일', '월', '화', '수', '목', '금', '토'];
const CL_HOURS = [16, 17, 18, 19, 20, 21, 22];           // 4:00–5:00 … 10:00–11:00
const CL_SUBJ = ['영어', '수학', '국어', '과학'];          // 한 시간 안에서 이 순서로 과목끼리 붙는다
const CL_KINDS = ['담임', '조교', '전체'];
const CL_BRANCH = '이음점';                               // 일단 이음점만(2026-11-19 사장님)
const CL_CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const CL_SCHEMA_HINT = 'Supabase SQL Editor 에서 scripts/clinic_schema.sql 을 한 번 실행해야 합니다.';

function clYmd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function clShift(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return clYmd(d); }
function clDow(ymd) { return new Date(ymd + 'T00:00:00').getDay(); }
function clMdw(ymd) { const d = new Date(ymd + 'T00:00:00'); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + CL_WD[d.getDay()] + ')'; }
/** 금·토 — 담임 클리닉이 있는 날 */
function clIsWeekend(ymd) { const w = clDow(ymd); return w === 5 || w === 6; }
/** 요일 짝 — 월↔수, 화↔목. 그 밖(금·토·일)은 그 요일 하나. */
function clPairOf(w) { return w === 1 || w === 3 ? [1, 3] : w === 2 || w === 4 ? [2, 4] : [w]; }
/** 그 줄(클리닉)이 날짜 d 에 오는가. 담임 = 매주 그 요일 · 조교 = 월·수 / 화·목 짝(금·토·일에 넣은 것은 그날 하루). */
function clOnDay(r, d) {
  if (d < r.start_day || (r.end_day && d >= r.end_day) || (r.skip && r.skip[d])) return false;
  if (d === r.start_day) return true;
  const w0 = clDow(r.start_day), w = clDow(d);
  if (r.kind === '담임') return w === w0;
  const p = clPairOf(w0);
  return p.length > 1 && p.indexOf(w) >= 0;
}
/** 반복 표시 — '월·수' · '화·목' · '매주 금' · ''(하루뿐) */
function clRepeat(r) {
  const w0 = clDow(r.start_day);
  if (r.kind === '담임') return '매주 ' + CL_WD[w0];
  const p = clPairOf(w0);
  return p.length > 1 ? p.map((w) => CL_WD[w]).join('·') : '';
}
/** 옮길 요일(pair: '13' · '24' · '5' · '6') 가운데 day 또는 그 뒤 가장 가까운 날 */
function clMoveStart(day, pair) {
  const ws = String(pair).split('').map(Number);
  for (let i = 0; i < 8; i++) { const d = clShift(day, i); if (ws.indexOf(clDow(d)) >= 0) return d; }
  return day;
}
/** 이름 찾기 — 글자 그대로 또는 초성(ㅎㅅㅇ · 한ㅅ). 초성 글자는 그 자리 글자의 초성과, 나머지는 글자 그대로 견준다. */
function clNameHit(name, query) {
  const q = String(query || '').replace(/\s/g, ''), n = String(name || '');
  if (!q) return false;
  const cho = (ch) => { const c = ch.charCodeAt(0) - 0xAC00; return c >= 0 && c <= 11171 ? CL_CHO[Math.floor(c / 588)] : ch; };
  for (let i = 0; i + q.length <= n.length; i++) {
    let ok = true;
    for (let j = 0; j < q.length && ok; j++) ok = CL_CHO.indexOf(q[j]) >= 0 ? cho(n[i + j]) === q[j] : n[i + j] === q[j];
    if (ok) return true;
  }
  return false;
}
function clErrText(e) {
  const m = String((e && e.message) || e || '');
  if (/relation .* does not exist|schema cache|PGRST205/i.test(m)) return '클리닉 표가 아직 없습니다 — ' + CL_SCHEMA_HINT;
  if (/row-level security|permission denied/i.test(m)) return '클리닉을 고칠 권한이 없습니다.';
  return m || '알 수 없는 오류';
}

// 화면 CSS — 색은 루트의 변수(TT 값)로 받는다. hover · 캡슐의 늘어남처럼 인라인으로 못 하는 것이 많아 한 덩어리로 둔다.
const CL_CSS = `
.cl { --e: background-color .14s cubic-bezier(.2,0,0,1), color .14s cubic-bezier(.2,0,0,1), border-color .14s cubic-bezier(.2,0,0,1), opacity .14s cubic-bezier(.2,0,0,1); font-size: 13.5px; }
.cl button, .cl input, .cl textarea { font-family: inherit; color: inherit; }
.cl-nav { flex: none; display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border); }
.cl-cap { position: relative; display: flex; padding: 2px; border-radius: 6px; background: var(--raised); transition: background-color .2s ease-in-out, padding .2s ease-in-out; }
.cl-cap .thumb { position: absolute; top: 2px; bottom: 2px; left: 2px; width: 96px; border-radius: 4px; background: var(--surface); transition: left .2s ease-in-out, opacity .2s ease-in-out; pointer-events: none; }
.cl-cap button { position: relative; flex: none; display: grid; place-items: center; width: 96px; height: 28px; border: none; background: transparent; padding: 0; font-size: 13px; letter-spacing: 0; color: var(--muted); cursor: pointer; white-space: nowrap; overflow: hidden;
  transition: width .2s ease-in-out, opacity .2s ease-in-out, font-size .2s ease-in-out, color .14s cubic-bezier(.2,0,0,1); }
.cl-cap button span { grid-area: 1 / 1; transition: opacity .2s ease-in-out; }
.cl-cap button .b { font-weight: 700; opacity: 0; }
.cl-cap button.on { color: var(--text); }
.cl-cap button.on .n { opacity: 0; }
.cl-cap button.on .b { opacity: 1; }
.cl-cap button.gone { width: 0; opacity: 0; pointer-events: none; }
.cl-cap.solo { background: transparent; padding: 2px 0; }
.cl-cap.solo .thumb { opacity: 0; }
.cl-cap.solo button.on { width: 92px; font-size: 17px; letter-spacing: -0.2px; justify-items: start; cursor: default; }
.cl-day { display: flex; align-items: center; gap: 2px; margin-left: 10px; }
.cl-day .arrow { border: none; background: transparent; cursor: pointer; color: var(--muted); font-size: 17px; padding: 2px 8px; border-radius: 6px; transition: var(--e); }
.cl-day .arrow:hover { background: var(--active); color: var(--text); }
.cl-day label { position: relative; cursor: pointer; font-size: 18px; font-weight: 500; font-variant-numeric: tabular-nums; padding: 0 4px; white-space: nowrap; }
.cl-day label input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.cl-btn { height: 28px; padding: 0 10px; border: 1px solid var(--control); background: transparent; border-radius: 6px; font-size: 12px; cursor: pointer; transition: var(--e); white-space: nowrap; }
.cl-btn:hover { background: var(--active); }
.cl-sum { margin-left: auto; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cl-sum b { color: var(--text); font-weight: 600; }
.cl-main { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 20px 40px; }
.cl-tag { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 4px; color: #1d1d1f; font-size: 12px; font-weight: 500; white-space: nowrap; }
.cl-tag i { font-style: normal; opacity: .62; font-weight: 400; }
.cl-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 1180px; margin-bottom: 12px; min-height: 30px; }
.cl-chk { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px 0 9px; border-radius: 6px; color: #1d1d1f; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: var(--e); user-select: none; }
.cl-chk input { accent-color: #141414; margin: 0; width: 14px; height: 14px; cursor: pointer; }
.cl-chk i { font-style: normal; opacity: .62; font-weight: 400; }
.cl-chk b { font-weight: 600; font-variant-numeric: tabular-nums; }
.cl-chk.off { opacity: .45; }
.cl-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; max-width: 1180px; }
.cl-slot { display: flex; border-top: 1px solid var(--border); }
.cl-slot:first-child { border-top: none; }
.cl-hour { flex: none; width: 104px; padding: 16px 0 16px 20px; }
.cl-hour .h { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.2px; }
.cl-hour .r { font-size: 12px; color: var(--muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
.cl-hour .now { font-size: 12px; font-weight: 600; margin-top: 6px; }
.cl-slot.past .cl-hour .h { color: var(--muted); font-weight: 500; }
.cl-kids { flex: 1; min-width: 0; padding: 8px 12px 8px 0; }
.cl-row, .cl-head { display: grid; grid-template-columns: 104px 190px 150px minmax(160px, 1.2fr) minmax(140px, 1fr) 28px; align-items: start; column-gap: 8px; }
.cl-head { color: var(--muted); font-size: 12px; padding: 6px 0 4px; }
.cl-head span { padding: 0 6px; }
.cl-row { position: relative; border-top: 1px solid var(--rule); padding: 5px 0; min-height: 40px; }
.cl-row.gap { border-top-color: var(--control); }
.cl-who { padding: 4px 0 0 6px; }
.cl-name { padding: 5px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-name small { font-weight: 400; color: var(--muted); font-size: 12px; margin-left: 12px; }
.cl-nm { border: none; background: transparent; cursor: pointer; font: inherit; font-weight: 500; color: inherit; padding: 2px 6px; margin: -2px -6px; border-radius: 6px; transition: var(--e); }
.cl-nm:hover, .cl-row.moving .cl-nm { background: var(--active); }
.cl-tel { padding: 5px 6px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cl-tel a { color: inherit; text-decoration: none; }
.cl-tel small { color: var(--muted); font-size: 12px; margin-left: 4px; }
.cl textarea { width: 100%; border: 1px solid transparent; border-radius: 6px; padding: 4px 6px; font-size: 13.5px; line-height: 1.45; background: transparent; outline: none; resize: none; overflow: hidden; display: block; transition: var(--e); }
.cl textarea::placeholder { color: var(--control); }
.cl textarea:hover { border-color: var(--border); }
.cl textarea:focus { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); background: var(--surface); }
.cl-x { border: none; background: transparent; cursor: pointer; color: var(--muted); font-size: 15px; line-height: 1; height: 28px; width: 28px; border-radius: 6px; opacity: 0; transition: var(--e); }
.cl-row:hover .cl-x, .cl-x:focus, .cl-row.asking .cl-x { opacity: 1; }
.cl-x:hover { background: var(--active); color: var(--neg); }
.cl-add { position: relative; padding: 4px 0 6px; }
.cl-add > button { border: none; background: transparent; cursor: pointer; color: var(--muted); font-size: 13px; height: 30px; padding: 0 8px; border-radius: 6px; transition: var(--e); }
.cl-add > button:hover { background: var(--active); color: var(--text); }
.cl-find { display: flex; align-items: center; gap: 8px; }
.cl-find input { width: 220px; height: 32px; padding: 0 10px; border: 1px solid var(--ink); box-shadow: 0 0 0 1px var(--ink); border-radius: 6px; font-size: 13.5px; background: var(--surface); outline: none; }
.cl-find span { color: var(--muted); font-size: 12px; }
.cl-pop { position: absolute; left: 0; top: 40px; z-index: 5; width: 340px; max-height: 300px; overflow-y: auto; padding: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.cl-pop button { display: flex; width: 100%; align-items: center; gap: 8px; height: 34px; padding: 0 8px 0 10px; border: none; background: transparent; border-radius: 6px; cursor: pointer; font-size: 13.5px; text-align: left; }
.cl-pop button:hover, .cl-pop button.on { background: var(--active); }
.cl-pop button small { color: var(--muted); font-size: 12px; }
.cl-pop button .cl-tag { margin-left: auto; }
.cl-pop .none { padding: 10px; color: var(--muted); font-size: 13px; }
.cl-ask { position: absolute; right: 0; top: 36px; z-index: 6; width: 250px; padding: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.cl-ask button { display: block; width: 100%; text-align: left; border: none; background: transparent; border-radius: 6px; padding: 7px 10px; cursor: pointer; font-size: 13.5px; }
.cl-ask button small { display: block; color: var(--muted); font-size: 12px; margin-top: 1px; }
.cl-ask button:hover { background: var(--active); }
.cl-mv { position: absolute; left: 104px; top: 36px; z-index: 6; width: 316px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.cl-mv h4 { margin: 0 0 12px; font-size: 13.5px; font-weight: 600; }
.cl-mv h4 small { font-weight: 400; color: var(--muted); font-size: 12px; margin-left: 6px; }
.cl-mv .lb { font-size: 12px; color: var(--muted); margin: 0 0 6px; }
.cl-seg { display: flex; gap: 2px; padding: 2px; border-radius: 6px; background: var(--raised); margin-bottom: 12px; }
.cl-seg button { flex: 1; height: 28px; border: none; border-radius: 4px; background: transparent; color: var(--muted); font-size: 13px; cursor: pointer; transition: var(--e); font-variant-numeric: tabular-nums; white-space: nowrap; padding: 0; }
.cl-seg button.on { background: var(--surface); color: var(--text); font-weight: 500; }
.cl-mv .to { font-size: 12px; color: var(--muted); margin: 0 0 12px; line-height: 1.5; min-height: 18px; }
.cl-mv .to b { color: var(--text); font-weight: 500; }
.cl-mv .acts { display: flex; justify-content: flex-end; gap: 8px; }
.cl-mv .acts button { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px; cursor: pointer; transition: var(--e); }
.cl-mv .cancel { border: 1px solid var(--control); background: transparent; }
.cl-mv .cancel:hover { background: var(--active); }
.cl-mv .go { border: 1px solid var(--ink); background: var(--ink); color: var(--inkText); font-weight: 500; }
.cl-mv .go:disabled { opacity: .4; cursor: default; }
.cl-foot { max-width: 1180px; margin-top: 12px; color: var(--muted); font-size: 12px; line-height: 1.6; }
@media (max-width: 760px) {
  .cl-nav { flex-wrap: wrap; padding: 10px 14px; } .cl-day { margin-left: 0; } .cl-main { padding: 12px 12px 40px; overflow: visible; }
  .cl-slot { display: block; } .cl-hour { width: auto; padding: 12px 14px 0; display: flex; align-items: baseline; gap: 8px; } .cl-hour .r, .cl-hour .now { margin: 0; }
  .cl-kids { padding: 4px 8px 8px; } .cl-head { display: none; }
  .cl-row { grid-template-columns: 1fr 28px; padding: 8px 0; } .cl-row > div { grid-column: 1; } .cl-row .todo, .cl-row .note { grid-column: 1 / -1; } .cl-row .cl-x { grid-column: 2; grid-row: 1; opacity: 1; }
  .cl-tel { padding-top: 0; } .cl-mv { left: 0; width: 100%; } .cl-find input { width: 100%; } .cl-pop { width: 100%; }
}
`;

/** 칸을 벗어날 때 저장하는 글 칸(내용만큼 늘어난다). 값이 바깥에서 바뀌면(다른 날로 이동 등) 따라간다. */
function ClText({ value, onSave, placeholder }) {
  const [v, setV] = useState(value || '');
  const ref = useRef(null);
  useEffect(() => { setV(value || ''); }, [value]);
  useEffect(() => { const t = ref.current; if (!t) return; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }, [v]);
  return <textarea ref={ref} rows={1} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => { if ((v || '') !== (value || '')) onSave(v); }} />;
}

function ClinicApp({ dark, userName }) {
  const K = TT(dark);
  const today = clYmd(new Date());
  const [aca, setAca] = useState(null);          // { students, classes }
  const [rows, setRows] = useState(null);        // 그날 걸린 clinic 줄들
  const [extra, setExtra] = useState({});        // 재원 명단에 없는 학생(퇴원 등) — s_id → 학생
  const [err, setErr] = useState('');
  const [day, setDayRaw] = useState(today);
  const [kind, setKind] = useState('조교');      // 캡슐 — 금·토에만 고른다. 평소엔 조교
  const [hidden, setHiddenRaw] = useState(() => { try { return JSON.parse(localStorage.getItem('cl_hidden') || '{}') || {}; } catch (e) { return {}; } });
  const [adding, setAdding] = useState(null);    // 학생을 추가하는 시간
  const [q, setQ] = useState('');
  const [asking, setAsking] = useState(null);    // 빼기 메뉴를 연 줄 id
  const [moving, setMoving] = useState(null);    // { id, pair, hour }
  const [toast, setToast] = useState('');
  const [ver, setVer] = useState(0);
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const closeAll = () => { setAdding(null); setQ(''); setAsking(null); setMoving(null); };
  const setDay = (d) => { closeAll(); setDayRaw(d); };
  const wk = clIsWeekend(day);
  const curKind = wk ? kind : '조교';
  useEffect(() => { if (!wk && kind !== '조교') setKind('조교'); }, [wk]);

  // ── ACA 명단 — 이음점 반 · 그 반의 재원생 ────────────────────────
  useEffect(() => {
    Promise.all([
      SB.from('aca_student').select('s_id,name,s_hp,p_hp1,grade,school,state,class_ids').eq('state', '재원').limit(3000),
      SB.from('aca_class').select('c_id,name,subject,subjects,teachers,deleted').limit(3000),
    ]).then(([a, b]) => {
      if (a.error || b.error) { setErr(clErrText(a.error || b.error)); setAca({ students: [], classes: [] }); return; }
      setAca({ students: a.data || [], classes: b.data || [] });
    });
  }, []);
  const classes = ((aca && aca.classes) || []).filter((c) => !c.deleted && waBranchOf(c) === CL_BRANCH && !RS_HIDDEN.test(c.name || ''));
  const clsById = {}; classes.forEach((c) => { clsById[c.c_id] = c; });
  // 담임 → 과목
  const subjOf = {};
  classes.forEach((c) => { const sj = c.subject || (c.subjects || [])[0] || ''; (c.teachers || []).forEach((t) => { if (!subjOf[t]) subjOf[t] = sj; }); });
  const sjRank = (t) => { const i = CL_SUBJ.indexOf(subjOf[t] || ''); return i < 0 ? 9 : i; };
  const teacherNames = Object.keys(subjOf).sort((a, b) => sjRank(a) - sjRank(b) || a.localeCompare(b, 'ko'));
  const colors = rsTeacherColors(teacherNames);
  const colorOf = (t) => colors[t] || K.raised;
  // 학생 — 이음점 반을 듣는 재원생. teachers = 그 학생의 이음점 담임들
  const students = ((aca && aca.students) || []).map((s) => {
    const ts = []; (s.class_ids || []).forEach((id) => { const c = clsById[id]; if (c) (c.teachers || []).forEach((t) => { if (ts.indexOf(t) < 0) ts.push(t); }); });
    return Object.assign({}, s, { cl_teachers: ts.sort((a, b) => sjRank(a) - sjRank(b) || a.localeCompare(b, 'ko')) });
  }).filter((s) => s.cl_teachers.length);
  const stuById = {}; students.forEach((s) => { stuById[s.s_id] = s; });
  const stuOf = (id) => stuById[id] || extra[id] || null;

  // ── 그날 걸린 줄 ────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    SB.from('clinic').select('*').lte('start_day', day).or('end_day.is.null,end_day.gt.' + day).limit(5000).then(({ data, error }) => {
      if (dead) return;
      if (error) { setErr(clErrText(error)); setRows([]); return; }
      setErr(''); setRows(data || []);
    });
    return () => { dead = true; };
  }, [day, ver]);
  // 명단에 없는 학생(퇴원 · 다른 지점) 이름을 한 번 더 읽는다
  useEffect(() => {
    if (!aca || !rows) return;
    const miss = Array.from(new Set(rows.map((r) => r.s_id))).filter((id) => !stuById[id] && !extra[id]);
    if (!miss.length) return;
    SB.from('aca_student').select('s_id,name,s_hp,p_hp1,grade,school,state').in('s_id', miss).then(({ data }) => {
      const m = Object.assign({}, extra); miss.forEach((id) => { m[id] = { s_id: id, name: '(명단에 없음)', gone: true }; });
      (data || []).forEach((s) => { m[s.s_id] = Object.assign({}, s, { gone: s.state !== '재원' }); });
      setExtra(m);
    });
  }, [aca, rows]);

  const onDayAll = (rows || []).filter((r) => clOnDay(r, day));
  const inKind = onDayAll.filter((r) => curKind === '전체' || r.kind === curKind);
  const list = inKind.filter((r) => !hidden[r.teacher]).sort((a, b) => a.hour - b.hour || sjRank(a.teacher) - sjRank(b.teacher) || a.teacher.localeCompare(b.teacher, 'ko')
    || String((stuOf(a.s_id) || {}).name || '').localeCompare(String((stuOf(b.s_id) || {}).name || ''), 'ko'));
  const cnt = {}; inKind.forEach((r) => { cnt[r.teacher] = (cnt[r.teacher] || 0) + 1; });
  // 체크박스에 올릴 담임 — 이음점 담임 전원 + 그날 줄에만 있는 이름(옛 담임)
  const legendNames = teacherNames.concat(Object.keys(cnt).filter((t) => teacherNames.indexOf(t) < 0).sort((a, b) => a.localeCompare(b, 'ko')));
  const setHidden = (t, off) => setHiddenRaw((h0) => { const h = Object.assign({}, h0); if (off) h[t] = true; else delete h[t]; try { localStorage.setItem('cl_hidden', JSON.stringify(h)); } catch (e) {} return h; });

  // ── 쓰기 ────────────────────────────────────────────────────────
  const stamp = () => ({ updated_by: userName || null, updated_at: new Date().toISOString() });
  const fail = (error) => { if (error) { setErr(clErrText(error)); say('저장하지 못했습니다'); setVer((v) => v + 1); return true; } return false; };
  const patchRow = (id, patch) => {
    setRows((r0) => (r0 || []).map((r) => r.id === id ? Object.assign({}, r, patch) : r));
    SB.from('clinic').update(Object.assign({}, patch, stamp())).eq('id', id).then(({ error }) => { fail(error); });
  };
  const dropRow = (id) => { setRows((r0) => (r0 || []).filter((r) => r.id !== id)); SB.from('clinic').delete().eq('id', id).then(({ error }) => { fail(error); }); };
  const addRow = (row, then) => {
    SB.from('clinic').insert(Object.assign({ created_by: userName || null }, row, stamp())).select().then(({ data, error }) => {
      if (fail(error)) return;
      if (data && data[0]) setRows((r0) => (r0 || []).concat([data[0]]));
      if (then) then(data && data[0]);
    });
  };
  const saveTodo = (r, v) => { const todo = Object.assign({}, r.todo || {}); if (v.trim()) todo[day] = v; else delete todo[day]; patchRow(r.id, { todo: todo }); };
  const saveNote = (r, v) => patchRow(r.id, { note: v });
  const skipDay = (r) => { const skip = Object.assign({}, r.skip || {}); skip[day] = true; setAsking(null); patchRow(r.id, { skip: skip }); };
  /** 이날부터 전부 빼기 — 이날 넣은 줄이면 지우고, 아니면 이날에서 끊는다(지난 기록은 남는다) */
  const endFrom = (r) => { setAsking(null); if (r.start_day === day) dropRow(r.id); else patchRow(r.id, { end_day: day }); };
  const pick = (s, t) => {
    const hour = adding; setAdding(null); setQ('');
    addRow({ kind: curKind === '전체' ? '조교' : curKind, s_id: s.s_id, teacher: t, hour: hour, start_day: day, note: '', todo: {}, skip: {} });
  };
  const pairKey = (r) => clPairOf(clDow(r.start_day)).join('');
  const doMove = () => {
    const r = (rows || []).filter((x) => x.id === moving.id)[0]; if (!r) { setMoving(null); return; }
    const st = clMoveStart(day, moving.pair), todo = {};
    if (st === day && r.todo && r.todo[day]) todo[day] = r.todo[day];   // 같은 날 시간만 바꾸면 적어 둔 할 일도 따라간다
    setMoving(null);
    addRow({ kind: r.kind, s_id: r.s_id, teacher: r.teacher, hour: moving.hour, start_day: st, note: r.note || '', todo: todo, skip: {} }, () => endFrom(r));
  };

  // 바깥을 누르면 닫는다 · 좌우 화살표로 하루씩
  useEffect(() => {
    const down = (e) => {
      const t = e.target; if (!t || !t.closest) return;
      if (adding != null && !t.closest('.cl-add')) { setAdding(null); setQ(''); }
      if (asking != null && !t.closest('.cl-ask') && !t.closest('.cl-x')) setAsking(null);
      if (moving && !t.closest('.cl-mv') && !t.closest('.cl-nm')) setMoving(null);
    };
    const key = (e) => {
      if (e.key === 'Escape' && (moving || asking != null)) { setMoving(null); setAsking(null); return; }
      if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowLeft') setDay(clShift(day, -1));
      if (e.key === 'ArrowRight') setDay(clShift(day, 1));
    };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [adding, asking, moving, day]);

  const tag = (t) => <span className="cl-tag" style={{ background: colorOf(t) }}>{subjOf[t] ? <i>{subjOf[t]}</i> : null}{t}</span>;
  const telOf = (s) => {
    if (!s) return null;
    const own = rsPhone(s.s_hp), par = rsPhone(s.p_hp1);
    if (own) return <a href={'tel:' + String(s.s_hp).replace(/\D/g, '')}>{own}</a>;
    if (par) return <React.Fragment><a href={'tel:' + String(s.p_hp1).replace(/\D/g, '')}>{par}</a><small>학부모</small></React.Fragment>;
    return <span style={{ color: K.muted }}>번호 없음</span>;
  };
  // 추가 목록 — 학생 × 담임(영어·수학을 다 들으면 두 줄). 아무것도 안 쳤으면 없다. 그날 이미 든 학생(그 선생님 것)은 안 뜬다.
  const hits = () => {
    const out = [];
    if (!q.trim()) return out;
    students.forEach((s) => { if (!clNameHit(s.name, q)) return; s.cl_teachers.forEach((t) => {
      if (onDayAll.some((r) => r.s_id === s.s_id && r.teacher === t)) return;
      out.push([s, t]); }); });
    return out.sort((a, b) => String(a[0].name).localeCompare(String(b[0].name), 'ko')).slice(0, 9);
  };
  const moveBox = (r, s) => {
    const care = clPairOf(clDow(r.start_day)).length === 1;
    const opts = care ? [['5', '금요일'], ['6', '토요일']] : [['13', '월 · 수'], ['24', '화 · 목']];
    const same = moving.pair === pairKey(r) && moving.hour === r.hour, st = clMoveStart(day, moving.pair);
    const pl = (opts.filter((o) => o[0] === moving.pair)[0] || ['', ''])[1].replace(/ /g, '');
    return (
      <div className="cl-mv">
        <h4>{(s && s.name) || ''}<small>{r.kind} 클리닉 시간 옮기기</small></h4>
        <div className="lb">요일</div>
        <div className="cl-seg">{opts.map((o) => <button key={o[0]} className={moving.pair === o[0] ? 'on' : ''} onClick={() => setMoving(Object.assign({}, moving, { pair: o[0] }))}>{o[1]}</button>)}</div>
        <div className="lb">시간</div>
        <div className="cl-seg">{CL_HOURS.map((h) => <button key={h} className={moving.hour === h ? 'on' : ''} onClick={() => setMoving(Object.assign({}, moving, { hour: h }))}>{h - 12}시</button>)}</div>
        <div className="to">{same ? '지금 시간입니다' : <React.Fragment><b>{clMdw(st)}</b>부터 {care ? '' : pl + ' '}<b>{moving.hour - 12}시</b>로 옮깁니다</React.Fragment>}</div>
        <div className="acts"><button className="cancel" onClick={() => setMoving(null)}>취소</button><button className="go" disabled={same} onClick={doMove}>옮기기</button></div>
      </div>
    );
  };

  const nowH = new Date().getHours();
  const shown = wk ? CL_KINDS : ['조교'];
  const mode = curKind === '전체' ? '클리닉' : curKind + ' 클리닉';
  const vars = { '--surface': K.surface, '--raised': K.raised, '--active': K.active, '--border': K.border, '--rule': K.rule, '--control': K.control, '--text': K.text, '--muted': K.muted, '--ink': K.ink, '--inkText': K.inkText, '--neg': K.neg };
  const ready = aca !== null && rows !== null;

  return (
    <div data-root="" className="cl" style={Object.assign({ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }, vars)}>
      <style>{CL_CSS}</style>
      <nav className="cl-nav">
        {/* 제목이 곧 캡슐 — 평소엔 「조교 클리닉」 글자, 금·토에는 그 자리에서 담임 · 조교 · 전체 캡슐로 늘어난다 */}
        <span className={'cl-cap' + (wk ? '' : ' solo')} data-nopop="">
          <span className="thumb" style={{ left: (2 + Math.max(0, shown.indexOf(curKind)) * 96) + 'px' }}></span>
          {CL_KINDS.map((k) => (
            <button key={k} className={(k === curKind ? 'on' : '') + (shown.indexOf(k) < 0 ? ' gone' : '')} tabIndex={shown.indexOf(k) < 0 || !wk ? -1 : 0}
              onClick={() => { if (!wk) return; closeAll(); setKind(k); }}>
              <span className="n">{k === '전체' ? '전체' : k + ' 클리닉'}</span><span className="b" aria-hidden="true">{k === '전체' ? '전체' : k + ' 클리닉'}</span>
            </button>
          ))}
        </span>
        <span className="cl-day">
          <button className="arrow" title="전날" onClick={() => setDay(clShift(day, -1))}>‹</button>
          <label title="날짜 고르기"><span>{clMdw(day)}</span><input type="date" value={day} onChange={(e) => { if (e.target.value) setDay(e.target.value); }} /></label>
          <button className="arrow" title="다음 날" onClick={() => setDay(clShift(day, 1))}>›</button>
          <button className="cl-btn" style={{ marginLeft: '4px', visibility: day === today ? 'hidden' : 'visible' }} onClick={() => setDay(today)}>오늘</button>
        </span>
        <span className="cl-sum">
          {!ready ? '' : list.length ? <React.Fragment>{day === today ? '오늘 ' : '이날 '}{mode} <b>{list.length}명</b>{list.length < inKind.length ? ' · 가린 ' + (inKind.length - list.length) + '명' : ''}</React.Fragment>
            : inKind.length ? '전부 가려져 있습니다' : '잡힌 ' + mode + '이 없습니다'}
        </span>
      </nav>

      {err && <div style={{ flex: 'none', margin: '14px 20px 0', padding: '12px 14px', borderRadius: K.rCtl + 'px', background: K.surface, border: '1px solid ' + K.neg, fontSize: '13px', color: K.neg }}>{err}</div>}

      <div className="cl-main">
        {!ready ? <SlLoading text="불러오는 중…" /> : (
          <React.Fragment>
            <div className="cl-legend">
              {legendNames.map((t) => (
                <label key={t} className={'cl-chk' + (hidden[t] ? ' off' : '')} style={{ background: colorOf(t) }}>
                  <input type="checkbox" checked={!hidden[t]} onChange={(e) => setHidden(t, !e.target.checked)} />
                  {subjOf[t] ? <i>{subjOf[t]}</i> : null}{t}T <b>{cnt[t] || 0}</b>
                </label>
              ))}
              {!legendNames.length && <span style={{ fontSize: '13px', color: K.muted }}>{CL_BRANCH} 반이 없습니다.</span>}
            </div>
            <div className="cl-card" data-pop-quiet="">
              {CL_HOURS.map((h) => {
                const kids = list.filter((r) => r.hour === h);
                const isNow = day === today && nowH === h, past = day < today || (day === today && nowH > h);
                const found = adding === h ? hits() : [];
                return (
                  <div key={h} className={'cl-slot' + (past ? ' past' : '')}>
                    <div className="cl-hour"><div className="h">{h - 12}시</div><div className="r">{h - 12}:00 – {h - 11}:00</div>{isNow ? <div className="now">지금</div> : null}</div>
                    <div className="cl-kids">
                      {kids.length ? <div className="cl-head"><span>담임</span><span>이름</span><span>전화번호</span><span>해야 할 일</span><span>비고</span><span></span></div> : null}
                      {kids.map((r, i) => {
                        const s = stuOf(r.s_id), rep = clRepeat(r);
                        const gap = i > 0 && sjRank(kids[i - 1].teacher) !== sjRank(r.teacher);
                        const mv = moving && moving.id === r.id;
                        const sub = [(s && s.grade) || '', rep, curKind === '전체' ? r.kind : '', s && s.gone ? '퇴원' : ''].filter(Boolean).join(' · ');
                        return (
                          <div key={r.id} className={'cl-row' + (gap ? ' gap' : '') + (asking === r.id ? ' asking' : '') + (mv ? ' moving' : '')}>
                            <div className="cl-who">{tag(r.teacher)}</div>
                            <div className="cl-name">
                              <button className="cl-nm" title="시간 옮기기" onClick={() => { setAsking(null); setAdding(null); setMoving(mv ? null : { id: r.id, pair: pairKey(r), hour: r.hour }); }}>{(s && s.name) || '…'}</button>
                              <small>{sub}</small>
                            </div>
                            <div className="cl-tel">{telOf(s)}</div>
                            <div className="todo"><ClText value={(r.todo && r.todo[day]) || ''} placeholder="해야 할 일" onSave={(v) => saveTodo(r, v)} /></div>
                            <div className="note"><ClText value={r.note || ''} placeholder="비고" onSave={(v) => saveNote(r, v)} /></div>
                            <button className="cl-x" title="빼기" onClick={() => { setMoving(null); setAdding(null); setAsking(asking === r.id ? null : r.id); }}>×</button>
                            {asking === r.id ? (
                              <div className="cl-ask">
                                {rep ? <button onClick={() => skipDay(r)}>이날만 빼기<small>{r.kind === '담임' ? '다음 주 ' + CL_WD[clDow(r.start_day)] + '요일' : '다음 ' + rep}에는 그대로 옵니다</small></button> : null}
                                <button onClick={() => endFrom(r)}>{rep ? '이날부터 전부 빼기' : '빼기'}{rep ? <small>앞으로 저절로 생기지 않습니다</small> : null}</button>
                              </div>
                            ) : null}
                            {mv ? moveBox(r, s) : null}
                          </div>
                        );
                      })}
                      <div className="cl-add">
                        {adding === h ? (
                          <React.Fragment>
                            <div className="cl-find">
                              <input autoFocus value={q} placeholder="이름 또는 초성" autoComplete="off" onChange={(e) => setQ(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(null); setQ(''); } if (e.key === 'Enter' && !e.nativeEvent.isComposing && found.length) pick(found[0][0], found[0][1]); }} />
                              <span>Esc 로 닫기</span>
                            </div>
                            {q.trim() ? (
                              <div className="cl-pop">
                                {found.length ? found.map((o, i) => (
                                  <button key={o[0].s_id + '|' + o[1]} className={i === 0 ? 'on' : ''} onClick={() => pick(o[0], o[1])}>{o[0].name}<small>{o[0].grade || ''}</small>{tag(o[1])}</button>
                                )) : <div className="none">맞는 학생이 없습니다</div>}
                              </div>
                            ) : null}
                          </React.Fragment>
                        ) : <button onClick={() => { setAsking(null); setMoving(null); setQ(''); setAdding(h); }}>+ 학생 추가</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cl-foot">
              한 번 넣은 클리닉은 같은 시간에 이어집니다 — 월요일에 넣으면 월·수, 화요일에 넣으면 화·목(수요일은 수·월, 목요일은 목·화로 같은 짝). 저절로 생긴 날의 「해야 할 일」은 비어 있고 비고는 이어집니다.
              금·토의 담임 클리닉은 매주 같은 요일로 이어지고, 금·토의 조교 클리닉은 그날 하루뿐입니다. 지금은 {CL_BRANCH}만 씁니다.
            </div>
          </React.Fragment>
        )}
      </div>

      {toast && <div style={{ position: 'fixed', left: '50%', bottom: '34px', transform: 'translateX(-50%)', background: K.ink, color: K.inkText, fontSize: '13px', padding: '10px 18px', borderRadius: K.rCtl + 'px', zIndex: 99 }}>{toast}</div>}
    </div>
  );
}
