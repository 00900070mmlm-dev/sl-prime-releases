// 대시보드 — 강사별 수강생 수 추이(2026-10-30 사장님). 원장·관리자·개발자만 본다(권한 키 'dashboard').
//
// 숫자는 전부 ACA2000 동기화 원본(aca_raw_enroll · aca_raw_class · aca_raw_classinfo)에서 **여기서 계산**한다.
// 어느 날짜 D 의 수강생 = 그 날 수강 중인 등록(시작일 ≤ D, 종료일 없거나 ≥ D, 삭제 안 됨)을
// 그 반의 **그 날짜 담임**(GetClassInfo.teacherM 의 기간)에게 붙여 **사람 수로** 센다(두 반을 들으면 한 명).
// 담임이 둘인 반은 양쪽에 한 명씩. 관리용 반(휴원목록·전반처리 …)은 뺀다.
//
// **담임 미상을 두지 않는다**(2026-10-30 사장님 — "담임 미상은 없어야 한다"). ACA2000 의 담임 칸은 2024~2026년에
// 뒤늦게 등록된 반이 많고 그때 등록한 날이 그대로 '담임 시작일'로 들어가 있어서, 날짜 그대로만 보면 2024년 이전은
// 절반 넘게 담임이 비는다(실측). 그래서 그 날짜에 담임 기록이 없으면 **그 반의 가장 가까운 담임 기록**(뒤 → 앞) →
// 반 이름의 (xxT) → 담당(teacherS) 순으로 붙인다. 옛 숫자는 그만큼 추정치다 — 각주로 알린다.
//
// 그래프는 **강사 전원을 겹쳐 그린 채로 시작한다**(2026-11-16 사장님 — "상위 8명 이딴거 하지 말고 전체 다 눌러놓고
// 색도 각각 다 지정"). 범례 칩으로 끄고 켠다 — 켜져 있으면 −, 꺼져 있으면 +.
// 선 색은 **강사마다 하나씩**, 이름순 자리로 정해 필터를 바꿔도 같은 사람은 같은 색이다. 색상환을 황금각(137.5°)으로
// 돌며 뽑아 이웃한 순번끼리 멀리 떨어지고, 밝기를 세 단계로 번갈아 색상이 가까운 둘도 갈린다.
function dbColor(i, dark) {
  const h = Math.round((i * 137.508 + 212) % 360);
  const l = (dark ? [66, 56, 74] : [44, 56, 36])[i % 3];
  return 'hsl(' + h + ' ' + (dark ? 62 : 68) + '% ' + l + '%)';
}
const DB_UNITS = [{ k: 'w', label: '주별' }, { k: 'm', label: '월별' }, { k: 'q', label: '3개월' }, { k: 'h', label: '6개월' }, { k: 'y', label: '연별' }];

