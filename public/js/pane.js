// Which view the keys belong to: the 2D plan, the 3D scene, or in "plan + 3D" (split) the half pressed last.
export const pane = { mode: '2d', last: 'plan' };
export const keysTo3d = () => pane.mode === '3d' || (pane.mode === 'split' && pane.last === '3d');
export const keysToPlan = () => pane.mode === '2d' || (pane.mode === 'split' && pane.last === 'plan');
