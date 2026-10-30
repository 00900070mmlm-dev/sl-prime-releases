// 상담 일정 — 학부모 상담 예약 링크 만들기 · 시간칸 열기 · 예약된 일정 보기
// 학부모는 폰에서 공개 페이지(web/booking/, GitHub Pages)로 예약하고, 여기서는 그 결과를 본다.
// 백엔드: scripts/booking_schema.sql (booking_links · booking_slots + 학부모용 RPC 4개)
// 시간은 전부 한국 시간 기준으로 만들고 보여준다(+09:00 고정 — 한국은 서머타임이 없다).

const BK_PAGE_URL = 'https://my.sl-edu.com/booking/';   // web/CNAME · sl-edu.com DNS 의 my CNAME 으로 연결(GitHub Pages). 학생용 채점은 같은 집의 /grade/ 다.
const BK_DOW = ['일', '월', '화', '수', '목', '금', '토'];

function bkParts(iso) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}
function bkPad(n) { return (n < 10 ? '0' : '') + n; }
function bkHM(p) { return bkPad(p.h) + ':' + bkPad(p.mi); }
function bkDayKey(p) { return p.y + '-' + bkPad(p.m) + '-' + bkPad(p.d); }
function bkDayLabel(p) { return p.m + '월 ' + p.d + '일 (' + BK_DOW[p.w] + ')'; }
function bkEnd(iso, min) { return bkParts(new Date(new Date(iso).getTime() + min * 60000).toISOString()); }
function bkTodayKey() { return bkDayKey(bkParts(new Date().toISOString())); }
// 'YYYY-MM-DD' + 'HH:MM' (한국 시간) → ISO
function bkIso(day, hm) { return new Date(day + 'T' + hm + ':00+09:00').toISOString(); }
function bkPhone(d) { d = String(d || ''); return d.length === 11 ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : d; }
function bkLinkUrl(token) { return BK_PAGE_URL + '?k=' + token; }
function bkInvite(l) {
  return '[SL PRIME] ' + l.title + '\n'
    + '안녕하세요, SL PRIME ' + l.owner_name + ' 선생님입니다.\n'
    + '아래 링크에서 편하신 상담 시간을 골라 예약해 주세요.\n'
    + bkLinkUrl(l.token);
}
function bkCopy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(() => bkCopyFallback(text));
  bkCopyFallback(text);
  return Promise.resolve();
}
function bkCopyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}
function bkErrText(e) {
  const msg = String((e && e.message) || e);
  // 테이블이 없으면(SQL 미실행) PostgREST 가 "relation ... does not exist" / PGRST205 를 준다
  if (/booking_(links|slots)/.test(msg) && /(exist|schema cache|find)/i.test(msg)) return '상담 예약 DB가 아직 준비되지 않았습니다. 관리자에게 scripts/booking_schema.sql 실행을 요청해 주세요.';
  return msg;
}

// ── 앱 안 확인창 ── window.alert/confirm 대신 쓴다.
// 윈도우 Electron 에서 네이티브 alert/confirm 을 한 번 띄우고 닫으면 그 뒤로 입력칸에 글자가 안 쳐진다
// (창이 키보드 포커스를 잃는 Electron 버그 — 다른 창을 눌렀다 돌아와야 풀린다). 그래서 이 화면은 DOM 으로 직접 그린다.
// bkAsk(문구) → Promise<boolean>. { cancel:false } 면 확인 버튼만(알림), { danger:true } 면 빨간 확인 버튼.
function bkAsk(msg, opt) {
  opt = opt || {};
  return new Promise((resolve) => {
    const dark = !!document.querySelector('[data-root].dark');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.32);font-family:inherit';
    const box = document.createElement('div');
    box.style.cssText = 'width:360px;max-width:86vw;border-radius:18px;padding:22px 22px 16px;box-shadow:0 24px 70px rgba(0,0,0,0.3);'
      + (dark ? 'background:#26282e;color:#ececed' : 'background:#fff;color:#1d1d1f');
    const text = document.createElement('div');
    text.style.cssText = 'font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:keep-all';
    text.textContent = msg;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:18px';
    const mk = (label, primary) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'border:none;cursor:pointer;font:inherit;font-size:13px;font-weight:600;padding:8px 16px;border-radius:9999px;'
        + (primary ? 'color:#fff;background:' + (opt.danger ? '#e03131' : '#0066cc') : (dark ? 'color:#ececed;background:rgba(255,255,255,0.1)' : 'color:#1d1d1f;background:rgba(0,0,0,0.06)'));
      return b;
    };
    const done = (v) => { document.removeEventListener('keydown', onKey, true); wrap.remove(); resolve(v); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done(opt.cancel === false); }
      else if (e.key === 'Enter') { e.preventDefault(); done(true); }
    };
    if (opt.cancel !== false) { const c = mk(opt.cancelText || '취소', false); c.onclick = () => done(false); row.appendChild(c); }
    const ok = mk(opt.okText || '확인', true); ok.onclick = () => done(true); row.appendChild(ok);
    box.appendChild(text); box.appendChild(row); wrap.appendChild(box);
    wrap.onclick = (e) => { if (e.target === wrap) done(opt.cancel === false); };
    document.body.appendChild(wrap);
    document.addEventListener('keydown', onKey, true);
    ok.focus();
  });
}
function bkAlert(msg) { return bkAsk(msg, { cancel: false }); }

/** 홈 브리핑용: 오늘 내 상담 일정 문장 목록. 테이블이 없거나 실패하면 빈 배열. */
async function bkTodayBrief(userName) {
  const t = bkTodayKey();
  const from = bkIso(t, '00:00');
  const to = new Date(new Date(from).getTime() + 24 * 3600000).toISOString();
  const { data, error } = await SB.from('booking_slots')
    .select('starts_at,minutes,parent_name,student_name,booking_links!inner(owner_name)')
    .not('booked_at', 'is', null).gte('starts_at', from).lt('starts_at', to)
    .eq('booking_links.owner_name', userName).order('starts_at');
  if (error || !data) return [];
  return data.map((s) => bkHM(bkParts(s.starts_at)) + ' 상담 — ' + s.student_name + ' 학부모(' + s.parent_name + ')');
}

