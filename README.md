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

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / Arrow keys | Left stick / D-pad | Drag anywhere (floating stick) |
| Cast shadow, then swap control | **Space** (or C) | A | **SHADOW** button |
| Show the level hint | H | B | HINT button (top bar) |
| Restart level | R | Y | Pause menu |
| Pause | Esc / P | Start | ❚❚ button |
| Mute | M | — | Settings |

Casting hands you control of the shadow. Press the clone key again to swap
back to yourself — the shadow stays exactly where you left it, so it can hold
a plate while you walk away. Press it again to retake the shadow.

On-screen prompts switch to match whichever device you used last. Phones play
in landscape (a rotate prompt shows in portrait); Settings has a fullscreen
toggle.

## Rules (from the game brief)

| Brief | In the game |
| --- | --- |
| One temporary shadow clone | Space casts a clone at your position |
| Only one clone at a time | While a clone exists, Space swaps control instead of casting; 1 s cooldown after it fades |
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
- **Detection** builds up over a moment while a guard can see you (faster up close) — break line of sight to shake it off. Bumping into a guard is instant.
- **Patrol guards** walk a route; **sentries** sweep their vision cone; **hounds** sleep until you get close, then chase you.
- **Stars:** finish the level, collect all 3 shards, finish with 20 s or more left.

The 60-second clock starts on your first WASD/arrow or clone-key press, not
when the level loads. Each level's tip stays hidden until you ask for it with
the HINT button.

## Levels

Twelve levels in three acts, each with its own look and music style (every
level also gets its own melody):

| Act | Levels | Look |
| --- | --- | --- |
| I — Outer Walls | Breach, The Tether, Empty Hands, Bell Tower | cold flagstones, mossy ramparts |
| II — Barracks | Two as One, Mess Hall, Clockwork, Kennels | timber floors, crates and barrels |
| III — Inner Keep | Double Lock, Watchtower, Gauntlet, Final Escape | polished stone, red carpets |

Guards appear from Level 1. In **Bell Tower**, **Mess Hall** and
**Watchtower** the exit is watched by sentries that never leave their post —
the only way through is to have your shadow ring a bell (always behind a
grate, so only the shadow can reach it) and slip past while they investigate.
Guards respond to a bell only if it is within 400px and they can walk to
within 2 tiles of it.

Progress (unlocked levels, stars, best times) and settings (volumes, screen
shake, tutorial prompts) are saved in `localStorage`.

## Project layout

```
index.html            canvas + script tags (classic scripts, so file:// works)
css/style.css
js/config.js          every tuning constant, including the brief's rules
js/levels.js          the 12 level maps
js/level.js           map parsing, collision, line of sight, pathfinding
js/entities.js        player, clone, guards
js/game.js            state machine and simulation
js/render.js          world drawing + shared drawing helpers (SCE.Gfx)
js/ui.js              HUD, menus, results screens, prompts, touch controls
js/input.js           keyboard / mouse / touch / gamepad
js/audio.js           synthesized WebAudio effects + per-level generative music
js/save.js            localStorage progress and settings
tools/validate-levels.js   static checks for level data
tools/test-rules.js        headless checks of every rule + scripted playthroughs
```

## Development

```bash
node tools/validate-levels.js
node tools/test-rules.js
```

`test-rules.js` runs the real game code headlessly. It checks every rule in the
brief and plays through all 12 levels with scripted inputs. Run both after editing levels or
mechanics.

### Editing levels

Each map is 16 rows of 30 tiles, written as `"10|10|10"` chunks. The outer wall
is added automatically. See the legend at the top of `js/level.js` — besides
walls, grates, doors and plates it has props (`X` crate, `B` barrel, `O`
pillar: solid, block sight) and `,` carpet. Guard
coordinates use the same grid: `[column 0-29, row 1-16]`.
