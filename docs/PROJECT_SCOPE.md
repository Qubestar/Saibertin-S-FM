# S1-FM Project Scope

S1-FM is an experimental open-source firmware project for the M-VAVE FM-1 and a development playground for Saibertin S1.

## Purpose

S1-FM is not a replacement for Saibertin S1. It is a low-cost hardware laboratory used to validate interaction models, MIDI workflows, sequencing behavior, musical modes, and browser-companion ideas before they are frozen into the dedicated Saibertin S1 hardware.

The project should reuse Saibertin S1 concepts where they fit the FM-1, while respecting the FM-1's physical constraints.

## Relationship to Saibertin S1

Saibertin S1 remains the source of truth for the final product direction. S1-FM should test a reduced version of the same concepts:

- track-based MIDI control;
- standalone MIDI sequencing;
- 16-step interaction;
- Note / Scale / Chord / Drum performance modes;
- Note Repeat / Arp / Scatter-style performance tools;
- remappable MIDI controls;
- browser/desktop companion for visibility and editing;
- modular architecture suitable for future community-created modes.

The full S1 target has 8 tracks, 16 performance pads, 16 dedicated step buttons, and sequencing up to 128 steps. S1-FM may begin with fewer tracks and 64 steps where that matches the upstream firmware architecture, but its behavior should remain conceptually compatible with S1.

## Initial S1-FM modes

### KEYS
Chromatic MIDI keyboard mode.

### SCALE
Root + scale constrained note mode. Initial scales should include at least Major, Natural Minor, Dorian, Phrygian, Mixolydian and major/minor pentatonic. The design must allow more scales without changing the input engine.

### CHORD
Scale-aware chord performance mode. Two target layouts:

- DEGREE: white keys represent scale degrees I-VII and generate diatonic chords;
- ROOT: select root plus chord quality/extension.

Future modifiers may include 7, maj7, 9, sus2, sus4, add9, 6, dim, aug, borrowed chords and inversions.

### DRUM
The 16 white keys act as 16 MIDI drum pads with user-remappable note numbers. Provide a sensible GM-style default, but never hard-code the project to GM only.

### SEQ
The 16 white keys become steps 1-16. Multiple pages expose longer patterns. S1-FM starts from the upstream engine's practical capabilities and should preserve a path toward the S1 128-step model.

## Interaction principle

Physical controls are context-sensitive surfaces rather than permanently assigned controls.

The same white keys may represent:

- notes in KEYS;
- in-scale notes in SCALE;
- chords in CHORD;
- drum pads in DRUM;
- steps in SEQ;
- momentary performance actions in an FX/Scatter layer.

The screen must always make the current context obvious.

## Initial proof of concept

The first hardware proof is deliberately small:

1. FM-1 keys send MIDI notes.
2. KNOB 1-4 send configurable MIDI CC messages.
3. Active track selects MIDI channel.
4. Display shows active track, channel, CC number and value.
5. A 16-step page can emit sequenced MIDI notes.
6. Core behavior is runnable in a host/browser emulator before physical FM-1 validation.

Only after this proof works should the project expand into Scale/Chord/Drum, CC parameter locks, Note Repeat, Arp and Scatter.

## Open-source / licensing boundary

S1-FM is expected to inherit GPL-3.0 obligations from its firmware upstream and should remain open source.

Do not copy GPL-derived S1-FM implementation code into a future closed-source Saibertin S1 firmware. Reuse product ideas, UX findings, specifications and independently reimplemented behavior instead.

## Community direction

S1-FM should be structured so custom modes can eventually become first-class extensions rather than forks of the whole firmware. This is also a design experiment for a future Saibertin S1 community SDK / custom-mode ecosystem.
