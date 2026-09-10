#!/usr/bin/env bash
set -euo pipefail

OUT="${SHOWCASE_OUT:-${1:-showcase-output}}"
RAW="$OUT/raw"
PROC="$OUT/processed"
QA="$OUT/qa"
mkdir -p "$PROC" "$QA"

FONT_BOLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
if [[ ! -f "$FONT_BOLD" ]]; then FONT_BOLD="/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"; fi
if [[ ! -f "$FONT_REG" ]]; then FONT_REG="/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"; fi

probe_duration(){ ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$1"; }
calc_start(){ python3 - "$1" "$2" <<'PY'
import sys
D=float(sys.argv[1]); T=float(sys.argv[2]); print(f"{max(0.0,D-T-0.25):.3f}")
PY
}

normalise(){
  local id="$1" secs="$2" w="$3" h="$4"
  local in="$RAW/$id.webm" out="$PROC/${id}_clean.mp4"
  [[ -s "$in" ]] || { echo "Missing raw clip: $in" >&2; exit 1; }
  local dur start
  dur="$(probe_duration "$in")"
  start="$(calc_start "$dur" "$secs")"
  ffmpeg -hide_banner -loglevel error -y -ss "$start" -i "$in" -t "$secs" -an \
    -vf "fps=30,scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0F1530,format=yuv420p" \
    -c:v libx264 -preset medium -crf 18 -movflags +faststart "$out"
}

overlay_desktop(){
  local id="$1" title="$2" sub="$3"
  ffmpeg -hide_banner -loglevel error -y -i "$PROC/${id}_clean.mp4" -an \
    -vf "drawbox=x=72:y=62:w=1220:h=148:color=0x0F1530@0.82:t=fill,drawtext=fontfile='${FONT_BOLD}':text='${title}':x=104:y=82:fontsize=52:fontcolor=0xF2A24A,drawtext=fontfile='${FONT_REG}':text='${sub}':x=106:y=151:fontsize=25:fontcolor=0xFFFDF6" \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart "$PROC/${id}_overlay.mp4"
}

overlay_mobile(){
  local id="$1" title="$2" sub="$3"
  ffmpeg -hide_banner -loglevel error -y -i "$PROC/${id}_clean.mp4" -an \
    -vf "drawbox=x=60:y=150:w=960:h=230:color=0x0F1530@0.84:t=fill,drawtext=fontfile='${FONT_BOLD}':text='${title}':x=94:y=190:fontsize=72:fontcolor=0xF2A24A,drawtext=fontfile='${FONT_REG}':text='${sub}':x=96:y=294:fontsize=34:fontcolor=0xFFFDF6" \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart "$PROC/${id}_overlay.mp4"
}

# Desktop master: 81 seconds.
normalise home 8 1920 1080
normalise games 16 1920 1080
normalise lessons 15 1920 1080
normalise apps 12 1920 1080
normalise tools 10 1920 1080
normalise resources 12 1920 1080
normalise closing 8 1920 1080

overlay_desktop home 'MADE BY MATT' 'Learn · Build · Explore'
overlay_desktop games 'PLAY' 'Browser games built to explore, experiment and enjoy.'
overlay_desktop lessons 'LEARN' 'Interactive lessons designed for real classrooms.'
overlay_desktop apps 'CREATE' 'Creative tools that run straight from the browser.'
overlay_desktop tools 'WORK SMARTER' 'Practical tools built around real classroom workflows.'
overlay_desktop resources 'FIND WHAT YOU NEED' 'Lessons, activities, games and tools in one searchable collection.'
overlay_desktop closing 'MADE BY MATT' 'Games · Lessons · Apps · Tools · Resources  ·  madebymatt.uk'

: > "$PROC/master_overlay.txt"
: > "$PROC/master_clean.txt"
for id in home games lessons apps tools resources closing; do
  printf "file '%s'\n" "$(realpath "$PROC/${id}_overlay.mp4")" >> "$PROC/master_overlay.txt"
  printf "file '%s'\n" "$(realpath "$PROC/${id}_clean.mp4")" >> "$PROC/master_clean.txt"
done

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$PROC/master_overlay.txt" -an \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart "$OUT/Made_by_Matt_Showcase_Master.mp4"
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$PROC/master_clean.txt" -an \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart "$OUT/Made_by_Matt_Showcase_Clean.mp4"

# Purpose-built mobile social edit: 45 seconds, native mobile capture padded into a 9:16 frame.
normalise mobile_home 6 1080 1920
normalise mobile_games 7 1080 1920
normalise mobile_lessons 7 1080 1920
normalise mobile_apps 7 1080 1920
normalise mobile_tools 6 1080 1920
normalise mobile_resources 7 1080 1920
normalise mobile_closing 5 1080 1920

overlay_mobile mobile_home 'MADE BY MATT' 'Learn · Build · Explore'
overlay_mobile mobile_games 'PLAY' 'Games'
overlay_mobile mobile_lessons 'LEARN' 'BUILD · GROW · LAUNCH'
overlay_mobile mobile_apps 'CREATE' 'Creative Apps'
overlay_mobile mobile_tools 'WORK SMARTER' 'Teacher Tools'
overlay_mobile mobile_resources 'DISCOVER' 'Searchable Resources'
overlay_mobile mobile_closing 'madebymatt.uk' 'Learn · Build · Explore'

: > "$PROC/social_overlay.txt"
for id in mobile_home mobile_games mobile_lessons mobile_apps mobile_tools mobile_resources mobile_closing; do
  printf "file '%s'\n" "$(realpath "$PROC/${id}_overlay.mp4")" >> "$PROC/social_overlay.txt"
done
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$PROC/social_overlay.txt" -an \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart "$OUT/Made_by_Matt_Showcase_Social.mp4"

# 15-second teaser, cut from native mobile scenes rather than from the landscape master.
declare -A TD=(
  [mobile_home]=2.5 [mobile_games]=2.5 [mobile_lessons]=2.0 [mobile_apps]=2.0
  [mobile_tools]=1.5 [mobile_resources]=1.5 [mobile_closing]=3.0
)
: > "$PROC/teaser.txt"
for id in mobile_home mobile_games mobile_lessons mobile_apps mobile_tools mobile_resources mobile_closing; do
  ffmpeg -hide_banner -loglevel error -y -i "$PROC/${id}_overlay.mp4" -t "${TD[$id]}" -an \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart "$PROC/${id}_teaser.mp4"
  printf "file '%s'\n" "$(realpath "$PROC/${id}_teaser.mp4")" >> "$PROC/teaser.txt"
done
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$PROC/teaser.txt" -an \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart "$OUT/Made_by_Matt_Showcase_Teaser.mp4"

cat > "$OUT/Made_by_Matt_Showcase_Script.md" <<'EOF'
# Made by Matt Showcase — narration and social copy

Sentinel: `mbm-live-showcase-video-2026-08-08`

## Master narration

Welcome to Made by Matt — a growing collection of games, interactive lessons, creative apps, classroom tools and learning resources.

Explore browser games built for experimentation and fun.

Discover structured learning through BUILD, GROW and LAUNCH.

Create with browser-based studios and practical digital applications.

Work smarter with tools designed around classroom needs.

And find lessons, activities, games and resources from one searchable catalogue.

Made by Matt. Learn. Build. Explore.

Visit madebymatt.uk.

## Optional opener

What if games, interactive lessons, creative apps, classroom tools and learning resources all lived in one place? Welcome to Made by Matt — built to learn, build and explore.

## Optional closer

Whatever brought you here — there is probably something else you will want to explore. Made by Matt. Learn. Build. Explore.

## Facebook — main

Games. Lessons. Creative apps. Teacher tools. And a whole lot more. 🎮📚🛠️

I've been building Made by Matt into one place where learning, creativity and technology come together.

Explore interactive lessons, play browser games, discover creative studios, use practical classroom tools and search through a growing collection of resources — all from the same Made by Matt platform.

The video gives you a quick tour, but there's plenty more waiting inside.

Learn. Build. Explore.

👉 madebymatt.uk

#MadeByMatt #Education #EdTech #Teachers #TeachingResources #Learning #BrowserGames #CreativeTechnology

## Facebook — teacher focused

Built for the classroom. Made to be explored.

Made by Matt brings together interactive lessons, teaching resources, practical teacher tools, creative applications and browser games in one connected platform.

From structured BUILD · GROW · LAUNCH learning to tools designed to make classroom work easier, there's a lot here to explore.

Take a look around:
👉 madebymatt.uk

Made by Matt — Learn · Build · Explore.

## YouTube title

Made by Matt | Games, Interactive Lessons, Apps, Teacher Tools & Resources

## YouTube description

Welcome to Made by Matt.

This is a quick tour through a growing digital collection bringing together games, interactive lessons, creative apps and studios, teacher tools, and searchable learning resources.

Explore the Made by Matt learning pathways through BUILD, GROW and LAUNCH, discover classroom-ready resources, experiment with creative browser applications, or simply jump into a game.

Everything shown in this video is footage from the real Made by Matt platform.

Learn · Build · Explore

Visit: madebymatt.uk

#MadeByMatt #EdTech #Education #TeachingResources #InteractiveLearning #TeacherTools #BrowserGames

## YouTube Shorts caption

There's a lot more inside Made by Matt than you might expect. 👀

Games 🎮 · Lessons 📚 · Creative Apps 🎨 · Teacher Tools 🛠️ · Resources 🔎

Learn · Build · Explore
madebymatt.uk

#MadeByMatt #EdTech #Teachers #Learning
EOF

cat > "$OUT/Made_by_Matt_Showcase_Storyboard.md" <<'EOF'
# Made by Matt Showcase — production storyboard

Sentinel: `mbm-live-showcase-video-2026-08-08`

| Time | Scene | Genuine production content | On-screen line |
|---|---|---|---|
| 00:00–00:08 | Made by Matt | Updated homepage, identity, navigation, audience routes | MADE BY MATT · Learn · Build · Explore |
| 00:08–00:24 | Games | Games hub, curated shelf, Apex Kick opened and interacted with | PLAY |
| 00:24–00:39 | Lessons | Lesson Hub, BUILD/GROW/LAUNCH controls, Y5 Night and day, Earth rotation control | LEARN |
| 00:39–00:51 | Apps | Creator Hub filters/search, Design Studio, temporary local canvas creation | CREATE |
| 00:51–01:01 | Teacher tools | Tools Hub and UAS Register | WORK SMARTER |
| 01:01–01:13 | Resources | Resource catalogue subject/type/search response | FIND WHAT YOU NEED |
| 01:13–01:21 | Close | Homepage return and URL | MADE BY MATT · madebymatt.uk |

## Vertical edit

The 45-second social cut is built from separate 390 × 844 mobile browser captures and padded into a 1080 × 1920 social frame. It is not a crop of the landscape master.

## Capture rules used

Production URLs only; clean browser contexts; no account login; no pupil/staff data; no fabricated counts; no devtools; no website changes for filming; no third-party commercial soundtrack.
EOF

cat > "$OUT/Made_by_Matt_Showcase.srt" <<'EOF'
1
00:00:00,000 --> 00:00:08,000
Welcome to Made by Matt — a growing collection of games, interactive lessons, creative apps, classroom tools and learning resources.

2
00:00:08,000 --> 00:00:24,000
Explore browser games built for experimentation and fun.

3
00:00:24,000 --> 00:00:39,000
Discover structured learning through BUILD, GROW and LAUNCH.

4
00:00:39,000 --> 00:00:51,000
Create with browser-based studios and practical digital applications.

5
00:00:51,000 --> 00:01:01,000
Work smarter with tools designed around classroom needs.

6
00:01:01,000 --> 00:01:13,000
And find lessons, activities, games and resources from one searchable catalogue.

7
00:01:13,000 --> 00:01:21,000
Made by Matt. Learn. Build. Explore. Visit madebymatt.uk.
EOF

# Final media validation and QA still-frame extraction.
VIDEOS=(
  Made_by_Matt_Showcase_Master.mp4
  Made_by_Matt_Showcase_Social.mp4
  Made_by_Matt_Showcase_Teaser.mp4
  Made_by_Matt_Showcase_Clean.mp4
)
for name in "${VIDEOS[@]}"; do
  file="$OUT/$name"
  [[ -s "$file" ]] || { echo "Missing final output: $file" >&2; exit 1; }
  ffprobe -v error -show_entries stream=index,codec_name,codec_type,width,height,r_frame_rate,pix_fmt -show_entries format=duration,size -of json "$file" > "$QA/${name%.mp4}.ffprobe.json"
  dur="$(probe_duration "$file")"
  mid="$(python3 - "$dur" <<'PY'
import sys
print(f"{float(sys.argv[1])/2:.3f}")
PY
)"
  end="$(python3 - "$dur" <<'PY'
