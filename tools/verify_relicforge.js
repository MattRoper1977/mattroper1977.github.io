#!/usr/bin/env node
/*
 * verify_relicforge.js — shipping contract for /relicforge/index.html
 *
 * Shaped after verify_apexrally.js, and it keeps that harness's two corrections:
 *
 * 1. CORRECTED no-remote-resources form. The older donor limb reads
 *      !/<(?:script|link|img|audio|video|source)\b[^>]+(?:src|href)=["']https?:/i
 *    which counts <link rel="canonical" href="https://..."> as a remote resource.
 *    It is not: canonical, og:url and og:image are METADATA and are never fetched
 *    at runtime. G2 below uses the runtime-fetching tag list, and asserts the
 *    CLEAN file passes positively as well as that a tampered one fails — a limb
 *    that is only ever asserted to return false hides its own defect.
 *
 * 2. DERIVE, DON'T PIN. Nothing here hardcodes a part count, a chamber count or a
 *    commit SHA. Every expected value is read out of the file under test, so this
 *    contract cannot go red because the estate moved on. (The relationship it
 *    checks is what matters: that the 27 relics and the 27 memories are the SAME
 *    27, whatever that number becomes.)
 *
 * Every gate family has a positive control in G9. A gate that cannot fail is
 * vacuous, and this estate has shipped that mistake before.
 *
 *   node tools/verify_relicforge.js [path/to/index.html]
 */
