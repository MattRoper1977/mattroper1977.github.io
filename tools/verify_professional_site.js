#!/usr/bin/env node
'use strict';

/*
 * Static verifier for mbm-site-professional-design-upgrade-2026-08-07.
 * Zero dependencies. It validates the shared platform contract, preservation
 * rules, accessibility floor and mutation-based positive controls.
 *
 * Account/member/privacy copy is an explicitly authorised functional exception
 * under mbm-accounts-members-mailing-2026-08-08. Those pages still retain all
 * platform, logo, navigation, no-fake-auth and accessibility checks. Homepage
 * account/mailing truth is normalised only inside four named structural regions;
 * all unrelated authored homepage wording remains preservation-protected.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SENTINEL = 'mbm-site-professional-design-upgrade-2026-08-07';
const ACCOUNT_SENTINEL = 'mbm-accounts-members-mailing-2026-08-08';
const COUNTER_SENTINEL = 'mbm-counter-local-fallback-2026-08-09';
const FUNCTIONAL_COPY_PAGES = new Set(['members/index.html', 'privacy/index.html']);
const CHOOSER_PAGE = 'index.html';
const KEY_PAGES = [
  'main/index.html',
  'games/index.html',
  'tools/index.html',
  'resources/index.html',
  'members/index.html',
  'privacy/index.html',
  'stats/index.html'
];
const PRIMARY_LINKS = ['/games/', '/Lessons/', '/Matt-s-Apps-/', '/tools/', '/resources/'];
const MORE_LINKS = ['/main/', '/', '/stats/', '/members/', '/main/#about', '/privacy/'];
const EXTERNAL_MOUNTS = new Set(['/Lessons/', '/Matt-s-Apps-/', '/Games/']);

/*
 * These are the only homepage regions whose authored wording may change for
 * the production account/mailing truth correction. They are deliberately
 * identified by existing, narrow structure: one named band lead, two specific
 * promise tiles, and the dedicated Teacher updates component. The replacement
 * leaves surrounding authored copy in the preservation comparison.
 */
