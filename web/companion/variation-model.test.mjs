import assert from 'node:assert/strict';
import { applyVariation, variationRange, VARIATIONS } from './variation-model.js';

const makeState = () => ({
  page: 0,
  trackLengths: Array(64).fill(16),
  steps: Array.from({ length: 64 }, () => Array(64).fill(false)),
  stepParams: Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => ({
    note: null, velocity: 100, gate: 55, probability: 100, ratchet: 1, micro: 0,
    ccLocks: [null, null, null, null],
  }))),
});

assert.ok(VARIATIONS.length >= 9);
let s = makeState();
assert.deepEqual(variationRange(s, 0, 'PAGE'), { start: 0, end: 16 });
s.trackLengths[0] = 31;
s.page = 1;
assert.deepEqual(variationRange(s, 0, 'PAGE'), { start: 16, end: 31 });
assert.deepEqual(variationRange(s, 0, 'TRACK'), { start: 0, end: 31 });

s = makeState();
applyVariation(s, 0, 'fill-1beat', 'PAGE');
assert.deepEqual(s.steps[0].slice(0,16).map((v,i)=>v?i:null).filter(v=>v!==null), [12,13,14,15]);
assert.deepEqual(s.stepParams[0].slice(12,16).map(p=>p.velocity), [82,96,110,124]);

s = makeState();
applyVariation(s, 0, 'fill-2beat', 'PAGE');
assert.deepEqual(s.steps[0].slice(0,16).map((v,i)=>v?i:null).filter(v=>v!==null), [8,9,10,11,12,13,14,15]);
assert.equal(s.stepParams[0][15].velocity, 124);

s = makeState();
applyVariation(s, 0, 'roll-last', 'PAGE');
assert.equal(s.steps[0][15], true);
assert.equal(s.stepParams[0][15].ratchet, 4);
assert.equal(s.stepParams[0][15].gate, 35);

s = makeState();
applyVariation(s, 0, 'ghost-backbeat', 'PAGE');
assert.equal(s.steps[0][3], true);
assert.equal(s.steps[0][11], true);
assert.equal(s.stepParams[0][3].velocity, 45);

s = makeState();
applyVariation(s, 0, 'rolling-16', 'PAGE');
assert.equal(s.steps[0].slice(0,16).every(Boolean), true);
assert.equal(s.stepParams[0][0].velocity, 112);
assert.equal(s.stepParams[0][1].velocity, 72);

s = makeState();
for (const i of [0,2,4,6]) s.steps[0][i] = true;
applyVariation(s, 0, 'velocity-alternate', 'PAGE');
assert.deepEqual([0,2,4,6].map(i=>s.stepParams[0][i].velocity), [112,78,112,78]);
applyVariation(s, 0, 'crescendo', 'PAGE');
assert.deepEqual([0,2,4,6].map(i=>s.stepParams[0][i].velocity), [60,82,105,127]);
applyVariation(s, 0, 'ratchet-4', 'PAGE');
assert.deepEqual([0,2,4,6].map(i=>s.stepParams[0][i].ratchet), [1,1,1,2]);

console.log('Saibertin S-FM variation model: ok');