/** 로컬 날짜 → 'YYYY-MM-DD' (toISOString 은 UTC 라 한국 밤에 하루 전으로 간다) */
function dbYmd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dbDate(ymd) { const p = String(ymd || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
function dbMonthEnd(y, m0) { return new Date(y, m0 + 1, 0); }   // m0: 0~11

/** PostgREST 는 한 번에 1000행 — 다 받을 때까지 넘긴다. */
async function dbAll(table, select) {
  const out = []; let from = 0; const PAGE = 1000;
  for (;;) {
    const { data, error } = await SB.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/** 반 이름에 적힌 담임 — "(주연T)" 꼴만(lib/aca.js 의 nameTeacher 와 같은 규칙). */
function dbNameTeacher(cName) {
  const m = String(cName || '').match(/[(\[（]\s*([가-힣]{2,4})\s*T\s*[)\]）]/);
  return m ? m[1] : '';
}

/** 날짜 D 에 그 반의 담임들 — 그 날짜 담임 기록 → 가장 가까운 담임 기록(뒤 먼저, 없으면 앞) → 반 이름의 (xxT) → 그 날짜 담당(teacherS). */
// 이 날짜 전에는 담임을 붙이지 않는 반(2026-11-19 사장님 — "당시 담임은 지금 퇴사한 사람이어서 상관없어, 걍 빼").
// ACA2000 에 그때 담임 기록이 없어 가까운 기록(지금 담임)으로 추정되던 반이다. 그 전 학생은 어느 강사에게도 세지 않는다.
const DB_NO_TEACHER_BEFORE = { '(영)아라중2 S1반': '2026-10-12' };
function dbTeachersAt(tm, ts, cName, D) {
  const nb = DB_NO_TEACHER_BEFORE[String(cName || '').trim()];
  if (nb && D < nb) return [];
  const names = (a) => Array.from(new Set(a.map((t) => String(t.tName || '').trim()).filter(Boolean)));
  const at = (a) => (a || []).filter((t) => t && (t.startDate || '') <= D && (!t.endDate || t.endDate >= D));
  // 담임 기록이 겹치면 **가장 늦게 시작한 담임만** 본다(2026-11-19 사장님 — 반을 넘겨줬는데 ACA2000 에 옛 담임 기록이 안 닫혀 있어,
  // 넘겨받은 선생님 때 나간 학생이 옛 담임의 퇴원으로 잡혔다. 실측: 겹친 반은 전부 이런 경우였다). 아직 채용 전인 사람은 겹침에서 뺀다.
  let cur = at(tm).filter((t) => String(t.tName || '').trim());
  if (cur.length > 1) {
    const hired = cur.filter((t) => D >= dbHired(t.tName));
    if (hired.length) cur = hired;
    const mx = cur.reduce((m, t) => ((t.startDate || '') > m ? (t.startDate || '') : m), '');
    cur = cur.filter((t) => (t.startDate || '') === mx);
  }
  const hit = names(cur);
  if (hit.length) return hit;
  const later = (tm || []).filter((t) => t && (t.startDate || '') > D).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  if (later.length) return names([later[0]]);
  // 담임 기록이 **끝난 뒤**라면 반 이름의 (xxT) 를 먼저 믿는다(2026-11-20 사장님 — "5·6·7월 인원수가 말이 안 되게 많다").
  // 김현진 선생님의 중3 반 넷은 담임 기록이 2026-02-23 에 끝났고 반 이름은 (연정T)·(경화T) 인데, 끝난 기록으로 되돌아가 7월까지 김현진 선생님 인원(35명쯤)으로 잡혔다.
  const n = dbNameTeacher(cName); if (n) return [n];
  const before = (tm || []).filter((t) => t && t.endDate && t.endDate < D).sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
  if (before.length) return names([before[0]]);
  return names(at(ts));
}

// 채용일 — 이 날짜 전에는 그 강사의 수강생을 0 으로 둔다(사장님 2026-11-16, 학원강사 게시표 기준 · 박민주·김정석은 2026-11-09).
// ACA2000 담임 칸은 시작일이 엉터리인 기록이 많고(2011-12-13 로 박힌 것 등) 담임이 빈 옛 반은 가까운 기록으로 추정해 붙이므로,
// 그대로 두면 입사 전 기간에도 수강생이 잡힌다. 표에 없는 강사(퇴사자 등)는 건드리지 않는다. 강사가 새로 오면 여기 한 줄 더한다.
const DB_HIRED = {
  '김동영': '2022-02-17', '진성혁': '2022-08-01', '김하나': '2023-10-23', '표건수': '2024-08-19', '장욱진': '2024-08-19',
  '박승철': '2025-06-02', '김현진': '2025-07-14', '양은석': '2025-11-07', '이민욱': '2026-07-13', '김민규': '2026-07-13',
  '김민경': '2024-03-04', // 게시표의 2026-09-14 는 재계약일 — 그 전 기록을 살린다(2026-11-25 사장님). ACA 담임 기록 첫날.
  '오나라': '2026-09-14',
  '김재식': '2011-10-17', '한옥영': '2011-11-23', '이세은': '2023-08-23', '김지수': '2025-01-07', '이석찬': '2026-08-13',
  '이주연': '2026-08-13', '박성민': '2026-10-01',
  '박민주': '2026-11-09', '김정석': '2026-11-09',
};
/** 강사 이름 → 채용일('' = 모름). 반 이름에서 뽑은 이름은 성이 없어서(`(석찬T)` → 석찬) 끝이 맞는 한 사람을 찾는다. */
function dbHired(name) {
  const n = String(name || '').trim();
  if (DB_HIRED[n]) return DB_HIRED[n];
  if (n.length < 2) return '';
  const hit = Object.keys(DB_HIRED).filter((k) => k.length > n.length && k.endsWith(n));
  return hit.length === 1 ? DB_HIRED[hit[0]] : '';
}

// 지점 — 원당점 | 이음점 | 전체지점. 반 이름이 `이음(` 으로 시작하면 이음점(waBranchOf, 16-wtadmin.js). 고른 것은 이 PC 에 남는다.
const DB_BRANCHES = ['원당점', '이음점', '전체지점'];
function dbLoadBranch() { try { const v = localStorage.getItem('db_branch'); return v === '원당점' || v === '이음점' ? v : '전체지점'; } catch (e) { return '전체지점'; } }

// 구역 — 이음점 | 4층 | 5층(원당점을 층으로 가른다. 2026-11-18 사장님: "5층은 초등, 원당중1·2 / 4층은 그 외 나머지").
// 옛 반까지 가려야 해서 **반 이름**으로 본다(학생 학년은 해마다 올라가 과거를 못 가린다):
//   아라(아라중·아라고) → 4층 · 예비중1~3(=초6·중1·중2) → 5층 · 고1~3·예비고·중3 → 4층 · 초등(초·Beg·Inter·Adv·파닉스 …) → 5층 · 중1·중2 → 5층 · 나머지 → 4층
// `(영)중1 통합반` 처럼 이름에 학교가 없는 중1·2 반은, 지금 재원생이 있으면 그 학생들의 학교로 한 번 더 본다(원당중이 다수가 아니면 4층 — maj).
function dbZone(name, maj) {
  const n = String(name || '');
  if (/^\s*이음\(/.test(n)) return '이음점';
  if (/아라/.test(n)) return '4층';
  if (/예비\s*중\s*[123]/.test(n)) return '5층';
  if (/고\s*[123]|예비\s*고|고등|중등?\s*3/.test(n)) return '4층';
  if (/초|Beg|Inter|Adv|파닉스|Pho|Phanics|Starter|유치/i.test(n)) return '5층';
  if (/중등?\s*[12]/.test(n)) return maj && maj !== '원당중' ? '4층' : '5층';
  return '4층';
}

// 반의 과목 — 전반은 **같은 과목** 안에서만 본다(국어를 그만두고 같은 달 수학을 새로 들은 것은 전반이 아니다).
// 반 이름의 (영)(수)(국)(과) → 담당 과목(teacher_s 의 sjName) → 이름 속 과목 말 순서로 정한다. 모르면 ''.
function dbSubject(name, ts) {
  const n = String(name || '');
  const m = n.match(/\((영|수|국|과)(?:학)?\)/);
  if (m) return m[1];
  const sj = (Array.isArray(ts) ? ts : []).map((x) => String((x && x.sjName) || '')).filter(Boolean).pop() || '';
  const t = sj + ' ' + n;
  return /영어|Beg|Inter|Adv|파닉스|Pho/i.test(t) ? '영' : /수학|기하|미적|확통|확률|대수/.test(t) ? '수' : /국어|언매|화작/.test(t) ? '국' : /과학|물리|화학|생명|지구/.test(t) ? '과' : '';
}

// 방학 특강(써머·윈터) 반은 수강생 수·신입·퇴원 어디에도 세지 않는다(2026-11-20 사장님 — "현진쌤 특강 같이 잡힌 거 아닌가?").
// 7월의 써머 특강 둘(46명)이 김현진 선생님 인원에 들어가 90명까지 올라갔다. 방학 특강은 정규 반에 얹어 듣는 것이라 정규 수강생 수가 아니다.
// 이름에 특강이 있어도 방학 특강이 아닌 반(`고3 성혁T 2주특강` — 고3 반과 정시반 사이를 잇는 반, `(수) 기하 특강` …)은 그대로 센다.
const DB_SKIP_CLASS = /(써머|썸머|윈터|여름\s*방학|겨울\s*방학).*특강|특강.*(써머|썸머|윈터)/;
/** 날짜 D 에 수강 중인 사람들 — 전체 · 구역별 · (ok(구역) 을 통과한 반만) 강사별. 값은 s_id 의 Set. */
function dbSnapAt(raw, D, ok) {
  const by = {}; const byAll = {}; const sub = {}; const all = new Set(); const z = { '4층': new Set(), '5층': new Set(), '이음점': new Set() };
  for (const e of raw.enroll) {
    if (e.del_date) continue;
    if ((e.start_date || '') > D) continue;
    if (e.end_date && e.end_date < D) continue;
    const c = raw.clsBy[e.c_id];
    if (!c || RS_HIDDEN.test(c.c_name || '') || DB_SKIP_CLASS.test(c.c_name || '')) continue;
    const zone = raw.zoneBy[e.c_id];
    all.add(e.s_id); z[zone].add(e.s_id);
    const sj = raw.subjBy[e.c_id]; (sub[sj] = sub[sj] || new Set()).add(e.s_id);   // 과목별 — 강사가 누구든 그 과목을 듣는 사람
    const ts = dbTeachersAt(raw.tmBy[e.c_id], raw.tsBy[e.c_id], c.c_name, D);
    const pass = !ok || ok(zone);
    for (const t of ts) {
      if (D < dbHired(t)) continue;                                  // 채용일 전은 세지 않는다
      const k = t + '|' + raw.subjBy[e.c_id];                        // 강사|과목 — 지점·층을 안 거른 것. 전반(같은 과목의 다른 강사 반으로 옮김)을 가리는 데 쓴다
      (byAll[k] = byAll[k] || new Set()).add(e.s_id);
      if (pass) (by[t] = by[t] || new Set()).add(e.s_id);
    }
  }
  return { by, byAll, sub, all, z };
}
// 종강 퇴원 — 고3 종강처럼 반이 끝나서 나간 것은 퇴원으로 치지 않는다(2026-11-18 사장님).
// ACA2000 의 수강 종료 사유(GetStudentClassInfo.reason, kubun 3)에 `종강`·`종료` 가 적혀 있으면 종강이다(lib/aca.js 의 quitCourseEnd 와 같은 기준).
const DB_COURSE_END = /종강|종료/;
// 수능 뒤 고3 반은 사유를 안 적고 닫는다(2025-11 실측: 고3 반을 끝낸 20명 중 17명이 사유 없음). 그래서 **고3 반 · 사유 없음 · 종료일이 11~12월** 도 종강으로 본다.
// 사유가 적혀 있으면(성적부진·유학 …) 그대로 퇴원이다.
const DB_G3_CLASS = /고\s*3|정시|수능/;
// 정시반·특강에서 나간 것은 사유가 무엇이든 퇴원으로 치지 않는다(2026-11-19 사장님 — "정시반 이탈 없애, 고3 2주특강도").
// 정시반은 수시로 빠지는 고3 이 9~10월에 사유를 적고 나가고(독학·최저 맞출 필요 없음 …), 특강은 기간이 끝나면 닫힌다.
const DB_TERM_CLASS = /정시|특강/;
function dbIsCourseEnd(reason, cName, end) {
  const r = String(reason || '').trim();
  if (DB_COURSE_END.test(r)) return true;
  if (DB_TERM_CLASS.test(cName || '')) return true;
  return !r && DB_G3_CLASS.test(cName || '') && /^\d{4}-1[12]-/.test(end || '');
}
/** 두 시점(prevD → D) 사이 한 범위(강사·층·지점)의 드나듦.
 *  i 신입 · o 퇴원 · g 종강 · h 휴원 · r 복귀 · ti 전반으로 들어옴 · to 전반으로 나감.
 *  **복귀** = 전반이 아닌 들어온 학생 중, 앞 칸 마지막 날에 휴원목록 반에 있었거나 그 사이에 휴원목록 반을 끝낸 학생. 신입으로 치지 않는다(2026-11-19 사장님 — "휴원에서 돌아온 학생도 신입에서 빼").
 *  **휴원** = 전반이 아닌 나간 학생 중, 그 사이에 휴원목록 반(영어휴원목록 …)에 들어간 학생(raw.holdBy). 퇴원으로 치지 않고 따로 센다(2026-11-19 사장님).
 *  **전반** = 이 범위에서 나가면서 같은 사이에 다른 범위에 새로 들어간 학생(mv.join), 또는 그 반대(mv.left).
 *    (2026-11-18 사장님 — "자기 반에서 다른 강사 반으로 전반한 경우는 그래프에 넣지 말고 숫자로만". 예전엔 퇴원·신입으로 잡혔다.)
 *  **종강** = 전반이 아닌 나간 학생 중, 그 사이에 끝낸 수강(classOk 로 이 범위의 반만)이 전부 종강인 학생. 하나라도 다른 사유면 퇴원. */
function dbFlow(prev, cur, raw, prevD, D, classOk, mv) {
  const a = prev || new Set(), b = cur || new Set(); let i = 0, o = 0, g = 0, h = 0, r = 0, ti = 0, to = 0;
  const back = (x) => (raw.holdBy[x] || []).some((d) => d.s <= D && (d.s <= prevD ? (!d.e || d.e >= prevD) : !!d.e) && (!d.e || d.e <= D));
  const who = { i: [], o: [], g: [], h: [], r: [], ti: [], to: [] };   // 누가 잡혔는지(명단 창 — DbWhoDialog)
  b.forEach((x) => { if (a.has(x)) return; if (mv && mv.left(x)) { ti++; who.ti.push(x); } else if (back(x)) { r++; who.r.push(x); } else { i++; who.i.push(x); } });
  a.forEach((x) => {
    if (b.has(x)) return;
    if (mv && mv.join(x)) { to++; who.to.push(x); return; }
    if ((raw.holdBy[x] || []).some((d) => d.s > prevD && d.s <= D)) { h++; who.h.push(x); return; }
    const ends = (raw.endsBy[x] || []).filter((d) => d.end >= prevD && d.end < D && (!classOk || classOk(d.c, d.end)));
    if (ends.length && ends.every((d) => d.ce)) { g++; who.g.push(x); } else { o++; who.o.push(x); }
  });
  return { i, o, g, h, r, ti, to, who, prevD, D };
}
// 층·지점의 전반 — 다른 구역에 새로 들어갔는가 / 다른 구역에서 나왔는가
function dbMoveZone(pv, sn, zone) {
  const oth = Object.keys(sn.z).filter((k) => k !== zone);
  return { join: (x) => oth.some((k) => sn.z[k].has(x) && !pv.z[k].has(x)), left: (x) => oth.some((k) => pv.z[k].has(x) && !sn.z[k].has(x)) };
}
// 강사의 전반 — **그 과목을 학원에서 계속 듣고 있었는가**로 본다. 키는 `강사|과목`(dbSnapAt 의 byAll), 과목별 명단은 sub.
//   들어온 학생이 앞 칸에도 그 과목을 듣고 있었으면(강사가 누구였든) 신입이 아니라 전반 — 반 이동 · 담임 교체 · 새 강사가 반을 넘겨받은 것(2026-11-18 사장님: "강사 변경도 신입생으로 치면 안 돼").
//   나간 학생이 이 칸에도 그 과목을 듣고 있으면 퇴원이 아니라 전반.
function dbMoveTeacher(pv, sn, t) {
  const mine = (o, x) => Object.keys(o).filter((k) => k.split('|')[0] === t && o[k].has(x)).map((k) => k.split('|')[1]);
  const inSub = (snap, s, x) => !!(snap.sub[s] && snap.sub[s].has(x));
  return {
    join: (x) => mine(pv.byAll, x).some((s) => inSub(sn, s, x)),
    left: (x) => mine(sn.byAll, x).some((s) => inSub(pv, s, x)),
  };
}

/** 단위별 기간 끝 날짜들. 오늘을 넘는 마지막 칸은 오늘로 당기고 partial 표시. */
function dbPeriods(unit, from, to, today) {
  const out = [];
  const push = (label, end, startYmd) => {
    let D = dbYmd(end); let partial = false;
    if (D < from || startYmd > to) return;
    if (D > today) { if (startYmd > today) return; D = today; partial = true; }
    else if (D > to) { D = to; partial = true; }
    out.push({ label, D, partial, start: startYmd });
  };
  const f = dbDate(from), t = dbDate(to);
  if (unit === 'w') {
    // 주 = 월요일~일요일. from 이 든 주의 일요일부터.
    const d = new Date(f); d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    for (;; d.setDate(d.getDate() + 7)) {
      const s = new Date(d); s.setDate(s.getDate() - 6);
      if (dbYmd(s) > to) break;                            // 주 시작이 기간을 넘으면 끝(진행 중인 주는 push 가 오늘로 당긴다)
      push((d.getFullYear() % 100) + '.' + (d.getMonth() + 1) + '.' + d.getDate(), new Date(d), dbYmd(s));
    }
  } else {
    const step = unit === 'm' ? 1 : unit === 'q' ? 3 : unit === 'h' ? 6 : 12;
    let y = f.getFullYear(), m0 = unit === 'm' ? f.getMonth() : Math.floor(f.getMonth() / step) * step;
    for (;;) {
      const end = dbMonthEnd(y, m0 + step - 1);
      if (new Date(y, m0, 1) > t) break;
      const label = unit === 'm' ? (y % 100) + '.' + String(m0 + 1).padStart(2, '0')
        : unit === 'q' ? y + ' ' + (m0 / 3 + 1) + '분기'
        : unit === 'h' ? y + ' ' + (m0 ? '하반기' : '상반기')
        : String(y);
      push(label, end, dbYmd(new Date(y, m0, 1)));
      m0 += step; if (m0 >= 12) { m0 -= 12; y++; }
    }
  }
  return out;
}

function dbKo(a, b) { return String(a).localeCompare(String(b), 'ko'); }

// 가로축에 적을 칸 고르기 — 글자 폭을 어림해 서로 안 겹치는 간격으로만 적는다(마지막 칸은 늘 적는다).
// 예전엔 60px 마다 하나로 잡아, 주별(`26.11.15`)·분기(`2026 3분기`)처럼 긴 글자가 좁은 카드에서 겹쳤다(2026-11-19 사장님).
// 양 끝은 안쪽으로 붙여 쓰고(start·end) 가운데는 가운데 정렬이라, 이웃과의 거리는 글자 폭의 1.5배가 있어야 한다.
function dbXTicks(labels, plotW, fontSize) {
  const n = labels.length; const show = new Set(); if (!n) return show;
  const wOf = (t) => Array.from(String(t)).reduce((a, ch) => a + (/[가-힣]/.test(ch) ? 1 : 0.6), 0) * fontSize;
  const need = (Math.max(...labels.map(wOf)) + fontSize * 0.6) * 1.5;   // 마지막 칸의 `*` 한 글자 몫 포함
  const step = n > 1 ? plotW / (n - 1) : plotW;
  const every = Math.max(1, Math.ceil(need / Math.max(1, step)));
  for (let i = 0; i < n - 1; i += every) if ((n - 1 - i) * step >= need) show.add(i);
  show.add(n - 1);
  return show;
}

// ── 선 그래프(SVG) — 교차선 + 툴팁 ──
function DbLineChart({ labels, series, partialLast, yMax, height, T, dark, compact }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(600);
  const [hi, setHi] = useState(-1);
  const clipId = useRef('dbclip' + Math.random().toString(36).slice(2, 8)).current;
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600));
    ro.observe(el); setW(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);
  const H = height || 320;
  const padL = compact ? 28 : 40, padR = 12, padT = 12, padB = compact ? 20 : 28;
  const n = labels.length;
  const x = (i) => padL + (n <= 1 ? 0 : (w - padL - padR) * i / (n - 1));
  const yy = (v) => padT + (H - padT - padB) * (1 - v / (yMax || 1));
  const ticks = []; { const step = compact ? (yMax <= 20 ? 5 : yMax <= 60 ? 10 : yMax <= 150 ? 30 : yMax <= 300 ? 50 : 100) : (yMax <= 20 ? 5 : yMax <= 150 ? 10 : yMax <= 300 ? 25 : 50); for (let v = 0; v <= yMax; v += step) ticks.push(v); }
  // x 눈금은 글자가 안 겹칠 만큼만
  const xShow = dbXTicks(labels, w - padL - padR, compact ? 10 : 11);
  const K = TT(dark);
  const grid = K.rule;
  const axis = K.muted;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect(); const px = e.clientX - r.left;
    let best = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } }
    setHi(best);
  };
  const tipLeft = hi >= 0 ? Math.min(Math.max(x(hi) + 12, 0), w - 180) : 0;
  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg width={w} height={H} style={{ display: 'block', overflow: 'visible' }} onMouseMove={onMove} onMouseLeave={() => setHi(-1)}>
        <defs><clipPath id={clipId}><rect x={padL - 4} y={padT - 4} width={w - padL - padR + 8} height={H - padT - padB + 8} /></clipPath></defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={w - padR} y1={yy(v)} y2={yy(v)} stroke={grid} strokeWidth="1" />
            <text x={padL - 6} y={yy(v) + 4} textAnchor="end" fontSize={compact ? 10 : 11} fill={axis}>{v}</text>
          </g>
        ))}
        {labels.map((l, i) => xShow.has(i) ? (
          <text key={i} x={x(i)} y={H - padB + 16} textAnchor={i === n - 1 && n > 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize={compact ? 10 : 11} fill={axis}>{l}{partialLast && i === n - 1 ? '*' : ''}</text>
        ) : null)}
        {hi >= 0 ? <line x1={x(hi)} x2={x(hi)} y1={padT} y2={H - padB} stroke={K.control} strokeWidth="1" strokeDasharray="3 3" /> : null}
        <g clipPath={'url(#' + clipId + ')'}>
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : [x(i), yy(v)]));
          let d = ''; pts.forEach((p, i) => { if (!p) return; d += (i === 0 || !pts[i - 1] ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' '; });
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {hi >= 0 && pts[hi] ? <circle cx={pts[hi][0]} cy={pts[hi][1]} r="4" fill={s.color} stroke={K.surface} strokeWidth="2" /> : null}
            </g>
          );
        })}
        </g>
      </svg>
      {hi >= 0 && !compact ? (
        <div style={{ position: 'absolute', left: tipLeft, top: padT, pointerEvents: 'none', background: K.surface,
          border: '1px solid ' + K.border, borderRadius: K.rCtl, padding: '8px 11px', fontSize: 12, lineHeight: 1.6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 150, color: K.text }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{labels[hi]}{partialLast && hi === n - 1 ? ' (진행 중)' : ''}</div>
          {series.slice().sort((a, b) => (b.values[hi] || 0) - (a.values[hi] || 0)).map((s) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 2, borderRadius: 1, background: s.color, flexShrink: 0 }} />
              <span style={{ color: K.muted, flex: 1 }}>{s.name}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.values[hi] == null ? '—' : s.values[hi]}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── 신입 · 퇴원 그래프 — LUCY 사용량 그래프와 같은 모양(그라데이션 영역 · 점선 격자 · 툴팁 카드) ──
// flows: [{ i, o }] (칸마다 신입·퇴원 수)
/** 신입·퇴원 명단 창 — 그 범위(강사·층·지점)에서 칸마다 누가 어느 쪽으로 잡혔는지. 이름 · 그때 듣던(듣게 된) 반 · 퇴원 사유. */
function DbWhoDialog({ scope, labels, raw, dark, onClose }) {
  const K = TT(dark);
  useEffect(() => { const f = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, []);
  const KINDS = [['i', '신입', K.hue], ['o', '퇴원', K.neg], ['h', '휴원', dbHoldColor(dark)], ['r', '복귀', K.text], ['g', '종강', K.text], ['ti', '전반 들어옴', K.text], ['to', '전반 나감', K.text]];
  const cname = (c) => String((raw.clsBy[c] || {}).c_name || '');
  // 그 날짜에 이 범위에서 듣던 반들
  const classesAt = (x, day) => Array.from(new Set((raw.enBy[x] || []).filter((e) => (e.start_date || '') <= day && (!e.end_date || e.end_date >= day) && !RS_HIDDEN.test(cname(e.c_id)) && !DB_SKIP_CLASS.test(cname(e.c_id)) && (!scope.classOk || scope.classOk(e.c_id, day))).map((e) => cname(e.c_id))));
  const whyOf = (x, f) => Array.from(new Set((raw.endsBy[x] || []).filter((d) => d.end >= f.prevD && d.end <= f.D && d.why && (!scope.classOk || scope.classOk(d.c, d.end))).map((d) => d.why))).join(' / ');
  const rows = (scope.flows || []).map((f, idx) => ({ f, label: labels[idx] })).filter((o) => o.f && o.f.who && KINDS.some((k) => o.f.who[k[0]].length));
  const nm = (x) => raw.nameBy[x] || '(이름 없음)';
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 720, maxWidth: '100%', maxHeight: '84vh', display: 'flex', flexDirection: 'column', background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard, color: K.text }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid ' + K.border }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{scope.name}</span><span style={{ marginLeft: 8, fontSize: 13, color: K.muted }}>신입 · 퇴원 명단</span>
          <button onClick={onClose} aria-label="닫기" style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: K.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, width: 28, height: 28, borderRadius: K.rCtl }}>×</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 20px 18px' }}>
          {!rows.length ? <div style={{ padding: '28px 0', textAlign: 'center', color: K.muted, fontSize: 13 }}>이 기간에 드나든 학생이 없습니다.</div> : rows.map((o) => (
            <div key={o.label} style={{ padding: '14px 0', borderTop: '1px solid ' + K.rule }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>{o.label}<span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: K.muted }}>{o.f.prevD} 다음 날 ~ {o.f.D}</span></div>
              {KINDS.filter((k) => o.f.who[k[0]].length).map((k) => {
                const before = k[0] === 'o' || k[0] === 'g' || k[0] === 'h' || k[0] === 'to';   // 나간 쪽은 앞 칸 끝의 반, 들어온 쪽은 이 칸 끝의 반
                return (
                  <div key={k[0]} style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 13 }}>
                    <div style={{ flex: 'none', width: 92, fontWeight: 600, color: k[2] }}>{k[1]} <span style={{ fontVariantNumeric: 'tabular-nums' }}>{o.f.who[k[0]].length}</span></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {o.f.who[k[0]].slice().sort((a, b) => dbKo(nm(a), nm(b))).map((x) => {
                        const cs = classesAt(x, before ? o.f.prevD : o.f.D).join(', '), why = k[0] === 'o' || k[0] === 'g' ? whyOf(x, o.f) : '';
                        return (
                          <div key={x} style={{ display: 'flex', gap: 10, lineHeight: '22px' }}>
                            <span style={{ flex: 'none', width: 76, fontWeight: 500 }}>{nm(x)}</span>
                            <span style={{ flex: 1, minWidth: 0, color: K.muted, fontSize: 12.5, wordBreak: 'keep-all' }}>{cs}{why ? (cs ? ' — ' : '') + why : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// 휴원 선 색 — 노랑(2026-11-19 사장님). 신입 파랑 · 퇴원 빨강과 같은 굵기의 선 하나.
function dbHoldColor(dark) { return dark ? '#f0c23c' : '#d9a300'; }
function DbFlowChart({ labels, flows, partialLast, height, dark, compact }) {
  const K = TT(dark);
  const wrap = useRef(null);
  const [w, setW] = useState(480);
  const [hi, setHi] = useState(-1);
  const gid = useRef('dbfl' + Math.random().toString(36).slice(2, 8)).current;
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)));
    ro.observe(el); setW(Math.max(200, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const H = height || 220, L = compact ? 26 : 36, R = 10, T = 10, B = compact ? 20 : 26;
  const n = flows.length;
  const max = lucyNice(Math.max(0, ...flows.map((f) => Math.max(f.i, f.o, f.h || 0))));
  const x = (i) => L + (n <= 1 ? 0 : i * (w - L - R) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const curve = (k) => {
    let d = '';
    flows.forEach((f, i) => {
      if (!i) { d = 'M' + x(0).toFixed(1) + ' ' + y(f[k] || 0).toFixed(1); return; }
      const x0 = x(i - 1), y0 = y(flows[i - 1][k] || 0), x1 = x(i), y1 = y(f[k] || 0), dx = (x1 - x0) / 2;
      d += ' C' + (x0 + dx).toFixed(1) + ' ' + y0.toFixed(1) + ' ' + (x1 - dx).toFixed(1) + ' ' + y1.toFixed(1) + ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
    });
    return d;
  };
  const HOLD = dbHoldColor(dark);
  const SER = [{ k: 'h', name: '휴원', color: HOLD }, { k: 'o', name: '퇴원', color: K.neg }, { k: 'i', name: '신입', color: K.hue }];   // 신입을 나중에(위에) 그린다
  const xShow = dbXTicks(labels, w - L - R, compact ? 10 : 11);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - r.left - L) / ((w - L - R) / Math.max(1, n - 1)));
    setHi(Math.max(0, Math.min(n - 1, i)));
  };
  const f = hi >= 0 ? flows[hi] : null;
  const net = f ? f.i + (f.r || 0) + (f.ti || 0) - f.o - (f.g || 0) - (f.h || 0) - (f.to || 0) : 0;
  const tipLeft = f ? Math.min(Math.max(x(hi) + 12, 0), Math.max(0, w - 150)) : 0;
  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%', height: H }}>
      <svg width={w} height={H} style={{ display: 'block', overflow: 'visible' }} onMouseMove={onMove} onMouseLeave={() => setHi(-1)} role="img" aria-label="신입 · 퇴원 추이">
        <defs>
          {SER.map((s) => (
            <linearGradient key={s.k} id={gid + s.k} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="95%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
        {(compact || max % 4 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(max * t)} y2={y(max * t)} stroke={t === 0 ? K.control : K.border} strokeDasharray={t === 0 ? undefined : '3 3'} />
            <text x={L - 6} y={y(max * t) + 4} textAnchor="end" fontSize={compact ? 10 : 11} fill={K.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(max * t)}</text>
          </g>
        ))}
        {labels.map((l, i) => xShow.has(i) ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === n - 1 && n > 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize={compact ? 10 : 11} fill={K.muted}>{l}{partialLast && i === n - 1 ? '*' : ''}</text>
        ) : null)}
        {n > 0 ? SER.map((s) => {
          const d = curve(s.k);
          return (
            <g key={s.k}>
              <path d={d + ' L' + x(n - 1).toFixed(1) + ' ' + y(0) + ' L' + x(0).toFixed(1) + ' ' + y(0) + ' Z'} fill={'url(#' + gid + s.k + ')'} />
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        }) : null}
        {f ? <line x1={x(hi)} x2={x(hi)} y1={T} y2={y(0)} stroke={K.control} strokeDasharray="4 3" /> : null}
        {f ? SER.map((s) => <circle key={s.k} cx={x(hi)} cy={y(f[s.k] || 0)} r="4" fill={s.color} stroke={K.surface} strokeWidth="2" />) : null}
        <rect x={L} y={T} width={Math.max(0, w - L - R)} height={H - T - B} fill="transparent" />
      </svg>
      {f ? (
        <div style={{ position: 'absolute', left: tipLeft, top: 4, pointerEvents: 'none', minWidth: 132, padding: '8px 10px', background: K.surface, border: '1px solid ' + K.border,
          borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.10)', fontSize: 12, color: K.text, zIndex: 3 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{labels[hi]}{partialLast && hi === n - 1 ? ' (진행 중)' : ''}</div>
          {[['신입', f.i, K.hue], ['퇴원', f.o, K.neg], ['휴원', f.h || 0, HOLD]].concat(f.r ? [['복귀', f.r + '명', K.grey]] : [], f.g ? [['종강', f.g + '명', K.grey]] : [], f.ti || f.to ? [['전반', '+' + (f.ti || 0) + ' −' + (f.to || 0), K.grey]] : []).map((r) => (
            <div key={r[0]} style={{ display: 'flex', alignItems: 'center', gap: 6, color: K.muted, lineHeight: '20px' }}>
              <i style={{ width: 9, height: 9, borderRadius: 2, flex: 'none', background: r[2] }} /><span style={{ flex: 1 }}>{r[0]}</span><b style={{ color: K.text, fontVariantNumeric: 'tabular-nums' }}>{typeof r[1] === 'number' ? r[1] + '명' : r[1]}</b>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, color: K.muted, lineHeight: '20px', borderTop: '1px solid ' + K.rule, marginTop: 4, paddingTop: 4 }}>
            <span style={{ flex: 1 }}>증감</span><b style={{ color: K.text, fontVariantNumeric: 'tabular-nums' }}>{net > 0 ? '+' : ''}{net}명</b>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DashboardApp({ dark, onHome }) {
  const T = THEME(dark);
  const K = TT(dark);   // taste 디자인 — 크롬은 먹/회색, 파랑(hue)은 주 시리즈 선에만
  const today = dbYmd(new Date());
  const [raw, setRaw] = useState(null);
  const [err, setErr] = useState('');
  const [sync, setSync] = useState(null);
  const [unit, setUnit] = useState('m');
  const [from, setFrom] = useState('2026-05-01');   // 기본 조회 기간 — 2026년 5월부터(2026-11-18 사장님). 더 앞은 날짜 칸·`2022년부터` 로 본다
  const [to, setTo] = useState(today);
  const [onlyCurrent, setOnlyCurrent] = useState(true);   // 현재 수업 있는 강사만(퇴사 제외)
  const [picked, setPicked] = useState(null);             // 겹쳐 그릴 강사들(null = 아직 안 건드림 → 전원)
  const [branch, setBranchRaw] = useState(dbLoadBranch);
  const setBranch = (b) => { setBranchRaw(b); setPicked(null); try { localStorage.setItem('db_branch', b); } catch (e) {} };
  const [floor, setFloorRaw] = useState('');               // 원당점 안에서 — '' | '4층' | '5층'
  const setFloor = (f) => { setFloorRaw(f); setPicked(null); };
  const zoneOk = branch === '전체지점' ? null : branch === '이음점' ? ((z) => z === '이음점') : ((z) => z !== '이음점' && (!floor || z === floor));
  const scopeKey = branch + '|' + (branch === '원당점' ? floor : '');

  useEffect(() => {
    Promise.all([
      dbAll('aca_raw_enroll', 's_id,c_id,start_date,end_date,del_date'),
      dbAll('aca_raw_class', 'c_id,c_name'),
      dbAll('aca_raw_classinfo', 'c_id,teacher_m,teacher_s'),
      SB.from('aca_sync').select('started_at,ok').order('started_at', { ascending: false }).limit(1),
      dbAll('aca_student', 's_id,school,state,class_ids'),
      dbAll('aca_raw_studentclass', 's_id,data').catch(() => []),   // 퇴원 사유(종강 가리기) — 못 읽으면 전부 퇴원으로 센다
      dbAll('aca_raw_student', 's_id,s_name').catch(() => []),       // 이름(명단 창) — 퇴원한 학생은 aca_student 에 없다
    ]).then(([enroll, cls, info, y, stu, sc, names]) => {
      const nameBy = {}; (names || []).forEach((x) => { nameBy[x.s_id] = x.s_name || ''; });
      const enBy = {}; enroll.forEach((e) => { if (!e.del_date) (enBy[e.s_id] = enBy[e.s_id] || []).push(e); });
      const clsBy = {}; cls.forEach((c) => { clsBy[c.c_id] = c; });
      const tmBy = {}, tsBy = {};
      info.forEach((i) => { tmBy[i.c_id] = Array.isArray(i.teacher_m) ? i.teacher_m : []; tsBy[i.c_id] = Array.isArray(i.teacher_s) ? i.teacher_s : []; });
      // 반마다 지금 재원생의 다수 학교 — 이름에 학교가 없는 중1·2 반의 층을 가르는 데만 쓴다(dbZone)
      const sch = {};
      (stu || []).forEach((x) => { if (x.state !== '재원') return; (x.class_ids || []).forEach((id) => { const m = (sch[id] = sch[id] || {}); const k = x.school || ''; m[k] = (m[k] || 0) + 1; }); });
      const zoneBy = {};
      cls.forEach((c) => { const m = sch[c.c_id]; const maj = m ? Object.keys(m).sort((a, b) => m[b] - m[a])[0] : ''; zoneBy[c.c_id] = dbZone(c.c_name, maj); });
      // 학생마다 끝난 수강(kubun 3 · 삭제 아님 · 관리용 반 아님) — { c 반, end 종료일, ce 종강 사유인가 }
      const endsBy = {};
      (sc || []).forEach((x) => { (Array.isArray(x.data) ? x.data : []).forEach((d) => {
        if (Number(d.kubun) !== 3 || d.delDate || !d.endDate) return;
        const c = clsBy[d.cId]; if (!c || RS_HIDDEN.test(c.c_name || '')) return;
        (endsBy[x.s_id] = endsBy[x.s_id] || []).push({ c: d.cId, end: d.endDate, ce: dbIsCourseEnd(d.reason, c.c_name, d.endDate), why: String(d.reason || '').replace(/\s+/g, ' ').trim() });
      }); });
      // 학생마다 휴원목록 반에 들어간 날들 — 그 사이에 나간 학생이 휴원인지 가린다(dbFlow)
      const holdBy = {};
      enroll.forEach((e) => { if (e.del_date || !e.start_date) return; const c = clsBy[e.c_id]; if (!c || !/휴원목록/.test(c.c_name || '')) return; (holdBy[e.s_id] = holdBy[e.s_id] || []).push({ s: e.start_date, e: e.end_date || '' }); });
      const subjBy = {}; cls.forEach((c) => { subjBy[c.c_id] = dbSubject(c.c_name, tsBy[c.c_id]); });
      setRaw({ enroll, clsBy, tmBy, tsBy, zoneBy, endsBy, subjBy, holdBy, nameBy, enBy });
      setSync(((y && y.data) || [])[0] || null);
    }).catch((e) => setErr(String((e && e.message) || e)));
  }, []);

  // 오늘 기준 — '현재 수업이 있는 강사' 판정
  const sizes = (snap) => { const o = {}; Object.keys(snap.by).forEach((t) => { o[t] = snap.by[t].size; }); return { by: o }; };
  const nowBy = React.useMemo(() => (raw ? sizes(dbSnapAt(raw, today, zoneOk)).by : {}), [raw, scopeKey]);
  const periods = React.useMemo(() => dbPeriods(unit, from, to, today), [unit, from, to]);
  // 칸마다의 스냅샷 + 첫 칸 바로 앞 날(신입·퇴원은 앞 칸과 견줘서 센다)
  const snaps = React.useMemo(() => {
    if (!raw || !periods.length) return { prev: null, prevD: '', list: [] };
    const d0 = dbDate(periods[0].start); d0.setDate(d0.getDate() - 1);
    return { prev: dbSnapAt(raw, dbYmd(d0), zoneOk), prevD: dbYmd(d0), list: periods.map((p) => dbSnapAt(raw, p.D, zoneOk)) };
  }, [raw, periods, scopeKey]);
  const counts = React.useMemo(() => snaps.list.map(sizes), [snaps]);
  // 신입·퇴원 — pick(스냅샷) 이 그 범위의 사람들(Set)을 돌려준다
  // classOk(반, 종료일) — 종강인지 볼 때 그 범위의 반만 본다
  // others(앞 스냅샷, 이 스냅샷) — 전반을 가리는 판정(dbMoveZone·dbMoveTeacher)
  const flowOf = (pick, classOk, others) => snaps.list.map((sn, i) => { const pv = i ? snaps.list[i - 1] : snaps.prev;
    return dbFlow(pick(pv), pick(sn), raw, i ? periods[i - 1].D : snaps.prevD, periods[i].D, classOk, others ? others(pv, sn) : null); });
  const zoneIs = (z) => (c) => raw.zoneBy[c] === z;
  const flowScopes = React.useMemo(() => [
    { name: '전지점', flows: flowOf((sn) => sn.all, null), classOk: null },
    { name: '원당점 4층', flows: flowOf((sn) => sn.z['4층'], zoneIs('4층'), (pv, sn) => dbMoveZone(pv, sn, '4층')), classOk: zoneIs('4층') },
    { name: '원당점 5층', flows: flowOf((sn) => sn.z['5층'], zoneIs('5층'), (pv, sn) => dbMoveZone(pv, sn, '5층')), classOk: zoneIs('5층') },
    { name: '이음점', flows: flowOf((sn) => sn.z['이음점'], zoneIs('이음점'), (pv, sn) => dbMoveZone(pv, sn, '이음점')), classOk: zoneIs('이음점') },
  ], [snaps]);
  const teacherOk = (t) => (c, end) => (!zoneOk || zoneOk(raw.zoneBy[c])) && dbTeachersAt(raw.tmBy[c], raw.tsBy[c], (raw.clsBy[c] || {}).c_name, end).indexOf(t) >= 0;
  const flowTeacher = React.useMemo(() => { const m = {}; const ts = new Set(); snaps.list.forEach((sn) => Object.keys(sn.by).forEach((t) => ts.add(t)));
    ts.forEach((t) => { m[t] = flowOf((sn) => sn.by[t], teacherOk(t), (pv, sn) => dbMoveTeacher(pv, sn, t)); }); return m; }, [snaps]);
  const [who, setWho] = useState(null);   // 명단 창 — { name, flows, classOk }
  const flowSum = (fl) => (fl || []).reduce((a, f) => ({ i: a.i + f.i, o: a.o + f.o, g: a.g + f.g, h: a.h + (f.h || 0), r: a.r + (f.r || 0), ti: a.ti + f.ti, to: a.to + f.to }), { i: 0, o: 0, g: 0, h: 0, r: 0, ti: 0, to: 0 });
  const flowHead = (fl) => { const t = flowSum(fl); const net = t.i + t.r + t.ti - t.o - t.g - t.h - t.to; return (
    <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 12, color: K.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <span>신입 <b style={{ color: K.hue, fontWeight: 600 }}>{t.i}</b></span><span>퇴원 <b style={{ color: K.neg, fontWeight: 600 }}>{t.o}</b></span><span>휴원 <b style={{ color: dbHoldColor(dark), fontWeight: 600 }}>{t.h}</b></span>{t.r ? <span>복귀 <b style={{ color: K.text, fontWeight: 600 }}>{t.r}</b></span> : null}{t.g ? <span>종강 <b style={{ color: K.text, fontWeight: 600 }}>{t.g}</b></span> : null}{t.ti || t.to ? <span>전반 <b style={{ color: K.text, fontWeight: 600 }}>+{t.ti} −{t.to}</b></span> : null}<span>증감 <b style={{ color: K.text, fontWeight: 600 }}>{net > 0 ? '+' : ''}{net}</b></span>
    </span>); };

  const everyone = React.useMemo(() => {
    const s = new Set(); counts.forEach((c) => Object.keys(c.by).forEach((t) => s.add(t))); Object.keys(nowBy).forEach((t) => s.add(t));
    return Array.from(s);
  }, [counts, nowBy]);
  const last = counts.length ? counts[counts.length - 1].by : {};
  const teachers = everyone
    .filter((t) => !onlyCurrent || (nowBy[t] || 0) > 0)
    .sort((a, b) => (last[b] || 0) - (last[a] || 0) || (nowBy[b] || 0) - (nowBy[a] || 0) || dbKo(a, b));
  const shown = (picked ? teachers.filter((t) => picked.has(t)) : teachers);
  // 색은 강사마다 하나 — 이름순 자리로 정한다(필터·기간을 바꿔도 같은 사람은 같은 색)
  const colorOf = React.useMemo(() => {
    const m = {};
    everyone.slice().sort(dbKo).forEach((t, i) => { m[t] = dbColor(i, dark); });
    return m;
  }, [everyone.join('|'), dark]);
  const smallColor = (t) => colorOf[t] || K.grey;
  const togglePick = (t) => {
    const s = new Set(picked || shown);
    if (s.has(t)) s.delete(t); else s.add(t);
    setPicked(s);
  };
  const labels = periods.map((p) => p.label);
  const partialLast = periods.length > 0 && periods[periods.length - 1].partial;
  const valuesOf = (t) => counts.map((c) => c.by[t] || 0);
  // y 축은 **강사 선만** 보고 잡는다. 기본 최대 90 · 큰 그래프는 10명마다 가로줄(2026-11-20 사장님 — "세로줄 90명으로, 좀 더 촘촘하게". 예전엔 150 · 25명 단위).
  // 강사 하나가 90 을 넘으면 그만큼만 올린다.
  const niceMax = (v) => { const step = v <= 150 ? 10 : v <= 300 ? 25 : 50; return Math.ceil(v / step) * step; };
  const yMaxAll = Math.max(90, niceMax(Math.max(0, ...teachers.map((t) => Math.max(0, ...valuesOf(t))))));
  // 나중에 그린 선이 위로 온다 — 수강생이 많은 강사가 맨 위에 오게 뒤집는다
  const series = shown.map((t) => ({ name: t, color: colorOf[t], values: valuesOf(t) })).reverse();

  const stale = !sync || !sync.ok || (Date.now() - new Date(sync.started_at).getTime()) / 3600000 > 25;
  const syncText = sync ? new Date(sync.started_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + (sync.ok ? '' : ' · 실패') : '기록 없음';
  const preset = (k) => {
    const d = new Date();
    if (k === '1y') d.setFullYear(d.getFullYear() - 1); else if (k === '2y') d.setFullYear(d.getFullYear() - 2); else if (k === '6m') d.setMonth(d.getMonth() - 6);
    setFrom(k === '2022' ? '2022-01-01' : dbYmd(d)); setTo(today);
  };
  const card = { background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard, padding: '16px 20px' };
  // 단위 = 회색 바탕 세그먼트(선택 칸만 흰 surface)
  const seg = (on) => ({ height: 28, padding: '0 12px', borderRadius: 4, fontSize: 13, fontWeight: on ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit',
    border: 'none', background: on ? K.surface : 'transparent', color: on ? K.text : K.muted, transition: K.ease });
  const ghost = { height: 32, padding: '0 12px', borderRadius: K.rCtl, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + K.control, background: 'transparent', color: K.text, transition: K.ease };
  const inputS = { font: 'inherit', fontSize: 13, height: 32, boxSizing: 'border-box', padding: '0 8px', borderRadius: K.rCtl, border: '1px solid ' + K.control, background: K.surface, color: K.text, colorScheme: dark ? 'dark' : 'light' };

  return (
    <div style={{ minHeight: '100vh', background: K.ground, color: K.text, fontFamily: TT_FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid ' + K.border }}>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>대시보드</div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: stale ? K.neg : K.muted }}>{stale ? '⚠ ' : ''}동기화 {syncText}</span>
      </div>

      {err ? <div style={{ padding: 24, color: K.neg, fontSize: 13.5 }}>불러오지 못했습니다 — {err}</div> : null}
      {!raw && !err ? <SlLoading /> : null}

      {raw ? (
        <div style={{ padding: '16px 24px 60px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>강사별 수강생 수</div>

          {/* 필터는 한 줄 — 단위 · 기간 · 강사 범위 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ display: 'inline-flex', background: K.raised, borderRadius: K.rCtl, padding: 2 }}>
              {DB_BRANCHES.map((b) => <button key={b} onClick={() => setBranch(b)} aria-pressed={branch === b} style={seg(branch === b)}>{b}</button>)}
            </span>
            {branch === '원당점' ? (
              <span style={{ display: 'inline-flex', background: K.raised, borderRadius: K.rCtl, padding: 2 }}>
                {[['', '전체'], ['4층', '4층'], ['5층', '5층']].map(([v, l]) => <button key={l} onClick={() => setFloor(v)} aria-pressed={floor === v} style={seg(floor === v)}>{l}</button>)}
              </span>
            ) : null}
            <span style={{ width: 1, height: 22, background: K.border, margin: '0 4px' }} />
            <span style={{ display: 'inline-flex', background: K.raised, borderRadius: K.rCtl, padding: 2 }}>
              {DB_UNITS.map((u) => <button key={u.k} onClick={() => setUnit(u.k)} style={seg(unit === u.k)}>{u.label}</button>)}
            </span>
            <span style={{ width: 1, height: 22, background: K.border, margin: '0 4px' }} />
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} style={inputS} />
            <span style={{ color: K.muted }}>~</span>
            <input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} style={inputS} />
            {[['6m', '최근 6개월'], ['1y', '최근 1년'], ['2y', '최근 2년'], ['2022', '2022년부터']].map(([k, l]) => (
              <button key={k} onClick={() => preset(k)} style={Object.assign({}, ghost, { height: 28, padding: '0 10px', fontSize: 12, color: K.muted })}>{l}</button>
            ))}
            <span style={{ width: 1, height: 22, background: K.border, margin: '0 4px' }} />
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" style={{ accentColor: K.ink }} checked={onlyCurrent} onChange={(e) => { setOnlyCurrent(e.target.checked); setPicked(null); }} /> 현재 수업 있는 강사만
            </label>
          </div>

          <div style={card}>
            {/* 범례 = 고르기. 처음엔 전원이 켜져 있다 — 켜짐 −, 꺼짐 + */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
              {teachers.map((t) => {
                const on = shown.includes(t);
                return (
                  <button key={t} onClick={() => togglePick(t)} title={on ? '끄기' : '켜기'} aria-pressed={on}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px 0 8px', borderRadius: K.rCtl, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid ' + (on ? K.control : K.border), background: on ? K.surface : 'transparent', color: on ? K.text : K.muted, transition: K.ease }}>
                    <span aria-hidden="true" style={{ width: 12, textAlign: 'center', fontSize: 16, lineHeight: '14px', fontWeight: 700, color: on ? colorOf[t] : K.muted }}>{on ? '\u2212' : '+'}</span>
                    {t}<span style={{ color: K.muted, fontVariantNumeric: 'tabular-nums' }}>{last[t] || 0}</span>
                  </button>
                );
              })}
              {shown.length ? <button onClick={() => setPicked(new Set())} style={{ border: '1px solid ' + K.control, background: 'transparent', color: K.text, cursor: 'pointer', font: 'inherit', fontSize: 12, height: 28, padding: '0 10px', borderRadius: K.rCtl, transition: K.ease }}>전부 끄기</button> : null}
              {shown.length < teachers.length ? <button onClick={() => setPicked(null)} style={{ border: '1px solid ' + K.control, background: 'transparent', color: K.text, cursor: 'pointer', font: 'inherit', fontSize: 12, height: 28, padding: '0 10px', borderRadius: K.rCtl, transition: K.ease }}>전부 켜기</button> : null}
            </div>
            {periods.length ? (
              <DbLineChart labels={labels} series={series} partialLast={partialLast} yMax={yMaxAll} height={340} T={T} dark={dark} />
            ) : <div style={{ padding: 30, textAlign: 'center', color: K.muted, fontSize: 13 }}>기간 안에 들어가는 칸이 없습니다.</div>}
            <div style={{ marginTop: 8, fontSize: 12, color: K.muted, lineHeight: 1.6 }}>
              각 칸의 마지막 날 기준 수강생 수(사람 수). {partialLast ? '* 마지막 칸은 오늘(' + today + ')까지. ' : ''}
              ACA2000 에 담임이 등록돼 있지 않던 기간은 그 반의 가장 가까운 시기 담임에게 붙입니다 — 담임 등록이 늦었던 2024년 이전은 그만큼 추정치입니다.
            </div>
          </div>

          {/* 신입 · 퇴원 — 전지점 · 원당점 4층 · 5층 · 이음점은 위 지점 선택과 무관하게 늘 넷 다 보인다 */}
          {who ? <DbWhoDialog scope={who} labels={labels} raw={raw} dark={dark} onClose={() => setWho(null)} /> : null}
          <div style={{ fontSize: 16, fontWeight: 600, margin: '28px 0 4px' }}>신입 · 퇴원</div>
          <div style={{ fontSize: 12, color: K.muted, marginBottom: 10, lineHeight: 1.6 }}>
            앞 칸 마지막 날에는 없다가 이 칸 마지막 날에 수강 중이면 신입, 그 반대면 퇴원입니다. 고3 종강처럼 반이 끝나서 나간 학생(ACA2000 종료 사유에 종강·종료, 11~12월에 사유 없이 끝난 고3 반, 정시반·특강에서 나간 학생)은 퇴원에서 빼고 종강으로 따로 셉니다. 휴원목록으로 옮긴 학생은 휴원(노랑)으로, 휴원에서 돌아온 학생은 신입이 아니라 복귀로 따로 셉니다 — 모두 증감에는 들어갑니다. 방학 특강(써머·윈터) 반은 세지 않습니다. 카드의 「명단」을 누르면 누가 어느 쪽으로 잡혔는지 볼 수 있습니다. 단위(주별·월별·연별 …)와 기간은 위에서 고른 대로입니다.
            같은 과목 안에서 강사만 바뀐 학생(반 이동·강사 변경)과 다른 층으로 옮긴 학생은 전반(+들어옴 −나감)으로 숫자만 적고 그래프에는 넣지 않습니다. 5층 = 초등 · 원당중 1·2학년 반, 4층 = 원당점의 나머지 반(반 이름 기준).
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: K.muted, marginBottom: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: K.hue }} />신입</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: K.neg }} />퇴원</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 10 }}>
            {flowScopes.map((sc) => (
              <div key={sc.name} style={Object.assign({}, card, { padding: '14px 16px 10px' })}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap', rowGap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{sc.name}</span><button onClick={() => setWho(sc)} title="누가 잡혔는지 보기" style={{ border: '1px solid ' + K.control, background: 'transparent', color: K.text, cursor: 'pointer', font: 'inherit', fontSize: 12, height: 24, padding: '0 8px', marginLeft: 8, borderRadius: K.rCtl, transition: K.ease }}>명단</button>{flowHead(sc.flows)}
                </div>
                <DbFlowChart labels={labels} flows={sc.flows} partialLast={partialLast} height={200} dark={dark} />
              </div>
            ))}
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, margin: '22px 0 10px' }}>강사별 신입 · 퇴원 <span style={{ fontWeight: 400, color: K.muted, fontSize: 12 }}>· {branch}{branch === '원당점' && floor ? ' ' + floor : ''} · 기간 합계</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 10 }}>
            {teachers.map((t) => (
              <div key={t} style={Object.assign({}, card, { padding: '12px 14px 8px' })}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6, flexWrap: 'wrap', rowGap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t}</span><button onClick={() => setWho({ name: t, flows: flowTeacher[t] || [], classOk: teacherOk(t) })} title="누가 잡혔는지 보기" style={{ border: '1px solid ' + K.control, background: 'transparent', color: K.text, cursor: 'pointer', font: 'inherit', fontSize: 12, height: 24, padding: '0 8px', marginLeft: 8, borderRadius: K.rCtl, transition: K.ease }}>명단</button>{flowHead(flowTeacher[t])}
                </div>
                <DbFlowChart labels={labels} flows={flowTeacher[t] || labels.map(() => ({ i: 0, o: 0, g: 0, h: 0, ti: 0, to: 0 }))} partialLast={partialLast} height={130} dark={dark} compact />
              </div>
            ))}
          </div>

          {/* 강사별 작은 그래프 — 같은 눈금, 큰 그래프와 같은 색 */}
          <div style={{ fontSize: 14, fontWeight: 600, margin: '22px 0 10px' }}>강사별 수강생 수 <span style={{ fontWeight: 400, color: K.muted, fontSize: 12 }}>· 같은 눈금 · 이름 옆은 마지막 칸 기준</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
            {teachers.map((t) => (
              <div key={t} style={Object.assign({}, card, { padding: '12px 14px 8px' })}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 12, height: 2, borderRadius: 1, background: smallColor(t), alignSelf: 'center' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{last[t] || 0}</span>
                  <span style={{ fontSize: 11, color: K.muted }}>명</span>
                </div>
                <DbLineChart labels={labels} series={[{ name: t, color: smallColor(t), values: valuesOf(t) }]} partialLast={partialLast} yMax={yMaxAll} height={120} T={T} dark={dark} compact />
              </div>
            ))}
          </div>

          {/* 표 — 그래프와 같은 숫자 */}
          <div style={{ fontSize: 14, fontWeight: 600, margin: '22px 0 10px' }}>표</div>
          <div style={Object.assign({}, card, { padding: 0, overflow: 'auto', maxHeight: 520 })}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12.5, minWidth: '100%', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 2, textAlign: 'left', height: 40, padding: '0 12px', background: K.surface, borderBottom: '1px solid ' + K.border, fontSize: 12, fontWeight: 400, color: K.muted }}>기간</th>
                  {teachers.map((t) => <th key={t} style={{ position: 'sticky', top: 0, textAlign: 'right', height: 40, padding: '0 10px', background: K.surface, borderBottom: '1px solid ' + K.border, fontSize: 12, fontWeight: 400, color: K.muted }}>{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={p.D}>
                    <td style={{ position: 'sticky', left: 0, height: 36, padding: '0 12px', background: K.surface, borderBottom: '1px solid ' + K.rule, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{p.label}{p.partial ? '*' : ''}</td>
                    {teachers.map((t) => <td key={t} style={{ textAlign: 'right', height: 36, padding: '0 10px', borderBottom: '1px solid ' + K.rule, fontVariantNumeric: 'tabular-nums', color: counts[i].by[t] ? K.text : K.muted }}>{counts[i].by[t] || 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
