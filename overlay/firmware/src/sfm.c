/* SPDX-License-Identifier: GPL-3.0-only
 * Saibertin S-FM additions for the M-VAVE FM-1.
 *
 * M1 proof: on HOME, KNOB 1..4 act as four MIDI CC controls for the
 * selected track. This file is intentionally small and is included into
 * SLOOP's single compilation unit before ui_input.c. */
#ifndef SFM_CC_PROOF
#define SFM_CC_PROOF 1
#endif

#if SFM_CC_PROOF
static const uint8_t SFM_CC_DEFAULT[4] = {74u, 71u, 73u, 91u};
static uint8_t sfm_cc_value[NTRK][4];
static uint8_t sfm_cc_ready;

static void sfm_cc_init(void)
{
    uint32_t t, k;
    if (sfm_cc_ready)
        return;
    for (t = 0; t < NTRK; t++)
        for (k = 0; k < 4u; k++)
            sfm_cc_value[t][k] = 64u;
    sfm_cc_ready = 1u;
}

static uint8_t sfm_cc_adjust(uint32_t track, uint32_t slot, int32_t steps)
{
    int32_t v;
    sfm_cc_init();
    track %= NTRK;
    slot &= 3u;
    v = (int32_t)sfm_cc_value[track][slot] + steps;
    if (v < 0)
        v = 0;
    else if (v > 127)
        v = 127;
    sfm_cc_value[track][slot] = (uint8_t)v;
    return (uint8_t)v;
}

static void sfm_midi_out_cc(uint32_t ch, uint32_t cc, uint32_t value)
{
    if (ch > 15u || cc > 127u)
        return;
    midi_out_event(0x0Bu | (0xB0u | ch) << 8 | (cc & 127u) << 16 | (value & 127u) << 24);
}

static void sfm_put3(char *p, uint32_t v)
{
    v %= 1000u;
    p[0] = (char)('0' + (v / 100u) % 10u);
    p[1] = (char)('0' + (v / 10u) % 10u);
    p[2] = (char)('0' + v % 10u);
}

static void sfm_cc_feedback(uint32_t track, uint32_t ch, uint32_t cc, uint32_t value)
{
    char b[] = "T1 C01 CC074 V083";
    b[1] = (char)('1' + track % 9u);
    if (ch <= 15u) {
        uint32_t shown = ch + 1u;
        b[4] = (char)('0' + (shown / 10u) % 10u);
        b[5] = (char)('0' + shown % 10u);
    } else {
        b[4] = '-';
        b[5] = '-';
    }
    sfm_put3(&b[9], cc);
    sfm_put3(&b[14], value);
    ui_message(b);
}

static void sfm_cc_turn(uint32_t slot, int32_t steps)
{
    uint32_t track = (uint32_t)song.sel % NTRK;
    uint32_t ch = trk_midi_ch(track);
    uint32_t cc = SFM_CC_DEFAULT[slot & 3u];
    uint32_t value = sfm_cc_adjust(track, slot, steps);
    sfm_midi_out_cc(ch, cc, value);
    sfm_cc_feedback(track, ch, cc, value);
}
#endif
