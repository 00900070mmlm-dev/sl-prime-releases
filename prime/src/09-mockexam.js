// 모의고사 — 회차 단위로 골라 [단어장(맨 앞·모아찍기)] + [문제지] + [해설지(토글)] 를
// 한 PDF로 합쳐 뽑는 앱. 시험지 PDF 원본은 Supabase Storage 비공개 버킷 'exams' 에 있다
// (경로: g1/2025_6_p.pdf = 고1 2025년 6월 문제, _s.pdf = 해설). 회차 목록은 하드코딩하지
// 않고 버킷 파일 목록에서 만든다 — PDF를 올리면 회차가 자동으로 뜬다.
// 병합은 데스크톱 전용(main.js 의 save-exam-pdf IPC, pdf-lib): 단어장은 이 창을
// printToPDF 로 뽑고, 시험지 바이트를 렌더러가 내려받아 넘기면 main 이 순서대로 합친다.

// 시험지 미리보기: pdf.js(vendor/pdf.min.js)로 각 페이지를 캔버스에 직접 그린다.
// <embed>(크로미움 내장 뷰어 플러그인)는 환경에 따라 안 뜨는 곳이 있어 쓰지 않는다.
function MePdfDoc({ bytes, label, dark }) {
  const boxRef = useRef(null);
  const [err, setErr] = useState('');
  const [prog, setProg] = useState('여는 중…');
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (!window.pdfjsLib) throw new Error('pdf.js가 로드되지 않았습니다');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        const doc = await window.pdfjsLib.getDocument({ data: bytes.slice() }).promise;
        for (let i = 1; i <= doc.numPages; i++) {
          if (dead) return;
          const page = await doc.getPage(i);
          const scale = 794 / page.getViewport({ scale: 1 }).width;   // A4 시트와 같은 폭
          const vp = page.getViewport({ scale });
          const ratio = Math.min(2, window.devicePixelRatio || 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(vp.width * ratio);
          canvas.height = Math.floor(vp.height * ratio);
          canvas.style.cssText = 'display:block;width:794px;height:' + Math.floor(vp.height) + 'px;background:#fff;border:1px solid #e0e0e0;border-radius:2px;box-shadow:rgba(0,0,0,0.1) 0 12px 44px;margin:0 auto 28px';
          if (!boxRef.current) return;
          boxRef.current.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined }).promise;
          setProg(i < doc.numPages ? i + '/' + doc.numPages + ' 쪽' : '');
        }
      } catch (e) { if (!dead) setErr(String((e && e.message) || e)); }
    })();
    return () => { dead = true; if (boxRef.current) boxRef.current.innerHTML = ''; };
  }, [bytes]);
  return (
    <div data-noprint="">
      <div style={{ maxWidth: '794px', margin: '0 auto', display: 'flex', alignItems: 'baseline', gap: '8px', padding: '4px 2px 8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700 }}>{label}</span>
        {prog && !err && <span style={{ fontSize: '12px', opacity: 0.55 }}>{prog}</span>}
        {err && <span style={{ fontSize: '12px', color: '#e03131' }}>미리보기 실패: {err}</span>}
      </div>
      <div ref={boxRef}></div>
    </div>
  );
}

// 버킷 파일 목록 → [{ grade:'고1', year:'2025년', month:'6월' }] (연도 내림차·월 오름차 정렬)
async function meListRounds() {
  const out = [];
  for (const g of ['g1', 'g2', 'g3']) {
    const { data, error } = await SB.storage.from('exams').list(g, { limit: 1000 });
    if (error) throw error;
    for (const f of data || []) {
      const m = (f.name || '').match(/^(\d{4})_(\d{1,2})_p\.pdf$/);
      if (m) out.push({ grade: '고' + g.slice(1), year: m[1] + '년', month: m[2] + '월' });
    }
  }
  return out;
}
const meRoundKey = (r) => r.grade + '|' + r.year + '|' + r.month;
const meRoundLabel = (r) => r.grade + ' ' + r.year + ' ' + r.month + ' 모의고사';
const meStoragePath = (r, kind) => 'g' + r.grade.replace('고', '') + '/' + r.year.replace('년', '') + '_' + r.month.replace('월', '') + '_' + (kind === '문제' ? 'p' : 's') + '.pdf';

// 회차의 단어: window.VOCAB 의 mock 키에서 26·27·28번을 뺀 전 지문(범위 전체선택 고정).
// 각 지문의 첫 단어에 'N번' 마커를 붙인다(교재 단어장과 같은 표기).
function meRoundWords(r) {
  const prefix = 'mock|' + r.grade + '|' + r.year + '|' + r.month + '|';
  const V = window.VOCAB || {};
  const nums = Object.keys(V).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length))
    .filter((n) => !['26', '27', '28'].includes(n))
    .sort((a, b) => (parseInt(a, 10) || 999) - (parseInt(b, 10) || 999));
  const words = [];
  for (const n of nums) {
    (V[prefix + n] || []).forEach((w, i) => words.push({ en: w.en, ko: w.ko, marker: i === 0 ? n + '번' : '' }));
  }
  return words;
}

