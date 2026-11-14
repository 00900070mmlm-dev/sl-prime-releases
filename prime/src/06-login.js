// LoginScreen · PwModal — 이름 로그인과 비밀번호 변경
// index.html 에서 분리(2026-07-29). 로드 순서는 index.html 의 script 태그 순서가 결정한다.
function LoginInput({ shimmer, ...props }) {
  return <input className="login-input" {...props} />;
}

function LoginScreen({ onSuccess }) {
  const dark = (() => { try { return localStorage.getItem('sl-dark') === '1'; } catch (e) { return false; } })();
  const K = TT(dark);
  const shimmer = K.ink;
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const logo = (() => { const l = document.querySelector('link[rel="icon"]'); return l ? l.href : ''; })();

  const [busy, setBusy] = useState(false);

  // Supabase 로그인: 이름 → 계정 이메일 매핑 → signInWithPassword. 성공 시 Root의 onAuthStateChange가 화면 전환.
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const nm = id.trim().normalize('NFC');
    let email = NAME_TO_EMAIL[nm];
    setBusy(true);
    try {
      // 표(NAME_TO_EMAIL)에 없는 이름 — 사용자 관리에서 새로 만든 계정이면 서버(admin-users 함수)가 이메일을 알려 준다
      if (!email) {
        try {
          const r = await fetch(SUPA_URL + '/functions/v1/admin-users', { method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY }, body: JSON.stringify({ action: 'login_email', name: nm }) });
          const j = await r.json(); email = j && j.email;
        } catch (e2) {}
      }
      if (!email) { setErr('등록되지 않은 이름입니다.'); return; }
      const { error } = await SB.auth.signInWithPassword({ email, password: pw });
      if (error) { setErr('이름 또는 비밀번호가 올바르지 않습니다.'); setPw(''); }
    } catch (er) {
      setErr('로그인 중 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={dark ? 'dark' : ''} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: K.ground, fontFamily: K.font, color: K.text }}>
      <form onSubmit={submit}
        style={{ width: '340px', maxWidth: '90vw', padding: '34px 30px 28px', borderRadius: K.rCard + 'px', background: K.surface, border: '1px solid ' + K.border, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            {logo && <img src={logo} alt="SL PRIME" style={{ width: '48px', height: '48px', objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />}
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.4px', color: K.text }}>SL PRIME</div>
          </div>
          <LoginInput shimmer={shimmer} value={id} onChange={e => { setId(e.target.value); setErr(''); }} placeholder="이름" autoFocus spellCheck={false} autoComplete="username" />
          <LoginInput shimmer={shimmer} type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(''); }} placeholder="비밀번호" autoComplete="current-password" />
          {err && <div style={{ fontSize: '12.5px', color: K.neg, textAlign: 'center' }}>{err}</div>}
          <button type="submit" className="login-btn" disabled={busy}><span>{busy ? '로그인 중…' : '로그인'}</span></button>
        </div>
      </form>
    </div>
  );
}

function PwModal({ dark, onClose }) {
  const K = TT(dark);
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!nw) { setMsg('새 비밀번호를 입력하세요.'); return; }
    if (nw.length < 6) { setMsg('새 비밀번호는 6자 이상이어야 합니다.'); return; }
    if (nw !== cf) { setMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    const { data: ud } = await SB.auth.getUser();
    const email = ud && ud.user && ud.user.email;
    if (!email) { setMsg('세션이 만료되었습니다. 다시 로그인해 주세요.'); return; }
    const { error: e1 } = await SB.auth.signInWithPassword({ email, password: cur });
    if (e1) { setMsg('현재 비밀번호가 올바르지 않습니다.'); return; }
    const { error: e2 } = await SB.auth.updateUser({ password: nw });
    if (e2) { setMsg('변경 실패: ' + (e2.message || '')); return; }
    setDone(true); setMsg('');
  };
  return (
    <div data-noprint="" className={(dark ? 'dark ' : '') + 'wip-backdrop'} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.32)', fontFamily: K.font }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="wip-card"
        style={{ width: '320px', maxWidth: '88vw', background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', boxShadow: '0 12px 32px rgba(0,0,0,0.16)', padding: '22px 20px 18px', display: 'flex', flexDirection: 'column', gap: '10px', color: K.text }}>
        <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.3px', marginBottom: '4px' }}>비밀번호 변경</div>
        {done ? (
          <>
            <div style={{ fontSize: '14px', color: K.muted, textAlign: 'center', lineHeight: 1.5, padding: '6px 0 10px' }}>비밀번호가 변경되었습니다.</div>
            <button type="button" onClick={onClose} className="login-btn"><span>확인</span></button>
          </>
        ) : (
          <>
            <input className="login-input" type="password" value={cur} onChange={e => { setCur(e.target.value); setMsg(''); }} placeholder="현재 비밀번호" autoFocus autoComplete="current-password" />
            <input className="login-input" type="password" value={nw} onChange={e => { setNw(e.target.value); setMsg(''); }} placeholder="새 비밀번호" autoComplete="new-password" />
            <input className="login-input" type="password" value={cf} onChange={e => { setCf(e.target.value); setMsg(''); }} placeholder="새 비밀번호 확인" autoComplete="new-password" />
            {msg && <div style={{ fontSize: '12.5px', color: K.neg }}>{msg}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="button" onClick={onClose} style={{ flex: 1, height: '42px', border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', background: K.surface, color: K.text, fontSize: '14px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: K.ease }}>취소</button>
              <button type="submit" className="login-btn" style={{ flex: 1, height: '42px', marginTop: 0 }}><span>변경</span></button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

