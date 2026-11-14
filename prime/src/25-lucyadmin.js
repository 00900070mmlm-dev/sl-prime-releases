// ===== LUCY 관리 (개발자 전용) — 설정의 "LUCY 사용량" 리셋 화면 + 홈의 "LUCY 사용량" 대시보드 =====
// 데이터: scripts/lucy_admin_schema.sql 의 RPC lucy_admin_overview(달) · lucy_grant(사람, 개수, 메모).
// 둘 다 서버가 개발자인지 다시 확인한다(화면에서 숨기는 것만으로 막지 않는다).
// 비용은 기록된 실제 토큰 수 × Sonnet 5.5 단가로 계산한 추정치다(달러 → 원은 LUCY_KRW).
// 포인트색은 Claude 주황(--lc-accent, index.html) — LUCY 화면에만 쓴다(사장님 지시). 그래프는 사장님이 고른 shadcn chart 느낌(그라데이션 영역 · 점선 격자 · 툴팁 카드)을 SVG 로 직접 그린다 —
// 이 앱은 빌드가 없어 recharts 를 쓸 수 없다.

const LUCY_PRICE = { in: 2, out: 10, cr: 0.10, cw: 2.50 };   // $ / 100만 토큰 (cw = 5분 캐시 쓰기 1.25배)
const LUCY_KRW = 1400;
const LUCY_EFFORT_NAME = { low: 'Medium', medium: 'High', high: 'Extra' };   // 실제 API 값 → 화면 이름
function lucyCost(r) {
  if (!r) return 0;
  if (r.usd != null) return Number(r.usd) || 0;   // 서버가 모델 단가(Haiku/Sonnet)로 계산한 값 — lucy_archive_schema.sql 이후
  return ((Number(r.tin) || 0) * LUCY_PRICE.in + (Number(r.tout) || 0) * LUCY_PRICE.out
    + (Number(r.tcr) || 0) * LUCY_PRICE.cr + (Number(r.tcw) || 0) * LUCY_PRICE.cw) / 1e6;
}
const lucyWon = (usd) => '₩' + Math.round(usd * LUCY_KRW).toLocaleString('ko-KR');
const lucyUsd = (usd) => '$' + (usd < 10 ? usd.toFixed(2) : usd.toFixed(1));
function lucyMonthShift(m, d) { const [y, mo] = m.split('-').map(Number); const t = new Date(y, mo - 1 + d, 1); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2); }
function lucyNice(v) { if (v <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }

// ── 영역 차트 ───────────────────────────────────────────────────────
// points: [{ key, label, tip, v }] — v 가 높이. fmt 는 축·툴팁 숫자 표기.
function LucyAreaChart({ points, fmt, unit, height }) {
  const wrap = useRef(null);
  const [w, setW] = useState(640);
  const [hi, setHi] = useState(-1);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el); setW(Math.max(240, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const H = height || 220, L = 44, R = 12, T = 12, B = 26;
  const n = points.length;
  const max = lucyNice(Math.max(0, ...points.map((p) => p.v)));
  const x = (i) => L + (n <= 1 ? 0 : i * (w - L - R) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let line = '';
  points.forEach((p, i) => {
    if (!i) { line = 'M' + x(0) + ' ' + y(p.v); return; }
    const x0 = x(i - 1), y0 = y(points[i - 1].v), x1 = x(i), y1 = y(p.v), dx = (x1 - x0) / 2;
    line += ' C' + (x0 + dx) + ' ' + y0 + ' ' + (x1 - dx) + ' ' + y1 + ' ' + x1 + ' ' + y1;
  });
  const area = n ? line + ' L' + x(n - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z' : '';
  const gid = 'lucy-grad';
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - L - R) / 56))));
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round((px - L) / ((w - L - R) / Math.max(1, n - 1)));
    setHi(Math.max(0, Math.min(n - 1, i)));
  };
  const p = hi >= 0 ? points[hi] : null;
  const tipLeft = p ? Math.min(Math.max(x(hi) + 12, 0), w - 168) : 0;
  return (
    <div ref={wrap} className="lc-chart" style={{ height: H }}>
      <svg width={w} height={H} onMouseMove={onMove} onMouseLeave={() => setHi(-1)} role="img" aria-label={'날짜별 ' + unit}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--lc-accent)" stopOpacity="0.32" />
            <stop offset="95%" stopColor="var(--lc-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(max * t)} y2={y(max * t)} className={t === 0 ? 'lc-base' : 'lc-grid'} />
            <text x={L - 8} y={y(max * t) + 4} textAnchor="end" className="lc-ax">{fmt(max * t, true)}</text>
          </g>
        ))}
        {points.map((pt, i) => (i % every === 0 || i === n - 1) && (
          <text key={pt.key} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="lc-ax">{pt.label}</text>
        ))}
        {n > 0 && <path d={area} fill={'url(#' + gid + ')'} />}
        {n > 0 && <path d={line} fill="none" stroke="var(--lc-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {p && <line x1={x(hi)} x2={x(hi)} y1={T} y2={y(0)} className="lc-cross" />}
        {p && <circle cx={x(hi)} cy={y(p.v)} r="4.5" fill="var(--lc-accent)" stroke="var(--surface)" strokeWidth="2" />}
        <rect x={L} y={T} width={Math.max(0, w - L - R)} height={H - T - B} fill="transparent" />
      </svg>
      {p && (
        <div className="lc-tip" style={{ left: tipLeft, top: 8 }}>
          <div className="t">{p.tip}</div>
          {p.rows.map((r, j) => (
            <div key={j} className="r"><i style={{ background: j ? 'var(--grey)' : 'var(--lc-accent)' }}></i><span>{r[0]}</span><b className="num">{r[1]}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 질문 기록 (lucy_admin_log — scripts/lucy_archive_schema.sql) ─────────────
// 최근 순 / 비싼 순. 줄을 누르면 답이 펼쳐진다. 자주 나오는 질문·비싼 질문을 보고 답을 더 싸게 만드는 데 쓴다.
function LucyLogPanel({ month, tick }) {
  const [order, setOrder] = useState('recent');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);
  useEffect(() => { setRows(null); }, [month, order]);   // 달·정렬이 바뀔 때만 비운다(주기 갱신 때는 깜빡이지 않게)
  useEffect(() => {
    let live = true; setErr('');
    SB.rpc('lucy_admin_log', { p_month: month, p_order: order, p_limit: 40 }).then(({ data, error }) => {
      if (!live) return;
      if (error) setErr(/lucy_admin_log|schema cache|PGRST202/i.test(error.message) ? 'SQL Editor 에서 scripts/lucy_archive_schema.sql 을 한 번 실행하면 질문·답이 여기에 쌓입니다.' : error.message);
      else setRows(data || []);
    });
    return () => { live = false; };
  }, [month, order, tick]);
  const when = (t) => { const d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  return (
    <section className="tt-pnl c12 lc-dash">
      <div className="tt-ph">
        <h2>질문 기록</h2><span className="note" title="개발자만 봅니다. 학생 정보가 담길 수 있습니다. ⚡ = 빠른 조회(Haiku)">줄을 누르면 답이 펼쳐집니다 · ⚡ 빠른 조회</span>
        <span className="lc-seg" style={{ marginLeft: 'auto' }}>
          <button className={order === 'recent' ? 'on' : ''} onClick={() => setOrder('recent')}>최근 순</button>
          <button className={order === 'cost' ? 'on' : ''} onClick={() => setOrder('cost')}>비싼 순</button>
        </span>
      </div>
      {err ? <div className="tt-empty">{err}</div> : !rows ? <div className="tt-empty">불러오는 중…</div> : !rows.length ? <div className="tt-empty">이 달에 남은 질문 기록이 없습니다</div> : (
        <div className="lc-log">
          {rows.map((r) => (
            <div key={r.id} className={'lc-l' + (openId === r.id ? ' open' : '')}>
              <button className="row" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                <span className="t num">{when(r.at)}</span>
                <b className="who">{r.user_name || '—'}</b>
                <span className="eff" title={r.model || 'claude-sonnet-5-5'}>{LUCY_EFFORT_NAME[r.effort] || r.effort || ''}{r.model === 'claude-haiku-5-5' ? ' ⚡' : ''}</span>
                <span className="q">{r.question || (r.ok === false ? '(실패한 질문)' : '(질문 기록 없음 — 보관 SQL 이전)')}</span>
                <span className="st num">{r.steps ? '조회 ' + Math.max(0, r.steps - 1) : ''}</span>
                <span className={'won num' + (r.usd * LUCY_KRW >= 200 ? ' hi' : '')}>{lucyWon(Number(r.usd) || 0)}</span>
              </button>
              {openId === r.id && (
                <div className="ans">
                  {r.tools && r.tools.length > 0 && <div className="tl">{r.tools.join(' · ')}</div>}
                  <div className="tx">{r.answer || '(답 기록 없음)'}</div>
                  <div className="tk num">{r.model === 'claude-haiku-5-5' ? 'Haiku 5.5' : 'Sonnet 5.5'} · API 토큰 — 입력 {r.tin} · 캐시 읽기 {r.tcr} · 캐시 쓰기 {r.tcw} · 출력 {r.tout}{Number(r.side_usd) > 0 ? ' · 상담 요약 등 곁가지 ' + lucyWon(Number(r.side_usd)) + ' 포함' : ''}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 홈 대시보드 ─────────────────────────────────────────────────────
function LucyUsageDash({ dark }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); });
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [metric, setMetric] = useState('n');   // n = 질문 수 · cost = 비용
  // 실시간 갱신 — 화면이 보이는 동안 10초마다, 그리고 내가 LUCY 에 질문할 때마다(토큰 수가 바뀌면) 바로 다시 읽는다
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === 'visible') setTick((t) => t + 1); }, 10000);
    const bump = () => setTick((t) => t + 1);
    LUCY_Q.subs.push(bump);
    return () => { clearInterval(iv); const i = LUCY_Q.subs.indexOf(bump); if (i >= 0) LUCY_Q.subs.splice(i, 1); };
  }, []);
  const thisMonth = React.useMemo(() => { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }, []);
  useEffect(() => {
    let live = true; setErr('');
    SB.rpc('lucy_admin_overview', { p_month: month }).then(({ data: d, error }) => {
      if (!live) return;
      if (error) setErr(/lucy_admin_overview|schema cache|PGRST202/i.test(error.message) ? 'SQL Editor 에서 scripts/lucy_admin_schema.sql 을 한 번 실행해야 합니다.' : error.message);
      else setData(d);
    });
    return () => { live = false; };
  }, [month, tick]);

  const d = data && data.month === month ? data : null;
  const users = d ? d.users.filter((u) => u.budget_krw !== 0 || u.used > 0) : [];
  const perUser = {}; (d ? d.per_user : []).forEach((r) => { perUser[r.uid] = r; });
  const total = d ? d.daily.reduce((s, r) => s + Number(r.n), 0) : 0;
  const cost = d ? d.daily.reduce((s, r) => s + lucyCost(r), 0) : 0;
  const active = users.filter((u) => u.used > 0).length;
  const logged = d ? d.effort.reduce((s, e) => s + Number(e.n), 0) : 0;

  // 그 달 날짜 전부(기록 없는 날은 0) — 이번 달은 오늘까지
  const pts = [];
  if (d) {
    const [yy, mm] = month.split('-').map(Number);
    const last = month === thisMonth ? new Date().getDate() : new Date(yy, mm, 0).getDate();
    const by = {}; d.daily.forEach((r) => { by[r.day] = r; });
    for (let i = 1; i <= last; i++) {
      const key = month + '-' + ('0' + i).slice(-2), r = by[key] || { n: 0 }, c = lucyCost(r);
      pts.push({ key, label: mm + '/' + i, tip: mm + '월 ' + i + '일', v: metric === 'n' ? Number(r.n) : c * LUCY_KRW,
        rows: [['질문', Number(r.n) + '번'], ['예상 비용', lucyWon(c)]] });
    }
  }
  const fmt = metric === 'n' ? (v) => String(Math.round(v)) : (v, ax) => ax ? (v >= 1000 ? String(Math.round(v / 100) / 10).replace(/.0$/, '') + 'k' : String(Math.round(v))) : lucyWon(v / LUCY_KRW);
  const ym = (m) => { const [a, b] = m.split('-'); return a + '년 ' + Number(b) + '월'; };

  return (
    <React.Fragment>
      <section className="tt-pnl c12 lc-dash">
        <div className="tt-ph">
          <h2>LUCY 사용량</h2>
          <span className="note" title="직원 사용량 % = 지금 5시간 창에서 쓴 비용 ÷ 창 예산(관리자·강사 1,500 · 조교 500, 넘으면 Haiku). 비용은 실제 API 사용량 × 모델 단가로 계산한 추정치입니다.">{ym(month)} · 예상 비용 기준</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button className="tt-btn sm" onClick={() => setMonth(lucyMonthShift(month, -1))} aria-label="이전 달">‹</button>
            <button className="tt-btn sm" onClick={() => setMonth(thisMonth)}>이번 달</button>
            <button className="tt-btn sm" onClick={() => setMonth(lucyMonthShift(month, 1))} disabled={month >= thisMonth} aria-label="다음 달">›</button>
          </span>
        </div>
        {err ? <div className="tt-empty">{err}</div> : !d ? <div className="tt-empty">불러오는 중…</div> : (
          <React.Fragment>
            <div className="lc-kpis">
              <button className={'lc-kpi' + (metric === 'n' ? ' on' : '')} onClick={() => setMetric('n')}>
                <span className="l">질문</span><b className="num">{total.toLocaleString('ko-KR')}<small>번</small></b>
                <span className="c">{d.daily.some((r) => r.n_haiku != null) ? '빠른 조회 ' + d.daily.reduce((s, r) => s + Number(r.n_haiku || 0), 0) + '번' : '이번 달 합계'}{d.failed ? ' · 실패 ' + d.failed + '번' : ''}</span>
              </button>
              <button className={'lc-kpi' + (metric === 'cost' ? ' on' : '')} onClick={() => setMetric('cost')}>
                <span className="l">예상 비용</span><b className="num">{lucyWon(cost)}</b>
                <span className="c">{lucyUsd(cost)} · 1달러 {LUCY_KRW.toLocaleString('ko-KR')}원</span>
              </button>
              <div className="lc-kpi">
                <span className="l">쓴 직원</span><b className="num">{active}<small>/ {users.filter((u) => u.budget_krw !== 0).length}명</small></b>
                <span className="c">이번 달 1번 이상</span>
              </div>
              <div className="lc-kpi">
                <span className="l">질문당 평균</span><b className="num">{total ? lucyWon(cost / total) : '—'}</b>
                <span className="c">{total ? 'API 토큰 약 ' + Math.round(d.daily.reduce((s, r) => s + Number(r.tin) + Number(r.tout) + Number(r.tcr) + Number(r.tcw), 0) / total).toLocaleString('ko-KR') + '개' : '아직 기록 없음'}</span>
              </div>
            </div>
            <LucyAreaChart points={pts} fmt={fmt} unit={metric === 'n' ? '질문 수' : '비용'} height={230} />
          </React.Fragment>
        )}
      </section>

      {d && !err && (
        <section className="tt-pnl c8 lc-dash">
          <div className="tt-ph"><h2>직원별</h2><span className="chip">{users.length}명</span><span className="note">지금 5시간 창 사용량 · 이번 달 질문 수</span></div>
          <div className="lc-users">
            {users.map((u) => {
              const g = permGroupKey(u.perms), unl = u.budget_krw == null, p = unl ? 0 : Number(u.pct) || 0;
              const c = lucyCost(perUser[u.uid]);
              return (
                <div key={u.uid} className="lc-u">
                  <div className="who"><b>{u.name || EMAIL_TO_NAME[u.email] || u.email}</b><span>{g}</span></div>
                  {unl ? <div className="lc-inf">무제한</div> : <div className={'lc-meter' + (p >= 100 ? ' full' : '')}><i style={{ width: Math.min(100, p) + '%' }}></i></div>}
                  <div className="fig num"><b>{unl ? u.used + '번' : lucyPctText(p)}</b><span>{unl ? '' : u.used + '번'}</span></div>
                  <div className="fig num cost">{c ? lucyWon(c) : '—'}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {d && !err && (
        <section className="tt-pnl c4 lc-dash">
          <div className="tt-ph"><h2>노력 단계</h2><span className="note">기록된 질문 {logged}번</span></div>
          {['low', 'medium', 'high'].map((k) => {
            const e = d.effort.find((x) => x.effort === k) || { n: 0, tout: 0 };
            const share = logged ? Number(e.n) / logged * 100 : 0;
            return (
              <div key={k} className="tt-mr" style={{ gridTemplateColumns: "64px 1fr auto" }}>
                <span className="q">{LUCY_EFFORT_NAME[k]}</span>
                <div className="t"><i style={{ width: share + '%' }}></i></div>
                <span className="n num" style={{ width: 'auto', whiteSpace: 'nowrap' }}>{e.n}번 · {lucyWon(Number(e.usd) || 0)}</span>
              </div>
            );
          })}
          <div className="tt-ph" style={{ marginTop: 22 }}><h2>최근 리셋</h2></div>
          {!d.grants.length && <div className="tt-empty">아직 리셋 기록이 없습니다 — 설정 → LUCY 사용량</div>}
          <div className="lc-grants">
            {d.grants.slice(0, 6).map((g, i) => (
              <div key={i} className="lc-g">
                <b>{g.user_name}</b><span className="num pos">{g.amount >= 100 ? '전부' : g.amount + '%'} 리셋</span>
                <em>{String(g.at).slice(5, 10).replace('-', '/')}{g.note ? ' · ' + g.note : ''}</em>
              </div>
            ))}
          </div>
        </section>
      )}
      {d && !err && <LucyLogPanel month={month} tick={tick} />}
    </React.Fragment>
  );
}

// ── 설정: LUCY 사용량 리셋 (개발자) ─────────────────────────────────────
// 사람을 골라 10% · 30% · 50% · 전부 — 그 비율만큼 이번 달 사용량을 깎아 준다(lucy_reset, 0% 아래로는 안 내려감).
const LUCY_RESET_STEPS = [10, 30, 50, 100];
function SettingsLucyGrant({ dark }) {
  const K = TT(dark);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);       // uid
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => SB.rpc('lucy_admin_overview', {}).then(({ data, error }) => {
    if (error) setErr(/lucy_admin_overview|schema cache|PGRST202/i.test(error.message) ? 'SQL Editor 에서 scripts/lucy_window_schema.sql 을 한 번 실행해야 합니다.' : error.message);
    else if (data && data.users && data.users.length && data.users[0].resets_at === undefined) setErr('SQL Editor 에서 scripts/lucy_window_schema.sql 을 한 번 실행해야 5시간 사용량 리셋을 쓸 수 있습니다.');
    else setD(data);
  });
  useEffect(() => { load(); }, []);
  const users = d ? d.users.filter((u) => u.budget_krw !== 0).slice().sort((a, b) =>
    Object.keys(PERM_GROUPS).indexOf(permGroupKey(a.perms)) - Object.keys(PERM_GROUPS).indexOf(permGroupKey(b.perms)) || String(a.name).localeCompare(String(b.name), 'ko')) : [];
  const u = users.find((x) => x.uid === sel);
  const pctOf = (x) => (x.budget_krw == null ? null : Number(x.pct) || 0);
  const reset = (p) => {
    if (!u) return;
    setBusy(true); setMsg('');
    SB.rpc('lucy_reset', { p_uid: u.uid, p_pct: p, p_note: note.trim() }).then(({ data, error }) => {
      setBusy(false);
      if (error) { setMsg('실패 — ' + error.message); return; }
      setMsg((u.name || u.email) + ' 님 ' + (p === 100 ? '사용량 전부' : p + '%') + ' 리셋 · 지금 5시간 사용량 ' + lucyPctText(Number(data.pct) || 0));
      setNote(''); load(); lucyRefresh();
    });
  };
  const chip = (active) => ({ height: 30, padding: '0 12px', borderRadius: K.rCtl, border: '1px solid ' + (active ? K.ink : K.control), background: active ? K.ink : K.surface,
    color: active ? K.inkText : K.text, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', transition: K.ease });
  const inp = { height: 34, padding: '0 10px', borderRadius: K.rCtl, border: '1px solid ' + K.control, background: K.surface, color: K.text, fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: K.text }}>LUCY 사용량 리셋</div>
      <div style={{ fontSize: 13, color: K.muted, marginBottom: 14, lineHeight: 1.55 }}>
        사람을 고르고 <b style={{ color: K.text, fontWeight: 600 }}>10% · 30% · 50% · 전부</b> 중 하나를 누르면 지금 5시간 창의 사용량을 그만큼 깎아 줍니다(0% 아래로는 내려가지 않습니다).
        창 하나(처음 질문한 때부터 5시간)에 관리자·강사 1,500원 · 조교 500원어치가 100%이고, 넘으면 막지 않고 빠른 모델(Haiku)로 답합니다.
      </div>
      {err ? <div style={{ fontSize: 13, color: K.neg }}>{err}</div> : !d ? <div style={{ fontSize: 13, color: K.muted }}>불러오는 중…</div> : (
        <React.Fragment>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {users.map((x) => {
              const p = pctOf(x);
              return (
                <button key={x.uid} onClick={() => { setSel(x.uid); setMsg(''); }} style={chip(sel === x.uid)} title={x.email}>
                  {x.name || EMAIL_TO_NAME[x.email] || x.email} <span style={{ opacity: 0.6, fontSize: 12 }}>{p == null ? '무제한' : lucyPctText(p)}</span>
                </button>
              );
            })}
          </div>
          {!u ? <div style={{ fontSize: 13, color: K.muted }}>위에서 사람을 고르세요.</div> : (
            <div style={{ border: '1px solid ' + K.border, borderRadius: K.rCard, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                <b style={{ fontSize: 15, color: K.text }}>{u.name || u.email}</b>
                <span style={{ fontSize: 12.5, color: K.muted }}>{permGroupKey(u.perms)}{u.budget_krw == null ? ' · 무제한' : ' · 5시간 사용량 ' + lucyPctText(pctOf(u)) + (u.resets_at ? ' · ' + lucyHm(u.resets_at) + ' 충전' : '') + ' · 이번 달 질문 ' + u.used + '번'}</span>
              </div>
              {u.budget_krw == null ? <div style={{ fontSize: 13, color: K.muted }}>개발자는 무제한이라 리셋할 필요가 없습니다.</div> : (
                <React.Fragment>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모 (선택) — 예: 시험 기간" style={Object.assign({}, inp, { width: '100%' })} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {LUCY_RESET_STEPS.map((p) => (
                      <button key={p} disabled={busy} onClick={() => reset(p)} style={p === 100
                        ? { height: 34, padding: '0 16px', borderRadius: K.rCtl, border: 'none', background: K.ink, color: K.inkText, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.5 : 1 }
                        : Object.assign(chip(false), { height: 34, opacity: busy ? 0.5 : 1 })}>{p === 100 ? '전부 리셋' : p + '% 리셋'}</button>
                    ))}
                  </div>
                </React.Fragment>
              )}
              {msg && <div style={{ marginTop: 10, fontSize: 13, color: /^실패/.test(msg) ? K.neg : K.pos }}>{msg}</div>}
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}
