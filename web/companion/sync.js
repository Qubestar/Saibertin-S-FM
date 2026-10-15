import { restoreState, sequenceEventsAtTick, MIDI_PORTS } from './model.js';
import {
  MIDI_CLOCK, MIDI_START, MIDI_CONTINUE, MIDI_STOP,
  CLOCKS_PER_16TH, clockIntervalMs, stepIntervalMs,
  isSixteenthBoundary, bpmFromClockIntervals, normalizeClockOutPorts,
} from './sync-model.js';

const STORAGE_KEY = 'saibertin-s-fm-companion-v1';
const SYNC_KEY = 'saibertin-s-fm-sync-v1';
const OUTPUT_MAP_KEY = 'saibertin-s-fm-output-map-v1';
const $ = (id) => document.getElementById(id);

const defaults = {
  source: 'INTERNAL',
  inputId: '',
  clockOutPorts: [true, false, false, false],
  sendTransport: true,
};

function loadSync() {
  try {
    const raw = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null') || {};
    return {
      source: raw.source === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
      inputId: typeof raw.inputId === 'string' ? raw.inputId : '',
      clockOutPorts: normalizeClockOutPorts(raw.clockOutPorts, MIDI_PORTS.length),
      sendTransport: raw.sendTransport !== false,
    };
  } catch { return { ...defaults, clockOutPorts: [...defaults.clockOutPorts] }; }
}
function saveSync() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(settings)); } catch {} }
function loadMusicalState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return restoreState(raw?.state ?? raw);
  } catch { return restoreState(null); }
}
function loadOutputIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(OUTPUT_MAP_KEY) || 'null');
    return Array.from({ length: MIDI_PORTS.length }, (_, i) => typeof raw?.[i] === 'string' ? raw[i] : '');
  } catch { return Array(MIDI_PORTS.length).fill(''); }
}

let settings = loadSync();
let midi = null;
let selectedInput = null;
let externalRunning = false;
let externalClockCount = 0;
let externalTick = 0;
let lastClockAt = null;
let clockIntervals = [];
let detectedBpm = null;
let clockOutRunning = false;
let clockOutTimer = null;
let nextClockAt = 0;
const noteTimers = new Set();
const activeNotes = new Map();
const usedRoutes = new Map();

function ensurePanel() {
  if ($('syncPanel')) return;
  const transport = document.querySelector('.box.transport');
  if (!transport) return;
  const panel = document.createElement('div');
  panel.className = 'box';
  panel.id = 'syncPanel';
  panel.style.marginTop = '14px';
  panel.innerHTML = `
    <div class="label">MIDI CLOCK / SYNC · 24 PPQN</div>
    <div class="row" style="margin-top:8px">
      <label>Clock source <select id="syncSource"><option value="INTERNAL">INTERNAL</option><option value="EXTERNAL">EXTERNAL MIDI</option></select></label>
      <label>Clock input <select id="syncInput"><option value="">No MIDI input</option></select></label>
      <label><input id="syncTransport" type="checkbox" checked> Start/Stop out</label>
      <strong class="status" id="syncBpm">INT 120.0 BPM</strong>
    </div>
    <div class="row" style="margin-top:8px">
      <span class="label">Clock out</span>
      ${MIDI_PORTS.map((p, i) => `<label><input type="checkbox" id="syncOut${p}" data-port="${i}"> PORT ${p}</label>`).join('')}
      <span class="status" id="syncStatus">Internal master</span>
    </div>`;
  transport.insertAdjacentElement('afterend', panel);

  $('syncSource').onchange = async () => {
    const nextSource = $('syncSource').value === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL';
    const previousSource = settings.source;
    if (previousSource === 'INTERNAL' && nextSource === 'EXTERNAL' && $('stop')) $('stop').click();
    settings.source = nextSource;
    saveSync();
    await ensureMidi();
    if (settings.source === 'EXTERNAL') stopClockOut(false);
    else stopExternal({ panic: true });
    refreshUi();
  };
  $('syncInput').onchange = () => { settings.inputId = $('syncInput').value; saveSync(); bindInput(); refreshUi(); };
  $('syncTransport').onchange = () => { settings.sendTransport = $('syncTransport').checked; saveSync(); };
  MIDI_PORTS.forEach((p, i) => {
    $(`syncOut${p}`).onchange = () => { settings.clockOutPorts[i] = $(`syncOut${p}`).checked; saveSync(); refreshUi(); };
  });
  refreshUi();
}

async function ensureMidi() {
  if (midi || !navigator.requestMIDIAccess) return midi;
  try {
    midi = await navigator.requestMIDIAccess({ sysex: false });
    midi.onstatechange = () => { refreshInputs(); bindInput(); refreshUi(); };
    refreshInputs();
    bindInput();
  } catch {}
  return midi;
}

function refreshInputs() {
  const select = $('syncInput');
  if (!select) return;
  const current = settings.inputId;
  select.replaceChildren(new Option('No MIDI input', ''));
  if (midi) for (const input of midi.inputs.values()) select.add(new Option(input.name || input.id, input.id));
  if (midi && [...midi.inputs.values()].some((i) => i.id === current)) select.value = current;
  else select.value = '';
}

