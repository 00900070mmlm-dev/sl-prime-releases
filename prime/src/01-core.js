// Supabase 클라이언트 · 계정 매핑 · 콘텐츠 로드(loadContent) · 앱 버전
// index.html 에서 분리(2026-07-29). 로드 순서는 index.html 의 script 태그 순서가 결정한다.
const { useState, useRef, useLayoutEffect, useEffect } = React;

// ===== Supabase (인증·백엔드) =====
const SUPA_URL = 'https://lfrawudhoppvvwktqbvg.supabase.co';
const SUPA_KEY = 'sb_publishable_tagOfpNlqNEXldBIPYqEvw_q0amXG8x';
// storage=sessionStorage → 앱(창)을 닫으면 세션이 사라져 자동 로그아웃됨(다음 실행 시 재로그인).
// (dark/point 등 앱 설정은 localStorage에 따로 저장되어 영향 없음)
const SB = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, autoRefreshToken: true, storage: window.sessionStorage } });
const SESSION_MAX_MS = 12 * 60 * 60 * 1000; // 로그인 후 12시간 지나면 자동 로그아웃
// 이름 → 계정 이메일 매핑 (직원 추가 시: 여기 + Supabase 계정 함께 추가)
// 이메일은 로그인에 쓰이는 내부 식별자일 뿐이다 — 사용자는 언제나 **이름**으로 로그인한다.
const NAME_TO_EMAIL = {
  '박시환': 'parksihwan@sl-edu.com',
  '김동영': 'kimdongyoung@sl-edu.com',
  '이예지': 'leeyeji@sl-edu.com',
  '임지선': 'imjiseon@sl-edu.com',
  'LUCY': 'lucy@sl-edu.com',      // 관리자(perms all) — CI 스모크 테스트 겸용
  '장회영': 'janghoeyoung@sl-edu.com', // 제작자 — 한줄해석·쌩지문·삽화
  '김소진': 'kimsojin@sl-edu.com',      // 조교 (2026-08-18 추가) — 지문 자료 제작
  '김도아': 'kimdoa@sl-edu.com',        // 조교 (2026-08-18 추가)
  '서예림': 'seoyerim@sl-edu.com',      // 조교 (2026-08-18 추가)
  // 강사 (2026-08-06 추가)
  '김민경': 'kimmingyeong@sl-edu.com',
  '김하나': 'kimhana@sl-edu.com',
  '표건수': 'pyogeonsu@sl-edu.com',
  '이민욱': 'leeminwook@sl-edu.com',
  '홍소영': 'hongsoyoung@sl-edu.com', // 제작자 — 한줄해석·쌩지문·삽화
  '진성혁': 'jinseonghyeok@sl-edu.com', // 부원장 · 관리자 (2026-10-06 추가) — 상담 일정 시험 사용자
  '추예솔': 'chuyesol@sl-edu.com',    // 실장 · 관리자 (2026-10-24 추가)
  '박민주': 'parkminju@sl-edu.com',   // 강사 (2026-11-05 추가)
  '이세영': 'leeseyoung@sl-edu.com',  // 조교 (2026-11-10 추가)
};
const EMAIL_TO_NAME = Object.fromEntries(Object.entries(NAME_TO_EMAIL).map(([n, e]) => [e, n]));

