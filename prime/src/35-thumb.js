// ══════════════════════════════════════════════════════════════════════
// 썸네일 제작 (홈 앱 — 권한 키 'thumb', PD + 개발자. 2026-11-26 사장님 — "PD 는 썸네일 제작 앱과 CG 앱")
//   영상 파일을 넣으면 ① 앱이 그 자리에서 장면 24장을 뽑고(서버에 올리지 않는다) ② Gemini(글)가 장면을 보고 **시안 5개**를
//   정한다 — 시안마다 바탕이 될 장면(후킹되는 순간)·제목·작은 글·글자 틀·색 ③ 바로 만든다 — **바탕은 전부 영상의 실제 장면**이라
//   비용 0 이고 AI 티가 안 난다(같은 날 사장님 — "후킹이 좋은 장면을 뽑아서 썸네일이 영상을 대표할 수 있도록", "최대한 AI 티 나지 않게").
//   카드의 「사진처럼 다듬기」를 누를 때만 나노바나나 프로(gemini-3-pro-image)가 그 장면을 사진 그대로 선명하게 손본다(삽화 1장 값).
//   ③-2 **AI 배경 시안 5개**(같은 날 사장님 — jordicor/youtube_thumbnail_generator_with_AIs(MIT) 방식을 우리 말로 흡수하되, **나노바나나는 사람을
//   그리지 않는다**(같은 날 사장님 — "나노바나나가 사람을 생성하면 안 돼, 원본에서 누끼 따서 쓰는 건 괜찮아")): 영상(소리)을 읽고 내용에서 뽑은
//   장면을 나노바나나 프로가 **사람 없는 배경만** 그리고, 그 위에 영상 원본 장면에서 **누끼를 딴 사람**(픽셀 그대로)을 앱이 붙인다. 글자는 앱이 얹는다.
//   누끼는 **MODNet 인물 매팅**(onnxruntime-web, Apache-2.0, 512px — 머리카락까지 알파)을 **브라우저 안에서** 돌린다 — 사진이 밖으로 안 나가고 비용 0.
//   (처음엔 MediaPipe selfie_segmenter(256px)였는데 가장자리가 지저분했다 — 같은 날 사장님. MediaPipe 는 MODNet 을 못 불러올 때의 대비.) 둘 다 CDN(jsdelivr·허깅페이스) —
//   wasm·모델이 커서 앱에 안 넣는다(썸네일은 어차피 인터넷이 필요하다). 처음 한 번만 받고 Cache API 에 둔다.
//   영상 한 편에 나노바나나 5번(배경만). 올린 소리·파일은 계획이 끝나면 지운다(안 지워도 48시간 뒤 사라진다). 파일 올리기가 실패하면 장면만으로 계획한다.
//   ③-3 **콜라주 시안 5개**(같은 날 사장님 — 보여 주신 사람이 만든 썸네일 느낌으로도): 전부 앱이 캔버스로 만든다(비용 0) — 자료 장면을 흐리고
//   어둡게 깔고, 누끼 딴 사람을 양옆에 크게 붙이고, 핵심 숫자를 가운데 크게 빛나게 찍는다(프리텐다드). 어느 장면·어느 숫자인지는 Gemini 가 정한다.
//   로고(선택): 왼쪽 위에 앱이 얹는다(모든 시안 공통, 비용 0).
//   ④ 제목 글자는 앱이 캔버스로 **프리텐다드**로 얹는다(사장님 2026-11-26 — "글자는 무조건 프리텐다드", "AI 가 가장 좋은 걸로 적어 주고 사람이 후수정").
//   크기는 가로 1920×1080 · 세로 1080×1920 둘 중 선택(같은 날 사장님 — 처음엔 가로 고정이었다가 "가로 버전 세로 버전 고를 수 있게"). 결과는 PNG 로 PC 에 내려받기만.
//   소리: 데스크톱 앱이면 main.js 가 ffmpeg(lib/audio-extract.js)로 소리만 뽑아(22분 ≈ 8MB) Gemini 에 올린다 — 영상 크기와 무관. 웹판은 2GB 아래 영상만 통째로 올리고, 넘으면 장면만.
//   Gemini 호출·키·사용량은 삽화(10-illust.js)의 것을 그대로 쓴다 — illGetConfig('gemini_api_key') · illGeminiFetch · illUsageAdd.
//   모델: 기획 gemini-3.1-pro-preview(TH_PLAN_MODEL) · 그림 gemini-3-pro-image — 2026-11-26 API 로 실재 확인.
// ══════════════════════════════════════════════════════════════════════
const TH_FRAMES = 24;                 // 영상에서 뽑는 장면 수 — 후킹되는 순간을 고를 폭
const TH_FRAME_W = 640;               // 분석·참고용 장면 폭(px)
const TH_SIZES = { h: { label: '가로 1920×1080', w: 1920, h: 1080, ratio: '16:9' }, v: { label: '세로 1080×1920', w: 1080, h: 1920, ratio: '9:16' } };   // 2026-11-26 사장님 — "가로 버전 세로 버전 고를 수 있게". 세로 영상이면 세로가 기본
const TH_N = 5;                       // AI 가 추천하는 시안 수(실제 장면 5 + AI 그림 5)
const TH_PLAN_MODEL = 'gemini-3.1-pro-preview';   // 영상을 보고 기획하는 모델(2026-11-26 사장님 — "3.1 프로 프리뷰로 넣어". 삽화의 Flash 보다 비싸지만 기획 품질 우선). 2026-11-26 API 로 실재 확인
const TH_GAPI = 'https://generativelanguage.googleapis.com';
const TH_UPLOAD_MAX = 2 * 1024 * 1024 * 1024;   // Gemini 파일 한도 2GB — 넘으면 올리지 않고 장면만으로(소리 없이) 계획한다
// 글자 틀(2026-11-26 사장님이 보여 준 사람이 만든 썸네일 기준 — 굵은 검정 외곽선 글자가 띠 없이 아래 가운데에 두 줄로 꽉 차고, 핵심 낱말만 색이 다르다). 예전 띠·그라데이션은 "AI 티"
const TH_STYLES = [['outline', '외곽선 · 아래 가운데'], ['outline-top', '외곽선 · 위 가운데'], ['band', '아래 띠(옛 모양)']];
const TH_ACCENT = { '*': '#ffe14d', '_': '#7cf2c8' };   // *노랑* _민트_ — 제목 안에서 강조 표시
const TH_COLORS = [['#ffffff', '흰색'], ['#ffe14d', '노랑'], ['#7cf2c8', '민트'], ['#111111', '검정']];   // 기본 글자색(강조 표시가 없는 글자)
const TH_MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3';   // 누끼 — 2026-11-11 판(2주 넘음). wasm 은 TH_MP + '/wasm'
const TH_ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/';   // 누끼 1순위 — MODNet(인물 매팅, Apache-2.0, 512px, 머리카락까지 알파). 2025-09 판
const TH_MODNET = 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx';   // 26MB · 처음 한 번 받아 Cache API 에 둔다
const TH_MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';   // 250KB · 사람 신뢰도 마스크
const TH_FONT = "'Pretendard WT', sans-serif";   // 프리텐다드(index.html @font-face — Black 900 · SemiBold 600, ASCII + 완성형 한글 2,350자)

