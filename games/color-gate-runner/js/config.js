// Color Gate Runner — configuration. All gameplay numbers live here.
const CFG = {
  LANES: 3,
  COOLDOWN: 1.0,        // seconds between color switches (spec)
  SPEED0: 330,          // px/s at start
  SPEED_STEP: 1.12,     // multiplier applied every SPEED_EVERY seconds (spec: speed rises every 20 s)
  SPEED_EVERY: 20,
  LIVES: 3,
  GATE_H: 60,
  WORLD_EVERY: 40,      // seconds of play between portals
  BUFFER: 0.12,
  HITSTOP: 0.08,
  SCORE_PER_GATE: 10,
  CLUTCH_WINDOW: 0.35,  // switching this close before a matching gate = CLUTCH bonus
  CLUTCH_BONUS: 25,
  PERFECT_WORLD_BONUS: 250,
  // Shop (paid with prism shards: wallet + this run's shards)
  HEADSTART_COST: 30,      // jetpack dash: fly forward at high speed over everything, once per run
  HEADSTART_SECS: 3.5,
  HEADSTART_BOOST: 5,      // scroll speed multiplier during the dash
  HEADSTART_PTS_PER_SEC: 120,
  SHIELD_COST: 50,         // one active at a time, at most 2 per run
  SHIELD_MAX_PER_RUN: 2,
  // The brief says a wrong-color collision costs a life. With false (default) the shield keeps your combo
  // and blocks one splash pad, but the life is still lost. Set true only if you accept bending that rule.
  SHIELD_SAVES_LIFE: false,
  LB_KEY: 'color-gate-runner:leaderboard_v1',
  SETTINGS_KEY: 'color-gate-runner:settings_v1',
};
// The three color slots never change. Each has a fixed shape so color is never the only cue.
const SLOTS = [
  { key:'emerald', name:'Emerald', color:'#19c46c', shape:'circle' },
  { key:'fiery',   name:'Fiery',   color:'#ff7a1a', shape:'triangle' },
  { key:'ice',     name:'Ice',     color:'#3aa8ff', shape:'square' },
];
// Worlds change art, music speed and hazard skin. Rules never change.
const WORLDS = [
  { id:'green', name:'Verdant Trail', hazard:'Spore cloud', tint:'#9fe870', dark:false },
  { id:'fire',  name:'Ember Rift',    hazard:'Heat haze',   tint:'#ff9a4a', dark:true },
  { id:'frost', name:'Glacier Chute', hazard:'Freeze fog',  tint:'#bfe6ff', dark:false },
];
const KEYS = { colors:['A','S','D'] };
