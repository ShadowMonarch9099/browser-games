// Screens and menus (HTML over the canvas). One focus system serves keyboard
// and gamepad (spatial navigation between [data-nav] elements); mouse and
// touch just click. Every screen has a back action, so Esc / B always leaves.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // Layout box ignoring CSS transforms, so navigation works mid-animation.
  function box(el) {
    let x = 0;
    let y = 0;
    for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft - (n.scrollLeft || 0); y += n.offsetTop - (n.scrollTop || 0); }
    return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
  }

  const UI = {
    current: null,
    focusEl: null,
    onAction: null,

    init(onAction) {
      this.onAction = onAction;
      document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action],[data-set],[data-level]');
        if (!el || el.disabled) return;
        el.blur();
        if (el.dataset.set) this.clickSetting(el, e);
        else if (el.dataset.level) this.onAction('play-level', +el.dataset.level, el);
        else this.onAction(el.dataset.action, null, el);
      });
      // Hovering with the mouse moves the menu focus too, so the two never disagree.
      document.addEventListener('pointerover', (e) => {
        if (e.pointerType !== 'mouse') return;
        const el = e.target.closest('[data-nav]');
        if (el && this.current && el.closest('.screen') === this.current) this.setFocus(el, true);
      });
      this.paintHowArt();
    },

    show(id, opts = {}) {
      const next = id ? $(`#s-${id}`) : null;
      $$('.screen.on').forEach((s) => { if (s !== next) s.classList.remove('on'); });
      this.current = next;
      if (!next) { this.setFocus(null); return; }
      next.classList.toggle('dim', !!opts.dim);
      // restart entrance animations
      next.classList.remove('on');
      void next.offsetWidth;
      next.classList.add('on');
      const first = (opts.focus && $(opts.focus, next)) || $('[data-nav].current', next) || $('[data-nav]', next);
      this.setFocus(first, true);
    },

    focusables() {
      if (!this.current) return [];
      return $$('[data-nav]', this.current).filter((el) => el.offsetParent !== null && !el.disabled);
    },

    setFocus(el, quiet) {
      if (this.focusEl) this.focusEl.classList.remove('focus');
      this.focusEl = el;
      if (!el) return;
      el.classList.add('focus');
      if (!quiet) PP.Audio.play('move');
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* old browsers */ }
    },

    // Spatial navigation: the nearest element in that direction, wrapping round.
    nav(dir) {
      const list = this.focusables();
      if (!list.length) return;
      const cur = list.includes(this.focusEl) ? this.focusEl : null;
      if (!cur) { this.setFocus(list[0]); return; }
      if ((dir === 'left' || dir === 'right') && cur.dataset.set && this.adjust(cur, dir === 'left' ? -1 : 1)) return;
      const c = box(cur);
      const cx = c.left + c.width / 2;
      const cy = c.top + c.height / 2;
      const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      let best = null;
      let bs = Infinity;
      for (const el of list) {
        if (el === cur) continue;
        const r = box(el);
        const dx = r.left + r.width / 2 - cx;
        const dy = r.top + r.height / 2 - cy;
        const along = dx * v[0] + dy * v[1];
        if (along <= 4) continue;
        const across = Math.abs(dx * v[1] - dy * v[0]);
        const s = along + across * 2.2;
        if (s < bs) { bs = s; best = el; }
      }
      if (!best) {
        // wrap: the furthest element on the other side, closest in line
        for (const el of list) {
          if (el === cur) continue;
          const r = box(el);
          const dx = r.left + r.width / 2 - cx;
          const dy = r.top + r.height / 2 - cy;
          const along = dx * v[0] + dy * v[1];
          const across = Math.abs(dx * v[1] - dy * v[0]);
          const s = along + across * 3;
          if (along < 0 && s < bs) { bs = s; best = el; }
        }
      }
      if (best) this.setFocus(best);
    },

    confirm() {
      const el = this.focusEl;
      if (!el || !this.current || !this.current.contains(el)) return false;
      if (el.dataset.set) { this.adjust(el, 1, true); return true; }
      el.click();
      return true;
    },

    back() {
      if (!this.current) return false;
      const b = this.current.dataset.back;
      if (!b || b === 'none') return false;
      this.onAction(b);
      return true;
    },

    toast(msg) {
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('on');
      clearTimeout(this.toastT);
      this.toastT = setTimeout(() => t.classList.remove('on'), 1800);
    },

    fade(on) { $('#fade').classList.toggle('on', on); },

    // ---------- settings ----------
    settingDefs: null,
    renderSettings(defs, values) {
      this.settingDefs = defs;
      const list = $('#set-list');
      list.innerHTML = '';
      for (const d of defs) {
        const b = document.createElement('button');
        b.className = 'set-row' + (d.danger ? ' danger' : '');
        b.dataset.nav = '';
        b.dataset.set = d.key;
        b.innerHTML = `<span>${d.label}${d.note ? `<small>${d.note}</small>` : ''}</span><span class="set-val"></span>`;
        list.appendChild(b);
      }
      this.paintSettings(values);
    },
    paintSettings(values) {
      for (const el of $$('#set-list [data-set]')) {
        const d = this.settingDefs.find((x) => x.key === el.dataset.set);
        const box = $('.set-val', el);
        if (d.type === 'slider') {
          const v = values[d.key];
          box.innerHTML = `<span class="fizz">${Array.from({ length: 10 }, (_, i) => `<i data-v="${i + 1}" class="${i < v ? 'on' : ''}"></i>`).join('')}</span>`;
        } else if (d.type === 'toggle') {
          box.innerHTML = `<span class="tap ${d.get() ? 'on' : ''}"></span>`;
        } else box.textContent = d.text ? d.text() : '';
        if (d.type === 'action') $('span', el).firstChild.textContent = d.label === undefined ? '' : (d.labelFn ? d.labelFn() : d.label);
      }
    },
    clickSetting(el, e) {
      const d = this.settingDefs.find((x) => x.key === el.dataset.set);
      const dot = e.target.closest('[data-v]');
      if (d.type === 'slider' && dot) d.set(+dot.dataset.v === d.get() ? 0 : +dot.dataset.v);
      else this.adjust(el, 1, true);
      this.setFocus(el, true);
    },
    adjust(el, delta, activate) {
      const d = this.settingDefs && this.settingDefs.find((x) => x.key === el.dataset.set);
      if (!d) return false;
      if (d.type === 'slider') {
        const v = d.get();
        const nv = activate ? (v >= 10 ? 0 : v + 1) : Math.max(0, Math.min(10, v + delta));
        if (nv !== v) d.set(nv);
        return true;
      }
      if (d.type === 'toggle') { d.set(!d.get()); return true; }
      if (activate && d.type === 'action') { d.run(); return true; }
      return false;
    },

    // ---------- level select ----------
    renderLevels(page, info) {
      const grid = $('#lv-grid');
      grid.innerHTML = '';
      const per = 20;
      const first = page * per + 1;
      $('#lv-page').textContent = `Levels ${first} – ${first + per - 1}`;
      $('#lv-stars').textContent = `${info.total} ★`;
      for (let lv = first; lv < first + per; lv++) {
        const b = document.createElement('button');
        const rec = info.best[lv];
        const open = lv <= info.unlocked;
        b.className = 'coaster' + (open ? '' : ' locked') + (lv === info.current ? ' current' : '');
        b.style.animationDelay = `${(lv - first) * 0.018}s`;
        if (open) {
          b.dataset.nav = '';
          b.dataset.level = lv;
          const s = rec ? rec.stars : 0;
          b.innerHTML = `${lv}<small>${'★'.repeat(s)}<b>${'★'.repeat(3 - s)}</b></small>`;
          b.setAttribute('aria-label', `Level ${lv}, ${s} stars`);
        } else {
          b.disabled = true;
          b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10Zm2 0h6V7a3 3 0 0 0-6 0Z"/></svg>';
          b.setAttribute('aria-label', `Level ${lv}, locked`);
        }
        grid.appendChild(b);
      }
      $('[data-action="page-prev"]').disabled = page === 0;
      $('[data-action="page-next"]').disabled = first + per > info.unlocked + per;
    },

    // ---------- how to play ----------
    renderKeys() {
      const rows = [
        ['', 'Mouse / touch', 'Keyboard', 'Gamepad'],
        ['Pick up / pour', 'Tap a glass, then another (or drag)', '← → ↑ ↓ then Enter · or 1–9, 0', 'D-pad then A'],
        ['Put it back down', 'Tap it again', 'Enter on it again', 'A on it, or B'],
        ['Undo', 'Undo button', 'U, Z or Backspace', 'X'],
        ['Hint', 'Hint button', 'H', 'Y'],
        ['Restart', 'Restart button', 'R', 'Select / View'],
        ['Pause', 'Pause button', 'Esc or P', 'Start / Menu'],
      ];
      $('#how-keys').innerHTML = rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('');
    },

    paintHowArt() {
      const glass = (x, layers, opts = {}) => {
        const r = layers.map((c, i) => `<rect x="${x + 3}" y="${72 - (i + 1) * 14}" width="22" height="14" fill="${c}"/>`).join('');
        return `<g transform="${opts.t || ''}">${r}<path d="M${x} 10v60q0 6 6 6h16q6 0 6-6V10" fill="none" stroke="#3b1d2a" stroke-width="2.5" stroke-linejoin="round"/></g>`;
      };
      const svg = (body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 92'>${body}</svg>`)}")`;
      const C = ['#f0384f', '#ffab1a', '#3a8dff', '#3fd68c'];
      $('.art-pick').style.backgroundImage = svg(glass(30, [C[0], C[1], C[1]], { t: 'translate(0 -10)' }) + glass(82, [C[2], C[0]]) + `<path d="M44 4l0 -2" stroke="#e8344e"/>`);
      $('.art-pour').style.backgroundImage = svg(glass(20, [C[2], C[1]], { t: 'rotate(55 48 10) translate(0 -6)' }) + `<path d="M96 14 q2 18 0 40" stroke="${C[1]}" stroke-width="5" fill="none" stroke-linecap="round"/>` + glass(82, [C[1]]));
      $('.art-done').style.backgroundImage = svg(glass(30, [C[0], C[0], C[0], C[0]]) + glass(82, [C[3], C[3], C[3], C[3]]) + `<path d="M50 50 L64 0" stroke="#fff" stroke-width="4"/><path d="M50 50 L64 0" stroke="#e8344e" stroke-width="4" stroke-dasharray="4 4"/>`);
    },
  };

  PP.UI = UI;
})();
