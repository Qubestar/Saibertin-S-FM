import assert from 'node:assert/strict';
import {
  TRACK_COUNT, TRACK_BANKS, MIDI_PORTS, INTERNAL_TRACK_COUNT,
  createState, setCc, adjustCc, ccNumber, setCcNumber, setDrumNote,
  toggleStep, visibleStep, scaleNote, chordNotes, restoreState, snapshotState,
  setStepEnabled, stepParam, effectiveStepNote, setStepParam, setStepCcLock,
  sequenceEventsAtTick, stepDurationMs, setTrackLength, setTrackTarget, setMidiPort,
  setInternalEngine, setInternalSound, trackLocalStep, maxPageForTrack,
  trackBankIndex, trackSlotIndex, trackLabel, canUseInternal, midiPortLabel,
} from './model.js';

const s = createState();
assert.equal(TRACK_COUNT, 64);
assert.deepEqual(TRACK_BANKS, ['A', 'B', 'C', 'D']);
assert.deepEqual(MIDI_PORTS, ['A', 'B', 'C', 'D']);
assert.equal(INTERNAL_TRACK_COUNT, 8);
assert.equal(s.channels.length, 64);
assert.equal(s.midiPorts.length, 64);
assert.equal(s.steps.length, 64);
assert.equal(s.stepParams.length, 64);
assert.equal(s.trackLengths.length, 64);
assert.equal(s.channels[0], 1);
assert.equal(s.channels[15], 16);
assert.equal(s.channels[16], 1);
assert.equal(s.channels[63], 16);
assert.equal(s.midiPorts[0], 0);
assert.equal(s.midiPorts[15], 0);
assert.equal(s.midiPorts[16], 1);
assert.equal(s.midiPorts[32], 2);
assert.equal(s.midiPorts[63], 3);
assert.equal(midiPortLabel(0), 'A');
assert.equal(midiPortLabel(3), 'D');
assert.equal(trackBankIndex(0), 0);
assert.equal(trackBankIndex(16), 1);
assert.equal(trackBankIndex(63), 3);
assert.equal(trackSlotIndex(31), 15);
assert.equal(trackLabel(0), 'A01');
assert.equal(trackLabel(16), 'B01');
assert.equal(trackLabel(63), 'D16');
assert.equal(canUseInternal(0), true);
assert.equal(canUseInternal(3), true);
assert.equal(canUseInternal(4), true);
assert.equal(canUseInternal(7), true);
assert.equal(canUseInternal(8), false);
assert.equal(canUseInternal(63), false);

assert.equal(s.selectedTrack, 0);
assert.equal(s.ccValues[0][0], 64);
assert.equal(ccNumber(s, 0), 74);
assert.equal(s.drumNotes[0], 36);
assert.equal(stepParam(s, 0, 0).velocity, 100);
assert.equal(stepParam(s, 0, 0).micro, 0);
assert.deepEqual(stepParam(s, 0, 0).ccLocks, [null, null, null, null]);
assert.equal(effectiveStepNote(s, 0, 0), 60);

assert.equal(adjustCc(s, 0, 1), 65);
assert.equal(setCc(s, 0, 999), 127);
assert.equal(setCc(s, 0, -5), 0);
assert.equal(setCcNumber(s, 0, 21), 21);
assert.equal(ccNumber(s, 0), 21);
assert.equal(setDrumNote(s, 0, 140), 127);

assert.equal(setTrackLength(s, 0, 12), 12);
assert.equal(setTrackLength(s, 1, 7), 7);
assert.equal(setTrackLength(s, 63, 31), 31);
assert.equal(setMidiPort(s, 0, 3), 3);
assert.equal(setMidiPort(s, 63, -1), 0);
assert.equal(setMidiPort(s, 63, 3), 3);
assert.equal(trackLocalStep(s, 0, 12), 0);
assert.equal(trackLocalStep(s, 1, 8), 1);
assert.equal(trackLocalStep(s, 63, 31), 0);
assert.equal(maxPageForTrack(s, 0), 0);
assert.equal(maxPageForTrack(s, 63), 1);
assert.equal(setTrackTarget(s, 0, 'BOTH'), 'BOTH');
assert.equal(setInternalEngine(s, 0, 'GRAIN'), 'GRAIN');
assert.equal(setInternalSound(s, 0, 999), 152);
assert.equal(setTrackTarget(s, 4, 'INTERNAL'), 'INTERNAL');
assert.equal(setTrackTarget(s, 7, 'BOTH'), 'BOTH');
assert.equal(setTrackTarget(s, 8, 'INTERNAL'), 'MIDI');
assert.equal(setTrackTarget(s, 63, 'BOTH'), 'MIDI');

