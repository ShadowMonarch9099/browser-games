// Boot: size the canvases, run the loop, pause when the tab is hidden.
(function () {
  const { Game, View } = SG;
  const bg = document.getElementById('bg');
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');

  function resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, 2600 / Math.max(W, 1));
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    View.resize(bg, W, H, dpr);
    Game.relayout();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Game.pause(); });
  window.addEventListener('blur', () => Game.pause());

  Game.init();
  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { View.sprites.clear(); document.querySelectorAll('.how-art').forEach((c) => View.howArt(c)); }).catch(() => {});

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    Game.update(dt);
    Game.render(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  SG.debug = { Game, View, Rules: window.SnapGrid.Rules };
})();
