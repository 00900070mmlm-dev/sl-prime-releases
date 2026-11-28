// 공용 유틸 — 테마 · 인증/비밀번호 · selKey와 지문 조회 · 라이브러리 트리 · 색 변환(pcTint/pcShade)
// index.html 에서 분리(2026-07-29). 로드 순서는 index.html 의 script 태그 순서가 결정한다.
const EASE = 'all 0.14s cubic-bezier(0.4,0,0.2,1)';

// ===== 폰 화면인가 =====
// 웹(my.sl-edu.com/prime/)에서 폰으로 여는 화면용. index.html 의 @media (max-width: 760px) 와 같은 기준이다 —
// 인라인 스타일을 바꿔야 하는 자리(홈 화면 배치·설정 창)만 이 훅을 쓰고, 나머지는 CSS 가 data 속성으로 처리한다.
const MOBILE_MQ = '(max-width: 760px)';
function useMobile() {
  const [m, setM] = useState(() => { try { return window.matchMedia(MOBILE_MQ).matches; } catch (e) { return false; } });
  useEffect(() => {
    let mq; try { mq = window.matchMedia(MOBILE_MQ); } catch (e) { return undefined; }
    const f = (e) => setM(!!e.matches);
    if (mq.addEventListener) mq.addEventListener('change', f); else mq.addListener(f);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', f); else mq.removeListener(f); };
  }, []);
  return m;
}
// 폰에서 A4 시트([data-sheet] — 794px, 가로 모아찍기는 1123px)를 화면 폭에 맞춰 줄인다. CSS zoom 이라 레이아웃이 같이 줄어
// 옆으로 밀 일이 없다(transform: scale 은 자리를 그대로 차지해 안 된다). 글자는 작아지니 핀치 줌으로 본다.
// zoom 은 React 가 모르는 속성이라 다시 그려도 남고, 새 시트가 생기면 MutationObserver 가 다시 맞춘다. 인쇄 CSS 가 zoom 을 1 로 되돌린다.
function mobileFitSheets() {
  let mobile = false; try { mobile = window.matchMedia(MOBILE_MQ).matches; } catch (e) {}
  const avail = document.documentElement.clientWidth - 24;
  // [data-mfit] — 시트는 아니지만 폭이 고정된 것(PPT 슬라이드 800px). 인쇄 CSS 의 쪽 나누기는 안 받는다.
  document.querySelectorAll('[data-sheet], [data-mfit]').forEach((el) => {
    if (!mobile) { if (el.style.zoom) el.style.zoom = ''; return; }
    // 인라인 width(px) 가 있으면 그것이 원래 폭이다 — 같은 요소가 세로(794) → 가로(1123) 로 바뀌어도 맞는다(값을 캐시하면 틀린다).
    let w = /px$/.test(el.style.width || '') ? parseFloat(el.style.width) : 0;
    if (!w) { const z = el.style.zoom; el.style.zoom = ''; w = el.getBoundingClientRect().width; el.style.zoom = z; }
    const z = w > avail ? String(Math.floor((avail / w) * 1000) / 1000) : '';
    if (el.style.zoom !== z) el.style.zoom = z;
  });
}
(function () {
  if (typeof window === 'undefined' || !window.MutationObserver) return;
  let t = 0; const run = () => { t = 0; mobileFitSheets(); };
  const kick = () => { if (!t) t = setTimeout(run, 60); };
  window.addEventListener('resize', kick);
  new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true });
})();

// 지문 데이터는 data.js(window.PASSAGES)에서 로드. 등록된 지문이 없는 선택은 아래 placeholder 사용.
const EMPTY_PASSAGE = { title: '(등록된 지문 없음)', sentences: [{ en: '', ko: '' }] };
// 단어장 데이터: vocab.js(window.VOCAB)에서 selKey로 조회. 없으면 빈 배열.

// 테마 색상 (로그인 화면·앱 공통)
function THEME(dark) {
  return dark ? {
    bg: '#121212', text: '#f2f2f2', textDim: '#a0a0a0', textFaint: '#8a8a8a',
    panel: '#1b1b1b', panelBorder: '#2c2c2c',
    navBg: '#121212', navBorder: '#2c2c2c',
    divider: 'rgba(255,255,255,0.12)', emptyCardBg: '#1b1b1b', accent: '#0066cc'
  } : {
    bg: '#f4f4f2', text: '#0a0a0a', textDim: '#6b6b6b', textFaint: '#86868b',   // taste 디자인(2026-11-12): 시험지 바탕 · 먹
    panel: '#ffffff', panelBorder: '#e6e6e6',   // 유리 카드 대신 흰 종이 + 1px 선
    navBg: '#f4f4f2', navBorder: '#e6e6e6',
    divider: 'rgba(0,0,0,0.1)', emptyCardBg: '#ffffff', accent: '#0066cc'
  };
}

// ===== taste 디자인 공용 값(2026-11-12, design/taste) — **앱 화면 전용**. 인쇄물(시트·교재·시험지)의 포인트색 PC 와는 무관하다. =====
// 원칙: 크롬(버튼·탭·선택 상태)은 먹(ink), 파랑(hue)은 핵심 데이터(평균 막대·강조 숫자)에만. 유리·그림자·알약(9999) 없음.
// 카드 8px · 컨트롤 6px 모서리, 1px 선, 컨트롤 높이 32~36px.
// 글꼴 하나 · 모션 하나. 앱마다 fontFamily·transition 을 따로 쓰지 말고 이 둘을 쓴다(튀는 스프링·바운스 없음).
const TT_FONT = "Inter, 'Spoqa Han Sans Neo', 'Malgun Gothic', system-ui, sans-serif";
const TT_EASE = 'background-color .14s cubic-bezier(.2,0,0,1), color .14s cubic-bezier(.2,0,0,1), border-color .14s cubic-bezier(.2,0,0,1), opacity .14s cubic-bezier(.2,0,0,1), transform .18s cubic-bezier(.2,0,0,1)';
function TT(dark) {
  return dark ? {
    ground: '#121212', surface: '#1b1b1b', raised: '#262626', active: '#2a2a2a', border: '#2c2c2c', rule: '#242424', control: '#3a3a3a',
    text: '#f2f2f2', muted: '#9a9a9a', ink: '#e9e9e7', inkText: '#111111', hue: '#5b93e6', hueSoft: 'rgba(91,147,230,0.16)', grey: '#777777',
    row: '#1f1f1f', rowBorder: '#2e2e2e', neg: '#ef6b6b', pos: '#5fbf6a', warn: '#e0a050', rCard: 8, rCtl: 6, font: TT_FONT, ease: TT_EASE,
  } : {
    ground: '#f4f4f2', surface: '#ffffff', raised: '#eeeeee', active: '#e9e9e7', border: '#e6e6e6', rule: '#f0f0f0', control: '#d4d4d4',
    text: '#0a0a0a', muted: '#6b6b6b', ink: '#141414', inkText: '#ffffff', hue: '#1d5fbf', hueSoft: 'rgba(29,95,191,0.10)', grey: '#8a8a8a',
    row: '#fcfcfb', rowBorder: '#e0e0de', neg: '#c4242a', pos: '#2e7d32', warn: '#92400e', rCard: 8, rCtl: 6, font: TT_FONT, ease: TT_EASE,
  };
}

