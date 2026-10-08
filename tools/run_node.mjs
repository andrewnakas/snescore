// Headless, silent runner for a dkc_web_* build (this repo's, or any build with the same exports).
// Nothing is played: audio is only measured.
//
//   node run_node.mjs <build.js> <factoryName> <rom> <outDir> <frames> [keys] [dumpFrames]
//     keys        "from-to:bit,from-to:bit"   pad bit index held over a frame range (bit 3 = Start, 0 = B, 7 = Right)
//     dumpFrames  "600,1200"                  frames at which WRAM + picture are written to outDir
//
// Prints one JSON line: per-dump hashes, audio statistics, time per frame.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const [js, factoryName, romPath, outDir, framesArg, keysArg = '', dumpArg = ''] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const factory = require(resolve(js));
const logs = [];
const mod = await (typeof factory === 'function' ? factory : factory[factoryName])({
  print: s => logs.push(String(s)), printErr: s => logs.push('E ' + String(s)),
});
mkdirSync(outDir, { recursive: true });
let rom = readFileSync(romPath);
if (rom.length % 1024 === 512) rom = rom.subarray(512);
mod.FS.writeFile('/input.sfc', rom);
const rc = mod.ccall('dkc_web_init', 'number', ['string'], ['/input.sfc']);
if (rc !== 0) { console.log(JSON.stringify({ error: 'init', rc, logs })); process.exit(1); }

const spans = keysArg.split(',').filter(Boolean).map(s => { const [r, b] = s.split(':'); const [a, z] = r.split('-').map(Number); return { a, z: z ?? a, bit: +b }; });
const dumps = new Set(dumpArg.split(',').filter(Boolean).map(Number));
const frames = +framesArg;
const sha = b => createHash('sha256').update(b).digest('hex').slice(0, 16);
const hasAudio = typeof mod._dkc_web_audio_count === 'function';
const audio = { frames: 0, samples: 0, peak: 0, nonSilentFrames: 0, sumSq: 0, minCount: 1e9, maxCount: 0 };
const out = { build: js, sramSize: mod._dkc_web_sram_size(), dumps: {}, audio };
const pcmAll = [];
const t0 = performance.now();
for (let f = 1; f <= frames; f++) {
  let keys = 0;
  for (const s of spans) if (f >= s.a && f <= s.z) keys |= 1 << s.bit;
  const r = mod._dkc_web_step(keys);
  if (r < 0) { out.stopped = f; break; }
  if (hasAudio) {
    const n = mod._dkc_web_audio_count();
    const pcm = new Int16Array(mod.HEAPU8.buffer, mod._dkc_web_audio(), n * 2);
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) { const v = Math.abs(pcm[i]); if (v > peak) peak = v; audio.sumSq += pcm[i] * pcm[i]; }
    audio.frames++; audio.samples += n; if (peak > audio.peak) audio.peak = peak; if (peak > 0) audio.nonSilentFrames++;
    if (n < audio.minCount) audio.minCount = n; if (n > audio.maxCount) audio.maxCount = n;
    if (process.env.PCM) pcmAll.push(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).subarray());
  }
  if (dumps.has(f)) {
    const wram = Buffer.from(mod.HEAPU8.subarray(mod._dkc_web_wram(), mod._dkc_web_wram() + 0x20000));
    const pix = Buffer.from(mod.HEAPU8.subarray(mod._dkc_web_pixels(), mod._dkc_web_pixels() + 256 * 224 * 4));
    writeFileSync(`${outDir}/wram_${f}.bin`, wram);
    writeFileSync(`${outDir}/pix_${f}.bin`, pix);
    let lit = 0; for (let i = 0; i < pix.length; i += 4) if (pix[i] | pix[i + 1] | pix[i + 2]) lit++;
    out.dumps[f] = { wram: sha(wram), pix: sha(pix), litPixels: lit };
  }
}
out.msPerFrame = +((performance.now() - t0) / frames).toFixed(3);
audio.rms = audio.samples ? +Math.sqrt(audio.sumSq / (audio.samples * 2)).toFixed(1) : 0; delete audio.sumSq;
audio.nonSilentShare = audio.frames ? +(audio.nonSilentFrames / audio.frames).toFixed(4) : 0;
if (process.env.PCM) writeFileSync(`${outDir}/audio.pcm`, Buffer.concat(pcmAll));
out.logs = logs.slice(0, 6);
console.log(JSON.stringify(out));
