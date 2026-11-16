// The composer. A seed picks a style and writes a whole track: sections,
// chords, drums, bass, pads, arpeggios and a lead melody. The pads you land on
// are the lead melody's own notes, so the level and the song are one thing.
// Pure data in, pure data out: runs under Node as well as in the page.
(function (root) {
  const BS = root.BS;

  const STYLES = [
    { name: 'Neon Drive', bpm: 112, scale: [0, 3, 5, 7, 10], root: 45, lead: 'sawtooth', bass: 'sawtooth' },
    { name: 'Arcade Bounce', bpm: 128, scale: [0, 2, 4, 7, 9], root: 48, lead: 'square', bass: 'square' },
    { name: 'Midnight Run', bpm: 100, scale: [0, 2, 3, 7, 8], root: 43, lead: 'triangle', bass: 'sawtooth' },
    { name: 'Turbo Funk', bpm: 118, scale: [0, 3, 5, 6, 7, 10], root: 41, lead: 'square', bass: 'sawtooth' },
    { name: 'Sky Rush', bpm: 136, scale: [0, 2, 4, 5, 7, 9, 11], root: 50, lead: 'sawtooth', bass: 'square' },
  ];

  // gap: least distance between two pads, in beats. missRow: misses in a row that end the run.
  const LEVELS = [
    { name: 'Chill', gap: 1.0, missRow: 5 },
    { name: 'Standard', gap: 0.75, missRow: 3 },
    { name: 'Intense', gap: 0.5, missRow: 3 },
  ];

  // What each kind of section sounds like. pal picks the colour scheme the scenery shifts to.
  const KINDS = {
    intro: { dens: 0.3, drums: 'light', bass: 'long', arp: false, pal: 0 },
    verse: { dens: 0.46, drums: 'basic', bass: 'groove', arp: false, pal: 1 },
    build: { dens: 0.55, drums: 'build', bass: 'drive', arp: true, pal: 2 },
    chorus: { dens: 0.7, drums: 'full', bass: 'drive', arp: true, pal: 3 },
    break: { dens: 0.3, drums: 'break', bass: 'long', arp: false, pal: 4 },
    verse2: { dens: 0.56, drums: 'basic', bass: 'groove', arp: false, pal: 1 },
    chorus2: { dens: 0.8, drums: 'full', bass: 'drive', arp: true, pal: 5 },
    outro: { dens: 0.24, drums: 'light', bass: 'long', arp: false, pal: 0 },
  };
  const PLAN = [['intro', 0.1], ['verse', 0.19], ['build', 0.1], ['chorus', 0.19], ['break', 0.1], ['verse2', 0.12], ['chorus2', 0.15], ['outro', 0.05]];
  const PROGS = [[0, 0, 3, 2], [0, 2, 3, 1], [0, 3, 1, 2], [0, 1, 3, 4], [0, 4, 3, 3]];
  const STEPS = [-3, -2, -1, -1, -1, 0, 1, 1, 1, 2, 3];
  const T0 = 1.5;          // silence before bar one, so the first beat never lands on a cold start
  const LENGTH = 90;       // seconds, as in the original game

  function compose(seed, level, opts) {
    seed >>>= 0;
    level = BS.clamp(level === undefined ? 1 : level, 0, LEVELS.length - 1);
    const length = (opts && opts.length) || LENGTH;
    const style = STYLES[seed % STYLES.length];
    const rand = BS.rng(seed);
    const beat = 60 / style.bpm, bar = beat * 4, half = beat / 2;
    const bars = Math.max(4, Math.floor(length / bar));
    const len = style.scale.length;
    const sc = (i) => style.scale[((i % len) + len) % len] + 12 * Math.floor(i / len);

    // ----- sections -----
    const sections = [];
    let acc = 0;
    for (const [name, frac] of PLAN) {
      const from = bars >= 16 ? Math.round((acc * bars) / 2) * 2 : Math.round(acc * bars);
      acc += frac;
      const to = name === 'outro' ? bars : bars >= 16 ? Math.round((acc * bars) / 2) * 2 : Math.round(acc * bars);
      if (to > from) sections.push({ name, kind: KINDS[name], bar0: from, bars: to - from, t: T0 + from * bar, end: T0 + to * bar, pal: KINDS[name].pal });
    }
    const progA = rand.pick(PROGS), progB = rand.pick(PROGS);

    const events = [], lead = [];
    const push = (t, k, extra) => events.push(Object.assign({ t, k }, extra));

    for (const sec of sections) {
      const K = sec.kind;
      const prog = K.pal >= 3 && K.pal !== 4 ? progB : progA;
      // a two-bar melodic idea for this section, and a bass rhythm
      const motif = [];
      for (let i = 0; i < 16; i++) motif.push({ on: i === 0 || rand() < K.dens * (i % 2 === 0 ? 1 : 0.55), step: rand.pick(STEPS) });
      const groove = [1, 0, rand() < 0.5 ? 1 : 0, rand() < 0.4 ? 3 : 0, 1, 0, rand() < 0.6 ? 2 : 1, rand() < 0.5 ? 3 : 0];
      const extraKick = rand() < 0.5 ? 5 : 7;
      let deg = len;

      for (let b = 0; b < sec.bars; b++) {
        const barIndex = sec.bar0 + b;
        const tBar = T0 + barIndex * bar;
        const chord = prog[barIndex % 4];
        const lastBar = b === sec.bars - 1;

        // pad: a stack of every other scale tone over the chord root
        push(tBar, 'pad', { notes: [style.root + 12 + sc(chord), style.root + 12 + sc(chord + 2), style.root + 12 + sc(chord + 4)], d: bar });

        for (let s = 0; s < 8; s++) {
          const t = tBar + s * half;
          // ----- drums -----
          if (K.drums === 'light') {
            if (s === 0 || s === 4) push(t, 'kick', { v: 0.8 });
            if (s % 2 === 0) push(t, 'hat', { v: 0.6 });
          } else if (K.drums === 'basic') {
            if (s === 0 || s === 4 || (s === extraKick && b % 2 === 1)) push(t, 'kick', { v: 1 });
            if (s === 2 || s === 6) push(t, 'snare', { v: 1 });
            push(t, 'hat', { v: s % 2 ? 0.5 : 0.8 });
          } else if (K.drums === 'build') {
            if (s % 2 === 0) push(t, 'kick', { v: 1 });
            if (lastBar) {
              // snare roll that speeds up into the chorus
              push(t, 'snare', { v: 0.45 + s * 0.07 });
              if (s >= 4) push(t + half / 2, 'snare', { v: 0.5 + s * 0.06 });
            } else if (s === 2 || s === 6) push(t, 'snare', { v: 1 });
            push(t, 'hat', { v: 0.7 });
          } else if (K.drums === 'full') {
            if (s % 2 === 0) push(t, 'kick', { v: 1 });
            if (s === 2 || s === 6) { push(t, 'snare', { v: 1 }); push(t, 'clap', { v: 0.8 }); }
            push(t, s % 2 ? 'ohat' : 'hat', { v: s % 2 ? 0.55 : 0.8 });
            if (lastBar && s === 7) push(t, 'kick', { v: 0.8 });
          } else if (K.drums === 'break') {
            if (s % 2 === 0) push(t, 'hat', { v: 0.45 });
            if (s === 6 && b % 2 === 1) push(t, 'clap', { v: 0.5 });
            if (lastBar && s >= 6) push(t, 'snare', { v: 0.7 });
          }
          // ----- bass -----
          const rootNote = style.root + sc(chord);
          if (K.bass === 'long') { if (s === 0) push(t, 'bass', { n: rootNote, d: bar * 0.95 }); }
          else if (K.bass === 'groove') {
            const g = groove[s];
            if (g) push(t, 'bass', { n: rootNote + (g === 2 ? 7 : g === 3 ? 12 : 0), d: half * 0.9 });
          } else push(t, 'bass', { n: rootNote + (s % 2 ? 12 : 0), d: half * 0.8 });
          // ----- arpeggio (sixteenths) -----
          if (K.arp) {
            const tones = [chord, chord + 2, chord + 4, chord + 2 + len];
            for (let q = 0; q < 2; q++) push(t + (q * half) / 2, 'arp', { n: style.root + 24 + sc(tones[(s * 2 + q) % 4]), d: half * 0.45 });
          }
          // ----- lead -----
          if (barIndex < 2) continue;                 // two clean bars to count yourself in
          if (b % 2 === 0 && s === 0) deg = len + (((chord % len) + len) % len) - (rand() < 0.5 ? 0 : len > 5 ? 2 : 1);
          const m = motif[(b % 2) * 8 + s];
          let on = m.on;
          if (b >= 2 && rand() < 0.12) on = !on;      // small variations when the idea repeats
          if (!on) continue;
          deg += m.step;
          if (deg < 0) deg = -deg;
          if (deg > 2 * len) deg = 4 * len - deg;
          lead.push({ t, k: 'lead', n: style.root + 12 + sc(deg), deg, d: beat * 0.45, sec: sections.indexOf(sec), slot: s });
        }
      }
    }
    // each lead note rings until the next one (at most a beat)
    for (let i = 0; i < lead.length; i++) {
      const next = lead[i + 1];
      lead[i].d = Math.max(half * 0.6, Math.min(beat, next ? next.t - lead[i].t : beat) * 0.92);
      events.push(lead[i]);
    }
    events.sort((a, b) => a.t - b.t);

    // ----- the chart: pads come from lead notes, never closer than the level's gap -----
    const gap = LEVELS[level].gap * beat - 1e-6;
    const picked = [];
    let last = -9;
    for (const n of lead) if (n.t - last >= gap) { picked.push(n); last = n.t; }
    const degs = picked.map((n) => n.deg).sort((a, b) => a - b);
    const q1 = degs[Math.floor(degs.length / 3)], q2 = degs[Math.floor((degs.length * 2) / 3)];
    const flat = q1 === q2;
    const chart = picked.map((n, i) => {
      const K = sections[n.sec].kind;
      const wide = n.slot === 0 && K.drums === 'full';
      return { t: n.t, lane: flat ? i % 3 : n.deg < q1 ? 0 : n.deg < q2 ? 1 : 2, kind: wide ? 'wide' : 'tap', n: n.n, sec: n.sec };
    });

    return { seed, level, style, beat, bar, bars, t0: T0, sections, events, chart, missRow: LEVELS[level].missRow, end: T0 + bars * bar + 1 };
  }

  // Which section is playing at song time t.
  function sectionAt(song, t) {
    let cur = song.sections[0];
    for (const s of song.sections) if (t >= s.t) cur = s;
    return cur;
  }

  BS.Song = { STYLES, LEVELS, KINDS, LENGTH, compose, sectionAt };
})(typeof window !== 'undefined' ? window : globalThis);
