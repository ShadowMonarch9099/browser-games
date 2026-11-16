// Judging. A Run takes presses stamped with song time (from the audio clock)
// and decides hit, miss or stray. No drawing, no audio: runs under Node.
(function (root) {
  const BS = root.BS;
  const WINDOW = 0.13;    // a press this close to a pad's beat counts
  const PERFECT = 0.05;

  function Run(song) {
    this.song = song;
    this.notes = song.chart.map((n) => ({ t: n.t, lane: n.lane, kind: n.kind, n: n.n, sec: n.sec, res: null, err: 0 }));
    this.score = 0; this.combo = 0; this.best = 0;
    this.perfect = 0; this.good = 0; this.miss = 0; this.missRow = 0;
    this.first = 0;        // index of the first pad not judged yet
    this.failed = false; this.done = false;
  }

  // Score multiplier: +1 every 10 hits in a row, up to x8.
  Run.prototype.mult = function () { return Math.min(8, 1 + Math.floor(this.combo / 10)); };

  // lane 0..2 at song time t. Returns { type: 'hit' | 'miss' | 'stray', note, grade, err }.
  Run.prototype.press = function (lane, t) {
    if (this.failed || this.done) return { type: 'stray' };
    let target = null, wrong = null;
    for (let i = this.first; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - t >= WINDOW) break;
      if (n.res || t - n.t >= WINDOW) continue;
      // Windows of close pads overlap: prefer the pad in the lane that was pressed.
      if (n.kind === 'wide' || n.lane === lane) { if (!target || Math.abs(n.t - t) < Math.abs(target.t - t)) target = n; }
      else if (!wrong) wrong = n;
    }
    if (target) {
      const err = t - target.t;       // negative = early
      target.err = err;
      target.res = Math.abs(err) < PERFECT ? 'perfect' : 'good';
      this.combo++; this.best = Math.max(this.best, this.combo); this.missRow = 0;
      this[target.res]++;
      const gain = (target.res === 'perfect' ? 100 : 60) * this.mult();
      this.score += gain;
      return { type: 'hit', note: target, grade: target.res, err, gain };
    }
    if (wrong) { this._miss(wrong); return { type: 'miss', note: wrong, wrongLane: true }; }
    return { type: 'stray' };        // nothing nearby: no penalty
  };

  Run.prototype._miss = function (n) {
    n.res = 'miss';
    this.combo = 0; this.miss++; this.missRow++;
    if (this.missRow >= this.song.missRow) this.failed = true;
  };

  // Call every frame with the song time. Returns the pads that just slipped past.
  Run.prototype.tick = function (t) {
    const out = [];
    while (this.first < this.notes.length && (this.notes[this.first].res || t - this.notes[this.first].t > WINDOW)) {
      const n = this.notes[this.first++];
      if (!n.res && !this.failed) { this._miss(n); out.push(n); }
    }
    // pads further on can also have expired when frames are very slow
    if (!this.failed) for (let i = this.first; i < this.notes.length && this.notes[i].t < t - WINDOW; i++) {
      const n = this.notes[i];
      if (!n.res) { this._miss(n); out.push(n); if (this.failed) break; }
    }
    if (!this.failed && t >= this.song.end) this.done = true;
    return out;
  };

  Run.prototype.judged = function () { return this.perfect + this.good + this.miss; };
  Run.prototype.pct = function () {
    const total = this.notes.length || 1;
    return Math.round(((this.perfect + this.good) / total) * 100);
  };
  // S needs a clear run with nearly everything hit and mostly perfects.
  Run.prototype.grade = function () {
    if (this.failed) return 'F';
    const total = this.notes.length || 1;
    const acc = (this.perfect + this.good * 0.6) / total;
    return acc >= 0.93 ? 'S' : acc >= 0.82 ? 'A' : acc >= 0.66 ? 'B' : acc >= 0.45 ? 'C' : 'D';
  };

  BS.Run = Run;
  BS.Rules = { WINDOW, PERFECT };
})(typeof window !== 'undefined' ? window : globalThis);
