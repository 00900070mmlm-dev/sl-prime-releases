// ══════════════════════════════════════════════════════════════════════
// CG (홈 앱 — 권한 키 'cg', PD + 개발자. 2026-11-26 사장님 — "CG 앱", 'CG' = AI 이미지 생성 전반)
//   삽화(10-illust.js)에 박시환 전용으로 있던 「자유 생성」·「수정」을 독립 앱으로 꺼낸 것.
//   프롬프트 + 참고 이미지(여러 장) → 나노바나나 프로(gemini-3-pro-image) → 결과 위에 지시를 적어 수정 → PNG 저장.
//   비율·해상도 칸은 두지 않는다(같은 날 사장님 — "사이즈나 화질 정하지 말고 그냥 프롬프트 적는대로") — 크기·비율도 프롬프트로 말하면 모델이 따른다(imageConfig 를 안 보낸다).
//   만든 것은 이 화면 안에서만 쌓이고(세션) DB 에 남기지 않는다 — 사장님 선택("PC 에 내려받기만").
//   Gemini 호출·키·사용량은 삽화의 것을 그대로 쓴다(illGetConfig('gemini_api_key') · illGeminiFetch · illParseImageResponse · illUsageAdd).
// ══════════════════════════════════════════════════════════════════════
let CG_SEQ = 1;

function cgInline(dataUrl) { return { inlineData: { mimeType: dataUrl.substring(5, dataUrl.indexOf(';')), data: dataUrl.split(',')[1] } }; }
async function cgGenerate(refs, prompt, log) {
  const key = await illGetConfig('gemini_api_key');
  if (!key) throw new Error('Gemini API 키가 등록되지 않았습니다 (app_config.gemini_api_key)');
  const parts = refs.map(cgInline);
  parts.push({ text: prompt });
  const res = await illGeminiFetch(key, ILL_IMAGE_MODEL, { contents: [{ parts }] }, log);
  const url = await illParseImageResponse(res);
  illUsageAdd(1);
  return url;
}

