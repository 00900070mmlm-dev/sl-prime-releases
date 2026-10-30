// Home 대시보드(브리핑·달력·날씨) · SettingsWindow(설정 창)
// index.html 에서 분리(2026-07-29). 로드 순서는 index.html 의 script 태그 순서가 결정한다.
// ===== 홈 대시보드 (통합 프로그램 이식) =====
// 브리핑 항목(업무지시·일정)은 아직 데이터 소스가 없어 비워둔다.
const HOME_BRIEF_ITEMS = [];

const HOME_PASSAGE_ICON = 'M4 4h16v16H4z M8 9h8 M8 13h8 M8 17h5';
const HOME_MOCK_ICON = 'M4 4h16v16H4z M8 8.5h8 M8 12h4 M8 15.5h3 M13.5 15l1.8 1.8 3.2-3.3';

function homeWeatherIcon(code) {
  if (code <= 1) return 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M19.1 4.9l-1.4 1.4 M6.3 17.7l-1.4 1.4';
  if (code <= 48) return 'M6 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 17 8.5 4.5 4.5 0 0 1 17.5 18H6z';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'M6 15a4 4 0 0 1-.6-7.95A6 6 0 0 1 17 5.5 4.5 4.5 0 0 1 17.5 15H6z M8 19h.01 M12 21h.01 M16 19h.01';
  if (code >= 95) return 'M6 15a4 4 0 0 1-.6-7.95A6 6 0 0 1 17 5.5 4.5 4.5 0 0 1 17.5 15H6z M13 15l-2 4h3l-2 4';
  return 'M6 15a4 4 0 0 1-.6-7.95A6 6 0 0 1 17 5.5 4.5 4.5 0 0 1 17.5 15H6z M8 18v3 M12 18v3 M16 18v3';
}

function homeWeatherCond(code) {
  if (code === 0) return '맑음';
  if (code <= 1) return '대체로 맑음';
  if (code === 2) return '부분적으로 흐림';
  if (code === 3) return '흐림';
  if (code <= 48) return '안개';
  if (code <= 57) return '이슬비';
  if (code <= 67) return '비';
  if (code <= 77) return '눈';
  if (code <= 82) return '소나기';
  if (code <= 86) return '눈';
  return '뇌우';
}

// ===== 설정 창 (iPhone 설정앱 스타일: 좌 사이드바 + 우 세부, 창 모달) =====
// 주간테스트 관리 — 성적표(종이 + 체크 + 막대)
const HOME_WTADMIN_ICON = 'M6 3h9l5 5v13H6z M15 3v5h5 M9.5 12.5l1.5 1.5 3-3.5 M9 17.5h7';
// 전체명단 — 줄이 그어진 명부 모양
const HOME_ROSTER_ICON = 'M4 5h16v14H4z M4 9.5h16 M4 14h16 M8 5v14';
const HOME_BOOKING_ICON ='M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 17.5h2';
const HOME_SETTINGS_ICON = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z';

