// Beat Sprint licensed tracks: real recordings by living artists, used under
// licenses that allow them in games. Their charts are made by listening to the
// recording (js/analyze.js), so nothing here needs notes written out.
//
// Licenses checked on the artists' own pages:
//   Kevin MacLeod: Creative Commons Attribution 4.0. The credit must be easy to
//     find; incompetech.com's FAQ suggests a Credits screen in the settings menu.
//   Ragnar Random: CC0 1.0, public domain dedication. Credit appreciated, not required.
//   Alex McCulloch (Pro Sensory): CC0 1.0. Asks to be named.
// If you add a track, add it here with its credit line, and keep the file in music/.
(function (root) {
  const BS = root.BS;
  const MACLEOD = { by: 'Kevin MacLeod', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', from: 'incompetech.com' };
  const RAGNAR = { by: 'Ragnar Random', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', from: 'ragnarrandom.itch.io/retro-game-music' };
  const ALEX = { by: 'Alex McCulloch', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', from: 'opengameart.org/content/synth-wave-by-alex' };

  const LIST = [
    Object.assign({ id: 'monkeys-spinning-monkeys', title: 'Monkeys Spinning Monkeys', file: 'music/monkeys-spinning-monkeys.mp3', genre: 'Quirky pop', diff: 0 }, MACLEOD),
    Object.assign({ id: 'fluffing-a-duck', title: 'Fluffing a Duck', file: 'music/fluffing-a-duck.mp3', genre: 'Comedy swing', diff: 0 }, MACLEOD),
    Object.assign({ id: 'sneaky-snitch', title: 'Sneaky Snitch', file: 'music/sneaky-snitch.mp3', genre: 'Cartoon caper', diff: 1 }, MACLEOD),
    Object.assign({ id: 'run-amok', title: 'Run Amok', file: 'music/run-amok.mp3', genre: 'Cartoon chase', diff: 1 }, MACLEOD),
    Object.assign({ id: 'galactic-rap', title: 'Galactic Rap', file: 'music/galactic-rap.mp3', genre: 'Hip hop', diff: 1 }, MACLEOD),
    Object.assign({ id: 'volatile-reaction', title: 'Volatile Reaction', file: 'music/volatile-reaction.mp3', genre: 'Rock', diff: 2 }, MACLEOD),
    Object.assign({ id: 'hyperfun', title: 'Hyperfun', file: 'music/hyperfun.mp3', genre: 'Electro rock', diff: 2 }, MACLEOD),
    Object.assign({ id: 'pixel-peeker-polka', title: 'Pixel Peeker Polka (faster)', file: 'music/pixel-peeker-polka.mp3', genre: 'Polka electronica', diff: 2 }, MACLEOD),
    Object.assign({ id: 'synth-wave', title: 'Synth Wave', file: 'music/synth-wave.mp3', genre: '80s synthwave', diff: 1 }, ALEX),
    Object.assign({ id: 'angry-bullfrogs', title: 'Angry Bullfrogs Riding Motorbikes', file: 'music/angry-bullfrogs.ogg', genre: 'Chiptune', diff: 1 }, RAGNAR),
    Object.assign({ id: 'planet-of-the-lobsters', title: 'Escape from the Planet of the Lobsters', file: 'music/planet-of-the-lobsters.ogg', genre: 'Chiptune', diff: 1 }, RAGNAR),
    Object.assign({ id: 'street-punks', title: 'Street Punks Fighting to Save the Princess', file: 'music/street-punks.ogg', genre: 'Chiptune brawler', diff: 2 }, RAGNAR),
    Object.assign({ id: 'samurai-eats-ninja', title: 'Samurai Eats Ninja for Breakfast', file: 'music/samurai-eats-ninja.ogg', genre: 'Chiptune', diff: 2 }, RAGNAR),
    Object.assign({ id: 'nario-versus-zonik', title: 'Nario versus Zonik', file: 'music/nario-versus-zonik.ogg', genre: 'Chiptune', diff: 2 }, RAGNAR),
  ];
  // The credit line shown on the Credits screen and in the library.
  const credit = (t) => `"${t.title}" by ${t.by} (${t.from}), ${t.license}`;

  // ---------- loading: fetch, decode, listen once, keep for the session ----------
  const cache = {};
  async function load(t, ctx, onProgress) {
    if (cache[t.id]) return cache[t.id];
    const res = await fetch(t.file);
    if (!res.ok) throw new Error('Could not load the track (' + res.status + ')');
    let data;
    const total = +res.headers.get('content-length') || 0;
    if (res.body && res.body.getReader && total) {
      const reader = res.body.getReader(), parts = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); got += value.length;
        if (onProgress) onProgress(0.8 * (got / total));
      }
      data = new Uint8Array(got);
      let at = 0;
      for (const p of parts) { data.set(p, at); at += p.length; }
      data = data.buffer;
    } else data = await res.arrayBuffer();
    if (onProgress) onProgress(0.82);
    const buffer = await new Promise((ok, bad) => {
      const p = ctx.decodeAudioData(data, ok, bad);
      if (p && p.then) p.then(ok, bad);
    }).catch(() => { throw new Error('This browser cannot play that file type'); });
    if (onProgress) onProgress(0.9);
    await new Promise((r) => setTimeout(r, 0));      // let the loading screen draw
    // mix to mono for listening
    const ch0 = buffer.getChannelData(0), mono = new Float32Array(ch0.length);
    const chans = buffer.numberOfChannels;
    for (let c = 0; c < chans; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / chans; }
    const analysis = BS.Analyze.analyze(mono, buffer.sampleRate);
    if (onProgress) onProgress(1);
    return (cache[t.id] = { buffer, analysis });
  }
  // A playable song for this level, with the decoded recording attached.
  function song(t, loaded, level) {
    const s = BS.Analyze.chart(loaded.analysis, level, { id: t.id, title: t.title, by: t.by, lead: 2 });
    s.buffer = loaded.buffer;
    return s;
  }

  BS.Licensed = { LIST, credit, load, song, get: (id) => cache[id], byId: (id) => LIST.find((t) => t.id === id) };
})(typeof window !== 'undefined' ? window : globalThis);
