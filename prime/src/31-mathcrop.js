// ============================================================
// 31-mathcrop.js — 수학 PDF 시험지 → 문항 그림(2026-11-23 사장님 — "수학도 주간테스트,데이테스트도 가능하도록",
// "객관식만 할거니까 문항 크롭해서 우리 시험지 양식으로 넣으면 될듯", "답지도 합본되어있으니까").
//
// 수학 문항은 수식·그림이라 글자로 옮기지 않는다. PDF 쪽에서 **문항 자리(상자)** 만 찾아 두고,
// 시험지를 볼 때 저장해 둔 PDF 를 다시 그려 그 상자를 잘라 우리 양식(평가원 2단)에 문항 그림으로 넣는다.
//   · 저장하는 것은 상자 좌표뿐이다(payload.items[].box = [쪽, x, y, w, h] — PDF 포인트, 쪽 왼쪽 위 기준).
//     그림 파일을 따로 올리지 않는다 — storage 버킷 'weekly' 는 PDF 만 받는다.
//   · 자리는 글자 층에서 문항 번호(1. 2. 3. … 차례로 이어지는 것)를 찾아 잡고, 정답은 뒤쪽 정답표에서 읽는다.
//     틀리게 잡힌 것은 선생님이 상자를 끌어 고친다(McEditor). 글자 층이 없는 스캔 PDF 는 상자를 직접 그린다.
//   · 문항 번호는 원본 글자 그대로 그림 안에 들어 있다(우리가 다시 쓰지 않는다).
// ============================================================

const MC_PREVIEW = 1.5;      // 고치는 화면의 쪽 그림 배율(pt → px)
const MC_RENDER = 3;         // 시험지에 넣을 문항 그림 배율 — 306px 단에 2배 넘게 들어가 인쇄해도 또렷하다
const MC_CIRC = '①②③④⑤';

function mcPdfLib() {
  if (!window.pdfjsLib) throw new Error('pdf.js가 로드되지 않았습니다');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  return window.pdfjsLib;
}
function mcCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

/** 쪽의 글자 조각 — { s, x, y(위), w, h } (pt, 쪽 왼쪽 위 기준) */
async function mcPageText(page, vp) {
  const tc = await page.getTextContent();
  const out = [];
  (tc.items || []).forEach((it) => {
    const s = String(it.str || '').normalize('NFC');      // 맥에서 만든 PDF 는 한글이 자모로 풀려 올 수 있다
    if (!s.trim()) return;
    const tr = it.transform || [1, 0, 0, 1, 0, 0];
    const h = Math.hypot(tr[2], tr[3]) || it.height || 10;
    const pt = vp.convertToViewportPoint(tr[4], tr[5]);
    out.push({ s, x: pt[0], y: pt[1] - h, w: it.width || 0, h });
  });
  return out;
}

/** 어두운 점인가(종이 바탕이 아닌가) */
function mcDark(d, i) { return d[i + 3] > 40 && (d[i] < 225 || d[i + 1] < 225 || d[i + 2] < 225); }

/** 상자 안에서 그림이 있는 범위만 남긴다(바깥 여백을 깎는다). 쪽을 가르는 긴 선(세로 가름선·머리 가로줄)은 내용으로 치지 않는다.
 *  cutGap(pt) 을 주면 내용이 시작된 뒤 그만큼 빈 줄이 이어지는 곳에서 끊는다 — 단의 마지막 문항 아래 쪽 번호·꼬리말을 떼려고.
 *  돌려주는 것: { x, y, w, h } (pt) 또는 null(빈 상자) */
function mcTrim(cv, sc, b, cutGap) {
  const x0 = Math.max(0, Math.floor(b.x * sc)), y0 = Math.max(0, Math.floor(b.y * sc));
  const x1 = Math.min(cv.width, Math.ceil((b.x + b.w) * sc)), y1 = Math.min(cv.height, Math.ceil((b.y + b.h) * sc));
  const W = x1 - x0, H = y1 - y0;
  if (W < 4 || H < 4) return null;
  const d = cv.getContext('2d').getImageData(x0, y0, W, H).data;
  const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) m[i] = mcDark(d, i * 4) ? 1 : 0;
  // 긴 선 — 끊기지 않고 상자 높이의 90%(또는 120pt) 넘게 내려가는 세로줄(단 가름선), 폭의 90% 넘게 가는 가로줄(머리 줄).
  // 선이 지나는 줄은 전부 "내용 있음"이 되어 여백을 못 깎으므로, 선의 점은 세지 않는다.
  const lineCol = new Uint8Array(W), lineRow = new Uint8Array(H);
  const vMin = Math.min(H * 0.9, 120 * sc), hMin = W * 0.9;
  for (let x = 0; x < W; x++) { let run = 0, best = 0; for (let y = 0; y < H; y++) { if (m[y * W + x]) { if (++run > best) best = run; } else run = 0; } if (best >= vMin) lineCol[x] = 1; }
  for (let y = 0; y < H; y++) { let run = 0, best = 0; for (let x = 0; x < W; x++) { if (m[y * W + x]) { if (++run > best) best = run; } else run = 0; } if (best >= hMin) lineRow[y] = 1; }
  const rows = new Int32Array(H);
  for (let y = 0; y < H; y++) { if (lineRow[y]) continue; for (let x = 0; x < W; x++) if (m[y * W + x] && !lineCol[x]) rows[y]++; }
  const rowOn = (y) => rows[y] > 0;
  const colOn = (x) => !lineCol[x];
  let top = 0; while (top < H && !rowOn(top)) top++;
  if (top >= H) return null;
  let bot = H - 1; while (bot > top && !rowOn(bot)) bot--;
  if (cutGap) {
    const g = cutGap * sc; let blank = 0;
    for (let y = top; y <= bot; y++) { if (rowOn(y)) blank = 0; else if (++blank >= g) { bot = y - blank; break; } }
  }
  // 좌우는 남긴 줄 안에서만 다시 센다(끊어 낸 꼬리말의 폭이 끼지 않게)
  const cols2 = new Int32Array(W);
  for (let y = top; y <= bot; y++) { if (lineRow[y]) continue; for (let x = 0; x < W; x++) if (m[y * W + x]) cols2[x]++; }
  let left = 0; while (left < W && !(cols2[left] > 0 && colOn(left))) left++;
  let right = W - 1; while (right > left && !(cols2[right] > 0 && colOn(right))) right--;
  if (left >= W) return null;
  const pad = 2 * sc;
  const L = Math.max(0, left - pad), T = Math.max(0, top - pad), R = Math.min(W, right + 1 + pad), B = Math.min(H, bot + 1 + pad);
  return { x: (x0 + L) / sc, y: (y0 + T) / sc, w: (R - L) / sc, h: (B - T) / sc };
}

