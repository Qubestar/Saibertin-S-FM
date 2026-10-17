import {
  SONG_MAX_SECTIONS, normalizeSong, normalizeSongSection,
  sectionEndTick, songTotalBars, nextSongCursor, songSectionAt,
} from './song-model.js';

const SONG_KEY = 'saibertin-s-fm-song-v1';
const SCENE_KEY = 'saibertin-s-fm-scenes-v1';

function readSong() {
  try { return normalizeSong(JSON.parse(localStorage.getItem(SONG_KEY) || 'null')); }
  catch { return normalizeSong(null); }
}
function writeSong() {
  try { localStorage.setItem(SONG_KEY, JSON.stringify(song)); } catch {}
}
function readSceneStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCENE_KEY) || 'null');
    return raw && typeof raw === 'object' ? raw : { scenes: [] };
  } catch { return { scenes: [] }; }
}
function sceneInfo(index) {
  const scene = readSceneStore().scenes?.[index];
  return scene ? { exists: true, name: scene.name || `Scene ${index + 1}` } : { exists: false, name: `Scene ${index + 1}` };
}

let song = readSong();
let transportRunning = false;
let sectionStartTick = 0;
let lastPlannedTick = 0;
let pendingCursor = null;
let completed = false;

const style = document.createElement('style');
style.textContent = `
.song-panel{margin-top:14px}.song-head,.song-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}.song-head label{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px}.song-add{background:#24422f!important;border-color:#4f9b65!important}.song-table{display:grid;gap:6px;margin-top:10px}.song-row{display:grid;grid-template-columns:42px minmax(120px,1.4fr) minmax(130px,1fr) 90px auto;gap:7px;align-items:center;padding:7px;border:1px solid var(--line);border-radius:7px;background:#111319}.song-row.active{border-color:#67a9ff;box-shadow:0 0 0 1px #67a9ff inset}.song-row.queued{border-color:#f6c453}.song-row input,.song-row select{min-width:0;background:#0d0f14;color:var(--text);border:1px solid var(--line);padding:7px;border-radius:6px}.song-index{font-weight:800;color:var(--active);text-align:center}.song-row-actions{display:flex;gap:5px}.song-row-actions .btn{padding:6px 8px;min-width:34px}.song-status{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.song-warning{color:#f6c453}@media(max-width:900px){.song-row{grid-template-columns:38px 1fr 1fr 76px}.song-row-actions{grid-column:2/5}}
`;
document.head.append(style);

const panel = document.createElement('div');
panel.className = 'box song-panel';
panel.innerHTML = `
  <div class="label">Song mode · arrange scenes into sections</div>
  <div class="song-head">
    <label><input id="songEnabled" type="checkbox"> Song mode</label>
    <label><input id="songLoop" type="checkbox" checked> Loop song</label>
    <button class="btn song-add" id="songAdd">+ Add section</button>
    <button class="btn" id="songPrev">◀ Previous section</button>
    <button class="btn" id="songNext">Next section ▶</button>
    <span class="status" id="songSummary"></span>
  </div>
  <div class="song-table" id="songRows"></div>
  <div class="status song-status" id="songStatus" style="margin-top:9px">Song Mode uses saved independent Scenes. Each section chooses a Scene and how many 4/4 bars it should play.</div>
`;

const scenesPanel = document.querySelector('.scene-panel');
if (scenesPanel?.parentNode) scenesPanel.insertAdjacentElement('afterend', panel);
else document.querySelector('.variation-panel')?.insertAdjacentElement('afterend', panel);

const enabledEl = document.getElementById('songEnabled');
const loopEl = document.getElementById('songLoop');
const addEl = document.getElementById('songAdd');
const rowsEl = document.getElementById('songRows');
const statusEl = document.getElementById('songStatus');
const summaryEl = document.getElementById('songSummary');

function sectionLabel(section) {
  const info = sceneInfo(section.scene);
  return `${section.name} · Scene ${section.scene + 1}${info.exists ? ` (${info.name})` : ' [EMPTY]'} · ${section.bars} bar${section.bars === 1 ? '' : 's'}`;
}