// 영상에서 n 장을 고르게 뽑는다(앞뒤 4% 는 뺀다 — 검은 화면·로고). 브라우저가 못 읽는 코덱(HEVC .mov 등)이면 오류.
function thSeek(v, t) { return new Promise((res) => { v.onseeked = () => res(); v.currentTime = t; }); }
async function thOpenVideo(file) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(file);
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('이 영상을 브라우저가 읽지 못합니다 — mp4(H.264) 로 바꿔 넣어 주세요')); });
  if (!isFinite(v.duration) || v.duration <= 0 || !v.videoWidth) throw new Error('영상 길이·크기를 읽지 못했습니다');
  return v;
}
function thGrab(v, maxW) {
  const s = Math.min(1, maxW / v.videoWidth);
  const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88);
}
async function thExtractFrames(file, onProgress) {
  const v = await thOpenVideo(file);
  const out = [];
  for (let i = 0; i < TH_FRAMES; i++) {
    const t = v.duration * (0.04 + 0.92 * i / (TH_FRAMES - 1));
    await thSeek(v, t);
    out.push({ t, url: thGrab(v, TH_FRAME_W) });
    if (onProgress) onProgress(i + 1);
  }
  const info = { frames: out, w: v.videoWidth, h: v.videoHeight, dur: v.duration };
  URL.revokeObjectURL(v.src);
  return info;
}
async function thGrabFull(file, t, maxW) {   // 그 장면을 원래 크기(최대 1920)로 다시 뽑는다 — 시안 바탕·얼굴 참고 사진
  const v = await thOpenVideo(file);
  await thSeek(v, t);
  const url = thGrab(v, maxW || 1920);
  URL.revokeObjectURL(v.src);
  return url;
}
function thInline(dataUrl) { return { inlineData: { mimeType: dataUrl.substring(5, dataUrl.indexOf(';')), data: dataUrl.split(',')[1] } }; }
function thMmss(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }

