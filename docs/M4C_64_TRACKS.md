# M4C — 64-track command-center target

Saibertin S-FM targets **64 logical sequencer/MIDI tracks**, organized as four banks of sixteen:

- Bank A: T01–T16
- Bank B: T17–T32
- Bank C: T33–T48
- Bank D: T49–T64

This is intentionally a *logical sequencer* ceiling, not a claim of 64 simultaneous internal audio engines. Internal synthesis remains constrained by the FM-1/SLOOP audio architecture. MIDI tracks can share output channels and, in a later hardware stage, may be spread across multiple USB MIDI virtual cables if the FM-1 USB stack proves that practical.

## Market reference

The design target is informed by current standalone sequencers: 16 tracks is common in high-end devices, 32 is a strong power-user tier, and 64 tracks is an established command-center class used by Squarp Pyramid. The bank-of-16 layout also maps cleanly onto the FM-1's 16-key surface when a Track/Bank layer is active.

## M4C Browser Companion behavior

- 64 independent logical tracks
- four track banks, A–D
- 16 track buttons visible at once
- each track keeps its own:
  - MIDI channel
  - sequence length 1–64
  - target MIDI / INTERNAL / BOTH
  - internal engine / sound slot metadata
  - default note
  - four CC mappings and values
  - 64 steps and per-step parameters
- migration from older 4-track Browser Companion states preserves tracks 1–4 and initializes tracks 5–64 safely

The Browser Companion is the workflow laboratory. Firmware storage will use a packed representation rather than copying the browser's JavaScript object layout directly.
