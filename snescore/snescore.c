/* snescore - host facade over the vendored LakeSnes machine.
 * MIT licence (see ../LICENSE). Original code; game-independent. */
#include <stdlib.h>
#include <string.h>

#include "snescore.h"
#include "lakesnes/snes.h"

struct SnesCore {
  Snes *snes;
  bool loaded;
  uint16_t audio_mark;                 /* DSP ring position at the last frame boundary */
  int audio_count;
  int16_t audio[SNESCORE_MAX_FRAME_SAMPLES * 2];
  uint8_t pixels[SNESCORE_WIDTH * SNESCORE_HEIGHT * 4];
};

/* LakeSnes ring buffer geometry (dsp.h: sampleBuffer[0x400 * 2], free-running sampleOffset). */
#define RING_MASK 0x3ff
/* LakeSnes picture buffer: two fields of 239 rows, each row 512 pixels of 4 bytes. */
#define ROW_BYTES 2048
#define FIELD_ROWS 239

SnesCore *snescore_create(void) {
  SnesCore *sc = calloc(1, sizeof(SnesCore));
  if(!sc) return NULL;
  sc->snes = snes_init();
  /* format 0: bytes in memory are B, G, R, X */
  snes_setPixelFormat(sc->snes, 0);
  return sc;
}

void snescore_destroy(SnesCore *sc) {
  if(!sc) return;
  snes_free(sc->snes);
  free(sc);
}

bool snescore_load_rom(SnesCore *sc, const uint8_t *data, int length) {
  sc->loaded = snes_loadRom(sc->snes, data, length);
  sc->audio_mark = sc->snes->apu->dsp->sampleOffset;
  sc->audio_count = 0;
  memset(sc->pixels, 0, sizeof(sc->pixels));
  return sc->loaded;
}

void snescore_reset(SnesCore *sc, bool hard) {
  snes_reset(sc->snes, hard);
  sc->audio_mark = sc->snes->apu->dsp->sampleOffset;
}

void snescore_set_pad(SnesCore *sc, int player, uint16_t bits) {
  Input *in = player == 2 ? sc->snes->input2 : sc->snes->input1;
  in->currentState = bits & 0x0fff;
}

static void refresh_pixels(SnesCore *sc) {
  const Ppu *ppu = sc->snes->ppu;
  /* the field the frame that just ended was drawn into */
  const uint8_t *field = ppu->pixelBuffer + (ppu->evenFrame ? 0 : FIELD_ROWS) * ROW_BYTES;
  uint8_t *out = sc->pixels;
  for(int y = 0; y < SNESCORE_HEIGHT; y++) {
    const uint8_t *row = field + y * ROW_BYTES;
    for(int x = 0; x < SNESCORE_WIDTH; x++) {
      const uint8_t *p = row + x * 8;   /* two 4-byte half-pixels: sub-screen then main */
      out[0] = (uint8_t)((p[0] + p[4] + 1) >> 1);
      out[1] = (uint8_t)((p[1] + p[5] + 1) >> 1);
      out[2] = (uint8_t)((p[2] + p[6] + 1) >> 1);
      out[3] = 0xff;
      out += 4;
    }
  }
}

static void refresh_audio(SnesCore *sc) {
  const Dsp *dsp = sc->snes->apu->dsp;
  uint16_t now = dsp->sampleOffset;
  int n = (uint16_t)(now - sc->audio_mark);
  uint16_t from = sc->audio_mark;
  if(n > RING_MASK) {                   /* more than the ring holds: keep the newest */
    from = (uint16_t)(now - RING_MASK);
    n = RING_MASK;
  }
  for(int i = 0; i < n; i++) {
    int at = ((uint16_t)(from + i)) & RING_MASK;
    sc->audio[i * 2] = dsp->sampleBuffer[at * 2];
    sc->audio[i * 2 + 1] = dsp->sampleBuffer[at * 2 + 1];
  }
  sc->audio_count = n;
  sc->audio_mark = now;
}

void snescore_run_frame(SnesCore *sc) {
  if(!sc->loaded) return;
  snes_runFrame(sc->snes);
  refresh_pixels(sc);
  refresh_audio(sc);
}

uint32_t snescore_frame_count(const SnesCore *sc) { return sc->snes->frames; }
const uint8_t *snescore_pixels(const SnesCore *sc) { return sc->pixels; }
const int16_t *snescore_audio(const SnesCore *sc) { return sc->audio; }
int snescore_audio_count(const SnesCore *sc) { return sc->audio_count; }
uint8_t *snescore_wram(SnesCore *sc) { return sc->snes->ram; }
uint8_t *snescore_sram(SnesCore *sc) { return sc->snes->cart->ramSize ? sc->snes->cart->ram : NULL; }
int snescore_sram_size(const SnesCore *sc) { return (int)sc->snes->cart->ramSize; }

int snescore_save_state(SnesCore *sc, uint8_t *out) {
  return snes_saveState(sc->snes, out);
}

bool snescore_load_state(SnesCore *sc, const uint8_t *data, int size) {
  /* LakeSnes takes a non-const pointer but only reads from it when loading */
  bool ok = snes_loadState(sc->snes, (uint8_t *)data, size);
  if(ok) {
    sc->audio_mark = sc->snes->apu->dsp->sampleOffset;
    sc->audio_count = 0;
  }
  return ok;
}
