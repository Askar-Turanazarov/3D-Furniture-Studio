// The 3D toolbar above the scene: ⚙ opens the view settings (a drop-down on wide screens, a bottom sheet on phones),
// Esc / ✕ / a click outside close it; "?" shows or hides the controls hint (hidden at first on phones).
const $ = id => document.getElementById(id);
const phone = matchMedia('(max-width: 860px), (pointer: coarse)');

export function initV3dBar() {
  const panel = $('v3dPanel'), more = $('v3dMoreBtn'), hint = $('hint3d'), help = $('hint3dBtn');
  const open = on => {
    panel.hidden = !on;
    more.classList.toggle('active', on);
    more.setAttribute('aria-expanded', String(on));
  };
  more.addEventListener('click', () => open(panel.hidden));
  $('v3dPanelClose').addEventListener('click', () => open(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) open(false); });
  document.addEventListener('pointerdown', e => {
    if (!panel.hidden && !e.target.closest('#v3dPanel, #v3dMoreBtn')) open(false);
  });
  // The hint: one line at the bottom on a computer; on a phone only on "?", it would cover the joystick.
  const showHint = on => { hint.classList.toggle('off', !on); help.classList.toggle('active', on); };
  showHint(!phone.matches);
  help.addEventListener('click', () => showHint(hint.classList.contains('off')));
  phone.addEventListener('change', () => showHint(!phone.matches));
}
