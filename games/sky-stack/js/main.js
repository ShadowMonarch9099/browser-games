// Boot: canvas sizing, fullscreen, pause when the tab is hidden, frame loop.
(function () {
  const SS = window.SS;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const doc = document.documentElement;
  let W = 0, H = 0, dpr = 1;

  SS.Platform = {
    canFullscreen() { return !!(doc.requestFullscreen || doc.webkitRequestFullscreen); },
    isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    toggleFullscreen() {
      try {
        if (this.isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { const p = (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc); if (p && p.catch) p.catch(() => {}); }
      } catch (e) { /* refused */ }
    },
  };

  function resize() {
    W = Math.max(1, innerWidth); H = Math.max(1, innerHeight);
    dpr = Math.min(devicePixelRatio || 1, 2, 2400 / W);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    SS.World.resize(W, H, dpr);
    SS.UI.layout(W, H);
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 120));
  resize();

  SS.Input.init(canvas);
  const G = SS.Game;
  G.init();
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.pause(); });
  addEventListener('blur', () => G.pause());

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    SS.Input.poll();
    G.update(dt);
    SS.Audio.pump();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    SS.Render.draw(ctx, G);
    SS.UI.draw(ctx, G, dpr);
    const m = SS.Input.mouse;
    canvas.style.cursor = m && (G.hitButton(m.x, m.y) || G.state === 'play') ? 'pointer' : 'default';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
