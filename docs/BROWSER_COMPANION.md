# Browser Companion / emulator direction

The user wants Saibertin S-FM to be usable and understandable on a normal large computer display, not only on the FM-1's 240x240 screen. The browser surface is therefore part of the product direction, not just a screenshot mockup.

## M2 now: functional workflow companion

`web/companion/` is deliberately dependency-free and already models:

- tracks 1..4 with independent MIDI channels;
- four independent MIDI CC values per track;
- 64 sequence steps in four pages of 16;
- KEYS, SCALE, CHORD, DRUM and SEQ modes;
- selectable root and scale;
- scale-safe note generation;
- scale-degree triads;
- a 16-pad drum map;
- Web MIDI note and CC output to a DAW or MIDI destination.

Run locally:

```bash
node web/companion/model.test.mjs
bash scripts/serve-companion.sh
```

Then open `http://localhost:8080` in a browser with Web MIDI support.

This lets us iterate the S-FM workflow with mouse/pointer input before the physical FM-1 arrives.

## Important: M2 is not the final emulator architecture

The JavaScript model exists to make the workflow testable immediately. It must not become a permanently separate musical engine that drifts away from firmware behavior.

The target is the approach demonstrated by HYP-1:

1. build a host/simulator version of the actual instrument firmware;
2. compile that host code to WebAssembly;
3. drive it from an AudioWorklet / browser event bridge;
4. read the real firmware framebuffer/LED state back into the browser;
5. optionally let the physical FM-1 panel remote-control the browser instance over USB MIDI.

HYP-1 demonstrates that the whole simulated FM-1 app can be compiled for `wasm32` with a small platform shim, expose screen/lights/input functions, and run from the browser while producing audio. Its Remote mode uses a reserved MIDI channel and CC/note messages to carry panel state in both directions.

## S-FM target architecture

```text
             browser UI / large screen
                      |
        +-------------+-------------+
        |                           |
   pointer/mouse                 Web MIDI
        |                           |
        v                           v
                S-FM host bridge
                      |
                      v
           SAME S-FM musical core
        modes / sequencer / routing
                      |
            +---------+---------+
            |                   |
          WASM              FM-1 build
            |                   |
       browser sim          real hardware
```

The key design rule is that SCALE, CHORD, DRUM, sequencer and CC behavior eventually have one authoritative implementation or shared data/model, with browser-specific code limited to platform/input/rendering concerns.

## Physical FM-1 remote mode

A later milestone should let the physical FM-1 control the browser companion similarly to HYP-1 Remote mode. Proposed direction:

- use one reserved MIDI channel for panel remote traffic;
- encode key presses as MIDI notes;
- encode buttons as a reserved CC block;
- encode endless encoder detents as relative CC values around 64;
- carry MASTER separately;
- send LED/key-light state back from the browser to the FM-1;
- include a hello/keepalive so unplugging or leaving Remote mode cannot leave either side stuck.

The exact CC/note allocation is not frozen yet and should avoid collision with normal S-FM musical MIDI.

## Next browser milestones

1. M2a: current JS companion, Web MIDI OUT, functional modes.
2. M2b: make CC numbers and drum note map editable/persistent.
3. M2c: sequencer transport/playhead and MIDI clock in the browser prototype.
4. M2d: inspect/port SLOOP's host simulation boundaries and build a minimal WASM proof.
5. M2e: replace duplicated JS musical behavior with firmware/shared-core behavior.
6. M2f: physical FM-1 Remote mode and bidirectional light/screen state.
