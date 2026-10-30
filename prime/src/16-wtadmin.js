// 주간테스트 관리 (홈 → 주간테스트 관리)
// **성적 아카이빙**이 본 용도다. 문항 출제는 여기서 하지 않는다(지문 스튜디오 → 주간테스트).
//   왼쪽  학교 → 학년 → 반 (아카2000에서 받아 온 명단. '내 담당 반만 보기' 로 추릴 수 있다)
//   오른쪽 시험을 고르고, 그 반 재원 학생이 깔린 성적표에 점수를 적는다
//
// 시험지는 **강사별·반별**로 등록한다(사장님 2026-10-22) — 반은 여러 개를 고를 수 있고,
// 한 주에 몇 개를 등록하든 막지 않는다. 주는 그 주 월요일(week_start)로 저장한다.
//
// 명단: aca_student · aca_class (아카2000 openapi 동기화본, 이 앱은 **읽기만** 한다)
// 성적: scripts/weekly_schema.sql 의 weekly_tests · weekly_scores. 스키마를 안 돌렸으면 안내를 띄운다.

const WA_SCHEMA_HINT = 'scripts/weekly_schema.sql 을 Supabase SQL Editor 에서 한 번 실행해야 합니다.';
const WA_GRADE_ORDER = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];

function waErrText(e) {
  const m = String((e && e.message) || e || '');
  if (/relation .* does not exist|schema cache|PGRST205/i.test(m)) return '성적 표가 아직 없습니다 — ' + WA_SCHEMA_HINT;
  if (/duplicate key|weekly_tests_week/i.test(m)) return '그 주 시험이 이미 있습니다 — 위 목록에서 고르세요.';
  if (/row-level security|permission denied/i.test(m)) return '권한이 없습니다. 만든 사람 또는 관리자·개발자만 고칠 수 있습니다.';
  return m || '알 수 없는 오류';
}
function waToday() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);   // 한국 시간 기준 오늘
}
// ── 주 ───────────────────────────────────────────────────────────
// 시험은 주마다 하나다. 주는 **그 주 월요일 날짜**(YYYY-MM-DD) 하나로 나타낸다 —
// weekly_tests.week_start 에 unique 가 걸려 있어 같은 주에 두 개가 들어가지 않는다.
function waYmd(d) { return d.toISOString().slice(0, 10); }
function waParse(ymd) {
  const p = String(ymd || '').split('-');
  return p.length === 3 ? new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))) : null;
}
/** 그 날이 든 주의 월요일. 일요일(getUTCDay 0)은 그 주의 마지막 날로 본다. */
function waMonday(ymd) {
  const d = waParse(ymd);
  if (!d) return '';
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return waYmd(d);
}
function waWeekShift(mon, n) {
  const d = waParse(mon);
  if (!d) return mon || '';
  d.setUTCDate(d.getUTCDate() + n * 7);
  return waYmd(d);
}
// 학생이 스스로 채점하는 페이지(web/grade/) — 상담 예약과 같은 집, 경로만 다르다.
// 토큰이 없는 **한 장짜리 주소**다. 학생이 이름·비밀번호(숫자 4자리)로 자기를 밝히고,
// 자기 반에 배정된 시험지 중에서 주차를 고른다. 그래서 반마다 링크를 따로 만들 필요가 없다.
const WA_GRADE_URL = 'https://my.sl-edu.com/grade/';
function waGradeInvite(t, who) {
  return '[SL PRIME] ' + (t.title || '주간테스트') + ' 채점\n'
    + '아래 링크에서 이름과 비밀번호를 넣고 답을 입력하면\n'
    + '점수와 틀린 문항, 틀린 것 다시 풀어볼 시험지가 바로 나옵니다.\n'
    + WA_GRADE_URL + (who ? '\n— SL PRIME ' + who + ' 선생님' : '');
}

/** '10월 2주' — 그 달의 몇 번째 월요일인지로 센다(주가 두 달에 걸치면 월요일 쪽 달이 기준). */
function waWeekName(mon) {
  const p = String(mon || '').split('-');
  if (p.length !== 3) return mon || '';
  return Number(p[1]) + '월 ' + (Math.floor((Number(p[2]) - 1) / 7) + 1) + '주';
}
/** '10/13~10/19' */
function waWeekSpan(mon) {
  const d = waParse(mon);
  if (!d) return '';
  const a = Number(mon.split('-')[1]) + '/' + Number(mon.split('-')[2]);
  d.setUTCDate(d.getUTCDate() + 6);
  return a + '~' + (d.getUTCMonth() + 1) + '/' + d.getUTCDate();
}
/** 학년도는 3월에 시작한다 → 1·2월 주는 전년도(13-weekly.js 의 wtDateTitle 과 같은 규칙). */
function waWeekTitle(mon) {
  const p = String(mon || '').split('-');
  if (p.length !== 3) return '';
  const y = Number(p[0]), m = Number(p[1]);
  return (m <= 2 ? y - 1 : y) + '학년도 ' + waWeekName(mon) + ' 주간테스트';
}
/** 고를 수 있는 주 — 다음 주부터 과거 back 주까지(최근 주가 위로). */
function waWeekOptions(back) {
  const cur = waMonday(waToday());
  const out = [];
  for (let i = 1; i >= -back; i--) out.push(waWeekShift(cur, i));
  return out;
}
/** 목록·드롭다운에 쓰는 한 줄 — 주 · 반 · 담당. 제목이 자동 제목과 같으면 중복이라 뺀다.
 *  byId 를 주면 반 이름을 보여 주고, 없으면 개수만 보여 준다. */
function waTestLabel(t, byId) {
  const out = [waWeekName(t.week_start) + ' (' + waWeekSpan(t.week_start) + ')'];
  const ids = t.class_ids || [];
  if (ids.length) {
    const names = byId ? ids.map((id) => (byId.get(id) || {}).name).filter(Boolean) : [];
    out.push(names.length ? (names.length > 2 ? names.slice(0, 2).join(', ') + ' 외 ' + (names.length - 2) : names.join(', ')) : ids.length + '개 반');
  }
  if (t.title && t.title !== waWeekTitle(t.week_start)) out.push(t.title);
  if (t.teacher) out.push(t.teacher + 'T');
  return out.join(' · ');
}
function waGradeRank(g) {
  const i = WA_GRADE_ORDER.indexOf(String(g || ''));
  return i < 0 ? 99 : i;
}
// 학교를 초·중·고로 묶는다. 이름 끝 글자로 보고, 없으면 그 학교 학생의 학년으로 본다.
/** 받침이 있으면 앞 조사, 없으면 뒤 조사. '빈칸을' · '어휘를' */
function waJosa(word, withBatchim, without) {
  const c = String(word || '').trim().slice(-1).charCodeAt(0);
  if (isNaN(c) || c < 0xac00 || c > 0xd7a3) return withBatchim;
  return ((c - 0xac00) % 28) ? withBatchim : without;
}
/** 성적 추이의 한 칸 — 점수가 낮을수록 붉다. 미응시는 '—'. */
function waHeat(v, dark, T) {
  if (v == null) return <span style={{ color: T.textFaint }}>—</span>;
  const c = v >= 85 ? ['#1a7f37', dark ? 'rgba(48,209,88,0.16)' : 'rgba(26,127,55,0.10)']
    : v >= 70 ? [T.text, dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.045)']
    : v >= 55 ? ['#b25e09', dark ? 'rgba(255,159,10,0.16)' : 'rgba(178,94,9,0.10)']
    : ['#e03131', dark ? 'rgba(255,69,58,0.16)' : 'rgba(215,0,21,0.09)'];
  return <span style={{ display: 'inline-block', minWidth: '42px', textAlign: 'center', borderRadius: '6px', padding: '3px 7px', fontWeight: 700, color: c[0], background: c[1] }}>{v}</span>;
}
/** '10월 23일 19:04' — 학생이 채점한 시각 */
function waWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
const WA_LEVELS = ['초등학교', '중학교', '고등학교', '기타'];
const WA_LEVEL_CHIP = { '초등학교': '초등', '중학교': '중등', '고등학교': '고등', '기타': '기타' };

/** 반 이름에서 **반 등급 표시**(T·T1·S1·S1-A …)를 떼어 정렬 키로 만든다.
 *  위에서부터 T → T1 → T2 → S1 → S1-A → S2 … 순으로 세운다(사장님 2026-10-23).
 *  이름 꼴이 제각각이라(원당고2 T · (강)중1-S2B1 · 중2-T1 영어-원당 · 아라중2 T반)
 *  **앞이 공백·하이픈·괄호인 T/S** 만 등급으로 본다 — '성혁T'·'파닉스' 의 T 에 걸리지 않게. */
function waClassRank(name) {
  const m = String(name || '').match(/(?:^|[ ()\-\[\]])([TS])(\d*)(-?[A-Z]*\d*)(?:반)?(?=$|[ \-])/);
  if (!m) return [9, 0, '', String(name || '')];         // 등급 표시가 없는 반(통합반·기초반…)은 맨 뒤
  const letter = m[1] === 'T' ? 0 : 1;                   // T 가 먼저, 그다음 S
  const num = m[2] ? Number(m[2]) : 0;                   // T=0 · T1=1 · S1=1 · S2=2
  const tail = (m[3] || '').replace(/-/g, '');           // '' < '1' < 'A' … (없는 것이 먼저)
  return [letter, num, (tail ? (/^\d/.test(tail) ? '1' : '2') + tail : '0'), String(name || '')];
}
function waClassCmp(a, b) {
  const x = waClassRank(a.name), y = waClassRank(b.name);
  for (let i = 0; i < 3; i++) {
    if (x[i] < y[i]) return -1;
    if (x[i] > y[i]) return 1;
  }
  return String(a.name).localeCompare(String(b.name), 'ko');
}
function waSchoolLevel(name, grades) {
  const c = String(name || '').trim().slice(-1);
  if (c === '초') return '초등학교';
  if (c === '중') return '중학교';
  if (c === '고') return '고등학교';
  const g = String((grades && grades[0] && grades[0].grade) || '').slice(0, 1);
  return g === '초' ? '초등학교' : g === '중' ? '중학교' : g === '고' ? '고등학교' : '기타';
}
/** 주간테스트는 영어 시험이므로 영어 반만 보여 준다. */
function waIsEnglish(c) {
  return !!c && !c.deleted && (c.subjects || []).indexOf('영어') >= 0;
}
/** 점수가 있는 줄만 모아 평균·최고·최저를 낸다(미응시는 빼고 센다). */
/** 한 반 안에서도 수준별로 시험지를 다르게 낸다 — **제외한 학생은 아예 안 센다.**
 *  미응시가 아니라 '이 시험지 대상이 아님' 이라, 응시에도 미응시에도 들어가면 안 된다. */
function waStats(rows) {
  const on = rows.filter((r) => !r.excluded);
  const ns = on.map((r) => (r.score === '' || r.score == null ? null : Number(r.score)))
    .filter((n) => n != null && !isNaN(n));
  const out = { n: 0, avg: null, hi: null, lo: null, blank: on.length, total: on.length, off: rows.length - on.length };
  if (!ns.length) return out;
  const sum = ns.reduce((a, b) => a + b, 0);
  return Object.assign(out, { n: ns.length, avg: Math.round((sum / ns.length) * 10) / 10, hi: Math.max.apply(null, ns), lo: Math.min.apply(null, ns), blank: on.length - ns.length });
}

/** 재원 학생 + 영어 반으로 학교 → 학년 → 반 트리를 만든다.
 *  반 하나에 학교·학년이 섞여 있으면 그 조합마다 나온다(어느 쪽에서 눌러도 반 전체가 열린다). */
function waTree(students, classes, onlyMine, me) {
  const byId = new Map(classes.map((c) => [c.c_id, c]));
  const mine = (c) => (c.teachers || []).indexOf(me) >= 0;
  const t = new Map();                       // 학교 → 학년 → Map(c_id → 반)
  students.forEach((s) => {
    (s.class_ids || []).forEach((id) => {
      const c = byId.get(id);
      if (!waIsEnglish(c)) return;
      if (onlyMine && !mine(c)) return;
      const sc = s.school || '(학교 미기재)';
      if (!t.has(sc)) t.set(sc, new Map());
      const g = t.get(sc);
      const gr = s.grade || '(학년 미기재)';
      if (!g.has(gr)) g.set(gr, new Map());
      g.get(gr).set(id, c);
    });
  });
  const schools = [...t.entries()].map(([name, g]) => ({
    name,
    grades: [...g.entries()].map(([gr, cs]) => ({ grade: gr, classes: [...cs.values()].sort(waClassCmp) }))
      .sort((a, b) => waGradeRank(a.grade) - waGradeRank(b.grade)),
  }));
  // 인원 많은 학교부터
  const headcount = (s) => s.grades.reduce((n, g) => n + g.classes.length, 0);
  return schools.sort((a, b) => headcount(b) - headcount(a) || a.name.localeCompare(b.name, 'ko'));
}

