// 대시보드 — 강사별 수강생 수 추이(2026-10-30 사장님). 원장·관리자·개발자만 본다(권한 키 'dashboard').
//
// 숫자는 전부 ACA2000 동기화 원본(aca_raw_enroll · aca_raw_class · aca_raw_classinfo)에서 **여기서 계산**한다.
// 어느 날짜 D 의 수강생 = 그 날 수강 중인 등록(시작일 ≤ D, 종료일 없거나 ≥ D, 삭제 안 됨)을
// 그 반의 **그 날짜 담임**(GetClassInfo.teacherM 의 기간)에게 붙여 **사람 수로** 센다(두 반을 들으면 한 명).
// 담임이 둘인 반은 양쪽에 한 명씩. 관리용 반(휴원목록·전반처리 …)은 뺀다.
//
// **담임 미상을 두지 않는다**(2026-10-30 사장님 — "담임 미상은 없어야 한다"). ACA2000 의 담임 칸은 2024~2026년에
// 뒤늦게 등록된 반이 많고 그때 등록한 날이 그대로 '담임 시작일'로 들어가 있어서, 날짜 그대로만 보면 2024년 이전은
// 절반 넘게 담임이 비는다(실측). 그래서 그 날짜에 담임 기록이 없으면 **그 반의 가장 가까운 담임 기록**(뒤 → 앞) →
// 반 이름의 (xxT) → 담당(teacherS) 순으로 붙인다. 옛 숫자는 그만큼 추정치다 — 각주로 알린다.
//
// 그래프는 동시에 **8명까지**만 겹쳐 그린다(색 8개 — 9번째부터는 눈으로 못 가른다). 나머지는 아래
// 강사별 작은 그래프(같은 눈금)와 표로 본다. 색은 강사 이름에 고정이라 고르는 사람이 바뀌어도 색이 안 바뀐다.

const DB_PAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
const DB_MAX_LINES = 8;
const DB_UNITS = [{ k: 'w', label: '주별' }, { k: 'm', label: '월별' }, { k: 'q', label: '3개월' }, { k: 'h', label: '6개월' }, { k: 'y', label: '연별' }];

