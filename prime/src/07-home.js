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
// 대시보드 — 축 위에 꺾은선
const HOME_DASHBOARD_ICON = 'M4 4v16h16 M7 15l4-5 3 3 5-7';
const HOME_USERS_ICON = 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1 M19 8v6 M16 11h6';
// 레포트 — 접힌 종이 + 글 줄 + 보내기 화살표
const HOME_REPORT_ICON = 'M6 3h9l5 5v13H6z M15 3v5h5 M9 12h6 M9 15.5h4 M13 19l2.5-2.5L13 14';
const HOME_ATTEND_ICON = 'M4 5h16v15H4z M4 9.5h16 M8 3v4 M16 3v4 M7.5 14.5l2 2 4-4';
const HOME_DIARY_ICON = 'M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4';
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
  const K = TT(dark);
  const c = { text: K.text, dim: K.muted };
  const inputStyle = { height: 38, padding: '0 12px', border: '1px solid ' + K.control, borderRadius: K.rCtl, fontSize: 14, fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none', width: '100%', boxSizing: 'border-box', transition: K.ease };
  return (
    <div style={{ maxWidth: 420 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: c.text }}>비밀번호 변경</div>
      <div style={{ fontSize: 13, color: c.dim, marginBottom: 18, lineHeight: 1.5 }}>현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다. (6자 이상)</div>
      {done ? (
        <div style={{ padding: '12px 14px', background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCtl, color: K.pos, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✓</span><span>비밀번호가 변경되었습니다.</span>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="password" value={cur} onChange={e => { setCur(e.target.value); setMsg(''); }} placeholder="현재 비밀번호" autoComplete="current-password" style={inputStyle} />
          <input type="password" value={nw} onChange={e => { setNw(e.target.value); setMsg(''); }} placeholder="새 비밀번호" autoComplete="new-password" style={inputStyle} />
          <input type="password" value={cf} onChange={e => { setCf(e.target.value); setMsg(''); }} placeholder="새 비밀번호 확인" autoComplete="new-password" style={inputStyle} />
          {msg && <div style={{ fontSize: 13, color: K.neg }}>{msg}</div>}
          <button type="submit" disabled={busy} style={{ marginTop: 6, height: 34, border: 'none', borderRadius: K.rCtl, background: K.ink, color: K.inkText, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.6 : 1, alignSelf: 'flex-start', padding: '0 18px', transition: K.ease }}>{busy ? '변경 중…' : '변경'}</button>
        </form>
      )}
    </div>
  );
}

function ThemePreview({ dark }) {
  const K = TT(dark);
  const c = { bg: K.ground, card: K.surface, accent: K.ink, text: K.text, dim: K.control, border: K.border };
  const line = (w, o) => ({ width: w, height: 5, borderRadius: 3, background: c.text, opacity: o });
  return (
    <div style={{ width: 132, height: 92, borderRadius: 8, background: c.bg, border: '1px solid ' + c.border, padding: 11, boxSizing: 'border-box', overflow: 'hidden' }}>
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
  const K = TT(appDark);
  const accent = K.ink;
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
      <div style={{ borderRadius: 11, padding: 3, border: '2px solid ' + (selected ? accent : 'transparent'), transition: K.ease }}>
        <ThemePreview dark={optionDark} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 18, height: 18, borderRadius: '50%', border: selected ? 'none' : '1.5px solid ' + K.control, background: selected ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={K.inkText} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: K.text }}>{label}</span>
      </div>
    </button>
  );
}

