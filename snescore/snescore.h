/* snescore - a small, game-independent SNES machine for hosts.
 *
 * MIT licence (see ../LICENSE). This file and snescore.c are original code.
 * The hardware model underneath is LakeSnes (MIT), vendored unmodified in
 * lakesnes/. Nothing in this directory knows about any particular game.
 *
 * The machine runs the cartridge image it is given: 65816 CPU, PPU, SPC700,
 * S-DSP, DMA/HDMA, LoROM / HiROM / ExHiROM carts with battery RAM.
 * No coprocessors (SA-1, SuperFX, DSP-n, Cx4 ...).
 */
#ifndef SNESCORE_H
#define SNESCORE_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

enum {
  SNESCORE_WIDTH = 256,
  SNESCORE_HEIGHT = 224,
  SNESCORE_WRAM_SIZE = 0x20000,
  SNESCORE_SAMPLE_RATE = 32040,     /* S-DSP output rate, stereo int16 */
  SNESCORE_MAX_FRAME_SAMPLES = 1024
};

/* Pad bits, in the order the console's serial pad reports them. */
enum {
  SNESCORE_PAD_B = 1 << 0, SNESCORE_PAD_Y = 1 << 1, SNESCORE_PAD_SELECT = 1 << 2, SNESCORE_PAD_START = 1 << 3,
  SNESCORE_PAD_UP = 1 << 4, SNESCORE_PAD_DOWN = 1 << 5, SNESCORE_PAD_LEFT = 1 << 6, SNESCORE_PAD_RIGHT = 1 << 7,
  SNESCORE_PAD_A = 1 << 8, SNESCORE_PAD_X = 1 << 9, SNESCORE_PAD_L = 1 << 10, SNESCORE_PAD_R = 1 << 11
};

typedef struct SnesCore SnesCore;

SnesCore *snescore_create(void);
void snescore_destroy(SnesCore *sc);

/* Copies the image; a 512-byte copier header is detected and skipped.
 * Performs a power-on reset. Returns false if the image is not a supported cart. */
bool snescore_load_rom(SnesCore *sc, const uint8_t *data, int length);
void snescore_reset(SnesCore *sc, bool hard);

/* player is 1 or 2; bits are SNESCORE_PAD_*. */
void snescore_set_pad(SnesCore *sc, int player, uint16_t bits);

/* Runs the machine up to the start of the next vertical blank, then
 * refreshes the picture and the audio for that frame. */
void snescore_run_frame(SnesCore *sc);
uint32_t snescore_frame_count(const SnesCore *sc);

/* 256x224, four bytes per pixel in memory order B, G, R, X.
 * High-resolution (512 wide) output is averaged down to 256. */
const uint8_t *snescore_pixels(const SnesCore *sc);

/* Interleaved stereo int16 at SNESCORE_SAMPLE_RATE: exactly the samples the
 * S-DSP produced during the last snescore_run_frame (about 533 on NTSC). */
const int16_t *snescore_audio(const SnesCore *sc);
int snescore_audio_count(const SnesCore *sc);

uint8_t *snescore_wram(SnesCore *sc);        /* SNESCORE_WRAM_SIZE bytes */
uint8_t *snescore_sram(SnesCore *sc);        /* battery RAM, may be NULL */
int snescore_sram_size(const SnesCore *sc);

/* Snapshot of the whole machine. save: pass NULL to query the size.
 * Returns the size written; load returns false on a foreign or mismatched snapshot. */
int snescore_save_state(SnesCore *sc, uint8_t *out);
bool snescore_load_state(SnesCore *sc, const uint8_t *data, int size);

#ifdef __cplusplus
}
#endif
#endif
