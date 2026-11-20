// UI 핫 업데이트 — 받은 새 화면을 **재시작 없이** 적용한다 (2026-11-15 사장님 — "두 번 껐다 켜야 하는 게 귀찮다").
//
// 예전: 앱이 켜진 뒤 새 번들을 받아 두기만 하고 다음에 켤 때 썼다 → 한 번 켜서 받고, 또 켜야 보였다.
// 지금: 설치본(main.js)이 새 번들을 다 받으면 window.__slUiUpdateReady() 를 부른다. 그러면
//   · 로그인 화면·홈 화면이고 치던 글자가 없으면 → 그 자리에서 새 화면으로 다시 읽는다
//   · 작업 중이면 → 아래에 알림만 띄우고, [지금 적용] 을 누르거나(한 번 더 묻는다) 홈으로 돌아올 때 적용한다
// 설치본은 켤 때 한 번 + 켜져 있는 동안 3분마다 새 번들을 확인한다 — 머지하면 사용 중인 앱에도 몇 분 안에 알림이 뜬다.
// 작업 중인 화면을 말없이 갈아엎지 않는 것이 핵심이다 — 입력하던 것이 날아간다.
//
// 빌드 없는 일반 스크립트다(JSX 아님). 신UI(index.html)·구UI(legacy/index.html) 가 같이 쓴다.
// 지금 어느 화면인지는 양쪽 08-root.js 가 window.__slView 에 적어 준다('login' | 'home' | 그 밖의 앱 이름).
// 웹판·옛 설치본에서는 아무도 __slUiUpdateReady 를 부르지 않으므로 아무 일도 하지 않는다.
(function () {
  var ready = false;      // 새 번들이 준비됐고 아직 적용 전
  var bar = null;
  var later = false;      // [나중에] 를 눌렀다 — 알림을 다시 띄우지 않는다(홈으로 돌아오면 적용은 한다). 새 번들이 또 오면 풀린다
  var ask = null;         // [지금 적용] 뒤의 확인 창

  /** 지금 다시 읽어도 잃을 것이 없는가 — 순수 판단이라 node 로도 시험한다(test/ui-update.test.mjs). */
  function idleFrom(view, typing, pwFilled, lucy) {
    if (view !== 'login' && view !== 'home') return false;
    return !typing && !pwFilled && !lucy;
  }
  // LUCY 를 쓰는 중인가 — 창이 열려 있거나 나눈 대화가 있다. 홈 화면이어도 다시 읽으면 대화가 날아간다
  // (사장님 2026-11-15: 홈에서 LUCY 를 쓰는데 말없이 업데이트됐다). 이때는 작업 중일 때처럼 알림을 띄워 묻는다.
  function lucyBusy() {
    try { return !!document.querySelector('.ai-panel.open, .ai-list .ai-msg'); } catch (e) { return false; }
  }
  function idle() {
    var a = document.activeElement;
    var typing = !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.value);
    var pws = document.querySelectorAll('input[type=password]'), pwFilled = false;
    for (var i = 0; i < pws.length; i++) if (pws[i].value) pwFilled = true;
    return idleFrom(window.__slView, typing, pwFilled, lucyBusy());
  }

  // 다크에서는 알림도 어둡게 뜬다(같은 날 사장님 — 다크 화면에 밝은 알약이 떠서 "다크모드에 맞게 떠야지"). 바탕 raised + 1px 테두리로 화면과 가른다.
  // 다크 모드 — 알림을 띄우는 그 순간 화면이 다크인지 본다(사장님 2026-11-15: 알림창만 흰색으로 떠 있던 것).
  // 신UI 는 셸 '.tt.dark', 구UI 는 지문 스튜디오의 '.dark' 가 표시다. 색은 DESIGN.md 의 TT 토큰 값과 같다.
  function pal() {
    var dark = false;
    try { dark = !!(document.querySelector && document.querySelector('.tt.dark, .dark')); } catch (e) {}   // 판정을 못 하면 라이트
    return dark
      ? { toastBg: '#262626', toastFg: '#f2f2f2', toastDim: 'rgba(242,242,242,.6)', toastBtnBg: '#e9e9e7', toastBtnFg: '#111111', toastLine: '1px solid #3a3a3a',
          card: '#1b1b1b', cardFg: '#f2f2f2', line: '#3a3a3a', priBg: '#e9e9e7', priFg: '#111111', scrim: 'rgba(0,0,0,.55)' }
      : { toastBg: '#1d1d1f', toastFg: '#ffffff', toastDim: 'rgba(255,255,255,.7)', toastBtnBg: '#ffffff', toastBtnFg: '#1d1d1f', toastLine: 'none',
          card: '#ffffff', cardFg: '#1d1d1f', line: '#d2d2d7', priBg: '#1d1d1f', priFg: '#ffffff', scrim: 'rgba(0,0,0,.38)' };
  }

  // 알림은 아래에서 스르륵 올라오고(ease-in-out), 닫을 때 같은 길로 내려간다 (2026-11-15 사장님).
  var EASE = 'opacity .32s ease-in-out, transform .32s ease-in-out';
  var OFF = 'translateX(-50%) translateY(14px)', ON = 'translateX(-50%) translateY(0)';
  function hideBar() {
    var b = bar; bar = null;
    if (!b) return;
    b.style.opacity = '0'; b.style.transform = OFF; b.style.pointerEvents = 'none';
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 340);
  }
  function showBar() {
    if (bar || !document.body) return;
    var P = pal();
    bar = document.createElement('div');
    bar.setAttribute('data-noprint', '');
    bar.style.cssText = 'position:fixed;left:50%;bottom:22px;opacity:0;transform:' + OFF + ';transition:' + EASE + ';z-index:2147483000;display:flex;align-items:center;gap:12px;'
      + 'padding:9px 10px 9px 16px;border-radius:9999px;background:' + P.toastBg + ';border:' + P.toastLine + ';color:' + P.toastFg + ';font:13px/1.3 -apple-system,BlinkMacSystemFont,"Spoqa Han Sans Neo","Malgun Gothic",sans-serif;'
      + 'box-shadow:0 8px 28px rgba(0,0,0,.28);white-space:nowrap';
    var t = document.createElement('span');
    t.textContent = '새로운 업데이트가 있습니다';
    var b = document.createElement('button');
    b.textContent = '지금 적용';
    b.style.cssText = 'border:none;cursor:pointer;border-radius:9999px;padding:6px 13px;background:' + P.toastBtnBg + ';color:' + P.toastBtnFg + ';font:inherit;font-weight:600';
    b.addEventListener('click', confirmApply);
    var x = document.createElement('button');
    x.textContent = '나중에';
    x.title = '홈 화면으로 돌아오면 적용됩니다';
    x.style.cssText = 'border:none;cursor:pointer;background:transparent;color:' + P.toastDim + ';font:inherit;padding:6px 6px';
    x.addEventListener('click', function () { later = true; hideBar(); });
    bar.appendChild(t); bar.appendChild(b); bar.appendChild(x);
    document.body.appendChild(bar);
    // 붙인 다음 프레임에 값을 바꿔야 움직인다(같은 프레임이면 처음부터 끝 값으로 그려진다)
    var el = bar;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = ON; }); });
  }

  // [지금 적용] 을 누르면 화면 한가운데에 한 번 더 묻는다 (2026-11-15 사장님) — 작업 중에 뜨는 알림이라
  // 무심코 누르면 고르던 지문·쓰던 초안이 그대로 날아간다. 저절로 적용되는 쪽(로그인·홈)은 묻지 않는다.
  function closeAsk() {
    var a = ask; ask = null;
    if (!a) return;
    a.style.opacity = '0'; a.firstChild.style.transform = 'scale(.96)'; a.style.pointerEvents = 'none';
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 300);
  }
  function confirmApply() {
    if (ask || !ready || !document.body) return;
    var FONT = '-apple-system,BlinkMacSystemFont,"Spoqa Han Sans Neo","Malgun Gothic",sans-serif';
    var P = pal();
    ask = document.createElement('div');
    ask.setAttribute('data-noprint', '');
    ask.style.cssText = 'position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:' + P.scrim + ';opacity:0;transition:opacity .28s ease-in-out';
    var card = document.createElement('div');
    card.style.cssText = 'width:340px;max-width:calc(100vw - 40px);box-sizing:border-box;padding:26px 24px 20px;border-radius:18px;background:' + P.card + ';color:' + P.cardFg + ';text-align:center;'
      + 'font:15px/1.55 ' + FONT + ';box-shadow:0 24px 70px rgba(0,0,0,.3);transform:scale(.96);transition:transform .28s ease-in-out';
    var msg = document.createElement('div');
    msg.style.cssText = 'font-weight:600;white-space:pre-line;word-break:keep-all';
    msg.textContent = '지금 작업중인 화면이 초기화됩니다\n그래도 하시겠습니까?';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:20px';
    var no = document.createElement('button');
    no.textContent = '취소';
    no.style.cssText = 'flex:1;border:1px solid ' + P.line + ';cursor:pointer;border-radius:10px;padding:10px 0;background:transparent;color:' + P.cardFg + ';font:14px ' + FONT;
    no.addEventListener('click', closeAsk);
    var yes = document.createElement('button');
    yes.textContent = '적용';
    yes.style.cssText = 'flex:1;border:none;cursor:pointer;border-radius:10px;padding:10px 0;background:' + P.priBg + ';color:' + P.priFg + ';font:600 14px ' + FONT;
    yes.addEventListener('click', function () { closeAsk(); apply(); });
    row.appendChild(no); row.appendChild(yes);
    card.appendChild(msg); card.appendChild(row);
    ask.appendChild(card);
    ask.addEventListener('click', function (e) { if (e.target === ask) closeAsk(); });   // 바깥을 누르면 취소
    document.body.appendChild(ask);
    var el = ask;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.opacity = '1'; card.style.transform = 'scale(1)'; }); });
  }

  function apply() {
    if (!ready) return;
    if (typeof window.desktopApplyUiUpdate !== 'function') return;   // 설치본이 아니면 할 일이 없다
    ready = false; later = false; hideBar(); closeAsk();
    // 설치본이 새 번들의 index.html 을 다시 읽는다. 못 하면(false) 그대로 둔다 — 다음에 켤 때 적용된다.
    // 다시 읽힌 뒤 "업데이트했습니다" 를 띄우려고 표시를 남긴다(아래 DONE_KEY).
    try { sessionStorage.setItem(DONE_KEY, '1'); } catch (e) {}
    var undo = function () { try { sessionStorage.removeItem(DONE_KEY); } catch (e) {} };
    try {
      var r = window.desktopApplyUiUpdate();
      if (r && typeof r.then === 'function') r.then(function (ok) { if (!ok) undo(); }, undo);
    } catch (e) { undo(); }
  }

  // 적용된 뒤 한 번, 잠깐 알린다 (2026-11-15 사장님) — 로그인·홈 화면에서는 묻지 않고 바로 바뀌는데,
  // 눈에 띄는 변화가 없는 수정이면 적용됐는지 알 길이 없었다(로그아웃했다 들어와서야 확인했다).
  var DONE_KEY = 'sl-ui-updated';
  function showDone() {
    if (!document.body) return;
    var P = pal();
    var t = document.createElement('div');
    t.setAttribute('data-noprint', '');
    t.style.cssText = 'position:fixed;left:50%;bottom:22px;opacity:0;transform:' + OFF + ';transition:' + EASE + ';z-index:2147483000;pointer-events:none;'
      + 'padding:10px 18px;border-radius:9999px;background:' + P.toastBg + ';border:' + P.toastLine + ';color:' + P.toastFg + ';font:13px/1.3 -apple-system,BlinkMacSystemFont,"Spoqa Han Sans Neo","Malgun Gothic",sans-serif;'
      + 'box-shadow:0 8px 28px rgba(0,0,0,.28);white-space:nowrap';
    t.textContent = '✓ 새 화면으로 업데이트했습니다';
    document.body.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = ON; }); });
    setTimeout(function () {
      t.style.opacity = '0'; t.style.transform = OFF;
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 340);
    }, 5000);
  }
  try {
    if (sessionStorage.getItem(DONE_KEY) === '1') { sessionStorage.removeItem(DONE_KEY); showDone(); }
  } catch (e) {}
  function tick() {
    if (!ready) return;
    if (idle()) apply(); else if (!later) showBar();
  }

  window.__slUiUpdateReady = function () { ready = true; later = false; tick(); return true; };
  /** 화면이 바뀔 때 08-root.js 가 부른다 — 홈으로 돌아온 순간에 적용하려고. */
  window.__slUiSetView = function (v) { window.__slView = v; tick(); };
  window.__slUiIdleFrom = idleFrom;
})();
