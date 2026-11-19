// Updraft Avenue menus: HTML screens over the canvas. One focus ring serves
// keys and gamepads (nearest button in the pressed direction); mouse and
// touch just click. Every screen has a way back.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const M = {
    current: null, focusEl: null, onAct: null,
    init(onAct) {
      this.onAct = onAct;
      document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act],[data-set],[data-lv]');
        if (!el || el.disabled) return;
        if (el.dataset.set) this.adjust(el, 1, true, e);
        else if (el.dataset.lv) this.onAct('play-level', +el.dataset.lv);
        else this.onAct(el.dataset.act);
        el.blur();
      });
      document.addEventListener('pointerover', (e) => {
        if (e.pointerType !== 'mouse') return;
        const el = e.target.closest('[data-nav]');
        if (el && this.current && this.current.contains(el)) this.setFocus(el, true);
      });
    },
    show(id, dim) {
      $$('.screen.on').forEach((s) => s.classList.remove('on'));
      this.current = id ? $('#s-' + id) : null;
      if (!this.current) { this.setFocus(null); return; }
      this.current.classList.toggle('dim', !!dim);
      void this.current.offsetWidth;
      this.current.classList.add('on');
      this.setFocus($('[data-nav]', this.current), true);
    },
    setFocus(el, quiet) {
      if (this.focusEl) this.focusEl.classList.remove('focus');
      this.focusEl = el;
      if (el) { el.classList.add('focus'); if (!quiet) UA.Audio.play('move'); try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* old */ } }
    },
    nav(dir) {
      if (!this.current) return;
      const list = $$('[data-nav]', this.current).filter((el) => !el.disabled && el.offsetParent !== null);
      const cur = this.focusEl;
      if (!cur || !list.includes(cur)) { this.setFocus(list[0]); return; }
      if ((dir === 'left' || dir === 'right') && cur.dataset.set && this.adjust(cur, dir === 'left' ? -1 : 1)) return;
      const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      let best = null, bs = Infinity;
      for (const el of list) {
        if (el === cur) continue;
        const b = el.getBoundingClientRect(), dx = b.left + b.width / 2 - cx, dy = b.top + b.height / 2 - cy;
        const along = dx * v[0] + dy * v[1]; if (along <= 4) continue;
        const s = along + Math.abs(dx * v[1] - dy * v[0]) * 2.5;
        if (s < bs) { bs = s; best = el; }
      }
      if (best) this.setFocus(best);
    },
    confirm() { const el = this.focusEl; if (el && this.current && this.current.contains(el)) { if (el.dataset.set) this.adjust(el, 1, true); else el.click(); } },
    toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(this.tt); this.tt = setTimeout(() => t.classList.remove('on'), 1600); },
    fade(on) { $('#fade').classList.toggle('on', on); },

    // ---------- settings ----------
    defs: [],
    renderSettings(defs) {
      this.defs = defs;
      $('#set-list').innerHTML = defs.map((d) => `<button class="set-row" data-nav data-set="${d.key}"><span>${d.label}${d.note ? `<small>${d.note}</small>` : ''}</span><span class="val"></span></button>`).join('');
      this.paintSettings();
    },
    paintSettings() {
      for (const el of $$('#set-list [data-set]')) {
        const d = this.defs.find((x) => x.key === el.dataset.set), v = $('.val', el);
        if (d.type === 'slider') v.innerHTML = `<span class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < d.get() ? 'on' : ''}"></i>`).join('')}</span>`;
        else if (d.type === 'toggle') v.innerHTML = `<span class="switch ${d.get() ? 'on' : ''}"></span>`;
        else { v.textContent = d.text ? d.text() : ''; if (d.labelFn) $('span', el).firstChild.textContent = d.labelFn(); }
      }
    },
    adjust(el, delta, activate) {
      const d = this.defs.find((x) => x.key === el.dataset.set); if (!d) return false;
      if (d.type === 'slider') { const v = d.get(); d.set(activate ? (v >= 10 ? 0 : v + 1) : Math.max(0, Math.min(10, v + delta))); }
      else if (d.type === 'toggle') d.set(!d.get());
      else if (activate) d.run(); else return false;
      this.paintSettings(); UA.Audio.play('move');
      return true;
    },

  };
  UA.Menus = M;
})();
