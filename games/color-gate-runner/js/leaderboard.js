// Local leaderboard, stored in this browser's localStorage only.
const Leaderboard = {
  load() { try { return JSON.parse(localStorage.getItem(CFG.LB_KEY) || '[]'); } catch (e) { return []; } },
  save(list) { try { localStorage.setItem(CFG.LB_KEY, JSON.stringify(list)); } catch (e) {} },
  add(entry) { const list = this.load(); list.push(Object.assign({ date: Date.now() }, entry)); list.sort((a, b) => b.score - a.score || a.date - b.date); const top = list.slice(0, 10); this.save(top); return top.findIndex(e => e.date === entry.date && e.score === entry.score); },
  qualifies(score) { const l = this.load(); return score > 0 && (l.length < 10 || score > l[l.length - 1].score); },
  reset() { this.save([]); },
};

// Shard wallet: lifetime currency, stored in this browser only.
const Wallet = {
  get() { try { return +(localStorage.getItem('color-gate-runner:wallet_v1') || 0); } catch (e) { return 0; } },
  add(n) { this.set(this.get() + n); },
  set(n) { try { localStorage.setItem('color-gate-runner:wallet_v1', String(Math.max(0, Math.round(n)))); } catch (e) {} },
};
