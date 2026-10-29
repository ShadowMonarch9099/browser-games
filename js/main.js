// Boot: canvas scaling, platform helpers (fullscreen, orientation) and the
// fixed-timestep loop.
(function () {
  const C = SCE.CFG;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const rotate = document.getElementById('rotate');
  const doc = document.documentElement;

  SCE.Platform = {
    canFullscreen() {
      return !!(doc.requestFullscreen || doc.webkitRequestFullscreen);
    },
    isFullscreen() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    },
    toggleFullscreen() {
      try {
        if (this.isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else {
          const p = (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc);
          // Phones: try to stay in landscape while fullscreen.
          if (p && p.then && screen.orientation && screen.orientation.lock) p.then(() => screen.orientation.lock('landscape').catch(() => {}));
        }
      } catch (e) {
        /* fullscreen refused — nothing to do */
      }
    },
  };

  const game = new SCE.Game();
  SCE.game = game; // handy for debugging from the console

  // Touch devices in portrait get a "rotate your device" overlay and pause.
  const portrait = () => window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(vw, (vh * C.W) / C.H);
    const h = (w * C.H) / C.W;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(canvas.width / C.W, 0, 0, canvas.height / C.H, 0, 0);
    const p = portrait();
    rotate.hidden = !p;
    if (p) game.pause();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
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
      SCE.Input.poll();
      game.update(C.STEP);
      SCE.Input.endTick();
      acc -= C.STEP;
    }
    SCE.Render.draw(ctx, game);
    const m = SCE.Input.mouse;
    canvas.style.cursor = m && game.hit(m) ? 'pointer' : 'default';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
