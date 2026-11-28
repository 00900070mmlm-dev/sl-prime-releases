// 학교별 시험지 양식(A4) — 원당고·이음고. 사장님이 Saas 레포 스킬에 저장해 둔 틀(wondang/assets/frame.hwpx — A4,
// ieum/assets/frame_b4.hwpx — B4)의 모양을 A4 한 장에 옮겼다. 이음고는 B4 틀의 비율(여백·단 간격)을 A4 로 줄여 맞췄다.
// 앱의 문항 조각(13-weekly.js 의 wtItemParts·WT_CSS)을 그대로 쓰고, 머리(첫 쪽·둘째 쪽부터)와 꼬리만 틀 모양으로 그린다.
// 정답·해설은 싣지 않는다(틀도 정답과 해설을 시험지에서 뺀다). 머리글 글자는 cfg 로 받는다(exam-lab/forms/<학교>.json → 시험지마다 exam_papers.cfg).
// 앱의 시험지 관리(29-exammaker.js)와 exam-lab/school.mjs(PDF) 가 이 한 파일을 같이 쓴다.
const SC_SANS = "'Spoqa Han Sans Neo', 'Malgun Gothic', sans-serif";
// 틀의 글꼴(HY견고딕·함초롬돋움·함초롬바탕·HY궁서·바탕체)을 먼저 찾고, 없으면 비슷한 글꼴로(맥 = Apple SD Gothic Neo·AppleMyungjo, 윈도우 = 맑은 고딕·바탕)
const SC_F = {
  heavy: "'HY견고딕', 'HYGothic-Extra', 'SC Heavy', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",   // 원당고 과목·날짜
  dotum: "'함초롬돋움', 'HCR Dotum', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",       // 이음고 머리
  batang: "'함초롬바탕', 'HCR Batang', 'AppleMyungjo', 'Batang', serif",                          // 이음고 교시·안내
  gungseo: "'HY궁서', 'HYGungSo-Bold', 'AppleMyungjo', 'Batang', serif",                          // 원당고 안내
  batangche: "'바탕체', 'BatangChe', 'AppleMyungjo', 'Batang', serif",                            // 원당고 학교 이름·꼬리
};
// 틀 실측(px, A4 794×1123)에서 출발해 사장님 지시로 고쳤다(2026-11-19): 좌우 여백은 두 학교 모두 원당고 틀(15mm)보다 조금 좁게(44px ≈ 11.6mm),
// 둘째 쪽부터는 문항을 머리 줄 바로 아래(8px)에 붙인다 — 원본 시험지가 그렇다
// 머리를 통째로 위로 올렸다(2026-11-20 사장님 — "전체적으로 위쪽 마진이 너무 넓어보이더라", "이음고도 마찬가지야"). 원본 스캔에서 잰 자리는 첫 글자가 위에서
// 원당고 61px(첫 쪽)·65px(둘째 쪽부터), 이음고 82px·67px 였다 → 전부 40px 안팎(≈10mm)으로. 아래 여백(꼬리 밑 39px)과 비슷해졌고 쪽마다 문항이 그만큼 더 들어간다.
// 올린 양은 여기 하나 — 머리 글자·줄(아래 header 의 top − U)과 RULE1·TOP1·RULEN·TOPN 이 같이 움직인다. p1 = 첫 쪽, pn = 둘째 쪽부터
const SC_UP = { wondang: { p1: 24, pn: 24 }, ieum: { p1: 40, pn: 26 } };
const SC_G = {
  wondang: { L: 44, R: 750, GAP: 26, RULE1: 201 - SC_UP.wondang.p1, TOP1: 213 - SC_UP.wondang.p1, RULEN: 97 - SC_UP.wondang.pn, TOPN: 105 - SC_UP.wondang.pn, BOTTOM: 1048 },
  ieum:    { L: 44, R: 750, GAP: 26, RULE1: 214 - SC_UP.ieum.p1, TOP1: 226 - SC_UP.ieum.p1, RULEN: 95 - SC_UP.ieum.pn, TOPN: 103 - SC_UP.ieum.pn, BOTTOM: 1048 },
};
// 글자·간격을 앱 양식(12.4px)보다 줄여 학교 원본 쪽수(원당고 24문항 8쪽)에 가깝게 한다(2026-11-19 사장님 — "줄여").
// 이음고는 B4 를 A4 로 줄여 단이 좁으므로 조금 더 작게.
const SC_CSS = {
  wondang: { fs: 11, lh: 1.5, gap: 14 },
  ieum: { fs: 10.6, lh: 1.48, gap: 13 },
};
function scCss(school) { const c = SC_CSS[school];
  // 맥에서는 Apple SD Gothic Neo 의 ExtraBold 를 이름으로 불러야 원본(HY헤드라인)만큼 굵게 나온다(굵기 값만으로는 Bold 에서 멈춘다). Heavy 는 원본보다 뚱뚱했다
  return "@font-face{font-family:'SC Heavy';src:local('AppleSDGothicNeo-ExtraBold'),local('Apple SD Gothic Neo ExtraBold')}"
    + '.sc .wt{font-size:' + c.fs + 'px;line-height:' + c.lh + '}'
    + '.sc .wt-item{padding-bottom:' + c.gap + 'px}'
    + '.sc .wt-stem,.sc .wt-lead{font-size:' + (c.fs + 0.2) + 'px;line-height:1.45;margin-bottom:4px}'
    // 문항 번호는 학교 원본처럼 기울인 굵은 숫자(1. 4. 6.)를 조금 크게. 묶음 머리: 원당고 【1~3】, 이음고는 줄 전체 굵게
    + ".sc .wt-stem b{font-family:'Times New Roman',Times,serif;font-style:italic;font-weight:700;font-size:1.42em;line-height:1;margin-right:5px}"
    + (school === 'ieum' ? ".sc .wt-lead{font-family:" + SC_F.heavy.replace(/"/g, "'") + ";font-weight:700}" : '')
    // 묶음 지문 바로 밑에 오는 발문(【1~3】의 1번처럼)은 원본처럼 한 줄쯤 띄운다(2026-11-19 사장님 — "문항이랑 본문이랑 너무 붙어 있어")
    + '.sc .wt-psg+.wt-stem,.sc .wt-part+.wt-stem{margin-top:16px}'
    + '.sc .wt-given{padding:4px 7px;margin-bottom:4px}.sc .wt-ch{margin-top:4px}.sc .wt-part{margin-top:3px}'
    // 단을 넘어 쪼개진 문항(school.mjs 가 표시를 단다)은 여기서 한 단계씩 더 줄인다
    + '.sc .wt .wt-item:has(img[src$="#c1"]){font-size:' + (c.fs - 0.4) + 'px;line-height:1.45}'
    + '.sc .wt .wt-item:has(img[src$="#c2"]){font-size:' + (c.fs - 0.8) + 'px;line-height:1.42}'
    + '.sc .wt .wt-item:has(img[src$="#c3"]){font-size:' + (c.fs - 1.2) + 'px;line-height:1.4}'
    + '.sc .wt .wt-item:has(img[src*="#c"]) .wt-stem{font-size:inherit}';
}
function scNotice(cfg, nPages, nMc, nWr) {
  if (cfg.school === 'ieum') return [
    '문제지는 모두 ( ' + nPages + ' )면이고 총 문항 수는 ( ' + (nMc + nWr) + ' ) 문항입니다.',
    '선택형 ( ' + nMc + ' )문항, 서답형 ( ' + nWr + ' ) 문항으로 이루어져 있으며, 문항 배점은 각 물음의 끝에 표시되어 있습니다.',
    '서답형 문항의 답안은 문항 아래 답란에 작성하시오.',   // OMR·답안지를 쓰지 않는다(2026-11-25 사장님) — 원본의 '답안지 표기 사항…' 줄은 뺐다
  ];
  return [
    '문제를 잘 읽고 물음에 답하시오.',
    '시험지는 모두 ' + nPages + '면이며, 선다형 ' + nMc + '문항' + (nWr ? ', 서답형 ' + nWr + '문항' : '') + '입니다.',
    '배점은 각 문항 뒤에 제시되어 있습니다.',
  ].concat(nWr ? ['서답형 답은 문항 아래 답란에 작성하시오.'] : []);   // 원본의 'OCR 카드에 표기' 줄은 뺐다 — OMR 을 쓰지 않는다(2026-11-25 사장님)
}
// sel·onPick — 화면에서 문항을 누르면 고른다(주간테스트 '시험지 보기'의 wt-click·wt-sel 과 같은 표시). 인쇄에는 아무 영향이 없다
function SchoolSheets({ items, cfg, sel, onPick }) {
  const G = Object.assign({}, SC_G[cfg.school]); G.COLW = Math.floor((G.R - G.L - G.GAP) / 2); G.COL2 = G.L + G.COLW + G.GAP; G.MID = G.L + G.COLW + Math.round(G.GAP / 2);
  const measRef = React.useRef(null);
  const [meas, setMeas] = React.useState(null);
  const nWr = items.filter(it => !it.missing && !(it.choices || []).length && it.typeLabel === '서답형').length;
  const nMc = items.length - nWr;
  const [nPages, setNPages] = React.useState(0);
  const noticeOf = n => scNotice(cfg, n || '  ', nMc, nWr);
  const noticeBox = (n) => (
    <div style={{ width: G.COLW + 'px', fontFamily: cfg.school === 'ieum' ? SC_F.batang : SC_F.gungseo, fontSize: '11.5px', fontWeight: cfg.school === 'ieum' ? 400 : 700, lineHeight: 1.6, paddingBottom: '7px', borderBottom: cfg.school === 'ieum' ? 'none' : '1px solid #000', wordBreak: 'keep-all' }}>
      {noticeOf(n).map((l, i) => <div key={i} style={{ paddingLeft: '0.9em', textIndent: '-0.9em' }}>{(cfg.school === 'ieum' ? '• ' : '·') + l}</div>)}
    </div>
  );
  React.useLayoutEffect(() => {
    const c = measRef.current; if (!c) return;
    const itemH = Array.from(c.querySelectorAll('[data-wt-item]')).map(el => {
      const kids = Array.from(el.children); const tops = kids.map(k => k.offsetTop - el.offsetTop);
      return { total: el.offsetHeight, parts: kids.map((k, j) => ((j + 1 < kids.length ? tops[j + 1] : el.offsetHeight) - tops[j])) };
    });
    const boxEl = c.querySelector('[data-sc-box]');
    setMeas({ itemH, boxH: boxEl ? boxEl.offsetHeight : 90 });
  }, [items]);
  const measure = (
    <div data-noprint="" style={{ position: 'absolute', left: '-99999px', top: 0, visibility: 'hidden' }}>
      <div ref={measRef} className="wt" style={{ width: G.COLW + 'px', display: 'flow-root' }}>
        {items.map((it, i) => <div key={it.id} data-wt-item="" className="wt-item">{wtItemParts(it, i + 1)}</div>)}
        <div data-sc-box="">{noticeBox(88)}</div>
      </div>
    </div>
  );
  if (!meas || meas.itemH.length !== items.length) return <div className="sc"><style>{WT_CSS + scCss(cfg.school)}</style>{measure}</div>;
  const colTop = (page, col) => page === 0 ? G.TOP1 + (col === 0 ? meas.boxH + 14 : 0) : G.TOPN;
  const pages = []; let page = 0, col = 0, used = 0;
  const cap = () => G.BOTTOM - colTop(page, col);
  const cell = () => { while (pages.length <= page) pages.push([[], []]); return pages[page][col]; };
  const next = () => { if (col === 0) col = 1; else { col = 0; page += 1; } used = 0; };
  items.forEach((it, i) => {
    const h = meas.itemH[i];
    if (used > 0 && used + h.total > cap()) next();
    if (h.total <= cap()) { cell().push({ it, i, parts: null }); used += h.total; return; }
    let chunk = [];
    h.parts.forEach((ph, j) => { if (used + ph > cap() && (used > 0 || chunk.length)) { if (chunk.length) cell().push({ it, i, parts: chunk }); chunk = []; next(); } chunk.push(j); used += ph; });
    if (chunk.length) cell().push({ it, i, parts: chunk }); used += 22;
  });
  if (!pages.length) pages.push([[], []]);
  const total = pages.length;
  const abs = x => Object.assign({ position: 'absolute' }, x);
  const B = { fontFamily: SC_SANS, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1 };
  const rule = (top, w) => <div style={abs({ left: G.L, width: G.R - G.L, top, borderTop: (w || 1.4) + 'px solid #000' })} />;
  // 색은 전부 검정(사장님 — "무조건 검정색"). 원본 스캔의 회색 과목명도 검정으로.
  // 첫 쪽 머리 — 학교 원본 시험지(스캔본, in/exam.pdf · in/ieum1/exam.pdf) 1쪽에서 잰 자리·크기를 A4 로 옮겼다(2026-11-19 사장님 — "원본 시험지랑 비교").
  // 원본 글꼴(HY헤드라인·HY신명조·HY궁서)은 없으면 비슷한 것으로 — 맥은 Apple SD Gothic Neo ExtraBold·AppleMyungjo.
  const header = p => {
    const HV = { fontFamily: SC_F.heavy, fontWeight: 900, whiteSpace: 'nowrap', lineHeight: 1 };
    if (cfg.school === 'wondang') {
      const U = SC_UP.wondang.p1, UN = SC_UP.wondang.pn;   // 머리를 올린 양(아래 top 값은 원본에서 잰 자리 − 올린 양)
      // 둘째 쪽부터 — 원본 2쪽: 왼쪽 과목(영어Ⅱ) · 오른쪽 학년·반, 굵은 머리 글씨 + 아래 굵은 줄
      if (p > 0) return (<React.Fragment>
        <div style={abs(Object.assign({ left: 80, top: 65 - UN, fontSize: '25px' }, HV))}>{cfg.subject}</div>
        <div style={abs(Object.assign({ right: 794 - 735, top: 65 - UN, fontSize: '25px', letterSpacing: '-0.3px' }, HV))}>{cfg.klass}</div>
        {rule(G.RULEN, 2)}
      </React.Fragment>);
      return (<React.Fragment>
        <div style={abs(Object.assign({ left: 80, top: 61 - U, fontSize: '22px', letterSpacing: '-0.3px' }, HV))}>{cfg.term}</div>
        <div style={abs(Object.assign({ right: 794 - 712, top: 61 - U, fontSize: '22px', letterSpacing: '-0.3px' }, HV))}>{cfg.klass}</div>
        {rule(91 - U, 1.2)}
        {/* 날짜를 비우면(2026-11-20 사장님) 과목(영어Ⅱ)을 위아래 두 줄 사이 가운데로 — 날짜 자리가 비어 위로 쏠려 보였다 */}
        <div style={abs(Object.assign({ left: 80, top: 136 - U, fontSize: '25px', letterSpacing: '-0.5px' }, HV))}>{cfg.name}</div>
        <div style={abs(Object.assign({ left: 394, width: 200, textAlign: 'center', top: cfg.date ? 101 - U : Math.round((91 - U + G.RULE1) / 2 - 20), fontSize: '40px', color: '#000' }, HV))}>{cfg.subject}{cfg.subNote ? <span style={{ fontSize: '13px', marginLeft: '12px', color: '#000' }}>{cfg.subNote}</span> : null}</div>
        <div style={abs(Object.assign({ left: 387, width: 216, textAlign: 'center', top: 163 - U, fontSize: '23px', letterSpacing: '-0.3px' }, HV))}>{cfg.date}</div>
        {rule(G.RULE1, 1.2)}
      </React.Fragment>);
    }
    const V = SC_UP.ieum.p1, VN = SC_UP.ieum.pn;
    if (p === 0) return (<React.Fragment>
      <div style={abs(Object.assign({ left: 0, right: 0, textAlign: 'center', top: 82 - V, fontSize: '22px', letterSpacing: '-0.2px', wordSpacing: '3px' }, HV))}>{cfg.title}</div>
      <div style={abs(Object.assign({ left: 72, top: 134 - V, fontSize: '21px', letterSpacing: '-0.2px', wordSpacing: '2px' }, HV))}>{cfg.date}</div>
      {cfg.period ? <div style={abs({ left: 72, top: 167 - V, height: 27, width: 108, boxSizing: 'border-box', border: '1.2px solid #000', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SC_F.batang, fontWeight: 700, fontSize: '19px', whiteSpace: 'nowrap', wordSpacing: '3px' })}>{cfg.period}</div> : null}
      <div style={abs(Object.assign({ left: 0, right: 0, textAlign: 'center', top: 138 - V, fontSize: '50px', color: '#000', letterSpacing: '0.5px' }, HV))}>{cfg.subject}</div>
      {cfg.code ? <div style={abs({ right: 794 - 727, top: 141 - V, width: 141, height: 42, boxSizing: 'border-box', border: '1.2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', fontFamily: SC_F.heavy, fontWeight: 900, whiteSpace: 'nowrap' })}><span style={{ fontSize: '17px' }}>과목코드</span><span style={{ fontSize: '21px' }}>{cfg.code}</span></div> : null}
      {rule(G.RULE1, 1.4)}
    </React.Fragment>);
    // 둘째 쪽부터 — 원본 2쪽: 왼쪽 학년도·학기 · 오른쪽 ( 학년 )( 과목 ), 굵은 머리 글씨 + 아래 줄
    return (<React.Fragment>
      <div style={abs(Object.assign({ left: 75, top: 67 - VN, fontSize: '22px', letterSpacing: '-0.3px', wordSpacing: '2px' }, HV))}>{cfg.term}</div>
      <div style={abs(Object.assign({ right: 794 - 728, top: 67 - VN, fontSize: '22px', letterSpacing: '-0.3px', wordSpacing: '2px' }, HV))}>{cfg.gradeTag}</div>
      {rule(G.RULEN, 1.4)}
    </React.Fragment>);
  };
  // 꼬리 — 원본처럼 가운데 아래 사선 칸(현재 쪽 / 전체 쪽), 그 오른쪽에 저작권. 저작권 글은 학교가 아니라 우리(에스엘프라임학원) 것 — 우리가 만든 시험지다
  const footer = p => (<React.Fragment>
    <div style={abs({ left: G.MID - 31, top: 1058, width: 62, height: 26, border: '1.3px solid #000', fontFamily: WT_SERIF, fontSize: '15px', fontWeight: 700 })}>
      {/* `/` 사선은 진짜 선(SVG)으로 — 그라데이션은 PDF 에서 그림이 된다(2026-11-23 사장님: 화면용 그리기 금지) */}
      <svg style={abs({ left: 0, top: 0, width: '100%', height: '100%' })}><line x1="100%" y1="0" x2="0" y2="100%" stroke="#000" strokeWidth="1.4" /></svg>
      <span style={abs({ left: 7, top: -1 })}>{p}</span><span style={abs({ right: 7, bottom: -2 })}>{total}</span>
    </div>
    <div style={abs({ left: G.MID + 46, top: 1059, fontFamily: SC_F.batangche, fontSize: '10px', fontWeight: cfg.school === 'wondang' ? 700 : 400, lineHeight: 1.55, whiteSpace: 'nowrap' })}>
      <div>◎ 이 문제지에 대한 저작권은 에스엘프라임학원에 있습니다.</div>
      <div>무단 전송·복제·배포 시 저작권법에 의거 처벌될 수 있습니다.</div>
    </div>
  </React.Fragment>);
  const sheetStyle = { position: 'relative', width: '794px', height: '1123px', margin: '0 auto 28px', background: '#fff', color: '#000', overflow: 'hidden' };
  return (
    <div className="sc">
      <style>{WT_CSS + scCss(cfg.school)}</style>
      {measure}
      {pages.map((cols, p) => (
        <div data-sheet="" key={p} style={sheetStyle}>
          {header(p)}
          <div style={abs({ left: G.MID, top: p === 0 ? G.RULE1 : G.RULEN, height: G.BOTTOM + 8 - (p === 0 ? G.RULE1 : G.RULEN), borderLeft: '1px solid #000' })} />
          {p === 0 && <div style={abs({ left: G.L, top: G.TOP1 })}>{noticeBox(total)}</div>}
          {cols.map((cells, ci) => (
            <div key={ci} className="wt" style={abs({ left: ci === 0 ? G.L : G.COL2, top: colTop(p, ci), width: G.COLW })}>
              {cells.map((c, k) => { const all = wtItemParts(c.it, c.i + 1); const shown = c.parts ? c.parts.map(j => all[j]) : all;
                return <div key={k} data-no={c.it.num} className={'wt-item' + (onPick ? ' wt-click' : '') + (sel === c.it.num ? ' wt-sel' : '')} onClick={onPick ? () => onPick(c.it.num) : undefined} style={c.parts && c.parts[c.parts.length - 1] !== all.length - 1 ? { paddingBottom: 0 } : null}>{shown}</div>; })}
            </div>
          ))}
          {footer(p + 1)}
        </div>
      ))}
      {/* 시험지가 짝수 쪽으로 끝나면 백지 한 장을 더한다 — 정답지가 다음 장을 넘겨야 나오게(2026-11-19 사장님) */}
      {total % 2 === 0 && !cfg.noAns && <div data-sheet="" data-sc-blank="" className="wt-print-only" style={sheetStyle} />}
    </div>
  );
}
