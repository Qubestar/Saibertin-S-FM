# M8B — Pattern Slots / Variations

M8B adds four compact pattern slots per logical track: A, B, C and D.

## What a slot stores

A slot stores sequence content, not routing:

- sequence length;
- track default note;
- enabled trigger positions;
- non-default per-step metadata: note, velocity, gate, probability, ratchet, microtiming and four CC locks.

MIDI port, MIDI channel, target and internal-engine routing remain track-level settings and do not change when switching pattern slots.

## Workflow

- Slot A is initialized lazily from the current track.
- Clicking an empty slot creates a variation by cloning the current active pattern, then switches to it.
- `Save current` stores the current working pattern into the active slot.
- `Duplicate → next` copies the current slot to the next A→B→C→D→A slot and activates it.
- `Copy` stores the active pattern in a global clipboard.
- `Paste` replaces the active slot on the selected track, so patterns can be copied across tracks.
- The active slot is saved before track/bank changes and before page unload.

## Storage

Pattern slots use sparse localStorage data. Only enabled step indices and non-default step parameters are stored, avoiding four full 64-step deep copies for every one of the 64 tracks.

This stage is a Browser Companion workflow prototype. Firmware persistence/layout will be designed separately after the FM-1 memory budget is measured.
