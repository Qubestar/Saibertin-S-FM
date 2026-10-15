import assert from 'node:assert/strict';
import {
  performanceRateMs, normalizePerformanceNotes, expandArpNotes, arpOrder, arpNoteAt,
} from './performance-model.js';

assert.equal(performanceRateMs(120, '1/4', false), 500);
assert.equal(performanceRateMs(120, '1/8', false), 250);
assert.equal(performanceRateMs(120, '1/16', false), 125);
assert.equal(performanceRateMs(120, '1/32', false), 62.5);
assert.ok(Math.abs(performanceRateMs(120, '1/16', true) - 83.3333333333) < 0.001);
assert.equal(performanceRateMs(999, '1/4', false), 200); // tempo clamps to 300

assert.deepEqual(normalizePerformanceNotes([64, 60, 64, -9, 200]), [0, 60, 64, 127]);
assert.deepEqual(expandArpNotes([60, 64], 2), [60, 64, 72, 76]);
assert.deepEqual(expandArpNotes([120], 4), [120]);
assert.deepEqual(arpOrder([60, 64, 67], 'UP', 1), [60, 64, 67]);
assert.deepEqual(arpOrder([60, 64, 67], 'DOWN', 1), [67, 64, 60]);
assert.deepEqual(arpOrder([60, 64, 67], 'UPDOWN', 1), [60, 64, 67, 64]);
assert.equal(arpNoteAt([60, 64, 67], 4, 'UP', 1), 64);
assert.equal(arpNoteAt([60, 64, 67], 0, 'RANDOM', 1, () => 0), 60);
assert.equal(arpNoteAt([60, 64, 67], 0, 'RANDOM', 1, () => 0.999), 67);
assert.equal(arpNoteAt([], 0, 'UP', 1), null);

console.log('Saibertin S-FM performance model: ok');
