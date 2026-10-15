import { MODES, DEFAULT_CCS, SCALES, ROOTS, DEGREE_NAMES, DRUMS, createState, setCc, toggleStep, visibleStep, scaleNote, chordNotes, noteName } from './model.js';

const state = createState();
let midi = null;
let output = null;
let held = new Map();

const $ = (id) => document.getElementById(id);
const modesEl = $('modes');
const tracksEl = $('tracks');
const ccsEl = $('ccs');
const surfaceEl = $('surface');
const outputEl = $('output');
const channelEl = $('channel');
const rootEl = $('root');
const scaleEl = $('scale');

function midiChannel() {
  const ch = state.channels[state.selectedTrack];
  return ch >= 1 && ch <= 16 ? ch - 1 : null;
}

function send(bytes) {
  if (output) output.send(bytes);
}

function sendCc(slot, value) {
  const ch = midiChannel();
  if (ch === null) return;
  send([0xB0 | ch, state.ccNumbers[slot], value]);
}

function noteOn(note, velocity = 100) {
  const ch = midiChannel();
  if (ch === null) return;
  send([0x90 | ch, note & 127, velocity & 127]);
}

function noteOff(note) {
  const ch = midiChannel();
  if (ch === null) return;
  send([0x80 | ch, note & 127, 0]);
}

function stopHeld(id) {
  const notes = held.get(id);
  if (!notes) return;
  notes.forEach(noteOff);
  held.delete(id);
}

function startHeld(id, notes) {
  stopHeld(id);
  notes.forEach((n) => noteOn(n));
  held.set(id, notes);
}

function renderModes() {
  modesEl.replaceChildren();
  MODES.forEach((mode) => {
    const b = document.createElement('button');
    b.className = `btn ${state.mode === mode ? 'active' : ''}`;
    b.textContent = mode;
    b.onclick = () => { state.mode = mode; render(); };
    modesEl.append(b);
  });
}

function renderTracks() {
  tracksEl.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const b = document.createElement('button');
    b.className = `btn track ${state.selectedTrack === i ? 'active' : ''}`;
    b.textContent = `T${i + 1}`;
    b.onclick = () => { state.selectedTrack = i; render(); };
    tracksEl.append(b);
  }
  channelEl.value = String(state.channels[state.selectedTrack]);
}

function renderCcs() {
  ccsEl.replaceChildren();
  state.ccNumbers.forEach((cc, slot) => {
    const v = state.ccValues[state.selectedTrack][slot];
    const box = document.createElement('div');
    box.className = 'cc';
    const title = document.createElement('strong');
    title.innerHTML = `<span>K${slot + 1} · CC${cc}</span><span>${String(v).padStart(3, '0')}</span>`;
    const input = document.createElement('input');
    input.type = 'range'; input.min = '0'; input.max = '127'; input.value = String(v);
    input.oninput = () => {
      const value = setCc(state, slot, input.value);
      sendCc(slot, value);
      $('screenValue').textContent = `CC${cc} ${String(value).padStart(3, '0')}`;
      renderCcs();
    };
    box.append(title, input);
    ccsEl.append(box);
  });
}

function keyInfo(i) {
  switch (state.mode) {
    case 'SEQ': return { label: String(state.page * 16 + i + 1), active: visibleStep(state, i), notes: [] };
    case 'DRUM': return { label: `${DRUMS[i][0]}\n${DRUMS[i][1]}`, notes: [DRUMS[i][1]] };
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
    b.className = `key ${info.active ? 'active' : ''}`;
    b.innerText = info.label;
    const id = `k${i}`;
    const down = (e) => {
      e.preventDefault();
      b.classList.add('playing');
      if (state.mode === 'SEQ') {
        toggleStep(state, i);
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

function renderScreen() {
  const ch = state.channels[state.selectedTrack];
  $('screenMain').textContent = `TRACK ${state.selectedTrack + 1} · ${state.mode}`;
  $('screenSub').textContent = `${ch ? `CH ${ch}` : 'MIDI OFF'} · ROOT ${ROOTS[state.root]} · ${state.scale.toUpperCase()} · PAGE ${state.page + 1}/4`;
  const v = state.ccValues[state.selectedTrack][0];
  $('screenValue').textContent = `CC${DEFAULT_CCS[0]} ${String(v).padStart(3, '0')}`;
  $('pageLabel').textContent = `${state.page * 16 + 1}–${state.page * 16 + 16}`;
}

function render() {
  renderModes(); renderTracks(); renderCcs(); renderSurface(); renderScreen();
  rootEl.value = String(state.root); scaleEl.value = state.scale;
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
outputEl.onchange = () => { output = midi && outputEl.value ? midi.outputs.get(outputEl.value) : null; $('midiStatus').textContent = output ? `OUT: ${output.name}` : 'MIDI ready'; };

for (let ch = 0; ch <= 16; ch++) channelEl.add(new Option(ch === 0 ? 'OFF' : String(ch), String(ch)));
channelEl.onchange = () => { state.channels[state.selectedTrack] = Number(channelEl.value); renderScreen(); };

ROOTS.forEach((name, i) => rootEl.add(new Option(name, String(i))));
Object.keys(SCALES).forEach((name) => scaleEl.add(new Option(name, name)));
rootEl.onchange = () => { state.root = Number(rootEl.value); render(); };
scaleEl.onchange = () => { state.scale = scaleEl.value; render(); };

$('pagePrev').onclick = () => { state.page = (state.page + 3) % 4; render(); };
$('pageNext').onclick = () => { state.page = (state.page + 1) % 4; render(); };

window.addEventListener('blur', () => { for (const id of [...held.keys()]) stopHeld(id); });

render();