// ── 로그인 계정 ── 이름/비밀번호는 SHA-256 해시로만 저장 (소스에 원문 노출 안 됨) ──
// role: 'academy'(전체 기능) | 'creator'(한줄해석·쌩본문만) | 'vocab'(단어만). 역할은 사용자에게 표시하지 않음.
// 초기 비밀번호는 모두 0000, 앱에서 변경 가능. 새 계정 추가 = 이름/비번을 같은 방식(SHA256(SALT+값))으로 해시해 등록.
const AUTH_SALT = 'slp$2026#jimun-x7k9';
const DEFAULT_PW_HASH = 'ecee5e53adf763df9032c0db2c2369e5cfb964017fcefb70b75522f39d20d16b'; // hash('0000')
const ACCOUNTS = [
  { nameHash: '781b1abb1bec4d3b124bfbba4d22ae58b2b68a30a15ef579a1f1d5220cf6cabb', role: 'academy' },
  { nameHash: '2826c0fe4c62460845a52ad36cdc78035002355fe89d7706d819b3be6c2bdee1', role: 'academy' },
  { nameHash: 'd1f5665779cce55642c7aeca6eedac4bd86aba27094d3902e3321bfd34e0e69a', role: 'academy' }, // 이예지 (초기 비번 0000)
  { nameHash: 'c912dc0ea626487801383ae7ddff978541646d4f00a605edfa26b5677ffc7640', role: 'creator' },
  { nameHash: '647d6e02267cfae067fb3c94aa664919b6f153fbe69b3957357f0175ea6eede1', role: 'creator' },
  { nameHash: '0cb98b980907bd2925573f95da2d5042116234980517d37791ad1908efb36093', role: 'vocab', noPw: true } // Lucy · 단어담당 (이름만 입력하면 자동 로그인)
];
async function sha256(v) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(AUTH_SALT + v));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function pwKey(nameHash) { return 'sl-pw|' + nameHash; }
function getUserPwHash(nameHash) { try { return localStorage.getItem(pwKey(nameHash)) || DEFAULT_PW_HASH; } catch (e) { return DEFAULT_PW_HASH; } }
function setUserPwHash(nameHash, hash) { try { localStorage.setItem(pwKey(nameHash), hash); } catch (e) {} }

