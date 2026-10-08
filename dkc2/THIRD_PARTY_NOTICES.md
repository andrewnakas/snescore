# Third-party notices

No ROM, and nothing extracted or generated from a ROM, is in this repository or in the
pages it builds. The page runs the cartridge image the person picks from their own disk.

Donkey Kong Country, Nintendo, Rare and related names are trademarks of their owners.
This is an unofficial project and is not affiliated with or endorsed by them.

## Linked into the WebAssembly

Everything that ends up in `dkcN.wasm` / `dkcN.js`:

| Component | Files | Licence | Source |
|---|---|---|---|
| snescore facade | `snescore/snescore.c`, `snescore/snescore.h` | MIT (this repository, `LICENSE`) | this repository |
| Browser host | `dkc/web_host.c` | MIT (this repository, `LICENSE`) | this repository |
| LakeSnes hardware model | `snescore/lakesnes/*.c`, `*.h` (21 files) | MIT, © 2021-2023 angelo_wf and contributors (`snescore/lakesnes/LICENSE.txt`) | https://github.com/angelo-wf/LakeSnes at commit `9db90b86e46a377609305e298dd92d71cd1d4c8a`, directory `snes/`, byte-identical (see `snescore/lakesnes/UPSTREAM.md`) |
| Emscripten runtime and system libraries (JS glue, musl libc, compiler-rt builtins, allocator) | added by `emcc` at link time, not stored here | Emscripten: MIT or UIUC/NCSA; musl: MIT; compiler-rt: Apache-2.0 with LLVM exception (also MIT/UIUC); dlmalloc: public domain (CC0) | https://github.com/emscripten-core/emscripten (built with 6.0.10) |

Nothing else is linked. In particular the wasm contains **no** code from `snesrecomp`
(PolyForm Noncommercial), from the DKC1Recomp / DKC2Recomp / DKC3Recomp projects, or
generated from a game ROM. `docs/LICENCE_AUDIT.md` records why those were left out.

The exact set of Emscripten system libraries that the linker pulls in was not enumerated
object by object; the row above lists what Emscripten's own licence files say about the
libraries a plain C program links.

## Not linked: used only as a reference while testing

The earlier non-commercial builds of the same three games (DKC*Recomp + snesrecomp) were
run side by side with this build as a black box, to compare pictures, work RAM and audio
levels (`tools/compare.mjs`). No source from them was read into, copied to, or translated
for this repository.

## LakeSnes licence

```
MIT License

Copyright (c) 2021-2023 angelo_wf and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
