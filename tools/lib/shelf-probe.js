'use strict';
/*
 * shelf-probe.js — the one place that knows how /games/ is built.
 *
 * WHY THIS EXISTS. Two gates queried '#allGrid .gcard' for the browse grid and
 * '#sportsRail .gcard' for the Sports rail. Neither id has ever existed on that
 * page. They were not passing blind — they failed loudly every run — but they
 * failed on a selector, not on the thing they claim to prove, which is the same
 * as not testing it. The two files were near-identical copies of each other, so
 * the drift lived in both.
 *
 * WHAT THE PAGE ACTUALLY DOES (games/index.html, drawGrid/render):
 *   - unfiltered, one <details class="gsec"> per genre, cards in its .cards;
 *   - filtered, one flat list in #flatResults and #genreSections hidden;
 *   - the curated rail is #topRail > a.pick;
 *   - there is NO Sports rail. Sports is a genre section like any other, and
 *     genre comes from the TAXONOMY literal in the page, NOT from the
 *     `collection` field in games.json. Those two disagree: /neonturf/ carries
 *     no collection and is TAXONOMY-genre Sports, so a gate deriving "expected
 *     Sports" from `collection` is wrong by one before it queries anything.
 *
 * HOW VACUITY IS MADE IMPOSSIBLE. Three separate things are reported, and the
 * caller cannot collapse them:
 *   - whether the CONTAINER exists at all (missing => selector drift);
 *   - how many cards are inside it (zero with a live container => the page
 *     rendered nothing, which is a real defect and must never read as a pass);
 *   - the count the manifest says there should be.
 * assertRendered() below refuses both zero cases by name, and it is called
 * before any equality, so `rendered === expected` can never be satisfied by
 * 0 === 0 — the shape the register calls a vacuous equality.
 */

const SEL = {
  genreHost: '#genreSections',
  flatHost: '#flatResults',
  browse: '#genreSections .gcard, #flatResults .gcard',
  picksHost: '#topRail',
  picks: '#topRail .pick',
  section: '#genreSections details.gsec',
  countline: '#countline',
};

/* Read the shelf as the browser sees it. Container existence is reported
   separately from card count so the caller can tell drift from an empty page. */
async function probeShelf(page) {
  return page.evaluate((S) => {
    const hrefs = sel => Array.from(document.querySelectorAll(sel)).map(a => a.getAttribute('href'));
    const sections = {};
    for (const d of document.querySelectorAll(S.section)) {
      const name = (d.querySelector('summary .gname') || {}).textContent || '';
      sections[name.trim()] = Array.from(d.querySelectorAll('.gcard')).map(a => a.getAttribute('href'));
    }
    return {
      hasGenreHost: !!document.querySelector(S.genreHost),
      hasFlatHost: !!document.querySelector(S.flatHost),
      hasPicksHost: !!document.querySelector(S.picksHost),
      all: hrefs(S.browse),
      picks: hrefs(S.picks),
      sections,
      countline: ((document.querySelector(S.countline) || {}).textContent || '').trim(),
    };
  }, SEL);
}

/* The genre map the page renders from: the TAXONOMY literal in the served
   HTML. This is the SOURCE, read independently of what the page did with it —
   deriving the expectation from the rendered DOM would be the page grading its
   own homework. */
function taxonomyFromHtml(html) {
  const i = html.indexOf('var TAXONOMY');
  if (i < 0) throw new Error('served /games/ carries no TAXONOMY literal — the page shape changed, fix the probe before trusting any count');
  const j = html.indexOf('var GENRE', i);
  const body = html.slice(i, j < 0 ? i + 200000 : j);
  const map = new Map();
  for (const m of body.matchAll(/href:"([^"]+)"[^}]*?genre:"([^"]+)"/g)) {
    map.set(m[1].replace(/\/?$/, '/'), m[2]);
  }
  if (!map.size) throw new Error('TAXONOMY literal parsed to zero entries — the probe is broken, not the page');
  return map;
}

/* What the page SHOULD paint in one genre: manifest entries whose TAXONOMY
   genre is that genre. A TAXONOMY row for a game the manifest does not carry
   paints nothing, so the intersection is the honest expectation. */
function expectedInGenre(manifest, taxonomy, genre) {
  return manifest.filter(g => taxonomy.get(String(g.href).replace(/\/?$/, '/')) === genre).map(g => g.href);
}

/* The guard every count must pass through first. Named separately from the
   equality it protects, so a red says which of the two things went wrong. */
function assertRendered(assert, label, containerPresent, cards, floor) {
  assert(containerPresent,
    `${label}: the container selector matched nothing — the page shape moved and this gate is measuring a selector, not the shelf`);
  assert(floor > 0,
    `${label}: the derived expectation is ${floor} — a zero floor would let an empty page satisfy every count below`);
  assert(cards.length > 0,
    `${label}: the container is present and rendered 0 cards — an empty shelf is a defect, never a pass`);
}

module.exports = { SEL, probeShelf, taxonomyFromHtml, expectedInGenre, assertRendered };
