// Boot: size the canvases to the window, run the loop, pause when the tab is
// hidden or loses focus.
(function () {
  const { Game, Scene } = PP;
  const bg = document.getElementById('bg');
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');

  function resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, 2600 / Math.max(W, 1));
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    Scene.resize(bg, W, H, dpr);
    Game.layout();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  // Space/Enter on a focused button would click it a second time on keyup.
  window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Game.pause(); });
  window.addEventListener('blur', () => Game.pause());

  Game.init();
  resize();
  // Repaint the backdrop once the web fonts arrive (it works without them).
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize).catch(() => {});

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    Game.update(dt);
    Game.render(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.PP.debug = { Game, Scene };
})();
