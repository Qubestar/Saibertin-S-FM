import {
  MODES, SCALES, ROOTS, DEGREE_NAMES, DRUMS, createState, restoreState, snapshotState,
  setCc, ccNumber, setCcNumber, setDrumNote, setSeqNote, setTempo,
  toggleStep, visibleStep, scaleNote, chordNotes, noteName, stepDurationMs, sequenceEventsAtStep,
} from './model.js';

const STORAGE_KEY = 'saibertin-s-fm-companion-v1';
let state = loadState();
let midi = null;
let output = null;
const held = new Map();

let playing = false;
let playhead = -1;
let transportTimer = null;
let nextTickAt = 0;
const seqActive = new Map();
const seqOffTimers = new Map();

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

function stopSequencerNotes() {
  for (const timer of seqOffTimers.values()) clearTimeout(timer);
  seqOffTimers.clear();
  for (const event of seqActive.values()) noteOff(event.note, event.channel);
  seqActive.clear();
}

function triggerSequenceEvent(event) {
  const priorTimer = seqOffTimers.get(event.track);
  if (priorTimer) clearTimeout(priorTimer);
  const prior = seqActive.get(event.track);
  if (prior) noteOff(prior.note, prior.channel);

  noteOn(event.note, event.velocity, event.channel);
  seqActive.set(event.track, event);

  const gateMs = Math.max(20, stepDurationMs(state.tempo) * 0.55);
  const timer = setTimeout(() => {
    const current = seqActive.get(event.track);
    if (current === event) {
      noteOff(event.note, event.channel);
      seqActive.delete(event.track);
    }
    seqOffTimers.delete(event.track);
  }, gateMs);
  seqOffTimers.set(event.track, timer);
}

function runTransportStep() {
  playhead = (playhead + 1) % 64;
  for (const event of sequenceEventsAtStep(state, playhead)) triggerSequenceEvent(event);

  if (state.follow) {
    const page = Math.floor(playhead / 16);
    if (page !== state.page) state.page = page;
  }

  renderTransport();
  renderScreen();
  if (state.mode === 'SEQ') renderSurface();
}

function scheduleTransport() {
  if (!playing) return;
  const delay = Math.max(0, nextTickAt - performance.now());
  transportTimer = setTimeout(() => {
    if (!playing) return;
    runTransportStep();
    nextTickAt += stepDurationMs(state.tempo);
    scheduleTransport();
  }, delay);
}

function startTransport() {
  if (playing) return;
  playing = true;
  playhead = -1;
  nextTickAt = performance.now();
  scheduleTransport();
  renderTransport();
  renderScreen();
}

function stopTransport({ persistPage = true } = {}) {
  playing = false;
  if (transportTimer) clearTimeout(transportTimer);
  transportTimer = null;
  nextTickAt = 0;
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
      return {
        label: String(absolute + 1),
        active: visibleStep(state, i),
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
    b.className = `key ${info.active ? 'active' : ''} ${info.playhead ? 'playhead' : ''}`;
    b.innerText = info.label;
    const id = `k${i}`;
    const down = (e) => {
      e.preventDefault();
      b.classList.add('playing');
      if (state.mode === 'SEQ') {
        toggleStep(state, i);
        persist();
        renderSurface();
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

$('play').onclick = startTransport;
$('stop').onclick = () => stopTransport();

tempoEl.onchange = () => {
  const tempo = setTempo(state, tempoEl.value);
  tempoEl.value = String(tempo);
  persist();
  if (playing) {
    if (transportTimer) clearTimeout(transportTimer);
    nextTickAt = performance.now() + stepDurationMs(state.tempo);
    scheduleTransport();
  }
  renderScreen();
};

seqNoteEl.onchange = () => {
  stopSequencerNotes();
  const note = setSeqNote(state, state.selectedTrack, seqNoteEl.value);
  seqNoteEl.value = String(note);
  persist();
  renderTransport();
};

followEl.onchange = () => {
  state.follow = followEl.checked;
  persist();
};

$('reset').onclick = () => {
  if (!window.confirm('Reset Browser Companion mappings, steps and settings?')) return;
  stopTransport({ persistPage: false });
  stopAllHeld();
  state = createState();
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

$('pagePrev').onclick = () => { state.page = (state.page + 3) % 4; persist(); render(); };
$('pageNext').onclick = () => { state.page = (state.page + 1) % 4; persist(); render(); };

window.addEventListener('blur', stopAllHeld);
window.addEventListener('beforeunload', () => {
  stopTransport({ persistPage: false });
  stopAllHeld();
});

render();
