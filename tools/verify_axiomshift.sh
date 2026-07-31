#!/usr/bin/env bash
# Axiom Shift server-side gate. Runs the Node harness (solvability, determinism,
# Daily sweep, §5 contract, render smoke) against the built file, then a
# node --check on the extracted <script>. Fails the build on any red.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
file="${1:-$root/games/Axiom_Shift.html}"

echo "Verifying: $file"
[ -f "$file" ] || { echo "missing file: $file"; exit 2; }

# structural sanity (NOT a version prefix — stays green across version bumps)
grep -q 'AXIOM SHIFT — SIM CORE (BEGIN)' "$file" || { echo "sim core marker missing"; exit 2; }
grep -q "mbm_axiomshift" "$file" || { echo "save key missing"; exit 2; }

# node --check the extracted script
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
node -e 'const fs=require("fs");const h=fs.readFileSync(process.argv[1],"utf8");const s=h.indexOf("<script>")+8,e=h.lastIndexOf("</script>");fs.writeFileSync(process.argv[2],h.slice(s,e));' "$file" "$tmp/extracted.js"
node --check "$tmp/extracted.js"
echo "node --check: OK"

# full harness (x3 for stochastic safety — this sim is deterministic, so all
# three runs must agree; a flake here is a real fault, not noise)
for i in 1 2 3; do
  echo "--- harness pass $i ---"
  node "$here/verify_axiomshift.js" "$file"
done
echo "verify_axiomshift: ALL GREEN"
