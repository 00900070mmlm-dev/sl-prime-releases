// 스크롤 끝 튕김 — 스크롤이 끝에 닿은 순간 내용이 한 번 살짝 밀려 나갔다가 ease-in-out 으로 돌아온다.
// (2026-11-15 사장님 — 시안 design/scroll/ 의 「살짝」: 최대 28px · 0.22초. 규칙은 DESIGN.md §7)
//
// 일반 스크립트다(JSX 아님, 신UI·구UI 공용). 화면마다 손대지 않는다 — 문서 전체의 휠을 한 곳에서 듣고,
// 굴린 자리에서 가장 가까운 스크롤 상자를 찾아 그 상자의 자식들을 CSS 로 민다.
//
// **스크롤되는 것은 전부 대상이다**(같은 날 사장님 — "모든 스크롤 요소에 다 넣으라니까"):
//  · 세로·가로 둘 다. 가로는 옆으로 굴리거나(트랙패드) Shift+휠.
//  · 안쪽 상자가 끝에 닿았으면 **바깥 상자가 더 굴러갈 수 있어도** 안쪽이 튕긴다. 처음엔 이때 안 튕기게 했다가
//    (브라우저가 스크롤을 바깥으로 넘기므로) 안쪽 목록 대부분이 빠져 "안 들어간 데가 많다"가 됐다 —
//    신UI 는 문서 자체가 길어서 바깥이 늘 더 굴러갈 수 있다.
//  · 문서 자체가 스크롤되는 화면(신UI 홈)은 body 의 자식을 position:relative + top/left 로 민다(아래 docTargets 주석).
//  · 글자만 든 상자(자식 요소 없음)는 상자 자신을 민다 — 밀 자식이 없다.
// 안 하는 것: 글 입력칸(textarea·input) 안 — 브라우저가 그리는 글자라 밀 수 없다.
//
// 지키는 것:
//  · 스크롤 자체는 브라우저 것을 그대로 둔다(휠을 막지 않는다 — passive). 스크롤 막대·키보드·찾기·트랙패드 관성 모두 원래대로.
//  · **한 번 굴림에 한 번만 튕긴다.** 휠 이벤트로는 손가락과 관성을 가를 수 없다 — 가르려 들면 실제 트랙패드의
//    들쭉날쭉한 신호에 판정이 뒤집혀 여러 번 튄다(시안에서 실제로 그랬다). 그래서 한 번 튕긴 뒤에는 휠이
//    QUIET ms 잠잠해질 때까지 그쪽 끝의 휠을 흘려보낸다.
//  · `prefers-reduced-motion` 이면 끈다. 튕기면 안 되는 상자에는 `data-nobounce` 를 붙인다.
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.document) return;
  var BAND = 28, DUR = 220, RISE = 80, QUIET = 150;

  var css = document.createElement('style');
  css.textContent = '[data-sl-bounce] > * { translate: var(--sl-bx, 0px) var(--sl-by, 0px); }\n' +
    '[data-sl-bounce="self"] { translate: var(--sl-bx, 0px) var(--sl-by, 0px); }\n' +
    '[data-sl-bounce="self"] > * { translate: none; }\n' +
    '@media print { [data-sl-bounce], [data-sl-bounce] > * { translate: none !important; } }';
  (document.head || document.documentElement).appendChild(css);

  var inOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var still = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  var anim = null;                 // { el, x, peak, t0, doc }
  var lockKey = '', lockEl = null, lastEvt = 0, raf = 0;

  function clear(el) { el.style.removeProperty('--sl-bx'); el.style.removeProperty('--sl-by'); el.removeAttribute('data-sl-bounce'); }

  // 문서 자체가 스크롤되는 화면(신UI 홈 등)은 translate 를 쓰지 못한다 — translate 가 걸린 상자는 그 안의 position:fixed
  // (왼쪽 레일·LUCY 버튼·모달)를 붙잡아 같이 끌고 가거나 엉뚱한 자리로 보낸다. 그래서 body 의 자식 중 흐름에 놓인 것(static)만
  // 잠깐 position:relative + top/left 로 민다 — relative 는 fixed 를 붙잡지 않는다. 끝나면 원래 인라인 값으로 되돌린다.
  function docTargets() {
    var out = [], kids = document.body ? document.body.children : [];
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i], tag = k.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') continue;
      if (getComputedStyle(k).position !== 'static') continue;
      out.push({ el: k, pos: k.style.position, top: k.style.top, left: k.style.left });
      k.style.position = 'relative';
    }
    return out;
  }
  function docRestore(list) { for (var i = 0; i < list.length; i++) { var o = list[i]; o.el.style.position = o.pos; o.el.style.top = o.top; o.el.style.left = o.left; } }

  function frame() {
    raf = 0;
    if (!anim) return;
    var el = anim.el, t = performance.now() - anim.t0, over;
    if (!anim.doc && !el.isConnected) { anim = null; return; }
    if (t < RISE) over = anim.peak * (1 - Math.pow(1 - t / RISE, 3));               // 빠르게 나갔다가
    else if (t < RISE + DUR) over = anim.peak * (1 - inOut((t - RISE) / DUR));     // ease-in-out 으로 돌아온다
    else { if (anim.doc) docRestore(anim.doc); else clear(el); anim = null; return; }
    var px = (-over).toFixed(2) + 'px';
    if (anim.doc) { for (var i = 0; i < anim.doc.length; i++) anim.doc[i].el.style[anim.x ? 'left' : 'top'] = px; }
    else el.style.setProperty(anim.x ? '--sl-bx' : '--sl-by', px);
    raf = requestAnimationFrame(frame);
  }

  // 그 축으로 굴러가는 상자인가(내용이 넘치고 overflow 가 auto·scroll)
  function scrolls(el, x) {
    if ((x ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight) < 2) return false;
    var cs = getComputedStyle(el), o = x ? cs.overflowX : cs.overflowY;
    return o === 'auto' || o === 'scroll';
  }
  // 그 방향으로 더 갈 수 있는가
  function canGo(el, x, d) {
    var pos = x ? el.scrollLeft : el.scrollTop, max = x ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
    return d < 0 ? pos > 0.5 : pos < max - 0.5;
  }

  document.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) return;                    // 확대(ctrl+휠)는 건드리지 않는다
    var x = Math.abs(e.deltaX) > Math.abs(e.deltaY) || (e.shiftKey && e.deltaY !== 0 && e.deltaX === 0);
    var d = x ? (e.deltaX || e.deltaY) : e.deltaY, now = performance.now();
    if (now - lastEvt > QUIET) { lockKey = ''; lockEl = null; }   // 잠잠해졌다 = 새로 굴리는 것
    lastEvt = now;
    if (!d || (still && still.matches)) return;

    // 굴린 자리에서 가장 가까운 스크롤 상자가 대상이다. 그 상자가 아직 끝이 아니면 평소대로 스크롤될 뿐이다.
    var box = null, doc = null, n = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
    for (; n && n !== document.documentElement && n !== document.body; n = n.parentElement) {
      if (n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.tagName === 'INPUT') { if (x ? n.scrollWidth - n.clientWidth > 1 : n.scrollHeight - n.clientHeight > 1) return; continue; }
      if (scrolls(n, x)) { box = n; break; }
    }
    if (!box) {                                            // 상자가 없으면 문서 자체가 스크롤되는 화면인지 본다
      var se = document.scrollingElement || document.documentElement;
      if ((x ? se.scrollWidth - se.clientWidth : se.scrollHeight - se.clientHeight) < 2) return;
      var ho = getComputedStyle(document.documentElement), bo = getComputedStyle(document.body);
      if ((x ? ho.overflowX : ho.overflowY) === 'hidden' || (x ? bo.overflowX : bo.overflowY) === 'hidden') return;
      box = se; doc = true;
    }
    if (canGo(box, x, d)) { lockKey = ''; lockEl = null; return; }   // 아직 끝이 아니다
    if (doc ? document.body.hasAttribute('data-nobounce') : box.closest('[data-nobounce]')) return;
    var side = d > 0 ? 1 : -1, key = (x ? 'x' : 'y') + side;
    if (lockKey === key && lockEl === box) return;         // 이 굴림에서 이미 튕겼다
    lockKey = key; lockEl = box;
    if (anim) return;                                      // 돌아가는 중이면 끝날 때까지 새로 튕기지 않는다
    if (e.deltaMode === 1) d *= 32;
    // 세게 굴릴수록 조금 더 나간다(최대 BAND)
    anim = { el: box, x: x, peak: side * Math.min(BAND, 8 + Math.abs(d) * 0.35), t0: now, doc: doc ? docTargets() : null };
    if (!doc) box.setAttribute('data-sl-bounce', box.firstElementChild ? '' : 'self');   // 글자만 든 상자는 상자 자신을 민다
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true, capture: true });
})();
