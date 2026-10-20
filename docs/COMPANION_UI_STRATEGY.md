# Companion UI Strategy

## Principle

The Browser Companion is a complete editor and feature lab. It is not a 1:1 representation of the physical FM-1 or future Saibertin S1 panel.

A long Browser page is acceptable while features are being proven, but it is not the final interaction model.

## Browser workspaces

The Companion should move toward three workspace presets:

### Simple

Keep only the controls needed to make and play a pattern:

- track selection;
- target and channel;
- Pattern Slots;
- pattern library;
- transport;
- sequence page;
- live pads / keys.

### Performance

Add live arrangement and performance controls:

- Scenes;
- Song Mode;
- Note Repeat;
- Arp;
- fills / variations;
- clock status.

### Advanced

Expose the complete editor:

- MIDI output routing;
- internal-engine metadata;
- step editor;
- CC locks;
- detailed mappings;
- project / future device configuration.

## Module customization

Later the Companion should allow users to:

- hide modules they never use;
- reorder modules;
- save workspace layouts;
- restore the default layout;
- assign selected functions to future physical controls/pages.

This lets the product keep a broad feature set without forcing every user to see every control all the time.

## Physical-device rule

The hardware UI must be designed separately from the Browser layout.

The physical unit should prioritize:

1. tracks;
2. transport;
3. steps / patterns;
4. performance controls;
5. fast access to the currently relevant parameters.

Deep configuration belongs on secondary pages or in the Companion. A feature existing in the Companion does not automatically justify a dedicated hardware section or button.

## Eight-track consequence

With official FM1 Open establishing eight internal tracks, the hardware-facing model should treat eight tracks as the primary internal performance surface even though the Browser command center may expose many more logical MIDI tracks.

Target distinction:

- A01-A08: internal-capable + MIDI-capable;
- higher logical tracks: MIDI-first command-center tracks;
- future Saibertin S1 hardware: eight primary channel strips/tracks, matching the existing product direction.

## Goal

Keep the feature breadth that makes S-FM useful and interesting while reducing cognitive load. Advanced capability should be available, not constantly visible.
