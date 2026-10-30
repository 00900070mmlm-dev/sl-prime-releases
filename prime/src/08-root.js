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
      if (event === 'SIGNED_OUT') { try { sessionStorage.removeItem('sl-login-at'); } catch (e) {} setSession(null); return; }
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
    role: m.role || '',
    // 값이 없으면 PERM_GROUPS 의 기본값(강사)이 적용된다 — 예전엔 'all'(전체 권한)이 기본이라
    // 메타데이터가 빠진 계정에 교재 제작까지 열렸다.
    perms: m.perms || '',
    dark: !!m.dark, // 계정별 다크모드 설정
  };
  return <Shell user={user} onLogout={() => SB.auth.signOut()} />;
}

// 로그인 후 셸: 홈(대시보드) ↔ 지문 스튜디오 ↔ 모의고사 를 한 앱 안에서 전환
function Shell({ user, onLogout }) {
  const [view, setView] = useState('home'); // 'home' | 'studio' | 'mock' | 'booking' | 'roster' | 'wtadmin'
  // 다크모드는 계정별(user_metadata.dark)로 저장 → 어느 PC든 로그인한 사람 설정을 따름. 앱 전체 공통으로 아래에 전달.
  const [dark, setDarkState] = useState(!!user.dark);
  const setDark = (d) => {
    setDarkState(!!d);
    try { localStorage.setItem('sl-dark', d ? '1' : '0'); } catch (e) {} // 로그인 화면 테마용 캐시
    SB.auth.updateUser({ data: { dark: !!d } }).catch(function () {}); // 계정에 저장(전 기기 동기화)
  };
  if (view === 'studio') {
    return <App perms={user.perms} dark={dark} onLogout={onLogout} onHome={() => setView('home')} />;
  }
  if (view === 'mock') {
    return <MockExamApp dark={dark} onHome={() => setView('home')} />;
  }
  if (view === 'roster' && permAllows(user.perms, 'roster', user.name)) {
    return <RosterApp dark={dark} onHome={() => setView('home')} />;
  }
  if (view === 'booking' && permAllows(user.perms, 'booking', user.name)) {
    return <BookingApp dark={dark} userName={user.name} onHome={() => setView('home')} />;
  }
  if (view === 'wtadmin' && permAllows(user.perms, 'weeklyadmin', user.name)) {
    return <WeeklyAdminApp dark={dark} userName={user.name} onHome={() => setView('home')} />;
  }
  return <Home userName={user.name} roleLabel={user.role} perms={user.perms} dark={dark} setDark={setDark} onOpenStudio={() => setView('studio')} onOpenMock={() => setView('mock')} onOpenBooking={() => setView('booking')} onOpenRoster={() => setView('roster')} onOpenWtAdmin={() => setView('wtadmin')} onLogout={onLogout} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
