// 삽화 — 지문 → 교육 웹툰 삽화 생성 (지문 스튜디오 '삽화' 모드)
// 원본: sl-edulab-deploy(SL EDULAB 삽화 생성기, Cloudflare Pages + KV)를 SL PRIME 안으로 이식.
//  · 로그인/비밀번호는 앱의 Supabase 인증을 그대로 쓰므로 원본의 로그인 화면은 옮기지 않았다.
//  · KV에 있던 것은 Supabase로: refchar → app_config.illust_refchar, usage:이름:날짜 → illust_usage.
//  · HTML에 하드코딩돼 있던 Gemini 키도 app_config.gemini_api_key 로 옮겼다(공개 릴리스에 키가 들어가지 않게).
// 스키마: scripts/illust_schema.sql  ·  로드 순서는 index.html 의 script 태그 순서가 결정한다.

// 구글이 모델을 조용히 내린다. `gemini-2.5-flash` 는 2026-08-10 실측에서 이미 404
// ("no longer available")였고, 그동안 삽화의 장면 추출이 통째로 실패하고 있었다.
// 모델을 올릴 때는 **API 로 실재를 확인하고** 바꾼다:
//   GET https://generativelanguage.googleapis.com/v1beta/models?key=<키>
const ILL_TEXT_MODEL = 'gemini-3-flash-preview';      // 지문 분리 + 장면/문구 생성
const ILL_IMAGE_MODEL = 'gemini-3-pro-image';         // Nano Banana Pro — 삽화 생성
                                                      // (preview 별칭이 아니라 정식 이름을 쓴다 — 위 사고 재발 방지)
const ILL_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ILL_CONCURRENCY = 5;      // 동시에 생성할 삽화 수
const ILL_MAX_TEXT_RETRY = 3;   // 한글 깨짐 시 최대 재생성 횟수

// 모든 삽화에 공통으로 적용되는 고정 스타일. {장면}/{말풍선}/{하단} 만 지문별로 교체된다.
function illBuildImagePrompt(p, hasRef) {
  const charLine = hasRef
    ? '첨부한 기준 캐릭터 이미지의 인물 디자인과 화풍을 그대로 따라서(같은 그림체·같은 캐릭터 느낌), '
    : '귀여운 2~3등신 SD 캐릭터를 사용해, ';
  // 하단 문구는 말풍선을 거드는 짧은 한 문장이다. 비어 있으면 아예 넣지 않는다 — 핵심은 말풍선이 전달한다.
  const bottomLine = (p.bottom && String(p.bottom).trim())
    ? '하단에 짧은 문구 「' + String(p.bottom).trim() + '」 — 말풍선보다 작게, **최대 두 줄**로. 세 줄로 늘리거나 문장을 더 덧붙이지 말 것.'
    : '하단 문구는 넣지 말 것.';
  return charLine + `숙련된 일러스트레이터가 손으로 직접 그린 듯한 한국 교육 웹툰 스타일의 한 컷 일러스트를 그려줘. 1:1 정사각형.
**배경은 순백(#FFFFFF) 단색으로 고정한다.** 배경에는 아무것도 그리지 않는다 — 풍경·실내·소품·바닥·그림자·무늬·색 띠·질감 전부 없이, 흰 여백 위에 캐릭터만 있게 한다(캐릭터가 손에 든 물건 하나 정도는 괜찮다).
**테두리를 절대 그리지 않는다.** 액자·프레임·외곽선·둥근 모서리 카드·컷 경계선·여백 띠 어느 것도 없이, 흰 배경이 정사각형 네 변 끝까지 그대로 이어져야 한다.
인물은 1~3명까지, 표정과 몸짓만으로 상황이 읽히게. 아주 단순하고 깔끔한 구성.
화풍: 귀여운 2~3등신 비율, **굵고 고른 검정 아웃라인**, 점 같은 눈과 단순한 입, 발그레한 볼 홍조, 부드러운 파스텔 톤의 평면적인 셀 채색.
[장면] ` + p.scene + `
**메시지는 말풍선이 전달한다.** 상단에 말풍선 「` + p.bubble + `」 — 이 말풍선만 읽어도 핵심이 전달되도록 또렷하고 크게. 말풍선은 연한 크림색 바탕에 검정 테두리와 꼬리가 달린 둥근 모양, 글자는 굵은 손글씨체.
` + bottomLine + `
글자는 처음부터 끝까지 "하나의 일관된 둥근 손글씨체"로 통일해서, 정확한 한국어로 또렷하게 렌더링.
절제된 색감(주요 색 2~3가지). 그림은 정사각형 전체를 꽉 채운다.

피해야 할 것: **테두리·액자·프레임·컷 경계선·둥근 모서리 카드**, **흰색이 아닌 배경과 배경에 그려 넣은 풍경·소품·질감·무늬**, 하단에 세 줄 이상 들어가는 긴 문구, SL 로고·워터마크·서명 등 불필요한 글자, 기준 캐릭터와 다른 외형, 요소를 빽빽하게 채우는 복잡한 구성, 여러 개의 작은 장면, 3D 렌더링, 매끈한 그라데이션·광택, 플라스틱 질감, 완벽한 대칭, 스톡 이미지나 AI로 생성한 듯한 인공적인 느낌, 사진처럼 사실적인 렌더링.`;
}

