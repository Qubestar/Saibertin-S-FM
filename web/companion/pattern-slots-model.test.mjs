import assert from 'node:assert/strict';
import {
  PATTERN_SLOTS, captureTrackPattern, applyTrackPattern,
  clonePatternSnapshot, nextPatternSlot, normalizePatternSnapshot,
} from './pattern-slots-model.js';

assert.deepEqual(PATTERN_SLOTS, ['A', 'B', 'C', 'D']);
assert.equal(nextPatternSlot('A'), 'B');
assert.equal(nextPatternSlot('D'), 'A');

const state = {
  trackLengths: Array(64).fill(64),
  seqNotes: Array(64).fill(60),
  steps: Array.from({ length: 64 }, () => Array(64).fill(false)),
  stepParams: Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => ({
    note: null, velocity: 100, gate: 55, probability: 100, ratchet: 1, micro: 0,
    ccLocks: [null, null, null, null],
  }))),
};
state.trackLengths[0] = 16;
state.seqNotes[0] = 36;
state.steps[0][0] = true;
state.steps[0][4] = true;
state.steps[0][8] = true;
state.steps[0][12] = true;
state.stepParams[0][4].velocity = 118;
state.stepParams[0][8].ratchet = 3;
state.stepParams[0][8].micro = -20;
state.stepParams[0][12].ccLocks[0] = 99;

const snap = captureTrackPattern(state, 0);
assert.equal(snap.length, 16);
assert.equal(snap.seqNote, 36);
assert.deepEqual(snap.enabled, [0, 4, 8, 12]);
assert.deepEqual(Object.keys(snap.params).map(Number), [4, 8, 12]);
assert.equal(snap.params[8].ratchet, 3);
assert.equal(snap.params[12].ccLocks[0], 99);

const cloned = clonePatternSnapshot(snap);
cloned.params[4].velocity = 1;
assert.equal(snap.params[4].velocity, 118);

const target = JSON.parse(JSON.stringify(state));
target.trackLengths[1] = 7;
target.seqNotes[1] = 72;
target.steps[1] = Array(64).fill(true);
applyTrackPattern(target, 1, snap);
assert.equal(target.trackLengths[1], 16);
assert.equal(target.seqNotes[1], 36);
assert.deepEqual(target.steps[1].slice(0, 16).map((v, i) => v ? i : null).filter((v) => v !== null), [0, 4, 8, 12]);
assert.equal(target.steps[1][20], false);
assert.equal(target.stepParams[1][4].velocity, 118);
assert.equal(target.stepParams[1][8].micro, -20);
assert.equal(target.stepParams[1][12].ccLocks[0], 99);
assert.equal(target.stepParams[1][2].velocity, 100);

const normalized = normalizePatternSnapshot({
  length: 99, seqNote: -4, enabled: [0, 0, 70, 3],
  params: { 2: { velocity: 999, ratchet: 9, micro: -99, ccLocks: [200] } },
});
assert.equal(normalized.length, 64);
assert.equal(normalized.seqNote, 0);
assert.deepEqual(normalized.enabled, [0, 3, 63]);
assert.equal(normalized.params[2].velocity, 127);
assert.equal(normalized.params[2].ratchet, 4);
assert.equal(normalized.params[2].micro, -50);
assert.equal(normalized.params[2].ccLocks[0], 127);

console.log('Saibertin S-FM pattern slots model: ok');