s.selectedTrack = 17;
assert.equal(s.ccValues[17][0], 64);
assert.equal(ccNumber(s, 0), 74);
assert.equal(adjustCc(s, 0, -2), 62);
s.selectedTrack = 0;
assert.equal(s.ccValues[0][0], 0);
assert.equal(ccNumber(s, 0), 21);

assert.equal(visibleStep(s, 3), false);
assert.equal(toggleStep(s, 3), true);
assert.equal(visibleStep(s, 3), true);
assert.equal(setStepEnabled(s, 0, 12, true), false);

assert.equal(scaleNote(2, 'Dorian', 0), 50);
assert.equal(scaleNote(2, 'Dorian', 7), 62);
assert.deepEqual(chordNotes(0, 'Major', 0), [48, 52, 55]);
assert.deepEqual(chordNotes(0, 'Major', 1), [50, 53, 57]);
assert.equal(stepDurationMs(120), 125);

setStepEnabled(s, 0, 8, true);
setStepParam(s, 0, 8, 'note', 72);
setStepParam(s, 0, 8, 'velocity', 91);
setStepParam(s, 0, 8, 'gate', 80);
setStepParam(s, 0, 8, 'probability', 50);
setStepParam(s, 0, 8, 'ratchet', 3);
setStepParam(s, 0, 8, 'micro', -25);
setStepCcLock(s, 0, 8, 0, 88);
setStepCcLock(s, 0, 8, 2, 130);
let events = sequenceEventsAtTick(s, 8, () => 0.49);
assert.equal(events.some((e) => e.track === 0), true);
const e0 = events.find((e) => e.track === 0);
assert.equal(e0.step, 8);
assert.equal(e0.target, 'BOTH');
assert.equal(e0.emitMidi, true);
assert.equal(e0.emitInternal, true);
assert.equal(e0.port, 3);
assert.equal(e0.engine, 'GRAIN');
assert.equal(e0.sound, 152);
assert.equal(e0.note, 72);
assert.equal(e0.ratchet, 3);
assert.equal(e0.micro, -25);
assert.deepEqual(e0.ccLocks, [
  { slot: 0, cc: 21, value: 88 },
  { slot: 2, cc: 73, value: 127 },
]);
assert.equal(sequenceEventsAtTick(s, 8, () => 0.50).some((e) => e.track === 0), false);

// M10 event-generation regression: track A08 (index 7) with Target BOTH emits both internal and MIDI.
setTrackLength(s, 7, 16);
setStepEnabled(s, 7, 4, true);
setStepParam(s, 7, 4, 'note', 64);
s.channels[7] = 8;
setMidiPort(s, 7, 0);
assert.equal(setTrackTarget(s, 7, 'BOTH'), 'BOTH');
setInternalEngine(s, 7, 'SAMPLE');
setInternalSound(s, 7, 12);
let ev7 = sequenceEventsAtTick(s, 4, () => 0);
const e7 = ev7.find((e) => e.track === 7);
assert.ok(e7);
assert.equal(e7.step, 4);
assert.equal(e7.target, 'BOTH');
assert.equal(e7.emitMidi, true);
assert.equal(e7.emitInternal, true);
assert.equal(e7.port, 0);
assert.equal(e7.channel, 7);
assert.equal(e7.engine, 'SAMPLE');
assert.equal(e7.sound, 12);
assert.equal(e7.note, 64);

// 64-track scheduling: a high-bank track is a normal independent MIDI track on its own logical port.
setTrackLength(s, 63, 31);
setStepEnabled(s, 63, 0, true);
setStepParam(s, 63, 0, 'note', 48);
s.channels[63] = 16;
setMidiPort(s, 63, 3);
let high = sequenceEventsAtTick(s, 31, () => 0);
high = high.find((e) => e.track === 63);
assert.equal(high.step, 0);
assert.equal(high.emitMidi, true);
assert.equal(high.emitInternal, false);
assert.equal(high.port, 3);
assert.equal(high.channel, 15);
assert.equal(high.note, 48);