// 지문에서 장면/말풍선/하단문구 3개를 뽑아내는 지시문
const ILL_EXTRACT_INSTRUCTION = `당신은 한국 교육 웹툰 삽화 기획자입니다.
주어진 자료(PDF 또는 붙여넣은 텍스트)에는 하나 이상의 영어 지문이 들어 있습니다.
자료 전체를 읽어 개별 지문 단위로 나누세요. 지문 사이는 보통 빈 줄로 구분되어 있으며, 지문이 하나뿐이면 1개만 반환하세요.
각 지문마다 교육 웹툰 한 컷 삽화를 위한 3가지 요소를 한국어로 작성하세요.

- number: 이 지문의 문항 번호(예: 18, 19, 20). 자료에 "[18]" 처럼 번호가 적혀 있으면 그 번호를 그대로 쓰고, 찾을 수 없으면 순서대로 1, 2, 3… 을 넣으세요.
- scene: **흰 배경 위에 캐릭터만** 있는 한 컷. 캐릭터의 표정·몸짓·자세로 상황이 읽히게 묘사하세요. 배경·장소·풍경·소품 배치는 쓰지 마세요("교실에서", "책상 앞에", "숲속" 같은 표현 금지) — 캐릭터가 손에 든 물건 하나까지만 허용합니다.
- bubble: **여기가 메시지의 전부입니다.** 이 말풍선만 읽어도 지문의 핵심이 전달되도록 쓰세요. 짧고 강렬한 한 문장(공백 포함 25자 이내).
- bottom: 지문의 결론/교훈을 거드는 **짧은 한 문장**. 제목이나 표어처럼 토막 내지 말고 주어와 서술어를 갖춘 완결된 문장으로 쓰되, 삽화 안 텍스트 박스에서 두 줄을 넘지 않도록 간결하게(공백 포함 대략 20~35자, 한 문장). 예를 들어 "작은 습관의 힘"(X) 같은 제목이 아니라 "작은 습관이 쌓이면 큰 변화를 만든다."(O)처럼. 말풍선 내용을 그대로 반복하지는 마세요. 덧붙일 말이 없으면 빈 문자열("")로 두세요.

반드시 아래 JSON 형식(배열)으로만, 자료에 등장하는 순서대로 응답하세요:
[{"number":"18","scene":"...","bubble":"...","bottom":"..."}]`;

// ── Supabase: 설정(API 키·기준 캐릭터) · 사용량 ──────────────────────
const ILL_CFG = {}; // 세션 캐시 (undefined=미조회, null=없음)
async function illGetConfig(key) {
  if (ILL_CFG[key] !== undefined) return ILL_CFG[key];
  const { data, error } = await SB.from('app_config').select('value').eq('key', key).maybeSingle();
  if (error) throw new Error('설정을 읽지 못했습니다 (' + error.message + ')');
  ILL_CFG[key] = data ? data.value : null;
  return ILL_CFG[key];
}
async function illSetConfig(key, value) {
  const { error } = await SB.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  ILL_CFG[key] = value;
}
// 삽화 1장 생성 성공 시 +1 (실패해도 앱 동작엔 영향 없음)
function illUsageAdd(n) { SB.rpc('illust_usage_add', { n: n || 1 }).then(function () {}, function () {}); }

// KST(UTC+9) 기준 오늘/이번주/이번달
function illKstToday() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
function illKstWeek() {
  const k = new Date(Date.now() + 9 * 3600 * 1000);
  const dow = k.getUTCDay();                // 0=일 … 6=토
  const mon = new Date(k); mon.setUTCDate(k.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  const list = [];
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setUTCDate(mon.getUTCDate() + i); list.push(d.toISOString().slice(0, 10)); }
  return list;
}
async function illUsageStats() {
  const { data, error } = await SB.from('illust_usage').select('user_name,day,count');
  if (error) throw new Error(error.message);
  const today = illKstToday(), week = illKstWeek(), month = today.slice(0, 7);
  const by = {};
  (data || []).forEach(r => {
    const u = by[r.user_name] || (by[r.user_name] = { name: r.user_name, day: 0, week: 0, month: 0 });
    const c = r.count || 0;
    if (r.day === today) u.day += c;
    if (week.indexOf(r.day) >= 0) u.week += c;
    if (String(r.day).slice(0, 7) === month) u.month += c;
  });
  return { rows: Object.keys(by).sort().map(k => by[k]), today };
}

