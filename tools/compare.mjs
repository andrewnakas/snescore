// Black-box comparison of two dkc_web_* builds fed the same ROM and the same pad script.
// Used to measure this repo's build against a reference build ("oracle"); only outputs are
// compared (picture, work RAM, audio level). Silent: nothing is played.
//
//   node compare.mjs <new.js> <oracle.js> <rom> <frames> [keys] [window=4]
//     keys  "from-to:bit,..."  pad bit held over a frame range (0 B, 1 Y, 2 Select, 3 Start, 4 Up, 5 Down, 6 Left, 7 Right)
//
// Two machines never stay on the same frame for long (a lag frame on one side shifts
// everything after it), so each frame of <new> is compared with the oracle frames in
// [-window, +window] and both the same-frame and the best-aligned figures are reported.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [jsA, jsB, romPath, framesArg, keysArg = '', winArg = '4'] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const K = +winArg, frames = +framesArg;
let rom = readFileSync(romPath);
if (rom.length % 1024 === 512) rom = rom.subarray(512);
async function boot(js) {
  const mod = await require(resolve(js))({ print() {}, printErr() {} });
  mod.FS.writeFile('/input.sfc', rom);
  if (mod.ccall('dkc_web_init', 'number', ['string'], ['/input.sfc']) !== 0) throw new Error('init failed: ' + js);
  return mod;
}
const A = await boot(jsA), B = await boot(jsB);
const spans = keysArg.split(',').filter(Boolean).map(s => { const [r, b] = s.split(':'); const [a, z] = r.split('-').map(Number); return { a, z: z ?? a, bit: +b }; });
const keysAt = f => { let k = 0; for (const s of spans) if (f >= s.a && f <= s.z) k |= 1 << s.bit; return k; };
const NPIX = 256 * 224, NW = 0x20000;
function snap(mod) {
  const p = mod._dkc_web_pixels(), w = mod._dkc_web_wram();
  return { pix: new Uint32Array(mod.HEAPU8.slice(p, p + NPIX * 4).buffer), wram: mod.HEAPU8.slice(w, w + NW) };
}
function audioLevel(mod, acc) {
  if (typeof mod._dkc_web_audio_count !== 'function') return;
  const n = mod._dkc_web_audio_count();
  const pcm = new Int16Array(mod.HEAPU8.buffer, mod._dkc_web_audio(), n * 2);
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) { const v = Math.abs(pcm[i]); if (v > peak) peak = v; acc.sumSq += pcm[i] * pcm[i]; }
  acc.frames++; acc.samples += n; if (peak > acc.peak) acc.peak = peak; if (peak > 0) acc.nonSilent++;
}
const pixSame = (a, b) => { let s = 0; for (let i = 0; i < NPIX; i++) if (((a[i] ^ b[i]) & 0xffffff) === 0) s++; return s; };
const wramSame = (a, b) => { let s = 0; for (let i = 0; i < NW; i++) if (a[i] === b[i]) s++; return s; };

const ring = new Map();                       // oracle frame -> snapshot
const accA = { frames: 0, samples: 0, peak: 0, nonSilent: 0, sumSq: 0 }, accB = { ...accA };
let fB = 0;
const stepB = () => { fB++; B._dkc_web_step(keysAt(fB)); audioLevel(B, accB); ring.set(fB, snap(B)); ring.delete(fB - 2 * K - 2); };
const R = { frames: 0, pixExact0: 0, pixExactBest: 0, pixShare0: 0, pixShareBest: 0, wramShare0: 0, wramShareBest: 0,
            wramExact0: 0, offsets: {}, worstBestPix: 1, worstBestPixFrame: 0, minWram0: 1, minWram0Frame: 0, checkpoints: {} };
for (let f = 1; f <= frames; f++) {
  while (fB < f + K) stepB();
  A._dkc_web_step(keysAt(f)); audioLevel(A, accA);
  const a = snap(A);
  let best = -1, bestOff = 0, p0 = 0;
  for (let o = -K; o <= K; o++) {
    const b = ring.get(f + o); if (!b) continue;
    const s = pixSame(a.pix, b.pix);
    if (o === 0) p0 = s;
    if (s > best || (s === best && Math.abs(o) < Math.abs(bestOff))) { best = s; bestOff = o; }
  }
  const w0 = wramSame(a.wram, ring.get(f).wram), wb = bestOff === 0 ? w0 : wramSame(a.wram, ring.get(f + bestOff).wram);
  R.frames++; R.pixShare0 += p0 / NPIX; R.pixShareBest += best / NPIX; R.wramShare0 += w0 / NW; R.wramShareBest += wb / NW;
  if (p0 === NPIX) R.pixExact0++; if (best === NPIX) R.pixExactBest++; if (w0 === NW) R.wramExact0++;
  R.offsets[bestOff] = (R.offsets[bestOff] || 0) + 1;
  if (best / NPIX < R.worstBestPix) { R.worstBestPix = best / NPIX; R.worstBestPixFrame = f; }
  if (w0 / NW < R.minWram0) { R.minWram0 = w0 / NW; R.minWram0Frame = f; }
  if (f % Math.max(1, Math.floor(frames / 10)) === 0)
    R.checkpoints[f] = { pix0: +(p0 / NPIX).toFixed(4), pixBest: +(best / NPIX).toFixed(4), off: bestOff, wramDiff0: NW - w0, wramDiffBest: NW - wb };
}
for (const k of ['pixShare0', 'pixShareBest', 'wramShare0', 'wramShareBest']) R[k] = +(R[k] / R.frames).toFixed(5);
R.worstBestPix = +R.worstBestPix.toFixed(4); R.minWram0 = +R.minWram0.toFixed(5);
const fin = a => ({ samples: a.samples, peak: a.peak, rms: a.samples ? +Math.sqrt(a.sumSq / (a.samples * 2)).toFixed(1) : 0, nonSilentShare: a.frames ? +(a.nonSilent / a.frames).toFixed(4) : 0 });
console.log(JSON.stringify({ result: R, audioNew: fin(accA), audioOracle: fin(accB) }, null, 1));
