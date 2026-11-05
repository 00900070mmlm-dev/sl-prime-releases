// LoginScreen · PwModal — 이름 로그인과 비밀번호 변경
// index.html 에서 분리(2026-07-29). 로드 순서는 index.html 의 script 태그 순서가 결정한다.
function LoginInput({ shimmer, ...props }) {
  return <input className="login-input" {...props} />;
}

function LoginScreen({ onSuccess }) {
  const dark = (() => { try { return localStorage.getItem('sl-dark') === '1'; } catch (e) { return false; } })();
  const T = THEME(dark);
  const shimmer = dark ? '#4da3ff' : '#0066cc';
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [gp, setGp] = useState({ x: -400, y: -400 });
  const [gHover, setGHover] = useState(false);
  const logo = (() => { const l = document.querySelector('link[rel="icon"]'); return l ? l.href : ''; })();

  const [busy, setBusy] = useState(false);

  // Supabase 로그인: 이름 → 계정 이메일 매핑 → signInWithPassword. 성공 시 Root의 onAuthStateChange가 화면 전환.
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const email = NAME_TO_EMAIL[id.trim().normalize('NFC')];
    if (!email) { setErr('등록되지 않은 이름입니다.'); return; }
    setBusy(true);
    try {
      const { error } = await SB.auth.signInWithPassword({ email, password: pw });
      if (error) { setErr('이름 또는 비밀번호가 올바르지 않습니다.'); setPw(''); }
    } catch (er) {
      setErr('로그인 중 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={dark ? 'dark' : ''} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Segoe UI', sans-serif", color: T.text }}>
      <div style={{ position: 'absolute', top: '-160px', left: '20%', width: '520px', height: '520px', borderRadius: '50%', background: dark ? '#1c1133' : '#aecdf2', opacity: dark ? 0.55 : 0.5, filter: 'blur(110px)', pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', bottom: '-180px', right: '-100px', width: '560px', height: '560px', borderRadius: '50%', background: dark ? '#251644' : '#d9e6f7', opacity: dark ? 0.45 : 0.55, filter: 'blur(120px)', pointerEvents: 'none' }}></div>

      <form onSubmit={submit}
        onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); setGp({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
        onMouseEnter={() => setGHover(true)} onMouseLeave={() => setGHover(false)}
        style={{ position: 'relative', zIndex: 1, overflow: 'hidden', width: '360px', maxWidth: '90vw', padding: '38px 34px 32px', borderRadius: '22px', background: dark ? 'rgba(40,42,48,0.72)' : 'rgba(255,255,255,0.65)', WebkitBackdropFilter: 'saturate(180%) blur(30px)', backdropFilter: 'saturate(180%) blur(30px)', border: '1px solid ' + T.panelBorder, boxShadow: dark ? '0 30px 80px rgba(0,0,0,0.5)' : '0 30px 80px rgba(0,0,0,0.18)' }}>
        {/* 카드 안 마우스 따라오는 은은한 글로우 (검정 아님) */}
        <div style={{ position: 'absolute', pointerEvents: 'none', left: 0, top: 0, width: '340px', height: '340px', borderRadius: '50%', transform: 'translate(' + (gp.x - 170) + 'px, ' + (gp.y - 170) + 'px)', background: dark ? 'radial-gradient(circle, rgba(77,163,255,0.18), transparent 68%)' : 'radial-gradient(circle, rgba(0,102,204,0.13), transparent 68%)', opacity: gHover ? 1 : 0, transition: 'opacity 0.25s ease', filter: 'blur(14px)', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            {logo && <img src={logo} alt="SL PRIME" style={{ width: '64px', height: '64px', objectFit: 'contain', margin: '0 auto 10px', display: 'block' }} />}
            <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.4px', color: T.text }}>SL PRIME</div>
          </div>
          <LoginInput shimmer={shimmer} value={id} onChange={e => { setId(e.target.value); setErr(''); }} placeholder="이름" autoFocus spellCheck={false} autoComplete="username" />
          <LoginInput shimmer={shimmer} type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(''); }} placeholder="비밀번호" autoComplete="current-password" />
          {err && <div style={{ fontSize: '12.5px', color: '#e03131', textAlign: 'center', marginTop: '-4px' }}>{err}</div>}
          <button type="submit" className="login-btn" disabled={busy}><span>{busy ? '로그인 중…' : '로그인'}</span></button>
        </div>
      </form>
    </div>
  );
}

function PwModal({ dark, onClose }) {
  const T = THEME(dark);
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
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="wip-card"
        style={{ width: '320px', maxWidth: '88vw', background: dark ? 'rgba(40,42,48,0.92)' : 'rgba(255,255,255,0.92)', WebkitBackdropFilter: 'saturate(180%) blur(24px)', backdropFilter: 'saturate(180%) blur(24px)', border: '1px solid ' + T.panelBorder, borderRadius: '20px', boxShadow: '0 24px 70px rgba(0,0,0,0.32)', padding: '24px 22px 20px', display: 'flex', flexDirection: 'column', gap: '11px', color: T.text }}>
        <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.3px', textAlign: 'center', marginBottom: '4px' }}>비밀번호 변경</div>
        {done ? (
          <>
            <div style={{ fontSize: '14px', color: T.textDim, textAlign: 'center', lineHeight: 1.5, padding: '6px 0 10px' }}>비밀번호가 변경되었습니다.</div>
            <button type="button" onClick={onClose} className="login-btn"><span>확인</span></button>
          </>
        ) : (
          <>
            <input className="login-input" type="password" value={cur} onChange={e => { setCur(e.target.value); setMsg(''); }} placeholder="현재 비밀번호" autoFocus autoComplete="current-password" />
            <input className="login-input" type="password" value={nw} onChange={e => { setNw(e.target.value); setMsg(''); }} placeholder="새 비밀번호" autoComplete="new-password" />
            <input className="login-input" type="password" value={cf} onChange={e => { setCf(e.target.value); setMsg(''); }} placeholder="새 비밀번호 확인" autoComplete="new-password" />
            {msg && <div style={{ fontSize: '12.5px', color: '#e03131', textAlign: 'center' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="button" onClick={onClose} style={{ flex: 1, height: '44px', border: '1px solid ' + (dark ? 'rgba(255,255,255,0.16)' : '#d2d2d7'), borderRadius: '11px', background: 'transparent', color: T.text, fontSize: '14px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>취소</button>
              <button type="submit" className="login-btn" style={{ flex: 1, height: '44px', marginTop: 0 }}><span>변경</span></button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

