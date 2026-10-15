import {
  MODES, SCALES, ROOTS, DEGREE_NAMES, DRUMS, TRACK_TARGETS, INTERNAL_ENGINES,
  TRACK_COUNT, TRACK_BANK_SIZE, TRACK_BANKS, MIDI_PORTS,
  createState, restoreState, snapshotState,
  setCc, ccNumber, setCcNumber, setDrumNote, setSeqNote, setTempo, setMidiPort,
  setTrackLength, setTrackTarget, setInternalEngine, setInternalSound, trackLocalStep, maxPageForTrack,
  trackBankIndex, trackSlotIndex, trackLabel, canUseInternal,
  toggleStep, setStepEnabled, visibleStep, stepParam, effectiveStepNote, setStepParam, setStepCcLock,
  scaleNote, chordNotes, noteName, stepDurationMs, sequenceEventsAtTick,
} from './model.js';

const STORAGE_KEY = 'saibertin-s-fm-companion-v1';
const OUTPUT_MAP_KEY = 'saibertin-s-fm-output-map-v1';
let state = loadState();
let midi = null;
let outputMap = loadOutputMap();
const outputs = Array(MIDI_PORTS.length).fill(null);
const held = new Map();

let playing = false;
let transportTick = -1;
let playhead = -1;
let selectedStep = Math.min(state.page * 16, state.trackLengths[state.selectedTrack] - 1);
let plannerTimer = null;
const seqActive = new Map();
const seqTimers = new Set();

const $ = (id) => document.getElementById(id);
const modesEl = $('modes');
const trackBanksEl = $('trackBanks');
const tracksEl = $('tracks');
const ccsEl = $('ccs');
const surfaceEl = $('surface');
const channelEl = $('channel');
const midiPortEl = $('midiPort');
const rootEl = $('root');
const scaleEl = $('scale');
const drumEditorEl = $('drumEditor');
const drumMapEl = $('drumMap');
const tempoEl = $('tempo');
const seqNoteEl = $('seqNote');
const followEl = $('follow');
const stepEditorEl = $('stepEditor');
const stepEnabledEl = $('stepEnabled');
const stepUseDefaultEl = $('stepUseDefault');
const stepNoteEl = $('stepNote');
const stepVelocityEl = $('stepVelocity');
const stepGateEl = $('stepGate');
const stepProbabilityEl = $('stepProbability');
const stepRatchetEl = $('stepRatchet');
const stepMicroEl = $('stepMicro');
const stepCcLocksEl = $('stepCcLocks');
const trackLengthEl = $('trackLength');
const trackTargetEl = $('trackTarget');
const internalEngineEl = $('internalEngine');
const internalSoundEl = $('internalSound');
const outputSelects = MIDI_PORTS.map((port) => $(`output${port}`));

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return restoreState(raw?.state ?? raw);
  } catch {
    return createState();
  }
}
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotState(state))); } catch {} }

function loadOutputMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(OUTPUT_MAP_KEY) || 'null');
    return Array.from({ length: MIDI_PORTS.length }, (_, i) => typeof raw?.[i] === 'string' ? raw[i] : '');
  } catch {
    return Array(MIDI_PORTS.length).fill('');
  }
}
function persistOutputMap() { try { localStorage.setItem(OUTPUT_MAP_KEY, JSON.stringify(outputMap)); } catch {} }

