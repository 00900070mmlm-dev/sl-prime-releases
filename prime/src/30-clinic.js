// ============================================================
// 클리닉 (홈 → 클리닉) — 신UI 전용
//
// 2026-11-19 사장님: 4시~11시를 한 시간씩 가로선으로 나누고, 시간마다 클리닉에 오는 학생의
// 이름 · 전화번호 · 그날 강사 요청(예전 이름 「해야 할 일」) · 비고를 본다. 하루 단위로 넘긴다. 시안은 design/clinic/.
//   · **일단 이음점만**(반 이름이 `이음(` 으로 시작하는 반의 담임 · 학생 — waBranchOf).
//   · 담임마다 색(전체명단과 같은 rsTeacherColors), 한 시간 안에서 과목끼리 붙는다(영어 → 수학 → …).
//     위의 담임 체크박스를 끄면 그 선생님 학생이 가려진다.
//   · 한 번 넣은 클리닉은 저절로 이어진다 — 월·수 / 화·목 짝(월에 넣으면 수, 수에 넣으면 다음 월 …).
//     저절로 생긴 날의 「강사 요청」은 비어 있다. 비고는 담임 클리닉만 이어지고 조교 클리닉은 날마다 따로다(2026-11-24).
//   · 금·토에는 제목(「조교 클리닉」)이 그 자리에서 캡슐(담임 클리닉 · 조교 클리닉 · 전체)로 바뀐다.
//     담임 클리닉은 매주 같은 요일로 이어지고, 금·토의 조교 클리닉은 그날 하루뿐이다.
//   · 2026-11-24 사장님: **반복 요일은 학생을 넣을 때 고른다**(월~토 여러 개 · 안 고르면 그날 하루) — todo.days('135' = 월·수·금).
//     요일마다 시간을 따로 정한다(같은 날 — 화 4시 · 목 8시). 시간이 다른 요일은 줄을 나눠 넣고(clGroups), 이름을 누르면 그 줄들을 함께 바꾼다(sibsOf).
//     위의 짝 규칙은 그 전에 넣은 줄(todo.days 없음)에만 남는다(clDaysOf). 이름을 눌러 요일 · 시간을 바꿀 때도 같은 칩.
//   · 이름을 누르면 요일 · 시간을 옮긴다(옛 줄은 그날에서 끊고 새 줄을 만든다 — 지난 기록이 남는다).
//   · 학생 추가는 이름 또는 초성으로 찾는다. 아무것도 안 치면 목록이 없고, 그날 이미 든 학생은 안 뜬다.
//   · 글은 칸을 벗어날 때 저장한다. 저장 버튼 없음.
//   · 2026-11-24 사장님: **조교 클리닉의 비고는 이어지지 않는다**(날마다 따로 — 담임 클리닉은 그대로 이어진다).
//     **출결**: 줄마다 출석 · 무단결석 · 미루기. 미루기는 날짜 · 시간을 고르면 그때 **하루만** 나온다(시간 고르기는 같은 날 추가 — 같은 날 다른 시간도 된다)
//     (그날 하루짜리 줄을 새로 만든다 — start_day = 미룬 날, end_day = 그다음 날, todo.from = 원래 날).
//     출결 · 조교 비고 · 미룬 곳은 표를 바꾸지 않으려고 todo jsonb 에 날짜를 붙인 키로 둔다:
//       'att:<날>' = 출석 | 결석 | 미룸 · 'note:<날>' = 그날 비고(조교) · 'mv:<날>' = '<미룬 날>|<새 줄 id>|<시>'
//       · 'from' / 'fromId' = (미뤄서 생긴 줄) 원래 날 · 원래 줄 id. 날짜만 키인 것은 예전처럼 그날 강사 요청(옛 이름 해야 할 일)이다.
//   · 2026-11-24 사장님: 「해야 할 일」 → **「강사 요청」**, **강사만 적는다**(강사·관리자·개발자 — 조교는 읽기만. CL_REQ_GROUPS).
//     화면에서만 막는다 — clinic 표의 쓰기 정책은 조교에게도 열려 있다(출결 · 비고는 조교가 적으므로 줄 단위로는 못 막는다).
// 학생 · 전화번호 · 담임은 ACA 동기화본에서 읽는다. 여기서 쓰는 표는 clinic 하나 — scripts/clinic_schema.sql.
// ============================================================

const CL_WD = ['일', '월', '화', '수', '목', '금', '토'];
const CL_HOURS = [16, 17, 18, 19, 20, 21, 22];           // 4:00–5:00 … 10:00–11:00
const CL_SUBJ = ['영어', '수학', '국어', '과학'];          // 한 시간 안에서 이 순서로 과목끼리 붙는다
const CL_KINDS = ['담임', '조교', '전체'];
const CL_REQ_GROUPS = ['강사', '관리자', '개발자'];      // 「강사 요청」을 적을 수 있는 그룹
const CL_BRANCH = '이음점';                               // 일단 이음점만(2026-11-19 사장님)
const CL_CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const CL_SCHEMA_HINT = 'Supabase SQL Editor 에서 scripts/clinic_schema.sql 을 한 번 실행해야 합니다.';

function clYmd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function clShift(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return clYmd(d); }
function clDow(ymd) { return new Date(ymd + 'T00:00:00').getDay(); }
function clMdw(ymd) { const d = new Date(ymd + 'T00:00:00'); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + CL_WD[d.getDay()] + ')'; }
/** 금·토 — 담임 클리닉이 있는 날 */
function clIsWeekend(ymd) { const w = clDow(ymd); return w === 5 || w === 6; }
/** 요일 짝 — 월↔수, 화↔목. 그 밖(금·토·일)은 그 요일 하나. */
function clPairOf(w) { return w === 1 || w === 3 ? [1, 3] : w === 2 || w === 4 ? [2, 4] : [w]; }
/** 미뤄서 생긴 하루짜리 줄인가 */
function clOnce(r) { return !!(r.todo && r.todo.from); }
/** 그날 칸에 보일 비고 — 담임은 줄 하나에 하나(이어진다), 조교는 날마다 따로(넣은 날만 예전 note 를 쓴다) */
function clNoteOn(r, d) {
  if (r.kind === '담임') return r.note || '';
  const k = 'note:' + d;
  if (r.todo && Object.prototype.hasOwnProperty.call(r.todo, k)) return r.todo[k] || '';
  return d === r.start_day ? (r.note || '') : '';
}
function clMd(ymd) { const d = new Date(ymd + 'T00:00:00'); return (d.getMonth() + 1) + '/' + d.getDate(); }
/** 그 줄이 반복하는 요일 — 요일 숫자를 이은 글('135' = 월·수·금, '' = 그날 하루뿐).
 *  2026-11-24 사장님: 학생을 넣을 때 반복 요일을 직접 고른다(todo.days). 그 전에 넣은 줄은 예전 규칙 —
 *  담임 = 매주 그 요일 · 조교 = 월·수 / 화·목 짝(금·토·일에 넣은 것은 그날 하루). */
