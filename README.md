# Shadow Clone Escape

A top-down stealth-puzzle game that runs entirely in the browser. Cast a
temporary shadow clone to hold switches, ring bells and slip through grates —
then escape each level of the fortress before 60 seconds run out.

No build step, no dependencies, no server required.

## Play

Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari).

Or serve the folder (handy for phones on the same network):

```bash
python -m http.server 8765
```

then visit <http://localhost:8765>.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD / Arrow keys | Drag on the left half |
| Cast clone | Tap **Space** (or C) | Tap the right half |
| Steer clone | Hold **Space** + move | Hold right half + drag left half |
| Restart level | R | — |
| Pause | Esc / P | ⏸ button |
| Mute | M | — |

## Rules (from the game brief)

| Brief | In the game |
| --- | --- |
| One temporary shadow clone | Space casts a clone at your position |
| Only one clone at a time | While a clone exists, Space steers it instead of casting; 1 s cooldown after it fades |
| Lasts 5 seconds | Countdown ring around the clone; it flickers in its last second |
| Stays within 100px of creation | Dashed leash circle; the clone can never cross it |
| Activates switches | Plates, timed plates, levers and bells all respond to the clone |
| Cannot collect items | Keys and shards pass straight through it ("Shadows can't grab!") |
| Enemies ignore it | Guards and hounds never see, chase or react to the clone |
| Distract enemies | Done *indirectly*: the clone rings bells that lure guards, and holds gates that seal hounds in |
| Doors needing player + clone on two switches | Twin-lock doors (⧉) latch open once both plates are pressed together |
| Finish each level in 60 seconds | Timer per level; at 0 the level fails |
| Move + clone key | Exactly that — everything else is menu keys |

## Mechanics

- **Grates** block you and guards, but your shadow slips through. Guards can see through them.
- **Hold plates** open their door only while pressed. Doors never close on anyone standing in them.
- **Timed plates** keep their door open for 2 s after release.
- **Levers** toggle on contact and stay flipped.
- **Bells** pull nearby guards over to investigate for 3 s.
- **Locked doors** use up one key.
- **Patrol guards** walk a route; **sentries** sweep their vision cone; **hounds** sleep until you get close, then chase you.
- **Stars:** finish the level, collect all 3 shards, finish with 20 s or more left.

Progress (unlocked levels, stars, best times) is saved in `localStorage`.

## Project layout

```
index.html            canvas + script tags (classic scripts, so file:// works)
css/style.css
js/config.js          every tuning constant, including the brief's rules
js/levels.js          the 12 level maps
js/level.js           map parsing, collision, line of sight, pathfinding
js/entities.js        player, clone, guards
js/game.js            state machine and simulation
js/render.js          all drawing (world, HUD, menus)
js/input.js           keyboard / mouse / touch
js/audio.js           synthesized WebAudio sound effects
js/save.js            localStorage progress
tools/validate-levels.js   static checks for level data
tools/test-rules.js        headless checks of every rule + scripted playthroughs
```

## Development

```bash
node tools/validate-levels.js
node tools/test-rules.js
```

`test-rules.js` runs the real game code headlessly. It checks every rule in the
brief and plays through 11 of the 12 levels with scripted inputs; Level 1 is a
movement tutorial with no mechanics to test. Run both after editing levels or
mechanics.

### Editing levels

Each map is 16 rows of 30 tiles, written as `"10|10|10"` chunks. The outer wall
is added automatically. See the legend at the top of `js/level.js`. Guard
coordinates use the same grid: `[column 0-29, row 1-16]`.
