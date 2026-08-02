#!/usr/bin/env python3
"""GATE Z: the complete text inventory of the finished film.

Two sources, because they are not equally reliable:

  A. DOM text, for every captured page shot. This is AUTHORITATIVE — it is the
     exact string the browser laid out, with no OCR error at all — and it is
     what would carry a pupil's name if one were ever on screen.
  B. OCR, for the Apex Kick frames only. Those are the one place DOM text does
     not exist: the HUD, the player name and the ballistics readout are painted
     into a WebGL canvas, so pixels are the only source.

     Mode is --psm 12, not 11. On a frame with a confetti crowd texture, psm 11
     took ~37 s per image and psm 12 takes ~0.42 s for a strictly better read —
     it recovers the HUD player name, which is the exact string this check
     exists to catch. Measured, after psm 11 spent 27 minutes on 45 frames.

An earlier version OCR'd every frame of the whole film at 30 fps — 2,287 images,
most of them near-identical because no shot is shorter than 3.6 s and the only
motion is a 4 % zoom. On four cores that ran for over 40 minutes and told us
nothing the two sources above do not, less accurately. Brute force is not the
same as coverage.

Usage: text_inventory.py <capture-dir> <apex-clip.mp4> [ocr-fps]
"""
import subprocess, sys, os, re, json, collections, tempfile
import imageio_ffmpeg

CAPDIR = sys.argv[1]
APEX = sys.argv[2]
OCR_FPS = float(sys.argv[3]) if len(sys.argv) > 3 else 6.0
FF = imageio_ffmpeg.get_ffmpeg_exe()

# ---------- A. authoritative text: the cards we generated + the page DOM ----
manifest = os.path.join(CAPDIR, "text_manifest.json")
dom = {}
if os.path.exists(manifest):
    dom = json.load(open(manifest, encoding="utf-8"))

print("TEXT INVENTORY — GATE Z")
print()
print("SOURCE A — DOM text of every captured page shot (authoritative)")
print("  POPULATION: %d shots" % len(dom))
allstr = collections.Counter()
for shot, lines in sorted(dom.items()):
    print("  %s  — %d distinct strings" % (shot, len(set(lines))))
    for s in lines:
        allstr[s] += 1
print("  TOTAL distinct strings across all page shots: %d" % len(allstr))

# ---------- B. OCR, the Apex Kick canvas only ------------------------------
tmp = tempfile.mkdtemp(prefix="apexocr_")
subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-i", APEX,
                "-vf", f"fps={OCR_FPS},scale=1280:720", os.path.join(tmp, "a_%04d.png")],
               check=True)
frames = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))

from concurrent.futures import ThreadPoolExecutor
def read(f):
    out = subprocess.run(["tesseract", os.path.join(tmp, f), "stdout", "--psm", "12"],
                         capture_output=True, text=True).stdout
    got = []
    for line in out.splitlines():
        s = line.strip()
        if len(s) < 2 or not re.search(r"[A-Za-z0-9]", s):
            continue
        got.append(s)
    return got

ocr = collections.Counter()
with ThreadPoolExecutor(max_workers=int(os.environ.get("OCR_JOBS", "4"))) as ex:
    for got in ex.map(read, frames):
        for s in got:
            ocr[s] += 1

print()
print("SOURCE B — OCR of the Apex Kick frames (the only pixels-only source)")
print("  POPULATION: %d frames read at %.1f fps, %d distinct strings" % (len(frames), OCR_FPS, len(ocr)))
for s, n in sorted(ocr.items(), key=lambda kv: (-kv[1], kv[0].lower())):
    print("    %3dx  %s" % (n, s))

# ---------- the check that matters ----------------------------------------
NAMEY = re.compile(r"\b(pupil|class list|register|mark(s)?\b|surname|forename)\b", re.I)
suspects = [s for s in list(allstr) + list(ocr) if NAMEY.search(s)]
print()
print("PUPIL-SHAPED STRINGS IN ANY FRAME: %d" % len(suspects))
for s in suspects:
    print("    %s" % s)
