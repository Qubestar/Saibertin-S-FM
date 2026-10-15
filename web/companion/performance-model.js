export const PERFORMANCE_RATES = ['1/4', '1/8', '1/16', '1/32'];
export const ARP_MODES = ['UP', 'DOWN', 'UPDOWN', 'RANDOM'];

export function performanceRateMs(tempo, rate = '1/16', triplet = false) {
  const bpm = Math.max(30, Math.min(300, Math.round(Number(tempo) || 120)));
  const beats = { '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125 }[rate] ?? 0.25;
  const straight = (60000 / bpm) * beats;
  return triplet ? straight * (2 / 3) : straight;
}

export function normalizePerformanceNotes(notes) {
  return [...new Set((notes || [])
    .map((n) => Math.max(0, Math.min(127, Math.round(Number(n)))))
    .filter(Number.isFinite))]
    .sort((a, b) => a - b);
}

export function expandArpNotes(notes, octaves = 1) {
  const base = normalizePerformanceNotes(notes);
  const count = Math.max(1, Math.min(4, Math.round(Number(octaves) || 1)));
  const out = [];
  for (let octave = 0; octave < count; octave++) {
    for (const note of base) {
      const expanded = note + octave * 12;
      if (expanded <= 127) out.push(expanded);
    }
  }
  return normalizePerformanceNotes(out);
}

export function arpOrder(notes, mode = 'UP', octaves = 1) {
  const up = expandArpNotes(notes, octaves);
  if (mode === 'DOWN') return [...up].reverse();
  if (mode === 'UPDOWN') {
    if (up.length <= 2) return up;
    return [...up, ...up.slice(1, -1).reverse()];
  }
  return up;
}

export function arpNoteAt(notes, index, mode = 'UP', octaves = 1, random = Math.random) {
  const ordered = arpOrder(notes, mode, octaves);
  if (!ordered.length) return null;
  if (mode === 'RANDOM') {
    const i = Math.max(0, Math.min(ordered.length - 1, Math.floor(random() * ordered.length)));
    return ordered[i];
  }
  const i = ((Math.floor(Number(index) || 0) % ordered.length) + ordered.length) % ordered.length;
  return ordered[i];
}