function clDaysOf(r) {
  if (clOnce(r)) return '';
  if (r.todo && typeof r.todo.days === 'string') return r.todo.days;
  const w0 = clDow(r.start_day);
  if (r.kind === '담임') return String(w0);
  const p = clPairOf(w0);
  return p.length > 1 ? p.join('') : '';
}
/** 그 줄(클리닉)이 날짜 d 에 오는가 */
function clOnDay(r, d) {
  if (d < r.start_day || (r.end_day && d >= r.end_day) || (r.skip && r.skip[d])) return false;
  const ds = clDaysOf(r);
  if (!ds) return d === r.start_day;
  return ds.indexOf(String(clDow(d))) >= 0;
}
/** 반복 표시 — '월·수' · '월·수·금' · '매주 금' · ''(하루뿐) */
function clRepeat(r) {
  const ds = clDaysOf(r);
  if (!ds) return '';
  return ds.length === 1 ? '매주 ' + CL_WD[+ds] : ds.split('').map((w) => CL_WD[+w]).join('·');
}
/** 요일 · 요일별 시간 → 넣을 줄 묶음 [{ days, hour }] — 시간이 같은 요일끼리 한 줄. 요일이 없으면 그날 하루 한 줄. */
function clGroups(days, hours, hour) {
  const ds = clDaysNorm(days || ''); if (!ds) return [{ days: '', hour: hour }];
  const by = {}; ds.split('').forEach((w) => { const h = (hours && hours[w]) || hour; by[h] = (by[h] || '') + w; });
  return Object.keys(by).map((h) => ({ days: by[h], hour: +h }));
}
/** '화 3시 · 목 8시' — 시간이 다 같으면 '화·목 4시' */
function clSchedLabel(days, hours, hour) {
  const ds = clDaysNorm(days || ''); const hh = ds.split('').map((w) => (hours && hours[w]) || hour);
  if (hh.every((h) => h === hh[0])) return ds.split('').map((w) => CL_WD[+w]).join('·') + ' ' + (hh[0] - 12) + '시';
  return ds.split('').map((w, i) => CL_WD[+w] + ' ' + (hh[i] - 12) + '시').join(' · ');
}
/** 요일 고르기 칩에 쓰는 순서 — 월~토 */
const CL_PICK = [1, 2, 3, 4, 5, 6];
/** 요일 글 정리 — 겹침 없이 월~토 순 */
function clDaysNorm(ds) { return CL_PICK.filter((w) => String(ds).indexOf(String(w)) >= 0).join(''); }
/** 요일(요일 숫자를 이은 글 — '13' · '135' · '5') 가운데 day 또는 그 뒤 가장 가까운 날 */
function clMoveStart(day, pair) {
  const ws = String(pair).split('').map(Number);
  for (let i = 0; i < 8; i++) { const d = clShift(day, i); if (ws.indexOf(clDow(d)) >= 0) return d; }
  return day;
}
/** 이름 찾기 — 글자 그대로 또는 초성(ㅎㅅㅇ · 한ㅅ). 초성 글자는 그 자리 글자의 초성과, 나머지는 글자 그대로 견준다. */
function clNameHit(name, query) {
  const q = String(query || '').replace(/\s/g, ''), n = String(name || '');
  if (!q) return false;
  const cho = (ch) => { const c = ch.charCodeAt(0) - 0xAC00; return c >= 0 && c <= 11171 ? CL_CHO[Math.floor(c / 588)] : ch; };
  for (let i = 0; i + q.length <= n.length; i++) {
    let ok = true;
    for (let j = 0; j < q.length && ok; j++) ok = CL_CHO.indexOf(q[j]) >= 0 ? cho(n[i + j]) === q[j] : n[i + j] === q[j];
    if (ok) return true;
  }
  return false;
}
function clErrText(e) {
  const m = String((e && e.message) || e || '');
  if (/relation .* does not exist|schema cache|PGRST205/i.test(m)) return '클리닉 표가 아직 없습니다 — ' + CL_SCHEMA_HINT;
  if (/row-level security|permission denied/i.test(m)) return '클리닉을 고칠 권한이 없습니다.';
  return m || '알 수 없는 오류';
}

