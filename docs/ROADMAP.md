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

- start from the existing logical 64-track Browser Companion model;
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
- keep physical FM-1 usable without the browser;
- treat the Browser Companion as a full feature lab/editor, not a 1:1 copy of the physical panel;
- support progressive disclosure so advanced sections do not overwhelm the normal performance workflow.

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

## M7–M9 — Routing, Scenes and Song Mode

- 64 logical tracks in four 16-track banks;
- four logical Browser MIDI ports A-D;
- Pattern Slots A/B/C/D;
- pattern library, fills and variations;
- independent Scene snapshots;
- per-Scene Quantize and Auto Chain;
- Song Mode with named sections and bar counts.

Exit criteria: a complete arrangement can be built and performed in the Browser Companion without losing the fast pattern workflow.

## M10 — Eight Internal-Capable Tracks

Official M-VAVE FM1 Open (October 2026) establishes an eight-track groovebox architecture on FM-1 hardware. Update the S-FM target accordingly:

- A01-A08 become internal-capable tracks;
- each of A01-A08 can target MIDI, INTERNAL or BOTH;
- the remaining logical command-center tracks remain MIDI-first;
- preserve all existing 64-track Browser projects during migration;
- do not remove the existing SLOOP-oriented engine abstraction yet;
- add an adapter layer later for the official FM1 Open sources: DX7 FM, Bass 303, Drum 808, PSG, Pluck and Sampler;
- Browser internal-audio metadata is not proof of real hardware audio until the shared engine/firmware path is integrated and tested on the FM-1.

Exit criteria: the model, UI and tests consistently expose eight internal-capable parts while preserving MIDI/BOTH routing and existing saved projects.

## M11 — Companion Workspace / Hardware UI Strategy

- organize the Browser Companion into collapsible work areas rather than one long scroll;
- provide Simple / Performance / Advanced workspace presets;
- allow modules to be hidden and reordered in the editor;
- keep core live controls immediately accessible: tracks, transport, patterns/scenes and performance;
- move setup-heavy functions such as routing, detailed locks, mappings and project administration behind secondary panels;
- define physical-device pages/layers independently from the Browser Companion layout;
- later allow user-configurable assignments so unused functions do not consume scarce hardware controls.

Exit criteria: a new user can perform basic sequencing without scrolling through every advanced function, while power users retain the complete feature set.

## Later experiments

- 128-step compatibility with Saibertin S1's data model;
- community custom-mode API/SDK;
- mode manifests and discoverable community builds;
- optional mappings/templates for common DAWs, drum racks and hardware synths;
- customizable physical-control profiles managed from the Companion editor.
