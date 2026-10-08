// Snapshot round trip: run, save, run N frames, load, run N frames again; both runs must end identical.
//   node state_test.mjs <build.js> <rom> [warmupFrames=2000] [n=300]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const [js, romPath, warm = '2000', nArg = '300'] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const mod = await require(resolve(js))({ print() {}, printErr() {} });
let rom = readFileSync(romPath);
if (rom.length % 1024 === 512) rom = rom.subarray(512);
mod.FS.writeFile('/input.sfc', rom);
if (mod.ccall('dkc_web_init', 'number', ['string'], ['/input.sfc']) !== 0) throw new Error('init');
const sha = () => {
  const h = createHash('sha256');
  h.update(mod.HEAPU8.subarray(mod._dkc_web_wram(), mod._dkc_web_wram() + 0x20000));
  h.update(mod.HEAPU8.subarray(mod._dkc_web_pixels(), mod._dkc_web_pixels() + 256 * 224 * 4));
  return h.digest('hex').slice(0, 16);
};
const run = n => { const h = createHash('sha256'); for (let i = 0; i < n; i++) { mod._dkc_web_step(i % 90 < 10 ? 8 : 0);
  const c = mod._dkc_web_audio_count(); h.update(mod.HEAPU8.subarray(mod._dkc_web_audio(), mod._dkc_web_audio() + c * 4)); } return sha() + ':' + h.digest('hex').slice(0, 16); };
run(+warm);
const saved = mod.ccall('dkc_web_save', 'number', ['string'], ['/state.bin']);
const size = saved ? mod.FS.readFile('/state.bin').length : 0;
const first = run(+nArg);
const loaded = mod.ccall('dkc_web_load', 'number', ['string'], ['/state.bin']);
const second = run(+nArg);
mod.FS.writeFile('/junk.bin', new Uint8Array(1000));
const junk = mod.ccall('dkc_web_load', 'number', ['string'], ['/junk.bin']);
console.log(JSON.stringify({ saved: !!saved, stateBytes: size, loaded: !!loaded, identicalAfterReload: first === second, first, second, junkRejected: !junk }));
