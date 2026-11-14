// ============================================================
// 업무일지 (홈 → 업무일지)
//
// 2026-11-12 사장님: 구글시트 '영어과 업무일지'를 앱으로 옮긴다. **단어 재시만** 옮긴다
// (1:1 케어 · 클리닉은 2026-11-12 사장님 지시로 뺐다 — "1대1케어와 클리닉은 빼자").
//   · 단어 재시는 **출석부와 연결.** 출석부에 숫자(본시험 불통과 점수)가 들어간 칸이 곧 재시 대상이다.
//     그날 재시를 본 결과(시간 · 통과/불참/미룸 · 점수 · 메모)를 적고, **통과할 때까지 따라온다.**
//   · 묶음은 시트의 조교별 대신 **ACA 반**(조교는 ACA 에 없다). 왼쪽 반 트리로 고르고, 안 고르면 그 과목 전체.
//   · 학생·반 이름은 **항상 ACA 동기화본**에서 온다. 손으로 적는 이름은 없다(퇴원하면 명단에서 빠진다).
//   · 칸은 고르는 즉시(글은 칸을 벗어날 때) 저장한다. 저장 버튼 없음.
// 스키마: scripts/diary_schema.sql (attendance_schema.sql 다음에)
// ============================================================

const DY_WD = ['일', '월', '화', '수', '목', '금', '토'];
const DY_STATUS = ['통과', '불참', '미룸'];
// 재시 시간 후보(고르거나 직접 적는다) — 3시~10시 30분 간격
const DY_TIMES = ['3:00', '3:30', '4:00', '4:30', '5:00', '5:30', '6:00', '6:30', '7:00', '7:30', '8:00', '8:30', '9:00', '9:30', '10:00'];
const DY_LOOKBACK = 60;   // 재시 대상: 최근 60일 안의 본시험만 본다(그보다 오래 안 풀린 건 사실상 끝난 것)
const DY_SCHEMA_HINT = 'Supabase SQL Editor 에서 scripts/diary_schema.sql 을 한 번 실행해야 합니다.';

function dyYmd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dyShift(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return dyYmd(d); }
function dyMd(ymd) { const p = String(ymd || '').split('-'); return p.length === 3 ? Number(p[1]) + '/' + Number(p[2]) : ''; }
function dyWd(ymd) { return DY_WD[new Date(ymd + 'T00:00:00').getDay()]; }
function dyErrText(e) {
  const m = String((e && e.message) || e || '');
  if (/relation .* does not exist|schema cache|PGRST205/i.test(m)) return '업무일지 표가 아직 없습니다 — ' + DY_SCHEMA_HINT;
  if (/row-level security|permission denied/i.test(m)) return '업무일지를 고칠 권한이 없습니다.';
  return m || '알 수 없는 오류';
}
const dyIsScore = (v) => /^\d+$/.test(String(v || ''));

