import './performance.js';
import './sync.js';
import './patterns.js';
import './pattern-slots.js';
import './variations.js';

const midiPortEl = document.getElementById('midiPort');
const channelEl = document.getElementById('channel');
const targetEl = document.getElementById('trackTarget');
const hintEl = document.getElementById('internalHint');

function keepStandbyRoutingEditable() {
  if (midiPortEl) midiPortEl.disabled = false;
  if (channelEl) channelEl.disabled = false;

  if (targetEl?.value === 'INTERNAL' && hintEl) {
    hintEl.textContent = 'INTERNAL target: MIDI port/channel are stored as standby routing. They become active when Target is changed to MIDI or BOTH.';
  }
}

const observer = new MutationObserver(keepStandbyRoutingEditable);
for (const el of [midiPortEl, channelEl]) {
  if (el) observer.observe(el, { attributes: true, attributeFilter: ['disabled'] });
}

if (targetEl) targetEl.addEventListener('change', () => queueMicrotask(keepStandbyRoutingEditable));
keepStandbyRoutingEditable();
