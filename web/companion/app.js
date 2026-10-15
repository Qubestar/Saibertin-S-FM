import {
  MODES, SCALES, ROOTS, DEGREE_NAMES, DRUMS, createState, restoreState, snapshotState,
  setCc, ccNumber, setCcNumber, setDrumNote, setSeqNote, setTempo,
  toggleStep, setStepEnabled, visibleStep, stepParam, effectiveStepNote, setStepParam, setStepCcLock,
  scaleNote, chordNotes, noteName, stepDurationMs, sequenceEventsAtStep,
} from './model.js';

const STORAGE_KEY = 'saibertin-s-fm-companion-v1';
let state = loadState();
let midi = null;
let output = null;
const held = new Map();

let playing = false;
let playhead = -1;
let selectedStep = state.page * 16;
let plannerTimer = null;
const seqActive = new Map();
const seqTimers = new Set();

const $ = (id) => document.getElementById(id);
const modesEl = $('modes');
const tracksEl = $('tracks');
const ccsEl = $('ccs');
const surfaceEl = $('surface');
const outputEl = $('output');
const channelEl = $('channel');
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

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return restoreState(raw?.state ?? raw);
  } catch {
    return createState();
  }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotState(state))); } catch {}
}

function midiChannel(track = state.selectedTrack) {
  const ch = state.channels[track];
  return ch >= 1 && ch <= 16 ? ch - 1 : null;
}

function send(bytes) {
  if (output) output.send(bytes);
}

function sendCc(slot, value) {
  const ch = midiChannel();
  if (ch === null) return;
  send([0xB0 | ch, ccNumber(state, slot), value]);
}

function noteOn(note, velocity = 100, ch = midiChannel()) {
  if (ch === null) return;
  send([0x90 | ch, note & 127, velocity & 127]);
}

function noteOff(note, ch) {
  if (ch === null || ch === undefined) return;
  send([0x80 | ch, note & 127, 0]);
}

function stopHeld(id) {
  const entry = held.get(id);
  if (!entry) return;
  entry.notes.forEach((note) => noteOff(note, entry.ch));
  held.delete(id);
}

function stopAllHeld() {
  for (const id of [...held.keys()]) stopHeld(id);
}

function startHeld(id, notes) {
  stopHeld(id);
  const ch = midiChannel();
  if (ch === null) return;
  notes.forEach((note) => noteOn(note, 100, ch));
  held.set(id, { ch, notes: [...notes] });
}

function trackedTimeout(fn, delay) {
  const timer = setTimeout(() => {
    seqTimers.delete(timer);
    fn();
  }, Math.max(0, delay));
  seqTimers.add(timer);
  return timer;
}

function stopSequencerNotes() {
  for (const timer of seqTimers) clearTimeout(timer);
  seqTimers.clear();
  plannerTimer = null;
  for (const event of seqActive.values()) noteOff(event.note, event.channel);
  seqActive.clear();
}

function fireSequenceHit(event, hitSpan) {
  const prior = seqActive.get(event.track);
  if (prior) noteOff(prior.note, prior.channel);

  const hit = { ...event };
  noteOn(hit.note, hit.velocity, hit.channel);
  seqActive.set(hit.track, hit);

  const gateMs = Math.max(4, Math.min(hitSpan * 0.9, hitSpan * (hit.gate / 100)));
  trackedTimeout(() => {
    const current = seqActive.get(hit.track);
    if (current === hit) {
      noteOff(hit.note, hit.channel);
      seqActive.delete(hit.track);
    }
  }, gateMs);
}

