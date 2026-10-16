// 3D quality by device class. The start tier comes from the CPU core count, memory, touch screen and GPU name;
// in "auto" a governor steps down when frames are slow and back up (not above the start) when they are fast.
export const TIERS = ['low', 'mid', 'high'];

export const SETTINGS = {
  // lampShadows: lamps of the room with the camera that cast a shadow (the brightest ones), 1024 px each;
  // bloom: the glow of lit shades (post-processing, the strong devices only).
  low: { pixelRatio: 1, shadowMap: 1024, lampShadows: 0, antialias: false, anisotropy: 2, maxLamps: 8, bloom: false },
  mid: { pixelRatio: 1.5, shadowMap: 2048, lampShadows: 2, antialias: true, anisotropy: 4, maxLamps: 18, bloom: false },
  high: { pixelRatio: 2, shadowMap: 2048, lampShadows: 4, antialias: true, anisotropy: 8, maxLamps: 27, bloom: true }
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

// Obviously weak devices: a software renderer, ≤ 2 cores or ≤ 2 GB, old phone GPUs. Not every 'low' tier device:
// an Intel HD / UHD laptop is 'low' (no soft lamp shadows) but shows the photo textures well enough.
const OLD_MOBILE_GPU = /mali-?(4\d{2}|t\d{3})\b|adreno[^\d]*[2-4]\d{2}\b|powervr|apple a(8|9|10)\b/i;
const SOFTWARE_GPU = /swiftshader|llvmpipe|software|microsoft basic/i;
export function isWeak({ cores = 4, memory = 4, gpu = '' } = {}) {
  return SOFTWARE_GPU.test(gpu) || OLD_MOBILE_GPU.test(gpu) || cores <= 2 || memory <= 2;
}
export const weakDevice = () => isWeak({ cores: navigator.hardwareConcurrency || 4, memory: navigator.deviceMemory || 4, gpu: gpuName() });

/** Photo textures by default: "High" — yes, "Low" — no, "Auto" — unless the device is obviously weak. */
export const photoAuto = (pref = readPref(), weak = weakDevice) => (pref === 'high' ? true : pref === 'low' ? false : !weak());

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
