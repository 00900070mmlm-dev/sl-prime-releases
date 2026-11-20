// ============================================================
// 신입생 상담 (홈 → 신입생 상담)
//
// 2026-11-15 사장님: "신입생 상담 어플 만들자 — 입학테스트 시험지 인쇄 및 입학테스트 아카이빙, 성적 바탕으로 즉석 레포트 생성" ·
// "양식은 우리 주간테스트에 쓰는 양식으로(대신 채점은 학생이 하지 않아)".
//
// 하는 일 셋:
//   ① 입학테스트 시험지를 주간테스트와 같은 평가원 양식(표지·백지·2단 시험지)으로 펼쳐 인쇄한다(13-weekly.js 의 WeeklyTestSheets).
//      채점 링크를 쓰지 않으므로 표지에 QR 이 없다.
//   ② 신입생마다 문항별 맞음/틀림을 선생님이 눌러 넣는다 → entry_results 에 쌓인다(아카이빙).
//   ③ 그 정오에서 한 장짜리 레포트를 그 자리에서 만든다 — 총점 · PART별 · 단어 수준별 · 어법/독해 유형별. 화면으로 보여 주고 인쇄한다.
//
// 시험지는 **DB(entry_tests.payload)에 있다.** 앱(app/**)은 공개 레포로 나가므로 코드에 문항을 넣으면 입학테스트가 공개된다.
// 신입생은 아직 ACA 명단에 없어서 이름·학교·학년·연락처를 직접 적는다.
// 스키마: scripts/entry_schema.sql. 시험지 JSON 을 만드는 법: scripts/entry/README.md.
// ============================================================

const EN_SUBJECTS = ['영어', '수학'];

/** 시험지 payload → 채점 칸 목록. 칸의 키: 단어 'w<수준>-<번호>' · 문항 '<PART>-<번호>'. */
function enCells(pl) {
  const cells = [];
  ((pl && pl.words) || []).forEach((w) => cells.push({ key: 'w' + w.lv + '-' + w.no, part: 1, group: 'Lv ' + w.lv, no: w.no, label: w.en, answer: w.ko, type: '단어 Lv ' + w.lv }));
  ((pl && pl.items) || []).forEach((it) => cells.push({ key: it.part + '-' + it.no, part: it.part, group: '', no: it.no, label: '', answer: typeof it.answer === 'number' ? wtCirc(it.answer) : String(it.answer == null ? '' : it.answer), type: it.type || '' }));
  return cells;
}
function enPartMeta(pl, part) { return (((pl && pl.parts) || []).filter((p) => p.part === part)[0]) || { part: part, name: 'PART ' + part, each: 1, total: 0 }; }

/** 정오 → 점수. 매기지 않은 칸은 세지 않는다(blank 로 따로 센다). */
function enScore(pl, marks) {
  const cells = enCells(pl), parts = {}, types = {};
  let score = 0, blank = 0;
  cells.forEach((c) => {
    const meta = enPartMeta(pl, c.part), v = marks ? marks[c.key] : undefined;
    const P = parts[c.part] || (parts[c.part] = { part: c.part, name: meta.name, each: meta.each, total: 0, got: 0, right: 0, n: 0, blank: 0 });
    P.total += meta.each; P.n += 1;
    const T = types[c.part + '|' + c.type] || (types[c.part + '|' + c.type] = { part: c.part, type: c.type, n: 0, right: 0, wrong: [] });
    T.n += 1;
    if (v === 1) { P.got += meta.each; P.right += 1; T.right += 1; score += meta.each; }
    else if (v === 0) T.wrong.push(c.no);
    else { blank += 1; P.blank += 1; }
  });
  const order = Object.keys(parts).map(Number).sort((a, b) => a - b).map((k) => parts[k]);
  return { score: score, total: order.reduce((s, p) => s + p.total, 0), blank: blank, parts: order, types: Object.keys(types).map((k) => types[k]) };
}