// ===== 권한 그룹 =====
// 계정의 Supabase user_metadata.perms 값이 그룹 키다. modes 는 04-studio.js 의 ALL_MODES 키.
//
// **권한은 여기서만 정한다.** 예전에는 04-studio.js 안에 boolean 세 개가 흩어져 있고
// 워크북은 `name === '박시환'` 으로 이름을 직접 비교했다 — 계정이 늘 때마다 코드를 고쳐야 했다.
// 그룹을 바꾸거나 모드를 옮기려면 이 표만 고치면 된다.
const PERM_GROUPS = {
  개발자: { label: '개발자', modes: null },   // null = 전 모드. 진짜 최상위 권한(박시환·LUCY)
  관리자: { label: '관리자', modes: ['line', 'ppt', 'gukl', 'order', 'raw', 'vocab', 'variant', 'workbook', 'textbook', 'roster', 'weeklyadmin', 'dashboard', 'report', 'attend', 'diary', 'clinic', 'users', 'booking'] },   // 상담 일정 2026-11-17
  강사: { label: '강사', modes: ['line', 'ppt', 'gukl', 'order', 'raw', 'vocab', 'variant', 'workbook', 'weeklyadmin', 'roster', 'report', 'attend', 'diary', 'clinic', 'booking'] },   // 워크북은 2026-10-15 강사에게 개방 · 상담 일정 2026-11-13
  조교: { label: '조교', modes: ['line', 'raw', 'vocab', 'roster', 'attend', 'diary', 'clinic', 'weeklyadmin', 'booking'] },   // 주간테스트 관리·상담 일정 2026-11-13
  제작자: { label: '제작자', modes: ['line', 'raw', 'illust'] },
};
// 전체명단('roster', 홈 앱)은 **개발자·관리자·강사·조교**가 본다(2026-11-10 사장님 지시 — 조교·강사 상관없이 전원).
// 제작자는 DB RLS(aca_* 읽기)가 막고 있어 열어도 데이터가 안 읽힌다 — 열려면 RLS 부터 고쳐야 한다.
// 대시보드('dashboard', 홈 앱 — 강사별 수강생 수 추이)도 **원장·관리자·개발자**만(2026-10-30 사장님 지시). 원장은 관리자 그룹이다.
// DB 쪽 RLS 는 제작자만 막고 있어 따로 손댈 게 없다.
// 신입생 상담('entry', 홈 앱 — 입학테스트 인쇄·성적 아카이빙·즉석 레포트)은 **아직 열지 않았다 — 개발자에게도 안 뜬다**(아래 PERM_CLOSED). 열 때는 PERM_CLOSED 에서 빼고 관리자·강사의 modes 에 'entry' 를 넣는다(RLS 는 이미 개발자·관리자·강사). 조교·제작자에게는 열지 않는다 — 신입생 연락처와 성적이 들어 있다.
// 레포트('report', 홈 앱 — 학부모 레포트 발행)는 **개발자·관리자·강사**(2026-11-12). 상담기록을 읽고 학부모에게 나가는 글을 올리므로
// 조교에게는 열지 않는다 — DB(aca_counsel · report_issues 의 RLS)도 같은 세 그룹만 받는다.
// 출석부('attend', 홈 앱 — 21-attend.js)는 전체명단과 같은 **개발자·관리자·강사·조교**(2026-11-12). DB(attendance RLS)도 제작자만 뺀다.
// 업무일지('diary', 홈 앱 — 22-diary.js)도 같은 네 그룹(2026-11-12). DB(retest_log RLS)도 같다.
// 클리닉('clinic', 홈 앱 — 30-clinic.js)도 같은 네 그룹(2026-11-19 사장님 — 강사·조교·관리자). DB(clinic RLS)도 같다. 신UI 전용.
// (2026-11-18 — 수업자료 앱에서 주간테스트 모드를 뺐다. 아래 weekly 키는 쓰는 화면이 없다. 기록은 CLAUDE.md)
// 주간테스트(weekly)는 **개발자만** 본다(2026-09-21 사장님 지시) — 엔진에 /weekly-item 이 아직 없어 시범 단계다.
// 사용자 관리('users', 홈 앱 — 26-users.js)는 **개발자·관리자**(2026-11-13 사장님). 계정 추가·권한·비밀번호·삭제.
//   실제 권한 확인은 Edge Function admin-users 가 다시 한다(관리자는 개발자 계정·개발자 권한을 못 건드림).
// 상담 일정('booking', 홈 앱)은 **개발자·관리자·강사·조교**(강사·조교 2026-11-13 · 관리자 2026-11-17 사장님 — "관리자 그룹도 상담 일정 앱 보이게").
// 주간테스트 관리('weeklyadmin')는 **개발자·관리자·강사·조교**(2026-11-13 사장님 — 조교에게도 연다).
//   DB: 시험지(weekly_tests)·성적(weekly_scores) 쓰기는 제작자를 뺀 직원 전원 — 누가 낸 시험지든 고치고 지운다
//   (scripts/weekly_scores_open.sql). 휴지통 되돌리기만 개발자·관리자.
// 시험지 관리('exammaker', 홈 앱 — 29-exammaker.js, 학교 시험 동형 시험지)는 **개발자만**(2026-11-19 사장님 — "개발자만 쓸 수 있게").
//   개발자는 modes: null 이라 따로 넣을 곳이 없다. 다른 그룹에 열 때는 그 그룹 modes 에 'exammaker' 를 넣고 DB RLS(exam_is_dev — scripts/exam_maker_schema.sql)도 넓힌다.
// 삽화는 **개발자·제작자만** 본다. 관리자에게 전 모드를 주지 않는 이유가 이것 하나다 —
// modes 를 null 로 두면 나중에 모드가 늘 때마다 관리자에게 자동으로 열려 버린다.
// 옛 perms 값 호환 — Supabase 메타데이터를 안 바꿔도 그대로 동작한다.
// 'all' 은 **관리자**로 받는다. 개발자로 받으면 아직 'all' 인 계정이 순간적으로 최상위 권한을 얻는다.
const PERM_ALIAS = { all: '관리자', admin: '관리자', vocab: '조교', creator: '제작자', illust: '제작자', teacher: '강사', assistant: '조교' };
const PERM_FALLBACK = '강사';   // 값이 없거나 모르는 값이면 강사. 예전 기본값은 'all'(전체 권한)이었는데,
                                // 메타데이터가 빠진 계정에 교재 제작까지 열리는 것은 위험하다.