// 영상을 Gemini 파일 저장소에 올린다(resumable) → { uri, name }. 처리(PROCESSING → ACTIVE)까지 기다린다.
async function thUploadVideo(key, file, log, mimeOverride) {
  const mime = mimeOverride || file.type || 'video/mp4';
  let res = await fetch(TH_GAPI + '/upload/v1beta/files?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(file.size), 'X-Goog-Upload-Header-Content-Type': mime, 'Content-Type': 'application/json' }, body: JSON.stringify({ file: { display_name: 'thumb-' + Date.now() } }) });
  const up = res.ok && res.headers.get('x-goog-upload-url');
  if (!up) throw new Error('영상 올리기 시작 실패 (' + res.status + ')');
  res = await fetch(up, { method: 'PUT', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: file });
  if (!res.ok) throw new Error('영상 올리기 실패 (' + res.status + ')');
  const j = await res.json(); let f = j.file || {};
  for (let i = 0; i < 90 && f.state === 'PROCESSING'; i++) {
    if (log) log('영상을 읽는 중… ' + (i * 2) + '초');
    await illSleep(2000);
    f = await (await fetch(TH_GAPI + '/v1beta/' + f.name + '?key=' + encodeURIComponent(key))).json();
  }
  if (f.state !== 'ACTIVE') throw new Error('영상 처리 실패 (' + (f.state || '?') + ')');
  return { uri: f.uri, name: f.name, mime };
}
function thDeleteUpload(key, name) { if (name) fetch(TH_GAPI + '/v1beta/' + name + '?key=' + encodeURIComponent(key), { method: 'DELETE' }).catch(() => {}); }

// Gemini(글)가 영상(올렸으면 소리까지)과 장면 24장을 보고 시안을 JSON 으로 정한다 — 실제 장면 5 + AI 그림 5 + 얼굴 참고 장면
async function thPlan(key, frames, video, orient, log) {
  const parts = video ? [{ fileData: { mimeType: video.mime, fileUri: video.uri } }] : [];
  frames.forEach((f) => parts.push(thInline(f.url)));
  parts.push({ text: '당신은 한국 학원의 유튜브 썸네일 기획자입니다. ' + (video ? (video.audioOnly ? '첫 번째 첨부는 영상의 소리(음성)이고, 그다음은 ' : '첫 번째 첨부는 영상 전체(소리 포함)이고, 그다음은 ') : '위는 ') + '그 영상에서 시간 순으로 뽑은 장면 ' + frames.length + '장입니다(1번부터). ' +
    (video ? '영상에서 말하는 내용(음성)을 끝까지 듣고 전체 흐름·결론을 먼저 파악한 뒤, ' : '소리 없이 장면만 보는 것이라 전체 주제는 장면들에 공통으로 보이는 큰 줄기로 잡고, ') + '이 영상을 대표하면서 **눌러 보고 싶게 만드는(후킹)** ' + (orient === 'v' ? '세로(9:16, 쇼츠)' : '가로(16:9)') + ' 썸네일을 두 묶음으로 ' + TH_N + '개씩 정하세요.\n' +
    '[A 실제 장면] 바탕은 이 장면들 가운데 하나를 그대로 씁니다(새로 그리지 않습니다) — 사람 얼굴·표정·동작이 살아 있는 순간, 핵심 장면, 숫자·결과가 보이는 순간처럼 눈길을 끄는 장면을 고르고, 흐리거나 검거나 글자만 가득한 장면은 피하세요. 5개는 서로 다른 장면.\n' +
    '[C 콜라주] 사람이 만든 유튜브 썸네일 모양 — 영상 속 사람(1~2명)을 원본에서 오려 양옆에 크게 두고, 뒤에는 자료·표 장면을 흐리고 어둡게 깔고, 핵심 숫자 하나를 가운데 크게 빛나게 띄운 합성(전부 앱이 만듭니다). persons 에 사람이 크고 또렷하게(상반신·표정, 화면 아래 자막이 얼굴·상체를 덮지 않은 것) 나온 장면 번호 1~2개(두 사람이 같이 나온 장면 하나여도 됩니다 — 앱이 사람별로 오립니다), data 에 자료·표·숫자가 보이는 장면 번호(없으면 null), figure 에 가운데 띄울 숫자나 아주 짧은 말(예 "913.3%", "42명"), label 에 그 이름(예 "충원율"). 5개는 서로 다른 장면·숫자·문구로.\n' +
    '[B AI 배경] AI 는 **사람 없는 배경만** 그리고, 그 위에 영상 원본에서 오려 낸 사람을 앱이 붙입니다. 먼저 faceFrames 에 주인공이 가장 크고 또렷하게(상반신·표정, 가려지지 않음) 나온 장면 번호를 1~3개 고르세요(사람이 없는 영상이면 빈 배열). ' +
    '그리고 영상 내용에서 나온 배경 아이디어 5개 — 각각 다른 장소·분위기·소품. scene 은 이미지 모델에 줄 영어 지시문: 장소·소품·조명·색감(내용에 맞게), 사람은 절대 넣지 말 것, personSide(left|right) 쪽은 사람이 설 자리로 비워 두고 반대쪽에 주제를 보여 주는 소품·화면을 두되 단순하게, 글자 넣을 빈 자리는 글자 틀 쪽. 사실적인 사진 느낌(photorealistic).\n' +
    '**제목은 영상 전체의 핵심 메시지여야 합니다** — 한 장면에 우연히 보인 표·숫자·대학 이름을 제목으로 삼지 마세요(장면은 바탕일 뿐이고, 글은 영상 전체가 말하는 것). 실제 장면 5개·AI 배경 5개·콜라주 5개의 제목이 모두 같은 영상의 주제를 가리켜야 하고, 세부 숫자는 영상에서 실제로 강조한 것만 씁니다. ' +
    '제목은 사람이 만든 유튜브 썸네일처럼 **두 줄**로(줄 사이를 " / " 로 나눔, 줄당 14자 이내, 전체가 영상의 핵심을 한 문장처럼 — 예: "2027 정시 1~3등급 · 교대 / 백분위로 살펴보는 추천대학!"), 과장·낚시 금지. 핵심 낱말 1~2개를 *별표*로 감싸면 노랑, 한 줄이나 구절을 _밑줄_로 감싸면 민트로 칠해집니다(둘 중 하나는 꼭 쓰세요). 작은 글(sub)은 비워 둡니다(사람이 만든 썸네일에는 없습니다 — 빈 문자열). ' +
    '글자 틀은 outline(아래 가운데 외곽선 글자 — 기본)·outline-top(위 가운데 — 아래에 사람·자료가 꽉 찼을 때)·band(아래 띠) 중 하나, 글자색은 white 가 기본(바탕이 아주 밝으면 black).\n' +
    'JSON 으로만 답하세요: {"topic":"영상 주제 한 줄(한국어)","summary":"영상 내용 요약 두 문장(한국어)","faceFrames":[장면 번호],' +
    '"plans":[{"frame":장면 번호,"title":"첫 줄 / 둘째 줄","sub":"","style":"outline|outline-top|band","color":"white|black","why":"이 장면을 고른 이유(한국어)"}],' +
    '"ai":[{"scene":"English prompt (no people)","personSide":"left|right","title":"첫 줄 / 둘째 줄","sub":"","style":"outline|outline-top|band","color":"white|black","why":"이 아이디어의 이유(한국어)"}],' +
    '"collage":[{"persons":[장면 번호],"data":장면 번호 또는 null,"figure":"913.3%","label":"충원율","title":"첫 줄 / 둘째 줄","sub":"","style":"outline","color":"white","why":"(한국어)"}]}' });
  const res = await illGeminiFetch(key, TH_PLAN_MODEL, { contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }, log);
  if (!res.ok) throw new Error('분석 API ' + res.status + ' — ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  const txt = (((data.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join('');
  let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('분석 결과를 읽지 못했습니다'); }
  const colorOf = { white: '#ffffff', yellow: '#ffe14d', black: '#111111', mint: '#7cf2c8' };
  const norm = (p) => ({ title: String(p.title || '').trim(), sub: String(p.sub || '').trim(), style: ['outline', 'outline-top', 'band'].indexOf(p.style) >= 0 ? p.style : 'outline', color: colorOf[p.color] || '#ffffff', why: String(p.why || '').trim() });
  const plans = (Array.isArray(j.plans) ? j.plans : []).slice(0, TH_N).map((p) => Object.assign({ frame: Math.min(frames.length - 1, Math.max(0, Number(p.frame) - 1 || 0)) }, norm(p)));
  while (plans.length < TH_N) plans.push({ frame: Math.floor(frames.length * (plans.length + 1) / (TH_N + 1)), title: '', sub: '', style: 'outline', color: '#ffffff', why: '' });
  const faceFrames = (Array.isArray(j.faceFrames) ? j.faceFrames : []).map((n) => Number(n) - 1).filter((i) => i >= 0 && i < frames.length).slice(0, 3);
  const ai = (Array.isArray(j.ai) ? j.ai : []).slice(0, TH_N).map((p) => Object.assign({ scene: String(p.scene || '').trim(), personSide: p.personSide === 'left' ? 'left' : 'right' }, norm(p))).filter((p) => p.scene);
  const idx = (n) => { const i = Number(n) - 1; return i >= 0 && i < frames.length ? i : null; };
  const collage = (Array.isArray(j.collage) ? j.collage : []).slice(0, TH_N).map((p) => Object.assign({ style: 'outline' }, Object.assign({
    persons: (Array.isArray(p.persons) ? p.persons : []).map(idx).filter((x) => x != null).slice(0, 2), data: idx(p.data),
    figure: String(p.figure || '').trim(), label: String(p.label || '').trim() }, norm(p)), { style: 'outline' })).filter((p) => p.persons.length);
  return { topic: String(j.topic || ''), summary: String(j.summary || ''), plans, faceFrames, ai, collage };
}
// 나노바나나 프로 — AI 그림 시안: 얼굴 참고 사진(1~3장) + 장면 지시. 얼굴은 참고에서만, 글자 없음, 16:9
async function thDraw(key, scene, style, side, ratio, log) {
  const space = style === 'outline-top' ? 'the upper part' : 'the lower third';
  const parts = [{ text: 'Paint a background plate for a YouTube thumbnail — a scene with NO people at all (no person, no face, no body part, no silhouette, no mannequin): ' + scene + ' ' +
    'Photorealistic photograph, ' + ratio + ', a clean simple composition with strong contrast that reads at phone size. Leave the ' + side + ' third of the frame as a quiet, uncluttered area (a real person will be composited there later), keep clean space in ' + space + ' for a caption, and keep the bottom-right corner free. Absolutely no text, letters, numbers, logos, borders, watermarks or interface elements.' }];
  const res = await illGeminiFetch(key, ILL_IMAGE_MODEL, { contents: [{ parts }], generationConfig: { imageConfig: { aspectRatio: ratio, imageSize: '2K' }, temperature: 0.6 } }, log);
  const url = await illParseImageResponse(res);
  illUsageAdd(1);
  return url;
}
// 나노바나나 프로 — 「사진처럼 다듬기」: 그 장면을 사진 그대로 두고 선명도·빛만 손본다(AI 티가 안 나게 — 새로 그리지 않는다)
async function thPaint(key, ref, log) {
  const parts = [thInline(ref), { text: 'Enhance this exact video frame as a photograph: keep every person, face, pose, object, framing and background exactly as they are. Only improve sharpness, exposure, contrast and color so it looks like a clean high-quality photo taken on a good camera. Do not stylize, do not add or remove anything, do not change the composition. Absolutely no text, letters, captions, logos or watermarks.' }];
  const res = await illGeminiFetch(key, ILL_IMAGE_MODEL, { contents: [{ parts }], generationConfig: { imageConfig: { aspectRatio: '16:9', imageSize: '2K' }, temperature: 0.5 } }, log);
  const url = await illParseImageResponse(res);
  illUsageAdd(1);
  return url;
}

// 누끼 ① MODNet(onnxruntime-web) — 알파 매트. 처음 한 번만 CDN 에서 받는다
let TH_MAT = null;
function thScript(src) { return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error('스크립트 로드 실패 ' + src)); document.head.appendChild(sc); }); }
async function thMatter() {
  if (TH_MAT) return TH_MAT;
  TH_MAT = (async () => {
    if (!window.ort) await thScript(TH_ORT + 'ort.min.js');
    window.ort.env.wasm.wasmPaths = TH_ORT;
    let buf = null;
    try { const cache = await caches.open('sl-thumb-models'); let r = await cache.match(TH_MODNET); if (!r) { await cache.add(TH_MODNET); r = await cache.match(TH_MODNET); } buf = await r.arrayBuffer(); } catch (e) { buf = null; }
    if (!buf) buf = await (await fetch(TH_MODNET)).arrayBuffer();
    return window.ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
  })().catch((e) => { TH_MAT = null; throw new Error('누끼 모델(MODNet)을 못 불러왔습니다 — ' + (e.message || e)); });
  return TH_MAT;
}
// 그림 → { alpha: Float32Array(0~1), mw, mh }. 긴 변 512, 32 의 배수. 입력 (x/255-0.5)/0.5
async function thMatteAlpha(im) {
  const sess = await thMatter();
  const sc = 512 / Math.max(im.width, im.height);
  const mw = Math.max(32, Math.round(im.width * sc / 32) * 32), mh = Math.max(32, Math.round(im.height * sc / 32) * 32);
  const c = document.createElement('canvas'); c.width = mw; c.height = mh;
  const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, mw, mh);
  const d = ctx.getImageData(0, 0, mw, mh).data, n = mw * mh, x = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) { x[i] = (d[i * 4] / 255 - 0.5) / 0.5; x[n + i] = (d[i * 4 + 1] / 255 - 0.5) / 0.5; x[2 * n + i] = (d[i * 4 + 2] / 255 - 0.5) / 0.5; }
  const feeds = {}; feeds[sess.inputNames[0]] = new window.ort.Tensor('float32', x, [1, 3, mh, mw]);
  const out = await sess.run(feeds);
  const t = out[sess.outputNames[0]];
  return { alpha: t.data, mw, mh };
}
// 누끼 ② MediaPipe 이미지 세그멘테이션 — MODNet 이 안 될 때
let TH_SEG = null;
async function thSegmenter() {
  if (TH_SEG) return TH_SEG;
  TH_SEG = (async () => {
    const vision = await import(TH_MP + '/vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(TH_MP + '/wasm');
    return vision.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: TH_MP_MODEL, delegate: 'GPU' }, runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true });
  })().catch((e) => { TH_SEG = null; throw new Error('누끼 모델을 못 불러왔습니다 — ' + (e.message || e)); });
  return TH_SEG;
}
async function thSegAlpha(im) {
  const seg = await thSegmenter();
  const src = document.createElement('canvas'); src.width = im.width; src.height = im.height;
  src.getContext('2d').drawImage(im, 0, 0);
  const r = seg.segment(src);
  const m = r.confidenceMasks && r.confidenceMasks[0];
  if (!m) { if (r.close) r.close(); throw new Error('사람을 찾지 못했습니다'); }
  const a = { alpha: Float32Array.from(m.getAsFloat32Array()), mw: m.width, mh: m.height };
  if (r.close) r.close();
  return a;
}
// 원본 장면(dataURL) → 사람만 남긴 PNG(투명 배경) + 사람별 자리. MODNet → 안 되면 MediaPipe.
// 화면 아래 18% 는 박힌 자막 띠라 뺀다. 세로 기둥 점유로 사람별 덩어리를 가른다
async function thCutout(dataUrl) {
  const im = await thLoadImg(dataUrl);
  const W = im.width, H = im.height;
  let A, soft;
  try { A = await thMatteAlpha(im); soft = true; }
  catch (e) { console.info('[thumb] MODNet 못 씀 — MediaPipe 로:', e.message); A = await thSegAlpha(im); soft = false; }
  const { alpha, mw, mh } = A;
  const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
  const mctx = mc.getContext('2d'); const md = mctx.createImageData(mw, mh);
  const cols = new Int32Array(mw), colTop = new Int32Array(mw).fill(mh), colBot = new Int32Array(mw).fill(-1);
  const capY = Math.floor(mh * 0.82);
  let count = 0;
  for (let i = 0; i < mw * mh; i++) {
    const v = alpha[i], y = (i / mw) | 0;
    const a = y >= capY ? 0 : soft ? (v < 0.08 ? 0 : v > 0.92 ? 255 : Math.round(v * 255)) : (v < 0.35 ? 0 : v > 0.65 ? 255 : Math.round((v - 0.35) / 0.3 * 255));
    md.data[i * 4] = 255; md.data[i * 4 + 1] = 255; md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = a;
    if (a > 128) { const x = i % mw; cols[x]++; if (y < colTop[x]) colTop[x] = y; if (y > colBot[x]) colBot[x] = y; count++; }
  }
  mctx.putImageData(md, 0, 0);
  if (count < mw * mh * 0.02) throw new Error('사람이 너무 작거나 없습니다');
  const parts = []; const gapMin = Math.max(2, Math.round(mw * 0.03)); let x0 = -1, gap = 0;
  for (let x = 0; x <= mw; x++) {
    const on = x < mw && cols[x] > mh * 0.02;
    if (on) { if (x0 < 0) x0 = x; gap = 0; }
    else if (x0 >= 0) { gap++; if (gap >= gapMin || x === mw) { const x1 = x - gap; let top = mh, bot = -1, n = 0; for (let k = x0; k < x1; k++) { n += cols[k]; if (colTop[k] < top) top = colTop[k]; if (colBot[k] > bot) bot = colBot[k]; } if (n > count * 0.08) parts.push({ x0, x1, top, bot, n }); x0 = -1; gap = 0; } }
  }
  if (!parts.length) throw new Error('사람 덩어리를 못 찾았습니다');
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.filter = soft ? 'blur(0.6px)' : 'blur(1.5px)'; octx.drawImage(mc, 0, 0, W, H); octx.filter = 'none';
  octx.globalCompositeOperation = 'source-in'; octx.drawImage(im, 0, 0);
  const sx = W / mw, sy = H / mh;
  const boxes = parts.map((q) => ({ x: Math.floor(q.x0 * sx), y: Math.floor(q.top * sy), w: Math.ceil((q.x1 - q.x0) * sx), h: Math.ceil((q.bot - q.top + 1) * sy), n: q.n }));
  const all = { x: Math.min(...boxes.map((b) => b.x)), y: Math.min(...boxes.map((b) => b.y)) }; all.w = Math.max(...boxes.map((b) => b.x + b.w)) - all.x; all.h = Math.max(...boxes.map((b) => b.y + b.h)) - all.y;
  return { url: out.toDataURL('image/png'), box: all, boxes, w: W, h: H, matte: soft };
}

