// 드롭다운 — 앱의 모든 `<select>` 를 우리 모양의 목록으로 연다 (2026-11-15 사장님 — "드롭다운들을 우리만의 고유 디자인으로").
// 규칙은 DESIGN.md §6.
//
// 일반 스크립트다(JSX 아님, 신UI·구UI 공용). `<select>` 는 그대로 둔다 — 값·onChange·키보드 포커스·폼이 전부 원래대로다.
// 바꾸는 것은 둘뿐이다:
//   ① 닫힌 모양: 브라우저 화살표를 지우고 우리 꺾쇠를 그린다(CSS).
//   ② 열린 목록: 누르면 브라우저 목록 대신 우리 목록(.sl-dd)을 그 아래에 띄운다. 고르면 select 의 값을 바꾸고
//      `change` 이벤트를 쏜다 — React 의 onChange 가 그대로 받는다.
// 그래서 화면 코드는 손댈 것이 없다. 새 화면에서도 그냥 `<select>` 를 쓰면 된다.
//
// 지키는 것:
//  · 손가락으로 쓰는 기기(폰·태블릿)에서는 목록을 가로채지 않는다 — 거기는 기기의 고르기 화면이 더 낫다.
//  · `multiple` · `size` 가 있는 select, `data-native` 를 붙인 select 는 건드리지 않는다.
//  · 목록이 뜨고 사라지는 움직임은 pop-ease.js 가 건다(위에서 아래로 내려온다. 위로 열리면 아래에서 올라온다).
//  · 키보드: ↑↓ 이동 · Enter/Space 고르기 · Esc 닫기 · 글자를 치면 그 글자로 시작하는 항목으로.
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.document) return;
  var fine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: true };

  var css = document.createElement('style');
  css.textContent = [
    // ① 닫힌 모양 — 화살표만 바꾼다(테두리·높이·글꼴은 화면이 준 그대로)
    'select:not([multiple]):not([size]):not([data-native]) { -webkit-appearance: none; appearance: none; padding-right: 26px !important; cursor: pointer;',
    '  background-image: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27 viewBox=%270 0 10 6%27 fill=%27none%27 stroke=%27%238a8a8a%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M1 1l4 4 4-4%27/%3E%3C/svg%3E");',
    '  background-repeat: no-repeat; background-position: right 9px center; background-size: 10px 6px; }',
    // ② 열린 목록
    '.sl-dd { position: fixed; z-index: 2147482000; box-sizing: border-box; padding: 4px; overflow-y: auto; overscroll-behavior: contain;',
    '  background: var(--dd-bg); color: var(--dd-fg); border: 1px solid var(--dd-line); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.08);',
    '  font: 13.5px/1.3 Inter, "Spoqa Han Sans Neo", "Malgun Gothic", system-ui, sans-serif; -webkit-font-smoothing: antialiased; user-select: none; }',
    '.sl-dd { --dd-bg:#ffffff; --dd-fg:#0a0a0a; --dd-line:#e6e6e6; --dd-on:#e9e9e7; --dd-dim:#6b6b6b; --dd-ink:#141414; }',
    '.sl-dd.dark { --dd-bg:#1b1b1b; --dd-fg:#f2f2f2; --dd-line:#2c2c2c; --dd-on:#2a2a2a; --dd-dim:#9a9a9a; --dd-ink:#e9e9e7; box-shadow: 0 8px 24px rgba(0,0,0,.4); }',
    '.sl-dd-i { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 8px 0 10px; border-radius: 6px; cursor: pointer; white-space: nowrap; }',
    '.sl-dd-i span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }',
    '.sl-dd-i svg { flex: none; visibility: hidden; }',
    '.sl-dd-i.sel { font-weight: 600; } .sl-dd-i.sel svg { visibility: visible; }',
    '.sl-dd-i.on { background: var(--dd-on); }',
    '.sl-dd-i.off { color: var(--dd-dim); opacity: .55; cursor: default; }',
    '.sl-dd-g { padding: 8px 10px 4px; font-size: 12px; color: var(--dd-dim); }',
    '@media print { .sl-dd { display: none !important; } }'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  var CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var cur = null;   // { sel, menu, items: [{ el, opt }], on }

  function plain(sel) { return sel && sel.tagName === 'SELECT' && !sel.multiple && !(sel.size > 1) && !sel.hasAttribute('data-native') && !sel.disabled; }

  function close(refocus) {
    if (!cur) return;
    var c = cur; cur = null;
    if (c.menu.parentNode) c.menu.parentNode.removeChild(c.menu);
    if (refocus && c.sel.isConnected) try { c.sel.focus({ preventScroll: true }); } catch (e) {}
  }
  function setOn(i, scroll) {
    if (!cur) return;
    if (cur.on >= 0 && cur.items[cur.on]) cur.items[cur.on].el.classList.remove('on');
    cur.on = i;
    var it = cur.items[i];
    if (it) { it.el.classList.add('on'); if (scroll) it.el.scrollIntoView({ block: 'nearest' }); }
  }
  function step(d) {
    if (!cur || !cur.items.length) return;
    var n = cur.items.length, i = cur.on;
    for (var k = 0; k < n; k++) { i = (i + d + n) % n; if (!cur.items[i].opt.disabled) { setOn(i, true); return; } }
  }
  function pick(i) {
    if (!cur) return;
    var it = cur.items[i], sel = cur.sel;
    if (!it || it.opt.disabled) return;
    var changed = sel.value !== it.opt.value || sel.selectedIndex !== it.opt.index;
    close(true);
    if (!changed) return;
    sel.selectedIndex = it.opt.index;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function open(sel) {
    close(false);
    var menu = document.createElement('div');
    var dark = false;
    try { dark = !!sel.closest('.tt.dark, .dark') || (!sel.closest('.tt') && !!document.querySelector('.tt.dark')); } catch (e) {}
    menu.className = 'sl-dd' + (dark ? ' dark' : '');
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('data-noprint', '');
    var items = [], on = -1;
    var add = function (opt) {
      var el = document.createElement('div');
      el.className = 'sl-dd-i' + (opt.selected ? ' sel' : '') + (opt.disabled ? ' off' : '');
      el.setAttribute('role', 'option');
      if (opt.selected) el.setAttribute('aria-selected', 'true');
      var sp = document.createElement('span'); sp.textContent = opt.label || opt.textContent || ' ';
      el.appendChild(sp); el.insertAdjacentHTML('beforeend', CHECK);
      var i = items.length;
      el.addEventListener('mousemove', function () { if (cur && cur.on !== i && !opt.disabled) setOn(i, false); });
      el.addEventListener('mousedown', function (e) { e.preventDefault(); });
      el.addEventListener('click', function () { pick(i); });
      if (opt.selected && on < 0) on = i;
      items.push({ el: el, opt: opt });
      menu.appendChild(el);
    };
    for (var k = 0; k < sel.children.length; k++) {
      var c = sel.children[k];
      if (c.tagName === 'OPTGROUP') {
        var g = document.createElement('div'); g.className = 'sl-dd-g'; g.textContent = c.label; menu.appendChild(g);
        for (var j = 0; j < c.children.length; j++) if (c.children[j].tagName === 'OPTION' && !c.children[j].hidden) add(c.children[j]);
      } else if (c.tagName === 'OPTION' && !c.hidden) add(c);
    }
    if (!items.length) return;

    // 자리 — select 바로 아래. 아래가 모자라고 위가 더 넓으면 위로 연다.
    var r = sel.getBoundingClientRect(), gap = 4, edge = 8;
    var below = innerHeight - r.bottom - gap - edge, above = r.top - gap - edge;
    var up = below < 160 && above > below;
    menu.style.minWidth = Math.max(r.width, 96) + 'px';
    menu.style.maxWidth = Math.max(r.width, Math.min(420, innerWidth - 2 * edge)) + 'px';
    menu.style.maxHeight = Math.max(96, Math.min(336, up ? above : below)) + 'px';
    menu.style.visibility = 'hidden';
    if (up) menu.setAttribute('data-pop-from', 'below');   // pop-ease.js — 위로 열리면 아래에서 올라온다
    document.body.appendChild(menu);
    var w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(edge, Math.min(r.left, innerWidth - w - edge)) + 'px';
    menu.style.top = (up ? Math.max(edge, r.top - gap - h) : r.bottom + gap) + 'px';
    menu.style.visibility = '';
    cur = { sel: sel, menu: menu, items: items, on: -1, typed: '', typedAt: 0 };
    if (on >= 0) { setOn(on, false); items[on].el.scrollIntoView({ block: 'center' }); }
  }

  // 누르면 — 브라우저 목록을 막고 우리 목록을 연다
  document.addEventListener('mousedown', function (e) {
    if (cur && cur.menu.contains(e.target)) return;
    var sel = e.target && e.target.closest ? e.target.closest('select') : null;
    if (e.button === 0 && fine.matches && plain(sel)) {
      e.preventDefault();
      var was = cur && cur.sel === sel;
      close(false);
      try { sel.focus({ preventScroll: true }); } catch (err) {}
      if (!was) open(sel);
      return;
    }
    close(false);
  }, true);

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (cur) {
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (k === 'ArrowDown') { e.preventDefault(); step(1); }
      else if (k === 'ArrowUp') { e.preventDefault(); step(-1); }
      else if (k === 'Home') { e.preventDefault(); cur.on = -1; step(1); }
      else if (k === 'End') { e.preventDefault(); cur.on = 0; step(-1); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (cur.on >= 0) pick(cur.on); else close(true); }
      else if (k === 'Tab') close(false);
      else if (k && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {   // 글자를 치면 그 글자로 시작하는 항목으로
        var now = Date.now(); cur.typed = (now - cur.typedAt < 700 ? cur.typed : '') + k.toLowerCase(); cur.typedAt = now;
        for (var i = 0; i < cur.items.length; i++) {
          var it = cur.items[i];
          if (!it.opt.disabled && it.el.textContent.trim().toLowerCase().indexOf(cur.typed) === 0) { setOn(i, true); break; }
        }
        e.preventDefault();
      }
      return;
    }
    var sel = e.target;
    if (!fine.matches || !plain(sel)) return;
    if (k === 'Enter' || k === ' ' || k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); open(sel); }
  }, true);

  // 밖에서 일이 생기면 닫는다 — 스크롤(목록 안 스크롤은 빼고) · 창 크기 · 포커스 이동
  window.addEventListener('scroll', function (e) { if (cur && !(e.target && e.target.nodeType === 1 && cur.menu.contains(e.target))) close(false); }, true);
  window.addEventListener('resize', function () { close(false); });
  window.addEventListener('blur', function () { close(false); });
  document.addEventListener('focusin', function (e) { if (cur && e.target !== cur.sel && !cur.menu.contains(e.target)) close(false); });
  setInterval(function () { if (cur && !cur.sel.isConnected) close(false); }, 500);
})();
