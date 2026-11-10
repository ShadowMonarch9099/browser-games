# Arcade

One website for all our browser games. Every folder in `games/` shows up on
the landing page automatically and is playable from it — no one has to edit
the homepage to add a game.

```
index.html              landing page (reads games.json, draws the cards)
play.html               player page: the game in a frame, with back + fullscreen
site/                   shared CSS / JS / favicon for those two pages
games/
  shadow-clone-escape/  one folder per game
    game.json           ← the manifest that puts it on the site
    index.html          ← the game's entry point
    thumbnail.svg
    …                   anything else the game needs
  _template/            copy this to start a new game (ignored by the site)
scripts/
  registry.mjs          scans games/*/game.json → games.json
  dev.mjs               local server (no dependencies)
.github/workflows/      check on PRs, deploy to GitHub Pages on main
```

## Run it locally

Needs Node 18+. No `npm install`.

```bash
npm run dev
```

Open <http://localhost:8765>. The game list is rebuilt on every refresh, so a
new folder appears as soon as you reload. If a `game.json` has a problem, a red
box on the landing page tells you exactly what to fix.

## Add your game

1. Copy `games/_template` to `games/<your-game>` — the folder name becomes the
   URL, so use `lowercase-with-dashes`.
2. Put your game in that folder with `index.html` as the entry point.
   **Use relative paths only** (`js/main.js`, not `/js/main.js`), since the
   game is served from `/games/<your-game>/`.
3. Fill in `game.json`:

   | Field | Required | Notes |
   | --- | --- | --- |
   | `title` | yes | |
   | `description` | yes | One or two sentences, shown on the card |
   | `authors` | | List of names |
   | `thumbnail` | | Image in your folder, 16:9 (e.g. 640×360). Without one, a cover is generated from your title and `accent` |
   | `tags` | | e.g. `["puzzle", "action"]` — become filter chips on the homepage |
   | `controls` | | Any of `keyboard`, `mouse`, `gamepad`, `touch` — shown as icons |
   | `orientation` | | `any`, `landscape` or `portrait` |
   | `accent` | | Hex colour for the card's hover glow |
   | `added` | | `YYYY-MM-DD`; games from the last 3 weeks get a NEW badge, newest first |

4. `npm run check` to validate, then open a pull request. CI re-runs the check;
   once it's merged to `main` the site redeploys with your game on it.

Games run inside an `<iframe>` on `play.html`, with fullscreen, gamepad and
audio allowed. Each game is also reachable on its own at `/games/<slug>/`.
Keep `localStorage` keys prefixed with your game's name — every game shares
the same origin.

Making your game a self-contained folder (no build step) is easiest. If your
game *does* need a build (Vite, Phaser bundles, Unity WebGL…), commit the built
output into your folder, or ask to add a build step to `deploy.yml`.

## Deploying

`.github/workflows/deploy.yml` publishes to GitHub Pages on every push to
`main`. One-time setup: **Settings → Pages → Source: GitHub Actions**.

## Games

- [Shadow Clone Escape](games/shadow-clone-escape/README.md) — stealth puzzle with a five-second shadow clone.