const HOME_TRUTH_REGIONS = Object.freeze([
  {
    name: 'follow-work-account-mailing-lede',
    pattern: /(<article\b[^>]*>\s*<h2\b[^>]*>Follow the work<\/h2>\s*)<p\b(?=[^>]*\bclass=["'][^"']*\bdx-bandlead\b[^"']*["'])[^>]*>[\s\S]*?<\/p>/i,
    replacement: '$1<p class="dx-bandlead">__MBM_AUTHORISED_FOLLOW_TRUTH__</p>'
  },
  {
    name: 'public-access-promise-tile',
    pattern: /<div\b(?=[^>]*\bclass=["'][^"']*\bdx-tile\b[^"']*["'])[^>]*>\s*<svg\b[\s\S]*?<use\b[^>]*\bhref=["']#dxi-free["'][^>]*\/?>(?:<\/use>)?[\s\S]*?<\/svg>\s*<b>Free<\/b>\s*<p\b[^>]*>[\s\S]*?<\/p>\s*<\/div>/i,
    replacement: '<div class="dx-tile">__MBM_AUTHORISED_PUBLIC_ACCESS_TRUTH__</div>'
  },
  {
    name: 'classroom-data-privacy-promise-tile',
    pattern: /<div\b(?=[^>]*\bclass=["'][^"']*\bdx-tile\b[^"']*["'])[^>]*>\s*<svg\b[\s\S]*?<use\b[^>]*\bhref=["']#dxi-shield["'][^>]*\/?>(?:<\/use>)?[\s\S]*?<\/svg>\s*<b>Nothing uploaded<\/b>\s*<p\b[^>]*>[\s\S]*?<\/p>\s*<\/div>/i,
    replacement: '<div class="dx-tile">__MBM_AUTHORISED_DATA_PRIVACY_TRUTH__</div>'
  },
  {
    name: 'teacher-updates-component',
    pattern: /<!--\s*TEACHER UPDATES[\s\S]*?<div\b(?=[^>]*\bclass=["'][^"']*\bdx-teach\b[^"']*["'])[^>]*>\s*<h3>Teacher updates<\/h3>[\s\S]*?<\/div>\s*(?=<div\b[^>]*\bclass=["'][^"']*\bdx-about\b[^"']*["'][^>]*\bid=["']about["'])/i,
    replacement: '__MBM_AUTHORISED_TEACHER_UPDATES__\n\n'
  },
  {
    name: 'device-local-counter-panel',
    pattern: /<section\b(?=[^>]*\bid\s*=\s*["']mbmStats["'])[^>]*>[\s\S]*?<\/section>/i,
    replacement: '__MBM_AUTHORISED_LOCAL_COUNTER_PANEL__'
  }
]);

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
function matchCount(source, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...source.matchAll(new RegExp(pattern.source, flags))].length;
}
function captureExactly(source, region, failures, label) {
  const count = matchCount(source, region.pattern);
  assert(count === 1, `${label}: authorised homepage region ${region.name} matched ${count} times (expected 1)`, failures);
  return count === 1 ? source.match(region.pattern)[0] : '';
}
function canonicalHomeTruthCopy(html, failures, label) {
  let s = html;
  for (const region of HOME_TRUTH_REGIONS) {
    const count = matchCount(s, region.pattern);
    assert(count === 1, `${label}: authorised homepage region ${region.name} matched ${count} times (expected 1)`, failures);
    if (count === 1) s = s.replace(region.pattern, region.replacement);
  }
  return s;
}
function verifyHomeTruthContracts(home, failures) {
  const regions = new Map();
  for (const region of HOME_TRUTH_REGIONS) regions.set(region.name, captureExactly(home, region, failures, 'main/index.html'));

  const follow = regions.get('follow-work-account-mailing-lede') || '';
  const free = regions.get('public-access-promise-tile') || '';
  const privacy = regions.get('classroom-data-privacy-promise-tile') || '';
  const teacher = regions.get('teacher-updates-component') || '';

  assert(/Accounts are optional/i.test(follow), 'homepage follow-work copy must state that accounts are optional', failures);
  assert(/adults? and teachers?/i.test(follow), 'homepage follow-work copy must position accounts for adults/teachers', failures);
  assert(/separate double-opt-in mailing list/i.test(follow), 'homepage follow-work copy must distinguish the double-opt-in mailing list', failures);

  assert(/Everything here is free to use/i.test(free), 'homepage Free promise must retain free public access', failures);
  assert(/account is optional/i.test(free), 'homepage Free promise must keep account registration optional', failures);
  assert(/between devices/i.test(free), 'homepage Free promise must describe the narrow cross-device benefit', failures);

  assert(/Lessons, registers and pupil records stay in your browser/i.test(privacy), 'homepage privacy promise must keep pupil/classroom records local', failures);
  assert(/not uploaded into your account/i.test(privacy), 'homepage privacy promise must distinguish local classroom data from account data', failures);
  assert(/account identity and saved hub shortcuts/i.test(privacy), 'homepage privacy promise must identify narrow account-backed network data', failures);
  assert(/separate teacher mailing list/i.test(privacy), 'homepage privacy promise must identify the separate mailing service', failures);
  assert(/href=["']\/privacy\/["']/i.test(privacy), 'homepage privacy promise must retain the detailed privacy route', failures);

  assert(/href=["']\/mailing-list\/["']/i.test(teacher), 'Teacher updates must link to /mailing-list/', failures);
  assert(/href=["']\/account\/["']/i.test(teacher), 'Teacher updates must retain the optional /account/ route', failures);
  assert(/separate from an account/i.test(teacher), 'Teacher updates must state mailing consent is separate from account creation', failures);
  assert(/Creating an account never subscribes you/i.test(teacher), 'Teacher updates must state account creation does not subscribe', failures);
  assert(/double opt-in/i.test(teacher), 'Teacher updates must state double opt-in', failures);
  assert(/unsubscribe at any time/i.test(teacher), 'Teacher updates must state unsubscribe availability', failures);
  assert(/Under 18/i.test(teacher), 'Teacher updates must retain the adult-only audience boundary', failures);
  assert(/Everything public on the site stays free without either/i.test(teacher), 'Teacher updates must keep public content ungated', failures);
  assert(!/<form\b/i.test(teacher), 'Teacher updates must not contain a competing signup form', failures);
  assert(!/formsubmit\.co/i.test(teacher), 'Teacher updates must not route mailing consent through FormSubmit', failures);

  assert(!/There is no account and no mailing list/i.test(home), 'obsolete no-account/no-mailing statement remains', failures);
  assert(!/There is no account, so there is nothing to forget the password to/i.test(home), 'obsolete no-account Free promise remains', failures);
  assert(!/Accounts never leave your own device/i.test(home), 'obsolete device-only account claim remains', failures);
  assert(!/class=["'][^"']*\bdx-tform\b/i.test(home), 'obsolete FormSubmit Teacher updates form remains', failures);

  const counterPanel = captureExactly(home, HOME_TRUTH_REGIONS.find(region => region.name === 'device-local-counter-panel'), failures, 'main/index.html');
  assert(/Private · on this device/i.test(counterPanel), 'homepage counter panel must identify device-local activity', failures);
  assert(/Visits on this device/i.test(counterPanel), 'homepage counter panel must label device-local visits', failures);
  assert(/No counter request/i.test(counterPanel), 'homepage counter panel must state that no remote counter request is sent', failures);
  assert(!/counterapi\.dev/i.test(counterPanel), 'homepage counter panel still names the retired CounterAPI service', failures);
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
  const home = relRead('main/index.html', overrides);
  const chooser = relRead(CHOOSER_PAGE, overrides);

  assert(css.includes(SENTINEL), 'shared CSS sentinel missing', failures);
  assert(js.includes(SENTINEL), 'shared JavaScript sentinel missing', failures);
  assert(fs.existsSync(path.join(ROOT, 'assets/mbm-platform.css')), 'assets/mbm-platform.css missing', failures);
  assert(fs.existsSync(path.join(ROOT, 'assets/mbm-platform.js')), 'assets/mbm-platform.js missing', failures);

  assert(/href=["']\/assets\/mbm-platform\.css["']/i.test(chooser), `${CHOOSER_PAGE}: shared CSS not loaded`, failures);
  assert(/src=["']\/assets\/mbm-platform\.js["']/i.test(chooser), `${CHOOSER_PAGE}: shared JavaScript not loaded`, failures);
  assert(/<header\b[^>]*\bmbm-site-header\b/i.test(chooser), `${CHOOSER_PAGE}: shared header class missing`, failures);
  assert(/<button\b[^>]*\bclass=["'][^"']*\bmenu\b/i.test(chooser), `${CHOOSER_PAGE}: mobile Menu control missing`, failures);
  assert(/<nav\b[^>]*\baria-label=["']Site navigation["']/i.test(chooser), `${CHOOSER_PAGE}: named site navigation missing`, failures);
  assert(/<details\b[^>]*\bmbm-nav-more\b/i.test(chooser), `${CHOOSER_PAGE}: More disclosure missing`, failures);

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
  for (const label of ['Pupils &amp; learners', 'Teachers &amp; education staff', 'Parents &amp; carers', 'Schools &amp; specialist settings', 'Academy trusts', 'Local authorities &amp; education services', 'Education organisations &amp; service providers']) assert(home.includes(label), `homepage audience label missing: ${label}`, failures);
  for (const href of ['/tools/', '/Lessons/', '/resources/', '/games/', '/stats/', '/privacy/', '/main/#about', '/main/#contact', '/main/#collections', '/', '/for/pupils/', '/for/teachers/', '/for/parents-carers/', '/for/schools-semh/', '/for/trusts/', '/for/councils-organisations/', '/for/partners/']) {
    assert(home.includes(`href="${href}"`) || home.includes(`href='${href}'`), `homepage audience route missing: ${href}`, failures);
    assert(localRouteExists(href), `homepage audience route has no proven destination: ${href}`, failures);
  }
  verifyHomeTruthContracts(home, failures);

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
      const baselineRel = rel === 'main/index.html' ? 'index.html' : rel;
      const baseline = gitShow(base, baselineRel);
      const current = relRead(rel, overrides);
      const beforeLogo = brandVisual(baseline).replace(/src=["']assets\//g, 'src="/assets/');
      const afterLogo = brandVisual(current).replace(/src=["']assets\//g, 'src="/assets/');
      assert(beforeLogo && beforeLogo === afterLogo, `${rel}: Made by Matt logo visual changed`, failures);
      if (rel === 'stats/index.html') {
        assert(current.includes(COUNTER_SENTINEL), `${rel}: authorised device-local counter copy changed without counter sentinel`, failures);
        assert(/Activity on this device/i.test(current), `${rel}: device-local activity title missing`, failures);
        assert(/Visits on this device/i.test(current), `${rel}: device-local visit label missing`, failures);
        assert(/stored only in this browser/i.test(current), `${rel}: local-storage explanation missing`, failures);
        assert(!/counterapi\.dev/i.test(current), `${rel}: retired CounterAPI claim remains`, failures);
      } else if (FUNCTIONAL_COPY_PAGES.has(rel)) {
        assert(current.includes(ACCOUNT_SENTINEL), `${rel}: authorised account/privacy copy changed without account sentinel`, failures);
      } else {
        const beforeSource = rel === 'main/index.html' ? canonicalHomeTruthCopy(baseline, failures, `${rel} baseline`) : baseline;
        const afterSource = rel === 'main/index.html' ? canonicalHomeTruthCopy(current, failures, `${rel} current`) : current;
        const before = visibleAuthoredText(beforeSource);
        const after = visibleAuthoredText(afterSource);
        assert(before === after, `${rel}: authored body wording changed outside permitted chrome/audience/auth/counter regions`, failures);
      }
    } catch (error) { failures.push(`${rel}: could not compare authored wording with ${base}: ${error.message}`); }
  }

  return failures;
}
function printFailures(failures) { for (const failure of failures) console.error(`  - ${failure}`); }
function requireMutation(home, from, to, label) {
  const mutated = home.replace(from, to);
  if (mutated === home) throw new Error(`${label} fixture could not be created`);
  return mutated;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  const first = verify(args.base);
  if (first.length) {
    console.error(`[FAIL] professional site verifier (${first.length} issue${first.length === 1 ? '' : 's'})`);
    printFailures(first); process.exit(1);
  }
  console.log(`[PASS] current implementation: chooser + ${KEY_PAGES.length} key pages, shared platform, /main/ preservation and route contracts`);
  if (args.selfTest) {
    const home = relRead('main/index.html');

    const authorisedMutation = requireMutation(
      home,
      'A weekly Made by Matt update covering what changed on the site and a clearly labelled look at what is coming next.',
      'A regular Made by Matt update covering what changed on the site and a clearly labelled look at what is coming next.',
      'authorised-region mutation'
    );
    const authorised = verify(args.base, { 'main/index.html': authorisedMutation });
    if (authorised.length) {
      console.error('[FAIL] authorised account/mailing wording mutation was rejected');
      printFailures(authorised); process.exit(1);
    }
    console.log('[PASS] positive control: authorised account/mailing wording mutation accepted');

    const unrelatedMutation = requireMutation(home, 'Browse the Arcade', 'Browse every Arcade', 'unrelated authored-copy mutation');
    const unrelated = verify(args.base, { 'main/index.html': unrelatedMutation });
    if (!unrelated.some((failure) => failure.includes('authored body wording changed'))) {
      console.error('[FAIL] unrelated authored homepage wording mutation was not rejected by preservation');
      printFailures(unrelated); process.exit(1);
    }
    console.log(`[PASS] positive control: unrelated authored-copy mutation rejected (${unrelated.length} detected issue${unrelated.length === 1 ? '' : 's'})`);

    const structuralMutation = requireMutation(
      home,
      '<a class="dx-tbtn" href="/mailing-list/">Join teacher updates</a>',
      '<a class="dx-tbtn" href="/mailing-list-broken/">Join teacher updates</a>',
      'account/mailing structure mutation'
    );
    const structural = verify(args.base, { 'main/index.html': structuralMutation });
    if (!structural.some((failure) => failure.includes('Teacher updates must link to /mailing-list/'))) {
      console.error('[FAIL] broken account/mailing structure was not rejected');
      printFailures(structural); process.exit(1);
    }
    console.log(`[PASS] positive control: structural account/mailing mutation rejected (${structural.length} detected issue${structural.length === 1 ? '' : 's'})`);

    const audienceMutation = requireMutation(home, 'id="audiences"', 'id="audiences-broken"', 'audience structure mutation');
    const audience = verify(args.base, { 'main/index.html': audienceMutation });
    if (!audience.length) { console.error('[FAIL] broken audience fixture was not rejected'); process.exit(1); }
    console.log(`[PASS] positive control: deliberately broken audience fixture rejected (${audience.length} detected issue${audience.length === 1 ? '' : 's'})`);

    const restored = verify(args.base);
    if (restored.length) { console.error('[FAIL] restored implementation did not pass'); printFailures(restored); process.exit(1); }
    console.log('[PASS] restored implementation after positive controls');
  }
}
try { main(); } catch (error) { console.error(`[FAIL] ${error.stack || error.message}`); process.exit(1); }
