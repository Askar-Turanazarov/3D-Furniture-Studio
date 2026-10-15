// First-person walk on the site around the building (showcase 3D view): WASD / arrows, Shift to run, the mouse
// looks (pointer lock after a click, or drag), on touch: drag to look, hold ▲ / ▼ to walk. Trees, benches,
// lamps, cars and the house stop the walker; stepping onto the street doors calls onDoor().
// Units: metres, as in exterior.js / site.js.
import * as THREE from 'three';

const EYE = 1.62, R = 0.3, WALK = 1.5, RUN = 3.2;

/** createStreetWalk({ camera, dom, walk (site.walk), obstacles, onDoor, onStop }) → { start(at), stop(), update(dt), active } */
export function createStreetWalk({ camera, dom, walk, obstacles, onDoor, onStop }) {
  const keys = new Set();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const pad = { f: 0 };
  let active = false, entered = false, drag = null, saved = null;

  const blocked = (x, z) => {
    const b = walk.bounds;
    if (x - R < b.x0 || x + R > b.x1 || z - R < b.z0 || z + R > b.z1) return true;
    const hit = o => x + R > o.x0 && x - R < o.x1 && z + R > o.z0 && z - R < o.z1;
    return hit(walk.house) || obstacles.some(hit);
  };

  function look(dx, dy) {
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= dx * 0.0035;
    euler.x = Math.max(-1.2, Math.min(1.2, euler.x - dy * 0.0035));
    camera.quaternion.setFromEuler(euler);
  }

  const onKey = e => {
    if (!active || e.target.closest?.('input, select, textarea, dialog')) return;
    if (e.type === 'keydown' && e.code === 'Escape') { stop(); onStop?.(); return; }
    if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(e.code)) {
      e.preventDefault();
      if (e.type === 'keydown') keys.add(e.code); else keys.delete(e.code);
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', () => keys.clear());
  dom.addEventListener('pointerdown', e => {
    if (!active) return;
    if (e.pointerType === 'mouse' && !document.pointerLockElement) {
      try { dom.requestPointerLock()?.catch?.(() => {}); } catch { /* drag instead */ }
    }
    drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', e => {
    if (!active) return;
    if (document.pointerLockElement === dom) return look(e.movementX, e.movementY);
    if (!drag) return;
    look(e.clientX - drag.x, e.clientY - drag.y);
    drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', () => { drag = null; });

  // At the start on the sidewalk or on the porch (coming out of the house), facing the doors / the street.
  function start(at = 'street') {
    const p = at === 'porch' ? walk.porch : walk.street;
    if (!active) saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, near: camera.near };
    active = true;
    entered = at === 'porch';         // step off the porch before the doors work again
    camera.position.set(p.x, EYE, p.z);
    camera.fov = 62;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
    camera.lookAt(p.x, EYE * (at === 'porch' ? 0.95 : 1.15), at === 'porch' ? p.z + 10 : walk.door.z);
    keys.clear();
  }

  function stop() {
    if (!active) return;
    active = false;
    keys.clear();
    pad.f = 0;
    if (document.pointerLockElement === dom) document.exitPointerLock();
    if (saved) {
      camera.position.copy(saved.pos);
      camera.quaternion.copy(saved.quat);
      camera.fov = saved.fov;
      camera.near = saved.near;
      camera.updateProjectionMatrix();
    }
  }

  const fwd = new THREE.Vector3();
  // One frame; true when the camera moved.
  function update(dt) {
    if (!active) return false;
    let f = pad.f, r = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    const len = Math.hypot(f, r);
    if (len < 0.01) return false;
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : WALK) * dt / Math.max(1, len);
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const dx = (fwd.x * f - fwd.z * r) * speed, dz = (fwd.z * f + fwd.x * r) * speed;
    const pos = camera.position;
    // The street doors: walking into them goes inside.
    const d = walk.door;
    const atDoor = pos.x > d.x0 && pos.x < d.x1 && pos.z + dz - R < d.z + 0.05;
    if (atDoor && !entered) {
      entered = true;
      // Let go of the mouse and the keys before the lobby opens: the dialog needs the cursor.
      keys.clear();
      pad.f = 0;
      drag = null;
      if (document.pointerLockElement === dom) document.exitPointerLock();
      onDoor?.();
      return true;
    }
    if (pos.z > d.z + 1.6) entered = false;
    if (!blocked(pos.x + dx, pos.z)) pos.x += dx;
    if (!blocked(pos.x, pos.z + dz)) pos.z += dz;
    return true;
  }

  return { start, stop, update, pad, get active() { return active; } };
}
