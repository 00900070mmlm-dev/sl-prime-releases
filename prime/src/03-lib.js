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
    bg: '#121016', text: '#ececed', textDim: '#a6a6ae', textFaint: '#8a8a93',
    panel: 'rgba(38,40,46,0.62)', panelBorder: 'rgba(255,255,255,0.09)',
    navBg: 'rgba(26,27,31,0.72)', navBorder: 'rgba(255,255,255,0.07)',
    divider: 'rgba(255,255,255,0.12)', emptyCardBg: 'rgba(38,40,46,0.6)', accent: '#0066cc'
  } : {
    bg: '#f5f5f7', text: '#1d1d1f', textDim: '#6e6e73', textFaint: '#86868b',
    panel: 'rgba(255,255,255,0.55)', panelBorder: 'rgba(255,255,255,0.75)',
    navBg: 'rgba(255,255,255,0.62)', navBorder: 'rgba(0,0,0,0.06)',
    divider: 'rgba(0,0,0,0.1)', emptyCardBg: 'rgba(255,255,255,0.55)', accent: '#0066cc'
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
    default: return 'book|' + sel.grade + '|' + sel.book + '|' + sel.lesson + '|' + sel.unit;
  }
}
function passageFor(sel) {
  const P = window.PASSAGES || {};
  return P[selKey(sel)] || EMPTY_PASSAGE;
}
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
/** 학년 정렬 기준 — 중1·중2·중3 → 고1·고2·고3. 교과서·학교별·문항 정렬이 이걸 공유한다. */
const GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3'];
const gradeRank = (g) => { const i = GRADE_ORDER.indexOf(g); return i < 0 ? 99 : i; };
// 문항 정렬: 지문 순서(학년 → 연도 → 월 → 번호) 기준. 선택(클릭) 순서 아님.
function selOrderKey(sel) {
  const num = (v) => { const m = String(v == null ? '' : v).match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
  const gi = gradeRank(sel.grade);
  const kindRank = { book: 0, mock: 1, ebs: 2, school: 3 }; // 교과서 → 모의고사 → EBS → 학교별
  const rank = kindRank[sel.kind] != null ? kindRank[sel.kind] : 9;
  // 교과서: 과(課) 빠른 순. 부록류는 그 과의 맨 뒤로(unitOrder 공유).
  if (sel.kind === 'book') return [rank, gi, num(sel.lesson), unitOrder(sel.unit), num(sel.book)];
  if (sel.kind === 'ebs') return [rank, gi, num(sel.book), num(sel.gang), num(sel.unit)];
  if (sel.kind === 'school') return [rank, gi, num(sel.unit), 0, 0];
  if (sel.kind === 'etc') return [4, num(sel.sub), num(sel.day != null ? sel.day : sel.name), 0, 0]; // 기타 단어장: 학교별 뒤
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
  if (sel.kind === 'book') return { key: 'book|' + sel.grade + '|' + sel.book + '|' + sel.lesson, label: sel.book + ' · ' + sel.lesson, marker: '' };
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
  return { top: '외부지문', main: numOf(sel.unit) ? ('지문' + numOf(sel.unit) + '번') : String(sel.unit || '') }; // EBS·학교별
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
// ---- 수업용 PPT 미리보기(화면용) — lib/ppt-deck.js(Node, 실제 저장용)와 같은 알고리즘의 거울.
// 지침 스펙이 바뀌면 반드시 두 곳을 함께 고칠 것.
const PPT_FONT = '배달의민족 도현';
const PPT_PX_PER_IN = 60; // 16:9 미리보기 박스 = 800×450px (13.333in×7.5in × 60px/in)
function pptSubjectName(meta) {
  if (meta.kind === 'mock') return meta.year + ' 고' + meta.grade.replace('고', '') + ' ' + meta.month + ' 모의고사';
  if (meta.kind === 'book') return meta.book;
  return '';
}
function pptParseKey(key) {
  const p = String(key || '').split('|');
  if (p[0] === 'mock') return { kind: 'mock', grade: p[1] || '', year: p[2] || '', month: p[3] || '', num: p[4] || '' };
  if (p[0] === 'book') return { kind: 'book', grade: p[1] || '', book: p[2] || '', lesson: p[3] || '', unit: p[4] || '' };
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
function pptGroupSentences(sents) {
  const groups = [];
  let current = [];
  let currentLen = 0;
  for (const sent of sents) {
    if (current.length >= 2 || currentLen + sent.length > 230) {
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
function pptPlanSlides(items) {
  const labels = [];
  items.forEach((it) => { const l = pptSubjectName(pptParseKey(it.key)); if (l && labels.indexOf(l) < 0) labels.push(l); });
  const coverLabel = labels.length <= 1 ? (labels[0] || '') : (labels[0] + ' 외 ' + (labels.length - 1) + '건');
  const slides = [{ kind: 'cover', text: coverLabel }];
  items.forEach((it) => {
    const hdr = pptHeaderText(it, false);
    let n = 0;
    pptGroupSentences(it.rawSentences || []).forEach((group) => {
      const lines = group.map((s) => { n += 1; return '(' + n + ') ' + s; });
      slides.push({ kind: 'body', header: hdr, lines });
    });
    slides.push({ kind: 'keywords', header: pptHeaderText(it, true), eng: it.passageEng || '', title: it.passageTitle || '' });
  });
  return slides;
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
function booksFor(grade) {
  const base = BASE_BOOKS[grade] || [];
  const prefix = 'book|' + grade + '|';
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
function unitsFor(grade, book, lesson) {
  // 실제 등록된 지문(PASSAGES)이 있으면 그 목록을 사용
  const prefix = 'book|' + grade + '|' + book + '|' + lesson + '|';
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
// ===== 학교별 =====
// 교과서(booksFor/unitsFor)와 같은 원칙: **하드코딩하지 않는다.**
// DB에 `school|<학교>|<학년>|<지문>` 키가 있으면 그 학교·학년·지문이 자동으로 뜬다.
// 아래 기본값은 아직 지문을 안 넣은 학교를 목록에 미리 보여 주기 위한 것뿐이다.
const BASE_SCHOOLS = ['원당고등학교', '아라고등학교', '이음고등학교'];
const BASE_SCHOOL_GRADES = ['고1', '고2'];
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
function schoolList() {
  const found = schoolKeyParts(1, []).filter(s => BASE_SCHOOLS.indexOf(s) < 0);
  return BASE_SCHOOLS.concat(found.sort((a, b) => a.localeCompare(b, 'ko')));
}
function schoolGradesFor(school) {
  const found = schoolKeyParts(2, [school]);
  // 지문이 하나라도 있으면 **그 학년만** 보여 준다 — 중학교에 고1·고2가 뜨면 안 된다.
  const all = found.length ? found.slice() : BASE_SCHOOL_GRADES.slice();
  // 학년 정렬은 GRADE_ORDER(중1~고3) 공유. 그 외 값은 뒤에 붙인다.
  return all.sort((a, b) => gradeRank(a) - gradeRank(b) || a.localeCompare(b, 'ko'));
}
/** 지문 목록. 독해를 앞에, 듣기 대본을 뒤에 두고 각각 번호순으로 — '추가지문 1·2 …' 다음 '듣기-3번·9번 …' */
function schoolUnitsFor(school, grade) {
  const found = schoolKeyParts(3, [school, grade]);
  if (!found.length) return ['지문 1', '지문 2']; // 아직 지문을 안 넣은 학교·학년의 임시 기본값
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

