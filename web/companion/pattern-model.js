export const PATTERN_PRESETS = [
  { id: 'kick-four-floor', group: 'DRUM ESSENTIALS', name: 'Kick · Four on the Floor', mask: hits16(0, 4, 8, 12) },
  { id: 'kick-four-pickup', group: 'DRUM ESSENTIALS', name: 'Kick · 4x4 + Pickup', mask: hits16(0, 4, 8, 12, 15) },
  { id: 'snare-backbeat', group: 'DRUM ESSENTIALS', name: 'Snare / Clap · Backbeat 2 & 4', mask: hits16(4, 12) },
  { id: 'hat-offbeat', group: 'DRUM ESSENTIALS', name: 'Hat · Offbeat 8ths', mask: hits16(2, 6, 10, 14) },
  { id: 'hat-eighths', group: 'DRUM ESSENTIALS', name: 'Hat / Shaker · Straight 8ths', mask: hits16(0, 2, 4, 6, 8, 10, 12, 14) },
  { id: 'hat-sixteenths', group: 'DRUM ESSENTIALS', name: 'Hat / Shaker · Straight 16ths', mask: Array(16).fill(true) },
  { id: 'perc-tresillo', group: 'DRUM ESSENTIALS', name: 'Perc · Tresillo 3-3-2', mask: hits16(0, 6, 12) },
  { id: 'perc-euclid5', group: 'DRUM ESSENTIALS', name: 'Perc · Euclid 5/16', mask: euclideanPattern(16, 5, 0) },
  { id: 'perc-euclid7', group: 'DRUM ESSENTIALS', name: 'Perc · Euclid 7/16', mask: euclideanPattern(16, 7, 0) },

  { id: 'bass-offbeat', group: 'BASS / SYNTH', name: 'Bass · Offbeat 8ths', mask: hits16(2, 6, 10, 14) },
  { id: 'bass-eighths', group: 'BASS / SYNTH', name: 'Bass · Straight 8ths', mask: hits16(0, 2, 4, 6, 8, 10, 12, 14) },
  { id: 'bass-sixteenths', group: 'BASS / SYNTH', name: 'Bass / Arp · Straight 16ths', mask: Array(16).fill(true) },
  { id: 'bass-gallop', group: 'BASS / SYNTH', name: 'Bass · Gallop (8th + 2×16th)', mask: hits16(0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15) },
  { id: 'stab-quarters', group: 'BASS / SYNTH', name: 'Synth / Stab · Quarter Notes', mask: hits16(0, 4, 8, 12) },
  { id: 'stab-offbeat', group: 'BASS / SYNTH', name: 'Synth / Stab · Offbeats', mask: hits16(2, 6, 10, 14) },
  { id: 'synth-tresillo', group: 'BASS / SYNTH', name: 'Synth / Bass · Tresillo 3-3-2', mask: hits16(0, 6, 12) },
  { id: 'synth-euclid5', group: 'BASS / SYNTH', name: 'Synth · Euclid 5/16', mask: euclideanPattern(16, 5, 0) },
  { id: 'synth-euclid9', group: 'BASS / SYNTH', name: 'Synth · Euclid 9/16', mask: euclideanPattern(16, 9, 0) },
];

function hits16(...indexes) {
  const mask = Array(16).fill(false);
  for (const index of indexes) if (index >= 0 && index < 16) mask[index] = true;
  return mask;
}

function int(v, min, max, fallback = min) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

export function normalizeMask(mask) {
  return Array.isArray(mask) && mask.length ? mask.map(Boolean) : [false];
}

export function rotatePattern(mask, amount = 0) {
  const src = normalizeMask(mask);
  const n = src.length;
  const shift = ((Math.round(Number(amount) || 0) % n) + n) % n;
  const out = Array(n).fill(false);
  for (let i = 0; i < n; i++) out[(i + shift) % n] = src[i];
  return out;
}

// Evenly distributes `pulses` over `steps`. The phase is chosen so a pulse
// starts at step 1, matching a typical hardware-sequencer workflow.
export function euclideanPattern(steps, pulses, rotation = 0) {
  const n = int(steps, 1, 64, 16);
  const k = int(pulses, 0, n, Math.min(4, n));
  if (k === 0) return Array(n).fill(false);
  if (k === n) return rotatePattern(Array(n).fill(true), rotation);
  const base = Array.from({ length: n }, (_, i) => ((i * k) % n) < k);
  return rotatePattern(base, rotation);
}

export function getPatternPreset(id) {
  return PATTERN_PRESETS.find((preset) => preset.id === id) || PATTERN_PRESETS[0];
}

export function applyPatternToSteps(existing, trackLength, page, pattern, scope = 'PAGE', mode = 'REPLACE') {
  const length = int(trackLength, 1, 64, 64);
  const src = normalizeMask(pattern);
  const out = Array.from({ length: 64 }, (_, i) => Boolean(existing?.[i]));
  const merge = String(mode).toUpperCase() === 'MERGE';
  const wholeTrack = String(scope).toUpperCase() === 'TRACK';
  const start = wholeTrack ? 0 : int(page, 0, 3, 0) * 16;
  const end = wholeTrack ? length : Math.min(length, start + 16);

  if (!merge) for (let i = start; i < end; i++) out[i] = false;
  for (let i = start; i < end; i++) {
    const local = wholeTrack ? i : i - start;
    if (src[local % src.length]) out[i] = true;
  }
  for (let i = length; i < 64; i++) out[i] = false;
  return out;
}

export function patternPreview(mask, max = 32) {
  const src = normalizeMask(mask).slice(0, Math.max(1, max));
  return src.map((hit) => hit ? '●' : '·').join(' ');
}