function SettingsSecurity({ dark }) {
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!nw) { setMsg('새 비밀번호를 입력하세요.'); return; }
    if (nw.length < 6) { setMsg('새 비밀번호는 6자 이상이어야 합니다.'); return; }
    if (nw !== cf) { setMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    setBusy(true);
    try {
      const { data: ud } = await SB.auth.getUser();
      const email = ud && ud.user && ud.user.email;
      if (!email) { setMsg('세션이 만료되었습니다. 다시 로그인해 주세요.'); setBusy(false); return; }
      const { error: e1 } = await SB.auth.signInWithPassword({ email, password: cur });
      if (e1) { setMsg('현재 비밀번호가 올바르지 않습니다.'); setBusy(false); return; }
      const { error: e2 } = await SB.auth.updateUser({ password: nw });
      if (e2) { setMsg('변경 실패: ' + (e2.message || '')); setBusy(false); return; }
      setDone(true); setMsg(''); setCur(''); setNw(''); setCf('');
    } catch (er) { setMsg('오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'); }
    setBusy(false);
  };
  const c = dark
    ? { text: 'rgba(255,255,255,0.9)', dim: 'rgba(255,255,255,0.5)', inputBg: 'rgba(255,255,255,0.06)', inputBorder: 'rgba(255,255,255,0.16)', accent: '#0a84ff' }
    : { text: '#1d1d1f', dim: 'rgba(0,0,0,0.5)', inputBg: '#fff', inputBorder: 'rgba(0,0,0,0.14)', accent: '#0066cc' };
  const inputStyle = { height: 42, padding: '0 14px', border: '1px solid ' + c.inputBorder, borderRadius: 10, fontSize: 15, fontFamily: 'inherit', background: c.inputBg, color: c.text, outline: 'none', width: '100%', boxSizing: 'border-box' };
  return (
    <div style={{ maxWidth: 420 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: c.text }}>비밀번호 변경</div>
      <div style={{ fontSize: 13, color: c.dim, marginBottom: 18, lineHeight: 1.5 }}>현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다. (6자 이상)</div>
      {done ? (
        <div style={{ padding: '14px 16px', background: 'rgba(40,138,61,0.12)', border: '1px solid rgba(40,138,61,0.3)', borderRadius: 10, color: dark ? '#5edc7e' : '#248a3d', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✓</span><span>비밀번호가 변경되었습니다.</span>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="password" value={cur} onChange={e => { setCur(e.target.value); setMsg(''); }} placeholder="현재 비밀번호" autoComplete="current-password" style={inputStyle} />
          <input type="password" value={nw} onChange={e => { setNw(e.target.value); setMsg(''); }} placeholder="새 비밀번호" autoComplete="new-password" style={inputStyle} />
          <input type="password" value={cf} onChange={e => { setCf(e.target.value); setMsg(''); }} placeholder="새 비밀번호 확인" autoComplete="new-password" style={inputStyle} />
          {msg && <div style={{ fontSize: 13, color: '#ff5b5b' }}>{msg}</div>}
          <button type="submit" disabled={busy} style={{ marginTop: 6, height: 34, border: 'none', borderRadius: 8, background: c.accent, color: '#fff', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.6 : 1, alignSelf: 'flex-start', padding: '0 18px' }}>{busy ? '변경 중…' : '변경'}</button>
        </form>
      )}
    </div>
  );
}

function ThemePreview({ dark }) {
  const c = dark
    ? { bg: '#1c1c1e', card: '#2c2c2e', accent: '#0a84ff', text: 'rgba(255,255,255,0.85)', dim: 'rgba(255,255,255,0.32)', border: 'rgba(255,255,255,0.12)' }
    : { bg: '#f5f5f7', card: '#ffffff', accent: '#0066cc', text: '#1d1d1f', dim: 'rgba(0,0,0,0.28)', border: 'rgba(0,0,0,0.1)' };
  const line = (w, o) => ({ width: w, height: 5, borderRadius: 3, background: c.text, opacity: o });
  return (
    <div style={{ width: 132, height: 92, borderRadius: 12, background: c.bg, border: '1px solid ' + c.border, padding: 11, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 9 }}>
        <div style={{ width: 15, height: 15, borderRadius: 4, background: c.accent, flexShrink: 0 }}></div>
        <div style={{ width: 44, height: 6, borderRadius: 3, background: c.text, opacity: 0.8 }}></div>
      </div>
      <div style={{ background: c.card, borderRadius: 8, padding: 9, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={line('68%', 0.8)}></div>
        <div style={{ width: '92%', height: 4, borderRadius: 2, background: c.dim }}></div>
        <div style={{ width: '52%', height: 4, borderRadius: 2, background: c.dim }}></div>
      </div>
    </div>
  );
}

function ThemeOption({ label, optionDark, appDark, selected, onClick }) {
  const accent = appDark ? '#0a84ff' : '#0066cc';
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
      <div style={{ borderRadius: 15, padding: 3, border: '2px solid ' + (selected ? accent : 'transparent') }}>
        <ThemePreview dark={optionDark} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 18, height: 18, borderRadius: '50%', border: selected ? 'none' : '1.5px solid ' + (appDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'), background: selected ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: appDark ? 'rgba(255,255,255,0.9)' : '#1d1d1f' }}>{label}</span>
      </div>
    </button>
  );
}

function SettingsTheme({ dark, setDark }) {
  const c = dark ? { text: 'rgba(255,255,255,0.9)', dim: 'rgba(255,255,255,0.5)' } : { text: '#1d1d1f', dim: 'rgba(0,0,0,0.5)' };
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: c.text }}>다크 모드</div>
      <div style={{ fontSize: 13, color: c.dim, marginBottom: 22, lineHeight: 1.5 }}>화면 테마를 선택하세요. 앱 전체에 적용됩니다.</div>
      <div style={{ display: 'flex', gap: 26 }}>
        <ThemeOption label="일반" optionDark={false} appDark={dark} selected={!dark} onClick={() => setDark(false)} />
        <ThemeOption label="다크" optionDark={true} appDark={dark} selected={dark} onClick={() => setDark(true)} />
      </div>
    </div>
  );
}

