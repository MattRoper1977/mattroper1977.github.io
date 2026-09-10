/**
 * SW2 T4 — the token file resolves on the COMPOSED Play tree, not just the site.
 *
 * The Play tree is built, not authored: domain-split/build_publications.py
 * copies assets/ and images/ wholesale into domain-split/output/games/ and the
 * result is served from a different root. A root-absolute /assets/… path is
 * only correct there if the build actually carries the file, so this is checked
 * against the composed output rather than argued from the copy line.
 *
 * Three things, in order, because each is a different way to fail:
 *
 *   1  the builder copies assets/ UNFILTERED. A future allowlist there would
 *      drop the token file silently, and steps 2 and 3 would still pass off a
 *      stale tree, so the source line is asserted too.
 *   2  the file is present in the composed tree and byte-identical to source.
 *      Not "present": a truncated or stale copy is present.
 *   3  the tokens RESOLVE at /assets/mbm-tokens.css in that tree's URL space,
 *      read back through getComputedStyle in a real browser. A 200 with the
 *      right bytes still would not prove the path a page would use resolves.
 *
 * Step 3 injects the <link> rather than expecting one: T3 landed the file
 * inert and the Play shelf does not reference it yet. What is being proved is
 * that the path is good for the part that adopts it, not that adoption has
 * happened.
 *
 *   node tools/sw2/check_play_tokens.cjs --origin http://127.0.0.1:PORT
 *
 * where PORT serves domain-split/output/games/. --expect-missing inverts the
 * verdict, which is how this gate is red-proved against a tree with the file
 * removed.
 */
const { createRequire } = require('module');
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright')('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const TREE = path.join(ROOT, 'domain-split', 'output', 'games');
const REL = path.join('assets', 'mbm-tokens.css');
const BUILDER = path.join(ROOT, 'domain-split', 'build_publications.py');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  const origin = arg('--origin', 'http://127.0.0.1:4912').replace(/\/$/, '');
  const expectMissing = process.argv.includes('--expect-missing');
  const problems = [];

  // 1 — the builder still copies the whole directory.
  const builder = fs.readFileSync(BUILDER, 'utf8');
  const unfiltered = /for directory in \['assets', 'images'\]:\s*\n\s*shutil\.copytree\(ROOT \/ directory, games \/ directory, dirs_exist_ok=True\)/.test(builder);
  console.log(`  builder copies assets/ unfiltered: ${unfiltered}`);
  if (!unfiltered) {
    problems.push('build_publications.py no longer copies assets/ with an unfiltered copytree — '
      + 'if a filter was added, assets/mbm-tokens.css must be named in it');
  }

  // 2 — present in the composed tree, and the same bytes.
  const src = fs.readFileSync(path.join(ROOT, REL));
  const built = fs.existsSync(path.join(TREE, REL)) ? fs.readFileSync(path.join(TREE, REL)) : null;
  console.log(`  source  ${src.length} bytes  ${sha(src).slice(0, 16)}`);
  console.log(`  in tree ${built ? built.length + ' bytes  ' + sha(built).slice(0, 16) : 'ABSENT'}`);
  if (!built) problems.push(`${REL} is absent from the composed tree — rebuild, then re-run`);
  else if (sha(built) !== sha(src)) problems.push(`${REL} in the composed tree differs from source (stale build)`);

  // 3 — the path resolves, and the values come back, in a browser.
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const response = await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
  if (!response || response.status() >= 400) {
    problems.push(`the composed tree is not being served at ${origin}`);
  } else {
    const names = [...src.toString().matchAll(/(--mbm-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    const wanted = [...new Set(names)].sort();
    const got = await page.evaluate(async ([href, tokens]) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      const loaded = new Promise((res) => { link.onload = () => res('load'); link.onerror = () => res('error'); });
      document.head.appendChild(link);
      const how = await loaded;
      const cs = getComputedStyle(document.documentElement);
      const out = {};
      for (const t of tokens) out[t] = cs.getPropertyValue(t).trim();
      return { how, out };
    }, ['/assets/mbm-tokens.css', wanted]);

    const empty = wanted.filter((t) => !got.out[t]);
    console.log(`  <link href="/assets/mbm-tokens.css"> in the play tree: ${got.how}`);
    console.log(`  tokens resolving there: ${wanted.length - empty.length}/${wanted.length}`);
    if (got.how !== 'load') problems.push('the stylesheet did not load at /assets/mbm-tokens.css in the play tree');
    if (empty.length) problems.push(`${empty.length} token(s) resolved empty in the play tree: ${empty.slice(0, 6).join(', ')}`);
  }
  await browser.close();

  if (expectMissing) {
    if (problems.length) {
      console.log(`\n--expect-missing: the gate reported ${problems.length} problem(s), as required`);
      for (const p of problems) console.log('  ' + p);
      return;
    }
    console.error('\n--expect-missing: the gate passed against a tree it should have failed on');
    process.exit(1);
  }

  if (problems.length) {
    console.error(`\nPROBLEMS: ${problems.length}`);
    for (const p of problems) console.error('  ' + p);
    process.exit(1);
  }
  console.log('\nassets/mbm-tokens.css is carried into the Play tree and resolves there root-absolute');
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(2); });
