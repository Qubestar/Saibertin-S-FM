export const SCENE_COUNT = 8;
export const SLOT_NAMES = ['A', 'B', 'C', 'D'];

function clampInt(v, min, max, fallback = min) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

export function normalizeSlotMap(raw) {
  return Array.from({ length: 64 }, (_, i) => SLOT_NAMES.includes(raw?.[i]) ? raw[i] : 'A');
}

export function normalizeScene(raw, index = 0) {
  const fallbackName = `Scene ${clampInt(index, 0, SCENE_COUNT - 1, 0) + 1}`;
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 32) : fallbackName;
  return { name, slots: normalizeSlotMap(raw.slots) };
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
