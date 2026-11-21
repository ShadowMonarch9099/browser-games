// DOM screens: title, pause, game over, leaderboard. All overlays live in #ui.
const UI = (() => {
  const $ = s => document.querySelector(s);
  let pendingEntry = null;
  function show(id) { hideAll(); $('#ui').classList.add('on'); $(id).classList.add('on'); }
  function hideAll() { document.querySelectorAll('.screen').forEach(e => e.classList.remove('on')); $('#ui').classList.remove('on'); }
  function setWorld(w) { document.documentElement.style.setProperty('--c1', SLOTS[0].color); document.documentElement.style.setProperty('--c2', SLOTS[1].color); document.documentElement.style.setProperty('--c3', SLOTS[2].color); document.documentElement.style.setProperty('--tint', w.tint); }
  function setMute(m) { document.querySelectorAll('.mute').forEach(b => b.textContent = m ? '🔇 Sound off' : '🔊 Sound on'); }
  function showTitle() { show('#title'); const best = Leaderboard.load()[0]; $('#best').textContent = (best ? `Best in this browser: ${fmtScore(best.score)} by ${best.name}` : 'No scores yet in this browser') + `  ·  ◆ ${Wallet.get()} shards collected`; }
  function showPause() { show('#pause'); }
  function showGameOver(r) {
    show('#over'); $('#over-score').textContent = fmtScore(r.score); $('#over-meta').textContent = `Reached world ${r.worlds} (${r.world}) · best combo ×${r.combo} · ${Math.floor(r.time)}s · ◆ ${r.shards} collected, ${r.spent} spent · wallet ◆ ${r.wallet}`;
    const q = Leaderboard.qualifies(r.score); pendingEntry = q ? r : null; $('#entry').style.display = q ? '' : 'none'; $('#over-lb').innerHTML = q ? '' : renderList(Leaderboard.load(), -1);
    if (q) { const inp = $('#name'); inp.value = localStorage.getItem('color-gate-runner:name') || ''; setTimeout(() => inp.focus(), 50); }
    countUp($('#over-score'), r.score);
  }
  function countUp(el, target) { const t0 = performance.now(), d = 900; const f = now => { const k = Math.min(1, (now - t0) / d); el.textContent = fmtScore(Math.round(target * easeOut(k))); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
  function submitName() { if (!pendingEntry) return; const name = ($('#name').value.trim() || 'PLAYER').slice(0, 12).toUpperCase(); try { localStorage.setItem('color-gate-runner:name', name); } catch (e) {} const idx = Leaderboard.add({ name, score: pendingEntry.score, world: pendingEntry.worlds }); pendingEntry = null; $('#entry').style.display = 'none'; $('#over-lb').innerHTML = renderList(Leaderboard.load(), idx); Audio.sfx.milestone(); }
  function renderList(list, hi) { if (!list.length) return '<p class="muted">No scores yet. Play a run!</p>'; return '<ol class="lb">' + list.map((e, i) => `<li class="${i === hi ? 'hi' : ''}"><span class="rank">${i + 1}</span><span class="nm">${esc(e.name)}</span><span class="wd">W${e.world || 1}</span><span class="sc">${fmtScore(e.score)}</span></li>`).join('') + '</ol>'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function showLeaderboard() { show('#board'); $('#board-list').innerHTML = renderList(Leaderboard.load(), -1); $('#confirm').style.display = 'none'; $('#reset').style.display = ''; }
  function bind() {
    $('#play').onclick = () => { Audio.sfx.ui(); Game.start(); };
    $('#show-board').onclick = () => { Audio.sfx.ui(); showLeaderboard(); };
    $('#board-back').onclick = () => { Audio.sfx.ui(); Game.toTitle(); };
    $('#reset').onclick = () => { $('#reset').style.display = 'none'; $('#confirm').style.display = ''; };
    $('#reset-yes').onclick = () => { Leaderboard.reset(); showLeaderboard(); Audio.sfx.deny(); };
    $('#reset-no').onclick = () => { $('#confirm').style.display = 'none'; $('#reset').style.display = ''; };
    $('#resume').onclick = () => Game.resume(); $('#pause-quit').onclick = () => Game.toTitle();
    $('#retry').onclick = () => { if (pendingEntry) submitName(); Audio.sfx.ui(); Game.start(); };
    $('#over-home').onclick = () => { if (pendingEntry) submitName(); Game.toTitle(); };
    $('#save').onclick = submitName; $('#name').addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); e.stopPropagation(); });
    document.querySelectorAll('.mute').forEach(b => b.onclick = () => setMute(Game.toggleMute()));
    addEventListener('keydown', e => { if (Game.state === 'title' && (e.key === ' ' || e.key === 'Enter') && $('#title').classList.contains('on')) Game.start(); if (Game.state === 'gameover' && (e.key === ' ' || e.key === 'Enter') && document.activeElement !== $('#name')) { if (pendingEntry) submitName(); else Game.start(); } });
  }
  return { show, hideAll, setWorld, setMute, showTitle, showPause, showGameOver, showLeaderboard, bind };
})();
