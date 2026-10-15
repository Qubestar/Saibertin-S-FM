# S1-FM Roadmap

## M0 — Foundation

- select and pin the firmware upstream/version;
- preserve upstream attribution and GPL licensing;
- establish build instructions and CI;
- establish host/browser emulator path;
- document hardware control mapping;
- add an S1 mode boundary instead of scattering S1 behavior throughout upstream code;
- keep Saibertin S1 concepts synchronized through docs, not copied implementation.

Exit criteria: reproducible build + emulator + documented extension points.

## M1 — MIDI Controller Proof

- KEYS mode sends MIDI notes;
- KNOB 1-4 send configurable CC 0-127;
- per-track MIDI channel selection;
- display feedback for track/channel/CC/value;
- save/load mappings;
- verify fast encoder motion and MIDI throughput in emulator and later on hardware.

Exit criteria: control an Ableton/Logic instrument reliably from S1-FM.

## M2 — Step Sequencer

- 4 MIDI tracks initially;
- 16 visible steps;
- multi-page patterns, target 64 steps for first FM-1 implementation;
- note, velocity, gate/length;
- probability;
- ratchet;
- mute;
- internal clock + MIDI clock sync;
- pattern persistence.

Exit criteria: S1-FM can act as a useful standalone USB MIDI sequencer.

## M3 — Musical Input Modes

- SCALE: root + scale constrained notes;
- CHORD: DEGREE and ROOT layouts;
- DRUM: 16 remappable MIDI notes;
- preserve ordinary KEYS mode;
- mode-aware screen legends.

Exit criteria: one physical keybed can cleanly switch between melodic, harmonic, drum and sequencing roles.

## M4 — Advanced Sequencing

- per-step CC locks;
- CC motion recording/automation;
- microtiming;
- tie/legato where appropriate;
- Note Repeat with divisions 1/4, 1/8, 1/16, 1/32 and Triplet;
- minimal Arp.

Exit criteria: external synth/plugin sequencing feels expressive rather than merely step-triggered.

## M5 — Browser Companion

- browser emulator based on the same behavior model where practical;
- FM-1 Remote mode over USB MIDI;
- large-screen visualization without requiring touch;
- inspect/edit mappings, track channels, scales, chord settings and patterns;
- keep physical FM-1 usable without the browser.

Exit criteria: hardware and browser can operate as one coherent system, while each remains independently usable.

## M6 — Performance Layer

- Scatter-style MIDI transformations;
- repeat/stutter;
- sequence direction/skip experiments;
- octave jumps;
- velocity/probability randomization;
- fills;
- pattern switching;
- copy/paste/randomize workflow.

Exit criteria: S1-FM works as a live-performance MIDI instrument.

## Later experiments

- 8 MIDI tracks without forcing the upstream 4-part audio engine to become 8-part;
- 128-step compatibility with Saibertin S1's data model;
- community custom-mode API/SDK;
- mode manifests and discoverable community builds;
- optional mappings/templates for common DAWs, drum racks and hardware synths.
