// ============================================================
// 과제물 (홈 → 과제물) — 신UI 전용 · 강사만(+개발자)
//
// 2026-11-25 사장님: 학생·학부모 앱의 「과제물」 탭 — "선생님이 내고 학생은 보기만". 여기는 **내는 쪽**.
//   · 반 트리(상담 일정의 BkClassTree)에서 반을 고르고(여럿이면 반마다 한 줄, 안 고르면 전체 공개) 과목 · 제목 · 내용 · 마감일 · 첨부 주소(선택).
//   · 낸 목록은 전부 보이고(「내 것만 보기」) 마감이 안 지난 것이 위. 삭제는 한 줄씩 확인 창. 제출 기능은 없다.
// 표 · 학생 쪽 RPC 는 scripts/homework_schema.sql. 권한 키 'homework'(01-core.js PERM_GROUPS — 강의실과 같이 강사만).
// ============================================================

const HW_SCHEMA_HINT = 'Supabase SQL Editor 에서 scripts/homework_schema.sql 을 한 번 실행해야 합니다.';
function hwErrText(e) { const m = String((e && e.message) || e || ''); return /classroom_homework|does not exist|schema cache/.test(m) ? HW_SCHEMA_HINT : m; }
function hwYmd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function hwMd(ymd) { if (!ymd) return ''; const p = String(ymd).split('-'); return p.length === 3 ? Number(p[1]) + '월 ' + Number(p[2]) + '일' : ymd; }
function hwDday(ymd) { if (!ymd) return ''; const t = new Date(hwYmd(new Date()) + 'T00:00:00'), d = new Date(ymd + 'T00:00:00'); const n = Math.round((d - t) / 86400000); return n === 0 ? 'D-day' : n > 0 ? 'D-' + n : '지남'; }

