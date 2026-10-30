// App — 지문 스튜디오 워크스페이스(8개 모드 · 내보내기 · 주문파일)
// index.html 에서 분리(2026-07-29). 로드 순서는 index.html 의 script 태그 순서가 결정한다.
function App({ perms, name, dark, onLogout, onHome }) {
  // 권한 판정은 01-core.js 의 PERM_GROUPS 한 곳에서만 한다. 여기서 boolean 을 새로 만들지 말 것.
  const creator = permGroupKey(perms) === '제작자'; // 제작자는 해석 가리기 버튼을 쓰지 않는다
  const isAdmin = permGroupKey(perms) === '개발자';  // 삽화 패널의 관리자 도구(기준 캐릭터·자유 생성)
  // name 은 **권한 판정에 쓰지 않는다.** 삽화 패널에 작성자 이름으로만 넘긴다.
  const [srcTab, setSrcTab] = useState('mock');
  const [mockGrade, setMockGrade] = useState('고1');
  const [mockYear, setMockYear] = useState('2025년');
  const [openMonth, setOpenMonth] = useState('');
  const [bookGrade, setBookGrade] = useState('고1');
  const [openBook, setOpenBook] = useState('능률(민) 공통영어 1');
  const [openLesson, setOpenLesson] = useState('능률(민) 공통영어 1|1과');
  const [ebsGrade, setEbsGrade] = useState('고3');
  const [openEbsBook, setOpenEbsBook] = useState('수능특강 영어');
  const [openEbsGang, setOpenEbsGang] = useState('수능특강 영어|1강');
  const [openSchool, setOpenSchool] = useState('원당고등학교');
  const [openSchoolGrade, setOpenSchoolGrade] = useState('원당고등학교|고2');
  const [openEtc, setOpenEtc] = useState(''); // 기타 단어장: 펼친 그룹 이름
  const [openEtcSub, setOpenEtcSub] = useState(''); // 기타 단어장 3단계: 펼친 하위그룹 (group|sub)
  const [etcRange, setEtcRange] = useState({}); // 기타 단어장 단일목록: 이름별 출제 번호 범위 {name:{from,to}}
  const [selList, setSelList] = useState([]);
  const [mode, setMode] = useState(permAllows(perms, 'line') ? 'line' : 'vocab');
  const [pwOpen, setPwOpen] = useState(false);
  const [wipOpen, setWipOpen] = useState(false); // 개발중 모드(변형문제) 클릭 시 안내
  const [hideKo, setHideKo] = useState(false);
  const [rawKo, setRawKo] = useState(false); // 쌩본문: 영어 지문 아래에 한글해석 통째로 표시 on/off
  const [vocabMode, setVocabMode] = useState('list'); // list=단어장(뜻보임) | ko=한글쓰기(해석빈칸) | en=영어쓰기(영어빈칸)
  const [vocabClass, setVocabClass] = useState('');
  const [vocabAnswer, setVocabAnswer] = useState(false); // 시험지 답지(정답 보이기): 좌측만 채우고 우측 비움
  const [vocabImpose, setVocabImpose] = useState(true); // 모아찍기: ON=가로 2부, OFF=세로 A4 단일 표
  const [orderOpen, setOrderOpen] = useState(false); // 선택 지문 순서 변경 패널
  const [dragIdx, setDragIdx] = useState(null); // 순서 패널 드래그 중 인덱스
  const [vocabDate, setVocabDate] = useState(() => { const d = new Date(); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate(); });
  const [showAnswer, setShowAnswer] = useState(false);
  const [seed, setSeed] = useState(3);
  const [wideRaw, setWideRaw] = useState(false);
  const [academyName, setAcademyName] = useState('SL PRIME');
  const [engSerif, setEngSerif] = useState(false);
  const [wbSerul, setWbSerul] = useState(true); // 워크북 서술형(⑤) 포함 여부 토글
  const [tbParts, setTbParts] = useState(['workbook']); // 교재 스코프에서 단어장·손필기 뒤에 넣을 파트들
  const [tbKind, setTbKind] = useState('handwrite'); // 교재 틀(큰 틀): handwrite(손필기)만 구현 · variant(변형문제)·finalnote(파이널노트)는 별개 교재, 파트 구성 협의 중
  const [tbVarTypes, setTbVarTypes] = useState([]); // 변형문제에 넣을 문제 유형(VAR_TYPES 키). **배열 순서 = 파트 순서**(순서 칸에서 바꾼다)
  const [varDrag, setVarDrag] = useState(null); // 순서 칸 드래그 중 인덱스
  const vqCache = useRef(new Map()); // 변형문제 조각 높이 측정 캐시(html → px)
  const [vqTick, setVqTick] = useState(0); // 웹폰트가 늦게 뜨면 캐시를 비우고 다시 잰다
  useEffect(() => {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { vqCache.current.clear(); setVqTick(t => t + 1); });
  }, []);
  const [varSeq, setVarSeq] = useState('passage');
  const [varAnsExp, setVarAnsExp] = useState(true);     // 정답지 ① 정답 및 해설(해설 없는 문항은 정답만)
  const [varAnsQuick, setVarAnsQuick] = useState(true); // 정답지 ② 빠른 정답표
  const [ansOnly, setAnsOnly] = useState(false);         // 답지 다운로드 중: 정답지 페이지만 남겨 PDF로 찍는다 // 각 파트 **안**의 문항 순서: passage(지문순) | random(랜덤순). 파트끼리 순서는 tbVarTypes
  const [scopeDesign, setScopeDesign] = useState('normal'); // 스코프 디자인 프리셋
  const [designOpen, setDesignOpen] = useState(false);      // 디자인 드롭다운 열림
  const [orderExport, setOrderExport] = useState(false); // 주문파일 렌더 중(도련 용지 + 임베드 가능 폰트로 전환)
  const [pressResult, setPressResult] = useState(null);  // 주문파일 저장 결과(규격·색 변환표·프리플라이트)
  const [pptBusy, setPptBusy] = useState(false); // PPT 다운로드 진행 중
  // dark는 Shell에서 prop으로 전달됨(앱 전체 공통)
  // 워크시트 포인트 색상 (블루/레드/옐로우). 옐로우는 흰 종이 시인성 위해 진한 골드.
  const POINT_COLORS = { blue: { main: '#0066cc', soft: '#eef3fb', pale: '#66a3e0' }, red: { main: '#d92d2d', soft: '#fdeeee', pale: '#e08a8a' }, yellow: { main: '#c99000', soft: '#f8f1dd', pale: '#d8b25a' } };
  const [pointKey, setPointKey] = useState(() => { try { return localStorage.getItem('sl-point') || 'blue'; } catch (e) { return 'blue'; } });
  useLayoutEffect(() => { try { localStorage.setItem('sl-point', pointKey); } catch (e) {} }, [pointKey]);
  const [customColor, setCustomColor] = useState(() => { try { return localStorage.getItem('sl-point-custom') || '#7c3aed'; } catch (e) { return '#7c3aed'; } });
  useLayoutEffect(() => { try { localStorage.setItem('sl-point-custom', customColor); } catch (e) {} }, [customColor]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerBoxRef = useRef(null);
  // 커스텀 색 드롭다운: 바깥 클릭 시 닫기 — z-index/스택킹에 의존하는 백드롭 대신 document 레벨로 감지(본문 영역 클릭도 확실히 닫힘)
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e) => { if (pickerBoxRef.current && !pickerBoxRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [pickerOpen]);
  const customPCT = { main: customColor, soft: pcTint(customColor, 0.88), pale: pcTint(customColor, 0.5) };
  // 포인트 색상은 교재 제작에서만 적용, 나머지 모드는 항상 기본 블루
  const PCT = (mode === 'textbook' ? (pointKey === 'custom' ? customPCT : POINT_COLORS[pointKey]) : POINT_COLORS.blue) || POINT_COLORS.blue;
  const PC = PCT.main, PCsoft = PCT.soft, PCpale = PCT.pale;
  // 스코프 디자인 프리셋 (Normal + 3종). 교재 제작에서만 적용, 나머지는 Normal.
  const DESIGNS = {
    // 현재 표준
    normal: { name: 'Normal', kind: 'normal', pageBg: '#ffffff', rowExtra: 0, koColor: '#6e6e73' },
    // 매거진 — 상단에 통짜 컬러 헤더 밴드(내셔널지오그래픽/에디토리얼)
    mag: { name: '매거진', kind: 'mag', pageBg: '#ffffff', rowExtra: 0, koColor: '#5c5c62' },
    // 카드 — 연한 톤 종이 위에 흰색 라운드 카드 문장(앱/듀오링고)
    card: { name: '카드', kind: 'card', pageBg: '#ffffff', rowExtra: 0, koColor: '#5b6068' },
    // 노트 — 줄노트 종이 + 좌측 여백선(컴포지션 노트/단어장)
    note: { name: '노트', kind: 'note', pageBg: '#ffffff', rowExtra: 0, koColor: '#54606a' },
  };
  const DZ = (mode === 'textbook' ? (DESIGNS[scopeDesign] || DESIGNS.normal) : DESIGNS.normal);
  // 테마 색상 (워크시트 종이는 항상 흰색, 앱 UI만 다크)
  const T = THEME(dark);

  // 상단 캡슐(모의고사/교과서/EBS/학교별) 전환 시 하위 트리(월·책·강·학교 펼침)를 모두 닫는다
  const switchSrc = (k) => {
    setSrcTab(k);
    setOpenMonth(''); setOpenBook(''); setOpenLesson('');
    setOpenEbsBook(''); setOpenEbsGang(''); setOpenSchool(''); setOpenSchoolGrade('');
  };
  // 기타 단어장은 단어 업무 전용 → 다른 모드로 가면 모의고사 소스로 복귀
  useEffect(() => { if (mode !== 'vocab' && srcTab === 'etc') setSrcTab('mock'); }, [mode, srcTab]);
  // 교과서 학년(고1↔고2)을 바꾸면 교재 목록이 통째로 달라진다 → 이전 학년에서 펼쳐둔 교재·과를 닫는다
  useEffect(() => { setOpenBook(''); setOpenLesson(''); }, [bookGrade]);

  // 리퀴드 글라스 스위처: 모드 전환 시 유리 알약이 좌우로 늘었다 복원 (scaleToggle)
  const ALL_MODES = [{ key: 'line', label: '한줄해석' }, { key: 'ppt', label: 'PPT' }, { key: 'gukl', label: '구클' }, { key: 'order', label: '한문장배열' }, { key: 'raw', label: '쌩지문' }, { key: 'illust', label: '삽화' }, { key: 'vocab', label: '단어' }, { key: 'variant', label: '변형문제' }, { key: 'workbook', label: '워크북' }, { key: 'weekly', label: '주간테스트' }, { key: 'textbook', label: '교재 제작' }];
  // 어느 그룹이 무엇을 보는지는 01-core.js 의 PERM_GROUPS 표가 정한다. 삽화는 제작자 그룹(+관리자).
  const MODES = ALL_MODES.filter(m => permAllows(perms, m.key));
  // 권한이 없는 모드에 머물러 있으면 첫 모드로 되돌린다(그룹이 바뀌었을 때)
  useEffect(() => { if (MODES.length && !MODES.some(m => m.key === mode)) setMode(MODES[0].key); }, [mode, perms]);
  const modeIndex = MODES.findIndex(m => m.key === mode);
  const thumbRef = useRef(null);
  const firstRenderRef = useRef(true);
  useLayoutEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    const el = thumbRef.current;
    if (el && el.animate) {
      el.animate(
        [{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.16)' }, { transform: 'scaleX(1)' }],
        { duration: 500, easing: 'cubic-bezier(0.34, 1.4, 0.5, 1)' }
      );
    }
  }, [mode]);

  // 사이드바 소스 스위처 (모의고사 / 교과서)
  const SRC_TABS = [{ key: 'mock', label: '모의고사' }, { key: 'book', label: '교과서' }, { key: 'ebs', label: 'EBS' }, { key: 'school', label: '학교별' }];
  const srcIndex = SRC_TABS.findIndex(s => s.key === srcTab);
  const srcThumbRef = useRef(null);
  const srcFirstRef = useRef(true);
  useLayoutEffect(() => {
    if (srcFirstRef.current) { srcFirstRef.current = false; return; }
    const el = srcThumbRef.current;
    if (el && el.animate) {
      el.animate(
        [{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.16)' }, { transform: 'scaleX(1)' }],
        { duration: 500, easing: 'cubic-bezier(0.34, 1.4, 0.5, 1)' }
      );
    }
  }, [srcTab]);

  const isSelected = (sel) => {
    const k = selKey(sel);
    return selList.some(s => selKey(s) === k);
  };
  const toggleSel = (sel) => {
    const k = selKey(sel);
    setSelList(list => {
      if (list.some(x => selKey(x) === k)) return list.filter(x => selKey(x) !== k);
      // 새 지문은 지문순서 위치에 삽입(기존 수동 순서는 유지)
      const idx = list.findIndex(x => cmpSel(x, sel) > 0);
      const arr = [...list];
      if (idx === -1) arr.push(sel); else arr.splice(idx, 0, sel);
      return arr;
    });
  };
  // 드래그로 여러 지문을 한 번에 선택/해제 (칠하기)
  const applySel = (sel, on) => {
    const k = selKey(sel);
    setSelList(list => {
      const has = list.some(x => selKey(x) === k);
      if (on && !has) {
        const idx = list.findIndex(x => cmpSel(x, sel) > 0);
        const arr = [...list];
        if (idx === -1) arr.push(sel); else arr.splice(idx, 0, sel);
        return arr;
      }
      if (!on && has) return list.filter(x => selKey(x) !== k);
      return list;
    });
  };
  // 여러 지문을 한 번에 선택/해제 (교과서: 과 단위로 본문 전체를 켜고 끈다)
  const applyMany = (targets, on) => { targets.forEach(t => applySel(t, on)); };
  const paintRef = useRef(null); // true=선택 칠하기, false=해제 칠하기, null=드래그 안함
  const startPaint = (t) => { const on = !isSelected(t); paintRef.current = on; applySel(t, on); };
  const paintOver = (t) => { if (paintRef.current !== null) applySel(t, paintRef.current); };
  useEffect(() => {
    const end = () => { paintRef.current = null; };
    window.addEventListener('mouseup', end);
    return () => window.removeEventListener('mouseup', end);
  }, []);
  const moveSel = (i, dir) => setSelList(list => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const arr = [...list];
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    return arr;
  });
  const ordBtn = (disabled) => ({ flex: 'none', width: '22px', height: '22px', border: '1px solid ' + T.panelBorder, background: T.emptyCardBg, borderRadius: '6px', cursor: disabled ? 'default' : 'pointer', color: disabled ? T.textFaint : T.textDim, fontSize: '10px', opacity: disabled ? 0.4 : 1, fontFamily: 'inherit', padding: 0, lineHeight: 1 });
  const reorderSel = (from, to) => setSelList(list => {
    if (from == null || to == null || from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
    const arr = [...list]; const [it] = arr.splice(from, 1); arr.splice(to, 0, it); return arr;
  });
  const toggleAllExam = (targets, allSel) => {
    setSelList(list => {
      const keys = targets.map(t => selKey(t));
      const rest = list.filter(x => !keys.includes(selKey(x)));
      return allSel ? rest : [...rest, ...targets];
    });
  };

  // 시트에 쓰는 글꼴은 번들 폰트로 못박는다(index.html 의 @font-face).
  // OS 기본값에 맡기면 PC마다 한글이 달라지고, 그 글꼴이 PDF 에 임베드되지 않으면 인쇄소에서 깨진다.
  const engFontFamily = engSerif
    ? "Georgia, 'Times New Roman', 'Spoqa Han Sans Neo', 'Malgun Gothic', serif"
    : "Inter, 'Spoqa Han Sans Neo', 'Malgun Gothic', sans-serif";
  const enFam = DZ.enSerif ? "Georgia, 'Times New Roman', serif" : engFontFamily; // 세리프 디자인은 항상 세리프

  // ---- style helpers (ported) ----
  const segStyle = (sel) => ({
    flex: 1, border: 'none', cursor: 'pointer', borderRadius: '9999px', padding: '7px 0',
    fontSize: '13px', fontWeight: sel ? 600 : 400, fontFamily: 'inherit', letterSpacing: '-0.1px',
    background: sel ? '#ffffff' : 'transparent', color: sel ? '#0066cc' : '#1d1d1f',
    boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: EASE
  });
  const leafStyle = (sel, indent) => ({
    display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%', textAlign: 'left',
    padding: '9px 12px 9px ' + (indent ? '20px' : '12px'),
    borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    background: sel ? 'rgba(0,102,204,0.10)' : 'transparent', transition: 'background 0.14s cubic-bezier(0.4,0,0.2,1)'
  });
  const leafLabelStyle = (sel) => ({
    display: 'block', fontSize: '14px', fontWeight: 600, letterSpacing: '-0.1px',
    color: sel ? '#0066cc' : T.text
  });
  const tabStyle = (sel) => ({
    border: 'none', cursor: 'pointer', borderRadius: '9999px', padding: '7px 18px',
    fontSize: '14px', fontWeight: sel ? 600 : 400, fontFamily: 'inherit', letterSpacing: '-0.1px',
    background: sel ? '#ffffff' : 'transparent', color: sel ? '#0066cc' : '#1d1d1f',
    boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: EASE
  });
  const chipStyle = (active) => ({
    border: '1px solid ' + (active ? 'rgba(0,102,204,0.4)' : (dark ? 'rgba(255,255,255,0.14)' : '#d2d2d7')),
    cursor: 'pointer', borderRadius: '9999px', padding: '6px 14px',
    fontSize: '13px', fontFamily: 'inherit', letterSpacing: '-0.1px',
    background: active ? (dark ? 'rgba(77,159,255,0.16)' : 'rgba(0,102,204,0.08)') : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)'),
    color: active ? (dark ? '#4d9fff' : '#0066cc') : T.text, transition: EASE
  });
  // EBS·학교별은 학년 선택칩 없음 (EBS는 고3 고정)
  // 교과서는 중1~고2. 교재가 아직 없는 학년도 슬롯은 띄워 둔다(지문을 넣으면 교재가 자동으로 뜬다).
  const gradeList = srcTab === 'mock' ? ['고1', '고2', '고3'] : srcTab === 'book' ? ['중1', '중2', '중3', '고1', '고2'] : [];
  const curGrade = srcTab === 'mock' ? mockGrade : bookGrade;
  const setGrade = (g) => {
    if (srcTab === 'mock') setMockGrade(g);
    else { setBookGrade(g); setOpenBook(booksFor(g)[0]); }
  };
  // 단어 모드에서만 지문 없이 단어만 있는 회차(고3 2019·2020년·수능 등)까지 목록에 넣는다.
  // 다른 모드에서 켜면 지문이 없는 회차가 떠서 빈 자료가 나온다.
  const vocabTree = (mode === 'vocab');
  const monthList = availMonths(mockGrade, mockYear, vocabTree);
  // 과 목록: 지문이 들어온 교재는 실제 있는 과만 보여준다(3과까지면 3과까지, 5과가 있으면 5과까지).
  // 아직 지문이 없는 교재만 기본 4과를 미리 띄워 둔다.
  const lessonsFor = (grade, book) => {
    const prefix = 'book|' + grade + '|' + book + '|';
    const found = [];
    Object.keys(window.PASSAGES || {}).forEach(k => {
      if (!k.startsWith(prefix)) return;
      const l = k.split('|')[3];
      if (l && found.indexOf(l) < 0) found.push(l);
    });
    const no = (s) => { const m = String(s).match(/\d+/); return m ? parseInt(m[0], 10) : 9999; };
    if (found.length) return found.sort((a, b) => no(a) - no(b) || String(a).localeCompare(String(b)));
    return ['1과', '2과', '3과', '4과'];
  };

  // 교재/EBS/학교별 공통 3단계 트리 렌더러 (상위 → 중위 → 지문 체크박스)
  const renderTree = (cfg) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {/* 교재가 아직 없는 학년(중1~중3 등)은 빈 화면이 아니라 안내를 띄운다 */}
      {cfg.l0Items.length === 0 && (
        <div style={{ padding: '18px 12px', fontSize: '13px', lineHeight: 1.6, color: '#86868b', letterSpacing: '-0.1px' }}>
          아직 등록된 교재가 없습니다.<br />지문을 넣으면 교재와 과가 자동으로 나타납니다.
        </div>
      )}
      {cfg.l0Items.map(l0 => {
        const l0open = cfg.l0Open === l0;
        return (
          <div key={l0} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <button onClick={() => cfg.setL0Open(l0open ? null : l0)} style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, letterSpacing: '-0.1px', color: T.text, background: 'transparent', textAlign: 'left' }}>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l0}</span>
              <span style={{ flex: 'none', color: '#86868b', fontSize: '16px', display: 'inline-block', transform: l0open ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s cubic-bezier(0.4,0,0.2,1)' }}>›</span>
            </button>
            {l0open && cfg.l1ItemsFor(l0).map(l1 => {
              const l1key = l0 + '|' + l1;
              const l1open = cfg.l1Open === l1key;
              const units = cfg.l2ItemsFor(l0, l1).map(u => ({ label: u, target: cfg.makeTarget(l0, l1, u) }));
              const uCount = units.filter(u => isSelected(u.target)).length;
              // 교과서: 과 아래에 [본문] + [부록류] 를 체크박스로 둔다.
              // 본문은 지문이 몇 개든(지문 1…지문 7) **한 줄로 묶어** 통째로 선택/해제한다.
              if (cfg.groupSelect) {
                const main = units.filter(u => unitOrder(u.label) < 10000);
                const extra = units.filter(u => unitOrder(u.label) >= 10000);
                const mainOn = main.length > 0 && main.every(u => isSelected(u.target));
                const mainSome = main.some(u => isSelected(u.target));
                const rowStyle = (on) => ({ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '9px 12px 9px 36px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: on ? 'rgba(0,102,204,0.10)' : 'transparent', transition: 'background 0.14s cubic-bezier(0.4,0,0.2,1)' });
                return (
                  <div key={l1} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* 과 머리글 — 아래 본문·부록 줄보다 확실히 눈에 띄게(실선 + 굵은 글씨) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 12px 6px 20px' }}>
                      <span style={{ flex: 'none', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.2px', color: T.text }}>{l1}</span>
                      <span style={{ flex: 1, height: '1px', background: dark ? 'rgba(255,255,255,0.12)' : '#e5e5ea' }}></span>
                    </div>
                    {main.length > 0 && (
                      <button onClick={() => applyMany(main.map(u => u.target), !mainOn)} style={rowStyle(mainSome)}>
                        <CheckBox checked={mainOn} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={leafLabelStyle(mainSome)}>{cfg.leafWord}</span>
                          <span style={{ display: 'block', fontSize: '12px', color: '#86868b', marginTop: '2px' }}>
                            {mainSome && !mainOn
                              ? (main.filter(u => isSelected(u.target)).length + ' / ' + main.length + '개 선택됨')
                              : (main.length > 1 ? '지문 ' + main.length + '개' : passageFor(main[0].target).title)}
                          </span>
                        </span>
                      </button>
                    )}
                    {extra.map(u => {
                      const sel = isSelected(u.target);
                      return (
                        <button key={u.label} onClick={() => toggleSel(u.target)} style={rowStyle(sel)}>
                          <CheckBox checked={sel} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={leafLabelStyle(sel)}>{u.label}</span>
                            <span style={{ display: 'block', fontSize: '12px', color: '#86868b', marginTop: '2px' }}>{passageFor(u.target).title}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              }
              return (
                <div key={l1} style={{ display: 'flex', flexDirection: 'column' }}>
                  <button onClick={() => cfg.setL1Open(l1open ? null : l1key)} style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 12px 9px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: uCount > 0 ? 'rgba(0,102,204,0.06)' : 'transparent', transition: 'background 0.14s cubic-bezier(0.4,0,0.2,1)' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={leafLabelStyle(uCount > 0)}>{l1}{cfg.l1Suffix && <span style={{ fontWeight: 400, fontSize: '12px', color: '#86868b', marginLeft: '5px' }}>{cfg.l1Suffix}</span>}</span>
                      <span style={{ display: 'block', fontSize: '12px', color: '#86868b', marginTop: '2px' }}>{uCount > 0 ? uCount + '개 ' + cfg.leafWord + ' 선택됨' : cfg.leafWord + ' ' + units.length + '개'}</span>
                    </span>
                    <span style={{ flex: 'none', color: '#86868b', fontSize: '16px', display: 'inline-block', transform: l1open ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s cubic-bezier(0.4,0,0.2,1)' }}>›</span>
                  </button>
                  {l1open && units.map(u => {
                    const sel = isSelected(u.target);
                    return (
                      <button key={u.label} onClick={() => toggleSel(u.target)} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '9px 12px 9px 36px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: sel ? 'rgba(0,102,204,0.10)' : 'transparent', transition: 'background 0.14s cubic-bezier(0.4,0,0.2,1)' }}>
                        <CheckBox checked={sel} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={leafLabelStyle(sel)}>{u.label}</span>
                          <span style={{ display: 'block', fontSize: '12px', color: '#86868b', marginTop: '2px' }}>{passageFor(u.target).title}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
  const bookCfg = { l0Items: booksFor(bookGrade), l0Open: openBook, setL0Open: setOpenBook, l1ItemsFor: (b) => lessonsFor(bookGrade, b), l1Open: openLesson, setL1Open: setOpenLesson, l2ItemsFor: (b, l) => unitsFor(bookGrade, b, l), makeTarget: (b, l, u) => ({ kind: 'book', grade: bookGrade, book: b, lesson: l, unit: u }), leafWord: '본문', groupSelect: true };
  const ebsCfg = { l0Items: ebsBooksFor(ebsGrade), l0Open: openEbsBook, setL0Open: setOpenEbsBook, l1ItemsFor: () => ['1강', '2강', '3강', '4강'], l1Open: openEbsGang, setL1Open: setOpenEbsGang, l2ItemsFor: () => ['지문 1', '지문 2'], makeTarget: (b, g, u) => ({ kind: 'ebs', grade: ebsGrade, book: b, gang: g, unit: u }), leafWord: '지문' };
  // 학교·학년·지문 목록은 전부 DB(PASSAGES)에서 뽑는다 — 지문을 넣으면 코드 수정 없이 뜬다(교과서와 같은 원칙).
  const schoolCfg = { l0Items: schoolList(), l0Open: openSchool, setL0Open: setOpenSchool, l1ItemsFor: (s) => schoolGradesFor(s), l1Open: openSchoolGrade, setL1Open: setOpenSchoolGrade, l2ItemsFor: (s, gr) => schoolUnitsFor(s, gr), makeTarget: (s, gr, u) => ({ kind: 'school', school: s, grade: gr, unit: u }), leafWord: '지문', l1Suffix: '(예상범위)' };

  const titles = { line: '한줄해석', ppt: '수업용 PPT', gukl: '구클', order: '한 문장 배열', raw: '쌩지문', vocab: '단어장', variant: '변형문제', workbook: '워크북', weekly: '주간테스트' };
  const dirs = {
    line: (hideKo && mode !== 'textbook') ? '각 문장을 읽고 해석을 아래 줄에 쓰시오.' : '각 문장과 해석을 확인하며 정독하시오.',
    gukl: '각 문장을 읽고 해석을 아래에 쓰시오.',
    order: '다음 문장들을 글의 흐름에 맞게 배열하시오.',
    raw: rawKo ? '다음 글과 해석을 확인하며 정독하시오.' : '다음 글을 읽고 스스로 해석하시오.',
    vocab: '단어와 뜻을 확인하며 암기하시오.',
    variant: '지문을 바탕으로 한 변형문제입니다.',
    weekly: '이번 주 학습 지문 주간 테스트입니다.'
  };
  // 단어장 계열(뜻이 보이는 목록형): 단어장 / 교재 단어장. 나머지(ko·en)는 시험형.
  const listLike = (vocabMode === 'list' || vocabMode === 'book'); // book도 뜻이 보이는 목록형(셔플·답 버튼 없음)
  const bookMode = (mode === 'textbook');             // 교재 제작 전용: 교재 단어장(세로 A4·헤더 없음·깔끔한 표)
  // 교재 단어장 '디자인'을 쓰는 경우: 교재 제작 + 단어 모드의 교재단어장 캡슐.
  // 단어 모드 쪽은 교재의 홀짝·메모(마진 규칙) 없이 표준 중앙 여백으로 뽑는다.
  const bookVocab = bookMode || (mode === 'vocab' && vocabMode === 'book');
  const imposeOn = vocabImpose && !bookVocab;         // 일반 단어장·시험지의 가로 2부
  const bookImpose = mode === 'vocab' && vocabMode === 'book' && vocabImpose; // 교재단어장 모아찍기(가로 2단, 교재 제작에는 없음)
  const vocabTitle = (vocabMode === 'list' ? '단어장' : vocabMode === 'book' ? '교재 단어장' : (vocabMode === 'ko' ? '단어 시험 (뜻 쓰기)' : '단어 시험 (영어 쓰기)')) + (vocabAnswer && !listLike ? ' 〈정답〉' : '');
  const sheetTitle = mode === 'vocab' ? vocabTitle : titles[mode];
  const directions = dirs[mode];
  const vocabRange = (() => { // 단어 출처 범위 표기
    if (!selList.length) return '';
    const src = selList;
    const nums = src.map(s => (s.num != null ? String(s.num) : '')).filter(Boolean);
    const head = sourceLabel(src[0]).replace(/\s*\d+번?$/, '');
    return nums.length ? (head + ' ' + nums.join('·') + '번') : sourceLabel(src[0]);
  })();

  const sheets = selList.map(sel => {
    const p = passageFor(sel);
    const n = p.sentences.length;
    const idx = shuffledIdx(n, seed * 7 + hashStr(selKey(sel)));
    const answerSeq = Array.from({ length: n }, (_, orig) => alphaLabel(idx.indexOf(orig))).join(' → ');
    return {
      key: selKey(sel),
      passageSource: sourceLabel(sel),
      passageTitle: p.title,
      passageEng: p.eng || '',
      passageNum: sel.num !== undefined ? sel.num : '',
      label: labelParts(sel),
      bookGrp: bookGroup(sel),
      lineItems: p.sentences.map((s, i) => ({ num: String(i + 1).padStart(2, '0'), en: s.en, ko: s.ko })),
      orderItems: idx.map((orig, pos) => ({ label: alphaLabel(pos), en: p.sentences[orig].en })),
      answerSeq,
      rawText: p.sentences.map(s => s.en).join(' '),
      rawKoText: p.sentences.map(s => s.ko).join(' '),
      rawSentences: p.sentences.map(s => s.en),
      vocab: vocabFor(sel)
    };
  });

  // ── 수업용 PPT: 선택된 지문으로 슬라이드 계획(화면 미리보기용) ──
  const pptItems = mode === 'ppt' ? sheets.map(sh => ({ key: sh.key, passageEng: sh.passageEng, passageTitle: sh.passageTitle, rawSentences: sh.rawSentences })) : [];
  const pptSlides = mode === 'ppt' ? pptPlanSlides(pptItems) : [];
  const doPpt = async () => {
    if (!window.desktopSavePPT) { alert('PPT 다운로드는 데스크톱 앱에서만 가능합니다.\n(브라우저 미리보기에서는 파일 저장을 할 수 없습니다)'); return; }
    if (!pptItems.length) return;
    setPptBusy(true);
    try {
      const first = pptParseKey(pptItems[0].key);
      const filename = (first.kind === 'mock' ? (first.year + '_' + first.month + '_고' + first.grade.replace('고', '') + '영어_PPT')
        : first.kind === 'book' ? (first.book + '_' + pptItems.map(it => pptParseKey(it.key).lesson).filter((v, i, a) => v && a.indexOf(v) === i).join(',') + '과_PPT')
        : '수업용PPT') + '.pptx';
      const res = await window.desktopSavePPT({ items: pptItems, filename });
      if (res && !res.ok && !res.canceled) alert('PPT를 만들지 못했습니다.\n\n' + (res.error || '알 수 없는 오류'));
    } finally {
      setPptBusy(false);
    }
  };

  // ── A4 페이지 분할: 지문이 한 장을 넘치면 다음 페이지로 ──
  const rawLeading = 2.85; // 쌩본문 기본 줄간격 (기존 1.9의 1.5배)
  // 여백: 상단 8mm(30px), 하단 12pt 한글 한 줄(24px). 헤더 자체 높이 ≈104px(실측, 라벨 40px 기준).
  const PAD_TOP = 30;
  const PAD_BOTTOM = 24;
  const HEAD_H = PAD_TOP + 104;
  const BODY_CAP = 1123 - PAD_TOP - PAD_BOTTOM - 223; // order 한 장 본문 가용 높이(px)
  const LINE_CAP_FIRST = 1123 - HEAD_H - PAD_BOTTOM;  // 한줄해석 헤더 있는 첫 장
  const LINE_CAP_REST = 1123 - PAD_TOP - PAD_BOTTOM;  // 한줄해석 헤더 없는 이어지는 장
  const RAW_LH = rawLeading * 17;                                          // 쌩본문 줄 높이(≈48.45px)
  const RAW_CPL = 77;                                                      // 쌩본문 한 줄 글자 수(실측 ~79, 보수적)
  const RAW_LINES_FIRST = Math.floor((1123 - HEAD_H - PAD_BOTTOM) / RAW_LH);  // 헤더 있는 첫 장 최대 줄
  const RAW_LINES_REST = Math.floor((1123 - PAD_TOP - PAD_BOTTOM) / RAW_LH);    // 이어지는 장 최대 줄
  // 쌩본문 블록(2페이지 하단) 높이 추정: 구분선+라벨 + 본문 줄(13.5×1.75≈23.6), 한 줄 ≈95자
  const rawBlockH = (txt) => 50 + Math.max(1, Math.ceil((txt || '').length / 94)) * 23.6;
  const EN_LH = 2.89;            // 한줄해석 영문 기본 줄간격(기존 1.65의 1.75배)
  const EN_LH_MIN_SCALE = 0.8;   // 2페이지에 안 들어가면 여기까지만 줄인다
  const EN_LH_MAX_SCALE = 1.3;   // 아래 '전체 지문'이 빠져 자리가 비면 여기까지 넓힌다(손필기 공간)
  // 글자 크기: 일반 한줄해석 = 영문 16.5px(12.4pt)/한글 14.5px(10.9pt), 교재 제작 = 영문 11pt/한글 10pt
  // 교재 스코프에 쌩지문 파트가 따로 들어가면 손필기 아래 '전체 지문'을 빼고(같은 본문이 두 번
  // 실리므로), 비는 자리를 글자 크기와 줄간격에 돌려준다. EN_PX/KO_PX 는 한줄해석 경로에서만
  // 쓰이므로(estLineH 와 line 렌더) 구클·쌩지문·배열 면에는 영향이 없다.
  const tbRawPart = mode === 'textbook' && tbParts.includes('raw');
  const EN_PX_BASE = bookMode ? 14.67 : 16.5;
  const KO_PX_BASE = bookMode ? 13.33 : 14.5;
  // 글자를 키우면 한 줄 글자 수가 줄어 줄이 늘어난다 → 긴 지문이 3쪽으로 밀린다.
  // 고정값을 쓰면 회차마다 결과가 들쭉날쭉하므로, **고른 지문이 전부 2쪽에 들어가는
  // 가장 큰 크기**를 찾아 교재 전체에 똑같이 적용한다(쪽마다 글자 크기가 달라지면 안 된다).
  const lineFitsAll = (px) => {
    const enCpl = Math.round(79 * (16.5 / px));
    const koPx = px * (KO_PX_BASE / EN_PX_BASE);
    const koCpl = Math.round(43 * (14.5 / koPx));
    const h1 = 1123 - (PAD_TOP + 104) - PAD_BOTTOM, h2 = 1123 - PAD_TOP - PAD_BOTTOM;
    return sheets.every((sh) => {
      for (let t = EN_LH_MAX_SCALE; t >= EN_LH_MIN_SCALE - 0.001; t -= 0.02) {
        let pages = 1, used = 0;
        for (const it of sh.lineItems) {
          const en = Math.max(1, Math.ceil((it.en || '').length / enCpl));
          const ko = Math.max(1, Math.ceil((it.ko || '').length / koCpl));
          const h = 25 + en * (px * EN_LH * t) + 6 + ko * (koPx * 1.6);
          if (used > 0 && used + h > (pages === 1 ? h1 : h2)) { pages++; used = 0; }
          used += h;
        }
        if (pages <= 2) return true;
      }
      return false;
    });
  };
  const EN_PX = (!tbRawPart || !sheets.length) ? EN_PX_BASE
    : ([16, 15.8, 15.6, 15.4, 15.2, 15, 14.8].find(lineFitsAll) || EN_PX_BASE);
  const KO_PX = +(EN_PX * (KO_PX_BASE / EN_PX_BASE)).toFixed(2);
  const EN_CPL = Math.round(79 * (16.5 / EN_PX));   // 본문폭 680px 기준 영문 한 줄 글자 수
  const KO_CPL = Math.round(43 * (14.5 / KO_PX));   // 한글 한 줄 글자 수(keep-all 감안 보수적)
  const estLineH = (it, s = 1) => {
    const enLines = Math.max(1, Math.ceil((it.en || '').length / EN_CPL));
    let h = 25 + enLines * (EN_PX * EN_LH * s); // 상하패딩 24 + 보더 1 + 영문 줄
    if (hideKo && mode !== 'textbook') h += 12 + 26;    // 빈 답란(marginTop 12 + 26)
    else { const k = Math.max(1, Math.ceil((it.ko || '').length / KO_CPL)); h += 6 + k * (KO_PX * 1.6); }
    return h + (DZ.rowExtra || 0);   // 디자인별 카드/간격 추가 높이
  };
  const estOrderH = (it) => 42 + Math.max(1, Math.ceil((it.en || '').length / 62)) * 26;
  const chunkRaw = (sents, maxFirst, maxRest) => { // 쌩본문: 누적 글자 수로 줄 수 추정(문장별 반올림 과다계산 방지) → 20mm 하단 여백 유지
    const out = []; let cur = [], chars = 0;
    for (const s of sents) {
      const add = (s || '').length + 1;
      const maxLines = out.length === 0 ? maxFirst : maxRest;
      if (cur.length && Math.ceil((chars + add) / RAW_CPL) > maxLines) { out.push(cur); cur = []; chars = 0; }
      cur.push(s); chars += add;
    }
    if (cur.length) out.push(cur);
    return out.length ? out : [[]];
  };
  // 쌩본문 + 한글해석: 영어 블록 + 구분선 + 한글 블록이 한 장에 들어가도록 픽셀 높이로 자른다.
  const RAW_KO_PX = 14.5, RAW_KO_LEADING = 1.95;
  const RAW_KO_LH = RAW_KO_PX * RAW_KO_LEADING;   // 한글 줄 높이(≈28.3px)
  const RAW_KO_CPL = 40;                          // 한글 한 줄 글자 수(keep-all 감안 보수적)
  const RAW_KO_GAP = 40;                          // 영어/한글 사이 구분선+라벨+여백
  const RAW_CAP_FIRST = 1123 - HEAD_H - PAD_BOTTOM;   // 헤더 있는 첫 장
  const RAW_CAP_REST = 1123 - PAD_TOP - PAD_BOTTOM;   // 이어지는 장
  const chunkRawBoth = (items) => {
    const out = []; let cur = [], enC = 0, koC = 0;
    const blockH = (e, k) => Math.ceil(e / RAW_CPL) * RAW_LH + RAW_KO_GAP + Math.ceil(k / RAW_KO_CPL) * RAW_KO_LH;
    for (const it of items) {
      const eAdd = (it.en || '').length + 1, kAdd = (it.ko || '').length + 1;
      const cap = out.length === 0 ? RAW_CAP_FIRST : RAW_CAP_REST;
      if (cur.length && blockH(enC + eAdd, koC + kAdd) > cap) { out.push(cur); cur = []; enC = 0; koC = 0; }
      cur.push(it); enC += eAdd; koC += kAdd;
    }
    if (cur.length) out.push(cur);
    return out.length ? out : [[]];
  };
  const chunkByHeight = (items, hFn, cap) => {
    const out = []; let cur = [], used = 0;
    for (const it of items) { const h = hFn(it); if (cur.length && used + h > cap) { out.push(cur); cur = []; used = 0; } cur.push(it); used += h; }
    if (cur.length) out.push(cur);
    return out.length ? out : [[]];
  };
  const chunkByHeightH = (items, hFn, capFirst, capRest) => { // 첫 장(헤더 有)과 이어지는 장의 가용 높이가 다를 때
    const out = []; let cur = [], used = 0;
    for (const it of items) { const h = hFn(it); const cap = out.length === 0 ? capFirst : capRest; if (cur.length && used + h > cap) { out.push(cur); cur = []; used = 0; } cur.push(it); used += h; }
    if (cur.length) out.push(cur);
    return out.length ? out : [[]];
  };
  // 교재 파트 구성 + 대전제(선택 범위 요약: "2025년 9월 1학년 모의고사" / "○○ 교과서 · N과")
  // 스코프 구성: PART1 단어장 · PART2 나만의 손필기는 고정이고, 뒤쪽 파트는 칩으로 넣고 뺀다.
  // 워크북은 pageList 뒤에 별도 렌더러로 붙는데 쪽수를 실측한 뒤에야 알 수 있어서(뒤 파트의 쪽번호를
  // 미리 계산할 수 없다) 고른 순서와 무관하게 **항상 맨 마지막 파트**가 된다.
  const TB_EXTRA = [{ k: 'gukl', l: '구클' }, { k: 'order', l: '한문장배열' }, { k: 'raw', l: '쌩지문' }, { k: 'workbook', l: '워크북' }];
  const tbSel = TB_EXTRA.filter(x => tbParts.includes(x.k));
  // 변형문제의 문제 유형. 목록 순서는 '전체' 버튼으로 고를 때의 기본 순서일 뿐이고, 파트 순서는 tbVarTypes(순서 칸)가 정한다.
  const VAR_TYPES = [
    { k: 'mismatch', l: '내용 불일치' }, { k: 'match', l: '내용 일치' }, { k: 'grammar', l: '어법' }, { k: 'vocab', l: '어휘' },
    { k: 'insert', l: '문장 삽입' }, { k: 'order', l: '글의 순서' }, { k: 'connective', l: '연결사' }, { k: 'blank', l: '빈칸' },
    { k: 'gist', l: '요지' }, { k: 'title', l: '제목' }, { k: 'topic', l: '주제' }, { k: 'implied', l: '함축의미' }
  ];
  const varSel = tbVarTypes.map(k => VAR_TYPES.find(x => x.k === k)).filter(Boolean);
  const moveVar = (from, to) => setTbVarTypes(list => {
    if (from == null || to == null || from === to || to < 0 || to >= list.length) return list;
    const arr = [...list]; const [it] = arr.splice(from, 1); arr.splice(to, 0, it); return arr;
  });
  // 고른 유형을 PART 순서로 보여주는 카드. 문항 데이터가 들어오면 이 자리에 실제 문제가 조립된다.
  const varCard = (title) => (
    <div style={{ maxWidth: '560px', margin: '80px auto 0', textAlign: 'center', padding: '40px 34px', borderRadius: '18px', background: T.emptyCardBg, border: '1px solid ' + T.panelBorder }}>
      <div style={{ fontSize: '19px', fontWeight: 700, color: T.text }}>{title}</div>
      {varSel.length ? (
        <div style={{ marginTop: '14px', textAlign: 'left', display: 'inline-block' }}>
          {varSel.map((x, i) => (
            <div key={x.k} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '3px 0', fontSize: '14px', color: T.text }}>
              <span style={{ flex: 'none', width: '52px', fontSize: '11.5px', fontWeight: 700, letterSpacing: '1px', color: dark ? '#4da3ff' : '#0066cc' }}>PART {i + 1}</span>{x.l}
            </div>
          ))}
          <div style={{ fontSize: '12.5px', color: T.textDim, marginTop: '12px', lineHeight: 1.7 }}>각 파트 안 문항은 <b>{varSeq === 'random' ? '랜덤순' : '지문순'}</b>으로 놓입니다.<br />문항 데이터가 들어오면 이 순서로 조립됩니다.</div>
        </div>
      ) : (
        <div style={{ fontSize: '13.5px', color: T.textDim, marginTop: '11px', lineHeight: 1.7 }}>
          왼쪽 <b>문제 유형</b>에서 넣을 유형을 고르세요.<br />고른 유형이 순서대로 파트가 됩니다.
        </div>
      )}
    </div>
  );
  // 서술형(⑤) 포함 여부 — 칩이 아니라 **체크박스**로 둔다. 칩과 같은 알약 모양이면
  // 옆의 '구클·쌩지문' 처럼 파트를 켜는 버튼으로 보여서, 지금 켜져 있는지가 눈에 안 들어온다.
  const serulCheck = (
    <label key="serul" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '7px', height: '30px', padding: '0 12px 0 10px', borderRadius: '9px', border: '1px solid ' + T.panelBorder, background: T.emptyCardBg, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', letterSpacing: '-0.1px', color: T.text, WebkitUserSelect: 'none', userSelect: 'none', transition: EASE }}>
      <input type="checkbox" checked={wbSerul} onChange={() => setWbSerul(v => !v)}
        style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, margin: 0, pointerEvents: 'none' }} />
      <span aria-hidden="true" style={{ flex: 'none', width: '15px', height: '15px', display: 'grid', placeItems: 'center', borderRadius: '4px', border: '1px solid ' + (wbSerul ? (dark ? '#4d9fff' : '#0066cc') : (dark ? 'rgba(255,255,255,0.3)' : '#b8b8be')), background: wbSerul ? (dark ? '#4d9fff' : '#0066cc') : 'transparent', transition: EASE }}>
        {wbSerul ? <span style={{ fontSize: '11px', lineHeight: 1, fontWeight: 700, color: dark ? '#14161a' : '#ffffff' }}>✓</span> : null}
      </span>
      서술형 포함
    </label>
  );
  const PART_META = (mode === 'textbook' && tbKind === 'variant')
    ? varSel.map((x, i) => ({ n: i + 1, t: x.l }))
    : [{ n: 1, t: '단어장' }, { n: 2, t: '나만의 손필기' }, ...tbSel.map((x, i) => ({ n: 3 + i, t: x.l }))];
  // 간지의 선택 범위는 **전부** 적는다 — 교과서는 과 단위, 모의고사는 연월 단위.
  // 예전엔 3개 이상이면 "○○ 외 N건"으로 줄였는데 무엇이 들어 있는지 알 수 없다는 지적을 받았다.
  const tbGist = (() => {
    const seen = [];
    sheets.forEach(sh => { const l = sh.bookGrp && sh.bookGrp.label; if (l && seen.indexOf(l) < 0) seen.push(l); });
    return seen;
  })();
  // 범위가 많아지면 글자를 줄여 간지 한 면 안에 담는다
  const tbGistFs = tbGist.length > 14 ? 11 : tbGist.length > 9 ? 12.5 : tbGist.length > 5 ? 13.5 : 15;
  const pageList = [];
  // 한줄해석 페이지 분할 (한줄해석 모드 / 교재 제작 합본에서 공용)
  const pushLinePages = (sh, si) => {
    // 쌩지문 파트가 따로 있으면 아래 '전체 지문'을 빼고, 줄간격 상한도 1 위로 연다
    // (EN_LH_MAX_SCALE). 어느 배율을 쓸지는 아래 루프가 "2쪽에 들어가는 가장 큰 값"으로
    // 알아서 고르므로, 글자가 커져 줄이 늘어도 넘치지 않는다.
    const dropRaw = tbRawPart;
    const R = dropRaw ? 0 : rawBlockH(sh.rawText);
    const paginate = (s) => {
      const pages = [[]];
      let used = 0;
      for (const it of sh.lineItems) {
        const h = estLineH(it, s), cap = pages.length === 1 ? LINE_CAP_FIRST : LINE_CAP_REST;
        if (used > 0 && used + h > cap) { pages.push([]); used = 0; }
        pages[pages.length - 1].push(it); used += h;
      }
      if (used + R > (pages.length === 1 ? LINE_CAP_FIRST : LINE_CAP_REST)) pages.push([]);
      while (pages.length < 2) pages.push([]);
      return pages;
    };
    let s = EN_LH_MIN_SCALE, pagesArr = null, memoPages = 0;
    for (let t = dropRaw ? EN_LH_MAX_SCALE : 1; t >= EN_LH_MIN_SCALE - 0.001; t -= 0.02) {
      const pg = paginate(t);
      if (pg.length <= 2) { s = t; pagesArr = pg; break; }
    }
    if (!pagesArr) { s = 1; pagesArr = paginate(s); if (pagesArr.length % 2 === 1) memoPages = 1; }
    const lh = EN_LH * s;
    const lastContent = pagesArr.length - 1;
    const totalPages = pagesArr.length + memoPages;
    pagesArr.forEach((items, pi) => pageList.push({ sh, si, kind: 'line', items, pi, pc: totalPages, lh, raw: (!dropRaw && pi === lastContent) ? sh.rawText : '' }));
    for (let m = 0; m < memoPages; m++) pageList.push({ sh, si, kind: 'line', items: [], pi: pagesArr.length + m, pc: totalPages, lh, raw: '', memo: true });
  };
  // 지문 하나를 지정한 유형으로 페이지에 올린다 — 단독 모드와 교재 제작 스코프가 공용으로 쓴다.
  const pushKindPages = (kind, sh, si) => {
    if (kind === 'line') { pushLinePages(sh, si); return; }
    if (kind === 'gukl') {
      // 구클: 문장 + '해석 :' 빈칸. 블록이 페이지를 넘치면 통째로 다음 장으로.
      const hFn = (it) => 25 + Math.max(1, Math.ceil((it.en || '').length / 79)) * (16.5 * 1.75) + 10 + 25;
      chunkByHeightH(sh.lineItems, hFn, LINE_CAP_FIRST, LINE_CAP_REST).forEach((items, pi, arr) => pageList.push({ sh, si, kind: 'gukl', items, pi, pc: arr.length }));
      return;
    }
    if (kind === 'order') {
      // 한 지문은 무조건 한 페이지에 (분할하지 않음) — 글씨/간격을 작게 잡아 다 들어가게
      pageList.push({ sh, si, kind: 'order', items: sh.orderItems, pi: 0, pc: 1, showOrderRow: true });
      return;
    }
    if (kind === 'raw') {
      if (rawKo) {
        chunkRawBoth(sh.lineItems).forEach((items, pi, arr) => pageList.push({ sh, si, kind: 'raw', text: items.map(it => it.en).join(' '), ko: items.map(it => it.ko).join(' '), pi, pc: arr.length }));
      } else {
        chunkRaw(sh.rawSentences, RAW_LINES_FIRST, RAW_LINES_REST).forEach((sents, pi, arr) => pageList.push({ sh, si, kind: 'raw', text: sents.join(' '), pi, pc: arr.length }));
      }
      return;
    }
    pageList.push({ sh, si, kind, text: sh.rawText, pi: 0, pc: 1 });
  };
  if (mode === 'vocab' || (mode === 'textbook' && tbKind === 'handwrite')) {
    // 선택 범위 전체 단어(지문 순서대로). 각 단어에 지문번호(pnum) 부착.
    let words = sheets.flatMap(sh => sh.vocab.map(w => ({ en: w.en, ko: w.ko, pnum: sh.passageNum })));
    words.forEach((w, i) => { w.start = (i === 0) || (w.pnum !== words[i - 1].pnum); }); // 지문이 바뀌는 첫 단어에 표시
    if (!listLike && words.length) {
      const ord = shuffledIdx(words.length, seed * 13 + 7);
      words = ord.slice(0, 50).map(i => words[i]);
    }
    // 한 표(6열×25행)=50단어. offset부터 번호 매김. 지문 시작 단어엔 배지(start/pnum) 유지.
    const cell = (w, no) => w ? { no, en: w.en, ko: w.ko, pnum: w.pnum, start: w.start, marker: w.marker } : null;
    const mkRows = (slice, offset) => {
      const rows = [];
      for (let r = 0; r < 25; r++) rows.push({ L: cell(slice[r], offset + r + 1), R: cell(slice[r + 25], offset + r + 26) });
      return rows;
    };
    if (bookVocab) {
      // 교재 단어장: 월/과(=헤더 그룹)가 바뀌면 새 장에서 시작.
      // 교재 제작(bookMode)에서는 헤더가 홀수 페이지에만 → 그룹을 홀수 페이지에서 시작시키고 어긋나면 메모 장을 끼운다.
      // 단어 모드의 교재단어장은 낱장 출력이라 홀짝 규칙이 무의미 → 메모 없이 이어 붙이고 헤더는 모든 장에 보인다.
      const groups = [];
      sheets.forEach(sh => {
        const g = sh.bookGrp;
        let cur = groups[groups.length - 1];
        if (!cur || cur.key !== g.key) { cur = { key: g.key, label: g.label, words: [] }; groups.push(cur); }
        sh.vocab.forEach((w, i) => cur.words.push({ en: w.en, ko: w.ko, marker: i === 0 ? g.marker : '' }));
      });
      const out = [];
      groups.forEach(g => {
        if (bookMode && out.length % 2 === 1) out.push({ memo: true }); // 짝수 페이지에서 시작하게 되면 메모 한 장 끼워 홀수로 밀기
        // 번호는 그룹(월/과)마다 1번부터 다시 시작 → offset은 그룹 안에서만 누적
        for (let p = 0; p * 50 < g.words.length; p++) out.push({ words: g.words.slice(p * 50, p * 50 + 50), header: g.label, offset: p * 50 });
      });
      if (bookImpose) {
        // 모아찍기: 50단어 묶음(out) 두 개를 가로 한 장의 좌/우로. 그룹이 달라도 각 반쪽이 자기 헤더를 단다.
        const pc = Math.ceil(out.length / 2);
        for (let p = 0; p < pc; p++) {
          const L = out[p * 2], R = out[p * 2 + 1] || null;
          pageList.push({
            kind: 'vocab', book2up: true, pi: p, pc,
            left: { header: L.header, rows: mkRows(L.words, L.offset) },
            right: R ? { header: R.header, rows: mkRows(R.words, R.offset) } : null
          });
        }
      } else out.forEach((pg, i) => {
        pageList.push({
          kind: 'vocab', memo: !!pg.memo, header: pg.header || '', headerVisible: bookMode ? (i % 2 === 0) : true, // 0-based 짝수 = 1-based 홀수
          leftRows: pg.memo ? null : mkRows(pg.words, pg.offset), rightRows: null, pi: i, pc: out.length
        });
      });
    } else if (words.length && imposeOn) {
      // 가로 모아찍기
      if (listLike) {
        // 단어장: 한 장에 2표(좌 50 + 우 50 연속) = 100단어/장
        const pc = Math.max(1, Math.ceil((words.length || 1) / 100));
        for (let p = 0; p < pc; p++) {
          const base = p * 100;
          const rightSlice = words.slice(base + 50, base + 100);
          pageList.push({ kind: 'vocab', leftRows: mkRows(words.slice(base, base + 50), base), rightRows: rightSlice.length ? mkRows(rightSlice, base + 50) : null, pi: p, pc });
        }
      } else {
        // 시험지: 같은 50단어 좌우 2부 복붙. 답지(vocabAnswer)면 좌측만, 우측 비움.
        const rows = mkRows(words.slice(0, 50), 0);
        pageList.push({ kind: 'vocab', leftRows: rows, rightRows: vocabAnswer ? null : rows, pi: 0, pc: 1 });
      }
    } else if (words.length) {
      // 세로 A4 단일 표: 50단어/장
      if (listLike) {
        const pc = Math.max(1, Math.ceil((words.length || 1) / 50));
        for (let p = 0; p < pc; p++) pageList.push({ kind: 'vocab', leftRows: mkRows(words.slice(p * 50, p * 50 + 50), p * 50), rightRows: null, pi: p, pc });
      } else {
        pageList.push({ kind: 'vocab', leftRows: mkRows(words.slice(0, 50), 0), rightRows: null, pi: 0, pc: 1 });
      }
    }
    // 교재 제작 = 빈 표지면 + PART1 단어장 + PART2 나만의 손필기(한줄해석) + PART3 워크북(별도 렌더러).
    // 각 파트 앞에 간지 2면(1면=파트 표제, 2면=전체 목차 중 현재 파트 강조)을 넣는다.
    if (mode === 'textbook' && sheets.length) {
      const vocabPages = pageList.splice(0, pageList.length);   // 여기까지가 교재 단어장
      sheets.forEach((sh, si) => pushLinePages(sh, si));
      const linePages = pageList.splice(0, pageList.length);    // 한줄해석
      const push2 = (part) => { pageList.push({ kind: 'part', part }); pageList.push({ kind: 'parttoc', part }); };
      // 각 파트는 항상 홀수 쪽(오른쪽 면)에서 시작 → 앞 섹션이 홀수 면수로 끝나면 메모 한 면을 끼워 짝수로 맞춘다.
      const padToEven = () => { if (pageList.length % 2 === 1) pageList.push({ kind: 'vocab', memo: true, header: '', headerVisible: false, leftRows: null, rightRows: null, pi: 0, pc: 0 }); };
      // ※ 맨 앞 백지는 인쇄/PDF에서만 물리적으로 덧붙는다(아래 print-blank). 쪽번호·미러마진·홀짝 계산에는 넣지 않는다.
      push2(1); vocabPages.forEach(p => pageList.push(p)); padToEven();
      push2(2); linePages.forEach(p => pageList.push(p));
      tbSel.forEach((x, i) => {
        padToEven();
        push2(3 + i);
        if (x.k === 'workbook') return;                          // 워크북 본체는 pageList 뒤에 별도 렌더
        sheets.forEach((sh, si) => pushKindPages(x.k, sh, si));
      });
    }
  } else if (mode !== 'variant' && mode !== 'workbook' && mode !== 'illust' && mode !== 'weekly' && mode !== 'textbook') sheets.forEach((sh, si) => {   // 변형문제·워크북·주간테스트는 별도 렌더러로, 삽화는 빈 캡슐, 교재 제작(비손필기 틀)은 아래 자리표시
    if (mode === 'line' || mode === 'gukl' || mode === 'order' || mode === 'raw') {
      pushKindPages(mode, sh, si);
    } else {
      pageList.push({ sh, si, kind: mode, text: sh.rawText, pi: 0, pc: 1 });
    }
  });

  // ── 변형문제 조립 (일반 변형문제 모드 · 교재 제작 변형문제 틀 공용) ──
  // 문항 데이터: DB variant_items → loadContent()가 지문 key별로 묶은 window.VARIANT_BY_KEY.
  //   지문 스튜디오가 지문을 가져오듯, 좌측에서 고른 지문(sheets)의 문항만 가져와 조립한다.
  // · 파트 = 고른 유형(순서 칸 순서). 각 유형은 새 페이지에서 시작한다.
  // · 교재 제작: 파트마다 간지 2면 + 홀수쪽 시작(손필기 교재와 같은 규정). 쪽번호·미러 마진은 페이지 렌더가 붙인다.
  // · 일반 모드: 간지 없이 유형 첫 페이지 위에 유형 이름만 표시한다.
  // · 파트 안 문항 순서 = varSeq(지문순: 좌측에서 고른 지문 순서→원 문항번호 / 랜덤순: seed 셔플)
  // 2단 배치(원본 문항지처럼 A4 한 장 좌우 분할). 문항은 단·페이지 경계를 넘어 이어진다(원본과 같음).
  // 문항을 조각(발문 · 지문[문장 단위] · 출처 · 선지 하나하나)으로 쪼개고, 각 조각의 **실제 렌더 높이**를
  // 화면 밖 상자에서 재서 왼쪽 단 → 오른쪽 단 → 다음 페이지 순으로 채운다.
  // 측정과 렌더가 같은 HTML(vqAtomHtml)을 쓰므로 높이가 어긋나지 않는다.
  const varBook = mode === 'textbook' && tbKind === 'variant';
  const VQ_COL_H = 1123 - 30 - 24 - 2 - 40;            // 단 높이(위·아래 여백·테두리, 쪽번호 자리)
  const VQ_HEAD = 104;                                   // 일반 모드 유형 머리말(두 단 위에 걸침)
  const VQ_GUT = 14;                                     // 단 사이 여백(구분선 양쪽)
  const VQ_QROW = 27;                                    // 빠른 정답표 한 행 높이
  const VQ_COL_W = Math.floor(((varBook ? 794 - 114 : 794 - 108) - 2 - VQ_GUT * 2 - 1) / 2);
  const VQ_CSS = ".vq-psg u{text-decoration:none;border-bottom:1.3px solid #1d1d1f;padding-bottom:0.5px}"
    + ".vq-stem u{text-decoration:none;border-bottom:1.2px solid #1d1d1f}"
    + ".vq-note{font-size:10.5px;line-height:1.5;color:#3a3a3c;text-align:left;margin-top:4px;padding-left:0.5em}"
    + ".vq-table{width:100%;border-collapse:collapse;margin:6px 0;font-size:11.5px;line-height:1.4;text-align:center}"
    + ".vq-table th{font-weight:600;border-top:1.2px solid #1d1d1f;border-bottom:1px solid #1d1d1f;padding:3px 4px}"
    + ".vq-table td{border-bottom:1px solid #d2d2d7;padding:3px 4px}"
    + ".vq-blank{display:inline-block;width:7.5em;height:1em;border-bottom:1.2px solid #1d1d1f;vertical-align:-2px;margin:0 3px}"
    + ".vq-cn{font-family:'Spoqa Han Sans Neo','Malgun Gothic',sans-serif;font-weight:400}";   // ①~⑤ — Georgia 에 없는 글자라 굵은 대체 글꼴로 그려지던 것
  const vqEnsureCss = () => {
    if (typeof document === 'undefined' || document.getElementById('vq-style')) return;
    const st = document.createElement('style'); st.id = 'vq-style'; st.textContent = VQ_CSS; document.head.appendChild(st);
  };
  const vqCn = (h) => (h || '').replace(/([①②③④⑤])/g, '<span class="vq-cn">$1</span>');
  const vqLine = pcTint(PC, 0.72);
  const vqAtomHtml = (a) => {
    if (a.t === 'stem') {
      const q = a.q;
      return '<div class="vq-stem" style="font-size:13px;font-weight:700;line-height:1.5;word-break:keep-all;padding:4px 0 7px">'
        + '<span style="color:' + PC + ';font-weight:800;margin-right:5px">' + String(q.num).padStart(2, '0') + '.</span>' + q.stem
        + (q.orig ? '<span style="font-size:10.5px;font-weight:500;color:#86868b;margin-left:5px">[' + q.orig + ']</span>' : '') + '</div>';
    }
    if (a.t === 'psg') {
      // 단·페이지에서 끊긴 지문은 상자가 이어진다: 이어지는 쪽 테두리·둥근 모서리를 지운다
      const bt = a.top ? '1px solid ' + vqLine : '1px dashed ' + vqLine;
      const bb = a.bottom ? '1px solid ' + vqLine : '1px dashed ' + vqLine;
      const r = (a.top ? '5px 5px ' : '0 0 ') + (a.bottom ? '5px 5px' : '0 0');
      return '<div class="vq-psg" style="font-size:12.5px;line-height:1.65;text-align:justify;font-family:' + enFam.replace(/"/g, "'")
        + ';padding:8px 11px;border-left:1px solid ' + vqLine + ';border-right:1px solid ' + vqLine + ';border-top:' + bt + ';border-bottom:' + bb
        + ';border-radius:' + r + ';background:#ffffff">' + vqCn(a.html) + '</div>';
    }
    if (a.t === 'src') return '<div style="font-size:9.5px;color:#9aa0a6;padding-top:3px;text-align:right">' + a.q.source.replace(/</g, '&lt;') + '</div>';
    if (a.t === 'ch') return '<div style="font-size:12.5px;line-height:1.5;padding:' + (a.first ? '7px' : '1.5px') + ' 0 1.5px 1.25em;text-indent:-1.25em;word-break:keep-all'
      + (/[가-힣]/.test(a.c) ? '' : ';font-family:' + enFam.replace(/"/g, "'")) + '">' + vqCn(a.c) + '</div>';
    if (a.t === 'ans') {   // 정답 및 해설 — 번호 · 정답 · 유형, 아래 해설(없으면 정답만)
      const q = a.q, ex = (q.explanation || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return '<div style="padding:7px 0 9px;border-bottom:1px solid #f0f0f2;font-size:12px;line-height:1.65;word-break:keep-all">'
        + '<span style="color:' + PC + ';font-weight:800">' + String(q.num).padStart(2, '0') + '</span>'
        + '<span class="vq-cn" style="font-size:13px;margin:0 8px 0 7px">' + (q.answer || '') + '</span>'
        + '<span style="font-size:10.5px;color:#86868b">' + q.vtype + '</span>'
        + (ex ? '<div style="margin-top:3px;color:#3a3a3c">' + vqCn(ex) + '</div>' : '') + '</div>';
    }
    return '<div style="height:18px"></div>';   // 문항 사이 간격
  };
  const vqMeasure = (html) => {
    const c = vqCache.current;
    if (c.has(html)) return c.get(html);
    if (typeof document === 'undefined') return 0;
    vqEnsureCss();
    let box = document.getElementById('vq-measure');
    if (!box) { box = document.createElement('div'); box.id = 'vq-measure'; box.style.cssText = 'position:absolute;left:-20000px;top:0;visibility:hidden;pointer-events:none'; document.body.appendChild(box); }
    box.innerHTML = '<div style="width:' + VQ_COL_W + 'px">' + html + '</div>';
    const h = box.firstChild.getBoundingClientRect().height;
    c.set(html, h);
    return h;
  };
  // 지문 HTML을 문장 단위로 자른다(밑줄 <u> 안에서는 자르지 않는다). 표(<table>)·각주(.vq-note)는 통째로 한 조각, <p>는 문단 경계.
  const vqSentences = (h) => {
    const out = [];
    (h || '').split(/(<table[\s\S]*?<\/table>|<div class="vq-note">[\s\S]*?<\/div>)/).forEach(blk => {
      if (blk.startsWith('<table') || blk.startsWith('<div')) { out.push(blk); return; }
      blk.split(/<\/?p>/).forEach(t => {
        let start = 0, m; const re = /[.!?]["”’)]*\s+(?=(?:<[^>]+>)*[A-Z“"(‘'])/g;
        while ((m = re.exec(t))) {
          const pos = m.index + m[0].length, pre = t.slice(0, pos);
          if ((pre.match(/<u>/g) || []).length !== (pre.match(/<\/u>/g) || []).length) continue;
          out.push(t.slice(start, pos).trim()); start = pos;
        }
        out.push(t.slice(start).trim());
      });
    });
    return out.filter(Boolean);
  };
  // 한 유형(파트)의 문항을 2단 페이지들로 채운다
  const vqPack = (qs, headFirst) => {
    const pages = []; let page = null, col = 0, used = 0, cap = 0;
    const newPage = () => { page = { cols: [[], []], head: headFirst && pages.length === 0 }; pages.push(page); col = 0; used = 0; cap = VQ_COL_H - (page.head ? VQ_HEAD : 0); };
    const nextCol = () => { if (col === 0) { col = 1; used = 0; } else newPage(); };
    const put = (a, h) => { page.cols[col].push(a); used += h; };
    const place = (a) => { const h = vqMeasure(vqAtomHtml(a)); if (used > 0 && used + h > cap) nextCol(); put(a, h); };
    newPage();
    qs.forEach(q => {
      const stem = { t: 'stem', q }, hs = vqMeasure(vqAtomHtml(stem));
      if (used > 0 && used + hs + 48 > cap) nextCol();          // 발문만 단 끝에 홀로 남지 않게(지문 두어 줄과 함께)
      put(stem, hs);
      const ss = vqSentences(q.passage_html); let i = 0, first = true;
      while (i < ss.length) {
        let best = -1, bestH = 0;
        for (let j = i + 1; j <= ss.length; j++) {
          const h = vqMeasure(vqAtomHtml({ t: 'psg', html: ss.slice(i, j).join(' '), top: first, bottom: j === ss.length }));
          if (used + h <= cap) { best = j; bestH = h; } else break;
        }
        if (best === -1) {
          if (used > 0) { nextCol(); continue; }
          best = i + 1;                                           // 한 문장이 단보다 길면 그냥 놓는다
          bestH = vqMeasure(vqAtomHtml({ t: 'psg', html: ss[i], top: first, bottom: best === ss.length }));
        }
        put({ t: 'psg', html: ss.slice(i, best).join(' '), top: first, bottom: best === ss.length }, bestH);
        i = best; first = false;
        if (i < ss.length) nextCol();
      }
      if (q.source) place({ t: 'src', q });
      (q.choices || []).forEach((c, ci) => place({ t: 'ch', c, first: ci === 0 }));
      if (used > 0 && used + 18 <= cap) put({ t: 'gap' }, 18);
    });
    return pages.filter(pg => pg.cols[0].length || pg.cols[1].length);
  };
  if ((mode === 'variant' || varBook) && varSel.length) {
    const byKey = (typeof window !== 'undefined' && window.VARIANT_BY_KEY) || {};
    const bank = [];
    sheets.forEach((sh, si) => (byKey[sh.key] || []).forEach(q => bank.push({ ...q, si, orig: sh.passageNum !== '' && sh.passageNum != null ? String(sh.passageNum) : '' })));
    // 파트 정답지: 그 파트 문제 바로 뒤, 새 페이지. 머리말 → 빠른 정답표(두 단 위, 가로) → 해설 2단.
    // 체크박스: 정답 및 해설(해설 없는 문항은 정답만) · 빠른 정답. 둘 다 켜면 한 묶음으로 같은 페이지에 들어간다.
    const pushAns = (qs, label) => {
      if (!qs.length || !(varAnsQuick || varAnsExp)) return;
      const quickH = varAnsQuick ? 20 + Math.ceil(qs.length / 5) * VQ_QROW + 16 : 0;   // 캡션 + 행 + 아래 여백
      const headMain = varAnsExp ? '정답 및 해설' : '빠른 정답';
      const base = { kind: 'vq', headTop: '정답지', headMain, headTitle: label };
      if (!varAnsExp) { pageList.push({ ...base, cols: [[], []], typeHead: true, quick: qs, quickH, quickCap: false }); return; }
      const pages = []; let page = null, col = 0, used = 0, cap = 0;
      const newPage = () => { page = { cols: [[], []], head: pages.length === 0 }; pages.push(page); col = 0; used = 0; cap = VQ_COL_H - (page.head ? VQ_HEAD + quickH : 0); };
      newPage();
      qs.forEach(q => {
        const a = { t: 'ans', q }, h = vqMeasure(vqAtomHtml(a));
        if (used > 0 && used + h > cap) { if (col === 0) { col = 1; used = 0; } else newPage(); }
        page.cols[col].push(a); used += h;
      });
      pages.forEach((pgv, i) => pageList.push({ ...base, cols: pgv.cols, typeHead: pgv.head, quick: i === 0 && varAnsQuick ? qs : null, quickH: i === 0 ? quickH : 0, quickCap: true }));
    };
    const push2 = (part) => { pageList.push({ kind: 'part', part }); pageList.push({ kind: 'parttoc', part }); };
    const padToEven = () => { if (pageList.length % 2 === 1) pageList.push({ kind: 'vocab', memo: true, header: '', headerVisible: false, leftRows: null, rightRows: null, pi: 0, pc: 0 }); };
    varSel.forEach((t, ti) => {
      let qs = bank.filter(q => q.type === t.k);
      if (!qs.length) return;
      if (varSeq === 'random') { const ord = shuffledIdx(qs.length, seed * 31 + ti * 7 + 1); qs = ord.map(i => qs[i]); }
      else qs = [...qs].sort((a, b) => (a.si - b.si) || (a.no - b.no));
      qs = qs.map((q, i) => ({ ...q, num: i + 1, vtype: t.l }));   // 문항 번호는 파트마다 01부터
      if (varBook) { padToEven(); push2(ti + 1); }
      vqPack(qs, !varBook).forEach(pgv => pageList.push({ kind: 'vq', vtype: t, cols: pgv.cols, typeHead: pgv.head, stemHint: qs[0].stem }));
      pushAns(qs, t.l);
    });
  }
  const varHasPages = pageList.some(p => p.kind === 'vq');
  const varHasAns = pageList.some(p => p.headTop === '정답지');
  if (ansOnly) { const keep = pageList.filter(p => p.headTop === '정답지'); pageList.length = 0; keep.forEach(p => pageList.push(p)); }

  // 단어 표 렌더 — 행 높이를 크게(rowH) 잡아 페이지 바닥까지 채움
  const vCell = { border: '1px solid #d7d9dd', padding: '0 5px', overflow: 'hidden', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.05, verticalAlign: 'middle', maxWidth: 0 };
  const renderVocabTable = (rows, rowH) => {
    // 컬럼 폭 대략(px). 긴 내용은 폰트를 줄여 한 줄에 안 잘리게.
    const colPx = imposeOn ? 92 : 130;
    // 2줄까지 허용 → 한 줄에 안 들어가면 폰트를 조금만 줄이고 줄바꿈. (2줄에 담기는 폰트 = 1줄용의 2배)
    const fitFont = (t, cf, reserve = 0) => { const n = (t || '').length; if (!n) return undefined; return Math.max(6.5, Math.min(11, 2 * (colPx - reserve) / (n * cf))) + 'px'; };
    return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '11px' }}>
      <colgroup>
        <col style={{ width: '8.5%' }} /><col style={{ width: '20.75%' }} /><col style={{ width: '20.75%' }} />
        <col style={{ width: '8.5%' }} /><col style={{ width: '20.75%' }} /><col style={{ width: '20.75%' }} />
      </colgroup>
      <thead>
        <tr>
          {['번호', '단어', '해석', '번호', '단어', '해석'].map((h, i) => (
            <th key={i} style={{ border: '1px solid #b8bcc2', borderLeft: i === 3 ? '2px solid #6e6e73' : '1px solid #b8bcc2', background: '#eef1f5', padding: '2px 4px', fontSize: '10.5px', fontWeight: 700, color: '#1d1d1f', height: '20px' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ height: rowH + 'px' }}>
            {[row.L, row.R].flatMap((c, bi) => [
              <td key={bi + 'n'} style={{ border: '1px solid #d7d9dd', borderLeft: bi === 1 ? '2px solid #6e6e73' : '1px solid #d7d9dd', textAlign: 'center', padding: '0 1px', color: PC, fontWeight: 600, fontSize: '10.5px', whiteSpace: 'nowrap' }}>{c ? c.no : ''}</td>,
              <td key={bi + 'e'} style={{ ...vCell, fontFamily: engFontFamily, fontSize: c ? fitFont(c.en, 0.58, (listLike && c.start && c.pnum) ? 28 : 0) : undefined, color: (vocabMode === 'en' && vocabAnswer) ? PC : undefined }}>{c ? ((vocabMode === 'en' && !vocabAnswer) ? '' : <>{listLike && c.start && c.pnum && <span style={{ display: 'inline-block', background: PC, color: '#fff', fontSize: '8px', fontWeight: 700, borderRadius: '2px', padding: '0 3px', marginRight: '4px', verticalAlign: '1px', fontFamily: 'inherit' }}>{c.pnum}번</span>}{c.en}</>) : ''}</td>,
              <td key={bi + 'k'} style={{ ...vCell, fontSize: c ? fitFont(c.ko, 1.02) : undefined, color: (vocabMode === 'ko' && vocabAnswer) ? PC : '#3d3d42' }}>{c ? ((vocabMode === 'ko' && !vocabAnswer) ? '' : c.ko) : ''}</td>
            ])}
          </tr>
        ))}
      </tbody>
    </table>
    );
  };
  // 교재 단어장 표: 테두리를 최소화한 깔끔한 2단 목록 (헤더 없음, 50단어/장)
  // compact = 모아찍기(가로 2부)용: 반쪽 높이에 25행이 들어가도록 행 높이·글자를 줄인다.
  const renderBookTable = (rows, compact) => {
    const maxF = compact ? 11 : 12.5;
    const fit = (t, cf, reserve = 0) => { const n = (t || '').length; if (!n) return undefined; return Math.max(7, Math.min(maxF, 2 * ((compact ? 110 : 150) - reserve) / (n * cf))) + 'px'; };
    const base = { borderBottom: '1px solid #edeff2', padding: '0 6px', height: compact ? '25px' : '36px', verticalAlign: 'middle', overflow: 'hidden', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'break-word', lineHeight: 1.12, maxWidth: 0 };
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: compact ? '11px' : '12.5px' }}>
        <colgroup>
          <col style={{ width: '8%' }} /><col style={{ width: '19.5%' }} /><col style={{ width: '22.5%' }} />
          <col style={{ width: '8%' }} /><col style={{ width: '19.5%' }} /><col style={{ width: '22.5%' }} />
        </colgroup>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {[row.L, row.R].flatMap((c, bi) => [
                <td key={bi + 'n'} style={{ ...base, borderLeft: bi === 1 ? '1px solid #e2e5ea' : 'none', paddingLeft: bi === 1 ? '12px' : '2px', paddingRight: '7px', textAlign: 'right', whiteSpace: 'nowrap', color: PC, fontSize: compact ? '9px' : '10px', fontWeight: 700 }}>{c ? c.no : ''}</td>,
                <td key={bi + 'e'} style={{ ...base, borderLeft: '4px solid ' + (c && c.marker ? PC : 'transparent'), paddingLeft: '6px', fontFamily: engFontFamily, fontWeight: 600, color: '#1d1d1f', fontSize: c ? fit(c.en, 0.56, c.marker ? 40 : 0) : undefined }}>{c ? (<>{c.marker && <span style={{ display: 'inline-block', background: PC, color: '#fff', fontSize: '9px', fontWeight: 800, borderRadius: '4px', padding: '2px 6px', marginRight: '6px', verticalAlign: '1px', fontFamily: 'inherit' }}>{c.marker}</span>}{c.en}</>) : ''}</td>,
                <td key={bi + 'k'} style={{ ...base, color: '#5b6068', fontSize: c ? fit(c.ko, 1.0) : undefined }}>{c ? c.ko : ''}</td>
              ])}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };
  // ── 변형문제(어법) 렌더러 — 사용자가 선택한 지문(sheets)으로 문제 생성. 지문별 데이터는 GRAMMAR_BY_KEY(스킬로 생성).
  const renderGrammarSheets = () => {
    const gmStyle = '.gm{font-size:13.5px;line-height:1.5;color:#1f2733}.gm .cover{border-bottom:3px solid #14324f;padding-bottom:10px;margin-bottom:16px}.gm .kicker{color:#2f6da3;font-size:11px;letter-spacing:2px;font-weight:700}.gm h1{font-size:24px;margin:4px 0 2px;color:#14324f;letter-spacing:-0.3px}.gm .sub{color:#64707d;font-size:12.5px;margin-top:2px}.gm .meta{font-size:11.5px;color:#55616e;margin-top:8px}.gm .meta b{color:#14324f}.gm .q{margin:0 0 15px}.gm .q-no{display:inline-block;background:#14324f;color:#fff;font-weight:700;font-size:12px;border-radius:4px;padding:2px 9px}.gm .q-src{font-size:11px;color:#8a97a6;font-weight:600;margin-left:7px}.gm .q-ask{font-weight:700;font-size:13.5px;color:#22303f;margin:6px 0}.gm .q-ask u{border-bottom:1.4px solid #22303f;text-decoration:none}.gm .passage{border:1px solid #d3dce4;border-left:4px solid #2f6da3;background:#fbfcfd;border-radius:5px;padding:11px 14px;text-align:justify;font-size:13.5px;line-height:1.8}.gm .ph{border:1px dashed #c7cfd8;border-radius:5px;padding:13px 14px;color:#8a97a6;font-size:12.5px;background:#fafbfc;margin-top:2px}.gm u{text-decoration:none;border-bottom:1.4px solid #1f2733;padding-bottom:0.5px}.gm .cn{font-weight:700;font-style:normal}.gm .sec-title{color:#14324f;font-size:19px;font-weight:700;border-bottom:2px solid #14324f;padding-bottom:5px;margin:0 0 12px}.gm table.key{border-collapse:collapse;width:100%;margin-bottom:16px;font-size:12.5px}.gm table.key th{background:#14324f;color:#fff;padding:6px 8px;text-align:left;font-weight:600}.gm table.key td{border:1px solid #d3dce4;padding:3px 8px;font-size:12px}.gm table.key tr:nth-child(even) td{background:#f6f9fb}.gm .exp{margin:0 0 13px}.gm .exp h3{font-size:14px;color:#14324f;margin:0 0 4px;border-left:4px solid #2f6da3;padding-left:8px}.gm .exp .ans{color:#c0392b;font-weight:700}.gm .exp ul{margin:4px 0 0;padding-left:18px}.gm .exp li{margin-bottom:3px}.gm .exp .pt{font-weight:700;color:#14324f}.gm .exp .tf{color:#8a6d18;font-weight:700}.gm code{background:#eef3f7;padding:0 3px;border-radius:3px;font-size:12px}';
    const Sheet = ({ children, k }) => (
      <div key={k} data-sheet="" style={{ width: '794px', maxWidth: 'none', margin: '0 auto 28px', height: '1123px', minHeight: '1123px', background: '#ffffff', color: '#1d1d1f', border: '1px solid #e0e0e0', borderRadius: '2px', boxShadow: 'rgba(0,0,0,0.1) 0px 12px 44px', padding: '34px 44px 26px', overflow: 'hidden' }}>{children}</div>
    );
    if (!sheets.length) {
      return (
        <React.Fragment>
          <style>{gmStyle}</style>
          <div style={{ maxWidth: '540px', margin: '90px auto 0', textAlign: 'center', padding: '38px 32px', borderRadius: '18px', background: T.emptyCardBg, border: '1px solid ' + T.panelBorder }}>
            <div style={{ fontSize: '18px', fontWeight: 600, color: T.text }}>지문을 선택하세요</div>
            <div style={{ fontSize: '13.5px', color: T.textDim, marginTop: '10px', lineHeight: 1.65 }}>왼쪽에서 지문을 체크하면 <b>그 지문으로 어법문제</b>가 나옵니다.<br />어법문제는 <b>영어 원문이 있는 교과서 지문</b>에서 생성됩니다.<br />(모의고사는 단어만 있어 문제를 만들 수 없습니다.)</div>
          </div>
        </React.Fragment>
      );
    }
    const strip = (h) => (h || '').replace(/<[^>]+>/g, '');
    const blocks = sheets.map((sh, i) => ({ no: String(i + 1).padStart(2, '0'), sh, item: GRAMMAR_BY_KEY[sh.key], hasEng: !!(sh.rawText && sh.rawText.trim()) }));
    // 문제 블록 → {el, h}
    const problems = blocks.map((b) => {
      const src = b.sh.passageSource + (b.sh.passageNum ? (' ' + b.sh.passageNum + '번') : (' — ' + b.sh.passageTitle));
      if (b.item) {
        const lines = Math.max(1, Math.ceil(strip(b.item.passageHtml).length / 84));
        return { h: 30 + 24 + (lines * 25 + 24) + 15, el: (
          <div className="q" key={'q' + b.no}>
            <div><span className="q-no">{b.no}</span><span className="q-src">{src}</span></div>
            <div className="q-ask" dangerouslySetInnerHTML={{ __html: GRAMMAR_ASK }} />
            <div className="passage" dangerouslySetInnerHTML={{ __html: b.item.passageHtml }} />
          </div>
        ) };
      }
      const msg = b.hasEng
        ? '이 지문의 어법문제는 아직 생성되지 않았습니다. (영어 원문 있음 — 생성 가능. "이 지문 어법 생성해줘"라고 하면 만들어 넣습니다.)'
        : '이 지문은 앱에 영어 원문이 없어 어법문제를 만들 수 없습니다. (모의고사=단어만 / 교과서 지문을 선택하세요.)';
      return { h: 30 + 62 + 15, el: (
        <div className="q" key={'q' + b.no}>
          <div><span className="q-no">{b.no}</span><span className="q-src">{src}</span></div>
          <div className="ph">{msg}</div>
        </div>
      ) };
    });
    // 표지
    const madeCount = blocks.filter(b => b.item).length;
    const cover = (
      <div className="cover" key="cover">
        <div className="kicker">GRAMMAR SET · 밑줄형 어법</div>
        <h1>어법 {blocks.length}제</h1>
        <div className="sub">다음 글의 밑줄 친 부분 중 어법상 틀린 것 고르기 · 한 문장당 밑줄 1개 · 원문 변형</div>
        <div className="meta"><span><b>문항</b> {blocks.length}제</span>&nbsp;&nbsp;&nbsp;<span><b>생성됨</b> {madeCount}제</span>&nbsp;&nbsp;&nbsp;<span><b>정답·해설</b> 뒤쪽</span></div>
      </div>
    );
    // 문제 페이지: 그리디 배치 (표지는 첫 장)
    const usable = 1063, coverH = 150;
    const probSheets = []; let cur = [], used = 0;
    problems.forEach((p) => {
      const cap = usable - (probSheets.length === 0 ? coverH : 0);
      if (used + p.h > cap && cur.length) { probSheets.push(cur); cur = []; used = 0; }
      cur.push(p.el); used += p.h;
    });
    if (cur.length) probSheets.push(cur);
    // 정답·해설 (생성된 문제만)
    const made = blocks.filter(b => b.item);
    const wrapExp = (e) => {
      let h = (e || '');
      h = h.replace(/\[변형:[^\]]*\]/g, (m) => '<span class="tf">' + m + '</span>');
      h = h.replace(/^\s*([①②③④⑤])(\s*\(정답\))?/, (all, n, ans) => '<span class="pt">' + n + (ans || '') + '</span>');
      return h;
    };
    const ansEls = []; const ansH = [];
    if (made.length) {
      // 정답표: 압축 행(≈34px)으로, 시트당 행 수로 분할해 자체 시트에. 해설은 그 뒤 별도 시트로 흐름.
      const capA = usable - 24, TITLE = 46, THEAD = 40, ROWH = 44;
      const rowsPerSheet = Math.max(6, Math.floor((capA - TITLE - THEAD) / ROWH)); // ≈21 (한글 핵심포인트 2줄 대비)
      for (let k = 0; k < made.length; k += rowsPerSheet) {
        const chunk = made.slice(k, k + rowsPerSheet), first = (k === 0);
        ansEls.push(
          <div key={'kt' + k}>
            {first && <div className="sec-title">정답 및 해설</div>}
            <table className="key"><tbody>
              <tr><th style={{ width: '46px' }}>문항</th><th style={{ width: '150px' }}>핵심 포인트</th><th>정답</th></tr>
              {chunk.map((b) => (<tr key={b.no}><td>{b.no}</td><td>{b.item.point}</td><td><b>{b.item.answer}</b>&nbsp;&nbsp;{b.item.correction}</td></tr>))}
            </tbody></table>
          </div>
        );
        ansH.push((first ? TITLE : 0) + THEAD + chunk.length * ROWH);
      }
      made.forEach((b) => {
        ansEls.push(
          <div className="exp" key={'e' + b.no}>
            <h3>{b.no} &nbsp;정답 <span className="ans">{b.item.answer} {b.item.correction}</span></h3>
            <ul>{b.item.exps.map((e, i) => <li key={i} dangerouslySetInnerHTML={{ __html: wrapExp(e) }} />)}</ul>
          </div>
        );
        const c = b.item.exps.reduce((a, e) => a + Math.ceil(strip(e).length / 64) * 20 + 9, 0);
        ansH.push(50 + c + 14);
      });
    }
    const ansSheets = []; let acur = [], aused = 0;
    ansEls.forEach((el, i) => {
      if (aused + ansH[i] > usable - 24 && acur.length) { ansSheets.push(acur); acur = []; aused = 0; }
      acur.push(el); aused += ansH[i];
    });
    if (acur.length) ansSheets.push(acur);
    return (
      <React.Fragment>
        <style>{gmStyle}</style>
        {probSheets.map((els, si) => (
          <Sheet k={'gp' + si}><div className="gm">{si === 0 ? cover : null}{els}</div></Sheet>
        ))}
        {ansSheets.map((els, si) => (
          <Sheet k={'ga' + si}><div className="gm">{els}</div></Sheet>
        ))}
      </React.Fragment>
    );
  };
  // ── 워크북(5유형) 렌더러 — 선택 지문(sheets)으로 유형별 워크북 생성. 지문별 데이터는 WORKBOOK_BY_KEY(Supabase workbook_items).
  const renderWorkbookSheets = () => <WorkbookSheetsInner key={'pc' + PC + '|' + (wbSerul ? 's1|' : 's0|') + sheets.map(s => s.key).join('|')} sheets={sheets} academyName={academyName} serul={wbSerul} pcMain={PC} />;
  const vInput = (w) => ({ fontFamily: 'inherit', fontSize: '10px', color: '#1d1d1f', border: 'none', background: 'transparent', outline: 'none', width: w + 'px', textAlign: 'center', padding: '0 1px 1px' });
  // 단어 시트 각 부 상단: 제목 + 범위 + 날짜(자동/수정) + 반 + 이름 + 틀린개수
  const renderVocabHeader = (legend) => (
    <div style={{ fontSize: '9.5px', color: '#3d3d42', flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0, borderBottom: '1.5px solid #1d1d1f', paddingBottom: '3px' }}>
          <input value={vocabClass} onChange={e => setVocabClass(e.target.value)} placeholder="반" spellCheck={false}
            style={{ fontFamily: 'inherit', fontSize: '18px', fontWeight: 800, color: '#1d1d1f', border: 'none', background: 'transparent', outline: 'none', width: '150px', padding: '0 2px 1px' }} />
        </div>
        <div style={{ flex: 'none', fontWeight: 700, color: '#1d1d1f', fontSize: '13px', whiteSpace: 'nowrap', paddingBottom: '1px' }}>
          <span style={{ display: 'inline-block', width: '104px', height: '20px', borderBottom: '1.5px solid #1d1d1f', verticalAlign: 'bottom' }}></span> / 50
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', whiteSpace: 'nowrap' }}>
        {/* 날짜 칸은 글자 수만큼 늘어난다 — 54px 고정이라 `2026. 10. 15`처럼 월이 두 자리가 되면 잘렸다.
            한글(예: 2026년 10월 15일)은 숫자보다 넓어서 두 칸으로 센다. */}
        <span>날짜 <input value={vocabDate} onChange={e => setVocabDate(e.target.value)} spellCheck={false}
          style={Object.assign(vInput(54), { width: Math.max(7, [...vocabDate].reduce((n, c) => n + (/[ㄱ-ㅎ가-힣]/.test(c) ? 1.9 : 1), 0) + 1.5) + 'ch' })} /></span>
        <span>이름 <span style={{ display: 'inline-block', width: '90px' }}></span></span>
      </div>
    </div>
  );

  // ---- exports ----
  // 파일 하나 내려받기 — Blob 을 만들어 링크를 클릭시키고 정리한다(모든 내보내기 공용)
  const download = (blob, filename) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  const stamp = () => { const d = new Date(); return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); };

  const doWord = () => {
    if (!sheets.length) { alert('먼저 지문을 선택하세요.'); return; }
    const esc = escHtml;
    // 구클만 **진짜 .docx** 로 낸다. 다른 유형이 쓰는 아래 방식은 HTML 을 .doc 확장자로
    // 위장한 것이라 워드는 열지만 **구글 문서로 올리면 표·서식이 깨진다.**
    // 구클은 구글 클래스룸에 올리는 용도라 그게 치명적이다.
    if (mode === 'gukl') {
      buildGuklDocx(sheets, { pointColor: PC, docTitle: academyName + ' 지문자료' })
        .then(blob => download(blob, academyName + ' 지문자료 ' + sheetTitle + ' ' + stamp() + '.docx'))
        .catch(err => alert('문서를 만들지 못했습니다.\n\n' + (err && err.message ? err.message : String(err))));
      return;
    }
    if (mode === 'vocab') {
      const oneTable = (rows) => {
        const hdr = '<tr>' + ['번호', '단어', '해석', '번호', '단어', '해석'].map(h => '<td style="border:0.75pt solid #999;background:#eef1f5;text-align:center;font-weight:bold;font-size:8.5pt;padding:2pt">' + h + '</td>').join('') + '</tr>';
        const rowsHtml = rows.map(row => '<tr>' + [row.L, row.R].map(c => {
          const no = c ? c.no : '';
          const badge = (c && listLike && c.start && c.pnum) ? '<span style="background:'+PC+';color:#fff;font-size:7pt;font-weight:bold;padding:0 3pt">' + c.pnum + '번</span> ' : '';
          const en = c ? ((vocabMode === 'en' && !vocabAnswer) ? '' : badge + esc(c.en)) : '';
          const ko = c ? ((vocabMode === 'ko' && !vocabAnswer) ? '' : esc(c.ko)) : '';
          return '<td style="border:0.5pt solid #bbb;text-align:center;color:' + PC + ';font-weight:bold;font-size:8pt;height:17pt">' + no + '</td><td style="border:0.5pt solid #bbb;padding:1pt 4pt;font-size:9pt">' + en + '</td><td style="border:0.5pt solid #bbb;padding:1pt 4pt;font-size:9pt;color:#333">' + ko + '</td>';
        }).join('') + '</tr>').join('');
        return '<table style="width:100%;border-collapse:collapse"><colgroup><col style="width:7%"><col style="width:21%"><col style="width:22%"><col style="width:7%"><col style="width:21%"><col style="width:22%"></colgroup>' + hdr + rowsHtml + '</table>';
      };
      const half = (rows) => rows ? (
        '<table width="100%" style="border-collapse:collapse;border-bottom:1pt solid #1d1d1f;margin-bottom:3pt"><tr><td style="font-size:20pt;font-weight:bold;padding-bottom:2pt">' + esc(vocabClass || '________') + '</td><td align="right" style="font-size:8.5pt;color:#666">범위 ' + esc(vocabRange) + '</td></tr></table>' +
        '<table width="100%" style="font-size:8.5pt;margin-bottom:4pt"><tr><td>날짜 ' + esc(vocabDate) + '</td><td>이름 ______________</td><td align="right"><b>틀린 개수 ______ / 50</b></td></tr></table>' +
        oneTable(rows)
      ) : '';
      const body = pageList.map((pg, i) => '<div' + (i < pageList.length - 1 ? ' style="page-break-after:always"' : '') + '><table width="100%" style="border-collapse:collapse"><tr><td width="49%" valign="top" style="padding-right:10pt">' + half(pg.leftRows) + '</td><td width="2%"></td><td width="49%" valign="top" style="padding-left:10pt;border-left:0.5pt dashed #999">' + half(pg.rightRows) + '</td></tr></table></div>').join('');
      const head = '<head><meta charset="utf-8"><title>단어장</title><style>@page WordSectionL { size: 29.7cm 21.0cm; margin: 1.2cm; mso-page-orientation: landscape; } div.WordSectionL { page: WordSectionL; } body { font-family: \'Malgun Gothic\', sans-serif; }</style></head>';
      const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' + head + '<body><div class="WordSectionL">' + body + '</div></body></html>';
      const blob = new Blob(['﻿', html], { type: 'application/msword' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      const d = new Date();
      a.download = academyName + ' ' + sheetTitle + ' ' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.doc';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return;
    }
    const parts = sheets.map((sh, si) => {
      let content = '';
      if (mode === 'line') {
        content = sh.lineItems.map(it =>
          '<p style="margin:10pt 0 2pt;font-size:11pt;line-height:150%"><b style="color:' + PC + '">' + it.num + '</b>&nbsp; ' + esc(it.en) + '</p>' +
          (hideKo
            ? '<p style="margin:0 0 4pt 20pt;border-bottom:1pt solid #999">&nbsp;</p>'
            : '<p style="margin:0 0 4pt 20pt;color:#666;font-size:10pt">' + esc(it.ko) + '</p>')
        ).join('');
      } else if (mode === 'order') {
        content = sh.orderItems.map(it =>
          '<p style="padding:4pt 2pt;margin:0;border-bottom:0.5pt solid #eee;font-size:10.5pt;line-height:145%"><b style="color:' + PC + '">' + it.label + '</b>&nbsp;&nbsp; ' + esc(it.en) + '</p>'
        ).join('') +
        '<p style="margin-top:14pt;font-size:10.5pt"><b>글의 순서</b>&nbsp;&nbsp;' + (showAnswer ? sh.answerSeq : '______________________________') + '</p>';
      } else {
        content = '<p style="font-size:11pt;line-height:285%;text-align:justify;text-indent:20pt">' + esc(sh.rawText) + '</p>';
        if (mode === 'raw' && rawKo && sh.rawKoText) {
          content += '<hr style="border:none;border-top:0.5pt solid #d2d2d7;margin:14pt 0 8pt">' +
            '<p style="font-size:10.5pt;color:#86868b;font-weight:bold;margin:0 0 6pt">해석</p>' +
            '<p style="font-size:10.5pt;line-height:180%;text-align:justify;text-indent:14pt;color:#3a3a3c">' + esc(sh.rawKoText) + '</p>';
        }
      }
      if (mode === 'order') return '<p style="font-size:16pt;font-weight:bold;margin:0 0 4pt">' + (si + 1) + '번</p><hr style="border:none;border-top:1pt solid #1d1d1f;margin:4pt 0 12pt">' + content;
      return '<table width="100%" style="font-size:9pt;color:#888"><tr><td>' + esc(academyName) + ' · English Reading</td><td align="right">' + '이름 ______________&nbsp;&nbsp;날짜 ______________</td></tr></table>' +
        '<h1 style="font-size:17pt;margin:16pt 0 2pt">' + sheetTitle + '</h1>' +
        '<p style="font-size:10pt;color:#666;margin:0">' + esc(sh.passageSource) + ' — ' + esc(sh.passageTitle) + '</p>' +
        '<hr style="border:none;border-top:1pt solid #1d1d1f;margin:10pt 0 4pt">' +
        '<p style="font-size:9pt;color:#666;margin:0 0 12pt">' + directions + '</p>' + content;
    });
    // 한문장배열: 맨 뒤에 정답지를 항상 추가 (12개씩 A4 한 장으로 분할)
    if (mode === 'order') {
      const ROWS_PER_PAGE = 10;
      for (let start = 0; start < sheets.length; start += ROWS_PER_PAGE) {
        const chunk = sheets.slice(start, start + ROWS_PER_PAGE);
        const pageNo = Math.floor(start / ROWS_PER_PAGE) + 1;
        const pageCnt = Math.ceil(sheets.length / ROWS_PER_PAGE);
        const rows = chunk.map((sh, j) => {
          const idx = start + j;
          return '<p style="margin:9pt 0;font-size:11pt;line-height:150%"><b style="color:' + PC + '">' + String(idx + 1).padStart(2, '0') + '</b>&nbsp;&nbsp;' + esc(sh.passageSource) + ' — ' + esc(sh.passageTitle) +
            '<br><b style="font-size:13pt;letter-spacing:1pt">' + sh.answerSeq + '</b></p>';
        }).join('');
        parts.push(
          '<table width="100%" style="font-size:9pt;color:#888"><tr><td>' + esc(academyName) + ' · English Reading</td><td align="right">정답' + (pageCnt > 1 ? ' (' + pageNo + '/' + pageCnt + ')' : '') + '</td></tr></table>' +
          '<h1 style="font-size:17pt;margin:16pt 0 2pt">한 문장 배열 · 정답</h1>' +
          '<p style="font-size:10pt;color:#666;margin:0">전체 ' + sheets.length + '개 지문</p>' +
          '<hr style="border:none;border-top:1pt solid #1d1d1f;margin:10pt 0 8pt">' + rows
        );
      }
    }
    // A4 페이지 크기·여백을 미리보기와 동일하게 지정 (좌우 여백 일치)
    const head = '<head><meta charset="utf-8"><title>지문자료</title>' +
      '<style>' +
      '@page WordSection1 { size: 21.0cm 29.7cm; margin: 1.7cm 1.6cm 1.7cm 1.6cm; mso-page-orientation: portrait; }' +
      'div.WordSection1 { page: WordSection1; }' +
      'body { font-family: \'Malgun Gothic\', sans-serif; }' +
      '</style></head>';
    const joined = parts.map((p, i) => '<div' + (i < parts.length - 1 ? ' style="page-break-after:always"' : '') + '>' + p + '</div>').join('');
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' + head +
      '<body><div class="WordSection1">' + joined + '</div></body></html>';
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    a.download = academyName + ' 지문자료 ' + sheetTitle + ' ' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.doc';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  const doTxt = () => {
    if (!sheets.length) { alert('먼저 지문을 선택하세요.'); return; }
    const txt = sheets.map(sh => sh.passageSource + '\n' + sh.rawText).join('\n\n');
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const dd = new Date();
    a.download = academyName + ' 쌩지문 ' + dd.getFullYear() + ('0' + (dd.getMonth() + 1)).slice(-2) + ('0' + dd.getDate()).slice(-2) + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  const pdfBaseName = () => {
    const d = new Date();
    const dstr = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    // 단어 모드: 파일명 = 반명_날짜
    if (mode === 'vocab') return (vocabClass || '반') + '_' + vocabDate.replace(/\s+/g, '');
    return academyName + ' 지문자료 ' + sheetTitle + ' ' + dstr;
  };
  const doPdf = () => {
    if (!sheets.length && mode !== 'variant') { alert('먼저 지문을 선택하세요.'); return; }
    const base = pdfBaseName();
    // 데스크톱 앱: Electron 네이티브 printToPDF로 벡터 PDF 바로 저장 (대화상자 없이)
    if (window.desktopSavePDF) { window.desktopSavePDF(base + '.pdf'); return; }
    // 웹: 브라우저 인쇄 → 'PDF로 저장'. 저장 파일명은 문서 제목을 따르므로 임시로 변경.
    const prev = document.title; document.title = base;
    window.print();
    setTimeout(() => { document.title = prev; }, 800);
  };
  // 답지 다운로드 — 정답지 페이지만 남겨 다시 그린 뒤 PDF로 찍고 원래대로 돌린다(주문파일과 같은 방식)
  const doAnsPdf = async () => {
    if (!varHasAns) { alert('정답지가 없습니다.\n유형과 지문을 고르고, 순서 칸의 정답지 체크박스를 켜 주세요.'); return; }
    const base = pdfBaseName() + ' 답지';
    setAnsOnly(true);
    try {
      await new Promise(r => {
        let done = false;
        const go = () => { if (!done) { done = true; r(); } };
        requestAnimationFrame(() => requestAnimationFrame(go));
        setTimeout(go, 300);
      });
      if (window.desktopSavePDF) await window.desktopSavePDF(base + '.pdf');
      else { const prev = document.title; document.title = base; window.print(); setTimeout(() => { document.title = prev; }, 800); }
    } finally { setAnsOnly(false); }
  };
  const doPrint = () => {
    if (!sheets.length && mode !== 'variant') { alert('먼저 지문을 선택하세요.'); return; }
    const prev = document.title; document.title = pdfBaseName();
    window.print();
    setTimeout(() => { document.title = prev; }, 800);
  };

  // ===== 주문파일: 인쇄소 입고용 CMYK 도련본 =====
  // 규격 근거는 .claude/skills/print-ready-pdf (SKILL.md · references/press-specs.md).
  //  · 재단 210×297mm, 도련 3mm → 용지 216×303mm
  //  · 재단선 없음: 국내 온라인 인쇄소(레드프린팅·성원애드피아 등)는 자체 하리꼬미로 마크를 붙인다
  //  · 본문 검정·회색은 K 단독(먹1도) — 작은 글씨를 4도로 겹치면 정합이 틀려 번진다
  //  · 포인트색은 아래 배합으로 고정한다. 눈으로 확인 못 하는 값이라 저장 후 표로 보여준다.
  const PRESS_BUILD = {
    '#0066cc': { cmyk: [0.90, 0.60, 0, 0], name: '포인트 블루' },
    '#d92d2d': { cmyk: [0, 0.85, 0.80, 0.05], name: '포인트 레드' },
    '#c99000': { cmyk: [0, 0.35, 1.00, 0.10], name: '포인트 골드' },
  };
  // 프리셋의 연한 톤은 손으로 고른 색이라 배합의 정확한 망점이 아니다 → 잉크가 탁해지지 않게 따로 지정
  const PRESS_TINT = {
    '#eef3fb': [0.08, 0.04, 0, 0], '#66a3e0': [0.50, 0.28, 0, 0],
    '#fdeeee': [0, 0.07, 0.06, 0], '#e08a8a': [0, 0.45, 0.40, 0],
    '#f8f1dd': [0, 0.04, 0.14, 0], '#d8b25a': [0, 0.25, 0.70, 0.02],
  };
  const pressOverrides = () => {
    const rgbOf = (hex) => { const c = pcHexToRgb(hex); return [c.r, c.g, c.b]; };
    const main = (PC || '').toLowerCase();
    const b = PRESS_BUILD[main];
    // tint:true → 이 색을 흰색과 섞은 연한 톤은 같은 배합의 망점으로 환산한다.
    // 워크북 팔레트(WB_STYLE_FOR)가 전부 pcTint(PC, t)이므로 이 한 줄로 함께 처리된다.
    const out = [{ rgb: rgbOf(main), cmyk: b ? b.cmyk : null, name: b ? b.name : '포인트색(공식 환산)', tint: true }];
    [PCsoft, PCpale].forEach(hex => {
      const t = PRESS_TINT[(hex || '').toLowerCase()];
      if (t) out.push({ rgb: rgbOf(hex), cmyk: t, name: '포인트 연한톤' });
    });
    // 워크북의 진한 네이비는 pcShade(PC, 0.35) = 흰색이 아니라 검정 쪽으로 섞은 색이라 망점 판정에 걸리지 않는다.
    // 인쇄에서는 같은 배합 + K30 으로 찍는 것이 맞다(색상은 유지, 어둡기만 K로).
    if (b) out.push({ rgb: rgbOf(pcShade(PC, 0.35)), cmyk: [b.cmyk[0], b.cmyk[1], b.cmyk[2], 0.30], name: '워크북 진한톤' });
    return out;
  };
  const doOrder = async () => {
    if (!sheets.length) { alert('먼저 지문을 선택하세요.'); return; }
    if (!window.desktopSaveOrderPDF) {
      alert('주문파일은 데스크톱 앱에서만 만들 수 있습니다.\n(브라우저 미리보기에서는 CMYK 변환을 할 수 없습니다)');
      return;
    }
    const d = new Date();
    const dstr = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    const filename = academyName + ' 교재 주문용 ' + dstr + ' CMYK 도련3mm 재단선.pdf';
    setOrderExport(true);
    try {
      // 주문 모드 스타일(@page 216×303 · 임베드 가능 폰트)이 실제로 적용된 뒤에 렌더해야 한다.
      // 창이 최소화·백그라운드면 rAF가 멈추므로 타이머로도 반드시 풀리게 한다.
      await new Promise(r => {
        let done = false;
        const go = () => { if (!done) { done = true; r(); } };
        requestAnimationFrame(() => requestAnimationFrame(go));
        setTimeout(go, 300);
      });
      const res = await window.desktopSaveOrderPDF({ filename, overrides: pressOverrides() });
      if (res && res.ok) setPressResult(res);
      else if (res && !res.canceled) alert('주문파일을 만들지 못했습니다.\n\n' + (res.error || '알 수 없는 오류'));
    } catch (err) {
      alert('주문파일을 만들지 못했습니다.\n\n' + String((err && err.message) || err));
    } finally {
      setOrderExport(false);
    }
  };
  // 주문파일 전용 인쇄 스타일. 화면에는 영향이 없다(@media print 안에서만 적용).
  //  · 한글이 Noto Sans KR로 떨어지면 Chromium이 임베드하지 못한다(가변/CFF 폰트) → 인쇄소에서 글자가 깨진다.
  //    맑은 고딕은 윈도우 기본 탑재 + TrueType이라 항상 서브셋 임베드된다.
  //  · 세리프로 지정된 영어 문단은 Georgia를 유지한다(인라인 스타일을 선택자로 집어냄).
  // 메모 면의 줄 — 예전엔 repeating-linear-gradient(배경 이미지)였는데 인쇄에서 말썽이었다.
  //  · 보통 인쇄: 브라우저가 배경 이미지를 기본으로 빼버려 줄이 아예 안 나온다.
  //  · 주문파일: Skia 가 그라디언트를 래스터로 빼내 CMYK 변환을 피해간다(그림자·블러와 같은 문제).
  // 그래서 진짜 선(border-bottom)으로 그린다 — 벡터로 나가고 CMYK 로 제대로 변환된다.
  const MEMO_LINE_H = 38;   // 줄 높이(기존 그라디언트 주기와 동일)
  const memoLines = () => (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {Array.from({ length: 30 }, (_, i) => (
        <div key={i} style={{ height: (MEMO_LINE_H - 1) + 'px', borderBottom: '1px solid #e5e5ea' }}></div>
      ))}
    </div>
  );

  const ORDER_CSS = [
    '@media print {',
    // 용지 = 재단 사이즈 그대로 210×297mm. 인쇄소가 재단선·도련을 모두 원하지 않는다(2026-08-11).
    // main.js 의 spec 과 **반드시 함께** 맞춘다 — 어긋나면 변환기가 "용지가 작습니다"로 예외를 던진다.
    //   · 재단선+도련: @page 234mm 321mm · top·left 12mm  ← main.js { bleed: 3, marks: true }
    //   · 도련만:      @page 216mm 303mm · top·left  3mm  ← main.js { bleed: 3, marks: false }
    //   · 둘 다 없음:  @page 210mm 297mm · top·left  0     ← main.js { bleed: 0, marks: false }  ← 지금
    //
    // 시트를 용지 가운데(12mm 지점)에 놓는 방법이 까다롭다 — 둘 다 실패했다:
    //  · [data-sheet]에 margin 12mm  → 페이지가 바뀔 때 Chromium이 margin-top을 버려서
    //    내용이 위로 12mm 밀린다(실제 주문파일에서 위 0/아래 24mm로 확인).
    //  · @page에 margin 12mm        → 여백 밖이 잘려서 간지의 도련(재단선 밖 3mm 색면)이
    //    통째로 사라진다(픽셀 검증으로 확인). 재단하면 가장자리에 흰 줄.
    // 그래서 상대이동(position:relative + top/left)을 쓴다. 레이아웃·페이지 분할에는
    // 영향이 없고(각 면은 여전히 페이지 맨 위에서 시작), 그리기만 12mm 안쪽으로 옮기며,
    // 시트 밖으로 나가는 도련 outline도 잘리지 않는다.
    // Chromium 은 이 값을 594.96pt(=209.889mm)로 살짝 줄여 내놓는다 — pt 로 지정해도 같다(실측).
    // 그래서 도련 0 일 때는 pressready 가 TrimBox 를 용지에 맞춘다(210mm 로 못박지 않는다).
    // 재단할 여백이 없는 모드라 용지가 곧 재단 영역이다.
    '  @page { size: 210mm 297mm; margin: 0; }',
    '  [data-sheet] { width: 210mm !important; height: 297mm !important; margin: 0 !important; position: relative !important; top: 0; left: 0; }',
    // 그림자·블러는 화면용 장식이고, 인쇄에서는 래스터 이미지나 투명도로 빠져 CMYK 변환을 피해간다 → 없앤다
    '  [data-sheet], [data-sheet] * { box-shadow: none !important; text-shadow: none !important; filter: none !important; }',
    "  [data-sheet], [data-sheet] * { font-family: Inter, 'Spoqa Han Sans Neo', 'Malgun Gothic', sans-serif !important; }",
    '  [data-sheet] [style*="Georgia"] { font-family: Georgia, \'Times New Roman\', \'Spoqa Han Sans Neo\', \'Malgun Gothic\', serif !important; }',
    '}',
  ].join('\n');

  // 마지막으로 수정한 날짜 — 수정할 때마다 이 값을 갱신합니다.
  const lastModified = '2026년 7월 6일 수정';

  // ============ RENDER ============
  return (
    <div data-root="" className={dark ? 'dark' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: T.bg, fontFamily: "Inter, 'Spoqa Han Sans Neo', 'Malgun Gothic', sans-serif", color: T.text }}>

      {/* ambient blobs — 다크: 진한 검정~진한 보라 블러 그라데이션 */}
      <div data-noprint="" style={{ position: 'absolute', top: '-140px', left: '26%', width: '520px', height: '520px', borderRadius: '50%', background: dark ? '#1c1133' : '#aecdf2', opacity: dark ? 0.55 : 0.55, filter: 'blur(100px)', pointerEvents: 'none' }}></div>
      <div data-noprint="" style={{ position: 'absolute', bottom: '-180px', right: '-120px', width: '560px', height: '560px', borderRadius: '50%', background: dark ? '#251644' : '#d9e6f7', opacity: dark ? 0.45 : 0.6, filter: 'blur(110px)', pointerEvents: 'none' }}></div>
      <div data-noprint="" style={{ position: 'absolute', bottom: '-120px', left: '-140px', width: '420px', height: '420px', borderRadius: '50%', background: dark ? '#140c28' : '#ece7de', opacity: dark ? 0.55 : 0.55, filter: 'blur(90px)', pointerEvents: 'none' }}></div>

      {/* nav */}
      <nav data-noprint="" style={{ position: 'relative', zIndex: 3, flex: 'none', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: T.navBg, WebkitBackdropFilter: 'saturate(180%) blur(20px)', backdropFilter: 'saturate(180%) blur(20px)', borderBottom: '1px solid ' + T.navBorder }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="nav-brand" style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px', color: T.text }}>{academyName}</span>
          <span style={{ fontSize: '14px', color: T.textDim, whiteSpace: 'nowrap' }}>지문 스튜디오</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onHome && <button onClick={() => onHome()} style={{ border: 'none', cursor: 'pointer', background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', fontSize: '13px', color: T.text, fontFamily: 'inherit', padding: '6px 12px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '4px' }}>‹ 홈</button>}
        </div>
      </nav>

      <div data-row="" style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ===== SIDEBAR: 지문 라이브러리 ===== */}
        <aside data-noprint="" style={{ flex: 'none', width: '296px', margin: '16px 0 16px 16px', borderRadius: '18px', background: T.panel, WebkitBackdropFilter: 'saturate(180%) blur(24px)', backdropFilter: 'saturate(180%) blur(24px)', border: '1px solid ' + T.panelBorder, padding: '14px 12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {mode === 'vocab' ? (
            // 단어 업무: 캡슐(4탭)과 '기타 단어장'을 한 컨테이너로 붙이고, 글라스 알약이 위↔아래로 이동
            <div style={{ position: 'relative', flex: 'none', width: '100%', marginBottom: '12px', padding: '4px', borderRadius: '18px', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
              <div style={{ position: 'absolute', zIndex: 0, pointerEvents: 'none', height: '32px', transition: 'top 0.5s cubic-bezier(0.34,1.4,0.5,1), left 0.5s cubic-bezier(0.34,1.4,0.5,1), width 0.5s cubic-bezier(0.34,1.4,0.5,1)', ...(srcTab === 'etc' ? { top: '40px', left: '4px', width: 'calc(100% - 8px)' } : { top: '4px', left: `calc(4px + ${Math.max(0, srcIndex)} * (100% - 8px) / 4)`, width: 'calc((100% - 8px) / 4)' }) }}>
                <div ref={srcThumbRef} className="lg-glass"></div>
              </div>
              <div style={{ display: 'flex', height: '32px' }}>
                {SRC_TABS.map(t => (
                  <button key={t.key} onClick={() => switchSrc(t.key)} className="lg-seg lg-sm"
                    style={{ height: '100%', color: srcTab === t.key ? (dark ? '#4da3ff' : '#0066cc') : T.textDim, fontWeight: srcTab === t.key ? 600 : 400 }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <button onClick={() => switchSrc('etc')} className="lg-seg lg-sm"
                style={{ flex: 'none', display: 'block', width: '100%', height: '32px', marginTop: '4px', color: srcTab === 'etc' ? (dark ? '#4da3ff' : '#0066cc') : T.textDim, fontWeight: srcTab === 'etc' ? 700 : 500 }}>
                기타 단어장
              </button>
            </div>
          ) : (
            <div className="lg-track lg-sm" style={{ flex: 'none', width: '100%', marginBottom: '12px', '--n': SRC_TABS.length }}>
              <div className="lg-thumb" style={{ transform: `translateX(${Math.max(0, srcIndex) * 100}%)`, opacity: srcIndex < 0 ? 0 : 1 }}>
                <div ref={srcThumbRef} className="lg-glass"></div>
              </div>
              {SRC_TABS.map(t => (
                <button key={t.key} onClick={() => switchSrc(t.key)} className="lg-seg"
                  style={{ color: srcTab === t.key ? (dark ? '#4da3ff' : '#0066cc') : T.textDim, fontWeight: srcTab === t.key ? 600 : 400 }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {gradeList.length > 0 && (
            <div style={{ flex: 'none', display: 'flex', gap: '6px', marginBottom: '12px', padding: '0 2px' }}>
              {gradeList.map(g => (
                <button key={g} className="sel-chip" data-sel={g === curGrade ? 'true' : 'false'}
                  onClick={() => setGrade(g)}><span className="lbl">{g}</span></button>
              ))}
            </div>
          )}

          {srcTab === 'mock' && (
            <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px', padding: '0 2px' }}>
              {availYears(mockGrade, vocabTree).map(y => {
                const hasData = availMonths(mockGrade, y, vocabTree).length > 0;
                return (
                  <button key={y} className="sel-chip" data-sel={y === mockYear ? 'true' : 'false'} onClick={() => setMockYear(y)}
                    style={{ opacity: hasData ? 1 : 0.45 }}><span className="lbl">{y}</span></button>
                );
              })}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {srcTab === 'mock' && !(window.PASSAGES && Object.keys(window.PASSAGES).length) && (
              <div style={{ margin: '4px 2px 10px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(224,49,49,0.10)', border: '1px solid rgba(224,49,49,0.35)', fontSize: '13px', color: '#e03131', lineHeight: 1.55 }}>
                지문 데이터를 불러오지 못했습니다.<br />새로고침(Ctrl+R) 해주세요.
              </div>
            )}
            {srcTab === 'mock' && monthList.length === 0 && (window.PASSAGES && Object.keys(window.PASSAGES).length > 0) && (
              <div style={{ padding: '28px 14px', textAlign: 'center', fontSize: '13px', color: T.textFaint, lineHeight: 1.6 }}>
                {mockYear} {mockGrade} 지문이 아직 등록되지 않았습니다.<br />지문이 준비되면 이곳에 표시됩니다.
              </div>
            )}
            {srcTab === 'mock' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {monthList.map(m => {
                  const open = openMonth === m;
                  const nums = availNums(mockGrade, mockYear, m, vocabTree);
                  const targets = nums.map(num => ({ kind: 'mock', grade: mockGrade, year: mockYear, month: m, num }));
                  const selCount = targets.filter(t => isSelected(t)).length;
                  const allSel = targets.length > 0 && selCount === targets.length;
                  return (
                    <div key={m} style={{ display: 'flex', flexDirection: 'column' }}>
                      <button onClick={() => setOpenMonth(open ? null : m)} style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: selCount > 0 ? 'rgba(0,102,204,0.06)' : 'transparent', transition: 'background 0.14s cubic-bezier(0.4,0,0.2,1)' }}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={leafLabelStyle(selCount > 0)}>{m === '수능' ? '대학수학능력시험' : m + ' 학력평가'}</span>
                          <span style={{ display: 'block', fontSize: '12px', color: '#86868b', marginTop: '2px' }}>{selCount > 0 ? selCount + '개 지문 선택됨' : nums.length + '개 지문 (' + (nums[0] || '') + '~' + String(nums[nums.length - 1] || '').split('-').pop() + '번)'}</span>
                        </span>
                        <span style={{ flex: 'none', color: '#86868b', fontSize: '16px', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s cubic-bezier(0.4,0,0.2,1)' }}>›</span>
                      </button>
                      {open && (
                        <div style={{ margin: '2px 0 8px', padding: '12px', borderRadius: '12px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)', border: '1px solid ' + (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') }}>
                          <button onClick={() => toggleAllExam(targets, allSel)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 10px', fontFamily: 'inherit' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: T.text }}>전체 선택</span>
                            <span className="sw-track" data-on={allSel ? 'true' : 'false'}>
                              <span className="sw-knob"></span>
                            </span>
                          </button>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', userSelect: 'none' }}>
                            {targets.map(t => (
                              <button key={t.num}
                                onMouseDown={(e) => { e.preventDefault(); startPaint(t); }}
                                onMouseEnter={() => paintOver(t)}
                                onClick={(e) => e.preventDefault()}
                                className="num-chip" data-sel={isSelected(t) ? 'true' : 'false'}><span className="num">{t.num}</span></button>
                            ))}
                          </div>
                          <div style={{ fontSize: '11px', color: T.textFaint, marginTop: '8px' }}>드래그하면 여러 개를 한 번에 선택/해제</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {srcTab === 'book' && renderTree(bookCfg)}
            {srcTab === 'ebs' && renderTree(ebsCfg)}
            {srcTab === 'school' && (
              <div>
                <div style={{ fontSize: '12px', fontStyle: 'italic', color: T.textFaint, padding: '2px 4px 10px', letterSpacing: '-0.1px' }}>2026년 2학기 중간고사 기준입니다</div>
                {renderTree(schoolCfg)}
              </div>
            )}
            {srcTab === 'etc' && (() => {
              const E = window.ETC_VOCAB || {};
              const keys = Object.keys(E);
              if (!keys.length) return (
                <div style={{ padding: '28px 14px', textAlign: 'center', fontSize: '13px', color: T.textFaint, lineHeight: 1.6 }}>
                  등록된 기타 단어장이 없습니다.<br />단어 목록을 추가하면 여기에 표시됩니다.
                </div>
              );
              const dayNum = (s) => { const m = String(s).match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
              const isGroup = (v) => v && !Array.isArray(v) && typeof v === 'object';
              // 리프 칩 패널 (전체 선택 + 드래그 칩). 2단계·3단계 공용.
              const chipPanel = (leafMap, mkTarget, unitWord) => {
                const leaves = Object.keys(leafMap).sort((a, b) => dayNum(a) - dayNum(b));
                const targets = leaves.map(mkTarget);
                const allSel = targets.length > 0 && targets.every(t => isSelected(t));
                return (
                  <div style={{ margin: '2px 0 8px', padding: '10px 12px', borderRadius: '12px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)', border: '1px solid ' + (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') }}>
                    <button onClick={() => toggleAllExam(targets, allSel)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: '0 2px 10px', fontFamily: 'inherit' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: T.text }}>전체 선택</span>
                      <span className="sw-track" data-on={allSel ? 'true' : 'false'}><span className="sw-knob"></span></span>
                    </button>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', userSelect: 'none' }}>
                      {leaves.map((lf, i) => {
                        const t = targets[i];
                        const s = isSelected(t);
                        return (
                          <button key={lf}
                            onMouseDown={(e) => { e.preventDefault(); startPaint(t); }}
                            onMouseEnter={() => paintOver(t)}
                            onClick={(e) => e.preventDefault()}
                            className="num-chip" data-sel={s ? 'true' : 'false'} style={{ minWidth: '46px' }}><span className="num">{dayNum(lf)}</span></button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '11px', color: T.textFaint, marginTop: '8px' }}>드래그하면 여러 {unitWord}을 한 번에 선택/해제</div>
                  </div>
                );
              };
              const groupSelCount = (val, key) => {
                let c = 0;
                for (const sub of Object.keys(val)) {
                  if (Array.isArray(val[sub])) { if (isSelected({ kind: 'etc', group: key, day: sub })) c++; }
                  else for (const lf of Object.keys(val[sub])) if (isSelected({ kind: 'etc', group: key, sub, day: lf })) c++;
                }
                return c;
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {keys.map(key => {
                    const val = E[key];
                    // 배열 = 단일 목록(리프). 묶음이 없으므로 번호 범위(N번~N번)로 잘라 출제한다.
                    if (Array.isArray(val)) {
                      const N = val.length;
                      const r = etcRange[key] || { from: '1', to: String(N) };
                      const a = parseInt(r.from, 10), b = parseInt(r.to, 10);
                      const okRange = a >= 1 && b >= 1 && a <= N && b <= N && a <= b;
                      const whole = okRange && a === 1 && b === N;
                      const target = okRange ? (whole ? { kind: 'etc', name: key } : { kind: 'etc', name: key, from: a, to: b }) : null;
                      const sel = target ? isSelected(target) : false;
                      const setR = (k, v) => setEtcRange(Object.assign({}, etcRange, { [key]: Object.assign({}, r, { [k]: v }) }));
                      const numStyle = { width: '58px', padding: '5px 6px', fontSize: '13px', textAlign: 'center', fontFamily: 'inherit', color: T.text, background: dark ? 'rgba(255,255,255,0.06)' : '#fff', border: '1px solid ' + (okRange ? T.divider : '#d94f4f'), borderRadius: '8px' };
                      return (
                        <div key={key} style={{ padding: '9px 12px', borderRadius: '10px', background: sel ? 'rgba(0,102,204,0.10)' : 'transparent' }}>
                          <button onClick={() => target && toggleSel(target)} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: 0, border: 'none', background: 'none', cursor: target ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                            <CheckBox checked={sel} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={leafLabelStyle(sel)}>{key}</span>
                              <span style={{ display: 'block', fontSize: '12px', color: '#86868b', marginTop: '2px' }}>
                                단어 {N}개{okRange && !whole ? ' 중 ' + (b - a + 1) + '개 (' + a + '~' + b + '번)' : ''}
                              </span>
                            </span>
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', paddingLeft: '28px', flexWrap: 'wrap' }}>
                            <input type="number" min="1" max={N} value={r.from} onChange={(e) => setR('from', e.target.value)} style={numStyle} />
                            <span style={{ fontSize: '13px', color: T.textFaint }}>~</span>
                            <input type="number" min="1" max={N} value={r.to} onChange={(e) => setR('to', e.target.value)} style={numStyle} />
                            <span style={{ fontSize: '12px', color: T.textFaint }}>번</span>
                            <button onClick={() => setEtcRange(Object.assign({}, etcRange, { [key]: { from: '1', to: String(N) } }))}
                              style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', border: '1px solid ' + T.divider, background: 'none', color: T.textFaint, cursor: 'pointer', fontFamily: 'inherit' }}>전체</button>
                            {!okRange && <span style={{ fontSize: '11px', color: '#d94f4f' }}>1~{N} 사이, 시작 ≤ 끝</span>}
                          </div>
                        </div>
                      );
                    }
                    const subKeys = Object.keys(val).sort((a, b) => dayNum(a) - dayNum(b));
                    const three = isGroup(val[subKeys[0]]); // 하위가 객체면 3단계(그룹→권→UNIT)
                    const open = openEtc === key;
                    const selCount = groupSelCount(val, key);
                    return (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                        <button onClick={() => setOpenEtc(open ? '' : key)} style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: selCount > 0 ? 'rgba(0,102,204,0.06)' : 'transparent', transition: 'background 0.14s cubic-bezier(0.4,0,0.2,1)' }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={leafLabelStyle(selCount > 0)}>{key}</span>
                            <span style={{ display: 'block', fontSize: '12px', color: '#86868b', marginTop: '2px' }}>{selCount > 0 ? selCount + '개 선택됨' : (three ? subKeys.length + '권' : subKeys.length + '개')}</span>
                          </span>
                          <span style={{ flex: 'none', color: '#86868b', fontSize: '16px', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s cubic-bezier(0.4,0,0.2,1)' }}>›</span>
                        </button>
                        {open && (three ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '10px' }}>
                            {subKeys.map(sub => {
                              const units = Object.keys(val[sub]);
                              const subOpen = openEtcSub === key + '|' + sub;
                              const subSel = units.filter(u => isSelected({ kind: 'etc', group: key, sub, day: u })).length;
                              return (
                                <div key={sub} style={{ display: 'flex', flexDirection: 'column' }}>
                                  <button onClick={() => setOpenEtcSub(subOpen ? '' : key + '|' + sub)} style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: subSel > 0 ? 'rgba(0,102,204,0.06)' : 'transparent' }}>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                      <span style={leafLabelStyle(subSel > 0)}>{sub}</span>
                                      <span style={{ display: 'block', fontSize: '12px', color: '#86868b', marginTop: '2px' }}>{subSel > 0 ? subSel + '개 UNIT 선택됨' : units.length + '개 UNIT'}</span>
                                    </span>
                                    <span style={{ flex: 'none', color: '#86868b', fontSize: '15px', display: 'inline-block', transform: subOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s cubic-bezier(0.4,0,0.2,1)' }}>›</span>
                                  </button>
                                  {subOpen && chipPanel(val[sub], u => ({ kind: 'etc', group: key, sub, day: u }), 'UNIT')}
                                </div>
                              );
                            })}
                          </div>
                        ) : chipPanel(val, d => ({ kind: 'etc', group: key, day: d }), 'Day'))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div style={{ position: 'relative', flex: 'none', padding: '12px 10px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid ' + T.divider, marginTop: '10px' }}>
            {orderOpen && selList.length > 0 && (() => {
              // 교과서는 과 단위로 고르므로 목록에도 '교재 N과'로 묶어 보여준다(본문 7개가 7줄로 늘어지지 않게).
              // 부록은 따로 고른 것이니 'N과 부록'으로 한 줄 더 둔다. 나머지 소스는 지문 하나가 한 줄.
              const groups = [];
              selList.forEach(sel => {
                let key = selKey(sel), label = null;
                if (sel.kind === 'book') {
                  const extra = unitOrder(sel.unit) >= 10000;
                  key = ['book', sel.grade, sel.book, sel.lesson, extra ? 'extra' : 'main'].join('|');
                  label = sel.book + ' ' + sel.lesson + (extra ? ' 부록' : '');
                }
                const last = groups[groups.length - 1];
                if (last && last.key === key && sel.kind === 'book') last.items.push(sel);
                else groups.push({ key, label, sel, items: [sel] });
              });
              const reorderGroups = (from, to) => {
                const gs = [...groups];
                const [moved] = gs.splice(from, 1);
                gs.splice(to, 0, moved);
                setSelList(gs.reduce((a, g) => a.concat(g.items), []));
              };
              return (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, maxHeight: '300px', overflowY: 'auto', background: dark ? '#232529' : '#ffffff', border: '1px solid ' + T.panelBorder, borderRadius: '14px', boxShadow: dark ? '0 12px 40px rgba(0,0,0,0.55)' : '0 12px 40px rgba(0,0,0,0.25)', padding: '6px', zIndex: 40 }}>
                  <div style={{ fontSize: '11px', color: T.textFaint, padding: '4px 6px 6px' }}>선택한 지문 · 드래그로 순서 변경</div>
                  {groups.map((g, i) => (
                    <div key={g.key}
                      draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragEnd={() => setDragIdx(null)}
                      onDragOver={e => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) { reorderGroups(dragIdx, i); setDragIdx(i); } }}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 7px', borderRadius: '8px', cursor: 'grab', userSelect: 'none', background: dragIdx === i ? (dark ? 'rgba(77,163,255,0.20)' : 'rgba(0,102,204,0.12)') : (i % 2 ? 'transparent' : (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')) }}>
                      <span style={{ flex: 'none', color: T.textFaint, fontSize: '14px', lineHeight: 1 }}>⠿</span>
                      <span style={{ flex: 'none', width: '16px', fontSize: '11px', fontWeight: 700, color: '#0066cc', textAlign: 'center' }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: '12px', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.label ? <>{g.label}{g.items.length > 1 && <span style={{ color: T.textFaint, marginLeft: '5px' }}>{g.items.length}개</span>}</>
                          : (g.sel.kind === 'mock' ? <>{g.sel.grade + ' ' + g.sel.year + ' ' + g.sel.month + ' '}<b style={{ color: '#0066cc' }}>{g.sel.num}번</b></> : sourceLabel(g.sel))}
                      </span>
                      <button onClick={() => applyMany(g.items, false)} style={{ ...ordBtn(false), color: '#e03131', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })()}
            <span style={{ fontSize: '13px', color: T.textDim }}>지문 {selList.length}개 선택됨</span>
            <span style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {selList.length > 0 && <button onClick={() => setOrderOpen(v => !v)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: orderOpen ? '#0066cc' : T.textDim, fontFamily: 'inherit', padding: 0, fontWeight: orderOpen ? 600 : 400 }}>순서 {orderOpen ? '▾' : '▴'}</button>}
              <button onClick={() => { setSelList([]); setOrderOpen(false); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#0066cc', fontFamily: 'inherit', padding: 0 }}>모두 해제</button>
            </span>
          </div>
        </aside>

        {/* ===== 변형문제(모드 · 교재 제작 변형문제 틀): 문제 유형 선택 — 지문 선택 칸 바로 오른쪽 ===== */}
        {((mode === 'textbook' && tbKind === 'variant') || mode === 'variant') && (
          <aside data-noprint="" style={{ flex: 'none', width: '168px', margin: '16px 0 16px 10px', borderRadius: '18px', background: T.panel, WebkitBackdropFilter: 'saturate(180%) blur(24px)', backdropFilter: 'saturate(180%) blur(24px)', border: '1px solid ' + T.panelBorder, padding: '14px 10px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: T.text }}>문제 유형</span>
              <span style={{ fontSize: '12px', color: T.textDim }}>{varSel.length}/{VAR_TYPES.length}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', padding: '0 2px 8px' }}>
              {[['전체', () => setTbVarTypes(VAR_TYPES.map(x => x.k))], ['해제', () => setTbVarTypes([])]].map(([l, fn]) => (
                <button key={l} onClick={fn} style={{ flex: 1, height: '26px', borderRadius: '8px', border: '1px solid ' + T.panelBorder, background: T.emptyCardBg, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', color: T.textDim }}>{l}</button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {VAR_TYPES.map(x => {
                const on = tbVarTypes.includes(x.k);
                return (
                  <button key={x.k} onClick={() => setTbVarTypes(p => (p.includes(x.k) ? p.filter(k => k !== x.k) : [...p, x.k]))}
                    style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left', padding: '8px 8px', marginBottom: '2px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: on ? 600 : 500, color: T.text, background: on ? (dark ? 'rgba(77,163,255,0.12)' : 'rgba(0,102,204,0.07)') : 'transparent' }}>
                    <span aria-hidden="true" style={{ flex: 'none', width: '15px', height: '15px', display: 'grid', placeItems: 'center', borderRadius: '4px', border: '1px solid ' + (on ? (dark ? '#4d9fff' : '#0066cc') : (dark ? 'rgba(255,255,255,0.3)' : '#b8b8be')), background: on ? (dark ? '#4d9fff' : '#0066cc') : 'transparent' }}>
                      {on ? <span style={{ fontSize: '11px', lineHeight: 1, fontWeight: 700, color: dark ? '#14161a' : '#ffffff' }}>✓</span> : null}
                    </span>
                    {x.l}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* ===== 변형문제: 파트 순서 — 문제 유형 칸 바로 오른쪽. 고른 유형이 있을 때만 ===== */}
        {((mode === 'textbook' && tbKind === 'variant') || mode === 'variant') && varSel.length > 0 && (
          <aside data-noprint="" style={{ flex: 'none', width: '176px', margin: '16px 0 16px 10px', borderRadius: '18px', background: T.panel, WebkitBackdropFilter: 'saturate(180%) blur(24px)', backdropFilter: 'saturate(180%) blur(24px)', border: '1px solid ' + T.panelBorder, padding: '14px 10px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: T.text }}>순서</span>
              <span style={{ fontSize: '12px', color: T.textDim }}>{varSel.length}개</span>
            </div>
            <div style={{ fontSize: '11.5px', color: T.textDim, padding: '0 4px 10px', lineHeight: 1.5 }}>끌어서 옮기거나 ▲▼</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {varSel.map((x, i) => (
                <div key={x.k} draggable
                  onDragStart={() => setVarDrag(i)} onDragEnd={() => setVarDrag(null)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); moveVar(varDrag, i); setVarDrag(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 6px', marginBottom: '4px', borderRadius: '9px', border: '1px solid ' + T.panelBorder, background: T.emptyCardBg, cursor: 'grab', opacity: varDrag === i ? 0.45 : 1 }}>
                  <span style={{ flex: 'none', width: '16px', fontSize: '11px', fontWeight: 700, color: dark ? '#4da3ff' : '#0066cc', textAlign: 'center' }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.l}</span>
                  <button disabled={i === 0} onClick={() => moveVar(i, i - 1)} style={ordBtn(i === 0)}>▲</button>
                  <button disabled={i === varSel.length - 1} onClick={() => moveVar(i, i + 1)} style={ordBtn(i === varSel.length - 1)}>▼</button>
                </div>
              ))}
            </div>
            {/* 각 파트 안의 문항 순서 — 파트끼리 순서(위 목록)와는 별개 */}
            <div style={{ flex: 'none', borderTop: '1px solid ' + T.divider, marginTop: '8px', paddingTop: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: T.text, padding: '0 4px 7px' }}>파트 안 문항 순서</div>
              <div className="lg-track lg-sm" style={{ width: '100%', '--n': 2 }}>
                <div className="lg-thumb" style={{ transform: `translateX(${varSeq === 'random' ? 100 : 0}%)` }}><div className="lg-glass"></div></div>
                {[{ k: 'passage', l: '지문순' }, { k: 'random', l: '랜덤순' }].map(t => (
                  <button key={t.k} className="lg-seg" onClick={() => setVarSeq(t.k)}
                    style={{ color: varSeq === t.k ? (dark ? '#4da3ff' : '#0066cc') : T.textDim, fontWeight: varSeq === t.k ? 600 : 400 }}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            {/* 정답지 — 맨 뒤에 붙일 것: 정답 및 해설(해설 없으면 정답만) · 빠른 정답표 */}
            <div style={{ flex: 'none', borderTop: '1px solid ' + T.divider, marginTop: '10px', paddingTop: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: T.text, padding: '0 4px 6px' }}>정답지</div>
              {[['정답 및 해설', varAnsExp, setVarAnsExp], ['빠른 정답', varAnsQuick, setVarAnsQuick]].map(([l, on, set]) => (
                <button key={l} onClick={() => set(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left', padding: '7px 8px', marginBottom: '2px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: on ? 600 : 500, color: T.text, background: on ? (dark ? 'rgba(77,163,255,0.12)' : 'rgba(0,102,204,0.07)') : 'transparent' }}>
                  <span aria-hidden="true" style={{ flex: 'none', width: '15px', height: '15px', display: 'grid', placeItems: 'center', borderRadius: '4px', border: '1px solid ' + (on ? (dark ? '#4d9fff' : '#0066cc') : (dark ? 'rgba(255,255,255,0.3)' : '#b8b8be')), background: on ? (dark ? '#4d9fff' : '#0066cc') : 'transparent' }}>
                    {on ? <span style={{ fontSize: '11px', lineHeight: 1, fontWeight: 700, color: dark ? '#14161a' : '#ffffff' }}>✓</span> : null}
                  </span>
                  {l}
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* ===== MAIN ===== */}
        <main data-main="" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>

          {/* toolbar */}
          <div data-noprint="" style={{ position: 'relative', zIndex: 20, flex: 'none', margin: '16px 16px 0', borderRadius: '18px', background: T.panel, WebkitBackdropFilter: 'saturate(180%) blur(24px)', backdropFilter: 'saturate(180%) blur(24px)', border: '1px solid ' + T.panelBorder, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* 트랙은 모드 수 × 84px 고정 폭(알약 위치가 % 라 폭이 정해져야 한다). 폰에서는 이 상자 안에서 옆으로 민다. */}
            <div style={{ flex: 'none', maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <div className="lg-track" style={{ width: (MODES.length * 84) + 'px', '--n': MODES.length }}>
              <div className="lg-thumb" style={{ transform: `translateX(${modeIndex * 100}%)` }}>
                <div ref={thumbRef} className="lg-glass"></div>
              </div>
              {MODES.map(t => {
                const wip = false; // 준비 중 모드 없음 (변형문제는 2026-10-29 개방 — 유형 선택)
                return (
                  <button key={t.key} className="lg-seg"
                    onClick={() => { if (wip) { setWipOpen(true); return; } setMode(t.key); }}
                    style={{ color: mode === t.key ? (dark ? '#4da3ff' : '#0066cc') : (wip ? (dark ? '#5a5a62' : '#c7c7cc') : T.textDim), fontWeight: mode === t.key ? 600 : 400 }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            </div>
            <div style={{ flex: 'none', width: '1px', height: '22px', background: T.divider }}></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {mode === 'line' && !creator && (
                <button style={chipStyle(hideKo)} onClick={() => setHideKo(v => !v)}>{hideKo ? '해석 보이기' : '해석 가리기'}</button>
              )}
              {mode === 'raw' && (
                <button style={chipStyle(rawKo)} onClick={() => setRawKo(v => !v)}>{rawKo ? '해석 끄기' : '해석 켜기'}</button>
              )}
              {mode === 'order' && <>
                <button style={chipStyle(false)} onClick={() => setSeed(s => s + 1)}>다시 섞기</button>
                <button style={chipStyle(showAnswer)} onClick={() => setShowAnswer(v => !v)}>정답 표시</button>
              </>}
              {mode === 'vocab' && <>
                <div className="lg-track lg-sm" style={{ flex: 'none', width: (4 * 84) + 'px', '--n': 4 }}>
                  <div className="lg-thumb" style={{ transform: `translateX(${['list', 'ko', 'en', 'book'].indexOf(vocabMode) * 100}%)` }}>
                    <div className="lg-glass"></div>
                  </div>
                  {[{ k: 'list', l: '단어장' }, { k: 'ko', l: '한글쓰기' }, { k: 'en', l: '영어쓰기' }, { k: 'book', l: '교재단어장' }].map(t => (
                    <button key={t.k} className="lg-seg" onClick={() => setVocabMode(t.k)}
                      style={{ color: vocabMode === t.k ? (dark ? '#4da3ff' : '#0066cc') : T.textDim, fontWeight: vocabMode === t.k ? 600 : 400 }}>
                      {t.l}
                    </button>
                  ))}
                </div>
                <button style={chipStyle(vocabImpose)} onClick={() => setVocabImpose(v => !v)}>모아찍기</button>
                {!listLike && <button style={chipStyle(false)} onClick={() => setSeed(s => s + 1)}>셔플</button>}
                {!listLike && <button style={chipStyle(vocabAnswer)} onClick={() => setVocabAnswer(v => !v)}>{vocabAnswer ? '답 숨기기' : '답 보여주기'}</button>}
              </>}
              {mode !== 'illust' && <button style={chipStyle(engSerif)} onClick={() => setEngSerif(v => !v)}>영어 세리프</button>}
              {mode === 'workbook' && serulCheck}
              {/* 큰 틀(교재 종류) — 손필기·변형문제·파이널노트는 각각 별개의 교재다. 파트 구성은 틀마다 다르다. */}
              {mode === 'textbook' && (() => {
                const KINDS = [{ k: 'handwrite', l: '손필기' }, { k: 'variant', l: '변형문제' }, { k: 'finalnote', l: '파이널노트' }];
                const idx = KINDS.findIndex(x => x.k === tbKind);
                return (
                  <div className="lg-track" style={{ flex: 'none', width: (3 * 84) + 'px', '--n': 3, marginRight: '4px' }}>
                    <div className="lg-thumb" style={{ transform: `translateX(${(idx < 0 ? 0 : idx) * 100}%)` }}><div className="lg-glass"></div></div>
                    {KINDS.map(t => (
                      <button key={t.k} className="lg-seg" onClick={() => setTbKind(t.k)}
                        style={{ color: tbKind === t.k ? (dark ? '#4da3ff' : '#0066cc') : T.textDim, fontWeight: tbKind === t.k ? 600 : 400 }}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {/* 손필기 구성 — 단어장·손필기는 고정이라 칩이 없고, 뒤쪽 파트만 켜고 끈다 */}
              {mode === 'textbook' && tbKind === 'handwrite' && TB_EXTRA.map(x => (
                <React.Fragment key={x.k}>
                  <button style={chipStyle(tbParts.includes(x.k))}
                    onClick={() => setTbParts(p => (p.includes(x.k) ? p.filter(k => k !== x.k) : [...p, x.k]))}>
                    {x.l}
                  </button>
                  {x.k === 'workbook' && tbParts.includes('workbook') ? serulCheck : null}
                </React.Fragment>
              ))}
              {mode === 'textbook' && (
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setDesignOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '30px', padding: '0 12px', borderRadius: '9px', border: '1px solid ' + T.panelBorder, background: T.emptyCardBg, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: T.text }}>
                    디자인 · {DESIGNS[scopeDesign].name}
                    <span style={{ fontSize: '10px', color: T.textDim, transform: designOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </button>
                  {designOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, minWidth: '150px', background: dark ? '#232529' : '#ffffff', border: '1px solid ' + T.panelBorder, borderRadius: '12px', boxShadow: dark ? '0 12px 40px rgba(0,0,0,0.55)' : '0 12px 40px rgba(0,0,0,0.22)', padding: '5px' }}>
                      {Object.keys(DESIGNS).map(k => (
                        <button key={k} onClick={() => { setScopeDesign(k); setDesignOpen(false); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: scopeDesign === k ? 700 : 500, color: scopeDesign === k ? (dark ? '#4da3ff' : '#0066cc') : T.text, background: scopeDesign === k ? (dark ? 'rgba(77,163,255,0.12)' : 'rgba(0,102,204,0.07)') : 'transparent' }}>
                          {DESIGNS[k].name}{scopeDesign === k && <span style={{ fontSize: '11px' }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {mode === 'textbook' && (
                <div ref={pickerBoxRef} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '2px', position: 'relative' }}>
                  <span style={{ fontSize: '12px', color: T.textDim }}>포인트</span>
                  {[['blue', '#0066cc'], ['red', '#d92d2d'], ['yellow', '#c99000']].map(([k, col]) => (
                    <button key={k} onClick={() => { setPointKey(k); setPickerOpen(false); }} title={k}
                      style={{ width: '20px', height: '20px', borderRadius: '50%', background: col, cursor: 'pointer', padding: 0, border: pointKey === k ? '2px solid ' + (dark ? '#fff' : '#1d1d1f') : '2px solid transparent', boxShadow: pointKey === k ? '0 0 0 1px ' + col : 'none' }} />
                  ))}
                  {/* 커스텀 색 */}
                  <button onClick={() => { setPointKey('custom'); setPickerOpen(v => !v); }} title="커스텀"
                    style={{ width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', padding: 0, background: pointKey === 'custom' ? customColor : 'conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #007aff, #5856d6, #ff2d55, #ff3b30)', border: pointKey === 'custom' ? '2px solid ' + (dark ? '#fff' : '#1d1d1f') : '2px solid transparent', boxShadow: pointKey === 'custom' ? '0 0 0 1px ' + customColor : 'none' }} />
                  {pickerOpen && (<>
                    <div onClick={() => setPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 41, width: '250px', background: dark ? '#232529' : '#ffffff', border: '1px solid ' + T.panelBorder, borderRadius: '18px', boxShadow: dark ? '0 16px 48px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.22)', padding: '14px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: T.text, marginBottom: '11px' }}>커스텀 색</div>
                      <HsvColorPicker value={customColor} onChange={setCustomColor} dark={dark}
                        presets={['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e']} />
                    </div>
                  </>)}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* 삽화는 아직 내보낼 것이 없다 → 내보내기 버튼을 숨긴다 */}
              {mode === 'illust' ? null : mode === 'ppt' ? (
                <button onClick={doPpt} disabled={pptBusy || !pptItems.length} className="export-btn secondary"
                  style={{ '--hc': '#e03131', '--hc-glow': 'rgba(224,49,49,0.20)', opacity: (pptBusy || !pptItems.length) ? 0.6 : 1, cursor: (pptBusy || !pptItems.length) ? 'default' : 'pointer' }}>
                  <span>{pptBusy ? '만드는 중…' : 'PPT 다운로드'}</span>
                </button>
              ) : <>
                {mode === 'raw' && <button onClick={doTxt} className="export-btn secondary" style={{ '--hc': dark ? '#3d3d45' : '#1d1d1f', '--hc-glow': 'rgba(0,0,0,0.18)' }}><span>TXT로 저장</span></button>}
                {mode !== 'weekly' && <button onClick={doWord} className="export-btn secondary" style={{ '--hc': '#0066cc', '--hc-glow': 'rgba(0,102,204,0.20)' }}><span>Word로 저장</span></button>}
                <button onClick={doPdf} className="export-btn secondary" style={{ '--hc': '#e03131', '--hc-glow': 'rgba(224,49,49,0.20)' }}><span>PDF로 저장</span></button>
                {mode === 'variant' && <button onClick={doAnsPdf} disabled={ansOnly} className="export-btn secondary" style={{ '--hc': '#6e4bd8', '--hc-glow': 'rgba(110,75,216,0.20)', opacity: ansOnly ? 0.6 : 1 }}><span>{ansOnly ? '만드는 중…' : '답지 다운로드'}</span></button>}
                {/* 교재 제작은 인쇄 대신 '주문파일'(인쇄소 입고용 CMYK 도련본) */}
                {mode === 'textbook' ? (
                  <button onClick={doOrder} disabled={orderExport} className="export-btn secondary"
                    style={{ '--hc': '#000000', '--hc-glow': 'rgba(0,0,0,0.30)', opacity: orderExport ? 0.6 : 1, cursor: orderExport ? 'default' : 'pointer' }}>
                    <span>{orderExport ? '만드는 중…' : '주문파일'}</span>
                  </button>
                ) : (
                  <button onClick={doPrint} className="export-btn secondary" style={{ '--hc': '#1a7a3f', '--hc-glow': 'rgba(26,122,63,0.22)' }}><span>인쇄</span></button>
                )}
              </>}
            </div>
          </div>

          {/* scroll area */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div data-noprint="" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '34px', zIndex: 6, pointerEvents: 'none', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 20%, transparent 100%)', maskImage: 'linear-gradient(to bottom, #000 0%, #000 20%, transparent 100%)' }}></div>
          <div data-scroll="" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '24px 16px 40px' }}>

            {/* 삽화 — 렌더러는 10-illust.js(IllustPane). 선택 지문·PDF·직접 입력 → Gemini 삽화 생성. */}
            {mode === 'illust' && <IllustPane dark={dark} T={T} PC={PC} sheets={sheets} userName={name} isAdmin={isAdmin} />}

            {selList.length === 0 && mode !== 'variant' && mode !== 'workbook' && mode !== 'illust' && mode !== 'weekly' && (
              <div style={{ maxWidth: '420px', margin: '120px auto 0', textAlign: 'center', padding: '40px 32px', borderRadius: '18px', background: T.emptyCardBg, WebkitBackdropFilter: 'saturate(180%) blur(24px)', backdropFilter: 'saturate(180%) blur(24px)', border: '1px solid ' + T.panelBorder }}>
                <div style={{ fontSize: '19px', fontWeight: 600, letterSpacing: '-0.2px', color: T.text }}>지문을 선택하세요</div>
                <div style={{ fontSize: '14px', color: T.textDim, marginTop: '8px', lineHeight: 1.5 }}>왼쪽 라이브러리에서 지문을 체크하면<br />선택한 순서대로 자료가 만들어집니다.</div>
              </div>
            )}

            {mode === 'variant' && !varHasPages && varCard('변형문제')}

            {mode === 'workbook' && renderWorkbookSheets()}

            {/* 주간테스트 — 렌더러는 13-weekly.js(WeeklyTestPane). 평가원 양식 · 문항별 재생성/직접 수정 · 정답지 맨 뒤 */}
            {mode === 'weekly' && <WeeklyTestPane sheets={sheets} dark={dark} T={T} PC={PC} userName={name} />}

            {mode === 'ppt' && pptSlides.length > 0 && (() => {
              const SC = PPT_PX_PER_IN; // 1in = 60px → 미리보기 박스 800×450 (16:9, 실제 슬라이드 13.333×7.5in 그대로 축소)
              const BOX_W = 13.333 * SC, BOX_H = 7.5 * SC;
              const pt = (p) => p * SC / 72; // pt → px (72pt = 1in)
              const headerStyle = { position: 'absolute', left: 0.5 * SC, top: 0.3 * SC, width: (13.333 - 1) * SC, fontFamily: 'inherit', fontSize: pt(22), color: '#808080' };
              return (
                <div style={{ maxWidth: BOX_W + 40, margin: '16px auto 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ fontSize: '13px', color: T.textDim }}>{pptItems.length}개 지문 · 총 {pptSlides.length}장</div>
                    <div style={{ fontSize: '12.5px', color: T.textFaint }}>실제 폰트는 배달의민족 도현 — 화면은 근사 표시, 결과물은 ‘PPT 다운로드’로 확인</div>
                  </div>
                  {pptSlides.map((sl, i) => (
                    <div key={i} data-mfit="" style={{ margin: '0 auto 24px', width: BOX_W }}>
                      <div style={{ position: 'relative', width: BOX_W, height: BOX_H, background: '#ffffff', borderRadius: '4px', boxShadow: '0 6px 24px rgba(0,0,0,0.14)', overflow: 'hidden', fontFamily: "'Malgun Gothic', sans-serif" }}>
                        {sl.kind === 'cover' && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
                            <span style={{ fontSize: pt(45), fontWeight: 700, color: '#000' }}>{sl.text}</span>
                          </div>
                        )}
                        {sl.kind === 'body' && <>
                          <div style={headerStyle}>{sl.header}</div>
                          <div style={{ position: 'absolute', left: 0.7 * SC, top: 0.9 * SC, width: (13.333 - 1.4) * SC, height: (7.5 - 1.2) * SC, fontSize: pt(26), fontWeight: 700, color: '#000', textAlign: 'justify', lineHeight: 1.6 }}>
                            {sl.lines.map((ln, j) => <div key={j} style={{ marginBottom: j < sl.lines.length - 1 ? '0.8em' : 0 }}>{ln}</div>)}
                          </div>
                        </>}
                        {sl.kind === 'keywords' && <>
                          <div style={headerStyle}>{sl.header}</div>
                          <div style={{ position: 'absolute', left: 0.6 * SC, top: 1.5 * SC, width: (13.333 - 1.2) * SC, textAlign: 'center', fontSize: pt(40), fontWeight: 700, color: '#000', lineHeight: 1.5 }}>{sl.eng}</div>
                          <div style={{ position: 'absolute', left: 0.6 * SC, top: 3.5 * SC, width: (13.333 - 1.2) * SC, textAlign: 'center', fontSize: pt(36), fontWeight: 700, color: '#000', lineHeight: 1.5 }}>{sl.title}</div>
                        </>}
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '11.5px', color: T.textFaint, textAlign: 'right' }}>{i + 1} / {pptSlides.length}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {mode === 'vocab' && (imposeOn || bookImpose) && <style>{'@media print { @page { size: A4 landscape; margin: 0; } [data-sheet] { width: 297mm !important; height: 210mm !important; margin: 0 auto !important; } }'}</style>}

            {/* 주문파일 렌더 중에만: 도련 포함 용지 + 임베드 가능한 폰트로 전환 */}
            {orderExport && <style>{ORDER_CSS}</style>}

            {/* 교재: 맨 앞 백지 — 화면에는 숨기고 인쇄/PDF에서만 한 장 덧붙는다(쪽번호·홀짝 계산에는 미포함) */}
            {mode === 'textbook' && sheets.length > 0 && (
              <React.Fragment>
                <style>{'.print-blank{display:none}@media print{.print-blank{display:block !important}}'}</style>
                <div className="print-blank" data-sheet="" style={{ width: '794px', maxWidth: 'none', margin: '0 auto 28px', height: '1123px', minHeight: '1123px', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '2px' }}></div>
              </React.Fragment>
            )}

            {mode !== 'ppt' && pageList.map((pg, idx) => {
              const sh = pg.sh || {};
              const land = pg.kind === 'vocab' && (imposeOn || pg.book2up); // 단어 모아찍기 = 가로(landscape), 아니면 세로 A4
              const material = pg.kind === 'line' || pg.kind === 'raw' || pg.kind === 'gukl'; // 한줄해석·쌩본문·구클 = 분석서재료 형태(전체 표준)
              const showHeader = pg.pi === 0; // 이어지는 페이지엔 헤더를 넣지 않음
              const hasNum = sh.passageNum && sh.passageNum !== '';
              const mainT = sh.passageEng || sh.passageTitle;
              const subT = sh.passageEng ? sh.passageTitle : '';
              // 간지 2면은 흰 배경 + 포인트색 액센트(라벨·밑줄·◀)만 쓴다. 전면 컬러는 너무 쨍하다는
              // 피드백으로 되돌렸다. 흰 배경이라 도련용 outline도 필요 없다(종이색 = 배경색).
              return (
                <div key={idx} data-sheet="" style={{ width: land ? '1123px' : '794px', maxWidth: 'none', margin: '0 auto 28px', height: land ? '794px' : '1123px', minHeight: land ? '794px' : '1123px', background: (pg.kind === 'blank' || pg.kind === 'part' || pg.kind === 'parttoc') ? '#ffffff' : (mode === 'textbook' ? DZ.pageBg : '#ffffff'), color: '#1d1d1f',
                  border: '1px solid #e0e0e0', borderRadius: '2px', boxShadow: 'rgba(0,0,0,0.1) 0px 12px 44px', padding: land ? '18px 22px' : (mode === 'textbook'
                    // 교재 제작 전용 양면 미러 마진: 홀수쪽 좌10/우20mm, 짝수쪽 좌20/우10mm (20mm≈76px, 10mm≈38px)
                    ? ('30px ' + (idx % 2 === 0 ? 76 : 38) + 'px 24px ' + (idx % 2 === 0 ? 38 : 76) + 'px')
                    // 교재 제작의 내용 면은 전부 세로 flex 로 둔다 — 아래 쪽번호가 marginTop:auto 로
                    // 바닥에 붙으려면 부모가 flex 여야 한다. 예전엔 line·단어장만 flex 라서 구클·한문장배열·
                    // 쌩지문 면의 쪽번호가 본문 바로 아래에 찍혔다.
                    : '30px 54px 24px'), display: (land || pg.kind === 'line' || (pg.kind === 'vocab' && bookVocab)
                      || (mode === 'textbook' && pg.kind !== 'part' && pg.kind !== 'parttoc' && pg.kind !== 'blank')) ? 'flex' : 'block', flexDirection: 'column', overflow: 'hidden' }}>

                  {showHeader && (pg.kind === 'vocab' ? null : pg.kind === 'order' ? (
                    <div className="pg-head">
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.5px' }}>{pg.si + 1}<span style={{ fontSize: '16px', fontWeight: 700 }}>번</span></div>
                      <div style={{ height: '1px', background: '#1d1d1f', margin: '12px 0 20px' }}></div>
                    </div>
                  ) : material ? (
                    (DZ.kind === 'mag' ? (
                      <div className="pg-head">
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', background: PC, color: '#fff', borderRadius: '12px', padding: '11px 16px 12px', marginBottom: '12px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', opacity: 0.92 }}>{sh.label.top}</span>
                          <span style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.5px' }}>{sh.label.main}</span>
                        </div>
                        <div style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.25 }}>{mainT}</div>
                        {subT && <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px', wordBreak: 'keep-all' }}>{subT}</div>}
                        <div style={{ height: '2px', background: '#1d1d1f', margin: '12px 0 16px' }}></div>
                      </div>
                    ) : DZ.kind === 'card' ? (
                      <div className="pg-head">
                        <div style={{ marginBottom: '11px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid ' + PCpale, borderRadius: '999px', padding: '5px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: PCpale }}>{sh.label.top}</span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: PC }}>{sh.label.main}</span>
                          </span>
                        </div>
                        <div style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.25 }}>{mainT}</div>
                        {subT && <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px', wordBreak: 'keep-all' }}>{subT}</div>}
                        <div style={{ height: '10px' }}></div>
                      </div>
                    ) : DZ.kind === 'note' ? (
                      <div className="pg-head">
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px' }}>
                          <div style={{ flex: 'none' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: PC }}>{sh.label.top}</div>
                            <div style={{ fontSize: '34px', fontWeight: 800, color: '#1d1d1f', letterSpacing: '-1px', lineHeight: 1.05, borderBottom: '3px solid ' + PC, paddingBottom: '2px', display: 'inline-block' }}>{sh.label.main}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0, paddingBottom: '5px' }}>
                            <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.2px', lineHeight: 1.3 }}>{mainT}</div>
                            {subT && <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '2px', wordBreak: 'keep-all' }}>{subT}</div>}
                          </div>
                        </div>
                        <div style={{ height: '18px' }}></div>
                      </div>
                    ) : (
                      <div className="pg-head">
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                          <div style={{ flex: 'none', display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 500, color: PCpale, letterSpacing: '-0.1px', whiteSpace: 'nowrap' }}>{sh.label.top}</span>
                            <span style={{ fontSize: '40px', fontWeight: 800, color: PC, letterSpacing: '-1.2px', lineHeight: 1.02, whiteSpace: 'nowrap' }}>{sh.label.main}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '18.5px', fontWeight: 700, letterSpacing: '-0.2px', lineHeight: 1.3 }}>{mainT}</div>
                            {subT && <div style={{ fontSize: '15px', color: '#6e6e73', marginTop: '4px', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{subT}</div>}
                          </div>
                        </div>
                        <div style={{ height: '1px', background: '#1d1d1f', margin: '12px 0 18px' }}></div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px', color: '#86868b' }}>
                        <span>{academyName} · English Reading</span>
                        <span style={{ display: 'flex', gap: '14px', alignItems: 'baseline' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>이름 ______________&nbsp;&nbsp;&nbsp;날짜 ______________</span>
                        </span>
                      </div>
                      <div style={{ marginTop: '28px' }}>
                        <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.374px' }}>{sheetTitle}</div>
                        <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '6px' }}>{sh.passageSource} — {sh.passageTitle}</div>
                      </div>
                      <div style={{ height: '1px', background: '#1d1d1f', margin: '20px 0 6px' }}></div>
                      <div className="pg-head" style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '26px' }}>{directions}</div>
                    </>
                  ))}

                  {pg.kind === 'vocab' && pg.book2up ? (
                    // 교재단어장 모아찍기: 가로 한 장에 50단어 묶음 두 개(좌/우). 각 반쪽이 자기 출처 헤더를 단다.
                    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                      {[pg.left, pg.right].map((half, k) => (
                        <div key={k} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: k === 0 ? '0 16px 0 0' : '0 0 0 16px', borderLeft: k === 1 ? '1px dashed #b0b0b5' : 'none' }}>
                          {half && <div style={{ flex: 'none', height: '24px', marginBottom: '8px', display: 'flex', alignItems: 'flex-end', paddingBottom: '4px', borderBottom: '1.5px solid #1d1d1f' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.3px', color: '#1d1d1f' }}>{half.header}</span>
                          </div>}
                          {half && renderBookTable(half.rows, true)}
                        </div>
                      ))}
                    </div>
                  ) : pg.kind === 'vocab' && bookVocab ? (
                    // 교재 단어장: 상단에 출처 헤더(홀수 페이지만, 짝수는 같은 높이 빈칸) + 표
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ flex: 'none', height: '30px', marginBottom: '12px', display: 'flex', alignItems: 'flex-end', paddingBottom: '5px', borderBottom: '1.5px solid #1d1d1f' }}>
                        {pg.headerVisible && <span style={{ fontSize: '14.5px', fontWeight: 800, letterSpacing: '-0.3px', color: '#1d1d1f' }}>{pg.header}</span>}
                      </div>
                      {pg.memo ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#86868b', marginBottom: '10px' }}>메모</div>
                          {memoLines()}
                        </div>
                      ) : renderBookTable(pg.leftRows)}
                    </div>
                  ) : pg.kind === 'vocab' && (imposeOn ? (
                    // 가로 2-up 모아찍기: 좌/우 각각 상단 헤더 + 표(바닥까지 채움)
                    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                      {[[pg.leftRows, pg.leftLegend], [pg.rightRows, pg.rightLegend]].map(([rows, legend], k) => (
                        <div key={k} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: k === 0 ? '0 22px 0 0' : '0 0 0 22px', borderLeft: k === 1 ? '1px dashed #b0b0b5' : 'none' }}>
                          {rows && renderVocabHeader(legend)}
                          {rows && <div style={{ marginTop: '6px' }}>{renderVocabTable(rows, 27)}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // 세로 A4 단일 표
                    <div>
                      {renderVocabHeader(pg.leftLegend)}
                      <div style={{ marginTop: '10px' }}>{renderVocabTable(pg.leftRows, 35)}</div>
                    </div>
                  ))}

                  {pg.kind === 'line' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <div>
                      {pg.items.map((it, i) => {
                        const lh = (EN_PX * (pg.lh || 2.89)) + 'px';
                        const enBlock = (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: EN_PX + 'px', lineHeight: pg.lh || 2.89, fontFamily: enFam, fontWeight: DZ.kind === 'mag' ? 600 : 400 }}>{it.en}</div>
                            {(hideKo && mode !== 'textbook')
                              ? <div style={{ marginTop: '12px', height: '26px', borderBottom: '1px solid #d2d2d7' }}></div>
                              : <div style={{ marginTop: '6px', fontSize: KO_PX + 'px', lineHeight: 1.6, color: DZ.koColor, wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{it.ko}</div>}
                          </div>
                        );
                        if (DZ.kind === 'mag') return (
                          <div key={i} className="pg-item" style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid #ededf0' }}>
                            <div style={{ flex: 'none', width: '26px', lineHeight: lh }}><span style={{ fontSize: '27px', fontWeight: 800, color: PCsoft, letterSpacing: '-1.5px', whiteSpace: 'nowrap' }}>{it.num}</span></div>
                            {enBlock}
                          </div>
                        );
                        if (DZ.kind === 'card') return (
                          <div key={i} className="pg-item" style={{ display: 'flex', gap: '16px', padding: '8px 15px 8px 12px', marginLeft: '-12px', marginRight: '-15px', marginBottom: '6px', borderRadius: '13px', background: '#ffffff', border: '1px solid ' + pcTint(PC, 0.76), boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ flex: 'none', width: '26px', lineHeight: lh }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: PC, color: '#fff', fontSize: '11.5px', fontWeight: 700, verticalAlign: 'middle' }}>{it.num}</span></div>
                            {enBlock}
                          </div>
                        );
                        if (DZ.kind === 'note') return (
                          <div key={i} className="pg-item" style={{ display: 'flex', gap: '16px', padding: '12px 0 12px 8px', marginLeft: '-8px', borderLeft: '2px solid ' + pcTint(PC, 0.45), borderBottom: '1px solid ' + pcTint(PC, 0.72) }}>
                            <div style={{ flex: 'none', width: '26px', lineHeight: lh }}><span style={{ fontSize: '13px', fontWeight: 700, color: PC }}>{it.num}</span></div>
                            {enBlock}
                          </div>
                        );
                        return (
                          <div key={i} className="pg-item" style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid #f0f0f2' }}>
                            <div style={{ flex: 'none', width: '26px', lineHeight: lh }}><span style={{ fontSize: '13px', fontWeight: 600, color: PC }}>{it.num}</span></div>
                            {enBlock}
                          </div>
                        );
                      })}
                      </div>
                      {pg.memo && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#86868b', letterSpacing: '-0.2px', marginBottom: '10px' }}>메모</div>
                          {memoLines()}
                        </div>
                      )}
                      {pg.raw && (
                        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                          <div style={{ height: '1px', background: '#d2d2d7', margin: '0 0 10px' }}></div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#86868b', letterSpacing: '-0.2px', marginBottom: '6px' }}>전체 지문</div>
                          <div style={{ fontSize: '13.5px', lineHeight: 1.75, textAlign: 'justify', textIndent: '1.5em', fontFamily: "Georgia, 'Times New Roman', serif" }}>{pg.raw}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {pg.kind === 'gukl' && (
                    <div>
                      {pg.items.map((it, i) => (
                        <div key={i} className="pg-item" style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid #f0f0f2' }}>
                          <div style={{ flex: 'none', width: '26px', lineHeight: 1.75 }}><span style={{ fontSize: '13px', fontWeight: 600, color: PC }}>{it.num}</span></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '16.5px', lineHeight: 1.75, fontFamily: enFam }}>{it.en}</div>
                            <div style={{ marginTop: '10px', fontSize: '14px', fontWeight: 600, color: '#6e6e73' }}>해석 :</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pg.kind === 'order' && (
                    <div>
                      <div>
                        {pg.items.map((it, i) => (
                          <div key={i} className="pg-item" style={{ display: 'flex', gap: '12px', padding: '8px 2px', borderBottom: '1px solid #f0f0f2' }}>
                            <div style={{ flex: 'none', width: '24px', fontSize: '14px', fontWeight: 700, color: PC }}>{it.label}</div>
                            <div style={{ flex: 1, fontSize: '14.5px', lineHeight: 1.55, fontFamily: engFontFamily }}>{it.en}</div>
                          </div>
                        ))}
                      </div>
                      {pg.showOrderRow && (
                        <div className="pg-item" style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginTop: '24px' }}>
                          <span style={{ flex: 'none', fontSize: '14px', fontWeight: 600 }}>글의 순서</span>
                          {showAnswer
                            ? <span style={{ fontSize: '15px', fontWeight: 600, color: PC, letterSpacing: '0.02em' }}>{sh.answerSeq}</span>
                            : <span style={{ flex: 1, height: '22px', borderBottom: '1px solid #d2d2d7' }}></span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 변형문제 문제 페이지 — 원본 문항지처럼 2단. 나만의 손필기 톤(옅은 포인트 라벨 + 큰 포인트 유형명 + 검정 1px 선, 포인트색 번호) */}
                  {pg.kind === 'vq' && (vqEnsureCss(), (
                    <div>
                      {pg.typeHead && (
                        <div className="pg-head" style={{ height: VQ_HEAD + 'px' }}>
                          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                            <div style={{ flex: 'none', display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '15px', fontWeight: 500, color: PCpale, letterSpacing: '-0.1px', whiteSpace: 'nowrap' }}>{pg.headTop || '변형문제'}</span>
                              <span style={{ fontSize: '40px', fontWeight: 800, color: PC, letterSpacing: '-1.2px', lineHeight: 1.02, whiteSpace: 'nowrap' }}>{pg.headMain || pg.vtype.l}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '18.5px', fontWeight: 700, letterSpacing: '-0.2px', lineHeight: 1.3, wordBreak: 'keep-all' }}>{pg.headTitle != null ? pg.headTitle : (pg.stemHint || '').replace(/<[^>]+>/g, '')}</div>
                            </div>
                          </div>
                          <div style={{ height: '1px', background: '#1d1d1f', margin: '12px 0 0' }}></div>
                        </div>
                      )}
                      {pg.quick && (
                        <div style={{ height: pg.quickH + 'px' }}>
                          {pg.quickCap && <div style={{ fontSize: '12px', fontWeight: 700, color: PC, letterSpacing: '0.5px', height: '20px' }}>빠른 정답</div>}
                          {!pg.quickCap && <div style={{ height: '20px' }}></div>}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridAutoFlow: 'column', gridTemplateRows: 'repeat(' + Math.ceil(pg.quick.length / 5) + ', ' + VQ_QROW + 'px)', columnGap: '10px' }}>
                            {pg.quick.map(q => (
                              <div key={q.num} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid ' + pcTint(PC, 0.8) }}>
                                <span style={{ flex: 'none', width: '30px', fontSize: '12px', fontWeight: 800, color: PC }}>{String(q.num).padStart(2, '0')}</span>
                                <span className="vq-cn" style={{ fontSize: '14px' }}>{q.answer || ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', height: (VQ_COL_H - (pg.typeHead ? VQ_HEAD : 0) - (pg.quickH || 0)) + 'px' }}>
                        {pg.cols.map((col, ci) => (
                          <div key={ci} style={ci === 0
                            ? { flex: 'none', width: VQ_COL_W + 'px' }
                            : { flex: 'none', width: (VQ_COL_W + VQ_GUT + 1) + 'px', marginLeft: VQ_GUT + 'px', paddingLeft: VQ_GUT + 'px', borderLeft: '1px solid #d2d2d7' }}>
                            {col.map((a, ai) => <div key={ai} dangerouslySetInnerHTML={{ __html: vqAtomHtml(a) }} />)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {pg.kind === 'raw' && (
                    <div>
                      <div style={{ fontSize: '17px', textAlign: 'justify', textIndent: '2em', fontFamily: engFontFamily, lineHeight: rawLeading }}>{pg.text}</div>
                      {pg.ko && (
                        <div style={{ marginTop: '22px' }}>
                          <div style={{ height: '1px', background: '#d2d2d7', margin: '0 0 10px' }}></div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#86868b', letterSpacing: '-0.2px', marginBottom: '8px' }}>해석</div>
                          <div style={{ fontSize: '14.5px', textAlign: 'justify', textIndent: '1em', lineHeight: 1.95, color: '#3a3a3c' }}>{pg.ko}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 교재 간지 1면: PART N · 파트명 · 대전제 */}
                  {pg.kind === 'part' && (() => {
                    const m = PART_META[pg.part - 1] || PART_META[0];
                    return (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '3px', color: PC }}>PART {m.n}</div>
                        <div style={{ fontSize: '54px', fontWeight: 800, letterSpacing: '-1.6px', lineHeight: 1.1, margin: '10px 0 0', color: '#1d1d1f' }}>{m.t}</div>
                        <div style={{ height: '3px', width: '64px', background: PC, margin: '22px 0 18px' }}></div>
                        {tbGist.length > 0 && (
                          <div style={{ fontSize: tbGistFs + 'px', color: '#6e6e73', letterSpacing: '-0.2px', lineHeight: 1.8 }}>
                            {tbGist.map((t, gi) => <div key={gi}>{t}</div>)}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 교재 간지 2면: 전체 목차 — 현재 파트만 강조 */}
                  {pg.kind === 'parttoc' && (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '2px', color: PC, marginBottom: '22px' }}>CONTENTS</div>
                      {PART_META.map(m => {
                        const on = m.n === pg.part;
                        // 흰 배경: 현재 파트만 포인트색·검정으로 살리고 나머지는 연회색으로 가라앉힌다.
                        return (
                          <div key={m.n} style={{ display: 'flex', alignItems: 'baseline', gap: '16px', padding: '13px 0', borderBottom: '1px solid ' + (on ? PC : '#ececec') }}>
                            <span style={{ flex: 'none', width: '68px', fontSize: '12px', fontWeight: 700, letterSpacing: '1.4px', color: on ? PC : '#c7c7cc' }}>PART {m.n}</span>
                            <span style={{ flex: 1, fontSize: on ? '23px' : '18px', fontWeight: on ? 800 : 500, letterSpacing: '-0.4px', color: on ? '#1d1d1f' : '#c7c7cc' }}>{m.t}</span>
                            {on && <span style={{ flex: 'none', fontSize: '12px', fontWeight: 700, color: PC }}>◀</span>}
                          </div>
                        );
                      })}
                      {tbGist.length > 0 && (
                        <div style={{ fontSize: Math.min(tbGistFs, 13) + 'px', color: '#a1a1a6', marginTop: '20px', lineHeight: 1.75 }}>
                          {tbGist.map((t, gi) => <div key={gi}>{t}</div>)}
                        </div>
                      )}
                    </div>
                  )}

                  {pg.kind === 'variant' && (
                    <div>
                      <div style={{ padding: '13px 16px', borderRadius: '10px', background: 'rgba(0,102,204,0.06)', border: '1px dashed rgba(0,102,204,0.35)', fontSize: '13px', color: '#0066cc', marginBottom: '22px' }}>
                        {sheetTitle} 형식은 준비 중입니다. 원하는 문제 형식을 알려주시면 이 자리에 자동 생성됩니다.
                      </div>
                      <div style={{ fontSize: '16px', textAlign: 'justify', textIndent: '2em', fontFamily: engFontFamily, lineHeight: 1.9 }}>{pg.text}</div>
                    </div>
                  )}

                  {/* 교재 제작: 쪽번호 — 홀수쪽 좌측 하단, 짝수쪽 우측 하단 (간지·백지 제외) */}
                  {mode === 'textbook' && pg.kind !== 'blank' && pg.kind !== 'part' && pg.kind !== 'parttoc' && (
                    <div style={{ flex: 'none', marginTop: 'auto', paddingTop: '8px', fontSize: '11px', color: '#86868b', textAlign: idx % 2 === 0 ? 'left' : 'right' }}>{idx + 1}</div>
                  )}

                </div>
              );
            })}

            {/* 교재 제작 스코프: 워크북을 고른 경우에만 맨 뒤에 합본(같은 미러 마진, 쪽 연속) */}
            {mode === 'textbook' && tbKind === 'handwrite' && sheets.length > 0 && tbParts.includes('workbook') && (
              <WorkbookSheetsInner key={'tb|pc' + PC + '|' + (wbSerul ? 's1|' : 's0|') + pageList.length + '|' + sheets.map(s => s.key).join('|')} sheets={sheets} academyName={academyName} serul={wbSerul} variant="textbook" pageOffset={pageList.length} pcMain={PC} />
            )}

            {/* 변형문제·파이널노트 교재 — 틀 구조만 세워 둠. 각 교재의 파트 구성은 협의 후 채운다. */}
            {mode === 'textbook' && tbKind === 'variant' && !varHasPages && varCard('변형문제 교재')}
            {mode === 'textbook' && tbKind === 'finalnote' && sheets.length > 0 && (
              <div style={{ maxWidth: '560px', margin: '80px auto 0', textAlign: 'center', padding: '40px 34px', borderRadius: '18px', background: T.emptyCardBg, border: '1px solid ' + T.panelBorder }}>
                <div style={{ fontSize: '19px', fontWeight: 700, color: T.text }}>파이널노트 교재</div>
                <div style={{ fontSize: '13.5px', color: T.textDim, marginTop: '11px', lineHeight: 1.7 }}>
                  이 교재 틀을 만들었습니다. 이제 <b>파이널노트 교재의 파트 구성</b>을 정하면<br />여기에 손필기 교재처럼 간지·목차와 함께 조립됩니다.
                </div>
              </div>
            )}

            {mode === 'order' && sheets.length > 0 && (() => {
              const ROWS_PER_PAGE = 10; // A4 한 장에 안전하게 들어가는 정답 줄 수
              const pages = [];
              for (let i = 0; i < sheets.length; i += ROWS_PER_PAGE) pages.push(sheets.slice(i, i + ROWS_PER_PAGE));
              return pages.map((chunk, pi) => (
                <div key={'ans' + pi} data-sheet="" style={{ width: '794px', maxWidth: 'none', margin: '0 auto 28px', minHeight: '1123px', background: '#ffffff', color: '#1d1d1f', border: '1px solid #e0e0e0', borderRadius: '2px', boxShadow: 'rgba(0,0,0,0.1) 0px 12px 44px', padding: '64px 60px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px', color: '#86868b' }}>
                    <span>{academyName} · English Reading</span>
                    <span>정답{pages.length > 1 ? ` (${pi + 1}/${pages.length})` : ''}</span>
                  </div>
                  <div style={{ marginTop: '28px' }}>
                    <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.374px' }}>한 문장 배열 · 정답</div>
                    <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '6px' }}>전체 {sheets.length}개 지문{pages.length > 1 ? ` · ${pi + 1}면` : ''}</div>
                  </div>
                  <div style={{ height: '1px', background: '#1d1d1f', margin: '20px 0 6px' }}></div>
                  <div style={{ marginTop: '18px' }}>
                    {chunk.map((sh, j) => {
                      const idx = pi * ROWS_PER_PAGE + j;
                      return (
                        <div key={j} className="pg-item" style={{ display: 'flex', gap: '16px', padding: '14px 0', borderBottom: '1px solid #f0f0f2' }}>
                          <div style={{ flex: 'none', width: '26px', fontSize: '13px', fontWeight: 600, color: '#0066cc', paddingTop: '3px' }}>{String(idx + 1).padStart(2, '0')}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', color: '#6e6e73' }}>{sh.passageSource} — {sh.passageTitle}</div>
                            <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px', letterSpacing: '0.04em' }}>{sh.answerSeq}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
          </div>
        </main>
      </div>

      {pwOpen && <PwModal dark={dark} onClose={() => setPwOpen(false)} />}

      {wipOpen && (
        <div data-noprint="" className="wip-backdrop" onClick={() => setWipOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.28)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}>
          <div className="wip-card" onClick={e => e.stopPropagation()}
            style={{ width: '320px', maxWidth: '86vw', background: 'rgba(255,255,255,0.9)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', backdropFilter: 'saturate(180%) blur(20px)', border: '1px solid rgba(255,255,255,0.85)', borderRadius: '20px', boxShadow: '0 24px 70px rgba(0,0,0,0.28)', padding: '28px 24px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', lineHeight: 1, marginBottom: '12px' }}>🚧</div>
            <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>준비 중입니다</div>
            <button onClick={() => setWipOpen(false)}
              style={{ marginTop: '22px', width: '100%', height: '40px', border: 'none', borderRadius: '11px', background: '#0066cc', color: '#ffffff', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', letterSpacing: '-0.1px', cursor: 'pointer' }}>확인</button>
          </div>
        </div>
      )}

      {/* 주문파일 결과: 규격 + CMYK 변환표 + 프리플라이트.
          색 배합은 파일을 눈으로 봐서는 확인할 수 없으므로 반드시 표로 알려준다(인쇄소 문의용). */}
      {pressResult && (() => {
        const rep = pressResult.report || {};
        const pf = pressResult.preflight || { checks: [] };
        const bad = (pf.checks || []).filter(c => !c.ok);
        const line = { display: 'flex', justifyContent: 'space-between', gap: '14px', fontSize: '12.5px', padding: '4px 0' };
        return (
          <div data-noprint="" onClick={() => setPressResult(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.34)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: '520px', maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto', background: dark ? '#232529' : '#ffffff', border: '1px solid ' + T.panelBorder, borderRadius: '20px', boxShadow: '0 24px 70px rgba(0,0,0,0.3)', padding: '24px', color: T.text }}>
              <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>
                {bad.length ? '주문파일 저장 — 확인 필요' : '주문파일이 저장되었습니다'}
              </div>
              <div style={{ fontSize: '12px', color: T.textDim, marginTop: '5px', wordBreak: 'break-all' }}>{pressResult.filePath}</div>

              <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '12px', background: dark ? 'rgba(255,255,255,0.06)' : '#f5f5f7' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>인쇄 규격</div>
                <div style={line}><span style={{ color: T.textDim }}>재단 사이즈</span><span>{(rep.trim || []).join(' × ')} mm (A4) · {rep.pages}면</span></div>
                <div style={line}><span style={{ color: T.textDim }}>작업 사이즈</span><span>{(rep.media || []).join(' × ')} mm · 도련 {rep.bleed}mm</span></div>
                <div style={line}><span style={{ color: T.textDim }}>재단선</span><span>{rep.marks ? '네 모서리 8개 · ' + rep.markLen + 'mm · 레지스트레이션' : '없음 (온라인 인쇄소 기준)'}</span></div>
                <div style={line}><span style={{ color: T.textDim }}>색상</span><span>DeviceCMYK · 본문 먹1도(K100)</span></div>
                <div style={line}><span style={{ color: T.textDim }}>총잉크량</span><span>최대 {rep.maxTac}% (기준 300%)</span></div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>색 변환표</div>
                {(rep.colours || []).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '4px 0', fontSize: '12.5px' }}>
                    <span style={{ flex: 'none', width: '15px', height: '15px', borderRadius: '4px', background: c.hex, border: '1px solid ' + (dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)') }}></span>
                    <span style={{ flex: 'none', width: '66px', fontVariantNumeric: 'tabular-nums', color: T.textDim }}>{c.hex}</span>
                    <span style={{ flex: 'none', width: '116px', fontVariantNumeric: 'tabular-nums' }}>C{c.cmyk[0]} M{c.cmyk[1]} Y{c.cmyk[2]} K{c.cmyk[3]}</span>
                    <span style={{ flex: 1, color: T.textDim, fontSize: '11.5px' }}>{c.name || (c.via === 'K100' ? '먹1도' : c.tac === 0 ? '종이 흰색(잉크 없음)' : c.via === 'gray' ? '회색 K단독' : c.via === 'ucr' ? '공식 환산' : '')}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '7px' }}>프리플라이트</div>
                {(pf.checks || []).map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', padding: '3px 0', fontSize: '12.5px' }}>
                    <span style={{ flex: 'none', width: '14px', color: c.ok ? '#1a7a3f' : '#d92d2d', fontWeight: 700 }}>{c.ok ? '✓' : '✗'}</span>
                    <span style={{ flex: 'none', width: '132px' }}>{c.name}</span>
                    <span style={{ flex: 1, color: T.textDim }}>{c.detail}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '14px', fontSize: '11.5px', lineHeight: 1.6, color: T.textDim }}>
                인쇄소에 확인할 것 — ① 재단선(톰보)이 필요한지 ② 글자 아웃라인을 요구하는지.
                둘 중 하나라도 필요하다고 하면 알려주세요.
              </div>

              <button onClick={() => setPressResult(null)}
                style={{ marginTop: '18px', width: '100%', height: '40px', border: 'none', borderRadius: '11px', background: bad.length ? '#d92d2d' : '#0066cc', color: '#ffffff', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', letterSpacing: '-0.1px', cursor: 'pointer' }}>확인</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// HeroUI 스타일 커스텀 색 선택기 (프리셋 + 2D 채도/명도 영역 + Hue 슬라이더 + 셔플 + HEX)
