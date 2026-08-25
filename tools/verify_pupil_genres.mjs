/*
 * The pupil homepage shows the whole shelf, by genre, from the SAME record.
 *
 * Until 2026-08-15 /for/pupils/ hand-listed ten games in
 * data/audience-homepages.json and 42 of 52 were invisible to pupils — while
 * the "Surprise me" copy called those ten "the pupil-safe set", implying a
 * filter the data does not support: all 62 game routes in
 * data/mbm-search-index.json carry safeForPupils:true.
 *
 * The interesting limb here is the SHARED-RECORD one. It is easy to write a
 * pupil page that happens to agree with /games/ today and drifts tomorrow —
 * that is what `featured`, TAKES, TOP, `tag` and `collection` all did. So this
 * does not compare the two pages' output and call it agreement. It changes a
 * genre in a scratch copy of games/index.html, re-renders, and requires BOTH
 * pages to move. Agreement that survives a change to the source is the only
 * kind worth asserting.
 *
 * Usage: node tools/verify_pupil_genres.mjs [repo-root]
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] || path.join(HERE, '..');
const PUPIL = path.join(ROOT, 'for', 'pupils', 'index.html');
const GAMES = path.join(ROOT, 'games', 'index.html');
const MANIFEST = path.join(ROOT, 'data', 'source-manifests', 'games.json');
const INDEX_PATH = path.join(ROOT, 'data', 'mbm-search-index.json');
const AUDIENCES = path.join(ROOT, 'data', 'audience-homepages.json');

let chromium;
for (const spec of ['playwright', process.env.MBM_PLAYWRIGHT,
  '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
  try { const m = await import(spec); chromium = m.chromium || (m.default && m.default.chromium); if (chromium) break; }
  catch (e) { /* next */ }
}
if (!chromium) {
  console.error('INCONCLUSIVE: playwright is not importable, so no page was ever painted.');
  console.error('This gate did not judge anything. That is not a pass.');
  process.exit(2);
}

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? `  ·  ${detail}` : ''}`);
  return ok;
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

function serve(root) {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/Games/games.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(fs.readFileSync(path.join(root, 'data/source-manifests/games.json')));
      return;
    }
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  return s;
}

/* Read both pages the same way: PAINTED cards only, accordions opened, because
   a card inside a shut <details> is not a card a child can see. */
async function readPages(root) {
  const s = serve(root);
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

  const readOne = async (url, cardSel, railSel, genreSel, nameSel, numSel) => {
    const page = await ctx.newPage();
    const off = [], errs = [];
    page.on('request', q => { const h = new URL(q.url()).host; if (!h.startsWith('127.')) off.push(q.url()); });
    page.on('pageerror', e => errs.push(String(e).slice(0, 90)));
    await page.goto(origin + url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(sel => document.querySelectorAll(sel).length, cardSel).catch(() => 0)) break;
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    await page.waitForTimeout(400);
    const out = await page.evaluate(([cardSel, railSel, genreSel, nameSel, numSel]) => {
      const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const href = e => e.getAttribute('href') || (e.querySelector('a[href]') || {}).getAttribute?.('href') || '';
      const rail = [...document.querySelectorAll(railSel)].filter(vis).map(href);
      const all = [...document.querySelectorAll(cardSel)].filter(vis).map(href);
      const per = {}; all.forEach(h => { per[h] = (per[h] || 0) + 1; });
      return {
        cards: all.length, distinct: new Set(all).size, per, rail,
        /* The amended fence asserts not just HOW MANY inputs there are but
           WHICH one it is: a count of 1 would otherwise be satisfied by any
           input at all arriving on the page. */
        searchInputs: document.querySelectorAll('[data-mbm-pupil-search]').length,
        genres: [...document.querySelectorAll(genreSel)].map(d => ({
          name: (d.querySelector(nameSel) || {}).textContent || '',
          label: (d.querySelector(numSel) || {}).textContent || '',
          cards: [...d.querySelectorAll(cardSel)].filter(vis).length
        })),
        fence: {
          inputs: document.querySelectorAll('input,textarea').length,
          forms: document.querySelectorAll('form').length,
          kofi: document.querySelectorAll('a[href*="ko-fi" i]').length,
          mailto: document.querySelectorAll('a[href^="mailto:"]').length,
          signup: document.querySelectorAll('a[href*="mailing" i],a[href*="signup" i],a[href*="account" i],a[href*="members" i]').length,
          autoplay: document.querySelectorAll('[autoplay]').length
        },
        /* A <summary> or a masthead link is a control, never prose — the
           WCAG 2.5.8 inline exception is for a target sized by the line-height
           of the sentence around it, and neither of those is. */
        small: [...document.querySelectorAll('a,button,summary,input,select')]
          .map(e => ({ e, r: e.getBoundingClientRect() }))
          .filter(o => o.r.width > 0 && o.r.height > 0 && (o.r.height < 44 || o.r.width < 44))
          .filter(o => {
            if (o.e.tagName === 'SUMMARY' || o.e.tagName === 'BUTTON') return true;
            const par = o.e.parentElement;
            const around = par ? (par.textContent || '').replace(o.e.textContent || '', '').trim() : '';
            return around.length === 0;
          })
          .map(o => `${o.e.tagName} ${Math.round(o.r.width)}x${Math.round(o.r.height)} "${(o.e.textContent || '').trim().slice(0, 22)}"`),
        surprise: (() => {
          const el = document.querySelector('[data-mbm-surprise-set]');
          if (!el) return null;
          try { return JSON.parse(el.getAttribute('data-mbm-surprise-set')); } catch (e) { return null; }
        })()
      };
    }, [cardSel, railSel, genreSel, nameSel, numSel]);
    await page.close();
    return { ...out, off: off.length, errs };
  };

  const pupil = await readOne('/for/pupils/', '.mf-pupil-game .mf-media', '[data-mbm-pupil-rail] .mf-pupil-game .mf-media',
    'details.mf-pupil-genre', '.mf-pupil-gname', '.mf-pupil-gnum');
  const hub = await readOne('/games/', 'a.pick,a.gcard', 'a.pick',
    'details.gsec', '.gname', '.gnum');
  await browser.close(); s.close();
  return { pupil, hub };
}

const shelf = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).games;
const hrefs = new Set(shelf.map(g => g.href));

console.log('=== THE PUPIL HOMEPAGE SHOWS THE WHOLE SHELF ===\n');
const { pupil, hub } = await readPages(ROOT);

console.log(`  shelf: ${shelf.length} games`);
pupil.genres.forEach(g => console.log(`    ${g.name.padEnd(22)} ${String(g.cards).padStart(2)} cards  label "${g.label}"`));
console.log();

check(pupil.distinct === shelf.length, 'distinct games painted on the pupil page == the shelf',
  `${pupil.distinct} painted, ${shelf.length} on the shelf`);
/* DERIVED, never pinned. This read `=== 60` and was true for exactly as long
   as the shelf held 52 games and the rail held 8. A total written down here is
   a second copy of a number this repository already owns, and it reds on the
   next game shipped rather than on a defect — which is what it did. The
   relationship is the invariant: every shelf game is painted once, and a game
   on the rail is painted a second time. */
const expectedCards = shelf.length + pupil.rail.length;
check(pupil.cards === expectedCards,
  `the pupil page paints one card per shelf game plus one per rail game (${shelf.length}+${pupil.rail.length}=${expectedCards})`,
  `${pupil.cards}`);
const twice = Object.entries(pupil.per).filter(([, n]) => n > 1);
check(twice.every(([, n]) => n === 2), 'no game is painted more than twice',
  twice.map(([h, n]) => `${h}x${n}`).join(' ') || 'none twice');
check(JSON.stringify(twice.map(t => t[0]).sort()) === JSON.stringify(pupil.rail.slice().sort()),
  'and every game painted twice IS on the Top Picks rail', `${twice.length} twice, ${pupil.rail.length} on the rail`);
check(pupil.rail.length === hub.rail.length && JSON.stringify(pupil.rail) === JSON.stringify(hub.rail),
  'the pupil rail is the SAME rail /games/ paints, in the same order', pupil.rail.join(' · '));
const labelDrift = pupil.genres.filter(g => {
  const want = g.cards;
  return g.label !== `${want} game${want === 1 ? '' : 's'}`;
});
check(labelDrift.length === 0, 'every genre count on the pupil page is computed, not written down',
  labelDrift.map(g => `${g.name} shows "${g.label}" for ${g.cards}`).join('; ') || `${pupil.genres.length} genres`);
check(JSON.stringify(pupil.genres.map(g => [g.name, g.cards])) === JSON.stringify(hub.genres.map(g => [g.name, g.cards])),
  'the pupil genres and the /games/ genres are identical, name and count',
  pupil.genres.map(g => `${g.name}=${g.cards}`).join(' '));

/* --- the fence ---
 *
 * ONE AMENDMENT, AUTHORISED BY MATT ON 2026-08-23. NOTHING ELSE MOVES.
 *
 * PREVIOUS ASSERTION
 *   f.inputs === 0 && f.forms === 0 && f.kofi === 0 && f.mailto === 0
 *   && f.signup === 0 && f.autoplay === 0 && pupil.off === 0
 *
 * REPLACEMENT
 *   exactly ONE input, and it is the pupil game-search field, and there is
 *   still no form — plus every other clause unchanged.
 *
 * WHY. The pupil page listed every safe game and gave a child no way to look
 * for one; the genre groups are a browse, not a search. Matt ruled that the
 * page gets a real search. The count moves from 0 to 1 because a search needs
 * a field, and for no other reason.
 *
 * WHAT DID NOT MOVE, AND IS STILL ASSERTED HERE
 *   forms 0 · Ko-fi 0 · mailto 0 · signup/account 0 · autoplay 0 · off-origin 0
 *
 * WHY THIS IS AN AMENDMENT AND NOT A LOOSENING. "Zero inputs" was a proxy for
 * the thing that actually matters: nothing on this page can send a child, or
 * anything a child types, anywhere. The replacement asserts that directly and
 * in more places than the old clause did — tools/verify_search_prominence.mjs
 * proves, in a browser, that the field submits nowhere (there is no form),
 * that typing fires no data request, that the query reaches no storage and no
 * URL, and that every reachable result is a game route on the shelf. A count
 * of one input is a weaker statement than the old zero; those five runtime
 * assertions together are a stronger one.
 *
 * THE RED CONTROLS, all of which must fail:
 *   a second input -> RED (proved: 'exactly ONE input' reported 2)
 *   an external or active form action -> RED (forms must stay 0)
 *   an injected non-game result -> RED (results are shelf routes only)
 *   a storage write of the query -> RED (no persistence)
 *   a network request on typing -> RED (no data fetch)
 */
const f = pupil.fence;
check(f.inputs === 1, 'pupil fence, amended 2026-08-23: exactly one input',
  `inputs ${f.inputs}`);
check(pupil.searchInputs === 1,
  'and it is the pupil game-search field, not something else that arrived',
  `game-search fields ${pupil.searchInputs}`);
check(f.forms === 0 && f.kofi === 0 && f.mailto === 0 && f.signup === 0 && f.autoplay === 0 && pupil.off === 0,
  'the rest of the fence is untouched: no form, Ko-fi, mailto, signup or account link, no autoplay, nothing off-origin',
  `forms ${f.forms} kofi ${f.kofi} mailto ${f.mailto} signup ${f.signup} autoplay ${f.autoplay} off-origin ${pupil.off}`);
check(pupil.errs.length === 0, 'the pupil page boots with no script errors', pupil.errs.slice(0, 2).join(' | ') || 'clean');
check(pupil.small.length === 0, 'every interactive target is at least 44px at 390px',
  pupil.small.join('; ') || '0 under 44px');

/* --- Surprise me --- */
check(Array.isArray(pupil.surprise) && pupil.surprise.length === shelf.length,
  'Surprise me can land on every game on the shelf',
  `${pupil.surprise ? pupil.surprise.length : 'absent'} of ${shelf.length}`);
const unresolved = (pupil.surprise || []).filter(e => !hrefs.has(e.route));
check(unresolved.length === 0, 'and every route it can land on resolves to a live manifest entry',
  unresolved.map(e => e.route).join(', ') || `${(pupil.surprise || []).length} of ${(pupil.surprise || []).length} resolve`);

/* --- no hand-list --- */
const RETIRED = ['/apexkick/', '/voxel/', '/rallyvector3d/', '/neonmeridian/', '/novasiege/',
  '/ouroboros/', '/fracture/', '/apextennis/', '/apexpool/', '/olympics/'];
const audSrc = fs.readFileSync(AUDIENCES, 'utf8');
const aud = JSON.parse(audSrc);
const pupilSections = aud.audiences.pupils.sections;
const listed = pupilSections.flatMap(sec => (sec.features || []).map(x => x.href)).filter(h => hrefs.has(h));
check(listed.length === 0, 'the pupil audience data hand-lists ZERO games — the ten are retired',
  listed.join(', ') || `${pupilSections.length} sections, none naming a game`);
/* Scoped to the PUPIL subtree, not the whole file. The first draft scanned
   every audience and reported /apexkick/, which lives in the parents page's
   feature cards and has nothing to do with this. A gate that reds on another
   page's legitimate content teaches people to ignore it. */
const pupilJson = JSON.stringify(aud.audiences.pupils);
const stillThere = RETIRED.filter(r => pupilJson.includes(`"${r}"`));
check(stillThere.length === 0, 'and none of the retired ten survives as a literal anywhere under audiences.pupils',
  stillThere.join(', ') || '0 of 10');

/* --- the claim, read off the RENDERED page --- */
/* Deliberately the rendered HTML and not the JSON: a claim is made where a
   child reads it. Scanning the source would also count the note that RECORDS
   the removal, which quotes the phrase — a scanner counting its own
   documentation, which this estate has been bitten by before. */
const pupilHtml = fs.readFileSync(PUPIL, 'utf8');
/* Derived, not typed. This message said "62 game routes" and the shelf now
   carries 64 — a count retyped into prose inside a gate is the same species of
   drift the gate exists to describe. */
const indexEntries = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')).entries;
const gameEntries = indexEntries.filter(e => e.category === 'game');
const safeGames = gameEntries.filter(e => e.safeForPupils === true).length;
check(!pupilHtml.includes('pupil-safe set'),
  'the "pupil-safe set" claim is gone from the page a child reads',
  `all ${gameEntries.length} game routes carry safeForPupils:true (${safeGames} of them), so the phrase implied a filter the data does not support`);
const surpriseCopy = (pupilHtml.match(/<span>([^<]*random[^<]*)<\/span>/) || [])[1] || '';
check(surpriseCopy.includes('every game on this page'),
  'and the Surprise me copy now claims only what is true',
  surpriseCopy.trim() || '(not found)');

/* ---------------- CONTROLS ---------------- */
console.log('\n=== CONTROLS ===\n');

/* THE one that matters: prove the two pages read ONE record by changing it. */
{
  const scratch = fs.mkdtempSync('/tmp/pupil-rec-');
  execFileSync('cp', ['-r', ROOT + '/.', scratch], { stdio: 'ignore' });
  for (const junk of ['.git', 'node_modules', 'audit-output']) {
    fs.rmSync(path.join(scratch, junk), { recursive: true, force: true });
  }
  const src = fs.readFileSync(path.join(scratch, 'games/index.html'), 'utf8');
  const moved = src.replace('{href:"/apexkick/",', '{href:"/apexkick/",').replace(
    /(\{href:"\/apexkick\/",\s*genre:")[^"]+(")/, '$1Sandbox & Creative$2');
  check(moved !== src, 'CONTROL: the record edit is real, not a no-op',
    `${Buffer.byteLength(src)} B -> ${Buffer.byteLength(moved)} B, /apexkick/ moved to Sandbox & Creative`);
  fs.writeFileSync(path.join(scratch, 'games/index.html'), moved);
  execFileSync('python3', [path.join(scratch, 'tools/render_audience_homepages.py')],
    { cwd: scratch, stdio: 'ignore' });
  const after = await readPages(scratch);
  const hubMoved = after.hub.genres.find(g => g.name === 'Sandbox & Creative');
  const pupMoved = after.pupil.genres.find(g => g.name === 'Sandbox & Creative');
  const hubBase = hub.genres.find(g => g.name === 'Sandbox & Creative');
  const pupBase = pupil.genres.find(g => g.name === 'Sandbox & Creative');
  check(hubMoved && hubMoved.cards === hubBase.cards + 1,
    'CONTROL: changing ONE genre in games/index.html moves /games/',
    `Sandbox & Creative ${hubBase.cards} -> ${hubMoved ? hubMoved.cards : 'gone'}`);
  check(pupMoved && pupMoved.cards === pupBase.cards + 1,
    'CONTROL: and the SAME edit moves /for/pupils/ — one record, two pages',
    `Sandbox & Creative ${pupBase.cards} -> ${pupMoved ? pupMoved.cards : 'gone'}`);
  check(after.pupil.distinct === shelf.length && after.hub.distinct === shelf.length,
    'CONTROL: and neither page lost or gained a game while the genre moved',
    `pupil ${after.pupil.distinct}, hub ${after.hub.distinct}, shelf ${shelf.length}`);
  fs.rmSync(scratch, { recursive: true, force: true });
}

/* Surprise me must red on a dead route. */
{
  const dead = [...(pupil.surprise || [])];
  dead[0] = { ...dead[0], route: '/this-route-does-not-exist/' };
  const bad = dead.filter(e => !hrefs.has(e.route));
  check(bad.length === 1 && bad[0].route === '/this-route-does-not-exist/',
    'CONTROL: point one Surprise me entry at a dead route and the resolution limb catches it',
    `${bad.length} unresolved detected, shipped set has ${unresolved.length}`);
}


/* U4. THE FENCE, MEASURED IN THE STATE A CHILD TOUCHES.
   `under-44px: 0` was reported from the page as it loads - with eleven genre
   groups closed and the mobile nav stood down at `display:none`. Twelve targets
   were inside those closed groups and measured 0x0, which is not a size: a
   pupil taps them OPEN. Measuring only the collapsed state is measuring the
   state nobody touches, and it is the same species as the swatch read
   mid-construction.
   Both states are measured now. The expanded one is reached the way a pupil
   reaches it - by tapping the Menu control - never by forcing the CSS, because
   a state the page cannot enter is not a state worth measuring either. */
const TAPSEL = 'a[href],button,input,select,textarea,[role="button"],summary,[tabindex]:not([tabindex="-1"])';

async function tapTargets(root, route) {
  const s = serve(root);
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch();
  const out = {};
  for (const expand of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => document.querySelectorAll('.mf-pupil-game').length).catch(() => 0)) break;
      await page.waitForTimeout(250);
    }
    let menuTapped = false, detailsOpened = 0;
    if (expand) {
      const menu = await page.$('button.menu, header [aria-expanded]');
      if (menu) { await menu.click().catch(() => {}); menuTapped = true; }
      detailsOpened = await page.evaluate(() => {
        const ds = [...document.querySelectorAll('details')];
        ds.forEach(d => { if (!d.open) d.open = true; });
        return ds.length;
      });
      await page.waitForTimeout(400);
    }
    /* INJECTED CONTROL, in the same pass. Two zeroes are also what a broken
       selector prints, so one deliberately undersized control is planted and
       must be COUNTED. It is excluded from the shipped tally by its own id. */
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.id = 'u4-control-target';
      b.textContent = 'x';
      b.style.cssText = 'width:20px;height:20px;position:fixed;left:0;top:0;z-index:9999';
      document.body.appendChild(b);
    });
    const m = await page.evaluate((SEL) => {
      let laid = 0; const under = [], nul = [];
      for (const e of document.querySelectorAll(SEL)) {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        if (r.width === 0 || r.height === 0) {
          e.focus();
          nul.push({ id: e.id, tag: e.tagName.toLowerCase(), focusable: document.activeElement === e });
          continue;
        }
        laid++;
        if (r.width < 44 || r.height < 44)
          under.push({ id: e.id, tag: e.tagName.toLowerCase(),
                       txt: (e.textContent || '').trim().slice(0, 28),
                       w: Math.round(r.width), h: Math.round(r.height) });
      }
      return { laid, under, nul };
    }, TAPSEL);
    out[expand ? 'expanded' : 'loaded'] = {
      laid: m.laid,
      control: m.under.some(u => u.id === 'u4-control-target'),
      under: m.under.filter(u => u.id !== 'u4-control-target'),
      nul: m.nul.filter(u => u.id !== 'u4-control-target'),
      menuTapped, detailsOpened,
    };
    await page.close();
  }
  await browser.close(); s.close();
  return out;
}

console.log('\n=== THE PUPIL FENCE, IN BOTH STATES ===\n');
{
  const t = await tapTargets(ROOT, '/for/pupils/');
  for (const [state, r] of Object.entries(t)) {
    console.log(`  ${state.padEnd(9)} laid out ${String(r.laid).padStart(3)}   under-44px: ${r.under.length}   ` +
                `null-box ${r.nul.length} (focusable ${r.nul.filter(x => x.focusable).length})` +
                (state === 'expanded' ? `   menu tapped ${r.menuTapped}, ${r.detailsOpened} details opened` : ''));
    for (const u of r.under) console.log(`             ${u.w}x${u.h} <${u.tag}> ${JSON.stringify(u.txt)}`);
  }
  check(t.loaded.control && t.expanded.control,
    'CONTROL: a deliberately 20x20 target IS counted, in both states',
    `loaded ${t.loaded.control}, expanded ${t.expanded.control}`);
  check(t.loaded.under.length === 0, 'as loaded: under-44px 0',
    `${t.loaded.laid} laid out`);
  check(t.expanded.laid > t.loaded.laid,
    'expanding actually exposed more targets — otherwise the second measurement is the first one again',
    `${t.loaded.laid} -> ${t.expanded.laid}`);
  check(t.expanded.under.length === 0,
    'EXPANDED — every genre group open and the nav tapped out: under-44px 0',
    `${t.expanded.laid} laid out, ${t.expanded.under.length} under 44px`);
  check(t.expanded.nul.every(n => !n.focusable),
    'and nothing that measures 0x0 is in the tab order',
    `${t.expanded.nul.length} null-box, ${t.expanded.nul.filter(n => n.focusable).length} focusable`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
