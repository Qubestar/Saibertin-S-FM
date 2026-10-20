import {
  WORKSPACES,
  DEFAULT_WORKSPACE,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_METADATA,
  normalizeWorkspace,
  isModuleVisible,
} from './workspace-model.js';

const style = document.createElement('style');
style.textContent = `
.workspace-hidden {
  display: none !important;
}
.workspace-bar {
  position: sticky;
  top: 10px;
  z-index: 100;
  background: rgba(25, 27, 32, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 8px 12px;
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}
.workspace-nav {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.workspace-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--panel2);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.2;
}
.workspace-btn strong {
  font-size: 13px;
  color: var(--text);
  letter-spacing: 0.04em;
}
.workspace-btn span {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}
.workspace-btn:hover {
  border-color: #727987;
  color: var(--text);
}
.workspace-btn.active {
  background: #343944;
  border-color: var(--active);
  color: var(--active);
  box-shadow: 0 0 0 1px var(--active) inset;
}
.workspace-btn.active strong {
  color: var(--active);
}
.workspace-btn.active span {
  color: #fff1bd;
}
.workspace-warning {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.3;
  max-width: 440px;
}
body.workspace-simple .track-setup,
body.workspace-performance .track-setup {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 820px) {
  .workspace-bar {
    position: static;
  }
  .workspace-warning {
    max-width: 100%;
  }
}
`;
document.head.append(style);

export const MODULE_SELECTORS = {
  'midi-routing': ['#midiRoutingBox', '[data-companion-module="midi-routing"]'],
  'track-internal': ['.track-internal-field', '[data-companion-module="track-internal"]'],
  'ccs': ['#ccs', '[data-companion-module="ccs"]'],
  'sync': ['#syncPanel', '.sync-panel', '[data-companion-module="sync"]'],
  'step-editor': ['#stepEditor', '[data-companion-module="step-editor"]'],
  'drum-map': ['#drumEditor', '[data-companion-module="drum-map"]'],
  'performance': ['.performance-panel', '[data-companion-module="performance"]'],
  'variations': ['.variation-panel', '[data-companion-module="variations"]'],
  'scenes': ['.scene-panel', '[data-companion-module="scenes"]'],
  'song': ['.song-panel', '[data-companion-module="song"]'],
  'pattern-slots': ['.pattern-slots', '[data-companion-module="pattern-slots"]'],
  'pattern-library': ['.pattern-library', '[data-companion-module="pattern-library"]'],
};

function readSavedWorkspace() {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return normalizeWorkspace(raw);
  } catch {
    return DEFAULT_WORKSPACE;
  }
}

function writeSavedWorkspace(ws) {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, ws);
  } catch {}
}

let currentWorkspace = readSavedWorkspace();

export function getCurrentWorkspace() {
  return currentWorkspace;
}

const bar = document.createElement('div');
bar.id = 'workspaceSelector';
bar.className = 'workspace-bar';
bar.innerHTML = `
  <div class="workspace-nav" id="workspaceNav">
    ${WORKSPACE_METADATA.map((meta) => `
      <button class="workspace-btn ${meta.id === currentWorkspace ? 'active' : ''}" data-workspace="${meta.id}">
        <strong>${meta.label}</strong>
        <span>${meta.desc}</span>
      </button>
    `).join('')}
  </div>
  <div class="workspace-warning">
    Workspace changes visibility only. Armed performance or automation features remain active.
  </div>
`;

// Mount sticky bar right above the main panel
const panelEl = document.querySelector('.panel');
if (panelEl?.parentNode) {
  panelEl.parentNode.insertBefore(bar, panelEl);
} else {
  document.querySelector('.app')?.prepend(bar);
}

const navButtons = bar.querySelectorAll('.workspace-btn');
navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setWorkspace(btn.dataset.workspace);
  });
});

export function applyWorkspace(ws = currentWorkspace) {
  currentWorkspace = normalizeWorkspace(ws);
  writeSavedWorkspace(currentWorkspace);

  // Update body class for contextual layout adjustments (e.g. 2-column track-setup in simple)
  document.body.classList.remove('workspace-simple', 'workspace-performance', 'workspace-advanced');
  document.body.classList.add(`workspace-${currentWorkspace.toLowerCase()}`);

  // Update button active state
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.workspace === currentWorkspace);
  });

  // Apply visibility classes to modules
  for (const [moduleId, selectors] of Object.entries(MODULE_SELECTORS)) {
    const visible = isModuleVisible(currentWorkspace, moduleId);
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        el.classList.toggle('workspace-hidden', !visible);
      });
    }
  }

  window.dispatchEvent(
    new CustomEvent('saibertin:workspace-change', {
      detail: { workspace: currentWorkspace },
    }),
  );
}

export function setWorkspace(ws) {
  applyWorkspace(ws);
}

// Initial apply
applyWorkspace(currentWorkspace);
