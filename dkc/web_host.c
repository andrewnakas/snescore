/* Browser host for the Donkey Kong Country players.
 * MIT licence (see ../LICENSE). Original code.
 *
 * Exports the same C API the existing player page already calls
 * (dkc_web_init/step/pixels/frame/wram/sram/sram_size/save/load/audio/audio_count),
 * implemented on snescore. There is no game code here: the cartridge image the
 * person picks is loaded into the machine and run.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#include <emscripten/emscripten.h>

#include "../snescore/snescore.h"

static SnesCore *core;
static int frame_no;

static uint8_t *read_file(const char *path, long *size) {
  FILE *f = fopen(path, "rb");
  if(!f) return NULL;
  fseek(f, 0, SEEK_END);
  long n = ftell(f);
  fseek(f, 0, SEEK_SET);
  uint8_t *buf = n > 0 ? malloc((size_t)n) : NULL;
  if(buf && fread(buf, 1, (size_t)n, f) != (size_t)n) { free(buf); buf = NULL; }
  fclose(f);
  *size = n;
  return buf;
}

/* 0 on success. */
EMSCRIPTEN_KEEPALIVE int dkc_web_init(const char *rom_path) {
  long n = 0;
  uint8_t *rom = read_file(rom_path, &n);
  if(!rom) return 1;
  if(!core) core = snescore_create();
  bool ok = core && snescore_load_rom(core, rom, (int)n);
  free(rom);
  frame_no = 0;
  return ok ? 0 : 2;
}

/* keys: bit 0..11 = B Y Select Start Up Down Left Right A X L R. Returns the frame number, or -1. */
EMSCRIPTEN_KEEPALIVE int dkc_web_step(int keys) {
  if(!core) return -1;
  snescore_set_pad(core, 1, (uint16_t)keys);
  snescore_run_frame(core);
  return ++frame_no;
}

EMSCRIPTEN_KEEPALIVE const uint8_t *dkc_web_pixels(void) { return core ? snescore_pixels(core) : NULL; }
EMSCRIPTEN_KEEPALIVE int dkc_web_frame(void) { return frame_no; }
EMSCRIPTEN_KEEPALIVE uint8_t *dkc_web_wram(void) { return core ? snescore_wram(core) : NULL; }
EMSCRIPTEN_KEEPALIVE uint8_t *dkc_web_sram(void) { return core ? snescore_sram(core) : NULL; }
EMSCRIPTEN_KEEPALIVE int dkc_web_sram_size(void) { return core ? snescore_sram_size(core) : 0; }
EMSCRIPTEN_KEEPALIVE const int16_t *dkc_web_audio(void) { return core ? snescore_audio(core) : NULL; }
EMSCRIPTEN_KEEPALIVE int dkc_web_audio_count(void) { return core ? snescore_audio_count(core) : 0; }

/* Snapshot to / from a file in the in-memory filesystem. Non-zero on success. */
EMSCRIPTEN_KEEPALIVE int dkc_web_save(const char *path) {
  if(!core) return 0;
  int n = snescore_save_state(core, NULL);
  uint8_t *buf = malloc((size_t)n);
  if(!buf) return 0;
  snescore_save_state(core, buf);
  FILE *f = fopen(path, "wb");
  int ok = f && fwrite(buf, 1, (size_t)n, f) == (size_t)n;
  if(f) fclose(f);
  free(buf);
  return ok;
}

EMSCRIPTEN_KEEPALIVE int dkc_web_load(const char *path) {
  if(!core) return 0;
  long n = 0;
  uint8_t *buf = read_file(path, &n);
  if(!buf) return 0;
  int ok = snescore_load_state(core, buf, (int)n);
  free(buf);
  return ok;
}
