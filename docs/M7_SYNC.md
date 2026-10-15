# M7 — MIDI Clock / Sync

M7 turns the Browser Companion into a clock master or MIDI-clock slave while preserving the 64-track / four-port routing model.

## Internal master

- Transport Play sends MIDI Start when enabled.
- Transport Stop sends MIDI Stop when enabled.
- MIDI Clock is emitted at 24 PPQN.
- Clock output can be enabled independently for logical ports A–D.
- The clock scheduler follows the Browser Companion tempo control.

## External MIDI Clock

- A Web MIDI input can be selected as the clock source.
- MIDI Start resets the external sequencer position and starts from step 1.
- MIDI Continue resumes from the current external position.
- MIDI Stop stops the slave engine and sends All Notes Off on routes used by the external engine.
- Six incoming MIDI clocks equal one 1/16 sequencer step.
- Detected BPM is estimated from a trimmed rolling window of recent clock intervals.

The external slave engine reads the same persisted musical state and uses the same `sequenceEventsAtTick()` model, including velocity, probability, gate, ratchet and CC locks. Browser/internal audio is still outside this layer; INTERNAL-only SLOOP audio waits for the shared firmware/WASM core.

## Deliberate boundary

Ableton Link is not MIDI Clock and is not represented as a fake source here. Link remains a later dedicated integration stage.