function sendStepLocks(event) {
  for (const lock of event.ccLocks || [])
    send([0xB0 | event.channel, lock.cc & 127, lock.value & 127]);
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

function showPlayhead(step) {
  if (!playing) return;
  playhead = step;
  if (state.follow) {
    const page = Math.floor(playhead / 16);
    if (page !== state.page) state.page = page;
  }
  renderTransport();
  renderScreen();
  if (state.mode === 'SEQ') renderSurface();
}

function planTransportStep(step, nominalAt) {
  if (!playing) return;
  const stepMs = stepDurationMs(state.tempo);

  for (const event of sequenceEventsAtStep(state, step))
    scheduleSequenceEvent(event, nominalAt, stepMs);

  trackedTimeout(() => showPlayhead(step), nominalAt - performance.now());

  // Plan the next step before its earliest allowed hit. With microtiming down to -50%,
  // the next event may happen half a step before its nominal grid point.
  const nextStep = (step + 1) % 64;
  const nextNominalAt = nominalAt + stepMs;
  const planAt = nominalAt + stepMs * 0.25;
  plannerTimer = trackedTimeout(() => planTransportStep(nextStep, nextNominalAt), planAt - performance.now());
}

function startTransport(startStep = 0) {
  if (playing) return;
  playing = true;
  playhead = -1;
  const stepMs = stepDurationMs(state.tempo);
  const firstNominalAt = performance.now() + stepMs * 0.55;
  planTransportStep(Math.max(0, Math.min(63, startStep)), firstNominalAt);
  renderTransport();
  renderScreen();
}

function stopTransport({ persistPage = true } = {}) {
  playing = false;
  stopSequencerNotes();
  playhead = -1;
  if (persistPage) persist();
  renderTransport();
  renderScreen();
  if (state.mode === 'SEQ') renderSurface();
}

function renderModes() {
  modesEl.replaceChildren();
  MODES.forEach((mode) => {
    const b = document.createElement('button');
    b.className = `btn ${state.mode === mode ? 'active' : ''}`;
    b.textContent = mode;
    b.onclick = () => {
      stopAllHeld();
      state.mode = mode;
      persist();
      render();
    };
    modesEl.append(b);
  });
}

function renderTracks() {
  tracksEl.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const b = document.createElement('button');
    b.className = `btn track ${state.selectedTrack === i ? 'active' : ''}`;
    b.textContent = `T${i + 1}`;
    b.onclick = () => {
      stopAllHeld();
      state.selectedTrack = i;
      persist();
      render();
    };
    tracksEl.append(b);
  }
  channelEl.value = String(state.channels[state.selectedTrack]);
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
    mapInput.type = 'number';
    mapInput.min = '0';
    mapInput.max = '127';
    mapInput.value = String(cc);
    mapInput.title = `MIDI CC number for K${slot + 1}`;
    mapInput.onchange = () => {
      const mapped = setCcNumber(state, slot, mapInput.value);
      mapInput.value = String(mapped);
      persist();
      renderScreen();
      renderStepEditor();
    };
    const valueEl = document.createElement('span');
    valueEl.textContent = String(v).padStart(3, '0');
    const leftWrap = document.createElement('span');
    leftWrap.style.display = 'flex';
    leftWrap.style.alignItems = 'center';
    leftWrap.style.gap = '5px';
    leftWrap.append(left, mapInput);
    title.append(leftWrap, valueEl);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '127';
    input.value = String(v);
    input.oninput = () => {
      const value = setCc(state, slot, input.value);
      sendCc(slot, value);
      valueEl.textContent = String(value).padStart(3, '0');
      $('screenValue').textContent = `CC${ccNumber(state, slot)} ${String(value).padStart(3, '0')}`;
      persist();
    };
    box.append(title, input);
    ccsEl.append(box);
  }
}

