// Boot: canvas sizing, the frame loop, pointer taps, and pausing when the
// tab is hidden.
(function () {
  const G = LJ.Game;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.resize(W, H, dpr);
  }
  addEventListener('resize', resize);

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    G.pointer(e.clientX - r.left, e.clientY - r.top);
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) G.pause(); });
  addEventListener('blur', () => G.pause());

  G.init();
  resize();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.update(dt);
    G.render(ctx);
  }
  requestAnimationFrame(frame);
})();
