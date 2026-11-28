// 워크북(5유형) 렌더러 — 포인트색 팔레트(WB_STYLE_FOR) · 답지(wbFixedPassage) · WorkbookSheetsInner
// index.html 에서 분리(2026-07-29). 로드 순서는 index.html 의 script 태그 순서가 결정한다.
// ===== 워크북(5유형) 렌더러 — 실측 페이지네이션(A4 잘림 방지) + 유형별 새 페이지 + 기존 워크시트 톤 =====
// 워크북 팔레트는 포인트색에서 파생시킨다(예전엔 파란색이 하드코딩돼 포인트색을 바꿔도 안 바뀌었다).
// 연한 톤은 pcTint = 같은 배합의 망점, 진한 네이비는 pcShade = 같은 배합 + K → 인쇄 변환도 깔끔하게 떨어진다.
function WB_STYLE_FOR(pc) {
  const A = pc, DEEP = pcShade(pc, 0.35);
  const T61 = pcTint(pc, 0.61), T66 = pcTint(pc, 0.66), T72 = pcTint(pc, 0.72), T80 = pcTint(pc, 0.80),
        T84 = pcTint(pc, 0.84), T86 = pcTint(pc, 0.86), T89 = pcTint(pc, 0.89), T90 = pcTint(pc, 0.90),
        T93 = pcTint(pc, 0.93), T95 = pcTint(pc, 0.95), T97 = pcTint(pc, 0.97);
  return `.wb{color:#1d1d1f;font-size:12.5px;line-height:1.5}.wb .rhead{display:flex;justify-content:space-between;align-items:baseline;font-size:11.5px;color:#86868b;flex:none}.wb .rfoot{display:flex;justify-content:space-between;align-items:baseline;font-size:10.5px;color:#a1a1a6;flex:none;padding-top:6px;border-top:1px solid ${T90};margin-top:6px}.wb .thead{margin:10px 0 0}.wb .thead .tt{font-size:22px;font-weight:700;letter-spacing:-0.4px;color:#1d1d1f}.wb .thead .td{font-size:12px;color:#6e6e73;margin-top:4px}.wb .thead .rule{height:1px;background:#1d1d1f;margin:10px 0 3px}.wb .psub{display:flex;align-items:baseline;gap:8px;margin:13px 0 7px;padding-bottom:5px;border-bottom:1px solid ${T84}}.wb .psub .pn{font-size:16px;font-weight:800;color:${A};letter-spacing:-0.3px}.wb .psub .pt{font-size:12.5px;font-weight:600;color:#1d1d1f}.wb .psub .pcont{margin-left:auto;font-size:10px;font-weight:600;color:#a1a1a6;letter-spacing:-0.2px}.wb .qitem{margin:5px 0 7px}.wb .qno{display:inline-block;min-width:15px;font-weight:700;color:${A};font-size:11.5px;margin-right:5px}.wb .ko{color:#6e6e73;font-size:11px;margin:1px 0 3px;line-height:1.45}.wb .en{font-size:12.5px;line-height:1.8;color:#1d1d1f}.wb .box{display:inline;white-space:nowrap;border:1px solid ${T61};border-radius:4px;padding:0 7px;margin:0 1px;font-weight:600;background:${T93};color:${DEEP}}.wb .box .sl{color:#9aa6b2;font-weight:400;margin:0 3px}.wb .grp{display:inline;border:1px solid ${T61};border-radius:5px;padding:0 8px;margin:0 1px;background:${T93};color:${DEEP};font-weight:500}.wb .grp .sl{color:${T66};margin:0 4px}.wb .bl{display:inline-block;width:46px;border-bottom:1.3px solid #1d1d1f;margin:0 3px;height:16px;vertical-align:middle}.wb .wline{border-bottom:1px solid ${T72};height:18px;margin:4px 0 2px}.wb .hintlbl{color:${A};font-weight:700;font-size:10px;margin-right:5px}.wb .hint{display:inline;border:1px dashed ${T61};background:${T93};color:${DEEP};border-radius:5px;padding:0 9px;font-weight:600;font-size:11px}.wb .hint .sl{color:${T66};margin:0 4px}.wb .passage{border:1px solid ${T86};border-left:3px solid ${A};background:${T97};border-radius:5px;padding:9px 12px;text-align:justify;text-indent:1.5em;font-size:12px;line-height:1.65;margin:2px 0 7px}.wb table.fill{border-collapse:collapse;width:100%;font-size:11px;table-layout:fixed}.wb table.fill th{background:${T93};color:#1d1d1f;padding:3px 8px;border:1px solid ${T80};font-weight:600;text-align:center}.wb table.fill th.w{width:calc((100% - 52px) / 2)}.wb table.fill td{border:1px solid ${T86};padding:6px 9px}.wb table.fill td.n{text-align:center;width:28px;background:${T95};font-weight:700;color:${A}}.wb table.fill td.ar{text-align:center;width:24px;color:${T61}}.wb .ph{border:1px dashed ${T80};border-radius:5px;padding:9px 11px;color:#a1a1a6;font-size:11px;background:${T97}}.wb .akh{font-size:21px;font-weight:700;letter-spacing:-0.3px;border-bottom:2px solid ${A};padding-bottom:6px;margin:0 0 3px;color:#1d1d1f}.wb .akg{font-weight:700;color:${A};font-size:12.5px;margin:10px 0 4px}.wb .ap{margin:0 0 4px;padding:5px 9px;border:1px solid ${T89};border-radius:6px;font-size:11px;line-height:1.6}.wb .ap .apn{font-weight:800;color:${A};display:inline-block;min-width:46px}.wb .ap .v{color:${A};font-weight:600}.wb .ap .sw{color:#8e8e93}.wb .apsg{margin-top:5px;font-size:11px;line-height:1.75;text-align:justify;text-indent:1.5em;color:#1d1d1f}.wb .fix{color:${A};font-weight:700}`;
}
const WB_STOP = new Set('a an the of in on to for with at by from as into about than over under up down off out through between among without within upon after before and or but so yet nor both either neither it they we you i he she our your their his her its them us me him this that these those some any no such each all one ones be is am are was were been being do does did have has had will would shall should can could may might must which who whom whose when where why how what whether if not there here more most less least very too also then only'.split(' '));
const WB_TYPES = [
  { tn: '유형 ① 어법 선택', td: '네모 안에서 어법상 알맞은 것을 고르시오.' },
  { tn: '유형 ② 어휘 어색한 곳', td: '문맥상 어색한 낱말 4곳을 찾아 바르게 고치시오.' },
  { tn: '유형 ③ 어법 어색한 곳', td: '어법상 어색한 곳 4군데를 찾아 바르게 고치시오.' },
  { tn: '유형 ④ 문장 배열', td: '괄호 안의 말을 어법·문맥에 맞게 배열하여 빈칸에 쓰시오.' },
  { tn: '유형 ⑤ 서술형 (영작)', td: '제시어(원형)를 활용하여 빈칸을 채워 영작하시오. (제시어 외 필요한 단어는 보충·변형)' },
];
// ②③ 정답: 고치기 표 대신 지문을 통째로 싣고, 틀린 자리만 옳은 말로 바꿔 포인트색 볼드로 보여준다.
// swaps 의 wrong 은 지문에 한 번만 나오도록 출제한다(현재 데이터 168곳 전부 1회). 혹시 여러 번 나오면 첫 자리만 고친다.
// 이미 고친 조각은 다시 건드리지 않으므로, 고친 말이 다른 swap 의 wrong 과 같아도 안전하다.
function wbFixedPassage(passage, swaps) {
  if (!passage) return null;
  const parts = [{ t: String(passage) }];
  (swaps || []).forEach((s) => {
    if (!s || !s.wrong) return;
    const re = new RegExp('\\b' + String(s.wrong).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].fix) continue;
      const m = re.exec(parts[i].t);
      if (!m) continue;
      const before = parts[i].t.slice(0, m.index), after = parts[i].t.slice(m.index + m[0].length);
      parts.splice(i, 1, { t: before }, { fix: s.right }, { t: after });
      break;
    }
  });
  return parts.map((p, i) => p.fix
    ? <b className="fix" key={i}>{p.fix}</b>
    : <React.Fragment key={i}>{p.t}</React.Fragment>);
}

