export const VARIATIONS = [
  { id: 'fill-1beat', group: 'Fills', name: 'Fill · Last 1 beat' },
  { id: 'fill-2beat', group: 'Fills', name: 'Fill · Last 2 beats' },
  { id: 'roll-last', group: 'Fills', name: 'Roll · Last step ×4' },
  { id: 'ghost-backbeat', group: 'Groove', name: 'Ghosts · Before backbeats' },
  { id: 'rolling-16', group: 'Groove', name: 'Rolling · 16ths' },
  { id: 'accent-downbeat', group: 'Velocity', name: 'Accent · Quarter downbeats' },
  { id: 'velocity-alternate', group: 'Velocity', name: 'Velocity · Alternating' },
  { id: 'crescendo', group: 'Velocity', name: 'Velocity · Crescendo' },
  { id: 'ratchet-4', group: 'Ratchet', name: 'Ratchet · Every 4th active step ×2' },
];

const clamp = (v, min, max, fallback = min) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

function defaultParam() {
  return { note: null, velocity: 100, gate: 55, probability: 100, ratchet: 1, micro: 0, ccLocks: [null, null, null, null] };
}

function ensureParam(state, track, step) {
  const p = state.stepParams?.[track]?.[step];
  if (!p || typeof p !== 'object') state.stepParams[track][step] = defaultParam();
  const out = state.stepParams[track][step];
  if (!Array.isArray(out.ccLocks)) out.ccLocks = [null, null, null, null];
  return out;
}

export function variationRange(state, track, scope = 'PAGE') {
  const t = clamp(track, 0, 63, 0);
  const len = clamp(state.trackLengths?.[t], 1, 64, 64);
  if (scope === 'TRACK') return { start: 0, end: len };
  const page = clamp(state.page, 0, 3, 0);
  const start = Math.min(len, page * 16);
  return { start, end: Math.min(len, start + 16) };
}

function activeInRange(state, track, start, end) {
  const out = [];
  for (let i = start; i < end; i++) if (state.steps[track][i]) out.push(i);
  return out;
}

function setVelocity(state, track, step, value) {
  ensureParam(state, track, step).velocity = clamp(value, 1, 127, 100);
}

export function applyVariation(state, track, variationId, scope = 'PAGE') {
  const t = clamp(track, 0, 63, 0);
  const { start, end } = variationRange(state, t, scope);
  const span = Math.max(0, end - start);
  if (!span) return state;

  switch (variationId) {
    case 'fill-1beat': {
      const count = Math.min(4, span);
      const velocities = [82, 96, 110, 124];
      for (let n = 0; n < count; n++) {
        const step = end - count + n;
        state.steps[t][step] = true;
        const p = ensureParam(state, t, step);
        p.velocity = velocities[4 - count + n]; p.probability = 100; p.ratchet = 1;
      }
      break;
    }
    case 'fill-2beat': {
      const count = Math.min(8, span);
      const velocities = [72, 84, 78, 92, 88, 100, 112, 124];
      for (let n = 0; n < count; n++) {
        const step = end - count + n;
        state.steps[t][step] = true;
        const p = ensureParam(state, t, step);
        p.velocity = velocities[8 - count + n]; p.probability = 100; p.ratchet = 1;
      }
      break;
    }
    case 'roll-last': {
      const step = end - 1;
      state.steps[t][step] = true;
      const p = ensureParam(state, t, step);
      p.velocity = 120; p.gate = 35; p.probability = 100; p.ratchet = 4;
      break;
    }
    case 'ghost-backbeat': {
      for (let step = start; step < end; step++) {
        const phase = step % 16;
        if (phase === 3 || phase === 11) {
          state.steps[t][step] = true;
          const p = ensureParam(state, t, step);
          p.velocity = 45; p.gate = 30; p.probability = 100;
        }
      }
      break;
    }
    case 'rolling-16': {
      for (let step = start; step < end; step++) {
        state.steps[t][step] = true;
        setVelocity(state, t, step, step % 4 === 0 ? 112 : 72);
      }
      break;
    }
    case 'accent-downbeat': {
      for (const step of activeInRange(state, t, start, end)) setVelocity(state, t, step, step % 4 === 0 ? 122 : 88);
      break;
    }
    case 'velocity-alternate': {
      const active = activeInRange(state, t, start, end);
      active.forEach((step, i) => setVelocity(state, t, step, i % 2 === 0 ? 112 : 78));
      break;
    }
    case 'crescendo': {
      const active = activeInRange(state, t, start, end);
      const denom = Math.max(1, active.length - 1);
      active.forEach((step, i) => setVelocity(state, t, step, Math.round(60 + (67 * i / denom))));
      break;
    }
    case 'ratchet-4': {
      const active = activeInRange(state, t, start, end);
      active.forEach((step, i) => { ensureParam(state, t, step).ratchet = (i + 1) % 4 === 0 ? 2 : 1; });
      break;
    }
    default: break;
  }
  return state;
}
