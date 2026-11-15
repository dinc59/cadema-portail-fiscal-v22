import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) console.error(e); });
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {url: 'https://example.test/#/', virtualConsole: vc});
const w = dom.window;
for (const k of ['window','document','HTMLElement','HTMLInputElement','Node','CustomEvent','Event','KeyboardEvent','MutationObserver','getComputedStyle','location','history','navigator','DOMParser'])
  { try { globalThis[k] = k === 'window' ? w : w[k]; } catch {} }
w.matchMedia = globalThis.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
globalThis.localStorage = w.localStorage; globalThis.CSS = w.CSS = {escape: s => String(s).replace(/"/g, '\\"')};
globalThis.requestAnimationFrame = w.requestAnimationFrame = fn => setTimeout(fn, 0);
w.HTMLElement.prototype.scrollIntoView = function () { globalThis.__scrolled = this.dataset.rbCard; };
for (const k of ['addEventListener','removeEventListener','dispatchEvent','scrollTo']) globalThis[k] = (w[k] || (() => {})).bind(w);
globalThis.innerWidth = 1280; globalThis.innerHeight = 900; globalThis.scrollY = 0; globalThis.scrollX = 0; globalThis.devicePixelRatio = 1;
globalThis.setTimeout = setTimeout; globalThis.top = globalThis; globalThis.self = globalThis; globalThis.ResizeObserver = class { observe() {} disconnect() {} }; globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
const errors = []; w.addEventListener('error', e => errors.push(e.message));

export { w, errors };
