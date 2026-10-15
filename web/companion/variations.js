import { restoreState, snapshotState, trackLabel } from './model.js';
import { VARIATIONS, applyVariation } from './variation-model.js';

const MUSIC_KEY = 'saibertin-s-fm-companion-v1';
const SLOT_KEY = 'saibertin-s-fm-pattern-slots-v1';
const SCENE_KEY = 'saibertin-s-fm-scenes-v1';
const UI_KEY = 'saibertin-s-fm-variation-ui-v1';
const SLOT_NAMES = ['A', 'B', 'C', 'D'];

function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(MUSIC_KEY) || 'null');
    return restoreState(raw?.state ?? raw);
  } catch { return restoreState(null); }
}
function writeState(state) { localStorage.setItem(MUSIC_KEY, JSON.stringify(snapshotState(state))); }

function currentContext() {
  const state = readState();
  const track = state.selectedTrack;
  let slot = 'A';
  let scene = 0;
  try {
    const raw = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null');
    const active = raw?.tracks?.[String(track)]?.active;
    if (SLOT_NAMES.includes(active)) slot = active;
  } catch {}
  try {
    const raw = JSON.parse(localStorage.getItem(SCENE_KEY) || 'null');
    const active = Number(raw?.active);
    if (Number.isInteger(active) && active >= 0 && active < 8) scene = active;
  } catch {}
  return { scene, track, slot, key: `${scene}:${track}:${slot}` };
}

function readUiStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
    if (raw && typeof raw === 'object') return raw;
  } catch {}
  return {};
}
function readUi() {
  const fallback = { variation: 'fill-1beat', scope: 'PAGE' };
  const raw = readUiStore();
  const { key } = currentContext();
  const legacy = raw.variation || raw.scope ? { variation: raw.variation, scope: raw.scope } : null;
  const saved = raw.byContext?.[key] || raw.bySlot?.[key.split(':').slice(1).join(':')] || legacy || null;
  return { ...fallback, ...(saved || {}) };
}
function writeUi() {
  try {
    const raw = readUiStore();
    const { key } = currentContext();
    const byContext = raw.byContext && typeof raw.byContext === 'object' ? { ...raw.byContext } : {};
    byContext[key] = { variation: variationEl.value, scope: scopeEl.value };
    localStorage.setItem(UI_KEY, JSON.stringify({ version: 3, byContext }));
  } catch {}
}

const style = document.createElement('style');
style.textContent = `
.variation-panel{margin-top:14px}.variation-grid{display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-top:10px}.variation-grid label{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:12px}.variation-grid select{background:#111319;color:var(--text);border:1px solid var(--line);padding:7px;border-radius:6px}.variation-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.variation-apply{background:#5a3524!important;border-color:#b66c42!important}.variation-tip{font-size:13px;color:var(--muted)}@media(max-width:760px){.variation-grid{grid-template-columns:1fr}}
`;
document.head.append(style);

const panel = document.createElement('div');
panel.className = 'box variation-panel';
panel.innerHTML = `
  <div class="label">Fills / accents / variations</div>
  <div class="variation-grid">
    <label>Transform<select id="variationSelect"></select></label>
    <label>Apply to<select id="variationScope"><option value="PAGE">Current 16-step page</option><option value="TRACK">Whole track</option></select></label>
  </div>
  <div class="variation-actions">
    <button class="btn variation-apply" id="variationApply">Apply variation</button>
    <span class="variation-tip">Tip: duplicate Pattern A → B first when you want a safe fill/variation version.</span>
  </div>
  <div class="status" id="variationStatus" style="margin-top:8px">Transform choice is remembered per Scene + Track + Pattern slot.</div>
`;

const slots = document.querySelector('.pattern-slots');
if (slots?.parentNode) slots.parentNode.insertBefore(panel, slots.nextSibling);
else document.querySelector('.pattern-library')?.parentNode?.insertBefore(panel, document.querySelector('.pattern-library'));

const variationEl = document.getElementById('variationSelect');
const scopeEl = document.getElementById('variationScope');
const statusEl = document.getElementById('variationStatus');
const groups = new Map();
for (const item of VARIATIONS) {
  if (!groups.has(item.group)) {
    const group = document.createElement('optgroup'); group.label = item.group; groups.set(item.group, group); variationEl.append(group);
  }
  groups.get(item.group).append(new Option(item.name, item.id));
}

function renderContextStatus(message = '') {
  if (message) { statusEl.textContent = message; return; }
  const { scene, track, slot } = currentContext();
  const name = VARIATIONS.find((v) => v.id === variationEl.value)?.name || variationEl.value;
  statusEl.textContent = `Scene ${scene + 1} · ${trackLabel(track)} · Pattern ${slot} · ${name} · ${scopeEl.value === 'TRACK' ? 'whole track' : 'current page'}`;
}
function loadContextUi(message = '') {
  const saved = readUi();
  variationEl.value = VARIATIONS.some((v) => v.id === saved.variation) ? saved.variation : 'fill-1beat';
  scopeEl.value = saved.scope === 'TRACK' ? 'TRACK' : 'PAGE';
  renderContextStatus(message);
}

for (const el of [variationEl, scopeEl]) el.addEventListener('change', () => { writeUi(); renderContextStatus(); });

document.getElementById('variationApply').onclick = () => {
  document.getElementById('stop')?.click();
  const state = readState();
  const track = state.selectedTrack;
  const { scene, slot } = currentContext();
  applyVariation(state, track, variationEl.value, scopeEl.value);
  writeState(state); writeUi();
  const name = VARIATIONS.find((v) => v.id === variationEl.value)?.name || variationEl.value;
  renderContextStatus(`${name} → Scene ${scene + 1} · ${trackLabel(track)} · Pattern ${slot}. Reloading view…`);
  setTimeout(() => location.reload(), 90);
};

window.addEventListener('saibertin:scene-recalled', () => loadContextUi('Variation context updated for recalled scene.'));
loadContextUi();
