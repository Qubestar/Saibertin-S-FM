import assert from 'node:assert/strict';
import {
  MIDI_CLOCK, MIDI_START, MIDI_CONTINUE, MIDI_STOP,
  CLOCKS_PER_QUARTER, CLOCKS_PER_16TH,
  clockIntervalMs, stepIntervalMs, isSixteenthBoundary,
  sixteenthTickForClockCount, bpmFromClockIntervals, normalizeClockOutPorts,
} from './sync-model.js';

assert.equal(MIDI_CLOCK, 0xF8);
assert.equal(MIDI_START, 0xFA);
assert.equal(MIDI_CONTINUE, 0xFB);
assert.equal(MIDI_STOP, 0xFC);
assert.equal(CLOCKS_PER_QUARTER, 24);
assert.equal(CLOCKS_PER_16TH, 6);
assert.equal(Math.round(clockIntervalMs(120) * 1000) / 1000, 20.833);
assert.equal(stepIntervalMs(120), 125);
assert.equal(isSixteenthBoundary(0), false);
assert.equal(isSixteenthBoundary(5), false);
assert.equal(isSixteenthBoundary(6), true);
assert.equal(isSixteenthBoundary(12), true);
assert.equal(sixteenthTickForClockCount(0), 0);
assert.equal(sixteenthTickForClockCount(5), 0);
assert.equal(sixteenthTickForClockCount(6), 1);
assert.equal(sixteenthTickForClockCount(23), 3);
assert.equal(sixteenthTickForClockCount(24), 4);
assert.ok(Math.abs(bpmFromClockIntervals(Array(24).fill(60000 / (120 * 24))) - 120) < 0.001);
assert.ok(Math.abs(bpmFromClockIntervals([20.9,20.7,20.8,100,20.85,20.82,20.81,20.84,20.83,20.8]) - 120) < 3);
assert.deepEqual(normalizeClockOutPorts([true,false,1,0]), [true,false,true,false]);

console.log('Saibertin S-FM sync model: ok');
