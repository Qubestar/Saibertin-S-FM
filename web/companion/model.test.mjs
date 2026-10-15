import assert from 'node:assert/strict';
import {
  createState, setCc, adjustCc, ccNumber, setCcNumber, setDrumNote,
  toggleStep, visibleStep, scaleNote, chordNotes, restoreState, snapshotState,
  setStepEnabled, stepParam, effectiveStepNote, setStepParam, sequenceEventsAtStep, stepDurationMs,
} from './model.js';

const s = createState();
assert.equal(s.selectedTrack, 0);
assert.equal(s.ccValues[0][0], 64);
assert.equal(ccNumber(s, 0), 74);
assert.equal(s.drumNotes[0], 36);
assert.equal(stepParam(s, 0, 0).velocity, 100);
assert.equal(effectiveStepNote(s, 0, 0), 60);

assert.equal(adjustCc(s, 0, 1), 65);
assert.equal(setCc(s, 0, 999), 127);
assert.equal(setCc(s, 0, -5), 0);
assert.equal(setCcNumber(s, 0, 21), 21);
assert.equal(ccNumber(s, 0), 21);
assert.equal(setDrumNote(s, 0, 140), 127);

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
s.page = 1;
assert.equal(visibleStep(s, 3), false);
assert.equal(toggleStep(s, 3), true);
assert.equal(s.steps[0][19], true);

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
let events = sequenceEventsAtStep(s, 8, () => 0.49);
assert.equal(events.length, 1);
assert.deepEqual(events[0], { track: 0, channel: 0, note: 72, velocity: 91, gate: 80, probability: 50, ratchet: 3 });
events = sequenceEventsAtStep(s, 8, () => 0.50);
assert.equal(events.length, 0);
setStepParam(s, 0, 8, 'note', null);
assert.equal(effectiveStepNote(s, 0, 8), 60);
setStepParam(s, 0, 8, 'probability', 100);
assert.equal(sequenceEventsAtStep(s, 8, () => 0.999).length, 1);

const restored = restoreState({
  mode: 'DRUM', selectedTrack: 2, page: 3, root: 11, scale: 'Lydian', tempo: 132, follow: false,
  channels: [16, 0, 5, 10],
  ccNumbers: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
  drumNotes: Array.from({ length: 16 }, (_, i) => 40 + i),
  steps: [Array(64).fill(true)],
  stepParams: [[{ note: 100, velocity: 200, gate: 1, probability: -2, ratchet: 9 }]],
});
assert.equal(restored.mode, 'DRUM');
assert.equal(restored.selectedTrack, 2);
assert.equal(restored.channels[1], 0);
assert.equal(restored.ccNumbers[2][3], 12);
assert.equal(restored.drumNotes[15], 55);
assert.equal(restored.steps[0][63], true);
assert.equal(restored.steps[1][0], false);
assert.equal(restored.tempo, 132);
assert.equal(restored.follow, false);
assert.deepEqual(restored.stepParams[0][0], { note: 100, velocity: 127, gate: 5, probability: 0, ratchet: 4 });
assert.equal(snapshotState(restored).version, 2);

const migrated = restoreState({ ccNumbers: [10, 20, 30, 40], steps: [Array(64).fill(true)] });
assert.deepEqual(migrated.ccNumbers[0], [10, 20, 30, 40]);
assert.deepEqual(migrated.ccNumbers[3], [10, 20, 30, 40]);
assert.equal(migrated.stepParams[0][0].note, null);
assert.equal(migrated.stepParams[0][0].probability, 100);

console.log('Saibertin S-FM browser model: ok');
