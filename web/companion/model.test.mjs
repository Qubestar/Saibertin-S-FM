import assert from 'node:assert/strict';
import {
  createState, setCc, adjustCc, ccNumber, setCcNumber, setDrumNote, setSeqNote, setTempo,
  toggleStep, visibleStep, scaleNote, chordNotes, restoreState, snapshotState,
  stepDurationMs, sequenceEventsAtStep,
} from './model.js';

const s = createState();
assert.equal(s.selectedTrack, 0);
assert.equal(s.ccValues[0][0], 64);
assert.equal(ccNumber(s, 0), 74);
assert.equal(s.drumNotes[0], 36);
assert.equal(s.tempo, 120);
assert.equal(s.seqNotes[0], 60);

assert.equal(adjustCc(s, 0, 1), 65);
assert.equal(setCc(s, 0, 999), 127);
assert.equal(setCc(s, 0, -5), 0);
assert.equal(setCcNumber(s, 0, 21), 21);
assert.equal(ccNumber(s, 0), 21);
assert.equal(setDrumNote(s, 0, 140), 127);
assert.equal(setSeqNote(s, 0, 62), 62);
assert.equal(setTempo(s, 0), 30);
assert.equal(setTempo(s, 999), 300);
assert.equal(setTempo(s, 120), 120);
assert.equal(stepDurationMs(120), 125);

s.selectedTrack = 1;
assert.equal(s.ccValues[1][0], 64);
assert.equal(ccNumber(s, 0), 74); // mappings are independent per track
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

assert.equal(scaleNote(2, 'Dorian', 0), 50); // D3
assert.equal(scaleNote(2, 'Dorian', 7), 62); // D4
assert.deepEqual(chordNotes(0, 'Major', 0), [48, 52, 55]); // C major
assert.deepEqual(chordNotes(0, 'Major', 1), [50, 53, 57]); // D minor

const seq = createState();
seq.steps[0][0] = true;
seq.steps[1][0] = true;
seq.channels[1] = 0; // MIDI OFF suppresses track 2
seq.seqNotes[0] = 61;
assert.deepEqual(sequenceEventsAtStep(seq, 0), [
  { track: 0, channel: 0, note: 61, velocity: 100 },
]);
assert.deepEqual(sequenceEventsAtStep(seq, 1), []);

const restored = restoreState({
  mode: 'DRUM', selectedTrack: 2, page: 3, root: 11, scale: 'Lydian', tempo: 133, follow: false,
  channels: [16, 0, 5, 10],
  ccNumbers: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
  drumNotes: Array.from({ length: 16 }, (_, i) => 40 + i),
  seqNotes: [40, 41, 42, 43],
  steps: [Array(64).fill(true)],
});
assert.equal(restored.mode, 'DRUM');
assert.equal(restored.selectedTrack, 2);
assert.equal(restored.channels[1], 0);
assert.equal(restored.ccNumbers[2][3], 12);
assert.equal(restored.drumNotes[15], 55);
assert.equal(restored.seqNotes[3], 43);
assert.equal(restored.tempo, 133);
assert.equal(restored.follow, false);
assert.equal(restored.steps[0][63], true);
assert.equal(restored.steps[1][0], false);
assert.equal(snapshotState(restored).version, 1);

// Migration from the first M2 flat CC mapping.
const migrated = restoreState({ ccNumbers: [10, 20, 30, 40] });
assert.deepEqual(migrated.ccNumbers[0], [10, 20, 30, 40]);
assert.deepEqual(migrated.ccNumbers[3], [10, 20, 30, 40]);

console.log('Saibertin S-FM browser model: ok');