function midiChannel(track = state.selectedTrack) {
  const ch = state.channels[track];
  return ch >= 1 && ch <= 16 ? ch - 1 : null;
}
function midiPort(track = state.selectedTrack) {
  const port = Number(state.midiPorts[track]);
  return Number.isInteger(port) && port >= 0 && port < MIDI_PORTS.length ? port : 0;
}
function send(bytes, port = midiPort()) {
  const output = outputs[port];
  if (output) output.send(bytes);
}
function sendCc(slot, value) {
  const ch = midiChannel();
  if (ch === null || state.trackTargets[state.selectedTrack] === 'INTERNAL') return;
  send([0xB0 | ch, ccNumber(state, slot), value], midiPort());
}
function noteOn(note, velocity = 100, ch = midiChannel(), port = midiPort()) {
  if (ch !== null) send([0x90 | ch, note & 127, velocity & 127], port);
}
function noteOff(note, ch, port = midiPort()) {
  if (ch !== null && ch !== undefined) send([0x80 | ch, note & 127, 0], port);
}
function stopHeld(id) {
  const entry = held.get(id);
  if (!entry) return;
  entry.notes.forEach((note) => noteOff(note, entry.ch, entry.port));
  held.delete(id);
}
function stopAllHeld() { for (const id of [...held.keys()]) stopHeld(id); }
function startHeld(id, notes) {
  stopHeld(id);
  if (state.trackTargets[state.selectedTrack] === 'INTERNAL') return;
  const ch = midiChannel();
  const port = midiPort();
  if (ch === null) return;
  notes.forEach((note) => noteOn(note, 100, ch, port));
  held.set(id, { ch, port, notes: [...notes] });
}
function trackedTimeout(fn, delay) {
  const timer = setTimeout(() => { seqTimers.delete(timer); fn(); }, Math.max(0, delay));
  seqTimers.add(timer);
  return timer;
}
function stopSequencerNotes() {
  for (const timer of seqTimers) clearTimeout(timer);
  seqTimers.clear();
  plannerTimer = null;
  for (const event of seqActive.values()) if (event.emitMidi) noteOff(event.note, event.channel, event.port);
  seqActive.clear();
}
function fireSequenceHit(event, hitSpan) {
  if (!event.emitMidi) return;
  const prior = seqActive.get(event.track);
  if (prior?.emitMidi) noteOff(prior.note, prior.channel, prior.port);
  const hit = { ...event };
  noteOn(hit.note, hit.velocity, hit.channel, hit.port);
  seqActive.set(hit.track, hit);
  const gateMs = Math.max(4, Math.min(hitSpan * 0.9, hitSpan * (hit.gate / 100)));
  trackedTimeout(() => {
    const current = seqActive.get(hit.track);
    if (current === hit) {
      noteOff(hit.note, hit.channel, hit.port);
      seqActive.delete(hit.track);
    }
  }, gateMs);
}
function sendStepLocks(event) {
  if (!event.emitMidi || event.channel === null) return;
  for (const lock of event.ccLocks || []) send([0xB0 | event.channel, lock.cc & 127, lock.value & 127], event.port);
}
function scheduleSequenceEvent(event, nominalAt, stepMs) {
  const eventAt = nominalAt + stepMs * ((event.micro || 0) / 100);
  trackedTimeout(() => {
    if (!playing) return;
    sendStepLocks(event);
    const hits = Math.max(1, Math.min(4, event.ratchet || 1));
    const span = stepMs / hits;
    for (let i = 0; i < hits; i++) {
      if (i === 0) fireSequenceHit(event, span);
      else trackedTimeout(() => { if (playing) fireSequenceHit(event, span); }, i * span);
    }
  }, eventAt - performance.now());
}
function showPlayhead(tick) {
  if (!playing) return;
  transportTick = tick;
  playhead = trackLocalStep(state, state.selectedTrack, tick);
  if (state.follow) {
    const page = Math.floor(playhead / 16);
    if (page !== state.page) state.page = page;
  }
  renderTransport();
  renderScreen();
  if (state.mode === 'SEQ') renderSurface();
}
function planTransportTick(tick, nominalAt) {
  if (!playing) return;
  const stepMs = stepDurationMs(state.tempo);
  for (const event of sequenceEventsAtTick(state, tick)) scheduleSequenceEvent(event, nominalAt, stepMs);
  trackedTimeout(() => showPlayhead(tick), nominalAt - performance.now());
  const nextTick = tick + 1;
  const nextNominalAt = nominalAt + stepMs;
  const planAt = nominalAt + stepMs * 0.25;
  plannerTimer = trackedTimeout(() => planTransportTick(nextTick, nextNominalAt), planAt - performance.now());
}
function startTransport(startTick = 0) {
  if (playing) return;
  playing = true;
  transportTick = startTick - 1;
  playhead = -1;
  const stepMs = stepDurationMs(state.tempo);
  planTransportTick(Math.max(0, Math.floor(startTick)), performance.now() + stepMs * 0.55);
  renderTransport();
  renderScreen();
}
function stopTransport({ persistPage = true } = {}) {
  playing = false;
  stopSequencerNotes();
  transportTick = -1;
  playhead = -1;
  if (persistPage) persist();
  renderTransport();
  renderScreen();
  if (state.mode === 'SEQ') renderSurface();
}
function normalizeViewForTrack() {
  const maxPage = maxPageForTrack(state, state.selectedTrack);
  state.page = Math.min(state.page, maxPage);
  selectedStep = Math.min(Math.max(0, selectedStep), state.trackLengths[state.selectedTrack] - 1);
  if (selectedStep < state.page * 16 || selectedStep >= state.page * 16 + 16) selectedStep = state.page * 16;
}
function selectTrack(track) {
  stopAllHeld();
  state.selectedTrack = Math.max(0, Math.min(TRACK_COUNT - 1, track));
  normalizeViewForTrack();
  if (playing && transportTick >= 0) playhead = trackLocalStep(state, state.selectedTrack, transportTick);
  persist();
  render();
}

