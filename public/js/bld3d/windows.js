// Facade glass with a room behind it ("interior mapping", as in games and archviz): every window is one flat quad,
// the fragment shader traces the view ray into an imaginary box room — side walls, floor, ceiling, back wall with
// a doorway — and draws curtains or blinds just behind the glass. Over it the glass reflects the sky (Fresnel).
// All windows are one InstancedMesh: one draw call, no textures. Per window: a seed (wall colour, curtains,
// room depth), how lit it is from inside, the sill height, the kind (flat / shop / lobby), a highlight tint,
// dimmed and hovered flags.
import * as THREE from 'three';

const vertexShader = /* glsl */`
attribute vec4 aWin;     // seed, lit 0…1, sill (m from the floor), kind: 0 flat, 1 shop, 2 lobby
attribute vec4 aTint;    // highlight colour, strength
attribute vec2 aState;   // dimmed, hovered
varying vec2 vUv; varying vec2 vSize; varying vec3 vDirT; varying vec3 vWorld; varying vec3 vN;
varying vec4 vWin; varying vec4 vTint; varying vec2 vState;
#include <fog_pars_vertex>
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec3 ax = m[0].xyz, ay = m[1].xyz;
  vSize = vec2(length(ax), length(ay));
  vec3 T = ax / vSize.x, B = ay / vSize.y, N = normalize(m[2].xyz);
  vec4 wp = m * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec3 v = wp.xyz - cameraPosition;
  vDirT = vec3(dot(v, T), dot(v, B), -dot(v, N));    // z: into the room
  vN = N;
  vUv = (position.xy + 0.5) * vSize;                  // metres from the window's bottom-left corner
  vWin = aWin; vTint = aTint; vState = aState;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const fragmentShader = /* glsl */`
uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
uniform float uDay;      // daylight inside, 0…1
uniform vec3 uLamp;      // colour × strength of a lit room
varying vec2 vUv; varying vec2 vSize; varying vec3 vDirT; varying vec3 vWorld; varying vec3 vN;
varying vec4 vWin; varying vec4 vTint; varying vec2 vState;
#include <fog_pars_fragment>
float hash(float n) { return fract(sin(n) * 43758.5453); }
vec3 skyCol(vec3 r) {
  float h = r.y;
  if (h < 0.0) return mix(bottom * 0.5, vec3(0.09, 0.09, 0.08), clamp(-h * 4.0, 0.0, 1.0));   // the ground
  return mix(mid, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.8));
}
void main() {
  float seed = vWin.x, lit = vWin.y, sill = vWin.z, kind = vWin.w;
#ifdef SIMPLE
  // Low quality: no room behind the glass, only a dark interior or the lamp's glow.
  vec3 room = vec3(0.05 + 0.12 * uDay) + uLamp * lit * (0.5 + 0.2 * hash(seed * 3.3));
#else
  vec3 d = normalize(vDirT);
  d.z = max(d.z, 1e-3);
  bool flat_ = kind < 0.5;
  // The room: wider than the window, floor at -sill, 2.7 m high (shops and the lobby 3.6), 3.5–5 m deep.
  float ex = flat_ ? 0.9 + seed * 0.9 : 0.4;
  float H = flat_ ? 2.7 : 3.6, D = flat_ ? 3.5 + seed * 1.5 : 6.0;
  vec3 o = vec3(vUv, 0.0);
  vec3 lo = vec3(-ex, -sill, 0.0), hi = vec3(vSize.x + ex, H - sill, D);
  vec3 tf = max((lo - o) / d, (hi - o) / d);
  float t = min(min(tf.x, tf.y), tf.z);
  vec3 p = o + d * t;

  // Wall colours: warm white, beige, light grey, sage; shops white, the lobby warm stone.
  float k = floor(hash(seed * 91.7) * 4.0);
  vec3 wallC = k < 1.0 ? vec3(0.86, 0.83, 0.78) : k < 2.0 ? vec3(0.78, 0.70, 0.60) : k < 3.0 ? vec3(0.70, 0.71, 0.72) : vec3(0.62, 0.68, 0.60);
  if (kind > 0.5) wallC = kind < 1.5 ? vec3(0.9) : vec3(0.80, 0.70, 0.56);
  vec3 col = wallC;
  if (t == tf.z) {
    // Back wall: a darker doorway and, in flats, a picture or a wardrobe.
    float dx = vSize.x * 0.5 + (hash(seed * 13.1) - 0.5) * 2.0;
    if (abs(p.x - dx) < 0.45 && p.y < 2.05 - sill) col *= 0.35;
    else if (flat_ && abs(p.x - dx + 1.4) < 0.35 && abs(p.y - (1.5 - sill)) < 0.25) col = vec3(0.25, 0.32, 0.38);
  } else if (t == tf.y) {
    if (d.y > 0.0) col = vec3(0.92);                                     // ceiling
    else {                                                               // floor: planks / stone
      float plank = step(0.5, fract(p.x * 4.0 + floor(p.z * 0.8) * 0.5));
      col = flat_ ? mix(vec3(0.42, 0.30, 0.20), vec3(0.48, 0.35, 0.24), plank) : vec3(0.62, 0.60, 0.56);
    }
  }
  // Furniture silhouettes along the back wall (a sofa / a bed) in flats.
  if (flat_ && t == tf.z && p.y < 0.8 - sill && abs(p.x - vSize.x * 0.5) < 1.1 + hash(seed * 3.3)) col *= 0.55;

  // Light: dim daylight from the window, a lamp in lit rooms (brighter under the ceiling centre).
  float depth = p.z / D;
  float edge = min(min(p.x - lo.x, hi.x - p.x), min(p.y - lo.y, hi.y - p.y));
  float occl = 0.6 + 0.4 * smoothstep(0.0, 0.5, edge);                  // darker in the corners
  vec2 c = vec2(vSize.x * 0.5, D * 0.45);
  float glow = exp(-dot(p.xz - c, p.xz - c) * 0.25);
  vec3 dayL = vec3(uDay * mix(0.42, 0.16, depth));
  vec3 lampL = uLamp * lit * (0.55 + 0.6 * glow) * (t == tf.y && d.y > 0.0 ? 1.25 : 1.0);
  if (!flat_) dayL *= 1.6;
  vec3 room = col * occl * (dayL + lampL);

  // Curtains just behind the glass (z = 0.12) or blinds over the top part; none in shops and the lobby.
  if (flat_) {
    vec2 q = o.xy + d.xy * (0.12 / d.z);
    float style = hash(seed * 7.7);
    vec3 fabric = mix(vec3(0.86, 0.82, 0.74), vec3(0.62, 0.58, 0.55), hash(seed * 5.1));
    float w = vSize.x * (0.16 + 0.22 * hash(seed * 2.9));
    float fold = 0.88 + 0.12 * sin(q.x * 48.0);
    vec3 light = vec3(uDay * 0.55) + uLamp * lit * 0.6;                 // lit rooms make the fabric glow
    if (style < 0.7 && (q.x < w || q.x > vSize.x - w) && q.y > -0.1) room = fabric * fold * light;
    else if (style >= 0.7) {
      float down = vSize.y * (0.35 + 0.4 * hash(seed * 4.3));
      if (q.y > vSize.y - down) room = fabric * (0.8 + 0.2 * step(0.5, fract(q.y * 18.0))) * light;
    }
  }
#endif

  // Glass: a cool tint and the sky by Fresnel; a lit room shows through more.
  vec3 vd = normalize(vWorld - cameraPosition);
  float cosT = clamp(dot(-vd, vN), 0.0, 1.0);
  float F = 0.12 + 0.88 * pow(1.0 - cosT, 4.0);
  vec3 refl = skyCol(reflect(vd, vN));
  vec3 col3 = mix(room * vec3(0.86, 0.92, 0.95), refl, F * (1.0 - 0.5 * lit));
  // Highlight: a light tone of the apartment's colour over the glass and a thin frame in it, not a fill.
  // Hovered: a bright frame round every window of the apartment; not matching the filters: darker glass.
  float border = min(min(vUv.x, vUv.y), min(vSize.x - vUv.x, vSize.y - vUv.y));
  vec3 tc = vTint.rgb * (0.55 + 0.45 * max(uDay, 0.6));
  col3 = mix(col3, tc, vTint.a);                                      // tone ≤ 25 %
  col3 = mix(col3, tc, step(0.0001, vTint.a) * (1.0 - smoothstep(0.05, 0.07, border)));
  col3 *= mix(1.0, 0.45, vState.x);
  col3 = mix(col3, col3 * 1.15 + 0.05, vState.y);
  col3 = mix(col3, vec3(1.0, 0.97, 0.88), vState.y * (1.0 - smoothstep(0.08, 0.1, border)));
  gl_FragColor = vec4(col3, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/**
 * createWindows(bays, sky) → { mesh, set(i, { matrix, seed, lit, sill, kind, tint: Color|null, tintK, dim, hover }),
 * commit(), setTime({ day, lamp }) }. sky: the sky material's uniforms (top, mid, bottom — shared, so the
 * reflection follows the time of day). simple: low quality — plain glass without the room.
 */
export function createWindows(bays, sky, { simple = false } = {}) {
  const n = bays.length;
  const geo = new THREE.PlaneGeometry(1, 1);
  const win = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  const state = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
  geo.setAttribute('aWin', win);
  geo.setAttribute('aTint', tint);
  geo.setAttribute('aState', state);
  const mat = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, fog: true, defines: simple ? { SIMPLE: '' } : {},
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uDay: { value: 1 }, uLamp: { value: new THREE.Color() } }])
  });
  // The sky colours are the sky's own objects: one update moves both.
  Object.assign(mat.uniforms, { top: sky.top, mid: sky.mid, bottom: sky.bottom });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.name = 'windows';

  function set(i, o) {
    if (o.matrix) mesh.setMatrixAt(i, o.matrix);
    win.setXYZW(i, o.seed, o.lit, o.sill, o.kind);
    const c = o.tint;
    tint.setXYZW(i, c ? c.r : 0, c ? c.g : 0, c ? c.b : 0, c ? o.tintK : 0);
    state.setXY(i, o.dim ? 1 : 0, o.hover ? 1 : 0);
  }
  function commit() {
    mesh.instanceMatrix.needsUpdate = true;
    win.needsUpdate = tint.needsUpdate = state.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  function setTime({ day, lamp }) {
    mat.uniforms.uDay.value = day;
    mat.uniforms.uLamp.value.setRGB(1.0, 0.72, 0.45).multiplyScalar(lamp);
  }
  return { mesh, set, commit, setTime };
}
