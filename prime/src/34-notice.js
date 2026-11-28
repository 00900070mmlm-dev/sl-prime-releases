// ============================================================
// 공지사항 (홈 → 공지사항) — 신UI 전용 · 관리자·강사(+개발자)
//
// 2026-11-25 사장님: 학생·학부모 앱의 ☰ 메뉴 「공지사항」 — "좌측 메뉴에 공지사항도". 여기는 **올리는 쪽**.
//   · **지점(전체 · 원당점 · 이음점)** 을 고르고(같은 날 사장님 — "지점별/전체로 나뉘어야 함, 지점별로 올리면 해당 지점 재원생·학부모한테만") 대상(전체 · 학생 · 학부모) · 제목 · 내용 · 맨 위 고정(첨부 주소 칸은 2026-11-25 사장님 — "첨부주소 자체를 없애" — 뺐다. 표의 link 칸은 남아 있지만 안 쓴다).
//     학생의 지점은 듣는 반 이름으로 서버가 가른다(waBranchOf 와 같은 규칙 — 반 이름이 '이음(' 으로 시작하면 이음점).
//   · 체크박스 셋(같은 날 사장님): **팝업 띄우기**(앱을 켜자마자 뜬다 · 띄울 기간) · **알림 보내기**(올릴 때 푸시 한 번 — 앱이 맡긴 Expo 토큰으로, DB 트리거가 보낸다)
//     · **상단 광고**(홈 맨 위 슬라이드에 들어간다 · 같은 기간). 기간을 비우면 늘 뜬다.
//   · **사진**(같은 날 사장님 — "사진 첨부, 누르면 상품 상세보기처럼 · 팝업 이미지 · 광고 이미지 · 알림 메시지"): 본문 사진 여러 장 · 팝업 그림 · 광고 그림을
//     storage 버킷 'notices'(공개 읽기)에 <공지 id>/<번호>.<확장자> 로 올리고 공개 URL 을 줄에 적는다. 알림 제목·내용도 따로 적을 수 있다(비면 공지 제목·본문).
//   · 올린 목록은 전부 보이고(「내 것만 보기」) 고정이 위. 삭제는 한 줄씩 확인 창.
// 표 · 학생 쪽 RPC 는 scripts/notice_schema.sql. 권한 키 'notice'(01-core.js PERM_GROUPS — 관리자·강사).
// ============================================================

