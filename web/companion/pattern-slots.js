import { restoreState, snapshotState, trackLabel } from './model.js';
import {
  PATTERN_SLOTS, captureTrackPattern, applyTrackPattern,
  clonePatternSnapshot, nextPatternSlot,
} from './pattern-slots-model.js';

const MUSIC_KEY = 'saibertin-s-fm-companion-v1';
const SLOT_KEY = 'saibertin-s-fm-pattern-slots-v1';

function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(MUSIC_KEY) || 'null');
    return restoreState(raw?.state ?? raw);
  } catch { return restoreState(null); }
}
function writeState(state) {
  localStorage.setItem(MUSIC_KEY, JSON.stringify(snapshotState(state)));
}
function readStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null');
    return raw && typeof raw === 'object'
      ? { version: 1, tracks: raw.tracks || {}, clipboard: raw.clipboard || null }
      : { version: 1, tracks: {}, clipboard: null };
  } catch { return { version: 1, tracks: {}, clipboard: null }; }
}
let store = readStore();
function writeStore() {
  try { localStorage.setItem(SLOT_KEY, JSON.stringify(store)); } catch {}
}
function entryFor(track, state, { initialize = true } = {}) {
  const key = String(track);
  if (!store.tracks[key]) store.tracks[key] = { active: 'A', slots: {} };
  const entry = store.tracks[key];
  if (!PATTERN_SLOTS.includes(entry.active)) entry.active = 'A';
  if (!entry.slots || typeof entry.slots !== 'object') entry.slots = {};
  if (initialize && !entry.slots[entry.active]) entry.slots[entry.active] = captureTrackPattern(state, track);
  return entry;
}
function saveCurrentToActive() {
  const state = readState();
  const track = state.selectedTrack;
  const entry = entryFor(track, state);
  entry.slots[entry.active] = captureTrackPattern(state, track);
  writeStore();
  return { state, track, entry };
}

const style = document.createElement('style');
style.textContent = `
.pattern-slots{margin-top:14px}.slot-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.slot-btn{min-width:64px;font-weight:800;position:relative}.slot-btn.active{background:#6a4d16!important;border-color:#f6c453!important;color:#fff1bd!important}.slot-btn.empty{opacity:.62}.slot-dot{font-size:10px;margin-left:5px;color:#75d88c}.slot-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.slot-save{background:#24422f!important;border-color:#4f9b65!important}.slot-dup{background:#3b2e57!important;border-color:#795db1!important}.slot-copy{background:#243d5a!important;border-color:#4f8ac9!important}.slot-status{margin-top:8px;color:var(--muted);font-size:13px}
`;
document.head.append(style);

const panel = document.createElement('div');
panel.className = 'box pattern-slots';
panel.innerHTML = `
  <div class="label">Pattern slots · per track variations</div>
  <div class="slot-row" id="patternSlotButtons"></div>
  <div class="slot-actions">
    <button class="btn slot-save" id="slotSave">Save current</button>
    <button class="btn slot-dup" id="slotDuplicate">Duplicate → next</button>
    <button class="btn slot-copy" id="slotCopy">Copy</button>
    <button class="btn slot-copy" id="slotPaste">Paste</button>
  </div>
  <div class="slot-status" id="slotStatus">A–D store the sequence content for the selected track. Routing stays with the track.</div>
`;
const library = document.querySelector('.pattern-library');
if (library?.parentNode) library.parentNode.insertBefore(panel, library);
else document.querySelector('.screen')?.parentNode?.insertBefore(panel, document.querySelector('.screen'));

const buttonsEl = document.getElementById('patternSlotButtons');
const statusEl = document.getElementById('slotStatus');

function slotSummary(snapshot) {
  if (!snapshot) return 'empty';
  return `${snapshot.enabled?.length || 0} trig · ${snapshot.length || 64} steps`;
}
function renderSlots(message = '') {
  const state = readState();
  const track = state.selectedTrack;
  const entry = entryFor(track, state);
  buttonsEl.replaceChildren();
  for (const slot of PATTERN_SLOTS) {
    const saved = entry.slots[slot];
    const b = document.createElement('button');
    b.className = `btn slot-btn ${entry.active === slot ? 'active' : ''} ${saved ? '' : 'empty'}`;
    b.innerHTML = `${slot}${saved ? '<span class="slot-dot">●</span>' : ''}`;
    b.title = saved ? `Pattern ${slot}: ${slotSummary(saved)}` : `Pattern ${slot}: empty — clicking creates a variation from the current pattern`;
    b.onclick = () => switchSlot(slot);
    buttonsEl.append(b);
  }
  const clip = store.clipboard;
  document.getElementById('slotPaste').disabled = !clip?.snapshot;
  statusEl.textContent = message || `${trackLabel(track)} · active ${entry.active} · ${slotSummary(entry.slots[entry.active])}${clip?.snapshot ? ` · clipboard ${clip.source || ''}` : ''}`;
}

function stopTransport() { document.getElementById('stop')?.click(); }
function switchSlot(slot) {
  if (!PATTERN_SLOTS.includes(slot)) return;
  stopTransport();
  const state = readState();
  const track = state.selectedTrack;
  const entry = entryFor(track, state);
  entry.slots[entry.active] = captureTrackPattern(state, track);
  if (!entry.slots[slot]) entry.slots[slot] = clonePatternSnapshot(entry.slots[entry.active]);
  applyTrackPattern(state, track, entry.slots[slot]);
  entry.active = slot;
  writeStore(); writeState(state);
  location.reload();
}

function saveAndRender(message) {
  const { track, entry } = saveCurrentToActive();
  renderSlots(message || `${trackLabel(track)} · Pattern ${entry.active} saved.`);
}

document.getElementById('slotSave').onclick = () => saveAndRender();
document.getElementById('slotDuplicate').onclick = () => {
  stopTransport();
  const { state, track, entry } = saveCurrentToActive();
  const target = nextPatternSlot(entry.active);
  entry.slots[target] = clonePatternSnapshot(entry.slots[entry.active]);
  entry.active = target;
  applyTrackPattern(state, track, entry.slots[target]);
  writeStore(); writeState(state);
  location.reload();
};
document.getElementById('slotCopy').onclick = () => {
  const { track, entry } = saveCurrentToActive();
  store.clipboard = {
    source: `${trackLabel(track)}:${entry.active}`,
    snapshot: clonePatternSnapshot(entry.slots[entry.active]),
  };
  writeStore(); renderSlots(`Copied ${store.clipboard.source} to clipboard.`);
};
document.getElementById('slotPaste').onclick = () => {
  if (!store.clipboard?.snapshot) return;
  stopTransport();
  const state = readState();
  const track = state.selectedTrack;
  const entry = entryFor(track, state);
  entry.slots[entry.active] = clonePatternSnapshot(store.clipboard.snapshot);
  applyTrackPattern(state, track, entry.slots[entry.active]);
  writeStore(); writeState(state);
  location.reload();
};

const trackUi = document.getElementById('tracks');
const bankUi = document.getElementById('trackBanks');
for (const el of [trackUi, bankUi]) {
  el?.addEventListener('pointerdown', () => saveCurrentToActive(), true);
}
if (trackUi) {
  const observer = new MutationObserver(() => queueMicrotask(() => renderSlots()));
  observer.observe(trackUi, { childList: true });
}
window.addEventListener('beforeunload', () => {
  try { saveCurrentToActive(); } catch {}
});

renderSlots();