function BookingApp({ dark, userName, onHome }) {
  const T = THEME(dark);
  const PC = '#0066cc';
  const [tab, setTab] = useState('schedule');     // 'schedule' | 'links'
  const [links, setLinks] = useState(null);       // null = 로딩
  const [err, setErr] = useState('');
  const [myId, setMyId] = useState(null);
  const [scope, setScope] = useState('mine');     // 일정: 'mine' | 'all'
  const [showFree, setShowFree] = useState(false);
  const [day, setDay] = useState(bkTodayKey());   // 일정 탭: 보고 있는 날짜(YYYY-MM-DD, 한국 시간)
  const [selId, setSelId] = useState(null);       // 링크 탭: 선택한 링크 id | 'new'
  const [toast, setToast] = useState('');

  const load = () => {
    setErr('');
    return SB.from('booking_links')
      .select('id,token,owner_id,owner_name,title,place,note,active,created_at,booking_slots(id,starts_at,minutes,parent_name,student_name,phone,memo,booked_at)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { setErr(bkErrText(error)); setLinks([]); return; }
        (data || []).forEach((l) => { l.booking_slots.sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1)); });
        setLinks(data || []);
      });
  };
  useEffect(() => {
    SB.auth.getSession().then(({ data }) => setMyId(data.session && data.session.user.id));
    load();
    // 학부모가 폰에서 예약하면 30초 안에 보이게
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 1800); };
  const mine = (l) => l.owner_id === myId;
  const myLinks = (links || []).filter(mine);

  // ── 공통 스타일 ──
  const panel = { borderRadius: '18px', background: T.panel, WebkitBackdropFilter: 'saturate(180%) blur(24px)', backdropFilter: 'saturate(180%) blur(24px)', border: '1px solid ' + T.panelBorder };
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: '10px', border: '1px solid ' + T.divider, background: dark ? 'rgba(255,255,255,0.06)' : '#fff', color: T.text, fontFamily: 'inherit', fontSize: '13.5px', outline: 'none' };
  const btn = (kind) => ({
    border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, padding: '8px 14px', borderRadius: '9999px',
    background: kind === 'primary' ? PC : kind === 'danger' ? 'rgba(224,49,49,0.1)' : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
    color: kind === 'primary' ? '#fff' : kind === 'danger' ? '#e03131' : T.text,
  });
  const lbl = { fontSize: '12px', fontWeight: 700, color: T.textFaint, margin: '12px 2px 6px' };

  // ── 예약 취소(학원 쪽) ──
  const cancelSlot = async (s) => {
    if (!(await bkAsk(bkDayLabel(bkParts(s.starts_at)) + ' ' + bkHM(bkParts(s.starts_at)) + ' ' + s.student_name + ' 학부모 상담 예약을 취소할까요?\n(학부모에게는 따로 연락해 주세요)', { okText: '예약 취소', cancelText: '닫기', danger: true }))) return;
    const { error } = await SB.from('booking_slots').update({ parent_name: null, student_name: null, phone: null, memo: null, booked_at: null, cancel_token: null }).eq('id', s.id);
    if (error) { bkAlert('취소하지 못했습니다: ' + bkErrText(error)); return; }
    flash('예약을 취소했습니다'); load();
  };

  // ════════════════ 일정 탭 (하루 단위 표) ════════════════
  const renderSchedule = () => {
    const today = bkTodayKey();
    const p = bkParts(bkIso(day, '12:00'));
    const shift = (n) => setDay(bkDayKey(bkParts(new Date(new Date(bkIso(day, '12:00')).getTime() + n * 86400000).toISOString())));
    const rows = [];
    (links || []).forEach((l) => {
      if (scope === 'mine' && l.owner_name !== userName) return;   // 내 일정 = 내가 담당 선생님인 상담(누가 만들었든)
      l.booking_slots.forEach((s) => {
        if (!s.booked_at && !showFree) return;
        if (bkDayKey(bkParts(s.starts_at)) === day) rows.push({ s, l });
      });
    });
    rows.sort((a, b) => (a.s.starts_at < b.s.starts_at ? -1 : 1));
    const booked = rows.filter((x) => x.s.booked_at).length;
    const th = { textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: T.textFaint, borderBottom: '1px solid ' + T.divider, whiteSpace: 'nowrap' };
    const td = { padding: '11px 12px', fontSize: '13.5px', borderBottom: '1px solid ' + T.divider, verticalAlign: 'top' };

    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '16px 20px 20px' }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button style={btn()} onClick={() => shift(-1)}>‹</button>
          <div style={{ fontSize: '19px', fontWeight: 700, minWidth: '170px', textAlign: 'center', color: p.w === 0 ? '#d70015' : p.w === 6 ? PC : T.text }}>{bkDayLabel(p)}</div>
          <button style={btn()} onClick={() => shift(1)}>›</button>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} style={Object.assign({}, inp, { width: '150px' })} />
          {day !== today && <button style={btn()} onClick={() => setDay(today)}>오늘</button>}
          <span style={{ fontSize: '13.5px', color: T.textDim, marginLeft: '6px' }}>예약 <b style={{ color: T.text }}>{booked}</b>건</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: T.textDim, cursor: 'pointer', marginRight: '6px' }}>
              <input type="checkbox" checked={showFree} onChange={(e) => setShowFree(e.target.checked)} /> 빈 시간도 보기
            </label>
            {[['mine', '내 일정'], ['all', '전체']].map(([k, t]) => (
              <button key={k} style={{ flex: 'none', padding: '6px 14px', whiteSpace: 'nowrap' }} className="sel-chip" data-sel={scope === k ? 'true' : 'false'} onClick={() => setScope(k)}><span className="lbl">{t}</span></button>
            ))}
          </div>
        </div>
        <div style={Object.assign({}, panel, { flex: 1, minHeight: 0, overflow: 'auto', padding: '4px 8px' })}>
          {!rows.length ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: T.textFaint, fontSize: '14px' }}>이 날은 {showFree ? '열린 시간이' : '예약이'} 없습니다</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>시간</th><th style={th}>학생</th><th style={th}>학부모</th><th style={th}>연락처</th>
                  <th style={th}>상담</th>{scope === 'all' && <th style={th}>선생님</th>}<th style={th}>상담 내용</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, l }) => {
                  const st = bkParts(s.starts_at), en = bkEnd(s.starts_at, s.minutes);
                  const time = <td style={Object.assign({}, td, { fontWeight: 700, whiteSpace: 'nowrap', color: s.booked_at ? PC : T.textFaint })}>{bkHM(st)}–{bkHM(en)}</td>;
                  if (!s.booked_at) return (
                    <tr key={s.id}>{time}<td style={Object.assign({}, td, { color: T.textFaint })} colSpan={3}>빈 시간</td>
                      <td style={Object.assign({}, td, { color: T.textFaint })}>{l.title}</td>{scope === 'all' && <td style={Object.assign({}, td, { color: T.textFaint })}>{l.owner_name}</td>}<td style={td}></td><td style={td}></td></tr>
                  );
                  return (
                    <tr key={s.id}>
                      {time}
                      <td style={Object.assign({}, td, { fontWeight: 600, whiteSpace: 'nowrap' })}>{s.student_name}</td>
                      <td style={Object.assign({}, td, { whiteSpace: 'nowrap' })}>{s.parent_name}</td>
                      <td style={Object.assign({}, td, { whiteSpace: 'nowrap' })}>{bkPhone(s.phone)}</td>
                      <td style={Object.assign({}, td, { color: T.textDim })}>{l.title}</td>
                      {scope === 'all' && <td style={Object.assign({}, td, { whiteSpace: 'nowrap', color: T.textDim })}>{l.owner_name}</td>}
                      <td style={Object.assign({}, td, { whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '360px', color: s.memo ? T.text : T.textFaint })}>{s.memo || '—'}</td>
                      <td style={Object.assign({}, td, { textAlign: 'right' })}>{mine(l) && <button onClick={() => cancelSlot(s)} style={Object.assign(btn('danger'), { padding: '5px 11px', fontSize: '12px' })}>취소</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // ════════════════ 링크 탭 ════════════════
  const sel = selId === 'new' ? null : (links || []).find((l) => l.id === selId) || null;

  const renderLinks = () => (
    <div data-mstack="" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <aside data-mpane="" style={Object.assign({}, panel, { flex: 'none', width: '280px', margin: '16px 0 16px 16px', padding: '12px', display: 'flex', flexDirection: 'column', minHeight: 0 })}>
        <button style={Object.assign(btn('primary'), { marginBottom: '10px' })} onClick={() => setSelId('new')}>+ 새 상담 링크</button>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {!myLinks.length && <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: '12.5px', color: T.textFaint, lineHeight: 1.6 }}>아직 만든 링크가 없습니다.<br />새 상담 링크를 만들어 보세요.</div>}
          {myLinks.map((l) => {
            const fut = l.booking_slots.filter((s) => new Date(s.starts_at) > new Date());
            const booked = fut.filter((s) => s.booked_at).length;
            const on = l.id === selId;
            return (
              <button key={l.id} onClick={() => setSelId(l.id)} style={{ textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 12px', borderRadius: '12px', background: on ? (dark ? 'rgba(0,102,204,0.25)' : 'rgba(0,102,204,0.1)') : 'transparent', color: T.text }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                  {!l.active && <span style={{ flex: 'none', fontSize: '11px', color: T.textFaint, fontWeight: 500 }}>마감</span>}
                </div>
                <div style={{ fontSize: '12px', color: T.textDim, marginTop: '2px' }}>예약 {booked} / {fut.length}칸</div>
              </button>
            );
          })}
        </div>
      </aside>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '16px 20px 24px' }}>
        {selId === 'new' && <BkLinkForm T={T} dark={dark} inp={inp} btn={btn} lbl={lbl} panel={panel} userName={userName}
          onSaved={(id, n) => { load().then(() => setSelId(id)); flash(n ? '링크를 만들고 ' + n + '칸을 열었습니다 — 안내문을 복사해 보내세요' : '링크를 만들었습니다 — 이제 시간칸을 여세요'); }} onCancel={() => setSelId(null)} />}
        {sel && <BkLinkDetail key={sel.id} link={sel} T={T} dark={dark} inp={inp} btn={btn} lbl={lbl} panel={panel} PC={PC}
          reload={load} flash={flash} cancelSlot={cancelSlot} onDeleted={() => { setSelId(null); load(); }} />}
        {!selId && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: T.textFaint, fontSize: '13.5px', lineHeight: 1.8 }}>
            ① 새 상담 링크를 만들고 ② 상담 가능한 시간칸을 연 뒤<br />③ <b>안내문 복사</b>를 눌러 카카오톡·문자로 학부모님께 보내세요.<br />학부모님이 폰에서 시간을 고르면 <b>일정</b> 탭과 홈 브리핑에 바로 뜹니다.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div data-root="" className={dark ? 'dark' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Segoe UI', sans-serif", color: T.text }}>
      <nav style={{ position: 'relative', zIndex: 3, flex: 'none', height: '52px', display: 'flex', alignItems: 'center', gap: '18px', padding: '0 24px', background: T.navBg, WebkitBackdropFilter: 'saturate(180%) blur(20px)', backdropFilter: 'saturate(180%) blur(20px)', borderBottom: '1px solid ' + T.navBorder }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="nav-brand" style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px' }}>SL PRIME</span>
          <span style={{ fontSize: '14px', color: T.textDim, whiteSpace: 'nowrap' }}>상담 일정</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['schedule', '일정'], ['links', '예약 링크']].map(([k, t]) => (
            <button key={k} style={{ flex: 'none', padding: '6px 14px', whiteSpace: 'nowrap' }} className="sel-chip" data-sel={tab === k ? 'true' : 'false'} onClick={() => setTab(k)}><span className="lbl">{t}</span></button>
          ))}
        </div>
        <button onClick={onHome} style={{ marginLeft: 'auto', border: 'none', cursor: 'pointer', background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', fontSize: '13px', color: T.text, fontFamily: 'inherit', padding: '6px 12px', borderRadius: '9999px' }}>‹ 홈</button>
      </nav>
      {err && <div style={{ margin: '14px 20px 0', padding: '12px 14px', borderRadius: '10px', background: 'rgba(224,49,49,0.10)', border: '1px solid rgba(224,49,49,0.35)', fontSize: '13px', color: '#e03131' }}>{err}</div>}
      {links === null
        ? <div style={{ padding: '60px', textAlign: 'center', color: T.textFaint, fontSize: '13.5px' }}>불러오는 중…</div>
        : tab === 'schedule' ? renderSchedule() : renderLinks()}
      {toast && <div style={{ position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: '9999px', background: 'rgba(29,29,31,0.88)', color: '#fff', fontSize: '13px', zIndex: 50 }}>{toast}</div>}
    </div>
  );
}

// 담당 선생님 — 직원 이름 목록에서 고르거나 직접 입력(외부 강사 등)
function BkTeacherInput({ style, value, onChange }) {
  return (
    <React.Fragment>
      <input style={style} list="bk-teachers" value={value} onChange={(e) => onChange(e.target.value)} placeholder="이름을 고르거나 입력" />
      <datalist id="bk-teachers">{Object.keys(NAME_TO_EMAIL).filter((n) => n !== 'LUCY').map((n) => <option key={n} value={n} />)}</datalist>
    </React.Fragment>
  );
}

// 새 링크 만들기
function BkLinkForm({ T, dark, inp, btn, lbl, panel, userName, onSaved, onCancel }) {
  const [title, setTitle] = useState('');
  const [teacher, setTeacher] = useState(userName);
  const [place, setPlace] = useState('SL PRIME 상담실');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([bkNewRow()]);
  const [busy, setBusy] = useState(false);
  const { plan } = bkPlan(rows, new Set());
  // 링크와 시간칸을 한 번에 만든다(시간칸은 비워 두고 나중에 열어도 된다)
  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const { data, error } = await SB.from('booking_links').insert({ owner_name: teacher.trim() || userName, title: title.trim(), place: place.trim(), note: note.trim() }).select('id').single();
    if (error) { setBusy(false); bkAlert('만들지 못했습니다: ' + bkErrText(error)); return; }
    if (plan.length) {
      const r = await SB.from('booking_slots').insert(plan.map((x) => ({ link_id: data.id, starts_at: x.iso, minutes: x.min })));
      if (r.error) bkAlert('링크는 만들었지만 시간칸을 열지 못했습니다: ' + bkErrText(r.error) + '\n링크 화면에서 다시 열어 주세요.');
    }
    setBusy(false);
    onSaved(data.id, plan.length);
  };
  return (
    <div style={Object.assign({}, panel, { padding: '18px', maxWidth: '640px' })}>
      <div style={{ fontSize: '17px', fontWeight: 700 }}>새 상담 링크</div>
      <div style={lbl}>제목 (학부모님께 보입니다)</div>
      <input style={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 10월 중간고사 대비 학부모 상담" autoFocus />
      <div style={lbl}>선생님 (학부모님께 "OOO 선생님"으로 보입니다)</div>
      <BkTeacherInput style={inp} value={teacher} onChange={setTeacher} />
      <div style={lbl}>장소</div>
      <input style={inp} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="예: SL PRIME 3층 상담실 / 전화 상담" />
      <div style={lbl}>안내 문구 (선택)</div>
      <textarea style={Object.assign({}, inp, { minHeight: '80px', resize: 'vertical' })} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 상담은 약 20분 진행됩니다. 궁금하신 점을 적어 주시면 미리 준비하겠습니다." />
      <div style={Object.assign({}, lbl, { marginTop: '18px', fontSize: '13px', color: T.text })}>시간칸 <span style={{ fontWeight: 500, color: T.textFaint }}>(나중에 열어도 됩니다)</span></div>
      <BkSlotPlanner rows={rows} setRows={setRows} existingSlots={[]} T={T} dark={dark} inp={inp} lbl={lbl} btn={btn} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button style={btn('primary')} disabled={busy || !title.trim()} onClick={save}>{busy ? '만드는 중…' : plan.length ? '만들기 · ' + plan.length + '칸 열기' : '만들기'}</button>
        <button style={btn()} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

// 24시간제 시각 선택 — <input type="time"> 은 윈도우 지역 설정을 따라 '오전/오후'로 나와서 쓰지 않는다
const BK_HOURS = Array.from({ length: 24 }, (_, i) => bkPad(i));
const BK_MINS = Array.from({ length: 12 }, (_, i) => bkPad(i * 5));
function BkTimePick({ value, onChange, inp, allow24 }) {
  const [h, m] = (value || '00:00').split(':');
  const sel = Object.assign({}, inp, { width: '68px', padding: '9px 6px' });
  const hours = allow24 ? BK_HOURS.concat(['24']) : BK_HOURS;   // 끝 시각은 24:00(자정)까지
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <select style={sel} value={h} onChange={(e) => onChange(e.target.value + ':' + (e.target.value === '24' ? '00' : m))}>{hours.map((x) => <option key={x} value={x}>{x}시</option>)}</select>
      <select style={sel} value={m} disabled={h === '24'} onChange={(e) => onChange(h + ':' + e.target.value)}>{BK_MINS.map((x) => <option key={x} value={x}>{x}분</option>)}</select>
    </div>
  );
}

// ── 시간칸 계획: 여러 날짜를 한 번에 ──
// 날짜 줄마다 두 가지 방식:
//   auto   — 시작~끝을 '한 칸' 길이로 똑같이 자른다
//   custom — 사용자설정. 10분 단위 표에서 칸을 하나씩 직접 만든다(10~11시 · 11~11:20 · 11:20~12시 같은 변칙 시간)
// 칸 길이가 제각각이어도 booking_slots.minutes 가 칸마다 따로라 DB 는 그대로다.
const BK_GRID_FROM = 0, BK_GRID_TO = 24;   // 사용자설정 표: 하루 전체 00:00 ~ 24:00, 10분 단위
const BK_GRID_SCROLL_TO = 8;               // 처음 열 때 이 시각 줄이 맨 위에 오게 스크롤
function bkMinToHM(m) { return bkPad(Math.floor(m / 60)) + ':' + bkPad(m % 60); }
function bkHMToMin(hm) { const [h, m] = hm.split(':'); return Number(h) * 60 + Number(m); }
function bkNewRow(prev) {
  if (!prev) return { day: bkTodayKey(), mode: 'auto', from: '00:00', to: '00:00', gap: 30, blocks: [] };
  // 다음 날짜 · 같은 설정으로 채워 둔다(보통 며칠 연속 같은 시간대로 연다)
  const next = bkDayKey(bkParts(new Date(new Date(bkIso(prev.day, '12:00')).getTime() + 86400000).toISOString()));
  return Object.assign({}, prev, { day: next, blocks: prev.blocks.slice() });
}
/** rows → 열 칸 목록 [{ iso, min }]. existing = 이미 열린 칸의 시작 시각(ms) Set */
function bkPlan(rows, existing) {
  const plan = [], seen = new Set();
  let pastSkipped = 0;   // 오늘 날짜면 이미 지난 칸은 못 연다 — 조용히 빼면 '시간이 밀렸다'로 보이므로 개수를 알려 준다
  const push = (t, min) => {
    if (existing.has(t) || seen.has(t)) return;
    if (t <= Date.now()) { pastSkipped++; return; }
    seen.add(t); plan.push({ iso: new Date(t).toISOString(), min });
  };
  rows.forEach((r) => {
    if (!r.day) return;
    const d0 = new Date(bkIso(r.day, '00:00')).getTime();
    if (r.mode === 'custom') {
      r.blocks.forEach((b) => push(d0 + b.s * 60000, b.e - b.s));
      return;
    }
    if (!(r.gap > 0)) return;
    const a = d0 + bkHMToMin(r.from) * 60000, z = d0 + bkHMToMin(r.to) * 60000;
    for (let t = a; t + r.gap * 60000 <= z && plan.length < 300; t += r.gap * 60000) push(t, r.gap);
  });
  plan.sort((x, y) => (x.iso < y.iso ? -1 : 1));
  return { plan, pastSkipped };
}

// 사용자설정 표: 시작 칸을 누르고 → 끝 칸을 누르면 그 사이가 한 타임이 된다. 만든 타임을 누르면 지워진다.
function BkCustomGrid({ row, onBlocks, busyRanges, T, dark }) {
  const [pick, setPick] = useState(null);   // 시작으로 고른 칸(분)
  const boxRef = useRef(null);
  useEffect(() => {
    const box = boxRef.current, tr = box && box.querySelector('tr[data-h="' + BK_GRID_SCROLL_TO + '"]');
    if (box && tr) box.scrollTop = tr.offsetTop - 28;   // 28 = 머리줄 높이
  }, []);
  const blocks = row.blocks;
  const blockAt = (m) => blocks.find((b) => m >= b.s && m < b.e);
  const busyAt = (m) => busyRanges.some((r) => m >= r.s && m < r.e);
  const click = (m) => {
    const hit = blockAt(m);
    if (hit) { onBlocks(blocks.filter((b) => b !== hit)); setPick(null); return; }
    if (busyAt(m)) return;
    if (pick === null) { setPick(m); return; }
    const s = Math.min(pick, m), e = Math.max(pick, m) + 10;
    for (let x = s; x < e; x += 10) {
      if (blockAt(x) || busyAt(x)) { bkAlert('이미 만든 타임이나 열려 있는 칸과 겹칩니다.'); setPick(null); return; }
    }
    if (e - s > 240) { bkAlert('한 타임은 4시간까지 만들 수 있습니다.'); setPick(null); return; }
    onBlocks(blocks.concat([{ s, e }]).sort((x, y) => x.s - y.s));
    setPick(null);
  };
  const PC = '#0066cc';
  const tones = dark ? ['rgba(10,132,255,0.45)', 'rgba(10,132,255,0.28)'] : ['rgba(0,102,204,0.28)', 'rgba(0,102,204,0.14)'];
  const hours = [];
  for (let h = BK_GRID_FROM; h < BK_GRID_TO; h++) hours.push(h);
  const cell = { height: '26px', border: '1px solid ' + T.divider, cursor: 'pointer', fontSize: '10.5px', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'visible', position: 'relative' };
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '12.5px', color: pick === null ? T.textDim : PC, margin: '0 2px 6px', fontWeight: pick === null ? 400 : 600 }}>
        {pick === null ? '시작 칸을 누르고 → 끝 칸을 누르면 한 타임이 만들어집니다. 만든 타임을 누르면 지워집니다.' : bkMinToHM(pick) + ' 부터 — 이제 끝 칸을 누르세요 (같은 칸을 누르면 10분짜리)'}
      </div>
      <div ref={boxRef} style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid ' + T.divider, borderRadius: '10px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '46px', fontSize: '11px', color: T.textFaint, fontWeight: 600, padding: '4px', position: 'sticky', top: 0, background: dark ? '#26282e' : '#fff' }}></th>
              {[0, 10, 20, 30, 40, 50].map((m) => <th key={m} style={{ fontSize: '11px', color: T.textFaint, fontWeight: 600, padding: '4px', position: 'sticky', top: 0, background: dark ? '#26282e' : '#fff' }}>{bkPad(m)}분</th>)}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h} data-h={h}>
                <td style={{ fontSize: '11.5px', fontWeight: 700, color: T.textDim, textAlign: 'center', borderTop: '1px solid ' + T.divider }}>{bkPad(h)}시</td>
                {[0, 10, 20, 30, 40, 50].map((mm) => {
                  const m = h * 60 + mm;
                  const b = blockAt(m), busy = !b && busyAt(m), isPick = pick === m;
                  const idx = b ? blocks.indexOf(b) : -1;
                  const bg = b ? tones[idx % 2] : busy ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : isPick ? PC : 'transparent';
                  return (
                    <td key={mm} onClick={() => click(m)} title={b ? bkMinToHM(b.s) + '~' + bkMinToHM(b.e) + ' (누르면 삭제)' : busy ? '이미 열린 칸' : bkMinToHM(m)}
                      style={Object.assign({}, cell, { background: bg, cursor: busy ? 'not-allowed' : 'pointer', color: isPick ? '#fff' : b ? T.text : T.textFaint })}>
                      {b && b.s === m ? <b>{bkMinToHM(b.s)}~{bkMinToHM(b.e)}</b> : busy && !busyAt(m - 10) ? '열림' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BkSlotPlanner({ rows, setRows, existingSlots, T, dark, inp, lbl, btn }) {
  const existing = new Set(existingSlots.map((x) => new Date(x.starts_at).getTime()));
  const { plan, pastSkipped } = bkPlan(rows, existing);
  const upd = (i, patch) => setRows(rows.map((r, j) => (j === i ? Object.assign({}, r, patch) : r)));
  // 그 날짜에 이미 열린 칸(분 범위) — 사용자설정 표에서 회색으로 막는다
  const busyOf = (day) => existingSlots.filter((x) => bkDayKey(bkParts(x.starts_at)) === day).map((x) => {
    const p = bkParts(x.starts_at), s0 = p.h * 60 + p.mi;
    return { s: s0, e: s0 + x.minutes };
  });
  const byDay = {};
  plan.forEach((x) => {
    const k = bkDayLabel(bkParts(x.iso));
    const p = bkParts(x.iso), s0 = p.h * 60 + p.mi;
    (byDay[k] = byDay[k] || []).push(bkMinToHM(s0) + '~' + bkMinToHM(s0 + x.min));
  });
  const seg = (on) => ({ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, padding: '7px 12px', background: on ? '#0066cc' : 'transparent', color: on ? '#fff' : T.textDim });
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid ' + T.divider }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" style={Object.assign({}, inp, { width: '150px' })} value={r.day} min={bkTodayKey()} onChange={(e) => upd(i, { day: e.target.value })} />
              <div style={{ display: 'flex', borderRadius: '9999px', overflow: 'hidden', border: '1px solid ' + T.divider }}>
                <button style={seg(r.mode === 'auto')} onClick={() => upd(i, { mode: 'auto' })}>일정 간격</button>
                <button style={seg(r.mode === 'custom')} onClick={() => upd(i, { mode: 'custom' })}>사용자설정</button>
              </div>
              {r.mode === 'custom' && <span style={{ fontSize: '12.5px', color: T.textDim }}>{r.blocks.length}타임</span>}
              {rows.length > 1 && <button title="이 날짜 빼기" onClick={() => setRows(rows.filter((_, j) => j !== i))} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: T.textFaint, fontSize: '16px', padding: '0 4px' }}>×</button>}
            </div>
            {r.mode === 'auto' ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: T.textFaint }}>시작</span>
                <BkTimePick value={r.from} onChange={(v) => upd(i, { from: v })} inp={inp} />
                <span style={{ color: T.textFaint }}>~</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: T.textFaint }}>끝</span>
                <BkTimePick value={r.to} onChange={(v) => upd(i, { to: v })} inp={inp} allow24 />
                <span style={{ fontSize: '12px', fontWeight: 700, color: T.textFaint, marginLeft: '6px' }}>한 칸</span>
                <select style={Object.assign({}, inp, { width: '90px' })} value={r.gap} onChange={(e) => upd(i, { gap: Number(e.target.value) })}>
                  {[10, 15, 20, 30, 40, 50, 60, 90, 120].map((m) => <option key={m} value={m}>{m}분</option>)}
                </select>
              </div>
            ) : (
              <BkCustomGrid row={r} onBlocks={(bl) => upd(i, { blocks: bl })} busyRanges={busyOf(r.day)} T={T} dark={dark} />
            )}
          </div>
        ))}
      </div>
      <button style={Object.assign(btn(), { marginTop: '8px' })} onClick={() => setRows(rows.concat([bkNewRow(rows[rows.length - 1])]))}>+ 날짜 추가</button>
      {plan.length > 0 && (
        <div style={{ fontSize: '12.5px', color: T.textFaint, marginTop: '10px', lineHeight: 1.7 }}>
          {Object.keys(byDay).map((k) => <div key={k}><b style={{ color: T.textDim }}>{k}</b> {byDay[k].join(' · ')}</div>)}
        </div>
      )}
      {pastSkipped > 0 && <div style={{ fontSize: '12.5px', color: '#e03131', marginTop: '6px' }}>이미 지난 시간 {pastSkipped}칸은 열 수 없어 뺐습니다. 다른 날짜를 고르세요.</div>}
    </div>
  );
}

