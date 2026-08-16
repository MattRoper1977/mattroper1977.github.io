#!/usr/bin/env bash
# The positive control for tools/verify_inline_exit.mjs.
#
# WHY THIS EXISTS
# verify_inline_exit.mjs judges the thing a child on a locked-down device
# actually gets: the way OUT of eleven single-file games that carry a stamped
# inline exit region instead of <script src="/hud.js">. Until today it ran under
# NO WORKFLOW AT ALL — it only ever ran when somebody typed its name. That is
# the fourth instance of one species in this estate: a gate whose coverage is
# ASSERTED rather than EXERCISED. The other three were agx1-live-verify.yml's
# hand-list, verify_games_audience_faces.py green while 42 games were hidden,
# and the olympics control whose selector stopped matching.
#
# Wiring it to a workflow closes half of that. This closes the other half: a
# gate nobody has seen fail is a gate nobody knows can fail.
#
# WHAT IT BREAKS, AND WHY ON THE REAL TARGET
# It deletes the stamped exit region from ONE real game in a scratch copy of the
# estate, then demands the gate go RED. Not a synthetic fixture - the actual
# shipped bytes of an actual declared game, because a control that only fires on
# a stand-in proves the stand-in is broken and nothing about the product.
#
# It also reverse-applies: restoring the region must return the file byte for
# byte, so the control cannot leave a mutated tree behind.
#
# Usage:  tools/verify_inline_exit_control.sh [--lessons /path/to/Lessons]
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE="$(cd "$HERE/.." && pwd)"
LESSONS="${2:-${MBM_LESSONS_ROOT:-/home/user/Lessons}}"
[ "${1:-}" = "--lessons" ] && LESSONS="${2:?--lessons needs a path}"

# The victim is DERIVED from the ledger, not named here — a hard-coded filename
# would be the same species this gate exists to catch. First site-side game with
# a stamped region wins.
VICTIM_ROUTE="$(python3 - "$SITE" <<'PY'
import json,os,sys
root=sys.argv[1]
led=json.load(open(os.path.join(root,'data','hud-coverage.json')))['excluded']
for e in led:
    r=e['route']
    rel=r.lstrip('/') if r.endswith('.html') else r.strip('/')+'/index.html'
    p=os.path.join(root,rel)
    if os.path.isfile(p) and 'MBM-INLINE-EXIT:BEGIN' in open(p,encoding='utf-8',errors='replace').read():
        print(r); break
PY
)"
if [ -z "$VICTIM_ROUTE" ]; then
  echo "INCONCLUSIVE: no site-side declared game carries a stamped exit region."
  echo "  Nothing could be broken, so nothing was proven."
  echo "  This gate did not judge anything. That is not a pass."
  exit 2
fi
VICTIM_REL="${VICTIM_ROUTE#/}"; VICTIM_REL="${VICTIM_REL%/}/index.html"
VICTIM="$SITE/$VICTIM_REL"
BEFORE_SHA="$(sha256sum "$VICTIM" | cut -d' ' -f1)"

echo "=== control target, derived from data/hud-coverage.json ==="
echo "    route  $VICTIM_ROUTE"
echo "    file   $VICTIM_REL  ($(wc -c < "$VICTIM") bytes, sha256 ${BEFORE_SHA:0:16})"
echo

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

# A scratch ESTATE, because the gate derives its own ROOT from where it lives.
mkdir -p "$SCRATCH/site"
cp -a "$SITE/tools" "$SCRATCH/site/tools"
cp -a "$SITE/data" "$SCRATCH/site/data"
python3 - "$SITE" "$SCRATCH/site" <<'PY'
import json,os,shutil,sys
src,dst=sys.argv[1],sys.argv[2]
for e in json.load(open(os.path.join(src,'data','hud-coverage.json')))['excluded']:
    r=e['route']
    rel=r.lstrip('/') if r.endswith('.html') else r.strip('/')+'/index.html'
    s=os.path.join(src,rel)
    if os.path.isfile(s):
        d=os.path.join(dst,rel); os.makedirs(os.path.dirname(d),exist_ok=True); shutil.copy2(s,d)
PY
[ -d "$SITE/node_modules" ] && ln -s "$SITE/node_modules" "$SCRATCH/site/node_modules"
# The gate refuses to judge until it has proved its own server is answering, and
# it proves that by fetching /hud.js. The first cut of this control did not copy
# it, so the run ended INCONCLUSIVE at exit 3 — the gate behaving exactly as
# designed, and the control reporting "not a pass" exactly as designed. Both were
# right; the scratch estate was incomplete. Assembling an estate means assembling
# the file the gate uses to check it is talking to itself.
cp -a "$SITE/hud.js" "$SCRATCH/site/hud.js" 2>/dev/null || {
  echo "INCONCLUSIVE: hud.js is missing from the site root, so the gate cannot prove its own server."
  echo "  This gate did not judge anything. That is not a pass."; exit 2; }

# --- break exactly the exit region, and nothing else --------------------------
python3 - "$SCRATCH/site/$VICTIM_REL" <<'PY'
import re,sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
new=re.sub(r'<!-- MBM-INLINE-EXIT:BEGIN.*?MBM-INLINE-EXIT:END -->','',s,flags=re.S)
if new==s:
    print('INCONCLUSIVE: the region regex matched nothing; nothing was broken'); sys.exit(2)
open(p,'w',encoding='utf-8').write(new)
print(f'    removed the stamped exit region: {len(s)} B -> {len(new)} B')
PY
[ $? -eq 0 ] || exit 2

echo
echo "=== CONTROL: one real game's exit region removed — the gate must go RED ==="
set +e
OUT="$(node "$SCRATCH/site/tools/verify_inline_exit.mjs" --lessons "$LESSONS" 2>&1)"
RC=$?
set -e
echo "$OUT" | grep -E '^\s*\[FAIL\]' | head -6
echo "    exit code: $RC"
echo

if [ "$RC" -eq 0 ]; then
  echo "❌ CONTROL FAILED — the gate stayed green with a real game's exit region deleted."
  echo "   A gate that cannot go red on its own subject is asserting coverage, not exercising it."
  exit 1
fi
if [ "$RC" -eq 3 ]; then
  echo "INCONCLUSIVE: the gate could not put itself in a position to judge (exit 3)."
  echo "   That is not the control passing."
  exit 2
fi
echo "✅ CONTROL PASSED — the gate goes red on the defect it exists to catch."

# --- reverse-apply ------------------------------------------------------------
AFTER_SHA="$(sha256sum "$VICTIM" | cut -d' ' -f1)"
if [ "$BEFORE_SHA" != "$AFTER_SHA" ]; then
  echo "❌ the control modified the real tree — refusing to report a pass"; exit 1
fi
echo "✅ reverse-apply: the shipped tree is untouched, $BEFORE_SHA"
