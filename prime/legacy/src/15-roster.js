// 전체명단 — ACA2000 동기화 데이터(aca_student · aca_class)를 반별 명단으로 본다.
//
// 보는 순서: 과목 → 중등/고등 → 학년 → 반. 반은 **T반 · S1 · S2 · S3 …** 순으로 놓고,
// 가로로 길게 늘이지 않고 줄을 바꿔 깔아 한 화면에서 훑을 수 있게 한다.
// '전체' 학년을 고르면 1학년부터 차례로 내려온다.
//
// 데이터는 **만들지 않는다.** 전부 동기화된 DB 에서 온다(1시간마다 Supabase Edge Function).
// 그래서 여기서 할 일은 묶고 세고 거르는 것뿐이다.
//
// 학년은 **반 이름이 아니라 그 반 학생들의 학년**에서 정한다 — 반 이름은 '(수) 예비고1 S2' 처럼
// 표기가 흔들리고 오타(괄호 두 개 등)도 있지만, 학생 학년은 ACA2000 이 준 값이라 흔들리지 않는다.

const RS_LEVELS = [{ k: '초', label: '초등' }, { k: '중', label: '중등' }, { k: '고', label: '고등' }];
const RS_SUBJECT_ORDER = ['영어', '수학', '국어', '과학'];   // 원본 시트 탭 순서
// 수강으로 치지 않는 관리용 반 — 명단에 끼면 숫자가 틀어진다.
const RS_HIDDEN = /전반처리|강의평가|휴원목록|세미나|설명회|테스트반|프리미엄입시관리/;

// 확대/축소 — 여느 사이트처럼 100% 기준에 50~150%. CSS zoom 을 쓰는 이유는 **글자만 키우는 게 아니라
// 레이아웃을 다시 흘려주기** 때문이다(transform: scale 은 카드가 넘쳐도 줄바꿈이 안 된다).
//
// RS_ZOOM_BASE: 화면의 '100%' 가 실제로는 이 배율이다(사장님이 140% 를 기본으로 보시겠다고 해서).
// 카드 안 숫자를 전부 1.4 배로 고쳐 적지 않는 이유는 간단하다 — 스물 몇 군데를 손으로 곱하면 반드시 하나를 빠뜨린다.
const RS_ZOOM_BASE = 1.4;
const RS_ZOOM_MIN = 0.5, RS_ZOOM_MAX = 1.5, RS_ZOOM_STEP = 0.1, RS_ZOOM_KEY = 'slRosterZoom';
const rsClampZoom = (z) => Math.min(RS_ZOOM_MAX, Math.max(RS_ZOOM_MIN, Math.round(z * 100) / 100));
function rsLoadZoom() {
  try { const v = Number(localStorage.getItem(RS_ZOOM_KEY)); return v ? rsClampZoom(v) : 1; } catch (e) { return 1; }
}
function rsSaveZoom(z) { try { localStorage.setItem(RS_ZOOM_KEY, String(z)); } catch (e) {} }

// 강사별 반 머리 색. 지정된 다섯은 사장님이 고르신 것이고, 나머지는 아래 파스텔에서 **이름순으로** 받는다
// — 순서를 이름으로 고정해야 강사가 늘거나 걸러도 색이 춤추지 않는다.
// **한 과목 안에서 서로 안 겹치게** 고른 것이 핵심이다 — 화면에는 한 과목만 떠 있으므로 과목을 넘나드는
// 중복은 괜찮지만, 같은 탭에 비슷한 색이 둘이면 구분이 안 된다(진성혁이 자동 배정으로 김하나와 같은
// 초록 계열을 받아 실제로 헷갈렸다).
const RS_TEACHER_COLOR = {
  // 영어 — 노랑 · 하늘 · 연두 · 주황 · 핑크(사장님 지정) + 아쿠아 · 라벤더 · 살구
  '표건수': '#EFEC9D', '이민욱': '#94D4FC', '김하나': '#9BDB9F', '김민경': '#F5C38C', '박민주': '#FFB7E0',
  '진성혁': '#93F9F4', '박성민': '#D9DAFD', '이주연': '#FDBDB2',
  // 수학 — 로즈 · 아쿠아 · 노랑 · 하늘 · 연두 · 주황 · 보라
  '김현진': '#FEBBC3', '장욱진': '#90F9FA', '이석찬': '#F3EB9C', '김지수': '#A8D0FC',
  '오나라': '#92DDA5', '김민규': '#FBC094', '김재식': '#E2BEFE',
  // 국어 · 과학 — 혼자라 다른 과목과 겹쳐도 괜찮다
  '양은석': '#EDC0CC', '박승철': '#A8D8E8',
};
const RS_PASTELS = [
  '#DDD4F7', '#BEEAE0', '#FFD2C4', '#B8E3EC', '#E7D4EF', '#EDE0C8',
  '#E6F0A8', '#D6DDEA', '#F3D1D1', '#CFE3CE', '#F7DFF0', '#CCE5D2',
];
// 파스텔은 늘 밝으므로 글자는 어두운 먹으로 고정한다 — 다크 모드에서 밝은 글자를 얹으면 안 보인다.
const RS_ON_PASTEL = '#1d1d1f';

