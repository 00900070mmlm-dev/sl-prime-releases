// ============================================================
// 레포트 — 학부모 레포트 발행 (홈 → 레포트)
//
// 2026-11-12 사장님: "선생님이 본인 반 선택하고 레포트 발행 버튼을 누르면 우리가 만들어 뒀던 학부모 레포트
// 링크에 올라가는 방식" · "선생님은 레포트에 포함시킬 기간을 선택할 수 있어야 해" · "수학과 영어는 따로" ·
// 담는 것 = 점수 + 취약한 유형 + 잘한 유형 + 보완할 점 + 취약한 지문 + 기간 동안의 상담기록 요약(학생이 비밀로 한 건 제외) ·
// "AI 가 거르고, 선생님이 레포트를 전반적으로 수정할 수 있게 자유도를 높게".
//
// 흐름: 과목 → 반 → 기간 → `초안 만들기` → 학생별 초안(점수는 자동, 글은 항목 단위로 전부 고칠 수 있다) → `레포트 발행`.
//   · 초안은 주간테스트 성적(weekly_tests · weekly_scores)과 상담기록(aca_counsel)에서 만든다. 이 앱은 그 둘을 읽기만 한다.
//   · 화면은 세 칸 — ① 반 트리(과목 → 급 → 학교 → 학년 → 반 · 수학과 중등은 급 → 학년 → 반, 주간테스트 관리와 같은 waTree) ② 학생 ③ 고치기.
//   · 반은 여럿 고를 수 있다(트리에서 누르고 칩으로 뺀다). 두 반에 다 있는 학생은 한 번만 나온다 — 먼저 고른 반 밑에.
//   · 발행하면 report_issues 에 학생당 한 줄(과목 + 기간이 같으면 덮어쓴다). 학부모 페이지(web/report)는 발행된 것만 보여 준다.
//   · 글 항목은 { title, body } 의 목록이다 — 제목·내용을 고치고, 더하고, 빼고, 순서를 바꿀 수 있다. **내용이 빈 항목은 발행에 안 들어간다.**
//   · 상담 요약은 Claude 가 만든다(rpCounselSummary). 비밀로 해 달라고 한 것·사적인 고민·행정 내부 사정을 빼라고 시키지만,
//     **AI 만 믿고 내보내지 않는다** — 원문을 옆에 보여 주고(학부모에게는 안 나간다) 선생님이 고친 뒤 발행한다.
//   · 수학(PDF 시험지)은 유형·지문 정보가 없어 그 항목들이 비어 나온다 — 점수와 선생님이 적은 글만 나간다.
// 스키마: scripts/report_publish_schema.sql. 상담기록 동기화: scripts/aca-counsel-sync.mjs.
// ============================================================

const RP_MODEL = 'claude-opus-5-5';
const RP_POOL = 4;
/** 취약 유형별 '보완할 점' 초안 문장. 약속("수업에서 보강합니다")은 적지 않는다 — 선생님이 직접 적을 일이다. */
const RP_ADVICE = {
  '어법': '문장에서 주어와 동사를 먼저 찾고, 밑줄 친 부분이 어떤 문법 요소인지 근거를 대며 푸는 연습이 필요합니다.',
  '어휘': '지문의 단어를 문맥 속에서 다시 정리하고, 반의어가 들어갈 만한 자리를 의심하며 읽는 연습이 필요합니다.',
  '대의': '첫 문장과 마지막 문장, 반복되는 핵심어를 표시하며 글의 주제를 한 문장으로 말해 보는 연습이 필요합니다.',
  '일치': '선지를 먼저 읽고 지문에서 해당 부분을 찾아 한 줄씩 대조하는 습관이 필요합니다.',
  '빈칸': '빈칸 앞뒤 문장의 논리 관계를 확인하고, 글 전체의 주제와 연결해 답을 고르는 연습이 필요합니다.',
  '무관': '글의 주제를 먼저 잡은 뒤, 각 문장이 그 주제를 뒷받침하는지 하나씩 확인하는 연습이 필요합니다.',
  '순서': '지시어·연결어·관사(a → the)를 단서로 단락의 앞뒤를 맞추는 연습이 필요합니다.',
  '삽입': '주어진 문장의 지시어와 연결어를 단서로, 글의 흐름이 끊기는 자리를 찾는 연습이 필요합니다.',
  '요약': '글의 핵심 내용을 한 문장으로 줄여 보고, 요약문의 빈칸이 본문의 어떤 표현을 바꾼 것인지 확인하는 연습이 필요합니다.',
  '지칭': '대명사가 나올 때마다 가리키는 대상을 표시하며 읽는 연습이 필요합니다.',
  '심경': '인물의 감정을 드러내는 형용사·부사에 표시하며 상황의 변화를 따라 읽는 연습이 필요합니다.',
  '영작': '본문 문장을 우리말만 보고 다시 써 보는 연습으로 문장 구조를 익혀야 합니다.',
  '배열': '주어·동사부터 세우고 수식어를 붙여 나가는 순서로 문장을 조립하는 연습이 필요합니다.',
  '오류수정': '틀린 부분을 찾는 데서 그치지 않고, 왜 틀렸는지 문법 근거를 적어 보는 연습이 필요합니다.',
};
function rpYmd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function rpShift(ymd, days) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + days); return rpYmd(d); }
function rpMd(ymd) { const p = String(ymd || '').split('-'); return p.length === 3 ? Number(p[1]) + '/' + Number(p[2]) : ''; }
function rpRound1(n) { return Math.round(n * 10) / 10; }
function rpNum(v) { return (v === '' || v == null || isNaN(Number(v))) ? null : Number(v); }
let rpSeq = 0;
function rpSec(title, body) { rpSeq += 1; return { id: 'sec' + rpSeq, title: title, body: body || '' }; }

