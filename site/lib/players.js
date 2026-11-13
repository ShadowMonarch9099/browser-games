// Arcade kit: "press a button to join" player slots for same-device multiplayer.
//
//   const lobby = Arcade.players.lobby({ input, min: 2, max: 4, onChange: draw });
//   // every update step, after input.poll():
//   lobby.update();
//   lobby.players   -> [{ index, color, name, device }]   (device has held()/pressed())
//   lobby.ready     -> true once at least `min` players have joined
//
// A device joins by pressing its "a" button and leaves by pressing "b".
window.Arcade = window.Arcade || {};

Arcade.players = {
  // Colour plus a shape name, so colour is never the only way to tell players apart.
  SLOTS: [
    { color: '#ffc531', name: 'Gold', shape: 'circle' },
    { color: '#4ea8ff', name: 'Blue', shape: 'square' },
    { color: '#ff5a4e', name: 'Red', shape: 'triangle' },
    { color: '#48d597', name: 'Green', shape: 'diamond' },
  ],

  lobby({ input, min = 1, max = 4, onChange = () => {} }) {
    const players = [];
    const state = {
      players,
      get ready() { return players.length >= min; },
      update() {
        for (const dev of input.joinable()) {
          const at = players.findIndex((p) => p.device === dev);
          if (at === -1 && dev.pressed('a') && players.length < max) {
            // Take the lowest free slot so colours stay stable when someone leaves.
            const used = new Set(players.map((p) => p.index));
            const index = [0, 1, 2, 3].find((i) => !used.has(i));
            players.push({ index, ...Arcade.players.SLOTS[index], device: dev });
            players.sort((a, b) => a.index - b.index);
            onChange(players);
          } else if (at !== -1 && dev.pressed('b')) {
            players.splice(at, 1);
            onChange(players);
          }
        }
      },
    };
    return state;
  },
};
