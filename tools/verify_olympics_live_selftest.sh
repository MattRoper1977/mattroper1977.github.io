#!/usr/bin/env bash
# Negative control for tools/verify_olympics_live.mjs.
#
# §0.4 binding: a gate's green does not count until the gate has been proven
# able to go red. This knocks over every limb in turn, from a known-good
# baseline, and requires each one to exit non-zero and to name itself.
#
# The arcade limb gets the sharpest control of the set. A shelf of 46 is
# served and all 46 cards ARE appended to #allGrid — but CSS collapses them.
# A node-counting assertion passes that fixture. The one in this repo must
# fail it, which is the whole difference between counting nodes and measuring
# what a person is actually shown.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$(cd "$HERE/.." && pwd)"
GAMES_JSON="${1:?usage: verify_olympics_live_selftest.sh <path to games.json>}"
WORK="$(mktemp -d)"
fails=0
PIDS=()

# Servers are started directly, never behind `( … ) &`. A subshell hands back
# the subshell's PID, the kill lands there, and python keeps the port — which
# is exactly how a stale server from an earlier run served a since-deleted
# fixture to this harness and reported a false red.
serve() {  # serve <dir> -> echoes the URL it is actually listening on
  local dir="$1" port
  port="$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')"
  python3 -m http.server "$port" --bind 127.0.0.1 --directory "$dir" >/dev/null 2>&1 &
  PIDS+=($!)
  for _ in $(seq 1 40); do
    curl -sf -o /dev/null "http://127.0.0.1:$port/" && break
    sleep 0.25
  done
  echo "http://127.0.0.1:$port"
}

cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done; rm -rf "$WORK"; }
trap cleanup EXIT

# ---- baseline fixture -------------------------------------------------------
mkdir -p "$WORK/root/Games" "$WORK/served" "$WORK/run"
cp -r "$SITE/games" "$WORK/root/"
cp "$GAMES_JSON" "$WORK/root/Games/games.json"
cp "$GAMES_JSON" "$WORK/served/games.json"
cp "$SITE/olympics/index.html" "$WORK/served/olympics.html"
cp "$HERE/verify_olympics_live.mjs" "$WORK/run/"

# The script is copied to a scratch dir, so playwright has to be findable from
# there. Resolve where it ACTUALLY lives rather than guessing a path: CI
# installs it into the repo, this container carries it globally, and a
# hard-coded path would work in exactly one of those and fail silently in the
# other. ESM ignores NODE_PATH, hence the symlink rather than an env var.
PW_ENTRY="$(NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" \
  node -e 'try{console.log(require.resolve("playwright"))}catch(e){}' 2>/dev/null)"
if [ -z "$PW_ENTRY" ]; then
  echo "  BROKEN cannot resolve playwright — the arcade limbs cannot be controlled"
  exit 1
fi
PW_ROOT="${PW_ENTRY%%/node_modules/*}/node_modules"
ln -sfn "$PW_ROOT" "$WORK/run/node_modules"
echo "  playwright resolved at $PW_ROOT"

BASE_URL="$(serve "$WORK/root")/games/"

run() {  # run <served-games> <served-olympics> <arcade-url>
  ( cd "$WORK/run" && node verify_olympics_live.mjs \
      --served-games "$1" --repo-games "$GAMES_JSON" \
      --served-olympics "$2" --repo-olympics "$SITE/olympics/index.html" \
      --arcade-url "$3" 2>&1 )
}

expect_red() {  # expect_red <label> <limb> <output>
  local label="$1" limb="$2" out="$3"
  if grep -q "FAILING LIMBS:.*$limb" <<<"$out"; then
    echo "  ok    $label -> red on $limb"
  else
    echo "  BROKEN $label -> did NOT go red on $limb"
    echo "$out" | tail -4 | sed 's/^/         /'
    fails=$((fails+1))
  fi
}

echo "== baseline must be green =="
out="$(run "$WORK/served/games.json" "$WORK/served/olympics.html" "$BASE_URL")"
if grep -q "limbs pass" <<<"$out" && ! grep -q "FAILING LIMBS" <<<"$out"; then
  echo "  ok    baseline green"
else
  echo "  BROKEN baseline is not green — every control below is meaningless"
  echo "$out" | tail -6 | sed 's/^/         /'
  exit 1
fi

echo "== knocking over each limb =="