/** 문항 맨 위의 작은 출처 글자('[2018년 11월 고1 10번/3점]' — 번호 오른쪽, 발문 첫 줄 위)의 자리. 없으면 null.
 *  2026-11-23 사장님 — "출처 글자도 빼줘". 번호와 나란히 있어 잘라 낼 수는 없고, 그릴 때 그 자리를 흰색으로 덮는다(payload.items[].mask).
 *  번호 오른쪽에서 먹이 있는 줄 띠를 위에서부터 보아, 첫 띠가 상자 맨 위에 있고 · 낮고(7.5pt 이하) · 다음 띠(발문 첫 줄)보다 뚜렷이 낮으며 · 바로 붙어 있을 때만 출처로 본다. */
function mcTagMask(cv, sc, b, xFrom) {
  const x0 = Math.max(0, Math.round(xFrom * sc)), y0 = Math.max(0, Math.round(b.y * sc));
  const W = Math.min(cv.width, Math.round((b.x + b.w) * sc)) - x0, H = Math.min(cv.height, Math.round((b.y + b.h) * sc)) - y0;
  if (W < 20 || H < 20) return null;
  const d = cv.getContext('2d').getImageData(x0, y0, W, H).data;
  const bands = []; let s0 = -1;
  for (let y = 0; y <= H && bands.length < 2; y++) {
    let on = false;
    if (y < H) for (let x = 0; x < W; x++) if (mcDark(d, (y * W + x) * 4)) { on = true; break; }
    if (on && s0 < 0) s0 = y;
    if (!on && s0 >= 0) { bands.push([s0, y - 1]); s0 = -1; }
  }
  if (bands.length < 2) return null;
  const h1 = (bands[0][1] - bands[0][0] + 1) / sc, h2 = (bands[1][1] - bands[1][0] + 1) / sc, gap = (bands[1][0] - bands[0][1]) / sc;
  if (bands[0][0] / sc > 6 || h1 > 7.5 || h1 > h2 * 0.72 || gap > 8) return null;
  let l = W, r = -1;
  for (let y = bands[0][0]; y <= bands[0][1]; y++) for (let x = 0; x < W; x++) if (mcDark(d, (y * W + x) * 4)) { if (x < l) l = x; if (x > r) r = x; }
  if (r < 0) return null;
  return [(x0 + l) / sc - 1.5, (y0 + bands[0][0]) / sc - 1, (r - l + 1) / sc + 3, h1 + 2].map((v) => Math.round(v * 10) / 10);
}

/** 글자 조각을 줄로 묶어 한 줄씩 이어 붙인다(위 → 아래, 왼쪽 → 오른쪽) */
function mcLines(text) {
  const its = text.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  its.forEach((t) => {
    const cy = t.y + t.h / 2;
    const ln = lines.length && Math.abs(lines[lines.length - 1].cy - cy) < Math.max(3, t.h * 0.45) ? lines[lines.length - 1] : null;
    if (ln) ln.items.push(t); else lines.push({ cy, y: t.y, items: [t] });
  });
  lines.forEach((ln) => ln.items.sort((a, b) => a.x - b.x));
  return lines;
}

/** 정답표를 읽는다 — { 번호: 정답(1~5, 복수면 이어 붙인 수) }. '1 ③' · '1) ③' · '1번 ③' 짝, 또는 번호 줄 아래 ①~⑤ 줄(표).
 *  fromY 를 주면 그 쪽에서 그 아래 글자만 본다. */
function mcAnswersOf(text, fromY) {
  const src = fromY != null ? text.filter((t) => t.y >= fromY - 2) : text;
  const lines = mcLines(src);
  const ans = {};
  const circ = (s) => { let v = ''; String(s).split('').forEach((ch) => { const k = MC_CIRC.indexOf(ch); if (k >= 0) v += String(k + 1); }); return v ? Number(v.split('').sort().join('')) : 0; };
  // ① 짝
  // 줄을 전부 이어 붙여 찾는다 — 번호가 줄 끝에 걸리고 정답이 다음 줄로 넘어간 짝도 잡는다
  {
    const s = lines.map((ln) => ln.items.map((t) => t.s).join(' ')).join(' ');
    const re = /(\d{1,3})\s*(?:[.)\]:]|번)?\s*([①②③④⑤](?:\s*[,·]?\s*[①②③④⑤])*)/g; let m;
    while ((m = re.exec(s))) { const no = Number(m[1]); if (no >= 1 && no <= 200 && ans[no] == null) ans[no] = circ(m[2]); }
  }
  // ② 표 — 숫자만 있는 줄 바로 아래 동그라미만 있는 줄(칸 수가 같다)
  for (let i = 0; i + 1 < lines.length; i++) {
    const a = lines[i].items.map((t) => t.s.trim()).join(' ').split(/\s+/).filter(Boolean);
    const b = lines[i + 1].items.map((t) => t.s.trim()).join('').replace(/\s+/g, '').split('');
    if (a.length >= 2 && a.every((x) => /^\d{1,3}$/.test(x)) && b.length === a.length && b.every((x) => MC_CIRC.indexOf(x) >= 0)) {
      a.forEach((x, k) => { const no = Number(x); if (ans[no] == null) ans[no] = MC_CIRC.indexOf(b[k]) + 1; });
    }
  }
  return ans;
}

