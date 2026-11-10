// Shared bits for the landing page and the player page.
// Change the site name here (and in the <title> of index.html / play.html).
window.SITE = { name: 'Arcade' };

window.loadGames = async function () {
  const res = await fetch('games.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`games.json returned ${res.status}`);
  return res.json();
};

window.escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

window.initials = (title) =>
  title.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
