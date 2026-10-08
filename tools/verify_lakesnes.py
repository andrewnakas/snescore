"""Check that snescore/lakesnes is byte-identical to upstream LakeSnes at the pinned commit.

    python tools/verify_lakesnes.py <path to a clone of https://github.com/angelo-wf/LakeSnes>
"""
import subprocess
import sys
from pathlib import Path

PIN = "9db90b86e46a377609305e298dd92d71cd1d4c8a"
here = Path(__file__).resolve().parent.parent / "snescore" / "lakesnes"
clone = sys.argv[1]


def blob(path):
    r = subprocess.run(["git", "-C", clone, "cat-file", "blob", f"{PIN}:{path}"], capture_output=True)
    return r.stdout if r.returncode == 0 else None


bad = 0
names = sorted(p.name for p in here.iterdir() if p.suffix in (".c", ".h"))
upstream = subprocess.run(["git", "-C", clone, "ls-tree", "--name-only", f"{PIN}:snes"], capture_output=True, text=True).stdout.split()
for n in sorted(set(names) | set(upstream)):
    ours = (here / n).read_bytes() if (here / n).exists() else None
    if ours != blob(f"snes/{n}"):
        print("DIFFERENT", n)
        bad += 1
if (here / "LICENSE.txt").read_bytes() != blob("LICENSE.txt"):
    print("DIFFERENT LICENSE.txt")
    bad += 1
print(f"{len(names)} source files checked against {PIN[:10]}: {bad} different")
sys.exit(1 if bad else 0)
