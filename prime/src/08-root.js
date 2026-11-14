// Root/Shell — 로그인·데이터로딩·화면전환 게이팅 + 마운트
// index.html 에서 분리(2026-07-29). 로드 순서는 index.html 의 script 태그 순서가 결정한다.
function Root() {
  const [session, setSession] = useState(undefined); // undefined=확인중, null=로그아웃, obj=로그인
  const [dataState, setDataState] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [dataErr, setDataErr] = useState('');
  useEffect(() => {
    // 세션이 있으면: 로그인 시각을 (없을 때만) 기록하고, 12시간 지났으면 signOut.
    // 반환: 'expired'면 만료 처리됨, 아니면 세션(또는 null).
    const enforce = (s) => {
      if (!s) return null;
      let at = 0; try { at = Number(sessionStorage.getItem('sl-login-at')) || 0; } catch (e) {}
      if (!at) { at = Date.now(); try { sessionStorage.setItem('sl-login-at', String(at)); } catch (e) {} } // 최초 1회만 기록(복원 때 리셋 방지)
      if (Date.now() - at > SESSION_MAX_MS) { SB.auth.signOut(); return 'expired'; }
      return s;
    };
    SB.auth.getSession().then(({ data }) => {
      const r = enforce(data.session || null);
      if (r !== 'expired') setSession(r);
    }).catch(() => setSession(null));
    const { data: sub } = SB.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') { try { sessionStorage.removeItem('sl-login-at'); sessionStorage.removeItem('sl-ui-fallback'); } catch (e) {} location.reload(); return; }   // 로그아웃 → 새로고침: 로그인 화면은 구UI 것(index.html 갈림)
      const r = enforce(s || null);
      if (r !== 'expired') setSession(r);
    });
    // 1분마다 12시간 경과 확인 → 자동 로그아웃
    const timer = setInterval(() => {
      let at = 0; try { at = Number(sessionStorage.getItem('sl-login-at')) || 0; } catch (e) {}
      if (at && Date.now() - at > SESSION_MAX_MS) SB.auth.signOut();
    }, 60 * 1000);
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} clearInterval(timer); };
  }, []);

  const loadData = () => {
    setDataState('loading'); setDataErr('');
    loadContent().then(() => setDataState('ready')).catch((e) => { setDataErr(String((e && e.message) || e)); setDataState('error'); });
  };
  useEffect(() => {
    if (session && dataState === 'idle') loadData();
    if (!session && dataState !== 'idle') setDataState('idle');
  }, [session]);

  const splash = (msg, sub) => (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', color: '#8a8a8e', fontSize: '15px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif" }}>
      <div>{msg}</div>
      {sub}
    </div>
  );

  if (session === undefined) return splash('불러오는 중…');
  if (!session) return <LoginScreen />;
  if (dataState === 'error') return splash('데이터를 불러오지 못했습니다.',
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{ fontSize: '12.5px', color: '#e03131', maxWidth: '440px', textAlign: 'center' }}>{dataErr}</div>
      <button onClick={loadData} className="login-btn" style={{ width: '160px' }}><span>다시 시도</span></button>
    </div>);
  if (dataState !== 'ready') return splash('데이터 불러오는 중…');

  const m = (session.user && session.user.user_metadata) || {};
  const user = {
    name: m.name || EMAIL_TO_NAME[session.user.email] || session.user.email,
    email: session.user.email || '',
    role: m.role || '',
    // 값이 없으면 PERM_GROUPS 의 기본값(강사)이 적용된다 — 예전엔 'all'(전체 권한)이 기본이라
    // 메타데이터가 빠진 계정에 교재 제작까지 열렸다.
    perms: m.perms || '',
    dark: !!m.dark, // 계정별 다크모드 설정
  };
  // 신UI 는 사용자 관리의 "화면"이 신UI 인 사람만(사장님 2026-11-13 — 개발자도 예외 없음). 그 밖의 사람이 여기 오면 새로고침해
  // index.html 맨 앞의 갈림 스크립트가 구UI(app/legacy/)를 띄우게 한다. 구UI 를 못 읽은 경우에도 신UI 를 열지 않고 멈춘다.
  if (m.ui !== 'new') {
    let uiFallback = false; try { uiFallback = sessionStorage.getItem('sl-ui-fallback') === '1'; } catch (e) {}
    if (!uiFallback) { location.reload(); return splash('여는 중…'); }
    return splash('화면을 불러오지 못했습니다. 앱을 다시 시작해 주세요.', <button onClick={() => { try { sessionStorage.removeItem('sl-ui-fallback'); } catch (e) {} SB.auth.signOut(); }} className="login-btn" style={{ width: '120px' }}><span>로그아웃</span></button>);
  }
  return <Shell user={user} onLogout={() => SB.auth.signOut()} />;
}