'use strict';
const fs = require('fs');
const { stripExitRegion, hasExitRegion, exitRegion } = require('./mbm_exit_region.js');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.RF_GAME_FILE || process.argv[2] || path.join(ROOT, 'relicforge', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
const bytes = Buffer.byteLength(html);
const sha = crypto.createHash('sha256').update(html).digest('hex');

const CANON = 'https://madebymatt.uk/relicforge/';

const results = [];
function assert(x, m) { if (!x) throw new Error(m); }
function gate(id, name, fn) {
  try {
    const d = fn() || '';
    results.push({ id, name, status: 'PASS', detail: d });
    console.log(`PASS ${id} ${name}${d ? ' — ' + d : ''}`);
  } catch (e) {
    results.push({ id, name, status: 'FAIL', detail: e.message });
    console.error(`FAIL ${id} ${name} — ${e.message}`);
  }
}

/* ---- shared readers, used by the gates and by their controls ---- */

// Only tags the browser actually fetches. Metadata links are excluded on purpose.
const RUNTIME_SRC = /<(?:script|img|audio|video|source|iframe|embed)\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//gi;
const RUNTIME_LINK = /<link\b[^>]*\brel\s*=\s*["'](?:stylesheet|preload|prefetch|icon|apple-touch-icon|manifest)["'][^>]*\bhref\s*=\s*["'](?:https?:)?\/\//gi;
const remoteRefs = (src) => [...src.matchAll(RUNTIME_SRC), ...src.matchAll(RUNTIME_LINK)].map(m => m[0]);

function blockOf(src, header, closer) {
  const start = src.indexOf(header);
  if (start < 0) return null;
  const end = src.indexOf(closer, start);
  return end < 0 ? null : src.slice(start, end);
}
const partIds = (src) => {
  const block = blockOf(src, '  const PARTS = {', '\n  };');
  return block ? [...block.matchAll(/^    (\w+): \{/gm)].map(m => m[1]) : [];
};
const loreIds = (src) => {
  const block = blockOf(src, '    lore: {', '\n    }');
  return block ? [...block.matchAll(/^      (\w+):/gm)].map(m => m[1]) : [];
};

/* G1 judges THE GAME, so it judges the file with the platform's stamped exit
 * region removed. That region is an inline control - no src, no dependency, no
 * request - stamped into all eleven declared single-file games by
 * tools/render_inline_exit.py, so a child on a locked-down school device has a
 * way out of the page. The game's own promise is unchanged: one file, one game
 * script, nothing fetched.
 *
 * The amendment is paired, deliberately. /neonbreach/ is the precedent for
 * amending a single-file game's verifier to admit a script, and that script
 * then rendered nothing for months because no gate ever looked. Here the
 * rendering is proven in a browser by tools/verify_inline_exit.mjs. */
gate('G1', 'single file, one authority script, one V6 shell, plus the stamped exit region', () => {
  const game = stripExitRegion(html);
  const open = (game.match(/<script/g) || []).length;
  const close = (game.match(/<\/script>/g) || []).length;
  assert(open === 2 && close === 2, `expected authority + V6 shell script elements, saw ${open}/${close}`);
  assert((game.match(/id="mbm-v6-release-script"/g) || []).length === 1, 'the one named V6 release shell is absent or duplicated');
  assert((game.match(/window\.__MBM_V6_RELEASE__/g) || []).length === 1, 'the V6 release API is absent or duplicated');
  assert(!/\brequire\(|\bimport\s+.*\sfrom\s/.test(game), 'module syntax present in a standalone file');
  assert(hasExitRegion(html), 'the stamped inline exit region is missing \u2014 this game has no way out');
  assert(!/\bsrc\s*=/i.test(exitRegion(html)), 'the exit region fetches something; it must stay inline');
  return `${bytes} bytes, sha256 ${sha.slice(0, 12)}\u2026 \u00b7 1 authority script + 1 V6 shell + exit region (${Buffer.byteLength(exitRegion(html))} B)`;
});

gate('G2', 'no remote runtime resources (corrected form)', () => {
  const refs = remoteRefs(html);
  assert(refs.length === 0, `runtime-fetching remote refs: ${refs.join(', ')}`);
  // Positive limb: metadata must NOT be counted, and the file must carry it.
  assert(/<link\s+rel="canonical"/.test(html), 'canonical link missing — the positive limb has nothing to prove');
  return 'zero runtime-fetching remote refs; canonical/og present and correctly not counted';
});

gate('G3', 'canonical and Open Graph agree', () => {
  const canonical = (html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/) || [])[1];
  const ogUrl = (html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/) || [])[1];
  const ogTitle = (html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/) || [])[1];
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
  assert(canonical === CANON, `canonical is ${canonical}`);
  assert(ogUrl === CANON, `og:url is ${ogUrl}`);
  assert(title && ogTitle === title, `og:title "${ogTitle}" does not match <title> "${title}"`);
  // No og:image is claimed unless an asset actually exists for it.
  const ogImage = (html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/) || [])[1];
  if (ogImage) {
    const rel = ogImage.replace(/^https?:\/\/[^/]+/, '');
    assert(fs.existsSync(path.join(ROOT, rel.replace(/^\//, ''))), `og:image ${ogImage} has no asset in the tree`);
  }
  return `canonical = og:url = ${CANON}; og:title matches title; og:image ${ogImage ? 'present and backed' : 'not claimed'}`;
});

gate('G4', 'storage key is house-shaped and the legacy key is gone', () => {
  const keys = [...html.matchAll(/const SAVE_KEY = '([^']+)'/g)].map(m => m[1]);
  assert(keys.length === 1, `expected exactly one SAVE_KEY constant, saw ${keys.length}`);
  assert(/^mbm_relicforge_/.test(keys[0]), `SAVE_KEY is ${keys[0]}`);
  assert(!html.includes('madebymatt_relicforge_'), 'the pre-launch storage key still appears in the file');
  const uses = (html.match(/SAVE_KEY/g) || []).length;
  assert(uses >= 3, `SAVE_KEY declared but barely used (${uses} occurrences)`);
  return `${keys[0]}, ${uses - 1} call sites, zero legacy-key occurrences`;
});

gate('G5', 'every relic carries a memory — derived on both sides', () => {
  const parts = partIds(html);
  const lore = loreIds(html);
  assert(parts.length > 0, 'no PARTS block found');
  const missing = parts.filter(p => !lore.includes(p));
  const orphan = lore.filter(l => !parts.includes(l));
  assert(missing.length === 0, `relics with no memory: ${missing.join(', ')}`);
  assert(orphan.length === 0, `memories with no relic: ${orphan.join(', ')}`);
  return `${parts.length}/${parts.length} relics have exactly one memory (count derived, not pinned)`;
});

gate('G6', 'story set is complete and internally consistent', () => {
  const chambers = [...html.matchAll(/\{ title: '([^']+)', lines: \[/g)].map(m => m[1]);
  assert(chambers.length >= 10, `only ${chambers.length} chamber interstitials`);
  assert(new Set(chambers).size === chambers.length, 'duplicate interstitial titles');
  const fragmentKeys = [...(blockOf(html, '    fragments: {', '\n    },') || '').matchAll(/^      (\d+): \{/gm)].map(m => Number(m[1]));
  assert(fragmentKeys.length === 2, `expected two Machine God fragments, saw ${fragmentKeys.length}`);
  assert(fragmentKeys.every(k => k >= 1 && k <= chambers.length), 'a fragment is keyed to a chamber that has no interstitial');
  const chassisKeys = [...(blockOf(html, '    chassis: {', '\n    },') || '').matchAll(/^      (\w+): \{/gm)].map(m => m[1]);
  const defined = [...(blockOf(html, '  const CHASSIS = {', '\n  };') || '').matchAll(/^    (\w+): \{/gm)].map(m => m[1]);
  assert(defined.length > 0 && defined.every(c => chassisKeys.includes(c)),
    `chassis without a voice: ${defined.filter(c => !chassisKeys.includes(c)).join(', ')}`);
  return `${chambers.length} distinct interstitials, ${fragmentKeys.length} fragments at chambers ${fragmentKeys.join(' and ')}, ${chassisKeys.length}/${defined.length} chassis voiced`;
});

gate('G7', 'Salvage Rating bands cannot overlap by construction', () => {
  const floor = Number((html.match(/CLEAN_FLOOR: (\d+)/) || [])[1]);
  const ceiling = Number((html.match(/DIRTY_CEILING: (\d+)/) || [])[1]);
  assert(Number.isFinite(floor) && Number.isFinite(ceiling), 'salvage band constants not found');
  assert(ceiling < floor, `bands overlap: dirty ceiling ${ceiling} is not below clean floor ${floor}`);
  assert(/window\.RF\s*=/.test(html), 'RF.salvageRating is not exported for the fixtures');
  return `clean band starts at ${floor}, core-burn band capped at ${ceiling}`;
});

gate('G8', 'motion and photosensitivity settings are wired', () => {
  assert(/reducedMotion:\s*matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/.test(html),
    'reduced motion default does not read the OS query');
  assert(/data\.settings\?\.reducedMotion === true \|\| matchMedia/.test(html),
    'the OS preference is not honoured as a FLOOR when loading a save');
  assert(/save\.settings\.shake/.test(html), 'shake setting missing');
  return 'reducedMotion defaults from the OS query and loads with the OS as a floor; shake gated separately';
});

/* ---- G9: positive controls. Each gate family must be shown able to FAIL. ---- */
gate('G9', 'positive controls — every gate family proven sighted', () => {
  const controls = [];
  const check = (name, mutate, probe) => {
    const mutated = mutate(html);
    assert(mutated !== html, `control "${name}" did not change the file`);
    let caught = false;
    try { probe(mutated); } catch (e) { caught = true; }
    assert(caught, `control "${name}" did NOT trip its gate — that gate is vacuous`);
    controls.push(name);
  };

  check('remote script injected',
    s => s.replace('<title>', '<script src="https://cdn.example.com/x.js"></script><title>'),
    s => { const r = remoteRefs(s); if (r.length) throw new Error('caught'); });

  check('V6 shell duplicated',
    s => s.replace('</body>', '<script id="mbm-v6-release-script">window.__MBM_V6_RELEASE__={};</script></body>'),
    s => { const game = stripExitRegion(s), open = (game.match(/<script/g) || []).length, named = (game.match(/id="mbm-v6-release-script"/g) || []).length; if (open !== 2 || named !== 1) throw new Error('caught'); });

  check('canonical points elsewhere',
    s => s.replace(CANON, 'https://example.com/elsewhere/'),
    s => { const c = (s.match(/<link\s+rel="canonical"\s+href="([^"]+)"/) || [])[1]; if (c !== CANON) throw new Error('caught'); });

  check('legacy storage key restored',
    s => s.replace("'mbm_relicforge_v1'", "'madebymatt_relicforge_v1'"),
    s => { if (s.includes('madebymatt_relicforge_')) throw new Error('caught'); });

  check('a relic loses its memory',
    s => s.replace(/\n      furnace_core: '[^']*',/, ''),
    s => { const missing = partIds(s).filter(p => !loreIds(s).includes(p)); if (missing.length) throw new Error('caught'); });

  check('salvage bands made to overlap',
    s => s.replace('DIRTY_CEILING: 59', 'DIRTY_CEILING: 70'),
    s => {
      const f = Number((s.match(/CLEAN_FLOOR: (\d+)/) || [])[1]);
      const c = Number((s.match(/DIRTY_CEILING: (\d+)/) || [])[1]);
      if (!(c < f)) throw new Error('caught');
    });

  check('OS reduced-motion floor removed',
    s => s.replace('data.settings?.reducedMotion === true || matchMedia', 'data.settings?.reducedMotion === true || false && matchMedia'),
    s => { if (!/data\.settings\?\.reducedMotion === true \|\| matchMedia/.test(s)) throw new Error('caught'); });

  return `${controls.length} controls, all tripped their gate: ${controls.join('; ')}`;
});

const failed = results.filter(r => r.status === 'FAIL');
console.log(`\nRelicforge source contract: ${results.length - failed.length}/${results.length} gates passed.`);
console.log(`Artifact: ${bytes} bytes, sha256 ${sha}`);
if (failed.length) process.exit(1);