/** 전체 강사 이름 → 색. 지정색 먼저 빼고, 남은 사람에게 이름순으로 파스텔을 돌린다. */
function rsTeacherColors(names) {
  const out = {};
  const rest = [];
  for (const n of [...new Set(names)].sort((a, b) => String(a).localeCompare(String(b), 'ko'))) {
    if (RS_TEACHER_COLOR[n]) out[n] = RS_TEACHER_COLOR[n]; else rest.push(n);
  }
  rest.forEach((n, i) => { out[n] = RS_PASTELS[i % RS_PASTELS.length]; });
  return out;
}

/**
 * 명단 검색 — 이름 · 학생 전화 · 학부모 전화 1·2 중 **어디든 일부만 맞아도** 걸린다.
 * 전화는 숫자만 남겨 견준다. 그래야 '5677' 로 010-1234-5677 이 찾아진다(사장님 예시) —
 * 화면에는 하이픈이 있고 DB 에는 없어서, 둘 다 숫자만 남기지 않으면 뒷자리 검색이 안 된다.
 * ※ 학부모 '이름' 은 ACA2000 이 주지 않는다(학생 응답에 그 칸이 없다). 생기면 여기 한 줄 더하면 된다.
 */
function rsSearchHit(st, q) {
  const text = String(q || '').trim().toLowerCase();
  if (!text) return true;
  if (String(st.name || '').toLowerCase().includes(text)) return true;
  const digits = text.replace(/\D/g, '');
  if (!digits) return false;
  return [st.s_hp, st.p_hp1, st.p_hp2].some((v) => String(v || '').replace(/\D/g, '').includes(digits));
}

const rsUniq = (a) => [...new Set(a.filter(Boolean))];
/**
 * 반 목록에 **몇 사람**이 있나. 두 반을 듣는 학생을 두 번 세지 않는다.
 * 학교를 골랐으면 그 학교 학생(hitKids)만 센다 — 화면에는 나머지도 흐리게 남지만 숫자는 고른 쪽이다.
 */
const rsHeads = (cols) => new Set(cols.flatMap((c) => (c.hitKids || c.kids).map((k) => k.s_id))).size;
const rsKo = (a, b) => String(a).localeCompare(String(b), 'ko');

/** '고1' → {level:'고', num:1}. 못 읽으면 null. */
function rsGrade(g) {
  const m = String(g || '').match(/^([초중고])\s*(\d+)/);
  return m ? { level: m[1], num: Number(m[2]) } : null;
}

/** 그 반에서 제일 많은 학년. 섞여 있어도 한 반은 한 자리에 놓여야 한다. */
function rsClassGrade(kids) {
  const n = {};
  for (const k of kids) { const g = rsGrade(k.grade); if (g) n[g.level + g.num] = (n[g.level + g.num] || 0) + 1; }
  let best = '', bestN = 0;
  for (const key of Object.keys(n)) if (n[key] > bestN) { best = key; bestN = n[key]; }
  return best ? rsGrade(best) : null;
}

/**
 * 반 이름 → 정렬 자리. T반이 먼저, 그 다음 S1 · S2 · S3 …, 둘 다 아니면 맨 뒤(이름순).
 * 담임 표기 '(석찬T)' 안의 T 에 걸리지 않게 괄호부터 지운다 — 안 지우면 수학 반이 전부 T반이 된다.
 */
function rsRank(name) {
  const n = String(name || '').replace(/[([][^()[\]]*T[)\]]/g, ' ');
  const m = n.match(/(?:^|[^A-Za-z가-힣])([TS])\s*(\d+)?\s*-?\s*([A-Za-z0-9])?/);
  if (!m) return [9, 0, 0, n];
  const sub = m[3] ? String(m[3]).toUpperCase().charCodeAt(0) : 0;
  return [m[1].toUpperCase() === 'T' ? 0 : 1, Number(m[2] || 0), sub, n];
}
function rsCmpRank(a, b) {
  const x = rsRank(a.name), y = rsRank(b.name);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return rsKo(a.name, b.name);
}

/** 학교 이름을 짧게 — 한 반에 학교가 섞였을 때만 이름 옆에 붙인다. */
function rsSchoolTag(school) {
  const s = String(school || '');
  if (!s) return '';
  if (/^원당/.test(s)) return '원';
  if (/^아라/.test(s)) return '아';
  return s.replace(/(초|중|고)등?학교$/, '').slice(0, 2);
}

/** 반 이름에서 과목 접두사를 뗀다 — 과목은 탭으로 이미 안다. */
function rsShortName(name) {
  return String(name || '').replace(/^\s*[([]\s*[영수국과]\s*[)\]]\s*/, '').trim() || String(name || '');
}

/**
 * DB 행 → 과목별 반 목록. 거르기는 화면에서 한다(선택지가 사라지지 않게).
 * @returns 과목 목록과, 과목마다 {cols, teachers, schools}
 */