function SettingsTheme({ dark, setDark }) {
  const K = TT(dark);
  const c = { text: K.text, dim: K.muted };
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

// 설정 → 권한 미리보기 (개발자 전용, 2026-11-13 사장님 — "개발하면서 다른 권한의 화면도 보고 싶다")
// 계정의 권한은 **바꾸지 않는다.** 이 앱 화면에서만 다른 그룹(또는 다른 사람)으로 보이게 한다 —
// 메뉴·홈·각 앱의 권한 판정·AI 도구가 그 그룹/사람 기준으로 바뀐다. 앱을 다시 켜면 풀린다(어디에도 저장 안 함).
// 데이터는 여전히 개발자 본인 로그인으로 읽으므로 **DB 잠금(RLS)까지 흉내 내지는 않는다.**
// 사람 목록은 DB 함수 admin_list_users (scripts/perm_admin_schema.sql) — 개발자만 부를 수 있다.
const PERM_DESC = {
  개발자: '전부 + DB 쓰기',
  관리자: '삽화 빼고 전부',
  강사: '스튜디오 주요 모드 · 명단 · 주간테스트 관리 · 레포트 · 출석부 · 업무일지 · 상담 일정',
  조교: '한줄해석 · 쌩지문 · 단어 · 명단 · 주간테스트 관리 · 출석부 · 업무일지 · 상담 일정',
  제작자: '한줄해석 · 쌩지문 · 삽화',
};
function SettingsViewAs({ dark, viewAs, setViewAs, myEmail }) {
  const K = TT(dark);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    SB.rpc('admin_list_users').then(({ data, error }) => { if (error) setErr(error.message); else setRows(data || []); });
  }, []);
  const groups = Object.keys(PERM_GROUPS);
  const nameOf = (r) => r.name || EMAIL_TO_NAME[r.email] || '';
  const on = (g, n) => viewAs && viewAs.perms === g && (n ? viewAs.name === n : !viewAs.name);
  const chip = (active) => ({ height: 30, padding: '0 12px', borderRadius: K.rCtl, border: '1px solid ' + (active ? K.ink : K.control), background: active ? K.ink : K.surface,
    color: active ? K.inkText : K.text, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', transition: K.ease });
  const people = (rows || []).filter((r) => String(r.email || '').toLowerCase() !== String(myEmail || '').toLowerCase())
    .slice().sort((a, b) => groups.indexOf(permGroupKey(a.perms)) - groups.indexOf(permGroupKey(b.perms)) || nameOf(a).localeCompare(nameOf(b), 'ko'));
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: K.text }}>다른 권한으로 보기</div>
      <div style={{ fontSize: 13, color: K.muted, marginBottom: 14, lineHeight: 1.55 }}>
        이 화면에서만 다른 권한처럼 보입니다. 계정 권한은 바뀌지 않고, 앱을 다시 켜면 풀립니다.<br />
        데이터는 내 로그인으로 읽으므로 DB 잠금까지 똑같지는 않습니다.
      </div>
      {viewAs && <button onClick={() => setViewAs(null)} style={Object.assign(chip(false), { marginBottom: 16 })}>미리보기 끝내기 (내 권한으로)</button>}
      <div style={{ fontSize: 13, fontWeight: 600, color: K.text, margin: '2px 0 8px' }}>그룹으로 보기 <span style={{ fontWeight: 400, color: K.muted }}>— 이름은 내 이름 그대로</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', alignItems: 'center', marginBottom: 18 }}>
        {groups.map((g) => (
          <React.Fragment key={g}>
            <button onClick={() => setViewAs({ perms: g, name: '' })} style={chip(on(g))}>{g}</button>
            <span style={{ fontSize: 12.5, color: K.muted }}>{PERM_DESC[g] || ''}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: K.text, margin: '2px 0 8px' }}>사람으로 보기 <span style={{ fontWeight: 400, color: K.muted }}>— 그 사람의 그룹·담임 반·개인 추가 권한까지</span></div>
      {err ? <div style={{ fontSize: 13, color: K.neg }}>{err}</div>
        : !rows ? <div style={{ fontSize: 13, color: K.muted }}>불러오는 중…</div>
        : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {people.map((r) => { const n = nameOf(r), g = permGroupKey(r.perms); return (
              <button key={r.id} onClick={() => setViewAs({ perms: g, name: n })} style={chip(on(g, n))} title={r.email}>
                {n || r.email} <span style={{ opacity: 0.6, fontSize: 12 }}>{g}</span>
              </button>
            ); })}
          </div>
        )}
    </div>
  );
}

