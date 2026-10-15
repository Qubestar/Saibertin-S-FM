import {
  PERFORMANCE_RATES, ARP_MODES, performanceRateMs, normalizePerformanceNotes, arpNoteAt,
} from './performance-model.js';

const STORAGE_KEY = 'saibertin-s-fm-performance-v1';
const PORTS = ['A', 'B', 'C', 'D'];
const surface = document.getElementById('surface');
const modes = document.getElementById('modes');

if (!surface || !modes) throw new Error('Saibertin performance layer requires the Browser Companion surface');

function defaultSettings() {
  return {
    repeatEnabled: false,
    repeatMode: 'HOLD',
    repeatRate: '1/16',
    repeatTriplet: false,
    arpEnabled: false,
    arpMode: 'UP',
    arpRate: '1/16',
    arpTriplet: false,
    arpOctaves: 1,
    arpHold: false,
    gate: 55,
  };
}

function loadSettings() {
  const out = defaultSettings();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return out;
    out.repeatEnabled = Boolean(raw.repeatEnabled);
    out.repeatMode = raw.repeatMode === 'LATCH' ? 'LATCH' : 'HOLD';
    out.repeatRate = PERFORMANCE_RATES.includes(raw.repeatRate) ? raw.repeatRate : '1/16';
    out.repeatTriplet = Boolean(raw.repeatTriplet);
    out.arpEnabled = Boolean(raw.arpEnabled);
    out.arpMode = ARP_MODES.includes(raw.arpMode) ? raw.arpMode : 'UP';
    out.arpRate = PERFORMANCE_RATES.includes(raw.arpRate) ? raw.arpRate : '1/16';
    out.arpTriplet = Boolean(raw.arpTriplet);
    out.arpOctaves = Math.max(1, Math.min(4, Math.round(Number(raw.arpOctaves) || 1)));
    out.arpHold = Boolean(raw.arpHold);
    out.gate = Math.max(5, Math.min(95, Math.round(Number(raw.gate) || 55)));
  } catch {}
  if (out.repeatEnabled && out.arpEnabled) out.arpEnabled = false;
  return out;
}

let settings = loadSettings();
let midiAccess = null;
let repeatTimer = null;
let arpTimer = null;
let arpIndex = 0;
let arpRoute = null;
const repeatPads = new Map();
const arpPads = new Map();
const pointers = new Map();
const noteOffTimers = new Set();
const activeNotes = new Set();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

function installStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .performance-panel{margin-top:14px}
    .performance-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
    .performance-unit{background:#17191e;border:1px solid var(--line);border-radius:9px;padding:10px}
    .performance-unit .row{margin-top:8px}
    .performance-toggle{min-width:118px;font-weight:800}
    .performance-toggle.on{background:var(--active);border-color:var(--active);color:#111}
    .performance-status{margin-top:8px;color:var(--muted);font-size:12px}
    .key.performance-latched{box-shadow:0 0 0 4px #b88cff inset}
    @media(max-width:760px){.performance-grid{grid-template-columns:1fr}}
  `;
  document.head.append(style);
}

function makePanel() {
  const panel = document.createElement('div');
  panel.id = 'performancePanel';
  panel.className = 'box performance-panel';
  panel.innerHTML = `
    <div class="label">Performance · live pads / keys</div>
    <div class="performance-grid">
      <div class="performance-unit">
        <div class="row">
          <button class="btn performance-toggle" id="perfRepeat">NOTE REPEAT</button>
          <label>Mode <select id="perfRepeatMode"><option>HOLD</option><option>LATCH</option></select></label>
          <label>Rate <select id="perfRepeatRate"></select></label>
          <label><input id="perfRepeatTriplet" type="checkbox"> Triplet</label>
        </div>
      </div>
      <div class="performance-unit">
        <div class="row">
          <button class="btn performance-toggle" id="perfArp">ARP</button>
          <label>Mode <select id="perfArpMode"></select></label>
          <label>Rate <select id="perfArpRate"></select></label>
          <label>Oct <select id="perfArpOct"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
          <label><input id="perfArpTriplet" type="checkbox"> Triplet</label>
          <label><input id="perfArpHold" type="checkbox"> Hold</label>
        </div>
      </div>
    </div>
    <div class="row" style="margin-top:10px">
      <label>Gate % <input class="mini" id="perfGate" type="number" min="5" max="95"></label>
      <button class="btn" id="perfClear">Clear latch / held notes</button>
      <span class="performance-status" id="perfStatus"></span>
    </div>
  `;
  surface.parentNode.insertBefore(panel, surface);

  const rateOptions = PERFORMANCE_RATES.map((rate) => `<option value="${rate}">${rate}</option>`).join('');
  panel.querySelector('#perfRepeatRate').innerHTML = rateOptions;
  panel.querySelector('#perfArpRate').innerHTML = rateOptions;
  panel.querySelector('#perfArpMode').innerHTML = ARP_MODES.map((mode) => `<option value="${mode}">${mode}</option>`).join('');
  return panel;
}

installStyles();
const panel = makePanel();
const $p = (id) => panel.querySelector(`#${id}`);

function currentMode() {
  return [...modes.querySelectorAll('button')].find((button) => button.classList.contains('active'))?.textContent?.trim() || 'SEQ';
}

function selectedRouteSnapshot() {
  const target = document.getElementById('trackTarget')?.value || 'MIDI';
  if (target === 'INTERNAL') return null;
  const port = Number(document.getElementById('midiPort')?.value ?? 0);
  const channelUi = Number(document.getElementById('channel')?.value ?? 0);
  if (!Number.isInteger(port) || port < 0 || port >= PORTS.length || channelUi < 1 || channelUi > 16) return null;
  const outputId = document.getElementById(`output${PORTS[port]}`)?.value || '';
  return { port, channel: channelUi - 1, outputId };
}

async function ensureMidiAccess() {
  if (midiAccess) return midiAccess;
  if (!navigator.requestMIDIAccess) return null;
  try { midiAccess = await navigator.requestMIDIAccess({ sysex: false }); } catch { midiAccess = null; }
  return midiAccess;
}

async function outputFor(route) {
  if (!route?.outputId) return null;
  const access = await ensureMidiAccess();
  return access?.outputs?.get(route.outputId) || null;
}

function noteKey(route, note) {
  return `${route?.outputId || '-'}:${route?.channel ?? -1}:${note}`;
}

async function sendNoteOn(route, note, velocity = 100) {
  const output = await outputFor(route);
  if (!output || !route || route.channel < 0) return;
  output.send([0x90 | route.channel, note & 127, velocity & 127]);
  activeNotes.add(noteKey(route, note));
}

async function sendNoteOff(route, note) {
  const output = await outputFor(route);
  if (!output || !route || route.channel < 0) return;
  output.send([0x80 | route.channel, note & 127, 0]);
  activeNotes.delete(noteKey(route, note));
}

function trackedOff(route, note, delay) {
  const timer = setTimeout(() => {
    noteOffTimers.delete(timer);
    sendNoteOff(route, note);
  }, Math.max(5, delay));
  noteOffTimers.add(timer);
}

function performanceHit(route, notes, spanMs) {
  if (!route) return;
  const gateMs = Math.max(8, spanMs * (settings.gate / 100));
  for (const note of normalizePerformanceNotes(notes)) {
    sendNoteOn(route, note, 100);
    trackedOff(route, note, gateMs);
  }
}

function parseNoteName(token) {
  const m = /^([A-G])(#?)(-?\d+)$/.exec(token.trim());
  if (!m) return null;
  const pcs = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = (Number(m[3]) + 1) * 12 + pcs[m[1]] + (m[2] ? 1 : 0);
  return midi >= 0 && midi <= 127 ? midi : null;
}

function notesForButton(button) {
  const tokens = (button?.innerText || '').split(/\s+/).filter(Boolean);
  if (currentMode() === 'DRUM') {
    const nums = tokens.map(Number).filter((v) => Number.isInteger(v) && v >= 0 && v <= 127);
    return nums.length ? [nums[nums.length - 1]] : [];
  }
  return normalizePerformanceNotes(tokens.map(parseNoteName).filter((n) => n !== null));
}

function padId(button) {
  return String([...surface.children].indexOf(button));
}

function clearNoteOffTimers() {
  for (const timer of noteOffTimers) clearTimeout(timer);
  noteOffTimers.clear();
}

async function panicPerformance() {
  clearNoteOffTimers();
  const routes = [...repeatPads.values(), ...arpPads.values()].map((entry) => entry.route).filter(Boolean);
  const uniqueRoutes = new Map(routes.map((route) => [`${route.outputId}:${route.channel}`, route]));
  for (const route of uniqueRoutes.values()) {
    const output = await outputFor(route);
    if (output) output.send([0xB0 | route.channel, 123, 0]);
  }
  activeNotes.clear();
}

function stopRepeat({ clearPads = true } = {}) {
  if (repeatTimer) clearTimeout(repeatTimer);
  repeatTimer = null;
  if (clearPads) repeatPads.clear();
}

function stopArp({ clearPads = true } = {}) {
  if (arpTimer) clearTimeout(arpTimer);
  arpTimer = null;
  arpIndex = 0;
  arpRoute = null;
  if (clearPads) arpPads.clear();
}

function stopPerformance() {
  stopRepeat();
  stopArp();
  pointers.clear();
  panicPerformance();
  refreshPadVisuals();
  renderPerformance();
}

function repeatSpan() {
  return performanceRateMs(Number(document.getElementById('tempo')?.value || 120), settings.repeatRate, settings.repeatTriplet);
}

function arpSpan() {
  return performanceRateMs(Number(document.getElementById('tempo')?.value || 120), settings.arpRate, settings.arpTriplet);
}

function repeatTick() {
  repeatTimer = null;
  if (!settings.repeatEnabled || repeatPads.size === 0 || currentMode() === 'SEQ') return;
  const span = repeatSpan();
  for (const entry of repeatPads.values()) performanceHit(entry.route, entry.notes, span);
  repeatTimer = setTimeout(repeatTick, span);
}

function ensureRepeatLoop({ immediate = true } = {}) {
  if (repeatTimer || !settings.repeatEnabled || repeatPads.size === 0) return;
  if (immediate) repeatTick();
  else repeatTimer = setTimeout(repeatTick, repeatSpan());
}

function arpNotes() {
  return normalizePerformanceNotes([...arpPads.values()].flatMap((entry) => entry.notes));
}

function arpTick() {
  arpTimer = null;
  const notes = arpNotes();
  if (!settings.arpEnabled || !notes.length || currentMode() === 'SEQ') return;
  const span = arpSpan();
  const note = arpNoteAt(notes, arpIndex++, settings.arpMode, settings.arpOctaves);
  if (note !== null) performanceHit(arpRoute, [note], span);
  arpTimer = setTimeout(arpTick, span);
}

function ensureArpLoop({ immediate = true } = {}) {
  if (arpTimer || !settings.arpEnabled || !arpNotes().length) return;
  if (immediate) arpTick();
  else arpTimer = setTimeout(arpTick, arpSpan());
}

function refreshPadVisuals() {
  [...surface.children].forEach((button, index) => {
    const id = String(index);
    button.classList.toggle('performance-latched', repeatPads.has(id) || arpPads.has(id));
  });
}

function addOrToggleRepeat(button, route, notes, pointerId) {
  const id = padId(button);
  if (settings.repeatMode === 'LATCH') {
    if (repeatPads.has(id)) repeatPads.delete(id);
    else repeatPads.set(id, { route, notes });
  } else {
    repeatPads.set(id, { route, notes });
    pointers.set(pointerId, { kind: 'repeat', id });
  }
  refreshPadVisuals();
  if (repeatPads.size) ensureRepeatLoop();
  else stopRepeat({ clearPads: false });
}

function addOrToggleArp(button, route, notes, pointerId) {
  const id = padId(button);
  arpRoute = route;
  if (settings.arpHold) {
    if (arpPads.has(id)) arpPads.delete(id);
    else arpPads.set(id, { route, notes });
  } else {
    arpPads.set(id, { route, notes });
    pointers.set(pointerId, { kind: 'arp', id });
  }
  refreshPadVisuals();
  if (arpPads.size) ensureArpLoop();
  else stopArp({ clearPads: false });
}

function handleSurfaceDown(event) {
  if (currentMode() === 'SEQ' || (!settings.repeatEnabled && !settings.arpEnabled)) return;
  const button = event.target.closest('button.key');
  if (!button || button.disabled) return;
  const notes = notesForButton(button);
  const route = selectedRouteSnapshot();
  if (!notes.length || !route) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.classList.add('playing');
  if (settings.repeatEnabled) addOrToggleRepeat(button, route, notes, event.pointerId);
  else if (settings.arpEnabled) addOrToggleArp(button, route, notes, event.pointerId);
  renderPerformance();
}

function handlePointerUp(event) {
  const pointer = pointers.get(event.pointerId);
  if (!pointer) return;
  pointers.delete(event.pointerId);
  if (pointer.kind === 'repeat' && settings.repeatMode !== 'LATCH') {
    repeatPads.delete(pointer.id);
    if (!repeatPads.size) stopRepeat({ clearPads: false });
  }
  if (pointer.kind === 'arp' && !settings.arpHold) {
    arpPads.delete(pointer.id);
    if (!arpPads.size) stopArp({ clearPads: false });
  }
  refreshPadVisuals();
  renderPerformance();
}

function renderPerformance() {
  const seq = currentMode() === 'SEQ';
  panel.style.opacity = seq ? '0.58' : '1';
  $p('perfRepeat').classList.toggle('on', settings.repeatEnabled);
  $p('perfArp').classList.toggle('on', settings.arpEnabled);
  $p('perfRepeat').textContent = settings.repeatEnabled ? 'NOTE REPEAT · ON' : 'NOTE REPEAT';
  $p('perfArp').textContent = settings.arpEnabled ? 'ARP · ON' : 'ARP';
  $p('perfRepeatMode').value = settings.repeatMode;
  $p('perfRepeatRate').value = settings.repeatRate;
  $p('perfRepeatTriplet').checked = settings.repeatTriplet;
  $p('perfArpMode').value = settings.arpMode;
  $p('perfArpRate').value = settings.arpRate;
  $p('perfArpTriplet').checked = settings.arpTriplet;
  $p('perfArpOct').value = String(settings.arpOctaves);
  $p('perfArpHold').checked = settings.arpHold;
  $p('perfGate').value = String(settings.gate);
  const route = selectedRouteSnapshot();
  const routeText = route ? `PORT ${PORTS[route.port]} · CH ${route.channel + 1}${route.outputId ? '' : ' · no output mapped'}` : 'MIDI route unavailable / INTERNAL target';
  const active = settings.repeatEnabled ? `${repeatPads.size} repeat pad(s)` : settings.arpEnabled ? `${arpNotes().length} arp note(s)` : 'performance off';
  $p('perfStatus').textContent = seq ? 'Switch to KEYS / SCALE / CHORD / DRUM for live performance.' : `${routeText} · ${active}`;
}

function setRepeatEnabled(enabled) {
  settings.repeatEnabled = Boolean(enabled);
  if (settings.repeatEnabled) {
    settings.arpEnabled = false;
    stopArp();
  } else stopRepeat();
  persist();
  panicPerformance();
  refreshPadVisuals();
  renderPerformance();
}

function setArpEnabled(enabled) {
  settings.arpEnabled = Boolean(enabled);
  if (settings.arpEnabled) {
    settings.repeatEnabled = false;
    stopRepeat();
  } else stopArp();
  persist();
  panicPerformance();
  refreshPadVisuals();
  renderPerformance();
}

$p('perfRepeat').onclick = () => setRepeatEnabled(!settings.repeatEnabled);
$p('perfArp').onclick = () => setArpEnabled(!settings.arpEnabled);
$p('perfRepeatMode').onchange = () => { stopRepeat(); settings.repeatMode = $p('perfRepeatMode').value; persist(); refreshPadVisuals(); renderPerformance(); };
$p('perfRepeatRate').onchange = () => { settings.repeatRate = $p('perfRepeatRate').value; if (repeatTimer) { clearTimeout(repeatTimer); repeatTimer = null; ensureRepeatLoop({ immediate: false }); } persist(); };
$p('perfRepeatTriplet').onchange = () => { settings.repeatTriplet = $p('perfRepeatTriplet').checked; if (repeatTimer) { clearTimeout(repeatTimer); repeatTimer = null; ensureRepeatLoop({ immediate: false }); } persist(); };
$p('perfArpMode').onchange = () => { settings.arpMode = $p('perfArpMode').value; arpIndex = 0; persist(); };
$p('perfArpRate').onchange = () => { settings.arpRate = $p('perfArpRate').value; if (arpTimer) { clearTimeout(arpTimer); arpTimer = null; ensureArpLoop({ immediate: false }); } persist(); };
$p('perfArpTriplet').onchange = () => { settings.arpTriplet = $p('perfArpTriplet').checked; if (arpTimer) { clearTimeout(arpTimer); arpTimer = null; ensureArpLoop({ immediate: false }); } persist(); };
$p('perfArpOct').onchange = () => { settings.arpOctaves = Math.max(1, Math.min(4, Number($p('perfArpOct').value) || 1)); arpIndex = 0; persist(); };
$p('perfArpHold').onchange = () => { stopArp(); settings.arpHold = $p('perfArpHold').checked; persist(); refreshPadVisuals(); renderPerformance(); };
$p('perfGate').onchange = () => { settings.gate = Math.max(5, Math.min(95, Math.round(Number($p('perfGate').value) || 55))); $p('perfGate').value = String(settings.gate); persist(); };
$p('perfClear').onclick = stopPerformance;

surface.addEventListener('pointerdown', handleSurfaceDown, true);
document.addEventListener('pointerup', handlePointerUp, true);
document.addEventListener('pointercancel', handlePointerUp, true);

for (const id of ['modes', 'tracks', 'trackBanks']) {
  document.getElementById(id)?.addEventListener('click', () => stopPerformance(), true);
}
for (const id of ['trackTarget', 'midiPort', 'channel', 'outputA', 'outputB', 'outputC', 'outputD']) {
  document.getElementById(id)?.addEventListener('change', () => stopPerformance(), true);
}

new MutationObserver(() => {
  refreshPadVisuals();
  renderPerformance();
}).observe(surface, { childList: true });
new MutationObserver(renderPerformance).observe(modes, { subtree: true, attributes: true, attributeFilter: ['class'] });

window.addEventListener('blur', () => {
  if (settings.repeatMode !== 'LATCH' && !settings.arpHold) stopPerformance();
});
window.addEventListener('beforeunload', () => { stopPerformance(); });

renderPerformance();
