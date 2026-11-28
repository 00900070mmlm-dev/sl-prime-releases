// ============================================================
// 강의실 (홈 → 강의실) — 신UI 전용
//
// 2026-11-25 사장님: 학생·학부모 앱(mobile/family)의 「강의실」 탭이 **선생님이 올린 유튜브 링크**를 보여 준다.
// 여기는 그 링크를 **올리는 쪽** — 반 트리(상담 일정의 BkClassTree)에서 반을 고르고 제목 · 유튜브 주소 · 안내 한 줄을 넣는다.
//   · 반을 여럿 고르면 반마다 한 줄씩 들어간다(classroom_videos 는 반 하나에 한 줄). 반을 안 고르면 **전체 공개**(모든 학생에게).
//   · **카테고리**는 강사가 직접 만든다(2026-11-25 사장님 — 처음엔 '범위'를 모의고사·교과서 목록에서 고르게 했다가 "카테고리라고 하고 강사가 직접 정리"로).
//     올릴 때 내 카테고리 중 고르거나 새로 적는다(필수). 올린 뒤에도 줄마다 카테고리를 바꿀 수 있다. 학생 앱은 올린 선생님별 → 카테고리별로 묶는다.
//   · 줄마다 **시청 기록**(본 학생 수 · 끝까지 본 수, 누르면 이름·진행률 — classroom_watch, 2026-11-25 사장님 "끝까지 봤는지 아카이빙").
//   · 올린 목록은 **전부** 보인다(「내 것만 보기」로 거른다 — 처음엔 내 것만 보여 줬더니 다른 사람이 올린 영상이 안 보여 헷갈렸다, 2026-11-25). 「새로고침」으로 다시 읽는다. 삭제는 한 줄씩 확인 창.
//   · 주소는 watch?v= · youtu.be · shorts · embed 다 받는다 — 앱과 같은 규칙(ytId). 못 읽는 주소는 넣지 않는다.
// 표 · 학생 쪽 RPC 는 scripts/classroom_schema.sql. 권한 키 'classroom' — **강사만**(+개발자. 01-core.js PERM_GROUPS — 2026-11-25 사장님 "강사들만").
// ============================================================

