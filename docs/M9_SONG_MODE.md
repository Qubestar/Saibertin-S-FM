# M9 — Song Mode

M9 builds a simple arrangement layer on top of the independent Scene snapshots introduced in M8E.

## Goals

- arrange saved Scenes into named Song sections;
- choose a Scene and duration in 4/4 bars for every section;
- start every Song from section 1;
- advance sections on exact 16-step bar boundaries;
- support whole-song looping;
- stop transport after the final section when looping is disabled;
- provide manual Previous / Next section navigation;
- keep Scene Auto Chain and Song Mode mutually exclusive so two automation systems never fight over the same transport.

## UI

Each Song section stores:

- section name;
- Scene 1–8;
- bars 1–64.

Up to 32 Song sections are supported.

Example:

```text
Intro   · Scene 1 · 4 bars
Groove  · Scene 2 · 8 bars
Break   · Scene 3 · 4 bars
Drop    · Scene 4 · 16 bars
Fill    · Scene 5 · 1 bar
```

## Runtime

Song Mode listens to the existing `saibertin:transport-*` event contract. Scene changes are applied synchronously during `transport-plan` before the boundary tick is rendered/scheduled, so the next section begins on the boundary itself.

Song Mode asks the Scene layer to apply an existing independent Scene snapshot through `saibertin:song-apply-scene`; it does not duplicate Scene pattern storage.

## Persistence

Song structure is stored separately in localStorage under:

`saibertin-s-fm-song-v1`

Musical Scene data remains owned by the existing Scene storage.

## Validation target

Run:

```text
node web/companion/song-model.test.mjs
```

Browser validation should verify at minimum:

1. two saved Scenes with visibly different patterns;
2. Song sections `Scene 1 × 1 bar` then `Scene 2 × 2 bars`;
3. Song Mode ON, Scene Auto Chain OFF;
4. Play starts Scene 1;
5. Scene 2 begins exactly after 16 steps;
6. Scene 2 remains for 32 steps;
7. Loop Song repeats the arrangement;
8. with Loop Song OFF, transport stops after the last section.
