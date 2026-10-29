// Boot: canvas scaling and the fixed-timestep loop.
(function () {
  const C = SCE.CFG;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const game = new SCE.Game();
  SCE.game = game; // handy for debugging from the console

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(window.innerWidth, (window.innerHeight * C.W) / C.H);
    const h = (w * C.H) / C.W;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(canvas.width / C.W, 0, 0, canvas.height / C.H, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  SCE.Input.init(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
  });
  window.addEventListener('blur', () => game.pause());

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= C.STEP) {
      game.update(C.STEP);
      SCE.Input.endTick();
      acc -= C.STEP;
    }
    SCE.Render.draw(ctx, game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