function bindInput() {
  if (!midi) return;
  for (const input of midi.inputs.values()) input.onmidimessage = null;
  selectedInput = settings.inputId ? midi.inputs.get(settings.inputId) : null;
  if (selectedInput) selectedInput.onmidimessage = onMidiMessage;
}

function outputsByPort() {
  const ids = loadOutputIds();
  return ids.map((id) => midi && id ? midi.outputs.get(id) || null : null);
}
function sendRealtime(byte) {
  const outs = outputsByPort();
  settings.clockOutPorts.forEach((enabled, port) => {
    if (enabled && outs[port]) outs[port].send([byte]);
  });
}

function currentTempo() {
  const n = Number($('tempo')?.value || 120);
  return Number.isFinite(n) ? Math.max(20, Math.min(400, n)) : 120;
}

function startClockOut(sendStart = true) {
  if (settings.source !== 'INTERNAL' || clockOutRunning) return;
  clockOutRunning = true;
  if (sendStart && settings.sendTransport) sendRealtime(MIDI_START);
  nextClockAt = performance.now();
  scheduleClockOut();
  refreshUi();
}
function scheduleClockOut() {
  if (!clockOutRunning) return;
  const now = performance.now();
  const horizon = now + 60;
  const outputs = outputsByPort();
  while (nextClockAt <= horizon) {
    settings.clockOutPorts.forEach((enabled, port) => {
      if (enabled && outputs[port]) outputs[port].send([MIDI_CLOCK], nextClockAt);
    });
    nextClockAt += clockIntervalMs(currentTempo());
  }
  clockOutTimer = setTimeout(scheduleClockOut, 15);
}
function stopClockOut(sendStop = true) {
  clockOutRunning = false;
  if (clockOutTimer) clearTimeout(clockOutTimer);
  clockOutTimer = null;
  if (sendStop && settings.sendTransport) sendRealtime(MIDI_STOP);
  refreshUi();
}

function routeKey(event) { return `${event.port}:${event.channel}`; }
function outputForPort(port) { return outputsByPort()[port] || null; }
function trackedTimer(fn, delay) {
  const t = setTimeout(() => { noteTimers.delete(t); fn(); }, Math.max(0, delay));
  noteTimers.add(t);
  return t;
}
function fireExternalHit(event, hitSpan) {
  if (!event.emitMidi || event.channel === null) return;
  const output = outputForPort(event.port);
  if (!output) return;
  const key = `${event.track}`;
  const prior = activeNotes.get(key);
  if (prior) {
    const oldOut = outputForPort(prior.port);
    if (oldOut) oldOut.send([0x80 | prior.channel, prior.note & 127, 0]);
  }
  output.send([0x90 | event.channel, event.note & 127, event.velocity & 127]);
  usedRoutes.set(routeKey(event), { port: event.port, channel: event.channel });
  const token = { ...event };
  activeNotes.set(key, token);
  const gateMs = Math.max(4, Math.min(hitSpan * 0.9, hitSpan * (event.gate / 100)));
  trackedTimer(() => {
    if (activeNotes.get(key) !== token) return;
    output.send([0x80 | event.channel, event.note & 127, 0]);
    activeNotes.delete(key);
  }, gateMs);
}
function scheduleExternalEvent(event, baseDelay, stepMs) {
  if (!event.emitMidi || event.channel === null) return;
  const delay = Math.max(0, baseDelay + stepMs * ((event.micro || 0) / 100));
  trackedTimer(() => {
    const output = outputForPort(event.port);
    if (!externalRunning || !output) return;
    for (const lock of event.ccLocks || []) output.send([0xB0 | event.channel, lock.cc & 127, lock.value & 127]);
    const hits = Math.max(1, Math.min(4, event.ratchet || 1));
    const span = stepMs / hits;
    for (let i = 0; i < hits; i++) trackedTimer(() => { if (externalRunning) fireExternalHit(event, span); }, i * span);
  }, delay);
}
function planExternalTick(tick, baseDelay = 0) {
  const state = loadMusicalState();
  const bpm = detectedBpm || currentTempo();
  const stepMs = stepIntervalMs(bpm);
  const events = sequenceEventsAtTick(state, tick);
  for (const event of events) scheduleExternalEvent(event, baseDelay, stepMs);
}
function showExternalTick(tick) {
  updateExternalPlayhead(loadMusicalState(), tick);
}
function planNextExternalTick(fromNowMs = null) {
  const bpm = detectedBpm || currentTempo();
  const delay = fromNowMs === null ? stepIntervalMs(bpm) : Math.max(0, fromNowMs);
  planExternalTick(externalTick + 1, delay);
}

