# FM-1 Firmware References

These projects are references for interaction patterns, architecture and feasibility. S1-FM should not become a collage of copied features; each borrowed idea should be adapted into one coherent S1 interaction model.

## Felucca

Role: foundational open-source FM-1 platform / hardware layer used by many community firmwares.

Ideas to study:
- hardware abstraction;
- USB/MIDI stack;
- storage;
- updater/installer;
- host-side testing;
- parameter/step editing patterns;
- automation and MIDI-learn concepts.

## SLOOP

Role: strongest initial upstream candidate for S1-FM because it is already close to a MIDI/groovebox workflow.

Ideas to study:
- sequencer/arp/roll MIDI output;
- per-track MIDI channel routing;
- longer patterns;
- timing, ratchet and performance sequencing;
- encoder handling under fast movement / MIDI traffic.

Decision is not final until M0 pins an exact upstream version after source/build inspection.

## X0X

Role: proof that the FM-1 panel can support a radically different sequencer-centric workflow.

Ideas to study:
- x0x step interaction;
- pattern/song workflow;
- parameter locks;
- performance controls;
- extensive panel reinterpretation.

## HYP-1

Project: https://github.com/RustyPawz/fm1-HYP1

Ideas to study:
- context-sensitive white keys: scale normally, 16 steps in sequencer, effects in performance layer;
- six-lane 16-step drum sequencer;
- Remote mode where the physical FM-1 panel controls a browser emulator over USB MIDI;
- browser emulator, web installer, host simulator and CI as part of the product/tooling experience;
- strong mode-aware screen feedback.

## fm1-chord

Project: https://github.com/math0ne/fm1-chord

Ideas to study:
- seven white keys as scale degrees I-VII;
- scale-aware chord generation;
- chord extensions/modifiers on black keys;
- inversions and slash/bass behavior;
- Lead / Strum / Chord / Drum roles on one keybed;
- 16-step chord sequencing;
- screen legends that explain the active layout.

## ChoralRoot

Ideas to study:
- root + chord-shape workflow;
- major/minor/key-aware harmonic interaction;
- a simpler alternative to degree-first chord entry.

## Design rule derived from the references

S1-FM uses one physical surface with explicit modes rather than pretending every control has one permanent role:

- KEYS
- SCALE
- CHORD
- DRUM
- SEQ
- PERFORMANCE/FX layer

The active context must always be visible, and MIDI mappings should remain user-configurable where practical.