# 1 games.json-bytes
python3 - "$WORK/served/games.json" "$WORK/nc1.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); d['strap']=str(d.get('strap',''))+' '
json.dump(d,open(sys.argv[2],'w'))
PY
expect_red "byte drift in served shelf" "games.json-bytes" "$(run "$WORK/nc1.json" "$WORK/served/olympics.html" "")"

# 2 shelf-non-empty
python3 -c "import json,sys;d=json.load(open(sys.argv[1]));d['games']=[];json.dump(d,open(sys.argv[2],'w'))" "$WORK/served/games.json" "$WORK/nc2.json"
expect_red "empty shelf served" "shelf-non-empty" "$(run "$WORK/nc2.json" "$WORK/served/olympics.html" "")"

# 3 shelf-count
python3 -c "import json,sys;d=json.load(open(sys.argv[1]));d['games']=d['games'][:-1];json.dump(d,open(sys.argv[2],'w'))" "$WORK/served/games.json" "$WORK/nc3.json"
expect_red "one entry short" "shelf-count" "$(run "$WORK/nc3.json" "$WORK/served/olympics.html" "")"

# 4 marker-sole-holder
python3 - "$WORK/served/games.json" "$WORK/nc4.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
for e in d['games']:
    if not e['title'].startswith('NEW'):
        e['title']='NEW · '+e['title']; break
json.dump(d,open(sys.argv[2],'w'))
PY
expect_red "two games wear NEW·" "marker-sole-holder" "$(run "$WORK/nc4.json" "$WORK/served/olympics.html" "")"

# 5 marker-is-olympics
python3 - "$WORK/served/games.json" "$WORK/nc5.json" <<'PY'
import json,re,sys
d=json.load(open(sys.argv[1]))
for e in d['games']:
    if e['title'].startswith('NEW'): e['title']=re.sub(r'^NEW\s*·\s*','',e['title'])
for e in d['games']:
    if e['href']!='/olympics/': e['title']='NEW · '+e['title']; break
json.dump(d,open(sys.argv[2],'w'))
PY
expect_red "marker on the wrong game" "marker-is-olympics" "$(run "$WORK/nc5.json" "$WORK/served/olympics.html" "")"

# 6 olympics-bytes
cp "$WORK/served/olympics.html" "$WORK/nc6.html"; printf '<!-- drift -->' >> "$WORK/nc6.html"
expect_red "served /olympics/ drifted" "olympics-bytes" "$(run "$WORK/served/games.json" "$WORK/nc6.html" "")"

# 7 arcade-renders-shelf — THE node-count control.
# All 46 cards are appended; CSS gives them no box. Node counting says 46.
mkdir -p "$WORK/hidden/Games"
cp -r "$SITE/games" "$WORK/hidden/"
cp "$GAMES_JSON" "$WORK/hidden/Games/games.json"
python3 - "$WORK/hidden/games/index.html" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
s=s.replace('</head>','<style>#allGrid a.gcard{display:none!important}</style></head>',1)
open(p,'w',encoding='utf-8').write(s)
PY
HIDDEN_URL="$(serve "$WORK/hidden")/games/"
out="$(run "$WORK/served/games.json" "$WORK/served/olympics.html" "$HIDDEN_URL")"
expect_red "46 cards appended, none rendered" "arcade-renders-shelf" "$out"
if grep -qE 'arcade-renders-shelf +0 cards' <<<"$out"; then
  echo "        (measured 0 rendered against a DOM holding 46 — node counting would have passed)"
fi

# 8 arcade-no-script-error
mkdir -p "$WORK/throw/Games"
cp -r "$SITE/games" "$WORK/throw/"
cp "$GAMES_JSON" "$WORK/throw/Games/games.json"
python3 - "$WORK/throw/games/index.html" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
s=s.replace('</head>','<script>setTimeout(function(){throw new Error("negative control")},50)</script></head>',1)
open(p,'w',encoding='utf-8').write(s)
PY
THROW_URL="$(serve "$WORK/throw")/games/"
expect_red "arcade throws" "arcade-no-script-error" "$(run "$WORK/served/games.json" "$WORK/served/olympics.html" "$THROW_URL")"

echo
if [ "$fails" -eq 0 ]; then
  echo "SELF-TEST PASS — every limb proven able to exit non-zero"
  exit 0
fi
echo "SELF-TEST FAIL — $fails limb(s) could not be knocked over"
exit 1