// 화면 CSS — 색은 루트의 변수(TT 값)로 받는다. hover · 캡슐의 늘어남처럼 인라인으로 못 하는 것이 많아 한 덩어리로 둔다.
const CL_CSS = `
.cl { --e: background-color .14s cubic-bezier(.2,0,0,1), color .14s cubic-bezier(.2,0,0,1), border-color .14s cubic-bezier(.2,0,0,1), opacity .14s cubic-bezier(.2,0,0,1); font-size: 13.5px; }
.cl button, .cl input, .cl textarea { font-family: inherit; color: inherit; }
.cl-nav { flex: none; display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border); }
.cl-cap { position: relative; display: flex; padding: 2px; border-radius: 6px; background: var(--raised); transition: background-color .2s ease-in-out, padding .2s ease-in-out; }
.cl-cap .thumb { position: absolute; top: 2px; bottom: 2px; left: 2px; width: 96px; border-radius: 4px; background: var(--surface); transition: left .2s ease-in-out, opacity .2s ease-in-out; pointer-events: none; }
.cl-cap button { position: relative; flex: none; display: grid; place-items: center; width: 96px; height: 28px; border: none; background: transparent; padding: 0; font-size: 13px; letter-spacing: 0; color: var(--muted); cursor: pointer; white-space: nowrap; overflow: hidden;
  transition: width .2s ease-in-out, opacity .2s ease-in-out, font-size .2s ease-in-out, color .14s cubic-bezier(.2,0,0,1); }
.cl-cap button span { grid-area: 1 / 1; transition: opacity .2s ease-in-out; }
.cl-cap button .b { font-weight: 700; opacity: 0; }
.cl-cap button.on { color: var(--text); }
.cl-cap button.on .n { opacity: 0; }
.cl-cap button.on .b { opacity: 1; }
.cl-cap button.gone { width: 0; opacity: 0; pointer-events: none; }
.cl-cap.solo { background: transparent; padding: 2px 0; }
.cl-cap.solo .thumb { opacity: 0; }
.cl-cap.solo button.on { width: 92px; font-size: 17px; letter-spacing: -0.2px; justify-items: start; cursor: default; }
.cl-day { display: flex; align-items: center; gap: 2px; margin-left: 10px; }
.cl-day .arrow { border: none; background: transparent; cursor: pointer; color: var(--muted); font-size: 17px; padding: 2px 8px; border-radius: 6px; transition: var(--e); }
.cl-day .arrow:hover { background: var(--active); color: var(--text); }
.cl-day label { position: relative; cursor: pointer; font-size: 18px; font-weight: 500; font-variant-numeric: tabular-nums; padding: 0 4px; white-space: nowrap; }
.cl-day .pick { position: relative; border: none; background: transparent; color: var(--text); cursor: pointer; font: inherit; font-size: 18px; font-weight: 500; font-variant-numeric: tabular-nums; padding: 2px 6px; border-radius: 6px; white-space: nowrap; transition: var(--e); }
.cl-day .pick:hover, .cl-day .pick.open { background: var(--active); }
.cl-dwrap { position: relative; }
.cl-cal { position: absolute; left: 50%; translate: -50% 0; top: 38px; z-index: 8; width: 280px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.cl-cal .mh { display: flex; align-items: center; justify-content: space-between; margin: 0 0 8px; }
.cl-cal .mh b { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cl-cal .mh button { border: none; background: transparent; cursor: pointer; color: var(--muted); font-size: 16px; width: 30px; height: 28px; border-radius: 6px; transition: var(--e); }
.cl-cal .mh button:hover { background: var(--active); color: var(--text); }
.cl-cal .g { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cl-cal .wd { font-size: 11.5px; color: var(--muted); text-align: center; padding: 2px 0 4px; }
.cl-cal .d { height: 34px; border: 1px solid transparent; background: transparent; border-radius: 6px; cursor: pointer; font: inherit; font-size: 13px; color: var(--text); font-variant-numeric: tabular-nums; transition: var(--e); }
.cl-cal .d:hover { background: var(--active); }
.cl-cal .d.out { color: var(--muted); opacity: .45; }
.cl-cal .d.sun { color: var(--neg); }
.cl-cal .d.now { border-color: var(--ink); }
.cl-cal .d.on { background: var(--ink); color: var(--inkText); border-color: var(--ink); }
.cl-cal .ft { display: flex; justify-content: flex-end; margin-top: 8px; }
.cl-btn { height: 28px; padding: 0 10px; border: 1px solid var(--control); background: transparent; border-radius: 6px; font-size: 12px; cursor: pointer; transition: var(--e); white-space: nowrap; }
.cl-btn:hover { background: var(--active); }
.cl-sum { margin-left: auto; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cl-sum b { color: var(--text); font-weight: 600; }
.cl-main { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 20px 40px; }
.cl-tag { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 4px; color: #1d1d1f; font-size: 12px; font-weight: 500; white-space: nowrap; }
.cl-tag i { font-style: normal; opacity: .62; font-weight: 400; }
.cl-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 1180px; margin-bottom: 12px; min-height: 30px; }
.cl-chk { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px 0 9px; border-radius: 6px; color: #1d1d1f; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: var(--e); user-select: none; }
.cl-chk input { accent-color: #141414; margin: 0; width: 14px; height: 14px; cursor: pointer; }
.cl-chk i { font-style: normal; opacity: .62; font-weight: 400; }
.cl-chk b { font-weight: 600; font-variant-numeric: tabular-nums; }
.cl-chk.off { opacity: .45; }
.cl-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; max-width: 1180px; }
.cl-slot { display: flex; border-top: 1px solid var(--border); }
.cl-slot:first-child { border-top: none; }
.cl-hour { flex: none; width: 104px; padding: 16px 0 16px 20px; }
.cl-hour .h { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.2px; }
.cl-hour .r { font-size: 12px; color: var(--muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
.cl-hour .now { font-size: 12px; font-weight: 600; margin-top: 6px; }
.cl-slot.past .cl-hour .h { color: var(--muted); font-weight: 500; }
.cl-kids { flex: 1; min-width: 0; padding: 8px 12px 8px 0; }
.cl-row, .cl-head { display: grid; grid-template-columns: 104px 170px 136px 196px minmax(150px, 1.2fr) minmax(130px, 1fr) 28px; align-items: start; column-gap: 8px; }
.cl-head { color: var(--muted); font-size: 12px; padding: 6px 0 4px; }
.cl-head span { padding: 0 6px; }
.cl-row { position: relative; border-top: 1px solid var(--rule); padding: 5px 0; min-height: 40px; }
.cl-row.gap { border-top-color: var(--control); }
.cl-who { padding: 4px 0 0 6px; }
.cl-name { padding: 5px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-name small { font-weight: 400; color: var(--muted); font-size: 12px; margin-left: 12px; }
.cl-nm { border: none; background: transparent; cursor: pointer; font: inherit; font-weight: 500; color: inherit; padding: 2px 6px; margin: -2px -6px; border-radius: 6px; transition: var(--e); }
.cl-nm:hover, .cl-row.moving .cl-nm { background: var(--active); }
.cl-tel { padding: 5px 6px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cl-tel a { color: inherit; text-decoration: none; }
.cl-tel small { color: var(--muted); font-size: 12px; margin-left: 4px; }
.cl textarea { width: 100%; border: 1px solid transparent; border-radius: 6px; padding: 4px 6px; font-size: 13.5px; line-height: 1.45; background: transparent; outline: none; resize: none; overflow: hidden; display: block; transition: var(--e); }
.cl .ro { padding: 4px 6px; border: 1px solid transparent; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; min-height: 29px; }
.cl textarea::placeholder { color: var(--control); }
.cl textarea:hover { border-color: var(--border); }
.cl textarea:focus { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); background: var(--surface); }
.cl-x { border: none; background: transparent; cursor: pointer; color: var(--muted); font-size: 15px; line-height: 1; height: 28px; width: 28px; border-radius: 6px; opacity: 0; transition: var(--e); }
.cl-row:hover .cl-x, .cl-x:focus, .cl-row.asking .cl-x { opacity: 1; }
.cl-x:hover { background: var(--active); color: var(--neg); }
.cl-add { position: relative; padding: 4px 0 6px; }
.cl-add > button { border: none; background: transparent; cursor: pointer; color: var(--muted); font-size: 13px; height: 30px; padding: 0 8px; border-radius: 6px; transition: var(--e); }
.cl-add > button:hover { background: var(--active); color: var(--text); }
.cl-find { display: flex; align-items: center; gap: 8px; }
.cl-find input { width: 220px; height: 32px; padding: 0 10px; border: 1px solid var(--ink); box-shadow: 0 0 0 1px var(--ink); border-radius: 6px; font-size: 13.5px; background: var(--surface); outline: none; }
.cl-find span { color: var(--muted); font-size: 12px; }
.cl-pop { position: absolute; left: 0; top: 40px; z-index: 5; width: 340px; max-height: 300px; overflow-y: auto; padding: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.cl-pop button { display: flex; width: 100%; align-items: center; gap: 8px; height: 34px; padding: 0 8px 0 10px; border: none; background: transparent; border-radius: 6px; cursor: pointer; font-size: 13.5px; text-align: left; }
.cl-pop button:hover, .cl-pop button.on { background: var(--active); }
.cl-pop button small { color: var(--muted); font-size: 12px; }
.cl-pop button .cl-tag { margin-left: auto; }
.cl-pop .none { padding: 10px; color: var(--muted); font-size: 13px; }
.cl-ask { position: absolute; right: 0; top: 36px; z-index: 6; width: 250px; padding: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.cl-ask button { display: block; width: 100%; text-align: left; border: none; background: transparent; border-radius: 6px; padding: 7px 10px; cursor: pointer; font-size: 13.5px; }
.cl-ask button small { display: block; color: var(--muted); font-size: 12px; margin-top: 1px; }
.cl-ask button:hover { background: var(--active); }
.cl-mv { position: absolute; left: 104px; top: 36px; z-index: 6; width: 316px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.cl-mv h4 { margin: 0 0 12px; font-size: 13.5px; font-weight: 600; }
.cl-mv h4 small { font-weight: 400; color: var(--muted); font-size: 12px; margin-left: 6px; }
.cl-mv .lb { font-size: 12px; color: var(--muted); margin: 0 0 6px; }
.cl-seg { display: flex; gap: 2px; padding: 2px; border-radius: 6px; background: var(--raised); margin-bottom: 12px; }
.cl-seg button { flex: 1; height: 28px; border: none; border-radius: 4px; background: transparent; color: var(--muted); font-size: 13px; cursor: pointer; transition: var(--e); font-variant-numeric: tabular-nums; white-space: nowrap; padding: 0; }
.cl-seg button.on { background: var(--surface); color: var(--text); font-weight: 500; }
.cl-mv .to { font-size: 12px; color: var(--muted); margin: 0 0 12px; line-height: 1.5; min-height: 18px; }
.cl-mv .to b { color: var(--text); font-weight: 500; }
.cl-place { position: relative; left: 0; top: 0; margin-top: 4px; }
.cl-days button { min-width: 0; }
.cl-dh { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.cl-dh > span { flex: none; width: 18px; font-size: 13px; font-weight: 600; }
.cl-dh .cl-seg { flex: 1; margin-bottom: 0; }
.cl-mv .cl-dh:last-of-type { margin-bottom: 12px; }
.cl-mv .acts { display: flex; justify-content: flex-end; gap: 8px; }
.cl-mv .acts button { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px; cursor: pointer; transition: var(--e); }
.cl-mv .cancel { border: 1px solid var(--control); background: transparent; }
.cl-mv .cancel:hover { background: var(--active); }
.cl-mv .go { border: 1px solid var(--ink); background: var(--ink); color: var(--inkText); font-weight: 500; }
.cl-mv .go:disabled { opacity: .4; cursor: default; }
.cl-att { position: relative; padding-top: 2px; }
.cl-att .seg { display: flex; gap: 2px; padding: 2px; border-radius: 6px; background: var(--raised); }
.cl-att .seg button { flex: 1; height: 26px; border: none; border-radius: 4px; background: transparent; color: var(--muted); font-size: 12.5px; cursor: pointer; transition: var(--e); white-space: nowrap; padding: 0 4px; font-variant-numeric: tabular-nums; }
.cl-att .seg button:hover { color: var(--text); }
.cl-att .seg button.on { background: var(--surface); color: var(--text); font-weight: 600; }
.cl-att .seg button.on.neg { color: var(--neg); }
.cl-row.away .cl-nm { color: var(--muted); text-decoration: line-through; }
.cl-pp { position: absolute; right: 0; top: 36px; z-index: 6; width: 316px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.cl-pp h4 { margin: 0 0 10px; font-size: 13.5px; font-weight: 600; }
.cl-pp .lb { font-size: 12px; color: var(--muted); margin: 0 0 6px; }
.cl-pp input { width: 100%; height: 32px; padding: 0 10px; border: 1px solid var(--control); border-radius: 6px; font-size: 13.5px; background: var(--surface); outline: none; margin-bottom: 10px; }
.cl-pp input:focus { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); }
.cl-pp .to { font-size: 12px; color: var(--muted); margin: 0 0 12px; line-height: 1.5; }
.cl-pp .to b { color: var(--text); font-weight: 500; }
.cl-pp .acts { display: flex; justify-content: flex-end; gap: 8px; }
.cl-pp .acts button { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px; cursor: pointer; transition: var(--e); }
.cl-pp .cancel { border: 1px solid var(--control); background: transparent; }
.cl-pp .cancel:hover { background: var(--active); }
.cl-pp .go { border: 1px solid var(--ink); background: var(--ink); color: var(--inkText); font-weight: 500; }
.cl-pp .go:disabled { opacity: .4; cursor: default; }
.cl-foot { max-width: 1180px; margin-top: 12px; color: var(--muted); font-size: 12px; line-height: 1.6; }
@media (max-width: 760px) {
  .cl-nav { flex-wrap: wrap; padding: 10px 14px; } .cl-day { margin-left: 0; } .cl-main { padding: 12px 12px 40px; overflow: visible; }
  .cl-slot { display: block; } .cl-hour { width: auto; padding: 12px 14px 0; display: flex; align-items: baseline; gap: 8px; } .cl-hour .r, .cl-hour .now { margin: 0; }
  .cl-kids { padding: 4px 8px 8px; } .cl-head { display: none; }
  .cl-row { grid-template-columns: 1fr 28px; padding: 8px 0; } .cl-row > div { grid-column: 1; } .cl-row .todo, .cl-row .note, .cl-row .cl-att { grid-column: 1 / -1; } .cl-pp { left: 0; width: 100%; } .cl-row .cl-x { grid-column: 2; grid-row: 1; opacity: 1; }
  .cl-tel { padding-top: 0; } .cl-mv { left: 0; width: 100%; } .cl-find input { width: 100%; } .cl-pop { width: 100%; }
}
`;