function rsBuild(classes, students) {
  const live = (classes || []).filter((c) => !c.is_admin && c.active > 0 && !RS_HIDDEN.test(c.name || ''));
  const enrolled = (students || []).filter((s) => s.state === '재원');

  const kidsOf = {};
  for (const c of live) kidsOf[c.c_id] = [];
  for (const s of enrolled) for (const id of s.class_ids || []) if (kidsOf[id]) kidsOf[id].push(s);

  const all = rsUniq(live.map((c) => c.subject || '기타'));
  const subjects = RS_SUBJECT_ORDER.filter((s) => all.includes(s))
    .concat(all.filter((s) => !RS_SUBJECT_ORDER.includes(s)).sort(rsKo));

  // 색은 **과목을 가리지 않고 한 번에** 정한다. 과목마다 따로 돌리면 같은 강사가 탭마다 다른 색이 된다.
  const colorOf = rsTeacherColors(live.flatMap((c) => c.teachers || []));

  const bySubject = {};
  for (const sub of subjects) {
    const cols = [];
    for (const c of live) {
      if ((c.subject || '기타') !== sub) continue;
      const kids = (kidsOf[c.c_id] || []).slice().sort((a, b) => rsKo(a.name, b.name));
      if (!kids.length) continue;
      const g = rsClassGrade(kids);
      cols.push({
        id: c.c_id, name: rsShortName(c.name), full: c.name,
        teachers: c.teachers || [], timetable: c.timetable_text || '',
        color: colorOf[(c.teachers || [])[0]] || '',   // 담임 둘이면 첫 사람 색을 쓴다
        level: g ? g.level : '', num: g ? g.num : 0, kids,
      });
    }
    cols.sort(rsCmpRank);
    bySubject[sub] = {
      cols,
      // 고르는 칸은 **그 과목 안에서만** — 영어 탭에 수학 강사가 뜨면 고르나 마나다
      teachers: rsUniq(cols.flatMap((c) => c.teachers)).sort(rsKo),
      schools: rsUniq(cols.flatMap((c) => c.kids.map((k) => k.school))).sort(rsKo),
    };
  }
  return { subjects, bySubject };
}

/**
 * 고른 조건으로 좁힌다. 강사는 반을 통째로 거르고, **학교는 학생을 지우지 않는다** —
 * 수학처럼 한 반에 여러 학교가 섞인 경우, 고른 학교 학생을 위로 올리고 나머지는 흐리게 남긴다.
 * 반을 떠나는 게 아니라 그 반 안에서 누가 우리 학교인지 보는 게 목적이기 때문이다(사장님 지시).
 * 고른 학교 학생이 하나도 없는 반만 뺀다.
 *
 * where 에서 한 칸을 빼고 부르면 **그 칸의 선택지**가 나온다 —
 * 고등 1학년을 보고 있는데 중학교·초등 강사가 목록에 남아 있으면 고르나 마나다.
 */
function rsFilter(cols, { level, num, teacher, school }) {
  const out = [];
  for (const c of cols) {
    if (level && c.level !== level) continue;
    if (num && c.num !== num) continue;
    if (teacher && !c.teachers.includes(teacher)) continue;
    const hit = school ? c.kids.filter((k) => k.school === school) : c.kids;
    if (!hit.length) continue;
    const rest = school ? c.kids.filter((k) => k.school !== school) : [];
    out.push({
      ...c,
      kids: hit.concat(rest),                 // 고른 학교가 위로 (각자는 이미 이름순)
      hitKids: hit,
      hitIds: new Set(hit.map((k) => k.s_id)),
      dimmed: rest.length,                    // 흐리게 그릴 인원
      total: c.kids.length,
      mixed: rsUniq(c.kids.map((k) => k.school)).length > 1,
    });
  }
  return out;
}

// ─────────────────────────── 화면 ───────────────────────────

function RosterSelect({ label, value, options, onChange, T }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.textDim }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        font: 'inherit', fontSize: 13, color: T.text, background: 'transparent',
        border: '1px solid ' + T.divider, borderRadius: 8, padding: '5px 8px', cursor: 'pointer', minWidth: 96,
      }}>
        <option value="">전체</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function RosterPills({ items, value, onPick, T, PC }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((it) => (
        <button key={String(it.v)} onClick={() => onPick(it.v)} style={{
          padding: '5px 13px', borderRadius: 9999, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          border: '1px solid ' + (it.v === value ? PC : T.divider),
          background: it.v === value ? PC : 'transparent', color: it.v === value ? '#fff' : T.text,
        }}>{it.label}{it.n != null ? <span style={{ opacity: 0.7, marginLeft: 5 }}>{it.n}</span> : null}</button>
      ))}
    </div>
  );
}

