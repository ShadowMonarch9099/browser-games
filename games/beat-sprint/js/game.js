// Beat Sprint: states, menus and the run itself.
//
// States: title, setlist, settings, howto, calibrate, play, paused, results.
// Settings / how-to return to whichever screen opened them.
//
// Timing: the song is scheduled on the audio clock (audio.js). A press is
// stamped with that clock when the key/tap event fired, converted to song
// time, then corrected by the player's calibrated offset before judging.
(function () {
  const BS = window.BS;
  const A = BS.Audio, I = BS.Input, S = BS.Scene, Song = BS.Song;

  const SECTION_NAMES = { intro: 'INTRO', verse: 'VERSE', build: 'BUILD-UP', chorus: 'THE DROP', break: 'BREAKDOWN', verse2: 'VERSE II', chorus2: 'OVERDRIVE', outro: 'OUTRO' };
  const SPEEDS = [0.75, 0.9, 1, 1.15, 1.3, 1.5];
  const BASE_V = 13;          // highway speed in road units per second at 1x
  const MENU_STATES = new Set(['title', 'setlist', 'settings', 'howto', 'calibrate', 'paused', 'results']);

  const pad2 = (n) => String(n).padStart(2, '0');
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const trackCode = (seed) => '#' + (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(-5);

  const G = {
    state: 'title', stateT: 0, focus: 0, back: null, backStack: [], fade: 1, time: 0,
    buttons: [], toastMsg: null, confirmReset: false,
    save: null, s: null,
    mode: 'free', seed: 0, song: null, run: null, phase: null, phaseT: 0, sec: null, heldAt: 0,
    result: null, cal: null,
    demo: { notes: [], next: 0, pal: 0, palBar: -1 },
    vt: 0, look: null,

    init() {
      this.save = BS.Save.load();
      this.s = this.save.settings;
      A.setVolumes(this.s.sfx, this.s.music);
      this.setState('title', true);
    },

    // ---------- flow ----------
    setState(state, fade) {
      this.state = state; this.stateT = 0; this.focus = 0; this.confirmReset = false;
      if (fade) this.fade = 1;
      // menu music only when no track is loaded (paused tracks stay quiet)
      if (MENU_STATES.has(state) && state !== 'calibrate' && !this.song) A.startMenu();
      else A.stopMenu();
    },
    // Sub-screens stack: settings -> calibrate -> back to settings -> back to where settings came from.
    openSub(state) {
      this.backStack.push({ state: this.state, focus: this.focus });
      this.back = this.backStack[this.backStack.length - 1];
      this.setState(state); A.sfx('ok');
    },
    closeSub() {
      const b = this.backStack.pop() || { state: 'title', focus: 0 };
      this.back = this.backStack[this.backStack.length - 1] || null;
      this.setState(b.state); this.focus = b.focus;
      A.sfx('back');
    },
    goTitle() { this.endSong(); this.clearStack(); this.setState('title', true); },
    clearStack() { this.backStack = []; this.back = null; },
    goSetlist() { this.endSong(); this.clearStack(); this.setState('setlist', true); this.focus = 1; },
    endSong() { A.stopSong(0.3); this.song = null; this.run = null; S.power = 1; },

    persist() { A.setVolumes(this.s.sfx, this.s.music); BS.Save.store(); },
    toast(str) { this.toastMsg = { str, life: 1.8 }; },

    // ---------- starting a track ----------
    dailySeed() { return BS.dailySeed(); },
    newSeed() { return BS.hash(String(Math.random()) + Date.now()) >>> 0; },
    start(mode, seed) {
      A.unlock();
      this.mode = mode; this.seed = seed >>> 0;
      this.song = Song.compose(this.seed, this.s.level);
      this.run = new BS.Run(this.song);
      this.save.last = { seed: this.seed, mode };
      this.save.plays++;
      BS.Save.store();
      A.stopMenu();
      A.startSong(this.song, 0, 0.35);
      this.sec = null; this.phase = 'live'; this.phaseT = 0; this.countBeat = -1;
      this.result = null; this.lastCombo = 0;
      S.power = 1; S.parts.length = 0; S.pops.length = 0; S.banner = null; S.podTarget = 0;
      S.setPalette(this.song.sections[0].pal, true);
      I.clear();
      this.clearStack();
      this.setState('play', true);
    },
    restart() { this.start(this.mode, this.seed); },

    pause() {
      if (this.state !== 'play' || this.phase === 'fail' || this.phase === 'end') return;
      A.holdSong();
      this.heldAt = A.heldAt - this.s.offset / 1000;
      this.setState('paused');
      A.sfx('back');
    },
    resume() {
      // Rewind two beats and count back in over two more, so you can find the groove.
      const b = this.song.beat;
      A.resumeSong(b * 2, b * 2);
      this.phase = 'resume'; this.phaseT = 0;
      this.setState('play');
      I.clear();
    },

    // ---------- menus ----------
    menu() {
      const s = this.s;
      const slider = (key, label, max) => ({
        label, slider: () => s[key], max: max || 10,
        adjust: (d) => { s[key] = BS.clamp(s[key] + d, 0, max || 10); this.persist(); A.sfx('tick', s[key]); },
      });
      const toggle = (key, label, get) => ({
        label, value: () => ((get ? get() : s[key]) ? 'ON' : 'OFF'),
        adjust: () => { s[key] = !(get ? get() : s[key]); this.persist(); A.sfx('toggle', s[key]); },
      });
      switch (this.state) {
        case 'title': return {
          items: [
            { label: 'PLAY', sub: 'Pick a track and a level', action: () => { A.sfx('ok'); this.goSetlist(); } },
            { label: 'DAILY TRACK', sub: "Today's song, the same for everyone", action: () => { A.sfx('go'); this.start('daily', this.dailySeed()); } },
            { label: 'SETTINGS', action: () => this.openSub('settings') },
            { label: 'HOW TO PLAY', action: () => this.openSub('howto') },
          ],
        };
        case 'setlist': {
          const L = Song.LEVELS, lv = s.level;
          const dkey = BS.today();
          if (!this.dailyPreview || this.dailyPreview.key !== dkey) this.dailyPreview = { key: dkey, song: Song.compose(this.dailySeed(), 1, { length: 8 }) };
          const dailySong = this.dailyPreview.song;
          const today = this.save.daily[BS.today() + ':' + lv];
          const bestNew = this.save.best['random:' + lv];
          const items = [
            {
              label: 'LEVEL', choice: () => L[lv].name.toUpperCase(), wide: true,
              note: () => ['Pads at least a beat apart. Five misses in a row allowed.', 'Pads at least 3/4 of a beat apart. Three misses in a row end the run.', 'Pads as close as half a beat. Three misses in a row end the run.'][s.level],
              adjust: (d) => { s.level = (s.level + d + L.length) % L.length; this.persist(); A.sfx('tick', s.level * 3); },
            },
            { label: 'DAILY TRACK', card: true, sub: `${BS.today()}  ·  ${dailySong.style.name}  ·  ${dailySong.style.bpm} BPM`, best: today ? fmt(today) : '—', action: () => { A.sfx('go'); this.start('daily', this.dailySeed()); } },
            { label: 'NEW TRACK', card: true, sub: 'A fresh seed: new song, new chart', best: bestNew ? fmt(bestNew.score) + '  ' + bestNew.grade : '—', action: () => { A.sfx('go'); this.start('free', this.newSeed()); } },
          ];
          const last = this.save.last;
          if (last && last.mode !== 'daily') {
            const st = Song.STYLES[last.seed % Song.STYLES.length];
            items.push({ label: 'REPLAY LAST', card: true, sub: `Track ${trackCode(last.seed)}  ·  ${st.name}  ·  ${st.bpm} BPM`, action: () => { A.sfx('go'); this.start('free', last.seed); } });
          }
          items.push({ label: 'BACK', action: () => { A.sfx('back'); this.setState('title', true); this.focus = 0; } });
          return { items, back: () => { A.sfx('back'); this.setState('title', true); } };
        }
        case 'settings': {
          const P = BS.Platform;
          const items = [
            slider('sfx', 'SOUND EFFECTS'),
            slider('music', 'MUSIC'),
            {
              label: 'NOTE SPEED', choice: () => SPEEDS[s.speed !== undefined ? BS.clamp(SPEEDS.indexOf(s.speed) < 0 ? 2 : SPEEDS.indexOf(s.speed), 0, 5) : 2].toFixed(2) + 'x',
              adjust: (d) => { let i = SPEEDS.indexOf(s.speed); if (i < 0) i = 2; s.speed = SPEEDS[BS.clamp(i + d, 0, SPEEDS.length - 1)]; this.persist(); A.sfx('tick', i + d); },
            },
            {
              label: 'TIMING OFFSET', choice: () => (s.offset > 0 ? '+' : '') + s.offset + ' ms',
              adjust: (d) => { s.offset = BS.clamp(s.offset + d * 5, -200, 300); this.persist(); A.sfx('tick', s.offset / 20); },
            },
            { label: 'CALIBRATE TIMING', action: () => this.openCalibrate() },
            toggle('hints', 'LANE KEY HINTS'),
            toggle('symbols', 'LANE SYMBOLS', () => s.symbols !== false),
            toggle('shake', 'SCREEN SHAKE'),
            toggle('flash', 'BEAT FLASHES'),
          ];
          if (P.canFullscreen()) items.push({ label: 'FULLSCREEN', value: () => (P.isFullscreen() ? 'ON' : 'OFF'), adjust: () => { P.toggleFullscreen(); A.sfx('toggle', !P.isFullscreen()); } });
          if (this.back && this.back.state === 'title') items.push({
            label: this.confirmReset ? 'PRESS AGAIN TO ERASE' : 'RESET SCORES', danger: true,
            action: () => {
              if (this.confirmReset) { this.save.best = {}; this.save.daily = {}; this.save.last = null; BS.Save.store(); this.confirmReset = false; this.toast('Scores erased'); A.sfx('back'); }
              else { this.confirmReset = true; A.sfx('nav'); }
            },
          });
          items.push({ label: 'BACK', action: () => this.closeSub() });
          return { items, back: () => this.closeSub() };
        }
        case 'howto': return { items: [{ label: 'BACK', action: () => this.closeSub() }], back: () => this.closeSub() };
        case 'calibrate': {
          const c = this.cal;
          const items = [];
          if (c && c.done && c.result !== null) items.push({ label: 'KEEP ' + (c.result > 0 ? '+' : '') + c.result + ' MS', action: () => { this.s.offset = c.result; this.persist(); this.toast('Timing offset saved'); this.closeSub(); } });
          items.push({ label: c && c.done ? 'TRY AGAIN' : 'RESTART', action: () => this.calStart() });
          items.push({ label: 'BACK', action: () => this.closeSub() });
          return { items, back: () => this.closeSub() };
        }
        case 'paused': return {
          items: [
            { label: 'RESUME', action: () => { A.sfx('ok'); this.resume(); } },
            { label: 'RESTART TRACK', action: () => { A.sfx('ok'); this.restart(); } },
            { label: 'SETTINGS', action: () => this.openSub('settings') },
            { label: 'HOW TO PLAY', action: () => this.openSub('howto') },
            { label: 'QUIT TO SETLIST', action: () => { A.sfx('back'); this.goSetlist(); } },
          ],
          back: () => { A.sfx('ok'); this.resume(); },
        };
        case 'results': return {
          items: [
            { label: 'RETRY', sub: 'Same track', action: () => { A.sfx('go'); this.restart(); } },
            { label: 'NEW TRACK', action: () => { A.sfx('go'); this.start('free', this.newSeed()); } },
            { label: 'SETLIST', action: () => { A.sfx('back'); this.goSetlist(); } },
            { label: 'MAIN MENU', action: () => { A.sfx('back'); this.goTitle(); } },
          ],
          back: () => { A.sfx('back'); this.goSetlist(); },
        };
      }
      return { items: [] };
    },

    activate(it) {
      if (!it) return;
      if (it.action) it.action();
      else if (it.adjust) it.adjust(1);
    },

    handleMenuInput(events) {
      const m = this.menu(), items = m.items;
      const n = items.length;
      if (!n) return;
      if (this.focus >= n) this.focus = n - 1;
      // After an action the screen may change: hand the rest of this frame's
      // presses to the next frame instead of dropping them.
      const defer = (i) => { if (i + 1 < events.length) I.queue.unshift(...events.slice(i + 1)); };
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.type === 'tap') {
          const b = this.hitButton(e.x, e.y);
          if (b) {
            if (b.focus !== undefined) this.focus = b.focus;
            b.action();
            return defer(i);
          }
          continue;
        }
        const nav = I.NAV[e.code];
        if (!nav) continue;
        const it = items[this.focus];
        if (nav === 'up') { this.focus = (this.focus - 1 + n) % n; A.sfx('nav'); }
        else if (nav === 'down') { this.focus = (this.focus + 1) % n; A.sfx('nav'); }
        else if ((nav === 'left' || nav === 'right') && it && it.adjust && (it.slider || it.choice || it.value)) it.adjust(nav === 'left' ? -1 : 1);
        else if (nav === 'ok') { this.activate(it); return defer(i); }
        else if (nav === 'back' && m.back) { m.back(); return defer(i); }
        else if (nav === 'restart' && (this.state === 'results' || this.state === 'paused')) { A.sfx('go'); this.restart(); return defer(i); }
        else if (nav === 'mute') this.toggleMute();
      }
    },
    toggleMute() {
      if (this.s.sfx + this.s.music > 0) { this.s._mute = [this.s.sfx, this.s.music]; this.s.sfx = 0; this.s.music = 0; this.toast('Sound off'); }
      else { const m = this.s._mute || [7, 8]; this.s.sfx = m[0]; this.s.music = m[1]; this.toast('Sound on'); }
      this.persist();
    },

    // Buttons are registered by the UI each frame in its own (scaled) units.
    hitButton(x, y) {
      const k = BS.UI.k;
      const vx = x / k, vy = y / k;
      for (let i = this.buttons.length - 1; i >= 0; i--) {
        const b = this.buttons[i];
        if (vx >= b.x && vx <= b.x + b.w && vy >= b.y && vy <= b.y + b.h) return b;
      }
      return null;
    },

    // ---------- calibration ----------
    openCalibrate() { this.openSub('calibrate'); this.calStart(); },
    calStart() {
      A.unlock();
      const beat = 0.6;
      this.cal = { start: A.now() + 0.9, beat, count: 18, sched: 0, taps: [], done: false, result: null, flash: 0, lastTap: -1 };
      this.focus = 0;
    },
    calTap(t) {
      const c = this.cal;
      if (!c || c.done) return;
      const k = Math.round((t - c.start) / c.beat);
      if (k < 2 || k >= c.count) return;
      const err = t - (c.start + k * c.beat);
      if (Math.abs(err) > 0.3) return;
      c.taps.push(err); c.lastTap = this.time;
      A.sfx('tick', 4);
      if (c.taps.length >= 10) this.calFinish();
    },
    calFinish() {
      const c = this.cal;
      c.done = true;
      if (c.taps.length < 5) { c.result = null; return; }
      const sorted = c.taps.slice().sort((a, b) => a - b), mid = sorted[Math.floor(sorted.length / 2)];
      c.result = BS.clamp(Math.round((mid * 1000) / 5) * 5, -200, 300);
      const spread = sorted[sorted.length - 2] - sorted[1];
      c.steady = spread < 0.09;
      A.sfx('ok');
    },
    calUpdate() {
      const c = this.cal;
      if (!c) return;
      const now = A.now();
      while (c.sched < c.count && c.start + c.sched * c.beat < now + 0.2) { A.clickAt(c.start + c.sched * c.beat, c.sched % 4 === 0); c.sched++; }
      if (!c.done && now > c.start + c.count * c.beat + 0.3) this.calFinish();
    },

    // ---------- per frame ----------
    update(dt) {
      this.time += dt; this.stateT += dt;
      this.fade = Math.max(0, this.fade - dt * 2.6);
      if (this.toastMsg) { this.toastMsg.life -= dt; if (this.toastMsg.life <= 0) this.toastMsg = null; }
      const events = I.drain();

      if (this.state === 'play') this.updatePlay(dt, events);
      else {
        if (this.state === 'calibrate') {
          this.calUpdate();
          const c = this.cal;
          // any key or tap off the menu buttons counts as a tap along
          const rest = [];
          for (const e of events) {
            const nav = e.type === 'key' ? I.NAV[e.code] : null;
            const onButton = e.type === 'tap' && this.hitButton(e.x, e.y);
            if (c && !c.done && !onButton && nav !== 'back' && nav !== 'up' && nav !== 'down') this.calTap(e.t);
            else rest.push(e);
          }
          this.handleMenuInput(rest);
        } else this.handleMenuInput(events);
      }
      for (const e of events) if (e.type === 'key' && I.NAV[e.code] === 'fullscreen' && this.state !== 'play') BS.Platform.toggleFullscreen();
      this.updateScene(dt);
    },

    laneOf(e) {
      if (e.type === 'tap') {
        const W = S.W;
        return e.x < W / 3 ? 0 : e.x < (W * 2) / 3 ? 1 : 2;
      }
      const l = I.LANE[e.code];
      if (l === 'cur') return BS.clamp(Math.round(S.podTarget + 1), 0, 2);
      return l === undefined ? null : l;
    },

    updatePlay(dt, events) {
      const run = this.run, song = this.song, off = this.s.offset / 1000;
      this.phaseT += dt;
      const t = A.songTime() - off;

      for (const e of events) {
        if (e.type === 'key' && I.PAUSE[e.code]) { this.pause(); return; }
        if (e.type === 'tap') {
          const b = this.hitButton(e.x, e.y);
          if (b) { b.action(); return; }
          if (e.y < 56 * BS.UI.k) continue;     // the top bar is for the HUD
        }
        if (this.phase === 'fail' || this.phase === 'end') continue;
        const lane = this.laneOf(e);
        if (lane === null) continue;
        S.pressLane(lane);
        if (this.phase === 'resume' && t < this.heldAt - 0.25) continue;
        const pt = e.t - A.songStart - off;
        const r = run.press(lane, pt);
        if (r.type === 'hit') {
          S.hit(lane, r.grade, r.note.kind === 'wide');
          A.sfx('hit', { n: r.note.n, perfect: r.grade === 'perfect' });
          if (r.grade === 'perfect') S.addShake(0.12);
          if (run.combo > 0 && run.combo % 25 === 0) { S.comboFx(run.combo); A.sfx('combo', Math.min(4, run.combo / 25)); }
        } else if (r.type === 'miss') this.onMiss(r.note);
        else A.sfx('tick', lane * 2);
      }

      if (this.phase === 'live' || this.phase === 'resume') {
        if (this.phase === 'resume' && t >= this.heldAt) this.phase = 'live';
        const missed = run.tick(t);
        for (const n of missed) this.onMiss(n);
        // count-in on the four beats before the first bar with pads
        const beatIdx = Math.floor((t - song.t0) / song.beat);
        if (this.phase === 'live' && beatIdx >= 4 && beatIdx <= 7 && beatIdx !== this.countBeat) { this.countBeat = beatIdx; A.sfx(beatIdx === 7 ? 'go' : 'count'); }
        if (run.failed) {
          this.phase = 'fail'; this.phaseT = 0; this.failAt = t;
          A.powerDown(); A.sfx('fail');
          S.addShake(0.8);
        } else if (run.done) {
          this.phase = 'end'; this.phaseT = 0;
          A.stopSong(1.5); A.sfx('clear');
        }
      }
      if (this.phase === 'fail' && this.phaseT > 1.8) this.finish(false);
      if (this.phase === 'end' && this.phaseT > 1.4) this.finish(true);
    },
    onMiss(note) {
      S.missFx(note.kind === 'wide' ? -1 : note.lane);
      A.sfx('miss'); A.duck();
      S.addShake(0.35);
    },

    finish(cleared) {
      const run = this.run, lv = this.s.level;
      const grade = run.grade(), pct = run.pct();
      let best = 0, newBest = false;
      if (this.mode === 'daily') {
        const key = BS.today() + ':' + lv;
        best = this.save.daily[key] || 0;
        newBest = run.score > best;
        if (newBest) this.save.daily[key] = run.score;
      } else {
        const key = 'random:' + lv, rec = this.save.best[key];
        best = rec ? rec.score : 0;
        newBest = run.score > best;
        if (newBest) this.save.best[key] = { score: run.score, grade, pct };
      }
      BS.Save.store();
      this.result = { cleared, grade, pct, score: run.score, best: Math.max(best, run.score), newBest: newBest && run.score > 0, perfect: run.perfect, good: run.good, miss: run.miss, combo: run.best, total: run.notes.length, level: lv, style: this.song.style.name, bpm: this.song.style.bpm, mode: this.mode, code: trackCode(this.seed) };
      A.stopSong(0.2);
      this.song = null;
      S.power = 1;
      this.setState('results', true);
      A.sfx(cleared ? 'grade' : 'back');
    },

    // ---------- the scene's clock and contents ----------
    updateScene(dt) {
      let o;
      if (this.song && (this.state === 'play' || this.state === 'paused' || this.backStack.some((b) => b.state === 'paused'))) o = this.playView(dt);
      else o = this.demoView(dt);
      o.shakeOn = this.s.shake;
      o.flashOn = this.s.flash;
      o.speedZ = BASE_V * (this.s.speed || 1);
      S.step(dt, o);
      this.look = o;
    },

    beatInfo(o, t, t0, beat) {
      const bp = (t - t0) / beat;
      o.beatPos = ((bp % 1) + 1) % 1;
      const barPos = (((bp / 4) % 1) + 1) % 1;
      o.pulse = Math.exp(-o.beatPos * 5);
      o.bar = Math.exp(-barPos * 4 * 4) * (t >= t0 ? 1 : 0);
    },

    playView() {
      const song = this.song, run = this.run, off = this.s.offset / 1000;
      let t = A.songTime() - off;
      if (this.phase === 'fail') t = this.failAt + 0.5 * (1 - Math.exp(-this.phaseT * 2.5));
      const o = { t, beat: song.beat, t0: song.t0, notes: run.notes, firstVisible: Math.max(0, run.first - 4) };
      this.beatInfo(o, t, song.t0, song.beat);
      // section: palette and banner
      const sec = Song.sectionAt(song, t);
      if (sec !== this.sec) {
        const first = !this.sec;
        this.sec = sec;
        S.setPalette(sec.pal, first);
        if (!first && this.phase === 'live') S.sectionFx(SECTION_NAMES[sec.name] || sec.name.toUpperCase());
      }
      o.intense = sec.name === 'chorus' || sec.name === 'chorus2';
      o.failing = this.phase === 'fail';
      // how soon the next pad reaches each lane (for the approach rings)
      const next = [null, null, null];
      for (let i = run.first; i < run.notes.length; i++) {
        const n = run.notes[i];
        if (n.res) continue;
        const d = n.t - t;
        if (d > song.beat * 2) break;
        if (n.kind === 'wide') { for (let l = 0; l < 3; l++) if (next[l] === null) next[l] = d; }
        else if (next[n.lane] === null) next[n.lane] = d;
      }
      o.nextIn = next;
      o.hints = this.s.hints && this.state === 'play';
      o.glyphs = I.GLYPH.lanes[I.device];
      o.laneLook = this.s.symbols !== false;
      return o;
    },

    // The attract mode behind the menus: the ship plays itself, locked to the menu music.
    demoView(dt) {
      const d = this.demo, beat = A.MENU_BEAT;
      const t = A.menuOn && A.running() && A.menuBeat0 ? A.now() - A.menuBeat0 : this.time;
      if (d.next < t - 2 || d.next > t + 30) { d.next = Math.ceil(t / beat) * beat; d.notes = []; }
      while (d.next < t + 4) {
        const i = Math.round(d.next / beat);
        const h = BS.hash('demo' + i);
        if (i % 2 === 0 || h % 3 === 0) d.notes.push({ t: d.next, lane: h % 3, kind: i % 16 === 0 ? 'wide' : 'tap', res: null });
        if (h % 5 === 0) d.notes.push({ t: d.next + beat / 2, lane: (h >>> 3) % 3, kind: 'tap', res: null });
        d.next += beat;
      }
      d.notes.sort((a, b) => a.t - b.t);
      for (const n of d.notes) if (!n.res && n.t <= t) {
        n.res = 'perfect';
        const lane = n.kind === 'wide' ? Math.round(S.podTarget + 1) : n.lane;
        S.pressLane(lane); S.hit(lane, BS.hash('g' + n.t) % 4 ? 'perfect' : 'good', n.kind === 'wide', true);
      }
      d.notes = d.notes.filter((n) => n.t > t - 1);
      // drift through the palettes every eight bars
      const barN = Math.floor(t / (beat * 4));
      if (barN !== d.palBar) { d.palBar = barN; if (barN % 8 === 0) S.setPalette(Math.floor(barN / 8) % BS.PALS.length); }
      const o = { t, beat, t0: 0, notes: d.notes, demo: true };
      this.beatInfo(o, t, 0, beat);
      o.intense = false;
      o.nextIn = null;
      o.laneLook = this.s.symbols !== false;
      return o;
    },
  };

  BS.Game = G;
  BS.fmt = fmt;
  BS.trackCode = trackCode;
  BS.SPEEDS = SPEEDS;
  BS.SECTION_NAMES = SECTION_NAMES;
  BS.pad2 = pad2;
})();