/** 날짜 고르기 달력 — 머리의 날짜를 누르면 뜬다. 날을 누르면 그날로 가고 닫힌다 */
function ClCalendar({ value, today, onPick }) {
  const [m, setM] = useState(value.slice(0, 7));
  const first = new Date(m + '-01T00:00:00');
  const start = clShift(m + '-01', -first.getDay());
  const cells = []; for (let i = 0; i < 42; i++) cells.push(clShift(start, i));
  const rows = cells[35].slice(0, 7) === m ? 6 : 5;
  const go = (n) => { const d = new Date(first); d.setMonth(d.getMonth() + n); setM(clYmd(d).slice(0, 7)); };
  return (
    <div className="cl-cal" data-pop="">
      <div className="mh"><button title="전달" onClick={() => go(-1)}>‹</button><b>{first.getFullYear()}년 {first.getMonth() + 1}월</b><button title="다음 달" onClick={() => go(1)}>›</button></div>
      <div className="g">
        {CL_WD.map((w) => <span key={w} className="wd">{w}</span>)}
        {cells.slice(0, rows * 7).map((d) => (
          <button key={d} className={'d' + (d.slice(0, 7) !== m ? ' out' : '') + (clDow(d) === 0 ? ' sun' : '') + (d === today ? ' now' : '') + (d === value ? ' on' : '')}
            onClick={() => onPick(d)}>{Number(d.slice(8))}</button>
        ))}
      </div>
      {m !== today.slice(0, 7) ? <div className="ft"><button className="cl-btn" onClick={() => setM(today.slice(0, 7))}>이번 달</button></div> : null}
    </div>
  );
}

/** 칸을 벗어날 때 저장하는 글 칸(내용만큼 늘어난다). 값이 바깥에서 바뀌면(다른 날로 이동 등) 따라간다. */
function ClText({ value, onSave, placeholder }) {
  const [v, setV] = useState(value || '');
  const ref = useRef(null);
  useEffect(() => { setV(value || ''); }, [value]);
  useEffect(() => { const t = ref.current; if (!t) return; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }, [v]);
  return <textarea ref={ref} rows={1} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => { if ((v || '') !== (value || '')) onSave(v); }} />;
}

