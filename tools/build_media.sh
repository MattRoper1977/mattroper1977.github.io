#!/usr/bin/env bash
# Watch-grid media build for Neon Sync and Neon Breach.
#
# STATUS: HANDOFF SCRIPT. The clips it produces are OWED, not delivered —
# see MEDIA_OWED.md. Nothing here has been run to completion, so nothing it
# would produce is claimed as verified. Run it on a CI runner, which can both
# fetch the live paths and install a full ffmpeg.
#
# Convention DERIVED by ffprobe from the five committed clips, not assumed:
#   clip-apexkick.mp4             263 KB  480x930  18.1s  20fps  silent
#   clip-glitchclash.mp4          302 KB  480x930  17.7s  30fps  silent
#   clip-offbrand.mp4             299 KB  480x930  17.5s  30fps  silent
#   clip-voxelfrontier.mp4        358 KB  480x930  18.1s  20fps  silent
#   clip-voxelfrontier-play.mp4   387 KB  854x480  13.2s  25fps  silent  <-- landscape outlier
# Target: 480x930 portrait, ~18s, SILENT, 270-370 KB, poster .webp.
# Video slugs are UNHYPHENATED (clip-neonsync.mp4, poster-neonbreach.webp);
# card-art slugs hyphenate (neon-breach.svg). Both dialects are real.
set -euo pipefail

BASE="${BASE:-https://madebymatt.uk}"
OUT="${OUT:-artifacts/media}"
FFMPEG="${FFMPEG:-ffmpeg}"
FFPROBE="${FFPROBE:-ffprobe}"
mkdir -p "$OUT"

# ---------------------------------------------------------------- capture
# Records the DEPLOYED build. Byte-identity of served vs tree is proven by
# the live-verify workflow; this still records from the live path so the
# provenance chain has no gap.
capture () {                       # capture <slug> <path> <seconds>
  local slug="$1" path="$2" secs="$3"
  node tools/capture_clip.js --base "$BASE" --path "$path" \
       --out "$OUT/raw-$slug.webm" --seconds "$secs" --width 480 --height 930
}

# ---------------------------------------------------------- photosensitivity
# WCAG 2.3.1: no more than THREE general flashes in any one second.
# THIS GATE HAS NO SWAP. A fail is a GAME finding: stop, report, and do NOT
# retune the seed, the capture window, or the encode to get under the bar.
flash_check () {                   # flash_check <file>
  "$FFMPEG" -i "$1" -vf "select='gt(scene,0)',metadata=print:file=-" \
            -an -f null - 2>/dev/null | node tools/flash_rate.js --limit 3
}

# ------------------------------------------------------------------- OCR
# Every capture window is swept BEFORE chaining and again across the finished
# cut, for dialogs, IP addresses, personal data and notifications.
ocr_sweep () { node tools/ocr_sweep.js "$1"; }

# ------------------------------------------------------------------ encode
encode_portrait () {               # encode_portrait <in> <out>
  "$FFMPEG" -y -i "$1" -an \
    -vf "scale=480:930:force_original_aspect_ratio=increase,crop=480:930" \
    -c:v libx264 -profile:v high -crf 30 -preset slow -movflags +faststart "$2"
  "$FFPROBE" -v quiet -print_format json -show_format -show_streams "$2"
}

poster () {                        # poster <in> <out.webp>
  "$FFMPEG" -y -i "$1" -vframes 1 -vf "scale=480:930:force_original_aspect_ratio=increase,crop=480:930" -c:v libwebp -quality 82 "$2"
}

for game in "neonsync:/neonsync/" "neonbreach:/neonbreach/"; do
  slug="${game%%:*}"; path="${game##*:}"
  capture "$slug" "$path" 20
  ocr_sweep "$OUT/raw-$slug.webm"                 # before chaining
  flash_check "$OUT/raw-$slug.webm"               # unswappable
  encode_portrait "$OUT/raw-$slug.webm" "$OUT/clip-$slug.mp4"
  poster "$OUT/raw-$slug.webm" "$OUT/poster-$slug.webp"
  ocr_sweep "$OUT/clip-$slug.mp4"                 # again, across the finished cut
  flash_check "$OUT/clip-$slug.mp4"
  # Verify the finished file by extraction, not by trusting the encoder:
  # rendered video never displays back into a session.
  node tools/verify_clip.js "$OUT/clip-$slug.mp4" --expect-w 480 --expect-h 930 \
       --min-seconds 17 --max-seconds 20 --max-kb 370 --min-kb 260 --require-silent
done
