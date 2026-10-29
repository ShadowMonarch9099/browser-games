// Global namespace + tuning constants. Every rule from the game brief lives here.
window.SCE = window.SCE || {};

SCE.CFG = Object.freeze({
  // Logical resolution: the canvas is scaled to fit the window, so 100px is
  // always 100 game pixels regardless of screen size.
  W: 960,
  H: 540,
  TILE: 30,
  COLS: 32,
  ROWS: 18,
  STEP: 1 / 60, // fixed simulation timestep

  LEVEL_TIME: 60, // brief: finish each level in 60 seconds

  PLAYER_SPEED: 150,
  CLONE_SPEED: 150,
  HALF: 10, // half-size of the player/clone hitbox

  CLONE_LIFETIME: 5, // brief: clone lasts 5 seconds
  CLONE_LEASH: 100, // brief: clone stays within 100px of where it was cast
  CLONE_COOLDOWN: 1,

  TIMED_PLATE_HOLD: 2,

  GUARD_SPEED: 70,
  GUARD_TURN: 5, // rad/s
  VIEW_RANGE: 150,
  VIEW_HALF: (35 * Math.PI) / 180,
  HOUND_SPEED: 115,
  HOUND_WAKE: 170,
  BELL_RADIUS: 400,
  BELL_REACH: 2, // tiles: guards ignore bells they can't get near
  BELL_WAIT: 3,
  CATCH_DIST: 20,

  STAR_TIME_LEFT: 20,

  GROUP_COLORS: ['#38bdf8', '#f472b6', '#34d399', '#fb923c', '#a3e635', '#e879f9'],
  BELL_COLOR: '#facc15',
});
