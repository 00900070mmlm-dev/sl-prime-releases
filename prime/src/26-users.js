// ===== 사용자 관리 (홈 → 사용자 관리) — 관리자·개발자만 =====
// 계정 보기 · 추가 · 권한(그룹)·직함 바꾸기 · 비밀번호 초기화 · 삭제.
// 계정을 만들고 지우는 일은 service_role 키가 있어야 해서 앱이 직접 못 한다 — Edge Function
// `admin-users`(supabase/functions/admin-users/index.ts)를 부르고, **권한 확인도 그쪽이 다시 한다**:
//   · 관리자는 개발자 계정을 바꾸거나 지울 수 없고, 개발자 권한을 줄 수 없다 · 자기 자신은 지우거나 권한을 바꿀 수 없다.
// 로그인은 이름으로 하므로 이름이 겹치면 안 된다(함수가 막는다). 새 계정은 NAME_TO_EMAIL 표에 없어도
// 로그인된다 — 로그인 화면이 표에 없는 이름이면 같은 함수(login_email)로 이메일을 찾아온다(06-login.js).
// 디자인은 앱 화면 규칙: 줄과 정렬로 된 표 · 회색 12px 머리글 · 색은 위험한 동작(삭제)에만.

const USR_FN = SUPA_URL + '/functions/v1/admin-users';
async function usrCall(body) {
  const { data } = await SB.auth.getSession();
  const token = (data && data.session && data.session.access_token) || '';
  let res;
  try {
    res = await fetch(USR_FN, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPA_KEY, Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  } catch (e) { throw new Error('서버에 닿지 못했습니다 — 인터넷 연결을 확인하세요'); }
  let j = {};
  try { j = await res.json(); } catch (e) {}
  if (res.status === 404 && !j.error) throw new Error('사용자 관리 서버 함수(admin-users)가 아직 배포되지 않았습니다');
  if (!res.ok || j.error) throw new Error(j.error || ('요청 실패 (' + res.status + ')'));
  return j;
}
const USR_GROUPS = ['개발자', '관리자', '강사', '조교', '제작자'];
const usrWhen = (t) => {
  if (!t) return '—';
  const d = new Date(t), now = new Date();
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  const hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  return days === 0 ? '오늘 ' + hm : days === 1 ? '어제 ' + hm : days < 7 ? days + '일 전' : homeYmd(d);
};

function UsersApp({ dark, myName }) {
  const K = TT(dark);
  const [rows, setRows] = useState(null);
  const [me, setMe] = useState(null);
  const [myGroup, setMyGroup] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');          // 진행 중인 동작의 id
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', perms: '강사', role: '', password: '', ui: 'old' });
  const [pwFor, setPwFor] = useState(null);       // 비밀번호 초기화 칸이 열린 사람 id
  const [pw, setPw] = useState('');
  const [delFor, setDelFor] = useState(null);     // 삭제 확인이 열린 사람 id
  const [q, setQ] = useState('');
  const [roleEd, setRoleEd] = useState(null);     // 직함을 고치는 중 { id, val }

  const load = () => usrCall({ action: 'list' }).then((j) => { setRows(j.users); setMe(j.me); setMyGroup(j.myGroup); setErr(''); }, (e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const isDev = myGroup === '개발자';
  const canTouch = (u) => isDev || u.perms !== '개발자';
  const grantable = USR_GROUPS.filter((g) => isDev || g !== '개발자');
  const done = (t) => { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? '' : m)), 4000); };
  const run = (id, body, okText) => {
    setBusy(id); setErr('');
    return usrCall(body).then((j) => { done(okText(j)); return load().then(() => j); }, (e) => { setErr(e.message); return null; }).finally(() => setBusy(''));
  };

  // 이메일은 받지 않는다(늘 임의로 지어 왔다 — 사장님 2026-11-13). 서버 함수가 지어 넣고, 로그인은 이름으로 한다.
  const createOk = f.name.trim() && f.password.length >= 6;
  const create = (e) => {
    e.preventDefault();
    if (!createOk || busy) return;
    run('new', { action: 'create', name: f.name, password: f.password, perms: f.perms, role: f.role, ui: f.ui }, (j) => j.user.name + ' 님 계정을 만들었습니다 · 로그인 이름 "' + j.user.name + '" · 처음 비밀번호를 본인에게 알려 주세요')
      .then((j) => { if (j) { setF({ name: '', perms: '강사', role: '', password: '', ui: 'old' }); setAdding(false); } });
  };

  // ── 모양
  const inp = { height: 32, padding: '0 10px', border: '1px solid ' + K.control, borderRadius: K.rCtl, background: K.surface, color: K.text, font: 'inherit', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' };
  const btn = (primary) => ({ height: 32, padding: '0 14px', borderRadius: K.rCtl, border: primary ? 'none' : '1px solid ' + K.control, background: primary ? K.ink : 'transparent', color: primary ? K.inkText : K.text, font: 'inherit', fontSize: 13, fontWeight: primary ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' });
  const link = (danger) => ({ height: 28, padding: '0 8px', border: 0, borderRadius: K.rCtl, background: 'transparent', color: danger ? K.neg : K.text, font: 'inherit', fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' });
  const th = { textAlign: 'left', fontSize: 12, fontWeight: 400, color: K.muted, padding: '0 12px', height: 36, whiteSpace: 'nowrap' };
  const td = { padding: '0 12px', height: 52, borderTop: '1px solid ' + K.border, fontSize: 13.5, verticalAlign: 'middle' };
  const label = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: K.muted };

  const list = (rows || []).filter((u) => !q.trim() || (u.name + ' ' + u.email + ' ' + u.perms + ' ' + u.role).indexOf(q.trim()) >= 0);
  const count = {}; (rows || []).forEach((u) => { count[u.perms] = (count[u.perms] || 0) + 1; });

  return (
    <div style={{ minHeight: '100vh', background: K.ground, color: K.text, fontFamily: TT_FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid ' + K.border }}>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>사용자 관리</div>
        {rows && <span style={{ fontSize: 12.5, color: K.muted }}>{rows.length}명 · {USR_GROUPS.filter((g) => count[g]).map((g) => g + ' ' + count[g]).join(' · ')}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·이메일·권한 찾기" style={Object.assign({}, inp, { width: 200 })} aria-label="사용자 찾기" />
          <button onClick={() => { setAdding(!adding); setErr(''); }} style={btn(!adding)}>{adding ? '닫기' : '사용자 추가'}</button>
        </span>
      </div>

      <div style={{ padding: '20px 24px 60px', maxWidth: 1100, margin: '0 auto' }}>
        {adding && (
          <form onSubmit={create} style={{ background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>새 사용자</div>
            <div style={{ fontSize: 12.5, color: K.muted, marginBottom: 16 }}>로그인은 이름으로 합니다. 이름은 다른 사람과 겹치면 안 됩니다.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr', gap: 12, alignItems: 'end' }}>
              <label style={label}>이름<input value={f.name} onChange={(e) => setF(Object.assign({}, f, { name: e.target.value }))} style={inp} placeholder="홍길동" autoFocus /></label>
              <label style={label}>권한<select value={f.perms} onChange={(e) => setF(Object.assign({}, f, { perms: e.target.value }))} style={inp}>{grantable.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
              <label style={label}>화면<select value={f.ui} onChange={(e) => setF(Object.assign({}, f, { ui: e.target.value }))} style={inp}><option value="old">구UI</option><option value="new">신UI</option></select></label>
              <label style={label}>직함(선택)<input value={f.role} onChange={(e) => setF(Object.assign({}, f, { role: e.target.value }))} style={inp} placeholder="예: 실장" /></label>
              <label style={label}>처음 비밀번호<input value={f.password} onChange={(e) => setF(Object.assign({}, f, { password: e.target.value }))} style={inp} placeholder="6자 이상" autoComplete="new-password" spellCheck={false} /></label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button type="submit" disabled={!createOk || !!busy} style={Object.assign(btn(true), { opacity: !createOk || busy ? 0.45 : 1 })}>{busy === 'new' ? '만드는 중…' : '계정 만들기'}</button>
              <span style={{ fontSize: 12.5, color: K.muted }}>{PERM_DESC[f.perms] || ''}</span>
            </div>
          </form>
        )}

        {err && <div role="alert" style={{ marginBottom: 12, fontSize: 13.5, color: K.neg }}>{err}</div>}
        {msg && <div role="status" style={{ marginBottom: 12, fontSize: 13.5, color: K.pos }}>{msg}</div>}

        {!rows ? (!err && <div style={{ padding: 40, textAlign: 'center', color: K.muted, fontSize: 13.5 }}>불러오는 중…</div>) : (
          <div style={{ background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup><col style={{ width: '16%' }} /><col style={{ width: '24%' }} /><col style={{ width: '12%' }} /><col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '16%' }} /></colgroup>
              <thead><tr><th style={th}>이름</th><th style={th}>이메일</th><th style={th}>권한</th><th style={th}>화면</th><th style={th}>직함</th><th style={Object.assign({}, th, { textAlign: 'right' })}>최근 로그인</th><th style={th}></th></tr></thead>
              <tbody>
                {list.map((u) => {
                  const mine = u.id === me, ok = canTouch(u) && !mine;
                  return (
                    <React.Fragment key={u.id}>
                      <tr>
                        <td style={td}><b style={{ fontWeight: 500 }}>{u.name || '(이름 없음)'}</b>{mine && <span style={{ marginLeft: 6, fontSize: 12, color: K.muted }}>나</span>}</td>
                        <td style={Object.assign({}, td, { color: K.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })} title={u.email}>{u.email}</td>
                        <td style={td}>
                          {ok ? (
                            <select value={u.perms} disabled={busy === u.id} aria-label={u.name + ' 권한'}
                              onChange={(e) => { const g = e.target.value; run(u.id, { action: 'update', id: u.id, perms: g }, () => u.name + ' 님 권한을 ' + g + '(으)로 바꿨습니다 · 본인이 앱을 다시 켜면 적용됩니다'); }}
                              style={Object.assign({}, inp, { height: 30, width: '100%', maxWidth: 110 })}>
                              {(grantable.indexOf(u.perms) >= 0 ? grantable : [u.perms].concat(grantable)).map((g) => <option key={g} value={g}>{g}</option>)}
                            </select>
                          ) : <span>{u.perms}</span>}
                        </td>
                        <td style={td}>
                          {/* 화면 — 구UI / 신UI. 신UI 로 둔 사람만 신UI 를 쓴다(개발자도 예외 없음) */}
                          {canTouch(u) ? (
                            <select value={u.ui} disabled={busy === u.id} aria-label={u.name + ' 화면'}
                              onChange={(e) => { const v = e.target.value; run(u.id, { action: 'update', id: u.id, ui: v }, () => u.name + ' 님을 ' + (v === 'new' ? '신UI' : '구UI') + '로 바꿨습니다'); }}
                              style={Object.assign({}, inp, { height: 30, width: '100%', maxWidth: 90 })}>
                              <option value="old">구UI</option><option value="new">신UI</option>
                            </select>
                          ) : <span>{u.ui === 'new' ? '신UI' : '구UI'}</span>}
                        </td>
                        <td style={td}>
                          {/* 직함 — 누르면 그 자리에서 고친다(Enter 저장 · Esc 취소). 개발자 계정은 관리자가 못 고친다 */}
                          {roleEd && roleEd.id === u.id ? (
                            <form onSubmit={(e) => { e.preventDefault(); const v = roleEd.val.trim(); setRoleEd(null); if (v === (u.role && u.role !== u.perms ? u.role : '')) return; run(u.id, { action: 'update', id: u.id, role: v }, () => u.name + ' 님 직함을 ' + (v ? '"' + v + '"(으)로' : '비움으로') + ' 바꿨습니다'); }}>
                              <input value={roleEd.val} autoFocus onChange={(e) => setRoleEd({ id: u.id, val: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') setRoleEd(null); }}
                                onBlur={(e) => e.currentTarget.form && e.currentTarget.form.requestSubmit()} placeholder="예: 실장" aria-label={u.name + ' 직함'}
                                style={Object.assign({}, inp, { height: 30, width: '100%' })} />
                            </form>
                          ) : canTouch(u) ? (
                            <button onClick={() => setRoleEd({ id: u.id, val: u.role && u.role !== u.perms ? u.role : '' })} title="눌러서 직함 고치기" aria-label={u.name + ' 직함 고치기'}
                              style={{ width: '100%', height: 30, padding: '0 8px', margin: '0 -8px', border: 0, borderRadius: K.rCtl, background: 'transparent', textAlign: 'left', font: 'inherit', fontSize: 13.5, color: u.role && u.role !== u.perms ? K.text : K.muted, cursor: 'text' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = K.active; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                              {busy === u.id ? '…' : (u.role && u.role !== u.perms ? u.role : '—')}
                            </button>
                          ) : <span style={{ color: u.role && u.role !== u.perms ? K.text : K.muted }}>{u.role && u.role !== u.perms ? u.role : '—'}</span>}
                        </td>
                        <td style={Object.assign({}, td, { textAlign: 'right', color: K.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' })}>{usrWhen(u.last_sign_in_at)}</td>
                        <td style={Object.assign({}, td, { textAlign: 'right', whiteSpace: 'nowrap' })}>
                          {canTouch(u) && <button style={link(false)} onClick={() => { setPwFor(pwFor === u.id ? null : u.id); setDelFor(null); setPw(''); }}>비밀번호</button>}
                          {ok && <button style={link(true)} onClick={() => { setDelFor(delFor === u.id ? null : u.id); setPwFor(null); }}>삭제</button>}
                        </td>
                      </tr>
                      {pwFor === u.id && (
                        <tr><td colSpan={7} style={Object.assign({}, td, { height: 'auto', padding: '12px', background: K.raised })}>
                          <form onSubmit={(e) => { e.preventDefault(); if (pw.length < 6) return; run(u.id, { action: 'password', id: u.id, password: pw }, () => u.name + ' 님 비밀번호를 바꿨습니다 · 새 비밀번호를 본인에게 알려 주세요').then((j) => { if (j) { setPwFor(null); setPw(''); } }); }}
                            style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13 }}>{u.name} 님 새 비밀번호</span>
                            <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="6자 이상" style={Object.assign({}, inp, { width: 180 })} autoFocus autoComplete="new-password" spellCheck={false} />
                            <button type="submit" disabled={pw.length < 6 || !!busy} style={Object.assign(btn(true), { opacity: pw.length < 6 || busy ? 0.45 : 1 })}>바꾸기</button>
                            <button type="button" onClick={() => setPwFor(null)} style={btn(false)}>취소</button>
                          </form>
                        </td></tr>
                      )}
                      {delFor === u.id && (
                        <tr><td colSpan={7} style={Object.assign({}, td, { height: 'auto', padding: '12px', background: K.raised })}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13 }}><b style={{ fontWeight: 600 }}>{u.name}</b> 님 계정을 지웁니다. 되돌릴 수 없고, 이 계정으로는 더 로그인할 수 없습니다.</span>
                            <button disabled={!!busy} onClick={() => run(u.id, { action: 'delete', id: u.id }, () => u.name + ' 님 계정을 지웠습니다').then(() => setDelFor(null))}
                              style={Object.assign(btn(false), { borderColor: K.neg, color: K.neg })}>{busy === u.id ? '지우는 중…' : '지우기'}</button>
                            <button onClick={() => setDelFor(null)} style={btn(false)}>취소</button>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {!list.length && <tr><td colSpan={7} style={Object.assign({}, td, { color: K.muted, textAlign: 'center' })}>찾는 사용자가 없습니다</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 12.5, color: K.muted, lineHeight: 1.6 }}>
          권한을 바꾸면 그 사람이 앱을 다시 켤 때부터 적용됩니다.{!isDev && ' 관리자는 개발자 계정을 바꾸거나 지울 수 없고, 개발자 권한도 줄 수 없습니다.'} 자기 계정은 지우거나 권한을 바꿀 수 없습니다.
        </div>
      </div>
    </div>
  );
}