/** 레포트의 글 — 점수에서 나오는 사실만 적는다. 약속하는 말("보강하겠습니다")은 넣지 않는다(선생님이 한마디 칸에 적는다). */
function enNotes(sc) {
  const strong = [], weak = [];
  sc.parts.forEach((p) => { const r = p.total ? p.got / p.total : 0; if (r >= 0.8) strong.push(p.name + ' ' + p.got + '/' + p.total); else if (r < 0.6) weak.push(p.name + ' ' + p.got + '/' + p.total); });
  const wrongTypes = sc.types.filter((t) => t.part !== 1 && t.wrong.length && (t.n === 1 || t.right / t.n < 0.6)).map((t) => t.type);
  const lv = sc.types.filter((t) => t.part === 1).sort((a, b) => a.type.localeCompare(b.type));
  const out = [];
  if (strong.length) out.push({ title: '잘한 영역', body: strong.join(' · ') });
  if (weak.length) out.push({ title: '보완이 필요한 영역', body: weak.join(' · ') });
  if (lv.length) {
    const firstWeak = lv.filter((t) => t.right / t.n < 0.7)[0];
    out.push({ title: '어휘 수준', body: lv.map((t) => t.type.replace('단어 ', '') + ' ' + t.right + '/' + t.n).join(' · ') + (firstWeak ? ' — ' + firstWeak.type.replace('단어 ', '') + ' 단계부터 어휘 보충이 필요합니다.' : ' — 세 단계 모두 안정적입니다.') });
  }
  if (wrongTypes.length) out.push({ title: '틀린 유형', body: wrongTypes.filter((t, i, a) => a.indexOf(t) === i).join(' · ') });
  return out;
}

/** payload → WeeklyTestSheets 용 문항(단어 표 + PART 머리 + PART 마다 1번부터). */
function enSheetItems(pl) {
  const out = [], words = (pl && pl.words) || [], items = (pl && pl.items) || [];
  const head = (part) => { const m = enPartMeta(pl, part); return 'PART ' + part + ' ' + m.name + ' (각 ' + m.each + '점 / 총 ' + m.total + '점)'; };
  if (words.length) {
    const lvs = words.map((w) => w.lv).filter((v, i, a) => a.indexOf(v) === i).sort();
    out.push({ id: 'en-voc', status: 'done', type: '', wide: true, section: head(1) + ' — 뜻을 쓰시오', vocab: lvs.map((lv) => ({ label: 'Lv ' + lv, words: words.filter((w) => w.lv === lv).sort((a, b) => a.no - b.no) })), choices: [], rev: 0 });
  }
  let last = 0, carry = '';
  items.forEach((it) => {
    // '[6~7] 다음 글의 … 고르시오.' 처럼 지시문만 있고 문항마다 자기 지문을 가진 묶음: 발문이 빈 문항에 그 지시문을 발문으로 준다.
    // (주간테스트 양식은 지시문 + 지문을 발문 위에 그리는데, 그러면 '6.' 번호가 지문 아래로 내려간다.)
    let lead = it.lead || '', stem = it.stem || '';
    if (lead && !stem && it.passage) { carry = lead.replace(/^\[[^\]]*\]\s*/, ''); stem = carry; lead = ''; }
    else if (!stem && it.passage && carry) stem = carry;
    else if (stem) carry = '';
    out.push({ id: 'en-' + it.part + '-' + it.no, status: 'done', type: '', typeLabel: it.type || '', num: it.no, section: it.part !== last ? head(it.part) : '',
      lead: lead, stem: stem, given: it.given || '', passage: it.passage || '', pre: /\n/.test((it.given || '') + (it.passage || '')), img: it.img || '', imgW: it.imgW || 0, imgH: it.imgH || 0,
      choices: it.choices || [], answer: it.answer, explanation: '', rev: 0 });
    last = it.part;
  });
  return out;
}
function enToday() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function enErr(e) { const m = String((e && e.message) || e || ''); return /entry_(tests|results)|relation .* does not exist|schema cache/i.test(m) ? '신입생 상담 표가 아직 없습니다 — scripts/entry_schema.sql 을 Supabase SQL Editor 에서 한 번 실행해야 합니다. (' + m + ')' : m; }

