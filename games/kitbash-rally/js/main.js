// Boot: canvas sizing (16:9, sharp on high-DPI screens), fullscreen and
// orientation helpers, pause on blur, and the fixed-step loop.
(function () {
  const KR = window.KR;
  const W = 960, H = 540, STEP = 1 / 60;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const stage = document.getElementById('stage');
  const rotate = document.getElementById('rotate');
  const doc = document.documentElement;

  KR.Platform = {
    canFullscreen() { return !!(doc.requestFullscreen || doc.webkitRequestFullscreen); },
    isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    toggleFullscreen() {
      try {
        if (this.isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else {
          const p = (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc);
          if (p && p.then && screen.orientation && screen.orientation.lock) p.then(() => screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
        }
      } catch (e) { /* refused: nothing to do */ }
    },
  };

  const game = KR.Game;
  game.init();
  KR.game = game; // handy from the console

  const portrait = () => window.matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth;
  function resize() {
    const w = Math.min(innerWidth, (innerHeight * W) / H), h = (w * H) / W;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75, 1600 / w);
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.imageSmoothingQuality = 'medium';
    const p = portrait();
    rotate.hidden = !p;
    if (p) game.pause();
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 120));
  resize();

  KR.Input.init(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });
  addEventListener('blur', () => game.pause());

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.2, (now - last) / 1000);
    last = now;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      KR.Input.poll();
      game.update(STEP);
      KR.Input.endTick();
      acc -= STEP;
      steps++;
    }
    if (steps >= 6) acc = 0;
    game.draw(ctx);
    const m = KR.Input.mouse;
    canvas.style.cursor = m && game.hitAt(m) ? 'pointer' : 'default';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
