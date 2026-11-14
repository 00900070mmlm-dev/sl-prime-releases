// ============================================================
// 출석부 (홈 → 출석부)
//
// 2026-11-12 사장님: 예전 엑셀 출석부(고1·2·3 영어, 월별 시트)를 앱으로 옮긴다. 시안(sl-chulseok)에서 고친 것:
//   · 반·학생·수업날짜는 **ACA2000 동기화본**(aca_class · aca_student) 기준. 엑셀 명단은 쓰지 않는다.
//   · 반 고르기는 **주간테스트 관리와 같은 트리**(과목 → 급 → 학교 → 학년 → 반, 여러 반 · 수학과 중등은 학교 층 없이 급 → 학년 → 반) — 만드는 함수도 waTree 를 그대로 쓴다.
//   · 날짜는 그 달 **평일 전부**(토·일은 뺀다). 반의 ACA 시간표 요일이 아닌 날은 **진한 회색**으로 칠하지만 입력은 된다.
//   · 칸을 누르면 **드롭다운**(통과 · 지각 · 결 · 재시험 맞은 개수 · 비우기). 칸을 끌면 사각형으로 여러 칸을 잡아 **한 번에** 넣는다.
//   · **재시험은 따로 고르지 않는다** — 맞은 개수(숫자)를 적으면 그게 재시험이다.
//   · 옛 엑셀 기록(1~8월)은 옮기지 않는다 — 오늘부터의 기록만 쌓는다.
// 저장: 값을 고르는 즉시 attendance 표에 쓴다(저장 버튼 없음). 실패하면 화면을 되돌리고 알린다.
// 스키마: scripts/attendance_schema.sql
// ============================================================

const ATD_OPTS = ['통과', '지각', '결'];
const ATD_WD = ['일', '월', '화', '수', '목', '금', '토'];   // Date.getDay()
const ATD_ACA_DAY = ['', '월', '화', '수', '목', '금', '토', '일'];   // aca_class.timetable[].day — 1=월 … 7=일
const ATD_SCHEMA_HINT = 'Supabase SQL Editor 에서 scripts/attendance_schema.sql 을 한 번 실행해야 합니다.';