// ---- Pure helpers ----
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}
function selKey(sel) {
  switch (sel.kind) {
    case 'mock': return 'mock|' + sel.grade + '|' + sel.year + '|' + sel.month + '|' + sel.num;
    case 'ebs': return 'ebs|' + sel.grade + '|' + sel.book + '|' + sel.gang + '|' + sel.unit;
    case 'school': return 'school|' + sel.school + '|' + sel.grade + '|' + sel.unit;
    // 단일 목록 단어장은 번호 범위로 잘라 출제할 수 있다 → 범위를 key 에 넣어 서로 다른 선택으로 본다
    case 'etc': return sel.group ? (sel.sub ? 'etc|' + sel.group + '|' + sel.sub + '|' + sel.day : 'etc|' + sel.group + '|' + sel.day)
      : ('etc|' + sel.name + (sel.from ? '|' + sel.from + '-' + sel.to : ''));
    // 시중교재(중등)는 교과서와 구조가 같고 키 머리만 다르다 — sel.src === 'market'
    default: return (sel.src === 'market' ? 'market|' : 'book|') + sel.grade + '|' + sel.book + '|' + sel.lesson + '|' + sel.unit;
  }
}
function passageFor(sel) {
  const P = window.PASSAGES || {};
  return P[selKey(sel)] || EMPTY_PASSAGE;
}
// 지문 스튜디오의 급(중등·고등) — 기타 단어장은 이름에 '중등'이 있으면 중등 것이다(2026-11-18 사장님).
const etcLevelOf = (name) => /중등|중학/.test(String(name || '')) ? 'mid' : 'high';
// 단어 목록: 기타 단어장(etc)은 window.ETC_VOCAB, 나머지는 window.VOCAB에서 가져온다
function vocabFor(sel) {
  if (sel.kind === 'etc') {
    const E = window.ETC_VOCAB || {};
    if (sel.group) {
      const g = E[sel.group];
      if (!g) return [];
      if (sel.sub) { const s = g[sel.sub]; return (s && s[sel.day]) || []; }
      return g[sel.day] || [];
    }
    const list = E[sel.name] || [];
    // 번호 범위가 잡혀 있으면 그만큼만 (1부터 센다)
    return sel.from ? list.slice(sel.from - 1, sel.to) : list;
  }
  return (window.VOCAB && window.VOCAB[selKey(sel)]) || [];
}
/** 학년 정렬 기준 — 중1·중2·중3 → 고1·고2·고3. 교과서·추가지문·문항 정렬이 이걸 공유한다. */
const GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3'];
const gradeRank = (g) => { const i = GRADE_ORDER.indexOf(g); return i < 0 ? 99 : i; };
// 문항 정렬: 지문 순서(학년 → 연도 → 월 → 번호) 기준. 선택(클릭) 순서 아님.
function selOrderKey(sel) {
  const num = (v) => { const m = String(v == null ? '' : v).match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
  const gi = gradeRank(sel.grade);
  const kindRank = { book: 0, mock: 1, ebs: 2, school: 3 }; // 교과서 → 모의고사 → EBS → 추가지문
  const rank = kindRank[sel.kind] != null ? kindRank[sel.kind] : 9;
  // 교과서: 과(課) 빠른 순. 부록류는 그 과의 맨 뒤로(unitOrder 공유).
  if (sel.kind === 'book') return [rank, gi, num(sel.lesson), unitOrder(sel.unit), num(sel.book)];
  if (sel.kind === 'ebs') return [rank, gi, num(sel.book), num(sel.gang), num(sel.unit)];
  if (sel.kind === 'school') return [rank, gi, num(sel.unit), 0, 0];
  if (sel.kind === 'etc') return [4, num(sel.sub), num(sel.day != null ? sel.day : sel.name), 0, 0]; // 기타 단어장: 추가지문 뒤
  return [rank, gi, num(sel.year), num(sel.month), num(sel.num)]; // 모의고사
}
function cmpSel(a, b) {
  const ka = selOrderKey(a), kb = selOrderKey(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return 0;
}
function hasPassage(sel) {
  return !!((window.PASSAGES || {})[selKey(sel)]);
}
// 교재 단어장: 헤더 그룹(모의고사=월, 교과서=과, 그 외=외부지문)과 지문 표기
function bookGroup(sel) {
  const numOf = (v) => { const m = String(v == null ? '' : v).match(/\d+/); return m ? m[0] : ''; };
  if (sel.kind === 'mock') {
    const g = String(sel.grade || '').replace('고', '');
    const label = sel.month === '수능' ? (sel.year + ' 대학수학능력시험') : (sel.year + ' ' + sel.month + ' ' + g + '학년 모의고사');
    return { key: 'mock|' + sel.grade + '|' + sel.year + '|' + sel.month, label, marker: sel.num + '번' };
  }
  // 교과서는 과 단위로 뽑으므로 지문 경계를 표시하지 않는다(배지·세로줄 없음) — 단어가 죽 이어지는 게 맞다.
  if (sel.kind === 'book') return { key: (sel.src === 'market' ? 'market|' : 'book|') + sel.grade + '|' + sel.book + '|' + sel.lesson, label: sel.book + ' · ' + sel.lesson, marker: '' };
  if (sel.kind === 'ebs') return { key: 'ebs|' + sel.book + '|' + sel.gang, label: '외부지문 · ' + sel.book + ' ' + sel.gang, marker: '지문' + numOf(sel.unit) };
  if (sel.kind === 'school') return { key: 'school|' + sel.school + '|' + sel.grade, label: '외부지문 · ' + sel.school, marker: '지문' + numOf(sel.unit) };
  const g = sel.group || sel.name || '';
  const mark = sel.from ? sel.from + '~' + sel.to + '번' : (sel.day || sel.name || '');
  return { key: 'etc|' + g + '|' + (sel.sub || '') + (sel.from ? '|' + sel.from + '-' + sel.to : ''), label: '외부지문 · ' + g + (sel.sub ? ' ' + sel.sub : ''), marker: mark };
}
// 한줄해석 헤더 라벨: 위(작게)=출처, 아래(크게)=번호
function labelParts(sel) {
  const numOf = (v) => { const m = String(v == null ? '' : v).match(/\d+/); return m ? m[0] : ''; };
  if (sel.kind === 'mock') {
    const g = String(sel.grade || '').replace('고', '');
    const top = sel.month === '수능' ? (sel.year + ' 대학수학능력시험') : (sel.year + ' ' + sel.month + ' ' + g + '학년 모의고사');
    return { top, main: sel.num + '번' };
  }
  // 교과서는 위쪽에 '교재 · N과'를 함께 적는다 — 아래 '지문N번'만으로는 몇 과인지 알 수 없다.
  if (sel.kind === 'book') return { top: sel.book + (sel.lesson ? ' · ' + sel.lesson : ''), main: numOf(sel.unit) ? ('지문' + numOf(sel.unit) + '번') : String(sel.unit || '') };
  // 기타 단어장: 위에 단어장 이름, 아래에 묶음(Day)이나 번호 범위
  if (sel.kind === 'etc') {
    return { top: sel.group || sel.name || '외부지문',
             main: sel.from ? (sel.from + '~' + sel.to + '번') : String(sel.day || '') };
  }
  return { top: '외부지문', main: numOf(sel.unit) ? ('지문' + numOf(sel.unit) + '번') : String(sel.unit || '') }; // EBS·추가지문
}
// 단어 시험지 머리의 「범위」 한 줄 — 고른 것을 출처별로 묶어 적는다(사장님 2026-11-23: "단어시험지 상단에 시험범위도").
//   모의고사 '고1 2025년 9월 20~24·29번' · 교과서 '능률(오) 영어 Ⅱ 3과·4과' · EBS '수능특강 3강 1~3번' · 단어장 '워드마스터 Day 01~05'
function vocabRangeText(list) {
  const numOf = (v) => { const m = String(v == null ? '' : v).match(/\d+/); return m ? parseInt(m[0], 10) : null; };
  const runs = (ns) => {                                  // [20,21,22,29] → '20~22·29'
    const s = Array.from(new Set(ns)).sort((x, y) => x - y), out = [];
    for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? s[i] + '~' + s[j] : String(s[i])); i = j; }
    return out.join('·');
  };
  const groups = [];
  const grp = (key, head) => { let g = groups.find(x => x.key === key); if (!g) { g = { key, head, nums: [], names: [], lessons: [] }; groups.push(g); } return g; };
  (list || []).forEach(sel => {
    if (sel.kind === 'mock') {
      const head = sel.month === '수능' ? sel.year + ' 수능' : [sel.grade, sel.year, sel.month].filter(Boolean).join(' ');
      const g = grp('m|' + head, head); (String(sel.num).match(/\d+/g) || []).forEach(v => g.nums.push(parseInt(v, 10)));   // '41~42' 같은 묶음 번호도 숫자로
    } else if (sel.kind === 'ebs') {
      const head = [sel.book, sel.gang].filter(Boolean).join(' '); const g = grp('e|' + head, head); const n = numOf(sel.unit);
      if (n != null) g.nums.push(n); else g.names.push(String(sel.unit || ''));
    } else if (sel.kind === 'school') {
      const head = [sel.school, sel.grade].filter(Boolean).join(' '); grp('s|' + head, head).names.push(String(sel.unit || ''));
    } else if (sel.kind === 'etc') {
      const head = [sel.group || sel.name || '', sel.sub || ''].filter(Boolean).join(' '); const g = grp('x|' + head, head);
      if (sel.from) g.names.push(sel.from + '~' + sel.to + '번');
      else if (sel.day) { const n = numOf(sel.day); if (n != null) { g.nums.push(n); g.dayWord = String(sel.day).replace(/\s*\d+.*$/, ''); g.dayTail = String(sel.day).replace(/^\D*\d+/, '').trim(); g.pad = Math.max(g.pad || 0, (String(sel.day).match(/\d+/) || [''])[0].length); } else g.names.push(String(sel.day)); }
    } else {
      const g = grp('b|' + sel.book, sel.book || ''); const body = /^지문/.test(String(sel.unit || ''));
      let L = g.lessons.find(x => x.name === sel.lesson); if (!L) { L = { name: sel.lesson || '', body: false, extra: [] }; g.lessons.push(L); }
      if (body) L.body = true; else if (sel.unit && L.extra.indexOf(sel.unit) < 0) L.extra.push(sel.unit);
    }
  });
  return groups.map(g => {
    if (g.key[0] === 'b') return (g.head + ' ' + g.lessons.map(L => L.name + (L.extra.length ? ' ' + (L.body ? '본문·' : '') + L.extra.join('·') : '')).join('·')).trim();
    if (g.key[0] === 'x') {
      const parts = g.names.slice();
      if (g.nums.length) { const pad = (t) => t.split('~').map(v => v.padStart(g.pad || 1, '0')).join('~'); parts.unshift((g.dayWord ? g.dayWord + ' ' : '') + runs(g.nums).split('·').map(pad).join('·') + (g.dayTail || '')); }
      return (g.head + ' ' + parts.join('·')).trim();
    }
    const parts = g.names.slice(); if (g.nums.length) parts.unshift(runs(g.nums) + '번');
    return (g.head + ' ' + parts.join('·')).trim();
  }).filter(Boolean).join(' / ');
}
function sourceLabel(sel) {
  switch (sel.kind) {
    case 'mock': return sel.month === '수능'
      ? sel.year + ' 대학수학능력시험 ' + sel.num + '번'
      : sel.grade + ' ' + sel.year + ' ' + sel.month + ' 전국연합학력평가 ' + sel.num + '번';
    case 'ebs': return sel.grade + ' ' + sel.book + ' ' + sel.gang + ' ' + sel.unit;
    case 'school': return sel.school + ' ' + sel.grade + ' ' + sel.unit;
    case 'etc': return sel.group ? (sel.sub ? sel.group + ' ' + sel.sub + ' ' + sel.day : sel.group + ' ' + sel.day) : '기타 · ' + sel.name;
    default: return sel.grade + ' ' + sel.book + ' ' + sel.lesson + ' ' + sel.unit;
  }
}
// ---- 수업용 PPT — 화면 미리보기와 실제 .pptx 를 **둘 다 여기서** 만든다(pptBuildDeck, vendor/pptxgen.bundle.js).
// 예전엔 main.js 의 save-ppt IPC(lib/ppt-deck.js)가 만들었는데, 그러면 글꼴·크기 같은 옵션 하나 바꿀 때마다
// 설치본을 다시 깔아야 했다(서명 없는 맥은 자동 업데이트도 안 된다). 렌더러에서 만들면 UI 핫 업데이트로 바로 나간다.
// lib/ppt-deck.js 는 기본값(도현·26pt·흰 바탕)의 원본 사양으로 남아 있고 앱은 더 이상 부르지 않는다.
const PPT_FONT = '맑은 고딕';
// 글꼴 — **윈도우에 처음부터 깔려 있는 한글 글꼴만** 쓴다(사장님 2026-11-15). PPT 는 글꼴을 품지 않고 이름만 적으므로,
// 따로 깔아야 하는 글꼴(배민 도현·주아, 검은고딕, 나눔)은 발표 PC 에 없으면 다른 글꼴로 바뀌어 나왔다. 글꼴을 파일에 품는
// 방법도 시험 파일까지 만들었지만(EOT 를 ppt/fonts 에 끼워 넣기) 확인이 번거로워 이쪽으로 정했다.
//   face: PPT 파일에 적히는 이름 · css: 미리보기용(그 PC 의 글꼴을 쓴다. 맥에는 이 글꼴들이 없어 비슷한 것으로 보인다)
const PPT_FONTS = [
  { face: '맑은 고딕', label: '맑은 고딕', css: "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif" },
  { face: '바탕', label: '바탕', css: "Batang, '바탕', AppleMyungjo, 'Nanum Myeongjo', serif" },
  { face: '굴림', label: '굴림', css: "Gulim, '굴림', 'Apple SD Gothic Neo', sans-serif" },
  { face: '돋움', label: '돋움', css: "Dotum, '돋움', 'Apple SD Gothic Neo', sans-serif" },
  { face: '궁서', label: '궁서', css: "Gungsuh, '궁서', AppleMyungjo, serif" },
];
const PPT_BODY_PT = 26;                                   // 본문 기본 크기(지침 스펙)
const PPT_BODY_SIZES = [20, 22, 24, 26, 28, 30, 32, 36];
// 옵션 정리 — font: PPT_FONTS 의 face · bodyPt: 본문 pt(표지·키워드도 같은 비율로) · invert: 검정 바탕 + 흰 글씨
function pptOpts(o) {
  o = o || {};
  const f = PPT_FONTS.find((x) => x.face === o.font) || PPT_FONTS[0];
  const pt = PPT_BODY_SIZES.indexOf(Number(o.bodyPt)) >= 0 ? Number(o.bodyPt) : PPT_BODY_PT;
  return { font: f, bodyPt: pt, k: pt / PPT_BODY_PT, invert: !!o.invert, fg: o.invert ? 'FFFFFF' : '000000', bg: o.invert ? '000000' : 'FFFFFF' };
}
const PPT_PX_PER_IN = 60; // 16:9 미리보기 박스 = 800×450px (13.333in×7.5in × 60px/in)
function pptSubjectName(meta) {
  if (meta.kind === 'mock') return meta.year + ' 고' + meta.grade.replace('고', '') + ' ' + meta.month + ' 모의고사';
  if (meta.kind === 'book') return meta.book;
  return '';
}
function pptParseKey(key) {
  const p = String(key || '').split('|');
  if (p[0] === 'mock') return { kind: 'mock', grade: p[1] || '', year: p[2] || '', month: p[3] || '', num: p[4] || '' };
  if (p[0] === 'book' || p[0] === 'market') return { kind: 'book', grade: p[1] || '', book: p[2] || '', lesson: p[3] || '', unit: p[4] || '' };
  return { kind: 'other' };
}
function pptHeaderText(item, isKeywords) {
  const m = pptParseKey(item.key);
  let base;
  if (m.kind === 'mock') base = pptSubjectName(m) + ' - ' + m.num + '번';
  else if (m.kind === 'book') {
    const lessonNum = (m.lesson.match(/\d+/) || [])[0];
    const unitNum = (m.unit.match(/\d+/) || [])[0] || m.unit;
    base = m.book + ' ' + (lessonNum ? lessonNum + '과 ' : '') + '지문' + unitNum;
  } else base = item.passageSource || '';
  return isKeywords ? base + '  Keywords' : base;
}
// limit: 한 장에 넣을 글자 수 — 기본 230자(26pt). 글자를 키우면 면적에 맞춰 줄인다(넘치지 않게).
function pptGroupSentences(sents, limit) {
  const LIM = limit || 230;
  const groups = [];
  let current = [];
  let currentLen = 0;
  for (const sent of sents) {
    if (current.length >= 2 || currentLen + sent.length > LIM) {
      if (current.length > 0) groups.push(current);
      current = [sent];
      currentLen = sent.length;
    } else {
      current.push(sent);
      currentLen += sent.length + 1;
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}
// items: sheets 배열(key·passageEng·passageTitle·rawSentences 그대로) → 화면 미리보기용 슬라이드 계획
function pptPlanSlides(items, opts) {
  const o = pptOpts(opts);
  const limit = Math.round(230 / (o.k * o.k));             // 글자 면적은 크기의 제곱에 비례
  const labels = [];
  items.forEach((it) => { const l = pptSubjectName(pptParseKey(it.key)); if (l && labels.indexOf(l) < 0) labels.push(l); });
  const coverLabel = labels.length <= 1 ? (labels[0] || '') : (labels[0] + ' 외 ' + (labels.length - 1) + '건');
  const slides = [{ kind: 'cover', text: coverLabel }];
  items.forEach((it) => {
    const hdr = pptHeaderText(it, false);
    let n = 0;
    pptGroupSentences(it.rawSentences || [], limit).forEach((group) => {
      const lines = group.map((s) => { n += 1; return '(' + n + ') ' + s; });
      slides.push({ kind: 'body', header: hdr, lines });
    });
    slides.push({ kind: 'keywords', header: pptHeaderText(it, true), eng: it.passageEng || '', title: it.passageTitle || '' });
  });
  return slides;
}

// 키워드(주제) 장 — 영어 주제와 한글 주제를 **한 덩어리로 세로 가운데**에 둔다. 예전엔 둘을 고정 자리(위 1.5in · 3.5in)에
// 따로 놓아서, 글자를 키우거나 영어 주제가 두 줄을 넘으면 영어가 한글 위로 흘러내려 겹쳤다(사장님 2026-11-16).
// 한 덩어리로 흐르게 하면 겹칠 수 없다. 그래도 장을 넘칠 만큼 길면 둘을 같은 비율로 줄인다.
// 미리보기(04-studio.js)와 실제 파일(pptBuildDeck)이 이 값을 같이 쓴다.
const PPT_KW = { x: 0.6, y: 1.0, w: 13.333 - 1.2, h: 7.5 - 1.3, line: 1.5, gap: 0.7 };   // in · 줄간격 · 두 주제 사이(영어 글자 크기의 배수)
function pptKeywordFit(eng, title, opts) {
  const o = pptOpts(opts);
  const boxPt = PPT_KW.w * 72, availPt = PPT_KW.h * 72 * 0.94;
  // 글자 폭 어림 — 한글·한자는 1em, 공백 0.3em, 나머지(굵은 로마자) 0.6em
  const em = (t) => { let n = 0; for (const ch of String(t || '')) n += /[\u1100-\u11ff\u3000-\u9fff\uac00-\ud7a3\uff00-\uffef]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.6; return n; };
  const lines = (t, pt) => (t ? Math.max(1, Math.ceil(em(t) * pt * 1.08 / boxPt)) : 0);   // 낱말 단위로 꺾이는 몫 8%
  const height = (ePt, tPt) => lines(eng, ePt) * ePt * PPT_KW.line + lines(title, tPt) * tPt * PPT_KW.line + (eng && title ? ePt * PPT_KW.gap : 0);
  let k = 1;
  for (let i = 0; i < 4; i++) { const h = height(40 * o.k * k, 36 * o.k * k); if (h <= availPt) break; k *= Math.max(0.6, availPt / h); }
  const r = (p) => Math.round(p * 2) / 2;
  return { engPt: r(40 * o.k * k), titlePt: r(36 * o.k * k), gapPt: r(40 * o.k * k * PPT_KW.gap) };
}

// 실제 .pptx 조립 → Blob. 위치·크기는 lib/ppt-deck.js(원본 지침 스펙)와 같고, 글꼴·크기 배율·반전만 옵션으로 바뀐다.
async function pptBuildDeck(items, opts) {
  if (typeof PptxGenJS === 'undefined') throw new Error('PPT 라이브러리(vendor/pptxgen.bundle.js)를 불러오지 못했습니다');
  const o = pptOpts(opts), F = o.font.face, W = 13.333, H = 7.5;
  const sz = (p) => Math.round(p * o.k * 10) / 10;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SLPRIME_WIDE', width: W, height: H });
  pptx.layout = 'SLPRIME_WIDE';
  const header = (slide, text) => slide.addText(text, { x: 0.5, y: 0.3, w: W - 1, h: 0.5, fontFace: F, fontSize: 22, color: '808080', align: 'left' });
  pptPlanSlides(items, opts).forEach((sl) => {
    const slide = pptx.addSlide();
    slide.background = { color: o.bg };
    if (sl.kind === 'cover') {
      slide.addText(sl.text, { x: 0, y: 0, w: W, h: H, fontFace: F, fontSize: sz(45), bold: true, align: 'center', valign: 'middle', color: o.fg });
    } else if (sl.kind === 'body') {
      header(slide, sl.header);
      slide.addText(sl.lines.join('\n\n'), { x: 0.7, y: 0.9, w: W - 1.4, h: H - 1.2, fontFace: F, fontSize: sz(26), bold: true, color: o.fg, align: 'justify', valign: 'top', lineSpacingMultiple: 1.6 });
    } else if (sl.kind === 'keywords') {
      header(slide, sl.header);
      // 영어·한글 주제를 한 글상자에 이어 넣는다 — 따로 놓으면 글자를 키웠을 때 겹친다(pptKeywordFit 주석)
      const kw = pptKeywordFit(sl.eng, sl.title, opts), runs = [];
      const run = { fontFace: F, bold: true, color: o.fg, align: 'center', lineSpacingMultiple: PPT_KW.line };
      if (sl.eng) runs.push({ text: sl.eng, options: Object.assign({}, run, { fontSize: kw.engPt, breakLine: !!sl.title }) });
      if (sl.eng && sl.title) runs.push({ text: ' ', options: Object.assign({}, run, { fontSize: kw.gapPt, lineSpacingMultiple: 1, breakLine: true }) });
      if (sl.title) runs.push({ text: sl.title, options: Object.assign({}, run, { fontSize: kw.titlePt }) });
      if (runs.length) slide.addText(runs, { x: PPT_KW.x, y: PPT_KW.y, w: PPT_KW.w, h: PPT_KW.h, align: 'center', valign: 'middle' });
    }
  });
  return await pptx.write({ outputType: 'blob' });
}

// ---- 모의고사 라이브러리: DB에 실제로 있는 학년/연도/월/번호만 노출 ----
// withVocab=true 는 **단어 모드 전용**이다. 지문 없이 단어만 들어온 옛 회차(고3 2019·2020년,
// 수능 등)를 단어 모드에서 꺼낼 수 있게 VOCAB 의 mock 키까지 합친다.
// 다른 모드에 이걸 켜면 지문이 없는 회차가 목록에 떠서 빈 자료가 나오므로 켜지 말 것.
function mockKeys(withVocab) {
  const ks = Object.keys(window.PASSAGES || {}).filter(k => k.startsWith('mock|'));
  if (!withVocab) return ks;
  const vs = Object.keys(window.VOCAB || {}).filter(k => k.startsWith('mock|'));
  return vs.length ? [...new Set([...ks, ...vs])] : ks;
}
// 지문이 아직 없어도 미리 노출할 연도 (지문이 들어오면 월·번호 자동 표시)
const EXTRA_YEARS = ['2026년'];
function availYears(grade, withVocab) {
  if (mockKeys().length === 0) return []; // 데이터 로드 실패 시 빈 목록 → 오류 안내 표시 (지문 기준으로 판정)
  const ys = new Set(EXTRA_YEARS);
  mockKeys(withVocab).forEach(k => { const p = k.split('|'); if (p[1] === grade) ys.add(p[2]); });
  return [...ys].sort().reverse(); // 최근 연도가 앞(왼쪽 위)
}
function availMonths(grade, year, withVocab) {
  const order = ['3월', '4월', '5월', '6월', '7월', '9월', '10월', '11월', '수능'];
  const ms = new Set();
  mockKeys(withVocab).forEach(k => { const p = k.split('|'); if (p[1] === grade && p[2] === year) ms.add(p[3]); });
  return [...ms].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
function availNums(grade, year, month, withVocab) {
  // 번호는 문자열로 유지 — '41-42' 같은 통합 장문 번호 지원
  const ns = [];
  mockKeys(withVocab).forEach(k => { const p = k.split('|'); if (p[1] === grade && p[2] === year && p[3] === month) ns.push(p[4]); });
  return ns.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}
// 교재 목록: 미리 정해둔 기본 목록 + 실제 지문이 들어온 교재를 합친다.
// (지문만 DB에 넣으면 여기 손대지 않아도 라이브러리에 자동으로 나타난다)
// 중1~중3은 쓰는 교과서가 정해지면 여기 넣는다. 비워 둬도 DB에 지문이 들어오면 자동으로 뜬다.
const BASE_BOOKS = {
  '중1': [],
  '중2': [],
  '중3': [],
  '고1': ['능률(민) 공통영어 1', '능률(민) 공통영어 2'],
  '고2': ['YBM(박) 영어 Ⅰ', 'YBM(박) 영어 Ⅱ', '능률(오) 영어 Ⅰ', '능률(오) 영어 Ⅱ'],
};
// src: 'market' 이면 시중교재(`market|<학년>|<교재>|…`) — 기본 목록 없이 DB 에 있는 것만 뜬다.
function booksFor(grade, src) {
  const base = src === 'market' ? [] : (BASE_BOOKS[grade] || []);
  const prefix = (src === 'market' ? 'market|' : 'book|') + grade + '|';
  const found = [];
  Object.keys(window.PASSAGES || {}).forEach(k => {
    if (!k.startsWith(prefix)) return;
    const b = k.split('|')[2];
    if (b && base.indexOf(b) < 0 && found.indexOf(b) < 0) found.push(b);
  });
  return base.concat(found.sort());
}

// 과별 본문(소단원) 개수는 실제 지문 데이터로 정해진다.
// 지문을 넣을 때 아래 맵에 '학년|교재|과': ['본문 1','본문 2',...] 형태로 등록하면
// 라이브러리가 그 개수만큼 자동으로 쪼개진다. 등록 전에는 임시 기본값(2개)을 쓴다.
const BOOK_UNITS = {
  // 예) '고1|능률(민) 공통영어 1|1과': ['본문 1', '본문 2', '본문 3'],
};
// 소단원 정렬 기준: '지문 N'은 N번, 그 외(부록·부록1·부록2 …)는 번호가 붙어 있어도 지문 뒤로.
// 라이브러리 목록·선택 순서·교재 배치가 모두 이 기준을 공유해야 어긋나지 않는다.
function unitOrder(u) {
  const s = String(u == null ? '' : u);
  const m = s.match(/^지문\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  const n = s.match(/\d+/);
  return 10000 + (n ? parseInt(n[0], 10) : 0);
}
function unitsFor(grade, book, lesson, src) {
  // 실제 등록된 지문(PASSAGES)이 있으면 그 목록을 사용
  const prefix = (src === 'market' ? 'market|' : 'book|') + grade + '|' + book + '|' + lesson + '|';
  const P = window.PASSAGES || {};
  const found = Object.keys(P).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length));
  // '지문 1 … 지문 8, 부록, 부록1, 부록2' 순. 부록류는 번호가 붙어 있어도 항상 지문 뒤로 보낸다.
  if (found.length) return found.sort((a, b) => unitOrder(a) - unitOrder(b) || String(a).localeCompare(String(b)));
  const named = BOOK_UNITS[grade + '|' + book + '|' + lesson];
  if (named && named.length) return named.slice();
  return ['본문 1', '본문 2']; // 임시 기본값 — 실제 지문 주면 데이터대로 반영
}

// EBS 교재 목록 (실제 데이터 주면 교체)
function ebsBooksFor(grade) {
  return ['수능특강 영어', '수능특강 영어독해연습', '수능완성 영어'];
}
// ===== 추가지문(학교별) =====
// 모의고사·교과서로 나뉘지 않는 지문(학교에서 따로 나눠 준 지문·듣기 대본 등). 키는 그대로 `school|<학교>|<학년>|<지문>`.
// 2026-11-25 사장님 — "중등/고등 모두 학교별을 없애고 추가지문으로 바꿔, 추가지문 등록된 학교/학년만 띄워":
//   **하드코딩한 학교·학년이 없다.** DB 에 지문이 있는 학교·학년만 뜨고, 급(중등·고등)은 학년 글자(중·고)로 가른다.
/** `school|` 키를 쪼개 n번째 칸 값을 모은다(앞 칸이 want 와 맞는 것만). */
function schoolKeyParts(n, want) {
  const out = [];
  Object.keys(window.PASSAGES || {}).forEach(k => {
    if (!k.startsWith('school|')) return;
    const p = k.split('|');
    for (let i = 0; i < (want || []).length; i++) if (p[i + 1] !== want[i]) return;
    const v = p[n];
    if (v && out.indexOf(v) < 0) out.push(v);
  });
  return out;
}
/** 학년이 그 급의 것인가 — 'mid' 는 중1~중3, 'high' 는 고1~고3. 급을 안 주면 전부. */
function schoolGradeInLevel(grade, level) {
  if (!level) return true;
  return level === 'mid' ? /^중/.test(String(grade)) : /^고/.test(String(grade));
}
/** 추가지문이 등록된 학교만(그 급의 학년에 지문이 하나라도 있는 학교). 이름순. */
function schoolList(level) {
  return schoolKeyParts(1, []).filter(s => schoolGradesFor(s, level).length > 0).sort((a, b) => a.localeCompare(b, 'ko'));
}
/** 그 학교에 지문이 있는 학년만(급으로 걸러서). 학년 정렬은 GRADE_ORDER(중1~고3) 공유. */
function schoolGradesFor(school, level) {
  return schoolKeyParts(2, [school]).filter(g => schoolGradeInLevel(g, level))
    .sort((a, b) => gradeRank(a) - gradeRank(b) || a.localeCompare(b, 'ko'));
}
/** 지문 목록. 독해를 앞에, 듣기 대본을 뒤에 두고 각각 번호순으로 — '추가지문 1·2 …' 다음 '듣기-3번·9번 …' */
function schoolUnitsFor(school, grade) {
  const found = schoolKeyParts(3, [school, grade]);
  const rank = u => (/^듣기/.test(String(u)) ? 1 : 0);          // 듣기는 항상 뒤
  const head = u => String(u).replace(/\d+/g, '').trim();
  const nums = u => (String(u).match(/\d+/g) || []).map(Number); // '5과 추가지문 2' → [5, 2]
  return found.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    const na = nums(a), nb = nums(b);
    if (head(a) !== head(b)) return head(a).localeCompare(head(b), 'ko');
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      const d = (na[i] == null ? -1 : na[i]) - (nb[i] == null ? -1 : nb[i]);
      if (d) return d;
    }
    return String(a).localeCompare(String(b), 'ko');
  });
}
function shuffledIdx(n, seed) {
  const idx = Array.from({ length: n }, (_, i) => i);
  let x = (seed * 9301 + 49297) % 233280;
  const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [idx[k], idx[j]] = [idx[j], idx[k]];
  }
  if (n > 1 && idx.every((v, i) => v === i)) idx.push(idx.shift());
  return idx;
}
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// 포인트 커스텀 색: hex → 흰색으로 t만큼 섞기 (soft/pale 파생용)
function pcHexToRgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return { r: parseInt(h.slice(0, 2), 16) || 0, g: parseInt(h.slice(2, 4), 16) || 0, b: parseInt(h.slice(4, 6), 16) || 0 }; }
function pcTint(hex, t) { const { r, g, b } = pcHexToRgb(hex); const m = v => Math.round(v + (255 - v) * t); return '#' + [m(r), m(g), m(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
// 검정 쪽으로 섞기(음영). 인쇄에서는 같은 배합 + K 로 찍힌다.
function pcShade(hex, s) { const { r, g, b } = pcHexToRgb(hex); const m = v => Math.round(v * (1 - s)); return '#' + [m(r), m(g), m(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function pcRgbToHsv({ r, g, b }) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; const s = mx === 0 ? 0 : d / mx, v = mx; if (d !== 0) { if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; } return { h: h * 360, s: s * 100, v: v * 100 }; }
function pcHsvToHex({ h, s, v }) { h /= 360; s /= 100; v /= 100; const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); let r, g, b; switch (((i % 6) + 6) % 6) { case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break; case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break; case 4: r = t; g = p; b = v; break; default: r = v; g = p; b = q; } const to = x => Math.round(x * 255).toString(16).padStart(2, '0'); return '#' + to(r) + to(g) + to(b); }
const APPLE_SWATCHES = ['#000000', '#8E8E93', '#C7C7CC', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#30B0C7', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A2845E', '#8B5E34', '#1D6F42', '#0A3D75', '#4B2E83', '#C2185B', '#9E1B32', '#B8860B', '#2E7D32', '#00695C', '#37474F'];

function CheckBox({ checked }) {
  return (
    <span className="cbx" data-checked={checked ? 'true' : 'false'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
        <path pathLength="1" strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </span>
  );
}

// ── 변형문제(어법) 렌더러용 샘플 데이터 — grammar-item-builder 스킬의 실전 5제(고2 교육청 수준).
// ※ 앱은 자체 LLM이 없어 '생성'은 Claude가 스킬로 수행하고, 결과 데이터를 이 구조로 넣어 렌더한다.
//   지금은 렌더러 테스트용 고정 샘플. 실제 지문(예: 26 고1 3월) 원문 문장이 확보되면 같은 구조로 교체.
const GRAMMAR_ASK = '다음 글의 밑줄 친 부분 중, 어법상 <u>틀린</u> 것은?';
// 지문 key(selKey) → 어법문제 데이터. Claude가 스킬로 생성해 채운다. 여기 없는 지문은 렌더러가 "생성 예정"으로 표시.
let GRAMMAR_BY_KEY = {}; // Supabase에서 로드
let WORKBOOK_BY_KEY = {}; // Supabase workbook_items에서 로드 (5유형)
const GRAMMAR_SAMPLE = {
  meta: { kicker: 'GRAMMAR SET · 실전 모의고사 수준', title: '어법 5제 · 실전 모의고사 수준', sub: '밑줄형 · 한 문장당 밑줄 1개 · 원문 변형으로 함정 강화(의미 100% 보존)', note: '고2 교육청 모의고사 어법 (상위 문항 기준)' },
  items: [
    { no: '01', passage: 'A conceptual model is an explanation, usually highly simplified, of <span class="cn">①</span><u>the way</u> something works. It doesn’t have to be complete or even accurate as long as it is useful. What you see displayed on a computer screen—the files, folders, and icons—<span class="cn">②</span><u>helps</u> people create the conceptual model of documents and folders inside the computer, or of apps or applications on the screen. In fact, nowhere inside the computer <span class="cn">③</span><u>there are</u> folders—those are effective conceptualizations designed to make them easier to use. Sometimes these depictions can add to the confusion, however. When reading e-mail or visiting a website, the material appears to be on the device, for that is <span class="cn">④</span><u>where</u> it is displayed and used. But in fact, in many cases the actual material is “in the cloud,” located on some distant machine. The conceptual model is of one, coherent image, whereas it may actually consist of parts, each located on different machines <span class="cn">⑤</span><u>that</u> could be almost anywhere in the world.' },
    { no: '02', passage: 'The principal transportation mode in the developing world, even in large cities, is still walking because of constraints on the resources <span class="cn">①</span><u>which</u> extensive transit systems cannot be operated. People cover long distances on foot every day and expend human energy <span class="cn">②</span><u>that</u> they can hardly spare. Walking under those conditions is an unavoidable burden that <span class="cn">③</span><u>consumes</u> productive capability. In North America and Western Europe, however, just the opposite <span class="cn">④</span><u>is</u> true of the attitude and policies: walking is efficient, healthful, and natural. We should do more of it—almost everybody agrees—and some of the current trends should be reversed. Ironically, among the most popular exercise machines in health clubs and in homes <span class="cn">⑤</span><u>are</u> treadmills that simulate walking, which could be otherwise accomplished with a transport purpose on the street.' },
    { no: '03', passage: '<span class="cn">①</span><u>Filled</u> with too much stuff, other rooms in your home can cause anxiety, and the same is true for kids. If the play space houses <span class="cn">②</span><u>whatever</u> toy has ever been purchased for them since birth, they may not be able to express their feelings, but they can feel overwhelmed by so much stuff. This reminds us of how women look in their closets packed full of clothes and <span class="cn">③</span><u>think</u>, I have nothing to wear. Revision helps everyone see what they have and use what they own. Kids, faced with too much to see, too much to step over, and too much input, <span class="cn">④</span><u>having</u> a hard time making a choice. Streamlining a play space is so important. You want your kids to feel inspired and imaginative in the room—not <span class="cn">⑤</span><u>overcome</u> with indecision.' },
    { no: '04', passage: 'Students often mistake familiarity with true mastery, creating a dangerous “illusion of competence” <span class="cn">①</span><u>in which</u> recognizing information feels like genuine knowledge, but they struggle when asked to recall or apply it independently. This cognitive bias, strengthened by passive study methods, <span class="cn">②</span><u>leading</u> learners to overestimate their understanding. Teaching materials (even informally or imaginatively) actively <span class="cn">③</span><u>counters</u> this illusion by requiring deep processing, active recall, structured organization, and revealing gaps in knowledge. It introduces powerful methods like teaching imaginary students, peer-teaching in study groups, employing the Feynman Technique, and <span class="cn">④</span><u>writing</u> explanations for others. Ultimately, adopting the teacher mindset transforms surface familiarity into real mastery, exposing and filling gaps in knowledge and <span class="cn">⑤</span><u>ensuring</u> solid, reliable understanding.' },
    { no: '05', passage: 'From around 3000 BC, the Sumerian officials would mark their lists of goods on clay tablets. If they wanted to record five fish, they would mark five pictures of a fish. Their first great intellectual leap came from separating the number from the object <span class="cn">①</span><u>being counted</u>. In other words, five fish <span class="cn">②</span><u>would be represented</u> with a numeral for the number five alongside a symbol for the fish. If they wanted to describe five of something else, they realized they could keep the same numeral and <span class="cn">③</span><u>trade</u> the object symbol for a cow, or a jar of oil, or whatever else they were interested in. The Sumerians had developed the idea of an emancipated number, <span class="cn">④</span><u>existing</u> in its own right and independent of whatever it is being used to count. The emancipated number is easy <span class="cn">⑤</span><u>to be taken</u> for granted, as it is so deeply set into modern thought, but to the earliest civilizations it was intellectually new and extremely powerful.' }
  ],
  keyRows: [
    ['01', '부정어구 문두 도치', '<b>③</b> there are → are there'],
    ['02', '전치사+관계대명사(완전절 판단)', '<b>①</b> which → without which'],
    ['03', '삽입구 뒤 정동사', '<b>④</b> having → have'],
    ['04', '정동사 vs 준동사', '<b>②</b> leading → leads'],
    ['05', 'easy 구문 to부정사의 태', '<b>⑤</b> to be taken → to take']
  ],
  exps: [
    '<h3>01 &nbsp;정답 <span class="ans">③ there are → are there</span></h3><ul><li><span class="pt">③ (정답):</span> <span class="tf">[변형: there are no folders inside the computer → nowhere inside the computer ~ folders]</span> 부정어구 <code>nowhere inside the computer</code>가 문두에 오면 반드시 <b>도치</b>가 일어난다. 따라서 <code>are there folders</code>로 고쳐야 한다.</li><li><span class="pt">① the way:</span> <span class="tf">[변형: how → the way]</span> <code>the way (that) 완전절</code>. how와 the way는 함께 쓸 수 없고 각각 단독으로 쓴다. (○)</li><li><span class="pt">② helps:</span> 주어는 관계대명사 <code>What</code>이 이끄는 명사절(단수). 대시 사이 <code>the files, folders, and icons</code>는 동격 삽입이라 수일치에 영향 없음 → 단수 helps. (○)</li><li><span class="pt">④ where:</span> 뒤에 완전한 절(<code>it is displayed and used</code>)이 오므로 관계부사 where가 옳다. (○)</li><li><span class="pt">⑤ that:</span> 뒤 절에 주어가 없는 불완전한 절이므로 주격 관계대명사 that. (○)</li></ul>',
    '<h3>02 &nbsp;정답 <span class="ans">① which → without which</span></h3><ul><li><span class="pt">① (정답):</span> <span class="tf">[변형: the resources needed to operate ~ → the resources (without) which extensive transit systems cannot be operated]</span> 뒤 절이 주어·동사(수동)를 다 갖춘 <b>완전한 절</b>이라 which가 설 자리가 없다. ‘그 자원 없이는 운영될 수 없는’이 되도록 <code>without which</code>로 고친다.</li><li><span class="pt">② that:</span> 선행사 human energy + spare의 목적어 결손 → 목적격 that. ①과 완전/불완전 판단 짝. (○)</li><li><span class="pt">③ consumes:</span> 선행사는 단수 <code>an unavoidable burden</code> → 단수 동사. 앞의 conditions에 이끌리지 말 것. (○)</li><li><span class="pt">④ is:</span> <span class="tf">[변형: the attitude and policies are ~ → just the opposite is true of ~]</span> 주어는 단수 the opposite. 뒤의 policies에 이끌려 are로 고치면 오답. (○)</li><li><span class="pt">⑤ are:</span> 「among+명사구」 문두 도치, 진주어는 복수 treadmills → are. (○)</li></ul>',
    '<h3>03 &nbsp;정답 <span class="ans">④ having → have</span></h3><ul><li><span class="pt">④ (정답):</span> <span class="tf">[변형: kids have → Kids, faced with ~, having]</span> 주어 Kids 뒤 <code>faced with ~ input</code>은 콤마 삽입 분사구. 문장의 정동사가 없으므로 <code>have</code>로 고친다.</li><li><span class="pt">① Filled:</span> 주어 other rooms가 ‘채워지는’ 수동 → 과거분사 분사구문. (○)</li><li><span class="pt">② whatever:</span> 복합관계형용사 whatever+단수 toy가 명사절을 이끌고 단수 has와 일치. (○)</li><li><span class="pt">③ think:</span> <code>women look ~ and think</code> 정동사 병렬. 삽입 분사구 때문에 thinking으로 착각 유도. (○)</li><li><span class="pt">⑤ overcome:</span> <code>not (feel) overcome with indecision</code>. 압도되는 수동 → 과거분사. (○)</li></ul>',
    '<h3>04 &nbsp;정답 <span class="ans">② leading → leads</span></h3><ul><li><span class="pt">② (정답):</span> 주어 <code>This cognitive bias</code>의 정동사가 필요. <code>strengthened ~ methods</code>는 콤마 삽입 분사구이므로 leading을 <code>leads</code>로 고쳐야 문장 성립.</li><li><span class="pt">① in which:</span> 전치사+관계대명사(=where), 뒤에 완전한 절. (○)</li><li><span class="pt">③ counters:</span> 주어는 동명사구 Teaching materials(단수) — 뒤 문장 <code>It introduces</code>가 결정적. (○)</li><li><span class="pt">④ writing:</span> 전치사 like의 목적어 동명사 병렬(teaching…writing). (○)</li><li><span class="pt">⑤ ensuring:</span> 주절 transforms에 딸린 분사구문 병렬(exposing, filling, ensuring). (○)</li></ul>',
    '<h3>05 &nbsp;정답 <span class="ans">⑤ to be taken → to take</span></h3><ul><li><span class="pt">⑤ (정답):</span> <span class="tf">[변형: It is easy to take A for granted → A is easy to be taken(오류) for granted]</span> easy 구문에서 주어가 to부정사의 의미상 목적어이면 to부정사는 <b>능동</b> → <code>easy to take for granted</code>.</li><li><span class="pt">① being counted:</span> 사물이 ‘세어지는’ 수동 진행 분사. (○)</li><li><span class="pt">② would be represented:</span> five fish가 ‘표현되는’ 대상 → 조동사+수동. (○)</li><li><span class="pt">③ trade:</span> 조동사 could에 이어지는 원형 병렬(keep ~ and trade). (○)</li><li><span class="pt">④ existing:</span> 주절(had developed)이 있으므로 콤마 뒤는 분사구문. 능동 → 현재분사. (○)</li></ul>'
  ]
};


// ===== 로딩 표시 — 화면이 자료를 불러오는 동안 (사장님 2026-11-15: "대시보드 들어갔을 때 불러오는중 같은것도 그 로딩창") =====
// 켤 때 보이는 로고 애니메이션(loader.js 의 SL_LOADER_HTML)을 작게 쓴다. 선 색은 테마를 따른다(index.html 의 --sl-ld).
// 화면 한 칸을 기다릴 때는 그대로(64px), 홈 카드 안에서는 `size={40}` 으로 작게 쓴다(같은 날 사장님 — "홈 카드 안의 불러오는 중에도 로고").
function SlLoading({ text, pad, size }) {
  return (
    <div role="status" style={{ padding: pad == null ? 40 : pad, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--muted, #8a8a8e)', fontSize: 13 }}>
      {window.SL_LOADER_HTML ? <div className="sl-ld-sm" style={size ? { '--sl-ld-size': size + 'px' } : null} dangerouslySetInnerHTML={{ __html: window.SL_LOADER_HTML }} /> : null}
      <span>{text || '불러오는 중…'}</span>
    </div>
  );
}
