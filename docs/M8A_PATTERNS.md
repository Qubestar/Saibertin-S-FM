# M8A — Pattern Library + Euclidean Generator

M8A adds fast rhythm recipes to the Browser Companion before full Pattern/Project management.

## Why

S-FM is becoming a command-center sequencer. Users should not have to place every trigger from scratch when common rhythmic skeletons are useful starting points.

The library is intentionally a collection of **generic rhythmic recipes**, not copied songs or copyrighted MIDI phrases.

## Initial preset families

### Drum essentials

- Kick — Four on the Floor
- Kick — 4x4 + Pickup
- Snare / Clap — Backbeat 2 & 4
- Hat — Offbeat 8ths
- Hat / Shaker — Straight 8ths
- Hat / Shaker — Straight 16ths
- Perc — Tresillo 3-3-2
- Perc — Euclid 5/16
- Perc — Euclid 7/16

### Bass / synth

- Bass — Offbeat 8ths
- Bass — Straight 8ths
- Bass / Arp — Straight 16ths
- Bass — Gallop
- Synth / Stab — Quarter Notes
- Synth / Stab — Offbeats
- Synth / Bass — Tresillo 3-3-2
- Synth — Euclid 5/16
- Synth — Euclid 9/16

## Apply workflow

A recipe can be:

- rotated without changing its shape;
- applied to the current 16-step page or repeated across the entire current Track length;
- applied as **Replace** or **Merge**;
- further edited manually after application.

Applying a recipe changes only trigger placement (`steps`). Existing per-step note, velocity, gate, probability, ratchet, microtiming and CC-lock metadata remains available.

## Custom Euclidean generator

Controls:

- Steps: 1–64
- Pulses: 0–Steps
- Rotate: shifts the trigger pattern around the cycle

Pulses are distributed as evenly as possible across Steps. This gives S-FM a fast generative starting point for percussion, bass, synth and polymetric layers while preserving manual step editing afterward.

## Research basis

- Ableton Learning Music uses kick hits at steps 1/5/9/13 for the common four-on-the-floor pulse and clap/snare on beats 2 and 4 as a common backbeat in house/techno:
  - https://learningmusic.ableton.com/make-beats/beat-and-tempo.html
  - https://learningmusic.ableton.com/make-beats/backbeats.html
- Torso T-1 documents Euclidean sequencing as Steps + Pulses + Rotate, with 1–64 Steps, and explicitly combines generated rhythms with manual step editing and parameter locks:
  - https://docs.torsoelectronics.com/t1/core-concepts/euclidean-rhythms/
  - https://docs.torsoelectronics.com/t1/parameter-reference/shape/pulses-rotate/
  - https://docs.torsoelectronics.com/t1/parameter-reference/shape/steps/
  - https://docs.torsoelectronics.com/t1/core-concepts/per-step-editing/

## Later expansion

- user preset save/rename/delete;
- genre/category packs (techno, house, acid, electro, breaks, ambient/generative);
- multi-track kits that can stamp complementary kick/snare/hat/bass patterns across several Tracks at once;
- accent/velocity templates and probability templates;
- fills and phrase-ending variants;
- Pattern A/B/C/D and Project management in M8B;
- evaluate the user-provided YouTube reference `IUen4_1SJvk` once its content can be accessed reliably.

The same rhythm-recipe concept should be reusable later in Saibertin S1, with a richer hardware UI and larger preset library.
