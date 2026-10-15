export const MODES = ['KEYS', 'SCALE', 'CHORD', 'DRUM', 'SEQ'];
export const DEFAULT_CCS = [74, 71, 73, 91];
export const STORAGE_VERSION = 5;
export const TRACK_COUNT = 64;
export const TRACK_BANK_SIZE = 16;
export const TRACK_BANKS = ['A', 'B', 'C', 'D'];
export const INTERNAL_TRACK_COUNT = 4;
export const TRACK_TARGETS = ['MIDI', 'INTERNAL', 'BOTH'];
export const INTERNAL_ENGINES = ['ANALOG', 'DIGITAL', 'PHASE', 'LOFI', 'SAMPLE', 'VOICE', 'TRIO', 'WHEEL', 'GRAIN', 'FM6', 'PHYS', 'NOISE'];

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

function defaultStepParam() {
  return { note: null, velocity: 100, gate: 55, probability: 100, ratchet: 1, micro: 0, ccLocks: [null, null, null, null] };
}

function defaultChannel(track) { return (track % 16) + 1; }
function defaultSeqNote(track) { return [60, 64, 67, 36][track] ?? 60; }
function defaultEngine(track) { return ['ANALOG', 'DIGITAL', 'PHASE', 'SAMPLE'][track] ?? 'ANALOG'; }

export function createState() {
  return {
    mode: 'SEQ',
    selectedTrack: 0,
    channels: Array.from({ length: TRACK_COUNT }, (_, t) => defaultChannel(t)),
    ccValues: Array.from({ length: TRACK_COUNT }, () => [64, 64, 64, 64]),
    ccNumbers: Array.from({ length: TRACK_COUNT }, () => [...DEFAULT_CCS]),
    drumNotes: DRUMS.map(([, note]) => note),
    steps: Array.from({ length: TRACK_COUNT }, () => Array(64).fill(false)),
    stepParams: Array.from({ length: TRACK_COUNT }, () => Array.from({ length: 64 }, defaultStepParam)),
    seqNotes: Array.from({ length: TRACK_COUNT }, (_, t) => defaultSeqNote(t)),
    trackLengths: Array(TRACK_COUNT).fill(64),
    trackTargets: Array(TRACK_COUNT).fill('MIDI'),
    internalEngines: Array.from({ length: TRACK_COUNT }, (_, t) => defaultEngine(t)),
    internalSounds: Array(TRACK_COUNT).fill(0),
    tempo: 120,
    follow: true,
    page: 0,
    root: 0,
    scale: 'Minor',
  };
}

export function clampMidi(v) { return Math.max(0, Math.min(127, Math.round(Number(v) || 0))); }
function clampInt(v, min, max, fallback = min) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}
function boolRow(row, length) { return Array.from({ length }, (_, i) => Boolean(row?.[i])); }
function midiRow(row, fallback, length) { return Array.from({ length }, (_, i) => clampMidi(row?.[i] ?? fallback[i])); }
function trackIndex(v) { return clampInt(v, 0, TRACK_COUNT - 1, 0); }

function restoreStepParam(raw) {
  const p = defaultStepParam();
  if (!raw || typeof raw !== 'object') return p;
  p.note = raw.note === null || raw.note === undefined ? null : clampMidi(raw.note);
  p.velocity = clampInt(raw.velocity, 1, 127, 100);
  p.gate = clampInt(raw.gate, 5, 100, 55);
  p.probability = clampInt(raw.probability, 0, 100, 100);
  p.ratchet = clampInt(raw.ratchet, 1, 4, 1);
  p.micro = clampInt(raw.micro, -50, 50, 0);
  if (Array.isArray(raw.ccLocks)) {
    p.ccLocks = Array.from({ length: 4 }, (_, i) => {
      const v = raw.ccLocks[i];
      return v === null || v === undefined ? null : clampMidi(v);
    });
  }
  return p;
}

export function trackBankIndex(track) { return Math.floor(trackIndex(track) / TRACK_BANK_SIZE); }
export function trackSlotIndex(track) { return trackIndex(track) % TRACK_BANK_SIZE; }
export function trackLabel(track) {
  const t = trackIndex(track);
  return `${TRACK_BANKS[trackBankIndex(t)]}${String(trackSlotIndex(t) + 1).padStart(2, '0')}`;
}
export function canUseInternal(track) { return trackIndex(track) < INTERNAL_TRACK_COUNT; }

