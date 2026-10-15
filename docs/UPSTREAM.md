# Upstream Decision

## Initial baseline

S1-FM will begin from **SLOOP 2.6** by isod89 rather than directly from Felucca.

Pinned reference:

- repository: `isod89/sloop-fm1`
- tag: `v2.6`
- commit: `d30d6553353373cf5506b9ed285fc4a2aa0c30ef`
- license: GPL-3.0 (inherited from the Felucca lineage; verify and preserve all notices when importing source)

The pin is deliberate: development must not depend on the moving upstream `main` branch.

## Why SLOOP 2.6

SLOOP 2.6 already contains several systems S1-FM would otherwise have to build before validating its core idea:

- per-track MIDI channels and MIDI in/out configuration;
- MIDI Learn;
- note length and per-step velocity;
- step entry from an external MIDI keyboard;
- sequencer/performance-oriented interaction;
- web editor/offline editor workflow;
- existing FM-1 platform, storage and display integration through the Felucca lineage.

This makes SLOOP a shorter path to the first S1-FM proof: physical keys + encoders -> configurable MIDI output + sequencer.

## Relationship to Felucca

Felucca remains an important architectural reference and upstream lineage. When S1-FM needs a feature that SLOOP inherited from Felucca, inspect the corresponding Felucca implementation and history before re-implementing it.

Do not casually merge arbitrary newer Felucca/SLOOP `main` changes into S1-FM. Upstream updates should be explicit, reviewed migrations with regression testing.

## Import strategy

The next implementation step should import the pinned SLOOP 2.6 source/history in a way that preserves attribution and makes future upstream comparison practical.

Before modifying behavior:

1. reproduce the upstream build;
2. reproduce host/emulator tests where available;
3. document the FM-1 control matrix used by SLOOP;
4. identify the narrow extension points for S1 mode, MIDI CC output and browser companion behavior;
5. add tests before changing those paths.

S1-specific behavior should live behind a clear mode/module boundary whenever practical, rather than being spread as conditionals across unrelated upstream code.
