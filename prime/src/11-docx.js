// 구클 .docx 내보내기 — 진짜 OOXML 파일을 만든다.
//
// 예전에는 HTML 을 `application/msword` 로 감싸 `.doc` 확장자로 내려줬다. 워드는 열지만
// **구글 문서(구글 클래스룸)로 올리면 표·서식이 깨진다** — 그 파일은 워드 문서가 아니라
// 확장자만 바꾼 HTML 이기 때문이다. 그래서 이 유형만 진짜 docx 로 바꿨다.
//
// 만드는 곳이 **렌더러**인 이유: 여기서 만들면 `app/` 변경이라 UI 핫 업데이트로 전 PC에
// 바로 나간다. 메인 프로세스(IPC)로 만들면 설치본을 다시 깔아야 하고, 서명이 없는 맥은
// 자동 업데이트가 안 돼 특히 곤란하다. vendor/docx.iife.js 는 Node 의존이 없는 브라우저 빌드다.
//
// 화면 미리보기와 같은 모양을 목표로 한다:
//   [출처(작게) / 번호(크게·포인트색)] [영문 주제(굵게) / 한글 주제]
//   ─────────────────────────────────  (검정 가로줄)
//   01 | 영어 문장
//      | 해석 :                        (문장마다 아래 연회색 구분선)

// 워드 단위: 1pt = 2 half-point, 1cm = 567 twip
const DOCX_PT = (pt) => Math.round(pt * 2);
const DOCX_CM = (cm) => Math.round(cm * 567);

// #rrggbb → RRGGBB (docx 는 # 없는 6자리를 받는다)
function docxHex(c, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ''));
  return m ? m[1].toUpperCase() : fallback;
}

// ── 구글 문서 호환을 위한 두 가지 (분석서 재료 빌더와 같은 방식) ──
//
// ① 글꼴 이름은 **영문 이름**을 쓰고 한글·영문을 런으로 갈라 각각 지정한다.
//    '맑은 고딕' 같은 한글(로컬라이즈) 이름은 워드는 알아듣지만 구글 문서는 모른다 —
//    글꼴을 못 찾아 제 마음대로 대체하면서 줄간격·표 폭이 함께 틀어진다.
//    한 런에 한글과 영문을 섞으면 eastAsia 글꼴 지정이 없어 영문까지 한글 글꼴로 잡힌다.
// ② 표 너비는 퍼센트가 아니라 **DXA(트윕) 고정값**으로 주고 columnWidths 로 tblGrid 를 남긴다.
//    구글 문서는 tblGrid 가 없는 퍼센트 표를 읽으면 열 폭을 스스로 재계산해 표가 무너진다.
const DOCX_FONT_KR = 'Malgun Gothic';
const DOCX_FONT_EN = 'Arial';
const DOCX_KR_RE = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯]/;

/** 문자열을 한글/비한글 덩어리로 쪼갠다. */
function docxSplitScript(text) {
  const out = [];
  let cur = '', curKr = null;
  for (const ch of String(text == null ? '' : text)) {
    const kr = DOCX_KR_RE.test(ch);
    if (curKr === null) { curKr = kr; cur = ch; }
    else if (kr === curKr) { cur += ch; }
    else { out.push({ text: cur, kr: curKr }); cur = ch; curKr = kr; }
  }
  if (cur !== '') out.push({ text: cur, kr: curKr });
  return out;
}

/**
 * 구클 문서를 만든다.
 * @param {Array} sheets 04-studio.js 의 sheets (label·passageEng·passageTitle·lineItems)
 * @param {{pointColor?:string, docTitle?:string}} opts
 * @returns {Promise<Blob>} .docx 바이트
 */