/** 학생 한 명의 초안 — 점수·유형·지문은 여기서 계산하고, 글은 항목(sections)의 초안으로 풀어 적는다. */
function rpDraft(stu, cls, tests, scores) {
  const mine = (r) => r.s_id === stu.s_id || (r.s_id == null && r.student === stu.name && r.klass === cls.name);
  const rows = [];          // 주차별 한 줄
  const typeTot = {}, typeWrong = {}, srcTot = {}, srcWrong = {};
  let graded = 0;
  tests.forEach((t) => {
    const all = scores.filter((r) => r.test_id === t.id && !r.excluded);
    const me = scores.find((r) => r.test_id === t.id && mine(r));
    if (me && me.excluded) return;                       // 수준별로 빠진 시험지 — 그 학생 시험이 아니다
    const cs = all.filter((r) => r.klass === cls.name).map((r) => rpNum(r.score)).filter((n) => n != null);
    const sc = me ? rpNum(me.score) : null;
    rows.push({ week_start: t.week_start, label: waWeekName(t.week_start), range: t.range_text || '', score: sc,
      class_avg: cs.length ? rpRound1(cs.reduce((a, b) => a + b, 0) / cs.length) : null });
    // 유형·지문은 채점 링크로 채점한 시험에서만 안다(wrong 이 있는 줄)
    const items = (t.payload && t.payload.items) || [];
    if (!me || !Array.isArray(me.wrong) || sc == null || !items.length) return;
    graded += 1;
    const wrongNo = {}; me.wrong.forEach((w) => { wrongNo[w.no] = true; });
    items.forEach((it, i) => {
      const no = it.no != null ? Number(it.no) : i + 1;
      const ty = it.aiType || '', src = String(it.source || '').trim();
      if (ty && ty !== '기타') { typeTot[ty] = (typeTot[ty] || 0) + 1; if (wrongNo[no]) typeWrong[ty] = (typeWrong[ty] || 0) + 1; }
      if (src) { srcTot[src] = (srcTot[src] || 0) + 1; if (wrongNo[no]) srcWrong[src] = (srcWrong[src] || 0) + 1; }
    });
  });
  const taken = rows.filter((r) => r.score != null);
  const avg = taken.length ? rpRound1(taken.reduce((a, r) => a + r.score, 0) / taken.length) : null;
  const cav = taken.filter((r) => r.class_avg != null);
  const classAvg = cav.length ? rpRound1(cav.reduce((a, r) => a + r.class_avg, 0) / cav.length) : null;

  const types = Object.keys(typeTot).map((k) => { const w = typeWrong[k] || 0; return { type: k, total: typeTot[k], right: typeTot[k] - w, acc: (typeTot[k] - w) / typeTot[k] }; });
  const line = (x) => x.type + ' — ' + x.total + '문항 중 ' + x.right + '문항 정답 (' + Math.round(x.acc * 100) + '%)';
  const strong = types.filter((x) => x.total >= 2 && x.acc >= 0.8).sort((a, b) => b.acc - a.acc || b.total - a.total).slice(0, 4);
  const weak = types.filter((x) => x.total >= 2 && x.acc < 0.6).sort((a, b) => a.acc - b.acc || b.total - a.total).slice(0, 4);
  const srcs = Object.keys(srcWrong).map((k) => ({ src: k, total: srcTot[k], wrong: srcWrong[k] }))
    .filter((x) => x.wrong >= 2 || (x.total >= 2 && x.wrong === x.total)).sort((a, b) => b.wrong - a.wrong || (b.wrong / b.total) - (a.wrong / a.total)).slice(0, 4);
  const advice = weak.slice(0, 2).map((x) => RP_ADVICE[x.type] ? '· ' + x.type + ': ' + RP_ADVICE[x.type] : '').filter(Boolean);
  if (rows.length && rows.length - taken.length >= 2) advice.push('· 기간 중 ' + (rows.length - taken.length) + '회 미응시가 있었습니다. 시험에 빠지지 않고 응시하는 것이 우선입니다.');

  return {
    s_id: stu.s_id, name: stu.name, on: true, showScores: true,
    scores: rows, avg: avg, class_avg: classAvg, taken: taken.length, total: rows.length, graded: graded,
    sections: [
      rpSec('잘한 유형', strong.map(line).join('\n')),
      rpSec('취약한 유형', weak.map(line).join('\n')),
      rpSec('취약한 지문', srcs.map((x) => x.src + ' — ' + x.total + '문항 중 ' + x.wrong + '문항 오답').join('\n')),
      rpSec('보완할 점', advice.join('\n')),
      rpSec('출결', ''),                  // 고른 기간의 결석·지각 — 초안 만들 때 출석부(attendance)에서 채운다
      rpSec('담임선생님의 한마디', ''),   // 늘 있는 칸(2026-11-12 사장님). 비워 두면 다른 빈 항목처럼 발행에 안 들어간다
      rpSec('상담 요약', ''),
    ],
    counsel: [], ai: '', aiErr: '',
  };
}