function keyInfo(i) {
  switch (state.mode) {
    case 'SEQ': {
      const absolute = state.page * 16 + i;
      const p = stepParam(state, state.selectedTrack, absolute);
      const active = visibleStep(state, i);
      const note = effectiveStepNote(state, state.selectedTrack, absolute);
      const tags = [];
      if (p.ratchet > 1) tags.push(`×${p.ratchet}`);
      if (p.micro) tags.push(`${p.micro > 0 ? '+' : ''}${p.micro}%`);
      if (p.ccLocks.some((v) => v !== null)) tags.push('CC');
      return {
        label: active ? `${absolute + 1}\n${noteName(note)}${tags.length ? ` ${tags.join(' ')}` : ''}` : String(absolute + 1),
        active,
        selected: absolute === selectedStep,
        playhead: playing && absolute === playhead,
        notes: [],
      };
    }
    case 'DRUM':
      return { label: `${DRUMS[i][0]}\n${state.drumNotes[i]}`, notes: [state.drumNotes[i]] };
    case 'SCALE': {
      const note = scaleNote(state.root, state.scale, i);
      return { label: noteName(note), notes: [note] };
    }
    case 'CHORD': {
      const degree = i % 7;
      const notes = chordNotes(state.root, state.scale, degree);
      return { label: `${DEGREE_NAMES[degree]}\n${notes.map(noteName).join(' ')}`, notes };
    }
    default: {
      const note = 53 + i;
      return { label: noteName(note), notes: [note] };
    }
  }
}

