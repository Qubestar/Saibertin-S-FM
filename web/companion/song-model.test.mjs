import assert from 'node:assert/strict';
import {
  SONG_MAX_SECTIONS, SONG_MAX_BARS,
  normalizeSongSection, normalizeSong,
  sectionSteps, sectionEndTick,
  songTotalBars, songTotalSteps,
  nextSongCursor, songSectionAt,
} from './song-model.js';

assert.equal(SONG_MAX_SECTIONS, 32);
assert.equal(SONG_MAX_BARS, 64);

assert.deepEqual(
  normalizeSongSection({ name: ' Intro ', scene: 2, bars: 8 }, 0),
  { name: 'Intro', scene: 2, bars: 8 },
);
assert.deepEqual(
  normalizeSongSection({ scene: 99, bars: 0 }, 2),
  { name: 'Part 3', scene: 7, bars: 1 },
);

const song = normalizeSong({
  enabled: true,
  loop: false,
  cursor: 1,
  sections: [
    { name: 'Intro', scene: 0, bars: 4 },
    { name: 'Drop', scene: 1, bars: 8 },
  ],
});
assert.equal(song.enabled, true);
assert.equal(song.loop, false);
assert.equal(song.cursor, 1);
assert.equal(song.sections.length, 2);
assert.equal(songTotalBars(song), 12);
assert.equal(songTotalSteps(song), 192);
assert.equal(sectionSteps(song.sections[0]), 64);
assert.equal(sectionEndTick(64, song.sections[1]), 192);
assert.deepEqual(nextSongCursor(song, 0, 1), { cursor: 1, wrapped: false, ended: false });
assert.deepEqual(nextSongCursor(song, 1, 1), { cursor: 1, wrapped: false, ended: true });
assert.deepEqual(nextSongCursor(song, 0, -1), { cursor: 0, wrapped: false, ended: true });
assert.equal(songSectionAt(song, 0).name, 'Intro');
assert.equal(songSectionAt(song, 1).scene, 1);

const looping = normalizeSong({ loop: true, sections: [{ scene: 0, bars: 1 }, { scene: 1, bars: 1 }] });
assert.deepEqual(nextSongCursor(looping, 1, 1), { cursor: 0, wrapped: true, ended: false });
assert.deepEqual(nextSongCursor(looping, 0, -1), { cursor: 1, wrapped: true, ended: false });

const fallback = normalizeSong(null);
assert.equal(fallback.sections.length, 1);
assert.equal(fallback.sections[0].bars, 4);
assert.equal(fallback.sections[0].scene, 0);

console.log('Saibertin S-FM song model: ok');