// Polymeter remains independent between banks.
setStepParam(s, 0, 8, 'probability', 100);
setStepEnabled(s, 0, 0, true);
setStepEnabled(s, 1, 1, true);
setTrackTarget(s, 1, 'INTERNAL');
setInternalEngine(s, 1, 'SAMPLE');
setInternalSound(s, 1, 9);
let poly = sequenceEventsAtTick(s, 8, () => 0);
assert.equal(poly.some((e) => e.track === 1 && e.step === 1 && e.emitMidi === false && e.emitInternal === true), true);
poly = sequenceEventsAtTick(s, 12, () => 0);
assert.equal(poly.some((e) => e.track === 0 && e.step === 0), true);

// Restore a new 64-track state with explicit port routing.
const restored = restoreState({
  mode: 'DRUM', selectedTrack: 50, page: 3, root: 11, scale: 'Lydian', tempo: 132, follow: false,
  channels: Array.from({ length: 64 }, (_, i) => (i % 16) + 1),
  midiPorts: Array.from({ length: 64 }, (_, i) => i === 50 ? 1 : Math.floor(i / 16)),
  ccNumbers: Array.from({ length: 64 }, (_, t) => [t % 128, 2, 3, 4]),
  trackLengths: Array.from({ length: 64 }, (_, t) => t === 50 ? 7 : 64),
  trackTargets: Array.from({ length: 64 }, (_, t) => t === 2 ? 'BOTH' : t === 50 ? 'INTERNAL' : 'MIDI'),
  internalEngines: Array.from({ length: 64 }, (_, t) => t === 2 ? 'FM6' : 'ANALOG'),
  internalSounds: Array.from({ length: 64 }, (_, t) => t === 2 ? 200 : 0),
  steps: [Array(64).fill(true)],
  stepParams: [[{ note: 100, velocity: 200, gate: 1, probability: -2, ratchet: 9, micro: 90, ccLocks: [10, null, -5, 200] }]],
});
assert.equal(restored.selectedTrack, 50);
assert.equal(restored.trackLengths[50], 7);
assert.equal(restored.midiPorts[50], 1);
assert.equal(restored.trackTargets[2], 'BOTH');
assert.equal(restored.trackTargets[50], 'MIDI');
assert.equal(restored.internalEngines[2], 'FM6');
assert.equal(restored.internalSounds[2], 152);
assert.equal(restored.page, 0);
assert.equal(restored.stepParams[0][0].micro, 50);
assert.equal(snapshotState(restored).version, 6);

// Migration from the old 4-track Browser Companion preserves tracks 1-4 and initializes port routing safely.
const migrated = restoreState({
  selectedTrack: 2,
  channels: [16, 15, 14, 13],
  ccNumbers: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
  seqNotes: [40, 41, 42, 43],
  trackLengths: [16, 12, 7, 64],
  trackTargets: ['MIDI', 'INTERNAL', 'BOTH', 'MIDI'],
  internalEngines: ['ANALOG', 'SAMPLE', 'FM6', 'PHASE'],
  steps: [Array(64).fill(true)],
});
assert.equal(migrated.channels.length, 64);
assert.deepEqual(migrated.channels.slice(0, 4), [16, 15, 14, 13]);
assert.equal(migrated.channels[4], 5);
assert.deepEqual(migrated.trackLengths.slice(0, 4), [16, 12, 7, 64]);
assert.equal(migrated.trackLengths[63], 64);
assert.deepEqual(migrated.trackTargets.slice(0, 4), ['MIDI', 'INTERNAL', 'BOTH', 'MIDI']);
assert.equal(migrated.trackTargets[4], 'MIDI');
assert.deepEqual(migrated.ccNumbers[0], [1, 2, 3, 4]);
assert.deepEqual(migrated.ccNumbers[4], [74, 71, 73, 91]);
assert.equal(migrated.midiPorts[0], 0);
assert.equal(migrated.midiPorts[15], 0);
assert.equal(migrated.midiPorts[16], 1);
assert.equal(migrated.midiPorts[63], 3);
assert.equal(migrated.steps[0][63], true);
assert.equal(migrated.steps[4][0], false);

// Very old flat CC mapping still migrates globally.
const legacy = restoreState({ ccNumbers: [10, 20, 30, 40] });
assert.deepEqual(legacy.ccNumbers[0], [10, 20, 30, 40]);
assert.deepEqual(legacy.ccNumbers[63], [10, 20, 30, 40]);

console.log('Saibertin S-FM browser model: ok');