// ── 엑셀 내보내기: 링크 하나의 시간표 ──
// 날짜마다 [시간 | 학생 이름] 두 칸, 줄은 시간대. 열린 칸은 흰색(예약자 이름), 안 연 칸은 짙은 회색.
// 라이브러리 없이 진짜 .xlsx(OOXML)를 만든다 — xlsx 는 zip 이라 삽화의 무압축 zip(illZipStore)을 그대로 쓴다.
function bkXml(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function bkColName(i) { let n = '', x = i + 1; while (x > 0) { const r = (x - 1) % 26; n = String.fromCharCode(65 + r) + n; x = Math.floor((x - 1) / 26); } return n; }
function bkSlotRange(sl) { const p = bkParts(sl.starts_at), a = p.h * 60 + p.mi; return { s: a, e: a + sl.minutes }; }

/** 시간 줄 만들기: 칸 길이가 전부 같고 줄이 맞으면 처음~끝을 그 간격으로 빈틈없이(안 연 시간은 회색 줄),
 *  길이가 제각각(사용자설정)이면 실제 있는 시간대만 모아서. */
function bkExcelRows(slots) {
  const rs = slots.map(bkSlotRange);
  const lens = new Set(rs.map((r) => r.e - r.s));
  if (lens.size === 1) {
    const L = rs[0].e - rs[0].s, s0 = Math.min.apply(null, rs.map((r) => r.s)), e0 = Math.max.apply(null, rs.map((r) => r.e));
    if (rs.every((r) => (r.s - s0) % L === 0)) {
      const out = [];
      for (let t = s0; t + L <= e0; t += L) out.push({ s: t, e: t + L });
      return out;
    }
  }
  const seen = {}, out = [];
  rs.forEach((r) => { const k = r.s + '-' + r.e; if (!seen[k]) { seen[k] = 1; out.push(r); } });
  return out.sort((a, b) => a.s - b.s || a.e - b.e);
}

function bkExportXlsx(link) {
  const slots = link.booking_slots;
  if (!slots.length) { bkAlert('열린 시간칸이 없습니다.'); return; }
  const dayMap = {};
  slots.forEach((sl) => { const k = bkDayKey(bkParts(sl.starts_at)); (dayMap[k] = dayMap[k] || []).push(sl); });
  const days = Object.keys(dayMap).sort();
  const rows = bkExcelRows(slots);
  const label = (r) => bkMinToHM(r.s) + '-' + bkMinToHM(r.e);
  const dayTitle = (k) => { const p = bkParts(bkIso(k, '12:00')); return p.y + '. ' + p.m + '. ' + p.d + ' (' + BK_DOW[p.w] + ')'; };
  const cell = (ref, text, style) => '<c r="' + ref + '" t="inlineStr" s="' + style + '"><is><t>' + bkXml(text) + '</t></is></c>';

  // 스타일: 1=날짜 머리(굵게·연파랑) 2=열린 칸 3=안 연 칸(짙은 회색)
  let sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="24" customHeight="1"/><cols><col min="1" max="' + days.length * 2 + '" width="16" customWidth="1"/></cols><sheetData>';
  sheet += '<row r="1" ht="32" customHeight="1">' + days.map((k, i) => cell(bkColName(i * 2) + '1', dayTitle(k), 1) + cell(bkColName(i * 2 + 1) + '1', '', 1)).join('') + '</row>';
  rows.forEach((r, ri) => {
    const rn = ri + 2;
    sheet += '<row r="' + rn + '" ht="24" customHeight="1">' + days.map((k, i) => {
      const hit = dayMap[k].find((sl) => { const x = bkSlotRange(sl); return x.s === r.s && x.e === r.e; });
      const st = hit ? 2 : 3;
      return cell(bkColName(i * 2) + rn, label(r), st) + cell(bkColName(i * 2 + 1) + rn, hit && hit.booked_at ? hit.student_name : '', st);
    }).join('') + '</row>';
  });
  sheet += '</sheetData><mergeCells count="' + days.length + '">' + days.map((k, i) => '<mergeCell ref="' + bkColName(i * 2) + '1:' + bkColName(i * 2 + 1) + '1"/>').join('') + '</mergeCells>'
    + '<pageSetup orientation="landscape" paperSize="9"/></worksheet>';

  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="3"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="14"/><name val="맑은 고딕"/></font><font><sz val="11"/><color rgb="FF1A1A1A"/><name val="맑은 고딕"/></font></fonts>'
    + '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FFC9DAF8"/><bgColor indexed="64"/></patternFill></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FF474747"/><bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
    + '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
    + '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
    + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const sheetName = (link.title.replace(/[\[\]:*?\/\\]/g, ' ').trim() || '상담 일정').slice(0, 31);
  const enc = new TextEncoder();
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + bkXml(sheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', styles],
    ['xl/worksheets/sheet1.xml', sheet],
  ].map(([name, xml]) => ({ name, bytes: enc.encode(xml) }));
  const blob = new Blob([illZipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (link.title.replace(/[\\/:*?"<>|]/g, '').trim() || '상담') + ' 일정.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// 링크 상세: 공유 · 정보 수정 · 시간칸 열기 · 시간칸 목록
function BkLinkDetail({ link, T, dark, inp, btn, lbl, panel, PC, reload, flash, cancelSlot, onDeleted }) {
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(link.title);
  const [teacher, setTeacher] = useState(link.owner_name);
  const [place, setPlace] = useState(link.place);
  const [note, setNote] = useState(link.note);
  const [rows, setRows] = useState([bkNewRow()]);
  const [busy, setBusy] = useState(false);

  // 추가할 시간칸 미리 계산 (이미 있는 시각은 건너뜀)
  const existing = new Set(link.booking_slots.map((s) => new Date(s.starts_at).getTime()));
  const { plan } = bkPlan(rows, existing);
  const addSlots = async () => {
    if (!plan.length) return;
    setBusy(true);
    const { error } = await SB.from('booking_slots').insert(plan.map((x) => ({ link_id: link.id, starts_at: x.iso, minutes: x.min })));
    setBusy(false);
    if (error) { bkAlert('시간칸을 열지 못했습니다: ' + bkErrText(error)); return; }
    flash(plan.length + '칸을 열었습니다'); setRows([bkNewRow()]); reload();
  };
  const delSlot = async (s) => {
    const { error } = await SB.from('booking_slots').delete().eq('id', s.id).is('booked_at', null);
    if (error) { bkAlert('지우지 못했습니다: ' + bkErrText(error)); return; }
    reload();
  };
  const saveInfo = async () => {
    const { error } = await SB.from('booking_links').update({ title: title.trim() || link.title, owner_name: teacher.trim() || link.owner_name, place: place.trim(), note: note.trim() }).eq('id', link.id);
    if (error) { bkAlert('저장하지 못했습니다: ' + bkErrText(error)); return; }
    setEdit(false); flash('저장했습니다'); reload();
  };
  const toggleActive = async () => {
    const { error } = await SB.from('booking_links').update({ active: !link.active }).eq('id', link.id);
    if (error) { bkAlert(bkErrText(error)); return; }
    flash(link.active ? '예약을 마감했습니다 (기존 예약은 유지)' : '예약을 다시 받습니다'); reload();
  };
  const del = async () => {
    const n = link.booking_slots.filter((s) => s.booked_at && new Date(s.starts_at) > new Date()).length;
    if (!(await bkAsk('"' + link.title + '" 링크를 삭제할까요?' + (n ? '\n앞으로 잡힌 예약 ' + n + '건도 함께 사라집니다. 학부모님께 따로 연락해 주세요.' : '') + '\n되돌릴 수 없습니다.', { okText: '삭제', danger: true }))) return;
    const { error } = await SB.from('booking_links').delete().eq('id', link.id);
    if (error) { bkAlert('삭제하지 못했습니다: ' + bkErrText(error)); return; }
    onDeleted();
  };

  const now = new Date();
  const fut = link.booking_slots.filter((s) => new Date(s.starts_at).getTime() + s.minutes * 60000 > now.getTime());
  const byDay = [];
  fut.forEach((s) => {
    const k = bkDayKey(bkParts(s.starts_at));
    let g = byDay.find((x) => x.k === k);
    if (!g) { g = { k, p: bkParts(s.starts_at), list: [] }; byDay.push(g); }
    g.list.push(s);
  });
  const url = bkLinkUrl(link.token);
  const card = Object.assign({}, panel, { padding: '16px 18px', marginBottom: '14px' });

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={card}>
        {!edit ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '19px', fontWeight: 700 }}>{link.title} {!link.active && <span style={{ fontSize: '12px', color: '#e03131', fontWeight: 600 }}>· 예약 마감</span>}</div>
              <div style={{ fontSize: '13px', color: T.textDim, marginTop: '3px' }}>{link.owner_name} 선생님{link.place && ' · ' + link.place}</div>
              {link.note && <div style={{ fontSize: '13px', color: T.textDim, marginTop: '8px', whiteSpace: 'pre-wrap' }}>{link.note}</div>}
            </div>
            <div style={{ display: 'flex', gap: '6px', flex: 'none' }}>
              <button style={btn()} onClick={() => setEdit(true)}>수정</button>
              <button style={btn()} onClick={toggleActive}>{link.active ? '예약 마감' : '다시 받기'}</button>
              <button style={btn('danger')} onClick={del}>삭제</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={lbl}>제목</div><input style={inp} value={title} onChange={(e) => setTitle(e.target.value)} />
            <div style={lbl}>선생님</div><BkTeacherInput style={inp} value={teacher} onChange={setTeacher} />
            <div style={lbl}>장소</div><input style={inp} value={place} onChange={(e) => setPlace(e.target.value)} />
            <div style={lbl}>안내 문구</div><textarea style={Object.assign({}, inp, { minHeight: '70px', resize: 'vertical' })} value={note} onChange={(e) => setNote(e.target.value)} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button style={btn('primary')} onClick={saveInfo}>저장</button>
              <button style={btn()} onClick={() => { setEdit(false); setTitle(link.title); setTeacher(link.owner_name); setPlace(link.place); setNote(link.note); }}>취소</button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid ' + T.divider }}>
          <input readOnly value={url} onFocus={(e) => e.target.select()} style={Object.assign({}, inp, { flex: 1, fontSize: '12.5px', color: T.textDim })} />
          <button style={btn()} onClick={() => bkExportXlsx(link)}>엑셀 내보내기</button>
          <button style={btn()} onClick={() => bkCopy(url).then(() => flash('링크를 복사했습니다'))}>링크 복사</button>
          <button style={btn('primary')} onClick={() => bkCopy(bkInvite(link)).then(() => flash('안내문을 복사했습니다 — 카톡·문자에 붙여 넣으세요'))}>안내문 복사</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: '15px', fontWeight: 700 }}>시간칸 열기</div>
        <BkSlotPlanner rows={rows} setRows={setRows} existingSlots={link.booking_slots} T={T} dark={dark} inp={inp} lbl={lbl} btn={btn} />
        <button style={Object.assign(btn('primary'), { marginTop: '12px' })} disabled={busy || !plan.length} onClick={addSlots}>{busy ? '여는 중…' : plan.length ? plan.length + '칸 열기' : '열 칸 없음'}</button>
      </div>

      <div style={card}>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>시간칸 <span style={{ fontSize: '13px', color: T.textDim, fontWeight: 500 }}>예약 {fut.filter((s) => s.booked_at).length} / {fut.length}</span></div>
        {!byDay.length && <div style={{ padding: '16px 2px', fontSize: '13px', color: T.textFaint }}>열린 시간칸이 없습니다. 위에서 시간칸을 열어 주세요.</div>}
        {byDay.map((g) => (
          <div key={g.k} style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: T.textDim, marginBottom: '6px' }}>{bkDayLabel(g.p)}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {g.list.map((s) => s.booked_at ? (
                <div key={s.id} title={(s.memo || '') + ''} style={{ padding: '7px 10px', borderRadius: '10px', background: dark ? 'rgba(0,102,204,0.22)' : 'rgba(0,102,204,0.09)', border: '1px solid ' + (dark ? 'rgba(0,102,204,0.4)' : 'rgba(0,102,204,0.2)'), fontSize: '12.5px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <b style={{ color: PC }}>{bkHM(bkParts(s.starts_at))}~{bkHM(bkEnd(s.starts_at, s.minutes))}</b>
                  <span>{s.student_name} · {s.parent_name} · {bkPhone(s.phone)}</span>
                  <button onClick={() => cancelSlot(s)} title="예약 취소" style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textFaint, fontSize: '12px', padding: '0 0 0 2px' }}>취소</button>
                </div>
              ) : (
                <div key={s.id} style={{ padding: '7px 8px 7px 10px', borderRadius: '10px', border: '1px dashed ' + T.divider, fontSize: '12.5px', display: 'flex', gap: '6px', alignItems: 'center', color: T.textDim }}>
                  {bkHM(bkParts(s.starts_at))}~{bkHM(bkEnd(s.starts_at, s.minutes))}
                  <button onClick={() => delSlot(s)} title="이 칸 닫기" style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textFaint, fontSize: '13px', padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
