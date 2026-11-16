// Pocket Realm's side panel and duel stage, drawn on the canvas as vellum
// cards. Every button drawn here is registered in `buttons` so the pointer,
// number keys and gamepad can press it.
(function () {
  const R = window.Realm, G = PR.G, COL = PR.COL, U = PR.U, B = PR.Board;
  const LAND_NOTE = (l) => {
    const L = R.LANDS[l], bits = [];
    if (l === 'keep') return 'The dragon waits inside';
    bits.push(L.foe === 0 ? 'Safe' : L.foe < 0.3 ? 'Rarely foes' : L.foe < 0.6 ? 'Often foes' : 'Dangerous');
    if (L.gold[1]) bits.push(`${L.gold[0]}-${L.gold[1]} gold`);
    if (L.heal) bits.push(`heals ${L.heal}`);
    if (L.shop) bits.push('shop');
    if (L.herb) bits.push('herbs');
    return bits.join(' · ');
  };
  const CLS_NAME = { knight: 'Knight', ranger: 'Ranger', mage: 'Mage' };

  const P = {
    buttons: [],
    button(g, x, y, w, h, label, o = {}) {
      const b = { x, y, w, h, act: o.act, arg: o.arg, enabled: o.enabled !== false, key: o.key };
      this.buttons.push(b);
      const hot = o.hover && o.hover(b), sel = o.selected;
      g.save();
      g.globalAlpha *= b.enabled ? 1 : 0.45;
      g.fillStyle = 'rgba(30,15,5,0.3)'; g.fillRect(x + 2, y + 4, w, h);
      g.fillStyle = sel ? COL.seal : hot && b.enabled ? '#fff6dc' : COL.vellum2;
      g.fillRect(x, y, w, h);
      g.strokeStyle = sel ? COL.sealDark : hot && b.enabled ? COL.gold : COL.inkSoft; g.lineWidth = hot || sel ? 2 : 1.2;
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      G.text(g, label, x + w / 2, y + h / 2 + 1, o.size || 17, sel ? COL.vellum : COL.ink, 'center', { display: true, maxWidth: w - 26 });
      if (o.key) { g.fillStyle = sel ? 'rgba(255,255,255,0.6)' : COL.faint; g.font = '12px ' + PR.CFG.BODY; g.textAlign = 'right'; g.fillText(o.key, x + w - 6, y + 12); }
      if (o.sub) G.text(g, o.sub, x + w / 2, y + h - 10, 12, sel ? COL.vellum2 : COL.inkSoft, 'center', { italic: true });
      g.restore();
      return b;
    },

    draw(g, L, S) {
      this.buttons = [];
      const run = S.run, p = L.panel, h = run.hero, t = S.time;
      const hover = (b) => S.mouse && S.mouse[0] > b.x && S.mouse[0] < b.x + b.w && S.mouse[1] > b.y && S.mouse[1] < b.y + b.h;
      const pad = 14, x = p.x, w = p.w;
      let y = p.y;
      // ---- the hero's sheet ----
      const sheetH = L.portrait ? 112 : 150;
      G.card(g, x, y, w, sheetH);
      G.text(g, `${CLS_NAME[run.cls]} · level ${h.lvl}`, x + pad, y + 22, 22, COL.seal, 'left', { display: true });
      G.text(g, S.daily ? "Today's realm" : `Lands ${run.placed} / ${R.KEEP_AT}`, x + w - pad, y + 22, 14, COL.inkSoft, 'right', { italic: true });
      const bw = L.portrait ? (w - pad * 3) / 2 : w - pad * 2;
      G.bar(g, x + pad, y + 38, bw, 14, Math.max(0, h.hp) / h.max, S.hpFlash > 0 ? '#ff6b5b' : COL.hp);
      G.text(g, `${Math.max(0, h.hp)} / ${h.max}`, x + pad + bw / 2, y + 45, 12, '#fff', 'center', { stroke: 3, strokeColor: 'rgba(0,0,0,0.5)' });
      const xpy = L.portrait ? y + 38 : y + 58, xpx = L.portrait ? x + pad * 2 + bw : x + pad;
      G.bar(g, xpx, xpy, bw, 8, h.xp / (h.lvl * 8), COL.xp);
      G.text(g, 'xp', xpx + bw + 2, xpy + 4, 11, COL.inkSoft, 'left', { italic: true });
      const sy = L.portrait ? y + 72 : y + 86;
      const stats = [['Attack', h.atk], ['Armour', h.def], ['Gold', h.gold], ['Potions', h.potions], ['Herbs', h.herbs]];
      const cw = (w - pad * 2) / stats.length;
      stats.forEach(([k, v], i) => {
        G.text(g, String(v), x + pad + cw * i + cw / 2, sy + 4, 22, k === 'Gold' && S.goldFlash > 0 ? COL.gold : COL.ink, 'center', { display: true });
        G.text(g, k, x + pad + cw * i + cw / 2, sy + 24, 12, COL.inkSoft, 'center', { italic: true });
      });
      if (!L.portrait) {
        // a ribbon showing how close the keep is
        const ry = y + 128, rw = w - pad * 2, f = Math.min(1, run.placed / R.KEEP_AT);
        g.fillStyle = 'rgba(42,29,20,0.12)'; g.fillRect(x + pad, ry, rw, 6);
        g.fillStyle = f >= 1 ? COL.seal : COL.goldDark; g.fillRect(x + pad, ry, rw * f, 6);
        G.text(g, '♜', x + pad + rw, ry + 3, 14, f >= 1 ? COL.seal : COL.faint, 'center');
      }
      y += sheetH + 10;

      // ---- what to do now ----
      const logH = L.portrait ? 92 : 128, actH = p.y + p.h - y - logH - 10;
      G.card(g, x, y, w, actH);
      const mode = S.mode, ax = x + pad, aw = w - pad * 2;
      if (mode === 'fight' && run.fight) {
        const f = run.fight;
        G.text(g, `${f.name}`, x + w / 2, y + 22, 22, COL.seal, 'center', { display: true });
        G.text(g, `Health ${Math.max(0, f.hp)} / ${f.max} · Attack ${f.atk}`, x + w / 2, y + 44, 14, COL.inkSoft, 'center', { italic: true });
        const bh = Math.min(54, (actH - 70) / 2 - 6), by = y + 60;
        const acts = [
          ['Attack', 'attack', true, '1'],
          [`Potion (${h.potions})`, 'potion', h.potions > 0, '2'],
          [`Herb (${h.herbs})`, 'herb', h.herbs > 0, '3'],
          run.cls === 'mage' ? ['Mend', 'mend', !f.mended, '4'] : ['Flee', 'flee', f.type !== 'dragon', '4'],
        ];
        acts.forEach(([label, act, en, key], i) => this.button(g, ax + (i % 2) * (aw / 2 + 4), by + Math.floor(i / 2) * (bh + 8), aw / 2 - 4, bh, label, { act: 'fight', arg: act, enabled: en && !S.busy, key, hover, selected: i === 0 && false }));
      } else if (mode === 'shop') {
        const here = run.board[run.y][run.x];
        G.text(g, here.name, x + w / 2, y + 22, 22, COL.seal, 'center', { display: true });
        G.text(g, here.special === 'witch' ? 'The witch sells potions at half price' : 'The market is open', x + w / 2, y + 44, 14, COL.inkSoft, 'center', { italic: true });
        const items = [['potion', 'Potion', 'heals 14 in a fight', '1'], ['blade', 'Sharper blade', '+2 attack', '2'], ['armor', 'Armour', '+1 armour', '3']];
        const bh = Math.min(48, (actH - 120) / 3), by = y + 58;
        items.forEach(([id, name, note, key], i) => {
          const cost = R.price(run, id);
          this.button(g, ax, by + i * (bh + 6), aw, bh, `${name} · ${cost} gold`, { act: 'buy', arg: id, enabled: h.gold >= cost, key, hover, sub: bh > 40 ? note : null, size: 16 });
        });
        this.button(g, ax, by + 3 * (bh + 6) + 4, aw, Math.min(40, bh), 'Leave the market', { act: 'leave', key: 'Enter', hover, selected: true, size: 16 });
      } else if (run.over) {
        G.text(g, run.over === 'won' ? 'The dragon falls!' : 'Your hero has fallen', x + w / 2, y + 30, 22, COL.seal, 'center', { display: true });
        G.text(g, run.over === 'won' ? 'Songs will be sung of this.' : 'The chronicle closes.', x + w / 2, y + 56, 15, COL.inkSoft, 'center', { italic: true });
      } else if (S.spots.length) {
        G.text(g, run.offer.length === 1 ? 'The keep has appeared' : 'Draw a land', x + w / 2, y + 22, 22, COL.seal, 'center', { display: true });
        const n = run.offer.length, gap = 10, cwid = Math.min(150, (aw - gap * (n - 1)) / n), chh = Math.min(actH - 80, 150);
        const sx = x + (w - (cwid * n + gap * (n - 1))) / 2;
        run.offer.forEach((land, i) => {
          const bx = sx + i * (cwid + gap), by = y + 38, sel = i === S.pick;
          const b = { x: bx, y: by, w: cwid, h: chh, act: 'pick', arg: i, enabled: true, key: String(i + 1) };
          this.buttons.push(b);
          const lift = sel ? -4 : 0;
          g.fillStyle = 'rgba(30,15,5,0.3)'; g.fillRect(bx + 2, by + 4, cwid, chh);
          g.fillStyle = sel ? '#fff6dc' : COL.vellum2; g.fillRect(bx, by + lift, cwid, chh);
          g.strokeStyle = sel ? COL.seal : hover(b) ? COL.gold : COL.inkSoft; g.lineWidth = sel ? 3 : 1.2;
          g.strokeRect(bx + 0.5, by + lift + 0.5, cwid - 1, chh - 1);
          // a little block with its diorama, slowly turning in the candlelight
          const s = Math.min(cwid * 0.36, 44), cx = bx + cwid / 2, cy = by + lift + chh * 0.48;
          const c = PR.LANDCOL[land];
          g.fillStyle = B.shade(c.side, 0.85); g.beginPath(); g.moveTo(cx - s, cy); g.lineTo(cx, cy + s / 2); g.lineTo(cx, cy + s / 2 + 8); g.lineTo(cx - s, cy + 8); g.fill();
          g.fillStyle = B.shade(c.side, 0.65); g.beginPath(); g.moveTo(cx + s, cy); g.lineTo(cx, cy + s / 2); g.lineTo(cx, cy + s / 2 + 8); g.lineTo(cx + s, cy + 8); g.fill();
          B.diamond(g, cx, cy, s, s / 2); g.fillStyle = c.top; g.fill();
          g.save(); g.translate(cx, cy); B.diorama(g, land, null, 3 + i, 5, s, t); g.restore();
          G.text(g, R.LANDS[land].name, cx, by + lift + chh - 30, 18, COL.ink, 'center', { display: true, maxWidth: cwid - 8 });
          if (S.settings.hints) G.text(g, LAND_NOTE(land), cx, by + lift + chh - 12, 11, COL.inkSoft, 'center', { italic: true, maxWidth: cwid - 6 });
          g.fillStyle = COL.faint; g.font = '12px ' + PR.CFG.BODY; g.textAlign = 'right'; g.fillText(String(i + 1), bx + cwid - 6, by + lift + 14);
        });
        G.text(g, S.device === 'touch' ? 'Then tap a glowing plot beside your hero' : 'Then click a glowing plot, or use the arrows and Enter', x + w / 2, y + 38 + chh + 20, 13, COL.inkSoft, 'center', { italic: true, maxWidth: aw });
      } else {
        G.text(g, 'No room to build', x + w / 2, y + 26, 22, COL.seal, 'center', { display: true });
        const lines = G.wrap(g, 'Walk back across a land you have placed to reach open ground. The ringed lands are in reach.', aw, 15);
        lines.forEach((l, i) => G.text(g, l, x + w / 2, y + 56 + i * 20, 15, COL.inkSoft, 'center', { italic: true }));
      }
      y += actH + 10;

      // ---- the chronicle ----
      G.card(g, x, y, w, logH);
      G.text(g, 'Chronicle', x + pad, y + 16, 14, COL.goldDark, 'left', { display: true });
      const lines = run.log.slice(L.portrait ? -3 : -5);
      lines.forEach((l, i) => {
        const last = i === lines.length - 1;
        G.text(g, l, x + pad, y + 36 + i * 18, 14, last ? COL.ink : COL.inkSoft, 'left', { italic: !last, maxWidth: w - pad * 2 });
      });
    },

    // the duel: the hero's miniature facing the foe, painted large
    stage(g, L, S) {
      const st = S.stage; if (!st) return;
      const r = L.stage, k = U.easeOut(U.clamp01(st.inT * 3)) * (1 - U.clamp01(st.outT * 2));
      if (k <= 0.01) return;
      g.save();
      g.globalAlpha = k;
      g.fillStyle = 'rgba(20,10,5,0.45)'; g.fillRect(0, 0, L.W, L.H);
      const shake = S.reduced ? 0 : st.shake * 8;
      g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake + (1 - k) * 30);
      G.card(g, r.x, r.y, r.w, r.h, { fill: '#efe2c2' });
      // a painted backdrop: the land the fight happens on
      const bg = g.createLinearGradient(0, r.y + 10, 0, r.y + r.h - 10);
      const top = PR.LANDCOL[st.land] ? PR.LANDCOL[st.land].top : '#999';
      bg.addColorStop(0, '#dcd0b0'); bg.addColorStop(0.62, '#e8dcc0'); bg.addColorStop(0.63, B.shade(top, 1)); bg.addColorStop(1, B.shade(top, 0.75));
      g.fillStyle = bg; g.fillRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20);
      g.strokeStyle = COL.inkSoft; g.strokeRect(r.x + 10.5, r.y + 10.5, r.w - 21, r.h - 21);
      const ground = r.y + r.h * 0.78;
      B.token(g, S.run.cls, r.x + r.w * 0.25, ground, 110, S.time, { hop: st.heroHop });
      B.foe(g, st.type, r.x + r.w * 0.68, ground, Math.min(r.h * 0.62, 220), S.time, { hurt: st.hurt > 0, flip: true });
      // names and health
      const bar = (cx, label, hp, max, col) => {
        G.text(g, label, cx, r.y + 34, 20, COL.ink, 'center', { display: true, stroke: 4 });
        G.bar(g, cx - 70, r.y + 48, 140, 12, Math.max(0, hp) / max, col);
      };
      bar(r.x + r.w * 0.25, CLS_NAME[S.run.cls], S.run.hero.hp, S.run.hero.max, COL.hp);
      bar(r.x + r.w * 0.68, st.name, st.hp, st.max, '#6a040f');
      if (st.outT > 0 && st.result) G.text(g, st.result, r.x + r.w / 2, r.y + r.h * 0.45, 40, COL.seal, 'center', { display: true, stroke: 6 });
      g.restore();
    },
  };
  PR.Panel = P;
})();