function CgApp({ dark, userName }) {
  const K = TT(dark);
  const [prompt, setPrompt] = useState('');
  const [refs, setRefs] = useState([]);           // 참고 이미지 dataURL[]
  const [items, setItems] = useState([]);         // { id, prompt, refs, status, url, msg, edit, editText }
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const busy = items.some((x) => x.status === 'busy');

  const btn = (primary) => ({ height: 32, padding: '0 14px', borderRadius: K.rCtl, border: primary ? 'none' : '1px solid ' + K.control, background: primary ? K.ink : 'transparent', color: primary ? K.inkText : K.text, font: 'inherit', fontSize: 13, fontWeight: primary ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: K.ease });
  const inp = { width: '100%', boxSizing: 'border-box', height: 32, border: '1px solid ' + K.control, borderRadius: K.rCtl + 'px', padding: '0 10px', fontSize: '13.5px', fontFamily: 'inherit', background: K.surface, color: K.text, outline: 'none' };
  const lab = { fontSize: '12px', fontWeight: 500, color: K.muted, margin: '0 0 6px' };
  const card = { background: K.surface, border: '1px solid ' + K.border, borderRadius: K.rCard + 'px', padding: '20px' };
  const ta = Object.assign({}, inp, { height: 'auto', minHeight: '140px', padding: '8px 10px', resize: 'vertical', lineHeight: '1.5' });

  const addRefs = async (files) => {
    const list = Array.from(files || []).filter((f) => /^image\//.test(f.type || ''));
    if (!list.length) return;
    try { const urls = []; for (const f of list) urls.push(await illResizeImage(f, 1600)); setRefs((r) => r.concat(urls).slice(0, 6)); setErr(''); }
    catch (e) { setErr(e.message || String(e)); }
  };
  const pickRefs = () => { const el = document.createElement('input'); el.type = 'file'; el.accept = 'image/*'; el.multiple = true; el.onchange = () => addRefs(el.files); el.click(); };
  const patch = (id, p) => setItems((list) => list.map((x) => x.id === id ? Object.assign({}, x, p) : x));

  // 만들기 — 카드를 먼저 붙이고 그 안에서 기다린다. 같은 조건으로 '다시 만들기'도 이 길.
  const run = (spec) => {
    const id = CG_SEQ++;
    const item = Object.assign({ id, status: 'busy', url: '', msg: '', edit: false, editText: '' }, spec);
    setItems((list) => [item].concat(list));
    cgGenerate(spec.refs, spec.prompt, (m) => patch(id, { msg: m }))
      .then((url) => patch(id, { status: 'done', url, msg: '' }))
      .catch((e) => patch(id, { status: 'error', msg: e.message || String(e) }));
  };
  const make = () => {
    if (!prompt.trim()) { setErr('무엇을 그릴지 적어 주세요'); return; }
    setErr('');
    run({ prompt: prompt.trim(), refs: refs.slice(), kind: '생성' });
  };
  // 수정 — 그 결과 그림을 참고로 넣고 지시만 보낸다(삽화의 ✎수정과 같다)
  const applyEdit = (x) => {
    const t = String(x.editText || '').trim();
    if (!t || !x.url) return;
    patch(x.id, { edit: false, editText: '' });
    run({ prompt: '다음 그림을 이 지시대로만 고쳐 주세요. 나머지는 그대로 둡니다: ' + t, refs: [x.url], kind: '수정', from: x.id });
  };
  const save = (x) => {
    if (!x.url) return;
    illSaveBlob(new Blob([illB64ToBytes(x.url.split(',')[1])], { type: 'image/png' }), 'CG_' + illSanitize(x.prompt) + '_' + x.id + '.png');
  };
  const dropStyle = { border: '1px dashed ' + (drag ? K.ink : K.control), borderRadius: K.rCtl + 'px', padding: '12px', textAlign: 'center', color: K.muted, fontSize: '12.5px', cursor: 'pointer', background: drag ? K.active : 'transparent', transition: K.ease };

  return (
    <div data-root="" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: K.ground, color: K.text, fontFamily: 'inherit' }}>
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: K.ground, borderBottom: '1px solid ' + K.border }}>
        <span style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>CG</span>
        <span style={{ fontSize: '12.5px', color: K.muted }}>나노바나나 프로로 그림을 만들고 고칩니다 · 결과는 PNG 로 저장 · 이 화면을 나가면 목록은 사라집니다</span>
        <span style={{ flex: 1 }}></span>
      </nav>
      {err && <div style={{ margin: '12px 20px 0', padding: '10px 12px', border: '1px solid ' + K.neg, borderRadius: K.rCtl + 'px', color: K.neg, fontSize: '13px', background: K.surface }}>{err}</div>}
      <div data-row="" data-mstack="" style={{ flex: 1, minHeight: 0, display: 'flex', gap: '16px', padding: '16px 20px', overflow: 'hidden' }}>
        <div data-mpane="" style={{ flex: 'none', width: '380px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div style={card}>
            <div style={lab}>무엇을 그릴까요</div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={ta} placeholder={'예) 칠판 앞에서 설명하는 젊은 영어 선생님, 밝은 교실, 수채화 느낌, 가로로 넓게\n한국어·영어 모두 됩니다. 크기·비율·글자도 그냥 적어 주세요'} />
            <div style={Object.assign({}, lab, { marginTop: '12px' })}>참고 이미지 (선택 · 6장까지) — 인물·화풍·구도를 따라 그립니다</div>
            <div style={dropStyle} onClick={pickRefs}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); addRefs(e.dataTransfer.files); }}>그림을 끌어다 놓거나 눌러서 고르기</div>
            {refs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {refs.map((d, i) => (
                  <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
                    <img alt="" src={d} style={{ height: 64, borderRadius: 6, border: '1px solid ' + K.border, display: 'block' }} />
                    <button type="button" onClick={() => setRefs((r) => r.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 'none', background: K.ink, color: K.inkText, fontSize: 11, cursor: 'pointer', lineHeight: '18px', padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <button type="button" style={Object.assign({}, btn(true), { width: '100%', height: 36, marginTop: '14px' })} onClick={make}>만들기</button>
            <div style={{ fontSize: '12px', color: K.muted, marginTop: '8px' }}>한 번에 한 장(삽화 1장 값). 크기·비율도 프롬프트에 적으면 됩니다(예: 가로로 넓게, 세로 포스터). 만드는 동안 다른 것을 더 시켜도 됩니다.</div>
          </div>
        </div>
        <div data-main="" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          {!items.length && <div style={Object.assign({}, card, { color: K.muted, fontSize: '13px' })}>왼쪽에 적고 「만들기」를 누르면 여기에 쌓입니다. 결과마다 「수정」으로 지시를 적어 고치거나, 「참고로」로 다음 그림의 참고 이미지에 넣을 수 있습니다.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {items.map((x) => (
              <div key={x.id} style={Object.assign({}, card, { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' })}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '12px', color: K.muted }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: K.text }}>#{x.id} {x.kind}{x.from ? ' (#' + x.from + ' 에서)' : ''}</span>
                </div>
                <div style={{ minHeight: '200px', background: K.raised, borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: K.muted, fontSize: '13px', textAlign: 'center', padding: x.url ? 0 : '12px' }}>
                  {x.url ? <img alt="" src={x.url} style={{ width: '100%', height: 'auto', display: 'block' }} />
                    : x.status === 'busy' ? <SlLoading size={40} pad="0" text={x.msg || '그리는 중…'} />
                    : <span style={{ color: K.neg }}>{x.msg}</span>}
                </div>
                <div style={{ fontSize: '12.5px', color: K.muted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'keep-all' }} title={x.prompt}>{x.prompt}</div>
                {x.edit && (
                  <div>
                    <textarea value={x.editText} onChange={(e) => patch(x.id, { editText: e.target.value })} style={Object.assign({}, ta, { minHeight: '72px' })} placeholder="어떻게 고칠까요 — 예) 배경을 밤으로, 안경을 벗겨 주세요" autoFocus />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button type="button" style={btn(true)} onClick={() => applyEdit(x)}>이대로 고치기</button>
                      <button type="button" style={btn(false)} onClick={() => patch(x.id, { edit: false })}>취소</button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" style={btn(false)} disabled={!x.url} onClick={() => patch(x.id, { edit: !x.edit })}>수정</button>
                  <button type="button" style={btn(false)} disabled={x.status === 'busy'} onClick={() => run({ prompt: x.prompt, refs: x.refs, kind: x.kind, from: x.from })}>다시 만들기</button>
                  <button type="button" style={btn(false)} disabled={!x.url} onClick={() => setRefs((r) => r.concat([x.url]).slice(0, 6))}>참고로</button>
                  <span style={{ flex: 1 }}></span>
                  <button type="button" style={Object.assign({}, btn(true), { opacity: x.url ? 1 : 0.6, cursor: x.url ? 'pointer' : 'default' })} disabled={!x.url} onClick={() => save(x)}>PNG 저장</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
