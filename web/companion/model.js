export const MODES = ['KEYS', 'SCALE', 'CHORD', 'DRUM', 'SEQ'];
export const DEFAULT_CCS = [74, 71, 73, 91];

export const SCALES = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Pentatonic: [0, 2, 4, 7, 9],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
};

export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const DEGREE_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const DRUMS = [
  ['Kick', 36], ['Snare', 38], ['Clap', 39], ['Rim', 37],
  ['CH', 42], ['OH', 46], ['Tom L', 45], ['Tom H', 50],
  ['Perc 1', 56], ['Perc 2', 75], ['Cowbell', 56], ['Ride', 51],
  ['Crash', 49], ['Shaker', 70], ['User 1', 60], ['User 2', 61],
];

export function createState() {
  return {
    mode: 'SEQ',
    selectedTrack: 0,
    channels: [1, 2, 3, 10],
    ccValues: Array.from({ length: 4 }, () => [64, 64, 64, 64]),
    ccNumbers: [...DEFAULT_CCS],
    steps: Array.from({ length: 4 }, () => Array(64).fill(false)),
    page: 0,
    root: 0,
    scale: 'Minor',
  };
}

export function clampMidi(v) {
  return Math.max(0, Math.min(127, Math.round(Number(v) || 0)));
}

export function setCc(state, slot, value) {
  state.ccValues[state.selectedTrack][slot] = clampMidi(value);
  return state.ccValues[state.selectedTrack][slot];
}

export function adjustCc(state, slot, delta) {
  return setCc(state, slot, state.ccValues[state.selectedTrack][slot] + delta);
}

export function toggleStep(state, visibleIndex) {
  const absolute = state.page * 16 + visibleIndex;
  state.steps[state.selectedTrack][absolute] = !state.steps[state.selectedTrack][absolute];
  return state.steps[state.selectedTrack][absolute];
}

export function visibleStep(state, visibleIndex) {
  return state.steps[state.selectedTrack][state.page * 16 + visibleIndex];
}

export function scaleNote(root, scaleName, index, base = 48) {
  const scale = SCALES[scaleName] || SCALES.Minor;
  const degree = ((index % scale.length) + scale.length) % scale.length;
  const octave = Math.floor(index / scale.length);
  return base + root + scale[degree] + octave * 12;
}

export function chordNotes(root, scaleName, degree, base = 48) {
  const scale = SCALES[scaleName] || SCALES.Minor;
  const notes = [];
  for (let n = 0; n < 3; n++) {
    const idx = degree + n * 2;
    const wrapped = idx % scale.length;
    const octave = Math.floor(idx / scale.length);
    notes.push(base + root + scale[wrapped] + octave * 12);
  }
  return notes;
}

export function noteName(note) {
  const pc = ROOTS[((note % 12) + 12) % 12];
  return `${pc}${Math.floor(note / 12) - 1}`;
}
