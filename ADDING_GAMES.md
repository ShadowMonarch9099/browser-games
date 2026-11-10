# Adding a game

This guide walks you through putting your game on the site, start to finish.
You don't need to touch the homepage or any site code: **one folder in
`games/` is all it takes.** When that folder lands on the `main` branch,
Vercel rebuilds the site and your game appears on the homepage, playable.

- [The short version](#the-short-version)
- [1. Get the repo](#1-get-the-repo)
- [2. Create your game folder](#2-create-your-game-folder)
- [3. Put your game in it](#3-put-your-game-in-it)
- [4. Fill in game.json](#4-fill-in-gamejson)
- [5. Add a thumbnail](#5-add-a-thumbnail)
- [6. Test it locally](#6-test-it-locally)
- [7. Publish it](#7-publish-it)
- [Updating or removing your game](#updating-or-removing-your-game)
- [Rules every game must follow](#rules-every-game-must-follow)
- [Games made with an engine or bundler](#games-made-with-an-engine-or-bundler)
- [Troubleshooting](#troubleshooting)

---

## The short version

```bash
git clone https://github.com/ShadowMonarch9099/browser-games.git
cd browser-games
cp -r games/_template games/my-game     # then put your game in games/my-game/
# edit games/my-game/game.json
npm run dev                             # check it at http://localhost:8765
git add games/my-game
git commit -m "Add My Game"
git pull --rebase && git push
```

Everything below explains each step in detail.

---

## 1. Get the repo

You need to be a collaborator on
[ShadowMonarch9099/browser-games](https://github.com/ShadowMonarch9099/browser-games).
Accept the invite email from GitHub first.

**With git (recommended):**

```bash
git clone https://github.com/ShadowMonarch9099/browser-games.git
cd browser-games
```

If you already cloned it earlier, update it before starting:

```bash
git pull
```

**Without git:** skip to [7b. Upload through the GitHub website](#7b-upload-through-the-github-website).
You can still follow steps 2–5 on your own computer first.

To test locally (step 6) you need [Node.js](https://nodejs.org) 18 or newer.
There is nothing to `npm install`; the project has no dependencies.

---

## 2. Create your game folder

Copy the template and give the copy your game's name:

```bash
cp -r games/_template games/my-game
```

(On Windows without a bash shell, copy and rename the `_template` folder in
File Explorer.)

**The folder name matters.** It becomes your game's ID and its web address:
`games/space-race/` is played at `/play.html?g=space-race` and runs from
`/games/space-race/`. It must be:

- lowercase letters, numbers and dashes only: `space-race` ✓, `Space Race` ✗, `space_race` ✗
- unique: don't reuse another game's folder name
- not starting with `_` or `.` (those folders are ignored; that's how
  `_template` stays off the site)

Your folder now contains:

```
games/my-game/
  game.json       ← tells the site about your game (step 4)
  index.html      ← placeholder; replace with your game (step 3)
  thumbnail.svg   ← placeholder cover image (step 5)
```

---

## 3. Put your game in it

Replace the placeholder `index.html` with your game. **`index.html` must be
the page that starts your game**, and it must sit directly inside your
folder, not in a subfolder.

Everything else your game needs (scripts, styles, images, sounds, fonts,
levels) goes in the same folder, organised however you like:

```
games/my-game/
  game.json
  index.html
  thumbnail.png
  js/
    main.js
  css/
    style.css
  assets/
    player.png
    jump.mp3
```

**Use relative paths everywhere.** This is the most common reason a game
works on its own but breaks on the site.

| ✓ Works | ✗ Breaks on the site |
| --- | --- |
| `<script src="js/main.js">` | `<script src="/js/main.js">` |
| `fetch('levels/1.json')` | `fetch('/levels/1.json')` |
| `url(assets/bg.png)` in CSS | `url(/assets/bg.png)` |
| `new Audio('assets/jump.mp3')` | `new Audio('http://localhost:5500/assets/jump.mp3')` |

A path starting with `/` points to the root of the whole site, not your
folder, so it won't find your files.

Read [Rules every game must follow](#rules-every-game-must-follow) before
publishing. They're short.

---

## 4. Fill in game.json

`game.json` is what puts your game on the homepage. Open it and fill it in:

```json
{
  "title": "Space Race",
  "description": "Dodge asteroids and race to the moon. How far can you get before your fuel runs out?",
  "authors": ["Your Name"],
  "thumbnail": "thumbnail.png",
  "tags": ["arcade", "action"],
  "controls": ["keyboard", "touch"],
  "orientation": "landscape",
  "accent": "#ff8a3d",
  "added": "2026-11-10"
}
```

| Field | Required? | What it does | Allowed values |
| --- | --- | --- | --- |
| `title` | **Yes** | The game's name on the card and the player page. | Any text |
| `description` | **Yes** | Shown on the card, cut off after 2 lines. Make people want to click it. | Any text |
| `authors` | No | Shown as "by …" on the player page and searchable. | A list: `["Ana", "Ben"]` |
| `thumbnail` | No | Cover image on the card, relative to your folder. If you leave it out, a cover is generated from your title's initials and `accent` colour. | A file in your folder, e.g. `"thumbnail.png"` or `"art/cover.jpg"` |
| `tags` | No | Small labels on the card. Every tag used by any game becomes a filter button on the homepage. Keep them short and reuse existing tags where they fit. | A list: `["puzzle", "multiplayer"]` |
| `controls` | No | Shown as icons on the card so players know what they need. | Any of `"keyboard"`, `"mouse"`, `"gamepad"`, `"touch"` |
| `orientation` | No | How the game is meant to be held on a phone. | `"any"` (default), `"landscape"`, `"portrait"` |
| `accent` | No | Your card's glow colour on hover, and the colour of the generated cover. | A 6-digit hex colour: `"#ff8a3d"` |
| `added` | No | The date you added the game. Games are listed newest first, and games added in the last 3 weeks get a **NEW** badge. | `"YYYY-MM-DD"` |

JSON is strict. Common mistakes:

- No comma after the last item: `"added": "2026-11-10"` then `}`, with no comma between them.
- Double quotes only: `"title"`, not `'title'`.
- No comments allowed.

Run `npm run check` (or just `npm run dev` and look at the homepage) and it
will tell you exactly what's wrong if anything is.

---

## 5. Add a thumbnail

The thumbnail is the first thing people see, so it's worth a minute.

- **Shape:** 16:9 (wide). **Size:** 640×360 or 1280×720. Other shapes
  get cropped to fit.
- **Format:** `.png`, `.jpg`, `.webp` or `.svg`.
- **Size on disk:** try to keep it under ~300 KB so the homepage loads fast.
- **Easiest way:** play your game, take a screenshot of an exciting moment,
  crop it to 16:9, and save it as `thumbnail.png` in your folder.
- Set `"thumbnail": "thumbnail.png"` in `game.json` to match the file name
  exactly, including upper/lower case.

If you delete the placeholder `thumbnail.svg` and don't add your own, also
remove the `"thumbnail"` line from `game.json` and a cover will be generated
for you.

---

## 6. Test it locally

From the repo folder, run:

```bash
npm run dev
```

Then open <http://localhost:8765>. Check:

1. **Your card is on the homepage** with the right title, description,
   thumbnail and tags. The game list is re-read on every refresh, so after
   editing `game.json` just reload the page.
2. **A red box saying "Some games were skipped"** means something is wrong
   with a game; it lists exactly what to fix. It only appears locally.
3. **Click your card.** The game should load and play inside the page.
   Try the keyboard, sound, and the Fullscreen button.
4. **Open it on its own** at `http://localhost:8765/games/my-game/` to check
   it works outside the site too.
5. **Try it on your phone** if it supports touch: with your phone on the same
   Wi-Fi, open `http://<your-computer's-IP>:8765`.
6. **Open the browser console** (F12) and look for red errors, especially
   `404 Not Found` (usually a path problem, see step 3).

Also run the validator; it's the same check the live build runs:

```bash
npm run check
```

`✓ 3 games: …` means you're good. Any `✗` line must be fixed before
publishing, otherwise the site can't rebuild (see step 7).

To test the exact files that will be deployed:

```bash
npm run build
```

This creates a `dist/` folder, the same as Vercel does. (It's ignored by git;
don't commit it.)

---

## 7. Publish it

### 7a. With git

```bash
git add games/my-game
git commit -m "Add My Game"
git pull --rebase
git push
```

`git pull --rebase` grabs anything your friends pushed in the meantime, so
your push doesn't get rejected. Only add **your** folder (`git add games/my-game`),
not `git add .`, so you don't accidentally commit someone else's half-finished
files or your local junk.

### 7b. Upload through the GitHub website

1. Go to <https://github.com/ShadowMonarch9099/browser-games/tree/main/games>.
2. Click **Add file → Upload files**.
3. Drag your **whole game folder** (e.g. `my-game`, with `game.json` and
   `index.html` inside it) onto the page. GitHub keeps the folder structure.
   Uploading the folder's *contents* instead of the folder itself puts your
   files straight into `games/`, which won't work.
4. Write a short message like "Add My Game" and click **Commit changes**
   (leave it on "Commit directly to the main branch").

GitHub's uploader takes up to 100 files at a time and 25 MB per file. For
bigger games, use git.

### What happens next

1. GitHub runs **Check games** on your commit. A green ✓ next to the commit
   means your `game.json` is valid; a red ✗ means it isn't. Click the ✗ to see
   which line is wrong.
2. Vercel rebuilds the site. After about a minute your game is live on the
   homepage.

**If the check fails, fix it quickly.** A broken `game.json` stops the
whole site from rebuilding, so nobody's updates go live until it's fixed. The
site doesn't go down: it keeps showing the last version that built
successfully.

---

## Updating or removing your game

- **Update:** change files in your folder, test with `npm run dev`, then
  commit and push as in step 7. The site updates in about a minute.
- **Rename the folder:** this changes your game's address, so old links and
  players' bookmarks stop working. Avoid it after launch if you can.
- **Remove:** delete your folder (`git rm -r games/my-game`), commit and push.
- **Only change your own folder.** Ask before editing someone else's game or
  the shared site files (`index.html`, `play.html`, `site/`, `scripts/`).

---

## Rules every game must follow

1. **`index.html` directly inside your folder starts the game.**
2. **Relative paths only** (see step 3).
3. **Prefix your saved data.** All games on the site share one
   `localStorage`. If two games both save a key called `"highscore"`, they'll
   overwrite each other. Use your folder name as a prefix:
   ```js
   localStorage.setItem('my-game:highscore', score);
   ```
   The same goes for IndexedDB database names and cookies.
4. **Don't navigate the top page.** Your game runs inside a frame. Don't
   use `window.top.location` or `target="_top"`; players use the
   **All games** button to leave.
5. **Fill the screen you're given.** Your game gets a frame the size of the
   browser window minus a thin top bar. Size your game to `100vw`/`100vh`
   (or `window.innerWidth`/`innerHeight`) and handle the `resize` event,
   rather than assuming a fixed screen size.
6. **Start sound after the first click or key press.** Browsers block audio
   until the player interacts with the page. Create or resume your
   `AudioContext` in a click/keydown handler.
7. **Stop the page from scrolling on game keys.** If arrow keys or Space
   scroll the page, call `event.preventDefault()` in your keydown handler.
8. **No secrets.** The repo and the site are public. Never commit API keys,
   passwords or tokens.
9. **Keep it reasonably small.** Compress large images and audio. Files over
   100 MB can't be pushed to GitHub at all.
10. **Keep it friendly.** It's a shared site that represents all of us.

These features are already allowed inside the frame: fullscreen, gamepads,
autoplay (after interaction), clipboard writes, and keeping the screen awake.

---

## Games made with an engine or bundler

The site serves your folder as plain files; it doesn't run your game's build.
**Build or export your game first, then put the output in your folder.**

| Tool | What to do |
| --- | --- |
| **Plain HTML/JS/CSS** | Nothing special. Put it straight in. |
| **Vite** (React, Vue, Phaser + Vite, …) | Set `base: './'` in `vite.config.js`, run `npm run build`, and copy the **contents** of `dist/` into your game folder. Keep your source code in your own repo. |
| **Webpack / Parcel / other bundlers** | Set the public path to `./` (Webpack: `output.publicPath: './'`; Parcel: `--public-url ./`), build, and copy the output in. |
| **Phaser (no bundler)** | Load Phaser from a local file or a CDN `<script>` and you're done. |
| **Godot 4** | Export → Web. Turn **Thread Support off** (threaded exports need special server headers this site doesn't send). Rename the exported `.html` file to `index.html`. |
| **Unity** | Build for WebGL with **Compression Format: Disabled** (or Gzip with "Decompression Fallback" on). Copy the build folder's contents in; Unity's `index.html` is already the entry point. Unity builds are large, so use git rather than the web uploader. |
| **GameMaker / Construct / GDevelop** | Export for HTML5/Web and copy the exported files in. Make sure the main page is `index.html`. |
| **PICO-8** | `export my-game.html`, rename it to `index.html`, and put it in your folder together with the generated `.js` file. |

After copying a build in, always test with `npm run dev`. Build tools love
absolute paths, and that's where things break.

---

## Troubleshooting

**My game doesn't show up on the homepage.**
- Is your folder directly inside `games/` (`games/my-game/game.json`, not
  `games/my-game/my-game/game.json`)?
- Does the folder name start with `_` or `.`? Those are ignored.
- Run `npm run check`. It lists exactly what's wrong.

**Error messages from the check, and what they mean:**

| Message | Fix |
| --- | --- |
| `folder name must be lowercase-with-dashes` | Rename the folder, e.g. `My_Game` → `my-game`. |
| `missing index.html` | Your game's start page must be called `index.html` and sit directly in your folder. |
| `missing game.json` | Copy it from `games/_template/`. |
| `invalid JSON (…)` | A typo in `game.json`: usually a missing or extra comma, or single quotes. The message says where. |
| `game.json needs "title"` / `"description"` | Add the missing field. |
| `"tags" must be a list of strings` | Use `["a", "b"]`, not `"a, b"`. |
| `"controls" has unknown value "…"` | Only `keyboard`, `mouse`, `gamepad`, `touch` are allowed. |
| `"orientation" must be one of …` | Use `any`, `landscape` or `portrait`. |
| `"accent" must be a hex colour` | Use six hex digits with `#`: `"#ff8a3d"`. |
| `"added" must be a date like …` | Use `YYYY-MM-DD`: `"2026-11-10"`. |
| `thumbnail "…" not found` | The file name in `game.json` must match the real file exactly, including capitals and extension. |

**The game works on its own but is blank or broken on the site.**
Almost always absolute paths. Open the console (F12) and look for 404
errors, then change `/something` paths to `something` (see step 3).

**It works locally but not on the live site.**
- File name capitals: Windows and macOS don't care about `Player.png` vs
  `player.png`, but the live server does. Make them match exactly.
- Did you push? Check that your files are on GitHub.
- Did the build pass? Look for a red ✗ next to the latest commit on GitHub.

**Keyboard doesn't respond until I click the game.**
The site gives your game focus when it loads, but if your game creates its
canvas later, call `canvas.focus()` (and give it `tabindex="0"`) or listen
for keys on `window` rather than on an element.

**No sound.** See rule 6: start audio after a click or key press.

**`git push` was rejected.**
Someone pushed while you were working. Run `git pull --rebase`, then
`git push` again.

**Still stuck?** Ask in the group chat, and include the error message or a
screenshot of the console.
