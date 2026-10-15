import { restoreState, snapshotState } from './model.js';
import { captureTrackPattern, applyTrackPattern, clonePatternSnapshot, PATTERN_SLOTS } from './pattern-slots-model.js';
import {
  SCENE_COUNT, normalizeScene, parseSceneChain, formatSceneChain,
  nextSceneCursor, sceneAtCursor,
} from './scene-model.js';

const MUSIC_KEY = 'saibertin-s-fm-companion-v1';
const SLOT_KEY = 'saibertin-s-fm-pattern-slots-v1';
const SCENE_KEY = 'saibertin-s-fm-scenes-v1';

function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(MUSIC_KEY) || 'null');
    return restoreState(raw?.state ?? raw);
  } catch { return restoreState(null); }
}
function writeState(state) { localStorage.setItem(MUSIC_KEY, JSON.stringify(snapshotState(state))); }
function readSlots() {
  try {
    const raw = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null');
    return raw && typeof raw === 'object' ? { version: 1, tracks: raw.tracks || {}, clipboard: raw.clipboard || null } : { version: 1, tracks: {}, clipboard: null };
  } catch { return { version: 1, tracks: {}, clipboard: null }; }
}
function writeSlots(slots) { localStorage.setItem(SLOT_KEY, JSON.stringify(slots)); }
function readScenes() {
  const fallback = { version: 1, scenes: Array(SCENE_COUNT).fill(null), active: 0, chain: [0], cursor: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(SCENE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return fallback;
    const scenes = Array.from({ length: SCENE_COUNT }, (_, i) => normalizeScene(raw.scenes?.[i], i));
    const chain = parseSceneChain((raw.chain || [0]).map((v) => Number(v) + 1));
    return {
      version: 1, scenes,
      active: Math.max(0, Math.min(SCENE_COUNT - 1, Number(raw.active) || 0)),
      chain,
      cursor: Math.max(0, Math.min(chain.length - 1, Number(raw.cursor) || 0)),
    };
  } catch { return fallback; }
}
let sceneStore = readScenes();
function writeScenes() { localStorage.setItem(SCENE_KEY, JSON.stringify(sceneStore)); }

function ensureSlotEntry(slots, track) {
  const key = String(track);
  if (!slots.tracks[key]) slots.tracks[key] = { active: 'A', slots: {} };
  const entry = slots.tracks[key];
  if (!PATTERN_SLOTS.includes(entry.active)) entry.active = 'A';
  if (!entry.slots || typeof entry.slots !== 'object') entry.slots = {};
  return entry;
}

function syncAllActivePatterns(state, slots) {
  for (let track = 0; track < 64; track++) {
    const entry = ensureSlotEntry(slots, track);
    entry.slots[entry.active] = captureTrackPattern(state, track);
  }
}

const style = document.createElement('style');
style.textContent = `
.scene-panel{margin-top:14px}.scene-buttons{display:grid;grid-template-columns:repeat(8,minmax(58px,1fr));gap:7px;margin-top:10px}.scene-btn{font-weight:800;min-height:42px}.scene-btn.active{background:#184f4b!important;border-color:#3bb8aa!important;color:#c8fff8!important}.scene-btn.empty{opacity:.6}.scene-grid{display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-top:10px}.scene-grid label{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:12px}.scene-grid input{background:#111319;color:var(--text);border:1px solid var(--line);padding:7px;border-radius:6px}.scene-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.scene-capture{background:#24422f!important;border-color:#4f9b65!important}.scene-chain{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--active)}@media(max-width:760px){.scene-buttons{grid-template-columns:repeat(4,1fr)}.scene-grid{grid-template-columns:1fr}}
`;
document.head.append(style);

const panel = document.createElement('div');
panel.className = 'box scene-panel';
panel.innerHTML = `
  <div class="label">Scenes / pattern chain · 64-track slot maps</div>
  <div class="scene-buttons" id="sceneButtons"></div>
  <div class="scene-grid">
    <label>Active scene name<input id="sceneName" maxlength="32" value="Scene 1"></label>
    <label>Chain (scene numbers)<input id="sceneChainInput" value="1 1 2 1 3 4"></label>
  </div>
  <div class="scene-actions">
    <button class="btn scene-capture" id="sceneCapture">Capture current slot map</button>
    <button class="btn" id="scenePrev">◀ Chain prev</button>
    <button class="btn" id="sceneNext">Chain next ▶</button>
    <span class="scene-chain" id="sceneChainStatus">1</span>
  </div>
  <div class="status" id="sceneStatus" style="margin-top:8px">Click an empty scene to capture the current A/B/C/D choices. Click a saved scene to recall it.</div>
`;

const variation = document.querySelector('.variation-panel');
if (variation?.parentNode) variation.parentNode.insertBefore(panel, variation.nextSibling);
else document.querySelector('.pattern-slots')?.parentNode?.insertBefore(panel, document.querySelector('.pattern-slots'));

const buttonsEl = document.getElementById('sceneButtons');
const nameEl = document.getElementById('sceneName');
const chainInputEl = document.getElementById('sceneChainInput');
const chainStatusEl = document.getElementById('sceneChainStatus');
const statusEl = document.getElementById('sceneStatus');

function renderScenes(message = '') {
  buttonsEl.replaceChildren();
  for (let i = 0; i < SCENE_COUNT; i++) {
    const scene = sceneStore.scenes[i];
    const b = document.createElement('button');
    b.className = `btn scene-btn ${sceneStore.active === i ? 'active' : ''} ${scene ? '' : 'empty'}`;
    b.textContent = scene ? `${i + 1} · ${scene.name}` : `${i + 1} · EMPTY`;
    b.title = scene ? `Recall ${scene.name}` : 'Capture current pattern-slot map into this scene';
    b.onclick = () => scene ? recallScene(i) : captureScene(i);
    buttonsEl.append(b);
  }
  const activeScene = sceneStore.scenes[sceneStore.active];
  nameEl.value = activeScene?.name || `Scene ${sceneStore.active + 1}`;
  chainInputEl.value = sceneStore.chain.map((v) => v + 1).join(' ');
  chainStatusEl.textContent = `${formatSceneChain(sceneStore.chain)} · cursor ${sceneStore.cursor + 1}/${sceneStore.chain.length}`;
  statusEl.textContent = message || (activeScene ? `Active: ${sceneStore.active + 1} · ${activeScene.name}` : `Scene ${sceneStore.active + 1} is empty.`);
}

function stopTransport() { document.getElementById('stop')?.click(); }

function captureScene(index) {
  stopTransport();
  const state = readState();
  const slots = readSlots();
  syncAllActivePatterns(state, slots);
  const slotMap = Array.from({ length: 64 }, (_, t) => ensureSlotEntry(slots, t).active);
  const old = sceneStore.scenes[index];
  sceneStore.scenes[index] = { name: old?.name || `Scene ${index + 1}`, slots: slotMap };
  sceneStore.active = index;
  writeSlots(slots); writeScenes();
  renderScenes(`Captured Scene ${index + 1}: current A/B/C/D selection across all 64 tracks.`);
}

function recallScene(index) {
  const scene = sceneStore.scenes[index];
  if (!scene) return captureScene(index);
  stopTransport();
  const state = readState();
  const slots = readSlots();
  syncAllActivePatterns(state, slots);
  for (let track = 0; track < 64; track++) {
    const entry = ensureSlotEntry(slots, track);
    const targetSlot = PATTERN_SLOTS.includes(scene.slots[track]) ? scene.slots[track] : 'A';
    if (!entry.slots[targetSlot]) {
      const source = entry.slots[entry.active] || captureTrackPattern(state, track);
      entry.slots[targetSlot] = clonePatternSnapshot(source);
    }
    applyTrackPattern(state, track, entry.slots[targetSlot]);
    entry.active = targetSlot;
  }
  sceneStore.active = index;
  writeSlots(slots); writeState(state); writeScenes();
  location.reload();
}

nameEl.onchange = () => {
  const i = sceneStore.active;
  if (!sceneStore.scenes[i]) captureScene(i);
  sceneStore.scenes[i].name = nameEl.value.trim().slice(0, 32) || `Scene ${i + 1}`;
  writeScenes(); renderScenes('Scene renamed.');
};

document.getElementById('sceneCapture').onclick = () => captureScene(sceneStore.active);
chainInputEl.onchange = () => {
  sceneStore.chain = parseSceneChain(chainInputEl.value);
  sceneStore.cursor = 0;
  writeScenes(); renderScenes('Chain saved. Use Prev/Next for manual scene stepping.');
};

function moveChain(direction) {
  sceneStore.cursor = nextSceneCursor(sceneStore.chain, sceneStore.cursor, direction);
  const sceneIndex = sceneAtCursor(sceneStore.chain, sceneStore.cursor);
  writeScenes();
  if (!sceneStore.scenes[sceneIndex]) captureScene(sceneIndex);
  else recallScene(sceneIndex);
}
document.getElementById('scenePrev').onclick = () => moveChain(-1);
document.getElementById('sceneNext').onclick = () => moveChain(1);

renderScenes();
