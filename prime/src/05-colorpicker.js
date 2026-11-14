// HsvColorPicker — 교재 제작 커스텀 포인트색 선택기
// index.html 에서 분리(2026-07-29). 로드 순서는 index.html 의 script 태그 순서가 결정한다.
function HsvColorPicker({ value, onChange, presets, dark }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  const areaRef = useRef(null), hueRef = useRef(null), dragRef = useRef(null);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const clamp = (n) => Math.max(0, Math.min(1, n));
  // 로컬 HSV 상태 — 핸들/그라디언트를 드래그값으로 직접 구동(hex 라운드트립 지터 제거)
  const [hsv, setHsv] = useState(() => pcRgbToHsv(pcHexToRgb(valid ? value : '#000000')));
  const hsvRef = useRef(hsv); hsvRef.current = hsv;
  // 외부 value(프리셋/헥스 입력) 변경만 반영 — 드래그 중이 아닐 때, 라운드트립 오차는 무시(루프/지터 방지)
  useEffect(() => {
    if (dragRef.current || !/^#[0-9a-fA-F]{6}$/.test(value)) return;
    const n = pcRgbToHsv(pcHexToRgb(value)), c = hsvRef.current;
    const same = Math.abs(n.s - c.s) < 1.5 && Math.abs(n.v - c.v) < 1.5 && (c.s < 2 || c.v < 2 || Math.abs(((n.h - c.h + 540) % 360) - 180) < 2);
    if (!same) { hsvRef.current = n; setHsv(n); }
  }, [value]);
  // 정체성 고정 드래그 핸들러(ref만 읽음) → 포인터 캡처 없이 window에서 박스 밖까지 안정 추적
  const HB = useRef(null);
  if (!HB.current) {
    const move = (e) => {
      const w = dragRef.current; if (!w) return;
      const el = (w === 'area' ? areaRef : hueRef).current; if (!el) return;
      const r = el.getBoundingClientRect(), c = hsvRef.current; let n;
      if (w === 'area') { const x = clamp((e.clientX - r.left) / r.width), y = clamp((e.clientY - r.top) / r.height); n = { h: c.h, s: x * 100, v: (1 - y) * 100 }; }
      else { const x = clamp((e.clientX - r.left) / r.width); n = { h: x * 360, s: c.s, v: c.v }; }
      hsvRef.current = n; setHsv(n); onChangeRef.current(pcHsvToHex(n));
    };
    const up = () => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    HB.current = { move, up };
  }
  useEffect(() => () => { window.removeEventListener('pointermove', HB.current.move); window.removeEventListener('pointerup', HB.current.up); }, []);
  const start = (w) => (e) => {
    if (e.button !== 0) return; e.preventDefault();
    dragRef.current = w;
    window.addEventListener('pointermove', HB.current.move);
    window.addEventListener('pointerup', HB.current.up);
    HB.current.move(e);
  };
  const shuffle = () => { const n = { h: Math.floor(hsv.h * 7 + hsv.v * 3 + 137) % 360, s: 55 + (Math.floor(hsv.s + hsv.v) % 45), v: 45 + (Math.floor(hsv.v + hsv.h) % 35) }; hsvRef.current = n; setHsv(n); onChange(pcHsvToHex(n)); };
  const hueHex = pcHsvToHex({ h: hsv.h, s: 100, v: 100 });
  const border = '1px solid ' + (dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
        {presets.map(col => (
          <button key={col} onClick={() => onChange(col)} title={col}
            style={{ width: '20px', height: '20px', borderRadius: '50%', background: col, cursor: 'pointer', padding: 0, border: (valid && value.toUpperCase() === col.toUpperCase()) ? '2px solid ' + (dark ? '#fff' : '#1d1d1f') : '1px solid rgba(0,0,0,0.12)' }} />
        ))}
      </div>
      <div ref={areaRef} onPointerDown={start('area')} onContextMenu={e => e.preventDefault()}
        style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '12px', cursor: 'crosshair', touchAction: 'none', userSelect: 'none', background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${hueHex})` }}>
        <div style={{ position: 'absolute', width: '15px', height: '15px', marginLeft: '-7.5px', marginTop: '-7.5px', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)', pointerEvents: 'none', background: pcHsvToHex(hsv), left: hsv.s + '%', top: (100 - hsv.v) + '%' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <div ref={hueRef} onPointerDown={start('hue')} onContextMenu={e => e.preventDefault()}
          style={{ position: 'relative', flex: 1, height: '14px', borderRadius: '7px', cursor: 'pointer', touchAction: 'none', userSelect: 'none', background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}>
          <div style={{ position: 'absolute', top: '50%', width: '16px', height: '16px', marginLeft: '-8px', marginTop: '-8px', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)', pointerEvents: 'none', background: hueHex, left: (hsv.h / 360 * 100) + '%' }} />
        </div>
        <button onClick={shuffle} title="셔플" style={{ flex: 'none', width: '30px', height: '30px', borderRadius: '8px', border, background: dark ? 'rgba(255,255,255,0.06)' : '#f5f5f7', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#c8c8cc' : '#3d3d42' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 4h3v3" /><path d="M18 20h3v-3" /><path d="M3 4l6 6" /><path d="M21 4l-8 8-8 8" /><path d="M3 20l6-6" /></svg>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', height: '32px', padding: '0 10px', borderRadius: '9px', border, background: dark ? 'rgba(255,255,255,0.05)' : '#fff' }}>
        <span style={{ width: '18px', height: '18px', flex: 'none', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', background: valid ? value : '#000' }} />
        <span style={{ fontSize: '13px', color: dark ? '#8a8a90' : '#86868b' }}>#</span>
        <input value={(value || '').replace('#', '')} spellCheck={false}
          onChange={e => onChange('#' + e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: dark ? '#ececed' : '#1d1d1f', textTransform: 'uppercase' }} />
      </div>
    </div>
  );
}

