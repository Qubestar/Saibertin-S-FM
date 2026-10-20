# Companion UI Strategy

## Principle

The Browser Companion is a complete editor and feature lab. It is not a 1:1 representation of the physical FM-1 or future Saibertin S1 panel.

A long Browser page is acceptable while features are being proven, but it is not the final interaction model.

## Browser workspaces (implemented in M11)

The Companion provides three presentation-only workspace presets via a sticky selector:

### Simple

Keeps only the controls needed to make and play a pattern:

- track selection;
- essential track setup (sequence length, target, channel, MIDI port);
- Pattern Slots;
- pattern library;
- transport;
- harmony & sequence page;
- live pads / keys / performance surface.

### Performance

Adds live arrangement and performance controls to Simple:

- Scenes / pattern chain;
- Song Mode;
- Note Repeat;
- Arp;
- fills / variations;
- MIDI clock / sync status.

### Advanced

Exposes the complete editor (everything in Simple and Performance plus):

- MIDI output routing (ports A–D);
- internal-engine metadata & sound slot;
- CC controls and mappings;
- Step Editor;
- CC locks;
- Drum mapping editor.

Workspaces only affect UI visibility (`display: none !important`). Background engines, automation (such as Scene Auto Chain and Song Mode), MIDI transport, and note generation remain fully active in the background regardless of which workspace is selected.

## Future module customization (post-M11)

Later milestones may allow users to:

- custom hide/show individual modules;
- drag and reorder modules;
- save custom workspace layouts;
- restore the default layout;
- map Browser functions to future physical controls/pages.

These capabilities remain future roadmap items and are not yet implemented.

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
