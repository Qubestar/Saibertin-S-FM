import assert from 'node:assert/strict';
import {
  SCENE_COUNT, SLOT_NAMES, normalizeSlotMap, normalizeScene,
  parseSceneChain, formatSceneChain, nextSceneCursor, sceneAtCursor,
} from './scene-model.js';

assert.equal(SCENE_COUNT, 8);
assert.deepEqual(SLOT_NAMES, ['A', 'B', 'C', 'D']);
const map = normalizeSlotMap(['B', 'C', 'Z']);
assert.equal(map.length, 64);
assert.deepEqual(map.slice(0, 4), ['B', 'C', 'A', 'A']);
const scene = normalizeScene({ name: ' Drop ', slots: ['D'] }, 2);
assert.equal(scene.name, 'Drop');
assert.equal(scene.slots[0], 'D');
assert.equal(scene.slots[1], 'A');
assert.equal(normalizeScene(null, 0), null);
assert.deepEqual(parseSceneChain('1, 1 > 2; 8 99'), [0, 0, 1, 7]);
assert.equal(formatSceneChain([0, 0, 1, 7]), '1 → 1 → 2 → 8');
assert.equal(nextSceneCursor([0, 1, 2], 0, 1), 1);
assert.equal(nextSceneCursor([0, 1, 2], 2, 1), 0);
assert.equal(nextSceneCursor([0, 1, 2], 0, -1), 2);
assert.equal(sceneAtCursor([3, 5], 1), 5);
console.log('Saibertin S-FM scene model: ok');
