// 나타남·사라짐 — 화면에 새로 나오는 것은 전부 ease-in-out 으로 떠오르고, 없어지는 것은 ease-in-out 으로 사라진다.
// (2026-11-15 사장님 — "어떤 버튼이든 눌러서 무언가 나오는 곳엔 다", "사라질 때도". 규칙은 DESIGN.md §7)
//
// 일반 스크립트다(JSX 아님, 신UI·구UI 공용). 앱이 인라인 스타일이고 화면이 수백 군데라 하나씩 고치지 않는다 —
// 문서에 **붙고 떨어지는 요소**를 MutationObserver 한 곳에서 지켜보다가 움직인다. 팝업·모달·드롭다운뿐 아니라
// 펼쳐지는 판, 바뀌는 탭 내용, 화면 전환까지 전부 대상이다.
//
// 나타남: 새로 붙은 요소에 opacity 0→1, 0.2초 ease-in-out. 방향은 **위에서 아래로** 가 기본이다 —
//   · 펼쳐지는 판(흐름 안, 위에 누른 것이 있음)은 높이가 자라며 내려온다. 드롭다운·메뉴는 위에서 6px 내려온다.
//   · 모달 카드와 아래쪽 알림만 아래에서 6px 올라온다.
//   · 화면의 절반을 넘는 큰 것은 fade 만 한다 — translate 가 걸린 상자는 안쪽 position:fixed 를 붙잡아 끌고 간다.
//   · 화면을 다 덮는 fixed 배경(모달)은 배경이 fade, 그 안의 카드가 떠오른다.
// 사라짐: React 는 요소를 그 자리에서 떼어 버려 움직일 틈이 없다. 그래서 **떼어진 요소를 제자리에 잠깐 도로 꽂아**
//   0.14초 ease-in-out 으로 흐려지게 한 뒤 치운다("유령"). 유령은 누를 수 없고(pointer-events none) React 는 모른다.
//   · 같은 자리에 새것이 같이 들어왔으면(내용 교체) 유령을 두지 않는다 — 옛것과 새것이 나란히 놓여 배치가 출렁인다.
//     떠 있는 것(fixed·absolute)은 자리를 차지하지 않으니 그때도 유령을 둔다.
//
// 움직이지 않는 것(이걸 안 가리면 화면이 계속 깜빡인다):
//  · 글자를 치는 중에 바뀌는 것(검색 결과 등) — 마지막 입력 뒤 0.25초 동안은 쉰다.
//  · 다시 그려졌을 뿐 내용이 같은 것(React 가 같은 것을 떼었다 붙임) · 자리만 옮긴 것(목록 순서 바꾸기).
//  · 한 번에 40개 넘게 붙고 떨어지는 것(시트 쪽 나누기 등) · 화면 밖에 있는 것(높이 재는 상자) · 안 보이는 것.
//  · 제 연출이 있는 것: CSS animation 이 걸린 것, opacity 0 에서 스스로 나타나는 것(ui-update.js 의 알림),
//    LUCY(.ai-root — DESIGN.md 의 예외). 빼고 싶은 것은 `data-nopop`.
//  · 조용한 구역(`data-pop-quiet` — 지문 스튜디오) 안에서 화면이 바뀌는 것. 거기서는 눌러서 여는 것만 움직인다.
//  · Web Animations API 로만 움직인다(인라인 스타일을 안 건드린다). `transform` 은 안 쓰고 `translate` 를 쓴다 —
//    가운데 정렬(translate(-50%,-50%))처럼 그 요소가 이미 쓰는 transform 을 덮어쓰면 뜨는 동안 자리가 튄다.
//  · `prefers-reduced-motion` 이면 이동 없이 fade 만.
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.document || !window.MutationObserver) return;
  if (!Element.prototype.animate) return;
  var IN = 200, OUT = 140, EASE = 'ease-in-out', RISE = 6, MAX = 40, TYPING = 250;
  var still = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var SKIP_TAG = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, TITLE: 1, BR: 1, OPTION: 1, COL: 1, COLGROUP: 1 };
  var NOPOP = '[data-nopop], [data-sl-ghost], .ai-root';

  var css = document.createElement('style');
  css.textContent = '[data-sl-ghost], [data-sl-ghost] * { animation: none !important; transition: none !important; pointer-events: none !important; }\n' +
    '@media print { [data-sl-ghost] { display: none !important; } }';
  (document.head || document.documentElement).appendChild(css);

  // 글자를 치는 중인가 — 치는 대로 바뀌는 화면까지 움직이면 깜빡인다
  var lastType = 0;
  document.addEventListener('input', function () { lastType = performance.now(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Process')) lastType = performance.now(); }, true);

  var ghosts = new WeakSet();

  function hasOwnShow(cs) {
    return (cs.animationName && cs.animationName !== 'none') || parseFloat(cs.opacity) === 0;
  }
  function onScreen(r) {
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }
  function play(el, from, dur) {
    try { return el.animate([from, {}], { duration: dur, easing: EASE }); } catch (e) { return null; }
  }

  // 펼쳐지는 판인가 — 흐름 안에 놓이고, 위에 누른 것(앞 형제)이 있고, 줄을 다 차지하는 덩어리.
  // 이런 것은 높이가 0 에서 자라며 **위에서 아래로 내려온다**(사장님 2026-11-15 — 지문 스튜디오의 모의고사 월처럼
  // 아래로 펼쳐지는 것). 아래 내용도 뚝 밀리지 않고 같이 밀려 내려간다. 닫힐 때는 거꾸로 접힌다.
  var BLOCKY = { block: 1, flex: 1, grid: 1, 'flow-root': 1, 'list-item': 1 };
  function slideFrames(el, cs, r) {
    if ((cs.position !== 'static' && cs.position !== 'relative') || !BLOCKY[cs.display] || cs.float !== 'none') return null;
    if (!el.previousElementSibling || el.previousElementSibling.hasAttribute('data-sl-ghost')) return null;
    var p = el.parentElement; if (!p) return null;
    var pcs = getComputedStyle(p);
    if (pcs.display.indexOf('grid') >= 0) return null;
    if (pcs.display.indexOf('flex') >= 0 && (pcs.flexDirection.indexOf('row') === 0 || parseFloat(cs.flexGrow) > 0)) return null;
    if (cs.minHeight !== '0px' && cs.minHeight !== 'auto') return null;
    if (r.height < 8 || r.height > innerHeight * 0.7 || r.width < p.getBoundingClientRect().width * 0.6) return null;
    var shut = { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', opacity: 0, overflow: 'hidden' };
    var open = { height: cs.height, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom, borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, opacity: cs.opacity, overflow: 'hidden' };
    return [shut, open];
  }

  // 조용한 구역(`data-pop-quiet`) — 그 안에서는 **눌러서 여는 것만** 움직인다: 떠 있는 것(팝업·드롭다운·메뉴)과
  // `data-pop-zone` 안의 것(펼치는 목록), 그리고 `data-pop` 을 붙인 요소 자신(변형문제를 고르면 나오는 유형 칸 — 같은 날
  // 사장님: "유형선택바가 이지인이지아웃으로 나왔으면"). 나머지(시트·버튼·옵션 판이 바뀌는 것)는 바로 바뀐다.
  // 지문 스튜디오가 이 구역이다(사장님 2026-11-15 — "지문스튜디오에서의 모션이 생각보다 어지럽다"): 지문을 고르거나
  // 모드를 바꿀 때마다 넓은 면적이 한꺼번에 바뀌어서, 그게 전부 움직이면 화면이 출렁인다.
  function quiet(el, cs) {
    if (cs.position === 'fixed' || cs.position === 'absolute') return false;
    if (el.hasAttribute('data-pop')) return false;         // 조용한 구역 안이라도 이 요소 하나는 움직인다(그 안의 것은 아니다)
    return !!el.closest('[data-pop-quiet]') && !el.closest('[data-pop-zone]');
  }

  function show(el) {
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'contents' || cs.visibility === 'hidden' || hasOwnShow(cs)) return;
    if (cs.pointerEvents === 'none' && !el.textContent.trim()) return;                 // 배경 장식(블러 덩어리 등)
    var r = el.getBoundingClientRect();
    if (!onScreen(r)) return;
    var calm = still && still.matches;
    if (quiet(el, cs)) return;
    // 큰 것은 fade 만 한다 — translate 가 걸린 상자는 안쪽 position:fixed(레일·모달)를 붙잡아 끌고 간다.
    var big = r.width * r.height > innerWidth * innerHeight * 0.5;
    if (cs.position === 'fixed' && r.width >= innerWidth * 0.95 && r.height >= innerHeight * 0.95) {
      play(el, { opacity: 0 }, IN);                                                     // 모달 배경은 fade 만
      var card = el.firstElementChild;
      if (card && !el.children[1] && !calm && !hasOwnShow(getComputedStyle(card))) play(card, { opacity: 0, translate: '0 ' + RISE + 'px' }, IN);
      return;
    }
    if (big || calm) { play(el, { opacity: 0 }, IN); return; }
    var sf = slideFrames(el, cs, r);
    if (sf) { try { el.animate(sf, { duration: IN, easing: EASE }); } catch (e) {} return; }
    // 나머지 작은 것(드롭다운·메뉴·말풍선·줄)은 **위에서 아래로** 내려온다. 아래에 붙은 알림(fixed + bottom)과
    // 위로 열리는 목록(data-pop-from="below")만 아래에서 올라온다.
    var below = el.getAttribute('data-pop-from') === 'below' || (cs.position === 'fixed' && cs.bottom !== 'auto' && cs.top === 'auto') || (cs.position === 'fixed' && r.top > innerHeight * 0.6);
    play(el, { opacity: 0, translate: '0 ' + (below ? RISE : -RISE) + 'px' }, IN);
  }

  // 떼어진 요소를 제자리에 도로 꽂아 흐려지게 한다
  function hide(el, parent, next, replaced) {
    if (el.querySelector && el.querySelector('iframe, video, audio')) return;          // 도로 꽂으면 다시 읽거나 다시 튼다
    ghosts.add(el);
    el.setAttribute('data-sl-ghost', '');
    el.setAttribute('aria-hidden', 'true');
    try { parent.insertBefore(el, next && next.parentNode === parent ? next : null); } catch (e) { return; }
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    var floating = cs.position === 'fixed' || cs.position === 'absolute';
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0 || !onScreen(r) || (replaced && !floating) || quiet(el, cs)) { el.remove(); return; }
    var a = null, sf = floating || (still && still.matches) ? null : slideFrames(el, cs, r);
    try {
      a = sf ? el.animate([sf[1], sf[0]], { duration: OUT + 40, easing: EASE, fill: 'forwards' })               // 펼쳐졌던 판은 위로 접힌다
             : el.animate([{}, { opacity: 0 }], { duration: OUT, easing: EASE, fill: 'forwards' });
    } catch (e) { /* 옛 엔진 */ }
    var done = function () { el.remove(); };
    if (a) { a.onfinish = done; a.oncancel = done; }
    setTimeout(done, OUT + 120);
  }

  var ready = false;
  var mo = new MutationObserver(function (list) {
    if (!ready) return;
    if (performance.now() - lastType < TYPING) return;
    var added = [], removed = [], i, k, n;
    for (i = 0; i < list.length; i++) {
      var rec = list[i], t = rec.target;
      if (t.nodeType !== 1 || t.closest(NOPOP) || t === document.head || document.head.contains(t)) continue;
      for (k = 0; k < rec.addedNodes.length; k++) { n = rec.addedNodes[k]; if (n.nodeType === 1 && !SKIP_TAG[n.tagName] && !ghosts.has(n)) added.push({ el: n, parent: t }); }
      for (k = 0; k < rec.removedNodes.length; k++) { n = rec.removedNodes[k]; if (n.nodeType === 1 && !SKIP_TAG[n.tagName] && !ghosts.has(n)) removed.push({ el: n, parent: t, next: rec.nextSibling }); }
      if (added.length > MAX || removed.length > MAX) return;                           // 화면이 통째로 다시 그려지는 중(시트 쪽 나누기 등)
    }
    if (!added.length && !removed.length) return;

    // 자리만 옮긴 것(떼었다 바로 붙임)과, 내용이 같은 것으로 갈아 끼운 것은 가만히 둔다
    var gone = removed.filter(function (x) { return !x.el.isConnected; });
    var fresh = added.filter(function (x) {
      if (!x.el.isConnected) return false;
      for (var j = 0; j < removed.length; j++) if (removed[j].el === x.el) return false;
      return true;
    });
    var sameA = new Set(), sameR = new Set();
    fresh.forEach(function (a) {
      for (var j = 0; j < gone.length; j++) {
        var g = gone[j];
        if (sameR.has(g) || g.parent !== a.parent || g.el.tagName !== a.el.tagName) continue;
        if (g.el.className === a.el.className && g.el.textContent === a.el.textContent && g.el.childElementCount === a.el.childElementCount) { sameA.add(a); sameR.add(g); break; }
      }
    });

    var gotNew = new Set();
    fresh.forEach(function (a) { if (sameA.has(a)) return; gotNew.add(a.parent); if (!a.el.closest(NOPOP)) show(a.el); });
    gone.forEach(function (g) {
      if (sameR.has(g) || !g.parent.isConnected) return;
      if (g.el.matches && g.el.matches(NOPOP)) return;
      hide(g.el, g.parent, g.next, gotNew.has(g.parent));
    });
  });
  function start() {
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { ready = true; }, 600);          // 처음 뜨는 화면(로딩·로그인)은 그대로 둔다
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
