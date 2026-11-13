// Arcade kit: game loop and canvas sizing.
// Classic script (no modules) so games also run straight from file://.
window.Arcade = window.Arcade || {};

// Fixed-step loop: update(dt) always gets the same dt (1/60 s), however fast
// the screen refreshes; render(alpha) gets how far we are into the next step
// (0..1) for smooth drawing. Time doesn't pile up while the tab is hidden.
Arcade.loop = function ({ update, render, step = 1 / 60 }) {
  let last = 0, acc = 0, raf = 0, running = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // Cap a long frame so nothing teleports after a hitch.
    acc += Math.min((now - last) / 1000, 0.1);
    last = now;
    while (acc >= step) { update(step); acc -= step; }
    render(acc / step);
  }
  function start() {
    if (running) return;
    running = true; last = performance.now(); acc = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  document.addEventListener('visibilitychange', () => {
    if (!running) return;
    if (document.hidden) cancelAnimationFrame(raf);
    else { last = performance.now(); acc = 0; raf = requestAnimationFrame(frame); }
  });

  return { start, stop };
};

// Keeps a canvas as sharp as the screen allows and tells you its size in CSS
// pixels. Draw in CSS pixels; the context is already scaled.
Arcade.fitCanvas = function (canvas, onResize) {
  const ctx = canvas.getContext('2d');
  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (onResize) onResize(w, h);
  }
  window.addEventListener('resize', fit);
  fit();
  return ctx;
};