/** 흑백 점 그림(w×h, 1 = 먹)을 먹이 있는 범위만 잘라 gw×gh 로 맞춘다 */
function mcNorm(m, w, h, gw, gh) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, out = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) out[y * gw + x] = m[(y0 + Math.min(bh - 1, Math.floor((y + 0.5) * bh / gh))) * w + x0 + Math.min(bw - 1, Math.floor((x + 0.5) * bw / gw))];
  return { g: out, ar: bw / bh };
}
let MC_TPL = null;
/** 1~5 숫자 본(여러 글꼴) — 동그라미 숫자 그림 안의 숫자와 견줄 것 */
function mcTemplates() {
  if (MC_TPL) return MC_TPL;
  const fonts = ['Times New Roman', 'Georgia', 'Batang', 'serif', 'Arial', 'Helvetica', 'sans-serif'];
  const S = 96, out = [];
  fonts.forEach((f) => {
    for (let d = 1; d <= 5; d++) {
      const cv = mcCanvas(S, S), ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#000'; ctx.font = '72px "' + f + '"'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(d), 20, 76);
      const px = ctx.getImageData(0, 0, S, S).data, m = new Uint8Array(S * S);
      for (let i = 0; i < S * S; i++) m[i] = px[i * 4] < 128 ? 1 : 0;
      const n = mcNorm(m, S, S, 20, 28);
      if (n) out.push({ d, g: n.g, ar: n.ar });
    }
  });
  MC_TPL = out;
  return out;
}
/** 동그라미 숫자 그림 하나(먹 점 그림) → 1~5, 모르면 0. 테두리(동그라미)에 닿은 덩어리를 걷어 내고 남은 안쪽 숫자를 본과 견준다. */
function mcGlyphDigit(m, w, h) {
  // 가장자리에서 이어진 먹 = 동그라미. 그림 범위로 먼저 자른다
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return 0;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  if (bw < 8 || bh < 8) return 0;
  const g = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) g[y * bw + x] = m[(y0 + y) * w + x0 + x];
  const stack = [];
  const push = (x, y) => { if (x >= 0 && y >= 0 && x < bw && y < bh && g[y * bw + x] === 1) { g[y * bw + x] = 2; stack.push(x, y); } };
  for (let x = 0; x < bw; x++) { push(x, 0); push(x, bh - 1); }
  for (let y = 0; y < bh; y++) { push(0, y); push(bw - 1, y); }
  while (stack.length) { const y = stack.pop(), x = stack.pop(); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) push(x + dx, y + dy); }
  let ring = 0, rest = 0;
  for (let i = 0; i < g.length; i++) { if (g[i] === 2) { ring++; g[i] = 0; } else if (g[i]) rest++; }
  if (!ring || rest < 6) return 0;                       // 동그라미가 없거나 안이 비었다
  const n = mcNorm(g, bw, bh, 20, 28);
  if (!n) return 0;
  const score = [0, 0, 0, 0, 0, 0];
  mcTemplates().forEach((t) => {
    let both = 0, a = 0, b = 0;
    for (let i = 0; i < 560; i++) { if (n.g[i]) a++; if (t.g[i]) b++; if (n.g[i] && t.g[i]) both++; }
    const s = (2 * both / Math.max(1, a + b)) - Math.min(0.25, Math.abs(Math.log(n.ar / t.ar)) * 0.35);   // 모양 + 가로세로 비(1 은 가늘다)
    if (s > score[t.d]) score[t.d] = s;
  });
  let best = 0; for (let d = 1; d <= 5; d++) if (score[d] > score[best]) best = d;
  const second = Math.max.apply(null, score.filter((_, d) => d && d !== best));
  return best && score[best] >= 0.45 && score[best] - second >= 0.03 ? best : 0;
}
/** 정답표 쪽에서 번호 글자(seq) 오른쪽의 동그라미 숫자 그림을 읽는다 — { 번호: 정답 }. 한 칸에 그림이 둘이면 복수정답(이어 붙인 수). */
async function mcGlyphAnswers(page, seq, nums) {
  const SC = 6, vp = page.getViewport({ scale: SC });
  const cv = mcCanvas(vp.width, vp.height), ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const ans = {};
  seq.forEach((t, i) => {
    const next = nums.filter((o) => o !== t && Math.abs(o.y - t.y) < 4 && o.x > t.x + 2).sort((a, b) => a.x - b.x)[0];
    const xa = t.x + Math.max(t.w, t.h * 0.9) + 1, xb = Math.min(next ? next.x - 2 : 1e9, xa + 60, vp.width / SC);
    const X = Math.round(xa * SC), Y = Math.max(0, Math.round((t.y - 5) * SC)), W = Math.round((xb - xa) * SC), H = Math.round((t.h + 10) * SC);
    if (W < 10 || H < 10) return;
    const px = ctx.getImageData(X, Y, W, H).data, m = new Uint8Array(W * H), cols = new Int32Array(W);
    for (let k = 0; k < W * H; k++) { const v = (px[k * 4] + px[k * 4 + 1] + px[k * 4 + 2]) / 3; if (v < 150) { m[k] = 1; cols[k % W]++; } }
    // 가로로 떨어진 덩어리마다 한 글자. 칸 테두리 같은 긴 세로줄(높이의 90% 넘게)은 뺀다
    const segs = []; let s0 = -1;
    for (let x = 0; x <= W; x++) {
      const on = x < W && cols[x] > 0 && cols[x] < H * 0.9;
      if (on && s0 < 0) s0 = x;
      if (!on && s0 >= 0) { segs.push([s0, x - 1]); s0 = -1; }
    }
    let v = '';
    segs.forEach((sg) => {
      const sw = sg[1] - sg[0] + 1; if (sw < 5 * SC * 0.6) return;
      const sub = new Uint8Array(sw * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < sw; x++) sub[y * sw + x] = m[y * W + sg[0] + x];
      const d = mcGlyphDigit(sub, sw, H);
      if (d) v += String(d);
    });
    if (v) ans[i + 1] = Number(v.split('').sort().join(''));
  });
  cv.width = 1; cv.height = 1;
  return ans;
}

