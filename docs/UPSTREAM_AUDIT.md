# SLOOP v2.6 upstream audit for Saibertin S-FM

Pinned upstream: `isod89/sloop-fm1` tag `v2.6`, commit `d30d6553353373cf5506b9ed285fc4a2aa0c30ef`.

## Why SLOOP is the initial base

SLOOP already provides the difficult FM-1 platform work that S-FM needs: panel scanning, encoder calibration, display/UI primitives, USB MIDI, MIDI clock, storage, a multi-track sequencer, scale/chord logic, tests, installer tooling and recovery-oriented workflows. Saibertin S-FM should initially change the control/sequencing workflow rather than replace that platform layer.

## Confirmed useful code paths

### `firmware/src/seq.c`

This is the most important musical-control file for S-FM.

It already contains:
- keyboard/layer routing;
- 16 scale masks including chromatic, major, minor, Dorian, Mixolydian, pentatonics, harmonic minor, Phrygian, Lydian, Locrian, melodic minor, blues, whole-tone and diminished variants;
- chord-aware keyboard behavior;
- note repeat / rolls;
- arpeggiator and sequencer routing;
- per-track MIDI channels;
- `midi_out_note()` for USB MIDI note on/off;
- note tracking so channel changes/STOP do not leave hanging notes;
- 16-key step layers.

This means SCALE, CHORD, NOTE REPEAT and basic step interaction are adaptation tasks, not greenfield engines.

### `firmware/src/usb.c`

Contains the USB-MIDI event queues. MIDI OUT uses four-byte USB-MIDI packets and a 64-event output ring. The first S-FM CC proof should use this existing path rather than introduce a second transport.

### `firmware/src/panel.c` and `firmware/hal/fm1_input.h`

Provide physical FM-1 button/encoder mapping, direction handling and hardware calibration. S-FM should consume logical panel roles rather than hard-code matrix positions.

### Existing tests

SLOOP already tests MIDI output and encoder behavior. `tests/encoder_test.c` explicitly checks that encoder movement produces stable one-step behavior under slow/fast movement, pauses and bounce. Sequencer/scale tests inspect MIDI output queue packets. S-FM CC tests should follow the same pattern.

## Build reality on macOS

The firmware is buildable on macOS but the JieLi compiler is Linux x86-64. SLOOP's documented macOS path uses Docker Desktop with a `linux/amd64` Debian container. Additional prerequisites are Python 3 + Pillow, the JieLi toolchain and three files from the Apache-2.0 AC79 SDK. `tests/run_tests.sh` runs host, MIDI, encoder, DSP, project-format, regression and web tests.

For now, `scripts/bootstrap-sloop.sh` checks out the exact pinned upstream into `.upstream/sloop-v2.6`; it does not copy upstream source into the repository.

## Browser / large-screen strategy

SLOOP v2.6 has a web installer/editor but is not being treated as the final S-FM full-device browser emulator. HYP-1 demonstrates a stronger model: compile/run the instrument logic on the host/browser and allow the physical FM-1 panel to drive the browser over USB MIDI.

S-FM therefore has two separate UI targets:
1. the FM-1's own screen and controls;
2. a large-screen browser companion/emulator that can run without the physical unit and later accept physical-panel input.

The browser companion is a required S-FM direction, but it must share musical state/behavior rather than becoming an unrelated mockup.

## M1 proof: four encoders become a real MIDI controller

The first hardware-facing S-FM feature is intentionally small.

Default mapping on the selected track:
- K1 -> CC 74 (Filter)
- K2 -> CC 71 (Resonance)
- K3 -> CC 73 (Attack)
- K4 -> CC 91 (Reverb/Send)

Each mapping is ultimately configurable from CC 0..127.

Expected data path:

`FM-1 encoder -> panel logical encoder delta -> S-FM logical CC value -> USB MIDI CC packet -> DAW/hardware host`

The encoder is endless, so S-FM owns an absolute logical value (0..127) per track/mapping and changes it by encoder deltas. Switching tracks must therefore not cause pickup/jump problems.

### MIDI CC packet

Use the existing USB-MIDI output queue. A CC event is the same transport concept as `midi_out_note()`, with MIDI status `0xB0 | channel`, controller number and value. Do not create another USB path.

### Screen feedback

A moved encoder should temporarily show at least:

`T2  CH 5   CC74  083`

The user must always know track, channel, controller and current value.

## M1 test requirements

Before hardware validation:
- CC encoding: channel, controller and value are correct;
- OFF MIDI channel sends nothing;
- each track keeps independent CC values;
- fast encoder movement cannot overflow/wrap unexpectedly;
- values clamp to 0..127;
- track switching does not alter stored values;
- notes continue to use the existing note path;
- existing upstream tests remain green.

After the physical FM-1 arrives:
- verify every K1-K4 detent is captured;
- verify clockwise/counter-clockwise direction;
- inspect latency/jitter in a MIDI monitor and DAW;
- stress simultaneous playback + rapid encoder turns;
- confirm display feedback does not make sequencing timing unstable.

## Modes roadmap inherited from Saibertin S1

S-FM uses one physical surface with explicit contextual modes:
- KEYS: chromatic/normal MIDI keyboard;
- SCALE: key/root + scale constrained notes;
- CHORD: scale-degree and/or root+shape chord layouts, extensions and inversions;
- DRUM: 16-key configurable MIDI drum/pad map;
- SEQ: 16 visible steps with pages for longer patterns;
- PERFORMANCE: note repeat, arp, random/scatter-style MIDI transformations and performance shortcuts.

The final Saibertin S1 currently targets 8 tracks and a sequencer engine up to 128 steps. S-FM starts from SLOOP's native four-track architecture to minimize risk; expanding MIDI-only tracks comes after the first controller/sequencer proof.

## Explicit non-goals for the first proof

Do not yet:
- rewrite the synth/audio engines;
- expand all internal audio structures from 4 to 8 tracks;
- build the full Scatter engine;
- implement every chord-machine feature;
- optimize for a final commercial S1 firmware architecture.

S-FM is GPL-3.0 open-source experimentation on FM-1 hardware and a UX/prototyping bridge toward Saibertin S1.