function MockExamApp({ dark, onHome }) {
  const T = THEME(dark);
  const PC = '#0066cc';
  const [rounds, setRounds] = useState(null);     // null=로딩, []=목록
  const [loadErr, setLoadErr] = useState('');
  const [grade, setGrade] = useState('고1');
  const [sel, setSel] = useState([]);             // 선택한 회차(클릭 순서)
  const [explOn, setExplOn] = useState(false);    // 해설지: 회차 문제지 바로 뒤에 붙임
  const [vocabOn, setVocabOn] = useState(true);   // 단어장: 몇 회차든 무조건 맨 앞에 모음
  const [busy, setBusy] = useState('');           // '' | 'pdf' | 'print'
  const [pdfBytes, setPdfBytes] = useState({});   // 'g1/2025_6_p.pdf' → Uint8Array (미리보기·병합 공용 캐시)
  const [dragIdx, setDragIdx] = useState(null);   // 구성 순서 드래그 중인 회차 인덱스

  useEffect(() => {
    meListRounds().then(setRounds).catch((e) => { setLoadErr(String((e && e.message) || e)); setRounds([]); });
  }, []);

  // ── 시험지 다운로드 캐시: 선택한 회차의 문제지(+해설지 ON시). 미리보기와 병합이 같은 바이트를 쓴다 ──
  const bytesRef = useRef({});
  useEffect(() => {
    let dead = false;
    const need = [];
    for (const r of sel) {
      need.push(meStoragePath(r, '문제'));
      if (explOn) need.push(meStoragePath(r, '해설'));
    }
    (async () => {
      for (const p of need) {
        if (bytesRef.current[p]) continue;
        bytesRef.current[p] = 'loading';
        const { data, error } = await SB.storage.from('exams').download(p);
        if (dead) return;
        bytesRef.current[p] = error || !data ? 'error' : new Uint8Array(await data.arrayBuffer());
        setPdfBytes({ ...bytesRef.current });
      }
    })();
    return () => { dead = true; };
  }, [sel, explOn]);

  // 미리보기 한 부(문제/해설): pdf.js 캔버스 렌더. 인쇄(printToPDF)에는 안 들어가도록 data-noprint.
  const mePdfBox = (r, kind) => {
    const b = pdfBytes[meStoragePath(r, kind)];
    const label = meRoundLabel(r) + ' ' + kind + '지';
    if (b instanceof Uint8Array) return <MePdfDoc key={meRoundKey(r) + kind} bytes={b} label={label} dark={dark} />;
    return (
      <div key={meRoundKey(r) + kind} data-noprint="" style={{ maxWidth: '794px', margin: '0 auto 28px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, padding: '4px 2px 8px' }}>{label}</div>
        {b === 'error'
          ? <div style={{ padding: '18px', borderRadius: '10px', border: '1px solid rgba(224,49,49,0.35)', background: 'rgba(224,49,49,0.08)', fontSize: '13px', color: '#e03131' }}>불러오지 못했습니다</div>
          : <div style={{ height: '140px', borderRadius: '10px', border: '1px dashed ' + T.panelBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: T.textFaint }}>내려받는 중…</div>}
      </div>
    );
  };

  const isSel = (r) => sel.some((s) => meRoundKey(s) === meRoundKey(r));
  const toggle = (r) => setSel((p) => (isSel(r) ? p.filter((s) => meRoundKey(s) !== meRoundKey(r)) : [...p, r]));
  // 구성 순서 이동: from 위치의 회차를 to 위치로 (단어장·미리보기·병합이 전부 sel 순서를 따른다)
  const moveSel = (from, to) => setSel((p) => {
    if (to < 0 || to >= p.length || from === to) return p;
    const next = p.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    return next;
  });

  const years = [...new Set((rounds || []).filter((r) => r.grade === grade).map((r) => r.year))].sort().reverse();
  const monthNum = (m) => parseInt(m, 10) || 99;
  const roundsOf = (y) => (rounds || []).filter((r) => r.grade === grade && r.year === y).sort((a, b) => monthNum(a.month) - monthNum(b.month));

  // ── 단어장 페이지 계획: 가로 A4 모아찍기(한 장 = 반면 2개), 반면 = 헤더 + 50단어(25행×2열) ──
  // 회차가 바뀌면 반드시 새 반면에서 시작한다.
  const halves = [];
  if (vocabOn) {
    for (const r of sel) {
      const words = meRoundWords(r);
      if (!words.length) { halves.push({ label: meRoundLabel(r), rows: null, empty: true }); continue; }
      for (let off = 0; off < words.length; off += 50) {
        const slice = words.slice(off, off + 50);
        const cell = (w, no) => (w ? { no, en: w.en, ko: w.ko, marker: w.marker } : null);
        const rows = [];
        for (let i = 0; i < 25; i++) rows.push({ L: cell(slice[i], off + i + 1), R: cell(slice[i + 25], off + i + 26) });
        halves.push({ label: meRoundLabel(r), rows, pi: off / 50 });
      }
    }
  }
  const vSheets = [];
  for (let i = 0; i < halves.length; i += 2) vSheets.push([halves[i], halves[i + 1] || null]);

  // ── 교재 단어장 표 (04-studio renderBookTable 과 같은 생김새 — 이 앱 전용 사본) ──
  const meBookTable = (rows) => {
    const fit = (t, cf, reserve = 0) => { const n = (t || '').length; if (!n) return undefined; return Math.max(7, Math.min(11.5, 2 * (118 - reserve) / (n * cf))) + 'px'; };
    const base = { borderBottom: '1px solid #edeff2', padding: '0 5px', height: '25.5px', verticalAlign: 'middle', overflow: 'hidden', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'break-word', lineHeight: 1.12, maxWidth: 0 };
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '11px' }}>
        <colgroup>
          <col style={{ width: '8%' }} /><col style={{ width: '19.5%' }} /><col style={{ width: '22.5%' }} />
          <col style={{ width: '8%' }} /><col style={{ width: '19.5%' }} /><col style={{ width: '22.5%' }} />
        </colgroup>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {[row.L, row.R].flatMap((c, bi) => [
                <td key={bi + 'n'} style={{ ...base, borderLeft: bi === 1 ? '1px solid #e2e5ea' : 'none', paddingLeft: bi === 1 ? '10px' : '2px', paddingRight: '6px', textAlign: 'right', whiteSpace: 'nowrap', color: PC, fontSize: '9px', fontWeight: 700 }}>{c ? c.no : ''}</td>,
                <td key={bi + 'e'} style={{ ...base, borderLeft: '3px solid ' + (c && c.marker ? PC : 'transparent'), paddingLeft: '5px', fontWeight: 600, color: '#1d1d1f', fontSize: c ? fit(c.en, 0.56, c.marker ? 34 : 0) : undefined }}>{c ? (<>{c.marker && <span style={{ display: 'inline-block', background: PC, color: '#fff', fontSize: '8px', fontWeight: 800, borderRadius: '3px', padding: '1px 5px', marginRight: '5px', verticalAlign: '1px' }}>{c.marker}</span>}{c.en}</>) : ''}</td>,
                <td key={bi + 'k'} style={{ ...base, color: '#5b6068', fontSize: c ? fit(c.ko, 1.0) : undefined }}>{c ? c.ko : ''}</td>
              ])}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ── PDF 병합 (데스크톱 전용) — print=true 면 저장 대화상자 없이 임시 파일로 열어 인쇄 ──
  const doExam = async (print) => {
    if (!sel.length) { alert('먼저 회차를 선택하세요.'); return; }
    if (!window.desktopSaveExamPDF) { alert('PDF 병합은 데스크톱 앱에서만 가능합니다.\n(브라우저 미리보기에서는 파일을 합칠 수 없습니다)'); return; }
    setBusy(print ? 'print' : 'pdf');
    try {
      const parts = [];
      if (vocabOn && vSheets.length) parts.push({ kind: 'vocab' });
      for (const r of sel) {
        const dl = async (kind) => {
          const cached = bytesRef.current[meStoragePath(r, kind)];      // 미리보기가 받아둔 걸 재사용
          if (cached instanceof Uint8Array) return cached;
          const { data, error } = await SB.storage.from('exams').download(meStoragePath(r, kind));
          if (error || !data) throw new Error(meRoundLabel(r) + ' ' + kind + '지를 내려받지 못했습니다: ' + ((error && error.message) || ''));
          return new Uint8Array(await data.arrayBuffer());
        };
        parts.push({ name: meRoundLabel(r) + ' 문제', bytes: await dl('문제') });
        if (explOn) parts.push({ name: meRoundLabel(r) + ' 해설', bytes: await dl('해설') });
      }
      const d = new Date();
      const filename = '모의고사 모음 ' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.pdf';
      const res = await window.desktopSaveExamPDF({ parts, filename, print: !!print });
      if (res && !res.ok && !res.canceled) alert('PDF를 만들지 못했습니다.\n\n' + (res.error || '알 수 없는 오류'));
    } catch (err) {
      alert(String((err && err.message) || err));
    } finally {
      setBusy('');
    }
  };

  const chip = (on) => ({ height: '30px', padding: '0 12px', borderRadius: '9px', border: '1px solid ' + (on ? 'rgba(0,102,204,0.5)' : T.panelBorder), background: on ? 'rgba(0,102,204,0.10)' : T.emptyCardBg, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: on ? (dark ? '#4da3ff' : '#0066cc') : T.textDim });

  return (
    <div data-root="" className={dark ? 'dark' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Segoe UI', sans-serif", color: T.text }}>
      <nav data-noprint="" style={{ position: 'relative', zIndex: 3, flex: 'none', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: T.navBg, WebkitBackdropFilter: 'saturate(180%) blur(20px)', backdropFilter: 'saturate(180%) blur(20px)', borderBottom: '1px solid ' + T.navBorder }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="nav-brand" style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px' }}>SL PRIME</span>
          <span style={{ fontSize: '14px', color: T.textDim, whiteSpace: 'nowrap' }}>모의고사</span>
        </div>
        <button onClick={onHome} style={{ border: 'none', cursor: 'pointer', background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', fontSize: '13px', color: T.text, fontFamily: 'inherit', padding: '6px 12px', borderRadius: '9999px' }}>‹ 홈</button>
      </nav>

      <div data-mstack="" style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 사이드바: 학년 → 연도 → 회차(체크). data-mpane — 폰에서는 위로 올라가 전체 폭(index.html 모바일 CSS) */}
        <aside data-noprint="" data-mpane="" style={{ flex: 'none', width: '296px', margin: '16px 0 16px 16px', borderRadius: '18px', background: T.panel, WebkitBackdropFilter: 'saturate(180%) blur(24px)', backdropFilter: 'saturate(180%) blur(24px)', border: '1px solid ' + T.panelBorder, padding: '14px 12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 'none', display: 'flex', gap: '6px', marginBottom: '12px', padding: '0 2px' }}>
            {['고1', '고2', '고3'].map((g) => (
              <button key={g} className="sel-chip" data-sel={g === grade ? 'true' : 'false'} onClick={() => setGrade(g)}><span className="lbl">{g}</span></button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {rounds === null && <div style={{ padding: '28px 14px', textAlign: 'center', fontSize: '13px', color: T.textFaint }}>회차 목록 불러오는 중…</div>}
            {rounds !== null && loadErr && (
              <div style={{ margin: '4px 2px 10px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(224,49,49,0.10)', border: '1px solid rgba(224,49,49,0.35)', fontSize: '12.5px', color: '#e03131', lineHeight: 1.55 }}>
                시험지 저장소를 읽지 못했습니다.<br />{loadErr}
              </div>
            )}
            {rounds !== null && !loadErr && !years.length && <div style={{ padding: '28px 14px', textAlign: 'center', fontSize: '13px', color: T.textFaint, lineHeight: 1.6 }}>{grade} 시험지가 아직 없습니다.<br />PDF가 등록되면 이곳에 표시됩니다.</div>}
            {years.map((y) => (
              <div key={y} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: T.textFaint, padding: '4px 10px 6px' }}>{y}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {roundsOf(y).map((r) => {
                    const on = isSel(r);
                    return (
                      <button key={meRoundKey(r)} onClick={() => toggle(r)}
                        style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: on ? 'rgba(0,102,204,0.08)' : 'transparent', transition: 'background 0.14s' }}>
                        <span style={{ flex: 'none', width: '18px', height: '18px', borderRadius: '5px', border: on ? 'none' : '1.5px solid ' + (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'), background: on ? PC : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 800 }}>{on ? '✓' : ''}</span>
                        <span style={{ flex: 1, fontSize: '13.5px', fontWeight: on ? 700 : 500, color: on ? (dark ? '#4da3ff' : '#0066cc') : T.text }}>{r.month === '11월' ? '11월 학력평가' : r.month + ' 학력평가'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid ' + T.divider, fontSize: '12.5px', color: T.textDim }}>
            <span>{sel.length}개 회차 선택됨</span>
            {sel.length > 0 && <button onClick={() => setSel([])} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: dark ? '#4da3ff' : '#0066cc' }}>모두 해제</button>}
          </div>
        </aside>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {/* 툴바 */}
          <div data-noprint="" style={{ position: 'relative', zIndex: 20, flex: 'none', margin: '16px 16px 0', borderRadius: '18px', background: T.panel, WebkitBackdropFilter: 'saturate(180%) blur(24px)', backdropFilter: 'saturate(180%) blur(24px)', border: '1px solid ' + T.panelBorder, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button style={chip(vocabOn)} onClick={() => setVocabOn(v => !v)}>단어장 {vocabOn ? 'ON' : 'OFF'}</button>
            <button style={chip(explOn)} onClick={() => setExplOn(v => !v)}>해설지 {explOn ? 'ON' : 'OFF'}</button>
            <span style={{ fontSize: '12px', color: T.textFaint }}>단어장은 맨 앞에 모아 나오고(26·27·28 제외 전 지문), 해설지는 각 회차 문제지 바로 뒤에 붙습니다.</span>
            <div style={{ flex: 1 }}></div>
            <button onClick={() => doExam(false)} disabled={!!busy} className="export-btn secondary" style={{ '--hc': '#e03131', '--hc-glow': 'rgba(224,49,49,0.20)', opacity: busy ? 0.6 : 1 }}><span>{busy === 'pdf' ? '만드는 중…' : 'PDF로 저장'}</span></button>
            <button onClick={() => doExam(true)} disabled={!!busy} className="export-btn secondary" style={{ '--hc': '#1a7a3f', '--hc-glow': 'rgba(26,122,63,0.22)', opacity: busy ? 0.6 : 1 }}><span>{busy === 'print' ? '여는 중…' : '인쇄'}</span></button>
          </div>

          {/* 미리보기 */}
          <div data-scroll="" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '24px 16px 40px' }}>
            {sel.length === 0 && (
              <div style={{ maxWidth: '440px', margin: '120px auto 0', textAlign: 'center', padding: '40px 32px', borderRadius: '18px', background: T.emptyCardBg, border: '1px solid ' + T.panelBorder }}>
                <div style={{ fontSize: '19px', fontWeight: 600 }}>회차를 선택하세요</div>
                <div style={{ fontSize: '14px', color: T.textDim, marginTop: '8px', lineHeight: 1.6 }}>왼쪽에서 모의고사 회차를 체크하면<br />단어장 + 문제지{explOn ? ' + 해설지' : ''} 순서로 한 PDF가 만들어집니다.</div>
              </div>
            )}

            {/* 구성 목차 (화면 전용) */}
            {sel.length > 0 && (
              <div data-noprint="" style={{ maxWidth: '820px', margin: '0 auto 24px', padding: '18px 22px', borderRadius: '16px', background: T.emptyCardBg, border: '1px solid ' + T.panelBorder }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>PDF 구성 순서</span>
                  {sel.length > 1 && <span style={{ fontSize: '11.5px', color: T.textFaint }}>드래그하거나 ▲▼로 순서를 바꿀 수 있습니다</span>}
                </div>
                {vocabOn && <div style={{ padding: '7px 10px', fontSize: '13px', color: T.textDim }}><b style={{ color: T.text }}>맨 앞</b>&nbsp; 단어장 — 선택한 {sel.length}개 회차 전체 ({vSheets.length}면)</div>}
                {sel.map((r, i) => (
                  <div key={meRoundKey(r)} draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) { moveSel(dragIdx, i); setDragIdx(i); } }}
                    onDragEnd={() => setDragIdx(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '9px', cursor: 'grab', background: dragIdx === i ? 'rgba(0,102,204,0.10)' : 'transparent', border: '1px solid ' + (dragIdx === i ? 'rgba(0,102,204,0.4)' : 'transparent') }}>
                    <span style={{ flex: 'none', color: T.textFaint, fontSize: '13px', letterSpacing: '1px' }}>⠿</span>
                    <span style={{ flex: 'none', width: '20px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: dark ? '#4da3ff' : '#0066cc' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: '13.5px' }}>{meRoundLabel(r)} 문제지{explOn ? ' → 해설지' : ''}</span>
                    <button onClick={() => moveSel(i, i - 1)} disabled={i === 0} style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '13px', color: i === 0 ? T.textFaint : T.text, opacity: i === 0 ? 0.35 : 1, padding: '2px 5px' }}>▲</button>
                    <button onClick={() => moveSel(i, i + 1)} disabled={i === sel.length - 1} style={{ border: 'none', background: 'none', cursor: i === sel.length - 1 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '13px', color: i === sel.length - 1 ? T.textFaint : T.text, opacity: i === sel.length - 1 ? 0.35 : 1, padding: '2px 5px' }}>▼</button>
                  </div>
                ))}
                <div style={{ fontSize: '12px', color: T.textFaint, marginTop: '8px' }}>아래 미리보기(단어장 포함)가 이 순서를 그대로 따라갑니다 — 문제지·해설지는 원본 PDF가 그대로 합쳐집니다.</div>
              </div>
            )}

            {/* 단어장 미리보기 = 인쇄 대상 (가로 A4 모아찍기) */}
            {sel.length > 0 && vocabOn && <style>{'@media print { @page { size: A4 landscape; margin: 0; } [data-sheet] { width: 297mm !important; height: 210mm !important; margin: 0 auto !important; } }'}</style>}
            {sel.length > 0 && vocabOn && vSheets.map((pair, si) => (
              <div key={si} data-sheet="" style={{ width: '1123px', maxWidth: 'none', margin: '0 auto 28px', height: '794px', minHeight: '794px', background: '#ffffff', color: '#1d1d1f', border: '1px solid #e0e0e0', borderRadius: '2px', boxShadow: 'rgba(0,0,0,0.1) 0px 12px 44px', padding: '30px 34px 26px', overflow: 'hidden', display: 'flex' }}>
                {[pair[0], pair[1]].map((h, k) => (
                  <div key={k} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: k === 0 ? '0 20px 0 0' : '0 0 0 20px', borderLeft: k === 1 ? '1px dashed #b0b0b5' : 'none' }}>
                    {h && (
                      <>
                        <div style={{ flex: 'none', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: '6px', marginBottom: '8px', borderBottom: '1.5px solid #1d1d1f' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 800, letterSpacing: '-0.3px' }}>{h.label} 단어장</span>
                          {h.pi > 0 && <span style={{ fontSize: '10.5px', color: '#86868b' }}>이어서 {h.pi + 1}</span>}
                        </div>
                        {h.empty
                          ? <div style={{ padding: '30px 10px', fontSize: '12.5px', color: '#86868b' }}>이 회차의 단어장이 아직 등록되지 않았습니다.</div>
                          : meBookTable(h.rows)}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* 시험지 미리보기 — 최종 PDF와 같은 순서(문제지 → 해설지 → 다음 회차) */}
            {sel.flatMap((r) => [mePdfBox(r, '문제'), ...(explOn ? [mePdfBox(r, '해설')] : [])])}
          </div>
        </main>
      </div>
    </div>
  );
}