/** 상담기록 → 학부모에게 보낼 요약. 비밀·사적인 것·내부 사정을 뺀다. 남길 게 없으면 ''. */
async function rpCounselSummary(key, name, recs, signal) {
  const src = recs.map((r) => '[' + r.cs_date + ' · ' + (r.cs_with || '') + ' 상담 · ' + (r.cs_type || '') + (r.cs_subj ? ' · ' + r.cs_subj : '') + ']\n' + (r.cs_cont || '')).join('\n\n');
  const data = await acCall(key, RP_MODEL, {
    max_tokens: 1024,
    system: '너는 학원이 학부모에게 보내는 학습 레포트의 "상담 요약" 칸을 쓰는 사람이다. 주어진 상담기록에 있는 사실만 쓴다. 지어내지 않는다.',
    messages: [{ role: 'user', content: [
      '아래는 ' + name + ' 학생의 상담기록이다(강사가 내부용으로 적은 원문). 학부모가 읽을 요약을 써라.', '',
      '[쓰는 것] 학습 태도·과제·성적과 목표·학습 계획·학원과 학생(또는 학부모)이 합의한 것.',
      '[반드시 빼는 것]',
      '  · 학생이 비밀로 해 달라고 했거나 부모님께 말하지 말아 달라고 한 내용, 그리고 그런 부탁이 있었다는 사실 자체',
      '  · 학생이 털어놓은 사적인 고민(가정사·교우관계·이성 문제·건강·심리 상태 등) — 부탁이 없었어도 뺀다',
      '  · 학부모에 대한 강사의 평가나 내부 메모, 수납·환불·퇴원·전반 같은 행정 사정',
      '  · 다른 학생과 강사의 실명',
      '[형식] 한국어 존댓말 서술체(~했습니다) 2~4문장. 머리말·목록·따옴표 없이 본문만. 날짜는 안 적어도 된다.',
      '[남길 것이 없으면] 정확히 "없음" 한 단어만 답한다.',
      '', '=== 상담기록 ===', src.slice(0, 12000),
    ].join('\n') }],
  }, signal);
  const txt = ((data && data.content) || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  return /^없음[.。]?$/.test(txt) ? '' : txt;
}

function ReportApp({ dark, userName, onHome }) {
  const T = THEME(dark);
  const K = TT(dark);   // taste(2026-11-12) — 앱 화면 크롬만. 학부모 레포트 페이지(web/report)는 이 파일 밖이다
  const today = rpYmd(new Date());
  const [aca, setAca] = useState(null);
  const [err, setErr] = useState('');
  const [subject, setSubject] = useState('영어');
  const [branch, setBranchRaw] = useState(waLoadBranch);   // 지점(원당점 · 이음점) — 반 트리 맨 위
  const [allCls, setAllCls] = useState(false);
  const [level, setLevel] = useState(null);         // 급 캡슐(초등·중등·고등) — 주간테스트 관리와 같은 트리
  const [openSchool, setOpenSchool] = useState(null);
  const [openGrade, setOpenGrade] = useState(null);  // '학교|학년'
  const [classIds, setClassIds] = useState([]);     // 반 **중복 선택**(2026-11-12 사장님) — 여러 반을 한 번에 초안·발행한다
  const [from, setFrom] = useState(rpShift(today, -27));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState('');             // 진행 중인 일의 이름('' = 없음)
  const [drafts, setDrafts] = useState(null);       // 학생별 초안 | null = 아직 안 만듦
  const [meta, setMeta] = useState(null);           // 초안을 만든 조건 { subject, classes, from, to, tests }
  const [sel, setSel] = useState(null);             // 고른 학생 s_id
  const [issued, setIssued] = useState({});         // s_id → 발행 시각(같은 과목·기간)
  const [toast, setToast] = useState('');
  const [note, setNote] = useState('');             // 초안 위 안내(상담기록 못 읽음 등)
  const [showRaw, setShowRaw] = useState(false);
  // 발행 내역 — 지금 학부모에게 보이는 레포트 전부. 여기서 골라 지운다(2026-11-12 사장님 — "레포트 삭제도 할 수 있게").
  const [hist, setHist] = useState(null);           // null = 닫힘 | { rows | null(로딩), q, picked: {id: true} }
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  useEffect(() => {
    Promise.all([
      SB.from('aca_student').select('s_id,name,grade,state,school,class_ids').eq('state', '재원').limit(2000),
      SB.from('aca_class').select('c_id,name,subjects,teachers,deleted').limit(2000),
    ]).then(([a, b]) => {
      if (a.error || b.error) { setErr(waErrText(a.error || b.error)); setAca({ students: [], classes: [] }); return; }
      setAca({ students: a.data || [], classes: b.data || [] });
    });
  }, []);
  const classes = (aca && aca.classes) || [];
  const students = (aca && aca.students) || [];
  const headN = (c) => students.filter((s) => (s.class_ids || []).indexOf(c.c_id) >= 0).length;
  // 반 고르기 = 주간테스트 관리와 같은 트리(급 → 학교 → 학년 → 반, 여러 반 · 수학과 중등은 학교 층 없이 급 → 학년 → 반). 만드는 함수도 그쪽 것을 그대로 쓴다(waTree).
  const tree = aca ? waTree(students, classes, !allCls, userName, subject, branch) : [];
  const setBranch = (b) => { setBranchRaw(b); setClassIds([]); setLevel(null); setOpenSchool(null); setOpenGrade(null); };
  const levels = WA_LEVELS.map((lv) => ({ level: lv, schools: tree.filter((x) => waSchoolLevel(x.name, x.grades) === lv) })).filter((x) => x.schools.length);
  const curLevel = (level && levels.some((x) => x.level === level)) ? level : (levels[0] || {}).level;
  const shownSchools = (levels.filter((x) => x.level === curLevel)[0] || { schools: [] }).schools;
  const toggleClass = (id) => setClassIds((cur0) => cur0.indexOf(id) >= 0 ? cur0.filter((x) => x !== id) : cur0.concat([id]));
  const selCls = classIds.map((id) => classes.find((c) => c.c_id === id)).filter(Boolean).sort(waClassCmp);
  const clsKey = (list) => list.map((c) => c.c_id).sort().join(',');
  const metaName = meta ? meta.classes.map((c) => c.name).join(', ') : '';
  const dirty = !!drafts && !!meta && (meta.subject !== subject || clsKey(meta.classes) !== clsKey(selCls) || meta.from !== from || meta.to !== to);

  // ── 초안 만들기 ─────────────────────────────────────────────────
  const build = () => {
    if (!selCls.length) return say('반을 고르세요');
    if (!from || !to || from > to) return say('기간을 확인하세요');
    setBusy('초안 만드는 중…'); setErr(''); setNote('');
    // 학생 = 고른 반들의 합집합. 두 반에 다 있는 학생은 **한 번만**(발행은 학생·과목·기간에 한 줄이다) —
    // 먼저 고른 반에 넣고, 시험은 그 학생이 속한 고른 반 것을 다 본다.
    const picked = selCls.slice();
    const cids = picked.map((c) => c.c_id);
    const kids = [];
    picked.forEach((c) => students.filter((s) => (s.class_ids || []).indexOf(c.c_id) >= 0).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      .forEach((s) => { if (!kids.some((k) => k.stu.s_id === s.s_id)) kids.push({ stu: s, cls: c }); }));
    const ids = kids.map((k) => k.stu.s_id);
    // 주(월요일)가 기간에 걸친 시험지 — 그 주 월~일 중 하루라도 기간 안이면 넣는다
    SB.from('weekly_tests').select('id,title,week_start,range_text,class_ids,payload')
      .overlaps('class_ids', cids).gte('week_start', rpShift(from, -6)).lte('week_start', to).order('week_start')
      .then(({ data: tests, error }) => {
        if (error) throw new Error(waErrText(error));
        tests = tests || [];
        const tids = tests.map((t) => t.id);
        return Promise.all([
          tids.length ? SB.from('weekly_scores').select('test_id,klass,student,s_id,score,wrong,graded_at,excluded').in('test_id', tids).limit(5000) : Promise.resolve({ data: [] }),
          SB.from('aca_counsel').select('cns_id,s_id,cs_date,p_name,cs_type,cs_subj,cs_cont,cs_with').in('s_id', ids).gte('cs_date', from).lte('cs_date', to).order('cs_date').limit(2000),
          SB.from('report_issues').select('s_id,published_at').in('s_id', ids).eq('subject', subject).eq('period_from', from).eq('period_to', to),
          // 출결 — 고른 기간의 결석·지각(2026-11-12 사장님). 출석부의 '결'·'지각' 칸만 센다
          SB.from('attendance').select('s_id,c_id,value').in('s_id', ids).in('c_id', cids).in('value', ['결', '지각'])
            .gte('day', from).lte('day', to).limit(5000),
        ]).then(([sc, cn, iss, at]) => {
          if (sc.error) throw new Error(waErrText(sc.error));
          const notes = [];
          if (cn.error) notes.push('상담기록을 읽지 못했습니다 — 상담 요약 없이 만들었습니다(scripts/report_publish_schema.sql 실행 · 상담기록 동기화 확인).');
          if (at.error) notes.push('출석부를 읽지 못했습니다 — 출결 없이 만들었습니다.');
          if (iss.error) notes.push('발행 표가 아직 없습니다 — scripts/report_publish_schema.sql 을 실행해야 발행할 수 있습니다.');
          if (!tests.length) notes.push('이 기간에 고른 반에 등록된 시험지가 없습니다.');
          const ds = kids.map((k) => {
            const own = (k.stu.class_ids || []).filter((id) => cids.indexOf(id) >= 0);
            const d = rpDraft(k.stu, k.cls, tests.filter((t) => (t.class_ids || []).some((id) => own.indexOf(id) >= 0)), sc.data || []);
            d.klass = k.cls.name; d.c_id = k.cls.c_id;
            d.counsel = ((cn.data || []).filter((r) => r.s_id === k.stu.s_id));
            if (!at.error) {
              const mine = (at.data || []).filter((r) => r.s_id === k.stu.s_id && own.indexOf(r.c_id) >= 0);
              const ab = mine.filter((r) => r.value === '결').length, late = mine.filter((r) => r.value === '지각').length;
              d.sections = d.sections.map((x) => x.title === '출결' ? Object.assign({}, x, { body: '결석 ' + ab + '회 · 지각 ' + late + '회' }) : x);
            }
            return d;
          });
          const im = {}; ((iss.data) || []).forEach((r) => { im[r.s_id] = r.published_at; });
          setIssued(im); setDrafts(ds); setSel(ds.length ? ds[0].s_id : null);
          setMeta({ subject: subject, classes: picked, from: from, to: to, tests: tests.length });
          setNote(notes.join(' ')); setBusy('');
          if (ds.some((d) => d.counsel.length)) runAi(ds);
        });
      }).catch((e) => { setBusy(''); setErr(String((e && e.message) || e)); });
  };

  // ── 상담 요약(AI) — 상담기록이 있는 학생만. 끝나는 대로 그 학생의 '상담 요약' 항목에 넣는다 ──
  const patch = (sid, fn) => setDrafts((cur) => (cur || []).map((d) => d.s_id === sid ? fn(d) : d));
  const putCounsel = (d, text) => Object.assign({}, d, { sections: d.sections.map((x) => x.title === '상담 요약' && !x.body ? Object.assign({}, x, { body: text }) : x) });
  const runAi = (ds, only) => {
    const todo = ds.filter((d) => d.counsel.length && (!only || d.s_id === only));
    if (!todo.length) return;
    todo.forEach((d) => patch(d.s_id, (x) => Object.assign({}, x, { ai: 'busy', aiErr: '' })));
    illGetConfig('anthropic_api_key').then((key) => {
      if (!key) throw new Error('Anthropic API 키가 없습니다(app_config.anthropic_api_key).');
      let i = 0;
      const next = () => {
        const d = todo[i]; i += 1;
        if (!d) return Promise.resolve();
        return rpCounselSummary(key, d.name, d.counsel)
          .then((txt) => patch(d.s_id, (x) => Object.assign(putCounsel(x, txt), { ai: 'done' })))
          .catch((e) => patch(d.s_id, (x) => Object.assign({}, x, { ai: 'err', aiErr: String((e && e.message) || e) })))
          .then(next);
      };
      return Promise.all(Array.from({ length: RP_POOL }, next));
    }).catch((e) => todo.forEach((d) => patch(d.s_id, (x) => Object.assign({}, x, { ai: 'err', aiErr: String((e && e.message) || e) }))));
  };

  // ── 고치기 ──────────────────────────────────────────────────────
  const cur = (drafts || []).find((d) => d.s_id === sel) || null;
  const setSecs = (fn) => patch(sel, (d) => Object.assign({}, d, { sections: fn(d.sections) }));
  const updSec = (id, p) => setSecs((ss) => ss.map((x) => x.id === id ? Object.assign({}, x, p) : x));
  const moveSec = (id, dir) => setSecs((ss) => { const i = ss.findIndex((x) => x.id === id), j = i + dir; if (i < 0 || j < 0 || j >= ss.length) return ss; const a = ss.slice(); const t = a[i]; a[i] = a[j]; a[j] = t; return a; });
  const delScore = (ws) => patch(sel, (d) => {
    const rows = d.scores.filter((r) => r.week_start !== ws), tk = rows.filter((r) => r.score != null), cv = tk.filter((r) => r.class_avg != null);
    return Object.assign({}, d, { scores: rows, taken: tk.length, total: rows.length,
      avg: tk.length ? rpRound1(tk.reduce((a, r) => a + r.score, 0) / tk.length) : null,
      class_avg: cv.length ? rpRound1(cv.reduce((a, r) => a + r.class_avg, 0) / cv.length) : null });
  });

  // ── 발행 ────────────────────────────────────────────────────────
  const body = (d) => ({
    v: 1, name: d.name, subject: meta.subject, klass: d.klass, teacher: userName, from: meta.from, to: meta.to,
    showScores: !!d.showScores, avg: d.avg, class_avg: d.class_avg, taken: d.taken, total: d.total, scores: d.scores,
    sections: d.sections.filter((x) => String(x.body).trim()).map((x) => ({ title: String(x.title).trim() || '안내', body: String(x.body).trim() })),
  });
  const publish = (list) => {
    if (!meta || dirty) return say('조건이 바뀌었습니다 — 초안을 다시 만드세요');
    const waiting = list.filter((d) => d.ai === 'busy');
    if (waiting.length) return say('상담 요약을 만드는 중입니다 — 잠시 뒤에 다시 누르세요');
    if (!list.length) return say('발행할 학생이 없습니다');
    if (!window.confirm(metaName + ' · ' + meta.subject + ' · ' + meta.from + ' ~ ' + meta.to + '\n' + list.length + '명의 레포트를 학부모 레포트 주소에 올립니다. 같은 기간에 이미 발행한 것은 덮어씁니다.')) return;
    setBusy('발행 중…');
    const rows = list.map((d) => ({ s_id: d.s_id, subject: meta.subject, period_from: meta.from, period_to: meta.to, klass: d.klass, data: body(d), published_by: userName, published_at: new Date().toISOString() }));
    SB.from('report_issues').upsert(rows, { onConflict: 's_id,subject,period_from,period_to' }).then(({ error }) => {
      setBusy('');
      if (error) return setErr('발행 실패 — ' + waErrText(error));
      const im = Object.assign({}, issued); rows.forEach((r) => { im[r.s_id] = r.published_at; }); setIssued(im);
      say(list.length + '명 발행했습니다');
    });
  };
  const openHist = () => {
    setHist({ rows: null, q: '', picked: {} });
    SB.from('report_issues').select('id,s_id,subject,period_from,period_to,klass,published_by,published_at,name:data->>name')
      .order('published_at', { ascending: false }).limit(3000)
      .then(({ data, error }) => {
        if (error) { setHist(null); setErr('발행 내역을 읽지 못했습니다 — ' + waErrText(error)); return; }
        setHist({ rows: data || [], q: '', picked: {} });
      });
  };
  const delIssues = (rows) => {
    if (!rows.length) return;
    const label = rows.length === 1 ? rows[0].name + ' · ' + rows[0].subject + ' · ' + rows[0].period_from + ' ~ ' + rows[0].period_to : rows.length + '건';
    if (!window.confirm('레포트를 삭제합니다 — ' + label + '\n학부모 화면에서 바로 사라지고 되돌릴 수 없습니다(다시 발행하면 다시 올라갑니다).')) return;
    const ids = rows.map((r) => r.id);
    SB.from('report_issues').delete().in('id', ids).then(({ error }) => {
      if (error) return setErr('삭제 실패 — ' + waErrText(error));
      setHist((h) => h && Object.assign({}, h, { rows: (h.rows || []).filter((r) => ids.indexOf(r.id) < 0), picked: {} }));
      // 지금 띄운 초안과 같은 과목·기간이면 '발행됨' 표시도 내린다
      if (meta) { const im = Object.assign({}, issued); rows.forEach((r) => { if (r.subject === meta.subject && r.period_from === meta.from && r.period_to === meta.to) delete im[r.s_id]; }); setIssued(im); }
      say(rows.length + '건 삭제했습니다');
    });
  };
  const unpublish = (d) => {
    if (!window.confirm(d.name + ' 학생의 이 기간 레포트 발행을 취소합니다. 학부모 화면에서 사라집니다.')) return;
    SB.from('report_issues').delete().eq('s_id', d.s_id).eq('subject', meta.subject).eq('period_from', meta.from).eq('period_to', meta.to).then(({ error }) => {
      if (error) return setErr('발행 취소 실패 — ' + waErrText(error));
      const im = Object.assign({}, issued); delete im[d.s_id]; setIssued(im); say('발행을 취소했습니다');
    });
  };

  // ── 화면 ────────────────────────────────────────────────────────
  // taste(2026-11-12): 흰 카드 + 1px 선 · 주 버튼 먹 · 보조 버튼 1px 선 · 트리 행은 시안 .tr(선택 = active 회색 바탕 · 먹 글자)
  const card = { background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px' };
  const inputS = { border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '7px 10px', fontSize: '13px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none' };
  const btn = (primary, off) => ({ border: '1px solid ' + (primary ? K.ink : K.control), cursor: off ? 'default' : 'pointer', fontFamily: 'inherit', borderRadius: K.rCtl + 'px', height: '34px', padding: '0 14px', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', background: primary ? K.ink : 'transparent', color: primary ? K.inkText : K.text, opacity: off ? 0.45 : 1, transition: K.ease });
  const mini = { border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', color: K.muted, padding: '3px 6px', borderRadius: K.rCtl + 'px', transition: K.ease };
  const boxBtn = (open, small) => ({ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box', fontSize: '13px', height: small ? '32px' : '34px', padding: '0 10px', borderRadius: K.rCtl + 'px',
    border: 'none', background: open ? K.active : 'transparent', color: K.text, fontWeight: open ? 500 : 400, transition: K.ease });
  const caret = (open) => ({ flex: 'none', width: '14px', textAlign: 'center', fontSize: '11px', lineHeight: '13px', color: K.muted, display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: K.ease });
  const rowBtn = (on) => ({ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: K.rCtl + 'px', height: '32px', padding: '0 10px', fontSize: '13px', background: on ? K.active : 'transparent', color: on ? K.text : K.muted, fontWeight: on ? 500 : 400, transition: K.ease });
  const labS = { fontSize: '12px', color: K.muted, marginBottom: '4px' };
  const preset = (label, f, t) => <button key={label} style={mini} onClick={() => { setFrom(f); setTo(t); }}>{label}</button>;
  const d0 = new Date();
  const mFirst = rpYmd(new Date(d0.getFullYear(), d0.getMonth(), 1));
  const pFirst = rpYmd(new Date(d0.getFullYear(), d0.getMonth() - 1, 1)), pLast = rpYmd(new Date(d0.getFullYear(), d0.getMonth(), 0));
  const onList = (drafts || []).filter((d) => d.on);

  return (
    <div data-root="" style={{ height: '100vh', overflow: 'auto', background: K.ground, color: K.text, fontFamily: 'inherit' }}>
      <nav data-noprint="" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: '1px solid ' + K.border }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span className="nav-brand" style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px' }}>SL PRIME</span>
          <span style={{ fontSize: '14px', color: K.muted, whiteSpace: 'nowrap' }}>레포트</span>
        </div>
        <button onClick={openHist} style={{ marginLeft: 'auto', border: '1px solid ' + K.control, cursor: 'pointer', background: 'transparent', fontSize: '13px', color: K.text, fontFamily: 'inherit', height: '32px', padding: '0 12px', borderRadius: K.rCtl + 'px', transition: K.ease }}>발행 내역</button>
      </nav>

      {err && <div style={{ margin: '14px 20px 0', padding: '12px 14px', borderRadius: K.rCtl + 'px', background: K.surface, border: '1px solid ' + K.neg, fontSize: '13px', color: K.neg }}>{err}</div>}

      {/* 조건 — 기간 · 초안 · 발행. 과목과 반은 아래 왼쪽 트리에서 고른다 */}
      <div style={Object.assign({}, card, { margin: '16px 20px 0', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: '14px 18px', alignItems: 'flex-end' })}>
        <div>
          <div style={Object.assign({}, labS, { display: 'flex', gap: '2px', alignItems: 'center' })}>
            <span style={{ marginRight: '6px' }}>기간</span>
            {preset('최근 4주', rpShift(today, -27), today)}{preset('이번 달', mFirst, today)}{preset('지난달', pFirst, pLast)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={inputS} />
            <span style={{ color: K.muted }}>~</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={inputS} />
          </div>
        </div>
        <button style={btn(true, !!busy || !selCls.length)} disabled={!!busy || !selCls.length} onClick={build}>{busy === '초안 만드는 중…' ? busy : (drafts ? '초안 다시 만들기' : '초안 만들기')}</button>
        {drafts && !dirty && (
          <button style={Object.assign({}, btn(true, !!busy || !onList.length), { marginLeft: 'auto' })} disabled={!!busy || !onList.length} onClick={() => publish(onList)}>
            {busy === '발행 중…' ? busy : '레포트 발행 (' + onList.length + '명)'}
          </button>
        )}
      </div>
      {dirty && <div style={{ margin: '10px 20px 0', fontSize: '12.5px', color: K.warn }}>조건이 바뀌었습니다. 아래 초안은 {metaName} · {meta.subject} · {meta.from} ~ {meta.to} 것입니다 — `초안 다시 만들기` 를 눌러야 반영됩니다(고친 글은 사라집니다).</div>}
      {note && <div style={{ margin: '10px 20px 0', fontSize: '12.5px', color: K.warn }}>{note}</div>}


      <div data-mstack="" style={{ display: 'flex', gap: '16px', padding: '16px 20px', alignItems: 'flex-start' }}>
        {/* ① 반 — 과목 → 급 → 학교 → 학년 → 반(여러 개 · 수학과 중등은 급 → 학년 → 반). 주간테스트 관리와 같은 모양 */}
        <div data-mpane="" style={Object.assign({}, card, { flex: 'none', width: '280px', padding: '12px' })}>
          <WaBranchPick value={branch} onChange={setBranch} T={T} dark={dark} />
          <div style={{ display: 'flex', gap: '2px', padding: '2px', marginBottom: '10px', borderRadius: K.rCtl + 'px', background: K.raised }}>
            {['영어', '수학'].map((sj) => (
              <button key={sj} onClick={() => { if (sj === subject) return; setSubject(sj); setClassIds([]); setLevel(null); setOpenSchool(null); setOpenGrade(null); }}
                style={{ flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: 0, fontSize: '13px', fontWeight: subject === sj ? 500 : 400,
                  background: subject === sj ? K.surface : 'transparent', color: subject === sj ? K.text : K.muted, transition: K.ease }}>{sj}</button>
            ))}
          </div>
          {!!selCls.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
              {selCls.map((c) => (
                <button key={c.c_id} onClick={() => toggleClass(c.c_id)} title="빼기"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', padding: '3px 8px 3px 10px', fontSize: '12px', background: K.raised, color: K.text, fontWeight: 500, transition: K.ease }}>
                  <span>{c.name}</span><span style={{ fontSize: '13px', lineHeight: '13px', opacity: 0.75 }}>×</span>
                </button>
              ))}
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px 10px', cursor: 'pointer', fontSize: '13px', color: K.muted }}>
            <input type="checkbox" style={{ accentColor: K.ink }} checked={!allCls} onChange={(e) => { setAllCls(!e.target.checked); setClassIds([]); }} />
            <span>내 담당 반만 보기</span>
          </label>
          {aca === null ? <div style={{ padding: '30px 0', textAlign: 'center', color: K.muted, fontSize: '13px' }}>명단 불러오는 중…</div>
            : !tree.length ? (
              <div style={{ padding: '18px 6px', color: K.muted, fontSize: '13px', lineHeight: 1.6 }}>
                {!allCls ? ('‘' + userName + '’ 선생님이 담당으로 설정된 ' + subject + ' 반이 없습니다. 위의 체크를 끄면 전체 반이 보입니다.') : (subject + ' 반이 없습니다.')}
              </div>
            ) : (
              <React.Fragment>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px', padding: '2px', marginBottom: '10px', borderRadius: K.rCtl + 'px', background: K.raised }}>
                  {levels.map((sec) => {
                    const on = sec.level === curLevel;
                    return (
                      <button key={sec.level} onClick={() => { setLevel(sec.level); setOpenSchool(null); setOpenGrade(null); }}
                        style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '4px', height: '28px', padding: '0 10px', fontSize: '13px', fontWeight: on ? 500 : 400, background: on ? K.surface : 'transparent', color: on ? K.text : K.muted, transition: K.ease }}>
                        {WA_LEVEL_CHIP[sec.level] || sec.level}
                        <span style={{ marginLeft: '4px', fontSize: '12px', color: K.muted }}>{sec.schools.length}</span>
                      </button>
                    );
                  })}
                </div>
                {shownSchools.map((sc) => {
                  const scOpen = openSchool === sc.name;
                  return (
                    <div key={sc.name} style={{ marginBottom: '2px' }}>
                      <button onClick={() => setOpenSchool(scOpen ? null : sc.name)} style={boxBtn(scOpen)}>
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc.name}</span>
                        <span style={{ flex: 'none', color: K.muted, fontSize: '12px' }}>{sc.flat ? sc.grades[0].classes.length + '반' : sc.grades.length + '개 학년'}</span>
                        <span style={caret(scOpen)}>▾</span>
                      </button>
                      {scOpen && (
                        <div style={{ margin: '2px 0 0 12px' }}>
                          {sc.grades.map((g) => {
                            // 학년 칸(sc.flat — 수학·중등)은 열면 반이 바로 나온다 — 안쪽 학년 버튼 없음
                            const gKey = sc.name + '|' + g.grade, gOpen = sc.flat || openGrade === gKey;
                            const allIn = g.classes.every((c) => classIds.indexOf(c.c_id) >= 0);
                            return (
                              <div key={gKey} style={{ marginBottom: '3px' }}>
                                {!sc.flat && <button onClick={() => setOpenGrade(gOpen ? null : gKey)} style={boxBtn(gOpen, true)}>
                                  <span style={{ flex: 1, minWidth: 0 }}>{g.grade}</span>
                                  <span style={{ flex: 'none', color: K.muted, fontSize: '12px' }}>{g.classes.length}반</span>
                                  <span style={caret(gOpen)}>▾</span>
                                </button>}
                                {gOpen && (
                                  <div style={{ margin: sc.flat ? '0' : '2px 0 0 12px' }}>
                                    {g.classes.length > 1 && (
                                      <button style={Object.assign({}, mini, { margin: '0 0 2px 4px' })} onClick={() => setClassIds((cur0) => { const ids = g.classes.map((c) => c.c_id); return allIn ? cur0.filter((x) => ids.indexOf(x) < 0) : cur0.concat(ids.filter((x) => cur0.indexOf(x) < 0)); })}>{allIn ? '이 학년 전체 해제' : '이 학년 전체 선택'}</button>
                                    )}
                                    {g.classes.map((c) => {
                                      const on = classIds.indexOf(c.c_id) >= 0;
                                      return (
                                        <button key={c.c_id} onClick={() => toggleClass(c.c_id)} style={rowBtn(on)}>
                                          <span style={{ flex: 'none', width: '5px', height: '5px', borderRadius: '50%', background: on ? K.ink : K.muted, opacity: on ? 1 : 0.45 }}></span>
                                          <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                                          <span style={{ flex: 'none', color: K.muted, fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{headN(c)}명</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            )}
        </div>

        {/* ② 학생 — 반을 고르면 바로 이름이 뜬다. 초안을 만들면 평균·발행 체크가 붙는다 */}
        <div data-mpane="" style={Object.assign({}, card, { flex: 'none', width: '250px', padding: '10px' })}>
          {(drafts && !dirty) ? (
            <React.Fragment>
            <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px 8px', fontSize: '12px', color: K.muted }}>
              <span>{meta.classes.length > 1 ? '반 ' + meta.classes.length + '개 · ' + drafts.length + '명' : metaName} · 시험 {meta.tests}회</span>
              <button style={Object.assign({}, mini, { marginLeft: 'auto' })} onClick={() => { const allOn = drafts.every((d) => d.on); setDrafts(drafts.map((d) => Object.assign({}, d, { on: !allOn }))); }}>{drafts.every((d) => d.on) ? '전체 해제' : '전체 선택'}</button>
            </div>
            {drafts.map((d, di) => (
              <React.Fragment key={d.s_id}>
              {meta.classes.length > 1 && (di === 0 || drafts[di - 1].c_id !== d.c_id) && <div style={{ padding: '9px 8px 4px', fontSize: '12px', fontWeight: 500, color: K.muted }}>{d.klass}</div>}
              <div onClick={() => setSel(d.s_id)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '34px', padding: '0 8px', borderRadius: K.rCtl + 'px', cursor: 'pointer', fontSize: '13px', background: d.s_id === sel ? K.active : 'transparent', opacity: d.on ? 1 : 0.5, transition: K.ease }}>
                <input type="checkbox" style={{ accentColor: K.ink }} checked={d.on} title="발행에 포함" onClick={(e) => e.stopPropagation()} onChange={(e) => patch(d.s_id, (x) => Object.assign({}, x, { on: e.target.checked }))} />
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: d.s_id === sel ? 500 : 400 }}>{d.name}</span>
                {d.ai === 'busy' && <span style={{ fontSize: '11px', color: K.muted }}>요약 중</span>}
                {issued[d.s_id] && <span style={{ fontSize: '11px', color: K.pos, fontWeight: 500 }}>발행됨</span>}
                <span style={{ fontSize: '12px', color: K.muted, fontVariantNumeric: 'tabular-nums', width: '34px', textAlign: 'right' }}>{d.avg == null ? '—' : d.avg}</span>
              </div>
              </React.Fragment>
            ))}
            {!drafts.length && <div style={{ padding: '20px 6px', fontSize: '12.5px', color: K.muted }}>고른 반에 재원생이 없습니다.</div>}
            </React.Fragment>
          ) : !selCls.length ? (
            <div style={{ padding: '26px 8px', fontSize: '12.5px', color: K.muted, lineHeight: 1.7 }}>왼쪽에서 반을 고르면 학생 이름이 여기에 뜹니다. 반은 여러 개 고를 수 있습니다.</div>
          ) : (
            <React.Fragment>
              <div style={{ padding: '2px 6px 6px', fontSize: '12px', color: K.muted }}>{'반 ' + selCls.length + '개 · ' + students.filter((x) => (x.class_ids || []).some((id) => classIds.indexOf(id) >= 0)).length + '명 — 초안을 만들기 전입니다'}</div>
              {selCls.map((c) => (
                <React.Fragment key={c.c_id}>
                  <div style={{ padding: '9px 8px 4px', fontSize: '12px', fontWeight: 500, color: K.muted }}>{c.name}</div>
                  {students.filter((x) => (x.class_ids || []).indexOf(c.c_id) >= 0).sort((x, y) => x.name.localeCompare(y.name, 'ko')).map((x) => (
                    <div key={c.c_id + '|' + x.s_id} style={{ padding: '6px 10px', fontSize: '13px', color: K.muted }}>{x.name}</div>
                  ))}
                </React.Fragment>
              ))}
            </React.Fragment>
          )}
        </div>

        {/* ③ 고른 학생의 레포트 고치기 */}
        {!(drafts && !dirty && cur) ? (
          <div style={Object.assign({}, card, { flex: 1, minWidth: 0, padding: '60px 20px', textAlign: 'center', color: K.muted, fontSize: '13.5px', lineHeight: 1.8 })}>
            {dirty ? '반·과목·기간이 바뀌었습니다. `초안 다시 만들기` 를 누르세요.' : <React.Fragment>반과 기간을 고르고 `초안 만들기` 를 누르세요.<br />점수·유형·지문은 주간테스트 성적에서, 상담 요약은 상담기록에서 자동으로 채워집니다.<br />발행하기 전에는 학부모에게 아무것도 보이지 않습니다.</React.Fragment>}
          </div>
        ) : (
            <div style={Object.assign({}, card, { flex: 1, minWidth: 0, padding: '16px 18px' })}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '17px', fontWeight: 500 }}>{cur.name}</span>
                <span style={{ fontSize: '12.5px', color: K.muted }}>{cur.klass} · {meta.subject} · {meta.from} ~ {meta.to}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {issued[cur.s_id] && <button style={mini} onClick={() => unpublish(cur)}>발행 취소</button>}
                  <button style={btn(false, !!busy || dirty)} disabled={!!busy || dirty} onClick={() => publish([cur])}>{issued[cur.s_id] ? '이 학생만 다시 발행' : '이 학생만 발행'}</button>
                </span>
              </div>

              {/* 점수 — 자동. 주를 빼거나 통째로 감출 수 있다 */}
              <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: K.rCard + 'px', border: '1px solid ' + K.border, opacity: cur.showScores ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <b style={{ fontSize: '13.5px', fontWeight: 600 }}>점수</b>
                  <span style={{ fontSize: '12.5px', color: K.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {cur.avg == null ? '응시한 시험이 없습니다' : '평균 ' + cur.avg + '점' + (cur.class_avg != null ? ' · 반 평균 ' + cur.class_avg + '점' : '') + ' · ' + cur.total + '회 중 ' + cur.taken + '회 응시'}
                  </span>
                  <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: K.muted, cursor: 'pointer' }}>
                    <input type="checkbox" style={{ accentColor: K.ink }} checked={cur.showScores} onChange={(e) => patch(sel, (d) => Object.assign({}, d, { showScores: e.target.checked }))} />레포트에 점수 넣기
                  </label>
                </div>
                {cur.scores.map((r) => (
                  <div key={r.week_start} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', fontSize: '12.5px', borderTop: '1px solid ' + K.rule, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ width: '64px', flex: 'none' }}>{r.label}</span>
                    <span style={{ width: '54px', flex: 'none', fontWeight: 500, color: r.score == null ? K.muted : K.text }}>{r.score == null ? '미응시' : r.score + '점'}</span>
                    <span style={{ width: '90px', flex: 'none', color: K.muted }}>{r.class_avg == null ? '' : '반 평균 ' + r.class_avg}</span>
                    <span style={{ flex: 1, minWidth: 0, color: K.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.range}</span>
                    <button style={mini} title="이 주를 레포트에서 뺀다" onClick={() => delScore(r.week_start)}>빼기</button>
                  </div>
                ))}
                {cur.total > 0 && cur.graded === 0 && <div style={{ marginTop: '6px', fontSize: '12px', color: K.muted }}>채점 링크로 채점한 시험이 없어 유형·지문 분석은 비어 있습니다{meta.subject === '수학' ? '(수학 PDF 시험지는 유형·지문 정보가 없습니다)' : ''}.</div>}
              </div>

              {/* 글 항목 — 전부 고칠 수 있다. 내용이 빈 항목은 발행에 안 들어간다 */}
              {cur.sections.map((x, i) => (
                <div key={x.id} style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <input value={x.title} onChange={(e) => updSec(x.id, { title: e.target.value })} style={Object.assign({}, inputS, { fontWeight: 500, padding: '5px 9px', width: '200px' })} />
                    {!String(x.body).trim() && <span style={{ fontSize: '12px', color: K.muted }}>비어 있음 — 발행에 안 들어갑니다</span>}
                    {x.title === '상담 요약' && cur.ai === 'busy' && <span style={{ fontSize: '12px', color: K.muted }}>AI 가 상담기록을 요약하는 중…</span>}
                    {x.title === '상담 요약' && cur.ai === 'done' && <span style={{ fontSize: '12px', color: K.warn }}>AI 요약 — 발행 전에 읽어 보세요</span>}
                    {x.title === '상담 요약' && cur.ai === 'err' && <span style={{ fontSize: '12px', color: K.neg }}>요약 실패 — {cur.aiErr.slice(0, 80)}</span>}
                    <span style={{ marginLeft: 'auto', display: 'flex' }}>
                      <button style={mini} disabled={i === 0} onClick={() => moveSec(x.id, -1)}>▲</button>
                      <button style={mini} disabled={i === cur.sections.length - 1} onClick={() => moveSec(x.id, 1)}>▼</button>
                      <button style={mini} onClick={() => setSecs((ss) => ss.filter((y) => y.id !== x.id))}>삭제</button>
                    </span>
                  </div>
                  <textarea value={x.body} onChange={(e) => updSec(x.id, { body: e.target.value })} rows={Math.max(2, Math.min(10, String(x.body).split('\n').length + Math.floor(String(x.body).length / 70)))}
                    style={Object.assign({}, inputS, { width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 })} />
                </div>
              ))}
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button style={btn(false)} onClick={() => setSecs((ss) => ss.concat([rpSec('새 항목', '')]))}>+ 항목 추가</button>
                {cur.counsel.length > 0 && <button style={btn(false, cur.ai === 'busy')} disabled={cur.ai === 'busy'} onClick={() => { setSecs((ss) => ss.some((y) => y.title === '상담 요약') ? ss.map((y) => y.title === '상담 요약' ? Object.assign({}, y, { body: '' }) : y) : ss.concat([rpSec('상담 요약', '')])); runAi(drafts, cur.s_id); }}>상담 요약 다시 만들기</button>}
                <button style={btn(false)} onClick={() => setShowRaw(!showRaw)}>{showRaw ? '상담기록 원문 접기' : '상담기록 원문 보기 (' + cur.counsel.length + '건)'}</button>
              </div>
              {showRaw && (
                <div style={{ marginTop: '10px', padding: '12px 14px', borderRadius: K.rCtl + 'px', background: K.raised, fontSize: '12.5px', lineHeight: 1.65 }}>
                  <div style={{ color: K.neg, fontWeight: 500, marginBottom: '6px' }}>원문은 참고용입니다 — 학부모에게는 나가지 않습니다.</div>
                  {!cur.counsel.length && <div style={{ color: K.muted }}>이 기간의 상담기록이 없습니다.</div>}
                  {cur.counsel.map((r) => (
                    <div key={r.cns_id} style={{ padding: '6px 0', borderTop: '1px solid ' + K.border }}>
                      <div style={{ color: K.muted }}>{r.cs_date} · {r.cs_with || ''} · {r.cs_type || ''}{r.cs_subj ? ' · ' + r.cs_subj : ''}{r.p_name ? ' · ' + r.p_name : ''}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{r.cs_cont}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        )}
      </div>
      {hist && (() => {
        const k = hist.q.replace(/\s/g, '');
        const shown = (hist.rows || []).filter((r) => !k || (String(r.name) + String(r.klass) + String(r.subject) + String(r.published_by)).replace(/\s/g, '').indexOf(k) >= 0);
        const pickedRows = shown.filter((r) => hist.picked[r.id]);
        const allOn = shown.length > 0 && pickedRows.length === shown.length;
        const setPicked = (fn) => setHist((h) => Object.assign({}, h, { picked: fn(h.picked) }));
        return (
          <div onClick={() => setHist(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.30)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '720px', maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: K.surface, color: K.text, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', padding: '18px 20px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px', fontWeight: 500 }}>발행 내역</span>
                <span style={{ fontSize: '12.5px', color: K.muted }}>{hist.rows ? '지금 학부모에게 보이는 레포트 ' + hist.rows.length + '건' : '불러오는 중…'}</span>
                <button style={Object.assign({}, mini, { marginLeft: 'auto', fontSize: '13px' })} onClick={() => setHist(null)}>닫기</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input value={hist.q} onChange={(e) => setHist(Object.assign({}, hist, { q: e.target.value, picked: {} }))} placeholder="이름·반·과목·발행한 사람으로 찾기" style={Object.assign({}, inputS, { flex: 1, minWidth: '200px' })} />
                <button style={btn(false, !shown.length)} disabled={!shown.length} onClick={() => setPicked(() => { const m = {}; if (!allOn) shown.forEach((r) => { m[r.id] = true; }); return m; })}>{allOn ? '선택 해제' : '보이는 것 전체 선택'}</button>
                <button style={Object.assign({}, btn(false, !pickedRows.length), { color: K.neg, borderColor: K.control })} disabled={!pickedRows.length} onClick={() => delIssues(pickedRows)}>{'선택 삭제' + (pickedRows.length ? ' (' + pickedRows.length + ')' : '')}</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, minHeight: '120px', borderTop: '1px solid ' + K.border }}>
                {hist.rows && !shown.length && <div style={{ padding: '36px 0', textAlign: 'center', color: K.muted, fontSize: '13px' }}>{hist.rows.length ? '찾는 레포트가 없습니다.' : '발행된 레포트가 없습니다.'}</div>}
                {shown.map((r) => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '0 4px', borderBottom: '1px solid ' + K.rule, fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ accentColor: K.ink }} checked={!!hist.picked[r.id]} onChange={(e) => setPicked((m) => { const n = Object.assign({}, m); if (e.target.checked) n[r.id] = true; else delete n[r.id]; return n; })} />
                    <b style={{ width: '84px', flex: 'none', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name || ('학생 ' + r.s_id)}</b>
                    <span style={{ width: '34px', flex: 'none', color: K.muted }}>{r.subject}</span>
                    <span style={{ width: '104px', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{rpMd(r.period_from) + ' ~ ' + rpMd(r.period_to)}</span>
                    <span style={{ flex: 1, minWidth: 0, color: K.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.klass}</span>
                    <span style={{ flex: 'none', color: K.muted, fontSize: '12px', whiteSpace: 'nowrap' }}>{(r.published_by || '') + ' · ' + rpMd(String(r.published_at).slice(0, 10))}</span>
                    <button style={Object.assign({}, mini, { color: K.neg })} onClick={(e) => { e.preventDefault(); delIssues([r]); }}>삭제</button>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
      {toast && <div style={{ position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', background: K.ink, color: K.inkText, padding: '9px 18px', borderRadius: K.rCtl + 'px', fontSize: '13px', zIndex: 60 }}>{toast}</div>}
    </div>
  );
}