// ── 레포트 한 장 (흑백 · A4) ─────────────────────────────────────
function EntryReportSheet({ row, pl, sc }) {
  const INK = '#111', DIM = '#555', LINE = '#111';
  const notes = enNotes(sc);
  const cells = enCells(pl);
  const mk = row.marks || {};
  const bar = (p) => (
    <div key={p.part} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '9px' }}>
      <div style={{ width: '112px', flex: 'none', fontSize: '12.5px', fontWeight: 700 }}>PART {p.part} {p.name}</div>
      <div style={{ flex: 1, height: '12px', border: '1px solid ' + LINE, position: 'relative' }}><div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (p.total ? p.got / p.total * 100 : 0) + '%', background: INK }}></div></div>
      <div style={{ width: '70px', flex: 'none', textAlign: 'right', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}><b>{p.got}</b> / {p.total}</div>
    </div>
  );
  const grid = (part) => {
    const cs = cells.filter((c) => c.part === part);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + (part === 1 ? 10 : 10) + ', 1fr)', borderTop: '1px solid ' + LINE, borderLeft: '1px solid ' + LINE }}>
        {cs.map((c) => (
          <div key={c.key} style={{ borderRight: '1px solid ' + LINE, borderBottom: '1px solid ' + LINE, textAlign: 'center', padding: '3px 0 4px', fontSize: '10.5px', lineHeight: 1.3, background: mk[c.key] === 0 ? '#e4e4e4' : '#fff' }}>
            <div style={{ color: DIM, fontSize: '9.5px' }}>{part === 1 ? c.group.replace('Lv ', 'L') + '-' + c.no : c.no}</div>
            <div style={{ fontWeight: 700, fontSize: '12px' }}>{mk[c.key] === 1 ? '○' : mk[c.key] === 0 ? '✕' : '·'}</div>
          </div>
        ))}
      </div>
    );
  };
  const sec = (t) => <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', borderBottom: '2px solid ' + LINE, paddingBottom: '4px', margin: '22px 0 10px' }}>{t}</div>;
  return (
    <div data-sheet="" style={{ position: 'relative', width: '794px', height: '1123px', boxSizing: 'border-box', padding: '64px 72px', background: '#fff', color: INK, fontFamily: "'Spoqa Han Sans Neo', 'Malgun Gothic', sans-serif", margin: '0 auto 28px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '3px solid ' + LINE, paddingBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em' }}>SL PRIME</div>
          <div style={{ fontSize: '25px', fontWeight: 700, letterSpacing: '-0.02em', marginTop: '2px' }}>입학테스트 결과</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11.5px', color: DIM, lineHeight: 1.6 }}>
          <div>{row.test_title || (pl && pl.title) || ''}</div>
          <div>응시일 {row.taken_on || ''}{row.counselor ? ' · 상담 ' + row.counselor : ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '22px' }}>
        <div>
          <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em' }}>{row.name || '이름 없음'}</div>
          <div style={{ fontSize: '13px', color: DIM, marginTop: '3px' }}>{[row.school, row.grade].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: DIM, letterSpacing: '0.1em' }}>총점</div>
          <div style={{ fontSize: '54px', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{sc.score}<span style={{ fontSize: '20px', fontWeight: 400, color: DIM }}> / {sc.total}</span></div>
        </div>
      </div>

      {sec('영역별 점수')}
      {sc.parts.map(bar)}

      {notes.length > 0 && sec('분석')}
      {notes.map((n, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', fontSize: '12.5px', lineHeight: 1.6, marginBottom: '5px' }}>
          <div style={{ width: '112px', flex: 'none', fontWeight: 700 }}>{n.title}</div>
          <div style={{ flex: 1, wordBreak: 'keep-all' }}>{n.body}</div>
        </div>
      ))}

      {sec('문항별 결과')}
      {sc.parts.map((p) => (
        <div key={p.part} style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>PART {p.part} {p.name} <span style={{ fontWeight: 400, color: DIM }}>· {p.right}/{p.n}문항</span></div>
          {grid(p.part)}
        </div>
      ))}

      {(row.level || row.comment) && sec('상담')}
      {row.level && <div style={{ display: 'flex', gap: '12px', fontSize: '13px', marginBottom: '6px' }}><div style={{ width: '112px', flex: 'none', fontWeight: 700 }}>권장 반</div><div style={{ flex: 1, fontWeight: 700 }}>{row.level}</div></div>}
      {row.comment && <div style={{ display: 'flex', gap: '12px', fontSize: '12.5px', lineHeight: 1.65 }}><div style={{ width: '112px', flex: 'none', fontWeight: 700 }}>선생님 한마디</div><div style={{ flex: 1, whiteSpace: 'pre-line', wordBreak: 'keep-all' }}>{row.comment}</div></div>}

      <div style={{ position: 'absolute', left: '72px', right: '72px', bottom: '44px', borderTop: '1px solid ' + LINE, paddingTop: '7px', display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: DIM }}>
        <span>○ 맞음 · ✕ 틀림(회색 칸)</span><span>SL PRIME 영어·수학</span>
      </div>
    </div>
  );
}