/** 문항 번호 후보 — 줄 맨 앞의 '1.' · '1)' · '01' · '1번' · '[1]' */
function mcCands(pages) {
  const out = [];
  pages.forEach((pg, p) => {
    pg.text.forEach((t) => {
      const s = t.s.replace(/^\s+/, '');
      const m = /^[\[(]?\s*(\d{1,3})\s*[\])]?\s*([.)]|번)?(\s|$|[^\d.,)\]%])/.exec(s);
      if (!m) return;
      const delim = !!m[2] || /^[\[(]/.test(s);
      // 구두점이 없는 숫자는 숫자만 따로 떨어진 조각일 때만 후보로 본다(수식 속 숫자가 너무 많다)
      if (!delim && !/^\d{1,3}$/.test(s.trim())) return;
      const no = Number(m[1]);
      if (no < 1 || no > 200) return;
      out.push({ no, p, x: t.x, y: t.y, h: t.h, w: t.w || 0, col: t.x < pg.w / 2 - 8 ? 0 : 1, delim });
    });
  });
  out.sort((a, b) => a.p - b.p || a.col - b.col || a.y - b.y || a.x - b.x);
  return out;
}

/** 1번부터 차례로 이어지는 가장 긴 번호 줄을 고른다.
 *  문항 번호는 단마다 **왼쪽 자리가 같다** — 후보의 x 를 모아 가장 많이 몰린 자리 하나(1단) 또는 둘(2단)만 남기고 그 안에서 잇는다.
 *  (머리글의 '11월 4주', 수식 속 숫자처럼 자리가 제각각인 것은 여기서 떨어진다.) */
function mcChain(cands, endAt) {
  const ok = (c) => !endAt || c.p < endAt.p || (c.p === endAt.p && c.y < endAt.y);
  let pool = cands.filter(ok);
  const strong = pool.filter((c) => c.delim);
  if (strong.length >= 3) pool = strong;                    // '1.' 처럼 구두점이 붙은 번호가 있으면 그것만 본다
  if (!pool.length) return [];
  const xs = [];                                            // x 자리 모으기(±5pt)
  pool.forEach((c) => {
    const g = xs.filter((o) => Math.abs(o.x - c.x) <= 5)[0];
    if (g) { g.n++; g.nos[c.no] = 1; } else { const nos = {}; nos[c.no] = 1; xs.push({ x: c.x, n: 1, nos }); }
  });
  xs.forEach((g) => { g.k = Object.keys(g.nos).length; });
  xs.sort((a, b) => b.k - a.k || b.n - a.n);
  const tries = [[xs[0]]];
  const second = xs.filter((g) => g !== xs[0] && Math.abs(g.x - xs[0].x) > 90 && g.k >= Math.max(1, xs[0].k * 0.3))[0];
  if (second) tries.unshift([xs[0], second].sort((a, b) => a.x - b.x));
  let best = [];
  tries.forEach((cols) => {
    const list = [];
    pool.forEach((c) => { const ci = cols.findIndex((g) => Math.abs(g.x - c.x) <= 5); if (ci >= 0) list.push(Object.assign({}, c, { col: ci })); });
    list.sort((a, b) => a.p - b.p || a.col - b.col || a.y - b.y);
    const chain = []; let need = 1, at = -1;
    for (;;) {
      let hit = -1;
      for (let j = at + 1; j < list.length; j++) if (list[j].no === need) { hit = j; break; }
      if (hit < 0) break;
      chain.push(list[hit]); at = hit; need++;
    }
    if (chain.length > best.length) best = chain;
  });
  return best;
}

/** PDF 를 읽어 쪽 그림·문항 자리·정답을 낸다.
 *  돌려주는 것: { pages: [{ w, h, url }], boxes: [{ id, p, x, y, w, h, sp, mask }], answers: { no: n }, ex: { no: [쪽, x, y, w, h] }(해설 상자), twoCol, found } */
