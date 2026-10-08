# dkc-commercial

Browser players for Donkey Kong Country 1, 2 and 3 (bring your own ROM) in which **everything that is
linked is MIT or more permissive**. No ROM, nothing extracted from a ROM, and no code generated from a ROM
is in this repository or in the pages it builds.

```
snescore/            game-independent SNES machine (MIT)
  snescore.h/.c      small host facade: load ROM, run a frame, picture, audio, pad, WRAM, battery RAM, snapshots
  lakesnes/          LakeSnes hardware model, vendored byte-identical from upstream (MIT)
dkc/web_host.c       the browser host: the dkc_web_* C API the player page calls
web/page.html        the player page template (ROM picker, canvas, WebAudio, save in localStorage, gamepad)
build.py             emcc build -> dist/dkc{1,2,3}/ (complete static sites)
tools/               silent test tools (node runner, oracle comparison, snapshot round trip, upstream check)
docs/LICENCE_AUDIT.md  why the earlier recompilation builds cannot be shipped commercially
```

## What changed, plainly

The earlier builds were static recompilations (DKC1Recomp / DKC2Recomp / DKC3Recomp) linked against the
`snesrecomp` runtime, which is PolyForm Noncommercial. The audit (`docs/LICENCE_AUDIT.md`) found that
replacing only the runtime would not be enough: the generated game C is itself a translation of the
cartridge program, includes PolyForm headers, and depends on the runtime's private protocol.

So these builds are **no longer recompilations**. They are an ordinary SNES machine, with an interpreted
65816 CPU, running the ROM the person picks. The wasm is the same 107 KB file for all three games; only the
page text and the accepted ROM hash differ. Enhancements that lived in the recompilation projects
(widescreen and so on) are not here.

`snescore/` has no game-specific code and can host any LoROM / HiROM / ExHiROM title without a coprocessor.

## Build

```
set EMCC=D:\n64work\emsdk\upstream\emscripten\emcc.exe
set EM_CONFIG=D:\n64work\emsdk\.emscripten
python build.py          # or: python build.py 1
```

Output: `dist/dkcN/` with `index.html`, `dkcN.js`, `dkcN.wasm`, `LICENSE`, `THIRD_PARTY_NOTICES.md`.
`dist/` is not committed. Built and tested with Emscripten 6.0.10.

## Clean-room discipline

- Allowed inputs: LakeSnes fetched from its own repository (`angelo-wf/LakeSnes`, MIT, pinned commit, kept
  byte-identical: `python tools/verify_lakesnes.py <clone>`), public hardware knowledge, and this project's
  own code.
- Not used: any `snesrecomp` source or header. Nothing was copied, translated or paraphrased from it. During
  the audit its files were listed, counted, hashed and compared by line statistics; the generated C (which is
  not snesrecomp source) was read only to see which symbols it needs. None of that reached this code, which
  does not implement any of those symbols.
- The earlier builds were used as a **black-box oracle** only: same ROM and same pad script into both, then
  compare the picture, work RAM and audio levels (`tools/compare.mjs`).
- The player page is the owner's existing page with the description line, one error string and the audio
  rate constant changed.

## What was tested (2026-10-08, all silent and headless; nothing was listened to or played by a person)

Oracle = the staged non-commercial builds. "Best-aligned" = compared with the oracle frame within +/-4 frames
that matches best, because two machines do not lag on the same frames.

| | DKC1 | DKC2 | DKC3 |
|---|---|---|---|
| Frames compared (scripted pad input) | 3,100 | 3,000 | 3,000 |
| Picture identical to the oracle, same frame | 939 | 892 | 393 |
| Picture identical, best-aligned | 1,582 | 1,374 | 525 |
| Mean share of identical pixels, same frame / best-aligned | 89.5% / 97.9% | 78.6% / 85.4% | 84.5% / 85.7% |
| Mean share of identical WRAM bytes, same frame | 99.91% | 99.57% | 98.47% |
| Audio peak, new / oracle | 17,853 / 18,780 | 17,307 / 16,421 | 16,093 / 17,988 |
| Audio RMS, new / oracle | 2,195 / 2,214 | 2,078 / 2,102 | 2,366 / 2,415 |
| Frames with non-silent audio, new / oracle | 87.2% / 87.3% | 87.7% / 88.0% | 88.4% / 89.5% |
| Battery RAM size, new / oracle | 2,048 / 2,048 | 2,048 / 2,048 | 2,048 / 2,048 |
| Snapshot save, run 300, load, run 300: identical | yes | yes | yes |
| Browser (headless Edge, muted): page errors / off-origin requests | 0 / 0 | 0 / 0 | 0 / 0 |
| Browser: how far it got | Jungle Hijinxs map, into the level, walking and rolling | Pirate Panic, in the level, moving | file select, world map, Wrinkly's Save Cave dialogue, save stored, back on the map |

The builds are close to the oracle but not frame-identical: where they differ it is mostly timing (the new
build tends to be a few frames behind in loading transitions), and after a divergence a moving scene does not
line up again within the +/-4 frame window, which is what pulls the DKC2 and DKC3 averages down.
Which of the two is closer to a real console was not measured.

Time per frame in node on the development PC: about 6 ms (oracle builds: 1.5-2.2 ms). A frame has 16.6 ms.

## What was not tested

- No person has played these builds, and nobody has listened to them. Audio is known to be non-silent and at
  the oracle's level; whether it sounds right is unverified.
- Nothing past the first minute or two of each game. No boss, no bonus room, no ending. DKC3 was not taken
  into a platforming level.
- Speed on phones or slow laptops. The interpreted CPU costs 3-4 times what the recompilation did.
- Audio scheduling as heard. Measured only with the browser muted at process level: over 120 s of DKC1 the
  page dropped 27 of 7,205 frame buffers, the oracle page 23 of 7,204 under the same conditions (a headless
  tab paces frames unevenly), so the two behave alike there. The machine produces 534 samples per frame (LakeSnes ties its DSP
  clock to a 60.0 Hz frame; a console makes about 533.1), so the page plays the stream at 32,093 Hz instead of
  32,040. That constant is arithmetic, not a measurement, and the first second after power-on delivers a few
  irregular bursts.
- Whether a save made on the earlier pages loads here. The size (2,048 bytes) and the localStorage key are the
  same and both are raw battery RAM, so it should; it was not tried.
- Snapshots exported from the earlier pages are a different format and are rejected ("State import failed").
- LakeSnes's own list of known problem games (upstream `bugs.md`) does not mention these three; that is the
  extent of the compatibility evidence beyond the runs above.
- Gamepad and touch input.
- The licence statements about Emscripten's system libraries come from Emscripten's licence files; the exact
  set of library objects in the link was not enumerated.

## Licence

MIT, see `LICENSE`. Third-party components and their licences: `THIRD_PARTY_NOTICES.md`.

The licence covers this software. It does not give anyone rights to the games: the page needs a ROM the
person supplies, and the names and games belong to their owners.
