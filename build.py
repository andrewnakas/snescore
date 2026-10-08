"""Build the three Donkey Kong Country browser players.

    python build.py            # all three -> dist/dkc{1,2,3}/
    python build.py 1          # one

Each output directory is a complete static site: index.html, dkcN.js, dkcN.wasm,
LICENSE, THIRD_PARTY_NOTICES.md. The wasm is the same machine for all three
(snescore + the host); only the page text and the accepted ROM hash differ.

Needs Emscripten. Set EMCC to emcc(.bat/.exe) if it is not on PATH, and
EM_CONFIG if your emsdk uses a non-default config file.
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EMCC = os.environ.get("EMCC") or shutil.which("emcc") or "emcc"

GAMES = {
    "1": dict(title="Donkey Kong Country", h1="Donkey Kong <span>Country</span>", accent="#d9a441",
              sha="fa8cacf5bbfc39ee6bbaa557adf89133d60d42f6cf9e1db30d5a36a469f74d15", romdesc="USA v1.0, headerless"),
    "2": dict(title="Donkey Kong Country 2", h1="Donkey Kong Country <span>2</span>", accent="#c9773a",
              sha="35421a9af9dd011b40b91f792192af9f99c93201d8d394026bdfb42cbf2d8633", romdesc="North America v1.0, headerless"),
    "3": dict(title="Donkey Kong Country 3", h1="Donkey Kong Country <span>3</span>", accent="#5fa8c9",
              sha="2277a2d8dddb01fe5cb0ae9a0fa225d42b3a11adccaeafa18e3c339b3794a32b", romdesc="USA (En,Fr), headerless"),
}

SOURCES = [ROOT / "dkc/web_host.c", ROOT / "snescore/snescore.c"] + sorted((ROOT / "snescore/lakesnes").glob("*.c"))

EXPORTS = ["_dkc_web_init", "_dkc_web_step", "_dkc_web_pixels", "_dkc_web_frame", "_dkc_web_wram", "_dkc_web_sram",
           "_dkc_web_sram_size", "_dkc_web_save", "_dkc_web_load", "_dkc_web_audio", "_dkc_web_audio_count",
           "_malloc", "_free"]


def build(n):
    g = GAMES[n]
    out = ROOT / "dist" / f"dkc{n}"
    out.mkdir(parents=True, exist_ok=True)
    cmd = [EMCC, "-O2", "-std=gnu11", "-Wno-unused-result",
           *map(str, SOURCES),
           "--no-entry", "-sMODULARIZE=1", f"-sEXPORT_NAME=createDKC{n}", "-sALLOW_MEMORY_GROWTH=1",
           "-sINITIAL_MEMORY=33554432", "-sSTACK_SIZE=1048576", "-sENVIRONMENT=web,node",
           "-sEXPORTED_RUNTIME_METHODS=['ccall','FS','HEAPU8']",
           "-sEXPORTED_FUNCTIONS=[" + ",".join(f"'{e}'" for e in EXPORTS) + "]",
           "-o", str(out / f"dkc{n}.js")]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout[-3000:], r.stderr[-3000:])
        raise SystemExit(f"emcc failed for dkc{n}")
    html = (ROOT / "web/page.html").read_text(encoding="utf-8")
    for k, v in {"TITLE": g["title"], "H1": g["h1"], "ACCENT": g["accent"], "SHA": g["sha"], "ROMDESC": g["romdesc"],
                 "JS": f"dkc{n}.js", "FACTORY": f"createDKC{n}", "FMT": f"dkc{n}-native"}.items():
        html = html.replace(f"@@{k}@@", v)
    assert "@@" not in html, "unfilled placeholder in page.html"
    (out / "index.html").write_text(html, encoding="utf-8", newline="\n")
    shutil.copy2(ROOT / "LICENSE", out / "LICENSE")
    shutil.copy2(ROOT / "THIRD_PARTY_NOTICES.md", out / "THIRD_PARTY_NOTICES.md")
    (out / ".nojekyll").write_text("")
    wasm = out / f"dkc{n}.wasm"
    print(f"dkc{n}: {wasm.stat().st_size} bytes wasm -> {out}")


def main():
    for n in (sys.argv[1:] or list(GAMES)):
        build(n)


main()