// ── 정답지 한 장 ─────────────────────────────────────────────────
function EntryKeySheet({ pl }) {
  const cells = enCells(pl), LINE = '#111';
  const th = { border: '1px solid ' + LINE, padding: '4px 6px', background: '#f2f2f2', fontSize: '11px', width: '34px' };
  const td = { border: '1px solid ' + LINE, padding: '4px 8px', fontSize: '12px' };
  const parts = ((pl && pl.parts) || []).map((p) => p.part);
  return (
    <div data-sheet="" style={{ position: 'relative', width: '794px', minHeight: '1123px', boxSizing: 'border-box', padding: '64px 72px', background: '#fff', color: '#111', fontFamily: "'Spoqa Han Sans Neo', 'Malgun Gothic', sans-serif", margin: '0 auto 28px', border: '1px solid #e0e0e0' }}>
      <div style={{ borderBottom: '3px solid ' + LINE, paddingBottom: '10px', marginBottom: '18px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em' }}>SL PRIME</div>
        <div style={{ fontSize: '23px', fontWeight: 700 }}>{(pl && pl.title) || '입학테스트'} — 정답</div>
      </div>
      {parts.map((part) => {
        const m = enPartMeta(pl, part), cs = cells.filter((c) => c.part === part);
        return (
          <div key={part} style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>PART {part} {m.name} (각 {m.each}점 / 총 {m.total}점)</div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}><tbody>
              {(part === 1 ? [0, 1, 2] : [0]).map((g) => {
                const list = part === 1 ? cs.filter((c) => c.group === 'Lv ' + (g + 1)) : cs;
                const rows = [];
                const per = part === 1 ? 2 : 5;
                for (let i = 0; i < list.length; i += per) rows.push(list.slice(i, i + per));
                return rows.map((row, ri) => (
                  <tr key={g + '-' + ri}>
                    {part === 1 && ri === 0 && <th rowSpan={rows.length} style={Object.assign({}, th, { width: '44px' })}>Lv {g + 1}</th>}
                    {row.map((c) => <React.Fragment key={c.key}><th style={th}>{c.no}</th><td style={td}>{part === 1 ? <span><b>{c.label}</b> — {c.answer}</span> : <b>{c.answer}</b>}{part !== 1 && c.type ? <span style={{ color: '#666', fontSize: '10.5px' }}> {c.type}</span> : null}</td></React.Fragment>)}
                  </tr>
                ));
              })}
            </tbody></table>
          </div>
        );
      })}
    </div>
  );
}