/** 로컬 날짜 → 'YYYY-MM-DD' (toISOString 은 UTC 라 한국 밤에 하루 전으로 간다) */
function dbYmd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dbDate(ymd) { const p = String(ymd || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
function dbMonthEnd(y, m0) { return new Date(y, m0 + 1, 0); }   // m0: 0~11

/** PostgREST 는 한 번에 1000행 — 다 받을 때까지 넘긴다. */
async function dbAll(table, select) {
  const out = []; let from = 0; const PAGE = 1000;
  for (;;) {
    const { data, error } = await SB.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/** 반 이름에 적힌 담임 — "(주연T)" 꼴만(lib/aca.js 의 nameTeacher 와 같은 규칙). */
function dbNameTeacher(cName) {
  const m = String(cName || '').match(/[(\[（]\s*([가-힣]{2,4})\s*T\s*[)\]）]/);
  return m ? m[1] : '';
}

/** 날짜 D 에 그 반의 담임들 — 그 날짜 담임 기록 → 가장 가까운 담임 기록(뒤 먼저, 없으면 앞) → 반 이름의 (xxT) → 그 날짜 담당(teacherS). */
function dbTeachersAt(tm, ts, cName, D) {
  const names = (a) => Array.from(new Set(a.map((t) => String(t.tName || '').trim()).filter(Boolean)));
  const at = (a) => (a || []).filter((t) => t && (t.startDate || '') <= D && (!t.endDate || t.endDate >= D));
  const hit = names(at(tm));
  if (hit.length) return hit;
  const later = (tm || []).filter((t) => t && (t.startDate || '') > D).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  if (later.length) return names([later[0]]);
  const before = (tm || []).filter((t) => t && t.endDate && t.endDate < D).sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
  if (before.length) return names([before[0]]);
  const n = dbNameTeacher(cName); if (n) return [n];
  return names(at(ts));
}

/** 날짜 D 의 강사별 수강생 수(사람 수) + 담임 미상 수 */
function dbCountAt(raw, D) {
  const by = {}; const noT = new Set();
  for (const e of raw.enroll) {
    if (e.del_date) continue;
    if ((e.start_date || '') > D) continue;
    if (e.end_date && e.end_date < D) continue;
    const c = raw.clsBy[e.c_id];
    if (!c || RS_HIDDEN.test(c.c_name || '')) continue;
    const ts = dbTeachersAt(raw.tmBy[e.c_id], raw.tsBy[e.c_id], c.c_name, D);
    if (!ts.length) { noT.add(e.s_id); continue; }
    for (const t of ts) (by[t] = by[t] || new Set()).add(e.s_id);
  }
  const out = {}; Object.keys(by).forEach((t) => { out[t] = by[t].size; });
  return { by: out, noT: noT.size };
}

/** 단위별 기간 끝 날짜들. 오늘을 넘는 마지막 칸은 오늘로 당기고 partial 표시. */
function dbPeriods(unit, from, to, today) {
  const out = [];
  const push = (label, end, startYmd) => {
    let D = dbYmd(end); let partial = false;
    if (D < from || startYmd > to) return;
    if (D > today) { if (startYmd > today) return; D = today; partial = true; }
    else if (D > to) { D = to; partial = true; }
    out.push({ label, D, partial });
  };
  const f = dbDate(from), t = dbDate(to);
  if (unit === 'w') {
    // 주 = 월요일~일요일. from 이 든 주의 일요일부터.
    const d = new Date(f); d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    for (;; d.setDate(d.getDate() + 7)) {
      const s = new Date(d); s.setDate(s.getDate() - 6);
      if (dbYmd(s) > to) break;                            // 주 시작이 기간을 넘으면 끝(진행 중인 주는 push 가 오늘로 당긴다)
      push((d.getFullYear() % 100) + '.' + (d.getMonth() + 1) + '.' + d.getDate(), new Date(d), dbYmd(s));
    }
  } else {
    const step = unit === 'm' ? 1 : unit === 'q' ? 3 : unit === 'h' ? 6 : 12;
    let y = f.getFullYear(), m0 = unit === 'm' ? f.getMonth() : Math.floor(f.getMonth() / step) * step;
    for (;;) {
      const end = dbMonthEnd(y, m0 + step - 1);
      if (new Date(y, m0, 1) > t) break;
      const label = unit === 'm' ? (y % 100) + '.' + String(m0 + 1).padStart(2, '0')
        : unit === 'q' ? y + ' ' + (m0 / 3 + 1) + '분기'
        : unit === 'h' ? y + ' ' + (m0 ? '하반기' : '상반기')
        : String(y);
      push(label, end, dbYmd(new Date(y, m0, 1)));
      m0 += step; if (m0 >= 12) { m0 -= 12; y++; }
    }
  }
  return out;
}

function dbKo(a, b) { return String(a).localeCompare(String(b), 'ko'); }

// ── 선 그래프(SVG) — 교차선 + 툴팁 ──
function DbLineChart({ labels, series, partialLast, yMax, height, T, dark, compact }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(600);
  const [hi, setHi] = useState(-1);
  const clipId = useRef('dbclip' + Math.random().toString(36).slice(2, 8)).current;
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600));
    ro.observe(el); setW(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);
  const H = height || 320;
  const padL = compact ? 28 : 40, padR = 12, padT = 12, padB = compact ? 20 : 28;
  const n = labels.length;
  const x = (i) => padL + (n <= 1 ? 0 : (w - padL - padR) * i / (n - 1));
  const yy = (v) => padT + (H - padT - padB) * (1 - v / (yMax || 1));
  const ticks = []; { const step = yMax <= 20 ? 5 : yMax <= 60 ? 10 : yMax <= 150 ? 25 : yMax <= 300 ? 50 : 100; for (let v = 0; v <= yMax; v += step) ticks.push(v); }
  // x 눈금은 글자가 안 겹칠 만큼만
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((w - padL - padR) / (compact ? 60 : 64)))));
  const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const axis = T.textFaint;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect(); const px = e.clientX - r.left;
    let best = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } }
    setHi(best);
  };
  const tipLeft = hi >= 0 ? Math.min(Math.max(x(hi) + 12, 0), w - 180) : 0;
  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg width={w} height={H} style={{ display: 'block', overflow: 'visible' }} onMouseMove={onMove} onMouseLeave={() => setHi(-1)}>
        <defs><clipPath id={clipId}><rect x={padL - 4} y={padT - 4} width={w - padL - padR + 8} height={H - padT - padB + 8} /></clipPath></defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={w - padR} y1={yy(v)} y2={yy(v)} stroke={grid} strokeWidth="1" />
            <text x={padL - 6} y={yy(v) + 4} textAnchor="end" fontSize={compact ? 10 : 11} fill={axis}>{v}</text>
          </g>
        ))}
        {labels.map((l, i) => (i === n - 1 || (i % every === 0 && n - 1 - i > every * 0.6)) ? (
          <text key={i} x={x(i)} y={H - padB + 16} textAnchor={i === n - 1 && n > 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize={compact ? 10 : 11} fill={axis}>{l}{partialLast && i === n - 1 ? '*' : ''}</text>
        ) : null)}
        {hi >= 0 ? <line x1={x(hi)} x2={x(hi)} y1={padT} y2={H - padB} stroke={T.textFaint} strokeWidth="1" strokeDasharray="3 3" /> : null}
        <g clipPath={'url(#' + clipId + ')'}>
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : [x(i), yy(v)]));
          let d = ''; pts.forEach((p, i) => { if (!p) return; d += (i === 0 || !pts[i - 1] ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' '; });
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {hi >= 0 && pts[hi] ? <circle cx={pts[hi][0]} cy={pts[hi][1]} r="4" fill={s.color} stroke={dark ? '#1a1a19' : '#fff'} strokeWidth="2" /> : null}
            </g>
          );
        })}
        </g>
      </svg>
      {hi >= 0 && !compact ? (
        <div style={{ position: 'absolute', left: tipLeft, top: padT, pointerEvents: 'none', background: dark ? 'rgba(30,30,32,0.96)' : 'rgba(255,255,255,0.97)',
          border: '1px solid ' + T.divider, borderRadius: 10, padding: '8px 11px', fontSize: 12, lineHeight: 1.6, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: 150 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{labels[hi]}{partialLast && hi === n - 1 ? ' (진행 중)' : ''}</div>
          {series.slice().sort((a, b) => (b.values[hi] || 0) - (a.values[hi] || 0)).map((s) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ color: T.textDim, flex: 1 }}>{s.name}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.values[hi] == null ? '—' : s.values[hi]}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DashboardApp({ dark, onHome }) {
  const T = THEME(dark);
  const PC = '#0066cc';
  const today = dbYmd(new Date());
  const [raw, setRaw] = useState(null);
  const [err, setErr] = useState('');
  const [sync, setSync] = useState(null);
  const [unit, setUnit] = useState('m');
  const [from, setFrom] = useState('2022-01-01');
  const [to, setTo] = useState(today);
  const [onlyCurrent, setOnlyCurrent] = useState(true);   // 현재 수업 있는 강사만(퇴사 제외)
  const [picked, setPicked] = useState(null);             // 겹쳐 그릴 강사들(null = 아직 안 고름 → 상위 8명)

  useEffect(() => {
    Promise.all([
      dbAll('aca_raw_enroll', 's_id,c_id,start_date,end_date,del_date'),
      dbAll('aca_raw_class', 'c_id,c_name'),
      dbAll('aca_raw_classinfo', 'c_id,teacher_m,teacher_s'),
      SB.from('aca_sync').select('started_at,ok').order('started_at', { ascending: false }).limit(1),
    ]).then(([enroll, cls, info, y]) => {
      const clsBy = {}; cls.forEach((c) => { clsBy[c.c_id] = c; });
      const tmBy = {}, tsBy = {};
      info.forEach((i) => { tmBy[i.c_id] = Array.isArray(i.teacher_m) ? i.teacher_m : []; tsBy[i.c_id] = Array.isArray(i.teacher_s) ? i.teacher_s : []; });
      setRaw({ enroll, clsBy, tmBy, tsBy });
      setSync(((y && y.data) || [])[0] || null);
    }).catch((e) => setErr(String((e && e.message) || e)));
  }, []);

  // 오늘 기준 — '현재 수업이 있는 강사' 판정
  const nowBy = React.useMemo(() => (raw ? dbCountAt(raw, today).by : {}), [raw]);
  const periods = React.useMemo(() => dbPeriods(unit, from, to, today), [unit, from, to]);
  const counts = React.useMemo(() => (raw ? periods.map((p) => dbCountAt(raw, p.D)) : []), [raw, periods]);

  const everyone = React.useMemo(() => {
    const s = new Set(); counts.forEach((c) => Object.keys(c.by).forEach((t) => s.add(t))); Object.keys(nowBy).forEach((t) => s.add(t));
    return Array.from(s);
  }, [counts, nowBy]);
  const last = counts.length ? counts[counts.length - 1].by : {};
  const teachers = everyone
    .filter((t) => !onlyCurrent || (nowBy[t] || 0) > 0)
    .sort((a, b) => (last[b] || 0) - (last[a] || 0) || (nowBy[b] || 0) - (nowBy[a] || 0) || dbKo(a, b));
  const shown = (picked ? teachers.filter((t) => picked.has(t)) : teachers.slice(0, DB_MAX_LINES));
  // 색은 **겹쳐 그리는 강사들 안에서** 가나다순으로 준다 — 8색뿐이라 15명 전원에게 고정색을 줄 수 없고,
  // 같은 화면에 같은 색이 둘 있으면 선을 못 가른다(처음엔 이름순 슬롯이라 진성혁·박성민이 둘 다 분홍이었다).
  const colorOf = React.useMemo(() => {
    const m = {}; const pal = DB_PAL[dark ? 'dark' : 'light'];
    shown.slice().sort(dbKo).forEach((t, i) => { m[t] = pal[i % pal.length]; });
    return m;
  }, [shown.join('|'), dark]);
  const smallColor = (t) => colorOf[t] || T.textDim;   // 안 겹치는 강사의 작은 그래프는 회색 — 혼자라 색이 필요 없다
  const togglePick = (t) => {
    const s = new Set(picked || shown);
    if (s.has(t)) s.delete(t); else if (s.size < DB_MAX_LINES) s.add(t);
    setPicked(s);
  };
  const labels = periods.map((p) => p.label);
  const partialLast = periods.length > 0 && periods[periods.length - 1].partial;
  const valuesOf = (t) => counts.map((c) => c.by[t] || 0);
  // y 축은 **강사 선만** 보고 잡는다 — 담임 미상(수백 명)까지 담으면 강사 선이 바닥에 깔린다(2026-10-30 사장님: 최대 150).
  // 강사 하나가 150 을 넘으면 그만큼만 올린다. 담임 미상 선은 넘치는 부분이 위에서 잘린다(툴팁엔 값이 나온다).
  const niceMax = (v) => { const step = v <= 150 ? 25 : v <= 300 ? 50 : 100; return Math.ceil(v / step) * step; };
  const yMaxAll = Math.max(150, niceMax(Math.max(0, ...teachers.map((t) => Math.max(0, ...valuesOf(t))))));
  const series = shown.map((t) => ({ name: t, color: colorOf[t], values: valuesOf(t) }));

  const stale = !sync || !sync.ok || (Date.now() - new Date(sync.started_at).getTime()) / 3600000 > 25;
  const syncText = sync ? new Date(sync.started_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + (sync.ok ? '' : ' · 실패') : '기록 없음';
  const preset = (k) => {
    const d = new Date();
    if (k === '1y') d.setFullYear(d.getFullYear() - 1); else if (k === '2y') d.setFullYear(d.getFullYear() - 2); else if (k === '6m') d.setMonth(d.getMonth() - 6);
    setFrom(k === '2022' ? '2022-01-01' : dbYmd(d)); setTo(today);
  };
  const card = { background: dark ? 'rgba(255,255,255,0.04)' : '#fff', border: '1px solid ' + T.divider, borderRadius: 14, padding: '16px 18px' };
  const pill = (on) => ({ padding: '6px 13px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid ' + (on ? PC : T.divider), background: on ? PC : 'transparent', color: on ? '#fff' : T.text });
  const inputS = { font: 'inherit', fontSize: 13, padding: '5px 8px', borderRadius: 8, border: '1px solid ' + T.divider, background: dark ? 'rgba(255,255,255,0.05)' : '#fff', color: T.text, colorScheme: dark ? 'dark' : 'light' };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid ' + T.divider }}>
        <button onClick={onHome} style={{ padding: '6px 13px', borderRadius: 9, border: '1px solid ' + T.divider, background: 'transparent', color: T.text, font: 'inherit', fontSize: 13, cursor: 'pointer' }}>← 홈</button>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.4px' }}>대시보드</div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: stale ? '#c0392b' : T.textFaint }}>{stale ? '⚠ ' : ''}동기화 {syncText}</span>
      </div>

      {err ? <div style={{ padding: 24, color: '#c0392b', fontSize: 13.5 }}>불러오지 못했습니다 — {err}</div> : null}
      {!raw && !err ? <div style={{ padding: 40, textAlign: 'center', color: T.textDim, fontSize: 13.5 }}>불러오는 중…</div> : null}

      {raw ? (
        <div style={{ padding: '16px 24px 60px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>강사별 수강생 수</div>

          {/* 필터는 한 줄 — 단위 · 기간 · 강사 범위 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {DB_UNITS.map((u) => <button key={u.k} onClick={() => setUnit(u.k)} style={pill(unit === u.k)}>{u.label}</button>)}
            <span style={{ width: 1, height: 22, background: T.divider, margin: '0 4px' }} />
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} style={inputS} />
            <span style={{ color: T.textFaint }}>~</span>
            <input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} style={inputS} />
            {[['6m', '최근 6개월'], ['1y', '최근 1년'], ['2y', '최근 2년'], ['2022', '2022년부터']].map(([k, l]) => (
              <button key={k} onClick={() => preset(k)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + T.divider, background: 'transparent', color: T.textDim }}>{l}</button>
            ))}
            <span style={{ width: 1, height: 22, background: T.divider, margin: '0 4px' }} />
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyCurrent} onChange={(e) => { setOnlyCurrent(e.target.checked); setPicked(null); }} /> 현재 수업 있는 강사만
            </label>
          </div>

          <div style={card}>
            {/* 범례 = 고르기. 8명까지 겹쳐 그린다 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
              {teachers.map((t) => {
                const on = shown.includes(t); const full = !on && shown.length >= DB_MAX_LINES;
                return (
                  <button key={t} onClick={() => togglePick(t)} title={full ? '동시에 ' + DB_MAX_LINES + '명까지 — 하나를 끄고 고르세요' : (on ? '끄기' : '겹쳐 보기')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 7px', borderRadius: 8, fontSize: 12.5, cursor: full ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      border: '1px solid ' + (on ? colorOf[t] : T.divider), background: on ? (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent', color: on ? T.text : T.textFaint, opacity: full ? 0.5 : 1 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: on ? colorOf[t] : T.textFaint, opacity: on ? 1 : 0.35 }} />
                    {t}<span style={{ color: T.textFaint, fontVariantNumeric: 'tabular-nums' }}>{last[t] || 0}</span>
                  </button>
                );
              })}
              {picked ? <button onClick={() => setPicked(null)} style={{ border: 0, background: 'transparent', color: T.textFaint, cursor: 'pointer', font: 'inherit', fontSize: 12 }}>상위 {DB_MAX_LINES}명으로</button> : null}
            </div>
            {periods.length ? (
              <DbLineChart labels={labels} series={series} partialLast={partialLast} yMax={yMaxAll} height={340} T={T} dark={dark} />
            ) : <div style={{ padding: 30, textAlign: 'center', color: T.textDim, fontSize: 13 }}>기간 안에 들어가는 칸이 없습니다.</div>}
            <div style={{ marginTop: 8, fontSize: 12, color: T.textFaint, lineHeight: 1.6 }}>
              각 칸의 마지막 날 기준 수강생 수(사람 수). {partialLast ? '* 마지막 칸은 오늘(' + today + ')까지. ' : ''}
              ACA2000 에 담임이 등록돼 있지 않던 기간은 그 반의 가장 가까운 시기 담임에게 붙입니다 — 담임 등록이 늦었던 2024년 이전은 그만큼 추정치입니다.
            </div>
          </div>

          {/* 강사별 작은 그래프 — 같은 눈금. 겹쳐 그리지 못한 강사도 여기서 본다 */}
          <div style={{ fontSize: 14, fontWeight: 700, margin: '22px 0 10px' }}>강사별 <span style={{ fontWeight: 400, color: T.textFaint, fontSize: 12 }}>· 같은 눈금 · 이름 옆은 마지막 칸 기준</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
            {teachers.map((t) => (
              <div key={t} style={Object.assign({}, card, { padding: '12px 14px 8px' })}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: smallColor(t), alignSelf: 'center' }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{t}</span>
                  <b style={{ marginLeft: 'auto', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{last[t] || 0}</b>
                  <span style={{ fontSize: 11, color: T.textFaint }}>명</span>
                </div>
                <DbLineChart labels={labels} series={[{ name: t, color: smallColor(t), values: valuesOf(t) }]} partialLast={partialLast} yMax={yMaxAll} height={120} T={T} dark={dark} compact />
              </div>
            ))}
          </div>

          {/* 표 — 그래프와 같은 숫자 */}
          <div style={{ fontSize: 14, fontWeight: 700, margin: '22px 0 10px' }}>표</div>
          <div style={Object.assign({}, card, { padding: 0, overflow: 'auto', maxHeight: 520 })}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12.5, minWidth: '100%', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 2, textAlign: 'left', padding: '8px 12px', background: dark ? '#26262a' : '#f5f5f7', borderBottom: '1px solid ' + T.divider }}>기간</th>
                  {teachers.map((t) => <th key={t} style={{ position: 'sticky', top: 0, textAlign: 'right', padding: '8px 10px', background: dark ? '#26262a' : '#f5f5f7', borderBottom: '1px solid ' + T.divider, fontWeight: 600 }}>{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={p.D}>
                    <td style={{ position: 'sticky', left: 0, padding: '6px 12px', background: dark ? '#1e1e21' : '#fff', borderBottom: '1px solid ' + T.divider, fontWeight: 600 }}>{p.label}{p.partial ? '*' : ''}</td>
                    {teachers.map((t) => <td key={t} style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid ' + T.divider, fontVariantNumeric: 'tabular-nums', color: counts[i].by[t] ? T.text : T.textFaint }}>{counts[i].by[t] || 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
