// Boot: canvas sizing, the frame loop, and pausing when the tab is hidden.
(function () {
  const G = KA.Game, V = KA.View;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    V.resize(W, H);
  }
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.pause(); });
  addEventListener('blur', () => G.pause());
  KA.Input.init();
  resize();
  G.init();
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.update(dt);
    G.render(ctx);
  }
  // Test hook: background tabs pause animation frames, so tests can step time.
  G.advance = (secs) => { for (let i = 0; i < Math.round(secs * 60); i++) G.update(1 / 60); G.render(ctx); };
  requestAnimationFrame(frame);
})();
