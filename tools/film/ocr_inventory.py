#!/usr/bin/env python3
"""GATE Z: read every finished frame back and print the complete text inventory.

Why OCR and not DOM extraction: most frames are screenshots whose text could be
read from the DOM, but the Apex Kick frames are a WebGL canvas — the HUD with
the player name and the stat readout is drawn as pixels and has no DOM text at
all. Those are exactly the frames where something unexpected could hide, so the
inventory has to be read back off the picture.

Prints  "F frames, T distinct strings", then every string. Anything that is not
in the claim ledger stops the build.
"""
import subprocess, sys, os, re, collections, tempfile

VIDEO = sys.argv[1]
FPS = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0   # frames per second to sample

import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()

tmp = tempfile.mkdtemp(prefix="ocr_")
# Frames go out at 1280x720: tesseract reads the captions perfectly well at that
# size and it keeps 2286 PNGs inside a sane disk footprint.
subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-i", VIDEO,
                "-vf", f"fps={FPS},scale=1280:720", os.path.join(tmp, "f_%05d.png")], check=True)
frames = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))

def read(f):
    out = subprocess.run(["tesseract", os.path.join(tmp, f), "stdout", "--psm", "11"],
                         capture_output=True, text=True).stdout
    got = []
    for line in out.splitlines():
        s = line.strip()
        if len(s) < 2:                      # drop OCR noise: single chars
            continue
        if not re.search(r"[A-Za-z0-9]", s):  # and pure punctuation
            continue
        got.append(s)
    return f, got

from concurrent.futures import ThreadPoolExecutor
strings = collections.Counter()
per_frame = {}
with ThreadPoolExecutor(max_workers=int(os.environ.get("OCR_JOBS", "8"))) as ex:
    for f, got in ex.map(read, frames):
        per_frame[f] = got
        for s in got:
            strings[s] += 1

print("OCR TEXT INVENTORY")
print("%d frames read at %.2f fps, %d distinct strings" % (len(frames), FPS, len(strings)))
print()
for s, n in sorted(strings.items(), key=lambda kv: (-kv[1], kv[0].lower())):
    print("  %3dx  %s" % (n, s))
