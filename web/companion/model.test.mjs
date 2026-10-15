import assert from 'node:assert/strict';
import { createState, setCc, adjustCc, toggleStep, visibleStep, scaleNote, chordNotes } from './model.js';

const s = createState();
assert.equal(s.selectedTrack, 0);
assert.equal(s.ccValues[0][0], 64);

assert.equal(adjustCc(s, 0, 1), 65);
assert.equal(setCc(s, 0, 999), 127);
assert.equal(setCc(s, 0, -5), 0);

s.selectedTrack = 1;
assert.equal(s.ccValues[1][0], 64);
assert.equal(adjustCc(s, 0, -2), 62);
s.selectedTrack = 0;
assert.equal(s.ccValues[0][0], 0);

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

console.log('Saibertin S-FM browser model: ok');