function HomeworkApp({ dark, userName }) {
  const K = TT(dark);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [mine, setMine] = useState(false);
  const [cids, setCids] = useState([]);
  const [subject, setSubject] = useState('영어');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [classes, setClasses] = useState({});
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const btn = (primary) => ({ height: 32, padding: '0 14px', borderRadius: K.rCtl, border: primary ? 'none' : '1px solid ' + K.control, background: primary ? K.ink : 'transparent', color: primary ? K.inkText : K.text, font: 'inherit', fontSize: 13, fontWeight: primary ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: K.ease });
  const inp = { width: '100%', boxSizing: 'border-box', height: 32, border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '0 10px', fontSize: '13.5px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none' };
  const lab = { fontSize: '12px', fontWeight: 500, color: K.muted, margin: '0 0 6px' };
  const today = hwYmd(new Date());

  const load = () => {
    SB.from('classroom_homework').select('*').order('due', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(2000).then(({ data, error }) => {
      if (error) { setErr(hwErrText(error)); setRows([]); return; }
      setErr(''); setRows(data || []);
    });
  };
  useEffect(load, []);
  useEffect(() => { SB.from('aca_class').select('c_id,name,subject').limit(3000).then(({ data }) => { const m = {}; (data || []).forEach((c) => { m[c.c_id] = c; }); setClasses(m); }); }, []);

  const canAdd = !!title.trim() && !busy;
  const add = () => {
    if (!canAdd) return;
    setBusy(true);
    const base = { subject, title: title.trim(), body: body.trim() || null, due: due || null, link: link.trim() || null, owner_name: userName };
    const payload = cids.length ? cids.map((c) => Object.assign({ c_id: c }, base)) : [Object.assign({ c_id: null }, base)];
    SB.from('classroom_homework').insert(payload).then(({ error }) => {
      setBusy(false);
      if (error) { say(hwErrText(error)); return; }
      setTitle(''); setBody(''); setDue(''); setLink('');
      say(cids.length ? cids.length + '개 반에 냈습니다.' : '전체 공개로 냈습니다.');
      load();
    });
  };
  const del = (r) => {
    if (!window.confirm('「' + r.title + '」' + (r.c_id ? ' (' + ((classes[r.c_id] || {}).name || '반 ' + r.c_id) + ')' : ' (전체 공개)') + ' 을 지울까요? 학생 앱에서 바로 사라집니다.')) return;
    SB.from('classroom_homework').delete().eq('id', r.id).then(({ error }) => { if (error) { say(hwErrText(error)); return; } setRows((r0) => (r0 || []).filter((x) => x.id !== r.id)); });
  };
  const shown = (rows || []).filter((r) => !mine || r.owner_name === userName);
  const live = shown.filter((r) => !r.due || r.due >= today), past = shown.filter((r) => r.due && r.due < today);
  const row = (r) => { const c = classes[r.c_id]; const over = r.due && r.due < today; return (
    <div key={r.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 20px', borderTop: '1px solid ' + K.rule, opacity: over ? 0.6 : 1 }}>
      <div style={{ flex: 'none', width: '64px', fontSize: '12.5px', fontWeight: 600, color: over ? K.muted : (hwDday(r.due) === 'D-day' ? K.neg : K.text), fontVariantNumeric: 'tabular-nums' }}>{r.due ? hwDday(r.due) : '마감 없음'}<div style={{ fontSize: '11.5px', fontWeight: 400, color: K.muted }}>{hwMd(r.due)}</div></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 500 }}>{r.title}</div>
        {!!r.body && <div style={{ fontSize: '12.5px', color: K.text, marginTop: '3px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r.body}</div>}
        <div style={{ fontSize: '12px', color: K.muted, marginTop: '3px' }}>{[r.subject, r.c_id ? ((c && c.name) || '반 ' + r.c_id) : '전체 공개', r.owner_name].filter(Boolean).join(' · ')}{r.link ? <span> · <a href={r.link} target="_blank" rel="noreferrer" style={{ color: K.muted }}>첨부 열기</a></span> : null}</div>
      </div>
      <button type="button" onClick={() => del(r)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', color: K.neg, height: 28, padding: '0 6px' }}>삭제</button>
    </div>); };

  return (
    <div data-root="" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }}>
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: K.ground, borderBottom: '1px solid ' + K.border }}>
        <span style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>과제물</span>
        <span style={{ fontSize: '12.5px', color: K.muted }}>학생·학부모 앱의 「과제물」에 뜨는 과제를 냅니다 — 학생은 보기만 합니다</span>
        <span style={{ flex: 1 }}></span>
        {toast && <span style={{ fontSize: '12.5px', color: K.muted }}>{toast}</span>}
      </nav>
      {err && <div style={{ margin: '12px 20px 0', padding: '10px 12px', border: '1px solid ' + K.neg, borderRadius: K.rCtl + 'px', color: K.neg, fontSize: '13px', background: K.surface }}>{err}</div>}
      <div data-row="" style={{ flex: 1, minHeight: 0, display: 'flex', gap: '16px', padding: '16px 20px', overflow: 'hidden' }}>
        <BkClassTree owner={userName} value={cids} onChange={setCids} dark={dark} T={K} label="과제를 낼 반" emptyHint="반을 고르지 않으면 전체 학생에게 보입니다." />
        <div data-main="" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div style={{ background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', maxWidth: '760px' }}>
            <div style={{ gridColumn: '1 / -1', fontSize: '16px', fontWeight: 600 }}>과제 내기</div>
            <div>
              <div style={lab}>과목</div>
              <div style={{ display: 'inline-flex', gap: '2px', padding: '2px', borderRadius: K.rCtl + 'px', background: K.raised }}>
                {['영어', '수학', '국어', '과학', '기타'].map((sj) => <button key={sj} type="button" onClick={() => setSubject(sj)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: '0 12px', fontSize: '13px', fontWeight: subject === sj ? 500 : 400, background: subject === sj ? K.surface : 'transparent', color: subject === sj ? K.text : K.muted, transition: K.ease }}>{sj}</button>)}
              </div>
            </div>
            <div>
              <div style={lab}>낼 반</div>
              <div style={{ fontSize: '13px', lineHeight: '32px', color: cids.length ? K.text : K.muted }}>{cids.length ? cids.map((c) => (classes[c] || {}).name || '반 ' + c).join(' · ') : '전체 공개 (왼쪽에서 반을 고르면 그 반만)'}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lab}>제목</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 워크북 3과 ①②번 풀어 오기" style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lab}>내용 (선택)</div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="예) 어법 선택 문제는 근거 밑줄까지. 모르는 단어는 단어장에 적어 오세요." rows={4} style={Object.assign({}, inp, { height: 'auto', padding: '8px 10px', lineHeight: 1.5, resize: 'vertical' })} />
            </div>
            <div>
              <div style={lab}>마감일 (선택)</div>
              <input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} style={inp} />
            </div>
            <div>
              <div style={lab}>첨부 주소 (선택)</div>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…  (드라이브·유튜브 등)" style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={add} disabled={!canAdd} style={Object.assign(btn(true), { opacity: canAdd ? 1 : 0.6, cursor: canAdd ? 'pointer' : 'default' })}>{busy ? '내는 중…' : '내기'}</button>
            </div>
          </div>
          <div style={{ background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', maxWidth: '760px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid ' + K.border }}>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>낸 과제</span>
              <span style={{ fontSize: '12.5px', color: K.muted }}>{rows ? live.length + '개 진행 중 · 지난 과제 ' + past.length + '개' : '불러오는 중…'}</span>
              <span style={{ flex: 1 }}></span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: K.muted, cursor: 'pointer' }}><input type="checkbox" style={{ accentColor: K.ink }} checked={mine} onChange={(e) => setMine(e.target.checked)} />내 것만 보기</label>
              <button type="button" onClick={() => { setRows(null); load(); }} style={btn(false)}>새로고침</button>
            </div>
            {rows && !shown.length && <div style={{ padding: '18px 20px', fontSize: '13px', color: K.muted }}>{mine ? '내가 낸 과제가 없습니다.' : '아직 낸 과제가 없습니다.'}</div>}
            {live.map(row)}
            {past.length > 0 && <div style={{ padding: '10px 20px 4px', fontSize: '12px', fontWeight: 500, color: K.muted, borderTop: '1px solid ' + K.border }}>지난 과제</div>}
            {past.map(row)}
          </div>
        </div>
      </div>
    </div>
  );
}
