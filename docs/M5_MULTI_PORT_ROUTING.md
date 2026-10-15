# M5 — Multi-port MIDI routing

Saibertin S-FM now models four logical MIDI ports, A–D, across the 64-track command-center layer.

## Routing model

Each logical track owns:
- one logical MIDI port A–D;
- one MIDI channel 1–16 (or OFF);
- its existing sequence, CC and step data.

Default routing follows track banks:
- A01–A16 → Port A
- B01–B16 → Port B
- C01–C16 → Port C
- D01–D16 → Port D

The port is editable per track, so bank membership does not lock routing.

## Browser Companion

Each logical port can be mapped to any Web MIDI output. Multiple logical ports may point to the same physical output, or to different devices/interfaces. Output mapping is browser-specific state and is deliberately kept separate from the musical sequencer state.

If the browser sees exactly one output and no mapping has ever been stored, Port A auto-selects it for convenience; B–D remain unassigned until the user maps them.

## Firmware boundary

This does **not** claim that the M-VAVE FM-1 already exposes four USB virtual MIDI cables. The core only stores a logical port number. Later firmware work will decide how logical ports map to real transports such as USB virtual cables, DIN/TRS, BLE or an external USB host/router, based on what the FM-1 USB stack can actually support.
