// Touch controls for Walk mode: joystick (move) on the left, swipe anywhere else (look).
import { touchInput, look, getMode, isTouch } from './controls3d.js';

const RADIUS = 45;   // joystick travel, px

export function initTouch(container, canvas) {
  const joy = container.querySelector('#joystick');
  const stick = joy.querySelector('.stick');
  let joyId = null, cx = 0, cy = 0;

  const refresh = () => { joy.hidden = !(isTouch() && getMode() === 'walk' && touchInput.active); };
  container.addEventListener('click', () => setTimeout(refresh));
  setInterval(refresh, 500);

  joy.addEventListener('pointerdown', e => {
    joyId = e.pointerId;
    const r = joy.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    joy.setPointerCapture(e.pointerId);
    move(e);
  });
  const move = e => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    touchInput.r = dx / RADIUS;
    touchInput.f = -dy / RADIUS;
  };
  const end = e => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    stick.style.transform = '';
    touchInput.f = touchInput.r = 0;
  };
  joy.addEventListener('pointermove', move);
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);

  // Look: drag on the canvas (touch only, in walk mode).
  let lookId = null, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || getMode() !== 'walk' || !touchInput.active) return;
    lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== lookId) return;
    look(e.clientX - lx, e.clientY - ly);
    lx = e.clientX; ly = e.clientY;
  });
  const stop = e => { if (e.pointerId === lookId) lookId = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}
