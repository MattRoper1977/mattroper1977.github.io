#!/usr/bin/env node
'use strict';

/*
 * Static verifier for mbm-site-professional-design-upgrade-2026-08-07.
 * Zero dependencies. It validates the shared platform contract, preservation
 * rules, accessibility floor and a positive-control mutation.
 *
 * Account/member/privacy copy is an explicitly authorised functional exception
 * under mbm-accounts-members-mailing-2026-08-08. Those pages still retain all
 * platform, logo, navigation, no-fake-auth and accessibility checks; only the
 * old byte-for-byte authored-copy comparison is relaxed for those two surfaces.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SENTINEL = 'mbm-site-professional-design-upgrade-2026-08-07';
const ACCOUNT_SENTINEL = 'mbm-accounts-members-mailing-2026-08-08';
const FUNCTIONAL_COPY_PAGES = new Set(['members/index.html', 'privacy/index.html']);
const KEY_PAGES = [
  'index.html',
  'games/index.html',
  'tools/index.html',
  'resources/index.html',
  'members/index.html',
  'privacy/index.html',
  'stats/index.html'
];
const PRIMARY_LINKS = ['/games/', '/Lessons/', '/Matt-s-Apps-/', '/tools/', '/resources/'];
const MORE_LINKS = ['/stats/', '/members/', '/#about', '/privacy/'];
const EXTERNAL_MOUNTS = new Set(['/Lessons/', '/Matt-s-Apps-/', '/Games/']);

function parseArgs(argv) {
  const out = { base: 'origin/main', selfTest: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') out.base = argv[++i];
    else if (argv[i] === '--self-test') out.selfTest = true;
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node tools/verify_professional_site.js [--base <git-ref>] [--self-test]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!out.base) throw new Error('--base requires a git ref');
  return out;
}

function relRead(rel, overrides) {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, rel)) return overrides[rel];
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function assert(condition, message, failures) { if (!condition) failures.push(message); }
function duplicateIds(html) {
  const seen = new Map();
  const re = /\bid\s*=\s*(["'])(.*?)\1/gi;
  let m;
  while ((m = re.exec(html))) seen.set(m[2], (seen.get(m[2]) || 0) + 1);
  return [...seen.entries()].filter(([, count]) => count > 1).map(([id, count]) => `${id} (${count})`);
}
function decodeEntities(text) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·', times: '×',
    copy: '©', reg: '®', trade: '™', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘',
    rdquo: '”', ldquo: '“', pound: '£'
  };
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (all, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x';
      const n = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return Object.prototype.hasOwnProperty.call(named, entity.toLowerCase()) ? named[entity.toLowerCase()] : all;
  });
}
function brandVisual(html) {
  const match = html.match(/<a\b[^>]*\bclass=["'][^"']*\bbrand\b[^"']*["'][^>]*>([\s\S]*?)<span\b/i);
  if (!match) return '';
  return match[1].replace(/\s+/g, ' ').trim();
}
function visibleAuthoredText(html) {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<head\b[\s\S]*?<\/head>/gi, ' ');
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
  s = s.replace(/<header\b[\s\S]*?<\/header>/gi, ' ');
  s = s.replace(/<section\b[^>]*\bid\s*=\s*["']audiences["'][^>]*>[\s\S]*?<\/section>/gi, ' ');
  s = s.replace(/<div\b[^>]*\bid\s*=\s*["']mbmAuth["'][^>]*>[\s\S]*?(?=<\/body>)/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}
function gitShow(ref, rel) {
  return cp.execFileSync('git', ['show', `${ref}:${rel}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function gitChanged(base, rel) {
  return cp.execFileSync('git', ['diff', '--name-only', base, '--', rel], { cwd: ROOT, encoding: 'utf8' }).trim();
}
function localRouteExists(href) {
  if (!href.startsWith('/')) return true;
  const u = new URL(href, 'https://madebymatt.uk/');
  for (const mount of EXTERNAL_MOUNTS) if (u.pathname === mount || u.pathname.startsWith(mount)) return true;
  if (u.pathname === '/') return fs.existsSync(path.join(ROOT, 'index.html'));
  const clean = u.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const direct = path.join(ROOT, clean);
  return fs.existsSync(direct) || fs.existsSync(`${direct}.html`) || fs.existsSync(path.join(direct, 'index.html'));
}

function verify(base, overrides = null) {
  const failures = [];
  const css = relRead('assets/mbm-platform.css', overrides);
  const js = relRead('assets/mbm-platform.js', overrides);
  const home = relRead('index.html', overrides);

  assert(css.includes(SENTINEL), 'shared CSS sentinel missing', failures);
  assert(js.includes(SENTINEL), 'shared JavaScript sentinel missing', failures);
  assert(fs.existsSync(path.join(ROOT, 'assets/mbm-platform.css')), 'assets/mbm-platform.css missing', failures);
  assert(fs.existsSync(path.join(ROOT, 'assets/mbm-platform.js')), 'assets/mbm-platform.js missing', failures);

  for (const rel of KEY_PAGES) {
    const html = relRead(rel, overrides);
    assert(/href=["']\/assets\/mbm-platform\.css["']/i.test(html), `${rel}: shared CSS not loaded`, failures);
    assert(/src=["']\/assets\/mbm-platform\.js["']/i.test(html), `${rel}: shared JavaScript not loaded`, failures);
    assert(/<header\b[^>]*\bmbm-site-header\b/i.test(html), `${rel}: shared header class missing`, failures);
    assert(/<button\b[^>]*\bclass=["'][^"']*\bmenu\b/i.test(html), `${rel}: mobile Menu control missing`, failures);
    assert(/<nav\b[^>]*\baria-label=["']Site navigation["']/i.test(html), `${rel}: named site navigation missing`, failures);
    assert(/<details\b[^>]*\bmbm-nav-more\b/i.test(html), `${rel}: More disclosure missing`, failures);
    for (const href of [...PRIMARY_LINKS, ...MORE_LINKS]) {
      assert(html.includes(`href="${href}"`) || html.includes(`href='${href}'`), `${rel}: navigation link ${href} missing`, failures);
    }
    const dupes = duplicateIds(html);
    assert(dupes.length === 0, `${rel}: duplicate IDs: ${dupes.join(', ')}`, failures);
  }

  assert(/<section\b[^>]*\bid=["']audiences["']/i.test(home), 'homepage audience pathway section missing', failures);
  for (const label of ['Teachers', 'Pupils &amp; learners', 'Schools &amp; organisations', 'Partners']) assert(home.includes(label), `homepage audience label missing: ${label}`, failures);
  for (const href of ['/tools/', '/Lessons/', '/resources/', '/games/', '/stats/', '/privacy/', '/#about', '/#contact', '/#collections']) {
    assert(home.includes(`href="${href}"`) || home.includes(`href='${href}'`), `homepage audience route missing: ${href}`, failures);
    assert(localRouteExists(href), `homepage audience route has no proven destination: ${href}`, failures);
  }

  for (const rel of KEY_PAGES) {
    const html = relRead(rel, overrides);
    assert(!/\bid=["']mbmAccountBtn["']/i.test(html), `${rel}: fake account trigger remains`, failures);
    assert(!/\bid=["']mbmAuth["']/i.test(html), `${rel}: fake authentication dialog remains`, failures);
    assert(!/<input\b[^>]*\btype\s*=\s*["']password["']/i.test(html), `${rel}: password input remains`, failures);
  }

  assert(/min-height:44px/.test(css), 'shared CSS lacks 44px minimum target rule', failures);
  assert(/width:44px;height:44px;flex:0 0 44px/.test(css), 'theme swatches are not 44×44px', failures);
  assert(/@media\s*\(max-width:900px\)/.test(css), 'mobile navigation breakpoint missing', failures);
  assert(/@media\s*\(max-width:350px\)/.test(css), '320px-class safeguard missing', failures);
  assert(/@media\s*\(prefers-reduced-motion:reduce\)/.test(css), 'reduced-motion CSS support missing', failures);
  assert(/focus-visible/.test(css), 'shared focus-visible treatment missing', failures);
  assert(/body\.mbm-nav-open\{overflow:hidden\}/.test(css), 'mobile drawer scroll lock missing', failures);

  assert(/e\.key==='Escape'/.test(js), 'Escape-key menu handling missing', failures);
  assert(/pointerdown/.test(js), 'outside-pointer dismissal missing', failures);
  assert(/prefers-reduced-motion: reduce/.test(js), 'JavaScript reduced-motion support missing', failures);
  assert(/if\(!nav\)return/.test(js), 'optional navigation guard missing', failures);
  assert(/if\(window\.__mbmPlatform\)return/.test(js), 'duplicate-initialisation guard missing', failures);
  assert(/IntersectionObserver/.test(js), 'progressive scroll reveal missing', failures);
  assert(/scrollBy\(\{left:/.test(js), 'keyboard shelf scrolling missing', failures);

  try {
    const brandChanges = gitChanged(base, 'assets/brand');
    assert(!brandChanges, `immutable brand assets changed: ${brandChanges.replace(/\n/g, ', ')}`, failures);
  } catch (error) { failures.push(`could not compare immutable brand assets with ${base}: ${error.message}`); }

  for (const rel of KEY_PAGES) {
    try {
      const baseline = gitShow(base, rel);
      const current = relRead(rel, overrides);
      const beforeLogo = brandVisual(baseline);
      const afterLogo = brandVisual(current);
      assert(beforeLogo && beforeLogo === afterLogo, `${rel}: Made by Matt logo markup changed`, failures);
      if (FUNCTIONAL_COPY_PAGES.has(rel)) {
        assert(current.includes(ACCOUNT_SENTINEL), `${rel}: authorised account/privacy copy changed without account sentinel`, failures);
      } else {
        const before = visibleAuthoredText(baseline);
        const after = visibleAuthoredText(current);
        assert(before === after, `${rel}: authored body wording changed outside permitted chrome/audience/auth regions`, failures);
      }
    } catch (error) { failures.push(`${rel}: could not compare authored wording with ${base}: ${error.message}`); }
  }

  return failures;
}
function printFailures(failures) { for (const failure of failures) console.error(`  - ${failure}`); }
function main() {
  const args = parseArgs(process.argv.slice(2));
  const first = verify(args.base);
  if (first.length) {
    console.error(`[FAIL] professional site verifier (${first.length} issue${first.length === 1 ? '' : 's'})`);
    printFailures(first); process.exit(1);
  }
  console.log(`[PASS] current implementation: ${KEY_PAGES.length} key pages, shared platform, preservation and route contracts`);
  if (args.selfTest) {
    const home = relRead('index.html');
    const mutation = home.replace('id="audiences"', 'id="audiences-broken"');
    if (mutation === home) { console.error('[FAIL] positive-control fixture could not be created'); process.exit(1); }
    const controlled = verify(args.base, { 'index.html': mutation });
    if (!controlled.length) { console.error('[FAIL] positive-control mutation was not detected'); process.exit(1); }
    console.log(`[PASS] positive control: deliberately broken audience fixture rejected (${controlled.length} detected issue${controlled.length === 1 ? '' : 's'})`);
    const restored = verify(args.base);
    if (restored.length) { console.error('[FAIL] restored implementation did not pass'); printFailures(restored); process.exit(1); }
    console.log('[PASS] restored implementation after positive control');
  }
}
try { main(); } catch (error) { console.error(`[FAIL] ${error.stack || error.message}`); process.exit(1); }