const CR_SCHEMA_HINT = 'Supabase SQL Editor 에서 scripts/classroom_schema.sql 을 한 번 실행해야 합니다.';
/** 유튜브 주소 → 영상 id (mobile/family/src/util.js 의 ytId 와 같은 규칙 — 한쪽을 고치면 다른 쪽도) */
function crYtId(url) {
  const m = String(url || '').trim().match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function crErrText(e) { const m = String((e && e.message) || e || ''); return /classroom_videos|does not exist|schema cache/.test(m) ? CR_SCHEMA_HINT : m; }
function crMd(iso) { const d = new Date(iso); return isNaN(d) ? '' : (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
/** 카테고리 고르기 — 내가 쓴 카테고리(mine)를 칩으로, 새 것은 적어서. value: 글자(비면 없음). */
function CrCategoryPick({ value, onChange, mine, K }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const chip = (on) => ({ height: 28, padding: '0 10px', borderRadius: K.rCtl, border: '1px solid ' + (on ? K.ink : K.control), background: on ? K.ink : 'transparent', color: on ? K.inkText : K.text, font: 'inherit', fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', transition: K.ease });
  const inp = { boxSizing: 'border-box', height: 28, border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '0 10px', fontSize: '13px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none', width: '220px' };
  const commit = () => { const v = draft.trim(); if (!v) return; onChange(v); setDraft(''); setAdding(false); };
  const list = mine.slice(); if (value && list.indexOf(value) < 0) list.unshift(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {list.map((c) => <button key={c} type="button" onClick={() => onChange(c)} style={chip(value === c)}>{c}</button>)}
        {adding
          ? <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }} placeholder="새 카테고리 이름" style={inp} />
              <button type="button" onClick={commit} style={chip(false)}>추가</button>
              <button type="button" onClick={() => { setAdding(false); setDraft(''); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', color: K.muted }}>취소</button>
            </span>
          : <button type="button" onClick={() => setAdding(true)} style={Object.assign(chip(false), { borderStyle: 'dashed' })}>+ 새 카테고리</button>}
      </div>
      <div style={{ fontSize: '12.5px', color: value ? K.text : K.neg }}>{value ? '카테고리: ' + value : (mine.length ? '카테고리를 고르거나 새로 만들어 주세요 — 학생 앱에서 카테고리별로 묶여 보입니다.' : '첫 카테고리를 만들어 주세요(예: 10월 모의고사 · 어법 특강) — 학생 앱에서 카테고리별로 묶여 보입니다.')}</div>
    </div>
  );
}

function ClassroomApp({ dark, userName }) {
  const K = TT(dark);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [mine, setMine] = useState(false);
  const [cids, setCids] = useState([]);
  const [subject, setSubject] = useState('영어');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [classes, setClasses] = useState({});
  // 시청 기록(classroom_watch — scripts/classroom_watch_schema.sql): 영상 id → [{ s_id, watched_sec, duration_sec, done, updated_at }]. 이름은 aca_student 에서. 표가 아직 없으면 조용히 비워 둔다.
  const [watch, setWatch] = useState({});
  const [names, setNames] = useState({});
  const [openW, setOpenW] = useState(null);   // 이름 목록을 펼친 영상 id
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const btn = (primary) => ({ height: 32, padding: '0 14px', borderRadius: K.rCtl, border: primary ? 'none' : '1px solid ' + K.control, background: primary ? K.ink : 'transparent', color: primary ? K.inkText : K.text, font: 'inherit', fontSize: 13, fontWeight: primary ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: K.ease });
  const inp = { width: '100%', boxSizing: 'border-box', height: 32, border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '0 10px', fontSize: '13.5px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none' };
  const lab = { fontSize: '12px', fontWeight: 500, color: K.muted, margin: '0 0 6px' };

  const load = () => {
    SB.from('classroom_videos').select('*').order('created_at', { ascending: false }).limit(2000).then(({ data, error }) => {
      if (error) { setErr(crErrText(error)); setRows([]); return; }
      setErr(''); setRows(data || []);
    });
  };
  const loadWatch = () => {
    SB.from('classroom_watch').select('s_id,video_id,watched_sec,duration_sec,done,updated_at').limit(20000).then(({ data, error }) => {
      if (error) { setWatch({}); return; }
      const m = {}; (data || []).forEach((w) => { (m[w.video_id] = m[w.video_id] || []).push(w); }); setWatch(m);
    });
  };
  useEffect(() => { load(); loadWatch(); }, []);
  useEffect(() => { SB.from('aca_class').select('c_id,name,subject').limit(3000).then(({ data }) => { const m = {}; (data || []).forEach((c) => { m[c.c_id] = c; }); setClasses(m); }); }, []);
  useEffect(() => { SB.from('aca_student').select('s_id,name,school,grade').limit(3000).then(({ data }) => { const m = {}; (data || []).forEach((x) => { m[x.s_id] = x; }); setNames(m); }); }, []);
  const who = (sid) => sid === -1 ? '시연 계정' : ((names[sid] || {}).name || '학생 ' + sid);
  const pct = (w) => w.done ? 100 : (w.duration_sec ? Math.min(99, Math.round(w.watched_sec / w.duration_sec * 100)) : 0);

  const id = crYtId(url);
  const canAdd = !!id && !!title.trim() && !!String(category || '').trim() && !busy;
  const add = () => {
    if (!canAdd) return;
    setBusy(true);
    const base = { subject, title: title.trim(), url: url.trim(), note: note.trim() || null, category: String(category).trim(), owner_name: userName };
    const payload = cids.length ? cids.map((c) => Object.assign({ c_id: c }, base)) : [Object.assign({ c_id: null }, base)];
    SB.from('classroom_videos').insert(payload).then(({ error }) => {
      setBusy(false);
      if (error) { say(crErrText(error)); return; }
      setTitle(''); setUrl(''); setNote('');
      say(cids.length ? cids.length + '개 반에 올렸습니다.' : '전체 공개로 올렸습니다.');
      load();
    });
  };
  const del = (r) => {
    if (!window.confirm('「' + r.title + '」' + (r.c_id ? ' (' + ((classes[r.c_id] || {}).name || '반 ' + r.c_id) + ')' : ' (전체 공개)') + ' 을 지울까요? 학생 앱에서 바로 사라집니다.')) return;
    SB.from('classroom_videos').delete().eq('id', r.id).then(({ error }) => { if (error) { say(crErrText(error)); return; } setRows((r0) => (r0 || []).filter((x) => x.id !== r.id)); });
  };
  const shown = (rows || []).filter((r) => !mine || r.owner_name === userName);
  // 내 카테고리 — 내가 올린 영상에 쓴 것(최근 것부터)
  const myCats = []; (rows || []).forEach((r) => { if (r.owner_name === userName && r.category && myCats.indexOf(r.category) < 0) myCats.push(r.category); });
  // 올린 뒤 카테고리 바꾸기(줄의 select — 내 카테고리 + 새 카테고리…)
  const setCat = (r, v) => {
    if (v === '__new__') { const n = window.prompt('새 카테고리 이름', r.category || ''); if (n == null || !n.trim()) return; v = n.trim(); }
    if (v === (r.category || '')) return;
    SB.from('classroom_videos').update({ category: v }).eq('id', r.id).then(({ error }) => { if (error) { say(crErrText(error)); return; } setRows((r0) => (r0 || []).map((x) => x.id === r.id ? Object.assign({}, x, { category: v }) : x)); });
  };

  return (
    <div data-root="" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }}>
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: K.ground, borderBottom: '1px solid ' + K.border }}>
        <span style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>강의실</span>
        <span style={{ fontSize: '12.5px', color: K.muted }}>학생·학부모 앱의 「강의실」에 뜨는 유튜브 영상을 올립니다</span>
        <span style={{ flex: 1 }}></span>
        {toast && <span style={{ fontSize: '12.5px', color: K.muted }}>{toast}</span>}
      </nav>
      {err && <div style={{ margin: '12px 20px 0', padding: '10px 12px', border: '1px solid ' + K.neg, borderRadius: K.rCtl + 'px', color: K.neg, fontSize: '13px', background: K.surface }}>{err}</div>}
      <div data-row="" style={{ flex: 1, minHeight: 0, display: 'flex', gap: '16px', padding: '16px 20px', overflow: 'hidden' }}>
        <BkClassTree owner={userName} value={cids} onChange={setCids} dark={dark} T={K} label="영상을 보여 줄 반" emptyHint="반을 고르지 않으면 전체 학생에게 보입니다." />
        <div data-main="" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div style={{ background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', maxWidth: '760px' }}>
            <div style={{ gridColumn: '1 / -1', fontSize: '16px', fontWeight: 600 }}>영상 올리기</div>
            <div>
              <div style={lab}>과목</div>
              <div style={{ display: 'inline-flex', gap: '2px', padding: '2px', borderRadius: K.rCtl + 'px', background: K.raised }}>
                {['영어', '수학', '국어', '과학', '기타'].map((sj) => <button key={sj} type="button" onClick={() => setSubject(sj)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: '0 12px', fontSize: '13px', fontWeight: subject === sj ? 500 : 400, background: subject === sj ? K.surface : 'transparent', color: subject === sj ? K.text : K.muted, transition: K.ease }}>{sj}</button>)}
              </div>
            </div>
            <div>
              <div style={lab}>보여 줄 반</div>
              <div style={{ fontSize: '13px', lineHeight: '32px', color: cids.length ? K.text : K.muted }}>{cids.length ? cids.map((c) => (classes[c] || {}).name || '반 ' + c).join(' · ') : '전체 공개 (왼쪽에서 반을 고르면 그 반만)'}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lab}>카테고리</div>
              <CrCategoryPick value={category} onChange={setCategory} mine={myCats} K={K} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lab}>제목</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 11월 3주 어법 복습" style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lab}>유튜브 주소</div>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…  또는  https://youtu.be/…" style={Object.assign({}, inp, url.trim() && !id ? { borderColor: K.neg } : {})} />
              {!!url.trim() && !id && <div style={{ fontSize: '12px', color: K.neg, marginTop: '4px' }}>유튜브 주소로 보이지 않습니다. 영상 페이지의 주소를 그대로 붙여 넣어 주세요.</div>}
              {!!id && <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' }}><img src={'https://img.youtube.com/vi/' + id + '/mqdefault.jpg'} alt="" style={{ width: '120px', height: '68px', objectFit: 'cover', borderRadius: '6px', background: K.raised }} /><span style={{ fontSize: '12px', color: K.muted }}>영상 id {id}</span></div>}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lab}>안내 한 줄 (선택)</div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예) 수업 전에 한 번 보고 오세요" style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={add} disabled={!canAdd} style={Object.assign(btn(true), { opacity: canAdd ? 1 : 0.6, cursor: canAdd ? 'pointer' : 'default' })}>{busy ? '올리는 중…' : '올리기'}</button>
            </div>
          </div>
          <div style={{ background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', maxWidth: '760px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid ' + K.border }}>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>올린 영상</span>
              <span style={{ fontSize: '12.5px', color: K.muted }}>{rows ? shown.length + '개' : '불러오는 중…'}</span>
              <span style={{ flex: 1 }}></span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: K.muted, cursor: 'pointer' }}><input type="checkbox" style={{ accentColor: K.ink }} checked={mine} onChange={(e) => setMine(e.target.checked)} />내 것만 보기</label>
              <button type="button" onClick={() => { setRows(null); load(); loadWatch(); }} style={btn(false)}>새로고침</button>
            </div>
            {rows && !shown.length && <div style={{ padding: '18px 20px', fontSize: '13px', color: K.muted }}>{mine ? '내가 올린 영상이 없습니다.' : '아직 올린 영상이 없습니다.'}</div>}
            {shown.map((r) => { const vid = crYtId(r.url); const c = classes[r.c_id]; const ws = watch[r.id] || []; const doneN = ws.filter((w) => w.done).length; const wOpen = openW === r.id; return (
              <div key={r.id} style={{ borderTop: '1px solid ' + K.rule }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 20px' }}>
                <img src={vid ? 'https://img.youtube.com/vi/' + vid + '/default.jpg' : ''} alt="" style={{ width: '72px', height: '40px', objectFit: 'cover', borderRadius: '4px', background: K.raised, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                  <div style={{ fontSize: '12px', color: K.muted, marginTop: '2px' }}>{[r.subject, r.c_id ? ((c && c.name) || '반 ' + r.c_id) : '전체 공개', r.owner_name, crMd(r.created_at)].filter(Boolean).join(' · ')}{r.note ? ' · ' + r.note : ''}</div>
                </div>
                {r.owner_name === userName
                  ? <select value={r.category || ''} onChange={(e) => setCat(r, e.target.value)} title="카테고리 바꾸기" style={{ height: 28, maxWidth: '160px', border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '0 24px 0 8px', fontSize: '12.5px', fontFamily: 'inherit', background: K.surface, color: r.category ? K.text : K.neg }}>
                      {!r.category && <option value="">카테고리 없음</option>}
                      {(r.category && myCats.indexOf(r.category) < 0 ? [r.category] : []).concat(myCats).map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="__new__">새 카테고리…</option>
                    </select>
                  : <span style={{ fontSize: '12px', color: K.muted, whiteSpace: 'nowrap' }}>{r.category || '카테고리 없음'}</span>}
                {/* 시청 기록(2026-11-25 사장님 — "끝까지 봤는지 아카이빙"): 본 학생 수 · 끝까지 본 수. 누르면 아래에 이름·진행률 */}
                <button type="button" onClick={() => setOpenW(wOpen ? null : r.id)} title="누르면 본 학생 이름" style={{ border: 'none', background: 'transparent', cursor: ws.length ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: '12.5px', color: ws.length ? (doneN ? K.pos : K.text) : K.grey, height: 28, padding: '0 6px', whiteSpace: 'nowrap' }}>{ws.length ? '본 학생 ' + ws.length + ' · 다 봄 ' + doneN : '아직 안 봄'}</button>
                <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: K.muted, textDecoration: 'none', whiteSpace: 'nowrap' }}>열기</a>
                <button type="button" onClick={() => del(r)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', color: K.neg, height: 28, padding: '0 6px' }}>삭제</button>
              </div>
              {wOpen && ws.length > 0 && (
                <div style={{ padding: '0 20px 10px 104px', display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                  {ws.slice().sort((a, b) => (b.done - a.done) || (pct(b) - pct(a))).map((w) => (
                    <span key={w.s_id} style={{ fontSize: '12.5px', color: w.done ? K.pos : K.text, whiteSpace: 'nowrap' }}>{who(w.s_id)} <span style={{ color: w.done ? K.pos : K.muted }}>{w.done ? '다 봄' : pct(w) + '%'}</span> <span style={{ color: K.grey, fontSize: '11.5px' }}>{crMd(w.updated_at)}</span></span>
                  ))}
                </div>
              )}
              </div>); })}
          </div>
        </div>
      </div>
    </div>
  );
}