async function mcAnalyze(bytes, onStep) {
  const lib = mcPdfLib();
  const doc = await lib.getDocument({ data: bytes.slice(0) }).promise;
  const pages = [], cvs = [];
  for (let i = 1; i <= doc.numPages; i++) {
    if (onStep) onStep(i, doc.numPages);
    const page = await doc.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: MC_PREVIEW });
    const cv = mcCanvas(vp.width, vp.height);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pages.push({ w: vp1.width, h: vp1.height, text: await mcPageText(page, vp1) });
    cvs.push(cv);
  }
  // 정답이 시작하는 자리 — '정답'·'빠른 정답'·'답안' 이라는 말이 있고 그 아래 번호–정답 짝이 셋 이상인 첫 쪽
  let endAt = null; const answers = {};
  for (let p = 0; p < pages.length && !endAt; p++) {
    const keys = pages[p].text.filter((t) => /정\s*답|답\s*안|빠른\s*답|해\s*설/.test(t.s)).sort((a, b) => a.y - b.y);
    for (let k = 0; k < keys.length; k++) {
      if (Object.keys(mcAnswersOf(pages[p].text, keys[k].y)).length >= 3) { endAt = { p, y: keys[k].y }; break; }
    }
  }
  // 그런 말이 없는 정답 쪽 — 짝의 번호가 1..k(k≥5)로 빠짐없이 한 번씩인 쪽(문제 쪽의 보기 숫자는 이렇게 떨어지지 않는다)
  for (let p = 1; p < pages.length && !endAt; p++) {
    const nos = Object.keys(mcAnswersOf(pages[p].text, null)).map(Number).sort((a, b) => a - b);
    if (nos.length >= 5 && nos[0] === 1 && nos[nos.length - 1] === nos.length) endAt = { p, y: 0 };
  }
  if (endAt) {
    for (let p = endAt.p; p < pages.length; p++) {
      const a = mcAnswersOf(pages[p].text, p === endAt.p ? endAt.y : null);
      Object.keys(a).forEach((no) => { if (answers[no] == null && a[no]) answers[no] = a[no]; });
    }
  }
  // 정답의 ①~⑤ 가 글자가 아니라 **그림**인 PDF(매쓰플랫 등 — 2026-11-23 실측: '빠른정답' 표에 번호만 글자이고 동그라미 숫자는 그림이다).
  // 번호 글자 오른쪽의 그림을 잘라 안의 숫자 모양을 1~5 와 견준다(mcGlyphDigit). 자신 없는 칸은 비워 둔다.
  for (let p = 1; p < pages.length && !endAt; p++) {
    const key = pages[p].text.filter((t) => /빠른\s*정\s*답|정\s*답\s*표|빠른\s*답|정\s*답\s*및/.test(t.s)).sort((a, b) => a.y - b.y)[0];
    if (!key) continue;
    const nums = pages[p].text.filter((t) => /^\d{1,3}$/.test(t.s.trim()) && t.y > key.y).sort((a, b) => (Math.abs(a.y - b.y) < 4 ? a.x - b.x : a.y - b.y));
    const seq = []; let need = 1;
    nums.forEach((t) => { if (Number(t.s) === need) { seq.push(t); need++; } });
    if (seq.length < 5) continue;
    const g = await mcGlyphAnswers(await doc.getPage(p + 1), seq, nums);
    if (Object.keys(g).length >= seq.length * 0.6) { Object.keys(g).forEach((no) => { answers[no] = g[no]; }); endAt = { p, y: 0 }; }
  }
  const chain = mcChain(mcCands(pages), endAt);
  const boxes = mcBoxes(chain, pages, cvs, endAt, true);
  const twoCol = chain.some((c) => c.col === 1);
  // 해설 — 문제 쪽 뒤에서 '01 정답' 처럼 번호 옆에 '정답' 이 붙은 줄이 1번부터 이어지는 것. 그 번호부터 다음 번호 위까지가 그 문항의 해설 덩어리다.
  const lastQ = chain.length ? chain[chain.length - 1].p : -1;
  const exC = [];
  pages.forEach((pg, p) => {
    if (p <= lastQ) return;
    pg.text.forEach((t) => {
      if (!/^\d{1,3}$/.test(t.s.trim())) return;
      const no = Number(t.s);
      if (no < 1 || no > chain.length) return;
      if (!pg.text.some((o) => o !== t && Math.abs((o.y + o.h / 2) - (t.y + t.h / 2)) < Math.max(6, t.h * 0.6) && o.x > t.x && o.x < t.x + t.w + 70 && /정\s*답|해\s*설|풀\s*이/.test(o.s))) return;
      exC.push({ no, p, x: t.x, y: t.y, h: t.h, w: t.w || 0, col: 0, delim: true });
    });
  });
  exC.sort((a, b) => a.p - b.p || a.y - b.y || a.x - b.x);
  const exChain = exC.length >= 3 ? mcChain(exC, null) : [];
  const ex = {};
  mcBoxes(exChain, pages, cvs, null, false).forEach((b, i) => { ex[exChain[i].no] = [b.p, b.x, b.y, b.w, b.h].map((v) => Math.round(v * 10) / 10); });
  return mcFinish(doc, pages, cvs, boxes, answers, twoCol, chain.length, ex);
}