/** 칸을 벗어날 때 저장하는 글 칸 — 값이 바깥에서 바뀌면(다른 날로 이동 등) 따라간다. */
function DyText({ value, onSave, placeholder, width, T, dark, multi }) {
  const K = TT(dark);
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);
  const style = { width: width || '100%', boxSizing: 'border-box', border: '1px solid transparent', borderRadius: K.rCtl + 'px', padding: '4px 6px', fontSize: '12.5px', fontFamily: 'inherit',
    background: 'transparent', color: K.text, outline: 'none', resize: 'vertical', lineHeight: 1.45, transition: K.ease };
  const on = (e) => { e.target.style.borderColor = K.control; e.target.style.background = K.surface; };
  const off = (e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; if ((v || '') !== (value || '')) onSave(v); };
  return multi
    ? <textarea rows={1} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onFocus={on} onBlur={off} style={style} />
    : <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onFocus={on} onBlur={off} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} style={style} />;
}
function DiaryApp({ dark, userName, onHome }) {
  const T = THEME(dark);
  const K = TT(dark);   // taste(2026-11-12) — 업무일지는 인쇄물이 없다. 크롬 강조는 먹(K.ink)
  const today = dyYmd(new Date());
  const [aca, setAca] = useState(null);
  const [err, setErr] = useState('');
  const [subject, setSubjectRaw] = useState(() => { try { return localStorage.getItem('dy_subject') === '수학' ? '수학' : '영어'; } catch (e) { return '영어'; } });
  const [day, setDayRaw] = useState(today);
  const [q, setQ] = useState('');
  // 반 고르기 — 출석부·주간테스트 관리와 같은 트리(과목 → 급 → 학교 → 학년 → 반, 여러 반 · 수학과 중등은 학교 층 없이 급 → 학년 → 반). 안 고르면 그 과목 전체.
  const [onlyMine, setOnlyMine] = useState(false);
  const [branch, setBranchRaw] = useState(waLoadBranch);   // 지점(원당점 · 이음점) — 반 트리 맨 위
  const [level, setLevel] = useState(null);
  const [openSchool, setOpenSchool] = useState(null);
  const [openGrade, setOpenGrade] = useState(null);
  const [classIds, setClassIds] = useState([]);
  const [cq, setCq] = useState('');                // 반 이름 찾기
  const [toast, setToast] = useState('');
  const [ver, setVer] = useState(0);              // 다시 읽기 신호
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const setDay = (d) => setDayRaw(d);
  const setSubject = (sj) => { if (sj === subject) return; setSubjectRaw(sj); setClassIds([]); setLevel(null); setOpenSchool(null); setOpenGrade(null); try { localStorage.setItem('dy_subject', sj); } catch (e) {} };
  const setBranch = (b) => { setBranchRaw(b); setClassIds([]); setLevel(null); setOpenSchool(null); setOpenGrade(null); };

  // ── ACA 명단(항상 최신) ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      SB.from('aca_student').select('s_id,name,grade,state,school,class_ids').eq('state', '재원').limit(3000),
      SB.from('aca_class').select('c_id,name,subjects,teachers,deleted,timetable_text').limit(3000),
    ]).then(([a, b]) => {
      if (a.error || b.error) { setErr(dyErrText(a.error || b.error)); setAca({ students: [], classes: [] }); return; }
      setAca({ students: a.data || [], classes: b.data || [] });
    });
  }, []);
  const students = (aca && aca.students) || [];
  const classes = ((aca && aca.classes) || []).filter((c) => waIsEnglish(c, subject, branch));   // 그 과목 · 그 지점 반
  const clsById = {}; classes.forEach((c) => { clsById[c.c_id] = c; });
  const stuById = {}; students.forEach((s) => { stuById[s.s_id] = s; });
  const hitQ = (s) => !q.trim() || (s && String(s.name).indexOf(q.trim()) >= 0);
  const selSet = classIds.length ? new Set(classIds) : null;
  const inSel = (c_id) => !selSet || selSet.has(c_id);
  const tree = aca ? waTree(students, (aca && aca.classes) || [], onlyMine, userName, subject, branch) : [];
  const levels = WA_LEVELS.map((lv) => ({ level: lv, schools: tree.filter((x) => waSchoolLevel(x.name, x.grades) === lv) })).filter((x) => x.schools.length);
  const curLevel = (level && levels.some((x) => x.level === level)) ? level : (levels[0] || {}).level;
  const shownSchools = (levels.filter((x) => x.level === curLevel)[0] || { schools: [] }).schools;
  const toggleClass = (id) => setClassIds((c0) => c0.indexOf(id) >= 0 ? c0.filter((x) => x !== id) : c0.concat([id]));
  const selCls = classIds.map((id) => clsById[id]).filter(Boolean);
  const headN = (c) => students.filter((x) => (x.class_ids || []).indexOf(c.c_id) >= 0).length;
  const shortCls = (c) => String((c && c.name) || '').replace(/^\((영|수)\)\s*/, '');

  // ── 데이터(그날) ────────────────────────────────────────────────
  const [rt, setRt] = useState(null);       // { items:[{s_id,c_id,test_day,score}], logs:{key→[log]} }
  const rk = (x) => x.s_id + '|' + x.c_id + '|' + x.test_day;

  useEffect(() => {
    if (!aca) return;
    setRt(null);
    const from = dyShift(day, -DY_LOOKBACK);
    Promise.all([
      SB.from('attendance').select('s_id,c_id,day,value').gte('day', from).lte('day', day).not('value', 'in', '("통과","지각","결")').limit(20000),
      SB.from('retest_log').select('*').gte('test_day', from).lte('test_day', day).limit(20000),
    ]).then(([a, b]) => {
      if (a.error) { setErr(dyErrText(a.error)); setRt({ items: [], logs: {} }); return; }
      if (b.error) setErr(dyErrText(b.error)); else setErr('');
      const logs = {};
      (b.data || []).forEach((l) => { (logs[rk(l)] = logs[rk(l)] || []).push(l); });
      Object.keys(logs).forEach((k) => logs[k].sort((x, y) => x.on_day < y.on_day ? -1 : 1));
      const items = (a.data || []).filter((r) => dyIsScore(r.value)).map((r) => ({ s_id: r.s_id, c_id: r.c_id, test_day: r.day, score: r.value }));
      setRt({ items: items, logs: logs });
    });
  }, [aca, day, ver]);

  const fail = (error) => { if (error) { setErr(dyErrText(error)); say('저장하지 못했습니다'); return true; } return false; };

  // ── ① 단어 재시 ───────────────────────────────────────────────
  // 재시 날짜 = retest_log 의 on_day. 그날 줄이 있으면 '그날 재시' 로 잡힌 것이다(칸이 비어 있어도 — 일정만 잡아 둔 것).
  //   · 그날 보이는 것: 그날 줄이 있거나, **앞으로 잡힌 날이 없는**(= 재시 날짜 미정) 것. 그 전에 통과했으면 안 보인다.
  //   · 날짜 미정(출석부에서 막 올라왔거나, 지난 재시 뒤로 날짜를 안 잡은 학생)은 **맨 위**에 모은다(2026-11-12 사장님).
  //   · '다른 날로' = 그날 줄을 비우고(결과가 이미 적혀 있으면 기록으로 남긴다) 고른 날에 줄을 만든다.
  const [moving, setMoving] = useState(null);   // { key, to } — '다른 날로' 를 연 줄
  const putLogs = (k, fn) => setRt((r0) => { const logs = Object.assign({}, r0.logs); logs[k] = fn(logs[k] || []).sort((x, y) => x.on_day < y.on_day ? -1 : 1); return Object.assign({}, r0, { logs: logs }); });
  const saveRetest = (it, patch) => {
    const k = rk(it);
    const cur0 = ((rt.logs[k] || []).find((l) => l.on_day === day)) || { s_id: it.s_id, c_id: it.c_id, test_day: it.test_day, on_day: day, time: '', status: '', score: '', memo: '' };
    const row = Object.assign({}, cur0, patch, { updated_by: userName || null, updated_at: new Date().toISOString() });
    putLogs(k, (list) => list.filter((l) => l.on_day !== day).concat([row]));
    SB.from('retest_log').upsert({ s_id: row.s_id, c_id: row.c_id, test_day: row.test_day, on_day: day, time: row.time, status: row.status, score: row.score, memo: row.memo, updated_by: row.updated_by, updated_at: row.updated_at }, { onConflict: 's_id,c_id,test_day,on_day' })
      .then(({ error }) => { if (fail(error)) setVer((v) => v + 1); });
  };
  /** to = 'YYYY-MM-DD' 면 그날(time 이 있으면 그 시간)로 잡고, null 이면 날짜 미정으로 되돌린다. */
  const moveRetest = (it, to, time) => {
    const k = rk(it), logs = rt.logs[k] || [];
    const drop = logs.filter((l) => l.on_day >= day && !l.status && !l.score && l.on_day !== to);   // 결과가 없는 '잡아 둔 날' 만 지운다
    const there = to ? logs.find((l) => l.on_day === to) : null;
    const add = to && (!there || (time != null && time !== there.time))
      ? Object.assign({ s_id: it.s_id, c_id: it.c_id, test_day: it.test_day, on_day: to, time: '', status: '', score: '', memo: '' }, there || {},
          time != null ? { time: time } : {}, { updated_by: userName || null, updated_at: new Date().toISOString() }) : null;
    putLogs(k, (list) => list.filter((l) => drop.indexOf(l) < 0 && !(add && l.on_day === add.on_day)).concat(add ? [add] : []));
    setMoving(null);
    Promise.all(drop.map((l) => SB.from('retest_log').delete().eq('s_id', it.s_id).eq('c_id', it.c_id).eq('test_day', it.test_day).eq('on_day', l.on_day))
      .concat(add ? [SB.from('retest_log').upsert(add, { onConflict: 's_id,c_id,test_day,on_day' })] : []))
      .then((rs) => { const e = rs.find((r) => r.error); if (e) { fail(e.error); setVer((v) => v + 1); } else say(to ? stuById[it.s_id].name + ' → ' + dyMd(to) + '(' + dyWd(to) + ')' + (time ? ' ' + time : '') + ' 재시로 잡았습니다' : '재시 날짜를 비웠습니다'); });
  };
  const retestView = () => {
    if (!rt) return <div style={emptyS}>불러오는 중…</div>;
    const rows = rt.items.filter((it) => clsById[it.c_id] && stuById[it.s_id] && inSel(it.c_id)).map((it) => {
      const logs = rt.logs[rk(it)] || [];
      const passed = logs.find((l) => l.status === '통과');
      const todayLog = logs.find((l) => l.on_day === day) || null;
      const next = logs.find((l) => l.on_day > day) || null;
      const past = logs.filter((l) => l.on_day < day);
      // 재재시 일정은 지난 재시에서 **불참·미룸을 누른 경우에만** 다시 잡게 한다(사장님 2026-11-13).
      // 재시를 한 번도 안 잡은 학생(출석부에서 막 올라온)은 그대로 '날짜 미정'에 뜬다.
      const lastPast = past[past.length - 1];
      const needResched = !lastPast || lastPast.status === '불참' || lastPast.status === '미룸';
      return { it: it, logs: logs, passedOn: passed ? passed.on_day : null, todayLog: todayLog, next: next, past: past, unsched: !todayLog && !next, needResched: needResched };
    }).filter((x) => (!x.passedOn || x.passedOn >= day) && (x.todayLog || (!x.next && x.needResched))).filter((x) => hitQ(stuById[x.it.s_id]));
    const unsched = rows.filter((x) => x.unsched).sort((a, b) => waClassCmp(clsById[a.it.c_id], clsById[b.it.c_id]) || stuById[a.it.s_id].name.localeCompare(stuById[b.it.s_id].name, 'ko'));
    const sched = rows.filter((x) => !x.unsched);
    // 반 단위 카드(2026-11-12 사장님 — "반별로 나눠야해"). 순서: 학교·학년 → T · S1 · S2 …
    const groups = {};
    sched.forEach((x) => { (groups[x.it.c_id] = groups[x.it.c_id] || []).push(x); });
    const sgOf = (cid) => { const s = stuById[groups[cid][0].it.s_id]; return (s.school || '') + ' ' + (s.grade || ''); };
    const keys = Object.keys(groups).sort((a, b) => sgOf(a).localeCompare(sgOf(b), 'ko') || waClassCmp(clsById[a], clsById[b]));
    const cnt = (st) => sched.filter((x) => (x.todayLog && x.todayLog.status) === st).length;
    const pending = sched.filter((x) => !(x.todayLog && x.todayLog.status)).length;
    const btnS = (on) => ({ border: '1px solid ' + K.control, background: on ? K.active : 'transparent', color: K.text, borderRadius: K.rCtl + 'px', padding: '3px 8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: K.ease });
    // 재시 날짜·시간 잡기 / 다른 날로 — 날짜와 시간(2026-11-12 사장님 — "재시 시간도 정할 수 있게")을 고르면 그리로 잡는다. 미정으로 되돌리기도 여기서.
    const mover = (x) => {
      const k = rk(x.it), open = moving && moving.key === k;
      const nextDay = dyShift(day, dyWd(dyShift(day, 1)) === '일' ? 2 : 1);
      if (!open) return <button style={btnS(false)} onClick={() => setMoving({ key: k, to: x.unsched ? day : nextDay, time: (x.todayLog && x.todayLog.time) || '' })}>{x.unsched ? '날짜·시간 잡기' : '다른 날로'}</button>;
      const inS = { border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '2px 4px', fontSize: '12px', fontFamily: 'inherit', background: K.surface, color: K.text };
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <input type="date" value={moving.to} min={x.it.test_day} onChange={(e) => setMoving(Object.assign({}, moving, { to: e.target.value }))} style={inS} />
          <input list="dy-times" value={moving.time} placeholder="시간" onChange={(e) => setMoving(Object.assign({}, moving, { time: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter' && moving.to) moveRetest(x.it, moving.to, moving.time); }} style={Object.assign({}, inS, { width: '70px' })} />
          <button style={Object.assign(btnS(true), { background: K.ink, color: K.inkText, border: '1px solid ' + K.ink })} disabled={!moving.to} onClick={() => moveRetest(x.it, moving.to, moving.time)}>{x.unsched || moving.to === day ? '잡기' : '옮기기'}</button>
          {!x.unsched && <button style={btnS(false)} onClick={() => moveRetest(x.it, null)}>미정으로</button>}
          <button style={Object.assign(btnS(false), { border: '1px solid transparent', color: K.muted })} onClick={() => setMoving(null)}>취소</button>
        </span>
      );
    };
    const pastCell = (x) => (
      <td style={Object.assign({}, tdS, { color: K.muted, fontSize: '12px', fontVariantNumeric: 'tabular-nums' })}>
        {x.past.length ? x.past.map((l) => dyMd(l.on_day) + (l.status ? ' ' + l.status : '') + (l.score ? ' ' + l.score : '')).join(' · ') : '—'}
        {x.past.length >= 1 && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 600, color: K.warn }}>{x.past.length >= 2 ? '재재시+' : '재재시'}</span>}
      </td>
    );
    return (
      <React.Fragment>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', fontSize: '12.5px', color: K.muted, fontVariantNumeric: 'tabular-nums' }}>
          <span>오늘 재시 <b style={{ color: K.text, fontWeight: 600 }}>{sched.length}</b>명</span>
          <span style={badge(K.raised, K.text)}>통과 {cnt('통과')}</span>
          <span style={badge(K.raised, K.text)}>불참 {cnt('불참')}</span>
          <span style={badge(K.raised, K.muted)}>미룸 {cnt('미룸')}</span>
          <span style={badge(K.raised, K.muted)}>결과 미입력 {pending}</span>
          {!!unsched.length && <span style={Object.assign(badge('transparent', K.neg), { border: '1px solid ' + K.neg })}>재시 날짜 미정 {unsched.length}</span>}
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: K.muted }}>출석부에 숫자(불통과 점수)가 들어간 학생이 자동으로 올라옵니다 · 통과할 때까지 따라옵니다</span>
        </div>
        <datalist id="dy-times">{DY_TIMES.map((t0) => <option key={t0} value={t0} />)}</datalist>
        {!rows.length && <div style={emptyS}>{q.trim() ? '검색 결과가 없습니다.' : '이 날 재시 대상이 없습니다.'}</div>}

        {/* 재시 날짜 미정 — 맨 위 */}
        {!!unsched.length && (
          <div style={Object.assign({}, cardS, { borderColor: K.neg })}>
            <div style={cardH}>
              <span style={{ fontSize: '15px', fontWeight: 500, color: K.neg }}>재시 날짜 미정</span>
              <span style={{ fontSize: '12.5px', color: K.muted }}>{unsched.length}명 · 날짜를 잡거나, 오늘 재시를 봤으면 바로 결과를 적으세요(오늘로 잡힙니다)</span>
            </div>
            <table style={tblS}>
              <thead><tr>
                <th style={thS(110)}>반</th><th style={thS(84)}>이름</th><th style={thS(110)}>본시험</th><th style={thS(150)}>지난 재시</th><th style={thS()}>재시 날짜 · 시간</th><th style={thS(170)}>오늘 결과</th>
              </tr></thead>
              <tbody>
                {unsched.map((x) => (
                  <tr key={rk(x.it)}>
                    <td style={Object.assign({}, tdS, { color: K.muted })}>{shortCls(clsById[x.it.c_id])}</td>
                    <td style={Object.assign({}, tdS, { fontWeight: 500, whiteSpace: 'nowrap' })}>{stuById[x.it.s_id].name}</td>
                    <td style={Object.assign({}, tdS, { color: K.muted, fontVariantNumeric: 'tabular-nums' })}>{dyMd(x.it.test_day)}({dyWd(x.it.test_day)}) · {x.it.score}</td>
                    {pastCell(x)}
                    <td style={tdS}>
                      <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button style={btnS(false)} onClick={() => moveRetest(x.it, day)}>{day === today ? '오늘' : '이 날'}로</button>
                        {mover(x)}
                      </span>
                    </td>
                    <td style={tdS}>
                      <span style={{ display: 'inline-flex', gap: '3px' }}>
                        {DY_STATUS.map((st) => <button key={st} onClick={() => saveRetest(x.it, { status: st })} style={btnS(false)}>{st}</button>)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {keys.map((g) => (
          <div key={g} style={cardS}>
            <div style={cardH}><span style={{ fontSize: '15px', fontWeight: 500 }}>{shortCls(clsById[g])}</span><span style={{ fontSize: '12.5px', color: K.muted }}>{sgOf(g)} · {(clsById[g].teachers || []).join(', ')}{clsById[g].timetable_text ? ' · ' + clsById[g].timetable_text : ''} · 재시 {groups[g].length}명</span></div>
            <table style={tblS}>
              <thead><tr>
                <th style={thS(84)}>이름</th><th style={thS(110)}>본시험</th><th style={thS(150)}>지난 재시</th>
                <th style={thS(80)}>시간</th><th style={thS(170)}>결과</th><th style={thS(60)}>점수</th><th style={thS()}>메모</th><th style={thS(90)}>재시 날짜</th>
              </tr></thead>
              <tbody>
                {groups[g].sort((a, b) => stuById[a.it.s_id].name.localeCompare(stuById[b.it.s_id].name, 'ko') || (a.it.test_day < b.it.test_day ? -1 : 1)).map((x) => {
                  const lg = x.todayLog || {};
                  return (
                    <tr key={rk(x.it)}>
                      <td style={Object.assign({}, tdS, { fontWeight: 500, whiteSpace: 'nowrap' })}>{stuById[x.it.s_id].name}</td>
                      <td style={Object.assign({}, tdS, { color: K.muted, fontVariantNumeric: 'tabular-nums' })}>{dyMd(x.it.test_day)}({dyWd(x.it.test_day)}) · {x.it.score}</td>
                      {pastCell(x)}
                      <td style={tdS}><DyText T={T} dark={dark} value={lg.time} placeholder="예: 7시" onSave={(v) => saveRetest(x.it, { time: v })} /></td>
                      <td style={tdS}>
                        <span style={{ display: 'inline-flex', gap: '3px' }}>
                          {DY_STATUS.map((st) => {
                            const on = lg.status === st;
                            // taste: 고른 결과 = 먹 바탕(선택 상태). 노랑·주황 칠은 없앴다
                            return <button key={st} onClick={() => saveRetest(x.it, { status: on ? '' : st })}
                              style={{ border: '1px solid ' + (on ? K.ink : K.control), background: on ? K.ink : 'transparent', color: on ? K.inkText : K.muted, fontWeight: on ? 500 : 400,
                                borderRadius: K.rCtl + 'px', padding: '3px 8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', transition: K.ease }}>{st}</button>;
                          })}
                        </span>
                      </td>
                      <td style={tdS}><DyText T={T} dark={dark} value={lg.score} placeholder="점수" onSave={(v) => saveRetest(x.it, { score: v })} /></td>
                      <td style={tdS}><DyText T={T} dark={dark} multi value={lg.memo} placeholder="미룸 사유 · 숙제 등" onSave={(v) => saveRetest(x.it, { memo: v })} /></td>
                      <td style={tdS}>{mover(x)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </React.Fragment>
    );
  };

  // ── 공통 모양 ──────────────────────────────────────────────────
  const emptyS = { padding: '50px 0', textAlign: 'center', color: K.muted, fontSize: '13px' };
  const cardS = { background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', marginBottom: '12px', overflow: 'visible' };
  const cardH = { display: 'flex', alignItems: 'baseline', gap: '10px', padding: '14px 16px 10px', flexWrap: 'wrap' };
  const tblS = { borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: '12.5px' };
  const thS = (w) => Object.assign({ textAlign: 'left', fontSize: '12px', fontWeight: 400, color: K.muted, background: K.surface, height: '32px', padding: '0 10px', borderBottom: '1px solid ' + K.rule, whiteSpace: 'nowrap' }, w ? { width: w + 'px' } : {});
  const tdS = { padding: '5px 10px', height: '44px', boxSizing: 'border-box', borderBottom: '1px solid ' + K.rule, verticalAlign: 'middle', lineHeight: 1.45 };
  function badge(bg, fg) { return { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500, background: bg, color: fg }; }

  // 날짜 이동 — 일요일은 건너뛴다(학원 쉬는 날)
  const stepDay = (n) => { let d = dyShift(day, n); if (dyWd(d) === '일') d = dyShift(d, n); setDay(d); };
  // taste(2026-11-12): 흰 카드 + 1px 선, 트리 행은 시안 .tr(선택 = active 회색 바탕 · 먹 글자)
  const card = { background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px' };
  const boxBtn = (open, small) => ({ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box', fontSize: '13px', height: small ? '32px' : '34px', padding: '0 10px', borderRadius: K.rCtl + 'px',
    border: 'none', background: open ? K.active : 'transparent', color: K.text, fontWeight: open ? 500 : 400, transition: K.ease });
  const caretS = (open) => ({ flex: 'none', width: '14px', textAlign: 'center', fontSize: '11px', lineHeight: '13px', color: K.muted, display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: K.ease });
  const clsRowEl = (c) => {
    const on = classIds.indexOf(c.c_id) >= 0;
    return (
      <button key={c.c_id} onClick={() => toggleClass(c.c_id)} style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: K.rCtl + 'px', height: '32px', padding: '0 10px', fontSize: '13px', background: on ? K.active : 'transparent', color: on ? K.text : K.muted, fontWeight: on ? 500 : 400, transition: K.ease }}>
        <span style={{ flex: 'none', width: '5px', height: '5px', borderRadius: '50%', background: on ? K.ink : K.muted, opacity: on ? 1 : 0.45 }}></span>
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
        <span style={{ flex: 'none', color: K.muted, fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{headN(c)}명</span>
      </button>
    );
  };

  return (
    <div data-root="" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }}>
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: K.ground, borderBottom: '1px solid ' + K.border }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span className="nav-brand" style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px' }}>SL PRIME</span>
          <span style={{ fontSize: '14px', color: K.muted, whiteSpace: 'nowrap' }}>업무일지</span>
        </div>
        <div style={{ display: 'flex', gap: '2px', padding: '2px', marginLeft: '10px', borderRadius: K.rCtl + 'px', background: K.raised }}>
          {['영어', '수학'].map((sj) => (
            <button key={sj} onClick={() => setSubject(sj)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: '0 14px', fontSize: '13px', fontWeight: subject === sj ? 500 : 400,
              background: subject === sj ? K.surface : 'transparent', color: subject === sj ? K.text : K.muted, transition: K.ease }}>{sj}</button>
          ))}
        </div>
      </nav>

      {err && <div style={{ flex: 'none', margin: '14px 20px 0', padding: '12px 14px', borderRadius: K.rCtl + 'px', background: K.surface, border: '1px solid ' + K.neg, fontSize: '13px', color: K.neg }}>{err}</div>}

      <div data-mstack="" style={{ flex: 1, minHeight: 0, display: 'flex', gap: '16px', padding: '16px 20px' }}>
        {/* 반 — 과목은 위 캡슐. 급 → 학교 → 학년 → 반(여러 개 · 수학과 중등은 급 → 학년 → 반). 안 고르면 그 과목 전체 */}
        <div data-mpane="" style={Object.assign({}, card, { flex: 'none', width: '270px', padding: '12px', overflowY: 'auto' })}>
          <WaBranchPick value={branch} onChange={setBranch} T={T} dark={dark} />
          {selCls.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
              {selCls.map((c) => (
                <button key={c.c_id} onClick={() => toggleClass(c.c_id)} title="빼기"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', padding: '3px 8px 3px 10px', fontSize: '12px', background: K.raised, color: K.text, fontWeight: 500, transition: K.ease }}>
                  <span>{c.name}</span><span style={{ fontSize: '13px', lineHeight: '13px', opacity: 0.75 }}>×</span>
                </button>
              ))}
              <button onClick={() => setClassIds([])} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: K.muted, fontFamily: 'inherit' }}>전체 해제</button>
            </div>
          ) : <div style={{ fontSize: '12px', color: K.muted, padding: '0 4px 10px' }}>반을 고르지 않으면 {branch} {subject} 전체 반이 보입니다.</div>}
          <input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="반 이름으로 찾기"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: '8px', border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '7px 10px', fontSize: '13px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none' }} />
          {!!cq.trim() && (
            <div style={{ marginBottom: '10px' }}>
              {classes.filter((c) => String(c.name).replace(/\s/g, '').indexOf(cq.trim().replace(/\s/g, '')) >= 0).sort(waClassCmp).slice(0, 12).map((c) => clsRowEl(c))}
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px 10px', cursor: 'pointer', fontSize: '13px', color: K.muted }}>
            <input type="checkbox" style={{ accentColor: K.ink }} checked={onlyMine} onChange={(e) => { setOnlyMine(e.target.checked); setClassIds([]); }} />
            <span>내 담당 반만 보기</span>
          </label>
          <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px', padding: '2px', marginBottom: '10px', borderRadius: K.rCtl + 'px', background: K.raised }}>
            {levels.map((sec) => {
              const on = sec.level === curLevel;
              return (
                <button key={sec.level} onClick={() => { setLevel(sec.level); setOpenSchool(null); setOpenGrade(null); }}
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: '0 10px', fontSize: '13px', fontWeight: on ? 500 : 400, background: on ? K.surface : 'transparent', color: on ? K.text : K.muted, transition: K.ease }}>
                  {WA_LEVEL_CHIP[sec.level] || sec.level}<span style={{ marginLeft: '4px', fontSize: '12px', color: K.muted }}>{sec.schools.length}</span>
                </button>
              );
            })}
          </div>
          {shownSchools.map((sc) => {
            const scOpen = openSchool === sc.name;
            return (
              <div key={sc.name} style={{ marginBottom: '2px' }}>
                <button onClick={() => setOpenSchool(scOpen ? null : sc.name)} style={boxBtn(scOpen)}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc.name}</span>
                  <span style={{ flex: 'none', color: K.muted, fontSize: '12px' }}>{sc.flat ? sc.grades[0].classes.length + '반' : sc.grades.length + '개 학년'}</span>
                  <span style={caretS(scOpen)}>▾</span>
                </button>
                {scOpen && (
                  <div style={{ margin: '2px 0 0 12px' }}>
                    {sc.grades.map((g) => {
                      // 학년 칸(sc.flat — 수학·중등)은 열면 반이 바로 나온다 — 안쪽 학년 버튼 없음
                      const gKey = sc.name + '|' + g.grade, gOpen = sc.flat || openGrade === gKey;
                      const allIn = g.classes.every((c) => classIds.indexOf(c.c_id) >= 0);
                      return (
                        <div key={gKey} style={{ marginBottom: '3px' }}>
                          {!sc.flat && <button onClick={() => setOpenGrade(gOpen ? null : gKey)} style={boxBtn(gOpen, true)}>
                            <span style={{ flex: 1, minWidth: 0 }}>{g.grade}</span>
                            <span style={{ flex: 'none', color: K.muted, fontSize: '12px' }}>{g.classes.length}반</span>
                            <span style={caretS(gOpen)}>▾</span>
                          </button>}
                          {gOpen && (
                            <div style={{ margin: sc.flat ? '0' : '2px 0 0 12px' }}>
                              {g.classes.length > 1 && (
                                <button onClick={() => setClassIds((c0) => { const ids = g.classes.map((c) => c.c_id); return allIn ? c0.filter((x) => ids.indexOf(x) < 0) : c0.concat(ids.filter((x) => c0.indexOf(x) < 0)); })}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', color: K.muted, padding: '3px 6px', margin: '0 0 2px 4px' }}>{allIn ? '이 학년 전체 해제' : '이 학년 전체 선택'}</button>
                              )}
                              {g.classes.map((c) => clsRowEl(c))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 그날 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={Object.assign({}, card, { flex: 'none', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' })}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button onClick={() => stepDay(-1)} title="전날" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: K.muted, fontSize: '17px', padding: '2px 8px', fontFamily: 'inherit' }}>‹</button>
              <label style={{ position: 'relative', cursor: 'pointer' }} title="날짜 고르기">
                <span style={{ fontSize: '18px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{Number(day.slice(5, 7))}월 {Number(day.slice(8))}일 ({dyWd(day)})</span>
                <input type="date" value={day} onChange={(e) => { if (e.target.value) setDay(e.target.value); }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              </label>
              <button onClick={() => stepDay(1)} title="다음 날" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: K.muted, fontSize: '17px', padding: '2px 8px', fontFamily: 'inherit' }}>›</button>
              {day !== today && <button onClick={() => setDay(today)} style={{ marginLeft: '4px', border: '1px solid ' + K.control, background: 'transparent', cursor: 'pointer', color: K.text, fontSize: '12px', height: '28px', padding: '0 10px', borderRadius: K.rCtl + 'px', fontFamily: 'inherit', transition: K.ease }}>오늘</button>}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: K.muted }}>단어 재시</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="학생 검색"
              style={{ marginLeft: 'auto', width: '150px', border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '6px 12px', fontSize: '13px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none' }} />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
            {aca === null ? <div style={emptyS}>명단 불러오는 중…</div> : retestView()}
          </div>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', left: '50%', bottom: '34px', transform: 'translateX(-50%)', background: K.ink, color: K.inkText, fontSize: '13px', padding: '10px 18px', borderRadius: K.rCtl + 'px', zIndex: 99 }}>{toast}</div>}
    </div>
  );
}
