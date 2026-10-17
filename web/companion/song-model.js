export const SONG_MAX_SECTIONS = 32;
export const SONG_MAX_BARS = 64;

function clampInt(value, min, max, fallback = min) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

function cleanName(value, fallback) {
  const name = typeof value === 'string' ? value.trim().slice(0, 24) : '';
  return name || fallback;
}

export function normalizeSongSection(raw, index = 0) {
  const fallbackName = `Part ${clampInt(index, 0, SONG_MAX_SECTIONS - 1, 0) + 1}`;
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    name: cleanName(src.name, fallbackName),
    scene: clampInt(src.scene, 0, 7, 0),
    bars: clampInt(src.bars, 1, SONG_MAX_BARS, 4),
  };
}

export function normalizeSong(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const input = Array.isArray(src.sections) ? src.sections.slice(0, SONG_MAX_SECTIONS) : [];
  const sections = input.length
    ? input.map((section, index) => normalizeSongSection(section, index))
    : [normalizeSongSection({ name: 'Part 1', scene: 0, bars: 4 }, 0)];
  return {
    version: 1,
    enabled: src.enabled === true,
    loop: src.loop !== false,
    cursor: clampInt(src.cursor, 0, sections.length - 1, 0),
    sections,
  };
}

export function sectionSteps(section) {
  return normalizeSongSection(section).bars * 16;
}

export function sectionEndTick(startTick, section) {
  return Math.max(0, Math.floor(Number(startTick) || 0)) + sectionSteps(section);
}

export function songTotalBars(song) {
  return normalizeSong(song).sections.reduce((sum, section) => sum + section.bars, 0);
}

export function songTotalSteps(song) {
  return songTotalBars(song) * 16;
}

export function nextSongCursor(song, cursor, direction = 1) {
  const normalized = normalizeSong(song);
  const len = normalized.sections.length;
  const current = clampInt(cursor, 0, len - 1, 0);
  if (direction < 0) {
    if (current > 0) return { cursor: current - 1, wrapped: false, ended: false };
    if (normalized.loop) return { cursor: len - 1, wrapped: true, ended: false };
    return { cursor: 0, wrapped: false, ended: true };
  }
  if (current < len - 1) return { cursor: current + 1, wrapped: false, ended: false };
  if (normalized.loop) return { cursor: 0, wrapped: true, ended: false };
  return { cursor: len - 1, wrapped: false, ended: true };
}

export function songSectionAt(song, cursor) {
  const normalized = normalizeSong(song);
  return normalized.sections[clampInt(cursor, 0, normalized.sections.length - 1, 0)];
}
