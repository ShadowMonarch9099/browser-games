# Canvas game template (uses the Arcade kit)

Copy this folder to `games/<your-game-name>/` to start a canvas game with the
shared kit already wired up: game loop, keyboard + gamepad + touch input,
sound, saving, and the title / pause / results screens.

- `index.html` loads the kit from `../../site/lib/` and then `game.js`.
- `game.js` is a tiny working game. Replace the game parts, keep the shape:
  a `state`, an `update(dt)` that starts with `input.poll()`, and a `render()`.
- Because the kit lives outside your folder, test with `npm run dev` from the
  repo root (opening `index.html` by double-click also works, as long as the
  whole repo is on your disk).

The kit's API is documented in [ADDING_GAMES.md](../../ADDING_GAMES.md#the-arcade-kit)
and at the top of each file in `site/lib/`.

For a game that doesn't use the kit (an engine export, for example), start
from `games/_template/` instead. You can delete this README from your copy.