/** 번호 줄(chain)에서 상자를 만든다 — 번호 위에서 다음 번호 위까지, 바깥 여백은 깎는다. tag = 출처 글자 자리도 찾는다(문항만) */
function mcBoxes(chain, pages, cvs, endAt, tag) {
  const boxes = [];
  const twoCol = chain.some((c) => c.col === 1);
  const col1X = twoCol ? Math.min.apply(null, chain.filter((c) => c.col === 1).map((c) => c.x)) : 0;
  chain.forEach((c, i) => {
    const pg = pages[c.p];
    const same = chain.filter((o) => o.p === c.p && o.col === c.col && o.y > c.y).sort((a, b) => a.y - b.y)[0];
    const left = Math.max(0, c.x - 5);
    const right = (c.col === 0 && twoCol) ? col1X - 6 : pg.w - 6;
    let top = Math.max(0, c.y - 3);
    // 번호 바로 위에 다른 줄(머리 줄)이 붙어 있으면 그 줄의 글자 꼬리가 끼지 않게 그 아래에서 시작한다
    pg.text.forEach((t) => { if (t.x >= left - 3 && t.x < right && t.y < c.y - 1 && t.y + t.h * 1.35 > top && t.y + t.h * 1.35 < c.y + c.h * 0.3) top = t.y + t.h * 1.35; });
    let bottom = same ? same.y - 3 : pg.h - 6;
    if (endAt && endAt.p === c.p) bottom = Math.min(bottom, endAt.y - 2);
    // 다음 문항 번호 바로 위에 붙은 머리 줄('| 단원 이름 |' · '[유사] 교재, 쪽')은 다음 문항 것이다 — 거기서 끊는다.
    // 기호로 시작하는 줄만 본다(문항 자신의 마지막 줄을 잘라 내지 않게).
    if (same) {
      const lines = mcLines(pg.text.filter((t) => t.x >= left - 3 && t.x < right && t.y > c.y + 8 && t.y < same.y - 2)).sort((a, b) => b.y - a.y);
      let cur = same.y;
      for (let k = 0; k < lines.length; k++) {
        const ln = lines[k], lh = ln.items[0].h;
        if (cur - (ln.y + lh) > 9 || !/^[|\[<【〈「]/.test(ln.items[0].s.trim())) break;
        cur = ln.y;
      }
      if (cur < same.y) bottom = Math.min(bottom, cur - 2);
    }
    const region = { x: left, y: top, w: Math.max(10, right - left), h: Math.max(10, bottom - top) };
    const t = mcTrim(cvs[c.p], MC_PREVIEW, region, same ? 0 : 70) || region;
    // 원본에서 이 문항 아래 비워 둔 풀이 자리(다음 문항까지). 단의 마지막 문항은 모른다(-1 → 나머지의 가운데값)
    boxes.push({ id: 'b' + i, p: c.p, x: t.x, y: t.y, w: t.w, h: t.h, sp: same ? Math.max(0, region.y + region.h - (t.y + t.h)) : -1,
      mask: tag ? mcTagMask(cvs[c.p], MC_PREVIEW, t, c.x + Math.max(c.w, c.h * 0.9) + 2) : null });
  });
  const sps = boxes.map((b) => b.sp).filter((v) => v >= 0).sort((a, b) => a - b);
  const mid = sps.length ? sps[Math.floor(sps.length / 2)] : 60;
  boxes.forEach((b) => { if (b.sp < 0) b.sp = mid; });
  return boxes;
}
function mcFinish(doc, pages, cvs, boxes, answers, twoCol, found, ex) {
  const out = { pages: pages.map((pg, p) => ({ w: pg.w, h: pg.h, url: cvs[p].toDataURL('image/jpeg', 0.82) })), boxes, answers, twoCol, found, ex };
  cvs.forEach((cv) => { cv.width = 1; cv.height = 1; });
  try { doc.destroy(); } catch (e) { /* 이미 닫힘 */ }
  return out;
}

/** 상자를 읽는 순서로(쪽 → 단 → 위에서 아래) — 그 차례가 곧 문항 번호다 */
function mcSort(boxes, pages) {
  const col = (b) => { const pw = (pages[b.p] || {}).w || 595; return b.w < pw * 0.62 && b.x + b.w / 2 > pw / 2 ? 1 : 0; };
  return boxes.slice().sort((a, b) => a.p - b.p || col(a) - col(b) || a.y - b.y || a.x - b.x);
}

/** 저장해 둔 PDF 와 문항 상자로 시험지에 넣을 문항(그림)을 만든다.
 *  items: [{ no, answer, box: [p, x, y, w, h], sp }] → WeeklyTestSheets 가 받는 문항(it.crop · it.img · imgW · imgH · sp)
 *  sp = 문항 아래 비워 두는 풀이 자리(px). 원본에서 다음 문항까지 비어 있던 만큼이고 200px 을 넘기지 않는다. */
async function mcRenderItems(bytes, items, colW, gap) {
  const gk = gap == null ? 1 : Math.max(0, Number(gap) || 0);      // 풀이 자리 배율(1 = 원본만큼 · 0.5 = 절반 · 0 = 없음)
  const ok = (v) => Array.isArray(v) && v.length === 5;
  const withBox = items.filter((x) => ok(x.box)), withEx = items.filter((x) => ok(x.ex));
  const maxW = Math.max.apply(null, withBox.map((x) => x.box[3]).concat([1]));
  const maxE = Math.max.apply(null, withEx.map((x) => x.ex[3]).concat([1]));
  // pt → 시험지 px. 가장 넓은 문항이 한 단을 채운다 — 문항끼리 글자 크기가 같다. 1pt = 1.333px 이 원본 크기라 1.4(원본의 105%)를 넘기지 않는다
  const k = Math.min(1.4, colW / maxW), ke = Math.min(1.4, colW / maxE);
  const urls = await mcCropUrls(bytes, withBox.map((x) => ({ key: 'q' + x.no, box: x.box, mask: x.mask })).concat(withEx.map((x) => ({ key: 'e' + x.no, box: x.ex }))), MC_RENDER, 'image/png');
  return items.map((x) => {
    const b = x.box || [0, 0, 0, colW, 20];
    const o = { id: 'mc' + x.no, status: 'done', type: '', typeLabel: '', stem: '', given: '', passage: '', choices: [], answer: x.answer || 0, explanation: '', rev: 0,
      crop: true, img: urls['q' + x.no] || '', imgW: Math.round(b[3] * k), imgH: Math.round(b[4] * k), sp: Math.round(Math.min(200, Math.max(0, Number(x.sp) || 0) * k) * gk) };
    // 해설 그림(정답지에 들어간다) — 원본 해설 쪽에서 그 문항의 덩어리(번호 · 정답 · 해설)를 자른 것
    if (ok(x.ex) && urls['e' + x.no]) { o.exImg = urls['e' + x.no]; o.exW = Math.round(x.ex[3] * ke); o.exH = Math.round(x.ex[4] * ke); }
    return o;
  });
}

/** PDF 에서 상자들을 잘라 흑백 그림(data URL)으로 — { key: url }. rects: [{ key, box: [쪽, x, y, w, h](pt), mask? }] */
async function mcCropUrls(bytes, rects, scale, type, quality) {
  const lib = mcPdfLib();
  const doc = await lib.getDocument({ data: bytes.slice(0) }).promise;
  const byPage = {}, out = {};
  rects.forEach((x) => { (byPage[x.box[0]] = byPage[x.box[0]] || []).push(x); });
  for (const p of Object.keys(byPage)) {
    const page = await doc.getPage(Number(p) + 1);
    const vp = page.getViewport({ scale });
    const cv = mcCanvas(vp.width, vp.height);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    byPage[p].forEach((x) => {
      const b = x.box, w = Math.max(2, Math.round(b[3] * scale)), h = Math.max(2, Math.round(b[4] * scale));
      const c2 = mcCanvas(w, h);
      const c2x = c2.getContext('2d');
      c2x.fillStyle = '#fff'; c2x.fillRect(0, 0, w, h);
      c2x.drawImage(cv, Math.round(b[1] * scale), Math.round(b[2] * scale), w, h, 0, 0, w, h);
      // 출처 글자 자리는 흰색으로 덮는다(mcTagMask)
      if (Array.isArray(x.mask) && x.mask.length === 4) { c2x.fillStyle = '#fff'; c2x.fillRect((x.mask[0] - b[1]) * scale, (x.mask[1] - b[2]) * scale, x.mask[2] * scale, x.mask[3] * scale); }
      // 흑백으로(2026-11-23 사장님 — "문항번호색은 흑백으로 들어가야 해"). 색이 진한 점(파란 문항 번호 등)은 회색이 아니라 **검정**으로 떨어뜨리고
      // (가장 어두운 채널값), 색이 옅은 점(사진·그림)은 밝기대로 둔다. 시험지 양식은 전부 먹이다.
      const im = c2x.getImageData(0, 0, w, h), px = im.data;
      for (let q = 0; q < px.length; q += 4) {
        const r = px[q], g = px[q + 1], bl = px[q + 2];
        const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
        const sat = Math.max(0, Math.min(1, (mx - mn - 50) / 70));
        const v = Math.round((0.299 * r + 0.587 * g + 0.114 * bl) * (1 - sat) + mn * sat);
        px[q] = px[q + 1] = px[q + 2] = v;
      }
      c2x.putImageData(im, 0, 0);
      out[x.key] = c2.toDataURL(type || 'image/png', quality);
      c2.width = 1; c2.height = 1;
    });
    cv.width = 1; cv.height = 1;
  }
  try { doc.destroy(); } catch (e) { /* 이미 닫힘 */ }
  return out;
}

/** 채점 링크(학생 페이지)에 내려갈 그림을 문항에 싣는다 — 학생은 저장된 PDF 를 못 읽으므로(storage 는 직원만) 그림을 payload 에 넣어 둔다.
 *  item.img·iw(문항 그림 · 폭 pt) · item.eimg·ew(해설 그림). 서버(grade_papers)는 채점을 끝낸 학생에게만 문항을 내려주고 정답 칸(answer·explain)만 뗀다 —
 *  그래서 해설 그림은 explain 이 아니라 **eimg** 에 싣는다(explain 에 실으면 채점할 때 틀린 문항마다 성적 줄(weekly_scores.wrong)에 베껴져 표가 무거워진다).
 *  작게(2.5배 · WebP) 만든다 — payload 가 커지면 학생 로그인(grade_start 가 시험지마다 payload 를 읽는다)이 느려진다. */
async function mcEmbed(bytes, items) {
  const ok = (v) => Array.isArray(v) && v.length === 5;
  const urls = await mcCropUrls(bytes, items.filter((x) => ok(x.box)).map((x) => ({ key: 'q' + x.no, box: x.box, mask: x.mask }))
    .concat(items.filter((x) => ok(x.ex)).map((x) => ({ key: 'e' + x.no, box: x.ex }))), 2.5, 'image/webp', 0.82);
  return items.map((x) => {
    const o = Object.assign({}, x);
    delete o.img; delete o.iw; delete o.eimg; delete o.ew;
    if (ok(x.box) && urls['q' + x.no]) { o.img = urls['q' + x.no]; o.iw = x.box[3]; }
    if (ok(x.ex) && urls['e' + x.no]) { o.eimg = urls['e' + x.no]; o.ew = x.ex[3]; }
    return o;
  });
}

/** 문항 자리 고치기 — 쪽 그림 위에 상자를 보여 주고 끌어서 옮기고·늘이고·지우고·새로 그린다. 번호는 읽는 순서대로 다시 매긴다.
 *  props: pages [{ w, h, url }] · boxes [{ id, p, x, y, w, h, sp }] · onChange(boxes) · K(색) */
function McEditor({ pages, boxes, onChange, K }) {
  const VW = 620;                                    // 쪽 그림을 그리는 폭(px)
  const drag = React.useRef(null);
  const liveRef = React.useRef(null);
  const [live, setLive] = React.useState(null);      // 끄는 동안의 상자(놓을 때 onChange)
  const order = mcSort(boxes, pages);
  const noOf = (id) => order.findIndex((b) => b.id === id) + 1;
  const sc = (p) => VW / pages[p].w;
  const clamp = (b, p) => {
    const pw = pages[p].w, ph = pages[p].h;
    const w = Math.max(12, Math.min(pw, b.w)), h = Math.max(8, Math.min(ph, b.h));
    return Object.assign({}, b, { x: Math.max(0, Math.min(pw - w, b.x)), y: Math.max(0, Math.min(ph - h, b.y)), w, h });
  };
  const start = (e, p, mode, box) => {
    e.preventDefault(); e.stopPropagation();
    const host = e.currentTarget.closest('[data-mc-page]');
    const r = host.getBoundingClientRect();
    const at = (ev) => ({ x: (ev.clientX - r.left) / sc(p), y: (ev.clientY - r.top) / sc(p) });
    const o = at(e);
    const base = box || { id: 'n' + Date.now().toString(36), p, x: o.x, y: o.y, w: 0, h: 0, sp: 60 };
    drag.current = { p, mode, o, base };
    const move = (ev) => {
      const d = drag.current; if (!d) return;
      const c = at(ev), dx = c.x - d.o.x, dy = c.y - d.o.y, b = d.base;
      let n;
      if (d.mode === 'new') n = { x: Math.min(d.o.x, c.x), y: Math.min(d.o.y, c.y), w: Math.abs(dx), h: Math.abs(dy) };
      else if (d.mode === 'm') n = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h };
      else {
        let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
        if (d.mode.indexOf('w') >= 0) x0 = Math.min(x1 - 12, x0 + dx);
        if (d.mode.indexOf('e') >= 0) x1 = Math.max(x0 + 12, x1 + dx);
        if (d.mode.indexOf('n') >= 0) y0 = Math.min(y1 - 8, y0 + dy);
        if (d.mode.indexOf('s') >= 0) y1 = Math.max(y0 + 8, y1 + dy);
        n = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      const nb = d.mode === 'new' ? Object.assign({}, b, n) : clamp(Object.assign({}, b, n), p);
      liveRef.current = nb; setLive(nb);
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const d = drag.current, cur = liveRef.current;
      drag.current = null; liveRef.current = null; setLive(null);
      if (!cur || !d) return;
      if (d.mode === 'new') { if (cur.w > 14 && cur.h > 10) onChange(boxes.concat([clamp(cur, p)])); }
      else onChange(boxes.map((x) => x.id === cur.id ? cur : x));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const hs = (cur) => ({ position: 'absolute', width: '11px', height: '11px', background: '#fff', border: '1.5px solid #111', boxSizing: 'border-box', cursor: cur, touchAction: 'none' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
      {pages.map((pg, p) => {
        const s = sc(p);
        const list = boxes.filter((b) => b.p === p).map((b) => (live && live.id === b.id ? live : b));
        if (live && live.p === p && !boxes.some((b) => b.id === live.id)) list.push(live);
        return (
          <div key={p}>
            <div style={{ fontSize: '12px', color: K.muted, marginBottom: '4px' }}>{(p + 1) + '쪽'}</div>
            <div data-mc-page="" data-nobounce="" onPointerDown={(e) => start(e, p, 'new', null)}
              style={{ position: 'relative', width: VW + 'px', height: Math.round(pg.h * s) + 'px', background: '#fff', border: '1px solid ' + K.control, cursor: 'crosshair', userSelect: 'none', touchAction: 'none' }}>
              <img src={pg.url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
              {list.map((b) => {
                const no = noOf(b.id);
                return (
                  <div key={b.id} onPointerDown={(e) => start(e, p, 'm', b)}
                    style={{ position: 'absolute', left: b.x * s + 'px', top: b.y * s + 'px', width: b.w * s + 'px', height: b.h * s + 'px', boxSizing: 'border-box', border: '1.5px solid #111', background: 'rgba(0,0,0,0.04)', cursor: 'move', touchAction: 'none' }}>
                    <span style={{ position: 'absolute', left: '-1.5px', top: '-19px', height: '18px', minWidth: '20px', padding: '0 5px', boxSizing: 'border-box', background: '#111', color: '#fff', fontSize: '11.5px', lineHeight: '18px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{no || '+'}</span>
                    <button title="이 문항 빼기" onPointerDown={(e) => e.stopPropagation()} onClick={() => onChange(boxes.filter((x) => x.id !== b.id))}
                      style={{ position: 'absolute', right: '-1.5px', top: '-19px', width: '18px', height: '18px', padding: 0, border: 'none', background: '#111', color: '#fff', fontSize: '13px', lineHeight: '18px', cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                    <i onPointerDown={(e) => start(e, p, 'nw', b)} style={Object.assign(hs('nwse-resize'), { left: '-6px', top: '-6px' })} />
                    <i onPointerDown={(e) => start(e, p, 'ne', b)} style={Object.assign(hs('nesw-resize'), { right: '-6px', top: '-6px' })} />
                    <i onPointerDown={(e) => start(e, p, 'sw', b)} style={Object.assign(hs('nesw-resize'), { left: '-6px', bottom: '-6px' })} />
                    <i onPointerDown={(e) => start(e, p, 'se', b)} style={Object.assign(hs('nwse-resize'), { right: '-6px', bottom: '-6px' })} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