/** 돋보기 ＋/－. 가운데 퍼센트를 누르면 100% 로 돌아온다. */
function RosterZoom({ zoom, setZoom, T }) {
  const btn = {
    width: 30, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid ' + T.divider, background: 'transparent', color: T.text, cursor: 'pointer', padding: 0,
  };
  const Glass = ({ plus }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      <path d="M8 11h6" />{plus ? <path d="M11 8v6" /> : null}
    </svg>
  );
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden' }}
      title="Ctrl + 마우스 휠로도 조절할 수 있습니다">
      <button onClick={() => setZoom(rsClampZoom(zoom - RS_ZOOM_STEP))} disabled={zoom <= RS_ZOOM_MIN}
        style={{ ...btn, borderRadius: '8px 0 0 8px', opacity: zoom <= RS_ZOOM_MIN ? 0.35 : 1 }} aria-label="축소"><Glass /></button>
      <button onClick={() => setZoom(1)} style={{
        ...btn, width: 50, borderLeft: 'none', borderRight: 'none', borderRadius: 0,
        fontSize: 12, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums', color: T.textDim,
      }} aria-label="100% 로">{Math.round(zoom * 100)}%</button>
      <button onClick={() => setZoom(rsClampZoom(zoom + RS_ZOOM_STEP))} disabled={zoom >= RS_ZOOM_MAX}
        style={{ ...btn, borderRadius: '0 8px 8px 0', opacity: zoom >= RS_ZOOM_MAX ? 0.35 : 1 }} aria-label="확대"><Glass plus /></button>
    </div>
  );
}

function RosterColumn({ col, T, PC, dark, onPick }) {
  const head = col.color || (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.035)');
  const ink = col.color ? RS_ON_PASTEL : T.text;        // 파스텔 위에는 먹 글씨
  const sub = col.color ? 'rgba(0,0,0,0.5)' : T.textFaint;
  return (
    <div style={{ flex: 'none', width: 168, border: '1px solid ' + T.divider, borderRadius: 10, overflow: 'hidden', background: dark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
      <div style={{ padding: '9px 11px', background: head, borderBottom: '1px solid ' + T.divider, color: ink }}>
        <div title={col.full + (col.timetable ? ' · ' + col.timetable : '')}
          style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, wordBreak: 'keep-all' }}>{col.name}</div>
        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 12, color: sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {col.teachers.join(',') || '담임 미지정'}
          </span>
          {/* 학교를 골랐으면 '고른 학교 인원 / 반 전체' — 고른 쪽을 크게, 전체를 작게(사장님 지시) */}
          <span style={{ fontSize: 13.5, fontWeight: 700, color: col.color ? RS_ON_PASTEL : PC, whiteSpace: 'nowrap' }}>
            {col.dimmed
              ? <>{col.hitKids.length}<span style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.55 }}>/{col.total}</span></>
              : col.kids.length}
          </span>
        </div>
      </div>
      <div>
        {col.kids.map((k, i) => {
          // 학교를 골랐을 때 그 학교가 아닌 학생 — 지우지 않고 흐리게 둔다(반에 누가 더 있는지는 보여야 한다)
          const off = col.hitIds ? !col.hitIds.has(k.s_id) : false;
          return (
          // 번호는 이름보다 작은 글자라 그냥 늘어놓으면 위로 떠 보인다. baseline 으로 묶어 글자 밑선을 맞춘다.
          <div key={k.s_id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '4px 11px', fontSize: 14,
            opacity: off ? 0.34 : 1, borderTop: i ? '1px solid ' + (dark ? 'rgba(255,255,255,0.05)' : '#f2f2f5') : 'none' }}>
            <span style={{ flex: 'none', width: 17, textAlign: 'right', color: T.textFaint, fontSize: 12 }}>{off ? '' : i + 1}</span>
            <span onClick={() => onPick && onPick(k)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick && onPick(k); } }}
              style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3 }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = T.textFaint; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = 'transparent'; }}
              title={k.name + ' · ' + (k.school || '') + ' ' + (k.grade || '') + ' — 누르면 상세'}>
              {k.name}
              {col.mixed && k.school ? <span style={{ color: T.textFaint, fontSize: 12 }}>({rsSchoolTag(k.school)})</span> : null}
            </span>
          </div>);
        })}
      </div>
    </div>
  );
}

// ─────────────────────── 학생 상세 팝업 ───────────────────────
// 이름을 누르면 **ACA2000 에서 볼 수 있는 그 학생의 모든 것**을 띄운다.
// 목록 화면에는 담기지 않는 것(연락처 원본·수강 이력 전체·퇴원 사유·변동 기록)이 여기 다 있다.
//
// 네 테이블을 그 학생 것만 집어 온다 — 명단은 수백 명이라 미리 다 들고 있을 수 없다.
//   aca_raw_student      SyncStudent 원본(연락처·출결카드·이메일까지)
//   aca_raw_enroll       수강 이력 전체(옛 반·삭제된 등록 포함)
//   aca_raw_studentclass GetStudentClassInfo (kubun·퇴원 사유)
//   aca_event            그 학생에게 일어난 변동
//   aca_raw_class        옛 반 이름 — 수강 이력에는 지금 아무도 안 듣는 반이 나오는데(실측 6건),
//                        화면이 든 aca_class 에는 재원생이 있는 반만 담겨 있어 '반 232' 처럼 번호로 떴다
//
// 생김새는 사장님이 주신 다이얼로그를 따랐다(배경 흐림 · 둥근 카드 · 검색 · Esc 닫기 · 그룹 목록).
// 다만 Tailwind·framer-motion 을 쓰지 않는다 — 이 앱은 빌드 스텝이 없고 인라인 스타일이다(CLAUDE.md).

const RS_KUBUN = { 0: '수강중', 1: '전반(퇴반)', 2: '전반(입반)', 3: '퇴원' };

function rsPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  return v || '';
}
const rsDash = (v) => (v == null || v === '' ? '—' : String(v));

