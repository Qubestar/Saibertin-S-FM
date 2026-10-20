import assert from 'node:assert/strict';
import {
  WORKSPACES,
  DEFAULT_WORKSPACE,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_METADATA,
  normalizeWorkspace,
  isModuleVisible,
  visibleModuleIds,
} from './workspace-model.js';

// Supported workspaces
assert.deepEqual(WORKSPACES, ['SIMPLE', 'PERFORMANCE', 'ADVANCED']);
assert.equal(DEFAULT_WORKSPACE, 'SIMPLE');
assert.equal(WORKSPACE_STORAGE_KEY, 'saibertin-s-fm-workspace-v1');
assert.equal(WORKSPACE_METADATA.length, 3);
assert.deepEqual(
  WORKSPACE_METADATA.map((m) => m.id),
  ['SIMPLE', 'PERFORMANCE', 'ADVANCED'],
);

// Normalization & fallback
assert.equal(normalizeWorkspace(null), 'SIMPLE');
assert.equal(normalizeWorkspace(undefined), 'SIMPLE');
assert.equal(normalizeWorkspace(''), 'SIMPLE');
assert.equal(normalizeWorkspace('INVALID'), 'SIMPLE');
assert.equal(normalizeWorkspace('simple'), 'SIMPLE');
assert.equal(normalizeWorkspace('PERFORMANCE'), 'PERFORMANCE');
assert.equal(normalizeWorkspace('performance'), 'PERFORMANCE');
assert.equal(normalizeWorkspace('ADVANCED'), 'ADVANCED');
assert.equal(normalizeWorkspace('advanced'), 'ADVANCED');
assert.equal(normalizeWorkspace(123), 'SIMPLE');
assert.equal(normalizeWorkspace({}), 'SIMPLE');

// SIMPLE visibility map
assert.equal(isModuleVisible('SIMPLE', 'core'), true);
assert.equal(isModuleVisible('SIMPLE', 'pattern-slots'), true);
assert.equal(isModuleVisible('SIMPLE', 'pattern-library'), true);
assert.equal(isModuleVisible('SIMPLE', 'performance'), false);
assert.equal(isModuleVisible('SIMPLE', 'sync'), false);
assert.equal(isModuleVisible('SIMPLE', 'variations'), false);
assert.equal(isModuleVisible('SIMPLE', 'scenes'), false);
assert.equal(isModuleVisible('SIMPLE', 'song'), false);
assert.equal(isModuleVisible('SIMPLE', 'track-internal'), false);
assert.equal(isModuleVisible('SIMPLE', 'midi-routing'), false);
assert.equal(isModuleVisible('SIMPLE', 'ccs'), false);
assert.equal(isModuleVisible('SIMPLE', 'step-editor'), false);
assert.equal(isModuleVisible('SIMPLE', 'drum-map'), false);

const simpleModules = visibleModuleIds('SIMPLE');
assert.deepEqual(simpleModules, ['core', 'pattern-slots', 'pattern-library']);

// PERFORMANCE visibility map: includes SIMPLE plus performance/arrangement modules
assert.equal(isModuleVisible('PERFORMANCE', 'core'), true);
assert.equal(isModuleVisible('PERFORMANCE', 'pattern-slots'), true);
assert.equal(isModuleVisible('PERFORMANCE', 'pattern-library'), true);
assert.equal(isModuleVisible('PERFORMANCE', 'performance'), true);
assert.equal(isModuleVisible('PERFORMANCE', 'sync'), true);
assert.equal(isModuleVisible('PERFORMANCE', 'variations'), true);
assert.equal(isModuleVisible('PERFORMANCE', 'scenes'), true);
assert.equal(isModuleVisible('PERFORMANCE', 'song'), true);
assert.equal(isModuleVisible('PERFORMANCE', 'track-internal'), false);
assert.equal(isModuleVisible('PERFORMANCE', 'midi-routing'), false);
assert.equal(isModuleVisible('PERFORMANCE', 'ccs'), false);
assert.equal(isModuleVisible('PERFORMANCE', 'step-editor'), false);
assert.equal(isModuleVisible('PERFORMANCE', 'drum-map'), false);

const perfModules = visibleModuleIds('PERFORMANCE');
assert.deepEqual(perfModules, [
  'core',
  'pattern-slots',
  'pattern-library',
  'performance',
  'sync',
  'variations',
  'scenes',
  'song',
]);

// ADVANCED visibility map: includes all module groups
assert.equal(isModuleVisible('ADVANCED', 'core'), true);
assert.equal(isModuleVisible('ADVANCED', 'pattern-slots'), true);
assert.equal(isModuleVisible('ADVANCED', 'pattern-library'), true);
assert.equal(isModuleVisible('ADVANCED', 'performance'), true);
assert.equal(isModuleVisible('ADVANCED', 'sync'), true);
assert.equal(isModuleVisible('ADVANCED', 'variations'), true);
assert.equal(isModuleVisible('ADVANCED', 'scenes'), true);
assert.equal(isModuleVisible('ADVANCED', 'song'), true);
assert.equal(isModuleVisible('ADVANCED', 'track-internal'), true);
assert.equal(isModuleVisible('ADVANCED', 'midi-routing'), true);
assert.equal(isModuleVisible('ADVANCED', 'ccs'), true);
assert.equal(isModuleVisible('ADVANCED', 'step-editor'), true);
assert.equal(isModuleVisible('ADVANCED', 'drum-map'), true);

const advModules = visibleModuleIds('ADVANCED');
assert.equal(advModules.length, 13);

console.log('Saibertin S-FM workspace model: ok');
