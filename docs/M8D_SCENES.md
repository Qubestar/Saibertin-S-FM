# M8D — Scenes / Pattern Chains

M8D adds eight lightweight scenes on top of per-track Pattern Slots.

## Scene model

A scene does not duplicate sequence data. It stores one slot selector (A/B/C/D) for each of the 64 logical tracks.

Example:

- A01 → Pattern A
- A02 → Pattern B
- A03 → Pattern A
- ...
- D16 → Pattern C

Recalling the scene loads those slot snapshots across all tracks while preserving track-level routing.

## Workflow

- Eight scenes are available.
- Clicking an empty scene captures the current slot map.
- Clicking a saved scene recalls it.
- `Capture current slot map` overwrites the active scene with the current A/B/C/D selection across all 64 tracks.
- Scenes may be renamed.

## Chain

A chain is a sequence of scene numbers, for example:

`1 1 2 1 3 4`

M8D supports manual `Chain prev` / `Chain next` stepping with a persistent cursor.

Automatic quantized progression is intentionally deferred. It should be integrated directly with the transport/scheduler so scene changes happen at musical boundaries without Browser reloads.

## Storage

Scenes are compact because they store only 64 slot letters plus a name. Pattern data remains owned by M8B Pattern Slots.
