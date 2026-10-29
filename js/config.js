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
  // Detection builds up while a guard can see you instead of failing on the
  // very first frame: DETECT_FAR seconds at the edge of the cone, DETECT_NEAR
  // point blank. Suspicion drains over DETECT_DECAY seconds once you're hidden.
  DETECT_FAR: 0.55,
  DETECT_NEAR: 0.15,
  DETECT_DECAY: 1.2,

  STAR_TIME_LEFT: 20,

  GROUP_COLORS: ['#4cc3f0', '#f07a5a', '#4fd1a1', '#f3c04a', '#b5d94a', '#5b8def'],
  BELL_COLOR: '#e9b949',
  ACTS: ['Outer Walls', 'Barracks', 'Inner Keep'], // every 4 levels share a look and a music style

  // On-screen touch button for the clone (logical px).
  TOUCH_CLONE: { x: 870, y: 440, r: 44, hit: 80 },
});