function renderSurface() {
  surfaceEl.replaceChildren();
  for (let i = 0; i < 16; i++) {
    const info = keyInfo(i);
    const b = document.createElement('button');
    b.className = `key ${info.active ? 'active' : ''} ${info.selected ? 'selected' : ''} ${info.playhead ? 'playhead' : ''}`;
    b.innerText = info.label;
    const id = `k${i}`;
    const down = (e) => {
      e.preventDefault();
      b.classList.add('playing');
      if (state.mode === 'SEQ') {
        selectedStep = state.page * 16 + i;
        toggleStep(state, i);
        persist();
        renderSurface();
        renderStepEditor();
      } else {
        startHeld(id, info.notes);
      }
    };
    const up = (e) => {
      e.preventDefault();
      b.classList.remove('playing');
      stopHeld(id);
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', (e) => { if (e.buttons) up(e); });
    surfaceEl.append(b);
  }
}

function renderDrumEditor() {
  drumEditorEl.classList.toggle('hidden', state.mode !== 'DRUM');
  drumMapEl.replaceChildren();
  if (state.mode !== 'DRUM') return;
  for (let i = 0; i < 16; i++) {
    const item = document.createElement('label');
    item.className = 'drum-item';
    const name = document.createElement('span');
    name.textContent = `${i + 1}. ${DRUMS[i][0]}`;
    const input = document.createElement('input');
    input.className = 'mini';
    input.type = 'number';
    input.min = '0';
    input.max = '127';
    input.value = String(state.drumNotes[i]);
    input.onchange = () => {
      const note = setDrumNote(state, i, input.value);
      input.value = String(note);
      persist();
      renderSurface();
    };
    item.append(name, input);
    drumMapEl.append(item);
  }
}

function renderStepCcLocks(p, track, step) {
  stepCcLocksEl.replaceChildren();
  for (let slot = 0; slot < 4; slot++) {
    const lock = p.ccLocks[slot];
    const row = document.createElement('label');
    row.className = 'lock-item';

    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = lock !== null;

    const name = document.createElement('span');
    name.textContent = `K${slot + 1} · CC${state.ccNumbers[track][slot]}`;

    const value = document.createElement('input');
    value.className = 'mini';
    value.type = 'number';
    value.min = '0';
    value.max = '127';
    value.disabled = lock === null;
    value.value = String(lock === null ? state.ccValues[track][slot] : lock);

    enabled.onchange = () => {
      const next = enabled.checked ? Number(value.value) : null;
      setStepCcLock(state, track, step, slot, next);
      persist();
      renderStepEditor();
      renderSurface();
    };
    value.onchange = () => {
      const next = setStepCcLock(state, track, step, slot, value.value);
      value.value = String(next);
      enabled.checked = true;
      persist();
      renderStepEditor();
      renderSurface();
    };

    row.append(enabled, name, value);
    stepCcLocksEl.append(row);
  }
}

function renderStepEditor() {
  const show = state.mode === 'SEQ';
  stepEditorEl.classList.toggle('hidden', !show);
  if (!show) return;

  const track = state.selectedTrack;
  const step = Math.max(0, Math.min(63, selectedStep));
  const p = stepParam(state, track, step);
  const effective = effectiveStepNote(state, track, step);
  $('stepTitle').textContent = `T${track + 1} · STEP ${step + 1}`;
  stepEnabledEl.checked = state.steps[track][step];
  stepUseDefaultEl.checked = p.note === null;
  stepNoteEl.disabled = p.note === null;
  stepNoteEl.value = String(effective);
  $('stepNoteName').textContent = noteName(effective);
  stepVelocityEl.value = String(p.velocity);
  stepGateEl.value = String(p.gate);
  stepProbabilityEl.value = String(p.probability);
  stepRatchetEl.value = String(p.ratchet);
  stepMicroEl.value = String(p.micro);
  renderStepCcLocks(p, track, step);
}

function renderTransport() {
  $('play').classList.toggle('transport-on', playing);
  tempoEl.value = String(state.tempo);
  seqNoteEl.value = String(state.seqNotes[state.selectedTrack]);
  $('seqNoteName').textContent = noteName(state.seqNotes[state.selectedTrack]);
  followEl.checked = state.follow;
  $('playPos').textContent = playhead >= 0 ? `STEP ${String(playhead + 1).padStart(2, '0')}` : 'STEP --';
}

function renderScreen() {
  const ch = state.channels[state.selectedTrack];
  $('screenMain').textContent = `TRACK ${state.selectedTrack + 1} · ${state.mode}`;
  $('screenSub').textContent = `${ch ? `CH ${ch}` : 'MIDI OFF'} · ${state.tempo} BPM · ROOT ${ROOTS[state.root]} · ${state.scale.toUpperCase()} · PAGE ${state.page + 1}/4`;
  const v = state.ccValues[state.selectedTrack][0];
  $('screenValue').textContent = playing && playhead >= 0
    ? `▶ ${String(playhead + 1).padStart(2, '0')}/64`
    : `CC${ccNumber(state, 0)} ${String(v).padStart(3, '0')}`;
  $('pageLabel').textContent = `${state.page * 16 + 1}–${state.page * 16 + 16}`;
}

function render() {
  renderModes();
  renderTracks();
  renderCcs();
  renderDrumEditor();
  renderStepEditor();
  renderTransport();
  renderSurface();
  renderScreen();
  rootEl.value = String(state.root);
  scaleEl.value = state.scale;
}

async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    $('midiStatus').textContent = 'Web MIDI unavailable';
    return;
  }
  try {
    midi = await navigator.requestMIDIAccess({ sysex: false });
    refreshOutputs();
    midi.onstatechange = refreshOutputs;
    $('midiStatus').textContent = 'MIDI ready';
  } catch (err) {
    $('midiStatus').textContent = `MIDI denied${err?.message ? `: ${err.message}` : ''}`;
  }
}

function refreshOutputs() {
  const current = outputEl.value;
  outputEl.replaceChildren(new Option('No MIDI output', ''));
  if (!midi) return;
  for (const o of midi.outputs.values()) outputEl.add(new Option(o.name || o.id, o.id));
  if ([...outputEl.options].some((o) => o.value === current)) outputEl.value = current;
  output = outputEl.value ? midi.outputs.get(outputEl.value) : null;
}

$('connect').onclick = connectMidi;
outputEl.onchange = () => {
  stopTransport();
  stopAllHeld();
  output = midi && outputEl.value ? midi.outputs.get(outputEl.value) : null;
  $('midiStatus').textContent = output ? `OUT: ${output.name}` : 'MIDI ready';
};