function permGroupKey(perms) {
  const k = PERM_ALIAS[perms] || perms;
  return PERM_GROUPS[k] ? k : PERM_FALLBACK;
}
// 그룹과 별개로 **사람에게만 더 여는 모드** — 시험 중인 기능을 그룹 전체가 아니라 몇 명에게만 열 때.
// 키는 로그인 이름. 정식으로 열 때는 여기서 빼고 PERM_GROUPS 의 그룹 modes 에 넣는다.
// 2026-11-13 사장님: 그룹 규칙에 어긋나는 개인 추가 권한은 전부 없앴다(진성혁 상담 일정 · 서예림·김도아 주간테스트 관리).
// 대신 주간테스트 관리는 조교 그룹에, 상담 일정은 강사·조교 그룹에 열었다. 새로 개인에게만 열 일이 생기면 여기에 넣는다.
const PERM_EXTRA = {};
/** 이 계정이 그 모드를 쓸 수 있나. name 을 주면 PERM_EXTRA 도 본다. */
// **닫아 둔 기능** — 코드는 들어와 있지만 아직 아무에게도 안 보인다. 개발자(modes: null = 전부)에게도 안 뜬다.
// 열 때는 여기서 빼고 PERM_GROUPS 의 해당 그룹에 넣는다.
//   · entry(신입생 상담) — 2026-11-16 사장님: "아직 앱에 기능은 열어두지 마", "개발자들도 안뜨게". DB 표(entry_schema.sql)도 아직 없다.
const PERM_CLOSED = ['entry'];
function permAllows(perms, modeKey, name) {
  if (PERM_CLOSED.indexOf(modeKey) >= 0) return false;
  const g = PERM_GROUPS[permGroupKey(perms)];
  if (!g.modes || g.modes.indexOf(modeKey) >= 0) return true;
  const extra = name && PERM_EXTRA[String(name).normalize('NFC')];
  return !!(extra && extra.indexOf(modeKey) >= 0);
}
function permLabel(perms) { return PERM_GROUPS[permGroupKey(perms)].label; }

