// Arcade kit: title, pause and results screens. The kit supplies the layout
// and behaviour; each game supplies its own look through `theme`, so no two
// games (or the site itself) need to look alike. Needs ui.css next to it.
//
//   const ui = Arcade.ui.create({
//     title: 'My Game',
//     tagline: 'One line about it.',
//     how: [['Space / Tap', 'Jump'], ['Esc', 'Pause']],
//     theme: {
//       fonts: 'family=Fredoka:wght@500;700',      // Google Fonts query (optional)
//       display: '"Fredoka", sans-serif',          // headings and buttons
//       body: '"Fredoka", sans-serif',
//       overlay: 'rgba(0, 40, 60, .6)',            // tint over the game
//       panel: '#fff', panel2: '#eef3f7', edge: '#d5dde5',
//       text: '#16324a', muted: '#5f7688',
//       accent: '#ff7a59', accentInk: '#fff',
//       radius: '22px', border: '0px',
//       shadow: '0 20px 50px rgba(0,0,0,.25)', buttonShadow: 'none',
//       caps: 'none',                              // or 'uppercase'
//     },
//   });
//   ui.title({ buttons: [{ label: 'Play', onClick: start }] });
//   ui.pause({ onResume, onRestart });
//   ui.results({ heading: 'Game over', rows: [['Score', 12], ['Best', 30]], buttons: [...] });
//   ui.hide();
//   ui.toast('Wind picks up!');
//   ui.onPause(fn);        // Esc, P, gamepad Start, or the on-screen pause button
window.Arcade = window.Arcade || {};

(function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Loads the game's own fonts from Google Fonts. query is the part after
  // "css2?", e.g. 'family=Fredoka:wght@500;700'. Falls back to system fonts offline.
  function loadFonts(query) {
    if (!query || document.querySelector('link[data-arc-fonts]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.arcFonts = '1';
    link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
    document.head.appendChild(link);
  }
  const kebab = (k) => k.replace(/[A-Z0-9]/g, (c) => '-' + c.toLowerCase());

  Arcade.ui = {
    create({ title, tagline = '', how = [], theme = {}, parent = document.body }) {
      loadFonts(theme.fonts);
      const root = document.createElement('div');
      root.className = 'arc-ui';
      // Each theme key becomes a CSS variable: accentInk -> --arc-accent-ink.
      for (const [k, v] of Object.entries(theme)) {
        if (k !== 'fonts') root.style.setProperty('--arc-' + kebab(k), v);
      }
      root.innerHTML = `
        <div class="arc-corner">
          <button type="button" class="arc-icon" data-act="pause" aria-label="Pause" hidden>❚❚</button>
          <button type="button" class="arc-icon" data-act="mute" aria-label="Mute sound"></button>
        </div>
        <div class="arc-toast" role="status" hidden></div>
        <div class="arc-screen" hidden><div class="arc-card"></div></div>`;
      parent.appendChild(root);

      const screen = root.querySelector('.arc-screen');
      const card = root.querySelector('.arc-card');
      const toastEl = root.querySelector('.arc-toast');
      const muteBtn = root.querySelector('[data-act="mute"]');
      const pauseBtn = root.querySelector('[data-act="pause"]');
      let pauseHandler = null, toastTimer = 0, handlers = [];

      const paintMute = () => { muteBtn.textContent = Arcade.audio && Arcade.audio.muted ? '🔇' : '🔊'; };
      paintMute();
      muteBtn.addEventListener('click', () => { if (Arcade.audio) Arcade.audio.toggleMute(); paintMute(); muteBtn.blur(); });
      pauseBtn.addEventListener('click', () => { pauseBtn.blur(); if (pauseHandler && screen.hidden) pauseHandler(); });

      const howHtml = how.length
        ? `<dl class="arc-how">${how.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
        : '';

      function show(html, buttons) {
        handlers = buttons.map((b) => b.onClick);
        card.innerHTML = html + `<div class="arc-buttons">${buttons.map((b, i) =>
          `<button type="button" class="arc-btn${i === 0 ? ' arc-primary' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>`;
        screen.hidden = false;
        card.querySelector('.arc-btn').focus();
      }
      card.addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (!b) return;
        if (Arcade.audio) Arcade.audio.sfx('select');
        handlers[+b.dataset.i]();
      });

      // Up / down (keys or gamepad) move between buttons; gamepad A presses one.
      function moveFocus(step) {
        const btns = [...card.querySelectorAll('.arc-btn')];
        const at = btns.indexOf(document.activeElement);
        btns[(at + step + btns.length) % btns.length].focus();
      }
      addEventListener('keydown', (e) => {
        if (screen.hidden) {
          if ((e.code === 'Escape' || e.code === 'KeyP') && pauseHandler && !e.repeat) pauseHandler();
          return;
        }
        if (e.code === 'ArrowDown' || e.code === 'ArrowRight') { e.preventDefault(); moveFocus(1); }
        if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') { e.preventDefault(); moveFocus(-1); }
      });
      let padPrev = {};
      (function pollPad() {
        requestAnimationFrame(pollPad);
        const p = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean);
        if (!p) return;
        const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
        const now = { a: b(0), up: b(12) || p.axes[1] < -0.5, down: b(13) || p.axes[1] > 0.5, start: b(9) };
        const hit = (k) => now[k] && !padPrev[k];
        if (!screen.hidden) {
          if (hit('down')) moveFocus(1);
          if (hit('up')) moveFocus(-1);
          if (hit('a') && document.activeElement.classList.contains('arc-btn')) document.activeElement.click();
        } else if (hit('start') && pauseHandler) pauseHandler();
        padPrev = now;
      })();

      return {
        get visible() { return !screen.hidden; },
        title({ buttons, note = '' }) {
          show(`<h1>${esc(title)}</h1>${tagline ? `<p class="arc-tagline">${esc(tagline)}</p>` : ''}${howHtml}${note ? `<p class="arc-note">${esc(note)}</p>` : ''}`, buttons);
        },
        pause({ onResume, onRestart }) {
          show(`<h2>Paused</h2>${howHtml}`, [{ label: 'Resume', onClick: onResume }, { label: 'Restart', onClick: onRestart }]);
        },
        results({ heading, rows = [], note = '', buttons }) {
          show(`<h2>${esc(heading)}</h2>
            <table class="arc-rows">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
            ${note ? `<p class="arc-note">${esc(note)}</p>` : ''}`, buttons);
        },
        hide() {
          screen.hidden = true;
          if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
        },
        toast(text, ms = 1800) {
          toastEl.textContent = text;
          toastEl.hidden = false;
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
        },
        onPause(fn) { pauseHandler = fn; pauseBtn.hidden = false; },
      };
    },
  };
})();
