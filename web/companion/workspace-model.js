export const WORKSPACES = ['SIMPLE', 'PERFORMANCE', 'ADVANCED'];
export const DEFAULT_WORKSPACE = 'SIMPLE';
export const WORKSPACE_STORAGE_KEY = 'saibertin-s-fm-workspace-v1';

export const WORKSPACE_METADATA = [
  { id: 'SIMPLE', label: 'SIMPLE', desc: 'Simple · sequence' },
  { id: 'PERFORMANCE', label: 'PERFORMANCE', desc: 'Performance · play & arrange' },
  { id: 'ADVANCED', label: 'ADVANCED', desc: 'Advanced · full editor' },
];

export const MODULE_IDS = [
  'core',
  'pattern-slots',
  'pattern-library',
  'performance',
  'sync',
  'variations',
  'scenes',
  'song',
  'track-internal',
  'midi-routing',
  'ccs',
  'step-editor',
  'drum-map',
];

export function normalizeWorkspace(raw) {
  if (typeof raw === 'string') {
    const upper = raw.trim().toUpperCase();
    if (WORKSPACES.includes(upper)) return upper;
  }
  return DEFAULT_WORKSPACE;
}

export function isModuleVisible(workspace, moduleId) {
  const ws = normalizeWorkspace(workspace);
  switch (moduleId) {
    case 'core':
    case 'pattern-slots':
    case 'pattern-library':
      return true;
    case 'performance':
    case 'sync':
    case 'variations':
    case 'scenes':
    case 'song':
      return ws === 'PERFORMANCE' || ws === 'ADVANCED';
    case 'track-internal':
    case 'midi-routing':
    case 'ccs':
    case 'step-editor':
    case 'drum-map':
      return ws === 'ADVANCED';
    default:
      return true;
  }
}

export function visibleModuleIds(workspace) {
  const ws = normalizeWorkspace(workspace);
  return MODULE_IDS.filter((id) => isModuleVisible(ws, id));
}