$('play').onclick = () => startTransport(0);
$('stop').onclick = () => stopTransport();

tempoEl.onchange = () => {
  const wasPlaying = playing;
  const resumeAt = playhead >= 0 ? (playhead + 1) % 64 : 0;
  const tempo = setTempo(state, tempoEl.value);
  tempoEl.value = String(tempo);
  persist();
  if (wasPlaying) {
    stopTransport({ persistPage: false });
    startTransport(resumeAt);
  }
  renderScreen();
};

seqNoteEl.onchange = () => {
  stopSequencerNotes();
  const note = setSeqNote(state, state.selectedTrack, seqNoteEl.value);
  seqNoteEl.value = String(note);
  persist();
  renderTransport();
  renderStepEditor();
  if (state.mode === 'SEQ') renderSurface();
};

followEl.onchange = () => {
  state.follow = followEl.checked;
  persist();
};

stepEnabledEl.onchange = () => {
  setStepEnabled(state, state.selectedTrack, selectedStep, stepEnabledEl.checked);
  persist();
  renderSurface();
};

stepUseDefaultEl.onchange = () => {
  const current = effectiveStepNote(state, state.selectedTrack, selectedStep);
  setStepParam(state, state.selectedTrack, selectedStep, 'note', stepUseDefaultEl.checked ? null : current);
  persist();
  renderStepEditor();
  renderSurface();
};

stepNoteEl.onchange = () => {
  const note = setStepParam(state, state.selectedTrack, selectedStep, 'note', stepNoteEl.value);
  stepNoteEl.value = String(note);
  stepUseDefaultEl.checked = false;
  persist();
  renderStepEditor();
  renderSurface();
};

stepVelocityEl.onchange = () => {
  stepVelocityEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'velocity', stepVelocityEl.value));
  persist();
};

stepGateEl.onchange = () => {
  stepGateEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'gate', stepGateEl.value));
  persist();
};

stepProbabilityEl.onchange = () => {
  stepProbabilityEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'probability', stepProbabilityEl.value));
  persist();
};

stepRatchetEl.onchange = () => {
  stepRatchetEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'ratchet', stepRatchetEl.value));
  persist();
  renderSurface();
};

stepMicroEl.onchange = () => {
  stepMicroEl.value = String(setStepParam(state, state.selectedTrack, selectedStep, 'micro', stepMicroEl.value));
  persist();
  renderSurface();
};

$('reset').onclick = () => {
  if (!window.confirm('Reset Browser Companion mappings, steps and settings?')) return;
  stopTransport({ persistPage: false });
  stopAllHeld();
  state = createState();
  selectedStep = 0;
  persist();
  render();
};

for (let ch = 0; ch <= 16; ch++) channelEl.add(new Option(ch === 0 ? 'OFF' : String(ch), String(ch)));
channelEl.onchange = () => {
  stopSequencerNotes();
  stopAllHeld();
  state.channels[state.selectedTrack] = Number(channelEl.value);
  persist();
  renderScreen();
};

ROOTS.forEach((name, i) => rootEl.add(new Option(name, String(i))));
Object.keys(SCALES).forEach((name) => scaleEl.add(new Option(name, name)));
rootEl.onchange = () => { stopAllHeld(); state.root = Number(rootEl.value); persist(); render(); };
scaleEl.onchange = () => { stopAllHeld(); state.scale = scaleEl.value; persist(); render(); };

$('pagePrev').onclick = () => {
  state.page = (state.page + 3) % 4;
  selectedStep = state.page * 16;
  persist();
  render();
};
$('pageNext').onclick = () => {
  state.page = (state.page + 1) % 4;
  selectedStep = state.page * 16;
  persist();
  render();
};

window.addEventListener('blur', stopAllHeld);
window.addEventListener('beforeunload', () => {
  stopTransport({ persistPage: false });
  stopAllHeld();
});

render();
