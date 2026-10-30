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
  '김민규': 'kimmingyu@sl-edu.com',
  '이민욱': 'leeminwook@sl-edu.com',
  '홍소영': 'hongsoyoung@sl-edu.com', // 제작자 — 한줄해석·쌩지문·삽화
  '진성혁': 'jinseonghyeok@sl-edu.com', // 부원장 · 관리자 (2026-10-06 추가) — 상담 일정 시험 사용자
  '추예솔': 'chuyesol@sl-edu.com',    // 실장 · 관리자 (2026-10-24 추가)
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
  관리자: { label: '관리자', modes: ['line', 'ppt', 'gukl', 'order', 'raw', 'vocab', 'variant', 'workbook', 'textbook', 'roster', 'weeklyadmin'] },
  강사: { label: '강사', modes: ['line', 'ppt', 'gukl', 'order', 'raw', 'vocab', 'variant', 'workbook', 'weeklyadmin'] },   // 워크북은 2026-10-15 강사에게 개방
  조교: { label: '조교', modes: ['line', 'raw', 'vocab'] },
  제작자: { label: '제작자', modes: ['line', 'raw', 'illust'] },
};
// 전체명단('roster', 홈 앱)은 **개발자·관리자**가 본다(2026-10-19 사장님 지시 — 임지선·김동영·진성혁).
// DB 쪽 RLS 는 제작자만 막고 있어 따로 손댈 게 없다.
// 주간테스트(weekly)는 **개발자만** 본다(2026-09-21 사장님 지시) — 엔진에 /weekly-item 이 아직 없어 시범 단계다.
// 상담 일정('booking', 홈 앱)은 시험 중이라 어느 그룹에도 안 넣었다 → 개발자만 본다. 열 때 해당 그룹 modes 에 'booking' 추가.
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
const PERM_EXTRA = {
  '진성혁': ['booking'],   // 상담 일정 시험 사용(2026-10-06)
};
/** 이 계정이 그 모드를 쓸 수 있나. name 을 주면 PERM_EXTRA 도 본다. */
function permAllows(perms, modeKey, name) {
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
        .select('id,key,type,src_no,stem,passage_html,source,choices,answer,explanation').range(from, from + PAGE - 1);
      if (error) break;
      (data || []).forEach(r => {
        (VB[r.key] = VB[r.key] || []).push({ id: r.id, key: r.key, type: r.type, no: r.src_no || 0, stem: r.stem, passage_html: r.passage_html,
          source: r.source || '', choices: r.choices || [], answer: r.answer, explanation: r.explanation || '' });
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

