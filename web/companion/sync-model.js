export const MIDI_CLOCK = 0xF8;
export const MIDI_START = 0xFA;
export const MIDI_CONTINUE = 0xFB;
export const MIDI_STOP = 0xFC;
export const CLOCKS_PER_QUARTER = 24;
export const CLOCKS_PER_16TH = 6;

export function clampTempo(value, fallback = 120) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(20, Math.min(400, n)) : fallback;
}

export function clockIntervalMs(tempo) {
  return 60000 / (clampTempo(tempo) * CLOCKS_PER_QUARTER);
}

export function stepIntervalMs(tempo) {
  return 60000 / clampTempo(tempo) / 4;
}

export function isSixteenthBoundary(clockCount) {
  const count = Math.max(0, Math.floor(Number(clockCount) || 0));
  return count > 0 && count % CLOCKS_PER_16TH === 0;
}

export function sixteenthTickForClockCount(clockCount) {
  const count = Math.max(0, Math.floor(Number(clockCount) || 0));
  return Math.floor(count / CLOCKS_PER_16TH);
}

export function bpmFromClockIntervals(intervals, fallback = 120) {
  const clean = (Array.isArray(intervals) ? intervals : [])
    .map(Number)
    .filter((v) => Number.isFinite(v) && v > 1 && v < 1000)
    .slice(-24)
    .sort((a, b) => a - b);
  if (!clean.length) return clampTempo(fallback);
  const trim = clean.length >= 8 ? Math.floor(clean.length * 0.15) : 0;
  const sample = clean.slice(trim, clean.length - trim || undefined);
  const mean = sample.reduce((sum, v) => sum + v, 0) / sample.length;
  return clampTempo(60000 / (mean * CLOCKS_PER_QUARTER), fallback);
}

export function normalizeClockOutPorts(raw, count = 4) {
  return Array.from({ length: count }, (_, i) => Boolean(raw?.[i]));
}
