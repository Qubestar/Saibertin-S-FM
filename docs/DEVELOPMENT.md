# Saibertin S-FM development workflow

Saibertin S-FM currently develops as a small overlay on one exact upstream snapshot rather than a copied moving fork. This keeps our changes easy to audit while the first controller proof is still small.

## Upstream

Pinned in `UPSTREAM.lock`:

- repository: `isod89/sloop-fm1`
- tag: `v2.6`
- commit: `d30d6553353373cf5506b9ed285fc4a2aa0c30ef`

Do not change the pin casually. Review new upstream releases before rebasing S-FM.

## Prepare the source

From the Saibertin-S-FM repository root:

```bash
bash scripts/bootstrap-sloop.sh
python3 scripts/apply-overlay.py
```

The checkout lives in `.upstream/sloop-v2.6` and is intentionally ignored by Git.

The overlay currently:

1. adds `firmware/src/sfm.c`;
2. includes it before `ui_input.c` in SLOOP's single compilation unit;
3. redirects HOME K1..K4 to the S-FM CC proof;
4. adds `tests/sfm_cc_test.c` to SLOOP's host test runner.

## Build and test

SLOOP's macOS build requires the prerequisites documented upstream in `BUILDING.md`, including Docker Desktop, the JieLi toolchain, Python/Pillow and the required AC79 SDK files.

When those are installed:

```bash
bash scripts/build-and-test.sh
```

The script performs the pinned checkout, applies the overlay, builds the firmware and runs SLOOP's test suite including the S-FM CC host test.

## M1 behavior

On the HOME screen:

- ALGORITHM selects track 1..4 using SLOOP's existing track selection;
- K1 sends CC74;
- K2 sends CC71;
- K3 sends CC73;
- K4 sends CC91;
- each track keeps independent 0..127 values;
- the track's existing MIDI channel is used;
- MIDI channel OFF emits no CC packet;
- turning a knob shows track/channel/CC/value in the FM-1 status message.

This is a proof-of-concept mapping only. The controller numbers will become configurable after hardware validation.

## Hardware validation checklist

When the FM-1 arrives:

1. Build the pinned S-FM proof and back up the factory/current firmware first.
2. Install over the documented SLOOP/Felucca updater path.
3. Connect USB MIDI to a MIDI monitor before opening a DAW.
4. Confirm K1..K4 produce CC74/71/73/91 on the expected channel.
5. Change tracks with ALGORITHM and verify independent values/channels.
6. Set a track MIDI channel to OFF and verify silence on MIDI OUT.
7. Turn every knob slowly and very quickly in both directions; look for missed detents, reversal or bursts.
8. Run the sequencer while turning knobs rapidly; inspect MIDI timing and UI responsiveness.
9. Map the four CCs in Ableton Live and test a real plugin/device.
10. Record latency/jitter observations before adding more features.

## Before the first public release

The overlay model is convenient during early development, but the first public `.fwsc` release must ship with a clear corresponding-source story for GPL-3.0. Before publishing to The Firmware Hub, either vendor the exact upstream source into the release branch or produce a complete source bundle containing the pinned SLOOP source plus the S-FM changes and build instructions.
