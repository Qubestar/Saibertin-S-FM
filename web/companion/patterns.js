import { restoreState, snapshotState, trackLabel } from './model.js';
import {
  PATTERN_PRESETS, getPatternPreset, rotatePattern, euclideanPattern,
  applyPatternToSteps, patternPreview,
} from './pattern-model.js';

const STORAGE_KEY = 'saibertin-s-fm-companion-v1';
const SLOT_KEY = 'saibertin-s-fm-pattern-slots-v1';
const SCENE_KEY = 'saibertin-s-fm-scenes-v1';
const UI_KEY = 'saibertin-s-fm-pattern-ui-v1';
const SLOT_NAMES = ['A', 'B', 'C', 'D'];

function readMusicalState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return restoreState(raw?.state ?? raw);
  } catch { return restoreState(null); }
}
function writeMusicalState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotState(state))); }

function currentContext() {
  const state = readMusicalState();
  const track = state.selectedTrack;
  let slot = 'A';
  let scene = 0;
  try {
    const slots = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null');
    const active = slots?.tracks?.[String(track)]?.active;
    if (SLOT_NAMES.includes(active)) slot = active;
  } catch {}
  try {
    const scenes = JSON.parse(localStorage.getItem(SCENE_KEY) || 'null');
    const active = Number(scenes?.active);
    if (Number.isInteger(active) && active >= 0 && active < 8) scene = active;
  } catch {}
  return { scene, track, slot, key: `${scene}:${track}:${slot}` };
}

function readUiStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}
function readUi() {
  const fallback = { preset: 'kick-four-floor', rotate: 0, scope: 'PAGE', mode: 'REPLACE', euclidSteps: 16, euclidPulses: 5, euclidRotate: 0 };
  const raw = readUiStore();
  const { key } = currentContext();
  const legacy = raw.preset ? raw : null;
  return { ...fallback, ...(raw.byContext?.[key] || legacy || {}) };
}
function writeUi() {
  const raw = readUiStore();
  const { key } = currentContext();
  const byContext = raw.byContext && typeof raw.byContext === 'object' ? { ...raw.byContext } : {};
  byContext[key] = {
    preset: presetEl.value,
    rotate: Number(rotateEl.value),
    scope: scopeEl.value,
    mode: modeEl.value,
    euclidSteps: Number(euclidStepsEl.value),
    euclidPulses: Number(euclidPulsesEl.value),
    euclidRotate: Number(euclidRotateEl.value),
  };
  try { localStorage.setItem(UI_KEY, JSON.stringify({ version: 2, byContext })); } catch {}
}

const style = document.createElement('style');
style.textContent = `
.pattern-library{margin-top:14px}.pattern-grid{display:grid;grid-template-columns:2fr repeat(3,minmax(110px,1fr));gap:10px;margin-top:10px}.pattern-grid label,.euclid-grid label{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:12px}.pattern-grid select,.pattern-grid input,.euclid-grid input{background:#111319;color:var(--text);border:1px solid var(--line);padding:7px;border-radius:6px}.pattern-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.pattern-preview{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--active);font-size:13px;letter-spacing:.02em;overflow-wrap:anywhere}.euclid-grid{display:grid;grid-template-columns:repeat(3,minmax(100px,1fr));gap:10px;margin-top:10px}.pattern-apply{background:#243d5a!important;border-color:#4f8ac9!important}.pattern-euclid{background:#3b2e57!important;border-color:#795db1!important}@media(max-width:760px){.pattern-grid{grid-template-columns:1fr 1fr}.euclid-grid{grid-template-columns:1fr 1fr}}
`;
document.head.append(style);

const panel = document.createElement('div');
panel.className = 'box pattern-library';
panel.innerHTML = `
  <div class="label">Pattern library · quick rhythm recipes</div>
  <div class="pattern-grid">
    <label>Preset<select id="patternPreset"></select></label>
    <label>Rotate<input id="patternRotate" type="number" min="-63" max="63" value="0"></label>
    <label>Apply to<select id="patternScope"><option value="PAGE">Current 16-step page</option><option value="TRACK">Whole track</option></select></label>
    <label>Mode<select id="patternMode"><option value="REPLACE">Replace</option><option value="MERGE">Merge</option></select></label>
  </div>
  <div class="pattern-actions"><button class="btn pattern-apply" id="patternApply">Apply preset</button><span class="pattern-preview" id="patternPreview"></span></div>
  <div class="label" style="margin-top:14px">Custom Euclidean · evenly distribute pulses over a cycle</div>
  <div class="euclid-grid">
    <label>Steps<input id="euclidSteps" type="number" min="1" max="64" value="16"></label>
    <label>Pulses<input id="euclidPulses" type="number" min="0" max="16" value="5"></label>
    <label>Rotate<input id="euclidRotate" type="number" min="-63" max="63" value="0"></label>
  </div>
  <div class="pattern-actions"><button class="btn pattern-euclid" id="euclidApply">Generate + apply</button><span class="pattern-preview" id="euclidPreview"></span></div>
  <div class="status" id="patternStatus" style="margin-top:8px">Preset selection is remembered independently per Scene + Track + Pattern slot.</div>
`;

