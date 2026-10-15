// 3D quality by device class. The start tier comes from the CPU core count, memory, touch screen and GPU name;
// in "auto" a governor steps down when frames are slow and back up (not above the start) when they are fast.
export const TIERS = ['low', 'mid', 'high'];

export const SETTINGS = {
  low: { pixelRatio: 1, shadowMap: 1024, lampShadows: false, ao: false, antialias: false, anisotropy: 2 },
  mid: { pixelRatio: 1.5, shadowMap: 2048, lampShadows: true, ao: true, antialias: true, anisotropy: 4 },
  high: { pixelRatio: 2, shadowMap: 2048, lampShadows: true, ao: true, antialias: true, anisotropy: 8 }
};

// Older integrated (HD, UHD 6xx), mobile and software GPUs that struggle with soft shadows at a high pixel ratio.
const WEAK_GPU = /swiftshader|llvmpipe|software|microsoft basic|intel\(r\) hd graphics|intel\(r\) uhd graphics [2-6]\d{2}\b|mali-?[gt]?\d{1,2}\b|adreno[^\d]*[2-5]\d{2}\b|powervr|apple a(8|9|10|11)\b/i;
const STRONG_GPU = /nvidia|geforce|quadro|rtx|radeon (rx|pro)|apple m\d|intel.*\barc\b/i;

/** Device class: info = { cores, memory (GB), touch, gpu (renderer string) } → 'low' | 'mid' | 'high'. */
export function tierOf({ cores = 4, memory = 4, touch = false, gpu = '' } = {}) {
  if (WEAK_GPU.test(gpu) || cores <= 2 || memory <= 2) return 'low';
  if (touch) return cores >= 8 && memory >= 6 ? 'mid' : 'low';
  if (STRONG_GPU.test(gpu) && cores >= 6) return 'high';
  return cores >= 4 ? 'mid' : 'low';
}

/** The GPU name the browser reports (masked in some browsers; '' when unknown). */
export function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return ''; }
}

export function detectTier() {
  return tierOf({
    cores: navigator.hardwareConcurrency || 4,
    memory: navigator.deviceMemory || 4,
    touch: matchMedia('(pointer: coarse)').matches,
    gpu: gpuName()
  });
}

// The viewer's choice: 'auto' | 'high' | 'low' (saved).
export const PREFS = ['auto', 'high', 'low'];
export function readPref() {
  try { const p = localStorage.getItem('fsp3d.perf'); return PREFS.includes(p) ? p : 'auto'; } catch { return 'auto'; }
}
export function savePref(p) {
  try { localStorage.setItem('fsp3d.perf', p); } catch { /* ignore */ }
}
export const tierFor = (pref, detect = detectTier) => (pref === 'high' ? 'high' : pref === 'low' ? 'low' : detect());

/**
 * Frame-rate governor. frame(dt) gets the time of every frame drawn right after another one (idle time is not
 * counted). Below 30 fps for 3 s in a row → one tier down; above 55 fps for 10 s → one tier up, never above start.
 */
export function governor(start, onChange) {
  let level = TIERS.indexOf(start), time = 0, frames = 0, slow = 0, fast = 0;
  const max = level;
  return {
    get tier() { return TIERS[level]; },
    frame(dt) {
      if (!(dt > 0) || dt > 0.5) return;
      time += dt;
      frames++;
      if (time < 1) return;
      const fps = frames / time;
      time = frames = 0;
      if (fps < 30) { slow++; fast = 0; } else if (fps > 55) { fast++; slow = 0; } else slow = fast = 0;
      if (slow >= 3 && level > 0) {
        level--; slow = 0;
        onChange(TIERS[level], -1);
      } else if (fast >= 10 && level < max) {
        level++; fast = 0;
        onChange(TIERS[level], 1);
      }
    }
  };
}