function atdYmd(y, m, d) { return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
const atdIsAbs = (v) => v === '결';
const atdIsRetest = (v) => /^\d+$/.test(v);   // 재시험 = 숫자 칸(본시험 불통과 · 맞은 개수). 2026-11-13 '단어' 칸을 '재시험' 칸으로 바꿨다
function atdErrText(e) {
  const m = String((e && e.message) || e || '');
  if (/relation .* does not exist|schema cache|PGRST205/i.test(m)) return '출석 표가 아직 없습니다 — ' + ATD_SCHEMA_HINT;
  if (/row-level security|permission denied/i.test(m)) return '출석을 고칠 권한이 없습니다.';
  return m || '알 수 없는 오류';
}
/** 칸 색 — 글자색만(배지 없음). 사장님 2026-11-13: 통과=초록 · 지각=노랑 · 결석=빨강 · 재시험(숫자)=굵은 빨강. */
function atdMarkStyle(v, dark) {
  const K = TT(dark);
  const base = { display: 'inline-block', minWidth: '30px', padding: '2px 5px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' };
  if (v === '통과') return Object.assign(base, { color: K.pos });
  if (v === '결') return Object.assign(base, { color: K.neg });
  if (v === '지각') return Object.assign(base, { color: dark ? '#E8C04A' : '#B98A00' });   // 노랑 — 흰 바탕에서도 읽히게 조금 짙게
  return Object.assign(base, { color: K.neg, fontWeight: 800 });   // 숫자 = 재시험 맞은 개수
}

function AttendApp({ dark, userName, onHome }) {
  const T = THEME(dark);
  const K = TT(dark);
  const now = new Date();
  const todayYmd = atdYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [aca, setAca] = useState(null);           // { students, classes } | null = 로딩
  const [err, setErr] = useState('');
  const [subject, setSubjectRaw] = useState(() => { try { return localStorage.getItem('atd_subject') === '수학' ? '수학' : '영어'; } catch (e) { return '영어'; } });
  const [onlyMine, setOnlyMine] = useState(false);
  const [branch, setBranchRaw] = useState(waLoadBranch);   // 지점(원당점 · 이음점) — 반 트리 맨 위
  const [level, setLevel] = useState(null);
  const [openSchool, setOpenSchool] = useState(null);
  const [openGrade, setOpenGrade] = useState(null);   // '학교|학년'
  const [classIds, setClassIds] = useState([]);
  const [q, setQ] = useState('');                  // 반 이름 찾기
  const [sq, setSq] = useState('');                // 학생 찾기
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [marks, setMarks] = useState({});          // 's_id|c_id|YYYY-MM-DD' → 값
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(null);          // { a:{r,c}, b:{r,c}, done } — 끌어서 잡은 사각형
  const [dd, setDd] = useState(null);              // { cells:[{s_id,c_id,day}], x, y, flip } — 열린 드롭다운
  const [num, setNum] = useState('');
  const [toast, setToast] = useState('');
  const lastCell = useRef(null);                   // 마지막으로 지나간 칸(드롭다운을 그 옆에 띄운다)
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const setSubject = (sj) => {
    if (sj === subject) return;
    setSubjectRaw(sj); try { localStorage.setItem('atd_subject', sj); } catch (e) {}
    setClassIds([]); setLevel(null); setOpenSchool(null); setOpenGrade(null);
  };
  const setBranch = (b) => { setBranchRaw(b); setClassIds([]); setLevel(null); setOpenSchool(null); setOpenGrade(null); };

  // ── ACA 명단 ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      SB.from('aca_student').select('s_id,name,grade,state,school,class_ids').eq('state', '재원').limit(3000),
      SB.from('aca_class').select('c_id,name,subjects,teachers,deleted,timetable,timetable_text').limit(3000),
    ]).then(([a, b]) => {
      if (a.error || b.error) { setErr(atdErrText(a.error || b.error)); setAca({ students: [], classes: [] }); return; }
      setAca({ students: a.data || [], classes: b.data || [] });
    });
  }, []);
  const classes = (aca && aca.classes) || [];
  const students = (aca && aca.students) || [];
  const headN = (c) => students.filter((s) => (s.class_ids || []).indexOf(c.c_id) >= 0).length;
  const tree = aca ? waTree(students, classes, onlyMine, userName, subject, branch) : [];
  const levels = WA_LEVELS.map((lv) => ({ level: lv, schools: tree.filter((x) => waSchoolLevel(x.name, x.grades) === lv) })).filter((x) => x.schools.length);
  const curLevel = (level && levels.some((x) => x.level === level)) ? level : (levels[0] || {}).level;
  const shownSchools = (levels.filter((x) => x.level === curLevel)[0] || { schools: [] }).schools;
  const toggleClass = (id) => setClassIds((cur0) => cur0.indexOf(id) >= 0 ? cur0.filter((x) => x !== id) : cur0.concat([id]));
  const selCls = classIds.map((id) => classes.find((c) => c.c_id === id)).filter(Boolean);

  // ── 그 달 날짜(평일만) ───────────────────────────────────────────
  const dim = new Date(year, month, 0).getDate();
  const days = [];
  for (let d = 1; d <= dim; d++) {
    const w = ATD_WD[new Date(year, month - 1, d).getDay()];
    if (w !== '토' && w !== '일') days.push({ d: d, w: w, ymd: atdYmd(year, month, d) });
  }
  const first = atdYmd(year, month, 1), last = atdYmd(year, month, dim);

  // ── 출석 읽기: 고른 반 × 그 달 ─────────────────────────────────────
  const loadKey = classIds.slice().sort().join(',') + '|' + first;
  useEffect(() => {
    if (!classIds.length) { setMarks({}); return; }
    let alive = true;
    setLoading(true);
    SB.from('attendance').select('s_id,c_id,day,value').in('c_id', classIds).gte('day', first).lte('day', last).limit(20000)
      .then(({ data, error }) => {
        if (!alive) return;
        setLoading(false);
        if (error) { setErr(atdErrText(error)); setMarks({}); return; }
        setErr('');
        const m = {};
        (data || []).forEach((r) => { m[r.s_id + '|' + r.c_id + '|' + r.day] = r.value; });
        setMarks(m);
      });
    return () => { alive = false; };
  }, [loadKey]);

  // ── 화면의 줄: 고른 반마다 학생(가나다) ──────────────────────────────
  const rows = [];   // { kind:'grp', cls, n } | { kind:'stu', cls, stu, no, r }
  let rIdx = 0;
  selCls.forEach((c) => {
    const kids = students.filter((s) => (s.class_ids || []).indexOf(c.c_id) >= 0 && (!sq.trim() || s.name.indexOf(sq.trim()) >= 0))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    if (selCls.length > 1) rows.push({ kind: 'grp', cls: c, n: kids.length });
    kids.forEach((s, i) => { rows.push({ kind: 'stu', cls: c, stu: s, no: i + 1, r: rIdx }); rIdx += 1; });
  });
  const stuRows = rows.filter((x) => x.kind === 'stu');
  const keyOf = (s_id, c_id, day) => s_id + '|' + c_id + '|' + day;

  // ── 쓰기: 낙관적으로 바꾸고, 실패하면 되돌린다 ──────────────────────
  const write = (cells, v) => {
    if (!cells.length) return;
    const before = {};
    cells.forEach((x) => { const k = keyOf(x.s_id, x.c_id, x.day); before[k] = marks[k]; });
    setMarks((m0) => {
      const m = Object.assign({}, m0);
      cells.forEach((x) => { const k = keyOf(x.s_id, x.c_id, x.day); if (v) m[k] = v; else delete m[k]; });
      return m;
    });
    let job;
    if (v) {
      const at = new Date().toISOString();
      job = SB.from('attendance').upsert(cells.map((x) => ({ s_id: x.s_id, c_id: x.c_id, day: x.day, value: v, updated_by: userName || null, updated_at: at })), { onConflict: 's_id,c_id,day' });
    } else {
      // 비우기 = 줄을 지운다. 학생·반마다 한 번씩(그 학생의 고른 날짜들).
      const g = {};
      cells.forEach((x) => { const k = x.s_id + '|' + x.c_id; (g[k] = g[k] || { s_id: x.s_id, c_id: x.c_id, days: [] }).days.push(x.day); });
      job = Promise.all(Object.keys(g).map((k) => SB.from('attendance').delete().eq('s_id', g[k].s_id).eq('c_id', g[k].c_id).in('day', g[k].days)))
        .then((rs) => rs.find((r) => r.error) || { error: null });
    }
    job.then(({ error }) => {
      if (!error) {
        // 재시험(점수)이었던 칸을 다른 값으로 바꾸거나 지우면 = 그 재시험을 취소한 것 → 업무일지의 그 재시험 기록(날짜·시간·결과)을 모두 지운다.
        // 안 지우면 같은 날 다시 재시험을 찍었을 때 예전 일정·결과(10시 통과 등)가 되살아났다(사장님 2026-11-13, 가온·재준).
        const undone = cells.filter((x) => atdIsRetest(before[keyOf(x.s_id, x.c_id, x.day)] || '') && !atdIsRetest(v || ''));
        undone.forEach((x) => {
          SB.from('retest_log').delete().eq('s_id', x.s_id).eq('c_id', x.c_id).eq('test_day', x.day).then(() => {}, () => {});
        });
        return;
      }
      setMarks((m0) => {
        const m = Object.assign({}, m0);
        Object.keys(before).forEach((k) => { if (before[k] === undefined) delete m[k]; else m[k] = before[k]; });
        return m;
      });
      setErr(atdErrText(error));
      say('저장하지 못했습니다 — 되돌렸습니다');
    });
  };

  // ── 끌어서 고르기 → 드롭다운 ─────────────────────────────────────
  const inRect = (r, c, a, b) => r >= Math.min(a.r, b.r) && r <= Math.max(a.r, b.r) && c >= Math.min(a.c, b.c) && c <= Math.max(a.c, b.c);
  const closeDd = () => { setDd(null); setDrag(null); };
  const openDdFor = (dr) => {
    const cells = [];
    stuRows.forEach((x) => days.forEach((dy, ci) => { if (inRect(x.r, ci, dr.a, dr.b)) cells.push({ s_id: x.stu.s_id, c_id: x.cls.c_id, day: dy.ymd }); }));
    const el = lastCell.current;
    const rc = el ? el.getBoundingClientRect() : { left: 200, right: 240, top: 200, bottom: 234, width: 40 };
    const vals = cells.map((x) => marks[keyOf(x.s_id, x.c_id, x.day)] || '');
    const same = vals.every((v) => v === vals[0]) ? vals[0] : '';
    setNum(/^\d+$/.test(same) ? same : '');
    const W = 176, H = cells.length > 1 ? 214 : 190;
    let y = rc.bottom + 4;
    if (y + H > window.innerHeight - 8) y = rc.top - H - 4;
    const x = Math.max(8, Math.min(rc.left + rc.width / 2 - W / 2, window.innerWidth - W - 8));
    setDd({ cells: cells, x: x, y: Math.max(8, y), now: same });
  };
  const dragRef = useRef(null);   // 마우스를 놓는 순간 쓰는 최신 drag(이벤트 핸들러 안의 state 는 한 박자 늦을 수 있다)
  dragRef.current = drag;
  useEffect(() => {
    const up = () => {
      const dr = dragRef.current;
      if (!dr || dr.done) return;
      const done = Object.assign({}, dr, { done: true });
      dragRef.current = done;
      setDrag(done);
      openDdFor(done);
    };
    const key = (e) => { if (e.key === 'Escape') closeDd(); };
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('keydown', key); };
  });
  const pick = (v) => { if (dd) write(dd.cells, v); closeDd(); };

  // ── 집계(그 달) ─────────────────────────────────────────────────
  const rowVals = (x) => days.map((dy) => marks[keyOf(x.stu.s_id, x.cls.c_id, dy.ymd)] || '').filter(Boolean);
  let nPass = 0, nLate = 0, nAbs = 0, nRe = 0;
  stuRows.forEach((x) => rowVals(x).forEach((v) => { if (v === '통과') nPass++; else if (v === '지각') nLate++; else if (v === '결') nAbs++; else if (/^\d+$/.test(v)) nRe++; }));

  // ── 화면 ────────────────────────────────────────────────────────
  // taste(2026-11-12): 흰 카드 + 1px 선, 트리 행은 시안 .tr(선택 = active 회색 바탕 · 먹 글자), 파랑 크롬 없음
  const card = { background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px' };
  const inputS = { border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '7px 10px', fontSize: '13px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none' };
  const boxBtn = (open, small) => ({ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box', fontSize: '13px', height: small ? '32px' : '34px', padding: '0 10px', borderRadius: K.rCtl + 'px',
    border: 'none', background: open ? K.active : 'transparent', color: K.text, fontWeight: open ? 500 : 400, transition: K.ease });
  const caret = (open) => ({ flex: 'none', width: '14px', textAlign: 'center', fontSize: '11px', lineHeight: '13px', color: K.muted, display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: K.ease });
  const rowBtn = (on) => ({ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: K.rCtl + 'px', height: '32px', padding: '0 10px', fontSize: '13px', background: on ? K.active : 'transparent', color: on ? K.text : K.muted, fontWeight: on ? 500 : 400, transition: K.ease });
  const clsRow = (c) => {
    const on = classIds.indexOf(c.c_id) >= 0;
    return (
      <button key={c.c_id} onClick={() => toggleClass(c.c_id)} style={rowBtn(on)}>
        <span style={{ flex: 'none', width: '5px', height: '5px', borderRadius: '50%', background: on ? K.ink : K.muted, opacity: on ? 1 : 0.45 }}></span>
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
        <span style={{ flex: 'none', color: K.muted, fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{headN(c)}명</span>
      </button>
    );
  };
  const qq = q.trim().replace(/\s/g, '');
  const hits = qq ? classes.filter((c) => waIsEnglish(c, subject, branch) && String(c.name).replace(/\s/g, '').indexOf(qq) >= 0).sort(waClassCmp).slice(0, 12) : [];

  // 표 색
  const gridBg = K.surface;
  const headBg = K.surface;
  const line = K.rule;
  const offBg = dark ? '#3a3b42' : '#d8d8dd';         // 수업 요일이 아닌 날 — 진한 회색(사장님 2026-11-12) · taste 에서도 그대로 유지
  const selBg = K.hueSoft;                            // 끌어서 잡은 칸 = 선택된 데이터 칸(hue 옅게)
  const thS = { position: 'sticky', top: 0, zIndex: 5, background: headBg, fontWeight: 400, color: K.muted, fontSize: '12px', height: '26px', borderBottom: '1px solid ' + line, padding: 0, fontVariantNumeric: 'tabular-nums' };
  const th2S = Object.assign({}, thS, { top: '26px', height: '20px', fontSize: '10px', fontWeight: 400, color: K.muted });
  const stick = (left, w, extra) => Object.assign({ position: 'sticky', left: left + 'px', zIndex: 6, background: gridBg, width: w + 'px', minWidth: w + 'px', borderBottom: '1px solid ' + line, padding: 0 }, extra || {});
  const stickH = (left, w, top, extra) => Object.assign(stick(left, w, extra), { top: top + 'px', zIndex: 7, background: headBg });
  const L = [0, 40, 136, 182];   // 번호 · 이름 · 결석 · 단어 열의 왼쪽 위치

  const ymLabel = year + '년 ' + month + '월';
  const selMeta = selCls.length === 1
    ? [(selCls[0].teachers || []).join(', '), selCls[0].timetable_text].filter(Boolean).join(' · ')
    : (selCls.length ? selCls.length + '개 반' : '');

  return (
    <div data-root="" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }}>
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: K.ground, borderBottom: '1px solid ' + K.border }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span className="nav-brand" style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px' }}>SL PRIME</span>
          <span style={{ fontSize: '14px', color: K.muted, whiteSpace: 'nowrap' }}>출석부</span>
        </div>
      </nav>

      {err && <div style={{ flex: 'none', margin: '14px 20px 0', padding: '12px 14px', borderRadius: K.rCtl + 'px', background: K.surface, border: '1px solid ' + K.neg, fontSize: '13px', color: K.neg }}>{err}</div>}

      <div data-mstack="" style={{ flex: 1, minHeight: 0, display: 'flex', gap: '16px', padding: '16px 20px' }}>
        {/* ① 반 — 과목 → 급 → 학교 → 학년 → 반(여러 개 · 수학과 중등은 급 → 학년 → 반). 주간테스트 관리와 같은 모양 */}
        <div data-mpane="" style={Object.assign({}, card, { flex: 'none', width: '280px', padding: '12px', overflowY: 'auto' })}>
          <WaBranchPick value={branch} onChange={setBranch} T={T} dark={dark} />
          <div style={{ display: 'flex', gap: '2px', padding: '2px', marginBottom: '10px', borderRadius: K.rCtl + 'px', background: K.raised }}>
            {['영어', '수학'].map((sj) => (
              <button key={sj} onClick={() => setSubject(sj)}
                style={{ flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: 0, fontSize: '13px', fontWeight: subject === sj ? 500 : 400,
                  background: subject === sj ? K.surface : 'transparent', color: subject === sj ? K.text : K.muted, transition: K.ease }}>{sj}</button>
            ))}
          </div>
          {!!selCls.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
              {selCls.map((c) => (
                <button key={c.c_id} onClick={() => toggleClass(c.c_id)} title="빼기"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', padding: '3px 8px 3px 10px', fontSize: '12px', background: K.raised, color: K.text, fontWeight: 500, transition: K.ease }}>
                  <span>{c.name}</span><span style={{ fontSize: '13px', lineHeight: '13px', opacity: 0.75 }}>×</span>
                </button>
              ))}
            </div>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="반 이름으로 찾기" style={Object.assign({}, inputS, { width: '100%', boxSizing: 'border-box', marginBottom: '8px' })} />
          {!!qq && (
            <div style={{ marginBottom: '10px' }}>
              {hits.map(clsRow)}
              {!hits.length && <div style={{ padding: '10px 6px', fontSize: '12.5px', color: K.muted }}>그런 반이 없습니다.</div>}
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px 10px', cursor: 'pointer', fontSize: '13px', color: K.muted }}>
            <input type="checkbox" style={{ accentColor: K.ink }} checked={onlyMine} onChange={(e) => { setOnlyMine(e.target.checked); setClassIds([]); }} />
            <span>내 담당 반만 보기</span>
          </label>
          {aca === null ? <div style={{ padding: '30px 0', textAlign: 'center', color: K.muted, fontSize: '13px' }}>명단 불러오는 중…</div>
            : !tree.length ? (
              <div style={{ padding: '18px 6px', color: K.muted, fontSize: '13px', lineHeight: 1.6 }}>
                {onlyMine ? ('‘' + userName + '’ 선생님이 담당으로 설정된 ' + subject + ' 반이 없습니다.') : (subject + ' 반이 없습니다.')}
              </div>
            ) : (
              <React.Fragment>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px', padding: '2px', marginBottom: '10px', borderRadius: K.rCtl + 'px', background: K.raised }}>
                  {levels.map((sec) => {
                    const on = sec.level === curLevel;
                    return (
                      <button key={sec.level} onClick={() => { setLevel(sec.level); setOpenSchool(null); setOpenGrade(null); }}
                        style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: '0 10px', fontSize: '13px', fontWeight: on ? 500 : 400, background: on ? K.surface : 'transparent', color: on ? K.text : K.muted, transition: K.ease }}>
                        {WA_LEVEL_CHIP[sec.level] || sec.level}
                        <span style={{ marginLeft: '4px', fontSize: '12px', color: K.muted }}>{sec.schools.length}</span>
                      </button>
                    );
                  })}
                </div>
                {shownSchools.map((sc) => {
                  const scOpen = openSchool === sc.name;
                  return (
                    <div key={sc.name} style={{ marginBottom: '2px' }}>
                      <button onClick={() => setOpenSchool(scOpen ? null : sc.name)} style={boxBtn(scOpen)}>
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc.name}</span>
                        <span style={{ flex: 'none', color: K.muted, fontSize: '12px' }}>{sc.flat ? sc.grades[0].classes.length + '반' : sc.grades.length + '개 학년'}</span>
                        <span style={caret(scOpen)}>▾</span>
                      </button>
                      {scOpen && (
                        <div style={{ margin: '2px 0 0 12px' }}>
                          {sc.grades.map((g) => {
                            // 학년 칸(sc.flat — 수학·중등)은 열면 반이 바로 나온다 — 안쪽 학년 버튼 없음
                            const gKey = sc.name + '|' + g.grade, gOpen = sc.flat || openGrade === gKey;
                            return (
                              <div key={gKey} style={{ marginBottom: '3px' }}>
                                {!sc.flat && <button onClick={() => setOpenGrade(gOpen ? null : gKey)} style={boxBtn(gOpen, true)}>
                                  <span style={{ flex: 1, minWidth: 0 }}>{g.grade}</span>
                                  <span style={{ flex: 'none', color: K.muted, fontSize: '12px' }}>{g.classes.length}반</span>
                                  <span style={caret(gOpen)}>▾</span>
                                </button>}
                                {gOpen && <div style={{ margin: sc.flat ? '0' : '2px 0 0 12px' }}>{g.classes.map(clsRow)}</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            )}
        </div>

        {/* ② 출석표 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 달 고르기 · 학생 찾기 */}
          <div style={Object.assign({}, card, { flex: 'none', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' })}>
            <button onClick={() => setYear(year - 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: K.muted, fontSize: '14px', fontFamily: 'inherit', padding: '4px 6px' }}>‹</button>
            <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '44px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{year}</span>
            <button onClick={() => setYear(year + 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: K.muted, fontSize: '14px', fontFamily: 'inherit', padding: '4px 6px' }}>›</button>
            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', padding: '2px', borderRadius: K.rCtl + 'px', background: K.raised }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const on = m === month;
                return (
                  <button key={m} onClick={() => setMonth(m)}
                    style={{ cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: '0 10px', fontSize: '13px', fontWeight: on ? 500 : 400, fontVariantNumeric: 'tabular-nums',
                      border: 'none', background: on ? K.surface : 'transparent', color: on ? K.text : K.muted, transition: K.ease }}>{m}월</button>
                );
              })}
            </div>
            <input value={sq} onChange={(e) => setSq(e.target.value)} placeholder="학생 검색" style={Object.assign({}, inputS, { marginLeft: 'auto', width: '140px', padding: '6px 12px' })} />
          </div>

          <div style={Object.assign({}, card, { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '14px 16px' })}>
            {!selCls.length ? (
              <div style={{ padding: '70px 0', textAlign: 'center', color: K.muted, fontSize: '13.5px' }}>왼쪽에서 반을 고르세요. <b>여러 반을 함께</b> 고를 수 있습니다.</div>
            ) : (
              <React.Fragment>
                <div style={{ flex: 'none', display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 500 }}>{selCls.map((c) => c.name).join(' · ')}</span>
                  <span style={{ fontSize: '12.5px', color: K.muted }}>{[selMeta, ymLabel, stuRows.length + '명'].filter(Boolean).join(' · ')}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: K.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {loading ? '불러오는 중…' : ('통과 ' + nPass + ' · 재시험 ' + nRe + ' · 지각 ' + nLate + ' · 결석 ' + nAbs)}
                  </span>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', borderRadius: K.rCtl + 'px', border: '1px solid ' + K.border, background: gridBg }}>
                  <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px', minWidth: '100%', userSelect: 'none' }}>
                    <thead>
                      <tr>
                        <th style={stickH(L[0], 40, 0, { height: '26px', fontSize: '12px', fontWeight: 400, color: K.muted })}>번호</th>
                        <th style={stickH(L[1], 96, 0, { textAlign: 'left', paddingLeft: '10px', fontSize: '12px', fontWeight: 400, color: K.muted })}>이름</th>
                        <th style={stickH(L[2], 46, 0, { fontSize: '12px', fontWeight: 400, color: K.muted })}>결석</th>
                        <th style={stickH(L[3], 46, 0, { fontSize: '12px', fontWeight: 400, color: K.muted, borderRight: '1px solid ' + K.border })}>재시험</th>
                        {days.map((dy) => <th key={dy.d} style={Object.assign({}, thS, { width: '44px', minWidth: '44px', color: dy.ymd === todayYmd ? K.text : K.muted, fontWeight: dy.ymd === todayYmd ? 600 : 400 })}>{dy.d}</th>)}
                        <th style={thS}></th>
                      </tr>
                      <tr>
                        <th style={stickH(L[0], 40, 26)}></th><th style={stickH(L[1], 96, 26)}></th><th style={stickH(L[2], 46, 26)}></th>
                        <th style={stickH(L[3], 46, 26, { borderRight: '1px solid ' + K.border })}></th>
                        {days.map((dy) => <th key={dy.d} style={Object.assign({}, th2S, { color: dy.ymd === todayYmd ? K.text : K.muted, fontWeight: dy.ymd === todayYmd ? 600 : 400 })}>{dy.ymd === todayYmd ? '오늘' : dy.w}</th>)}
                        <th style={th2S}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((x) => {
                        if (x.kind === 'grp') {
                          return (
                            <tr key={'g' + x.cls.c_id}>
                              <td colSpan={4} style={stick(0, 228, { height: '30px', background: K.raised, fontWeight: 500, fontSize: '12.5px', padding: '0 10px', whiteSpace: 'nowrap' })}>
                                {x.cls.name}<span style={{ fontWeight: 400, color: K.muted, marginLeft: '8px', fontSize: '11.5px' }}>{(x.cls.timetable_text || '시간표 없음') + ' · ' + x.n + '명'}</span>
                              </td>
                              <td colSpan={days.length + 1} style={{ background: K.raised, borderBottom: '1px solid ' + line }}></td>
                            </tr>
                          );
                        }
                        const tt = (x.cls.timetable || []).map((t) => ATD_ACA_DAY[t.day]).filter(Boolean);
                        const vals = rowVals(x);
                        const abs = vals.filter(atdIsAbs).length, re = vals.filter(atdIsRetest).length;
                        return (
                          <tr key={x.cls.c_id + '-' + x.stu.s_id}>
                            <td style={stick(L[0], 40, { height: '34px', textAlign: 'center', color: K.muted, fontVariantNumeric: 'tabular-nums' })}>{x.no}</td>
                            <td style={stick(L[1], 96, { padding: '0 10px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })} title={(x.stu.school || '') + ' ' + (x.stu.grade || '')}>{x.stu.name}</td>
                            <td style={stick(L[2], 46, { textAlign: 'center', fontWeight: abs ? 500 : 400, color: abs ? K.neg : K.muted, fontVariantNumeric: 'tabular-nums' })}>{abs}</td>
                            <td style={stick(L[3], 46, { textAlign: 'center', fontWeight: re ? 800 : 400, color: re ? K.neg : K.muted, fontVariantNumeric: 'tabular-nums', borderRight: '1px solid ' + K.border })}>{re}</td>
                            {days.map((dy, ci) => {
                              const v = marks[keyOf(x.stu.s_id, x.cls.c_id, dy.ymd)] || '';
                              const off = tt.length && tt.indexOf(dy.w) < 0;   // 이 반 수업 요일이 아닌 날(시간표 없는 반은 칠하지 않는다)
                              const sel = drag && inRect(x.r, ci, drag.a, drag.b);
                              return (
                                <td key={dy.d}
                                  onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); lastCell.current = e.currentTarget; setDd(null); setDrag({ a: { r: x.r, c: ci }, b: { r: x.r, c: ci } }); }}
                                  onMouseEnter={(e) => { if (drag && !drag.done) { lastCell.current = e.currentTarget; setDrag(Object.assign({}, drag, { b: { r: x.r, c: ci } })); } }}
                                  style={{ width: '44px', minWidth: '44px', height: '34px', textAlign: 'center', cursor: 'pointer', padding: 0,
                                    borderBottom: '1px solid ' + line, borderRight: '1px solid ' + line,
                                    background: sel ? selBg : (off ? offBg : 'transparent'),
                                    boxShadow: sel ? 'inset 0 0 0 1px ' + K.hue : 'none' }}>
                                  {v && <span style={atdMarkStyle(v, dark)}>{v}</span>}
                                </td>
                              );
                            })}
                            <td style={{ borderBottom: '1px solid ' + line }}></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!stuRows.length && <div style={{ padding: '40px 0', textAlign: 'center', color: K.muted, fontSize: '13px' }}>{sq.trim() ? '그런 학생이 없습니다.' : '재원생이 없습니다.'}</div>}
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      </div>

      {/* 드롭다운 — 칸 하나 또는 끌어서 잡은 여러 칸 */}
      {dd && (
        <React.Fragment>
          <div onMouseDown={closeDd} style={{ position: 'fixed', inset: 0, zIndex: 40 }}></div>
          <div style={{ position: 'fixed', left: dd.x + 'px', top: dd.y + 'px', zIndex: 41, width: '176px', padding: '5px', borderRadius: K.rCard + 'px', background: K.surface, border: '1px solid ' + K.border, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            {dd.cells.length > 1 && <div style={{ fontSize: '11px', fontWeight: 500, color: K.muted, padding: '4px 8px 6px' }}>{dd.cells.length}칸 일괄</div>}
            {ATD_OPTS.map((o) => (
              <button key={o} onClick={() => pick(o)}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '6px 8px', borderRadius: K.rCtl + 'px', background: dd.now === o ? K.active : 'transparent', transition: K.ease }}>
                <span style={atdMarkStyle(o, dark)}>{o}</span>
              </button>
            ))}
            <div style={{ display: 'flex', gap: '4px', padding: '5px 4px', margin: '3px 0', borderTop: '1px solid ' + K.rule, borderBottom: '1px solid ' + K.rule }}>
              <input autoFocus={false} type="number" min="0" max="999" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onKeyDown={(e) => { if (e.key === 'Enter' && num) pick(num); }} placeholder="재시험 개수"
                style={Object.assign({}, inputS, { flex: 1, minWidth: 0, padding: '4px 6px', fontSize: '12px', borderRadius: '6px' })} />
              <button onClick={() => { if (num) pick(num); }} style={{ border: 'none', borderRadius: K.rCtl + 'px', background: K.ink, color: K.inkText, fontSize: '11.5px', cursor: 'pointer', fontFamily: 'inherit', padding: '0 9px' }}>입력</button>
            </div>
            <button onClick={() => pick('')} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '6px 8px', borderRadius: K.rCtl + 'px', background: 'transparent', color: K.muted, fontSize: '12px' }}>비우기</button>
          </div>
        </React.Fragment>
      )}

      {toast && <div style={{ position: 'fixed', left: '50%', bottom: '34px', transform: 'translateX(-50%)', background: K.ink, color: K.inkText, fontSize: '13px', padding: '10px 18px', borderRadius: K.rCtl + 'px', zIndex: 99 }}>{toast}</div>}
    </div>
  );
}