function renderModes() {
  modesEl.replaceChildren();
  MODES.forEach((mode) => {
    const b = document.createElement('button');
    b.className = `btn ${state.mode === mode ? 'active' : ''}`;
    b.textContent = mode;
    b.onclick = () => { stopAllHeld(); state.mode = mode; persist(); render(); };
    modesEl.append(b);
  });
}
function renderTrackBanks() {
  trackBanksEl.replaceChildren();
  const currentBank = trackBankIndex(state.selectedTrack);
  for (let bank = 0; bank < TRACK_BANKS.length; bank++) {
    const b = document.createElement('button');
    b.className = `btn bank ${currentBank === bank ? 'active' : ''}`;
    b.textContent = `BANK ${TRACK_BANKS[bank]}`;
    b.title = `${TRACK_BANKS[bank]}: tracks ${bank * TRACK_BANK_SIZE + 1}–${bank * TRACK_BANK_SIZE + TRACK_BANK_SIZE}`;
    b.onclick = () => selectTrack(bank * TRACK_BANK_SIZE + trackSlotIndex(state.selectedTrack));
    trackBanksEl.append(b);
  }
}
function renderTracks() {
  tracksEl.replaceChildren();
  const bank = trackBankIndex(state.selectedTrack);
  for (let slot = 0; slot < TRACK_BANK_SIZE; slot++) {
    const track = bank * TRACK_BANK_SIZE + slot;
    const b = document.createElement('button');
    b.className = `btn track ${state.selectedTrack === track ? 'active' : ''}`;
    b.textContent = trackLabel(track);
    b.title = `Track ${track + 1}/64 · Port ${MIDI_PORTS[state.midiPorts[track]]} · CH ${state.channels[track] || 'OFF'} · Length ${state.trackLengths[track]} · ${state.trackTargets[track]}`;
    b.onclick = () => selectTrack(track);
    tracksEl.append(b);
  }
  channelEl.value = String(state.channels[state.selectedTrack]);
  midiPortEl.value = String(state.midiPorts[state.selectedTrack]);
}
function renderTrackSetup() {
  const t = state.selectedTrack;
  const internalCapable = canUseInternal(t);
  trackLengthEl.value = String(state.trackLengths[t]);
  trackTargetEl.value = state.trackTargets[t];
  internalEngineEl.value = state.internalEngines[t];
  internalSoundEl.value = String(state.internalSounds[t]);
  midiPortEl.value = String(state.midiPorts[t]);
  for (const option of trackTargetEl.options) option.disabled = !internalCapable && option.value !== 'MIDI';
  const internal = internalCapable && state.trackTargets[t] !== 'MIDI';
  internalEngineEl.disabled = !internal;
  internalSoundEl.disabled = !internal;
  channelEl.disabled = state.trackTargets[t] === 'INTERNAL';
  midiPortEl.disabled = state.trackTargets[t] === 'INTERNAL';
  $('internalHint').textContent = internalCapable
    ? (internal ? 'Internal part metadata is stored now; Browser audio arrives with the shared SLOOP/WASM core.' : 'This track can address MIDI or one of the four native SLOOP internal parts.')
    : 'Command-center track: MIDI only on FM-1. A01–A04 remain the four native internal-audio parts.';
}
function renderCcs() {
  ccsEl.replaceChildren();
  for (let slot = 0; slot < 4; slot++) {
    const cc = ccNumber(state, slot);
    const v = state.ccValues[state.selectedTrack][slot];
    const box = document.createElement('div');
    box.className = 'cc';
    const title = document.createElement('strong');
    const left = document.createElement('span');
    left.textContent = `K${slot + 1} · CC`;
    const mapInput = document.createElement('input');
    mapInput.className = 'mini';
    mapInput.type = 'number'; mapInput.min = '0'; mapInput.max = '127'; mapInput.value = String(cc);
    mapInput.onchange = () => {
      mapInput.value = String(setCcNumber(state, slot, mapInput.value));
      persist(); renderScreen(); renderStepEditor();
    };
    const valueEl = document.createElement('span');
    valueEl.textContent = String(v).padStart(3, '0');
    const leftWrap = document.createElement('span');
    leftWrap.style.display = 'flex'; leftWrap.style.alignItems = 'center'; leftWrap.style.gap = '5px';
    leftWrap.append(left, mapInput); title.append(leftWrap, valueEl);
    const input = document.createElement('input');
    input.type = 'range'; input.min = '0'; input.max = '127'; input.value = String(v);
    input.oninput = () => {
      const value = setCc(state, slot, input.value);
      sendCc(slot, value);
      valueEl.textContent = String(value).padStart(3, '0');
      $('screenValue').textContent = `CC${ccNumber(state, slot)} ${String(value).padStart(3, '0')}`;
      persist();
    };
    box.append(title, input); ccsEl.append(box);
  }
}
function keyInfo(i) {
  switch (state.mode) {
    case 'SEQ': {
      const absolute = state.page * 16 + i;
      const disabled = absolute >= state.trackLengths[state.selectedTrack];
      if (disabled) return { label: `${absolute + 1}\n—`, disabled: true, active: false, selected: false, playhead: false, notes: [] };
      const p = stepParam(state, state.selectedTrack, absolute);
      const active = visibleStep(state, i);
      const note = effectiveStepNote(state, state.selectedTrack, absolute);
      const tags = [];
      if (p.ratchet > 1) tags.push(`×${p.ratchet}`);
      if (p.micro) tags.push(`${p.micro > 0 ? '+' : ''}${p.micro}%`);
      if (p.ccLocks.some((v) => v !== null)) tags.push('CC');
      return {
        label: active ? `${absolute + 1}\n${noteName(note)}${tags.length ? ` ${tags.join(' ')}` : ''}` : String(absolute + 1),
        active, disabled: false, selected: absolute === selectedStep,
        playhead: playing && absolute === playhead, notes: [],
      };
    }
    case 'DRUM': return { label: `${DRUMS[i][0]}\n${state.drumNotes[i]}`, notes: [state.drumNotes[i]] };
    case 'SCALE': { const note = scaleNote(state.root, state.scale, i); return { label: noteName(note), notes: [note] }; }
    case 'CHORD': {
      const degree = i % 7; const notes = chordNotes(state.root, state.scale, degree);
      return { label: `${DEGREE_NAMES[degree]}\n${notes.map(noteName).join(' ')}`, notes };
    }
    default: { const note = 53 + i; return { label: noteName(note), notes: [note] }; }
  }
}
function renderSurface() {
  surfaceEl.replaceChildren();
  for (let i = 0; i < 16; i++) {
    const info = keyInfo(i);
    const b = document.createElement('button');
    b.className = `key ${info.active ? 'active' : ''} ${info.selected ? 'selected' : ''} ${info.playhead ? 'playhead' : ''} ${info.disabled ? 'disabled-step' : ''}`;
    b.innerText = info.label; b.disabled = Boolean(info.disabled);
    const id = `k${i}`;
    const down = (e) => {
      e.preventDefault(); if (info.disabled) return; b.classList.add('playing');
      if (state.mode === 'SEQ') {
        selectedStep = state.page * 16 + i; toggleStep(state, i); persist(); renderSurface(); renderStepEditor();
      } else startHeld(id, info.notes);
    };
    const up = (e) => { e.preventDefault(); b.classList.remove('playing'); stopHeld(id); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', (e) => { if (e.buttons) up(e); });
    surfaceEl.append(b);
  }
}
function renderDrumEditor() {
  drumEditorEl.classList.toggle('hidden', state.mode !== 'DRUM');
  drumMapEl.replaceChildren();
  if (state.mode !== 'DRUM') return;
  for (let i = 0; i < 16; i++) {
    const item = document.createElement('label'); item.className = 'drum-item';
    const name = document.createElement('span'); name.textContent = `${i + 1}. ${DRUMS[i][0]}`;
    const input = document.createElement('input'); input.className = 'mini'; input.type = 'number'; input.min = '0'; input.max = '127'; input.value = String(state.drumNotes[i]);
    input.onchange = () => { input.value = String(setDrumNote(state, i, input.value)); persist(); renderSurface(); };
    item.append(name, input); drumMapEl.append(item);
  }
}
function renderStepCcLocks(p, track, step) {
  stepCcLocksEl.replaceChildren();
  for (let slot = 0; slot < 4; slot++) {
    const lock = p.ccLocks[slot];
    const row = document.createElement('label'); row.className = 'lock-item';
    const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = lock !== null;
    const name = document.createElement('span'); name.textContent = `K${slot + 1} · CC${state.ccNumbers[track][slot]}`;
    const value = document.createElement('input'); value.className = 'mini'; value.type = 'number'; value.min = '0'; value.max = '127'; value.disabled = lock === null;
    value.value = String(lock === null ? state.ccValues[track][slot] : lock);
    enabled.onchange = () => { setStepCcLock(state, track, step, slot, enabled.checked ? Number(value.value) : null); persist(); renderStepEditor(); renderSurface(); };
    value.onchange = () => { value.value = String(setStepCcLock(state, track, step, slot, value.value)); enabled.checked = true; persist(); renderStepEditor(); renderSurface(); };
    row.append(enabled, name, value); stepCcLocksEl.append(row);
  }
}
function renderStepEditor() {
  const show = state.mode === 'SEQ';
  stepEditorEl.classList.toggle('hidden', !show);
  if (!show) return;
  const track = state.selectedTrack;
  const step = Math.min(Math.max(0, selectedStep), state.trackLengths[track] - 1);
  selectedStep = step;
  const p = stepParam(state, track, step);
  const effective = effectiveStepNote(state, track, step);
  $('stepTitle').textContent = `${trackLabel(track)} · STEP ${step + 1}/${state.trackLengths[track]}`;
  stepEnabledEl.checked = state.steps[track][step];
  stepUseDefaultEl.checked = p.note === null;
  stepNoteEl.disabled = p.note === null; stepNoteEl.value = String(effective); $('stepNoteName').textContent = noteName(effective);
  stepVelocityEl.value = String(p.velocity); stepGateEl.value = String(p.gate); stepProbabilityEl.value = String(p.probability);
  stepRatchetEl.value = String(p.ratchet); stepMicroEl.value = String(p.micro);
  renderStepCcLocks(p, track, step);
}
function renderTransport() {
  $('play').classList.toggle('transport-on', playing);
  tempoEl.value = String(state.tempo); seqNoteEl.value = String(state.seqNotes[state.selectedTrack]);
  $('seqNoteName').textContent = noteName(state.seqNotes[state.selectedTrack]); followEl.checked = state.follow;
  const len = state.trackLengths[state.selectedTrack]; const label = trackLabel(state.selectedTrack);
  $('playPos').textContent = playhead >= 0 ? `${label} ${String(playhead + 1).padStart(2, '0')}/${len}` : `${label} --/${len}`;
}
function renderScreen() {
  const t = state.selectedTrack; const ch = state.channels[t]; const target = state.trackTargets[t]; const label = trackLabel(t);
  const port = MIDI_PORTS[state.midiPorts[t]];
  $('screenMain').textContent = `TRACK ${label} · ${state.mode}`;
  $('screenSub').textContent = `#${t + 1}/64 · ${target} · PORT ${port} · ${ch ? `CH ${ch}` : 'MIDI OFF'} · LEN ${state.trackLengths[t]} · ${state.tempo} BPM · PAGE ${state.page + 1}/${maxPageForTrack(state, t) + 1}`;
  const v = state.ccValues[t][0];
  $('screenValue').textContent = playing && playhead >= 0 ? `▶ ${String(playhead + 1).padStart(2, '0')}/${state.trackLengths[t]}` : `CC${ccNumber(state, 0)} ${String(v).padStart(3, '0')}`;
  const start = state.page * 16 + 1; const end = Math.min(state.page * 16 + 16, state.trackLengths[t]);
  $('pageLabel').textContent = `${start}–${end} / LEN ${state.trackLengths[t]}`;
}
function render() {
  normalizeViewForTrack(); renderModes(); renderTrackBanks(); renderTracks(); renderTrackSetup(); renderCcs();
  renderDrumEditor(); renderStepEditor(); renderTransport(); renderSurface(); renderScreen();
  rootEl.value = String(state.root); scaleEl.value = state.scale;
}

function updateMidiStatus() {
  if (!midi) {
    $('midiStatus').textContent = 'Offline';
    return;
  }
  const mapped = outputs.filter(Boolean).length;
  $('midiStatus').textContent = `MIDI ready · ${mapped}/${MIDI_PORTS.length} ports mapped`;
}
async function connectMidi() {
  if (!navigator.requestMIDIAccess) { $('midiStatus').textContent = 'Web MIDI unavailable'; return; }
  try {
    midi = await navigator.requestMIDIAccess({ sysex: false });
    refreshOutputs();
    midi.onstatechange = refreshOutputs;
    updateMidiStatus();
  } catch (err) {
    $('midiStatus').textContent = `MIDI denied${err?.message ? `: ${err.message}` : ''}`;
  }
}
function refreshOutputs() {
  const available = midi ? [...midi.outputs.values()] : [];
  outputSelects.forEach((select, port) => {
    const wanted = outputMap[port] || select.value;
    select.replaceChildren(new Option('No MIDI output', ''));
    for (const o of available) select.add(new Option(o.name || o.id, o.id));
    if (available.some((o) => o.id === wanted)) select.value = wanted;
    else select.value = '';
    outputs[port] = select.value ? midi.outputs.get(select.value) : null;
  });

  if (midi && available.length === 1 && outputMap.every((id) => !id)) {
    outputMap[0] = available[0].id;
    outputSelects[0].value = available[0].id;
    outputs[0] = available[0];
    persistOutputMap();
  }
  updateMidiStatus();
}

$('connect').onclick = connectMidi;
outputSelects.forEach((select, port) => {
  select.onchange = () => {
    stopTransport();
    stopAllHeld();
    outputMap[port] = select.value;
    outputs[port] = midi && select.value ? midi.outputs.get(select.value) : null;
    persistOutputMap();
    updateMidiStatus();
  };
});
$('play').onclick = () => startTransport(0);
$('stop').onclick = () => stopTransport();
tempoEl.onchange = () => {
  const wasPlaying = playing; const resumeAt = transportTick >= 0 ? transportTick + 1 : 0;
  tempoEl.value = String(setTempo(state, tempoEl.value)); persist();
  if (wasPlaying) { stopTransport({ persistPage: false }); startTransport(resumeAt); }
  renderScreen();
};
seqNoteEl.onchange = () => {
  stopSequencerNotes(); seqNoteEl.value = String(setSeqNote(state, state.selectedTrack, seqNoteEl.value)); persist();
  renderTransport(); renderStepEditor(); if (state.mode === 'SEQ') renderSurface();
};
followEl.onchange = () => { state.follow = followEl.checked; persist(); };
trackLengthEl.onchange = () => {
  trackLengthEl.value = String(setTrackLength(state, state.selectedTrack, trackLengthEl.value)); normalizeViewForTrack();
  if (playing && transportTick >= 0) playhead = trackLocalStep(state, state.selectedTrack, transportTick);
  persist(); render();
};
trackTargetEl.onchange = () => {
  stopSequencerNotes(); stopAllHeld(); trackTargetEl.value = setTrackTarget(state, state.selectedTrack, trackTargetEl.value); persist(); render();
};
midiPortEl.onchange = () => {
  stopSequencerNotes(); stopAllHeld();
  midiPortEl.value = String(setMidiPort(state, state.selectedTrack, midiPortEl.value));
  persist(); renderTracks(); renderTrackSetup(); renderScreen();
};
internalEngineEl.onchange = () => { setInternalEngine(state, state.selectedTrack, internalEngineEl.value); persist(); renderTrackSetup(); renderScreen(); };
internalSoundEl.onchange = () => { internalSoundEl.value = String(setInternalSound(state, state.selectedTrack, internalSoundEl.value)); persist(); };
stepEnabledEl.onchange = () => { setStepEnabled(state, state.selectedTrack, selectedStep, stepEnabledEl.checked); persist(); renderSurface(); };
stepUseDefaultEl.onchange = () => {
  const current = effectiveStepNote(state, state.selectedTrack, selectedStep);
  setStepParam(state, state.selectedTrack, selectedStep, 'note', stepUseDefaultEl.checked ? null : current); persist(); renderStepEditor(); renderSurface();
};
stepNoteEl.onchange = () => {
  stepNoteEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'note', stepNoteEl.value)); stepUseDefaultEl.checked = false; persist(); renderStepEditor(); renderSurface();
};
stepVelocityEl.onchange = () => { stepVelocityEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'velocity', stepVelocityEl.value)); persist(); };
stepGateEl.onchange = () => { stepGateEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'gate', stepGateEl.value)); persist(); };
stepProbabilityEl.onchange = () => { stepProbabilityEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'probability', stepProbabilityEl.value)); persist(); };
stepRatchetEl.onchange = () => { stepRatchetEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'ratchet', stepRatchetEl.value)); persist(); renderSurface(); };
stepMicroEl.onchange = () => { stepMicroEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'micro', stepMicroEl.value)); persist(); renderSurface(); };
$('reset').onclick = () => {
  if (!window.confirm('Reset Browser Companion mappings, steps and settings?')) return;
  stopTransport({ persistPage: false }); stopAllHeld(); state = createState(); selectedStep = 0; persist(); render();
};