function disableSceneAutoChain() {
  const auto = document.getElementById('sceneAuto');
  if (auto?.checked) {
    auto.checked = false;
    auto.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function applySectionScene(cursor, reason = 'SONG') {
  const section = songSectionAt(song, cursor);
  const info = sceneInfo(section.scene);
  if (!info.exists) {
    statusEl.textContent = `${reason} · ${section.name} points to empty Scene ${section.scene + 1}. Capture that Scene first.`;
    statusEl.classList.add('song-warning');
    return false;
  }
  statusEl.classList.remove('song-warning');
  window.dispatchEvent(new CustomEvent('saibertin:song-apply-scene', {
    detail: {
      sceneIndex: section.scene,
      message: `${reason} · ${sectionLabel(section)}`,
    },
  }));
  return true;
}

function updateStatus(message = '') {
  const section = songSectionAt(song, song.cursor);
  const bar = transportRunning
    ? Math.max(1, Math.min(section.bars, Math.floor(Math.max(0, lastPlannedTick - sectionStartTick) / 16) + 1))
    : 1;
  const queued = pendingCursor !== null ? ` · queued section ${pendingCursor + 1}` : '';
  if (message) statusEl.textContent = message;
  else statusEl.textContent = `${transportRunning ? 'PLAY' : 'STOP'} · section ${song.cursor + 1}/${song.sections.length} · ${sectionLabel(section)} · bar ${bar}/${section.bars}${queued}`;
}

function renderRows() {
  rowsEl.replaceChildren();
  song.sections.forEach((section, index) => {
    const row = document.createElement('div');
    row.className = `song-row ${song.cursor === index ? 'active' : ''} ${pendingCursor === index ? 'queued' : ''}`;

    const number = document.createElement('div');
    number.className = 'song-index';
    number.textContent = String(index + 1).padStart(2, '0');

    const name = document.createElement('input');
    name.maxLength = 24;
    name.value = section.name;
    name.disabled = transportRunning;
    name.title = 'Section name';
    name.onchange = () => {
      song.sections[index] = normalizeSongSection({ ...section, name: name.value }, index);
      writeSong(); render();
    };

    const scene = document.createElement('select');
    for (let i = 0; i < 8; i++) {
      const info = sceneInfo(i);
      scene.add(new Option(`${i + 1} · ${info.name}${info.exists ? '' : ' · EMPTY'}`, String(i)));
    }
    scene.value = String(section.scene);
    scene.disabled = transportRunning;
    scene.onchange = () => {
      song.sections[index] = normalizeSongSection({ ...section, scene: Number(scene.value) }, index);
      writeSong(); render();
      if (!transportRunning && index === song.cursor) applySectionScene(index, 'SONG PREVIEW');
    };

    const bars = document.createElement('input');
    bars.type = 'number'; bars.min = '1'; bars.max = '64'; bars.value = String(section.bars);
    bars.disabled = transportRunning;
    bars.title = 'Bars';
    bars.onchange = () => {
      song.sections[index] = normalizeSongSection({ ...section, bars: Number(bars.value) }, index);
      writeSong(); render();
    };

    const actions = document.createElement('div');
    actions.className = 'song-row-actions';
    const up = document.createElement('button'); up.className = 'btn'; up.textContent = '↑'; up.disabled = transportRunning || index === 0;
    const down = document.createElement('button'); down.className = 'btn'; down.textContent = '↓'; down.disabled = transportRunning || index === song.sections.length - 1;
    const del = document.createElement('button'); del.className = 'btn'; del.textContent = '×'; del.disabled = transportRunning || song.sections.length <= 1;
    up.onclick = () => {
      [song.sections[index - 1], song.sections[index]] = [song.sections[index], song.sections[index - 1]];
      if (song.cursor === index) song.cursor -= 1; else if (song.cursor === index - 1) song.cursor += 1;
      writeSong(); render();
    };
    down.onclick = () => {
      [song.sections[index + 1], song.sections[index]] = [song.sections[index], song.sections[index + 1]];
      if (song.cursor === index) song.cursor += 1; else if (song.cursor === index + 1) song.cursor -= 1;
      writeSong(); render();
    };
    del.onclick = () => {
      song.sections.splice(index, 1);
      if (song.cursor > index) song.cursor -= 1;
      song.cursor = Math.min(song.cursor, song.sections.length - 1);
      writeSong(); render();
    };
    actions.append(up, down, del);
    row.append(number, name, scene, bars, actions);
    rowsEl.append(row);
  });
}

function render(message = '') {
  enabledEl.checked = song.enabled;
  loopEl.checked = song.loop;
  addEl.disabled = transportRunning || song.sections.length >= SONG_MAX_SECTIONS;
  summaryEl.textContent = `${song.sections.length} sections · ${songTotalBars(song)} bars`;
  renderRows();
  updateStatus(message);
}

function moveSection(direction) {
  const next = nextSongCursor(song, song.cursor, direction);
  if (next.ended) {
    updateStatus(direction < 0 ? 'Already at the first Song section.' : 'Already at the final Song section.');
    return;
  }
  if (transportRunning) {
    pendingCursor = next.cursor;
    render(`Queued Song section ${next.cursor + 1} for the next bar boundary.`);
    return;
  }
  song.cursor = next.cursor;
  writeSong();
  applySectionScene(song.cursor, 'SONG MANUAL');
  render();
}

enabledEl.onchange = () => {
  if (transportRunning) {
    enabledEl.checked = song.enabled;
    updateStatus('Stop transport before enabling or disabling Song Mode.');
    return;
  }
  song.enabled = enabledEl.checked;
  if (song.enabled) {
    disableSceneAutoChain();
    song.cursor = 0;
    completed = false;
    applySectionScene(song.cursor, 'SONG ARMED');
  }
  writeSong(); render(song.enabled ? 'Song Mode armed. Play starts from section 1.' : 'Song Mode disabled.');
};
loopEl.onchange = () => { song.loop = loopEl.checked; writeSong(); render(); };
addEl.onclick = () => {
  if (transportRunning || song.sections.length >= SONG_MAX_SECTIONS) return;
  const previous = song.sections[song.sections.length - 1];
  song.sections.push(normalizeSongSection({ name: `Part ${song.sections.length + 1}`, scene: previous?.scene ?? 0, bars: previous?.bars ?? 4 }, song.sections.length));
  writeSong(); render('Song section added.');
};
document.getElementById('songPrev').onclick = () => moveSection(-1);
document.getElementById('songNext').onclick = () => moveSection(1);

const sceneAuto = document.getElementById('sceneAuto');
sceneAuto?.addEventListener('change', () => {
  if (sceneAuto.checked && song.enabled) {
    song.enabled = false;
    writeSong();
    render('Song Mode disabled because Scene Auto chain was enabled. Use one automation mode at a time.');
  }
});

window.addEventListener('saibertin:transport-start', () => {
  transportRunning = true;
  pendingCursor = null;
  lastPlannedTick = 0;
  sectionStartTick = 0;
  completed = false;
  if (!song.enabled) { render(); return; }
  disableSceneAutoChain();
  song.cursor = 0;
  writeSong();
  if (!applySectionScene(song.cursor, 'SONG START')) {
    queueMicrotask(() => document.getElementById('stop')?.click());
    return;
  }
  render();
});

window.addEventListener('saibertin:transport-plan', (event) => {
  if (!transportRunning || !song.enabled || completed) return;
  const tick = Math.max(0, Math.floor(Number(event.detail?.tick) || 0));
  lastPlannedTick = tick;

  if (pendingCursor !== null && tick > sectionStartTick && tick % 16 === 0) {
    song.cursor = pendingCursor;
    pendingCursor = null;
    sectionStartTick = tick;
    writeSong();
    applySectionScene(song.cursor, 'SONG MANUAL');
    render();
    return;
  }

  const section = songSectionAt(song, song.cursor);
  const boundary = sectionEndTick(sectionStartTick, section);
  if (tick < boundary) {
    if (tick % 16 === 0) updateStatus();
    return;
  }

  const next = nextSongCursor(song, song.cursor, 1);
  if (next.ended) {
    completed = true;
    updateStatus('Song complete. Transport stopping because Loop song is off.');
    queueMicrotask(() => document.getElementById('stop')?.click());
    return;
  }

  song.cursor = next.cursor;
  sectionStartTick = boundary;
  writeSong();
  applySectionScene(song.cursor, next.wrapped ? 'SONG LOOP' : 'SONG');
  render();
});

window.addEventListener('saibertin:transport-stop', () => {
  transportRunning = false;
  pendingCursor = null;
  sectionStartTick = 0;
  lastPlannedTick = 0;
  render(completed ? 'Song complete.' : 'Transport stopped. Next Play starts Song Mode from section 1.');
});

window.addEventListener('saibertin:scene-recalled', () => {
  if (!transportRunning) renderRows();
});

render();
