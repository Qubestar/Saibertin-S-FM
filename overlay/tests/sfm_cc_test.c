#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define NTRK 4

static struct { uint8_t sel; } song;
static uint8_t midi_ch[NTRK] = {0u, 1u, 0xFFu, 9u};
static uint32_t out_q[32];
static uint32_t out_n;
static char last_msg[32];

static uint32_t trk_midi_ch(uint32_t i) { return midi_ch[i % NTRK]; }
static void midi_out_event(uint32_t p) { assert(out_n < 32u); out_q[out_n++] = p; }
static void ui_message(const char *s)
{
    strncpy(last_msg, s, sizeof last_msg - 1u);
    last_msg[sizeof last_msg - 1u] = 0;
}

#include "../firmware/src/sfm.c"

static void expect_packet(uint32_t idx, uint32_t ch, uint32_t cc, uint32_t value)
{
    uint32_t p = out_q[idx];
    assert((p & 0xFFu) == 0x0Bu);
    assert(((p >> 8) & 0xFFu) == (0xB0u | ch));
    assert(((p >> 16) & 0x7Fu) == cc);
    assert(((p >> 24) & 0x7Fu) == value);
}

int main(void)
{
    song.sel = 0;
    sfm_cc_turn(0, 1);
    assert(out_n == 1u);
    expect_packet(0, 0, 74, 65);
    assert(strcmp(last_msg, "T1 C01 CC074 V065") == 0);

    sfm_cc_turn(1, 1000);
    assert(out_n == 2u);
    expect_packet(1, 0, 71, 127);

    sfm_cc_turn(1, -1000);
    assert(out_n == 3u);
    expect_packet(2, 0, 71, 0);

    song.sel = 1;
    sfm_cc_turn(0, -2);
    assert(out_n == 4u);
    expect_packet(3, 1, 74, 62);
    assert(strcmp(last_msg, "T2 C02 CC074 V062") == 0);

    song.sel = 0;
    sfm_cc_turn(0, 0);
    assert(out_n == 5u);
    expect_packet(4, 0, 74, 65);   /* track 1 kept its independent value */

    song.sel = 2;                   /* MIDI channel OFF */
    sfm_cc_turn(3, 1);
    assert(out_n == 5u);            /* no packet emitted */
    assert(strcmp(last_msg, "T3 C-- CC091 V065") == 0);

    puts("Saibertin S-FM CC proof: ok");
    return 0;
}