// 캔버스로 글자를 얹는다 — bg(dataURL) 를 cover 로 채우고 제목·작은 글을 틀대로 그린다. PNG dataURL 을 돌려준다.
// 제목 표기: " / " 또는 줄바꿈 = 줄 나눔 · *낱말* = 노랑 · _구절_ = 민트 (사람이 만든 썸네일처럼 핵심만 색을 달리한다)
function thLoadImg(url) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('그림을 읽지 못했습니다')); im.src = url; }); }
function thSegments(line, base) {   // "백분위로 _살펴보는_ *추천대학*!" → [{t, c}]
  const out = []; let cur = '', color = base, i = 0;
  const flush = () => { if (cur) out.push({ t: cur, c: color }); cur = ''; };
  while (i < line.length) {
    const ch = line[i];
    if ((ch === '*' || ch === '_') && TH_ACCENT[ch]) {
      const end = line.indexOf(ch, i + 1);
      if (end > i + 1) { flush(); out.push({ t: line.slice(i + 1, end), c: TH_ACCENT[ch] }); i = end + 1; continue; }
    }
    cur += ch; i++;
  }
  flush();
  return out;
}
function thLines(title) { return String(title || '').split(/\s*\/\s*|\n/).map((x) => x.trim()).filter(Boolean); }
function thPlain(s) { return String(s || '').replace(/[*_]/g, ''); }
function thWrapPlain(ctx, text, maxW) {   // 줄 나눔 표시가 없을 때 낱말 단위로 두 줄까지
  const words = String(text || '').trim().split(/\s+/).filter(Boolean), lines = []; let cur = '';
  words.forEach((w) => { if (!cur || ctx.measureText(cur + ' ' + w).width <= maxW) cur = cur ? cur + ' ' + w : w; else { lines.push(cur); cur = w; } });
  if (cur) lines.push(cur);
  return lines;
}
async function thCompose({ bg, size, title, sub, style, color, logo, persons, blurBg, figure, label }) {
  const S = TH_SIZES[size] || TH_SIZES.h, W = S.w, H = S.h;
  try { await Promise.all([document.fonts.load("900 100px 'Pretendard WT'"), document.fonts.load("600 100px 'Pretendard WT'")]); } catch (e) { /* 글꼴이 없으면 대체 글꼴 */ }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (bg) {
    const im = await thLoadImg(bg);
    const s = Math.max(W / im.width, H / im.height) * (blurBg ? 1.08 : 1), w = im.width * s, h = im.height * s;
    if (blurBg) ctx.filter = 'blur(' + Math.round(Math.min(W, H) * 0.012) + 'px)';
    ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    ctx.filter = 'none';
    if (blurBg) { ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(0, 0, W, H); }
  } else { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H); }
  const pad = Math.round(Math.min(W, H) * 0.045), maxW = W - pad * 2;
  const dark = color === '#111111';
  const outline = style !== 'band';
  // 줄 나누기 — 표시가 있으면 그대로, 없으면 낱말로 두 줄까지. 가장 긴 줄이 폭에 들어갈 때까지 글자를 줄인다
  const want = Math.round(W * (size === 'v' ? 0.115 : 0.084));
  let fs = want, lines = [];
  for (; fs >= 24; fs -= 4) {
    ctx.font = '900 ' + fs + 'px ' + TH_FONT;
    const given = thLines(title);
    lines = given.length > 1 ? given : thWrapPlain(ctx, title, maxW).slice(0, 3);
    const wide = Math.max(0, ...lines.map((l) => ctx.measureText(thPlain(l)).width));
    if (wide <= maxW && lines.length <= (size === 'v' ? 4 : 3)) break;
  }
  const lh = Math.round(fs * 1.12);
  let subFs = 0, subLines = [];
  if (sub && String(sub).trim()) { subFs = Math.round(fs * 0.4); ctx.font = '600 ' + subFs + 'px ' + TH_FONT; subLines = thWrapPlain(ctx, thPlain(sub), maxW).slice(0, 2); }
  const block = lines.length * lh + (subLines.length ? subLines.length * Math.round(subFs * 1.25) + Math.round(fs * 0.25) : 0);
  if (!outline) {   // 옛 띠 — 아래 절반 그라데이션
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, dark ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0)'); g.addColorStop(1, dark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.78)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55);
  }
  // 누끼 딴 사람 — [{ cut, box, side }] : 글자 자리를 피해 놓는다(2026-11-26 사장님 — "사람 얼굴이 글자에 가려져 버리잖아").
  // 얼굴은 사람 상자의 위쪽(상반신 상자면 위 42%, 머리·어깨만이면 위 62%)으로 보고, 글자가 아래면 얼굴 아래선이 글자 위선보다 위에,
  // 글자가 위면 머리 위선이 글자 아래선보다 아래에 오게 — 모자라면 사람을 아래로 내려 어깨가 화면 밖으로 잘리게 하고, 그래도 안 되면 줄인다
  const textTop = style === 'outline-top' ? pad : H - pad - block, textBottom = textTop + block, gapT = Math.round(fs * 0.12);
  if (persons && persons.length) {
    persons.forEach((pr, k) => {
      const b = pr.box || pr.cut.box;
      let dh = H * (size === 'v' ? 0.6 : persons.length > 1 ? 0.72 : 0.76), sc = dh / b.h;
      if (b.w * sc > W * 0.5) { sc = (W * 0.5) / b.w; dh = b.h * sc; }
      const faceRel = b.h / b.w >= 1.25 ? 0.42 : 0.62;
      let y;
      if (style === 'outline-top') { const maxDh = (H - textBottom - gapT) / 0.95; if (dh > maxDh) { dh = maxDh; sc = dh / b.h; } y = H - dh; }
      else { y = Math.min(H - dh, textTop - gapT - faceRel * dh); if (y < -dh * 0.03) { dh = (textTop - gapT + dh * 0.03) / faceRel; sc = dh / b.h; y = Math.min(H - dh, textTop - gapT - faceRel * dh); } }
      const dw = b.w * sc;
      const side = pr.side || (persons.length > 1 ? (k === 0 ? 'left' : 'right') : 'right');
      const x = side === 'left' ? -dw * 0.04 : W - dw * 0.96;
      ctx.drawImage(pr.cut.img, b.x, b.y, b.w, b.h, x, y, dw, dh);
    });
  }
  // 콜라주의 핵심 숫자 — 가운데 크게, 따뜻한 빛. 위에 작은 이름표
  if (figure) {
    const fsz = Math.round(W * (size === 'v' ? 0.2 : 0.13));
    ctx.textAlign = 'center';
    const cy = size === 'v' ? H * 0.34 : H * 0.4;
    ctx.font = '900 ' + fsz + 'px ' + TH_FONT; ctx.lineJoin = 'round';
    ctx.save(); ctx.shadowColor = 'rgba(255,214,100,0.95)'; ctx.shadowBlur = Math.round(fsz * 0.55); ctx.fillStyle = '#fff3c4';
    ctx.fillText(figure, W / 2, cy); ctx.fillText(figure, W / 2, cy); ctx.restore();
    ctx.lineWidth = Math.round(fsz * 0.1); ctx.strokeStyle = 'rgba(20,20,40,0.85)'; ctx.strokeText(figure, W / 2, cy);
    ctx.fillStyle = '#ffffff'; ctx.fillText(figure, W / 2, cy);
    if (label) { const ls = Math.round(fsz * 0.34); ctx.font = '600 ' + ls + 'px ' + TH_FONT; ctx.fillStyle = '#ffffff'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = Math.round(ls * 0.3); ctx.fillText(label, W / 2, cy - fsz * 0.95); ctx.restore(); }
    ctx.textAlign = 'left';
  }
  if (logo) {   // 채널 로고 — 왼쪽 위, 폭의 14%(세로는 22%)
    try { const lg = await thLoadImg(logo); const lw = Math.round(W * (size === 'v' ? 0.22 : 0.14)), lh2 = Math.round(lw * lg.height / lg.width); ctx.drawImage(lg, pad, pad, lw, lh2); } catch (e) { /* 로고 없이 */ }
  }
  let y = style === 'outline-top' ? pad + lh * 0.85 : H - pad - block + lh * 0.85;
  ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  const drawLine = (segs, f, lineH, big) => {
    ctx.font = f;
    const total = segs.reduce((a, g) => a + ctx.measureText(g.t).width, 0);
    const x0 = outline ? (W - total) / 2 : pad;   // 외곽선 틀은 가운데, 띠는 왼쪽
    if (outline) {   // 외곽선 먼저 전부, 그 위에 색 글자 — 이어진 글자의 테두리가 앞 글자를 덮지 않게
      ctx.lineWidth = Math.max(3, Math.round((big ? fs : subFs) * 0.16)); ctx.strokeStyle = dark ? 'rgba(255,255,255,0.95)' : '#000';
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = Math.round(fs * 0.06); ctx.shadowOffsetY = Math.round(fs * 0.04);
      let x = x0; segs.forEach((g) => { ctx.strokeText(g.t, x, y); x += ctx.measureText(g.t).width; });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    } else { ctx.shadowColor = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = Math.round(fs * 0.12); ctx.shadowOffsetY = Math.round(fs * 0.03); }
    let x = x0; segs.forEach((g) => { ctx.fillStyle = g.c; ctx.fillText(g.t, x, y); x += ctx.measureText(g.t).width; });
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    y += lineH;
  };
  lines.forEach((l) => drawLine(thSegments(l, color || '#ffffff'), '900 ' + fs + 'px ' + TH_FONT, lh, true));
  if (subLines.length) { y += Math.round(fs * 0.25); subLines.forEach((l) => drawLine([{ t: l, c: color || '#ffffff' }], '600 ' + subFs + 'px ' + TH_FONT, Math.round(subFs * 1.25), false)); }
  return c.toDataURL('image/png');
}

