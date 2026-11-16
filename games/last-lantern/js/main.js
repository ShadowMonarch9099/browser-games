// Boot: scaling, fullscreen, pause on blur/hide, the fixed-step loop and the
// order screens are drawn in.
(function () {
  const C = LL.CFG;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const rotate = document.getElementById('rotate');
  const doc = document.documentElement;

  LL.Platform = {
    canFullscreen: () => !!(doc.requestFullscreen || doc.webkitRequestFullscreen),
    isFullscreen: () => !!(document.fullscreenElement || document.webkitFullscreenElement),
    toggleFullscreen() {
      try {
        if (this.isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else {
          const p = (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc);
          if (p && p.then && screen.orientation && screen.orientation.lock) p.then(() => screen.orientation.lock('landscape').catch(() => {}));
        }
      } catch (e) {
        /* refused */
      }
    },
  };

  const game = new LL.Game();
  LL.game = game;

  const portrait = () => matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth;
  function resize() {
    const w = Math.min(innerWidth, (innerHeight * C.W) / C.H);
    const h = (w * C.H) / C.W;
    const dpr = Math.min(devicePixelRatio || 1, 2, 2560 / w);
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    rotate.hidden = !portrait();
    if (portrait()) game.pause();
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();
  LL.Input.init(canvas);
  document.addEventListener('visibilitychange', () => document.hidden && game.pause());
  addEventListener('blur', () => game.pause());
  addEventListener('beforeunload', () => game.run && !game.run.over && game.persist());

  const UI = LL.UI;
  const R = LL.Render;
  function draw() {
    ctx.setTransform(canvas.width / C.W, 0, 0, canvas.height / C.H, 0, 0);
    const g = game;
    g.buttons = [];
    const base = g.under;
    if (base === 'title' || !g.run) {
      if (g.demo.built) R.scene(ctx, g.demo, g.demoCam, g, {});
      else {
        ctx.fillStyle = '#05050a';
        ctx.fillRect(0, 0, C.W, C.H);
      }
      // a soft vignette so the menu reads
      const gr = ctx.createLinearGradient(0, 0, C.W * 0.6, 0);
      gr.addColorStop(0, 'rgba(3,3,8,0.85)');
      gr.addColorStop(1, 'rgba(3,3,8,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, C.W, C.H);
    } else {
      R.scene(ctx, g.run, g.cam, g, { shake: g.shake });
      if (base === 'play') {
        UI.hud(ctx, g);
        if (g.state === 'play') UI.touch(ctx, g);
      }
    }
    if (g.state !== 'play') g.buttons = [];
    const draw = { title: UI.title, paused: UI.paused, settings: UI.settings, help: UI.help, journal: UI.journal, map: UI.map, satchel: UI.satchel, over: UI.over }[g.state];
    if (draw) draw.call(UI, ctx, g);
    UI.toast(ctx, g);
    if (g.fade > 0) {
      ctx.fillStyle = `rgba(3,3,8,${g.fade})`;
      ctx.fillRect(0, 0, C.W, C.H);
    }
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= C.STEP) {
      LL.Input.poll();
      game.update(C.STEP);
      LL.Input.endTick();
      acc -= C.STEP;
    }
    draw();
    const m = LL.Input.mouse;
    canvas.style.cursor = m && game.hit(m) ? 'pointer' : 'default';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