for (let ch = 0; ch <= 16; ch++) channelEl.add(new Option(ch === 0 ? 'OFF' : String(ch), String(ch)));
channelEl.onchange = () => { stopSequencerNotes(); stopAllHeld(); state.channels[state.selectedTrack] = Number(channelEl.value); persist(); renderTracks(); renderScreen(); };
MIDI_PORTS.forEach((port, i) => midiPortEl.add(new Option(`PORT ${port}`, String(i))));
TRACK_TARGETS.forEach((target) => trackTargetEl.add(new Option(target, target)));
INTERNAL_ENGINES.forEach((engine) => internalEngineEl.add(new Option(engine, engine)));
ROOTS.forEach((name, i) => rootEl.add(new Option(name, String(i))));
Object.keys(SCALES).forEach((name) => scaleEl.add(new Option(name, name)));
rootEl.onchange = () => { stopAllHeld(); state.root = Number(rootEl.value); persist(); render(); };
scaleEl.onchange = () => { stopAllHeld(); state.scale = scaleEl.value; persist(); render(); };
$('pagePrev').onclick = () => { const max = maxPageForTrack(state, state.selectedTrack); state.page = state.page <= 0 ? max : state.page - 1; selectedStep = state.page * 16; persist(); render(); };
$('pageNext').onclick = () => { const max = maxPageForTrack(state, state.selectedTrack); state.page = state.page >= max ? 0 : state.page + 1; selectedStep = state.page * 16; persist(); render(); };
window.addEventListener('blur', stopAllHeld);
window.addEventListener('beforeunload', () => { stopTransport({ persistPage: false }); stopAllHeld(); });

render();