// ── Gemini ──────────────────────────────────────────────────────────
const illSleep = ms => new Promise(r => setTimeout(r, ms));
// 503/429/500 등 일시 오류는 지수 백오프로 자동 재시도
async function illGeminiFetch(key, model, body, log, tries) {
  const n = tries || 5;
  for (let a = 0; a < n; a++) {
    const res = await fetch(ILL_API_BASE + '/' + model + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (res.ok) return res;
    if ([429, 500, 503].indexOf(res.status) >= 0 && a < n - 1) {
      const wait = 2000 * (a + 1);
      if (log) log('서버 혼잡(' + res.status + ') — ' + (wait / 1000) + '초 후 재시도 (' + (a + 1) + '/' + (n - 1) + ')');
      await illSleep(wait);
      continue;
    }
    return res; // 재시도 불가 오류거나 마지막 시도 → 호출부에서 에러 처리
  }
}
// 이미지 응답에서 data URL 추출 (생성/수정 공용)
async function illParseImageResponse(res) {
  if (!res.ok) throw new Error('이미지 API ' + res.status + ' — ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  const cand = (data.candidates || [])[0] || {};
  const parts = (cand.content && cand.content.parts) || [];
  const imgPart = parts.filter(x => x.inlineData || x.inline_data)[0];
  const inline = imgPart && (imgPart.inlineData || imgPart.inline_data);
  if (!inline) {
    const reason = cand.finishReason || (data.promptFeedback && data.promptFeedback.blockReason) || '미상';
    throw new Error('이미지 없음(' + reason + ')');
  }
  return 'data:' + (inline.mimeType || inline.mime_type || 'image/png') + ';base64,' + inline.data;
}
// 생성된 이미지의 한글을 검수 → 정상이면 true (검수 실패는 통과 처리해 무한 재생성 방지)
async function illVerifyKorean(key, dataUrl) {
  try {
    const res = await illGeminiFetch(key, ILL_TEXT_MODEL, {
      contents: [{ parts: [
        { inlineData: { mimeType: dataUrl.substring(5, dataUrl.indexOf(';')), data: dataUrl.split(',')[1] } },
        { text: '이 이미지 속 한국어 글자만 검수해줘. 자모가 분리됐거나, 뭉개졌거나, 없는 글자·외계어·오타가 조금이라도 있으면 broken=true. 모든 한글이 또렷하고 자연스러우면 broken=false. 오직 JSON으로만: {"broken": true 또는 false}' }
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 }
    });
    if (!res.ok) return true;
    const data = await res.json();
    const raw = (((data.candidates || [])[0] || {}).content || {}).parts;
    return JSON.parse((raw && raw[0] && raw[0].text) || '{}').broken !== true;
  } catch (e) { return true; }
}

// ── 이미지 유틸 ──────────────────────────────────────────────────────
// 캐릭터/인풋 이미지를 최대 max px로 축소해 용량을 줄임
function illResizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다'));
    const r = new FileReader();
    r.onload = () => { img.src = r.result; };
    r.onerror = () => reject(new Error('파일 읽기 실패'));
    r.readAsDataURL(file);
  });
}
function illFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('파일 읽기 실패'));
    r.readAsDataURL(file);
  });
}
function illB64ToBytes(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function illSaveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ── ZIP(무압축 store) — PNG는 이미 압축돼 있어 저장만 해도 충분. CDN 의존 없이 file://에서도 동작. ──
const ILL_CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; }
  return t;
})();
function illCrc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i++) c = ILL_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
// files: [{ name, bytes }] → Blob(application/zip)
function illZipStore(files) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const u16 = v => [v & 0xFF, (v >>> 8) & 0xFF];
  const u32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  files.forEach(f => {
    const name = enc.encode(f.name), crc = illCrc32(f.bytes), size = f.bytes.length;
    // 0x0800 = 파일명 UTF-8 플래그 (한글 파일명)
    const head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size), u16(name.length), u16(0));
    chunks.push(new Uint8Array(head), name, f.bytes);
    central.push({ name, crc, size, offset });
    offset += head.length + name.length + size;
  });
  const dirStart = offset;
  central.forEach(c => {
    const head = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(c.crc), u32(c.size), u32(c.size),
      u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset));
    chunks.push(new Uint8Array(head), c.name);
    offset += head.length + c.name.length;
  });
  chunks.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(offset - dirStart), u32(dirStart), u16(0))));
  return new Blob(chunks, { type: 'application/zip' });
}
function illSanitize(s) { return String(s == null ? '' : s).replace(/[\\/:*?"<>|]/g, '').slice(0, 20) || 'untitled'; }

// ── 화면 ────────────────────────────────────────────────────────────
function IllustPane({ dark, T, PC, sheets, userName, isAdmin }) {
  const [src, setSrc] = useState('lib');     // lib=선택 지문 | pdf | text
  const [items, setItems] = useState([]);    // {num, scene, bubble, bottom, img, status}
  const [status, setStatus] = useState('');
  const [logLines, setLogLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pdfName, setPdfName] = useState('');
  const [pdfB64, setPdfB64] = useState('');
  const [text, setText] = useState('');
  const [drag, setDrag] = useState(false);
  const [modal, setModal] = useState('');    // ''|help|usage|ref|free|edit
  const [editIdx, setEditIdx] = useState(-1);
  const [editText, setEditText] = useState('');
  const [keyState, setKeyState] = useState('checking'); // checking|ok|missing|error
  const fileRef = useRef(null);
  const itemsRef = useRef(items);            // 동시 생성 중 최신 배열 참조
  itemsRef.current = items;

  const log = (m) => setLogLines(ls => ls.concat(m));
  const setItem = (i, patch) => setItems(list => list.map((it, k) => (k === i ? Object.assign({}, it, patch) : it)));

  // API 키 확인 (없으면 안내만 하고 기능은 잠근다)
  useEffect(() => {
    let alive = true;
    illGetConfig('gemini_api_key').then(
      v => { if (alive) setKeyState(v ? 'ok' : 'missing'); },
      () => { if (alive) setKeyState('error'); }
    );
    return () => { alive = false; };
  }, []);
  const needKey = async () => {
    const k = await illGetConfig('gemini_api_key');
    if (!k) throw new Error('Gemini API 키가 등록되지 않았습니다. 관리자에게 문의하세요.');
    return k;
  };

  // ── STEP 1: 지문 분석 ──
  const analyze = async () => {
    let sourcePart, baseName = '지문';
    if (src === 'lib') {
      if (!sheets.length) { alert('왼쪽 라이브러리에서 지문을 먼저 선택하세요.'); return; }
      const body = sheets.map((sh, i) => '[' + (sh.passageNum || (i + 1)) + '] ' + sh.rawText).join('\n\n');
      sourcePart = { text: '=== 지문 원문 ===\n' + body };
      baseName = sheets[0].passageSource || '지문';
    } else if (src === 'pdf') {
      if (!pdfB64) { alert('먼저 PDF를 업로드하세요.'); return; }
      sourcePart = { inlineData: { mimeType: 'application/pdf', data: pdfB64 } };
      baseName = pdfName || '지문';
    } else {
      if (!text.trim()) { alert('지문을 입력하세요.'); return; }
      sourcePart = { text: '=== 지문 원문 ===\n' + text.trim() };
    }
    setBusy(true); setStatus('지문 분석 중…');
    try {
      const key = await needKey();
      const res = await illGeminiFetch(key, ILL_TEXT_MODEL, {
        contents: [{ parts: [sourcePart, { text: ILL_EXTRACT_INSTRUCTION }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
      }, log);
      if (!res.ok) throw new Error('텍스트 API ' + res.status + ' — ' + (await res.text()).slice(0, 200));
      const data = await res.json();
      const parts = (((data.candidates || [])[0] || {}).content || {}).parts;
      let arr = JSON.parse((parts && parts[0] && parts[0].text) || '[]');
      if (!Array.isArray(arr)) arr = [];
      setItems(arr.map((p, i) => ({
        num: String(p.number == null ? (i + 1) : p.number).trim() || String(i + 1),
        scene: p.scene || '', bubble: p.bubble || '', bottom: p.bottom || '',
        img: null, status: 'idle'
      })));
      setPdfName(baseName);
      log('지문 ' + arr.length + '개 인식');
      setStatus('지문 ' + arr.length + '개 인식됨');
    } catch (err) {
      log('지문 분석 오류: ' + err.message);
      setStatus('분석 오류');
      alert('지문 분석에 실패했습니다.\n' + err.message);
    }
    setBusy(false);
  };

  const onFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('PDF 파일만 업로드할 수 있어요.'); return; }
    setPdfName(file.name.replace(/\.pdf$/i, ''));
    setStatus('파일 읽는 중…');
    try {
      const b64 = await illFileToBase64(file);
      setPdfB64(b64);
      log('PDF 로드 완료 (' + Math.round(file.size / 1024) + 'KB)');
      setStatus('PDF 준비됨 — [지문 분석]을 누르세요');
    } catch (err) { log('PDF 처리 오류: ' + err.message); setStatus('오류'); }
  };

  // ── STEP 2: 삽화 생성 ──
  // 나노바나나 프로 호출 — 기준 캐릭터(있으면) + 장면 프롬프트
  const renderOne = async (key, p) => {
    const ref = await illGetConfig('illust_refchar');
    const parts = [];
    if (ref) parts.push({ inlineData: { mimeType: ref.substring(5, ref.indexOf(';')), data: ref.split(',')[1] } });
    parts.push({ text: illBuildImagePrompt(p, !!ref) });
    const res = await illGeminiFetch(key, ILL_IMAGE_MODEL, {
      contents: [{ parts }],
      generationConfig: { imageConfig: { aspectRatio: '1:1', imageSize: '1K' }, temperature: 0.35 }
    }, log);
    return await illParseImageResponse(res);
  };
  // 생성 → 한글 검수 → 깨졌으면 재생성
  const makeImage = async (key, p) => {
    let last = null;
    for (let attempt = 1; attempt <= ILL_MAX_TEXT_RETRY; attempt++) {
      try {
        last = await renderOne(key, p);
      } catch (err) {
        log('지문 ' + p.num + ': 생성 실패(' + err.message + ') → 재시도 (' + attempt + '/' + ILL_MAX_TEXT_RETRY + ')');
        if (attempt === ILL_MAX_TEXT_RETRY) throw err;
        continue;
      }
      if (await illVerifyKorean(key, last)) return last;
      if (attempt < ILL_MAX_TEXT_RETRY) log('지문 ' + p.num + ': 한글 깨짐 감지 → 재생성 (' + attempt + '/' + ILL_MAX_TEXT_RETRY + ')');
      else log('지문 ' + p.num + ': 재생성 ' + ILL_MAX_TEXT_RETRY + '회 후에도 미흡 — 마지막 결과 사용');
    }
    return last;
  };

  const generateAll = async () => {
    if (!items.length || busy) return;
    let key;
    try { key = await needKey(); } catch (err) { alert(err.message); return; }
    setBusy(true);
    setItems(list => list.map(p => Object.assign({}, p, { status: 'loading' })));
    const t0 = Date.now();
    const list = itemsRef.current.slice();
    let next = 0, done = 0;
    const worker = async () => {
      while (next < list.length) {
        const i = next++;
        try {
          const img = await makeImage(key, list[i]);
          setItem(i, { img, status: 'done' });
          illUsageAdd(1);
          log('[' + (++done) + '/' + list.length + '] 지문 ' + list[i].num + ' 완료');
        } catch (err) {
          setItem(i, { status: 'error' }); done++;
          log('오류(지문 ' + list[i].num + '): ' + err.message);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(ILL_CONCURRENCY, list.length) }, worker));
    log('전체 완료 — ' + ((Date.now() - t0) / 1000).toFixed(1) + '초');
    setBusy(false);
  };

  const regen = async (i) => {
    let key;
    try { key = await needKey(); } catch (err) { alert(err.message); return; }
    const p = itemsRef.current[i];
    setItem(i, { status: 'loading' });
    try { setItem(i, { img: await makeImage(key, p), status: 'done' }); illUsageAdd(1); }
    catch (err) { setItem(i, { status: 'error' }); log('재생성 오류: ' + err.message); }
  };

  // 기존 이미지를 넣어 요청한 부분만 수정
  const applyEdit = async () => {
    const i = editIdx, instruction = editText.trim();
    if (i < 0 || !itemsRef.current[i]) return;
    if (!instruction) { alert('수정 요청을 입력하세요'); return; }
    let key;
    try { key = await needKey(); } catch (err) { alert(err.message); return; }
    setModal('');
    const p = itemsRef.current[i], prev = p.img;
    setItem(i, { status: 'loading' });
    try {
      const res = await illGeminiFetch(key, ILL_IMAGE_MODEL, {
        contents: [{ parts: [
          { inlineData: { mimeType: prev.substring(5, prev.indexOf(';')), data: prev.split(',')[1] } },
          { text: '이 교육 웹툰 삽화를 아래 요청에 맞게 수정해줘. 요청한 부분만 바꾸고, 전체적인 손그림 교육 웹툰 스타일·구도·캐릭터와 말풍선의 한국어 글자는 최대한 그대로 유지해줘.\n\n[수정 요청] ' + instruction + '\n\n지켜야 할 것: 1:1 정사각형 유지 · 배경은 순백(#FFFFFF) 단색이고 배경에 풍경·소품·질감을 그리지 말 것 · 액자·테두리·프레임·컷 경계선은 절대 넣지 말 것(흰 배경이 네 변 끝까지 이어지게) · 메시지는 말풍선이 전달하고 하단 문구는 두 줄 이내로만 · 한국어는 또렷하게 렌더링.' }
        ] }],
        generationConfig: { imageConfig: { aspectRatio: '1:1', imageSize: '1K' }, temperature: 0.35 }
      }, log);
      setItem(i, { img: await illParseImageResponse(res), status: 'done' });
      illUsageAdd(1);
      log('지문 ' + p.num + ': 수정 완료');
    } catch (err) {
      setItem(i, { img: prev, status: prev ? 'done' : 'error' });
      log('지문 ' + p.num + ': 수정 실패 — ' + err.message);
      alert('수정에 실패했어요: ' + err.message);
    }
  };

  const fileNameFor = (p, i) => '지문' + illSanitize(p.num || (i + 1)) + '.png';
  const downloadOne = (i) => {
    const p = items[i];
    if (!p || !p.img) return;
    illSaveBlob(new Blob([illB64ToBytes(p.img.split(',')[1])], { type: 'image/png' }), fileNameFor(p, i));
  };
  const downloadZip = () => {
    const used = {}, files = [];
    items.forEach((p, i) => {
      if (!p.img) return;
      let name = fileNameFor(p, i);
      if (used[name]) name = name.replace(/\.png$/, '_' + (i + 1) + '.png'); // 중복 방지
      used[name] = 1;
      files.push({ name, bytes: illB64ToBytes(p.img.split(',')[1]) });
    });
    if (!files.length) return;
    illSaveBlob(illZipStore(files), illSanitize(pdfName || '지문') + '_삽화.zip');
  };

  // ── 공통 스타일 ──
  const card = { background: T.emptyCardBg, border: '1px solid ' + T.panelBorder, borderRadius: '14px' };
  const btn = (kind) => ({
    height: '36px', padding: '0 16px', borderRadius: '9px', cursor: busy && kind === 'primary' ? 'default' : 'pointer',
    fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px',
    border: kind === 'primary' ? 'none' : '1px solid ' + T.panelBorder,
    background: kind === 'primary' ? PC : (dark ? 'rgba(255,255,255,0.06)' : '#ffffff'),
    color: kind === 'primary' ? '#fff' : T.text
  });
  const stepBadge = { background: PC, color: '#fff', fontSize: '11.5px', fontWeight: 700, padding: '3px 11px', borderRadius: '20px', letterSpacing: '0.3px' };
  const stepLabel = { fontSize: '15px', fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: '9px', margin: '0 0 12px' };
  const tabBtn = (on) => ({
    border: '1px solid ' + (on ? PC : T.panelBorder), background: on ? (dark ? 'rgba(77,163,255,0.12)' : pcTint(PC, 0.9)) : (dark ? 'rgba(255,255,255,0.04)' : '#ffffff'),
    color: on ? PC : T.textDim, borderRadius: '20px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
  });
  const field = { width: '100%', border: '1px solid ' + T.panelBorder, borderRadius: '10px', padding: '12px 14px', fontSize: '14px', lineHeight: 1.6, fontFamily: 'inherit', background: dark ? 'rgba(255,255,255,0.04)' : '#fff', color: T.text };

  const doneCount = items.filter(p => p.img).length;

  return (
    <div data-noprint="" style={{ maxWidth: '1040px', margin: '0 auto', paddingBottom: '40px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: T.text }}>삽화 생성기</div>
          <div style={{ fontSize: '12.5px', color: T.textDim, marginTop: '2px' }}>지문 → 교육 웹툰 삽화 · Nano Banana Pro</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: T.textDim, marginRight: '2px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: keyState === 'ok' ? '#15803d' : keyState === 'checking' ? '#c9a227' : '#dc2626' }} />
            {keyState === 'ok' ? 'API 키 확인됨' : keyState === 'checking' ? '확인 중…' : keyState === 'missing' ? 'API 키 미등록' : '설정을 읽지 못함'}
          </span>
          <button style={btn()} onClick={() => setModal('help')}>사용법</button>
          {isAdmin && <button style={btn()} onClick={() => setModal('ref')}>기준 캐릭터</button>}
          {isAdmin && <button style={btn()} onClick={() => setModal('free')}>자유 생성</button>}
          <button style={btn()} onClick={() => setModal('usage')}>사용량</button>
        </div>
      </div>

      {keyState === 'missing' && (
        <div style={{ ...card, padding: '14px 16px', marginBottom: '16px', fontSize: '13px', color: T.text, borderColor: '#dc2626' }}>
          Gemini API 키가 등록되지 않아 생성이 되지 않습니다. 관리자가 Supabase <b>app_config</b> 테이블의 <b>gemini_api_key</b> 값을 넣어야 합니다 (scripts/illust_schema.sql 참고).
        </div>
      )}

      {/* STEP 1 */}
      <div style={stepLabel}><span style={stepBadge}>STEP 1</span> 지문을 입력하세요</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button style={tabBtn(src === 'lib')} onClick={() => setSrc('lib')}>선택한 지문 {sheets.length ? '(' + sheets.length + '개)' : ''}</button>
        <button style={tabBtn(src === 'pdf')} onClick={() => setSrc('pdf')}>PDF로 입력하기</button>
        <button style={tabBtn(src === 'text')} onClick={() => setSrc('text')}>직접 입력하기</button>
      </div>

      {src === 'lib' && (
        <div style={{ ...card, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '13.5px', color: T.textDim, lineHeight: 1.6 }}>
            {sheets.length
              ? <>왼쪽에서 고른 <b style={{ color: T.text }}>{sheets.length}개</b> 지문으로 삽화를 만듭니다. 지문 번호가 그대로 파일명이 됩니다.</>
              : <>왼쪽 라이브러리에서 지문을 체크한 뒤 [지문 분석]을 누르세요.</>}
          </div>
          <button style={btn('primary')} disabled={busy || !sheets.length} onClick={analyze}>지문 분석</button>
        </div>
      )}

      {src === 'pdf' && (<>
        <div onClick={() => fileRef.current && fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
          style={{ border: '2px dashed ' + (drag ? PC : T.panelBorder), borderRadius: '14px', padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: drag ? pcTint(PC, 0.92) : T.emptyCardBg, transition: EASE }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: T.text }}>PDF를 여기에 끌어다 놓기</div>
          <div style={{ fontSize: '12px', color: T.textDim, marginTop: '4px' }}>또는 클릭해서 파일 선택 · 스타일 고정, 비율 1:1, 지문당 삽화 1장</div>
          <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={e => onFile(e.target.files[0])} />
        </div>
        {pdfB64 && (
          <div style={{ ...card, marginTop: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfName}.pdf</span>
            <button style={btn('primary')} disabled={busy} onClick={analyze}>지문 분석</button>
          </div>
        )}
      </>)}

      {src === 'text' && (<>
        <textarea value={text} onChange={e => setText(e.target.value)} style={{ ...field, minHeight: '200px', resize: 'vertical' }}
          placeholder={'영어 지문을 붙여넣으세요.\n지문이 여러 개면 지문 사이를 빈 줄로 구분하세요. (한 개만 입력해도 됩니다.)'} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button style={btn('primary')} disabled={busy} onClick={analyze}>지문 분석</button>
        </div>
      </>)}

      {status && <div style={{ fontSize: '13px', color: T.textDim, marginTop: '12px' }}>{status}</div>}

      {/* STEP 2 */}
      <div style={{ ...stepLabel, marginTop: '26px' }}><span style={stepBadge}>STEP 2</span> 삽화를 생성하세요</div>
      <div style={{ display: 'flex', gap: '10px', margin: '0 0 14px' }}>
        <button style={{ ...btn('primary'), opacity: (busy || !items.length) ? 0.5 : 1 }} disabled={busy || !items.length} onClick={generateAll}>
          {busy ? '생성 중…' : '삽화 생성'}
        </button>
        <button style={{ ...btn(), opacity: doneCount ? 1 : 0.5 }} disabled={!doneCount} onClick={downloadZip}>전체 다운로드{doneCount ? ' (' + doneCount + ')' : ''}</button>
      </div>

      {!items.length ? (
        <div style={{ ...card, padding: '40px 0', textAlign: 'center', fontSize: '13px', color: T.textDim }}>지문을 입력하고 분석하면 여기에 표시됩니다.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '14px' }}>
          {items.map((p, i) => (
            <div key={i} style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '1', background: p.status === 'error' ? (dark ? '#3a1f22' : '#fef2f2') : (dark ? 'rgba(255,255,255,0.03)' : '#f5f5f7'), position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {p.status === 'done' && p.img && <img src={p.img} alt={'지문 ' + p.num} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                {p.status === 'loading' && <>
                  <div className="ill-spin" style={{ width: '26px', height: '26px', border: '3px solid ' + T.divider, borderTopColor: PC, borderRadius: '50%' }} />
                  <div style={{ fontSize: '12px', color: T.textDim }}>생성 중…</div>
                </>}
                {p.status === 'error' && <>
                  <div style={{ fontSize: '12px', color: '#dc2626' }}>생성 실패</div>
                  <button style={{ ...btn(), height: '30px' }} onClick={() => regen(i)}>다시 시도</button>
                </>}
                {p.status === 'idle' && <div style={{ fontSize: '12px', color: T.textDim }}>대기 중</div>}
                <span style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>지문 {p.num}</span>
                {p.status === 'done' && p.img && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                    {[['수정', () => { setEditIdx(i); setEditText(''); setModal('edit'); }], ['다운로드', () => downloadOne(i)], ['재생성', () => regen(i)]].map(([t, fn]) => (
                      <button key={t} title={t} onClick={fn} style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', background: 'rgba(255,255,255,0.92)', cursor: 'pointer', color: '#333', fontSize: '13px', lineHeight: 1, padding: 0 }}>
                        {t === '수정' ? '✎' : t === '다운로드' ? '↓' : '↻'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div title={p.bubble || ''} style={{ padding: '9px 11px', fontSize: '12px', color: T.textDim, borderTop: '1px solid ' + T.panelBorder, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                지문 {p.num} · {p.bubble || ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {logLines.length > 0 && (
        <pre style={{ ...card, marginTop: '18px', padding: '12px 14px', fontSize: '12px', color: T.textDim, whiteSpace: 'pre-wrap', fontFamily: 'inherit', maxHeight: '220px', overflow: 'auto' }}>{logLines.join('\n')}</pre>
      )}

      <style>{'@keyframes ill-spin{to{transform:rotate(360deg)}} .ill-spin{animation:ill-spin .8s linear infinite}'}</style>

      {modal && <IllustModal kind={modal} dark={dark} T={T} PC={PC} btn={btn} field={field} userName={userName}
        onClose={() => setModal('')} editText={editText} setEditText={setEditText}
        editWho={editIdx >= 0 && items[editIdx] ? '지문 ' + items[editIdx].num + ' 삽화를 수정합니다' : ''}
        onApplyEdit={applyEdit} log={log} />}
    </div>
  );
}

// 삽화 모드의 모달 모음 — 사용법 · 사용량 · 기준 캐릭터 · 자유 생성 · 수정
function IllustModal({ kind, dark, T, PC, btn, field, onClose, editText, setEditText, editWho, onApplyEdit, log }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [refImg, setRefImg] = useState(undefined);   // undefined=로딩, null=없음
  const [refNew, setRefNew] = useState(null);
  const [freePrompt, setFreePrompt] = useState('');
  const [freeImgs, setFreeImgs] = useState([]);
  const [freeRatio, setFreeRatio] = useState('1:1');
  const [freeSize, setFreeSize] = useState('1K');
  const [freeOut, setFreeOut] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kind === 'usage') illUsageStats().then(r => setRows(r.rows), e => setErr(e.message));
    if (kind === 'ref') illGetConfig('illust_refchar').then(v => setRefImg(v || null), e => setErr(e.message));
  }, [kind]);

  const wrap = { position: 'fixed', inset: 0, background: 'rgba(17,29,52,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px' };
  const box = (w) => ({ background: dark ? '#232529' : '#ffffff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: w + 'px', maxHeight: '86vh', overflow: 'auto', boxShadow: '0 24px 70px rgba(11,20,40,0.45)', color: T.text });
  const h2 = { margin: 0, fontSize: '18px', fontWeight: 700 };
  const sub = { margin: '2px 0 18px', fontSize: '13px', color: T.textDim };
  const label = { display: 'block', fontSize: '12px', color: T.textDim, marginBottom: '5px' };
  const errLine = { color: '#dc2626', fontSize: '12px', minHeight: '16px', margin: '4px 0' };

  const saveRef = async () => {
    if (!refNew) return;
    setBusy(true); setErr('저장 중…');
    try { await illSetConfig('illust_refchar', refNew); setErr(''); onClose(); alert('기준 캐릭터가 저장되었습니다. 이제 모든 삽화가 이 캐릭터로 그려집니다.'); }
    catch (e) { setErr(e.message || '저장 실패'); }
    setBusy(false);
  };
  const doFree = async () => {
    if (!freePrompt.trim()) { setErr('프롬프트를 입력하세요'); return; }
    setErr(''); setBusy(true); setFreeOut('');
    try {
      const key = await illGetConfig('gemini_api_key');
      if (!key) throw new Error('Gemini API 키가 등록되지 않았습니다.');
      const parts = freeImgs.map(d => ({ inlineData: { mimeType: d.substring(5, d.indexOf(';')), data: d.split(',')[1] } }));
      parts.push({ text: freePrompt.trim() });
      const res = await illGeminiFetch(key, ILL_IMAGE_MODEL, {
        contents: [{ parts }],
        generationConfig: { imageConfig: { aspectRatio: freeRatio, imageSize: freeSize } }
      }, log);
      setFreeOut(await illParseImageResponse(res));
      illUsageAdd(1);
    } catch (e) { setErr('생성 실패: ' + e.message); }
    setBusy(false);
  };

  return (
    <div style={wrap} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {kind === 'help' && (
        <div style={box(560)}>
          <h2 style={h2}>사용법 안내</h2>
          <p style={sub}>선택한 지문·PDF·직접 입력한 영어 지문으로 교육 웹툰 삽화를 만드는 도구입니다.</p>
          {[
            ['STEP 1 · 지문 입력', [
              <><b>선택한 지문</b> — 왼쪽 라이브러리에서 체크한 지문을 그대로 씁니다. 지문 번호가 파일명이 됩니다.</>,
              <><b>PDF로 입력하기</b> — PDF를 끌어다 놓으면 앱이 모든 페이지를 읽어 지문을 자동으로 나눕니다.</>,
              <><b>직접 입력하기</b> — 지문을 붙여넣고 [지문 분석]. 여러 개면 사이를 <b>빈 줄</b>로 구분하세요.</>,
              <>화면에 <b>"지문 N개 인식됨"</b>이 뜨면 준비 완료입니다.</>
            ]],
            ['STEP 2 · 삽화 생성', [
              <><b>삽화 생성</b>을 누르면 지문마다 1:1 삽화가 <b>1장씩</b> 만들어집니다.</>,
              <>글자(한글)가 깨지면 앱이 자동으로 검수해 다시 생성합니다(최대 3회).</>,
              <>여러 장이 동시에 생성돼 빠르게 끝납니다. 진행 상황은 아래 로그에 표시됩니다.</>
            ]],
            ['생성된 삽화 관리', [
              <><b>✎ 수정</b> — 바꿀 내용을 적으면(예: "배경을 교실로") 기존 그림에서 <b>그 부분만</b> 고칩니다. 반복 수정 가능.</>,
              <><b>↻ 재생성</b> — 같은 지문으로 <b>완전히 새로</b> 다시 그립니다.</>,
              <><b>↓ 다운로드</b> — 삽화 1장을 PNG로 저장(파일명 = 지문 번호).</>,
              <><b>전체 다운로드</b> — 만들어진 모든 삽화를 ZIP으로 저장합니다.</>
            ]]
          ].map(([t, ls]) => (
            <div key={t} style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>{t}</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: 1.75 }}>{ls.map((l, i) => <li key={i} style={{ marginBottom: '4px' }}>{l}</li>)}</ul>
            </div>
          ))}
          <button style={{ ...btn('primary'), width: '100%', justifyContent: 'center', marginTop: '18px' }} onClick={onClose}>확인</button>
        </div>
      )}

      {kind === 'usage' && (
        <div style={box(460)}>
          <h2 style={h2}>사용량 모니터링</h2>
          <p style={sub}>생성한 삽화 수 · 오늘 {illKstToday()}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead><tr>{['사용자', '오늘', '이번 주', '이번 달'].map((h, i) => (
              <th key={h} style={{ padding: '10px 8px', borderBottom: '1px solid ' + T.divider, textAlign: i === 0 ? 'left' : 'center', color: T.textDim, fontWeight: 600, fontSize: '12px' }}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {rows === null && <tr><td colSpan={4} style={{ padding: '14px', color: T.textDim, textAlign: 'center' }}>불러오는 중…</td></tr>}
              {rows !== null && rows.length === 0 && <tr><td colSpan={4} style={{ padding: '14px', color: T.textDim, textAlign: 'center' }}>아직 생성 기록이 없습니다.</td></tr>}
              {(rows || []).map(u => (
                <tr key={u.name}>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid ' + T.divider, fontWeight: 700 }}>{u.name}</td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid ' + T.divider, textAlign: 'center', fontWeight: 700, fontSize: '15px' }}>{u.day}</td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid ' + T.divider, textAlign: 'center' }}>{u.week}</td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid ' + T.divider, textAlign: 'center' }}>{u.month}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={errLine}>{err}</div>
          <button style={{ ...btn(), width: '100%', justifyContent: 'center', marginTop: '10px' }} onClick={onClose}>닫기</button>
        </div>
      )}

      {kind === 'ref' && (
        <div style={box(420)}>
          <h2 style={h2}>기준 캐릭터 설정</h2>
          <p style={sub}>여기 등록한 캐릭터로 모든 삽화를 그립니다. (관리자 전용)</p>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            {(refNew || refImg)
              ? <img src={refNew || refImg} alt="기준 캐릭터" style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '12px', border: '1px solid ' + T.panelBorder }} />
              : <div style={{ fontSize: '13px', color: T.textDim }}>{refImg === undefined ? '불러오는 중…' : '아직 등록된 캐릭터가 없습니다.'}</div>}
          </div>
          <label style={label}>캐릭터 이미지 선택 (PNG/JPG)</label>
          <input type="file" accept="image/*" style={{ ...field, padding: '8px' }} onChange={async e => {
            const f = e.target.files[0]; if (!f) return;
            setErr('');
            try { setRefNew(await illResizeImage(f, 1024)); } catch (er) { setErr(er.message); }
          }} />
          <div style={errLine}>{err}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...btn(), flex: 1, justifyContent: 'center' }} onClick={onClose}>닫기</button>
            <button style={{ ...btn('primary'), flex: 1, justifyContent: 'center', opacity: (!refNew || busy) ? 0.5 : 1 }} disabled={!refNew || busy} onClick={saveRef}>저장</button>
          </div>
        </div>
      )}

      {kind === 'free' && (
        <div style={box(560)}>
          <h2 style={h2}>자유 생성 (나노바나나 프로)</h2>
          <p style={sub}>프롬프트를 직접 작성해 이미지를 생성합니다. (관리자 전용)</p>
          <label style={label}>프롬프트</label>
          <textarea value={freePrompt} onChange={e => setFreePrompt(e.target.value)} style={{ ...field, minHeight: '120px', resize: 'vertical' }}
            placeholder="예: 벚꽃 흩날리는 교실 창가, 따뜻한 오후 햇살, 수채화 스타일 / 이미지 첨부 시: 이 사진을 지브리풍으로 바꿔줘" />
          <div style={{ marginTop: '12px' }}>
            <label style={label}>인풋 이미지 (선택 · 여러 장 가능)</label>
            <input type="file" accept="image/*" multiple style={{ ...field, padding: '8px' }} onChange={async e => {
              const list = [];
              for (const f of e.target.files) { try { list.push(await illResizeImage(f, 1536)); } catch (er) {} }
              e.target.value = '';
              setFreeImgs(prev => prev.concat(list));
            }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {freeImgs.map((d, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={d} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', border: '1px solid ' + T.panelBorder }} />
                  <button title="제거" onClick={() => setFreeImgs(prev => prev.filter((_, k) => k !== i))}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', border: 'none', borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: '12px', lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={label}>비율</label>
              <select value={freeRatio} onChange={e => setFreeRatio(e.target.value)} style={{ ...field, height: '40px', padding: '0 12px' }}>
                {['1:1', '16:9', '9:16', '4:3', '3:4'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>해상도</label>
              <select value={freeSize} onChange={e => setFreeSize(e.target.value)} style={{ ...field, height: '40px', padding: '0 12px' }}>
                <option value="1K">1K (빠름)</option><option value="2K">2K (고화질)</option>
              </select>
            </div>
          </div>
          <div style={errLine}>{err}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...btn(), flex: 1, justifyContent: 'center' }} onClick={onClose}>닫기</button>
            <button style={{ ...btn('primary'), flex: 1, justifyContent: 'center', opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={doFree}>{busy ? '생성 중…' : '생성'}</button>
          </div>
          {freeOut && (
            <div style={{ marginTop: '14px', textAlign: 'center' }}>
              <img src={freeOut} style={{ maxWidth: '100%', borderRadius: '12px', border: '1px solid ' + T.panelBorder }} />
              <div style={{ marginTop: '10px' }}>
                <button style={btn()} onClick={() => illSaveBlob(new Blob([illB64ToBytes(freeOut.split(',')[1])], { type: 'image/png' }), 'nanobanana_' + Date.now() + '.png')}>이미지 다운로드</button>
              </div>
            </div>
          )}
        </div>
      )}

      {kind === 'edit' && (
        <div style={box(400)}>
          <h2 style={h2}>삽화 수정</h2>
          <p style={sub}>{editWho}</p>
          <label style={label}>어떻게 바꿀까요? (수정 요청)</label>
          <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ ...field, minHeight: '110px', resize: 'vertical' }}
            placeholder="예: 배경을 교실로 바꿔줘 / 캐릭터 표정을 더 밝게 / 말풍선을 위로 옮겨줘 / 색을 파란색 계열로" />
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button style={{ ...btn(), flex: 1, justifyContent: 'center' }} onClick={onClose}>취소</button>
            <button style={{ ...btn('primary'), flex: 1, justifyContent: 'center' }} onClick={onApplyEdit}>수정 적용</button>
          </div>
        </div>
      )}
    </div>
  );
}
