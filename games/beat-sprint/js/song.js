// The composer. A seed picks a style and writes a whole track: sections,
// chords, drums, bass, pads, arpeggios and a lead melody. The pads you land on
// are the lead melody's own notes, so the level and the song are one thing.
// Pure data in, pure data out: runs under Node as well as in the page.
(function (root) {
  const BS = root.BS;

  // Each style is a genre: tempo, scale, synths, and the drum groove underneath.
  const STYLES = [
    { name: 'Neon Drive', bpm: 112, scale: [0, 3, 5, 7, 10], root: 45, lead: 'sawtooth', bass: 'sawtooth', groove: 'four' },
    { name: 'Arcade Bounce', bpm: 128, scale: [0, 2, 4, 7, 9], root: 48, lead: 'square', bass: 'square', groove: 'four' },
    { name: 'Midnight Run', bpm: 100, scale: [0, 2, 3, 7, 8], root: 43, lead: 'triangle', bass: 'sawtooth', groove: 'four' },
    { name: 'Turbo Funk', bpm: 118, scale: [0, 3, 5, 6, 7, 10], root: 41, lead: 'square', bass: 'sawtooth', groove: 'disco' },
    { name: 'Sky Rush', bpm: 136, scale: [0, 2, 4, 5, 7, 9, 11], root: 50, lead: 'sawtooth', bass: 'square', groove: 'four' },
    { name: 'Chip Dash', bpm: 150, scale: [0, 2, 4, 7, 9], root: 48, lead: 'square', bass: 'triangle', groove: 'four' },
    { name: 'Liquid Break', bpm: 87, scale: [0, 2, 3, 5, 7, 8, 10], root: 45, lead: 'triangle', bass: 'sine', groove: 'break' },
    { name: 'Lo-Fi Cruise', bpm: 84, scale: [0, 2, 3, 5, 7, 9, 10], root: 43, lead: 'triangle', bass: 'triangle', groove: 'swing' },
    { name: 'Trap Lights', bpm: 140, scale: [0, 1, 3, 5, 7, 8, 10], root: 42, lead: 'sawtooth', bass: 'sine', groove: 'half' },
    { name: 'Disco Glitter', bpm: 120, scale: [0, 2, 4, 5, 7, 9, 10], root: 46, lead: 'square', bass: 'sawtooth', groove: 'disco' },
    { name: 'Tropic Heat', bpm: 104, scale: [0, 2, 4, 7, 9], root: 47, lead: 'triangle', bass: 'square', groove: 'latin' },
    { name: 'Hyper Gate', bpm: 142, scale: [0, 2, 3, 5, 7, 8, 11], root: 44, lead: 'sawtooth', bass: 'sawtooth', groove: 'four' },
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

  // One eighth-note step of drums. steps: eighths per bar (8 in 4/4, 6 in 3/4).
  // kind: how busy this section is. groove: the genre's feel.
  function drums(push, t, s, steps, kind, groove, lastBar, b, half, extraKick) {
    const mid = steps / 2;
    if (steps === 6) {                        // three in a bar: a waltz
      if (kind === 'light' || kind === 'break') { if (s === 0) push(t, 'kick', { v: 0.6 }); if (s % 2 === 0 && s) push(t, 'hat', { v: 0.45 }); return; }
      if (s === 0) push(t, 'kick', { v: 0.9 });
      if (s === 2 || s === 4) push(t, groove === 'soft' ? 'hat' : 'snare', { v: groove === 'soft' ? 0.7 : 0.55 });
      if (kind !== 'basic') push(t, s % 2 ? 'ohat' : 'hat', { v: 0.45 });
      if (kind === 'build' && lastBar) push(t, 'snare', { v: 0.4 + s * 0.08 });
      if (kind === 'full' && s === 0) push(t, 'clap', { v: 0.5 });
      return;
    }
    const swing = groove === 'swing' && s % 2 ? half * 0.32 : 0;
    if (kind === 'light') {
      if (s === 0 || (s === mid && groove !== 'half')) push(t, 'kick', { v: 0.8 });
      if (s % 2 === 0) push(t, 'hat', { v: groove === 'soft' ? 0.4 : 0.6 });
      return;
    }
    if (kind === 'break') {
      if (s % 2 === 0) push(t, 'hat', { v: 0.45 });
      if (s === 6 && b % 2 === 1) push(t, 'clap', { v: 0.5 });
      if (lastBar && s >= 6) push(t, 'snare', { v: 0.7 });
      return;
    }
    if (kind === 'build') {
      if (s % 2 === 0) push(t, 'kick', { v: groove === 'soft' ? 0.6 : 1 });
      if (lastBar) {
        // snare roll that speeds up into the chorus
        push(t, 'snare', { v: 0.45 + s * 0.07 });
        if (s >= 4) push(t + half / 2, 'snare', { v: 0.5 + s * 0.06 });
      } else if (s === 2 || s === 6) push(t, 'snare', { v: 1 });
      push(t + swing, 'hat', { v: 0.7 });
      return;
    }
    const full = kind === 'full';
    switch (groove) {
      case 'soft':        // brushed and gentle, for the quieter tunes
        if (s === 0 || (full && s === 4)) push(t, 'kick', { v: 0.6 });
        if (s === 2 || s === 6) push(t, 'snare', { v: full ? 0.5 : 0.32 });
        push(t, 'hat', { v: s % 2 ? 0.3 : 0.5 });
        break;
      case 'swing':       // shuffled hats over a two-step
        if (s === 0 || s === 4 || (full && s === 7)) push(t + swing, 'kick', { v: 1 });
        if (s === 2 || s === 6) { push(t, 'snare', { v: 1 }); if (full) push(t, 'clap', { v: 0.6 }); }
        push(t + swing, full && s % 2 ? 'ohat' : 'hat', { v: s % 2 ? 0.5 : 0.75 });
        break;
      case 'half':        // halftime: the snare lands on beat three
        if (s === 0 || s === 3 || (full && s === 7)) push(t, 'kick', { v: 1 });
        if (s === 4) { push(t, 'snare', { v: 1 }); if (full) push(t, 'clap', { v: 0.8 }); }
        push(t, 'hat', { v: 0.6 });
        if (full) push(t + half / 2, 'hat', { v: 0.4 });
        break;
      case 'break':       // drum and bass: kick on one and the and-of-two, sixteenth hats
        if (s === 0 || s === 3 || (full && s === 7 && b % 2)) push(t, 'kick', { v: 1 });
        if (s === 2 || s === 6) { push(t, 'snare', { v: 1 }); if (full) push(t, 'clap', { v: 0.5 }); }
        push(t, 'hat', { v: 0.6 }); push(t + half / 2, 'hat', { v: 0.35 });
        break;
      case 'disco':       // four on the floor with open hats on the offbeat
        if (s % 2 === 0) push(t, 'kick', { v: 1 });
        if (s === 2 || s === 6) { push(t, 'snare', { v: 0.9 }); push(t, 'clap', { v: 0.7 }); }
        push(t, s % 2 ? 'ohat' : 'hat', { v: s % 2 ? 0.6 : 0.5 });
        break;
      case 'latin':       // a tresillo kick, 3 + 3 + 2
        if (s === 0 || s === 3 || s === 6) push(t, 'kick', { v: 1 });
        if (s === 2 || s === 6) push(t, full ? 'clap' : 'snare', { v: 0.7 });
        push(t, s % 2 ? 'ohat' : 'hat', { v: s % 2 ? 0.45 : 0.6 });
        break;
      default:            // 'four': the original synthwave beat
        if (kind === 'basic') {
          if (s === 0 || s === 4 || (s === extraKick && b % 2 === 1)) push(t, 'kick', { v: 1 });
          if (s === 2 || s === 6) push(t, 'snare', { v: 1 });
          push(t, 'hat', { v: s % 2 ? 0.5 : 0.8 });
        } else {
          if (s % 2 === 0) push(t, 'kick', { v: 1 });
          if (s === 2 || s === 6) { push(t, 'snare', { v: 1 }); push(t, 'clap', { v: 0.8 }); }
          push(t, s % 2 ? 'ohat' : 'hat', { v: s % 2 ? 0.55 : 0.8 });
          if (lastBar && s === 7) push(t, 'kick', { v: 0.8 });
        }
    }
  }

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
          drums(push, t, s, 8, K.drums, style.groove, lastBar, b, half, extraKick);
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

  // ---------- classics: a written melody, arranged around its chords ----------
  // Same output shape as compose(), so the player, the chart and the scenery
  // need nothing new. The melody is the lead, and the pads are its notes.
  function composeClassic(def, level) {
    level = BS.clamp(level === undefined ? 1 : level, 0, LEVELS.length - 1);
    const C = BS.Classics, parts = C.bars(def), meter = def.meter, steps = meter * 2;
    const beat0 = 60 / def.bpm;
    const style = { name: def.title, bpm: def.bpm, lead: def.lead, bass: def.bass, groove: def.groove, classic: def.id };
    const rand = BS.rng(BS.hash('classic:' + def.id));
    const events = [], lead = [], sections = [];
    const push = (t, k, extra) => events.push(Object.assign({ t, k }, extra));
    const tr0 = def.transpose || 0;
    const near = (pc, lo) => { let n = lo + ((pc - lo) % 12 + 12) % 12; return n; };
    // the arrangement, bar by bar: count-in, the form, then an outro on the last chord
    const plan = [];
    const first = parts[def.form[0][0]][0].chords[0];
    plan.push({ name: 'intro', speed: def.form[0][2] || 1, tr: 0, bars: [{ notes: [], chords: [first] }, { notes: [], chords: [first] }] });
    for (const [part, name, speed, tr] of def.form) plan.push({ name, speed: speed || 1, tr: tr === undefined ? 0 : tr, bars: parts[part] });
    const lastForm = plan[plan.length - 1], lastBarDef = lastForm.bars[lastForm.bars.length - 1];
    const endChord = lastBarDef.chords[lastBarDef.chords.length - 1];
    plan.push({ name: 'outro', speed: lastForm.speed, tr: 0, bars: [{ notes: [], chords: [endChord] }, { notes: [], chords: [endChord] }] });

    let t = T0, barIndex = 0;
    for (const sec of plan) {
      const K = KINDS[sec.name], beat = beat0 / sec.speed, bar = beat * meter, half = beat / 2;
      const S = { name: sec.name, kind: K, bar0: barIndex, bars: sec.bars.length, t, end: t + bar * sec.bars.length, pal: K.pal, beat };
      sections.push(S);
      const si = sections.length - 1;
      sec.bars.forEach((B, bi) => {
        const tBar = t, lastBar = bi === sec.bars.length - 1, seg = bar / B.chords.length;
        B.chords.forEach((ch, ci) => {
          const at = tBar + ci * seg;
          // pad: the chord's tones, voiced around middle C
          push(at, 'pad', { notes: ch.tones.slice(0, 3).map((iv) => near((ch.root + iv) % 12, 55)), d: seg });
          // bass
          const root = near(ch.root, 36), fifth = root + 7;
          const n = Math.round(seg / half);
          for (let q = 0; q < n; q++) {
            const tq = at + q * half;
            if (K.bass === 'long') { if (q === 0) push(tq, 'bass', { n: root, d: seg * 0.95 }); }
            else if (K.bass === 'groove') { if (q % 2 === 0) push(tq, 'bass', { n: q % 4 === 2 ? fifth : root, d: half * 1.6 }); }
            else push(tq, 'bass', { n: root + (q % 2 ? 12 : 0), d: half * 0.8 });
          }
          // arpeggio in the busy sections
          if (K.arp) {
            const tones = ch.tones.concat([12]);
            for (let q = 0; q < n * 2; q++) push(at + (q * half) / 2, 'arp', { n: near(ch.root, 72) + tones[q % tones.length], d: half * 0.45 });
          }
        });
        for (let s = 0; s < steps; s++) drums(push, tBar + s * half, s, steps, K.drums, def.groove, lastBar, bi, half, 5);
        // the melody
        for (const note of B.notes) {
          if (note.n === null) continue;
          const n = note.n + tr0 + sec.tr;
          lead.push({ t: tBar + note.at * beat, k: 'lead', n, deg: n, d: Math.max(half * 0.6, note.d * beat * 0.92), sec: si, slot: note.at === 0 ? 0 : 1, beat });
        }
        t += bar; barIndex++;
      });
    }
    for (const n of lead) events.push(n);
    events.sort((a, b) => a.t - b.t);
    void rand;

    // the chart: melody notes, never closer than the level's gap (in the local tempo)
    const picked = [];
    let last = -9;
    for (const n of lead) if (n.t - last >= LEVELS[level].gap * n.beat - 1e-6) { picked.push(n); last = n.t; }
    const pitches = picked.map((n) => n.n).sort((a, b) => a - b);
    const q1 = pitches[Math.floor(pitches.length / 3)], q2 = pitches[Math.floor((pitches.length * 2) / 3)];
    const flat = q1 === q2;
    const chart = picked.map((n, i) => {
      const K = sections[n.sec].kind;
      const wide = n.slot === 0 && K.drums === 'full' && i > 0 && n.t - picked[i - 1].t >= beat0 * 0.99;
      return { t: n.t, lane: flat ? i % 3 : n.n < q1 ? 0 : n.n < q2 ? 1 : 2, kind: wide ? 'wide' : 'tap', n: n.n, sec: n.sec };
    });
    return { seed: BS.hash('classic:' + def.id), level, style, beat: beat0, bar: beat0 * meter, bars: barIndex, t0: T0, sections, events, chart, missRow: LEVELS[level].missRow, end: t + 1, classic: def };
  }

  // ---------- originals: named tracks, each a fixed seed in a chosen style ----------
  const ORIGINAL_NAMES = [
    'Afterglow Avenue', 'Pixel Rain', 'Static Hearts', 'Chrome Tide', 'Night Market', 'Glass Comet',
    'Velvet Circuit', 'Overpass', 'Paper Planets', 'Signal Fire', 'Low Orbit', 'Sugar Voltage',
    'Rooftop Radio', 'Mirror Lake', 'Hot Asphalt', 'Satellite Kiss', 'Lantern Bay', 'Fast Forward',
    'Ultraviolet', 'Coastline', 'Echo Chamber', 'Tangerine Sky', 'Last Train Home', 'Starlight Express',
  ];
  let originals = null;
  function originalList() {
    if (originals) return originals;
    originals = ORIGINAL_NAMES.map((name, i) => {
      const want = i % STYLES.length;
      let seed = BS.hash('beat-sprint-original:' + name) >>> 0;
      while (seed % STYLES.length !== want) seed = (seed + 1) >>> 0;
      return { id: 'orig-' + i, title: name, seed, style: STYLES[want] };
    });
    return originals;
  }

  // A track is { kind: 'seed', seed } | { kind: 'classic', id } | { kind: 'original', id }.
  function make(track, level) {
    if (track.kind === 'classic') return composeClassic(BS.Classics.byId(track.id), level);
    if (track.kind === 'original') {
      const o = originalList().find((x) => x.id === track.id), song = compose(o.seed, level);
      song.style = Object.assign({}, song.style, { name: o.title, genre: o.style.name });   // the track's own title on screen
      return song;
    }
    return compose(track.seed, level);
  }

  // Which section is playing at song time t.
  function sectionAt(song, t) {
    let cur = song.sections[0];
    for (const s of song.sections) if (t >= s.t) cur = s;
    return cur;
  }

  BS.Song = { STYLES, LEVELS, KINDS, LENGTH, compose, composeClassic, originalList, make, sectionAt };
})(typeof window !== 'undefined' ? window : globalThis);
