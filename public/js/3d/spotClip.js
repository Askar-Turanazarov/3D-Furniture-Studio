// Spots light only their own room. A spot without a shadow map shines straight through the partition onto the
// floor and the furniture of the next room; so every spot carries its room's rectangle (light.userData.clip,
// in the frame of its parent) and the shader drops its light outside it. One small addition to three's light
// loop: a uniform array, one vec4 per spot, filled before every frame in the order three sorts its lights.
import * as THREE from 'three';

const MAX = 64;
const rects = Array.from({ length: MAX }, () => new THREE.Vector4());   // shared by every material (shallow clone)
let patched = false;

/** Patch three's shader chunks once, before anything is compiled. A zero rectangle means "no clip". */
export function patchSpotClip() {
  if (patched) return;
  patched = true;
  const C = THREE.ShaderChunk;
  C.lights_pars_begin += `
#if NUM_SPOT_LIGHTS > 0
uniform vec4 spotClip[ NUM_SPOT_LIGHTS ];
float spotClipFactor( const in vec4 r, const in vec3 p ) {
	if ( r.z <= r.x ) return 1.0;
	return step( r.x, p.x ) * step( p.x, r.z ) * step( r.y, p.z ) * step( p.z, r.w );
}
#endif
`;
  const pos = 'vec3 geometryPosition = - vViewPosition;';
  const info = 'getSpotLightInfo( spotLight, geometryPosition, directLight );';
  if (!C.lights_fragment_begin.includes(pos) || !C.lights_fragment_begin.includes(info)) return;   // other three version
  C.lights_fragment_begin = C.lights_fragment_begin
    // World position of the fragment: the view matrix is rigid, so its inverse is the transposed rotation.
    .replace(pos, pos + '\n#if NUM_SPOT_LIGHTS > 0\nvec3 clipWorld = ( vec4( geometryPosition - viewMatrix[ 3 ].xyz, 0.0 ) * viewMatrix ).xyz;\n#endif')
    .replace(info, info + '\n\t\tdirectLight.color *= spotClipFactor( spotClip[ i ], clipWorld );');
  for (const k of ['standard', 'physical', 'lambert', 'phong', 'toon']) THREE.ShaderLib[k].uniforms.spotClip = { value: rects };
}

const byShadow = (a, b) => (b.castShadow ? 2 : 0) - (a.castShadow ? 2 : 0) + (b.map ? 1 : 0) - (a.map ? 1 : 0);

/**
 * Fill the rectangles for the next frame: the visible spots in scene order, sorted the way three sorts its lights
 * (shadow casters first, a stable sort), each rectangle moved to world coordinates by its parent's position.
 */
export function updateSpotClip(scene) {
  scene.updateMatrixWorld();
  const list = [];
  scene.traverseVisible(o => { if (o.isSpotLight) list.push(o); });
  list.sort(byShadow);
  for (let i = 0; i < MAX; i++) {
    const l = list[i], c = l?.userData.clip;
    if (!c) { rects[i].set(0, 0, 0, 0); continue; }
    const m = l.parent.matrixWorld.elements;
    rects[i].set(c.x0 + m[12], c.z0 + m[14], c.x1 + m[12], c.z1 + m[14]);
  }
}
