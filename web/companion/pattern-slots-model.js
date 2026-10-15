export const PATTERN_SLOTS = ['A', 'B', 'C', 'D'];

const DEFAULT_STEP = Object.freeze({
  note: null,
  velocity: 100,
  gate: 55,
  probability: 100,
  ratchet: 1,
  micro: 0,
  ccLocks: [null, null, null, null],
});

const clamp = (v, min, max, fallback = min) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

function normalizeLock(v) {
  return v === null || v === undefined ? null : clamp(v, 0, 127, 0);
}

export function normalizeStepParam(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    note: p.note === null || p.note === undefined ? null : clamp(p.note, 0, 127, 60),
    velocity: clamp(p.velocity, 1, 127, 100),
    gate: clamp(p.gate, 5, 100, 55),
    probability: clamp(p.probability, 0, 100, 100),
    ratchet: clamp(p.ratchet, 1, 4, 1),
    micro: clamp(p.micro, -50, 50, 0),
    ccLocks: Array.from({ length: 4 }, (_, i) => normalizeLock(p.ccLocks?.[i])),
  };
}

export function isDefaultStepParam(raw) {
  const p = normalizeStepParam(raw);
  return p.note === DEFAULT_STEP.note &&
    p.velocity === DEFAULT_STEP.velocity &&
    p.gate === DEFAULT_STEP.gate &&
    p.probability === DEFAULT_STEP.probability &&
    p.ratchet === DEFAULT_STEP.ratchet &&
    p.micro === DEFAULT_STEP.micro &&
    p.ccLocks.every((v) => v === null);
}

export function captureTrackPattern(state, track) {
  const t = clamp(track, 0, 63, 0);
  const length = clamp(state?.trackLengths?.[t], 1, 64, 64);
  const enabled = [];
  const params = {};
  for (let i = 0; i < 64; i++) {
    if (state?.steps?.[t]?.[i]) enabled.push(i);
    const p = normalizeStepParam(state?.stepParams?.[t]?.[i]);
    if (!isDefaultStepParam(p)) params[i] = p;
  }
  return {
    version: 1,
    length,
    seqNote: clamp(state?.seqNotes?.[t], 0, 127, 60),
    enabled,
    params,
  };
}

export function normalizePatternSnapshot(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const enabled = [...new Set((Array.isArray(src.enabled) ? src.enabled : [])
    .map((v) => clamp(v, 0, 63, 0)))]
    .sort((a, b) => a - b);
  const params = {};
  if (src.params && typeof src.params === 'object') {
    for (const [key, value] of Object.entries(src.params)) {
      const step = clamp(key, 0, 63, 0);
      const p = normalizeStepParam(value);
      if (!isDefaultStepParam(p)) params[step] = p;
    }
  }
  return {
    version: 1,
    length: clamp(src.length, 1, 64, 64),
    seqNote: clamp(src.seqNote, 0, 127, 60),
    enabled,
    params,
  };
}

export function applyTrackPattern(state, track, snapshot) {
  const t = clamp(track, 0, 63, 0);
  const ptn = normalizePatternSnapshot(snapshot);
  state.trackLengths[t] = ptn.length;
  state.seqNotes[t] = ptn.seqNote;
  state.steps[t] = Array.from({ length: 64 }, (_, i) => ptn.enabled.includes(i) && i < ptn.length);
  state.stepParams[t] = Array.from({ length: 64 }, (_, i) => normalizeStepParam(ptn.params[i]));
  return state;
}

export function clonePatternSnapshot(snapshot) {
  return normalizePatternSnapshot(JSON.parse(JSON.stringify(normalizePatternSnapshot(snapshot))));
}

export function nextPatternSlot(slot) {
  const i = Math.max(0, PATTERN_SLOTS.indexOf(slot));
  return PATTERN_SLOTS[(i + 1) % PATTERN_SLOTS.length];
}