function SettingsWindow({ dark, setDark, onClose, perms, myEmail, viewAs, setViewAs }) {
  const [section, setSection] = useState('security');
  const SECTIONS = [
    { key: 'security', label: '보안', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4' },
    { key: 'theme', label: '테마', icon: 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.91-.1-1.35a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-5.4-5.4c0-1.86.94-3.5 2.35-4.46A9 9 0 0 0 12 3z' },
  ];
  if (permGroupKey(perms) === '개발자') SECTIONS.push({ key: 'lucy', label: 'LUCY 사용량', icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' });
  if (permGroupKey(perms) === '개발자') SECTIONS.push({ key: 'perms', label: '권한 미리보기', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' });
  const cur = SECTIONS.find(s => s.key === section) || SECTIONS[0];
  const mobile = useMobile();   // 폰: 왼쪽 사이드바가 위쪽 탭 줄이 된다
  const K = TT(dark);
  const c = { content: K.surface, sidebar: K.ground, text: K.text, dim: K.muted, border: K.border, accent: K.ink, closeBg: K.raised };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.32)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 720, maxWidth: '92vw', height: mobile ? 'auto' : 480, maxHeight: '88vh', display: 'flex', flexDirection: mobile ? 'column' : 'row', background: c.content, border: '1px solid ' + c.border, borderRadius: K.rCard, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.16)', fontFamily: K.font, color: c.text }}>
        {/* 좌측 사이드바 */}
        <div style={mobile
          ? { flexShrink: 0, background: c.sidebar, borderBottom: '1px solid ' + c.border, padding: '10px 10px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }
          : { width: 200, flexShrink: 0, background: c.sidebar, borderRight: '1px solid ' + c.border, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, padding: mobile ? '0 10px 0 6px' : '6px 10px 12px', letterSpacing: '-0.3px', color: c.text }}>설정</div>
          {SECTIONS.map(s => {
            const sel = s.key === section;
            return (
              <button key={s.key} onClick={() => setSection(s.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: 'none', borderRadius: K.rCtl, background: sel ? K.active : 'transparent', color: sel ? K.text : K.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: sel ? 600 : 500, textAlign: 'left', transition: K.ease }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon}></path></svg>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
        {/* 우측 세부 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid ' + c.border, flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: c.text }}>{cur.label}</div>
            <button onClick={onClose} title="닫기" style={{ width: 28, height: 28, borderRadius: K.rCtl, border: '1px solid ' + c.border, background: c.content, color: c.dim, fontSize: 16, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit', transition: K.ease }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
            {section === 'security' && <SettingsSecurity dark={dark} />}
            {section === 'theme' && <SettingsTheme dark={dark} setDark={setDark} />}
            {section === 'lucy' && <SettingsLucyGrant dark={dark} />}
            {section === 'perms' && <SettingsViewAs dark={dark} viewAs={viewAs} setViewAs={(v) => { setViewAs(v); onClose(); }} myEmail={myEmail} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 홈 — taste 디자인(design/taste, 2026-11-12) =====
// 화면의 질문 하나: "오늘 내가 챙길 게 뭔가". 제목 밑 한 줄 + 숫자 네 칸 + 이번 주 주간테스트(반별) + 오늘 상담 + 반별 평균 + 달력.
// 숫자는 전부 DB(weekly_tests · weekly_scores · aca_class · aca_student · booking_slots)에서 읽는다.
function homeYmd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function homeMonday(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function homeShort(name) { return String(name || '').replace(/^\((영|수)\)\s*/, ''); }

// 이번 주·지난주 시험과 반별 응시·평균. 반 하나에 시험지가 여럿이면 줄도 여럿이다.
async function homeLoadWeek() {
  const now = new Date();
  const wk = homeMonday(now);
  const prev = new Date(wk); prev.setDate(prev.getDate() - 7);
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1), m1 = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const calFrom = homeMonday(m0);
  const [tq, mq] = await Promise.all([
    SB.from('weekly_tests').select('id,title,week_start,teacher,range_text,class_ids').in('week_start', [homeYmd(wk), homeYmd(prev)]),
    SB.from('weekly_tests').select('week_start').gte('week_start', homeYmd(calFrom)).lte('week_start', homeYmd(m1)),
  ]);
  if (tq.error) throw tq.error;
  const tests = tq.data || [];
  const ids = tests.map((t) => t.id);
  const cids = Array.from(new Set(tests.reduce((a, t) => a.concat(t.class_ids || []), [])));
  const [sq, cq, stq] = await Promise.all([
    ids.length ? SB.from('weekly_scores').select('test_id,klass,score,excluded').in('test_id', ids).limit(5000) : Promise.resolve({ data: [] }),
    cids.length ? SB.from('aca_class').select('c_id,name,teachers,subjects').in('c_id', cids) : Promise.resolve({ data: [] }),
    cids.length ? SB.from('aca_student').select('class_ids').eq('state', '재원').overlaps('class_ids', cids).limit(3000) : Promise.resolve({ data: [] }),
  ]);
  const cls = {}; (cq.data || []).forEach((c) => { cls[c.c_id] = c; });
  const enrolled = {}; (stq.data || []).forEach((s) => (s.class_ids || []).forEach((id) => { enrolled[id] = (enrolled[id] || 0) + 1; }));
  const byKey = {};   // test_id|반이름 → { scores, excl }
  (sq.data || []).forEach((r) => {
    const k = r.test_id + '|' + r.klass; const o = byKey[k] || (byKey[k] = { scores: [], excl: 0 });
    if (r.excluded) o.excl++; else if (r.score != null && r.score !== '') o.scores.push(Number(r.score));
  });
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const rows = [], prevAvg = {};
  tests.forEach((t) => (t.class_ids || []).forEach((cid) => {
    const c = cls[cid]; if (!c) return;
    const o = byKey[t.id + '|' + c.name] || { scores: [], excl: 0 };
    if (t.week_start === homeYmd(prev)) { if (o.scores.length) prevAvg[cid] = avg(o.scores); return; }
    rows.push({ testId: t.id, cid, klass: c.name, teachers: c.teachers || [], subjects: c.subjects || [], paperTeacher: t.teacher || '',
      paper: t.range_text || t.title, wkName: (String(t.title || '').match(/(\d+월\s*\d+주)/) || [])[1] || '', took: o.scores.length, total: Math.max(0, (enrolled[cid] || 0) - o.excl), avg: avg(o.scores) });
  }));
  rows.forEach((r) => { r.prev = prevAvg[r.cid] == null ? null : prevAvg[r.cid]; });
  rows.sort((a, b) => a.klass.localeCompare(b.klass, 'ko') || a.paper.localeCompare(b.paper, 'ko'));
  const examDays = Array.from(new Set((mq.data || []).map((x) => x.week_start)));
  return { rows, examDays, wk };
}

// 강사 본인의 재원생 — ACA 동기화본에서 그 이름이 담임/강사로 걸린 반의 학생(중복 제거). 담당 반이 없으면 null.
// 전체 재원생 수(total)는 늘 같이 돌려준다. 담당 반이 없으면 students = null.
async function homeLoadMine(userName) {
  const [cq, tq] = await Promise.all([
    SB.from('aca_class').select('c_id,name,deleted,active').contains('teachers', [userName]),
    SB.from('aca_student').select('s_id', { count: 'exact', head: true }).eq('state', '재원'),
  ]);
  if (cq.error) throw cq.error;
  const total = tq.error ? null : tq.count;
  // 진행 중인 반만 — ACA 에 닫히지 않고 남은 빈 반(영어휴원목록·지난 특강 등, 재원생 0)은 담당 반 수에 넣지 않는다(사장님 지적 2026-11-13)
  const cls = (cq.data || []).filter((c) => !c.deleted && Number(c.active) > 0);
  if (!cls.length) return { students: null, classes: 0, total };
  const ids = cls.map((c) => c.c_id);
  const sq = await SB.from('aca_student').select('s_id').eq('state', '재원').overlaps('class_ids', ids).limit(3000);
  if (sq.error) throw sq.error;
  return { students: new Set((sq.data || []).map((s) => s.s_id)).size, classes: cls.length, total };
}

// ===== 상담 경고 — 내 반 학생인데 내가 한 상담이 한 달(30일) 넘게 없는 아이 (사장님 지시 2026-11-13) =====
// 로그인할 때마다 홈 맨 위에 빨간 띠로 뜬다. X 로 닫으면 이번 로그인 동안은 안 뜨고, 다시 로그인하면 또 뜬다.
// "내 반" = aca_class.teachers 에 내 이름이 걸린 반의 재원생 · "내가 한 상담" = aca_counsel.p_name 에 내 이름(퇴사 표기 "(퇴)" 등 포함).
// 상담 기록은 앱에 2026-05-01 부터만 있다 — 그 전 상담은 "기록 없음"으로 보일 수 있다.
// 상담 기록을 못 읽는 그룹(조교·제작자 — aca_counsel RLS)이거나 담당 반이 없으면 띄우지 않는다.
const HOME_COUNSEL_DAYS = 30;
async function homeLoadCounselAlert(userName) {
  const cq = await SB.from('aca_class').select('c_id,name,deleted').contains('teachers', [userName]);
  if (cq.error) return null;
  const cls = (cq.data || []).filter((c) => !c.deleted);
  if (!cls.length) return null;
  const cname = {}; cls.forEach((c) => { cname[c.c_id] = homeShort(c.name); });
  const sq = await SB.from('aca_student').select('s_id,name,class_ids').eq('state', '재원').overlaps('class_ids', cls.map((c) => c.c_id)).limit(3000);
  if (sq.error || !(sq.data || []).length) return null;
  const kids = sq.data;
  const last = {};
  for (let i = 0; i < kids.length; i += 300) {
    const part = kids.slice(i, i + 300).map((k) => k.s_id);
    const r = await SB.from('aca_counsel').select('s_id,cs_date').in('s_id', part).ilike('p_name', '%' + userName + '%').order('cs_date', { ascending: false }).limit(5000);
    if (r.error) return null;   // 상담 기록을 못 읽는 권한
    (r.data || []).forEach((x) => { const d = String(x.cs_date || '').slice(0, 10); if (d && (!last[x.s_id] || d > last[x.s_id])) last[x.s_id] = d; });
  }
  const today = new Date(homeYmd(new Date()) + 'T00:00:00');
  const list = kids.map((k) => {
    const d = last[k.s_id];
    const days = d ? Math.round((today - new Date(d + 'T00:00:00')) / 864e5) : null;
    return { s_id: k.s_id, name: k.name, cls: (k.class_ids || []).map((id) => cname[id]).filter(Boolean).join(', '), last: d || null, days };
  }).filter((x) => x.days == null || x.days > HOME_COUNSEL_DAYS)
    .sort((a, b) => (b.days == null ? 1e9 : b.days) - (a.days == null ? 1e9 : a.days) || a.name.localeCompare(b.name, 'ko'));
  return { list, total: kids.length };
}
// 닫은 것은 "이번 로그인" 동안만 — 로그인 시각(last_sign_in_at)이 바뀌면(다시 로그인) 또 뜬다
let HOME_COUNSEL_DISMISSED = null;
function HomeCounselAlert({ userName }) {
  const [data, setData] = useState(null);
  const [loginKey, setLoginKey] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    SB.auth.getSession().then(({ data: s }) => { if (live) setLoginKey(((s && s.session && s.session.user) || {}).last_sign_in_at || 'x'); }, () => setLoginKey('x'));
    homeLoadCounselAlert(userName).then((d) => { if (live) setData(d); }, () => {});
    return () => { live = false; };
  }, [userName]);
  const [gone, setGone] = useState(false);
  if (!data || !data.list.length || !loginKey || gone || HOME_COUNSEL_DISMISSED === loginKey + '|' + userName) return null;
  // 디자인(사장님 2026-11-13 "AI 디자인스럽다" → design-taste 앱 화면 규칙으로 다시): 틴트 상자·왼쪽 막대·경고 아이콘·알약 칩 없음.
  // 다른 홈 패널과 같은 흰 패널에 빨간 1px 테두리, 빨강은 숫자(명수·일수)에만. 명단은 이름·반·일수가 줄 맞춰 선 여러 단 목록.
  const CAP = 16;
  const shown = open ? data.list : data.list.slice(0, CAP);
  const noneN = data.list.filter((x) => x.days == null).length;
  return (
    <section className="tt-alert" role="alert" aria-label="상담이 한 달 넘게 없는 내 반 학생">
      <div className="hd">
        <div className="fig num"><b>{data.list.length}</b><span>명</span></div>
        <div className="ttl">
          <h2>상담이 {HOME_COUNSEL_DAYS}일 넘게 없는 내 반 학생</h2>
          <p>내 반 재원생 {data.total}명 중 · 내가 한 상담 기준{noneN ? ' · 그중 ' + noneN + '명은 상담 기록이 없음' : ''}</p>
        </div>
        <button className="x" aria-label="닫기" title="닫기 — 다시 로그인하면 또 뜹니다" onClick={() => { HOME_COUNSEL_DISMISSED = loginKey + '|' + userName; setGone(true); }}>닫기</button>
      </div>
      <ol className="ls">
        {shown.map((x) => (
          <li key={x.s_id}>
            <b>{x.name}</b>
            <span className="c">{x.cls}</span>
            <span className="d num">{x.days == null ? '없음' : x.days + '일'}</span>
          </li>
        ))}
      </ol>
      {data.list.length > CAP && <button className="more" onClick={() => setOpen(!open)}>{open ? '접기' : '모두 보기 (' + data.list.length + '명)'}</button>}
    </section>
  );
}

// ===== 할 일 — 날짜별 체크리스트(달력과 한 몸) =====
// 사람마다 따로, 어느 PC 에서든 같은 목록(home_todos 테이블, scripts/home_todo_schema.sql — day 칸이 날짜).
// 테이블이 아직 없으면 이 PC 의 localStorage 에 담아 둔다(목록 아래에 그렇게 적는다).
function useHomeTodos(userName) {
  const [items, setItems] = useState(null);   // null = 불러오는 중
  const [local, setLocal] = useState(false);  // true = DB 테이블 없음 → 이 PC 에만 저장
  const LK = 'home_todos|' + userName;
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LK) || '[]'); } catch (e) { return []; } };
  const writeLocal = (arr) => { try { localStorage.setItem(LK, JSON.stringify(arr)); } catch (e) {} };
  useEffect(() => {
    SB.from('home_todos').select('id,text,done,day,at,created_at').order('created_at').limit(2000).then(({ data, error }) => {
      if (error) { setLocal(true); setItems(readLocal()); return; }
      setItems(data || []);
    });
  }, [userName]);
  const add = (day, text, at) => {   // at = 'HH:MM' 또는 '' (시간 없이)
    const t = String(text || '').trim(); if (!t) return;
    if (local) { const arr = (items || []).concat({ id: 'l' + Date.now(), text: t, done: false, day, at: at || '', created_at: new Date().toISOString() }); setItems(arr); writeLocal(arr); return; }
    SB.from('home_todos').insert({ text: t, day, at: at || '' }).select('id,text,done,day,at,created_at').single().then(({ data, error }) => { if (!error && data) setItems((cur) => (cur || []).concat(data)); });
  };
  const toggle = (it) => {
    const arr = (items || []).map((x) => (x.id === it.id ? Object.assign({}, x, { done: !x.done }) : x)); setItems(arr);
    if (local) writeLocal(arr); else SB.from('home_todos').update({ done: !it.done }).eq('id', it.id).then(function () {});
  };
  const remove = (it) => {
    const arr = (items || []).filter((x) => x.id !== it.id); setItems(arr);
    if (local) writeLocal(arr); else SB.from('home_todos').delete().eq('id', it.id).then(function () {});
  };
  // 안 한 것 먼저, 그 안에서 시간 있는 것(이른 순) → 시간 없는 것(적은 순)
  const forDay = (day) => (items || []).filter((x) => x.day === day).sort((a, b) => (a.done - b.done) || ((a.at ? 0 : 1) - (b.at ? 0 : 1)) || String(a.at || '').localeCompare(String(b.at || '')) || String(a.created_at).localeCompare(String(b.created_at)));
  return { items, local, add, toggle, remove, forDay };
}

// 한 날짜의 체크리스트(입력칸 + 항목). 달력 아래와 '오늘 일정'이 같은 것을 쓴다.
// 시간 고르기 — 시 · 분(5분 단위) 드롭다운 + 오전/오후 표시(눌러서 바꿈) + ×(비우기). 값은 24시간 'HH:MM', 비우면 ''.
// (사장님이 준 shadcn TimePicker 를 옮긴 것. 그 컴포넌트는 Tailwind·TS·빌드가 필요해 그대로는 못 쓴다.
//  처음엔 비어 있다 — 시간은 안 넣어도 되는 칸. 시·분 중 하나를 고르면 학원 일정이 대부분 오후라 오후로 잡는다.)
function HomeTimePicker({ value, onChange }) {
  const m = /^(\d{2}):(\d{2})$/.exec(value || '');
  const H = m ? +m[1] : null, M = m ? m[2] : '';
  const ap = H == null ? '' : (H >= 12 ? '오후' : '오전');
  const h12 = H == null ? '' : String(H % 12 === 0 ? 12 : H % 12).padStart(2, '0');
  const set = (nh, nm, nap) => {
    const hh = nh || h12 || '12', mm = nm || M || '00', aa = nap || ap || '오후';
    let h = +hh % 12; if (aa === '오후') h += 12;
    onChange(String(h).padStart(2, '0') + ':' + mm);
  };
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  if (M && mins.indexOf(M) < 0) mins.push(M);   // 예전에 5분 단위가 아닌 값으로 넣은 것
  return (
    <div className="tt-tp">
      <select value={h12} onChange={(e) => set(e.target.value, '', '')} aria-label="시">
        <option value="" disabled>시</option>
        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="col">:</span>
      <select value={M} onChange={(e) => set('', e.target.value, '')} aria-label="분">
        <option value="" disabled>분</option>
        {mins.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      {ap
        ? <button type="button" className="ap" onClick={() => set('', '', ap === '오전' ? '오후' : '오전')} title="눌러서 오전/오후 바꾸기">{ap}</button>
        : <span className="ap none">시간 선택</span>}
      {value ? <button type="button" className="clr" onClick={() => onChange('')} aria-label="시간 지우기">×</button> : null}
    </div>
  );
}
function homeAtLabel(at) {   // '16:30' → '오후 4:30'
  const m = /^(\d{2}):(\d{2})$/.exec(at || ''); if (!m) return '';
  const h = +m[1]; return (h >= 12 ? '오후 ' : '오전 ') + (h % 12 === 0 ? 12 : h % 12) + ':' + m[2];
}

function HomeDayList({ todo, day, input }) {
  const [text, setText] = useState('');
  const [at, setAt] = useState('');   // 시간은 안 넣어도 된다
  const list = todo.forDay(day);
  return (
    <div className="tt-todo">
      {input && (
        <form onSubmit={(e) => { e.preventDefault(); todo.add(day, text, at); setText(''); setAt(''); }} style={{ marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <HomeTimePicker value={at} onChange={setAt} />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={at ? homeAtLabel(at) + ' 할 일 적고 Enter' : '할 일 적고 Enter (시간은 선택)'} />
        </form>
      )}
      {todo.items === null && <div className="tt-empty">불러오는 중…</div>}
      {list.map((it) => (
        <div key={it.id} className={'tt-td' + (it.done ? ' done' : '')}>
          <button className="ck" onClick={() => todo.toggle(it)} aria-label={it.done ? '안 한 것으로' : '한 것으로'}>{it.done ? '✓' : ''}</button>
          {it.at ? <span className="at num">{homeAtLabel(it.at)}</span> : null}<span className="tx">{it.text}</span>
          <button className="x" onClick={() => todo.remove(it)} aria-label="지우기">×</button>
        </div>
      ))}
      {input && todo.local && <div className="tt-note">이 PC에만 저장됩니다</div>}
    </div>
  );
}

const HOME_RAIL_ICONS = {
  home: 'M4 11l8-7 8 7v9H4z M10 20v-6h4v6',
};

function Home({ userName, roleLabel, perms, dark, setDark, onOpenStudio, onOpenMock, onOpenBooking, onOpenRoster, onOpenWtAdmin, onOpenDashboard, onOpenReport, onOpenAttend, onOpenDiary, onOpenWtClass, onLogout }) {
  const [week, setWeek] = useState(null);        // null = 불러오는 중 · { rows, examDays, wk } · { error }
  const [consults, setConsults] = useState([]);  // 오늘 내 상담 (14-booking.js)
  const bookingOn = permAllows(perms, 'booking', userName);
  const wtOn = permAllows(perms, 'weeklyadmin', userName);
  useEffect(() => { homeLoadWeek().then(setWeek).catch((e) => setWeek({ error: (e && e.message) || String(e) })); }, []);
  useEffect(() => { if (bookingOn) bkTodayBrief(userName).then(setConsults).catch(function () {}); }, [userName]);
  const [mine, setMine] = useState(undefined);   // undefined = 불러오는 중 · null = 담당 반 없음(강사 아님) · { students, classes }
  useEffect(() => { homeLoadMine(userName).then(setMine).catch(() => setMine(null)); }, [userName]);
  const todo = useHomeTodos(userName);
  const [selDay, setSelDay] = useState(() => homeYmd(new Date()));                          // 달력에서 고른 날
  const [calYm, setCalYm] = useState(() => [new Date().getFullYear(), new Date().getMonth()]);   // 달력이 보여 주는 달

  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const todayStr = (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + days[now.getDay()] + '요일';
  const allRows = (week && week.rows) || [];
  // 주간테스트는 **본인이 담임인 반만** 보인다(사장님 2026-11-13). 담임 = aca_class.teachers(ACA 의 현재 담임).
  // 시험지를 낸 사람(paperTeacher)이어도 담임이 아니면 안 보인다. 담임인 반이 없으면 주간테스트 칸 자체를 숨긴다 —
  // 원장·개발자도 예외가 아니다. '전체' 보기는 없앴다(전체는 주간테스트 관리에서 권한대로 본다).
  const rows = allRows.filter((r) => r.teachers.indexOf(userName) >= 0);
  // 담임인 반이 있으면(이번 주 시험이 없어도) 칸을 두고, 담임인 반이 하나도 없으면 숨긴다. 담임 여부를 읽는 중에는 둔다.
  const showWeek = rows.length > 0 || mine === undefined || !!(mine && mine.classes > 0);

  // 숫자 네 칸
  const tests = Array.from(new Set(rows.map((r) => r.testId))).length;
  const took = rows.reduce((a, r) => a + r.took, 0), total = rows.reduce((a, r) => a + r.total, 0);
  const missing = rows.filter((r) => r.took < r.total).sort((a, b) => (b.total - b.took) - (a.total - a.took));
  const graded = rows.filter((r) => r.avg != null);
  const wkAvg = graded.length ? graded.reduce((a, r) => a + r.avg * r.took, 0) / Math.max(1, graded.reduce((a, r) => a + r.took, 0)) : null;
  const wkLabel = week && week.wk ? (week.wk.getMonth() + 1) + '/' + week.wk.getDate() + ' ~ ' + (() => { const e = new Date(week.wk); e.setDate(e.getDate() + 6); return (e.getMonth() + 1) + '/' + e.getDate(); })() : '';
  const consultRows = consults.map((s) => { const i = s.indexOf(' 상담 — '); return i > 0 ? { at: s.slice(0, i), who: s.slice(i + 6) } : { at: '', who: s }; });

  // 달력 + 날짜별 할 일 — 날짜를 누르면 아래에 그날 체크리스트가 열린다. 칸에는 남은 할 일 수를 작게 적는다.
  const todayKey = homeYmd(now);
  const y = calYm[0], mo = calYm[1];
  const first = new Date(y, mo, 1).getDay(), nDays = new Date(y, mo + 1, 0).getDate();
  const exam = {}; ((week && week.examDays) || []).forEach((d) => { const p = d.split('-'); if (+p[0] === y && +p[1] === mo + 1) exam[+p[2]] = 1; });
  const cnt = {};   // 날짜 → { left, all }
  (todo.items || []).forEach((x) => { const c = cnt[x.day] || (cnt[x.day] = { left: 0, all: 0 }); c.all++; if (!x.done) c.left++; });
  const cal = [];
  for (let i = 0; i < first; i++) cal.push(<span key={'p' + i}></span>);
  for (let d = 1; d <= nDays; d++) {
    const dow = (first + d - 1) % 7;
    const key = homeYmd(new Date(y, mo, d));
    const c = cnt[key];
    const cl = [key === todayKey ? 'today' : '', key === selDay ? 'sel' : '', dow === 0 || dow === 6 ? 'off' : '', exam[d] ? 'exam' : ''].filter(Boolean).join(' ');
    cal.push(
      <button key={d} className={'num ' + cl} onClick={() => setSelDay(key)}>
        <b>{d}</b>
        {c ? <em className={c.left ? '' : 'clear'}>{c.left ? c.left : '✓'}</em> : null}
      </button>
    );
  }
  const moveMonth = (k) => { const d = new Date(y, mo + k, 1); setCalYm([d.getFullYear(), d.getMonth()]); };
  const selDate = new Date(selDay + 'T00:00:00');
  const selLabel = (selDate.getMonth() + 1) + '월 ' + selDate.getDate() + '일 ' + days[selDate.getDay()] + '요일';
  const todayTodos = todo.forDay(todayKey);
  const todayLeft = todayTodos.filter((x) => !x.done).length;

  const byAvg = graded.slice().sort((a, b) => b.avg - a.avg);
  const showConsult = bookingOn;

  return (
    <div className="tt-home">
      <HomeCounselAlert userName={userName} />
      <div className="tt-top">
        {APP_VERSION && <span title={'SL PRIME ' + APP_VERSION}>{APP_VERSION}</span>}
        <button className="tt-btn" onClick={onLogout}>로그아웃</button>
      </div>
      <h1>{userName} {roleLabel === '원장' ? '원장님' : '선생님'}, {todayStr}</h1>

      <div className="tt-grid">
        {mine && mine.students != null
          ? <div className={'tt-tile' + (showWeek ? '' : ' wide')}><div className="l">내 원생 / 전체 원생</div><div className="v num">{mine.students}{mine.total != null ? <small>/ {mine.total}</small> : null}</div><div className="c">담당 반 {mine.classes}개 · ACA 재원 기준</div></div>
          : <div className={'tt-tile' + (showWeek ? '' : ' wide')}><div className="l">전체 원생</div><div className="v num">{mine && mine.total != null ? mine.total : '—'}</div><div className="c">ACA 재원 기준</div></div>}
        {showWeek && <div className="tt-tile"><div className="l">채점이 들어온 학생</div><div className="v num">{week && !week.error ? took : '—'}{total ? <small>/ {total}</small> : null}</div><div className="c">채점 링크·직접 입력 합계</div></div>}
        {showWeek && <div className="tt-tile"><div className="l">아직 안 본 학생</div><div className="v num">{week && !week.error ? Math.max(0, total - took) : '—'}</div><div className="c">{missing.slice(0, 2).map((r) => homeShort(r.klass) + ' ' + (r.total - r.took) + '명').join(' · ')}</div></div>}
        <div className={'tt-tile' + (showWeek ? '' : ' wide')}><div className="l">오늘 일정</div><div className="v num">{consultRows.length + todayLeft}</div>
          <div className="c">{[showConsult ? '상담 ' + consultRows.length : '', '할 일 ' + todayLeft].filter(Boolean).join(' · ')}{consultRows.length ? ' · ' + consultRows.map((c) => c.at).join(' · ') : ''}</div></div>

        {showWeek && <section className="tt-pnl c9">
          <div className="tt-ph">
            <h2>이번 주 주간테스트</h2><span className="chip">내 반 {rows.length}개</span>
            {wtOn && <button className="go" onClick={onOpenWtAdmin}>주간테스트 관리</button>}
          </div>
          <div className="tt-rows">
            {!week && <div className="tt-empty">불러오는 중…</div>}
            {week && week.error && <div className="tt-empty">{week.error}</div>}
            {week && !week.error && !rows.length && <div className="tt-empty">이번 주에 내 반 시험지가 없습니다</div>}
            {rows.map((r) => {
              const none = r.took === 0, part = r.took > 0 && r.took < r.total;
              const delta = r.avg != null && r.prev != null ? r.avg - r.prev : null;
              const sub = r.avg == null ? (r.prev != null ? '지난주 ' + r.prev.toFixed(1) : '아직 채점 없음')
                : part ? r.took + '명 평균' + (r.prev != null ? ' · 지난주 ' + r.prev.toFixed(1) : '')
                : delta != null ? (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1) + ' 지난주 대비' : '지난주 기록 없음';
              return (
                <button key={r.testId + '|' + r.cid} className="tt-row" onClick={wtOn ? () => onOpenWtClass({ cid: r.cid, testId: r.testId, subject: r.subjects.indexOf('영어') < 0 && r.subjects.indexOf('수학') >= 0 ? '수학' : '영어', branch: waBranchOf({ name: r.klass }) }) : undefined} style={wtOn ? null : { cursor: 'default' }}>
                  <div className="who"><b>{r.klass}</b><span>{r.teachers.length ? r.teachers.join(', ') + 'T' : (r.paperTeacher ? r.paperTeacher + 'T' : '')}</span></div>
                  <div className="who hidesm"><b style={{ fontWeight: 400 }}>{r.paper}</b><span>{r.wkName || '이번 주'}</span></div>
                  <div className="fig num"><b>{r.took} / {r.total}</b><span>응시</span></div>
                  <div className="fig num hidesm" style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={'tt-bar' + (part || none ? ' grey' : '')}><i style={{ width: (r.avg || 0) + '%' }}></i></div>
                      <b style={{ width: 40, textAlign: 'right' }}>{r.avg == null ? '—' : r.avg.toFixed(1)}</b>
                    </div>
                    <span>{sub}</span>
                  </div>
                  <div className={'act' + (none ? ' quiet' : '')}>{none ? '응시 전' : '성적 보기'}</div>
                </button>
              );
            })}
          </div>
        </section>}

        {/* 오늘 일정 = 오늘 상담 + 오늘 할 일(달력의 오늘 칸과 같은 목록) */}
        <section className={'tt-pnl ' + (showWeek ? 'c3' : 'c6')}>
          <div className="tt-ph"><h2>오늘 일정</h2><span className="chip">{consultRows.length + todayLeft}</span>{showConsult && <button className="go" onClick={onOpenBooking}>상담 일정</button>}</div>
          {consultRows.length > 0 && (
            <div className="tt-rows" style={{ marginBottom: 12 }}>
              {consultRows.map((c, i) => (
                <div key={i} className="tt-row c2"><div className="num">{c.at}</div><div className="who"><b>{c.who.replace(/\(.*\)$/, '')}</b><span>{(c.who.match(/\((.*)\)$/) || [])[1] || '상담'}</span></div></div>
              ))}
            </div>
          )}
          <HomeDayList todo={todo} day={todayKey} input={true} />
          {todo.items && !consultRows.length && !todayTodos.length && <div className="tt-empty" style={{ paddingTop: 10 }}>오늘 잡힌 일정이 없습니다</div>}
        </section>

        {showWeek && <section className="tt-pnl c6">
          <div className="tt-ph"><h2>반별 평균 · 이번 주</h2><span className="note">채점이 들어온 반만</span></div>
          {!byAvg.length && <div className="tt-empty">아직 채점이 들어온 반이 없습니다</div>}
          {byAvg.map((r) => (
            <div key={r.testId + '|' + r.cid} className="tt-mr"><span className="q">{homeShort(r.klass)}</span><div className="t"><i style={{ width: r.avg + '%' }}></i></div><span className="n num">{r.avg.toFixed(1)}</span></div>
          ))}
        </section>}
        <section className="tt-pnl c6">
          <div className="tt-ph">
            <h2>{(y !== now.getFullYear() ? y + '년 ' : '') + (mo + 1)}월</h2>
            <span className="note">파란 점은 주간테스트 주 · 숫자는 남은 할 일</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button className="tt-btn sm" onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
              <button className="tt-btn sm" onClick={() => { setCalYm([now.getFullYear(), now.getMonth()]); setSelDay(todayKey); }}>오늘</button>
              <button className="tt-btn sm" onClick={() => moveMonth(1)} aria-label="다음 달">›</button>
            </span>
          </div>
          <div className="tt-cal">{days.map((d) => <div key={d} className="d">{d}</div>)}{cal}</div>
          <div className="tt-dayhead"><b>{selLabel}</b><span>할 일 {todo.forDay(selDay).filter((x) => !x.done).length}</span></div>
          <HomeDayList key={selDay} todo={todo} day={selDay} input={true} />
        </section>

        {/* 개발자만 — LUCY 사용량 (25-lucyadmin.js). 권한 미리보기 중에는 그 그룹 화면이라 안 뜬다 */}
        {permGroupKey(perms) === '개발자' && <LucyUsageDash dark={dark} />}
      </div>

    </div>
  );
}

// ===== 아이콘 레일(셸) — 홈과 모든 앱이 같은 것을 쓴다(taste 시안의 56px 레일) =====
// 사이드바 맨 아래 내 이름 — 그 밑에 LUCY 5시간 사용량 %(23-aichat.js 의 useLucyQuota, 질문할 때마다 같이 바뀐다)
function TasteRailMe({ userName, perms }) {
  const q = useLucyQuota(perms);
  const sub = lucyQuotaShort(q);
  return (
    <div className={'me' + (sub ? ' two' : '')} title={userName + (sub ? ' · ' + sub : '')}>
      <span className="av">{String(userName || '').slice(0, 1)}</span>
      <span className="lb">{userName}{sub && <small className={q.fallback ? 'out' : ''}>{sub}</small>}</span>
    </div>
  );
}
function TasteRail({ view, setView, perms, userName, onSettings }) {
  // 사이드바 — 데스크톱: 마우스를 올리면 56px → 232px 로 펼쳐져 이름이 보인다(본문을 밀지 않고 위에 겹침).
  // 폰: 위쪽 막대의 메뉴 버튼 → 전체 화면 메뉴가 왼쪽에서 밀려 들어온다.
  const [open, setOpen] = useState(false);
  const items = [['studio', '지문 스튜디오', HOME_PASSAGE_ICON], ['mock', '모의고사', HOME_MOCK_ICON]];
  if (permAllows(perms, 'weeklyadmin', userName)) items.push(['wtadmin', '주간테스트 관리', HOME_WTADMIN_ICON]);
  if (permAllows(perms, 'report', userName)) items.push(['report', '레포트', HOME_REPORT_ICON]);
  if (permAllows(perms, 'attend', userName)) items.push(['attend', '출석부', HOME_ATTEND_ICON]);
  if (permAllows(perms, 'diary', userName)) items.push(['diary', '업무일지', HOME_DIARY_ICON]);
  if (permAllows(perms, 'roster', userName)) items.push(['roster', '전체명단', HOME_ROSTER_ICON]);
  if (permAllows(perms, 'booking', userName)) items.push(['booking', '상담 일정', HOME_BOOKING_ICON]);
  if (permAllows(perms, 'dashboard', userName)) items.push(['dashboard', '대시보드', HOME_DASHBOARD_ICON]);
  if (permAllows(perms, 'users', userName)) items.push(['users', '사용자 관리', HOME_USERS_ICON]);
  const go = (fn) => () => { fn(); if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) setOpen(false); };
  const btn = (k, label, d, on) => (
    <button key={k} onClick={go(on || (() => setView(k)))} aria-label={label} aria-current={view === k ? 'page' : undefined}>
      <svg viewBox="0 0 24 24"><path d={d}></path></svg><span className="lb">{label}</span>
    </button>
  );
  return (
    <div className="tt-railcell">
      <div className="tt-mbar">
        <div className="mark"><b>SL</b> PRIME</div>
        <button aria-label="메뉴 열기" onClick={() => setOpen(true)}><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"></path></svg></button>
      </div>
      <nav className={'tt-rail' + (open ? ' open' : '')} aria-label="앱" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <div className="mark"><b>SL</b><span className="lb">PRIME</span></div>
        <button className="tt-railx" aria-label="메뉴 닫기" onClick={(e) => { e.stopPropagation(); setOpen(false); }}><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"></path></svg></button>
        {btn('home', '홈', HOME_RAIL_ICONS.home)}
        <div className="hr"></div>
        {items.map((it) => btn(it[0], it[1], it[2]))}
        <div className="spacer"></div>
        {btn('settings', '설정', HOME_SETTINGS_ICON, onSettings)}
        <TasteRailMe userName={userName} perms={perms} />
      </nav>
    </div>
  );
}
