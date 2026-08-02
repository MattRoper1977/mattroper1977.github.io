#!/usr/bin/env bash
# ============================================================================
#  Made by Matt — launch film builder
#
#  Rebuilds the whole video from source. The MP4 itself is deliberately NOT
#  committed: a 60 MB binary in a GitHub Pages repo is served to anyone who
#  guesses the path and bloats every clone for ever. This script is the
#  artefact; the film is its output.
#
#  Everything on screen is a real screenshot, real gameplay, or a card drawn
#  from the estate's own palette and the "M" geometry in
#  assets/brand/micro_mark.svg. Nothing is AI-generated. Nothing is stock.
#
#  Silent by design (-an). Music is added at upload from YouTube's own Audio
#  Library, because a licence that cannot be verified here must not be baked in.
#  Burned-in captions are therefore the accessibility layer, not decoration.
#
#  Usage:   bash tools/film/build_film.sh [OUTDIR]
#  Needs:   node + playwright, python3 with imageio-ffmpeg, two local servers
#           (this repo, and a checkout of MattRoper1977/Lessons)
# ============================================================================
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-/tmp/claude-0/film}"
RAW="$OUT/raw"; CARDS="$OUT/cards"; SHOTS="$OUT/shots"
mkdir -p "$RAW" "$CARDS" "$SHOTS"

FF="$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')"
echo "ffmpeg: $FF"

# ---------------------------------------------------------------- 1. sources
# (capture.mjs and ak_capture.mjs enforce GATE Z: a clean browser profile is
#  asserted BEFORE the first frame, and no frame is written if a pupil-shaped
#  storage key is present. See tools/film/README.md.)
if [ "${SKIP_CAPTURE:-0}" != "1" ]; then
  node "$REPO/tools/film/capture.mjs"      "$RAW"
  node "$REPO/tools/film/ak_capture.mjs"   "$OUT/akvid"
fi
node "$REPO/tools/film/cards.mjs" "$CARDS"

# --------------------------------------------------------- 2. Apex Kick clip
# Real motion, driven through the game's own input paths and recorded by
# Playwright at 25 fps. NOT a canvas readback: this game's WebGL context is
# preserveDrawingBuffer:false and drawImage() returns pure black — a trap
# already recorded on this estate.
AKV="$(ls "$OUT"/akvid/*.webm | head -1)"
"$FF" -hide_banner -loglevel error -ss "${AK_SS:-30.20}" -t 7.5 -i "$AKV" \
  -vf "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" \
  -an -c:v libx264 -preset slow -crf 20 "$OUT/akmotion.mp4" -y
"$FF" -hide_banner -loglevel error -ss "${AK_SS:-30.20}" -i "$AKV" -frames:v 1 "$RAW/apex-aim.png" -y
"$FF" -hide_banner -loglevel error -ss 34.05 -i "$AKV" -frames:v 1 "$RAW/apex-flight.png" -y

# ------------------------------------------------------------- 3. shot list
# CALM MOTION GATE: minimum shot length 1.2 s (every shot here is >= 3.5 s),
# hard cuts only — no flashes, no strobing, no full-frame luminance flips.
# Stills carry a 1.00 -> 1.04 zoom over the whole shot, roughly 0.008 % per
# frame: enough that the frame is not dead, far below anything that reads as
# movement. The audience is SEMH pupils and their teachers.
shot_still () {                     # $1 image  $2 caption|-  $3 seconds  $4 out
  local img="$1" cap="$2" dur="$3" out="$4"
  local frames; frames=$(python3 -c "print(int(round($dur*30)))")
  if [ "$cap" = "-" ]; then
    "$FF" -hide_banner -loglevel error -loop 1 -framerate 30 -t "$dur" -i "$img" \
      -vf "scale=3840:2160:flags=lanczos,zoompan=z='min(1+0.04*on/$frames,1.04)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,format=yuv420p" \
      -an -c:v libx264 -preset slow -crf 20 -r 30 "$out" -y
  else
    "$FF" -hide_banner -loglevel error -loop 1 -framerate 30 -t "$dur" -i "$img" -i "$cap" \
      -filter_complex "[0:v]scale=3840:2160:flags=lanczos,zoompan=z='min(1+0.04*on/$frames,1.04)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p" \
      -an -c:v libx264 -preset slow -crf 20 -r 30 "$out" -y
  fi
}
shot_card () {                      # $1 image  $2 seconds  $3 out
  "$FF" -hide_banner -loglevel error -loop 1 -framerate 30 -t "$2" -i "$1" \
    -vf "scale=1920:1080,fps=30,format=yuv420p" \
    -an -c:v libx264 -preset slow -crf 20 -r 30 "$3" -y
}
shot_motion () {                    # $1 clip  $2 caption  $3 out
  "$FF" -hide_banner -loglevel error -i "$1" -i "$2" \
    -filter_complex "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p" \
    -an -c:v libx264 -preset slow -crf 20 -r 30 "$3" -y
}

