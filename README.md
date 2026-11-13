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

- [Lot Jam](games/lot-jam/): parking puzzle with 60 checked levels, an ambulance on a deadline and sleepy drivers.
- [Pin Pickle](games/pin-pickle/): pull-the-pin puzzle with falling gold, water and lava, and 40 checked levels.
- [Pour Party](games/pour-party/): colour-sorting puzzle with mystery layers.
- [Snap Grid](games/snap-grid/): neon block puzzle with gold cells and a daily board.
- [Puck Scuffle](games/puck-scuffle/): air hockey for two on one screen, or against the computer.
- [Sky Stack](games/sky-stack/): one-tap tower stacker with changing weather and a daily tower.
- [Shadow Clone Escape](games/shadow-clone-escape/README.md): stealth puzzle with a five-second shadow clone.
