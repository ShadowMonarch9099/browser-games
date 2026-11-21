const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (n) => (Math.random() * n) | 0;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
function hexa(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
// deterministic pseudo-random for static scenery
function seeded(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fmtScore(n) { return String(n).padStart(6, '0'); }
