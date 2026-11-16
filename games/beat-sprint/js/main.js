// Boot: canvas sizing, fullscreen, pause on tab hide, and the frame loop.
(function () {
  const BS = window.BS;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const doc = document.documentElement;
  let W = 0, H = 0, dpr = 1;

  BS.Platform = {
    canFullscreen() { return !!(doc.requestFullscreen || doc.webkitRequestFullscreen); },
    isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    toggleFullscreen() {
      try {
        if (this.isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else {
          const p = (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc);
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) { /* refused: nothing to do */ }
    },
  };

  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    // sharp on high-DPI screens, but capped: fill cost grows with pixel count
    dpr = Math.min(window.devicePixelRatio || 1, 2, 2400 / W);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    BS.Scene.resize(W, H, dpr);
    BS.UI.layout(W, H);
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 120));
  resize();

  BS.Input.init(canvas);
  const G = BS.Game;
  G.init();

  document.addEventListener('visibilitychange', () => { if (document.hidden) G.pause(); });
  addEventListener('blur', () => G.pause());
  // fonts arrive late: rebuild nothing, the canvas just picks them up when ready
  if (document.fonts && document.fonts.load) {
    document.fonts.load('40px Monoton').catch(() => {});
    document.fonts.load('700 14px "Chakra Petch"').catch(() => {});
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    BS.Input.poll();
    G.update(dt);
    BS.Audio.pump(0.22);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    BS.Scene.draw(ctx, G.look);
    BS.UI.draw(ctx, G, dpr);
    const m = BS.Input.mouse;
    canvas.style.cursor = m && G.hitButton(m.x, m.y) ? 'pointer' : 'default';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