function ThumbApp({ dark, userName }) {
  const K = TT(dark);
  const [file, setFile] = useState(null);
  const [video, setVideo] = useState(null);        // { frames, w, h, dur }
  const [prog, setProg] = useState('');
  const [err, setErr] = useState('');
  const [topic, setTopic] = useState('');
  const [summary, setSummary] = useState('');
  const [vars, setVars] = useState([]);            // 실제 장면 시안 5개 — { frame, title, sub, style, color, why, status, bg, raw, out, msg, refined }
  const [ais, setAis] = useState([]);              // AI 그림 시안 5개 — { scene, title, sub, style, color, why, status, bg, out, msg }
  const [cols, setCols] = useState([]);            // 콜라주 시안 5개 — { persons, data, figure, label, title, …, status, bg, out, msg }
  const [logo, setLogo] = useState('');            // 채널 로고 dataURL(선택)
  const [cuts, setCuts] = useState({});            // 누끼 — 장면 번호 → { url, box, w, h, img } (누끼를 못 딴 장면은 null)
  const cutsRef = useRef({});
  const [mainCut, setMainCut] = useState(null);     // AI 배경 위에 붙일 주인공 장면 번호
  const [spoken, setSpoken] = useState(null);      // 'audio' = 소리만 뽑아 읽었다 · 'video' = 영상째 · false = 장면만
  const [size, setSize] = useState('h');            // 'h' 가로 1920×1080 · 'v' 세로 1080×1920
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const log = (m) => setProg(m);

  const btn = (primary) => ({ height: 32, padding: '0 14px', borderRadius: K.rCtl, border: primary ? 'none' : '1px solid ' + K.control, background: primary ? K.ink : 'transparent', color: primary ? K.inkText : K.text, font: 'inherit', fontSize: 13, fontWeight: primary ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: K.ease });
  const inp = { width: '100%', boxSizing: 'border-box', height: 32, border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '0 10px', fontSize: '13.5px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none' };
  const lab = { fontSize: '12px', fontWeight: 500, color: K.muted, margin: '0 0 6px' };
  const card = { background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', padding: '20px' };

  const setVar = (i, patch) => setVars((v) => v.map((x, j) => j === i ? Object.assign({}, x, patch) : x));
  const setAi = (i, patch) => setAis((v) => v.map((x, j) => j === i ? Object.assign({}, x, patch) : x));
  const setCol = (i, patch) => setCols((v) => v.map((x, j) => j === i ? Object.assign({}, x, patch) : x));
  // 누끼 — 그 장면을 원본 크기로 다시 뽑아 사람만 남긴다. 한 번 딴 것은 다시 안 딴다(cutsRef). 못 따면 null
  const cutOf = async (fi, vid, f) => {
    if (cutsRef.current[fi] !== undefined) return cutsRef.current[fi];
    let c = null;
    try { const full = await thGrabFull(f, vid.frames[fi].t); c = await thCutout(full); c.img = await thLoadImg(c.url); }
    catch (e) { console.info('[thumb] 누끼 실패 장면 ' + (fi + 1) + ':', e.message); c = null; }
    cutsRef.current[fi] = c; setCuts(Object.assign({}, cutsRef.current));
    return c;
  };
  // 콜라주 시안 하나 — 앱이 만든다(비용 0): 자료 장면을 흐린 배경으로, 누끼 딴 사람을 양옆에, 숫자를 가운데
  const collageOne = async (i, plan, vid, f) => {
    setCol(i, { status: 'busy', msg: '누끼 따는 중…', bg: '', out: '' });
    try {
      // 장면마다 누끼를 따고 사람별 덩어리를 모은다 — 한 장면에 둘이 있으면 둘 다 각각. 큰 순으로 둘만 쓴다(왼쪽·오른쪽)
      let blobs = [];
      for (const fi of plan.persons) { const c = await cutOf(fi, vid, f); if (c) c.boxes.forEach((b) => blobs.push({ cut: c, frame: fi, box: b })); }
      if (!blobs.length) throw new Error('사람 누끼를 못 땄습니다');
      blobs.sort((a, b) => b.box.n - a.box.n); blobs = blobs.slice(0, 2);
      blobs.sort((a, b) => a.frame - b.frame || a.box.x - b.box.x);
      const bgFrame = plan.data != null ? plan.data : plan.persons[0];
      const bg = await thGrabFull(f, vid.frames[bgFrame].t);
      setCol(i, { status: 'done', bg, msg: '', persons: blobs.map((x, k) => ({ cut: x.cut, box: x.box, frame: x.frame, side: blobs.length > 1 ? (k === 0 ? 'left' : 'right') : 'right' })) });
    } catch (e) { setCol(i, { status: 'error', msg: e.message || String(e) }); }
  };
  // AI 배경 시안 하나 — 나노바나나가 사람 없는 배경을 그리고(삽화 1장 값), 주인공 누끼를 앱이 붙인다
  const drawOne = async (i, plan, vid, f, cutFrame) => {
    setAi(i, { status: 'busy', msg: '', bg: '', out: '' });
    try {
      const key = await illGetConfig('gemini_api_key');
      if (!key) throw new Error('Gemini API 키가 등록되지 않았습니다');
      const bg = await thDraw(key, plan.scene, plan.style, plan.personSide, TH_SIZES[size].ratio, (m) => setAi(i, { msg: m }));
      const c = cutFrame != null ? await cutOf(cutFrame, vid, f) : null;
      const big = c ? c.boxes.slice().sort((a, b) => b.n - a.n)[0] : null;
      setAi(i, { status: 'done', bg, msg: '', persons: c ? [{ cut: c, box: big, frame: cutFrame, side: plan.personSide }] : [] });
    } catch (e) { setAi(i, { status: 'error', msg: e.message || String(e) }); }
  };
  // 시안 하나의 바탕을 만든다 — 장면 그대로면 그 장면을 크게 다시 뽑고(비용 0), 아니면 나노바나나
  const makeBg = async (i, plan, vid, f) => {
    setVar(i, { status: 'busy', msg: '', bg: '', out: '' });
    try {
      const bg = await thGrabFull(f, vid.frames[plan.frame].t);
      setVar(i, { status: 'done', bg, raw: bg, msg: '', refined: false });
    } catch (e) { setVar(i, { status: 'error', msg: e.message || String(e) }); }
  };
  // 「사진처럼 다듬기」 — 그 장면(원본 크기)을 나노바나나에 넘겨 사진 그대로 선명하게. 되돌리기는 raw 로.
  const refine = async (i) => {
    const v = vars[i]; if (!v || !v.raw || v.status === 'busy') return;
    setVar(i, { status: 'busy', msg: '다듬는 중…' });
    try {
      const key = await illGetConfig('gemini_api_key');
      if (!key) throw new Error('Gemini API 키가 등록되지 않았습니다');
      const bg = await thPaint(key, v.raw, (m) => setVar(i, { msg: m }));
      setVar(i, { status: 'done', bg, msg: '', refined: true });
    } catch (e) { setVar(i, { status: 'done', msg: '다듬기 실패 — ' + (e.message || String(e)) }); }
  };
  // ① 영상 넣기 → 장면 뽑기 → AI 가 시안 5개를 정함 → 바로 만든다
  const take = async (f) => {
    if (!f) return;
    if (!/^video\//.test(f.type || '') && !/\.(mp4|mov|m4v|webm)$/i.test(f.name || '')) { setErr('영상 파일(mp4·mov·webm)을 넣어 주세요'); return; }
    setErr(''); setVars([]); setAis([]); setCols([]); setCuts({}); cutsRef.current = {}; setMainCut(null); setTopic(''); setSummary(''); setSpoken(null); setVideo(null); setFile(f); setBusy(true);
    try {
      const info = await thExtractFrames(f, (i) => setProg('장면 뽑는 중 ' + i + '/' + TH_FRAMES));
      setVideo(info); setSize(info.h > info.w ? 'v' : 'h');
      await plan(info, f, info.h > info.w ? 'v' : 'h');
    } catch (e) { setErr(e.message || String(e)); }
    setProg(''); setBusy(false);
  };
  const plan = async (vid, f, orient) => {
    const key = await illGetConfig('gemini_api_key');
    if (!key) throw new Error('Gemini API 키가 등록되지 않았습니다 (app_config.gemini_api_key)');
    // 소리를 읽는 길 — ① 데스크톱 앱이면 ffmpeg 로 소리만 뽑아 올린다(크기 무관, 22분 ≈ 8MB) ② 웹이면 2GB 아래 영상을 통째로 ③ 둘 다 안 되면 장면만
    let up = null;
    if (window.desktopExtractAudio && window.desktopFilePath) {
      try {
        const fp = window.desktopFilePath(f);
        if (!fp) throw new Error('파일 경로 없음');
        const a = await window.desktopExtractAudio(fp, (sec) => setProg('소리 뽑는 중… ' + thMmss(sec)));
        if (!a || !a.ok) throw new Error((a && a.error) || '소리 뽑기 실패');
        setProg('소리를 올리는 중…');
        up = await thUploadVideo(key, new Blob([a.data], { type: a.mime }), log, a.mime); up.audioOnly = true; setSpoken('audio');
      } catch (e) { console.info('[thumb] 소리 뽑기 실패 — 다음 길로:', e.message); }
    }
    if (!up) {
      if (f.size > TH_UPLOAD_MAX) { setSpoken(false); console.info('[thumb] 2GB 를 넘어 올리지 않음 — 장면만으로 계획'); }
      else {
        try { setProg('영상을 올리는 중…'); up = await thUploadVideo(key, f, log); setSpoken('video'); }
        catch (e) { setSpoken(false); console.info('[thumb] 영상 올리기 실패 — 장면만으로 계획:', e.message); }
      }
    }
    setProg('영상을 보고 시안을 정하는 중…');
    let p;
    try { p = await thPlan(key, vid.frames, up, orient, log); } finally { if (up) thDeleteUpload(key, up.name); }
    setTopic(p.topic); setSummary(p.summary);
    const list = p.plans.map((x) => Object.assign({ status: 'busy', bg: '', raw: '', out: '', msg: '', refined: false }, x));
    setVars(list);
    const alist = p.ai.map((x) => Object.assign({ status: 'busy', bg: '', out: '', msg: '' }, x));
    setAis(alist);
    const clist = p.collage.map((x) => Object.assign({ status: 'busy', bg: '', out: '', msg: '' }, x));
    setCols(clist);
    clist.forEach((x, i) => collageOne(i, x, vid, f));
    setProg('');
    list.forEach((x, i) => makeBg(i, x, vid, f));
    // AI 배경 위에 붙일 주인공 — faceFrames 첫 장면(없으면 콜라주의 첫 사람 장면). 누끼를 먼저 따 두고 배경 5장을 돌린다
    const mc = p.faceFrames.length ? p.faceFrames[0] : (p.collage[0] && p.collage[0].persons[0] != null ? p.collage[0].persons[0] : null);
    setMainCut(mc);
    if (mc != null) await cutOf(mc, vid, f);
    alist.forEach((x, i) => drawOne(i, x, vid, f, mc));
  };
  const replan = async () => {
    if (!video || !file || busy) return;
    setBusy(true); setErr('');
    try { await plan(video, file, size); } catch (e) { setErr(e.message || String(e)); }
    setProg(''); setBusy(false);
  };
  const pick = () => { const el = document.createElement('input'); el.type = 'file'; el.accept = 'video/*,.mp4,.mov,.m4v,.webm'; el.onchange = () => take((el.files || [])[0]); el.click(); };

  // 글자·틀이 바뀌면 바탕은 그대로 두고 다시 얹는다(비용 없음)
  const sigOf = (list) => size + '|' + logo.length + '|' + list.map((v) => [v.bg.length, v.title, v.sub, v.style, v.color, (v.persons || []).map((x) => x.frame + x.side + (x.box ? x.box.x : '')).join(','), v.figure || '', v.label || ''].join('\u0001')).join('\u0002');
  const recompose = (list, setList, blurBg) => {
    let alive = true;
    list.forEach((v, i) => {
      if (!v.bg) return;
      thCompose({ bg: v.bg, size, logo, title: v.title, sub: v.sub, style: v.style, color: v.color, persons: v.persons || [], blurBg: !!blurBg, figure: blurBg ? v.figure : '', label: blurBg ? v.label : '' }).then((out) => { if (alive) setList((cur) => cur.map((x, j) => j === i && x.bg === v.bg ? Object.assign({}, x, { out }) : x)); }).catch(() => {});
    });
    return () => { alive = false; };
  };
  useEffect(() => recompose(vars, setVars), [sigOf(vars)]);
  useEffect(() => recompose(ais, setAis), [sigOf(ais)]);
  useEffect(() => recompose(cols, setCols, true), [sigOf(cols)]);

  const save = (v, tag) => {
    if (!v || !v.out) return;
    illSaveBlob(new Blob([illB64ToBytes(v.out.split(',')[1])], { type: 'image/png' }), illSanitize(thPlain(v.title) || (file && file.name) || '썸네일') + '_' + tag + '_' + TH_SIZES[size].w + 'x' + TH_SIZES[size].h + '.png');
  };
  // 카드 하나(실제 장면·AI 그림 공용) — 제목·작은 글·틀·색을 고치면 바로 다시 얹는다
  const cardOf = (v, i, kind) => {
    const set = kind === 'ai' ? (p) => setAi(i, p) : kind === 'collage' ? (p) => setCol(i, p) : (p) => setVar(i, p);
    return (
      <div key={kind + i} style={Object.assign({}, card, { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' })}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '12px', color: K.muted }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: K.text, whiteSpace: 'nowrap' }}>{kind === 'ai' ? 'AI 배경' : kind === 'collage' ? '콜라주' : '실제 장면'} {i + 1}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{kind === 'ai' ? (v.persons && v.persons.length ? '배경 AI · 사람 장면 ' + (v.persons[0].frame + 1) + ' 누끼' : '배경 AI · 사람 없음') : kind === 'collage' ? '사람 ' + v.persons.map((x) => x + 1).join('·') + (v.data != null ? ' · 자료 ' + (v.data + 1) : '') + (v.figure ? ' · ' + v.figure : '') : '장면 ' + (v.frame + 1) + (v.refined ? ' · 다듬음' : '')}</span>
          {v.why && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.why + (v.scene ? '\n\n' + v.scene : '')}>{v.why}</span>}
        </div>
        <div style={{ aspectRatio: TH_SIZES[size].w + '/' + TH_SIZES[size].h, background: K.raised, borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: K.muted, fontSize: '13px', textAlign: 'center', padding: v.out ? 0 : '12px' }}>
          {v.out ? <img alt="" src={v.out} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            : v.status === 'busy' ? <SlLoading size={40} pad="0" text={v.msg || (kind === 'real' ? '장면 뽑는 중…' : '그리는 중…')} />
            : v.status === 'error' ? <span style={{ color: K.neg }}>{v.msg}</span> : ''}
        </div>
        <div><div style={lab}>제목 — <span style={{ fontWeight: 400 }}>" / " 줄 나눔 · *노랑* · _민트_</span></div><input value={v.title} onChange={(e) => set({ title: e.target.value })} style={inp} /></div>
        <div><div style={lab}>작은 글</div><input value={v.sub} onChange={(e) => set({ sub: e.target.value })} style={inp} placeholder="없으면 비워 둡니다" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
          <div><div style={lab}>글자 틀</div><select value={v.style} onChange={(e) => set({ style: e.target.value })} style={inp}>{TH_STYLES.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></div>
          <div><div style={lab}>글자색</div><select value={v.color} onChange={(e) => set({ color: e.target.value })} style={inp}>{TH_COLORS.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></div>
        </div>
        {v.status === 'done' && v.msg && <div style={{ fontSize: '12px', color: K.neg }}>{v.msg}</div>}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {kind === 'ai'
            ? <button type="button" style={btn(false)} disabled={v.status === 'busy'} onClick={() => drawOne(i, v, video, file, mainCut)} title="같은 아이디어로 배경을 다시 그립니다 — 삽화 1장 값">배경 다시 그리기</button>
            : kind === 'collage'
            ? <button type="button" style={btn(false)} disabled={v.status === 'busy'} onClick={() => collageOne(i, v, video, file)} title="같은 장면·숫자로 다시 만듭니다 — 비용 없음">다시 만들기</button>
            : v.refined
              ? <button type="button" style={btn(false)} disabled={v.status === 'busy'} onClick={() => set({ bg: v.raw, refined: false, msg: '' })}>원래 장면으로</button>
              : <button type="button" style={btn(false)} disabled={v.status === 'busy' || !v.raw} onClick={() => refine(i)} title="나노바나나가 그 장면을 사진 그대로 선명하게 손봅니다 — 삽화 1장 값">사진처럼 다듬기</button>}
          <span style={{ flex: 1 }}></span>
          <button type="button" style={Object.assign({}, btn(true), { opacity: v.out ? 1 : 0.6, cursor: v.out ? 'pointer' : 'default' })} disabled={!v.out} onClick={() => save(v, (kind === 'ai' ? 'AI배경' : kind === 'collage' ? '콜라주' : '장면') + (i + 1))}>PNG 저장</button>
        </div>
      </div>
    );
  };
  const dropStyle = { border: '1px dashed ' + (drag ? K.ink : K.control), borderRadius: K.rCtl + 'px', padding: '18px 12px', textAlign: 'center', color: K.muted, fontSize: '13px', cursor: 'pointer', background: drag ? K.active : 'transparent', transition: K.ease };

  return (
    <div data-root="" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }}>
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: K.ground, borderBottom: '1px solid ' + K.border }}>
        <span style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>썸네일 제작</span>
        <span style={{ fontSize: '12.5px', color: K.muted }}>영상을 읽고 실제 장면 · AI 배경 · 콜라주 시안을 {TH_N}개씩 만듭니다 · 가로 1920×1080 또는 세로 1080×1920 · 글자는 프리텐다드 · 카드에서 고쳐서 PNG 저장</span>
        <span style={{ flex: 1 }}></span>
        {prog && <span style={{ fontSize: '12.5px', color: K.muted }}>{prog}</span>}
      </nav>
      {err && <div style={{ margin: '12px 20px 0', padding: '10px 12px', border: '1px solid ' + K.neg, borderRadius: K.rCtl + 'px', color: K.neg, fontSize: '13px', background: K.surface }}>{err}</div>}
      <div data-row="" data-mstack="" style={{ flex: 1, minHeight: 0, display: 'flex', gap: '16px', padding: '16px 20px', overflow: 'hidden' }}>
        {/* 왼쪽 — 영상 · 장면 */}
        <div data-mpane="" style={{ flex: 'none', width: '340px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div style={card}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>영상</div>
            <div style={dropStyle} onClick={busy ? undefined : pick}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) take((e.dataTransfer.files || [])[0]); }}>
              {file ? <span style={{ color: K.text }}>{file.name}{video ? ' · ' + video.w + '×' + video.h + ' · ' + thMmss(video.dur) : ''}</span> : '영상 파일을 끌어다 놓거나 눌러서 고르기 (mp4 · mov · webm)'}
            </div>
            {topic && <div style={{ fontSize: '12.5px', color: K.muted, marginTop: '12px' }}>주제 — {topic}{summary ? <div style={{ marginTop: '4px' }}>{summary}</div> : null}{spoken === false && <div style={{ marginTop: '4px', color: K.warn }}>{file && file.size > TH_UPLOAD_MAX ? '2GB 를 넘는 영상이라 소리 없이 장면만 보고 정했습니다(데스크톱 앱에서는 소리를 뽑아 읽습니다).' : '영상을 올리지 못해 소리 없이 장면만 보고 정했습니다.'}</div>}{spoken === 'audio' && <div style={{ marginTop: '4px' }}>소리까지 읽었습니다.</div>}</div>}
            {video && (
              <div style={{ marginTop: '12px' }}>
                <div style={lab}>뽑은 장면 {video.frames.length}장 (시안의 바탕 번호)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
                  {video.frames.map((f, i) => (
                    <div key={i} title={thMmss(f.t)} style={{ borderRadius: '6px', overflow: 'hidden', position: 'relative', aspectRatio: video.w + '/' + video.h, background: K.raised }}>
                      <img alt="" src={f.url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <span style={{ position: 'absolute', left: 4, bottom: 3, fontSize: '11px', color: '#fff', textShadow: '0 0 3px #000' }}>{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {video && <div style={{ marginTop: '14px' }}><div style={lab}>크기</div><select value={size} onChange={(e) => setSize(e.target.value)} style={inp} disabled={busy}>{Object.keys(TH_SIZES).map((k) => <option key={k} value={k}>{TH_SIZES[k].label}</option>)}</select>
              <div style={{ fontSize: '12px', color: K.muted, marginTop: '6px' }}>바꾸면 글자는 바로 다시 얹고, AI 그림은 「다시 그리기」를 눌러야 그 비율로 다시 그립니다.</div></div>}
            {video && <div style={{ marginTop: '14px' }}><div style={lab}>채널 로고 (선택) — 왼쪽 위에 얹습니다</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {logo && <img alt="" src={logo} style={{ height: 32, borderRadius: 4, border: '1px solid ' + K.border }} />}
                <button type="button" style={btn(false)} onClick={() => { const el = document.createElement('input'); el.type = 'file'; el.accept = 'image/*'; el.onchange = () => { const f0 = (el.files || [])[0]; if (!f0) return; const r = new FileReader(); r.onload = () => setLogo(String(r.result)); r.readAsDataURL(f0); }; el.click(); }}>{logo ? '바꾸기' : '로고 넣기'}</button>
                {logo && <button type="button" style={btn(false)} onClick={() => setLogo('')}>빼기</button>}
              </div></div>}
            {video && <button type="button" style={Object.assign({}, btn(false), { width: '100%', marginTop: '14px', opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' })} disabled={busy} onClick={replan}>시안 {TH_N}개 다시 추천받기</button>}
            <div style={{ fontSize: '12px', color: K.muted, marginTop: '10px' }}>실제 장면·콜라주 시안은 비용이 없습니다(추천받을 때 Gemini 가 영상을 한 번 읽습니다). AI 배경 시안만 한 장에 삽화 1장 값이라 영상 한 편에 {TH_N}장 값이 듭니다. 사람은 AI 가 그리지 않고 원본에서 누끼를 땁니다. 제목·작은 글·틀·색은 카드에서 고치면 바로 반영됩니다.</div>
          </div>
        </div>
        {/* 오른쪽 — 시안 5개 */}
        <div data-main="" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          {!video && <div style={Object.assign({}, card, { color: K.muted, fontSize: '13px' })}>왼쪽에 영상을 넣으면 장면 {TH_FRAMES}장을 뽑고 영상 내용(소리)까지 읽어, 실제 장면 시안 {TH_N}개와 영상 속 사람 얼굴 그대로 그린 AI 그림 시안 {TH_N}개를 바로 만듭니다.</div>}
          {video && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>실제 장면 <span style={{ fontSize: '12.5px', fontWeight: 400, color: K.muted }}>영상의 한 장면 그대로 · 비용 없음</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>{vars.map((v, i) => cardOf(v, i, 'real'))}</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '8px' }}>AI 배경 <span style={{ fontSize: '12.5px', fontWeight: 400, color: K.muted }}>AI 가 사람 없는 배경만 그리고, 영상 원본에서 누끼 딴 사람을 그 위에 붙인 것 · 한 장에 삽화 1장 값</span></div>
              {!ais.length && !busy && <div style={{ fontSize: '13px', color: K.muted }}>이 영상에서는 AI 배경 아이디어가 나오지 않았습니다.</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>{ais.map((v, i) => cardOf(v, i, 'ai'))}</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '8px' }}>콜라주 <span style={{ fontSize: '12.5px', fontWeight: 400, color: K.muted }}>원본에서 누끼 딴 사람을 양옆에, 자료 화면을 흐리게 뒤에, 핵심 숫자를 가운데 — 전부 앱이 만든다 · 비용 없음</span></div>
              {!cols.length && !busy && <div style={{ fontSize: '13px', color: K.muted }}>이 영상에서는 콜라주 아이디어가 나오지 않았습니다(사람이 또렷이 나온 장면이 없을 때).</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>{cols.map((v, i) => cardOf(v, i, 'collage'))}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