function SettingsWindow({ dark, setDark, onClose }) {
  const [section, setSection] = useState('security');
  const SECTIONS = [
    { key: 'security', label: '보안', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4' },
    { key: 'theme', label: '테마', icon: 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.91-.1-1.35a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-5.4-5.4c0-1.86.94-3.5 2.35-4.46A9 9 0 0 0 12 3z' },
  ];
  const cur = SECTIONS.find(s => s.key === section) || SECTIONS[0];
  const mobile = useMobile();   // 폰: 왼쪽 사이드바가 위쪽 탭 줄이 된다
  const c = dark
    ? { content: '#1c1c1e', sidebar: '#2c2c2e', text: 'rgba(255,255,255,0.9)', dim: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.09)', accent: '#0a84ff', closeBg: 'rgba(255,255,255,0.1)' }
    : { content: '#ffffff', sidebar: '#f5f5f7', text: '#1d1d1f', dim: 'rgba(0,0,0,0.5)', border: 'rgba(0,0,0,0.06)', accent: '#0066cc', closeBg: 'rgba(0,0,0,0.05)' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.28)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 760, maxWidth: '92vw', height: mobile ? 'auto' : 520, maxHeight: '88vh', display: 'flex', flexDirection: mobile ? 'column' : 'row', background: c.content, borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.4)', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif", color: c.text }}>
        {/* 좌측 사이드바 */}
        <div style={mobile
          ? { flexShrink: 0, background: c.sidebar, borderBottom: '1px solid ' + c.border, padding: '10px 10px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }
          : { width: 200, flexShrink: 0, background: c.sidebar, borderRight: '1px solid ' + c.border, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, padding: mobile ? '0 10px 0 6px' : '6px 10px 12px', letterSpacing: '-0.3px', color: c.text }}>설정</div>
          {SECTIONS.map(s => {
            const sel = s.key === section;
            return (
              <button key={s.key} onClick={() => setSection(s.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: 'none', borderRadius: 8, background: sel ? c.accent : 'transparent', color: sel ? '#fff' : c.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, textAlign: 'left' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sel ? '#fff' : c.accent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon}></path></svg>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
        {/* 우측 세부 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid ' + c.border, flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: c.text }}>{cur.label}</div>
            <button onClick={onClose} title="닫기" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: c.closeBg, color: c.dim, fontSize: 16, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
            {section === 'security' && <SettingsSecurity dark={dark} />}
            {section === 'theme' && <SettingsTheme dark={dark} setDark={setDark} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Home({ userName, roleLabel, perms, dark, setDark, onOpenStudio, onOpenMock, onOpenBooking, onOpenRoster, onOpenWtAdmin, onLogout }) {
  const [weather, setWeather] = useState(null);
  const [bookingBrief, setBookingBrief] = useState([]);   // 오늘 내 상담 (14-booking.js)
  const bookingOn = permAllows(perms, 'booking', userName);   // 시험 중 — 개발자 + PERM_EXTRA 에 적힌 사람
  const rosterOn = permAllows(perms, 'roster', userName);     // 전체명단 (15-roster.js) — 시험 중, 개발자만
  useEffect(() => { if (bookingOn) bkTodayBrief(userName).then(setBookingBrief).catch(function () {}); }, [userName]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 폰(웹 my.sl-edu.com/prime/): 고정 높이·고정 폭 카드·떠 있는 dock 을 풀고 위에서 아래로 쌓는다 — 앱 타일이 맨 위.
  const mobile = useMobile();

  const c = dark ? {
    bg: '#1c1c1e', text: 'rgba(255,255,255,0.92)', dim: 'rgba(255,255,255,0.55)', dim2: 'rgba(255,255,255,0.4)',
    card: 'rgba(44,44,46,0.62)', cardBorder: 'rgba(255,255,255,0.09)', inner: 'rgba(255,255,255,0.06)', innerBorder: 'rgba(255,255,255,0.08)',
    accent: '#0a84ff', accentBg: 'rgba(10,132,255,0.16)', accentBorder: 'rgba(10,132,255,0.3)',
    blob1: 'rgba(10,132,255,0.16)', blob2: 'rgba(10,132,255,0.1)', blob3: 'rgba(255,255,255,0.05)',
    dock: 'rgba(44,44,46,0.7)', dockBorder: 'rgba(255,255,255,0.12)', tileBg: 'rgba(255,255,255,0.1)', tileBorder: 'rgba(255,255,255,0.14)',
    logoutBg: 'rgba(255,255,255,0.1)', logoutBorder: 'rgba(255,255,255,0.15)',
  } : {
    bg: '#f5f5f7', text: '#1d1d1f', dim: 'rgba(29,29,31,0.55)', dim2: 'rgba(29,29,31,0.45)',
    card: 'rgba(255,255,255,0.55)', cardBorder: 'rgba(255,255,255,0.7)', inner: 'rgba(255,255,255,0.6)', innerBorder: 'rgba(255,255,255,0.8)',
    accent: '#0066cc', accentBg: 'rgba(0,102,204,0.06)', accentBorder: 'rgba(0,102,204,0.14)',
    blob1: 'rgba(0,102,204,0.16)', blob2: 'rgba(0,113,227,0.12)', blob3: 'rgba(255,255,255,0.9)',
    dock: 'rgba(255,255,255,0.5)', dockBorder: 'rgba(255,255,255,0.75)', tileBg: 'rgba(255,255,255,0.75)', tileBorder: 'rgba(255,255,255,0.9)',
    logoutBg: 'rgba(255,255,255,0.55)', logoutBorder: 'rgba(255,255,255,0.75)',
  };

  useEffect(() => {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=37.60&longitude=126.72'
      + '&current=temperature_2m,weather_code'
      + '&daily=temperature_2m_max,temperature_2m_min'
      + '&hourly=temperature_2m,weather_code&forecast_days=2&timezone=Asia%2FSeoul';
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      const nowHour = new Date().getHours();
      const idx = d.hourly.time.findIndex(function (t) {
        return new Date(t).getHours() === nowHour && new Date(t).getDate() === new Date().getDate();
      });
      const hours = [];
      for (let i = 0; i < 5; i++) {
        const j = idx + i;
        if (j < 0 || j >= d.hourly.time.length) break;
        hours.push({
          t: i === 0 ? '지금' : new Date(d.hourly.time[j]).getHours() + '시',
          code: d.hourly.weather_code[j],
          temp: Math.round(d.hourly.temperature_2m[j]) + '°',
        });
      }
      setWeather({
        temp: Math.round(d.current.temperature_2m),
        code: d.current.weather_code,
        hi: Math.round(d.daily.temperature_2m_max[0]),
        lo: Math.round(d.daily.temperature_2m_min[0]),
        hours: hours,
      });
    }).catch(function () {});
  }, []);

  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const todayStr = (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + days[now.getDay()] + '요일';

  const briefItems = bookingBrief.concat(HOME_BRIEF_ITEMS);

  const ty = now.getFullYear();
  const tm = now.getMonth();
  const miniFirstDow = new Date(ty, tm, 1).getDay();
  const miniDays = new Date(ty, tm + 1, 0).getDate();
  const miniBase = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 11.5, margin: '0 auto' };
  const miniCells = [];
  for (let i = 0; i < miniFirstDow; i++) miniCells.push({ key: 'p' + i, label: '', numStyle: miniBase });
  for (let d = 1; d <= miniDays; d++) {
    const isToday = d === now.getDate();
    const dow = (miniFirstDow + d - 1) % 7;
    miniCells.push({
      key: 'd' + d,
      label: String(d),
      numStyle: isToday
        ? Object.assign({}, miniBase, { background: '#0066cc', color: '#ffffff', fontWeight: 700 })
        : Object.assign({}, miniBase, { color: dow === 0 ? 'rgba(215,0,21,0.8)' : dow === 6 ? 'rgba(0,102,204,0.8)' : c.text }),
    });
  }
  const miniDows = ['일', '월', '화', '수', '목', '금', '토'].map(function (d, i) {
    return { key: 'w' + i, label: d, style: { textAlign: 'center', fontSize: 10, fontWeight: 600, color: i === 0 ? 'rgba(215,0,21,0.6)' : i === 6 ? 'rgba(0,102,204,0.6)' : c.dim2 } };
  });
  const miniTitle = (tm + 1) + '월';

  const w = weather;
  const hour = now.getHours();
  const nightW = hour >= 19 || hour < 6;
  const code = w ? w.code : 1;
  const cloudy = code >= 2;
  let wbg;
  if (nightW) wbg = 'linear-gradient(180deg, #1c2a4d 0%, #2e4370 100%)';
  else if (cloudy) wbg = 'linear-gradient(180deg, #5c7593 0%, #8299b3 100%)';
  else wbg = 'linear-gradient(180deg, #2a6dd9 0%, #5b9be6 100%)';
  const wCardStyle = { background: wbg, color: '#ffffff', borderRadius: 20, padding: '18px 18px 14px', flexShrink: 0 };
  const wTemp = w ? w.temp + '°' : '—°';
  const wCond = w ? homeWeatherCond(w.code) : '불러오는 중';
  const wHiLo = w ? '최고 ' + w.hi + '° 최저 ' + w.lo + '°' : '';
  const wHours = w ? w.hours.map(function (h, i) { return { key: 'h' + i, t: h.t, icon: homeWeatherIcon(h.code), temp: h.temp }; }) : [];

  const apps = [
    { label: '지문 스튜디오', icon: HOME_PASSAGE_ICON, open: onOpenStudio },
    { label: '모의고사', icon: HOME_MOCK_ICON, open: onOpenMock },
  ];
  if (rosterOn) apps.push({ label: '전체명단', icon: HOME_ROSTER_ICON, open: onOpenRoster });
  if (bookingOn) apps.push({ label: '상담 일정', icon: HOME_BOOKING_ICON, open: onOpenBooking });
  if (permAllows(perms, 'weeklyadmin', userName)) apps.push({ label: '주간테스트 관리', icon: HOME_WTADMIN_ICON, open: onOpenWtAdmin });
  apps.push(
    { label: '설정', icon: HOME_SETTINGS_ICON, open: () => setSettingsOpen(true) });

  const cardShadow = dark
    ? '0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)'
    : '0 12px 40px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)';
  const glassBorder = '1px solid ' + c.cardBorder;
  const glassBlur = 'saturate(180%) blur(24px)';

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: c.bg, color: c.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif" }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -180, left: -120, width: 560, height: 560, borderRadius: '50%', background: c.blob1, filter: 'blur(90px)' }}></div>
        <div style={{ position: 'absolute', bottom: -220, right: -140, width: 640, height: 640, borderRadius: '50%', background: c.blob2, filter: 'blur(110px)' }}></div>
        <div style={{ position: 'absolute', top: '30%', left: '55%', width: 420, height: 420, borderRadius: '50%', background: c.blob3, filter: 'blur(80px)' }}></div>
      </div>

      <div style={mobile
        ? { position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 16px 32px', boxSizing: 'border-box' }
        : { position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column', padding: '28px 36px 130px', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 15, color: c.dim }}>안녕하세요</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.2 }}>{userName}님</div>
              <div style={{ padding: '4px 12px', borderRadius: 9999, background: c.accentBg, color: c.accent, fontSize: 13, fontWeight: 600 }}>{roleLabel}</div>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {APP_VERSION && <span title={'SL PRIME ' + APP_VERSION} style={{ fontSize: 11, color: c.dim, opacity: 0.4, letterSpacing: '0.2px', userSelect: 'none' }}>{APP_VERSION}</span>}
            <button onClick={onLogout} style={{ height: 38, padding: '0 20px', border: '1px solid ' + c.logoutBorder, borderRadius: 9999, background: c.logoutBg, backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', color: c.text, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)' }}>로그아웃</button>
          </div>
        </div>

        <div style={{ order: mobile ? 1 : 0, display: 'flex', flexWrap: 'wrap', gap: mobile ? 12 : 18, alignItems: 'flex-start', paddingTop: mobile ? 16 : 26, minHeight: 0, overflowY: mobile ? 'visible' : 'auto', scrollbarWidth: 'none' }}>
          <div style={{ width: mobile ? '100%' : 336, boxSizing: 'border-box', maxHeight: mobile ? 'none' : '100%', overflowY: 'auto', scrollbarWidth: 'none', background: c.card, backdropFilter: glassBlur, WebkitBackdropFilter: glassBlur, border: glassBorder, borderRadius: 22, padding: 18, boxShadow: cardShadow }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.12px' }}>오늘의 브리핑</div>
                <div style={{ fontSize: 13, color: c.dim2 }}>{todayStr}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {briefItems.length === 0 ? (
                  <div style={{ padding: '14px 14px', background: c.inner, border: '1px solid ' + c.innerBorder, borderRadius: 14, fontSize: 13.5, lineHeight: 1.45, color: c.dim2, textAlign: 'center' }}>
                    표시할 항목이 없습니다
                  </div>
                ) : briefItems.map(function (b, i) {
                  return (
                    <div key={'b' + i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: c.inner, border: '1px solid ' + c.innerBorder, borderRadius: 14, fontSize: 14, lineHeight: 1.45, color: c.dim }}>
                      <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: '#0066cc', marginTop: 6 }}></span>
                      <span>{b}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ width: mobile ? '100%' : 264, boxSizing: 'border-box', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: 18, background: c.card, backdropFilter: glassBlur, WebkitBackdropFilter: glassBlur, border: glassBorder, borderRadius: 22, boxShadow: cardShadow, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#d70015' }}>{miniTitle}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
              {miniDows.map(function (d) { return <span key={d.key} style={d.style}>{d.label}</span>; })}
              {miniCells.map(function (c) { return <span key={c.key} style={c.numStyle}>{c.label}</span>; })}
            </div>
          </div>

          <div style={{ width: mobile ? '100%' : 300, flexShrink: 0, boxSizing: 'border-box' }}>
            <div style={wCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.1px' }}>원당동</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>인천 서구 검단</div>
                </div>
                <div style={{ fontSize: 42, fontWeight: 300, lineHeight: 1, letterSpacing: '-0.374px' }}>{wTemp}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{wCond}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{wHiLo}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.25)' }}>
                {wHours.map(function (h) {
                  return (
                    <div key={h.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, opacity: 0.8 }}>{h.t}</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={h.icon}></path></svg>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{h.temp}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 앱 dock — PC 는 아래 가운데 떠 있고, 폰은 인사말 바로 밑에 줄바꿈으로 깔린다(order 로 카드 위로 올린다) */}
        <div style={mobile ? { marginTop: 18 } : { position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)', zIndex: 40 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: mobile ? 'wrap' : 'nowrap', justifyContent: mobile ? 'flex-start' : 'center', gap: mobile ? '10px 0' : 4, padding: '12px 14px', background: c.dock, backdropFilter: 'saturate(180%) blur(28px)', WebkitBackdropFilter: 'saturate(180%) blur(28px)', border: '1px solid ' + c.dockBorder, borderRadius: 28, boxShadow: '0 14px 44px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
            {apps.map(function (app, i) {
              return (
                <button key={'app' + i} onClick={app.open} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: mobile ? '25%' : 88, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  <span style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.tileBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid ' + c.tileBorder, borderRadius: 16, boxShadow: '0 6px 18px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={app.icon}></path></svg>
                  </span>
                  <span style={{ fontSize: 12, color: c.dim, lineHeight: 1.2, whiteSpace: mobile ? 'normal' : 'nowrap', textAlign: 'center', wordBreak: 'keep-all', maxWidth: '100%', padding: mobile ? '0 4px' : 0 }}>{app.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {settingsOpen && <SettingsWindow dark={dark} setDark={setDark} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