// 로그인 후 셸: 홈(대시보드) ↔ 지문 스튜디오 ↔ 모의고사 를 한 앱 안에서 전환
function Shell({ user: realUser, onLogout }) {
  const [view, setViewRaw] = useState('home');
  // 권한 미리보기(개발자 전용, 설정 → 권한 미리보기) — 이 화면에서만 다른 그룹/사람처럼 보인다. 계정은 그대로.
  // 아래의 user 는 미리보기가 켜지면 그 그룹·이름으로 바뀐 '보이는 사용자'다. 진짜 계정은 realUser.
  const [viewAs, setViewAsRaw] = useState(null);   // null | { perms, name }
  const isDev = permGroupKey(realUser.perms) === '개발자';
  const user = isDev && viewAs ? Object.assign({}, realUser, { perms: viewAs.perms, name: viewAs.name || realUser.name, role: '' }) : realUser;
  const setViewAs = (v) => { setViewAsRaw(v); setWtInit(null); setViewRaw('home'); };
  const asKey = user.perms + '|' + user.name;      // 바뀌면 앱들을 새로 띄운다(안에 들고 있는 권한·이름이 남지 않게)
  const [wtInit, setWtInit] = useState(null);   // 홈 반 줄 → 주간테스트 관리 그 반·그 시험으로 바로
  const setView = (v) => { setWtInit(null); setViewRaw(v); };
  const openWtClass = (x) => { setWtInit(Object.assign({ k: Date.now() }, x)); setViewRaw('wtadmin'); }; // 'home' | 'studio' | 'mock' | 'booking' | 'roster' | 'wtadmin' | 'dashboard' | 'report' | 'attend' | 'diary'
  // 다크모드는 계정별(user_metadata.dark)로 저장 → 어느 PC든 로그인한 사람 설정을 따름. 앱 전체 공통으로 아래에 전달.
  const [dark, setDarkState] = useState(!!realUser.dark);
  const setDark = (d) => {
    setDarkState(!!d);
    try { localStorage.setItem('sl-dark', d ? '1' : '0'); } catch (e) {} // 로그인 화면 테마용 캐시
    SB.auth.updateUser({ data: { dark: !!d } }).catch(function () {}); // 계정에 저장(전 기기 동기화)
  };
  let content = null;
  if (view === 'studio') {
    content = <App perms={user.perms} dark={dark} onLogout={onLogout} onHome={() => setView('home')} />;
  }
  else if (view === 'mock') {
    content = <MockExamApp dark={dark} onHome={() => setView('home')} />;
  }
  else if (view === 'roster' && permAllows(user.perms, 'roster', user.name)) {
    content = <RosterApp dark={dark} onHome={() => setView('home')} />;
  }
  else if (view === 'booking' && permAllows(user.perms, 'booking', user.name)) {
    content = <BookingApp dark={dark} userName={user.name} onHome={() => setView('home')} />;
  }
  else if (view === 'wtadmin' && permAllows(user.perms, 'weeklyadmin', user.name)) {
    content = <WeeklyAdminApp key={wtInit ? wtInit.k : 'wt'} init={wtInit} dark={dark} userName={user.name} onHome={() => setView('home')} />;
  }
  else if (view === 'dashboard' && permAllows(user.perms, 'dashboard', user.name)) {
    content = <DashboardApp dark={dark} onHome={() => setView('home')} />;
  }
  else if (view === 'users' && permAllows(user.perms, 'users', user.name)) {
    content = <UsersApp dark={dark} myName={user.name} />;
  }
  else if (view === 'report' && permAllows(user.perms, 'report', user.name)) {
    content = <ReportApp dark={dark} userName={user.name} onHome={() => setView('home')} />;
  }
  else if (view === 'attend' && permAllows(user.perms, 'attend', user.name)) {
    content = <AttendApp dark={dark} userName={user.name} onHome={() => setView('home')} />;
  }
  else if (view === 'diary' && permAllows(user.perms, 'diary', user.name)) {
    content = <DiaryApp dark={dark} userName={user.name} onHome={() => setView('home')} />;
  }
  else content = <Home userName={user.name} roleLabel={user.role} perms={user.perms} dark={dark} setDark={setDark} onOpenStudio={() => setView('studio')} onOpenMock={() => setView('mock')} onOpenBooking={() => setView('booking')} onOpenRoster={() => setView('roster')} onOpenWtAdmin={() => setView('wtadmin')} onOpenWtClass={openWtClass} onOpenDashboard={() => setView('dashboard')} onOpenReport={() => setView('report')} onOpenAttend={() => setView('attend')} onOpenDiary={() => setView('diary')} onLogout={onLogout} />;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const known = ['studio', 'mock', 'roster', 'booking', 'wtadmin', 'dashboard', 'report', 'attend', 'diary', 'users'];
  const railView = content && content.type === Home ? 'home' : (known.indexOf(view) >= 0 ? view : 'home');
  // taste 디자인 셸: 왼쪽 56px 아이콘 레일 + 본문. 앱들은 그대로 두고 레일로 오간다(각 앱의 '‹ 홈' 버튼은 2026-11-13 없앴다 — 레일의 홈으로 간다).
  return (
    <div className={'tt' + (dark ? ' dark' : '')}>
      <div className="tt-app">
        <TasteRail view={railView} setView={setView} perms={user.perms} userName={user.name} onSettings={() => setSettingsOpen(true)} />
        <div className="tt-main" key={asKey}>{content}</div>
      </div>
      {settingsOpen && <SettingsWindow dark={dark} setDark={setDark} perms={realUser.perms} myEmail={realUser.email} viewAs={viewAs} setViewAs={setViewAs} onClose={() => setSettingsOpen(false)} />}
      {permGroupKey(user.perms) !== '제작자' && <AiAssistant key={asKey} userName={user.name} perms={user.perms} />}   {/* LUCY — 제작자는 못 쓴다 (2026-11-13 사장님) */}
      {isDev && viewAs && (
        <div className="tt-viewas" data-noprint="">
          <span>미리보기 · <b>{viewAs.perms}</b>{viewAs.name ? ' · ' + viewAs.name : ''}</span>
          <button onClick={() => setViewAs(null)}>끝내기</button>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
