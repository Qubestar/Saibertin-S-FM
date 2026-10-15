import assert from 'node:assert/strict';
import {
  PATTERN_PRESETS, getPatternPreset, rotatePattern, euclideanPattern,
  applyPatternToSteps, patternPreview,
} from './pattern-model.js';

assert.ok(PATTERN_PRESETS.length >= 12);
assert.deepEqual(getPatternPreset('kick-four-floor').mask, [
  true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,
]);
assert.deepEqual(getPatternPreset('snare-backbeat').mask, [
  false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false,
]);
assert.deepEqual(getPatternPreset('hat-offbeat').mask, [
  false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,
]);
assert.deepEqual(getPatternPreset('perc-tresillo').mask, [
  true,false,false,false,false,false,true,false,false,false,false,false,true,false,false,false,
]);

const e416 = euclideanPattern(16, 4, 0);
assert.deepEqual(e416, getPatternPreset('kick-four-floor').mask);
const e516 = euclideanPattern(16, 5, 0);
assert.equal(e516.filter(Boolean).length, 5);
assert.equal(e516[0], true);
assert.equal(euclideanPattern(7, 20, 0).filter(Boolean).length, 7);
assert.equal(euclideanPattern(8, 0, 0).filter(Boolean).length, 0);

assert.deepEqual(rotatePattern([true,false,false,false], 1), [false,true,false,false]);
assert.deepEqual(rotatePattern([true,false,false,false], -1), [false,false,false,true]);

const empty = Array(64).fill(false);
let out = applyPatternToSteps(empty, 64, 0, getPatternPreset('kick-four-floor').mask, 'PAGE', 'REPLACE');
assert.equal(out[0], true);
assert.equal(out[4], true);
assert.equal(out[16], false);

out = applyPatternToSteps(empty, 64, 1, getPatternPreset('snare-backbeat').mask, 'PAGE', 'REPLACE');
assert.equal(out[20], true); // page 2, local step 5
assert.equal(out[28], true); // page 2, local step 13
assert.equal(out[4], false);

const seeded = Array(64).fill(false); seeded[1] = true;
out = applyPatternToSteps(seeded, 16, 0, getPatternPreset('kick-four-floor').mask, 'PAGE', 'MERGE');
assert.equal(out[1], true);
assert.equal(out[4], true);

out = applyPatternToSteps(empty, 40, 0, getPatternPreset('kick-four-floor').mask, 'TRACK', 'REPLACE');
assert.equal(out[0], true);
assert.equal(out[16], true);
assert.equal(out[32], true);
assert.equal(out[40], false);

out = applyPatternToSteps(Array(64).fill(true), 7, 0, [true,false], 'TRACK', 'REPLACE');
assert.deepEqual(out.slice(0, 7), [true,false,true,false,true,false,true]);
assert.equal(out.slice(7).some(Boolean), false);

assert.match(patternPreview([true,false,true,false]), /^● · ● ·$/);
console.log('Saibertin S-FM pattern model: ok');
