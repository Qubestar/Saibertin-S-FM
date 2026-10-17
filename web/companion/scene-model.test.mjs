import assert from 'node:assert/strict';
import {
  SCENE_COUNT, SLOT_NAMES, SCENE_QUANTIZE, normalizeSlotMap, normalizeScenePatterns, normalizeScene,
  parseSceneChain, formatSceneChain, nextSceneCursor, sceneAtCursor,
  normalizeSceneQuantize, sceneBoundarySteps, isSceneBoundary, isSceneElapsedBoundary,
} from './scene-model.js';

assert.equal(SCENE_COUNT, 8);
assert.deepEqual(SLOT_NAMES, ['A', 'B', 'C', 'D']);
assert.deepEqual(SCENE_QUANTIZE, ['BAR1', 'BAR2', 'PATTERN']);
const map = normalizeSlotMap(['B', 'C', 'Z']);
assert.equal(map.length, 64);
assert.deepEqual(map.slice(0, 4), ['B', 'C', 'A', 'A']);
const patternA = { version: 1, length: 16, seqNote: 36, enabled: [0, 4, 8, 12], params: {} };
const patterns = normalizeScenePatterns([patternA, null]);
assert.equal(patterns.length, 64);
assert.deepEqual(patterns[0], patternA);
assert.equal(patterns[1], null);
const scene = normalizeScene({ name: ' Drop ', slots: ['D'], patterns: [patternA], quantize: 'BAR2' }, 2);
assert.equal(scene.name, 'Drop');
assert.equal(scene.slots[0], 'D');
assert.equal(scene.slots[1], 'A');
assert.deepEqual(scene.patterns[0], patternA);
assert.equal(scene.patterns[1], null);
assert.equal(scene.quantize, 'BAR2');
const migratedScene = normalizeScene({ name: 'Legacy' }, 0, 'PATTERN');
assert.equal(migratedScene.quantize, 'PATTERN');
assert.equal(normalizeScene(null, 0), null);
assert.deepEqual(parseSceneChain('1, 1 > 2; 8 99'), [0, 0, 1, 7]);
assert.equal(formatSceneChain([0, 0, 1, 7]), '1 → 1 → 2 → 8');
assert.equal(nextSceneCursor([0, 1, 2], 0, 1), 1);
assert.equal(nextSceneCursor([0, 1, 2], 2, 1), 0);
assert.equal(nextSceneCursor([0, 1, 2], 0, -1), 2);
assert.equal(sceneAtCursor([3, 5], 1), 5);

assert.equal(normalizeSceneQuantize('BAR2'), 'BAR2');
assert.equal(normalizeSceneQuantize('???'), 'BAR1');
const timingState = { trackLengths: [16, 12, 7, 32] };
assert.equal(sceneBoundarySteps(timingState, 'BAR1'), 16);
assert.equal(sceneBoundarySteps(timingState, 'BAR2'), 32);
assert.equal(sceneBoundarySteps(timingState, 'PATTERN'), 32);
assert.equal(isSceneBoundary(0, timingState, 'BAR1'), true);
assert.equal(isSceneBoundary(15, timingState, 'BAR1'), false);
assert.equal(isSceneBoundary(16, timingState, 'BAR1'), true);
assert.equal(isSceneBoundary(31, timingState, 'BAR2'), false);
assert.equal(isSceneBoundary(32, timingState, 'BAR2'), true);
assert.equal(isSceneBoundary(64, timingState, 'PATTERN'), true);
assert.equal(isSceneBoundary(48, timingState, 'PATTERN'), false);

// Per-scene duration is measured from when that Scene became active.
assert.equal(isSceneElapsedBoundary(0, 0, timingState, 'BAR1'), true);
assert.equal(isSceneElapsedBoundary(15, 0, timingState, 'BAR1'), false);
assert.equal(isSceneElapsedBoundary(16, 0, timingState, 'BAR1'), true);
assert.equal(isSceneElapsedBoundary(32, 16, timingState, 'BAR2'), false);
assert.equal(isSceneElapsedBoundary(47, 16, timingState, 'BAR2'), false);
assert.equal(isSceneElapsedBoundary(48, 16, timingState, 'BAR2'), true);
assert.equal(isSceneElapsedBoundary(15, 16, timingState, 'BAR1'), false);

console.log('Saibertin S-FM scene model: ok');