// ===== 지문·어법·어휘 데이터: Supabase에서 로드 (data.js / GRAMMAR_BY_KEY / vocab.js / etc-vocab.js 대체) =====
window.PASSAGES = window.PASSAGES || {};
window.VOCAB = window.VOCAB || {};
window.ETC_VOCAB = window.ETC_VOCAB || {};
async function loadContent() {
  // 지문 (PostgREST 기본 최대 1000행 → 페이지네이션)
  const P = {};
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await SB.from('passages').select('key,eng,title,sentences').range(from, from + PAGE - 1);
    if (error) throw error;
    (data || []).forEach(r => { P[r.key] = { eng: r.eng, title: r.title, sentences: r.sentences || [] }; });
    if (!data || data.length < PAGE) break;
  }
  window.PASSAGES = P;
  // 어법
  const G = {};
  const { data: g, error: ge } = await SB.from('grammar_items').select('key,answer,point,correction,passage_html,exps');
  if (ge) throw ge;
  (g || []).forEach(r => { G[r.key] = { answer: r.answer, point: r.point, correction: r.correction, passageHtml: r.passage_html, exps: r.exps || [] }; });
  GRAMMAR_BY_KEY = G;
  // 지문별 단어 (VOCAB)
  const V = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await SB.from('passage_vocab').select('key,words').range(from, from + PAGE - 1);
    if (error) throw error;
    (data || []).forEach(r => { V[r.key] = r.words || []; });
    if (!data || data.length < PAGE) break;
  }
  window.VOCAB = V;
  // 기타 단어장 (ETC_VOCAB)
  const E = {};
  const { data: ev, error: ee } = await SB.from('etc_vocab').select('name,data');
  if (ee) throw ee;
  (ev || []).forEach(r => { E[r.name] = r.data; });
  window.ETC_VOCAB = E;
  // 워크북(5유형) — 테이블이 아직 없을 수 있으니 실패해도 앱은 계속 동작
  try {
    const W = {};
    const { data: w, error: we } = await SB.from('workbook_items').select('key,data');
    if (!we) (w || []).forEach(r => { W[r.key] = r.data || null; });
    WORKBOOK_BY_KEY = W;
  } catch (e) { WORKBOOK_BY_KEY = {}; }
  // 변형문제 문항(variant_items) — 지문 key별로 묶는다. 변형문제 모드·교재 제작 변형문제 틀이
  // 좌측에서 고른 지문의 문항을 여기서 꺼내 조립한다. 테이블이 아직 없어도 앱은 계속 동작.
  try {
    const VB = {};
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await SB.from('variant_items')
        .select('id,key,type,src_no,stem,passage_html,source,choices,answer,explanation,origin').range(from, from + PAGE - 1);
      if (error) break;
      (data || []).forEach(r => {
        (VB[r.key] = VB[r.key] || []).push({ id: r.id, key: r.key, type: r.type, no: r.src_no || 0, stem: r.stem, passage_html: r.passage_html,
          source: r.source || '', choices: r.choices || [], answer: r.answer, explanation: r.explanation || '',
          provider: (r.origin || '').split(' ')[0] });   // 출제사 = origin 의 첫 낱말("너른터 2025-10 고1" → 너른터)
      });
      if (!data || data.length < PAGE) break;
    }
    window.VARIANT_BY_KEY = VB;
  } catch (e) { window.VARIANT_BY_KEY = {}; }
}

// 데스크톱 앱 버전(홈 우상단에 은은하게 표기). 웹 미리보기에서는 빈 값이라 표시되지 않음.
const APP_VERSION = (typeof window !== 'undefined' && window.desktopVersion) ? ('v' + window.desktopVersion) : '';

const CIRC = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];
function alphaLabel(n) { let s = ''; n++; while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; } // 0→A … 25→Z, 26→AA … 문장 수 무제한

