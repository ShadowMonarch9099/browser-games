// Starter game on the Arcade kit: move a square, collect dots.
// Replace the "game" parts; keep the structure (state, update, render).
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  input.touchPad(['left', 'right', 'up', 'down']);
  const save = Arcade.save();
  const ui = Arcade.ui.create({
    title: 'My Game',
    tagline: 'Collect ten dots.',
    how: [['Arrows / WASD', 'Move'], ['Esc', 'Pause']],
    // Give your game its own look: fonts, colours and shapes for the menus.
    // Every key is optional; see the top of site/lib/ui.js for the full list.
    theme: {
      fonts: 'family=Fredoka:wght@500;700',
      display: '"Fredoka", sans-serif', body: '"Fredoka", sans-serif',
      overlay: 'rgba(10, 30, 40, .7)',
      panel: '#12303a', panel2: '#1b4552', edge: '#0a1d24',
      text: '#eafcff', muted: '#8fbcc7',
      accent: '#ffd166', accentInk: '#3a2a00',
      radius: '18px',
    },
  });

  let state = 'menu'; // menu | playing | paused | over
  let player, dot, score, rand;

  function start() {
    rand = Arcade.rng();
    player = { x: W / 2, y: H / 2, size: 28, speed: 260 };
    score = 0;
    placeDot();
    ui.hide();
    input.flush();
    state = 'playing';
  }
  function placeDot() { dot = { x: 40 + rand() * (W - 80), y: 40 + rand() * (H - 80) }; }

  function update(dt) {
    input.poll();
    if (state !== 'playing') return;
    const p = input.solo;
    player.x = Math.max(0, Math.min(W, player.x + p.x * player.speed * dt));
    player.y = Math.max(0, Math.min(H, player.y + p.y * player.speed * dt));
    if (Math.hypot(player.x - dot.x, player.y - dot.y) < player.size) {
      score++;
      Arcade.audio.sfx('coin');
      if (score === 10) return finish();
      placeDot();
    }
  }

  function finish() {
    state = 'over';
    const best = Math.max(score, save.get('best', 0));
    save.set('best', best);
    Arcade.audio.sfx('win');
    ui.results({ heading: 'Nice!', rows: [['Dots', score], ['Best', best]], buttons: [{ label: 'Play again', onClick: start }] });
  }

  function render() {
    ctx.fillStyle = '#121017';
    ctx.fillRect(0, 0, W, H);
    if (state === 'menu') return;
    ctx.fillStyle = '#48d597';
    ctx.beginPath(); ctx.arc(dot.x, dot.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffc531';
    ctx.fillRect(player.x - player.size / 2, player.y - player.size / 2, player.size, player.size);
    ctx.fillStyle = '#f3eee4';
    ctx.font = '700 20px "Chakra Petch", system-ui, sans-serif';
    ctx.fillText(`Dots ${score} / 10`, 16, 32);
  }

  ui.onPause(() => {
    if (state !== 'playing') return;
    state = 'paused';
    ui.pause({ onResume() { ui.hide(); input.flush(); state = 'playing'; }, onRestart: start });
  });
  ui.title({ buttons: [{ label: 'Play', onClick: start }] });
  Arcade.loop({ update, render }).start();
})();