/** 그 학생의 모든 기록 → 화면에 그릴 그룹들. 비어 있는 칸도 '—' 로 남긴다(없다는 것도 정보다). */
function rsDetailGroups(d, classOf) {
  if (!d) return [];
  const { base, raw, enroll, info, events, names } = d;
  // 지금 쓰는 반 → 원본 반 이름 → 그래도 없으면 번호
  const cname = (id) => (classOf(id) || {}).name || (names && names[id]) || ('반 ' + id);
  const kub = {};
  for (const r of info) if (r.cId != null) kub[r.cId] = r;

  const g = [];
  g.push({ heading: '기본', rows: [
    ['이름', rsDash(raw.s_name || base.name)],
    ['학년', rsDash(base.grade)],
    ['학교', rsDash(raw.sc_name) + (raw.sc_year ? ' ' + raw.sc_year + '학년' : '')],
    ['상태', rsDash(base.state) + (base.quit_reason ? ' · ' + base.quit_reason : '')],
    ['등록일', rsDash(raw.reg_date)],
    ['삭제일', rsDash(raw.del_date)],
    ['학생 ID', String(base.s_id)],
  ] });
  g.push({ heading: '연락처', rows: [
    ['학생', rsDash(rsPhone(raw.s_hp))],
    ['학부모 1', rsDash(rsPhone(raw.p_hp1))],
    ['학부모 2', rsDash(rsPhone(raw.p_hp2))],
    ['이메일', rsDash(raw.email)],
    ['출결카드', rsDash(raw.card_num)],
  ] });

  const now = (base.class_ids || []).map((id) => classOf(id)).filter(Boolean);
  g.push({ heading: '지금 듣는 반 (' + now.length + ')', rows: now.map((c) => [
    c.name,
    [c.subject, (c.teachers || []).join(','), c.timetable_text, c.amount ? c.amount.toLocaleString() + '원' : '']
      .filter(Boolean).join(' · ') || '—',
  ]) });

  const hist = enroll.slice().sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
  g.push({ heading: '수강 이력 (' + hist.length + ')', rows: hist.map((r) => {
    const k = kub[r.c_id];
    const tail = [r.start_date + ' ~ ' + (r.end_date || '수강중')];
    if (k && RS_KUBUN[k.kubun] && k.kubun !== 0) tail.push(RS_KUBUN[k.kubun]);
    if (k && k.reason) tail.push(k.reason);
    if (r.del_date) tail.push('삭제 ' + r.del_date);
    return [cname(r.c_id), tail.join(' · ')];
  }) });

  if (events.length) {
    g.push({ heading: '변동 기록 (' + events.length + ')', rows: events.map((e) => [
      String(e.at).slice(0, 10) + ' ' + e.kind,
      [e.c_name, Object.entries(e.detail || {}).map(([k, v]) =>
        k + ' ' + (v && typeof v === 'object' ? (v.from || '') + '→' + (v.to || '') : v)).join(' · ')]
        .filter(Boolean).join(' · ') || '—',
    ]) });
  }
  return g.filter((x) => x.rows.length);
}

