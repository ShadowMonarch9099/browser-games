# Game template

Copy this whole folder to `games/<your-game-name>/` (lowercase-with-dashes)
to start a new game. This `_template` folder itself never appears on the site.

1. Replace `index.html` with your game. It must be the page that starts it.
   Use **relative paths only** (`js/main.js`, not `/js/main.js`).
2. Edit `game.json`: `title` and `description` are required.
3. Replace `thumbnail.svg` with a 16:9 image (e.g. `thumbnail.png`, 640×360)
   and update `"thumbnail"` in `game.json` to match.
4. Run `npm run dev` from the repo root and check your game at
   <http://localhost:8765>.
5. Commit your folder and push to `main`.

You can delete this README from your copy.

Full step-by-step guide, field reference, engine export tips and
troubleshooting: [ADDING_GAMES.md](../../ADDING_GAMES.md).