async function buildGuklDocx(sheets, opts) {
  const o = opts || {};
  if (!window.docx) throw new Error('docx 라이브러리가 로드되지 않았습니다 (vendor/docx.iife.js).');
  const D = window.docx;
  const PC = docxHex(o.pointColor, '0066CC');
  const GRAY = '6E6E73';
  const PALE = '9AA6B2';
  const RULE = 'EDEDF0';

  // A4(21.0×29.7cm)에서 좌우 여백(1.6cm)을 뺀 본문 폭. 표는 이 폭을 열 비율대로 나눠 갖는다.
  const CONTENT_W = DOCX_CM(21.0) - DOCX_CM(1.6) * 2;
  const cols = (...ratios) => {
    const sum = ratios.reduce((a, b) => a + b, 0);
    const w = ratios.map((r) => Math.round(CONTENT_W * r / sum));
    w[w.length - 1] = CONTENT_W - w.slice(0, -1).reduce((a, b) => a + b, 0); // 반올림 오차는 마지막 열이 흡수
    return w;
  };
  const HEAD_COLS = cols(26, 74);   // 출처·번호 / 주제
  const BODY_COLS = cols(7, 93);    // 번호 / 문장

  const noBorder = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
    insideHorizontal: noBorder, insideVertical: noBorder };

  // 한 문자열 → TextRun 배열. 한글과 영문을 갈라 글꼴을 따로 준다(위 ① 참고).
  const run = (text, extra) => docxSplitScript(text).map((p) => new D.TextRun(
    Object.assign({ text: p.text, font: p.kr ? DOCX_FONT_KR : DOCX_FONT_EN }, extra || {})));
  const para = (children, extra) => new D.Paragraph(Object.assign(
    { children: (Array.isArray(children) ? children : [children]).flat() }, extra || {}));

  // ── 지문 하나 ────────────────────────────────────────────
  function sheetBlocks(sh, isFirst) {
    const mainT = sh.passageEng || sh.passageTitle || '';
    const subT = sh.passageEng ? (sh.passageTitle || '') : '';
    const lab = sh.label || {};
    const out = [];

    // 머리: 왼쪽 출처/번호, 오른쪽 주제. 테두리 없는 2칸 표로 나란히 둔다.
    out.push(new D.Table({
      width: { size: CONTENT_W, type: D.WidthType.DXA },
      columnWidths: HEAD_COLS,
      borders: noBorders,
      // 첫 지문이 아니면 이 표 앞에서 쪽을 넘긴다
      rows: [new D.TableRow({
        children: [
          new D.TableCell({
            width: { size: HEAD_COLS[0], type: D.WidthType.DXA },
            borders: noBorders,
            verticalAlign: D.VerticalAlign.BOTTOM,
            children: [
              para(run(lab.top || '', { size: DOCX_PT(11), color: PALE }), { spacing: { after: 0 } }),
              para(run(lab.main || '', { size: DOCX_PT(30), bold: true, color: PC }), { spacing: { before: 0, after: 0 } }),
            ],
          }),
          new D.TableCell({
            width: { size: HEAD_COLS[1], type: D.WidthType.DXA },
            borders: noBorders,
            verticalAlign: D.VerticalAlign.CENTER,
            children: [
              para(run(mainT, { size: DOCX_PT(14), bold: true }), { spacing: { after: subT ? 60 : 0 } }),
            ].concat(subT ? [para(run(subT, { size: DOCX_PT(11), color: GRAY }))] : []),
          }),
        ],
      })],
    }));

    // 머리 아래 검정 가로줄 — 빈 문단의 아래 테두리로 그린다
    out.push(new D.Paragraph({
      children: [],
      spacing: { before: 120, after: 120 },
      border: { bottom: { style: D.BorderStyle.SINGLE, size: 8, color: '1D1D1F' } },
    }));

    // 본문: 문장마다 [번호 | 영문 + 해석칸]. 행이 페이지에 걸치면 통째로 다음 장으로.
    const rows = (sh.lineItems || []).map((it) => new D.TableRow({
      cantSplit: true,
      children: [
        new D.TableCell({
          width: { size: BODY_COLS[0], type: D.WidthType.DXA },
          borders: { top: noBorder, left: noBorder, right: noBorder,
            bottom: { style: D.BorderStyle.SINGLE, size: 4, color: RULE } },
          margins: { top: 180, bottom: 180 },
          children: [para(run(it.num, { size: DOCX_PT(10), bold: true, color: PC }))],
        }),
        new D.TableCell({
          width: { size: BODY_COLS[1], type: D.WidthType.DXA },
          borders: { top: noBorder, left: noBorder, right: noBorder,
            bottom: { style: D.BorderStyle.SINGLE, size: 4, color: RULE } },
          margins: { top: 180, bottom: 180 },
          children: [
            para(run(it.en, { size: DOCX_PT(12.5) }), { spacing: { line: 420, after: 140 } }),
            para(run('해석 :', { size: DOCX_PT(10.5), bold: true, color: GRAY })),
          ],
        }),
      ],
    }));
    if (rows.length) {
      out.push(new D.Table({ width: { size: CONTENT_W, type: D.WidthType.DXA },
        columnWidths: BODY_COLS, borders: noBorders, rows }));
    }
    return out;
  }

  const children = [];
  (sheets || []).forEach((sh, i) => {
    if (i > 0) {
      // 표 다음에 바로 표가 오면 워드가 둘을 붙여 버린다. 쪽나눔 문단을 사이에 끼운다.
      children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
    }
    sheetBlocks(sh, i === 0).forEach((b) => children.push(b));
  });

  const doc = new D.Document({
    title: o.docTitle || '지문자료',
    styles: { default: { document: { run: { font: DOCX_FONT_EN, size: DOCX_PT(11) } } } },
    sections: [{
      properties: {
        page: {
          size: { width: DOCX_CM(21.0), height: DOCX_CM(29.7) },          // A4
          margin: { top: DOCX_CM(1.7), bottom: DOCX_CM(1.7), left: DOCX_CM(1.6), right: DOCX_CM(1.6) },
        },
      },
      children,
    }],
  });

  return await D.Packer.toBlob(doc);
}