export function setCc(state, slot, value) {
  state.ccValues[state.selectedTrack][slot] = clampMidi(value);
  return state.ccValues[state.selectedTrack][slot];
}
export function adjustCc(state, slot, delta) { return setCc(state, slot, state.ccValues[state.selectedTrack][slot] + delta); }
export function ccNumber(state, slot) { return state.ccNumbers[state.selectedTrack][slot]; }
export function setCcNumber(state, slot, value) {
  state.ccNumbers[state.selectedTrack][slot] = clampMidi(value);
  return state.ccNumbers[state.selectedTrack][slot];
}
export function setDrumNote(state, lane, value) { state.drumNotes[lane] = clampMidi(value); return state.drumNotes[lane]; }
export function setSeqNote(state, track, value) { const t = trackIndex(track); state.seqNotes[t] = clampMidi(value); return state.seqNotes[t]; }
export function setTempo(state, value) { state.tempo = clampInt(value, 30, 300, 120); return state.tempo; }

export function setTrackLength(state, track, value) {
  const t = trackIndex(track);
  state.trackLengths[t] = clampInt(value, 1, 64, 64);
  return state.trackLengths[t];
}
export function setTrackTarget(state, track, value) {
  const t = trackIndex(track);
  const requested = TRACK_TARGETS.includes(value) ? value : 'MIDI';
  state.trackTargets[t] = canUseInternal(t) ? requested : 'MIDI';
  return state.trackTargets[t];
}
export function setInternalEngine(state, track, value) {
  const t = trackIndex(track);
  state.internalEngines[t] = INTERNAL_ENGINES.includes(value) ? value : 'ANALOG';
  return state.internalEngines[t];
}
export function setInternalSound(state, track, value) {
  const t = trackIndex(track);
  state.internalSounds[t] = clampInt(value, 0, 152, 0);
  return state.internalSounds[t];
}
export function trackLocalStep(state, track, tick) {
  const t = trackIndex(track);
  const len = setTrackLength(state, t, state.trackLengths[t]);
  const n = Math.max(0, Math.floor(Number(tick) || 0));
  return n % len;
}
export function maxPageForTrack(state, track) {
  const t = trackIndex(track);
  return Math.max(0, Math.ceil(state.trackLengths[t] / 16) - 1);
}

export function toggleStep(state, visibleIndex) {
  const absolute = state.page * 16 + visibleIndex;
  if (absolute >= state.trackLengths[state.selectedTrack]) return false;
  state.steps[state.selectedTrack][absolute] = !state.steps[state.selectedTrack][absolute];
  return state.steps[state.selectedTrack][absolute];
}
export function setStepEnabled(state, track, step, enabled) {
  const t = trackIndex(track);
  const s = clampInt(step, 0, 63, 0);
  if (s >= state.trackLengths[t]) return false;
  state.steps[t][s] = Boolean(enabled);
  return state.steps[t][s];
}
export function visibleStep(state, visibleIndex) {
  const step = state.page * 16 + visibleIndex;
  if (step >= state.trackLengths[state.selectedTrack]) return false;
  return state.steps[state.selectedTrack][step];
}
export function stepParam(state, track, step) { return state.stepParams[trackIndex(track)][clampInt(step, 0, 63, 0)]; }
export function effectiveStepNote(state, track, step) {
  const t = trackIndex(track);
  const p = stepParam(state, t, step);
  return p.note === null ? clampMidi(state.seqNotes[t]) : clampMidi(p.note);
}
export function setStepParam(state, track, step, field, value) {
  const p = stepParam(state, track, step);
  switch (field) {
    case 'note': p.note = value === null ? null : clampMidi(value); break;
    case 'velocity': p.velocity = clampInt(value, 1, 127, 100); break;
    case 'gate': p.gate = clampInt(value, 5, 100, 55); break;
    case 'probability': p.probability = clampInt(value, 0, 100, 100); break;
    case 'ratchet': p.ratchet = clampInt(value, 1, 4, 1); break;
    case 'micro': p.micro = clampInt(value, -50, 50, 0); break;
    default: break;
  }
  return p[field];
}
export function setStepCcLock(state, track, step, slot, value) {
  const p = stepParam(state, track, step);
  const s = clampInt(slot, 0, 3, 0);
  p.ccLocks[s] = value === null || value === undefined ? null : clampMidi(value);
  return p.ccLocks[s];
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
    notes.push(base + root + scale[idx % scale.length] + Math.floor(idx / scale.length) * 12);
  }
  return notes;
}
export function noteName(note) {
  const pc = ROOTS[((note % 12) + 12) % 12];
  return `${pc}${Math.floor(note / 12) - 1}`;
}
export function stepDurationMs(tempo) { return 60000 / clampInt(tempo, 30, 300, 120) / 4; }

