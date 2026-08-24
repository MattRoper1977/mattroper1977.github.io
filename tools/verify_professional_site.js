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
/*
 * BACKLOG 0a-B. Which passes authorise the copy on a page is not derivable from
 * the page, so it is declared in data/copy-authorisation.json and read here.
 * One sentinel per page is unchanged; what changed is that the verifier no
 * longer demands one *particular* pass's sentinel on a page several passes
 * authorise. privacy/index.html carries the closeout sentinel because that pass
 * wrote it last, and the accounts copy it also carries is authorised by the map.
 */
const AUTHORISATION = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'copy-authorisation.json'), 'utf8'));

/*
 * Which pages a child reaches, read from the one place it is declared. The nav
 * contract below used to require /members/ on every key page. That is an
 * account-backed route, and Matt's R5 of 2026-08-14 extends the 2026-08-13
 * commerce ruling to it: no account routes on a pupil-reachable surface either.
 *
 * The requirement is not dropped, it is SPLIT, so nothing is exempted. A key
 * page that is not pupil-reachable must still carry the link; a key page that
 * IS must not carry it. Two assertions where there was one, and the list they
 * both read is data/adult-surfaces.json, so this gate and PILL_FORBIDDEN in
 * verify_games_audience_faces.py cannot drift apart.
 */
const PUPIL_REACHABLE = new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'adult-surfaces.json'), 'utf8'))
    .pupilReachableSurfaces.map((entry) => String(entry.page))
);
const ACCOUNT_BACKED_LINKS = new Set(['/members/', '/account/']);

function authorisationProblems() {
  const problems = [];
  if (!String(AUTHORISATION._boundary || '').includes('BEHAVIOUR')) {
    problems.push('data/copy-authorisation.json: the boundary rule is missing, so the map cannot be reviewed');
  }
  for (const [rel, entry] of Object.entries(AUTHORISATION.pages)) {
    if (!fs.existsSync(path.join(ROOT, rel))) {
      problems.push(`data/copy-authorisation.json: ${rel} is declared but does not exist`);
    }
    for (const pass of entry.authorisedBy) {
      if (!AUTHORISATION.passes[pass]) {
        problems.push(`data/copy-authorisation.json: ${rel} names pass "${pass}", which is not declared`);
      }
    }
  }
  return problems;
}

function sentinelIsAuthorised(rel, html) {
  const entry = AUTHORISATION.pages[rel];
  if (!entry || entry.governedBy === 'region-comparison') return null;
  const accepted = entry.authorisedBy.map((pass) => AUTHORISATION.passes[pass]).filter(Boolean);
  if (accepted.some((sentinel) => html.includes(sentinel))) return null;
  return `${rel}: carries none of the sentinels of the passes that authorise its copy (${entry.authorisedBy.join(', ')})`;
}
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

/*
 * tools/index.html — ONE authorised region, and deliberately a narrow one.
 *
 * The hub's tool inventory changes when a tool ships; its authored prose does
 * not. Before this, adding a card tripped "authored body wording changed" and
 * there were only two ways out, both bad: leave the red standing, or declare
 * the page in copy-authorisation.json WITHOUT region-comparison, which
 * replaces strict preservation with a sentinel-presence check and switches the
 * guard off for the whole page. Routing main/index.html that way once did
 * exactly that, and this file's own comment records it.
 *
 * So the guard is NARROWED rather than lifted. Only the run of accreditation
 * cards inside <div class="tgrid" data-sec="acc"> is canonicalised away. The
 * bridge panel that sits in the same grid is NOT in the region and stays under
 * strict comparison, as does every heading, section and promise on the page.
 *
 * The pattern must match EXACTLY ONCE - canonicalRegions asserts that - so a
 * loose pattern that swallowed the whole grid, or matched nothing after a
 * refactor, fails loudly instead of quietly widening what may change.
 */