function RosterStudentDialog({ student, classOf, dark, onClose }) {
  const T = THEME(dark);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [shown, setShown] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const id = student.s_id;
    Promise.all([
      SB.from('aca_raw_student').select('*').eq('s_id', id).limit(1),
      SB.from('aca_raw_enroll').select('*').eq('s_id', id),
      SB.from('aca_raw_studentclass').select('data').eq('s_id', id).limit(1),
      SB.from('aca_event').select('at,kind,c_name,detail').eq('s_id', id).order('at', { ascending: false }).limit(50),
      SB.from('aca_raw_class').select('c_id,c_name'),
    ]).then(([a, b, c, d, e]) => {
      const bad = [a, b, c, d, e].find((x) => x.error);
      if (bad) { setErr(bad.error.message); return; }
      const names = {};
      for (const r of e.data || []) names[r.c_id] = r.c_name;
      setData({
        base: student,
        raw: (a.data || [])[0] || {},
        enroll: b.data || [],
        info: ((c.data || [])[0] || {}).data || [],
        events: d.data || [],
        names,
      });
    }).catch((e) => setErr(String((e && e.message) || e)));
  }, [student.s_id]);

  const view = rsDetailGroups(data, classOf);

  const card = dark ? '#1f2024' : '#ffffff';
  const line = dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)';

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: dark ? 'rgba(0,0,0,0.6)' : 'rgba(24,24,27,0.4)',
        backdropFilter: 'blur(2px)', opacity: shown ? 1 : 0, transition: 'opacity .16s',
      }} />
      <div ref={boxRef} role="dialog" aria-modal="true" style={{
        position: 'relative', width: '100%', maxWidth: 560, maxHeight: '84vh', display: 'flex', flexDirection: 'column',
        background: card, color: T.text, border: '1px solid ' + line, borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
        opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(8px) scale(0.98)',
        transition: 'opacity .18s, transform .18s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid ' + line }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.3px' }}>{student.name}</div>
            <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>
              {[student.grade, student.school, student.state].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{
            marginLeft: 'auto', width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 7,
            border: 0, background: 'transparent', color: T.textFaint, cursor: 'pointer', fontSize: 17, lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '2px 10px 10px' }}>
          {err ? <div style={{ padding: 24, color: '#c0392b', fontSize: 13 }}>불러오지 못했습니다 — {err}</div> : null}
          {!data && !err ? <div style={{ padding: 32, textAlign: 'center', color: T.textDim, fontSize: 13 }}>불러오는 중…</div> : null}
          {view.map((g) => (
            <div key={g.heading}>
              <div style={{ padding: '14px 6px 5px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: T.textFaint }}>
                {g.heading.toUpperCase()}
              </div>
              {g.rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'baseline', padding: '6px 6px', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ flex: 'none', minWidth: 92, color: T.textDim }}>{r[0]}</span>
                  <span style={{ flex: 1, textAlign: 'right', wordBreak: 'break-all' }}>{r[1]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '9px 16px', borderTop: '1px solid ' + line, fontSize: 11.5, color: T.textFaint, display: 'flex', justifyContent: 'space-between' }}>
          <span>ACA2000 에서 받아온 그대로입니다</span>
          <span>Esc 로 닫기</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 검색 결과 — 찾을 때는 **과목·급·학년 선택을 무시한다.**
 * 전화가 울려서 '5677' 을 치는 사람은 그 학생이 지금 보고 있는 탭에 있든 없든 찾고 싶다.
 * 그래서 휴원·퇴원까지 전부 뒤지고 상태를 같이 보여 준다.
 */
function RosterResults({ hits, classOf, onPick, T, PC, dark }) {
  const badge = (state) => state === '재원' ? PC : state === '휴원' ? '#b8860b' : '#9aa6b2';
  return (
    <div style={{ border: '1px solid ' + T.divider, borderRadius: 12, overflow: 'hidden', background: dark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
      {hits.map((s, i) => {
        const cs = (s.class_ids || []).map(classOf).filter((c) => c && !c.is_admin);
        return (
          <div key={s.s_id} onClick={() => onPick(s)} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onPick(s); } }}
            style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 14px', cursor: 'pointer',
              borderTop: i ? '1px solid ' + (dark ? 'rgba(255,255,255,0.05)' : '#f2f2f5') : 'none' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : '#fafafb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ flex: 'none', fontSize: 14.5, fontWeight: 600, minWidth: 76 }}>{s.name}</span>
            <span style={{ flex: 'none', fontSize: 12, color: badge(s.state) }}>{s.state}</span>
            <span style={{ flex: 'none', fontSize: 12.5, color: T.textDim, minWidth: 92 }}>
              {[s.grade, s.school].filter(Boolean).join(' · ')}
            </span>
            <span style={{ flex: 'none', fontSize: 12.5, color: T.textDim, fontVariantNumeric: 'tabular-nums', minWidth: 230 }}>
              {[s.s_hp && '학생 ' + rsPhone(s.s_hp), s.p_hp1 && '학부모 ' + rsPhone(s.p_hp1), s.p_hp2 && rsPhone(s.p_hp2)]
                .filter(Boolean).join('  ·  ') || '—'}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cs.map((c) => c.name).join(' · ') || '듣는 반 없음'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RosterApp({ dark, onHome }) {
  const T = THEME(dark);
  const PC = '#0066cc';
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [sync, setSync] = useState(null);
  const [sub, setSub] = useState('');
  const [level, setLevel] = useState('');     // '초' | '중' | '고'
  const [num, setNum] = useState(0);          // 0 = 전체
  const [teacher, setTeacher] = useState('');
  const [school, setSchool] = useState('');
  const [find, setFind] = useState('');         // 명단 검색(이름·전화)
  const [picked, setPicked] = useState(null);   // 상세 팝업을 띄울 학생
  const [zoom, setZoomRaw] = useState(rsLoadZoom);
  const bodyRef = useRef(null);
  const setZoom = (z) => { const v = rsClampZoom(z); setZoomRaw(v); rsSaveZoom(v); };
  // 휠 핸들러는 effect 안에 갇혀 **렌더 당시의 zoom 을 붙잡는다.** 직전 값을 받아 더하는 형태로 올려야
  // 한 번 돌릴 때마다 같은 자리로 되돌아가지 않는다.
  const bumpZoom = (d) => setZoomRaw((prev) => { const v = rsClampZoom(prev + d); rsSaveZoom(v); return v; });

  // Ctrl + 휠. React 의 onWheel 은 passive 라 preventDefault 가 먹지 않아(브라우저가 통째로 확대된다)
  // 네이티브로 passive:false 를 붙인다.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      bumpZoom(e.deltaY < 0 ? RS_ZOOM_STEP : -RS_ZOOM_STEP);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [rows]);

  useEffect(() => {
    Promise.all([
      SB.from('aca_class').select('c_id,name,subject,teachers,timetable_text,is_admin,active'),
      SB.from('aca_student').select('s_id,name,grade,school,state,class_ids,s_hp,p_hp1,p_hp2'),
      SB.from('aca_sync').select('started_at,ok').order('started_at', { ascending: false }).limit(1),
    ]).then(([c, s, y]) => {
      if (c.error || s.error) { setErr((c.error || s.error).message); return; }
      setRows({ classes: c.data || [], students: s.data || [] });
      setSync((y.data || [])[0] || null);
    }).catch((e) => setErr(String((e && e.message) || e)));
  }, []);

  const data = rows ? rsBuild(rows.classes, rows.students) : null;
  const curSub = data ? (data.bySubject[sub] ? sub : data.subjects[0] || '') : '';
  const pack = data && curSub ? data.bySubject[curSub] : null;

  // 급 선택지 — 그 과목에 있는 것만. 고른 급이 이 과목에 없으면 제일 사람 많은 쪽으로 옮긴다.
  const levels = pack ? RS_LEVELS.filter((l) => pack.cols.some((c) => c.level === l.k))
    .map((l) => ({ v: l.k, label: l.label, n: rsHeads(pack.cols.filter((c) => c.level === l.k)) })) : [];
  const curLevel = levels.some((l) => l.v === level) ? level
    : (levels.slice().sort((a, b) => b.n - a.n)[0] || {}).v || '';

  const nums = pack ? rsUniq(pack.cols.filter((c) => c.level === curLevel).map((c) => c.num)).sort((a, b) => a - b) : [];
  const curNum = nums.includes(num) ? num : 0;

  // 급·학년 안에서 쓸 수 있는 값인지 먼저 거른다. 이 단계가 없으면 급을 바꿨을 때 남아 있던
  // 옛 선택(예: 고등에서 고른 '아라고')이 중등 계산에 끼어들어 **강사 목록이 통째로 비어 버린다**(실측).
  const inScope = pack ? rsFilter(pack.cols, { level: curLevel, num: curNum }) : [];
  const curTeacher = inScope.some((c) => c.teachers.includes(teacher)) ? teacher : '';
  const curSchool = inScope.some((c) => c.kids.some((k) => k.school === school)) ? school : '';
  // 선택지는 **자기 칸을 뺀 나머지 조건**으로 만든다. 그래야 '고등 1학년' 에서 초등 강사가 사라지고,
  // 학교를 고르면 그 학교를 가르치는 강사만 남는다.
  const teacherOpts = rsUniq(rsFilter(inScope, { school: curSchool }).flatMap((c) => c.teachers)).sort(rsKo);
  const schoolOpts = rsUniq(rsFilter(inScope, { teacher: curTeacher }).flatMap((c) => c.kids.map((k) => k.school))).sort(rsKo);

  const shown = pack ? rsFilter(pack.cols, { level: curLevel, num: curNum, teacher: curTeacher, school: curSchool }) : [];
  // '전체' 면 1학년부터 차례로, 학년을 고르면 그 학년만
  const groups = [];
  for (const g of (curNum ? [curNum] : nums)) {
    const cols = shown.filter((c) => c.num === g);
    if (cols.length) groups.push({ num: g, cols });
  }
  const total = rsHeads(shown);
  const seats = shown.reduce((n, c) => n + (c.hitKids || c.kids).length, 0);
  const perTeacher = (() => {
    const m = {}, seen = {};
    for (const c of shown) for (const t of (c.teachers.length ? c.teachers : ['미지정'])) {
      m[t] = m[t] || 0; seen[t] = seen[t] || new Set();
      for (const k of (c.hitKids || c.kids)) if (!seen[t].has(k.s_id)) { seen[t].add(k.s_id); m[t]++; }
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  })();

  // 동기화가 멈춘 걸 모르는 게 제일 위험하다 — 하루를 넘기거나 실패면 빨갛게
  const stale = !sync || !sync.ok || (Date.now() - new Date(sync.started_at).getTime()) / 3600000 > 25;
  const syncText = sync
    ? new Date(sync.started_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + (sync.ok ? '' : ' · 실패')
    : '기록 없음';

  const pickSub = (s) => { setSub(s); setNum(0); setTeacher(''); setSchool(''); };
  // 검색 중에는 과목·급·학년을 무시하고 전부 뒤진다(휴원·퇴원 포함)
  const searching = find.trim().length > 0;
  const hits = searching && rows
    ? rows.students.filter((s) => rsSearchHit(s, find))
        .sort((a, b) => (a.state === '재원' ? 0 : 1) - (b.state === '재원' ? 0 : 1) || rsKo(a.name, b.name))
        .slice(0, 200)
    : [];

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid ' + T.divider }}>
        <button onClick={onHome} style={{ padding: '6px 13px', borderRadius: 9, border: '1px solid ' + T.divider, background: 'transparent', color: T.text, font: 'inherit', fontSize: 13, cursor: 'pointer' }}>← 홈</button>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.4px' }}>전체명단</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: stale ? '#c0392b' : T.textFaint }}>{stale ? '⚠ ' : ''}동기화 {syncText}</span>
          {/* 폰에서는 돋보기를 감춘다(data-mhide) — 핀치 줌이 있다 */}
          <span data-mhide="" style={{ display: 'inline-flex' }}><RosterZoom zoom={zoom} setZoom={setZoom} T={T} /></span>
        </div>
      </div>

      {picked ? <RosterStudentDialog student={picked} dark={dark} onClose={() => setPicked(null)}
        classOf={(id) => (rows ? rows.classes.find((c) => c.c_id === id) : null)} /> : null}

      {err ? <div style={{ padding: 24, color: '#c0392b', fontSize: 13.5 }}>불러오지 못했습니다 — {err}</div> : null}
      {!rows && !err ? <div style={{ padding: 40, textAlign: 'center', color: T.textDim, fontSize: 13.5 }}>불러오는 중…</div> : null}

      {pack ? (
        <div style={{ padding: '14px 24px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px',
            border: '1px solid ' + (searching ? PC : T.divider), borderRadius: 10,
            background: dark ? 'rgba(255,255,255,0.03)' : '#fff' }}>
            <span style={{ color: T.textFaint, fontSize: 14 }}>🔍</span>
            <input value={find} onChange={(e) => setFind(e.target.value)}
              placeholder="이름 · 학생 전화 · 학부모 전화로 찾기 (뒷자리만 쳐도 됩니다)"
              style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', color: T.text, font: 'inherit', fontSize: 13.5 }} />
            {searching ? <button onClick={() => setFind('')} style={{ border: 0, background: 'transparent',
              color: T.textFaint, cursor: 'pointer', font: 'inherit', fontSize: 12 }}>지우기 ✕</button> : null}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, opacity: searching ? 0.4 : 1, pointerEvents: searching ? 'none' : 'auto' }}>
            {data.subjects.map((s) => (
              <button key={s} onClick={() => pickSub(s)} style={{
                padding: '7px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid ' + (s === curSub ? PC : T.divider), background: s === curSub ? PC : 'transparent', color: s === curSub ? '#fff' : T.text,
              }}>{s}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, opacity: searching ? 0.4 : 1, pointerEvents: searching ? 'none' : 'auto' }}>
            <RosterPills items={levels} value={curLevel} onPick={(v) => { setLevel(v); setNum(0); }} T={T} PC={PC} />
            <RosterPills
              items={[{ v: 0, label: '전체' }].concat(nums.map((n) => ({ v: n, label: n + '학년' })))}
              value={curNum} onPick={setNum} T={T} PC={PC} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', paddingTop: 2 }}>
              <RosterSelect label="강사" value={curTeacher} options={teacherOpts} onChange={setTeacher} T={T} />
              <RosterSelect label="학교" value={curSchool} options={schoolOpts} onChange={setSchool} T={T} />
            </div>
          </div>

          {searching ? (
            <div>
              <div style={{ margin: '0 2px 10px', fontSize: 13, color: T.textDim }}>
                <b style={{ fontSize: 15, color: T.text }}>{hits.length}명</b> 찾음
                <span style={{ marginLeft: 8, color: T.textFaint }}>과목·학년과 무관하게 전부 뒤집니다 · 이름을 누르면 상세</span>
              </div>
              {hits.length
                ? <RosterResults hits={hits} classOf={(id) => rows.classes.find((c) => c.c_id === id)} onPick={setPicked} T={T} PC={PC} dark={dark} />
                : <div style={{ padding: 40, textAlign: 'center', color: T.textDim, fontSize: 13.5 }}>"{find}" 로 찾은 학생이 없습니다.</div>}
            </div>
          ) : (<>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '0 2px 10px', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 15 }}>{total}명</b>
            <span style={{ fontSize: 12.5, color: T.textDim }}>
              반 {shown.length}개{seats !== total ? ' · 중복 수강 ' + (seats - total) + '건' : ''}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: T.textDim }}>
              {perTeacher.map(([t, n]) => t + 'T ' + n).join('  ·  ')}
            </span>
          </div>

          {/* 배율은 **명단에만** 건다 — 칩·드롭다운까지 커지면 고르기가 되레 불편해진다(사장님 지시). */}
          <div ref={bodyRef} style={{ zoom: zoom * RS_ZOOM_BASE }}>
          {groups.length ? groups.map((g) => (
            <div key={g.num} style={{ marginBottom: groups.length > 1 ? 26 : 14 }}>
              {/* 학년 '전체' 로 쭉 내려볼 때 지금 어느 학년인지 놓치지 않게 — 머리를 굵게 하고 위에 붙여 둔다.
                  배경을 깔아야 카드가 글자 뒤로 비쳐 보이지 않는다. */}
              <div style={{
                position: 'sticky', top: 0, zIndex: 2, background: T.bg,
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 2px 7px', marginBottom: 9,
                borderBottom: '2px solid ' + (dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)'),
              }}>
                <span style={{ flex: 'none', width: 4, height: 17, borderRadius: 2, background: PC }} />
                <b style={{ fontSize: 16, letterSpacing: '-0.3px' }}>{g.num}학년</b>
                <span style={{ fontSize: 13, color: T.textDim }}>{rsHeads(g.cols)}명 · {g.cols.length}반</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {g.cols.map((col) => <RosterColumn key={col.id} col={col} T={T} PC={PC} dark={dark} onPick={setPicked} />)}
              </div>
            </div>
          )) : <div style={{ padding: 40, textAlign: 'center', color: T.textDim, fontSize: 13.5 }}>조건에 맞는 반이 없습니다.</div>}
          </div>
          </>)}
        </div>
      ) : null}
    </div>
  );
}
