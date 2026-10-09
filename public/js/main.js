import { initLangSwitcher, onLangChange } from './i18n.js';
import { onChange } from './state.js';
import { initRenderer, requestDraw } from './renderer.js';

initLangSwitcher();
initRenderer(document.getElementById('plan'), document.getElementById('canvasWrap'));
onChange(requestDraw);
onLangChange(requestDraw);
requestDraw();
