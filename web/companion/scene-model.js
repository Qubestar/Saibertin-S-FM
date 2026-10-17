export const SCENE_COUNT = 8;
export const SLOT_NAMES = ['A', 'B', 'C', 'D'];
export const SCENE_QUANTIZE = ['BAR1', 'BAR2', 'PATTERN'];

function clampInt(v, min, max, fallback = min) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

export function normalizeSlotMap(raw) {
  return Array.from({ length: 64 }, (_, i) => SLOT_NAMES.includes(raw?.[i]) ? raw[i] : 'A');
}

export function normalizeScenePatterns(raw) {
  return Array.from({ length: 64 }, (_, i) => {
    const value = raw?.[i];
    return value && typeof value === 'object' ? value : null;
  });
}

export function normalizeSceneQuantize(value) {
  return SCENE_QUANTIZE.includes(value) ? value : 'BAR1';
}

export function normalizeScene(raw, index = 0, fallbackQuantize = 'BAR1') {
  const fallbackName = `Scene ${clampInt(index, 0, SCENE_COUNT - 1, 0) + 1}`;
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 32) : fallbackName;
  return {
    name,
    slots: normalizeSlotMap(raw.slots),
    patterns: normalizeScenePatterns(raw.patterns),
    quantize: normalizeSceneQuantize(raw.quantize ?? fallbackQuantize),
  };
}

export function parseSceneChain(value) {
  const tokens = Array.isArray(value) ? value : String(value || '').split(/[\s,;>\-]+/);
  const result = [];
  for (const token of tokens) {
    const n = Number(token);
    if (Number.isInteger(n) && n >= 1 && n <= SCENE_COUNT) result.push(n - 1);
    if (result.length >= 64) break;
  }
  return result.length ? result : [0];
}

export function formatSceneChain(chain) {
  return parseSceneChain((chain || []).map((v) => Number(v) + 1)).map((v) => v + 1).join(' → ');
}

export function nextSceneCursor(chain, cursor = 0, direction = 1) {
  const normalized = parseSceneChain((chain || []).map((v) => Number(v) + 1));
  const len = normalized.length;
  const current = clampInt(cursor, 0, len - 1, 0);
  return (current + (direction < 0 ? -1 : 1) + len) % len;
}

export function sceneAtCursor(chain, cursor = 0) {
  const normalized = parseSceneChain((chain || []).map((v) => Number(v) + 1));
  return normalized[clampInt(cursor, 0, normalized.length - 1, 0)];
}

export function sceneBoundarySteps(state, quantize = 'BAR1') {
  const q = normalizeSceneQuantize(quantize);
  if (q === 'BAR2') return 32;
  if (q === 'PATTERN') {
    const lengths = Array.isArray(state?.trackLengths) ? state.trackLengths : [];
    let longest = 1;
    for (const value of lengths) longest = Math.max(longest, clampInt(value, 1, 64, 64));
    return longest;
  }
  return 16;
}

export function isSceneBoundary(tick, state, quantize = 'BAR1') {
  const t = Math.max(0, Math.floor(Number(tick) || 0));
  if (t === 0) return true;
  return t % sceneBoundarySteps(state, quantize) === 0;
}

export function isSceneElapsedBoundary(tick, startedAtTick, state, quantize = 'BAR1') {
  const t = Math.max(0, Math.floor(Number(tick) || 0));
  const start = Math.max(0, Math.floor(Number(startedAtTick) || 0));
  if (t < start) return false;
  const elapsed = t - start;
  if (elapsed === 0) return true;
  return elapsed % sceneBoundarySteps(state, quantize) === 0;
}
