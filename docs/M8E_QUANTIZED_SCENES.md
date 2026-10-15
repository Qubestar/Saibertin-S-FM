# M8E — Quantized Scenes / Song progression

M8E turns the M8D scene chain into a transport-aware performance/song layer.

## What it adds

- Scene recalls no longer need a page reload.
- A scene click while transport is running is queued to a musical boundary.
- Quantize choices:
  - `1 BAR` = 16 sixteenth-note steps,
  - `2 BARS` = 32 sixteenth-note steps,
  - `PATTERN END` = the longest current track length (1–64 steps).
- `Auto chain` walks the saved scene chain automatically.
- Chain start is deterministic: a fresh transport Start begins from chain cursor 1.
- Manual Chain Prev / Next still works; while transport runs it queues the target scene rather than cutting immediately.
- Empty scenes are never auto-created during playback; the UI asks the user to stop and capture them first.
- Pattern slot and variation UI refresh after a live scene recall.

## Transport integration

The core Browser Companion now emits synchronous transport events:

- `saibertin:transport-start`
- `saibertin:transport-plan`
- `saibertin:transport-tick`
- `saibertin:transport-stop`

`transport-plan` is intentionally emitted before the sequencer calculates events for that tick. This lets a quantized scene swap become effective on the boundary itself, including for negative microtiming/look-ahead scheduling.

The same event contract is emitted by the EXTERNAL MIDI Clock engine, so scene chaining follows either the internal master clock or incoming MIDI Clock.

## Live state bridge

Scene recall writes the new musical state and sends `saibertin:replace-state`. The main app replaces its in-memory state and re-renders without stopping the transport or reloading the page.

Routing stays track-level. Scenes only choose each track's A/B/C/D Pattern Slot.

## Validation

- `scene-model` quantization helpers cover 1-bar, 2-bar and Pattern End boundaries.
- The existing M8D scene map remains backward-compatible; old scene storage migrates to the new auto/quantize fields.
- Browser-level timing and INTERNAL/EXTERNAL transport behavior require local preview validation.
