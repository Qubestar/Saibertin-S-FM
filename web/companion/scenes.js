import { restoreState, snapshotState } from './model.js';
import { captureTrackPattern, applyTrackPattern, clonePatternSnapshot, PATTERN_SLOTS } from './pattern-slots-model.js';
import {
  SCENE_COUNT, normalizeScene, parseSceneChain, formatSceneChain,
  nextSceneCursor, sceneAtCursor, normalizeSceneQuantize, sceneBoundarySteps, isSceneBoundary,
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
    return raw && typeof raw === 'object'
      ? { version: 1, tracks: raw.tracks || {}, clipboard: raw.clipboard || null }
      : { version: 1, tracks: {}, clipboard: null };
  } catch { return { version: 1, tracks: {}, clipboard: null }; }
}
function writeSlots(slots) { localStorage.setItem(SLOT_KEY, JSON.stringify(slots)); }
function readScenes() {
  const fallback = { version: 3, scenes: Array(SCENE_COUNT).fill(null), active: 0, chain: [0], cursor: 0, auto: false, quantize: 'BAR1' };
  try {
    const raw = JSON.parse(localStorage.getItem(SCENE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return fallback;
    const scenes = Array.from({ length: SCENE_COUNT }, (_, i) => normalizeScene(raw.scenes?.[i], i));
    const chain = parseSceneChain((raw.chain || [0]).map((v) => Number(v) + 1));
    return {
      version: 3,
      scenes,
      active: Math.max(0, Math.min(SCENE_COUNT - 1, Number(raw.active) || 0)),
      chain,
      cursor: Math.max(0, Math.min(chain.length - 1, Number(raw.cursor) || 0)),
      auto: raw.auto === true,
      quantize: normalizeSceneQuantize(raw.quantize),
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

function snapshotCurrentScene(index, state = readState(), slots = readSlots()) {
  const scene = sceneStore.scenes[index];
  if (!scene) return false;
  syncAllActivePatterns(state, slots);
  scene.slots = Array.from({ length: 64 }, (_, track) => ensureSlotEntry(slots, track).active);
  scene.patterns = Array.from({ length: 64 }, (_, track) => clonePatternSnapshot(captureTrackPattern(state, track)));
  writeSlots(slots);
  writeScenes();
  return true;
}

let transportRunning = false;
let queuedScene = null;
let lastPlannedTick = null;

const style = document.createElement('style');
style.textContent = `
.scene-panel{margin-top:14px}.scene-buttons{display:grid;grid-template-columns:repeat(8,minmax(58px,1fr));gap:7px;margin-top:10px}.scene-btn{font-weight:800;min-height:42px}.scene-btn.active{background:#184f4b!important;border-color:#3bb8aa!important;color:#c8fff8!important}.scene-btn.queued{box-shadow:0 0 0 2px #67a9ff inset}.scene-btn.empty{opacity:.6}.scene-grid{display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-top:10px}.scene-grid label,.scene-auto label{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:12px}.scene-grid input,.scene-auto select{background:#111319;color:var(--text);border:1px solid var(--line);padding:7px;border-radius:6px}.scene-actions,.scene-auto{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.scene-auto label.inline{flex-direction:row;align-items:center}.scene-capture{background:#24422f!important;border-color:#4f9b65!important}.scene-chain{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--active)}@media(max-width:760px){.scene-buttons{grid-template-columns:repeat(4,1fr)}.scene-grid{grid-template-columns:1fr}}
`;
document.head.append(style);

const panel = document.createElement('div');
panel.className = 'box scene-panel';
panel.innerHTML = `
  <div class="label">Scenes / pattern chain · independent 64-track snapshots</div>
  <div class="scene-buttons" id="sceneButtons"></div>
  <div class="scene-grid">
    <label>Active scene name<input id="sceneName" maxlength="32" value="Scene 1"></label>
    <label>Chain (scene numbers)<input id="sceneChainInput" value="1 1 2 1 3 4"></label>
  </div>
  <div class="scene-auto">
    <label class="inline"><input id="sceneAuto" type="checkbox"> Auto chain</label>
    <label>Quantize<select id="sceneQuantize"><option value="BAR1">1 BAR</option><option value="BAR2">2 BARS</option><option value="PATTERN">PATTERN END</option></select></label>
    <span class="status" id="sceneQuantizeStatus">Changes are queued to a musical boundary.</span>
  </div>
  <div class="scene-actions">
    <button class="btn scene-capture" id="sceneCapture">Capture / update scene</button>
    <button class="btn" id="scenePrev">◀ Chain prev</button>
    <button class="btn" id="sceneNext">Chain next ▶</button>
    <span class="scene-chain" id="sceneChainStatus">1</span>
  </div>
  <div class="status" id="sceneStatus" style="margin-top:8px">Each scene owns its own sparse pattern data. Editing one scene no longer changes another scene that uses the same A/B/C/D slot.</div>
`;

const variation = document.querySelector('.variation-panel');
if (variation?.parentNode) variation.parentNode.insertBefore(panel, variation.nextSibling);
else document.querySelector('.pattern-slots')?.parentNode?.insertBefore(panel, document.querySelector('.pattern-slots'));

const buttonsEl = document.getElementById('sceneButtons');
const nameEl = document.getElementById('sceneName');
const chainInputEl = document.getElementById('sceneChainInput');
const chainStatusEl = document.getElementById('sceneChainStatus');
const statusEl = document.getElementById('sceneStatus');
const autoEl = document.getElementById('sceneAuto');
const quantizeEl = document.getElementById('sceneQuantize');
const quantizeStatusEl = document.getElementById('sceneQuantizeStatus');

function quantizeLabel(state = readState()) {
  const steps = sceneBoundarySteps(state, sceneStore.quantize);
  if (sceneStore.quantize === 'PATTERN') return `PATTERN END · ${steps} steps (longest track)`;
  return `${sceneStore.quantize === 'BAR2' ? '2 BARS' : '1 BAR'} · ${steps} steps`;
}

function renderScenes(message = '') {
  buttonsEl.replaceChildren();
  for (let i = 0; i < SCENE_COUNT; i++) {
    const scene = sceneStore.scenes[i];
    const b = document.createElement('button');
    b.className = `btn scene-btn ${sceneStore.active === i ? 'active' : ''} ${queuedScene === i ? 'queued' : ''} ${scene ? '' : 'empty'}`;
    b.textContent = scene ? `${i + 1} · ${scene.name}` : `${i + 1} · EMPTY`;
    b.title = scene ? (transportRunning ? `Queue ${scene.name} for the next ${quantizeLabel()}` : `Recall ${scene.name}`) : 'Capture current independent pattern snapshot into this scene';
    b.onclick = () => scene ? requestScene(i) : captureScene(i);
    buttonsEl.append(b);
  }
  const activeScene = sceneStore.scenes[sceneStore.active];
  nameEl.value = activeScene?.name || `Scene ${sceneStore.active + 1}`;
  chainInputEl.value = sceneStore.chain.map((v) => v + 1).join(' ');
  chainStatusEl.textContent = `${formatSceneChain(sceneStore.chain)} · cursor ${sceneStore.cursor + 1}/${sceneStore.chain.length}`;
  autoEl.checked = sceneStore.auto;
  quantizeEl.value = sceneStore.quantize;
  quantizeStatusEl.textContent = `${quantizeLabel()}${transportRunning ? ' · transport running' : ''}`;
  const queued = queuedScene !== null ? ` · queued Scene ${queuedScene + 1}` : '';
  statusEl.textContent = message || (activeScene ? `Active: ${sceneStore.active + 1} · ${activeScene.name}${queued}` : `Scene ${sceneStore.active + 1} is empty.${queued}`);
}

function stopTransport() { document.getElementById('stop')?.click(); }

function captureScene(index) {
  if (transportRunning) {
    renderScenes(`Cannot capture Scene ${index + 1} while transport is running. Stop first.`);
    return false;
  }
  stopTransport();
  const state = readState();
  const slots = readSlots();
  syncAllActivePatterns(state, slots);
  const old = sceneStore.scenes[index];
  sceneStore.scenes[index] = {
    name: old?.name || `Scene ${index + 1}`,
    slots: Array.from({ length: 64 }, (_, track) => ensureSlotEntry(slots, track).active),
    patterns: Array.from({ length: 64 }, (_, track) => clonePatternSnapshot(captureTrackPattern(state, track))),
  };
  sceneStore.active = index;
  writeSlots(slots); writeScenes();
  window.dispatchEvent(new CustomEvent('saibertin:scene-recalled', { detail: { sceneIndex: index, captured: true } }));
  renderScenes(`Captured Scene ${index + 1}: independent pattern data saved for all 64 tracks.`);
  return true;
}

function applySceneLive(index, message = '') {
  const scene = sceneStore.scenes[index];
  if (!scene) {
    renderScenes(`Scene ${index + 1} is empty. Capture it before using it in a chain.`);
    return false;
  }
  const state = readState();
  const slots = readSlots();

  if (sceneStore.active !== index && sceneStore.scenes[sceneStore.active]) {
    snapshotCurrentScene(sceneStore.active, state, slots);
  } else {
    syncAllActivePatterns(state, slots);
  }

  for (let track = 0; track < 64; track++) {
    const entry = ensureSlotEntry(slots, track);
    const targetSlot = PATTERN_SLOTS.includes(scene.slots?.[track]) ? scene.slots[track] : 'A';
    let snapshot = scene.patterns?.[track] || null;

    if (!snapshot) {
      snapshot = entry.slots[targetSlot] || entry.slots[entry.active] || captureTrackPattern(state, track);
      if (!Array.isArray(scene.patterns)) scene.patterns = Array(64).fill(null);
      scene.patterns[track] = clonePatternSnapshot(snapshot);
    }

    entry.slots[targetSlot] = clonePatternSnapshot(snapshot);
    applyTrackPattern(state, track, snapshot);
    entry.active = targetSlot;
  }

  sceneStore.active = index;
  writeSlots(slots); writeState(state); writeScenes();
  window.dispatchEvent(new CustomEvent('saibertin:replace-state', { detail: { state, reason: 'scene', sceneIndex: index } }));
  window.dispatchEvent(new CustomEvent('saibertin:scene-recalled', { detail: { sceneIndex: index } }));
  renderScenes(message || `Recalled Scene ${index + 1} · ${scene.name}${transportRunning ? ' on quantized boundary' : ''}.`);
  return true;
}

function requestScene(index) {
  if (!sceneStore.scenes[index]) return captureScene(index);
  if (transportRunning) {
    queuedScene = index;
    renderScenes(`Queued Scene ${index + 1} · ${sceneStore.scenes[index].name} for the next ${quantizeLabel()}.`);
    return;
  }
  queuedScene = null;
  applySceneLive(index);
}

nameEl.onchange = () => {
  const i = sceneStore.active;
  if (!sceneStore.scenes[i]) captureScene(i);
  if (!sceneStore.scenes[i]) return;
  sceneStore.scenes[i].name = nameEl.value.trim().slice(0, 32) || `Scene ${i + 1}`;
  writeScenes(); renderScenes('Scene renamed.');
};

document.getElementById('sceneCapture').onclick = () => {
  const i = sceneStore.active;
  if (sceneStore.scenes[i]) {
    snapshotCurrentScene(i);
    renderScenes(`Updated Scene ${i + 1}: current pattern data saved independently.`);
  } else captureScene(i);
};
chainInputEl.onchange = () => {
  sceneStore.chain = parseSceneChain(chainInputEl.value);
  sceneStore.cursor = 0;
  writeScenes(); renderScenes('Chain saved. Auto chain starts from its first entry on the next transport Start.');
};
autoEl.onchange = () => {
  sceneStore.auto = autoEl.checked;
  if (sceneStore.auto && !transportRunning) sceneStore.cursor = 0;
  writeScenes(); renderScenes(sceneStore.auto ? 'Auto chain armed.' : 'Auto chain disabled.');
};
quantizeEl.onchange = () => {
  sceneStore.quantize = normalizeSceneQuantize(quantizeEl.value);
  writeScenes(); renderScenes(`Scene quantization: ${quantizeLabel()}.`);
};

function moveChain(direction) {
  sceneStore.cursor = nextSceneCursor(sceneStore.chain, sceneStore.cursor, direction);
  const sceneIndex = sceneAtCursor(sceneStore.chain, sceneStore.cursor);
  writeScenes();
  if (!sceneStore.scenes[sceneIndex]) {
    if (transportRunning) renderScenes(`Chain points to empty Scene ${sceneIndex + 1}; stop transport and capture it first.`);
    else captureScene(sceneIndex);
    return;
  }
  requestScene(sceneIndex);
}
document.getElementById('scenePrev').onclick = () => moveChain(-1);
document.getElementById('sceneNext').onclick = () => moveChain(1);

window.addEventListener('saibertin:transport-start', () => {
  transportRunning = true;
  queuedScene = null;
  lastPlannedTick = null;
  if (sceneStore.auto) sceneStore.cursor = 0;
  writeScenes();
  renderScenes(sceneStore.auto ? 'Auto chain started. First chain scene will be loaded for tick 1.' : 'Transport running. Scene clicks are now quantized.');
});

window.addEventListener('saibertin:transport-plan', (event) => {
  if (!transportRunning) return;
  const tick = Math.max(0, Math.floor(Number(event.detail?.tick) || 0));
  if (tick === lastPlannedTick) return;
  const state = readState();
  if (!isSceneBoundary(tick, state, sceneStore.quantize)) return;
  lastPlannedTick = tick;

  if (queuedScene !== null) {
    const target = queuedScene;
    queuedScene = null;
    applySceneLive(target, `Queued Scene ${target + 1} recalled at tick ${tick + 1}.`);
    return;
  }

  if (!sceneStore.auto) return;
  if (tick > 0) sceneStore.cursor = nextSceneCursor(sceneStore.chain, sceneStore.cursor, 1);
  const target = sceneAtCursor(sceneStore.chain, sceneStore.cursor);
  writeScenes();
  if (!sceneStore.scenes[target]) {
    renderScenes(`Auto chain skipped empty Scene ${target + 1}. Capture all scenes referenced by the chain.`);
    return;
  }
  applySceneLive(target, `AUTO · Scene ${target + 1} · chain ${sceneStore.cursor + 1}/${sceneStore.chain.length} · tick ${tick + 1}.`);
});

window.addEventListener('saibertin:transport-stop', () => {
  transportRunning = false;
  queuedScene = null;
  lastPlannedTick = null;
  renderScenes('Transport stopped. Scene recalls are immediate again.');
});

window.addEventListener('beforeunload', () => {
  try {
    if (!transportRunning && sceneStore.scenes[sceneStore.active]) snapshotCurrentScene(sceneStore.active);
  } catch {}
});

renderScenes();
