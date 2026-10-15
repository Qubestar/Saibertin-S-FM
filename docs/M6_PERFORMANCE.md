# M6 — Performance layer

M6 adds live MIDI performance functions on top of the M5 64-track / four-port routing model.

## Note Repeat

- rates: 1/4, 1/8, 1/16, 1/32
- optional triplet timing
- HOLD mode: repeat while the pad/key is physically held
- LATCH mode: tap pads/keys into or out of the repeating set
- shared performance gate 5–95%

## Arpeggiator

- modes: UP, DOWN, UPDOWN, RANDOM
- rates: 1/4, 1/8, 1/16, 1/32
- optional triplet timing
- 1–4 octave expansion
- optional Hold mode

## Routing

Performance notes use the currently selected track's logical MIDI port and MIDI channel. The logical port is resolved through the M5 Web MIDI output mapping, so Repeat and Arp can address the same multi-device setup as the sequencer.

Changing mode, track, bank, target, MIDI port/channel or physical output clears the live performance pool and sends MIDI All Notes Off to the affected routes.

## Scope boundary

The Browser Companion currently emits the performance layer through MIDI. INTERNAL SLOOP audio will use the same conceptual settings when the real SLOOP core is hosted by the browser/WASM layer. M6 does not pretend that Browser Companion already renders the FM-1 internal audio engine.