# Shot numbers are explicit. The first version used a counter incremented
# inside a function called as `S=$(n)` — a command substitution runs in a
# SUBSHELL, so the parent's counter never moved and all fifteen shots wrote to
# 01.mp4. Nothing errored; the concat list simply pointed fifteen times at one
# file. A silent wrong answer, which is why the shot count is asserted below.
> "$OUT/concat.txt"
add () { echo "file '$1'" >> "$OUT/concat.txt"; }

shot_card   "$CARDS/title.png"                                  5.0 "$SHOTS/01.mp4"; add "$SHOTS/01.mp4"
shot_card   "$CARDS/beat1.png"                                  3.6 "$SHOTS/02.mp4"; add "$SHOTS/02.mp4"
shot_still  "$RAW/privacy-lead.png"   "$CARDS/cap-privacy-1.png" 6.0 "$SHOTS/03.mp4"; add "$SHOTS/03.mp4"
shot_still  "$RAW/privacy-table.png"  "$CARDS/cap-privacy-2.png" 5.6 "$SHOTS/04.mp4"; add "$SHOTS/04.mp4"
shot_still  "$RAW/members-h1.png"     "$CARDS/cap-members.png"   5.0 "$SHOTS/05.mp4"; add "$SHOTS/05.mp4"
shot_card   "$CARDS/beat2.png"                                  3.6 "$SHOTS/06.mp4"; add "$SHOTS/06.mp4"
shot_motion "$OUT/akmotion.mp4"       "$CARDS/cap-apex-1.png"        "$SHOTS/07.mp4"; add "$SHOTS/07.mp4"
shot_still  "$RAW/apex-flight.png"    "$CARDS/cap-apex-2.png"   4.6 "$SHOTS/08.mp4"; add "$SHOTS/08.mp4"
shot_still  "$RAW/home-doors.png"     "$CARDS/cap-doors.png"    5.0 "$SHOTS/09.mp4"; add "$SHOTS/09.mp4"
shot_card   "$CARDS/beat3.png"                                  3.6 "$SHOTS/10.mp4"; add "$SHOTS/10.mp4"
shot_still  "$RAW/bio-w5-osmosis.png" "$CARDS/cap-bio-1.png"    5.6 "$SHOTS/11.mp4"; add "$SHOTS/11.mp4"
shot_still  "$RAW/bio-w6-active.png"  "$CARDS/cap-bio-2.png"    5.0 "$SHOTS/12.mp4"; add "$SHOTS/12.mp4"
shot_still  "$RAW/bio-w7-command.png" "$CARDS/cap-bio-3.png"    5.0 "$SHOTS/13.mp4"; add "$SHOTS/13.mp4"
shot_still  "$RAW/home-hero.png"      "-"                       4.6 "$SHOTS/14.mp4"; add "$SHOTS/14.mp4"
shot_card   "$CARDS/end.png"                                    6.5 "$SHOTS/15.mp4"; add "$SHOTS/15.mp4"

# population assertion: 15 distinct shot files, all non-empty
built=$(ls "$SHOTS"/*.mp4 | wc -l)
listed=$(wc -l < "$OUT/concat.txt")
echo "shots built: $built   listed in concat: $listed"
[ "$built" -eq 15 ] || { echo "EXPECTED 15 distinct shot files, got $built"; exit 1; }
for f in "$SHOTS"/*.mp4; do [ -s "$f" ] || { echo "empty shot: $f"; exit 1; }; done

# ---------------------------------------------------------------- 4. assemble
"$FF" -hide_banner -loglevel error -f concat -safe 0 -i "$OUT/concat.txt" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow -crf 21 \
  -r 30 -movflags +faststart -an "$OUT/madebymatt-launch.mp4" -y

echo
echo "built: $OUT/madebymatt-launch.mp4"
"$FF" -hide_banner -i "$OUT/madebymatt-launch.mp4" 2>&1 | grep -E "Duration|Stream"
echo "bytes: $(stat -c%s "$OUT/madebymatt-launch.mp4")"
