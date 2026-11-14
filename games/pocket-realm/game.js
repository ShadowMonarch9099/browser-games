// Pocket Realm's screen. The rules live in rules.js; this file draws the board
// as HTML and turns clicks into moves.
(function () {
  const R = window.Realm;
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const save = Arcade.save('pocket-realm');

  const DISPLAY = '"MedievalSharp", "Georgia", serif';
  const BODY = '"Spectral", "Georgia", serif';
  const ui = Arcade.ui.create({
    title: 'Pocket Realm',
    tagline: 'Build the map. Survive it. Slay the dragon.',
    how: [['Each turn', 'Pick one of two lands'], ['Then', 'Place it next to your hero, who walks onto it'], ['Neighbours', 'Some lands change each other'], ['After 26 lands', "the Dragon's Keep appears"]],
    // Pocket Realm's own look: an illuminated manuscript. Vellum, royal purple, gold leaf.
    theme: {
      fonts: 'family=MedievalSharp&family=Spectral:wght@500;700',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(40, 20, 60, .6)',
      panel: '#f4ecd8', panel2: '#e9dcbc', edge: '#7b2cbf',
      text: '#2b1b3d', muted: '#6b5a7b',
      accent: '#7b2cbf', accentInk: '#fff6d6',
      radius: '6px', border: '3px',
      shadow: '0 0 0 3px #f4ecd8, 0 0 0 6px #c9a227, 0 20px 40px rgba(0,0,0,.3)', buttonShadow: 'none',
    },
  });

  const ICON = { meadow: '🌾', forest: '🌲', ruins: '🏚️', village: '🏘️', swamp: '🌫️', mountain: '⛰️', lake: '💧', keep: '🏰' };
  const SPECIAL = { witch: '🧙', grove: '👻', falls: '🌊', farm: '🥕' };
  const COLOR = { meadow: '#c5d86d', forest: '#4f772d', ruins: '#a39171', village: '#e9c46a', swamp: '#6b705c', mountain: '#8d99ae', lake: '#4cc9f0', keep: '#6a040f' };

  const style = document.createElement('style');
  style.textContent = `
    .pr { position: fixed; inset: 0; z-index: 40; overflow: auto; font-family: ${BODY}; color: #2b1b3d; padding: 60px 12px 16px; }
    .pr[hidden] { display: none; }
    .pr-wrap { max-width: 980px; margin: 0 auto; display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) 300px; align-items: start; }
    @media (max-width: 760px) { .pr-wrap { grid-template-columns: 1fr; } }
    .pr-board { display: grid; grid-template-columns: repeat(${R.SIZE}, 1fr); grid-template-rows: repeat(${R.SIZE}, 1fr); gap: 4px; background: #c9a227; padding: 6px; border-radius: 6px; aspect-ratio: 1; max-width: 560px; width: 100%; margin: 0 auto; }
    .pr-cell { position: relative; border-radius: 3px; background: #e9dcbc; display: grid; place-items: center; font-size: clamp(1rem, 4.6vw, 1.9rem); border: 0; padding: 0; color: inherit; font-family: inherit; }
    .pr-cell.land { box-shadow: inset 0 -5px 0 rgba(0,0,0,.18); }
    .pr-cell.spot { background: #fff6d6; outline: 3px dashed #7b2cbf; outline-offset: -5px; cursor: pointer; }
    .pr-cell.spot:hover, .pr-cell.walk:hover { filter: brightness(1.1); }
    .pr-cell.walk { cursor: pointer; outline: 3px solid #7b2cbf; outline-offset: -4px; }
    .pr-cell .hero { position: absolute; inset: 14%; border-radius: 50%; background: #fff6d6; border: 3px solid #7b2cbf; display: grid; place-items: center; font-size: .8em; }
    .pr-cell .sp { position: absolute; right: 2px; bottom: 0; font-size: .55em; }
    .pr-side { display: grid; gap: 12px; }
    .pr-card { background: #f4ecd8; border: 2px solid #c9a227; border-radius: 6px; padding: 12px 14px; }
    .pr-card h3 { font: 1.25rem ${DISPLAY}; margin: 0 0 6px; color: #7b2cbf; }
    .pr-stats { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: .95rem; }
    .pr-stats b { font-weight: 700; }
    .pr-bar { height: 10px; background: #e9dcbc; border-radius: 5px; overflow: hidden; margin: 6px 0; }
    .pr-bar i { display: block; height: 100%; background: #b5179e; }
    .pr-offer { display: flex; gap: 8px; }
    .pr-offer button, .pr-actions button { flex: 1; font: 700 1rem ${BODY}; color: #2b1b3d; background: #fff6d6; border: 2px solid #c9a227; border-radius: 6px; padding: 8px 6px; cursor: pointer; }
    .pr-offer button[aria-pressed="true"] { background: #7b2cbf; color: #fff6d6; border-color: #7b2cbf; }
    .pr-offer .big { display: block; font-size: 1.7rem; }
    .pr-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .pr-actions button:disabled { opacity: .45; cursor: default; }
    .pr-log { font-size: .9rem; max-height: 9.5em; overflow: auto; margin: 0; padding-left: 18px; color: #6b5a7b; }
    .pr-log li:last-child { color: #2b1b3d; font-weight: 700; }
    .pr button:focus-visible { outline: 3px solid #b5179e; outline-offset: 2px; }`;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'pr'; root.hidden = true;
  document.body.appendChild(root);

  let run = null, mode = 'calm', pick = 0, daily = false;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function start(cls, isDaily) {
    daily = isDaily;
    const seed = isDaily ? Arcade.rng.hash('pocket-realm:' + Arcade.rng.today()) : Arcade.rng.hash(String(Math.random()));
    run = R.newRun(seed, cls);
    mode = 'calm'; pick = 0;
    ui.hide(); root.hidden = false;
    draw();
  }

  function act(result) {
    mode = result;
    if (mode === 'fight') Arcade.audio.sfx('hit', { vol: 0.2 });
    if (mode === 'won' || mode === 'lost') return finish();
    draw();
  }

  function finish() {
    draw();
    Arcade.audio.sfx(mode === 'won' ? 'win' : 'lose');
    const wins = save.get('wins', 0) + (mode === 'won' ? 1 : 0);
    save.set('wins', wins);
    setTimeout(() => {
      root.hidden = true;
      ui.results({
        heading: mode === 'won' ? 'The realm is saved' : 'Your story ends here',
        rows: [['Hero', R.CLASSES[run.cls].name + ', level ' + run.hero.lvl], ['Lands placed', run.placed], ['Dragons slain', wins]],
        note: daily ? "That was today's realm. Everyone gets the same one." : '',
        buttons: [{ label: 'New realm', onClick: chooseClass }],
      });
    }, 900);
  }

  function draw() {
    const h = run.hero, f = run.fight, spots = mode === 'fight' ? [] : R.freeSpots(run), walks = mode === 'fight' ? [] : R.walkSpots(run);
    const spotKey = new Set(spots.map(([x, y]) => x + ',' + y)), walkKey = spots.length ? new Set() : new Set(walks.map(([x, y]) => x + ',' + y));
    let cells = '';
    for (let y = 0; y < R.SIZE; y++) for (let x = 0; x < R.SIZE; x++) {
      const t = run.board[y][x], k = x + ',' + y, here = x === run.x && y === run.y;
      const cls = ['pr-cell', t ? 'land' : '', spotKey.has(k) ? 'spot' : '', walkKey.has(k) ? 'walk' : ''].join(' ');
      const bg = t ? `background:${COLOR[t.land]}` : '';
      const label = t ? t.name : spotKey.has(k) ? 'Place here' : 'Empty';
      cells += `<button type="button" class="${cls}" style="${bg}" data-x="${x}" data-y="${y}" aria-label="${esc(label)}" ${spotKey.has(k) || walkKey.has(k) ? '' : 'tabindex="-1"'}>${t ? ICON[t.land] : ''}${t && t.special ? `<span class="sp">${SPECIAL[t.special]}</span>` : ''}${here ? `<span class="hero">${{ knight: '🛡️', ranger: '🏹', mage: '✨' }[run.cls]}</span>` : ''}</button>`;
    }
    const here = run.board[run.y][run.x];
    let panel;
    if (mode === 'fight') {
      panel = `<div class="pr-card"><h3>${esc(f.name)}</h3>
        <div class="pr-bar"><i style="width:${Math.max(0, (f.hp / f.max) * 100)}%;background:#6a040f"></i></div>
        <div class="pr-stats"><span>Health</span><b>${Math.max(0, f.hp)} / ${f.max}</b><span>Attack</span><b>${f.atk}</b></div></div>
        <div class="pr-actions">
          <button type="button" data-act="attack">Attack</button>
          <button type="button" data-act="potion" ${h.potions ? '' : 'disabled'}>Potion (${h.potions})</button>
          <button type="button" data-act="herb" ${h.herbs ? '' : 'disabled'}>Herb (${h.herbs})</button>
          ${run.cls === 'mage' ? `<button type="button" data-act="mend" ${f.mended ? 'disabled' : ''}>Mend</button>` : `<button type="button" data-act="flee" ${f.type === 'dragon' ? 'disabled' : ''}>Flee</button>`}
        </div>`;
    } else {
      const shop = mode === 'shop' ? `<div class="pr-card"><h3>${esc(here.name)}</h3><div class="pr-actions">
          <button type="button" data-buy="potion">Potion · ${R.price(run, 'potion')}g</button>
          <button type="button" data-buy="blade">Sharper blade · ${R.price(run, 'blade')}g</button>
          <button type="button" data-buy="armor">Armour · ${R.price(run, 'armor')}g</button>
          <button type="button" data-act="leave">Done</button></div></div>` : '';
      const offer = spots.length
        ? `<div class="pr-card"><h3>Your next land</h3><div class="pr-offer">${run.offer.map((l, i) => `<button type="button" data-pick="${i}" aria-pressed="${i === pick}"><span class="big">${ICON[l]}</span>${esc(R.LANDS[l].name)}</button>`).join('')}</div>
            <p style="margin:8px 0 0;font-size:.9rem;color:#6b5a7b">Then tap a dashed square next to your hero.</p></div>`
        : `<div class="pr-card"><h3>No room to build</h3><p style="margin:0">Walk to a neighbouring land to find space.</p></div>`;
      panel = shop + offer;
    }
    root.innerHTML = `<div class="pr-wrap"><div class="pr-board">${cells}</div><div class="pr-side">
      <div class="pr-card"><h3>${R.CLASSES[run.cls].name} · level ${h.lvl}</h3>
        <div class="pr-bar"><i style="width:${(Math.max(0, h.hp) / h.max) * 100}%"></i></div>
        <div class="pr-stats"><span>Health</span><b>${Math.max(0, h.hp)} / ${h.max}</b><span>Attack · Armour</span><b>${h.atk} · ${h.def}</b>
        <span>Gold</span><b>${h.gold}</b><span>Lands</span><b>${run.placed} / ${R.KEEP_AT}</b></div></div>
      ${panel}
      <div class="pr-card"><ol class="pr-log">${run.log.slice(-6).map((l) => `<li>${esc(l)}</li>`).join('')}</ol></div></div></div>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !run || run.over) return;
    if (b.dataset.pick) { pick = +b.dataset.pick; Arcade.audio.sfx('blip'); return draw(); }
    if (b.dataset.buy) { if (R.buy(run, b.dataset.buy)) Arcade.audio.sfx('coin'); else Arcade.audio.sfx('hit', { vol: 0.1 }); return draw(); }
    if (b.dataset.act === 'leave') { mode = 'calm'; return draw(); }
    if (b.dataset.act) { Arcade.audio.sfx(b.dataset.act === 'attack' ? 'thud' : 'select', { vol: 0.3 }); return act(R.round(run, b.dataset.act)); }
    if (b.dataset.x !== undefined) {
      const x = +b.dataset.x, y = +b.dataset.y;
      if (b.classList.contains('spot')) { const land = run.offer[Math.min(pick, run.offer.length - 1)]; pick = 0; Arcade.audio.sfx('select'); return act(R.place(run, land, x, y)); }
      if (b.classList.contains('walk')) return act(R.walk(run, x, y));
    }
  });

  function chooseClass(isDaily) {
    root.hidden = true;
    ui.title({
      note: isDaily === true ? "Today's realm: everyone gets the same lands." : 'Pick a hero. ' + Object.values(R.CLASSES).map((c) => c.name + ': ' + c.perk + '.').join(' '),
      buttons: [...Object.entries(R.CLASSES).map(([id, c]) => ({ label: c.name, onClick: () => start(id, isDaily === true) })),
        ...(isDaily === true ? [] : [{ label: "Today's realm", onClick: () => chooseClass(true) }])],
    });
  }
  ui.onPause(() => { if (run && !run.over && !root.hidden) { root.hidden = true; ui.pause({ onResume() { ui.hide(); root.hidden = false; }, onRestart: chooseClass }); } });

  function render() {
    ctx.fillStyle = '#2b1b3d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(201, 162, 39, .08)';
    for (let y = 0; y < H; y += 40) for (let x = (y / 40) % 2 ? 20 : 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.fill(); }
  }
  chooseClass();
  Arcade.loop({ update() {}, render }).start();
})();