const TOOLS_TRUTH_REGIONS = Object.freeze([
  {
    name: 'accreditation-tool-cards',
    pattern: /(<div\b(?=[^>]*\bclass=["']tgrid["'])(?=[^>]*\bdata-sec=["']acc["'])[^>]*>)\s*(?:<article\b(?=[^>]*\bclass=["']tcard["'])(?=[^>]*\bdata-cat=["']acc["'])[^>]*>[\s\S]*?<\/article>\s*)+/i,
    replacement: '$1__MBM_AUTHORISED_TOOLS_ACC_CARDS__\n'
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
/*
 * Replace each declared region with its token, asserting it matched EXACTLY
 * once. The count assertion is the load-bearing half: a pattern that matched
 * nothing would silently leave the region under strict comparison (a false
 * red), and one that matched twice would silently canonicalise away more of
 * the page than was authorised (a false green). Both are failures here.
 */
function canonicalRegions(html, regions, failures, label) {
  let s = html;
  for (const region of regions) {
    const count = matchCount(s, region.pattern);
    assert(count === 1, `${label}: authorised region ${region.name} matched ${count} times (expected 1)`, failures);
    if (count === 1) s = s.replace(region.pattern, region.replacement);
  }
  return s;
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
function gitHasPath(ref, rel) {
  const result = cp.spawnSync('git', ['cat-file', '-e', `${ref}:${rel}`], { cwd: ROOT });
  return result.status === 0;
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
  failures.push(...authorisationProblems());
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
    const pupilReachable = PUPIL_REACHABLE.has(rel);
    for (const href of [...PRIMARY_LINKS, ...MORE_LINKS]) {
      const present = html.includes(`href="${href}"`) || html.includes(`href='${href}'`);
      if (pupilReachable && ACCOUNT_BACKED_LINKS.has(href)) {
        assert(!present, `${rel}: carries account-backed navigation link ${href}, and this surface is declared pupil-reachable in data/adult-surfaces.json`, failures);
      } else {
        assert(present, `${rel}: navigation link ${href} missing`, failures);
      }
    }
    const dupes = duplicateIds(html);
    assert(dupes.length === 0, `${rel}: duplicate IDs: ${dupes.join(', ')}`, failures);
  }

  assert(/<section\b[^>]*\bid=["']audiences["']/i.test(home), 'homepage audience pathway section missing', failures);
  // Labels come from the same data file the renderer reads. This list used to
  // be a second copy, which meant a relabel showed up here as a spurious
  // failure about a label nothing serves any more.
  const audienceData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'audience-homepages.json'), 'utf8'));
  const audienceLabels = Object.values(audienceData.audiences)
    .map(a => a.label.replace(/&/g, '&amp;'));
  for (const label of audienceLabels) assert(home.includes(label), `homepage audience label missing: ${label}`, failures);
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

  /* assets/brand is immutable BY DEFAULT, and stays that way. A change there
     is only permitted when it is declared here with its reason and its date,
     so that the exemption is a record rather than a hole: everything NOT on
     this list still fails exactly as before.

     THE ONE DECLARED CHANGE
     assets/brand/mbm-splash.js — authorised by Matt, 2026-08-23.
     The donor let the splash's own dismissal through to the game underneath:
     it listened for keydown on the splash element and click on .mbm-skip and
     stopped neither, because preventDefault suppresses a default action and
     does not stop propagation. tools/render_splash.py had been HELD on exactly
     this, refusing to stamp, with 26 S2/S3 failures recorded against it. Measured
     with a probe counting bubble-phase events on `window`, the way a game's own
     listeners sit:
         BEFORE  Space -> keydown 1, keyup 1 · Escape -> keydown 1, keyup 1
                 skip tap -> click 1, pointerdown 1, pointerup 1
         AFTER   all three dismissal paths -> 0, splash still dismisses
     The fix takes keydown, keyup, click, pointerdown and pointerup on `document`
     in the CAPTURE phase and releases them a short window after dismissal. The
     hold was lifted in the same commit, as its own instructions required. */
  const DECLARED_BRAND_CHANGES = new Set(['assets/brand/mbm-splash.js']);
  try {
    const brandChanges = gitChanged(base, 'assets/brand');
    const undeclared = brandChanges
      .split('\n').map(l => l.trim()).filter(Boolean)
      .filter(path => !DECLARED_BRAND_CHANGES.has(path));
    assert(undeclared.length === 0,
      `immutable brand assets changed without a declaration: ${undeclared.join(', ')}`, failures);
  } catch (error) { failures.push(`could not compare immutable brand assets with ${base}: ${error.message}`); }

  for (const rel of KEY_PAGES) {
    try {
      // BACKLOG 0a-A. This used to remap main/index.html's baseline to
      // index.html, which was correct for exactly one commit: #110, which moved
      // the professional homepage from / to /main/ and gave / to the chooser.
      // Against a base predating that move, comparing the new page with the old
      // path was the right preservation comparison. It is a one-shot mapping,
      // and every base since #110 merged already contains main/index.html - so
      // for weeks it compared the 14,780-byte chooser against the 69,047-byte
      // homepage and reported five "matched 0 times" findings about neither.
      //
      // Removed rather than made conditional. A conditional would silently
      // substitute a different file and be indistinguishable from correct
      // behaviour until it wasn't, which is how this survived. A base that
      // cannot support the comparison is a loud failure instead.
      if (!gitHasPath(base, rel)) {
        failures.push(
          `${rel}: ${base} does not contain this path, so there is no baseline to preserve ` +
          `against. This comparison needs a base from after #110 moved the homepage to /main/; ` +
          `comparing an older base is a deliberate, explicit act, not something to infer here.`
        );
        continue;
      }
      const baseline = gitShow(base, rel);
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
      // A page governed by region comparison stays in the preservation diff:
      // declaring it in the map records how it is governed, it does not move it
      // out of the comparison. Routing main/index.html here switched off the
      // homepage's authored-copy preservation entirely, and the unrelated-copy
      // control caught it on the same run.
      } else if (AUTHORISATION.pages[rel] && AUTHORISATION.pages[rel].governedBy !== 'region-comparison') {
        const problem = sentinelIsAuthorised(rel, current);
        if (problem) failures.push(problem);
      } else {
        const canonicalise = (html, label) => {
          if (rel === 'main/index.html') return canonicalHomeTruthCopy(html, failures, label);
          if (rel === 'tools/index.html') return canonicalRegions(html, TOOLS_TRUTH_REGIONS, failures, label);
          return html;
        };
        const beforeSource = canonicalise(baseline, `${rel} baseline`);
        const afterSource = canonicalise(current, `${rel} current`);
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
/*
 * The controls, declared rather than inlined, so that every one of them runs.
 *
 * They used to sit after an early `process.exit(1)`, which meant a red
 * verifier disabled the suite whose whole job is to prove the verifier can go
 * red - at exactly the moment that reassurance is worth having. They had not
 * run since #110 merged. See BACKLOG.md item 0a.
 *
 * Aggregating exposes a second problem the old shape hid. A control is
 * evaluated as a *delta* against the unmutated run, because with a red
 * baseline "the mutated run reports failure X" proves nothing if the
 * unmutated run already reported X. Where that is so, the control cannot tell
 * its mutation apart from the pre-existing failure, and it says so
 * (INCONCLUSIVE) rather than claiming a pass it has not earned.
 */
const SELF_TEST_CONTROLS = Object.freeze([
  {
    name: 'authorised account/mailing wording mutation accepted',
    mutate: (home) => requireMutation(
      home,
      'A weekly Made by Matt update covering what changed on the site and a clearly labelled look at what is coming next.',
      'A regular Made by Matt update covering what changed on the site and a clearly labelled look at what is coming next.',
      'authorised-region mutation'
    ),
    expect: 'no-new-findings'
  },
  /*
   * The tools-hub region, exercised in BOTH directions. One alone would be
   * worthless: a control that only proves the region accepts a new card cannot
   * tell a narrow authorisation from a switched-off guard, and a control that
   * only proves prose is still caught cannot tell a working region from a
   * pattern that matched nothing.
   */
  {
    name: 'tools hub: a new accreditation card inside the authorised region is accepted',
    page: 'tools/index.html',
    mutate: (html) => requireMutation(
      html,
      '<div class="bridge">',
      '<article class="tcard" data-cat="acc" data-s="control probe"><span class="ci" aria-hidden="true">\u2705</span><h3>Control Probe</h3><p>Inserted by the self-test.</p><a class="go" href="../tools/">OPEN →</a></article>\n<div class="bridge">',
      'tools accreditation-card mutation'
    ),
    expect: 'no-new-findings'
  },
  {
    name: 'tools hub: authored prose OUTSIDE the region is still rejected',
    page: 'tools/index.html',
    mutate: (html) => requireMutation(
      html,
      'THE PROGRAMMES THE REGISTERS TRACK',
      'THE PROGRAMMES THESE REGISTERS TRACK',
      'tools out-of-region prose mutation'
    ),
    expect: 'new-finding-matching',
    needle: 'authored body wording changed'
  },
  {
    name: 'unrelated authored-copy mutation rejected',
    mutate: (home) => requireMutation(home, 'Browse the Arcade', 'Browse every Arcade', 'unrelated authored-copy mutation'),
    expect: 'new-finding-matching',
    needle: 'authored body wording changed'
  },
  {
    name: 'structural account/mailing mutation rejected',
    mutate: (home) => requireMutation(
      home,
      '<a class="dx-tbtn" href="/mailing-list/">Join teacher updates</a>',
      '<a class="dx-tbtn" href="/mailing-list-broken/">Join teacher updates</a>',
      'account/mailing structure mutation'
    ),
    expect: 'new-finding-matching',
    needle: 'Teacher updates must link to /mailing-list/'
  },
  {
    name: 'deliberately broken audience fixture rejected',
    mutate: (home) => requireMutation(home, 'id="audiences"', 'id="audiences-broken"', 'audience structure mutation'),
    expect: 'any-new-finding'
  }
]);

function runControl(control, base, home, baseline) {
  // A control may target any key page. Default stays main/index.html so every
  // existing control is untouched; tools/index.html needs its own because the
  // region it exercises only exists there.
  const page = control.page || 'main/index.html';
  let mutated;
  try {
    mutated = control.mutate(page === 'main/index.html' ? home : relRead(page));
  } catch (error) {
    // A fixture that cannot be built means the control never reached the gate
    // it tests. That is a reported state, not a silent absence.
    return { state: 'ERROR', detail: error.message };
  }

  const added = verify(base, { [page]: mutated }).filter((failure) => !baseline.has(failure));

  if (control.expect === 'no-new-findings') {
    return added.length === 0
      ? { state: 'PASS', detail: 'the authorised mutation introduced no new finding' }
      : { state: 'FAIL', detail: `the authorised mutation was rejected (${added.length} new finding(s))`, added };
  }

  if (control.expect === 'any-new-finding') {
    return added.length > 0
      ? { state: 'PASS', detail: `the broken fixture produced ${added.length} new finding(s)` }
      : { state: 'FAIL', detail: 'the broken fixture produced no new finding' };
  }

  if ([...baseline].some((failure) => failure.includes(control.needle))) {
    return {
      state: 'INCONCLUSIVE',
      detail: `the baseline already fails on "${control.needle}", so a mutated run cannot be told apart from that pre-existing failure`
    };
  }
  return added.some((failure) => failure.includes(control.needle))
    ? { state: 'PASS', detail: `the mutation produced the expected new finding ("${control.needle}")` }
    : { state: 'FAIL', detail: `no new finding matched "${control.needle}"`, added };
}

function restoredControl(base, baseline) {
  const restored = verify(base);
  const added = restored.filter((failure) => !baseline.has(failure));
  const removed = [...baseline].filter((failure) => !restored.includes(failure));
  if (added.length || removed.length) {
    return { state: 'FAIL', detail: `the run after the controls differs from the baseline (+${added.length}/-${removed.length})`, added };
  }
  return {
    state: 'PASS',
    detail: baseline.size ? `identical to the ${baseline.size}-finding baseline` : 'clean, as it was before the controls ran'
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const first = verify(args.base);
  const baseline = new Set(first);

  if (first.length) {
    console.error(`[FAIL] professional site verifier (${first.length} issue${first.length === 1 ? '' : 's'})`);
    printFailures(first);
  } else {
    console.log(`[PASS] current implementation: chooser + ${KEY_PAGES.length} key pages, shared platform, /main/ preservation and route contracts`);
  }

  let controlProblems = 0;
  if (args.selfTest) {
    const home = relRead('main/index.html');
    const results = SELF_TEST_CONTROLS.map((control) => ({ name: control.name, ...runControl(control, args.base, home, baseline) }));
    results.push({ name: 'implementation restored after the controls', ...restoredControl(args.base, baseline) });

    const tally = results.reduce((acc, result) => Object.assign(acc, { [result.state]: (acc[result.state] || 0) + 1 }), {});
    console.log(`\n--self-test: ${results.length} controls, all run and aggregated (no fail-fast)`);
    for (const result of results) {
      const line = `  [${result.state}] ${result.name} - ${result.detail}`;
      if (result.state === 'PASS') console.log(line); else console.error(line);
      if (result.added && result.added.length) printFailures(result.added);
    }
    console.log(`  ${tally.PASS || 0} passed · ${tally.FAIL || 0} failed · ${tally.INCONCLUSIVE || 0} inconclusive · ${tally.ERROR || 0} errored`);

    controlProblems = (tally.FAIL || 0) + (tally.ERROR || 0);
    // An inconclusive control is a consequence of the red baseline, and the
    // run already fails because of it; counting it again would report one
    // problem twice. With a clean baseline there is no such excuse, so it
    // counts.
    if (!first.length) controlProblems += (tally.INCONCLUSIVE || 0);
  }

  if (first.length || controlProblems) {
    console.error(`\n[RED] ${first.length} baseline finding(s), ${controlProblems} control problem(s)`);
    process.exit(1);
  }
}
try { main(); } catch (error) { console.error(`[FAIL] ${error.stack || error.message}`); process.exit(1); }
