import assert from 'node:assert/strict';
import {
  createState, setCc, adjustCc, ccNumber, setCcNumber, setDrumNote,
  toggleStep, visibleStep, scaleNote, chordNotes, restoreState, snapshotState,
  setStepEnabled, stepParam, effectiveStepNote, setStepParam, setStepCcLock,
  sequenceEventsAtTick, stepDurationMs, setTrackLength, setTrackTarget,
  setInternalEngine, setInternalSound, trackLocalStep, maxPageForTrack,
} from './model.js';

const s = createState();
assert.equal(s.selectedTrack, 0);
assert.equal(s.ccValues[0][0], 64);
assert.equal(ccNumber(s, 0), 74);
assert.equal(s.drumNotes[0], 36);
assert.equal(stepParam(s, 0, 0).velocity, 100);
assert.equal(stepParam(s, 0, 0).micro, 0);
assert.deepEqual(stepParam(s, 0, 0).ccLocks, [null, null, null, null]);
assert.equal(effectiveStepNote(s, 0, 0), 60);
assert.deepEqual(s.trackLengths, [64, 64, 64, 64]);
assert.deepEqual(s.trackTargets, ['MIDI', 'MIDI', 'MIDI', 'MIDI']);

assert.equal(adjustCc(s, 0, 1), 65);
assert.equal(setCc(s, 0, 999), 127);
assert.equal(setCc(s, 0, -5), 0);
assert.equal(setCcNumber(s, 0, 21), 21);
assert.equal(ccNumber(s, 0), 21);
assert.equal(setDrumNote(s, 0, 140), 127);

assert.equal(setTrackLength(s, 0, 12), 12);
assert.equal(setTrackLength(s, 1, 7), 7);
assert.equal(trackLocalStep(s, 0, 12), 0);
assert.equal(trackLocalStep(s, 1, 8), 1);
assert.equal(maxPageForTrack(s, 0), 0);
assert.equal(setTrackTarget(s, 0, 'BOTH'), 'BOTH');
assert.equal(setInternalEngine(s, 0, 'GRAIN'), 'GRAIN');
assert.equal(setInternalSound(s, 0, 999), 152);

s.selectedTrack = 1;
assert.equal(s.ccValues[1][0], 64);
assert.equal(ccNumber(s, 0), 74);
assert.equal(adjustCc(s, 0, -2), 62);
s.selectedTrack = 0;
assert.equal(s.ccValues[0][0], 0);
assert.equal(ccNumber(s, 0), 21);

assert.equal(visibleStep(s, 3), false);
assert.equal(toggleStep(s, 3), true);
assert.equal(visibleStep(s, 3), true);
assert.equal(setStepEnabled(s, 0, 12, true), false); // beyond T1 length 12

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
assert.equal(events.length, 1);
assert.equal(events[0].step, 8);
assert.equal(events[0].target, 'BOTH');
assert.equal(events[0].emitMidi, true);
assert.equal(events[0].emitInternal, true);
assert.equal(events[0].engine, 'GRAIN');
assert.equal(events[0].sound, 152);
assert.equal(events[0].note, 72);
assert.equal(events[0].ratchet, 3);
assert.equal(events[0].micro, -25);
assert.deepEqual(events[0].ccLocks, [
  { slot: 0, cc: 21, value: 88 },
  { slot: 2, cc: 73, value: 127 },
]);
assert.equal(sequenceEventsAtTick(s, 8, () => 0.50).length, 0);

// Polymeter: T1 length 12 wraps tick 12 back to step 0; T2 length 7 wraps independently.
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

const restored = restoreState({
  mode: 'DRUM', selectedTrack: 2, page: 3, root: 11, scale: 'Lydian', tempo: 132, follow: false,
  channels: [16, 0, 5, 10],
  ccNumbers: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
  drumNotes: Array.from({ length: 16 }, (_, i) => 40 + i),
  trackLengths: [16, 12, 7, 64],
  trackTargets: ['MIDI', 'INTERNAL', 'BOTH', 'NOPE'],
  internalEngines: ['ANALOG', 'SAMPLE', 'FM6', 'BAD'],
  internalSounds: [1, 2, 200, -2],
  steps: [Array(64).fill(true)],
  stepParams: [[{
    note: 100, velocity: 200, gate: 1, probability: -2, ratchet: 9,
    micro: 90, ccLocks: [10, null, -5, 200],
  }]],
});
assert.deepEqual(restored.trackLengths, [16, 12, 7, 64]);
assert.deepEqual(restored.trackTargets, ['MIDI', 'INTERNAL', 'BOTH', 'MIDI']);
assert.deepEqual(restored.internalEngines, ['ANALOG', 'SAMPLE', 'FM6', 'SAMPLE']);
assert.deepEqual(restored.internalSounds, [1, 2, 152, 0]);
assert.equal(restored.page, 0); // selected T3 length 7 cannot remain on page 4
assert.equal(restored.stepParams[0][0].micro, 50);
assert.equal(snapshotState(restored).version, 4);

// Migration from M2/M3/M4: defaults preserve prior all-MIDI / length-64 behavior.
const migrated = restoreState({ ccNumbers: [10, 20, 30, 40], steps: [Array(64).fill(true)] });
assert.deepEqual(migrated.ccNumbers[0], [10, 20, 30, 40]);
assert.deepEqual(migrated.trackLengths, [64, 64, 64, 64]);
assert.deepEqual(migrated.trackTargets, ['MIDI', 'MIDI', 'MIDI', 'MIDI']);
assert.equal(migrated.stepParams[0][0].micro, 0);
assert.deepEqual(migrated.stepParams[0][0].ccLocks, [null, null, null, null]);

console.log('Saibertin S-FM browser model: ok');