function updateExternalPlayhead(state, tick) {
  const track = state.selectedTrack;
  const len = state.trackLengths[track] || 64;
  const step = tick % len;
  const pos = $('playPos');
  if (pos) pos.textContent = `${MIDI_PORTS[Math.floor(track / 16)]}${String((track % 16) + 1).padStart(2,'0')} ${String(step + 1).padStart(2,'0')}/${len}`;
  const play = $('play');
  if (play) play.classList.toggle('transport-on', externalRunning);
  if (state.mode === 'SEQ') {
    const page = Math.floor(step / 16);
    const visible = step % 16;
    if (state.follow && state.page !== page) {
      const next = $('pageNext');
      if (next) {
        let guard = 0;
        let view = loadMusicalState();
        while (view.page !== page && guard++ < 4) { next.click(); view = loadMusicalState(); }
        state = view;
      }
    }
    const surface = $('surface');
    if (surface && state.page === page) [...surface.children].forEach((b, i) => b.classList.toggle('playhead', i === visible));
  }
}

function panicExternal() {
  for (const timer of noteTimers) clearTimeout(timer);
  noteTimers.clear();
  for (const note of activeNotes.values()) {
    const output = outputForPort(note.port);
    if (output) output.send([0x80 | note.channel, note.note & 127, 0]);
  }
  activeNotes.clear();
  for (const route of usedRoutes.values()) {
    const output = outputForPort(route.port);
    if (output) output.send([0xB0 | route.channel, 123, 0]);
  }
  usedRoutes.clear();
}
function stopExternal({ panic = true } = {}) {
  externalRunning = false;
  if (panic) panicExternal();
  const play = $('play');
  if (play) play.classList.remove('transport-on');
  refreshUi();
}

function onMidiMessage(event) {
  if (settings.source !== 'EXTERNAL') return;
  const byte = event.data?.[0];
  const now = event.receivedTime || performance.now();
  if (byte === MIDI_START) {
    panicExternal();
    externalClockCount = 0;
    externalTick = 0;
    clockIntervals = [];
    lastClockAt = null;
    externalRunning = true;
    planExternalTick(0, 0);
    showExternalTick(0);
    planNextExternalTick();
    refreshUi();
    return;
  }
  if (byte === MIDI_CONTINUE) {
    externalRunning = true;
    const remainder = externalClockCount % CLOCKS_PER_16TH;
    const remaining = remainder === 0 ? CLOCKS_PER_16TH : CLOCKS_PER_16TH - remainder;
    const pulseMs = detectedBpm ? clockIntervalMs(detectedBpm) : clockIntervalMs(currentTempo());
    planNextExternalTick(remaining * pulseMs);
    refreshUi();
    return;
  }
  if (byte === MIDI_STOP) { stopExternal({ panic: true }); return; }
  if (byte !== MIDI_CLOCK) return;

  if (lastClockAt !== null) {
    const delta = now - lastClockAt;
    if (delta > 1 && delta < 1000) {
      clockIntervals.push(delta);
      if (clockIntervals.length > 24) clockIntervals.shift();
      detectedBpm = bpmFromClockIntervals(clockIntervals, detectedBpm || currentTempo());
    }
  }
  lastClockAt = now;
  externalClockCount += 1;
  if (externalRunning && isSixteenthBoundary(externalClockCount)) {
    externalTick += 1;
    showExternalTick(externalTick);
    planNextExternalTick();
  }
  refreshUi();
}

function refreshUi() {
  ensurePanel();
  if (!$('syncPanel')) return;
  $('syncSource').value = settings.source;
  $('syncTransport').checked = settings.sendTransport;
  MIDI_PORTS.forEach((p, i) => { $(`syncOut${p}`).checked = settings.clockOutPorts[i]; });
  $('syncInput').disabled = settings.source !== 'EXTERNAL';
  const bpm = settings.source === 'EXTERNAL' ? (detectedBpm ? detectedBpm.toFixed(1) : '---') : currentTempo().toFixed(1);
  $('syncBpm').textContent = `${settings.source === 'EXTERNAL' ? 'EXT' : 'INT'} ${bpm} BPM`;
  const outNames = settings.clockOutPorts.map((v, i) => v ? MIDI_PORTS[i] : null).filter(Boolean).join(', ') || 'none';
  $('syncStatus').textContent = settings.source === 'EXTERNAL'
    ? `${externalRunning ? 'External running' : 'Waiting for Start'} · ${selectedInput ? (selectedInput.name || 'input') : 'no input selected'}`
    : `Internal master · clock out: ${outNames}`;
}

function hookTransport() {
  const play = $('play');
  const stop = $('stop');
  if (!play || !stop || play.dataset.syncHooked) return;
  play.dataset.syncHooked = '1';
  const appPlay = play.onclick;
  const appStop = stop.onclick;
  play.onclick = async (event) => {
    await ensureMidi();
    if (settings.source === 'EXTERNAL') {
      event?.preventDefault?.();
      refreshUi();
      return;
    }
    appPlay?.call(play, event);
    startClockOut(true);
  };
  stop.onclick = (event) => {
    if (settings.source === 'EXTERNAL') {
      stopExternal({ panic: true });
      return;
    }
    appStop?.call(stop, event);
    stopClockOut(true);
  };
}

const connect = $('connect');
if (connect) connect.addEventListener('click', () => setTimeout(async () => { await ensureMidi(); refreshInputs(); bindInput(); refreshUi(); }, 0));
window.addEventListener('beforeunload', () => { stopClockOut(false); stopExternal({ panic: true }); });

ensurePanel();
hookTransport();
refreshUi();
