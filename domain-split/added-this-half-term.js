/* "Added this half-term" on the education homepage — UX2 B2.
 *
 * The SAME component as the Lessons hub's rail (Lessons UX2 A2), copied with
 * its source recorded: Lessons/index.html renderHub() lines 75–81 (the rail,
 * heading fallback and the six-row cut) and Lessons/assets/catalogue/hub.js —
 * halfTermWindow(), sixtyDaysAgo(), fmtDay(), formatOf(), badge(), esc(),
 * safeHref(), the FORMAT_LABEL table and the COPY strings "Added this
 * half-term" / "Added this term" / "See all →". It reads the served Lessons
 * catalogue (/Lessons/resources.json — the bytes the Site mirrors as
 * data/source-manifests/lessons-resources.json) for `added`, and the published
 * calendar spine (/Lessons/data/calendar-spine.json). No count or date is
 * typed here; nothing loads from a third party or from Play. The section stays
 * hidden until rows exist (derive, degrade, never invent).
 */
(function (root) {
  'use strict';
  var d = root.document;
  var section = d.getElementById('added'), heading = d.getElementById('added-h'), rail = d.getElementById('added-rail'), all = d.getElementById('added-all');
  if (!section || !heading || !rail) return;
  var COPY = { added: 'Added this half-term', addedFallback: 'Added this term', seeAll: 'See all →' };
  var HALF_TERMS = ['Autumn 1', 'Autumn 2', 'Spring 1', 'Spring 2', 'Summer 1', 'Summer 2'];
  var FORMAT_LABEL = { html: 'Interactive', packs: 'Editable packs', pdf: 'PDF' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeHref(value) {
    var s = String(value == null ? '' : value).trim();
    if (!s || /^(?:javascript|data|vbscript):/i.test(s)) return '#';
    if (/^https?:\/\//i.test(s)) return encodeURI(s);
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^\/\//.test(s) && !/[\\ -]/.test(s)) return encodeURI(s);
    return '#';
  }
  function ext(path) { var m = String(path || '').split('?')[0].split('#')[0].match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : ''; }
  function formatOf(r) {
    if (r.kind === 'pack') return 'packs';
    var e = ext(r.file || r.url);
    if (e === 'pdf') return 'pdf';
    if (e === 'pptx' || e === 'docx') return 'packs';
    return 'html';
  }
  function badge(fmt) { return '<span class="badge b-' + fmt + '">' + esc(FORMAT_LABEL[fmt]) + '</span>'; }
  function fmtDay(iso) { var p = String(iso).split('-'); return Number(p[2]) + ' ' + (MONTHS[Number(p[1]) - 1] || p[1]); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function sixtyDaysAgo() { var dt = new Date(); dt.setUTCDate(dt.getUTCDate() - 60); return dt.toISOString().slice(0, 10); }
  function halfTermWindow(spine, day) {
    if (!spine || !spine.blocks || !spine.weekStarts) return null;
    var iso = function (dt) { return dt.toISOString().slice(0, 10); };
    var blocks = HALF_TERMS.map(function (label) { return spine.blocks[label]; }).filter(Boolean).map(function (b) { return { label: b.label, start: spine.weekStarts[String(b.abs[0])], lastWeek: spine.weekStarts[String(b.abs[1])] }; });
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i], next = blocks[i + 1];
      var end = next ? next.start : (function () { var dt = new Date(b.lastWeek + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + 7); return iso(dt); })();
      if (day >= b.start && day < end) return { label: b.label, start: b.start, end: end, between: false };
    }
    var upcoming = blocks.filter(function (b) { return b.start > day; })[0];
    if (upcoming) return { label: upcoming.label, start: upcoming.start, end: upcoming.start, between: true };
    return null;
  }
  function j(url, optional) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); })
      .catch(function (err) { if (optional) return null; throw err; });
  }
  Promise.all([j('/Lessons/resources.json'), j('/Lessons/data/calendar-spine.json', true)]).then(function (loaded) {
    var rows = loaded[0], spine = loaded[1];
    if (!Array.isArray(rows)) throw new Error('Invalid resources.json');
    spine = spine && spine.weekStarts && spine.blocks ? spine : null;
    var w = halfTermWindow(spine, today());
    heading.textContent = w ? COPY.added : COPY.addedFallback;
    if (all) all.textContent = COPY.seeAll;
    var from = w ? w.start : sixtyDaysAgo(), now = today();
    var recent = rows.filter(function (r) { return r.added && r.added >= from && r.added <= now; })
      .sort(function (a, b) { return b.added.localeCompare(a.added) || String(a.title).localeCompare(String(b.title)); }).slice(0, 6);
    rail.innerHTML = recent.map(function (r) {
      var path = r.file || r.url || '';
      return '<a class="acard" href="' + esc(safeHref(/^https?:\/\//i.test(path) ? path : '/Lessons/' + path)) + '" data-resource-path="' + esc(path) + '"><span class="when">' + esc(fmtDay(r.added)) + '</span><h3>' + esc(r.title) + '</h3><span class="chips">' + badge(formatOf(r)) + '</span><span class="sub">' + esc(String(r.subject)) + '</span></a>';
    }).join('');
    section.hidden = !recent.length;
  }).catch(function () { section.hidden = true; });
})(window);
