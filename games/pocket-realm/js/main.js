// Boot: canvas sizing, the frame loop, and pausing when the tab is hidden.
(function () {
  const G = PR.Game;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = innerWidth, H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    G.resize(W, H);
  }
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.pause(); });
  addEventListener('blur', () => G.pause());
  resize();
  G.init(canvas);
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.update(dt);
    G.render(ctx, dpr);
  }
  // Test hook: background tabs pause animation frames, so tests can step time.
  G.advance = (secs) => { for (let i = 0; i < Math.round(secs * 60); i++) G.update(1 / 60); G.render(ctx, dpr); };
  requestAnimationFrame(frame);
})();