function WorkbookSheetsInner({ sheets, academyName, serul = true, variant = 'standalone', pageOffset = 0, pcMain = '#0066cc' }) {
  const measRef = React.useRef(null);
  const [tops, setTops] = React.useState(null);
  const CW = variant === 'textbook' ? 680 : 698; // 콘텐츠 폭(px): 교재 미러마진 38+76 / 표준 48+48
  const keyHints = (h) => { const k = (h || []).filter(w => !WB_STOP.has(String(w).toLowerCase().trim())); return k.length ? k : (h || []); };
  const blocks = React.useMemo(() => {
    const rows = sheets.map((sh, i) => ({ sh, no: i + 1, d: WORKBOOK_BY_KEY[sh.key] }));
    const withData = rows.filter(r => r.d);
    const psub = (r) => (<div className="psub"><span className="pn">{r.sh.passageNum || (r.no + '번')}</span><span className="pt">{r.sh.passageTitle || r.sh.passageEng || ''}</span></div>);
    // 지문이 다음 장으로 이어질 때 그 장 맨 위에 다시 얹는 머리글
    const psubCont = (r) => (<div className="psub"><span className="pn">{r.sh.passageNum || (r.no + '번')}</span><span className="pt">{r.sh.passageTitle || r.sh.passageEng || ''}</span><span className="pcont">이어서</span></div>);
    // 어색한 것 / 고친 것 두 칸은 **폭을 똑같이**, 머리글은 **가운데 정렬**(강사 피드백)
    const fill = (<table className="fill"><tbody><tr><th style={{ width: '28px' }}></th><th className="w">어색한 것</th><th style={{ width: '24px' }}></th><th className="w">고친 것</th></tr>{[1, 2, 3, 4].map(n => (<tr key={n}><td className="n">{n}</td><td></td><td className="ar">→</td><td></td></tr>))}</tbody></table>);
    const arr = [];
    WB_TYPES.forEach((ty, ti) => {
      if (ti === 4 && !serul) return; // 서술형 토글 OFF → ⑤ 유형 제외
      arr.push({ group: 't' + ti, brk: true, el: (<div className="thead" key={'th' + ti}><div className="tt">{ty.tn}</div><div className="td">{ty.td}</div><div className="rule"></div></div>) });
      rows.forEach((r) => {
        const isLong = String(r.sh.passageNum || '').includes('-');
        if (!r.d) { arr.push({ group: 't' + ti, isPassage: true, isLong, el: (<div className="pblk" key={'t' + ti + 'p' + r.no}>{psub(r)}<div className="ph">이 지문의 워크북은 아직 생성되지 않았습니다.</div></div>) }); return; }
        const d = r.d;
        const pkey = 't' + ti + 'p' + r.no;
        if (ti === 1 || ti === 2) { // ②③은 지문 한 덩어리 + 고치기 표라 통째로 둔다
          const inner = (<React.Fragment><div className="passage">{ti === 1 ? d.s2_passage : d.s3_passage}</div>{fill}</React.Fragment>);
          arr.push({ group: 't' + ti, isPassage: true, isLong, el: (<div className="pblk" key={pkey}>{psub(r)}{inner}</div>) });
          return;
        }
        // ①④⑤는 문항 수 = 지문 문장 수(전 문장 커버)라 한 지문이 한 장을 넘긴다.
        // 지문을 한 블록으로 묶으면 시트가 overflow:hidden이라 넘친 문항이 잘려 사라진다.
        // → 문항 단위로 쪼개 페이지를 넘길 수 있게 하고, 넘어간 쪽엔 지문 머리글을 다시 얹는다.
        let items;
        if (ti === 0) items = d.s1.map((it, j) => (<div className="qitem" key={j}><div className="ko"><span className="qno">{j + 1}</span>{it.ko}</div><div className="en" dangerouslySetInnerHTML={{ __html: it.en }} /></div>));
        else if (ti === 3) items = d.s4.map((it, j) => (<div className="qitem" key={j}><div className="ko"><span className="qno">{j + 1}</span>{it.ko}</div><div className="en" dangerouslySetInnerHTML={{ __html: it.en }} /><div className="wline"></div></div>));
        else items = d.s5.map((it, j) => (<div className="qitem" key={j}><div className="ko"><span className="qno">{j + 1}</span>{it.ko}</div><div style={{ margin: '2px 0 4px' }}><span className="hintlbl">제시어</span><span className="hint">{keyHints(it.hint).join(' / ')}</span></div><div className="en" dangerouslySetInnerHTML={{ __html: it.en }} /></div>));
        const cont = psubCont(r);
        arr.push({ group: 't' + ti, isPsub: true, isLong, contEl: cont, el: (<div className="pblk" key={pkey}>{psub(r)}</div>) });
        items.forEach((el, j) => arr.push({ group: 't' + ti, isLong, contEl: cont, el: (<div className="pblk" key={pkey + 'i' + j}>{el}</div>) }));
      });
    });
    if (withData.length) {
      arr.push({ group: 'ans', brk: true, el: (<div className="akh" key="akh">정답</div>) });
      const groups = [
        { t: '유형 ① 어법 선택', f: (d) => d.s1.map((it, j) => (<span key={j}>{j + 1}) <span className="v">{it.ans.join(', ')}</span>&nbsp;&nbsp; </span>)) },
        { t: '유형 ② 어휘 어색한 곳', f: (d) => (<div className="apsg">{wbFixedPassage(d.s2_passage, d.s2_swaps)}</div>) },
        { t: '유형 ③ 어법 어색한 곳', f: (d) => (<div className="apsg">{wbFixedPassage(d.s3_passage, d.s3_swaps)}</div>) },
        { t: '유형 ④ 문장 배열', f: (d) => d.s4.map((it, j) => (<span key={j}>{j + 1}) <span className="v">{it.ans.join(' / ')}</span>&nbsp;&nbsp; </span>)) },
        { t: '유형 ⑤ 서술형', f: (d) => d.s5.map((it, j) => (<span key={j}>{j + 1}) <span className="v">{it.ans}</span>&nbsp;&nbsp; </span>)) },
      ];
      (serul ? groups : groups.slice(0, 4)).forEach((g, gi) => {
        arr.push({ group: 'ans', el: (<div className="akg" key={'akg' + gi}>{g.t}</div>) });
        withData.forEach((r) => arr.push({ group: 'ans', el: (<div className="ap" key={'a' + gi + 'p' + r.no}><span className="apn">{r.sh.passageNum || (r.no + '번')}</span>{g.f(r.d)}</div>) }));
      });
    }
    return arr;
  }, [sheets, serul]);

  React.useLayoutEffect(() => {
    const c = measRef.current; if (!c) return;
    const kids = Array.from(c.children);
    const t = kids.map(k => k.offsetTop); t.push(c.scrollHeight);
    setTops(t);
  }, [blocks]);

  if (!sheets.length) {
    return (
      <div style={{ maxWidth: '540px', margin: '90px auto 0', textAlign: 'center', padding: '38px 32px', borderRadius: '18px', background: '#f5f5f7', border: '1px solid #e0e0e0' }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#1d1d1f' }}>지문을 선택하세요</div>
        <div style={{ fontSize: '13.5px', color: '#6e6e73', marginTop: '10px', lineHeight: 1.65 }}>왼쪽에서 지문을 체크하면 <b>그 지문으로 5유형 워크북</b>이 만들어집니다.<br />어법 선택 · 어휘 어색한 곳 · 어법 어색한 곳 · 문장 배열 · 서술형 + 정답</div>
      </div>
    );
  }
  const needMeasure = !tops || tops.length !== blocks.length + 1;
  if (needMeasure) {
    return (
      <div style={{ position: 'absolute', left: '-99999px', top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
        <style>{WB_STYLE_FOR(pcMain)}</style>
        <div ref={measRef} className="wb" style={{ width: CW + 'px', display: 'flow-root' }}>{blocks.map(b => b.el)}</div>
      </div>
    );
  }
  // 페이지 배치: 유형마다 새 페이지 + 한 페이지에 지문 2개씩(41-42 장문은 단독). 실측 높이로 넘침도 방지.
  const BUDGET = variant === 'textbook' ? 1025 : 1035;
  const grpLabel = (g) => g === 'ans' ? '정답' : (WB_TYPES[+String(g).slice(1)] ? WB_TYPES[+String(g).slice(1)].tn : '');
  const pages = []; let cur = [], used = 0, pc = 0, curGrp = null;
  let contEl = null, contH = 0, contSeq = 0;
  const flush = () => { if (cur.length) { pages.push({ grp: curGrp, els: cur }); cur = []; used = 0; pc = 0; } };
  blocks.forEach((b, i) => {
    const h = tops[i + 1] - tops[i];
    if (b.brk) { flush(); curGrp = b.group; contEl = null; }
    else if (b.isPsub) {
      // 지문 머리글은 첫 문항과 붙어 있어야 한다 — 머리글만 남고 넘어가면 빈 페이지처럼 보인다
      const firstH = (tops[i + 2] == null ? 0 : tops[i + 2] - tops[i + 1]);
      if ((pc >= 2 || used + h + firstH > BUDGET || (b.isLong && pc > 0)) && cur.length) flush();
      contEl = b.contEl; contH = h;
    } else if (b.isPassage) {
      if ((pc >= 2 || used + h > BUDGET || (b.isLong && pc > 0)) && cur.length) flush();
      contEl = null;
    } else if (used + h > BUDGET && cur.length) {
      flush();
      // 지문 중간에서 장이 넘어가면 어느 지문인지 다시 알려준다
      if (contEl) { cur.push(React.cloneElement(contEl, { key: 'cont' + (contSeq += 1) })); used += contH; }
    }
    if (curGrp === null) curGrp = b.group;
    cur.push(b.el); used += h;
    if (b.isPassage || b.isPsub) pc += (b.isLong ? 2 : 1); // 장문은 페이지 독점
  });
  flush();
  const sheetBase = { width: '794px', maxWidth: 'none', margin: '0 auto 28px', height: '1123px', minHeight: '1123px', background: '#ffffff', color: '#1d1d1f', border: '1px solid #e0e0e0', borderRadius: '2px', boxShadow: 'rgba(0,0,0,0.1) 0px 12px 44px', overflow: 'hidden' };
  // 교재 제작 스코프 편입 시: 기존 미러 마진(홀수쪽 좌10/우20mm, 짝수쪽 좌20/우10mm) 적용, 앞 페이지 수(pageOffset)로 홀짝 연속
  const pad = (pi) => variant === 'textbook'
    ? ('30px ' + ((pageOffset + pi) % 2 === 0 ? 76 : 38) + 'px 24px ' + ((pageOffset + pi) % 2 === 0 ? 38 : 76) + 'px')
    : '24px 48px 20px';
  return (
    <React.Fragment>
      <style>{WB_STYLE_FOR(pcMain)}</style>
      {pages.map((pg, pi) => (
        <div key={pi} data-sheet="" style={{ ...sheetBase, padding: pad(pi) }}>
          <div className="wb" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flow-root' }}>{pg.els}</div>
            <div style={{ flex: 'none', marginTop: 'auto', paddingTop: '8px', fontSize: '11px', color: '#86868b', textAlign: ((variant === 'textbook' ? pageOffset : 0) + pi) % 2 === 0 ? 'left' : 'right' }}>{(variant === 'textbook' ? pageOffset : 0) + pi + 1}</div>
          </div>
        </div>
      ))}
      {/* 교재: 인쇄 시 맨 앞 백지 1면이 더해지므로, 물리 총면수(콘텐츠+백지)가 짝수면 메모 한 면을 더해 홀수로 끝맺음 */}
      {variant === 'textbook' && (pageOffset + pages.length) % 2 === 1 && (
        <div data-sheet="" style={{ ...sheetBase, padding: pad(pages.length) }}>
          <div className="wb" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#86868b', letterSpacing: '-0.2px', marginBottom: '10px' }}>메모</div>
              <div style={{ flex: 1, backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 37px, #e5e5ea 37px, #e5e5ea 38px)' }}></div>
            </div>
            <div style={{ flex: 'none', paddingTop: '8px', fontSize: '11px', color: '#86868b', textAlign: (pageOffset + pages.length) % 2 === 0 ? 'left' : 'right' }}>{pageOffset + pages.length + 1}</div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}
