# LakeSnes (vendored, unmodified)

- Upstream: https://github.com/angelo-wf/LakeSnes
- Commit: `9db90b86e46a377609305e298dd92d71cd1d4c8a` (2023-12-02)
- Taken: every file of the upstream `snes/` directory, plus `LICENSE.txt`.
- Licence: MIT, Copyright (c) 2021-2023 angelo_wf and contributors.
- State: byte-identical to the upstream blobs (LF line endings). Check with
  `python tools/verify_lakesnes.py <path to a LakeSnes clone>`.

These files were fetched from that repository directly. They were **not** taken from
snesrev/zelda3, snesrev/smw, or snesrecomp, all of which carry modified descendants of
the same code under their own terms.

Local changes belong in `../snescore.c`, not here. If a file here ever has to be patched,
list the patch in this file.