function WeeklyAdminApp({ dark, userName, onHome }) {
  const T = THEME(dark);
  const PC = '#0066cc';
  const [aca, setAca] = useState(null);         // { students, classes } | null = 로딩
  const [acaErr, setAcaErr] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [level, setLevel] = useState(null);      // 고른 급(초등학교·중학교·고등학교·기타). null = 아직 안 고름 → 첫 급
  const [openSchool, setOpenSchool] = useState(null);
  const [openGrade, setOpenGrade] = useState(null);   // '학교|학년'
  const [classIds, setClassIds] = useState([]);   // 반 **중복 선택**(사장님 2026-10-23) — 여러 반 성적을 한 표에서 본다
  const [sortKey, setSortKey] = useState('name');  // 머리 칸을 눌러 정렬 — 'name' | 'score' | 'wrong'
  const [sortDir, setSortDir] = useState(1);       // 1 오름 · -1 내림
  const [tab, setTab] = useState('scores');        // 'scores' | 'trend' | 'types'
  const [menu, setMenu] = useState(false);         // ⋯ 메뉴
  const [editCell, setEditCell] = useState('');    // 점수를 고치는 중인 줄 '반|학생'
  const [memoOf, setMemoOf] = useState(null);      // 메모를 여는 줄
  const [q, setQ] = useState('');                  // 왼쪽 반 검색
  const [hist, setHist] = useState([]);            // 그 반에 걸린 시험지 전부의 성적(추이·유형용)
  const [saveState, setSaveState] = useState('');  // '' | 'saving' | 'saved' | 오류 글
  const savedAt = useRef('');                      // 마지막으로 저장한 시각
  const pending = useRef({});                      // 아직 안 보낸 줄 '반|학생'
  const saveTimer = useRef(null);
  const scoresRef = useRef({});                    // 보낼 때 **그 순간의** 값을 읽는다
  const rowsRef = useRef([]);
  const testRef = useRef(null);
  const [wrongOf, setWrongOf] = useState(null);   // 틀린 문항을 펼쳐 볼 학생 줄
  const [itemPop, setItemPop] = useState(null);   // 문항 하나를 양식 그대로 띄우는 팝업 { no, it, answer, type, mine?, student?, who? }
  const plCache = useRef({});                     // 시험지 id → payload(문항 전체). 한 번 읽으면 다시 안 읽는다
  const [trash, setTrash] = useState(null);       // 휴지통 목록(null = 안 열림)

  const [tests, setTests] = useState(null);
  const [testId, setTestId] = useState(null);
  const [weekSel, setWeekSel] = useState(null);   // 고른 주(월요일). 한 주에 시험지가 여럿이면 그다음에 시험지를 고른다
  const [scores, setScores] = useState({});     // '반이름|학생' → { id, score, note }
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [editTest, setEditTest] = useState(null);
  const [allCls, setAllCls] = useState(false);   // 등록 창에서 담당 반 말고 전체 반까지 고를지
  const [editErr, setEditErr] = useState('');    // 등록 창 안에서 난 오류(페이지 띠는 모달에 가려 안 보인다)
  const [hwpx, setHwpx] = useState(null);        // 읽어들인 시험지 { name, head, items, paras } | 'busy'
  const [ai, setAi] = useState(null);            // AI 검사 'busy' | { step } | { done } | { error }
  const [oldHwp, setOldHwp] = useState('');      // 옛 .hwp 를 넣었을 때 보여 줄 안내(파일 이름)
  const [ansFile, setAnsFile] = useState(null);  // 따로 올린 답지 'busy' | { name, matched } | { error }
  const [preview, setPreview] = useState(null);  // 양식으로 조립해 보여 줄 시험지 { title, teacher, range, dateTitle, items }

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  // ── 명단(읽기 전용) ──────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      SB.from('aca_student').select('s_id,name,grade,state,school,class_ids').eq('state', '재원').limit(2000),
      SB.from('aca_class').select('c_id,name,subjects,teachers,deleted,timetable_text').limit(2000),
    ]).then(([a, b]) => {
      if (a.error || b.error) { setAcaErr(waErrText(a.error || b.error)); setAca({ students: [], classes: [] }); return; }
      setAca({ students: a.data || [], classes: b.data || [] });
    });
  }, []);

  // ── 시험 ─────────────────────────────────────────────────────────
  const loadTests = () => SB.from('weekly_tests')
    .select('id,title,week_start,teacher,range_text,item_count,owner_name,class_ids')
    .order('week_start', { ascending: false })
    .then(({ data, error }) => {
      if (error) { setErr(waErrText(error)); setTests([]); return; }
      setErr(''); setTests(data || []);
    });
  useEffect(() => { loadTests(); }, []);
  // 창을 떠나거나 다른 시험으로 옮길 때 아직 안 보낸 줄을 마저 보낸다.
  useEffect(() => {
    const go = () => flushSave();
    window.addEventListener('beforeunload', go);
    window.addEventListener('blur', go);
    return () => { window.removeEventListener('beforeunload', go); window.removeEventListener('blur', go); go(); };
  }, []);

  // 학생이 채점 링크로 넣은 점수는 이 화면 모르게 들어온다 — 그래서 손으로도 다시 읽을 수 있어야 한다.
  const loadScores = (say1) => {
    if (!testId) { setScores({}); return; }
    SB.from('weekly_scores').select('id,klass,student,score,note,wrong,graded_at,excluded').eq('test_id', testId)
      .then(({ data, error }) => {
        if (error) { setErr(waErrText(error)); setScores({}); return; }
        const m = {};
        (data || []).forEach((r) => { m[r.klass + '|' + r.student] = { id: r.id, score: r.score == null ? '' : String(r.score), note: r.note || '', wrong: r.wrong || null, graded_at: r.graded_at || null, excluded: !!r.excluded }; });
        setScores(m);
        if (say1) say1((data || []).length + '명분을 다시 읽었습니다');
      });
  };
  useEffect(() => { loadScores(); }, [testId]);

  const classes = (aca && aca.classes) || [];
  const students = (aca && aca.students) || [];
  const tree = aca ? waTree(students, classes, onlyMine, userName) : [];
  // 초등·중학·고등으로 나눠 보여 준다(섞여 있으면 어느 학교가 어느 급인지 안 보인다)
  const sections = WA_LEVELS
    .map((lv) => ({ level: lv, schools: tree.filter((s) => waSchoolLevel(s.name, s.grades) === lv) }))
    .filter((s) => s.schools.length);
  // 캡슐로 급을 하나 고른다. 안 골랐거나 고른 급이 비면 첫 급으로 떨어진다.
  const curLevel = (level && sections.filter((x) => x.level === level).length) ? level : (sections[0] || {}).level;
  const shownSchools = (sections.filter((x) => x.level === curLevel)[0] || { schools: [] }).schools;
  // 고른 반들(왼쪽에서 누른 순서가 아니라 반 이름 순으로 세운다)
  const selCls = classes.filter((c) => classIds.indexOf(c.c_id) >= 0)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  const cls = selCls[0] || null;              // 시험지 등록 창의 기본값 등 '대표 반'이 필요한 자리
  // 고른 반들의 재원 학생. 두 반을 다 듣는 학생은 반마다 한 줄씩 선다 —
  // 성적 줄도 (시험, 반, 학생) 하나당 하나라 그렇게 보는 것이 맞다.
  const roster = [];
  selCls.forEach((c) => {
    students.filter((s) => (s.class_ids || []).indexOf(c.c_id) >= 0)
      .sort((a, b) => waGradeRank(a.grade) - waGradeRank(b.grade) || String(a.name).localeCompare(String(b.name), 'ko'))
      .forEach((s) => roster.push({ stu: s, klass: c.name }));
  });
  const toggleClass = (id) => setClassIds((cur) => {
    const next = cur.indexOf(id) >= 0 ? cur.filter((x) => x !== id) : cur.concat(id);
    setTestId(null); setWeekSel(null);        // 반이 바뀌면 고른 시험·주를 푼다 — 그 반 것이 아닐 수 있다
    return next;
  });
  const test = (tests || []).find((t) => t.id === testId) || null;
  scoresRef.current = scores; testRef.current = test;
  // 한 주에 몇 개든 등록할 수 있다(강사·반이 다르면 같은 주에 여러 시험지가 나온다).
  const weekOpts = waWeekOptions(16);
  const thisWeek = waMonday(waToday());
  // 주 → 그 주에 **이 반들**로 이미 등록된 시험지 수(고를 때 참고만).
  // 전체를 세면 다른 학년 것까지 들어가 뜬금없는 숫자가 된다(사장님 2026-10-25).
  const weekCount = {};
  const editCls = (editTest && editTest.class_ids) || [];
  (tests || []).forEach((t) => {
    if (editTest && editTest.id && editTest.id === t.id) return;   // 고치는 중인 그 시험지는 빼고 센다
    if (editCls.length && !(t.class_ids || []).some((c) => editCls.indexOf(c) >= 0)) return;
    weekCount[t.week_start] = (weekCount[t.week_start] || 0) + 1;
  });
  const clsById = new Map(classes.map((c) => [c.c_id, c]));
  // 반을 고르면 **그 반에 배정된 시험지만** 보여 준다 — 반이 늘면 목록이 금세 길어진다.
  const shownTests = (tests || []).filter((t) => !selCls.length
    || selCls.some((c) => (t.class_ids || []).indexOf(c.c_id) >= 0));
  // 고른 반 가운데 **이 시험지가 걸린 반**만 점수표에 올린다.
  const testCls = test ? selCls.filter((c) => (test.class_ids || []).indexOf(c.c_id) >= 0) : selCls;
  const offCls = test ? selCls.filter((c) => (test.class_ids || []).indexOf(c.c_id) < 0) : [];
  const onNames = testCls.map((c) => c.name);
  const rows0 = roster.filter((r) => !test || onNames.indexOf(r.klass) >= 0).map((r) => Object.assign(
    { student: r.stu.name, s_id: r.stu.s_id, grade: r.stu.grade, school: r.stu.school, klass: r.klass },
    scores[r.klass + '|' + r.stu.name] || { id: null, score: '', score0: '', note: '', wrong: null, excluded: false }));
  // 머리 칸을 눌러 정렬한다(2026-10-24). 미응시는 어느 쪽으로 정렬하든 **언제나 맨 아래**다 —
  // 0점과 안 본 것은 다른 일이라 섞이면 안 된다.
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  const rows = sortKey === 'name' ? rows0 : rows0.slice().sort((a, b) => {
    const x = sortKey === 'wrong' ? (Array.isArray(a.wrong) ? a.wrong.length : null) : num(a.score);
    const y = sortKey === 'wrong' ? (Array.isArray(b.wrong) ? b.wrong.length : null) : num(b.score);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x - y) * sortDir;
  });
  rowsRef.current = rows;
  const sortHead = (k) => { if (sortKey === k) setSortDir(-sortDir); else { setSortKey(k); setSortDir(k === 'name' ? 1 : -1); } };
  const sortMark = (k) => (sortKey === k ? (sortDir > 0 ? ' ▲' : ' ▼') : '');
  const st = waStats(rows);
  /** 바뀐 줄을 서버에 보낸다. 줄 단위로만 보내므로 남의 줄을 덮어쓰지 않는다. */
  const flushSave = () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const t = testRef.current;
    const keys = Object.keys(pending.current);
    pending.current = {};
    if (!t || !keys.length) return;
    const byKey = {};
    (rowsRef.current || []).forEach((r) => { byKey[r.klass + '|' + r.student] = r; });
    const body = keys.map((key) => {
      const r = byKey[key];
      if (!r) return null;
      const v = scoresRef.current[key] || {};
      const sc = v.score == null ? '' : String(v.score);
      return {
        test_id: t.id, klass: r.klass, student: r.student, s_id: r.s_id,
        score: sc === '' ? null : Number(sc), note: v.note || null,
        excluded: !!v.excluded, updated_at: new Date().toISOString(),
      };
    }).filter(Boolean).filter((x) => !(x.score === null && !x.note && !x.excluded && !byKey[x.klass + '|' + x.student].id));
    if (!body.length) { setSaveState('saved'); return; }
    setSaveState('saving');
    SB.from('weekly_scores').upsert(body, { onConflict: 'test_id,klass,student' }).then(({ error }) => {
      if (error) { setSaveState(waErrText(error)); return; }
      savedAt.current = waWhen(new Date().toISOString());
      setSaveState('saved');
      loadScores();                 // id 와 서버가 채운 값을 받아 온다
    });
  };

  const setScore = (klass, name, k, v) => {
    const key = klass + '|' + name;
    setScores((m) => Object.assign({}, m, { [key]: Object.assign({ id: null, score: '', note: '', wrong: null, excluded: false }, m[key], { [k]: v }) }));
    // 저장 버튼 없이 **바뀔 때마다 바로 저장**한다(사장님 2026-10-25).
    // 글자는 치는 중에 매번 보내지 않게 잠깐 모아서 보낸다.
    pending.current[key] = true;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 600);
  };
  /** 이 시험지 대상에서 빼고 넣는다. 뺀 학생은 평균·응시에서 빠지고 채점 링크에도 그 시험지가 안 뜬다. */
  const toggleExcl = (r) => setScore(r.klass, r.student, 'excluded', !r.excluded);

  // ── 화면 세 갈래(2026-10-24 사장님) ──────────────────────────────
  // 선생님이 하는 일이 '입력'에서 '보고 판단하기'로 바뀌었다(학생이 링크로 채점한다).
  // 그래서 반 하나를 대시보드로 세우고 탭 셋으로 가른다:
  //   이번 시험 · 성적 추이(주차별) · 유형 분석(무엇을 더 가르칠지)
  // 추이·유형은 이번 시험 하나로는 못 만든다 — 그 반에 걸린 **시험지 전부**의 성적을 따로 읽는다(hist).
  const shownIds = shownTests.map((t) => t.id);
  const histKey = shownIds.slice().sort().join(',');
  useEffect(() => {
    if (!shownIds.length) { setHist([]); return; }
    SB.from('weekly_scores').select('test_id,klass,student,s_id,score,wrong,graded_at,excluded')
      .in('test_id', shownIds)
      .then(({ data, error }) => { if (error) { setErr(waErrText(error)); setHist([]); return; } setHist(data || []); });
  }, [histKey]);

  // 주차 칩 — 오래된 것부터. 한 주에 여러 시험지가 있으면 각각 칩이 된다.
  const weekTests = shownTests.slice().sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)));
  // 주차 칩은 **주 하나에 칩 하나**다 — 예전엔 시험지마다 칩이라 한 주에 둘이면 '10월 4주' 가 두 번 떴다.
  const weeks = weekTests.map((t) => t.week_start).filter((w, i, a) => a.indexOf(w) === i);
  // 다른 곳(등록 직후 등)에서 시험지가 골라지면 그 주도 따라 고른다
  const curWeek = (testId && (weekTests.find((t) => t.id === testId) || {}).week_start) || weekSel;
  const inWeek = curWeek ? weekTests.filter((t) => t.week_start === curWeek) : [];
  /** 고른 시험지에 안 걸린 반이 같은 주에 따로 본 시험지(없으면 undefined) */
  const otherOf = (c) => inWeek.find((t) => t.id !== testId && (t.class_ids || []).indexOf(c.c_id) >= 0);
  const pickWeek = (w) => {
    if (w === curWeek) { setWeekSel(null); setTestId(null); return; }
    const ts = weekTests.filter((t) => t.week_start === w);
    setWeekSel(w);
    setTestId(ts.length === 1 ? ts[0].id : null);   // 하나뿐이면 바로 연다
  };
  /** 같은 주의 시험지끼리 가를 이름. 자동 제목이면 다 같아서 범위·교사·반으로 가른다. */
  const testLabel = (t) => {
    if (t.title && t.title !== waWeekTitle(t.week_start)) return t.title;
    if (t.range_text) return t.range_text;
    const cn = (t.class_ids || []).map((id) => (clsById.get(id) || {}).name).filter(Boolean);
    return (t.teacher ? t.teacher + 'T' : '') + (cn.length ? (t.teacher ? ' · ' : '') + cn.join(', ') : '') || '시험지';
  };
  const curIdx = weekTests.findIndex((t) => t.id === testId);
  const prevTest = curIdx > 0 ? weekTests[curIdx - 1] : null;
  /** 그 시험의 (고른 반) 평균. 없으면 null. */
  const avgOf = (tid) => {
    const ns = hist.filter((h) => h.test_id === tid && !h.excluded && selCls.some((c) => c.name === h.klass))
      .map((h) => (h.score == null ? null : Number(h.score))).filter((n) => n != null && !isNaN(n));
    return ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : null;
  };
  const prevAvg = prevTest ? avgOf(prevTest.id) : null;
  const missNames = rows.filter((r) => !r.excluded && (r.score === '' || r.score == null)).map((r) => r.student);

  // 성적 추이 — 학생 × 주차
  const histAt = {};   // 'test|반|학생' → 점수
  hist.forEach((h) => { if (!h.excluded) histAt[h.test_id + '|' + h.klass + '|' + h.student] = h.score == null ? null : Number(h.score); });
  const trendRows = roster.filter((r) => !test || onNames.indexOf(r.klass) >= 0).map((r) => {
    const vs = weekTests.map((t) => {
      const v = histAt[t.id + '|' + r.klass + '|' + r.stu.name];
      return v == null || isNaN(v) ? null : v;
    });
    const ok = vs.filter((v) => v != null);
    return { klass: r.klass, student: r.stu.name, vs: vs, avg: ok.length ? Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10 : null };
  });
  const weekAvg = weekTests.map((t) => avgOf(t.id));
  const weekTook = weekTests.map((t) => hist.filter((h) => h.test_id === t.id && !h.excluded && selCls.some((c) => c.name === h.klass) && h.score != null).length);

  // 유형 분석 — 틀린 문항의 유형을 모은다(채점 링크로 들어온 줄만 유형을 갖는다)
  const typeCount = {}; let wrongTotal = 0;
  const byStudentType = {};   // '학생|유형' → 횟수
  hist.forEach((h) => {
    if (h.excluded || !selCls.some((c) => c.name === h.klass)) return;
    (Array.isArray(h.wrong) ? h.wrong : []).forEach((w) => {
      const k = w.type || '기타';
      typeCount[k] = (typeCount[k] || 0) + 1; wrongTotal++;
      const sk = h.student + '|' + k;
      byStudentType[sk] = (byStudentType[sk] || 0) + 1;
    });
  });
  const itemTotal = hist.filter((h) => selCls.some((c) => c.name === h.klass) && h.graded_at)
    .reduce((a, h) => a + (weekTests.find((t) => t.id === h.test_id) || {}).item_count || 0, 0);
  const typeRows = Object.keys(typeCount).map((k) => ({ type: k, n: typeCount[k] }))
    .sort((a, b) => b.n - a.n);
  const topType = typeRows.length ? typeRows[0].type : '';
  const topTypeStudents = Object.keys(byStudentType).filter((k) => k.split('|')[1] === topType)
    .map((k) => ({ student: k.split('|')[0], n: byStudentType[k] }))
    .sort((a, b) => b.n - a.n).slice(0, 6);
  // 떨어지고 있는 학생 — 처음 본 시험과 마지막 시험의 차이
  const dropping = trendRows.map((r) => {
    const ok = r.vs.map((v, i) => ({ v: v, i: i })).filter((x) => x.v != null);
    if (ok.length < 2) return null;
    return { student: r.student, d: Math.round((ok[ok.length - 1].v - ok[0].v) * 10) / 10 };
  }).filter((x) => x && x.d < 0).sort((a, b) => a.d - b.d).slice(0, 6);

  // 이번 시험에서 많이 틀린 문항 — 고른 반의 점수표 줄 가운데 **채점 링크로 채점한 학생**만 센다
  // (선생님이 점수만 적은 줄은 어느 문항을 틀렸는지 모른다). 대상에서 뺀 학생은 안 센다.
  const gradedRows = rows.filter((r) => !r.excluded && r.graded_at && Array.isArray(r.wrong));
  const missBy = {};
  gradedRows.forEach((r) => r.wrong.forEach((w) => {
    const k = Number(w.no);
    if (!missBy[k]) missBy[k] = { no: k, type: w.type || '', n: 0, who: [] };
    missBy[k].n++; missBy[k].who.push(r.student);
  }));
  const missRows = Object.keys(missBy).map((k) => missBy[k]).sort((a, b) => b.n - a.n || a.no - b.no);

  // 주를 바꾸면 제목도 따라간다 — 선생님이 직접 고친 제목은 그대로 둔다.
  const setWeek = (w) => setEditTest((f) => Object.assign({}, f, {
    week_start: w,
    weekPicked: true,          // 직접 고른 주차는 파일을 올려도 지킨다
    title: (!f.title || f.title === waWeekTitle(f.week_start)) ? waWeekTitle(w) : f.title,
  }));

  /** 시험지의 payload(문항 전체). 문항 팝업이 번호를 누를 때마다 쓰므로 시험지마다 한 번만 읽는다. */
  const loadPayload = (tid) => {
    if (plCache.current[tid]) return Promise.resolve(plCache.current[tid]);
    return SB.from('weekly_tests').select('payload').eq('id', tid).single().then(({ data, error }) => {
      if (error) throw new Error(waErrText(error));
      plCache.current[tid] = (data && data.payload) || null;
      return plCache.current[tid];
    });
  };
  /** 문항 하나를 평가원 양식 그대로 팝업에 띄운다(2026-10-29 사장님 — 틀린 문항 번호를 누르면 바로 그 문항).
   *  문항 하나만 hwpxToItems 에 넘기면 묶음([20~21])의 둘째 문항이라도 **그 문항이 머리가 되어** 지시문·지문이 같이 붙는다 —
   *  시험지에서는 첫 문항에만 붙지만, 혼자 띄울 때는 지문이 없으면 읽을 수 없다. */
  const openItem = (no, extra) => {
    if (!test) return;
    loadPayload(test.id).then((pl) => {
      const src = ((pl && pl.items) || []).find((x) => Number(x.no) === Number(no));
      if (!src) return say(no + '번 문항을 시험지에서 찾지 못했습니다');
      const it = hwpxToItems({ items: [src] })[0];
      setItemPop(Object.assign({ no: Number(no), it: it, answer: src.answer, type: src.aiType || hxTypeLabel(src.prompt) || '' }, extra || {}));
    }).catch((e) => setErr(e.message));
  };

  /** 보관된 시험지(payload)를 평가원 양식으로 펼친다. payload 가 없으면 알려 준다. */
  // auto = '시험지 다운로드' — 양식을 그려 두고 곧바로 PDF 로 저장한 뒤 원래 화면으로 돌아온다(사장님 2026-10-26:
  // 시험지 보기 → 다운로드 두 번 누르는 게 번거롭다).
  const openPreview = (auto) => {
    if (!test) return;
    setBusy(true);
    SB.from('weekly_tests').select('payload').eq('id', test.id).single().then(({ data, error }) => {
      setBusy(false);
      if (error) return setErr(waErrText(error));
      const pl = data && data.payload;
      if (!pl || !pl.items || !pl.items.length) return say('이 시험지에는 문항이 없습니다 — .hwpx 를 올려 다시 저장하세요');
      setPreview({
        title: test.title,
        teacher: test.teacher || (pl.head && pl.head.teacher) || '',
        range: test.range_text || '',
        dateTitle: waWeekTitle(test.week_start),
        items: hwpxToItems(pl),
        auto: auto === true,
      });
    });
  };

  // 답지가 합본이 아닌 시험지를 위해 정답만 따로 받는다.
  const readAnswers = (file) => {
    if (!file || !hwpx || hwpx === 'busy') return;
    if (!/\.hwpx$/i.test(file.name)) {
      return setAnsFile({ error: '답지도 .hwpx 만 받습니다. 한글에서 「파일 → 다른 이름으로 저장 → 한글 표준 (*.hwpx)」로 저장해 주세요.' });
    }
    setAnsFile('busy');
    file.arrayBuffer()
      .then((ab) => hwpxAnswersOnly(ab))
      .then((ans) => {
        let matched = 0;
        hwpx.items.forEach((it) => {
          const a = ans[it.no];
          if (!a) return;
          it.answer = a.answer; it.explain = a.explain || it.explain; matched++;
        });
        setAnsFile({ name: file.name, matched: matched, found: Object.keys(ans).length });
        setHwpx((h) => (h && h !== 'busy') ? Object.assign({}, h, { items: h.items.slice() }) : h);
      })
      .catch((e) => setAnsFile({ error: String((e && e.message) || e) }));
  };

  // 규칙으로 쪼갠 결과를 Claude 가 대조하고, 틀린 덩어리만 다시 쪼갠다(18-hwpxai.js).
  // 돌리지 않아도 등록은 된다 — 누를 때만 호출한다(돈이 든다).
  const startAi = (h) => {
    if (!h || h === 'busy') return;
    setAi({ step: '준비 중…' });
    hwpxAiReview(h, (m) => setAi({ step: m }))
      .then((r) => {
        setAi({ done: r });
        // 고친 문항이 있으면 요약(문항 수·정답 수)도 다시 그려야 한다
        setHwpx((h) => (h && h !== 'busy') ? Object.assign({}, h, { items: h.items.slice() }) : h);
      })
      .catch((e) => setAi({ error: String((e && e.message) || e) }));
  };
  const runAi = () => startAi(hwpx);

  // 등록 창에 올릴 반 — 기본은 담당 강사의 영어 반, 이미 고른 반은 담당이 아니어도 남긴다.
  const pickFor = (teacher) => classes.filter((c) => waIsEnglish(c)
    && (allCls || (c.teachers || []).indexOf(String(teacher || '').trim()) >= 0
        || (editTest && (editTest.class_ids || []).indexOf(c.c_id) >= 0)))
    .sort(waClassCmp);
  const pickClasses = editTest ? pickFor(editTest.teacher || userName) : [];

  // 시험지 .hwpx 를 읽어 문항으로 쪼갠다(17-hwpx.js). 실패해도 등록 자체는 막지 않는다.
  const readHwpx = (file) => {
    if (!file) return;
    // .hwpx 만 받는다(2026-10-23 사장님). 이름으로 한 번, 알맹이로 또 한 번 거른다.
    if (!/\.hwpx$/i.test(file.name)) { setHwpx(null); setAi(null); setAnsFile(null); setEditErr(''); return setOldHwp(file.name); }
    setOldHwp('');
    setHwpx('busy'); setEditErr(''); setAi(null); setAnsFile(null);
    file.arrayBuffer()
      .then((ab) => hwpxParse(ab))
      .then((r) => {
        const h = { name: file.name, head: r.head, items: r.items, paras: r.paras };
        setHwpx(h);
        startAi(h);                 // 올리면 바로 대조한다 — 누를 필요 없다
        setEditTest((f) => {
          // 선생님이 주차를 직접 고르셨으면 파일의 실시일로 덮어쓰지 않는다 — 제목과 같은 규칙.
          const wk = (!f.weekPicked && r.head.date) ? waMonday(r.head.date) : f.week_start;
          return Object.assign({}, f, {
            item_count: String(r.items.length),
            week_start: wk,
            // 주가 바뀌면 자동 제목도 그 주로. 직접 고친 제목은 건드리지 않는다.
            title: (!f.title || f.title === waWeekTitle(f.week_start)) ? waWeekTitle(wk) : f.title,
          });
        });
      })
      .catch((e) => {
        setHwpx(null);
        const m = String((e && e.message) || e);
        // 이름만 .hwpx 이고 알맹이는 옛 .hwp 인 경우도 같은 안내로 보낸다
        // 변환 방법을 담은 오류는 빨간 줄 말고 안내 상자로 보낸다(이름만 .hwpx 로 바꾼 파일 포함)
        if (m.indexOf('다른 이름으로 저장') >= 0) return setOldHwp(file.name);
        setEditErr('시험지를 읽지 못했습니다 — ' + m);
      });
  };

  // 등록 창에서 반을 켜고 끈다(중복 선택).
  const toggleCls = (id) => setEditTest((f) => {
    const cur = f.class_ids || [];
    return Object.assign({}, f, { class_ids: cur.indexOf(id) >= 0 ? cur.filter((x) => x !== id) : cur.concat(id) });
  });

  const saveTest = () => {
    const f = editTest;
    // 새로 등록할 때는 시험지 파일이 반드시 있어야 한다 — 문항 없는 껍데기가 쌓이면
    // '시험지 보기'도 채점 링크도 쓸 수 없다. (고치기는 이미 들어 있는 문항을 그대로 둔다)
    if (!f.id && (!hwpx || hwpx === 'busy')) return setEditErr('시험지 파일(.hwpx)을 먼저 넣어 주세요. 문항이 없으면 등록할 수 없습니다.');
    if (!f.title.trim()) return setEditErr('시험 이름을 적어 주세요.');
    if (!(f.class_ids || []).length) return setEditErr('이 시험지를 보는 반을 하나 이상 고르세요.');
    setEditErr(''); setBusy(true);
    const body = {
      title: f.title.trim(), week_start: f.week_start, teacher: f.teacher.trim() || null,
      range_text: f.range_text.trim() || null, item_count: Number(f.item_count) || 0,
      class_ids: f.class_ids,
    };
    // 읽어들인 시험지가 있으면 문항째로 담는다 — 보관함에서 다시 열어 인쇄할 것이다
    if (hwpx && hwpx !== 'busy') body.payload = { source: 'hwpx', file: hwpx.name, head: hwpx.head, items: hwpx.items };
    const q = f.id ? SB.from('weekly_tests').update(body).eq('id', f.id)
      : SB.from('weekly_tests').insert(Object.assign({ owner_name: userName }, body)).select('id').single();
    q.then(({ data, error }) => {
      setBusy(false);
      if (error) { setEditErr(waErrText(error)); setErr(waErrText(error)); return; }   // 창을 열어 둔 채 창 안에 띄운다
      setErr(''); setEditTest(null);
      loadTests().then(() => { if (!f.id && data) setTestId(data.id); });
      say(f.id ? '고쳤습니다' : '시험을 만들었습니다');
    });
  };
  // ── 휴지통 ───────────────────────────────────────────────────────
  // 시험지를 지우면 성적까지 함께 사라진다. 지우기 직전에 통째로 베껴 두고(트리거)
  // 여기서 되돌린다. 되돌리기는 관리자만 — 서버가 다시 확인한다.
  const openTrash = () => {
    setBusy(true);
    SB.from('weekly_trash').select('id,test_id,deleted_at,deleted_by,test,scores')
      .order('deleted_at', { ascending: false }).limit(50)
      .then(({ data, error }) => {
        setBusy(false);
        if (error) return setErr(waErrText(error));
        setErr(''); setTrash(data || []);
      });
  };
  const restore = (row) => {
    const t = row.test || {};
    const n = Array.isArray(row.scores) ? row.scores.length : 0;
    if (!window.confirm((t.title || '시험지') + '\n이 시험과 성적 ' + n + '줄을 되돌립니다.')) return;
    setBusy(true);
    SB.rpc('weekly_restore', { p_trash: row.id }).then(({ data, error }) => {
      setBusy(false);
      if (error) return setErr(waErrText(error));
      setErr(''); say('되돌렸습니다 — 성적 ' + ((data && data.scores) || 0) + '줄');
      setTrash((cur) => (cur || []).filter((x) => x.id !== row.id));
      loadTests();
    });
  };

  const delTest = () => {
    if (!test || !window.confirm(test.title + '\n이 시험과 성적을 모두 지웁니다. 되돌릴 수 없습니다.')) return;
    SB.from('weekly_tests').delete().eq('id', test.id).then(({ error }) => {
      if (error) return setErr(waErrText(error));
      setTestId(null); loadTests(); say('지웠습니다');
    });
  };

  const inputS = {
    border: '1px solid ' + T.divider, borderRadius: '8px', padding: '7px 10px', fontSize: '13px',
    fontFamily: 'inherit', background: dark ? 'rgba(255,255,255,0.04)' : '#fff', color: T.text, outline: 'none',
  };
  const btnS = (primary) => ({
    border: primary ? 'none' : '1px solid ' + T.divider, borderRadius: '9999px', cursor: 'pointer',
    padding: '7px 16px', fontSize: '13px', fontFamily: 'inherit', fontWeight: primary ? 600 : 400,
    background: primary ? PC : 'transparent', color: primary ? '#fff' : T.text,
  });
  // 펼치는 줄(학교·학년)은 상자 + 화살표로 그린다 — 글씨만 있으면 누르는 줄인지 안 보인다
  const waBoxBtn = (open, small) => ({
    display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left',
    cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box',
    fontSize: small ? '13px' : '13.5px', padding: small ? '7px 10px' : '9px 11px',
    borderRadius: '10px', transition: 'background 0.14s, border-color 0.14s',
    border: '1px solid ' + (open ? (dark ? 'rgba(0,102,204,0.55)' : 'rgba(0,102,204,0.35)') : T.divider),
    background: open ? (dark ? 'rgba(0,102,204,0.18)' : 'rgba(0,102,204,0.07)')
      : (dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)'),
    color: open ? PC : T.text,
  });
  const waCaret = (open) => ({
    flex: 'none', width: '14px', textAlign: 'center', fontSize: '13px', lineHeight: '13px',
    color: open ? PC : T.textFaint, display: 'inline-block',
    transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.16s',
  });
  const rowBtn = (on, pad) => ({
    display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', borderRadius: '10px', padding: pad,
    background: on ? (dark ? 'rgba(0,102,204,0.22)' : 'rgba(0,102,204,0.10)') : 'transparent',
    color: on ? PC : T.text, fontSize: '13.5px',
  });

  /** 지금 펼친 시험지를 PDF 로 — 데스크톱은 저장 창, 웹은 브라우저 인쇄(→ PDF 로 저장) */
  const savePaper = () => {
    if (!preview) return Promise.resolve();
    const name = (preview.title || '주간테스트').replace(/[\\/:*?"<>|]/g, ' ').trim();
    if (window.desktopSavePDF) return window.desktopSavePDF(name + '.pdf');
    const prev = document.title; document.title = name;
    window.print();
    document.title = prev;
    return Promise.resolve();
  };
  useEffect(() => {
    if (!preview || !preview.auto) return;
    let gone = false;
    // 시트는 화면 밖에서 문항 높이를 재고 나서 쪽을 나눈다 — 글꼴이 다 오고 시트 수가 멈출 때까지 기다린다.
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      try { await document.fonts.ready; } catch (e) { /* 없어도 된다 */ }
      let last = -1;
      for (let i = 0; i < 40 && !gone; i++) {
        await wait(150);
        const n = document.querySelectorAll('[data-sheet]').length;
        if (n && n === last) break;
        last = n;
      }
      if (gone) return;
      await savePaper();
      if (!gone) setPreview(null);
    })();
    return () => { gone = true; };
  }, [preview]);

  // ── 시험지 보기(평가원 양식) ─────────────────────────────────────
  // 인쇄 CSS 가 [data-sheet] 를 A4 쪽으로 만든다 — 그래서 이 화면에서는 시트 말고는 아무것도 그리지 않고,
  // 도구 막대에는 data-noprint 를 붙여 인쇄에서 뺀다. 표지·백지는 WeeklyTestSheets 가 알아서 넣는다.
  if (preview) {
    return (
      <div data-main="" style={{ minHeight: '100vh', background: '#f5f5f7' }}>
        <nav data-noprint="" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: T.navBg, borderBottom: '1px solid ' + T.navBorder, position: 'sticky', top: 0, zIndex: 20, color: T.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif" }}>
          <button onClick={() => setPreview(null)} style={{ border: 'none', cursor: 'pointer', background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', fontSize: '13px', color: T.text, fontFamily: 'inherit', padding: '6px 12px', borderRadius: '9999px' }}>‹ 돌아가기</button>
          <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{preview.title}</span>
          <span style={{ fontSize: '12.5px', color: T.textDim }}>{preview.items.length}문항</span>
          {preview.auto ? <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: T.textDim }}>PDF 만드는 중…</span>
            : <button onClick={savePaper} style={Object.assign({}, btnS(true), { marginLeft: 'auto' })}>인쇄 · PDF 저장</button>}
        </nav>
        <div data-main="" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '16px 0 40px' }}>
          <WeeklyTestSheets items={preview.items} teacher={preview.teacher} range={preview.range}
            dateTitle={preview.dateTitle} selId={null} onSelect={() => {}} withAnswers={false} />
        </div>
      </div>
    );
  }

  const card = { background: T.panel, border: '1px solid ' + T.panelBorder, borderRadius: '16px', backdropFilter: 'saturate(180%) blur(20px)' };
  const tableS = { width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontVariantNumeric: 'tabular-nums' };
  const thSort = { padding: '9px 10px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' };
  const tdS = (c) => ({ padding: '6px 10px', borderTop: '1px solid ' + T.divider, color: c });
  const pillS = (fg, bg) => ({ display: 'inline-block', borderRadius: '9999px', padding: '2px 9px', fontSize: '11.5px', fontWeight: 600, color: fg, background: bg, whiteSpace: 'nowrap' });
  const tagS = { border: '1px solid ' + T.divider, borderRadius: '6px', padding: '1px 7px', fontSize: '11.5px', color: T.textDim };
  const menuItem = { display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '7px', padding: '7px 10px', fontSize: '12.5px', color: T.text };
  const emptyS = { padding: '44px 0', textAlign: 'center', color: T.textFaint, fontSize: '13px' };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif" }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px', background: T.navBg, borderBottom: '1px solid ' + T.navBorder, backdropFilter: 'saturate(180%) blur(20px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="nav-brand" style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px' }}>SL PRIME</span>
          <span style={{ fontSize: '14px', color: T.textDim, whiteSpace: 'nowrap' }}>주간테스트 관리</span>
        </div>
        <button onClick={onHome} style={{ marginLeft: 'auto', border: 'none', cursor: 'pointer', background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', fontSize: '13px', color: T.text, fontFamily: 'inherit', padding: '6px 12px', borderRadius: '9999px' }}>‹ 홈</button>
      </nav>

      {(err || acaErr) && <div style={{ margin: '14px 20px 0', padding: '12px 14px', borderRadius: '10px', background: 'rgba(224,49,49,0.10)', border: '1px solid rgba(224,49,49,0.35)', fontSize: '13px', color: '#e03131' }}>{err || acaErr}</div>}

      <div data-mstack="" style={{ display: 'flex', gap: '16px', padding: '16px 20px', alignItems: 'flex-start' }}>
        {/* 왼쪽 — 학교 → 학년 → 반. data-mpane — 폰에서는 위로 올라가 전체 폭(index.html 모바일 CSS) */}
        <div data-mpane="" style={{ flex: 'none', width: '290px', background: T.panel, border: '1px solid ' + T.panelBorder, borderRadius: '16px', padding: '12px', backdropFilter: 'saturate(180%) blur(20px)', maxHeight: 'calc(100vh - 110px)', overflowY: 'auto' }}>
          {!!selCls.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
              {selCls.map((c) => (
                <button key={c.c_id} onClick={() => toggleClass(c.c_id)} title="빼기"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    borderRadius: '9999px', padding: '3px 8px 3px 10px', fontSize: '12px', background: pcTint(PC, 0.86), color: PC, fontWeight: 600 }}>
                  <span>{c.name}</span>
                  <span style={{ fontSize: '13px', lineHeight: '13px', opacity: 0.75 }}>×</span>
                </button>
              ))}
            </div>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="반 이름으로 찾기"
            style={Object.assign({}, inputS, { width: '100%', boxSizing: 'border-box', marginBottom: '8px' })} />
          {/* 찾는 중에는 급·학교·학년을 건너뛰고 반을 바로 보여 준다 — 클릭 네 번이 타이핑 한 번이 된다. */}
          {!!q.trim() && (
            <div style={{ marginBottom: '10px' }}>
              {classes.filter((c) => waIsEnglish(c) && String(c.name).replace(/\s/g, '').indexOf(q.trim().replace(/\s/g, '')) >= 0)
                .sort((a, b) => waClassRank(a.name) < waClassRank(b.name) ? -1 : 1).slice(0, 12)
                .map((c) => (
                  <button key={c.c_id} onClick={() => toggleClass(c.c_id)} style={Object.assign({}, rowBtn(classIds.indexOf(c.c_id) >= 0, '7px 10px'), { fontSize: '13px' })}>
                    <span style={{ flex: 'none', width: '5px', height: '5px', borderRadius: '50%', background: classIds.indexOf(c.c_id) >= 0 ? PC : T.textFaint, opacity: classIds.indexOf(c.c_id) >= 0 ? 1 : 0.45 }}></span>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    <span style={{ flex: 'none', color: T.textFaint, fontSize: '12px' }}>{students.filter((s2) => (s2.class_ids || []).indexOf(c.c_id) >= 0).length}명</span>
                  </button>
                ))}
              {!classes.filter((c) => waIsEnglish(c) && String(c.name).replace(/\s/g, '').indexOf(q.trim().replace(/\s/g, '')) >= 0).length
                && <div style={{ padding: '10px 6px', fontSize: '12.5px', color: T.textFaint }}>그런 반이 없습니다.</div>}
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px 10px', cursor: 'pointer', fontSize: '13px' }}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => { setOnlyMine(e.target.checked); setClassIds([]); setTestId(null); setWeekSel(null); }} />
            <span>내 담당 반만 보기</span>
          </label>
          {aca === null ? <div style={{ padding: '30px 0', textAlign: 'center', color: T.textFaint, fontSize: '13px' }}>명단 불러오는 중…</div>
            : !tree.length ? (
              <div style={{ padding: '22px 6px', color: T.textFaint, fontSize: '13px', lineHeight: 1.6 }}>
                {onlyMine ? ('‘' + userName + '’ 선생님이 담당으로 설정된 영어 반이 없습니다.') : '영어 반이 없습니다.'}
              </div>
            ) : (
              <React.Fragment>
                {/* 급 캡슐 — 초등·중등·고등 중 하나를 고른다(사장님 2026-10-23) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '2px 0 10px' }}>
                  {sections.map((sec) => {
                    const on = sec.level === curLevel;
                    return (
                      <button key={sec.level} onClick={() => { setLevel(sec.level); setOpenSchool(null); setOpenGrade(null); }}
                        style={{ border: '1px solid ' + (on ? 'transparent' : T.divider), cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: '9999px', padding: '5px 13px', fontSize: '12.5px', fontWeight: on ? 700 : 400,
                          background: on ? PC : 'transparent', color: on ? '#fff' : T.text }}>
                        {WA_LEVEL_CHIP[sec.level] || sec.level}
                        <span style={{ marginLeft: '5px', fontSize: '11px', opacity: on ? 0.85 : 0.6 }}>{sec.schools.length}</span>
                      </button>
                    );
                  })}
                </div>
                {shownSchools.map((sc) => {
              const scOpen = openSchool === sc.name;
              return (
                <div key={sc.name} style={{ marginBottom: '6px' }}>
                  {/* 학교 — 누르는 줄인 게 보이게 상자로 그린다 */}
                  <button onClick={() => setOpenSchool(scOpen ? null : sc.name)} style={waBoxBtn(scOpen)}>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{sc.name}</span>
                    <span style={{ flex: 'none', color: T.textFaint, fontSize: '11.5px' }}>{sc.grades.length}개 학년</span>
                    <span style={waCaret(scOpen)}>▾</span>
                  </button>
                  {scOpen && (
                    <div style={{ margin: '4px 0 0 10px', paddingLeft: '10px', borderLeft: '2px solid ' + T.divider }}>
                      {sc.grades.map((g) => {
                        const gKey = sc.name + '|' + g.grade;
                        const gOpen = openGrade === gKey;
                        return (
                          <div key={gKey} style={{ marginBottom: '3px' }}>
                            <button onClick={() => setOpenGrade(gOpen ? null : gKey)} style={waBoxBtn(gOpen, true)}>
                              <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{g.grade}</span>
                              <span style={{ flex: 'none', color: T.textFaint, fontSize: '11.5px' }}>{g.classes.length}반</span>
                              <span style={waCaret(gOpen)}>▾</span>
                            </button>
                            {gOpen && (
                              <div style={{ margin: '3px 0 0 8px' }}>
                                {g.classes.map((c) => (
                                  <button key={c.c_id} onClick={() => toggleClass(c.c_id)} style={Object.assign({}, rowBtn(classIds.indexOf(c.c_id) >= 0, '7px 10px'), { fontSize: '13px' })}>
                                    <span style={{ flex: 'none', width: '5px', height: '5px', borderRadius: '50%', background: classIds.indexOf(c.c_id) >= 0 ? PC : T.textFaint, opacity: classIds.indexOf(c.c_id) >= 0 ? 1 : 0.45 }}></span>
                                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                                    <span style={{ flex: 'none', color: T.textFaint, fontSize: '12px' }}>{students.filter((s) => (s.class_ids || []).indexOf(c.c_id) >= 0).length}명</span>
                                  </button>
                                ))}
                              </div>
                            )}
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

        {/* 오른쪽 — 반 하나의 대시보드 (머리 숫자 → 탭 → 표) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!selCls.length ? (
            <div style={{ background: T.panel, border: '1px solid ' + T.panelBorder, borderRadius: '16px', padding: '70px 0', textAlign: 'center', color: T.textFaint, fontSize: '13.5px' }}>
              왼쪽에서 반을 고르세요. <b>여러 반을 함께</b> 고를 수 있습니다.
            </div>
          ) : (
          <React.Fragment>
            {/* 반 머리 + 하는 일 */}
            {/* 메뉴가 열리면 이 카드를 위로 올린다 — card 에 backdropFilter 가 있어 **쌓임 맥락**이
                생기므로, 그 안의 메뉴는 z-index 를 아무리 올려도 뒤에 오는 숫자 카드 밑으로 깔린다. */}
            <div style={Object.assign({}, card, menu ? { position: 'relative', zIndex: 32 } : null)}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', padding: '14px 16px 0' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>{selCls.map((c) => c.name).join(' · ')}</span>
                <span style={{ fontSize: '12.5px', color: T.textFaint }}>
                  재원 {roster.length}명{selCls.length === 1 && (cls.teachers || []).length ? ' · ' + cls.teachers.join(', ') : ''}{selCls.length === 1 && cls.timetable_text ? ' · ' + cls.timetable_text : ''}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {test && <button style={btnS(true)} onClick={() => bkCopy(waGradeInvite(test, userName)).then(() => say('채점 안내문을 복사했습니다 — 카톡·문자로 보내세요'))}>채점 링크 복사</button>}
                  {test && <button style={btnS(false)} disabled={busy} onClick={() => openPreview(false)}>{busy ? '여는 중…' : '시험지 보기'}</button>}
                  {test && <button style={btnS(false)} disabled={busy} onClick={() => openPreview(true)}>시험지 다운로드</button>}
                  <button style={btnS(!test)} onClick={() => { setEditErr(''); setHwpx(null); setOldHwp(''); setAnsFile(null); setEditTest({ id: null, week_start: thisWeek, title: waWeekTitle(thisWeek), teacher: userName || '', range_text: '', item_count: '', class_ids: selCls.map((c) => c.c_id) }); }}>+ 시험지 등록</button>
                  <span style={{ position: 'relative' }}>
                    <button style={Object.assign({}, btnS(false), { padding: '6px 10px' })} title="더 보기" onClick={() => setMenu(!menu)}>⋯</button>
                    {menu && (
                      <React.Fragment>
                        <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }}></div>
                        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 5px)', zIndex: 31, minWidth: '158px', background: dark ? '#1c1d22' : '#fff', border: '1px solid ' + T.divider, borderRadius: '11px', padding: '5px', boxShadow: '0 12px 34px rgba(0,0,0,0.18)' }}>
                          {test && <button style={menuItem} onClick={() => { setMenu(false); setEditErr(''); setHwpx(null); setOldHwp(''); setAnsFile(null); setEditTest({ id: test.id, week_start: test.week_start, title: test.title, teacher: test.teacher || '', range_text: test.range_text || '', item_count: test.item_count || '', class_ids: test.class_ids || [] }); }}>시험지 고치기</button>}
                          {test && <button style={menuItem} onClick={() => { setMenu(false); loadScores(say); }}>점수 다시 읽기</button>}
                          <button style={menuItem} onClick={() => { setMenu(false); openTrash(); }}>휴지통</button>
                          {test && <div style={{ borderTop: '1px solid ' + T.divider, margin: '4px 2px' }}></div>}
                          {test && <button style={Object.assign({}, menuItem, { color: '#e03131' })} onClick={() => { setMenu(false); delTest(); }}>시험지 삭제</button>}
                        </div>
                      </React.Fragment>
                    )}
                  </span>
                </span>
              </div>

              {/* 주차 고르기 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '12px 16px 0' }}>
                <span style={{ flex: 'none', fontSize: '11.5px', color: T.textFaint, marginRight: '2px' }}>시험</span>
                {!weeks.length ? <span style={{ fontSize: '12.5px', color: T.textFaint }}>이 반에 등록된 시험지가 없습니다 — <b>+ 시험지 등록</b></span>
                  : weeks.map((w) => {
                    const on = w === curWeek;
                    const n = weekTests.filter((t) => t.week_start === w).length;
                    return (
                      <button key={w} onClick={() => pickWeek(w)} title={waWeekSpan(w)}
                        style={{ flex: 'none', border: '1px solid ' + (on ? 'transparent' : T.divider), cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: '9999px', padding: '5px 13px', fontSize: '12.5px', whiteSpace: 'nowrap',
                          fontWeight: on ? 700 : 400, background: on ? T.text : 'transparent', color: on ? T.bg : T.text }}>
                        {waWeekName(w)}{n > 1 && <span style={{ marginLeft: '5px', fontSize: '11px', opacity: 0.7 }}>{n}</span>}
                      </button>
                    );
                  })}
              </div>
              {/* 그 주에 시험지가 여럿이면 하나를 더 고른다(수준별 상·하 등 — 사장님 2026-10-25) */}
              {inWeek.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '8px 16px 0' }}>
                  <span style={{ flex: 'none', fontSize: '11.5px', color: T.textFaint, marginRight: '2px' }}>시험지</span>
                  {inWeek.map((t) => {
                    const on = t.id === testId;
                    return (
                      <button key={t.id} onClick={() => setTestId(on ? null : t.id)} title={t.title}
                        style={{ flex: 'none', border: '1px solid ' + (on ? PC : T.divider), cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: '9px', padding: '5px 12px', fontSize: '12.5px', whiteSpace: 'nowrap',
                          fontWeight: on ? 700 : 400, background: on ? pcTint(PC, 0.9) : 'transparent', color: on ? PC : T.text }}>
                        {testLabel(t)}
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: T.textFaint, fontWeight: 400 }}>{(t.item_count || 0) + '문항'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ padding: '8px 16px 14px', fontSize: '12.5px', color: T.textDim, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', minHeight: '20px' }}>
                {test && <b style={{ color: T.text }}>{test.title}</b>}
                {test && !!test.item_count && <span style={tagS}>{test.item_count}문항</span>}
                {test && !!test.teacher && <span style={tagS}>{test.teacher}T</span>}
                {test && !!test.range_text && <span style={tagS}>{test.range_text}</span>}
                {test && <span>{waWeekSpan(test.week_start)}</span>}
                {!test && !!weekTests.length && <span style={{ color: T.textFaint }}>{inWeek.length > 1 ? '이 주에 시험지가 ' + inWeek.length + '개 있습니다 — 하나를 고르세요.' : '주차를 고르면 성적이 나옵니다.'}</span>}
              </div>
            </div>

            {/* 큰 숫자 — 가장 중요한 값을 가장 크게 */}
            {test && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
                {[
                  { k: '응시', v: st.n, sub: st.total ? '/ ' + st.total + '명 · ' + Math.round(st.n * 100 / st.total) + '%' + (st.off ? ' · 제외 ' + st.off : '') : '' },
                  { k: '반 평균', v: st.avg == null ? '—' : st.avg, sub: (st.avg != null && prevAvg != null) ? (st.avg >= prevAvg ? '지난 시험보다 ▲ ' : '지난 시험보다 ▼ ') + Math.abs(Math.round((st.avg - prevAvg) * 10) / 10) : (prevTest ? '지난 시험 기록 없음' : '첫 시험') },
                  { k: '최고 · 최저', v: st.hi == null ? '—' : st.hi, sub: st.lo == null ? '' : '최저 ' + st.lo },
                  { k: '미응시', v: st.blank, sub: missNames.slice(0, 3).join(' · ') + (missNames.length > 3 ? ' 외 ' + (missNames.length - 3) : '') || (st.off ? '제외 ' + st.off + '명' : ''), alert: st.blank > 0 },
                ].map((c) => (
                  <div key={c.k} style={Object.assign({}, card, { padding: '12px 14px' })}>
                    <div style={{ fontSize: '11.5px', color: T.textFaint }}>{c.k}</div>
                    <div style={{ fontSize: '25px', fontWeight: 800, letterSpacing: '-0.8px', fontVariantNumeric: 'tabular-nums', color: c.alert ? '#e03131' : T.text }}>{c.v}</div>
                    <div style={{ fontSize: '11.5px', color: T.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 탭 */}
            <div style={card}>
              <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid ' + T.divider, padding: '0 10px' }}>
                {[['scores', '이번 시험'], ['trend', '성적 추이'], ['types', '유형 분석']].map(([k, label]) => (
                  <button key={k} onClick={() => setTab(k)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    padding: '11px 12px 9px', fontSize: '13.5px', marginBottom: '-1px',
                    color: tab === k ? T.text : T.textDim, fontWeight: tab === k ? 700 : 400,
                    borderBottom: '2px solid ' + (tab === k ? PC : 'transparent') }}>{label}</button>
                ))}
              </div>

              {/* ① 이번 시험 */}
              {tab === 'scores' && (!test ? <div style={emptyS}>위에서 주차를 고르세요.</div> : (
                <React.Fragment>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={tableS}>
                      <thead>
                        <tr style={{ color: T.textFaint, fontSize: '11.5px', textAlign: 'left' }}>
                          <th style={{ padding: '9px 10px', width: '34px', fontWeight: 600 }}>#</th>
                          <th style={thSort} onClick={() => sortHead('name')}>학생{sortMark('name')}</th>
                          <th style={thSort} onClick={() => sortHead('score')}>점수{sortMark('score')}</th>
                          <th style={thSort} onClick={() => sortHead('wrong')}>틀린 문항{sortMark('wrong')}</th>
                          <th style={{ padding: '9px 10px', width: '160px', fontWeight: 600 }}>채점</th>
                          <th style={{ padding: '9px 10px', width: '74px', fontWeight: 600 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const ws = Array.isArray(r.wrong) ? r.wrong : [];
                          const head = sortKey === 'name' && (i === 0 || rows[i - 1].klass !== r.klass) && testCls.length > 1;
                          const n = r.score === '' || r.score == null ? null : Number(r.score);
                          const editing = editCell === r.klass + '|' + r.student;
                          return (
                            <React.Fragment key={r.klass + '|' + r.student}>
                              {head && <tr><td colSpan={6} style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', borderTop: '1px solid ' + T.divider, padding: '6px 10px', fontSize: '11.5px', fontWeight: 700, color: T.textDim }}>{r.klass}</td></tr>}
                              <tr style={r.excluded ? { opacity: 0.45 } : null}>
                                <td style={tdS(T.textFaint)}>{r.excluded ? '' : i + 1}</td>
                                <td style={Object.assign({}, tdS(T.text), { fontWeight: 600, whiteSpace: 'nowrap' })}>{r.student}</td>
                                <td style={tdS(T.text)}>
                                  {r.excluded ? <span style={{ color: T.textFaint }}>—</span> : editing ? (
                                    <input autoFocus style={Object.assign({}, inputS, { width: '66px', textAlign: 'right' })} value={r.score} inputMode="decimal"
                                      onChange={(e) => setScore(r.klass, r.student, 'score', e.target.value)}
                                      onBlur={() => setEditCell('')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditCell(''); }} />
                                  ) : (
                                    <button onClick={() => setEditCell(r.klass + '|' + r.student)} title="눌러서 고치기"
                                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px', borderRadius: '6px',
                                        fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                        color: n == null ? T.textFaint : (n >= 80 ? '#1a7f37' : (n < 60 ? '#e03131' : T.text)) }}>
                                      {n == null ? '—' : r.score}
                                    </button>
                                  )}
                                </td>
                                <td style={tdS(T.text)}>
                                  {r.excluded ? <span style={{ color: T.textFaint }}>—</span> : !ws.length ? <span style={{ color: T.textFaint }}>{r.graded_at ? '없음' : '—'}</span> : (
                                    <button onClick={() => setWrongOf(r)} title="눌러서 유형까지 보기"
                                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                      {ws.slice(0, 8).map((w, j) => (
                                        <span key={j} style={{ padding: '1px 5px', borderRadius: '5px', fontSize: '11px', fontWeight: 700,
                                          background: dark ? 'rgba(224,49,49,0.18)' : 'rgba(224,49,49,0.09)', color: '#e03131' }}>{w.no}</span>
                                      ))}
                                      {ws.length > 8 && <span style={{ fontSize: '11px', color: T.textFaint }}>+{ws.length - 8}</span>}
                                    </button>
                                  )}
                                </td>
                                <td style={tdS(T.text)}>
                                  {r.excluded ? <span style={pillS(T.textDim, dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')}>이 시험지 대상 아님</span>
                                    : r.graded_at ? (
                                    <span><span style={pillS(PC, pcTint(PC, 0.88))}>링크</span> <span style={{ fontSize: '11.5px', color: T.textFaint }}>{waWhen(r.graded_at)}</span></span>
                                  ) : n != null ? <span style={pillS(T.textDim, dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')}>직접 입력</span>
                                    : <span style={pillS('#e03131', dark ? 'rgba(224,49,49,0.18)' : 'rgba(224,49,49,0.09)')}>미응시</span>}
                                </td>
                                <td style={Object.assign({}, tdS(T.text), { whiteSpace: 'nowrap' })}>
                                  {/* 한 반 안에서도 수준별로 시험지를 다르게 낸다 — 이 시험지를 안 보는 학생을 뺀다. */}
                                  <button onClick={() => toggleExcl(r)} title={r.excluded ? '이 시험지 대상으로 되돌리기' : '이 시험지 대상에서 빼기 — 평균·응시에서 빠지고 채점 링크에도 안 뜹니다'}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', borderRadius: '6px', color: r.excluded ? PC : T.textFaint }}>{r.excluded ? '↩' : '⊘'}</button>
                                  <button onClick={() => setMemoOf(r)} title={r.note || '메모'}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px', padding: '2px 6px', borderRadius: '6px', color: r.note ? PC : T.textFaint }}>✎</button>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* 많이 틀린 문항 — 순서대로(2026-10-29 사장님). 번호를 누르면 그 문항이 양식 그대로 뜬다. */}
                  {missRows.length > 0 && (
                    <div style={{ margin: '14px 14px 0', paddingTop: '14px', borderTop: '1px solid ' + T.divider }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '8px' }}>
                        많이 틀린 문항 <span style={{ fontWeight: 400, color: T.textFaint }}>· 채점 링크로 채점한 {gradedRows.length}명 기준</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {missRows.map((m, mi) => {
                          const pct = Math.round(m.n * 100 / gradedRows.length);
                          const col = mi === 0 ? '#e03131' : (mi < 3 ? '#b25e09' : PC);
                          return (
                            <button key={m.no} onClick={() => openItem(m.no, { who: m.who })} title="눌러서 문항 보기"
                              style={{ display: 'grid', gridTemplateColumns: '44px 54px minmax(0,1fr) 110px', alignItems: 'center', gap: '10px', padding: '4px 6px',
                                border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: T.text, textAlign: 'left', borderRadius: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: PC }}>{m.no}번</span>
                              <span style={{ fontSize: '12px', color: T.textDim }}>{m.type || '—'}</span>
                              <span style={{ height: '10px', borderRadius: '9999px', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                                <span style={{ display: 'block', height: '100%', width: pct + '%', borderRadius: '9999px', background: col }}></span>
                              </span>
                              <span style={{ fontSize: '12px', color: T.textDim, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.n}명 · {pct}%</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* 같은 주에 그 반 시험지가 따로 있으면(수준별) '등록되지 않은 반' 이 아니다 — 갈라서 알리고 바로 옮겨 가게 한다 */}
                  {offCls.filter((c) => otherOf(c)).map((c) => {
                    const o = otherOf(c);
                    return (
                      <div key={c.c_id} style={{ margin: '10px 14px 0', padding: '10px 12px', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.6,
                        background: T.hover, border: '1px solid ' + T.divider, color: T.text, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ marginRight: 'auto' }}><b>{c.name}</b> 은(는) 이 주에 다른 시험지(<b>{testLabel(o)}</b>)를 봤습니다 — 이 표에서는 뺐습니다.</span>
                        <button onClick={() => setTestId(o.id)}
                          style={{ flex: 'none', border: '1px solid ' + T.divider, background: T.bg, color: T.text, borderRadius: '8px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                          그 시험지 보기
                        </button>
                      </div>
                    );
                  })}
                  {offCls.some((c) => !otherOf(c)) && (
                    <div style={{ margin: '10px 14px 0', padding: '10px 12px', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.6,
                      background: dark ? 'rgba(255,159,10,0.12)' : 'rgba(178,94,9,0.08)', border: '1px solid rgba(178,94,9,0.3)', color: T.text }}>
                      <b>{offCls.filter((c) => !otherOf(c)).map((c) => c.name).join(' · ')}</b> 은(는) 이 시험지가 등록되지 않은 반입니다 — 명단에서 뺐습니다.
                      <div style={{ color: T.textDim, marginTop: '2px' }}>그 반 시험지를 따로 등록하거나, <b>시험지 고치기</b>에서 이 시험지에 그 반을 더하세요.</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px 14px' }}>
                    <span style={{ fontSize: '12px', color: T.textFaint, marginRight: 'auto' }}>점수를 누르면 바로 고칠 수 있습니다. <b>⊘</b> 를 누르면 그 학생을 이 시험지 대상에서 빼고(수준별로 다른 시험지를 줄 때), 그 학생에게는 채점 링크에도 안 뜹니다.</span>
                    {/* 저장 버튼은 없다 — 바뀌는 대로 바로 저장한다(사장님 2026-10-25). */}
                    {saveState === 'saving' ? <span style={{ fontSize: '12px', color: T.textDim }}>저장 중…</span>
                      : saveState === 'saved' ? <span style={{ fontSize: '12px', color: '#1a7f37' }}>✓ 저장됨{savedAt.current ? ' ' + savedAt.current : ''}</span>
                      : saveState ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#e03131' }}>저장하지 못했습니다 — {saveState}</span>
                          <button style={btnS(true)} onClick={flushSave}>다시 시도</button>
                        </span>
                      ) : <span style={{ fontSize: '12px', color: T.textFaint }}>바뀌는 대로 저장됩니다</span>}
                  </div>
                </React.Fragment>
              ))}

              {/* ② 성적 추이 */}
              {tab === 'trend' && (!weekTests.length ? <div style={emptyS}>등록된 시험지가 없습니다.</div> : (
                <React.Fragment>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={tableS}>
                      <thead>
                        <tr style={{ color: T.textFaint, fontSize: '11.5px', textAlign: 'left' }}>
                          <th style={{ padding: '9px 10px', width: '34px', fontWeight: 600 }}>#</th>
                          <th style={{ padding: '9px 10px', width: '110px', fontWeight: 600 }}>학생</th>
                          {weekTests.map((t) => <th key={t.id} style={{ padding: '9px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{waWeekName(t.week_start)}</th>)}
                          <th style={{ padding: '9px 10px', fontWeight: 600 }}>평균</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendRows.map((r, i) => {
                          const head = (i === 0 || trendRows[i - 1].klass !== r.klass) && testCls.length > 1;
                          return (
                            <React.Fragment key={r.klass + '|' + r.student}>
                              {head && <tr><td colSpan={weekTests.length + 3} style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', borderTop: '1px solid ' + T.divider, padding: '6px 10px', fontSize: '11.5px', fontWeight: 700, color: T.textDim }}>{r.klass}</td></tr>}
                              <tr>
                                <td style={tdS(T.textFaint)}>{i + 1}</td>
                                <td style={Object.assign({}, tdS(T.text), { fontWeight: 600, whiteSpace: 'nowrap' })}>{r.student}</td>
                                {r.vs.map((v, j) => <td key={j} style={tdS(T.text)}>{waHeat(v, dark, T)}</td>)}
                                <td style={Object.assign({}, tdS(T.text), { fontWeight: 700, fontVariantNumeric: 'tabular-nums' })}>{r.avg == null ? '—' : r.avg}</td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                        <tr>
                          <td style={{ padding: '7px 10px', borderTop: '2px solid ' + T.divider }}></td>
                          <td style={{ padding: '7px 10px', borderTop: '2px solid ' + T.divider, fontWeight: 700 }}>반 평균</td>
                          {weekAvg.map((v, j) => <td key={j} style={{ padding: '7px 10px', borderTop: '2px solid ' + T.divider, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v == null ? '—' : v}</td>)}
                          <td style={{ padding: '7px 10px', borderTop: '2px solid ' + T.divider }}></td>
                        </tr>
                        <tr>
                          <td style={tdS(T.textFaint)}></td>
                          <td style={Object.assign({}, tdS(T.textDim), { fontSize: '12px' })}>응시</td>
                          {weekTook.map((v, j) => <td key={j} style={Object.assign({}, tdS(T.textDim), { fontSize: '12px', fontVariantNumeric: 'tabular-nums' })}>{v}/{roster.length}</td>)}
                          <td style={tdS(T.text)}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '0 14px 14px', fontSize: '12px', color: T.textFaint }}>칸이 붉을수록 낮은 점수입니다. 빈칸은 미응시이고 평균에서 뺍니다.</div>
                </React.Fragment>
              ))}

              {/* ③ 유형 분석 */}
              {tab === 'types' && (!typeRows.length ? <div style={emptyS}>아직 모인 오답이 없습니다. 학생이 채점 링크로 채점하면 유형이 쌓입니다.</div> : (
                <React.Fragment>
                  <div style={{ display: 'flex', gap: '18px', padding: '14px 16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '8px' }}>
                        이 반이 자주 틀리는 유형 <span style={{ fontWeight: 400, color: T.textFaint }}>· 시험 {weekTests.length}회 · 오답 {wrongTotal}개</span>
                      </div>
                      {typeRows.map((t, ti) => {
                        const pct = Math.round(t.n * 1000 / wrongTotal) / 10;
                        const w = Math.round(t.n * 100 / typeRows[0].n);
                        const col = ti === 0 ? '#e03131' : (ti < 3 ? '#b25e09' : PC);
                        return (
                          <div key={t.type} style={{ display: 'grid', gridTemplateColumns: '54px minmax(0,1fr) 92px', alignItems: 'center', gap: '10px', padding: '5px 0' }}>
                            <span style={{ fontSize: '12.5px' }}>{t.type}</span>
                            <span style={{ height: '10px', borderRadius: '9999px', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                              <span style={{ display: 'block', height: '100%', width: w + '%', borderRadius: '9999px', background: col }}></span>
                            </span>
                            <span style={{ fontSize: '12px', color: T.textDim, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}% · {t.n}개</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ flex: '0 1 300px', minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '8px' }}>{topType + waJosa(topType, '을', '를')} 자주 틀리는 학생</div>
                      {!topTypeStudents.length ? <div style={{ fontSize: '12.5px', color: T.textFaint }}>없음</div> : topTypeStudents.map((s) => (
                        <div key={s.student} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', padding: '3px 0' }}>
                          <span style={{ fontWeight: 600 }}>{s.student}</span>
                          <span style={{ marginLeft: 'auto', color: '#e03131', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.n}회</span>
                        </div>
                      ))}
                      <div style={{ fontSize: '12.5px', fontWeight: 700, margin: '16px 0 8px' }}>점수가 떨어지고 있는 학생</div>
                      {!dropping.length ? <div style={{ fontSize: '12.5px', color: T.textFaint }}>없음</div> : dropping.map((s) => (
                        <div key={s.student} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', padding: '3px 0' }}>
                          <span style={{ fontWeight: 600 }}>{s.student}</span>
                          <span style={{ color: T.textFaint, fontSize: '11.5px' }}>처음 대비</span>
                          <span style={{ marginLeft: 'auto', color: '#e03131', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: '0 16px 14px', fontSize: '12px', color: T.textFaint }}>
                    유형은 시험지를 올릴 때 AI 검사가 문항마다 매긴 값입니다. 채점 링크로 들어온 오답만 셉니다.
                  </div>
                </React.Fragment>
              ))}
            </div>
          </React.Fragment>
          )}
        </div>
      </div>

      {/* 메모 — 표에서는 ✎ 하나뿐이다. 거의 안 쓰는 칸이 화면을 먹지 않게. */}
      {memoOf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }} onClick={() => setMemoOf(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '380px', maxWidth: '92vw', background: dark ? '#1c1d22' : '#fff', color: T.text, borderRadius: '16px', padding: '18px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>{memoOf.student}</div>
            <div style={{ fontSize: '12px', color: T.textFaint, marginBottom: '12px' }}>{memoOf.klass}</div>
            <textarea autoFocus value={(scores[memoOf.klass + '|' + memoOf.student] || {}).note || ''}
              onChange={(e) => setScore(memoOf.klass, memoOf.student, 'note', e.target.value)}
              placeholder="상담 때 쓸 메모"
              style={Object.assign({}, inputS, { width: '100%', boxSizing: 'border-box', minHeight: '96px', resize: 'vertical', lineHeight: 1.5 })} />
            <div style={{ display: 'flex', marginTop: '14px' }}>
              <span style={{ fontSize: '11.5px', color: T.textFaint, alignSelf: 'center' }}>바뀌는 대로 저장됩니다</span>
              <button style={Object.assign({}, btnS(true), { marginLeft: 'auto' })} onClick={() => setMemoOf(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 휴지통 — 지워진 시험지와 그때의 성적을 통째로 들고 있다 */}
      {trash && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }} onClick={() => setTrash(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '560px', maxWidth: '92vw', maxHeight: '76vh', overflow: 'auto', background: dark ? '#1c1d22' : '#fff', color: T.text, borderRadius: '16px', padding: '18px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '2px' }}>휴지통</div>
            <div style={{ fontSize: '12px', color: T.textDim, marginBottom: '14px' }}>
              지워진 시험지와 그때의 성적을 그대로 들고 있습니다. 되돌리기는 관리자만 됩니다.
            </div>
            {!trash.length ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: T.textFaint, fontSize: '13px' }}>비어 있습니다.</div>
            ) : trash.map((row) => {
              const t = row.test || {};
              const n = Array.isArray(row.scores) ? row.scores.length : 0;
              return (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: '1px solid ' + T.divider }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title || '(이름 없음)'}</div>
                    <div style={{ fontSize: '12px', color: T.textDim, marginTop: '2px' }}>
                      {(t.week_start || '') + ' · ' + (t.item_count || 0) + '문항 · 성적 ' + n + '줄'}
                      {' · '}{waWhen(row.deleted_at)} {row.deleted_by || '(알 수 없음)'} 지움
                    </div>
                  </div>
                  <button style={btnS(true)} disabled={busy} onClick={() => restore(row)}>되돌리기</button>
                </div>
              );
            })}
            <div style={{ display: 'flex', marginTop: '16px' }}>
              <button style={Object.assign({}, btnS(false), { marginLeft: 'auto' })} onClick={() => setTrash(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 틀린 문항 — 채점 링크로 들어온 줄만 가진다(학생이 폰에서 넣은 답으로 서버가 매긴 것) */}
      {wrongOf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }} onClick={() => setWrongOf(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '440px', maxWidth: '92vw', maxHeight: '76vh', overflow: 'auto', background: dark ? '#1c1d22' : '#fff', color: T.text, borderRadius: '16px', padding: '18px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700 }}>{wrongOf.student}</span>
              <span style={{ fontSize: '12px', color: T.textFaint }}>{wrongOf.klass}</span>
              <span style={{ marginLeft: 'auto', fontSize: '15px', fontWeight: 800, color: Number(wrongOf.score) >= 80 ? '#1a7f37' : Number(wrongOf.score) < 60 ? '#e03131' : T.text }}>{wrongOf.score}</span>
            </div>
            <div style={{ fontSize: '12px', color: T.textDim, marginBottom: '14px' }}>
              틀린 {(wrongOf.wrong || []).length}문항{wrongOf.graded_at ? ' · 학생이 ' + waWhen(wrongOf.graded_at) + ' 채점' : ''}
            </div>

            {/* 유형별로 몇 개를 틀렸나 — 월간 레포트가 보게 될 그 숫자다 */}
            {(function () {
              const by = {};
              (wrongOf.wrong || []).forEach((w) => { const k = w.type || '기타'; by[k] = (by[k] || 0) + 1; });
              const ks = Object.keys(by).sort((x, y) => by[y] - by[x]);
              if (!ks.length) return null;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
                  {ks.map((k) => (
                    <span key={k} style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                      background: pcTint(PC, 0.88), color: PC }}>{k} {by[k]}</span>
                  ))}
                </div>
              );
            })()}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ color: T.textFaint, fontSize: '11.5px', textAlign: 'left' }}>
                  <th style={{ padding: '4px 6px', width: '46px', fontWeight: 600 }}>문항</th>
                  <th style={{ padding: '4px 6px', width: '74px', fontWeight: 600 }}>유형</th>
                  <th style={{ padding: '4px 6px', width: '54px', fontWeight: 600 }}>정답</th>
                  <th style={{ padding: '4px 6px', fontWeight: 600 }}>학생 답</th>
                </tr>
              </thead>
              <tbody>
                {(wrongOf.wrong || []).map((w, i) => (
                  <tr key={i} style={{ borderTop: '1px solid ' + T.divider }}>
                    <td style={{ padding: '2px 0' }}>
                      {/* 번호를 누르면 그 문항만 양식 그대로 뜬다(2026-10-29 사장님) */}
                      <button onClick={() => openItem(w.no, { mine: w.mine, student: wrongOf.student })} title="눌러서 문항 보기"
                        style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '7px',
                          background: pcTint(PC, 0.88), color: PC }}>{w.no}</button>
                    </td>
                    <td style={{ padding: '5px 6px', color: T.textDim }}>{w.type || '—'}</td>
                    <td style={{ padding: '5px 6px', color: '#1a7f37', fontWeight: 700 }}>{wtCirc(w.answer) || '—'}</td>
                    <td style={{ padding: '5px 6px', color: '#e03131', fontWeight: 700 }}>{wtCirc(w.mine) || '안 품'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', marginTop: '16px' }}>
              <button style={Object.assign({}, btnS(false), { marginLeft: 'auto' })} onClick={() => setWrongOf(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 문항 하나 — 시험지와 똑같은 평가원 양식(13-weekly.js 의 wtItemParts)으로 그린다. 흰 종이 위 검정 글자라 다크 모드에서도 종이색 그대로. */}
      {itemPop && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setItemPop(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '520px', maxWidth: '92vw', maxHeight: '84vh', overflow: 'auto', background: '#fff', color: '#000', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <style>{WT_CSS}</style>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px', fontFamily: 'inherit' }}>
              <span style={{ fontSize: '15px', fontWeight: 700 }}>{itemPop.no}번</span>
              {itemPop.type && <span style={{ fontSize: '12px', color: '#6e6e73' }}>{itemPop.type}</span>}
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#6e6e73' }}>{test ? testLabel(test) : ''}</span>
            </div>
            <div className="wt" style={{ fontSize: '13.6px' }}>
              {wtItemParts(itemPop.it, itemPop.no)}
            </div>
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: '6px', paddingTop: '12px', fontSize: '13px', lineHeight: 1.7, fontFamily: 'inherit' }}>
              <div><span style={{ color: '#6e6e73', marginRight: '8px' }}>정답</span><b style={{ color: '#1a7f37' }}>{wtCirc(itemPop.answer) || '—'}</b>
                {itemPop.student && <React.Fragment><span style={{ color: '#6e6e73', margin: '0 8px 0 18px' }}>{itemPop.student} 답</span><b style={{ color: '#e03131' }}>{wtCirc(itemPop.mine) || '안 품'}</b></React.Fragment>}
              </div>
              {itemPop.who && (
                <div style={{ marginTop: '4px' }}><span style={{ color: '#6e6e73', marginRight: '8px' }}>틀린 학생 {itemPop.who.length}명</span>{itemPop.who.join(' · ')}</div>
              )}
              {itemPop.it.explanation && <div style={{ marginTop: '6px', color: '#3a3a3c' }}><span style={{ color: '#6e6e73', marginRight: '8px' }}>해설</span>{itemPop.it.explanation}</div>}
            </div>
            <div style={{ display: 'flex', marginTop: '14px' }}>
              <button style={Object.assign({}, btnS(false), { marginLeft: 'auto' })} onClick={() => setItemPop(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 시험 만들기/고치기 */}
      {editTest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }} onClick={() => setEditTest(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '420px', maxWidth: '92vw', background: dark ? '#1c1d22' : '#fff', color: T.text, borderRadius: '16px', padding: '18px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>{editTest.id ? '시험지 고치기' : '시험지 등록'}</div>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ display: 'block', fontSize: '12px', color: T.textDim, marginBottom: '4px' }}>
                시험지 파일 (.hwpx){!editTest.id && <b style={{ color: '#e03131' }}> · 필수</b>}
              </span>
              <input type="file" accept=".hwpx" style={{ fontSize: '12.5px', fontFamily: 'inherit', color: T.text }}
                onChange={(e) => readHwpx(e.target.files && e.target.files[0])} />
              {!!oldHwp && (
                <div style={{ marginTop: '8px', padding: '12px 14px', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.6,
                  background: dark ? 'rgba(224,49,49,0.12)' : 'rgba(224,49,49,0.07)', border: '1px solid rgba(224,49,49,0.35)', color: T.text }}>
                  <div style={{ fontWeight: 700, color: '#e03131', marginBottom: '2px' }}>한글 문서(.hwp)는 넣을 수 없습니다 — .hwpx 만 받습니다</div>
                  <div style={{ color: T.textDim, marginBottom: '8px' }}>{oldHwp}</div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>한글에서 hwpx 로 저장한 뒤 다시 넣어 주세요</div>
                  <div style={{ paddingLeft: '2px' }}>
                    <div><b>1.</b> 한글에서 그 시험지를 엽니다</div>
                    <div><b>2.</b> <b>파일 → 다른 이름으로 저장</b></div>
                    <div><b>3.</b> 파일 형식에서 <b>한글 표준 (*.hwpx)</b> 선택</div>
                    <div><b>4.</b> 저장한 <b>.hwpx</b> 파일을 위에 다시 넣습니다</div>
                  </div>
                  <div style={{ marginTop: '8px', color: T.textFaint, fontSize: '11.5px' }}>
                    hwpx 는 한글 표준 형식이라 문항을 정확히 읽어낼 수 있습니다. 저장 형식만 바뀔 뿐 내용은 그대로입니다.
                  </div>
                </div>
              )}
              {hwpx === 'busy' && <div style={{ marginTop: '6px', fontSize: '12.5px', color: T.textDim }}>읽는 중…</div>}
              {hwpx && hwpx !== 'busy' && (
                <div style={{ marginTop: '6px', padding: '8px 10px', borderRadius: '9px', fontSize: '12.5px', lineHeight: 1.55,
                  background: dark ? 'rgba(0,102,204,0.16)' : 'rgba(0,102,204,0.07)', color: T.text }}>
                  <div><b>{hwpx.items.length}문항</b> · 정답 {hwpx.items.filter((x) => x.answer).length}개
                    {hwpx.items.filter((x) => x.aiFixed).length ? ' · AI가 고친 문항 ' + hwpx.items.filter((x) => x.aiFixed).length + '개' : ''}
                    {ansFile && ansFile.matched ? ' · 답지 따로 올림(' + ansFile.matched + '개)' : ''}</div>
                  {hwpx.items.filter((x) => x.answer).length < hwpx.items.length && (
                    <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '9px', lineHeight: 1.6,
                      background: dark ? 'rgba(178,106,0,0.16)' : 'rgba(178,106,0,0.08)', border: '1px solid rgba(178,106,0,0.35)' }}>
                      <div style={{ fontWeight: 700, color: '#b26a00' }}>
                        {hwpx.items.filter((x) => x.answer).length
                          ? '답지가 일부만 합본되어 있습니다 — 답지를 업로드해 주세요'
                          : '답지가 합본되어 있지 않습니다 — 답지를 업로드해 주세요'}
                      </div>
                      <div style={{ color: T.textDim, marginBottom: '6px' }}>
                        {'문항 ' + hwpx.items.length + '개 중 정답 ' + hwpx.items.filter((x) => x.answer).length + '개만 찾았습니다.'}
                      </div>
                      <input type="file" accept=".hwpx" style={{ fontSize: '12.5px', fontFamily: 'inherit', color: T.text }}
                        onChange={(e) => readAnswers(e.target.files && e.target.files[0])} />
                      {ansFile === 'busy' && <div style={{ marginTop: '5px', color: T.textDim }}>읽는 중…</div>}
                      {ansFile && ansFile.error && <div style={{ marginTop: '5px', color: '#e03131' }}>{ansFile.error}</div>}
                      {ansFile && ansFile.matched != null && (
                        <div style={{ marginTop: '5px', color: ansFile.matched ? '#2b8a3e' : '#e03131' }}>
                          {ansFile.matched
                            ? '✓ ' + ansFile.name + ' — 정답 ' + ansFile.matched + '개를 붙였습니다'
                            : '정답 ' + ansFile.found + '개를 찾았지만 문항 번호가 맞는 것이 없습니다. 같은 시험지의 답지가 맞는지 확인해 주세요.'}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(ai && ai.step)
                      ? <span style={{ fontSize: '12px', color: T.textDim }}>{'원문과 대조하는 중… ' + ai.step}</span>
                      : <React.Fragment>
                          <button onClick={runAi}
                            style={{ border: '1px solid ' + T.divider, background: 'transparent', color: T.text, cursor: 'pointer',
                              fontFamily: 'inherit', fontSize: '12px', borderRadius: '9999px', padding: '4px 11px' }}>다시 검사</button>
                          <span style={{ fontSize: '11.5px', color: T.textFaint }}>올리면 자동으로 원문과 대조합니다</span>
                        </React.Fragment>}
                  </div>
                  {ai && ai.error && <div style={{ marginTop: '5px', color: '#e03131' }}>검사하지 못했습니다 — {ai.error}</div>}
                  {ai && ai.done && (
                    <div style={{ marginTop: '5px' }}>
                      {ai.done.problems.length === 0
                        ? <div style={{ color: '#2b8a3e' }}>
                            {'✓ 원문과 어긋난 곳을 찾지 못했습니다 ('
                              + (ai.done.unchecked.length
                                  ? hwpx.items.length - ai.done.unchecked.length + '/' + hwpx.items.length + '문항 대조'
                                  : hwpx.items.length + '문항 전부 대조') + ')'}
                          </div>
                        : <React.Fragment>
                            <div style={{ color: '#b26a00' }}>{ai.done.problems.map((x, i) => <div key={i}>⚠ {x.no}번 [{x.kind}] {x.detail}</div>)}</div>
                            <div style={{ marginTop: '3px', color: ai.done.fixed ? '#2b8a3e' : T.textFaint }}>
                              {ai.done.fixed ? '→ ' + ai.done.fixed + '개 문항을 원문대로 다시 쪼갰습니다.' : '→ 고치지 못했습니다.'}
                            </div>
                          </React.Fragment>}
                      {!!ai.done.rejected.length && (
                        <div style={{ marginTop: '3px', color: '#e03131' }}>
                          {ai.done.rejected.map((r, i) => <div key={i}>✕ {r.nos.join(', ')}번은 그대로 뒀습니다 — {r.why}</div>)}
                        </div>
                      )}
                      {!!ai.done.typed && (
                        <div style={{ marginTop: '4px', color: T.textDim }}>
                          {'유형 — ' + Object.entries(hwpx.items.reduce(function (m, it) {
                            if (it.aiType) m[it.aiType] = (m[it.aiType] || 0) + 1;
                            return m;
                          }, {})).sort(function (a, b) { return b[1] - a[1]; })
                            .map(function (e) { return e[0] + ' ' + e[1]; }).join(' · ')}
                        </div>
                      )}
                      {!!ai.done.unchecked.length && (
                        <div style={{ marginTop: '3px', color: T.textFaint }}>
                          {ai.done.unchecked.join(', ') + '번은 대조하지 못했습니다(그대로 뒀습니다).'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              <span style={{ display: 'block', fontSize: '12px', color: T.textDim, marginBottom: '4px' }}>주</span>
              <select style={Object.assign({}, inputS, { width: '100%', boxSizing: 'border-box' })}
                value={editTest.week_start} onChange={(e) => setWeek(e.target.value)}>
                {(weekOpts.indexOf(editTest.week_start) < 0 ? [editTest.week_start].concat(weekOpts) : weekOpts).map((w) => {
                  const n = weekCount[w] || 0;
                  return <option key={w} value={w}>{waWeekName(w) + ' (' + waWeekSpan(w) + ')' + (n ? ' · 이 반 시험지 ' + n + '개' : '')}</option>;
                })}
              </select>
            </label>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: T.textDim }}>보는 반 <b style={{ color: T.text }}>{(editTest.class_ids || []).length}개</b></span>
                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: T.textDim, cursor: 'pointer' }}>
                  <input type="checkbox" checked={allCls} onChange={(e) => setAllCls(e.target.checked)} />
                  <span>전체 반 보기</span>
                </label>
              </div>
              {!!(editTest.class_ids || []).length && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                  {(editTest.class_ids || []).map((id) => (
                    <button key={id} onClick={() => toggleCls(id)} title="빼기"
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        borderRadius: '9999px', padding: '3px 8px 3px 10px', fontSize: '12px',
                        background: dark ? 'rgba(0,102,204,0.26)' : 'rgba(0,102,204,0.12)', color: PC }}>
                      <span>{(clsById.get(id) || {}).name || id}</span>
                      <span style={{ fontSize: '13px', lineHeight: '13px', opacity: 0.75 }}>×</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ maxHeight: '172px', overflowY: 'auto', border: '1px solid ' + T.divider, borderRadius: '10px', padding: '4px' }}>
                {pickClasses.length ? pickClasses.map((c) => {
                  const on = (editTest.class_ids || []).indexOf(c.c_id) >= 0;
                  return (
                    <label key={c.c_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', background: on ? (dark ? 'rgba(0,102,204,0.18)' : 'rgba(0,102,204,0.08)') : 'transparent' }}>
                      <input type="checkbox" checked={on} onChange={() => toggleCls(c.c_id)} />
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      <span style={{ flex: 'none', fontSize: '11.5px', color: T.textFaint }}>{students.filter((s) => (s.class_ids || []).indexOf(c.c_id) >= 0).length}명</span>
                    </label>
                  );
                }) : <div style={{ padding: '18px 8px', textAlign: 'center', fontSize: '12.5px', color: T.textFaint }}>{'‘' + (editTest.teacher || userName) + '’ 담당 영어 반이 없습니다 — 전체 반 보기를 켜세요.'}</div>}
              </div>
            </div>
            {[['title', '시험 이름', waWeekTitle(editTest.week_start)], ['teacher', '담당 강사', userName || ''], ['range_text', '시험 범위', '고1 2025년 9월'], ['item_count', '문항 수', '']].map(([k, label, ph]) => (
              <label key={k} style={{ display: 'block', marginBottom: '10px' }}>
                <span style={{ display: 'block', fontSize: '12px', color: T.textDim, marginBottom: '4px' }}>{label}</span>
                <input style={Object.assign({}, inputS, { width: '100%', boxSizing: 'border-box' })} type="text"
                  placeholder={ph} value={editTest[k]}
                  onChange={(e) => { const v = e.target.value; setEditTest((f) => Object.assign({}, f, { [k]: v })); }} />
              </label>
            ))}
            {!!editErr && (
              <div style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.55,
                background: 'rgba(224,49,49,0.10)', border: '1px solid rgba(224,49,49,0.35)', color: '#e03131' }}>{editErr}</div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button style={Object.assign({}, btnS(false), { marginLeft: 'auto' })} onClick={() => setEditTest(null)}>취소</button>
              <button style={btnS(true)} disabled={busy} onClick={saveTest}>{busy ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: '9999px', background: 'rgba(29,29,31,0.88)', color: '#fff', fontSize: '13px', zIndex: 50 }}>{toast}</div>}
    </div>
  );
}
