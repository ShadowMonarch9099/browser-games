// Beat Sprint's ear: turns a recording into a chart. Nobody wrote these
// tracks' notes down for us, so we listen for them instead:
//   1. split the sound into low, mid and high bands and measure how sharply
//      each one gets louder, frame by frame (an "onset envelope"),
//   2. find the tempo and where the beats fall,
//   3. put pads on the eighth-note slots with the strongest hits, choosing the
//      lane by which band the hit lives in (kick left, snare middle, hats right).
// Pure functions of the samples, so tools/test-song.js can check them on a
// synthetic drum track in Node.
(function (root) {
  const BS = root.BS;
  const SR = 11025, HOP = 128, N = 512;          // analysis rate, frame hop, FFT size
  const FPS = SR / HOP;                          // ~86 frames per second

  // ---------- FFT (radix 2, in place) ----------
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }

  // Average down to SR (good enough for finding hits; we never play this back).
  function downsample(samples, rate) {
    const k = rate / SR, out = new Float32Array(Math.floor(samples.length / k));
    for (let i = 0; i < out.length; i++) {
      const a = Math.floor(i * k), b = Math.max(a + 1, Math.floor((i + 1) * k));
      let s = 0;
      for (let j = a; j < b && j < samples.length; j++) s += samples[j];
      out[i] = s / (b - a);
    }
    return out;
  }

  const BANDS = [[2, 10], [10, 90], [90, 230]];   // FFT bins: ~40-215 Hz, 215-1900 Hz, 1.9-5 kHz

  // samples: mono Float32Array at `rate`. Returns everything the chart needs.
  function analyze(samples, rate) {
    const x = downsample(samples, rate);
    const frames = Math.max(1, Math.floor((x.length - N) / HOP));
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    const re = new Float32Array(N), im = new Float32Array(N);
    const prev = [new Float32Array(N / 2), new Float32Array(N / 2), new Float32Array(N / 2)];
    const flux = [new Float32Array(frames), new Float32Array(frames), new Float32Array(frames)];
    const rms = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let e = 0;
      for (let i = 0; i < N; i++) { const v = x[f * HOP + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
      rms[f] = Math.sqrt(e / N);
      fft(re, im);
      BANDS.forEach(([lo, hi], b) => {
        let s = 0;
        const p = prev[b];
        for (let k = lo; k < hi; k++) {
          const m = Math.log(1 + 40 * Math.hypot(re[k], im[k]));
          const d = m - p[k];
          if (d > 0) s += d;
          p[k] = m;
        }
        flux[b][f] = s / (hi - lo);
      });
    }
    // each band on the same scale, then one combined envelope (kick weighted up a little)
    const norm = flux.map((fl) => {
      const sorted = Array.from(fl).sort((a, b) => a - b), top = sorted[Math.floor(sorted.length * 0.98)] || 1;
      return fl.map((v) => Math.min(2, v / (top || 1)));
    });
    const env = new Float32Array(frames);
    for (let f = 0; f < frames; f++) env[f] = norm[0][f] * 1.3 + norm[1][f] + norm[2][f] * 0.8;
    const { bpm, phase } = tempo(env);
    return { bpm, beat: 60 / bpm, phase: refinePhase(x, 60 / bpm, phase), env, bands: norm, rms, fps: FPS, duration: samples.length / rate };
  }

  // value of the envelope at a fractional frame, peak-picked over a small window
  function peakAt(env, f, reach) {
    let best = 0;
    for (let i = Math.round(f - reach); i <= Math.round(f + reach); i++) if (i >= 0 && i < env.length && env[i] > best) best = env[i];
    return best;
  }
  // How well a beat grid (period and offset in frames) lines up with the hits.
  function gridScore(env, period, off) {
    let s = 0, n = 0;
    for (let f = off; f < env.length; f += period) { s += peakAt(env, f, 1); n++; }
    return n ? s / n : 0;
  }
  function tempo(env) {
    // 1. autocorrelation of the envelope over 70-180 BPM, with a soft preference near 120
    const lo = Math.floor((60 * FPS) / 180), hi = Math.ceil((60 * FPS) / 70);
    const mean = env.reduce((a, b) => a + b, 0) / env.length;
    const c = Float32Array.from(env, (v) => v - mean);
    const ac = (lag) => { let s = 0; for (let i = lag; i < c.length; i++) s += c[i] * c[i - lag]; return s / (c.length - lag); };
    let bestLag = lo, bestScore = -Infinity;
    for (let lag = lo; lag <= hi; lag++) {
      const bpm = (60 * FPS) / lag;
      const prefer = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
      const s = (ac(lag) + 0.5 * ac(lag * 2)) * prefer;
      if (s > bestScore) { bestScore = s; bestLag = lag; }
    }
    // 2. fine search around it: the tempo and offset whose grid hits the most onsets
    let best = { score: -1, period: bestLag, off: 0 };
    for (let p = bestLag * 0.97; p <= bestLag * 1.03; p += 0.02) {
      for (let off = 0; off < p; off += 1) {
        const s = gridScore(env, p, off);
        if (s > best.score) best = { score: s, period: p, off };
      }
    }
    for (let off = best.off - 1; off <= best.off + 1; off += 0.1) {
      const s = gridScore(env, best.period, Math.max(0, off));
      if (s > best.score) best = { score: s, period: best.period, off: Math.max(0, off) };
    }
    let bpm = (60 * FPS) / best.period;
    return { bpm, phase: best.off / FPS };
  }

  // The spectral frames are ~12 ms apart and blur an attack by a few frames, so
  // line the grid up again on a much finer loudness envelope (~3 ms steps).
  function refinePhase(x, beat, phase) {
    const H = 32, n = Math.floor(x.length / H), e = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < H; j++) { const v = x[i * H + j]; s += v * v; } e[i] = Math.sqrt(s / H); }
    const d = new Float32Array(n);
    for (let i = 2; i < n; i++) d[i] = Math.max(0, e[i] - e[i - 2]);
    const step = H / SR;
    let best = phase, bestS = -1;
    for (let o = -0.08; o <= 0.08; o += step) {
      const ph = phase + o;
      if (ph < 0) continue;
      let sc = 0;
      for (let t = ph; t < x.length / SR; t += beat) { const i = Math.round(t / step); if (i < n) sc += d[i] + 0.5 * (d[i + 1] || 0); }
      if (sc > bestS) { bestS = sc; best = ph; }
    }
    return best;
  }

  // ---------- from an analysis to a playable song ----------
  // meta: { id, title, by, lead }   lead: seconds of silence before the recording
  function chart(an, level, meta) {
    const L = BS.Song.LEVELS[level], K = BS.Song.KINDS;
    const lead = meta.lead || 2, beat = an.beat, bar = beat * 4, fps = an.fps;
    const t0 = lead + an.phase;
    const total = Math.floor((an.duration - an.phase) / beat);
    const frameAt = (t) => (t - lead) * fps;
    // ----- sections: 8-bar blocks named by how loud they are -----
    const barRms = [];
    for (let b = 0; b * 4 < total; b++) {
      let s = 0, n = 0;
      for (let f = Math.floor(frameAt(t0 + b * bar)); f < frameAt(t0 + (b + 1) * bar) && f < an.rms.length; f++) { s += an.rms[f]; n++; }
      barRms.push(n ? s / n : 0);
    }
    const bars = barRms.length, blocks = [];
    for (let b = 0; b < bars; b += 8) blocks.push(barRms.slice(b, b + 8).reduce((a, v) => a + v, 0) / Math.min(8, bars - b));
    const sortedB = blocks.slice().sort((a, b) => a - b), q = (p) => sortedB[Math.min(sortedB.length - 1, Math.floor(p * sortedB.length))];
    let loud = 0;
    const sections = blocks.map((e, i) => {
      let name = e >= q(0.7) ? (loud++ % 2 ? 'chorus2' : 'chorus') : e <= q(0.25) ? 'break' : i > 0 && blocks[i + 1] !== undefined && blocks[i + 1] >= q(0.7) ? 'build' : i > blocks.length / 2 ? 'verse2' : 'verse';
      if (i === 0) name = 'intro';
      if (i === blocks.length - 1 && blocks.length > 2) name = 'outro';
      const b0 = i * 8, nb = Math.min(8, bars - b0);
      return { name, kind: K[name], bar0: b0, bars: nb, t: t0 + b0 * bar, end: t0 + (b0 + nb) * bar, pal: K[name].pal, beat };
    });
    if (sections.length) sections[0].t = 0;
    // ----- pads: the strongest eighth-note slots -----
    const slots = [];
    for (let i = 0; i < total * 2; i++) {
      const t = t0 + (i * beat) / 2, f = frameAt(t);
      if (f >= an.env.length - 2) break;
      const s = peakAt(an.env, f, 2), bandS = an.bands.map((bd) => peakAt(bd, f, 2));
      slots.push({ t, s: s * (i % 2 ? 0.8 : 1) * (i % 8 === 0 ? 1.15 : 1), bandS, i });
    }
    // a slot counts if it stands out from the music around it (about four seconds either side)
    const reach = Math.round(4 / (beat / 2));
    const picked = [];
    let last = -9;
    // fast recordings would crowd the easy levels, so also keep a floor in seconds
    const gap = Math.max(L.gap * beat, [0.55, 0.36, 0.2][level]) - 1e-6;
    for (let k = 0; k < slots.length; k++) {
      const sl = slots[k];
      if (sl.t < t0 + 2 * bar) continue;                 // two bars to count yourself in
      let sum = 0, n = 0;
      for (let j = Math.max(0, k - reach); j < Math.min(slots.length, k + reach); j++) { sum += slots[j].s; n++; }
      const local = sum / n;
      const bar_ = [0.95, 0.8, 0.65][level];          // how far above the local level a hit must be
      if (sl.s < 0.25 || sl.s < local * bar_) continue;
      if (sl.t - last < gap) continue;
      picked.push(sl); last = sl.t;
    }
    // lanes: the band the hit stands out in most (each band measured against its
    // own usual level), nudged so one lane never hogs a long run
    const bandMean = [0, 1, 2].map((b) => picked.reduce((a, sl) => a + sl.bandS[b], 0) / Math.max(1, picked.length) || 1);
    let run = 0, prevLane = -1;
    const NOTE = [64, 69, 76];
    const notes = picked.map((sl, i) => {
      const order = [0, 1, 2].sort((a, b) => sl.bandS[b] / bandMean[b] - sl.bandS[a] / bandMean[a]);
      let lane = order[0];
      if (lane === prevLane && run >= 3) lane = order[1];
      run = lane === prevLane ? run + 1 : 1; prevLane = lane;
      const secI = Math.max(0, sections.findIndex((s) => sl.t >= s.t && sl.t < s.end));
      const wide = sl.i % 8 === 0 && sections[secI] && sections[secI].kind.drums === 'full' && sl.bandS[0] > 0.8 && i > 0 && sl.t - picked[i - 1].t >= beat * 0.99;
      return { t: sl.t, lane, kind: wide ? 'wide' : 'tap', n: NOTE[lane], sec: secI };
    });
    const style = { name: meta.title, bpm: Math.round(an.bpm), lead: 'square', bass: 'sawtooth', genre: meta.by, licensed: meta.id };
    return { seed: BS.hash('licensed:' + meta.id), level, style, beat, bar, bars, t0, sections, events: [], chart: notes, missRow: L.missRow, end: lead + an.duration, lead, licensed: meta };
  }

  BS.Analyze = { analyze, chart, tempo, fft, FPS, SR };
})(typeof window !== 'undefined' ? window : globalThis);
