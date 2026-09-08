/* The pupil game search. It filters what is already on the page.
 *
 * WHY THIS IS NOT assets/mbm-search.js WITH A FILTER
 * That engine fetches /data/mbm-search-index.json: 754 KB, 715 entries, of
 * which 69 are marked safeForPupils:false — and nothing that ships reads that
 * flag. It also routes to /teach/, /account/ and the resources catalogue, and
 * its suggest form submits to /resources/. Every one of those is outside the
 * pupil fence. So this reads the DOM instead.
 *
 * THE RESULT SET IS THE SAFETY BOUNDARY
 * The only thing this file can do to a result is show it or hide it. It never
 * constructs a destination, never writes an href, never inserts an element with
 * a link in it. A result can therefore only ever be a game already rendered on
 * this page — which is the safe set, painted by the generator from the same
 * record /games/ uses. There is no code path to a route the page does not
 * already carry, because there is no code path that creates one.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * No fetch, no XHR, no beacon, no WebSocket: typing fires zero requests.
 * No localStorage, sessionStorage, IndexedDB, cookie or history entry: the
 * query dies with the page, which is what a shared classroom device needs.
 * No form, so no submit, no action and no query string.
 */
(function () {
  'use strict';
  var doc = document;
  var input = doc.querySelector('[data-mbm-pupil-search]');
  if (!input) return;
  var status = doc.querySelector('[data-mbm-pupil-search-status]');
  var cards = [].slice.call(doc.querySelectorAll('.mf-pupil-game'));
  if (!cards.length) return;

  /* Index the cards ONCE, from what they already say. Genre comes from the
     <details> group each card sits in, so the grouping this page already has
     is searchable without a second copy of the taxonomy. */
  var items = cards.map(function (card) {
    var group = card.closest('details.mf-pupil-genre');
    var genre = group ? (group.querySelector('.mf-pupil-gname') || {}).textContent || '' : '';
    var title = (card.querySelector('h3') || {}).textContent || '';
    var body = [].slice.call(card.querySelectorAll('p'))
      .map(function (p) { return p.textContent || ''; }).join(' ');
    return {
      card: card,
      group: group,
      hay: (title + ' ' + body + ' ' + genre).toLowerCase(),
      title: title.trim(),
    };
  });

  var groups = items.map(function (i) { return i.group; })
    .filter(function (g, i, a) { return g && a.indexOf(g) === i; });
  var groupOpen = groups.map(function (g) { return g.hasAttribute('open'); });

  function reset() {
    items.forEach(function (i) { i.card.hidden = false; });
    groups.forEach(function (g, n) {
      g.hidden = false;
      if (groupOpen[n]) g.setAttribute('open', ''); else g.removeAttribute('open');
    });
    if (status) status.textContent = '';
  }

  function apply(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) { reset(); return; }
    var hits = 0;
    items.forEach(function (i) {
      var match = terms.every(function (t) { return i.hay.indexOf(t) >= 0; });
      i.card.hidden = !match;
      if (match) hits++;
    });
    /* A group with nothing left in it is hidden rather than left standing
       empty, and a group with a hit is opened so the result is visible without
       a second action. */
    groups.forEach(function (g) {
      var any = [].slice.call(g.querySelectorAll('.mf-pupil-game'))
        .some(function (c) { return !c.hidden; });
      g.hidden = !any;
      if (any) g.setAttribute('open', '');
    });
    if (!status) return;
    if (hits === 0) {
      /* Calm, brief, useful. It names the genre groups, which this page has,
         and it is not an error: no scolding, no "invalid", no dead end. */
      status.textContent = 'No game matches that yet. Try another word, or open one of the game groups below.';
    } else {
      status.textContent = hits === 1
        ? '1 game matches.'
        : hits + ' games match.';
    }
  }

  input.addEventListener('input', function () { apply(input.value.trim()); });
  /* There is no form, so Enter has nothing to submit — but a keyboard user
     will press it anyway, and it must not navigate or reload. */
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') e.preventDefault();
    if (e.key === 'Escape') { input.value = ''; reset(); }
  });
})();