export function sequenceEventsAtTick(state, tick, random = Math.random) {
  const events = [];
  for (let track = 0; track < TRACK_COUNT; track++) {
    const step = trackLocalStep(state, track, tick);
    if (!state.steps[track][step]) continue;
    const target = state.trackTargets[track];
    const emitMidi = target === 'MIDI' || target === 'BOTH';
    const emitInternal = canUseInternal(track) && (target === 'INTERNAL' || target === 'BOTH');
    const ch = state.channels[track];
    if (emitMidi && (ch < 1 || ch > 16) && !emitInternal) continue;
    const p = stepParam(state, track, step);
    if (p.probability < 100 && random() * 100 >= p.probability) continue;
    events.push({
      track, step, target,
      emitMidi: emitMidi && ch >= 1 && ch <= 16,
      emitInternal,
      channel: ch >= 1 && ch <= 16 ? ch - 1 : null,
      engine: state.internalEngines[track],
      sound: state.internalSounds[track],
      note: effectiveStepNote(state, track, step),
      velocity: p.velocity,
      gate: p.gate,
      probability: p.probability,
      ratchet: p.ratchet,
      micro: p.micro,
      ccLocks: p.ccLocks.map((value, slot) => value === null ? null : { slot, cc: state.ccNumbers[track][slot], value }).filter(Boolean),
    });
  }
  return events;
}
export function sequenceEventsAtStep(state, stepIndex, random = Math.random) { return sequenceEventsAtTick(state, stepIndex, random); }

export function restoreState(raw) {
  const s = createState();
  if (!raw || typeof raw !== 'object') return s;

  if (MODES.includes(raw.mode)) s.mode = raw.mode;
  s.selectedTrack = trackIndex(raw.selectedTrack);
  s.page = clampInt(raw.page, 0, 3, 0);
  s.root = clampInt(raw.root, 0, 11, 0);
  s.tempo = clampInt(raw.tempo, 30, 300, 120);
  if (typeof raw.follow === 'boolean') s.follow = raw.follow;
  if (typeof raw.scale === 'string' && SCALES[raw.scale]) s.scale = raw.scale;

  if (Array.isArray(raw.channels))
    s.channels = Array.from({ length: TRACK_COUNT }, (_, t) => clampInt(raw.channels[t], 0, 16, s.channels[t]));

  if (Array.isArray(raw.ccValues))
    s.ccValues = Array.from({ length: TRACK_COUNT }, (_, t) => midiRow(raw.ccValues[t], s.ccValues[t], 4));

  if (Array.isArray(raw.ccNumbers)) {
    if (raw.ccNumbers.length === 4 && raw.ccNumbers.every((v) => !Array.isArray(v))) {
      const row = midiRow(raw.ccNumbers, DEFAULT_CCS, 4);
      s.ccNumbers = Array.from({ length: TRACK_COUNT }, () => [...row]);
    } else {
      s.ccNumbers = Array.from({ length: TRACK_COUNT }, (_, t) => midiRow(raw.ccNumbers[t], DEFAULT_CCS, 4));
    }
  }

  if (Array.isArray(raw.drumNotes)) s.drumNotes = midiRow(raw.drumNotes, DRUMS.map(([, note]) => note), 16);
  if (Array.isArray(raw.seqNotes)) s.seqNotes = Array.from({ length: TRACK_COUNT }, (_, t) => clampMidi(raw.seqNotes[t] ?? s.seqNotes[t]));
  if (Array.isArray(raw.trackLengths)) s.trackLengths = Array.from({ length: TRACK_COUNT }, (_, t) => clampInt(raw.trackLengths[t], 1, 64, 64));
  if (Array.isArray(raw.trackTargets)) {
    s.trackTargets = Array.from({ length: TRACK_COUNT }, (_, t) => {
      const requested = TRACK_TARGETS.includes(raw.trackTargets[t]) ? raw.trackTargets[t] : 'MIDI';
      return canUseInternal(t) ? requested : 'MIDI';
    });
  }
  if (Array.isArray(raw.internalEngines))
    s.internalEngines = Array.from({ length: TRACK_COUNT }, (_, t) => INTERNAL_ENGINES.includes(raw.internalEngines[t]) ? raw.internalEngines[t] : s.internalEngines[t]);
  if (Array.isArray(raw.internalSounds))
    s.internalSounds = Array.from({ length: TRACK_COUNT }, (_, t) => clampInt(raw.internalSounds[t], 0, 152, 0));
  if (Array.isArray(raw.steps))
    s.steps = Array.from({ length: TRACK_COUNT }, (_, t) => boolRow(raw.steps[t], 64));
  if (Array.isArray(raw.stepParams))
    s.stepParams = Array.from({ length: TRACK_COUNT }, (_, t) => Array.from({ length: 64 }, (_, i) => restoreStepParam(raw.stepParams?.[t]?.[i])));

  s.page = Math.min(s.page, maxPageForTrack(s, s.selectedTrack));
  return s;
}

export function snapshotState(state) { return { version: STORAGE_VERSION, state: restoreState(state) }; }