import sys
print(f"{max(0,float(sys.argv[1])-0.10):.3f}")
PY
)"
  ffmpeg -hide_banner -loglevel error -y -ss 0.10 -i "$file" -frames:v 1 "$QA/${name%.mp4}_first.jpg"
  ffmpeg -hide_banner -loglevel error -y -ss "$mid" -i "$file" -frames:v 1 "$QA/${name%.mp4}_middle.jpg"
  ffmpeg -hide_banner -loglevel error -y -ss "$end" -i "$file" -frames:v 1 "$QA/${name%.mp4}_final.jpg"
done

cat > "$OUT/Made_by_Matt_Showcase_Capture_Report.md" <<EOF
# Made by Matt Showcase — capture report

Sentinel: \`mbm-live-showcase-video-2026-08-08\`

## A. Production site verified

Capture automation loaded the public production estate directly from \`https://madebymatt.uk/\`. Exact route/status/title evidence is in \`capture-report.json\`.

## B–F. Footage captured

- Homepage: real production homepage and navigation.
- Games: real Games hub plus **Apex Kick** production gameplay surface and a live canvas gesture.
- Lessons: real Lesson Hub plus **Y5 · Night and day**, including the Earth rotation/day-night interactive control.
- Apps: real Creator Hub plus **Design Studio**, using temporary demo content inside an isolated browser context only.
- Teacher tools: real Tools Hub plus **UAS Register**; no pupil/staff records were entered.
- Resources: real catalogue search and filter interactions.

## G. Video outputs

The following were encoded as broadly compatible H.264 MP4, yuv420p, 30 fps, fast-start, with no audio track:

EOF
for name in "${VIDEOS[@]}"; do
  file="$OUT/$name"
  printf -- '- `%s` — %s bytes — ' "$name" "$(stat -c%s "$file")" >> "$OUT/Made_by_Matt_Showcase_Capture_Report.md"
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration -of default=nw=1 "$file" | tr '\n' ' ' >> "$OUT/Made_by_Matt_Showcase_Capture_Report.md"
  printf '\n' >> "$OUT/Made_by_Matt_Showcase_Capture_Report.md"
done
cat >> "$OUT/Made_by_Matt_Showcase_Capture_Report.md" <<'EOF'

## H. Privacy/security

The capture script uses fresh, non-persistent browser contexts. It does not log into email, GitHub or any personal service; it does not load a personal browser profile; it does not enter real pupil/staff information; and it performs no production write action. Demo canvas content exists only inside the disposable browser context.

## I. QA

`ffprobe` JSON for every final MP4 is stored in `qa/`. First, middle and final frames are extracted for each video so visual QA can confirm there are no accidental blank/black sections, broken overlays or obsolete pages.

## J. Reusable production system

The reusable system lives in `marketing/capture/`:

- `capture_showcase.mjs` — Playwright production capture.
- `shots.json` — scene durations, overlays and representative content.
- `build_showcase.sh` — normalisation, overlays, landscape/mobile assembly, teaser derivation and ffprobe validation.
- `.github/workflows/made-by-matt-showcase-capture.yml` — isolated CI runner with production internet access and artifact upload.

To regenerate after future site upgrades, update selectors/content names only when live structure genuinely changes, then run the workflow. Large MP4s remain workflow artifacts rather than normal website source files.

## Audio decision

No narration or synthetic soundtrack is baked into these outputs. That is intentional: the environment can generate tones but does not provide a sufficiently high-quality natural voice or original music system for a professional advert. The narration script and SRT are supplied separately, and all edits work silently with branded text overlays.
EOF

# Fail if output geometry/durations drift materially.
python3 - "$OUT" <<'PY'
import json, pathlib, subprocess, sys
out=pathlib.Path(sys.argv[1])
expected={
'Made_by_Matt_Showcase_Master.mp4':((1920,1080),(79,83)),
'Made_by_Matt_Showcase_Social.mp4':((1080,1920),(43,47)),
'Made_by_Matt_Showcase_Teaser.mp4':((1080,1920),(14,16)),
'Made_by_Matt_Showcase_Clean.mp4':((1920,1080),(79,83)),
}
for name,(dims,bounds) in expected.items():
    p=out/name
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height,codec_name,pix_fmt,r_frame_rate','-show_entries','format=duration','-of','json',str(p)]))
    v=next(s for s in data['streams'] if 'width' in s)
    got=(v['width'],v['height']); dur=float(data['format']['duration'])
    assert got==dims,(name,got,dims)
    assert bounds[0] <= dur <= bounds[1],(name,dur,bounds)
    assert v['codec_name']=='h264',(name,v['codec_name'])
    assert v['pix_fmt']=='yuv420p',(name,v['pix_fmt'])
print('Final media validation: PASS')
PY

echo "Showcase build complete: $OUT"