function ClinicApp({ dark, userName, perms }) {
  const canReq = CL_REQ_GROUPS.indexOf(permGroupKey(perms)) >= 0;
  const K = TT(dark);
  const today = clYmd(new Date());
  const [aca, setAca] = useState(null);          // { students, classes }
  const [rows, setRows] = useState(null);        // 그날 걸린 clinic 줄들
  const [extra, setExtra] = useState({});        // 재원 명단에 없는 학생(퇴원 등) — s_id → 학생
  const [err, setErr] = useState('');
  const [day, setDayRaw] = useState(today);
  const [kind, setKind] = useState('조교');      // 캡슐 — 금·토에만 고른다. 평소엔 조교
  const [hidden, setHiddenRaw] = useState(() => { try { return JSON.parse(localStorage.getItem('cl_hidden') || '{}') || {}; } catch (e) { return {}; } });
  const [adding, setAdding] = useState(null);    // 학생을 추가하는 시간
  const [q, setQ] = useState('');
  const [asking, setAsking] = useState(null);    // 빼기 메뉴를 연 줄 id
  const [moving, setMoving] = useState(null);    // { id, pair, hour }
  const [postpone, setPostpone] = useState(null); // 미루기 창 — { id, to, hour }
  const [pending, setPending] = useState(null);   // 학생을 고른 뒤 반복 요일을 고르는 중 — { s, t, days }
  const [cal, setCal] = useState(false);          // 날짜 고르기 달력
  const [toast, setToast] = useState('');
  const [ver, setVer] = useState(0);
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const closeAll = () => { setCal(false); setAdding(null); setQ(''); setPending(null); setAsking(null); setMoving(null); setPostpone(null); };
  const setDay = (d) => { closeAll(); setDayRaw(d); };
  const wk = clIsWeekend(day);
  const curKind = wk ? kind : '조교';
  useEffect(() => { if (!wk && kind !== '조교') setKind('조교'); }, [wk]);

  // ── ACA 명단 — 이음점 반 · 그 반의 재원생 ────────────────────────
  useEffect(() => {
    Promise.all([
      SB.from('aca_student').select('s_id,name,s_hp,p_hp1,grade,school,state,class_ids').eq('state', '재원').limit(3000),
      SB.from('aca_class').select('c_id,name,subject,subjects,teachers,deleted').limit(3000),
    ]).then(([a, b]) => {
      if (a.error || b.error) { setErr(clErrText(a.error || b.error)); setAca({ students: [], classes: [] }); return; }
      setAca({ students: a.data || [], classes: b.data || [] });
    });
  }, []);
  const classes = ((aca && aca.classes) || []).filter((c) => !c.deleted && waBranchOf(c) === CL_BRANCH && !RS_HIDDEN.test(c.name || ''));
  const clsById = {}; classes.forEach((c) => { clsById[c.c_id] = c; });
  // 담임 → 과목
  const subjOf = {};
  classes.forEach((c) => { const sj = c.subject || (c.subjects || [])[0] || ''; (c.teachers || []).forEach((t) => { if (!subjOf[t]) subjOf[t] = sj; }); });
  const sjRank = (t) => { const i = CL_SUBJ.indexOf(subjOf[t] || ''); return i < 0 ? 9 : i; };
  const teacherNames = Object.keys(subjOf).sort((a, b) => sjRank(a) - sjRank(b) || a.localeCompare(b, 'ko'));
  const colors = rsTeacherColors(teacherNames);
  const colorOf = (t) => colors[t] || K.raised;
  // 학생 — 이음점 반을 듣는 재원생. teachers = 그 학생의 이음점 담임들
  const students = ((aca && aca.students) || []).map((s) => {
    const ts = []; (s.class_ids || []).forEach((id) => { const c = clsById[id]; if (c) (c.teachers || []).forEach((t) => { if (ts.indexOf(t) < 0) ts.push(t); }); });
    return Object.assign({}, s, { cl_teachers: ts.sort((a, b) => sjRank(a) - sjRank(b) || a.localeCompare(b, 'ko')) });
  }).filter((s) => s.cl_teachers.length);
  const stuById = {}; students.forEach((s) => { stuById[s.s_id] = s; });
  const stuOf = (id) => stuById[id] || extra[id] || null;

  // ── 그날 걸린 줄 ────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    SB.from('clinic').select('*').lte('start_day', day).or('end_day.is.null,end_day.gt.' + day).limit(5000).then(({ data, error }) => {
      if (dead) return;
      if (error) { setErr(clErrText(error)); setRows([]); return; }
      setErr(''); setRows(data || []);
    });
    return () => { dead = true; };
  }, [day, ver]);
  // 명단에 없는 학생(퇴원 · 다른 지점) 이름을 한 번 더 읽는다
  useEffect(() => {
    if (!aca || !rows) return;
    const miss = Array.from(new Set(rows.map((r) => r.s_id))).filter((id) => !stuById[id] && !extra[id]);
    if (!miss.length) return;
    SB.from('aca_student').select('s_id,name,s_hp,p_hp1,grade,school,state').in('s_id', miss).then(({ data }) => {
      const m = Object.assign({}, extra); miss.forEach((id) => { m[id] = { s_id: id, name: '(명단에 없음)', gone: true }; });
      (data || []).forEach((s) => { m[s.s_id] = Object.assign({}, s, { gone: s.state !== '재원' }); });
      setExtra(m);
    });
  }, [aca, rows]);

  const onDayAll = (rows || []).filter((r) => clOnDay(r, day));
  const inKind = onDayAll.filter((r) => curKind === '전체' || r.kind === curKind);
  const list = inKind.filter((r) => !hidden[r.teacher]).sort((a, b) => a.hour - b.hour || sjRank(a.teacher) - sjRank(b.teacher) || a.teacher.localeCompare(b.teacher, 'ko')
    || String((stuOf(a.s_id) || {}).name || '').localeCompare(String((stuOf(b.s_id) || {}).name || ''), 'ko'));
  const cnt = {}; inKind.forEach((r) => { cnt[r.teacher] = (cnt[r.teacher] || 0) + 1; });
  // 체크박스에 올릴 담임 — 이음점 담임 전원 + 그날 줄에만 있는 이름(옛 담임)
  const legendNames = teacherNames.concat(Object.keys(cnt).filter((t) => teacherNames.indexOf(t) < 0).sort((a, b) => a.localeCompare(b, 'ko')));
  const setHidden = (t, off) => setHiddenRaw((h0) => { const h = Object.assign({}, h0); if (off) h[t] = true; else delete h[t]; try { localStorage.setItem('cl_hidden', JSON.stringify(h)); } catch (e) {} return h; });

  // ── 쓰기 ────────────────────────────────────────────────────────
  const stamp = () => ({ updated_by: userName || null, updated_at: new Date().toISOString() });
  const fail = (error) => { if (error) { setErr(clErrText(error)); say('저장하지 못했습니다'); setVer((v) => v + 1); return true; } return false; };
  const patchRow = (id, patch) => {
    setRows((r0) => (r0 || []).map((r) => r.id === id ? Object.assign({}, r, patch) : r));
    SB.from('clinic').update(Object.assign({}, patch, stamp())).eq('id', id).then(({ error }) => { fail(error); });
  };
  const dropRow = (id) => { setRows((r0) => (r0 || []).filter((r) => r.id !== id)); SB.from('clinic').delete().eq('id', id).then(({ error }) => { fail(error); }); };
  const addRow = (row, then) => {
    SB.from('clinic').insert(Object.assign({ created_by: userName || null }, row, stamp())).select().then(({ data, error }) => {
      if (fail(error)) return;
      if (data && data[0]) setRows((r0) => (r0 || []).concat([data[0]]));
      if (then) then(data && data[0]);
    });
  };
  const saveTodo = (r, v) => { const todo = Object.assign({}, r.todo || {}); if (v.trim()) todo[day] = v; else delete todo[day]; patchRow(r.id, { todo: todo }); };
  /** todo 안의 날짜 붙인 키를 고친다(빈 값이면 키를 지운다). more = 같이 고칠 다른 칸 */
  const setKeys = (r, keys, more) => {
    const todo = Object.assign({}, r.todo || {});
    Object.keys(keys).forEach((k) => { if (keys[k]) todo[k] = keys[k]; else delete todo[k]; });
    patchRow(r.id, Object.assign({ todo: todo }, more || {}));
  };
  // 비고 — 담임은 줄 하나에 하나(이어진다), 조교는 그날 것만. 넣은 날 고치면 예전 note 칸은 비운다(다음 날로 번지지 않게).
  const saveNote = (r, v) => {
    if (r.kind === '담임') { patchRow(r.id, { note: v }); return; }
    const todo = Object.assign({}, r.todo || {}); todo['note:' + day] = v;
    if (!v.trim() && day !== r.start_day) delete todo['note:' + day];
    patchRow(r.id, day === r.start_day ? { todo: todo, note: '' } : { todo: todo });
  };
  // ── 출결 ── 출석 · 결석(무단결석) · 미룸. 같은 것을 한 번 더 누르면 푼다. 미룸을 풀면 미뤄 둔 하루짜리 줄도 지운다.
  const attOf = (r) => (r.todo && r.todo['att:' + day]) || '';
  const mvOf = (r) => { const v = (r.todo && r.todo['mv:' + day]) || ''; const p = v.split('|'); return v ? { to: p[0], id: p[1], hour: p[2] ? +p[2] : null } : null; };
  const dropMoved = (r) => {
    const mv = mvOf(r); if (!mv) return;
    if (mv.id) dropRow(mv.id);
    say(clMdw(mv.to) + '로 미뤄 둔 것을 지웠습니다');
  };
  const setAtt = (r, v) => {
    setPostpone(null);
    const cur = attOf(r), next = cur === v ? '' : v;
    if (cur === '미룸') dropMoved(r);
    setKeys(r, { ['att:' + day]: next, ['mv:' + day]: '' });
  };
  /** 미룬 날 — 이날 뒤 첫 날(일요일 건너뜀) */
  const nextDay = () => { let d = clShift(day, 1); if (clDow(d) === 0) d = clShift(d, 1); return d; };
  const doPostpone = () => {
    const r = (rows || []).filter((x) => x.id === postpone.id)[0]; const to = postpone.to, hour = postpone.hour;
    setPostpone(null);
    if (!r || !to || to < day || (to === day && hour === r.hour)) return;
    if (attOf(r) === '미룸') dropMoved(r);
    const todo = { from: day, fromId: r.id }; if (r.todo && r.todo[day]) todo[to] = r.todo[day];   // 그날 할 일은 미룬 날로 따라간다
    addRow({ kind: r.kind, s_id: r.s_id, teacher: r.teacher, hour: hour, start_day: to, end_day: clShift(to, 1), note: '', todo: todo, skip: {} }, (nr) => {
      if (!nr) return;
      setKeys(r, { ['att:' + day]: '미룸', ['mv:' + day]: to + '|' + nr.id + '|' + hour });
      say(clMdw(to) + ' ' + (hour - 12) + '시로 미뤘습니다');
    });
  };
  const skipDay = (r) => { const skip = Object.assign({}, r.skip || {}); skip[day] = true; setAsking(null); patchRow(r.id, { skip: skip }); };
  /** 이날부터 전부 빼기 — 이날 넣은 줄이면 지우고, 아니면 이날에서 끊는다(지난 기록은 남는다) */
  const endFrom = (r) => {
    setAsking(null);
    if (r.start_day === day) dropRow(r.id); else patchRow(r.id, { end_day: day });
    // 미뤄서 생긴 줄을 빼면 원래 날의 「미룸」 표시도 거둔다(그 줄은 다른 날이라 화면에 없을 수 있어 다시 읽어 고친다)
    if (clOnce(r) && r.todo.fromId) {
      const f = r.todo.from;
      SB.from('clinic').select('id,todo').eq('id', r.todo.fromId).then(({ data }) => {
        const o = data && data[0]; if (!o || !o.todo) return;
        const todo = Object.assign({}, o.todo); if (String(todo['mv:' + f] || '').split('|')[1] !== r.id) return;
        delete todo['mv:' + f]; delete todo['att:' + f];
        SB.from('clinic').update(Object.assign({ todo: todo }, stamp())).eq('id', o.id).then(({ error }) => { fail(error); });
      });
    }
  };
  // 학생을 고르면 바로 넣지 않고 반복 요일을 묻는다(2026-11-24 사장님 — 예전엔 월·수 / 화·목이 저절로 정해졌다). 기본은 이날 요일 하나.
  // 요일마다 시간을 따로 정한다(같은 날 사장님 — "화요일은 3시 목요일은 8시에 오고 싶을 수 있잖아"). 시간이 다른 요일은 줄을 나눠 넣는다(clGroups).
  const pick = (s, t) => { setQ(''); setPending({ s: s, t: t, days: clDow(day) === 0 ? '' : String(clDow(day)), hours: {}, hour: adding }); };
  /** 요일·시간 칸 → 넣을 줄들. 새 줄은 전부 이날(day)부터다 — 반복 줄은 요일만 보므로 시작일이 그 요일일 필요가 없다. */
  const newRows = (base, days, hours, hour, carry) => clGroups(days, hours, hour).map((g) => {
    const todo = { days: g.days };
    if (carry && (g.days ? g.days.indexOf(String(clDow(day))) >= 0 : true)) Object.assign(todo, carry);   // 이날 적은 것은 이날 오는 줄로
    return Object.assign({}, base, { hour: g.hour, start_day: day, todo: todo, skip: {} });
  });
  const addRows = (list, then) => { let n = list.length; if (!n) { if (then) then(); return; } list.forEach((row) => addRow(row, () => { if (--n === 0 && then) then(); })); };
  const place = () => {
    const pd = pending; if (!pd) return;
    setPending(null); setAdding(null); setQ('');
    addRows(newRows({ kind: curKind === '전체' ? '조교' : curKind, s_id: pd.s.s_id, teacher: pd.t, note: '' }, pd.days, pd.hours, pd.hour, null));
  };
  const pairKey = (r) => clDaysOf(r);
  /** 같은 학생 · 같은 선생님 · 같은 클리닉의 반복 줄들(요일마다 시간이 달라 나뉜 것) — 함께 보이고 함께 바꾼다 */
  const sibsOf = (r) => clOnce(r) ? [r] : (rows || []).filter((x) => x.s_id === r.s_id && x.teacher === r.teacher && x.kind === r.kind && !clOnce(x) && clDaysOf(x)
    && x.start_day <= day && (!x.end_day || x.end_day > day)).concat(clDaysOf(r) ? [] : [r]);
  /** 줄들 → 요일 · 요일별 시간 */
  const schedOf = (list) => { const hours = {}; let days = ''; list.forEach((x) => { const ds = clDaysOf(x); days += ds; ds.split('').forEach((w) => { if (w) hours[w] = x.hour; }); }); return { days: clDaysNorm(days), hours: hours }; };
  const openMove = (r) => { const sb = sibsOf(r), sc = schedOf(sb); setMoving({ id: r.id, ids: sb.map((x) => x.id), pair: sc.days, hours: sc.hours, hour: r.hour }); };
  const doMove = () => {
    const r = (rows || []).filter((x) => x.id === moving.id)[0]; if (!r) { setMoving(null); return; }
    const olds = (rows || []).filter((x) => (moving.ids || [r.id]).indexOf(x.id) >= 0);
    // 이날 적어 둔 것(할 일 · 조교 비고)은 이날 오는 새 줄로 따라간다
    const carry = {}; olds.forEach((o) => { if (!clOnDay(o, day) || !o.todo) return; ['', 'note:'].forEach((p) => { if (o.todo[p + day]) carry[p + day] = o.todo[p + day]; });
      if (o.kind !== '담임' && !carry['note:' + day] && clNoteOn(o, day)) carry['note:' + day] = clNoteOn(o, day); });
    setMoving(null);
    // 비고: 담임은 그대로 옮기고, 조교는 이어지지 않으므로 옮기지 않는다
    addRows(newRows({ kind: r.kind, s_id: r.s_id, teacher: r.teacher, note: r.kind === '담임' ? (r.note || '') : '' }, moving.pair, moving.hours, moving.hour, carry),
      () => olds.forEach((o) => endFrom(o)));
  };

  // 바깥을 누르면 닫는다 · 좌우 화살표로 하루씩
  useEffect(() => {
    const down = (e) => {
      const t = e.target; if (!t || !t.closest) return;
      if (adding != null && !t.closest('.cl-add')) { setAdding(null); setQ(''); setPending(null); }
      if (asking != null && !t.closest('.cl-ask') && !t.closest('.cl-x')) setAsking(null);
      if (moving && !t.closest('.cl-mv') && !t.closest('.cl-nm')) setMoving(null);
      if (postpone && !t.closest('.cl-pp') && !t.closest('.cl-att')) setPostpone(null);
      if (cal && !t.closest('.cl-dwrap')) setCal(false);
    };
    const key = (e) => {
      if (e.key === 'Escape' && cal) { setCal(false); return; }
      if (e.key === 'Escape' && (moving || asking != null || postpone || pending)) { setMoving(null); setAsking(null); setPostpone(null); setPending(null); return; }
      if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowLeft') setDay(clShift(day, -1));
      if (e.key === 'ArrowRight') setDay(clShift(day, 1));
    };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [adding, asking, moving, postpone, pending, day, cal]);

  const tag = (t) => <span className="cl-tag" style={{ background: colorOf(t) }}>{subjOf[t] ? <i>{subjOf[t]}</i> : null}{t}</span>;
  const telOf = (s) => {
    if (!s) return null;
    const own = rsPhone(s.s_hp), par = rsPhone(s.p_hp1);
    if (own) return <a href={'tel:' + String(s.s_hp).replace(/\D/g, '')}>{own}</a>;
    if (par) return <React.Fragment><a href={'tel:' + String(s.p_hp1).replace(/\D/g, '')}>{par}</a><small>학부모</small></React.Fragment>;
    return <span style={{ color: K.muted }}>번호 없음</span>;
  };
  // 추가 목록 — 학생 × 담임(영어·수학을 다 들으면 두 줄). 아무것도 안 쳤으면 없다. 그날 이미 든 학생(그 선생님 것)은 안 뜬다.
  const hits = () => {
    const out = [];
    if (!q.trim()) return out;
    students.forEach((s) => { if (!clNameHit(s.name, q)) return; s.cl_teachers.forEach((t) => {
      if (onDayAll.some((r) => r.s_id === s.s_id && r.teacher === t)) return;
      out.push([s, t]); }); });
    return out.sort((a, b) => String(a[0].name).localeCompare(String(b[0].name), 'ko')).slice(0, 9);
  };
  // 요일 칩 — 여러 개 고른다. 하나도 안 고르면 그날 하루뿐.
  const dayChips = (val, set) => (
    <div className="cl-seg cl-days">{CL_PICK.map((w) => { const on = String(val).indexOf(String(w)) >= 0;
      return <button key={w} className={on ? 'on' : ''} onClick={() => set(clDaysNorm(on ? String(val).replace(String(w), '') : val + w))}>{CL_WD[w]}</button>; })}</div>
  );
  const hourSeg = (val, set) => <div className="cl-seg">{CL_HOURS.map((h) => <button key={h} className={val === h ? 'on' : ''} onClick={() => set(h)}>{h - 12}시</button>)}</div>;
  // 요일 칩 + (요일을 골랐으면) 요일마다 시간 줄, (안 골랐으면) 그날 하루의 시간 하나
  const schedPick = (st0, set) => {
    const days = clDaysNorm(st0.pair);
    return (
      <React.Fragment>
        <div className="lb">반복 요일</div>
        {dayChips(st0.pair, (v) => set({ pair: v }))}
        <div className="lb">{days ? '요일별 시간' : '시간 (이날 하루만)'}</div>
        {days ? days.split('').map((w) => (
          <div key={w} className="cl-dh"><span>{CL_WD[+w]}</span>{hourSeg(st0.hours[w] || st0.hour, (h) => set({ hours: Object.assign({}, st0.hours, { [w]: h }) }))}</div>
        )) : hourSeg(st0.hour, (h) => set({ hour: h }))}
      </React.Fragment>
    );
  };
  const schedText = (days, hours, hour) => days ? '매주 ' + clSchedLabel(days, hours, hour) : '이날 하루만 ' + (hour - 12) + '시';
  const moveBox = (r, s) => {
    const days = clDaysNorm(moving.pair);
    const now = schedOf((rows || []).filter((x) => (moving.ids || []).indexOf(x.id) >= 0));
    const same = clDaysOf(r) ? days === now.days && clSchedLabel(days, moving.hours, moving.hour) === clSchedLabel(now.days, now.hours, r.hour)
      : !days && moving.hour === r.hour;
    return (
      <div className="cl-mv">
        <h4>{(s && s.name) || ''}<small>{r.kind} 클리닉 요일 · 시간 바꾸기</small></h4>
        {schedPick(moving, (o) => setMoving(Object.assign({}, moving, o)))}
        <div className="to">{same ? '지금 요일 · 시간입니다' : <React.Fragment><b>{clMdw(day)}</b>부터 <b>{schedText(days, moving.hours, moving.hour)}</b>로 바꿉니다</React.Fragment>}</div>
        <div className="acts"><button className="cancel" onClick={() => setMoving(null)}>취소</button><button className="go" disabled={same} onClick={doMove}>바꾸기</button></div>
      </div>
    );
  };
  // 학생을 고른 뒤 반복 요일 · 시간 묻기
  const placeBox = () => {
    const days = clDaysNorm(pending.days);
    const pv = { pair: pending.days, hours: pending.hours, hour: pending.hour };
    return (
      <div className="cl-mv cl-place">
        <h4>{pending.s.name}<small>{pending.t}T</small></h4>
        {schedPick(pv, (o) => setPending(Object.assign({}, pending, o.pair != null ? { days: o.pair } : o)))}
        <div className="to"><b>{clMdw(day)}</b>부터 <b>{schedText(days, pending.hours, pending.hour)}</b>에 옵니다</div>
        <div className="acts"><button className="cancel" onClick={() => setPending(null)}>다시 고르기</button><button className="go" onClick={place}>넣기</button></div>
      </div>
    );
  };

  const nowH = new Date().getHours();
  const shown = wk ? CL_KINDS : ['조교'];
  const mode = curKind === '전체' ? '클리닉' : curKind + ' 클리닉';
  const vars = { '--surface': K.surface, '--raised': K.raised, '--active': K.active, '--border': K.border, '--rule': K.rule, '--control': K.control, '--text': K.text, '--muted': K.muted, '--ink': K.ink, '--inkText': K.inkText, '--neg': K.neg };
  const ready = aca !== null && rows !== null;

  return (
    <div data-root="" className="cl" style={Object.assign({ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }, vars)}>
      <style>{CL_CSS}</style>
      <nav className="cl-nav">
        {/* 제목이 곧 캡슐 — 평소엔 「조교 클리닉」 글자, 금·토에는 그 자리에서 담임 · 조교 · 전체 캡슐로 늘어난다 */}
        <span className={'cl-cap' + (wk ? '' : ' solo')} data-nopop="">
          <span className="thumb" style={{ left: (2 + Math.max(0, shown.indexOf(curKind)) * 96) + 'px' }}></span>
          {CL_KINDS.map((k) => (
            <button key={k} className={(k === curKind ? 'on' : '') + (shown.indexOf(k) < 0 ? ' gone' : '')} tabIndex={shown.indexOf(k) < 0 || !wk ? -1 : 0}
              onClick={() => { if (!wk) return; closeAll(); setKind(k); }}>
              <span className="n">{k === '전체' ? '전체' : k + ' 클리닉'}</span><span className="b" aria-hidden="true">{k === '전체' ? '전체' : k + ' 클리닉'}</span>
            </button>
          ))}
        </span>
        <span className="cl-day">
          <button className="arrow" title="전날" onClick={() => setDay(clShift(day, -1))}>‹</button>
          <span className="cl-dwrap">
            <button className={'pick' + (cal ? ' open' : '')} title="날짜 고르기" onClick={() => { const o = !cal; closeAll(); setCal(o); }}>{clMdw(day)}</button>
            {cal ? <ClCalendar value={day} today={today} onPick={(d) => setDay(d)} /> : null}
          </span>
          <button className="arrow" title="다음 날" onClick={() => setDay(clShift(day, 1))}>›</button>
          <button className="cl-btn" style={{ marginLeft: '4px', visibility: day === today ? 'hidden' : 'visible' }} onClick={() => setDay(today)}>오늘</button>
        </span>
        <span className="cl-sum">
          {!ready ? '' : list.length ? <React.Fragment>{day === today ? '오늘 ' : '이날 '}{mode} <b>{list.length}명</b>{list.length < inKind.length ? ' · 가린 ' + (inKind.length - list.length) + '명' : ''}
            {['출석', '결석', '미룸'].map((a) => { const n = list.filter((r) => attOf(r) === a).length; return n ? <span key={a}> · {a === '결석' ? '무단결석' : a} {n}</span> : null; })}</React.Fragment>
            : inKind.length ? '전부 가려져 있습니다' : '잡힌 ' + mode + '이 없습니다'}
        </span>
      </nav>

      {err && <div style={{ flex: 'none', margin: '14px 20px 0', padding: '12px 14px', borderRadius: K.rCtl + 'px', background: K.surface, border: '1px solid ' + K.neg, fontSize: '13px', color: K.neg }}>{err}</div>}

      <div className="cl-main">
        {!ready ? <SlLoading text="불러오는 중…" /> : (
          <React.Fragment>
            <div className="cl-legend">
              {legendNames.map((t) => (
                <label key={t} className={'cl-chk' + (hidden[t] ? ' off' : '')} style={{ background: colorOf(t) }}>
                  <input type="checkbox" checked={!hidden[t]} onChange={(e) => setHidden(t, !e.target.checked)} />
                  {subjOf[t] ? <i>{subjOf[t]}</i> : null}{t}T <b>{cnt[t] || 0}</b>
                </label>
              ))}
              {!legendNames.length && <span style={{ fontSize: '13px', color: K.muted }}>{CL_BRANCH} 반이 없습니다.</span>}
            </div>
            <div className="cl-card" data-pop-quiet="">
              {CL_HOURS.map((h) => {
                const kids = list.filter((r) => r.hour === h);
                const isNow = day === today && nowH === h, past = day < today || (day === today && nowH > h);
                const found = adding === h ? hits() : [];
                return (
                  <div key={h} className={'cl-slot' + (past ? ' past' : '')}>
                    <div className="cl-hour"><div className="h">{h - 12}시</div><div className="r">{h - 12}:00 – {h - 11}:00</div>{isNow ? <div className="now">지금</div> : null}</div>
                    <div className="cl-kids">
                      {kids.length ? <div className="cl-head"><span>담임</span><span>이름</span><span>전화번호</span><span>출결</span><span>강사 요청</span><span>비고</span><span></span></div> : null}
                      {kids.map((r, i) => {
                        const s = stuOf(r.s_id), rep = clRepeat(r);
                        const gap = i > 0 && sjRank(kids[i - 1].teacher) !== sjRank(r.teacher);
                        const mv = moving && moving.id === r.id;
                        const att = attOf(r), moved = mvOf(r), pp = postpone && postpone.id === r.id;
                        const sb = rep ? sibsOf(r) : [r], sc = sb.length > 1 ? schedOf(sb) : null;   // 요일마다 시간이 다르면 전체 일정('화 4시 · 목 8시')
                        const sub = [(s && s.grade) || '', sc ? clSchedLabel(sc.days, sc.hours, r.hour) : rep, clOnce(r) ? clMd(r.todo.from) + '에서 미룸' : '', curKind === '전체' ? r.kind : '', s && s.gone ? '퇴원' : ''].filter(Boolean).join(' · ');
                        return (
                          <div key={r.id} className={'cl-row' + (gap ? ' gap' : '') + (asking === r.id ? ' asking' : '') + (mv ? ' moving' : '') + (att === '결석' || att === '미룸' ? ' away' : '')}>
                            <div className="cl-who">{tag(r.teacher)}</div>
                            <div className="cl-name">
                              <button className="cl-nm" title="시간 옮기기" onClick={() => { setAsking(null); setAdding(null); if (mv) setMoving(null); else openMove(r); }}>{(s && s.name) || '…'}</button>
                              <small>{sub}</small>
                            </div>
                            <div className="cl-tel">{telOf(s)}</div>
                            <div className="cl-att">
                              <div className="seg">
                                <button className={att === '출석' ? 'on' : ''} onClick={() => setAtt(r, '출석')}>출석</button>
                                <button className={att === '결석' ? 'on neg' : ''} title="무단결석" onClick={() => setAtt(r, '결석')}>무단결석</button>
                                <button className={att === '미룸' ? 'on' : ''} title={moved ? clMdw(moved.to) + '로 미룸 — 누르면 풉니다' : '다른 날 같은 시간으로 하루만 미룹니다'}
                                  onClick={() => { if (att === '미룸') { setAtt(r, '미룸'); return; } setAsking(null); setMoving(null); setAdding(null); setPostpone(pp ? null : { id: r.id, to: nextDay(), hour: r.hour }); }}>
                                  {att === '미룸' && moved ? clMd(moved.to) + (moved.hour ? ' ' + (moved.hour - 12) + '시' : '') + ' 미룸' : '미루기'}
                                </button>
                              </div>
                              {pp ? (
                                <div className="cl-pp">
                                  <h4>{(s && s.name) || ''} 미루기</h4>
                                  <div className="lb">날짜</div>
                                  <input type="date" value={postpone.to} min={day} onChange={(e) => setPostpone(Object.assign({}, postpone, { to: e.target.value }))} />
                                  <div className="lb">시간</div>
                                  <div className="cl-seg">{CL_HOURS.map((hh) => <button key={hh} className={postpone.hour === hh ? 'on' : ''} onClick={() => setPostpone(Object.assign({}, postpone, { hour: hh }))}>{hh - 12}시</button>)}</div>
                                  {(() => { const ok = postpone.to && (postpone.to > day || (postpone.to === day && postpone.hour !== r.hour));
                                    return <React.Fragment>
                                      <div className="to">{ok ? <React.Fragment><b>{clMdw(postpone.to)} {postpone.hour - 12}시</b>에 하루만 나옵니다.{rep ? ' 그다음부터는 원래대로 ' + rep + '에 옵니다.' : ''}</React.Fragment> : postpone.to === day ? '같은 날이면 다른 시간을 고르세요.' : '이날이나 그 뒤의 날짜를 고르세요.'}</div>
                                      <div className="acts"><button className="cancel" onClick={() => setPostpone(null)}>취소</button><button className="go" disabled={!ok} onClick={doPostpone}>미루기</button></div>
                                    </React.Fragment>; })()}
                                </div>
                              ) : null}
                            </div>
                            <div className="todo">{canReq ? <ClText value={(r.todo && r.todo[day]) || ''} placeholder="강사 요청" onSave={(v) => saveTodo(r, v)} />
                              : <div className="ro" title="강사만 적습니다">{(r.todo && r.todo[day]) || ''}</div>}</div>
                            <div className="note"><ClText value={clNoteOn(r, day)} placeholder="비고" onSave={(v) => saveNote(r, v)} /></div>
                            <button className="cl-x" title="빼기" onClick={() => { setMoving(null); setAdding(null); setAsking(asking === r.id ? null : r.id); }}>×</button>
                            {asking === r.id ? (
                              <div className="cl-ask">
                                {rep ? <button onClick={() => skipDay(r)}>이날만 빼기<small>다음 {rep.replace('매주 ', '주 ')}에는 그대로 옵니다</small></button> : null}
                                <button onClick={() => endFrom(r)}>{rep ? '이날부터 전부 빼기' : '빼기'}{rep ? <small>앞으로 저절로 생기지 않습니다</small> : null}</button>
                              </div>
                            ) : null}
                            {mv ? moveBox(r, s) : null}
                          </div>
                        );
                      })}
                      <div className="cl-add">
                        {adding === h && pending ? placeBox() : adding === h ? (
                          <React.Fragment>
                            <div className="cl-find">
                              <input autoFocus value={q} placeholder="이름 또는 초성" autoComplete="off" onChange={(e) => setQ(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(null); setQ(''); } if (e.key === 'Enter' && !e.nativeEvent.isComposing && found.length) pick(found[0][0], found[0][1]); }} />
                              <span>Esc 로 닫기</span>
                            </div>
                            {q.trim() ? (
                              <div className="cl-pop">
                                {found.length ? found.map((o, i) => (
                                  <button key={o[0].s_id + '|' + o[1]} className={i === 0 ? 'on' : ''} onClick={() => pick(o[0], o[1])}>{o[0].name}<small>{o[0].grade || ''}</small>{tag(o[1])}</button>
                                )) : <div className="none">맞는 학생이 없습니다</div>}
                              </div>
                            ) : null}
                          </React.Fragment>
                        ) : <button onClick={() => { setAsking(null); setMoving(null); setQ(''); setPending(null); setAdding(h); }}>+ 학생 추가</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cl-foot">
              학생을 넣을 때 고른 반복 요일 · 요일별 시간에 이어집니다(요일을 하나도 안 고르면 그날 하루만). 이름을 누르면 요일 · 시간을 바꿉니다. 저절로 생긴 날의 「강사 요청」과 조교 클리닉의 비고는 비어 있습니다(담임 클리닉의 비고는 이어집니다).
              예전에 넣은 학생은 예전 규칙(조교 = 월·수 / 화·목 짝, 담임 = 매주 그 요일)대로 이어집니다.
              「미루기」는 고른 날 · 시간에 하루만 나오고, 그다음부터는 원래 요일로 돌아갑니다. 지금은 {CL_BRANCH}만 씁니다.
            </div>
          </React.Fragment>
        )}
      </div>

      {toast && <div style={{ position: 'fixed', left: '50%', bottom: '34px', transform: 'translateX(-50%)', background: K.ink, color: K.inkText, fontSize: '13px', padding: '10px 18px', borderRadius: K.rCtl + 'px', zIndex: 99 }}>{toast}</div>}
    </div>
  );
}
