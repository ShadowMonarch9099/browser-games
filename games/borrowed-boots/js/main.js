// Boot: canvas scaling, fullscreen and orientation helpers, pause on blur,
// and the fixed-step loop that drives game.js and draws every screen.
(function () {
  const C = BB.CFG;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const rotate = document.getElementById('rotate');
  const doc = document.documentElement;

  BB.Platform = {
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
          if (p && p.then && screen.orientation && screen.orientation.lock) p.then(() => screen.orientation.lock('landscape').catch(() => {}));
        }
      } catch (e) {
        /* fullscreen refused */
      }
    },
  };

  const game = new BB.Game();
  BB.game = game;

  const portrait = () => window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth;
  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(vw, (vh * C.W) / C.H);
    const h = (w * C.H) / C.W;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, 2560 / w);
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const p = portrait();
    rotate.hidden = !p;
    if (p) game.pause();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();

  BB.Input.init(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
  });
  window.addEventListener('blur', () => game.pause());

  const UI = BB.UI;
  const R = BB.Render;

  function draw() {
    ctx.setTransform(canvas.width / C.W, 0, 0, canvas.height / C.H, 0, 0);
    game.buttons = [];
    const g = game;
    const base = ['settings', 'help', 'codex'].includes(g.state) && g.back ? g.back.state : g.state;
    const t = g.settings.motion ? g.time : g.time * 0.4;
    if (base === 'title' || base === 'slots') {
      const d = g.demo;
      if (d.terrain) R.scene(ctx, d, { fx: [], floaters: [], settings: g.settings, clouds: g.clouds }, t, { demo: true });
      else {
        ctx.fillStyle = '#9fd4f2';
        ctx.fillRect(0, 0, C.W, C.H);
      }
      R.ambient(ctx, g);
      ctx.drawImage(R.vignette(), 0, 0, C.W, C.H);
    } else if (base === 'map') {
      UI.map(ctx, g);
      R.ambient(ctx, g);
    } else if (g.sim) {
      R.scene(ctx, g, g, t, { shake: g.shake });
      R.ambient(ctx, g);
      ctx.drawImage(R.vignette(), 0, 0, C.W, C.H);
      if (base === 'play' || base === 'paused') UI.hud(ctx, g);
      if (g.state === 'play') UI.touch(ctx, g);
    }
    // overlay screens (the map draws itself above as the base)
    // only the screen on top is clickable
    if (g.state !== 'play' && g.state !== 'map') g.buttons = [];
    switch (g.state) {
      case 'title':
        UI.title(ctx, g);
        break;
      case 'slots':
        UI.slots(ctx, g);
        break;
      case 'paused':
        UI.paused(ctx, g);
        break;
      case 'won':
        UI.won(ctx, g);
        break;
      case 'settings':
        UI.settings(ctx, g);
        break;
      case 'help':
        UI.help(ctx, g);
        break;
      case 'codex':
        UI.codex(ctx, g);
        break;
    }
    UI.toast(ctx, g);
    UI.iris(ctx, g);
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= C.STEP) {
      BB.Input.poll();
      game.update(C.STEP);
      BB.Input.endTick();
      acc -= C.STEP;
    }
    draw();
    const m = BB.Input.mouse;
    canvas.style.cursor = m && game.hit(m) ? 'pointer' : 'default';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