const screen = document.querySelector('.screen');
if (screen?.parentNode) screen.parentNode.insertBefore(panel, screen);
else document.querySelector('.panel')?.append(panel);

const $ = (id) => document.getElementById(id);
const presetEl = $('patternPreset');
const rotateEl = $('patternRotate');
const scopeEl = $('patternScope');
const modeEl = $('patternMode');
const euclidStepsEl = $('euclidSteps');
const euclidPulsesEl = $('euclidPulses');
const euclidRotateEl = $('euclidRotate');
const statusEl = $('patternStatus');

const groups = new Map();
for (const preset of PATTERN_PRESETS) {
  if (!groups.has(preset.group)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = preset.group;
    groups.set(preset.group, optgroup);
    presetEl.append(optgroup);
  }
  groups.get(preset.group).append(new Option(preset.name, preset.id));
}

function currentPresetMask() {
  const preset = getPatternPreset(presetEl.value);
  return rotatePattern(preset.mask, Number(rotateEl.value) || 0);
}
function currentEuclidMask() {
  const steps = Math.max(1, Math.min(64, Number(euclidStepsEl.value) || 16));
  const pulses = Math.max(0, Math.min(steps, Number(euclidPulsesEl.value) || 0));
  euclidPulsesEl.max = String(steps);
  if (Number(euclidPulsesEl.value) !== pulses) euclidPulsesEl.value = String(pulses);
  return euclideanPattern(steps, pulses, Number(euclidRotateEl.value) || 0);
}
function renderPreviews(message = '') {
  $('patternPreview').textContent = patternPreview(currentPresetMask(), 16);
  const euclid = currentEuclidMask();
  $('euclidPreview').textContent = `E(${euclid.filter(Boolean).length},${euclid.length}) · ${patternPreview(euclid, 24)}`;
  const { scene, track, slot } = currentContext();
  statusEl.textContent = message || `Scene ${scene + 1} · ${trackLabel(track)} · Pattern ${slot} · preset ${getPatternPreset(presetEl.value).name}`;
  writeUi();
}
function loadContextUi(message = '') {
  const saved = readUi();
  presetEl.value = getPatternPreset(saved.preset).id;
  rotateEl.value = String(saved.rotate ?? 0);
  scopeEl.value = saved.scope === 'TRACK' ? 'TRACK' : 'PAGE';
  modeEl.value = saved.mode === 'MERGE' ? 'MERGE' : 'REPLACE';
  euclidStepsEl.value = String(Math.max(1, Math.min(64, Number(saved.euclidSteps) || 16)));
  euclidPulsesEl.value = String(Math.max(0, Math.min(Number(euclidStepsEl.value), Number(saved.euclidPulses) || 5)));
  euclidRotateEl.value = String(saved.euclidRotate ?? 0);
  renderPreviews(message);
}

function apply(mask, label) {
  document.getElementById('stop')?.click();
  const state = readMusicalState();
  const track = state.selectedTrack;
  const { scene, slot } = currentContext();
  state.steps[track] = applyPatternToSteps(state.steps[track], state.trackLengths[track], state.page, mask, scopeEl.value, modeEl.value);
  writeMusicalState(state);
  writeUi();
  statusEl.textContent = `${label} → Scene ${scene + 1} · ${trackLabel(track)} · Pattern ${slot}. Reloading view…`;
  setTimeout(() => location.reload(), 90);
}

$('patternApply').onclick = () => apply(currentPresetMask(), getPatternPreset(presetEl.value).name);
$('euclidApply').onclick = () => {
  const mask = currentEuclidMask();
  apply(mask, `Euclidean E(${mask.filter(Boolean).length},${mask.length})`);
};
for (const el of [presetEl, rotateEl, scopeEl, modeEl, euclidStepsEl, euclidPulsesEl, euclidRotateEl]) {
  el.addEventListener('change', () => renderPreviews());
  el.addEventListener('input', () => renderPreviews());
}
window.addEventListener('saibertin:scene-recalled', () => loadContextUi('Pattern preset context updated for recalled scene.'));
loadContextUi();
