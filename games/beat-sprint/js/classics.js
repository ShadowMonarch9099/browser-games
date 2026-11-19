// Beat Sprint classics: public-domain melodies, arranged here as synth tracks.
// Every tune is a composition long out of copyright (traditional songs, or a
// composer who died more than 70 years ago, first published before 1929).
// The notes below are written out from the original melodies; drums, bass,
// chords and synths are this game's own arrangement. No recordings are used.
//
// Melody: bars split by "|", notes as NAME:LENGTH, e.g. "E5:q F#4:e. r:h".
//   Lengths: w whole, h half, q quarter, e eighth, s sixteenth; "." dots it.
//   Every bar must add up to the tune's meter (checked by tools/test-song.js).
// Chords: one entry per bar, "|"-separated; several chords share a bar evenly.
// Form: [part, section kind, tempo multiplier, transpose].
(function (root) {
  const BS = root.BS;

  const CLASSICS = [
    {
      id: 'ode-to-joy', title: 'Ode to Joy', by: 'Ludwig van Beethoven', year: 1824, bpm: 132, meter: 4, transpose: 12,
      lead: 'square', bass: 'sawtooth', groove: 'four', diff: 1,
      parts: {
        A: { notes: 'F#4:q F#4:q G4:q A4:q | A4:q G4:q F#4:q E4:q | D4:q D4:q E4:q F#4:q | F#4:q. E4:e E4:h | F#4:q F#4:q G4:q A4:q | A4:q G4:q F#4:q E4:q | D4:q D4:q E4:q F#4:q | E4:q. D4:e D4:h',
          chords: 'D | A | D | A | D | A | D | A D' },
        B: { notes: 'E4:q E4:q F#4:q D4:q | E4:q F#4:e G4:e F#4:q D4:q | E4:q F#4:e G4:e F#4:q E4:q | D4:q E4:q A3:h',
          chords: 'A D | A D | A Bm | E A' },
        C: { notes: 'F#4:q F#4:q G4:q A4:q | A4:q G4:q F#4:q E4:q | D4:q D4:q E4:q F#4:q | E4:q. D4:e D4:h',
          chords: 'D | A | D | A D' },
      },
      form: [['A', 'verse'], ['B', 'build'], ['C', 'chorus'], ['B', 'break'], ['C', 'verse2'], ['A', 'chorus2', 1, 0]],
    },
    {
      id: 'mountain-king', title: 'In the Hall of the Mountain King', by: 'Edvard Grieg', year: 1875, bpm: 104, meter: 4, transpose: 0,
      lead: 'square', bass: 'sawtooth', groove: 'four', diff: 2,
      parts: {
        A: { notes: 'B3:e C#4:e D4:e E4:e F#4:e D4:e F#4:q | F4:e C#4:e F4:q E4:e C4:e E4:q | B3:e C#4:e D4:e E4:e F#4:e D4:e F#4:e B4:e | A4:e F#4:e D4:e F#4:e A4:h',
          chords: 'Bm | C# C | Bm | D' },
      },
      // the famous accelerando: every pass a little faster, and an octave up on the second
      form: [['A', 'verse', 1, 0], ['A', 'verse', 1, 12], ['A', 'build', 1.12, 0], ['A', 'build', 1.12, 12], ['A', 'chorus', 1.26, 0], ['A', 'chorus', 1.26, 12], ['A', 'chorus2', 1.42, 0], ['A', 'chorus2', 1.42, 12], ['A', 'chorus2', 1.6, 12]],
    },
    {
      id: 'fur-elise', title: 'Für Elise', by: 'Ludwig van Beethoven', year: 1810, bpm: 132, meter: 3, transpose: 0,
      lead: 'triangle', bass: 'triangle', groove: 'soft', diff: 1,
      parts: {
        P: { notes: 'r:q r:q E5:e D#5:e', chords: 'Am' },
        A1: { notes: 'E5:e D#5:e E5:e B4:e D5:e C5:e | A4:q r:e C4:e E4:e A4:e | B4:q r:e E4:e G#4:e B4:e | C5:q r:e E4:e E5:e D#5:e | E5:e D#5:e E5:e B4:e D5:e C5:e | A4:q r:e C4:e E4:e A4:e | B4:q r:e E4:e C5:e B4:e | A4:q r:q E5:e D#5:e',
          chords: 'Am | Am | E | Am | Am | Am | E | Am' },
        A2: { notes: 'E5:e D#5:e E5:e B4:e D5:e C5:e | A4:q r:e C4:e E4:e A4:e | B4:q r:e E4:e G#4:e B4:e | C5:q r:e E4:e E5:e D#5:e | E5:e D#5:e E5:e B4:e D5:e C5:e | A4:q r:e C4:e E4:e A4:e | B4:q r:e E4:e C5:e B4:e | A4:q r:e B4:e C5:e D5:e',
          chords: 'Am | Am | E | Am | Am | Am | E | Am' },
        B: { notes: 'E5:q. G4:e F5:e E5:e | D5:q. F4:e E5:e D5:e | C5:q. E4:e D5:e C5:e | B4:q r:q E5:e D#5:e',
          chords: 'C | G | Am | E' },
      },
      form: [['P', 'verse'], ['A1', 'verse'], ['A2', 'build'], ['B', 'chorus'], ['A1', 'break'], ['A2', 'verse2'], ['B', 'chorus2'], ['A1', 'chorus2']],
    },
    {
      id: 'korobeiniki', title: 'Korobeiniki', by: 'Russian folk song', year: 1861, bpm: 140, meter: 4, transpose: 0,
      lead: 'square', bass: 'square', groove: 'four', diff: 2,
      parts: {
        A: { notes: 'E5:q B4:e C5:e D5:q C5:e B4:e | A4:q A4:e C5:e E5:q D5:e C5:e | B4:q. C5:e D5:q E5:q | C5:q A4:q A4:h | D5:q. F5:e A5:q G5:e F5:e | E5:q. C5:e E5:q D5:e C5:e | B4:q B4:e C5:e D5:q E5:q | C5:q A4:q A4:h',
          chords: 'E | Am | E | Am | Dm | C | E | Am' },
      },
      form: [['A', 'verse', 1, 0], ['A', 'build', 1, 0], ['A', 'chorus', 1.08, 0], ['A', 'break', 1.08, -12], ['A', 'chorus2', 1.16, 0], ['A', 'chorus2', 1.24, 0]],
    },
    {
      id: 'entertainer', title: 'The Entertainer', by: 'Scott Joplin', year: 1902, bpm: 150, meter: 4, transpose: 0,
      lead: 'triangle', bass: 'square', groove: 'swing', diff: 2,
      parts: {
        A: { notes: 'r:h r:q D4:e D#4:e | E4:e C5:q E4:e C5:q E4:e C5:e | C5:h r:e C5:e D5:e D#5:e | E5:e C5:e D5:e E5:q B4:e D5:q | C5:h r:q D4:e D#4:e | E4:e C5:q E4:e C5:q E4:e C5:e | C5:h r:e r:e A4:e G4:e | F#4:e A4:e C5:e E5:q D5:e C5:e A4:e | D5:h r:q D4:e D#4:e | E4:e C5:q E4:e C5:q E4:e C5:e | C5:h r:e C5:e D5:e D#5:e | E5:e C5:e D5:e E5:q B4:e D5:q | C5:h. r:q',
          chords: 'C | C | C | G | C | C | C | D | G | C | C | G | C' },
      },
      form: [['A', 'verse'], ['A', 'chorus'], ['A', 'chorus2', 1, 12]],
    },
    {
      id: 'saints', title: 'When the Saints Go Marching In', by: 'Traditional spiritual', year: 1896, bpm: 152, meter: 4, transpose: 12,
      lead: 'sawtooth', bass: 'square', groove: 'swing', diff: 0,
      parts: {
        A: { notes: 'r:q C4:q E4:q F4:q | G4:w | r:q C4:q E4:q F4:q | G4:w | r:q C4:q E4:q F4:q | G4:h E4:h | C4:h E4:h | D4:w | r:q E4:q E4:q D4:q | C4:h. C4:q | E4:h G4:h | G4:q F4:h. | r:q E4:q F4:q G4:q | E4:h C4:h | D4:w | C4:w',
          chords: 'C | C | C | C | C | C | C | G | C | C | C7 | F | C | C | G | C' },
      },
      form: [['A', 'verse'], ['A', 'chorus'], ['A', 'chorus2', 1.1, 0]],
    },
    {
      id: 'oh-susanna', title: 'Oh! Susanna', by: 'Stephen Foster', year: 1848, bpm: 148, meter: 4, transpose: 12,
      lead: 'square', bass: 'square', groove: 'swing', diff: 1,
      parts: {
        A: { notes: 'r:h. C4:e D4:e | E4:q G4:q G4:q. A4:e | G4:q E4:q C4:q. D4:e | E4:q E4:q D4:q C4:q | D4:h. C4:e D4:e | E4:q G4:q G4:q. A4:e | G4:q E4:q C4:q. D4:e | E4:q E4:q D4:q D4:q | C4:h. r:q | F4:h A4:h | A4:h G4:q G4:q | E4:q C4:q D4:h | r:h. C4:e D4:e | E4:q G4:q G4:q. A4:e | G4:q E4:q C4:q. D4:e | E4:q E4:q D4:q D4:q | C4:w',
          chords: 'C | C | C | C | G | C | C | G | C | F | C | G | G | C | C | G | C' },
      },
      form: [['A', 'verse'], ['A', 'chorus'], ['A', 'chorus2', 1.08, 0]],
    },
    {
      id: 'greensleeves', title: 'Greensleeves', by: 'English traditional', year: 1580, bpm: 132, meter: 3, transpose: 0,
      lead: 'triangle', bass: 'triangle', groove: 'soft', diff: 0,
      parts: {
        A: { notes: 'r:q r:q A4:q | C5:h D5:q | E5:q. F5:e E5:q | D5:h B4:q | G4:q. A4:e B4:q | C5:h A4:q | A4:q. G#4:e A4:q | B4:h G#4:q | E4:h A4:q | C5:h D5:q | E5:q. F5:e E5:q | D5:h B4:q | G4:q. A4:e B4:q | C5:q. B4:e A4:q | G#4:q. F#4:e G#4:q | A4:h.',
          chords: 'Am | Am | C | G | Em | Am | Am | E | E | Am | C | G | Em | Am | E | Am' },
        B: { notes: 'G5:h. | G5:q. F#5:e E5:q | D5:h B4:q | G4:q. A4:e B4:q | C5:h A4:q | A4:q. G#4:e A4:q | B4:h G#4:q | E4:h. | G5:h. | G5:q. F#5:e E5:q | D5:h B4:q | G4:q. A4:e B4:q | C5:q. B4:e A4:q | G#4:q. F#4:e G#4:q | A4:h.',
          chords: 'C | C | G | Em | Am | Am | E | E | C | C | G | Em | Am | E | Am' },
      },
      form: [['A', 'verse'], ['B', 'chorus'], ['A', 'verse2'], ['B', 'chorus2']],
    },
    {
      id: 'minuet-g', title: 'Minuet in G', by: 'Christian Petzold (once credited to J. S. Bach)', year: 1725, bpm: 138, meter: 3, transpose: 0,
      lead: 'square', bass: 'triangle', groove: 'soft', diff: 1,
      parts: {
        A: { notes: 'D5:q G4:e A4:e B4:e C5:e | D5:q G4:q G4:q | E5:q C5:e D5:e E5:e F#5:e | G5:q G4:q G4:q | C5:q D5:e C5:e B4:e A4:e | B4:q C5:e B4:e A4:e G4:e | F#4:q G4:e A4:e B4:e G4:e | A4:h. | D5:q G4:e A4:e B4:e C5:e | D5:q G4:q G4:q | E5:q C5:e D5:e E5:e F#5:e | G5:q G4:q G4:q | C5:q D5:e C5:e B4:e A4:e | B4:q C5:e B4:e A4:e G4:e | A4:q B4:e A4:e G4:e F#4:e | G4:h.',
          chords: 'G | G | C | G | C | G | D | D | G | G | C | G | C | G | D | G' },
        B: { notes: 'B5:q G5:e A5:e B5:e G5:e | A5:q D5:e E5:e F#5:e D5:e | G5:q E5:e F#5:e G5:e D5:e | C#5:q B4:e C#5:e A4:q | A4:e B4:e C#5:e D5:e E5:e F#5:e | G5:q F#5:q E5:q | F#5:q A4:q C#5:q | D5:h. | D5:q G4:e F#4:e G4:q | E5:q G4:e F#4:e G4:q | D5:q C5:q B4:q | A4:e G4:e F#4:e G4:e A4:q | D4:e E4:e F#4:e G4:e A4:e B4:e | C5:q B4:q A4:q | B4:e D5:e G4:q F#4:q | G4:h.',
          chords: 'G | D | Em | A | A | Em | D A | D | G | C | G | D | D | Am | G D | G' },
      },
      form: [['A', 'verse'], ['B', 'build'], ['A', 'chorus'], ['B', 'chorus2']],
    },
    {
      id: 'amazing-grace', title: 'Amazing Grace', by: 'Traditional ("New Britain")', year: 1829, bpm: 108, meter: 3, transpose: 12,
      lead: 'triangle', bass: 'triangle', groove: 'soft', diff: 0,
      parts: {
        A: { notes: 'r:q r:q D4:q | G4:h B4:e G4:e | B4:h A4:q | G4:h E4:q | D4:h D4:q | G4:h B4:e G4:e | B4:h A4:q | D5:h. | D5:h B4:q | D5:h B4:e G4:e | B4:h A4:q | G4:h E4:q | D4:h D4:q | G4:h B4:e G4:e | B4:h A4:q | G4:h.',
          chords: 'G | G | G | C | G | G | Em | D | D | G | G | C | G | G | D | G' },
      },
      form: [['A', 'verse'], ['A', 'chorus'], ['A', 'chorus2', 1.1, 0]],
    },
    {
      id: 'drunken-sailor', title: 'Drunken Sailor', by: 'Sea shanty', year: 1839, bpm: 144, meter: 4, transpose: 12,
      lead: 'sawtooth', bass: 'sawtooth', groove: 'four', diff: 2,
      parts: {
        A: { notes: 'A4:q A4:e A4:e A4:q A4:e A4:e | A4:q D4:q F4:q A4:q | G4:q G4:e G4:e G4:q G4:e G4:e | G4:q C4:q E4:q G4:q | A4:q A4:e A4:e A4:q A4:e A4:e | A4:q B4:q C5:q D5:q | C5:q A4:q G4:q E4:q | D4:h D4:h',
          chords: 'Dm | Dm | C | C | Dm | Dm | C | Dm' },
        B: { notes: 'A4:h A4:q. A4:e | A4:q D4:q F4:q A4:q | G4:h G4:q. G4:e | G4:q C4:q E4:q G4:q | A4:h A4:q. A4:e | A4:q B4:q C5:q D5:q | C5:q A4:q G4:q E4:q | D4:h D4:h',
          chords: 'Dm | Dm | C | C | Dm | Dm | C | Dm' },
      },
      form: [['A', 'verse'], ['B', 'chorus'], ['A', 'verse2', 1.08, 0], ['B', 'chorus2', 1.08, 0], ['B', 'chorus2', 1.16, 0]],
    },
    {
      id: 'jingle-bells', title: 'Jingle Bells', by: 'James Lord Pierpont', year: 1857, bpm: 156, meter: 4, transpose: 0,
      lead: 'square', bass: 'square', groove: 'four', diff: 1,
      parts: {
        V: { notes: 'G4:q E5:q D5:q C5:q | G4:h. G4:e G4:e | G4:q E5:q D5:q C5:q | A4:h. r:q | A4:q F5:q E5:q D5:q | B4:h. r:q | G5:q G5:q F5:q D5:q | E5:h. r:q | G4:q E5:q D5:q C5:q | G4:h. r:q | G4:q E5:q D5:q C5:q | A4:h. A4:q | A4:q F5:q E5:q D5:q | G5:q G5:q G5:q G5:q | A5:q G5:q F5:q D5:q | C5:h G5:h',
          chords: 'C | C | C | Am | Dm | G | G | C | C | C | C | Am | Dm | G | G | C G' },
        C: { notes: 'E5:q E5:q E5:h | E5:q E5:q E5:h | E5:q G5:q C5:q. D5:e | E5:w | F5:q F5:q F5:q. F5:e | F5:q E5:q E5:q E5:e E5:e | E5:q D5:q D5:q E5:q | D5:h G5:h | E5:q E5:q E5:h | E5:q E5:q E5:h | E5:q G5:q C5:q. D5:e | E5:w | F5:q F5:q F5:q. F5:e | F5:q E5:q E5:q E5:e E5:e | G5:q G5:q F5:q D5:q | C5:w',
          chords: 'C | C | C | C | F | C | D | G | C | C | C | C | F | C | G | C' },
      },
      form: [['V', 'verse'], ['C', 'chorus'], ['V', 'verse2'], ['C', 'chorus2']],
    },
    {
      id: 'camptown', title: 'Camptown Races', by: 'Stephen Foster', year: 1850, bpm: 156, meter: 4, transpose: 12,
      lead: 'square', bass: 'square', groove: 'swing', diff: 1,
      parts: {
        A: { notes: 'G4:e G4:e E4:e G4:e A4:e G4:e E4:q | E4:q D4:q E4:q D4:q | G4:e G4:e E4:e G4:e A4:e G4:e E4:q | D4:q E4:q D4:q C4:q | C4:e. C4:s E4:e G4:e C5:h | A4:e. A4:s C5:e A4:e G4:h | G4:e G4:e E4:e G4:e A4:e G4:e E4:q | D4:e D4:e E4:e D4:e C4:h',
          chords: 'C | G | C | G C | C | F | C | G C' },
      },
      form: [['A', 'verse'], ['A', 'verse'], ['A', 'chorus'], ['A', 'chorus', 1.08, 0], ['A', 'chorus2', 1.16, 0], ['A', 'chorus2', 1.24, 0]],
    },
    {
      id: 'canon-d', title: 'Canon in D', by: 'Johann Pachelbel', year: 1690, bpm: 84, meter: 4, transpose: 0,
      lead: 'triangle', bass: 'triangle', groove: 'soft', diff: 1,
      parts: {
        V1: { notes: 'F#5:h E5:h | D5:h C#5:h | B4:h A4:h | B4:h C#5:h', chords: 'D A | Bm F#m | G D | G A' },
        V2: { notes: 'D5:q C#5:q B4:q A4:q | G4:q F#4:q G4:q E4:q | D4:q F#4:q A4:q G4:q | F#4:q D4:q F#4:q E4:q', chords: 'D A | Bm F#m | G D | G A' },
        V3: { notes: 'D4:e F#4:e A4:e G4:e F#4:e D4:e F#4:e E4:e | D4:e B3:e D4:e A4:e G4:e B4:e A4:e G4:e | F#4:e D4:e E4:e C#5:e D5:e F#5:e A5:e A4:e | B4:e G4:e A4:e F#4:e D4:e D5:e D5:e. C#5:s',
          chords: 'D A | Bm F#m | G D | G A' },
      },
      form: [['V1', 'verse'], ['V2', 'verse'], ['V3', 'build'], ['V2', 'chorus', 1, 12], ['V3', 'chorus2', 1, 12], ['V3', 'chorus2'], ['V1', 'break', 1, 12]],
    },
    {
      id: 'symphony-40', title: 'Symphony No. 40', by: 'Wolfgang Amadeus Mozart', year: 1788, bpm: 150, meter: 4, transpose: 0,
      lead: 'sawtooth', bass: 'sawtooth', groove: 'four', diff: 2,
      parts: {
        A: { notes: 'r:h. D#5:e D5:e | D5:q D#5:e D5:e D5:q D#5:e D5:e | D5:q A#5:q r:q A#5:e A5:e | G5:q G5:e F5:e D#5:q D#5:e D5:e | C5:q C5:q r:q D5:e C5:e | C5:q D5:e C5:e C5:q D5:e C5:e | C5:q A5:q r:q A5:e G5:e | F#5:q F#5:e D#5:e D5:q D5:e C5:e | A#4:q A#4:q r:h',
          chords: 'Gm | Gm | Gm | Cm | D | D | D | D | Gm' },
      },
      form: [['A', 'verse'], ['A', 'build'], ['A', 'chorus'], ['A', 'break', 1, -12], ['A', 'chorus2'], ['A', 'chorus2', 1.08, 0]],
    },
    {
      id: 'alla-turca', title: 'Rondo alla Turca', by: 'Wolfgang Amadeus Mozart', year: 1784, bpm: 126, meter: 4, transpose: -12,
      lead: 'square', bass: 'square', groove: 'four', diff: 2,
      parts: {
        A: { notes: 'r:h B4:e A4:e G#4:e A4:e | C5:q r:q D5:e C5:e B4:e C5:e | E5:q r:q F5:e E5:e D#5:e E5:e | B5:e A5:e G#5:e A5:e B5:e A5:e G#5:e A5:e | C6:h A5:q C6:q | B5:e A5:e G5:e A5:e B5:e A5:e G5:e A5:e | B5:e A5:e G5:e F#5:e E5:h',
          chords: 'Am | Am | Am | E Am | Am | Em | Em B' },
      },
      form: [['A', 'verse'], ['A', 'build'], ['A', 'chorus'], ['A', 'chorus2', 1.08, 0], ['A', 'chorus2', 1.16, 0]],
    },
  ];

  // ---------- reading the notation ----------
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LEN = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
  function midi(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) throw new Error('bad note ' + name);
    return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function length(code) {
    const base = LEN[code[0]];
    if (base === undefined) throw new Error('bad length ' + code);
    return code.endsWith('.') ? base * 1.5 : base;
  }
  // "Am" -> { root: 9, tones: [0, 3, 7] }
  function chord(name) {
    const m = /^([A-G])(#|b)?(m7|m|7|dim)?$/.exec(name);
    if (!m) throw new Error('bad chord ' + name);
    const root = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    const tones = m[3] === 'm' ? [0, 3, 7] : m[3] === 'm7' ? [0, 3, 7, 10] : m[3] === '7' ? [0, 4, 7, 10] : m[3] === 'dim' ? [0, 3, 6] : [0, 4, 7];
    return { root, tones };
  }
  // A part becomes bars of { notes: [{ at, d, n|null }], chords: [chord, ...] }.
  function parsePart(part, meter, label) {
    const bars = part.notes.split('|').map((b) => b.trim()).filter(Boolean);
    const chords = part.chords.split('|').map((b) => b.trim());
    if (chords.length !== bars.length) throw new Error(`${label}: ${bars.length} bars of melody but ${chords.length} bars of chords`);
    return bars.map((bar, i) => {
      let at = 0;
      const notes = bar.split(/\s+/).map((tok) => {
        const [name, code] = tok.split(':');
        const d = length(code), n = name === 'r' ? null : midi(name);
        const note = { at, d, n };
        at += d;
        return note;
      });
      if (Math.abs(at - meter) > 1e-6) throw new Error(`${label} bar ${i + 1} has ${at} beats, not ${meter}`);
      return { notes, chords: chords[i].split(/\s+/).map(chord) };
    });
  }
  const parsed = {};
  function bars(def) {
    if (!parsed[def.id]) {
      const out = {};
      for (const [k, p] of Object.entries(def.parts)) out[k] = parsePart(p, def.meter, `${def.title} part ${k}`);
      parsed[def.id] = out;
    }
    return parsed[def.id];
  }

  BS.Classics = { LIST: CLASSICS, bars, midi, length, chord, byId: (id) => CLASSICS.find((c) => c.id === id) };
})(typeof window !== 'undefined' ? window : globalThis);