const NT_SCHEMA_HINT = 'Supabase SQL Editor 에서 scripts/notice_schema.sql 을 한 번 실행해야 합니다.';
function ntErrText(e) { const m = String((e && e.message) || e || ''); return /\bnotices\b|does not exist|schema cache/.test(m) ? NT_SCHEMA_HINT : m; }
function ntWhen(iso) { const d = new Date(iso); if (isNaN(d)) return ''; return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
const NT_AUD = [['all', '전체'], ['student', '학생만'], ['parents', '학부모만']];
const NT_BRANCH = [[null, '전체 지점'], ['원당점', '원당점'], ['이음점', '이음점']];

function NoticeApp({ dark, userName }) {
  const K = TT(dark);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [mine, setMine] = useState(false);
  const [branch, setBranch] = useState(null);
  const [aud, setAud] = useState('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [popup, setPopup] = useState(false);
  const [notify, setNotify] = useState(false);
  const [banner, setBanner] = useState(false);
  const [showFrom, setShowFrom] = useState('');
  const [showTo, setShowTo] = useState('');
  const [files, setFiles] = useState([]);          // 본문 사진(File[])
  const [popFile, setPopFile] = useState(null);    // 팝업 그림
  const [banFile, setBanFile] = useState(null);    // 광고 그림
  const [nTitle, setNTitle] = useState('');
  const [nBody, setNBody] = useState('');
  const [prog, setProg] = useState('');
  const pick = (multi, cb) => { const el = document.createElement('input'); el.type = 'file'; el.accept = 'image/*'; el.multiple = !!multi; el.onchange = () => cb(Array.from(el.files || [])); el.click(); };
  const thumb = (f, onX) => <span key={f.name + f.size} style={{ position: 'relative', display: 'inline-block' }}><img alt="" src={URL.createObjectURL(f)} style={{ height: 64, borderRadius: 6, border: '1px solid ' + K.border, display: 'block' }} /><button type="button" onClick={onX} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 'none', background: K.ink, color: K.inkText, fontSize: 11, cursor: 'pointer', lineHeight: '18px', padding: 0 }}>×</button></span>;
  const ext = (f) => { const m = /\.(jpe?g|png|webp|gif)$/i.exec(f.name || ''); return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : (f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : f.type === 'image/gif' ? 'gif' : 'jpg'); };
  const upload = async (id, name, f) => {
    const path = id + '/' + name + '.' + ext(f);
    const { error } = await SB.storage.from('notices').upload(path, f, { upsert: true, contentType: f.type || 'image/jpeg' });
    if (error) throw new Error('사진 올리기 실패 — ' + ntErrText(error));
    return SB.storage.from('notices').getPublicUrl(path).data.publicUrl;
  };
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const btn = (primary) => ({ height: 32, padding: '0 14px', borderRadius: K.rCtl, border: primary ? 'none' : '1px solid ' + K.control, background: primary ? K.ink : 'transparent', color: primary ? K.inkText : K.text, font: 'inherit', fontSize: 13, fontWeight: primary ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: K.ease });
  const inp = { width: '100%', boxSizing: 'border-box', height: 32, border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '0 10px', fontSize: '13.5px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none' };
  const lab = { fontSize: '12px', fontWeight: 500, color: K.muted, margin: '0 0 6px' };

  const load = () => {
    SB.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(2000).then(({ data, error }) => {
      if (error) { setErr(ntErrText(error)); setRows([]); return; }
      setErr(''); setRows(data || []);
    });
  };
  useEffect(load, []);

  const canAdd = !!title.trim() && !busy;
  const add = async () => {
    if (!canAdd) return;
    setBusy(true);
    try {
      const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      const images = [];
      for (let i = 0; i < files.length; i++) { setProg('사진 ' + (i + 1) + '/' + files.length + ' 올리는 중…'); images.push(await upload(id, 'img' + (i + 1), files[i])); }
      let popup_image = null, banner_image = null;
      if (popup && popFile) { setProg('팝업 그림 올리는 중…'); popup_image = await upload(id, 'popup', popFile); }
      if (banner && banFile) { setProg('광고 그림 올리는 중…'); banner_image = await upload(id, 'banner', banFile); }
      setProg('');
      const payload = { id, branch, audience: aud, title: title.trim(), body: body.trim() || null, pinned, owner_name: userName,
        popup, banner, notify, show_from: (popup || banner) && showFrom ? showFrom : null, show_to: (popup || banner) && showTo ? showTo : null,
        images, popup_image, banner_image, notify_title: notify && nTitle.trim() ? nTitle.trim() : null, notify_body: notify && nBody.trim() ? nBody.trim() : null };
      const { error } = await SB.from('notices').insert(payload);
      if (error) throw error;
      setTitle(''); setBody(''); setPinned(false); setPopup(false); setNotify(false); setBanner(false); setShowFrom(''); setShowTo(''); setFiles([]); setPopFile(null); setBanFile(null); setNTitle(''); setNBody('');
      say((branch ? branch + ' 공지로 올렸습니다.' : '전체 지점 공지로 올렸습니다.') + (notify ? ' 알림을 보냈습니다.' : ''));
      load();
    } catch (e) { setProg(''); say(ntErrText(e)); }
    setBusy(false);
  };
  const del = (r) => {
    if (!window.confirm('「' + r.title + '」 (' + (r.branch || '전체 지점') + ') 을 지울까요? 학생·학부모 앱에서 바로 사라집니다.')) return;
    SB.from('notices').delete().eq('id', r.id).then(({ error }) => { if (error) { say(ntErrText(error)); return; } setRows((r0) => (r0 || []).filter((x) => x.id !== r.id)); });
  };
  const togglePin = (r) => {
    SB.from('notices').update({ pinned: !r.pinned }).eq('id', r.id).then(({ error }) => { if (error) { say(ntErrText(error)); return; } load(); });
  };
  // 이미 올린 공지의 팝업·상단 광고를 켜고 끈다(같은 날 사장님 — "팝업도 이미 올린 공지에 대해 켜고 끌 수 있게", "상단 광고도"). 앱은 다음에 읽을 때 반영.
  const toggleFlag = (r, key) => {
    const v = {}; v[key] = !r[key];
    SB.from('notices').update(v).eq('id', r.id).then(({ error }) => { if (error) { say(ntErrText(error)); return; } load(); });
  };
  // 알림 추가 발송(같은 날 사장님 — "이미 올린 공지 알림 추가 발송, 문구는 보낼 때마다 바꿀 수 있게"): 줄의 「알림 보내기」 → 문구 칸이 펼쳐지고 → 보내기(RPC notices_push_send).
  const [sendFor, setSendFor] = useState(null);   // { id, title, body }
  const [sending, setSending] = useState(false);
  const openSend = (r) => setSendFor({ id: r.id, title: r.notify_title || r.title, body: r.notify_body || String(r.body || '').slice(0, 120) });
  const doSend = () => {
    if (!sendFor || sending) return;
    setSending(true);
    SB.rpc('notices_push_send', { p_id: sendFor.id, p_title: sendFor.title.trim(), p_body: sendFor.body.trim() }).then(({ data, error }) => {
      setSending(false);
      if (error) { say(ntErrText(error)); return; }
      say('알림을 ' + ((data && data.sent) || 0) + '대에 보냈습니다.');
      setSendFor(null); load();
    });
  };
  const toggleBtn = (r, key, on, off) => <button type="button" onClick={() => toggleFlag(r, key)} style={{ border: '1px solid ' + (r[key] ? K.ink : K.control), background: r[key] ? K.ink : 'transparent', color: r[key] ? K.inkText : K.muted, borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', height: 26, padding: '0 8px', whiteSpace: 'nowrap' }}>{r[key] ? on : off}</button>;
  const shown = (rows || []).filter((r) => !mine || r.owner_name === userName);
  const audLabel = (a) => (NT_AUD.filter((x) => x[0] === a)[0] || NT_AUD[0])[1];
  const row = (r) => { return (
    <div key={r.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 20px', borderTop: '1px solid ' + K.rule }}>
      <div style={{ flex: 'none', width: '64px', fontSize: '12.5px', color: K.muted, fontVariantNumeric: 'tabular-nums' }}>{ntWhen(r.created_at)}{r.pinned && <div style={{ fontSize: '11.5px', fontWeight: 600, color: K.text }}>고정</div>}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 500 }}>{r.title}</div>
        {!!r.body && <div style={{ fontSize: '12.5px', color: K.text, marginTop: '3px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r.body}</div>}
        {(Array.isArray(r.images) && r.images.length > 0 || r.popup_image || r.banner_image) && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            {(r.images || []).map((u, i) => <img key={i} alt="" src={u} style={{ height: 48, borderRadius: 4, border: '1px solid ' + K.border }} />)}
            {r.popup_image && <span style={{ position: 'relative' }}><img alt="" src={r.popup_image} style={{ height: 48, borderRadius: 4, border: '1px solid ' + K.border }} /><span style={{ position: 'absolute', left: 2, bottom: 2, fontSize: 9, background: 'rgba(0,0,0,.6)', color: '#fff', padding: '0 4px', borderRadius: 3 }}>팝업</span></span>}
            {r.banner_image && <span style={{ position: 'relative' }}><img alt="" src={r.banner_image} style={{ height: 48, borderRadius: 4, border: '1px solid ' + K.border }} /><span style={{ position: 'absolute', left: 2, bottom: 2, fontSize: 9, background: 'rgba(0,0,0,.6)', color: '#fff', padding: '0 4px', borderRadius: 3 }}>광고</span></span>}
          </div>
        )}
        <div style={{ fontSize: '12px', color: K.muted, marginTop: '3px' }}>{[r.branch || '전체 지점', audLabel(r.audience), r.owner_name, r.notify ? '알림 보냄' : '', (r.show_from || r.show_to) ? (r.show_from || '') + ' ~ ' + (r.show_to || '') : ''].filter(Boolean).join(' · ')}</div>
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '300px' }}>
        {toggleBtn(r, 'popup', '팝업 켜짐', '팝업 꺼짐')}
        {toggleBtn(r, 'banner', '광고 켜짐', '광고 꺼짐')}
        <button type="button" onClick={() => (sendFor && sendFor.id === r.id ? setSendFor(null) : openSend(r))} style={{ border: '1px solid ' + K.control, background: 'transparent', color: K.text, borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', height: 26, padding: '0 8px', whiteSpace: 'nowrap' }}>알림 보내기</button>
      </div>
      <button type="button" onClick={() => togglePin(r)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', color: K.muted, height: 28, padding: '0 6px' }}>{r.pinned ? '고정 해제' : '고정'}</button>
      <button type="button" onClick={() => del(r)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', color: K.neg, height: 28, padding: '0 6px' }}>삭제</button>
    </div>); };
  const sendBox = (r) => (sendFor && sendFor.id === r.id) ? (
    <div key={r.id + ':send'} style={{ margin: '0 20px 12px 96px', padding: '12px', border: '1px solid ' + K.border, borderRadius: K.rCtl + 'px', background: K.raised, display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
      <div style={{ fontSize: '12.5px', color: K.muted }}>알림 문구 — 보낼 때마다 고칠 수 있습니다. 이 공지 대상(지점·학생/학부모)의 앱에 갑니다.</div>
      <input value={sendFor.title} onChange={(e) => setSendFor(Object.assign({}, sendFor, { title: e.target.value }))} placeholder="알림 제목" style={inp} />
      <textarea value={sendFor.body} onChange={(e) => setSendFor(Object.assign({}, sendFor, { body: e.target.value }))} placeholder="알림 내용" rows={2} style={Object.assign({}, inp, { height: 'auto', padding: '8px 10px', lineHeight: 1.5, resize: 'vertical' })} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setSendFor(null)} style={btn(false)}>취소</button>
        <button type="button" onClick={doSend} disabled={sending || !sendFor.title.trim()} style={Object.assign(btn(true), { opacity: sending || !sendFor.title.trim() ? 0.6 : 1 })}>{sending ? '보내는 중…' : '지금 보내기'}</button>
      </div>
    </div>) : null;

  return (
    <div data-root="" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }}>
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: K.ground, borderBottom: '1px solid ' + K.border }}>
        <span style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>공지사항</span>
        <span style={{ fontSize: '12.5px', color: K.muted }}>학생·학부모 앱의 「공지사항」에 뜨는 글을 올립니다</span>
        <span style={{ flex: 1 }}></span>
        {toast && <span style={{ fontSize: '12.5px', color: K.muted }}>{toast}</span>}
      </nav>
      {err && <div style={{ margin: '12px 20px 0', padding: '10px 12px', border: '1px solid ' + K.neg, borderRadius: K.rCtl + 'px', color: K.neg, fontSize: '13px', background: K.surface }}>{err}</div>}
      <div data-row="" style={{ flex: 1, minHeight: 0, display: 'flex', gap: '16px', padding: '16px 20px', overflow: 'hidden' }}>
        <div data-main="" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div style={{ background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', maxWidth: '760px' }}>
            <div style={{ gridColumn: '1 / -1', fontSize: '16px', fontWeight: 600 }}>공지 올리기</div>
            <div>
              <div style={lab}>지점</div>
              <div style={{ display: 'inline-flex', gap: '2px', padding: '2px', borderRadius: K.rCtl + 'px', background: K.raised }}>
                {NT_BRANCH.map(([k, l]) => <button key={l} type="button" onClick={() => setBranch(k)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: '0 12px', fontSize: '13px', fontWeight: branch === k ? 500 : 400, background: branch === k ? K.surface : 'transparent', color: branch === k ? K.text : K.muted, transition: K.ease }}>{l}</button>)}
              </div>
              <div style={{ fontSize: '12px', color: K.muted, marginTop: '6px' }}>{branch ? branch + ' 재원생·학부모에게만 보입니다' : '전체 지점 재원생·학부모에게 보입니다'}</div>
            </div>
            <div>
              <div style={lab}>대상</div>
              <div style={{ display: 'inline-flex', gap: '2px', padding: '2px', borderRadius: K.rCtl + 'px', background: K.raised }}>
                {NT_AUD.map(([k, l]) => <button key={k} type="button" onClick={() => setAud(k)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: '0 12px', fontSize: '13px', fontWeight: aud === k ? 500 : 400, background: aud === k ? K.surface : 'transparent', color: aud === k ? K.text : K.muted, transition: K.ease }}>{l}</button>)}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lab}>제목</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 12월 1일(월) 휴원 안내" style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lab}>내용 (선택)</div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="예) 12월 1일(월)은 학원 내부 행사로 휴원합니다. 보강 일정은 담임선생님이 따로 안내드립니다." rows={5} style={Object.assign({}, inp, { height: 'auto', padding: '8px 10px', lineHeight: 1.5, resize: 'vertical' })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lab}>사진 (선택 · 여러 장 — 앱에서 글 대신 상세보기처럼 세로로 보입니다)</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {files.map((f, i) => thumb(f, () => setFiles(files.filter((x, j) => j !== i))))}
                <button type="button" onClick={() => pick(true, (fs) => setFiles(files.concat(fs)))} style={btn(false)}>{files.length ? '사진 더하기' : '사진 고르기'}</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: K.text, cursor: 'pointer', height: 32 }}><input type="checkbox" style={{ accentColor: K.ink }} checked={pinned} onChange={(e) => setPinned(e.target.checked)} />맨 위에 고정</label>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '18px', padding: '10px 12px', border: '1px solid ' + K.border, borderRadius: K.rCtl + 'px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: K.text, cursor: 'pointer' }}><input type="checkbox" style={{ accentColor: K.ink }} checked={popup} onChange={(e) => setPopup(e.target.checked)} />팝업 띄우기<span style={{ fontSize: '11.5px', color: K.muted }}>앱을 켜자마자</span></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: K.text, cursor: 'pointer' }}><input type="checkbox" style={{ accentColor: K.ink }} checked={notify} onChange={(e) => setNotify(e.target.checked)} />알림 보내기<span style={{ fontSize: '11.5px', color: K.muted }}>올릴 때 한 번</span></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: K.text, cursor: 'pointer' }}><input type="checkbox" style={{ accentColor: K.ink }} checked={banner} onChange={(e) => setBanner(e.target.checked)} />상단 광고<span style={{ fontSize: '11.5px', color: K.muted }}>홈 맨 위 슬라이드</span></label>
              {popup && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span style={{ color: K.muted }}>팝업 그림</span>
                  {popFile ? thumb(popFile, () => setPopFile(null)) : <button type="button" onClick={() => pick(false, (fs) => setPopFile(fs[0] || null))} style={Object.assign(btn(false), { height: 28 })}>고르기</button>}
                </span>
              )}
              {banner && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span style={{ color: K.muted }}>광고 그림</span>
                  {banFile ? thumb(banFile, () => setBanFile(null)) : <button type="button" onClick={() => pick(false, (fs) => setBanFile(fs[0] || null))} style={Object.assign(btn(false), { height: 28 })}>고르기</button>}
                  <span style={{ fontSize: '11.5px', color: K.muted }}>없으면 제목 글자 배너</span>
                </span>
              )}
              {notify && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flexBasis: '100%' }}>
                  <span style={{ color: K.muted, whiteSpace: 'nowrap' }}>알림 문구</span>
                  <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="알림 제목 (비면 공지 제목)" style={Object.assign({}, inp, { width: '220px', height: 28 })} />
                  <input value={nBody} onChange={(e) => setNBody(e.target.value)} placeholder="알림 내용 (비면 본문 앞부분)" style={Object.assign({}, inp, { flex: 1, height: 28 })} />
                </span>
              )}
              {(popup || banner) && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: K.text }}>
                  <span style={{ color: K.muted }}>띄울 기간</span>
                  <input type="date" value={showFrom} onChange={(e) => setShowFrom(e.target.value)} style={Object.assign({}, inp, { width: '150px', height: 28 })} />
                  <span style={{ color: K.muted }}>~</span>
                  <input type="date" value={showTo} min={showFrom || undefined} onChange={(e) => setShowTo(e.target.value)} style={Object.assign({}, inp, { width: '150px', height: 28 })} />
                  <span style={{ fontSize: '11.5px', color: K.muted }}>비우면 늘</span>
                </span>
              )}
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {prog && <span style={{ fontSize: '12.5px', color: K.muted, alignSelf: 'center' }}>{prog}</span>}
              <button type="button" onClick={add} disabled={!canAdd} style={Object.assign(btn(true), { opacity: canAdd ? 1 : 0.6, cursor: canAdd ? 'pointer' : 'default' })}>{busy ? '올리는 중…' : '올리기'}</button>
            </div>
          </div>
          <div style={{ background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', maxWidth: '760px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid ' + K.border }}>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>올린 공지</span>
              <span style={{ fontSize: '12.5px', color: K.muted }}>{rows ? shown.length + '개' : '불러오는 중…'}</span>
              <span style={{ flex: 1 }}></span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: K.muted, cursor: 'pointer' }}><input type="checkbox" style={{ accentColor: K.ink }} checked={mine} onChange={(e) => setMine(e.target.checked)} />내 것만 보기</label>
              <button type="button" onClick={() => { setRows(null); load(); }} style={btn(false)}>새로고침</button>
            </div>
            {rows && !shown.length && <div style={{ padding: '18px 20px', fontSize: '13px', color: K.muted }}>{mine ? '내가 올린 공지가 없습니다.' : '아직 올린 공지가 없습니다.'}</div>}
            {shown.map((r) => [row(r), sendBox(r)])}
          </div>
        </div>
      </div>
    </div>
  );
}
