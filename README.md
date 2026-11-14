# Browser Games

One website for all our browser games. Every folder in `games/` shows up on
the homepage automatically and is playable from it. Nobody needs to edit the
homepage to add a game.

## ➜ Adding your game

**Read [ADDING_GAMES.md](ADDING_GAMES.md).** It covers everything step by
step: making your folder, filling in `game.json`, thumbnails, testing
locally, publishing (with git or by uploading on GitHub), rules every game
must follow, exporting from engines (Godot, Unity, Vite…), and fixes for
common problems.

In short: copy `games/_template` to `games/<your-game>/`, put your game in it
with `index.html` as the start page, fill in `game.json`, and push to `main`.

## Run the site locally

Needs [Node.js](https://nodejs.org) 18+. There is nothing to install.

```bash
npm run dev      # site at http://localhost:8765; new games appear on refresh
npm run check    # validate every games/*/game.json
npm run build    # build the deployable site into dist/ (what Vercel runs)
```

## How it fits together

```
index.html              homepage: reads games.json and draws the game cards
play.html               player page: runs a game in a frame, with back + fullscreen
site/                   shared CSS / JS / favicon for those two pages
  lib/                  the Arcade kit: shared game loop, input, sound, saving, menus
games/
  shadow-clone-escape/  one folder per game
    game.json           ← describes the game; this is what puts it on the site
    index.html          ← the game's start page
    …                   anything else the game needs
  _template/            blank starting point (ignored by the site)
  _template-canvas/     starting point for canvas games, with the Arcade kit wired up
scripts/
  registry.mjs          scans games/*/game.json, validates them, lists the games
  build.mjs             builds dist/ (site + valid games + games.json)
  dev.mjs               local server (no dependencies)
vercel.json             tells Vercel to run the build and serve dist/
.github/workflows/
  check.yml             validates games on every push to main and every PR
ADDING_GAMES.md         the contributor guide
```

`games.json` is generated, never committed. Locally the dev server
regenerates it on every request; on Vercel `scripts/build.mjs` writes it at
build time.

## Deploying on Vercel

One-time setup:

1. On [vercel.com](https://vercel.com), click **Add New → Project** and
   import `ShadowMonarch9099/browser-games` from GitHub.
2. Leave the settings as detected. `vercel.json` already sets the build
   command (`node scripts/build.mjs`), the output directory (`dist`) and
   "no framework". Click **Deploy**.

After that, every push to `main` deploys to production automatically, and
pushes to other branches get their own preview URL.

If a `game.json` is invalid, the build fails on purpose and Vercel keeps
serving the last good version. The failed build's log (and the red ✗ from
**Check games** on GitHub) says exactly what to fix.

## Games

| Game | Kind | Players |
| --- | --- | --- |
| [Shadow Clone Escape](games/shadow-clone-escape/README.md) | Stealth puzzle with a five-second shadow clone | 1 |
| [Sky Stack](games/sky-stack/) | One-tap tower stacker, weather stages, daily tower | 1 |
| [Pour Party](games/pour-party/) | Colour sort with mystery layers | 1 |
| [Snap Grid](games/snap-grid/) | Neon block puzzle, gold cells, daily board | 1 |
| [Puck Scuffle](games/puck-scuffle/) | Air hockey with power-up tokens | 1–2 |
| [Lot Jam](games/lot-jam/) | Parking puzzle, 60 checked levels | 1 |
| [Pin Pickle](games/pin-pickle/) | Pull-the-pin with falling gold, water and lava, 40 checked levels | 1 |
| [Jungle Getaway](games/jungle-getaway/) | Side-scrolling runner chased by a boulder, missions and hats | 1 |
| [Gate Stampede](games/gate-stampede/) | Crowd runner through math gates, 30 levels | 1 |
| [Courier Sprint](games/courier-sprint/) | Three-lane city runner with power-ups | 1 |
| [Bounce Tanks](games/bounce-tanks/) | Ricochet tank duel in random mazes, computer tanks | 1–4 |
| [Bonk Brawl](games/bonk-brawl/) | Platform fighter, four fighters, computer opponents | 1–4 |
| [Misfit Squad](games/misfit-squad/) | Co-op wave survival with upgrades and revives | 1–4 |
| [Tick Talk](games/tick-talk/) | Bomb defusal: one sees the bomb, the others read the [manual](games/tick-talk/manual.html) | 2–4 |
| [Paper Trail](games/paper-trail/) | One-line puzzle where you fold the page, 50 checked levels | 1 |
| [Beat Sprint](games/beat-sprint/) | Rhythm runner with generated music, daily track | 1 |
| [Borrowed Boots](games/borrowed-boots/) | Platformer: borrow creatures' abilities, 12 levels | 1 |
| [Bullet Garden](games/bullet-garden/) | Shooter where missed seeds grow into defences, 10 nights | 1 |
| [Last Lantern](games/last-lantern/) | Action RPG where lamp oil is light, health and money | 1 |
| [Pocket Realm](games/pocket-realm/) | Tile-laying RPG, three heroes, daily realm | 1 |
| [Knot Alone](games/knot-alone/) | Two climbers on one rope, 10 climbs | 2 |
| [Kitbash Rally](games/kitbash-rally/) | Build-your-kart racer, two cups | 1–2 |