// ── 앱 ───────────────────────────────────────────────────────────
function EntryApp({ dark, userName, perms }) {
  const K = TT(dark);
  const [subject, setSubject] = useState('영어');
  const [tests, setTests] = useState(null);            // [{id,subject,grade,title}] | null(읽는 중)
  const [testId, setTestId] = useState('');
  const [plCache, setPlCache] = useState({});          // 시험지 id → payload
  const [rows, setRows] = useState(null);              // 신입생 성적 줄
  const [sel, setSel] = useState(null);                // 고른 줄의 id | 'new'
  const [draft, setDraft] = useState(null);            // 고치는 중인 줄
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [saveState, setSaveState] = useState('');      // '' | 'saving' | 'saved' | 'error'
  const [view, setView] = useState(null);              // null | { kind:'paper'|'key'|'report', … }
  const [toast, setToast] = useState('');
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const canManage = ['개발자', '관리자'].indexOf(permGroupKey(perms)) >= 0;
  const draftRef = React.useRef(null); draftRef.current = draft;
  const timer = React.useRef(null);

  const loadTests = () => SB.from('entry_tests').select('id,subject,grade,title').order('title').then(({ data, error }) => {
    if (error) { setErr(enErr(error)); setTests([]); return; }
    setTests(data || []);
  });
  const loadRows = () => SB.from('entry_results').select('*').order('taken_on', { ascending: false }).order('created_at', { ascending: false }).limit(2000).then(({ data, error }) => {
    if (error) { setErr(enErr(error)); setRows([]); return; }
    setRows(data || []);
  });
  useEffect(() => { loadTests(); loadRows(); }, []);
  const subTests = (tests || []).filter((t) => t.subject === subject);
  useEffect(() => { if (tests && !subTests.some((t) => t.id === testId)) setTestId(subTests[0] ? subTests[0].id : ''); }, [tests, subject]);
  const needPl = (id) => {
    if (!id || plCache[id]) return;
    SB.from('entry_tests').select('payload').eq('id', id).single().then(({ data, error }) => {
      if (error) return setErr(enErr(error));
      setPlCache((c) => Object.assign({}, c, { [id]: data.payload }));
    });
  };
  useEffect(() => { needPl(testId); }, [testId]);
  useEffect(() => { if (draft && draft.test_id) needPl(draft.test_id); }, [draft && draft.test_id]);

  const pl = plCache[testId] || null;
  const dpl = draft ? (plCache[draft.test_id] || null) : null;
  const dsc = draft && dpl ? enScore(dpl, draft.marks) : null;

  // ── 저장 — 바뀌는 대로(0.6초 모아서). 새 줄은 이름을 적는 순간 생긴다 ──
  const flush = () => {
    const d = draftRef.current;
    if (!d || !d.name.trim()) return Promise.resolve();
    const p = plCache[d.test_id], sc = p ? enScore(p, d.marks) : null;
    const body = { test_id: d.test_id || null, subject: d.subject, test_title: d.test_title, name: d.name.trim(), school: d.school, grade: d.grade, phone: d.phone, taken_on: d.taken_on, counselor: d.counselor,
      marks: d.marks, score: sc ? sc.score : null, part_scores: sc ? sc.parts.reduce((o, x) => { o[x.part] = x.got; return o; }, {}) : {}, level: d.level, memo: d.memo, comment: d.comment, updated_at: new Date().toISOString() };
    setSaveState('saving');
    const req = d.id ? SB.from('entry_results').update(body).eq('id', d.id).select().single() : SB.from('entry_results').insert(Object.assign({ created_by: userName }, body)).select().single();
    return req.then(({ data, error }) => {
      if (error) { setSaveState('error'); setErr('저장 실패 — ' + enErr(error)); return; }
      setSaveState('saved');
      setRows((rs) => { const list = (rs || []).slice(); const i = list.findIndex((r) => r.id === data.id); if (i >= 0) list[i] = data; else list.unshift(data); return list; });
      if (!d.id) { setDraft((cur) => cur && !cur.id ? Object.assign({}, cur, { id: data.id }) : cur); setSel(data.id); }
    });
  };
  const edit = (patch) => {
    setDraft((d) => Object.assign({}, d, patch));
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };
  useEffect(() => () => { clearTimeout(timer.current); }, []);
  const leave = () => { clearTimeout(timer.current); return flush(); };

  const openRow = (r) => { leave(); setSel(r.id); setDraft(Object.assign({}, r, { marks: Object.assign({}, r.marks || {}) })); setSaveState(''); };
  const newRow = () => {
    leave();
    const t = subTests.filter((x) => x.id === testId)[0];
    setSel('new'); setSaveState('');
    setDraft({ id: null, test_id: t ? t.id : null, subject: subject, test_title: t ? t.title : '', name: '', school: '', grade: t ? t.grade : '', phone: '', taken_on: enToday(), counselor: userName || '', marks: {}, level: '', memo: '', comment: '' });
  };
  const delRow = () => {
    if (!draft || !draft.id) { setDraft(null); setSel(null); return; }
    if (!window.confirm(draft.name + ' 학생의 입학테스트 기록을 삭제합니다. 되돌릴 수 없습니다.')) return;
    clearTimeout(timer.current);
    SB.from('entry_results').delete().eq('id', draft.id).then(({ error }) => {
      if (error) return setErr('삭제 실패 — ' + enErr(error));
      setRows((rs) => (rs || []).filter((r) => r.id !== draft.id)); setDraft(null); setSel(null); say('삭제했습니다');
    });
  };
  const setMark = (key) => { const m = Object.assign({}, draft.marks); m[key] = m[key] === 1 ? 0 : m[key] === 0 ? 1 : 0; edit({ marks: m }); };
  const fillAll = (part, v) => { const m = Object.assign({}, draft.marks); enCells(dpl).forEach((c) => { if (part == null || c.part === part) { if (v == null) delete m[c.key]; else m[c.key] = v; } }); edit({ marks: m }); };

  // ── 시험지 등록(개발자·관리자) — scripts/entry 가 만든 JSON 파일을 그대로 올린다 ──
  const fileRef = React.useRef(null);
  const onTestFile = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    f.text().then((txt) => {
      const p = JSON.parse(txt);
      if (!p.title || !p.subject || !Array.isArray(p.items)) throw new Error('입학테스트 JSON 이 아닙니다(title · subject · items 가 있어야 합니다).');
      return SB.from('entry_tests').upsert({ subject: p.subject, grade: p.grade || '', title: p.title, payload: p, created_by: userName, updated_at: new Date().toISOString() }, { onConflict: 'subject,title' }).select('id,subject,grade,title').single();
    }).then(({ data, error }) => {
      if (error) throw error;
      setPlCache((c) => { const n = Object.assign({}, c); delete n[data.id]; return n; });
      setSubject(data.subject); loadTests().then(() => setTestId(data.id)); say('「' + data.title + '」 시험지를 등록했습니다');
    }).catch((e2) => setErr('시험지 등록 실패 — ' + enErr(e2)));
  };

  const printNow = (name) => {
    const nm = String(name || '입학테스트').replace(/[\\/:*?"<>|]/g, ' ').trim();
    if (window.desktopSavePDF) return window.desktopSavePDF(nm + '.pdf');
    const prev = document.title; document.title = nm; window.print(); document.title = prev;
  };

  const btn = (primary, off) => ({ border: primary ? 'none' : '1px solid ' + K.control, cursor: off ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '13px', padding: '7px 13px', borderRadius: K.rCtl + 'px', background: primary ? K.ink : K.surface, color: primary ? K.inkText : K.text, opacity: off ? 0.4 : 1, whiteSpace: 'nowrap', transition: K.ease });
  const inputS = { border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '7px 10px', fontSize: '13px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const card = { background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px' };
  const lab = { display: 'block', fontSize: '11.5px', color: K.muted, marginBottom: '4px' };

  // ── 인쇄 화면(시험지 · 정답지 · 레포트) — 시트 말고는 아무것도 그리지 않는다 ──
  if (view) {
    const d = new Date();
    const dateTitle = (d.getMonth() + 1 <= 2 ? d.getFullYear() - 1 : d.getFullYear()) + '학년도 ' + (view.pl.grade ? view.pl.grade + ' ' : '') + '입학테스트';
    // 첫 쪽 안내 상자 — 이름·응시일과 점수 칸(선생님이 채점해 적는다). 단 폭(306px)에 맞게 짧게.
    const info = view.pl.parts ? ['이름 :                          응시일 :       월       일',
      view.pl.parts.map((p) => p.name + '      /' + p.total).join('    ') + '    총점      /' + view.pl.parts.reduce((s, p) => s + p.total, 0)] : null;
    return (
      <div data-main="" style={{ minHeight: '100vh', background: '#f5f5f7' }}>
        <nav data-noprint="" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: K.ground, borderBottom: '1px solid ' + K.border, position: 'sticky', top: 0, zIndex: 20, color: K.text, fontFamily: TT_FONT }}>
          <button onClick={() => setView(null)} style={btn(false)}>‹ 돌아가기</button>
          <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{view.title}</span>
          <button onClick={() => printNow(view.title)} style={Object.assign({}, btn(true), { marginLeft: 'auto' })}>인쇄 · PDF 저장</button>
        </nav>
        <div data-main="" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '16px 0 40px' }}>
          {view.kind === 'paper' && <WeeklyTestSheets items={enSheetItems(view.pl)} teacher={userName} range="" dateTitle={dateTitle} selId={null} withAnswers={false} noQr={true} info={info} />}
          {view.kind === 'key' && <EntryKeySheet pl={view.pl} />}
          {view.kind === 'report' && <EntryReportSheet row={view.row} pl={view.pl} sc={enScore(view.pl, view.row.marks)} />}
        </div>
      </div>
    );
  }

  const qq = q.trim().replace(/\s/g, '');
  const shown = (rows || []).filter((r) => r.subject === subject && (!qq || (r.name + r.school + r.grade + r.phone).replace(/\s/g, '').indexOf(qq) >= 0));
  const cap = (on) => ({ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', padding: '6px 16px', borderRadius: '9999px', background: on ? K.ink : 'transparent', color: on ? K.inkText : K.muted, fontWeight: on ? 600 : 400, transition: K.ease });
  const chip = (v) => ({ border: '1px solid ' + (v === 0 ? K.neg : v === 1 ? K.ink : K.control), background: v === 1 ? K.ink : v === 0 ? 'transparent' : K.surface, color: v === 1 ? K.inkText : v === 0 ? K.neg : K.muted,
    cursor: 'pointer', fontFamily: 'inherit', borderRadius: K.rCtl + 'px', padding: '5px 4px', minWidth: '58px', textAlign: 'center', lineHeight: 1.25, transition: K.ease });

  return (
    <div data-root="" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }}>
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: K.ground, borderBottom: '1px solid ' + K.border }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px', color: K.text, whiteSpace: 'nowrap' }}>신입생 상담</span>
        </div>
        <div style={{ marginLeft: '12px', display: 'flex', gap: '2px', padding: '3px', border: '1px solid ' + K.border, borderRadius: '9999px', background: K.surface }}>
          {EN_SUBJECTS.map((s) => <button key={s} onClick={() => { leave(); setSubject(s); setDraft(null); setSel(null); }} style={cap(subject === s)}>{s}</button>)}
        </div>
      </nav>

      {err && <div style={{ flex: 'none', margin: '14px 20px 0', padding: '12px 14px', borderRadius: K.rCtl + 'px', background: K.surface, border: '1px solid ' + K.neg, fontSize: '13px', color: K.neg, display: 'flex', gap: '12px' }}><span style={{ flex: 1 }}>{err}</span><button onClick={() => setErr('')} style={{ border: 'none', background: 'transparent', color: K.neg, cursor: 'pointer', fontFamily: 'inherit' }}>닫기</button></div>}

      <div data-mstack="" style={{ flex: 1, minHeight: 0, display: 'flex', gap: '16px', padding: '16px 20px' }}>
        {/* ── 왼쪽: 시험지 + 신입생 목록 ── */}
        <div data-mpane="" style={{ width: '320px', flex: 'none', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
          <div style={Object.assign({}, card, { padding: '14px' })}>
            <div style={{ fontSize: '12px', color: K.muted, marginBottom: '8px' }}>입학테스트 시험지</div>
            {tests === null ? <div style={{ fontSize: '13px', color: K.muted }}>불러오는 중…</div>
              : !subTests.length ? <div style={{ fontSize: '13px', color: K.muted, lineHeight: 1.6 }}>등록된 {subject} 시험지가 없습니다.{canManage ? ' 아래에서 시험지 파일을 올려 주세요.' : ' 관리자에게 등록을 요청하세요.'}</div>
              : <select value={testId} onChange={(e) => setTestId(e.target.value)} style={inputS}>{subTests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button style={btn(true, !pl)} disabled={!pl} onClick={() => setView({ kind: 'paper', pl: pl, title: pl.title + ' 시험지' })}>시험지 인쇄</button>
              <button style={btn(false, !pl)} disabled={!pl} onClick={() => setView({ kind: 'key', pl: pl, title: pl.title + ' 정답지' })}>정답지</button>
              {canManage && <button style={btn(false)} onClick={() => fileRef.current && fileRef.current.click()}>시험지 등록</button>}
              <input ref={fileRef} type="file" accept=".json,application/json" onChange={onTestFile} style={{ display: 'none' }} />
            </div>
          </div>

          <div style={Object.assign({}, card, { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' })}>
            <div style={{ display: 'flex', gap: '8px', padding: '12px 12px 8px' }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·학교·연락처로 찾기" style={inputS} />
              <button style={btn(true, !subTests.length)} disabled={!subTests.length} onClick={newRow}>+ 신입생</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid ' + K.rule }}>
              {rows === null && <div style={{ padding: '18px 14px', fontSize: '13px', color: K.muted }}>불러오는 중…</div>}
              {rows && !shown.length && <div style={{ padding: '26px 14px', fontSize: '13px', color: K.muted, textAlign: 'center', lineHeight: 1.6 }}>{(rows || []).some((r) => r.subject === subject) ? '찾는 학생이 없습니다.' : '아직 기록이 없습니다.\n「+ 신입생」으로 시작하세요.'}</div>}
              {shown.map((r) => (
                <button key={r.id} onClick={() => openRow(r)} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid ' + K.rule, cursor: 'pointer', fontFamily: 'inherit', padding: '10px 14px', background: sel === r.id ? K.active : 'transparent', color: K.text, transition: K.ease }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                    <span style={{ display: 'block', fontSize: '11.5px', color: K.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[r.school, r.grade, r.taken_on].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span style={{ flex: 'none', fontSize: '15px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.score == null ? '—' : r.score}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 고른 신입생 ── */}
        <div style={Object.assign({}, card, { flex: 1, minWidth: 0, overflowY: 'auto', padding: draft ? '18px 20px 28px' : 0 })}>
          {!draft && <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: K.muted, fontSize: '13.5px', textAlign: 'center', lineHeight: 1.7, padding: '40px' }}>왼쪽에서 신입생을 고르거나 「+ 신입생」으로 새로 시작하세요.<br />시험지는 「시험지 인쇄」로 뽑고, 채점한 뒤 문항별 맞음/틀림을 여기서 눌러 넣습니다.</div>}
          {draft && (
            <React.Fragment>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>{draft.name || '새 신입생'}</span>
                <span style={{ fontSize: '12px', color: saveState === 'error' ? K.neg : K.muted }}>{!draft.name.trim() ? '이름을 적으면 저장이 시작됩니다' : saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '✓ 저장됨' : saveState === 'error' ? '저장 실패' : ''}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  <button style={btn(true, !dsc || !draft.name.trim())} disabled={!dsc || !draft.name.trim()} onClick={() => { leave(); setView({ kind: 'report', pl: dpl, row: draft, title: draft.name + ' 입학테스트 결과' }); }}>레포트 보기</button>
                  <button style={Object.assign({}, btn(false), { color: K.neg })} onClick={delRow}>{draft.id ? '삭제' : '취소'}</button>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px 12px', marginBottom: '18px' }}>
                <label><span style={lab}>이름</span><input value={draft.name} onChange={(e) => edit({ name: e.target.value })} style={inputS} autoFocus={!draft.id} /></label>
                <label><span style={lab}>학교</span><input value={draft.school} onChange={(e) => edit({ school: e.target.value })} style={inputS} /></label>
                <label><span style={lab}>학년</span><input value={draft.grade} onChange={(e) => edit({ grade: e.target.value })} style={inputS} /></label>
                <label><span style={lab}>학부모 연락처</span><input value={draft.phone} onChange={(e) => edit({ phone: e.target.value })} style={inputS} inputMode="tel" /></label>
                <label><span style={lab}>응시일</span><input type="date" value={draft.taken_on || ''} onChange={(e) => edit({ taken_on: e.target.value })} style={inputS} /></label>
                <label><span style={lab}>상담 선생님</span><input value={draft.counselor} onChange={(e) => edit({ counselor: e.target.value })} style={inputS} /></label>
                <label style={{ gridColumn: 'span 2' }}><span style={lab}>시험지</span>
                  <select value={draft.test_id || ''} onChange={(e) => { const t = (tests || []).filter((x) => x.id === e.target.value)[0]; edit({ test_id: e.target.value || null, test_title: t ? t.title : '', marks: {} }); }} style={inputS}>
                    {!draft.test_id && <option value="">시험지 없음</option>}
                    {(tests || []).filter((t) => t.subject === draft.subject).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </label>
              </div>

              {!dpl && <div style={{ fontSize: '13px', color: K.muted, padding: '14px 0' }}>{draft.test_id ? '시험지를 불러오는 중…' : '시험지를 골라야 채점할 수 있습니다.'}</div>}
              {dpl && dsc && (
                <React.Fragment>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', padding: '12px 14px', border: '1px solid ' + K.border, borderRadius: K.rCtl + 'px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '26px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{dsc.score}<span style={{ fontSize: '14px', fontWeight: 400, color: K.muted }}> / {dsc.total}</span></span>
                    {dsc.parts.map((p) => <span key={p.part} style={{ fontSize: '13px', color: K.muted }}>{p.name} <b style={{ color: K.text }}>{p.got}</b>/{p.total}</span>)}
                    {dsc.blank > 0 && <span style={{ fontSize: '12.5px', color: K.warn }}>아직 안 매긴 칸 {dsc.blank}개</span>}
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                      <button style={btn(false)} onClick={() => fillAll(null, 1)}>전부 맞음으로</button>
                      <button style={btn(false)} onClick={() => fillAll(null, null)}>전부 비우기</button>
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: K.muted, marginBottom: '12px' }}>칸을 누르면 맞음 ↔ 틀림이 바뀝니다. 「전부 맞음으로」를 누른 뒤 틀린 문항만 눌러 주면 빠릅니다. 칸 아래 작은 글자는 정답입니다.</div>
                  {dsc.parts.map((p) => {
                    const cs = enCells(dpl).filter((c) => c.part === p.part);
                    const groups = p.part === 1 ? cs.map((c) => c.group).filter((v, i, a) => a.indexOf(v) === i) : [''];
                    return (
                      <div key={p.part} style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 700 }}>PART {p.part} {p.name}</span>
                          <span style={{ fontSize: '12px', color: K.muted }}>{p.right}/{p.n}문항 · {p.got}/{p.total}점</span>
                          <button style={Object.assign({}, btn(false), { padding: '3px 9px', fontSize: '12px', marginLeft: 'auto' })} onClick={() => fillAll(p.part, 1)}>이 PART 전부 맞음</button>
                        </div>
                        {groups.map((g) => (
                          <div key={g} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                            {g && <span style={{ width: '34px', flex: 'none', fontSize: '12px', color: K.muted }}>{g}</span>}
                            {cs.filter((c) => c.group === g).map((c) => {
                              const v = draft.marks[c.key];
                              return (
                                <button key={c.key} onClick={() => setMark(c.key)} style={chip(v)} title={c.type}>
                                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{c.no}{c.label ? ' ' + c.label : ''} {v === 1 ? '○' : v === 0 ? '✕' : ''}</span>
                                  <span style={{ display: 'block', fontSize: '10.5px', opacity: 0.75, maxWidth: '110px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.answer}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: '10px 12px', marginTop: '6px' }}>
                <label><span style={lab}>권장 반 (레포트에 나갑니다)</span><input value={draft.level} onChange={(e) => edit({ level: e.target.value })} style={inputS} placeholder="예: 고1 S1" /></label>
                <label><span style={lab}>선생님 한마디 (레포트에 나갑니다 · 비우면 안 나갑니다)</span><textarea rows={2} value={draft.comment} onChange={(e) => edit({ comment: e.target.value })} style={Object.assign({}, inputS, { resize: 'vertical' })} /></label>
                <label style={{ gridColumn: '1 / -1' }}><span style={lab}>상담 메모 (레포트에는 안 나갑니다)</span><textarea rows={3} value={draft.memo} onChange={(e) => edit({ memo: e.target.value })} style={Object.assign({}, inputS, { resize: 'vertical' })} /></label>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
      {toast && <div style={{ position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', background: K.ink, color: K.inkText, fontSize: '13px', padding: '9px 16px', borderRadius: '9999px', zIndex: 60 }}>{toast}</div>}
    </div>
  );
}
