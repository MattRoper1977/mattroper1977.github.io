/* "Added this half-term" on the education homepage — UX2 B2.
 *
 * The SAME component as the Lessons hub's rail (Lessons UX2 A2), copied with
 * its source recorded: Lessons/index.html renderHub() lines 75–81 (the rail,
 * heading fallback and the SW2 H three-row cut) and Lessons/assets/catalogue/hub.js —
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
  var previewNode = d.getElementById('home-preview-data');
  var previews = previewNode ? JSON.parse(previewNode.textContent) : {};
  function previewFor(row) {
    var entry = previews[row.id];
    return entry && entry.resourceFile === row.file ? entry.images : [];
  }
  function previewImage(item, cls) {
    return '<img class="' + cls + '" src="' + esc(item.dataUri) + '" alt="" loading="eager" decoding="async" data-preview-source="' + esc(item.source) + '" data-preview-sha="' + esc(item.sourceSha256) + '">';
  }
  var search = d.querySelector('[data-home-search]');
  if (search) {
    var field = search.querySelector('input');
    var runSearch = function () { var q = field.value.trim(); root.location.assign('/resources/' + (q ? '?q=' + encodeURIComponent(q) : '')); };
    search.querySelector('button').addEventListener('click', runSearch);
    field.addEventListener('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); runSearch(); } });
  }
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
    if (s[0] === '/' && s[1] !== '/' && !/[\\]/.test(s)) return encodeURI(s);
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
  Promise.all([j('/Lessons/resources.json'), j('/Lessons/data/calendar-spine.json', true), j('/Lessons/assets/catalogue/display-titles.json', true)]).then(function (loaded) {
    var rows = loaded[0], spine = loaded[1], titleMap = loaded[2] && loaded[2].schema === 1 ? loaded[2].entries || {} : {};
    function displayTitle(r) { var e = titleMap[r.file || r.url || '']; return e && e.id === (r.id || '') && e.originalTitle === r.title ? e.displayTitle : r.title; }
    if (!Array.isArray(rows)) throw new Error('Invalid resources.json');
    spine = spine && spine.weekStarts && spine.blocks ? spine : null;
    var w = halfTermWindow(spine, today());
    heading.textContent = w ? COPY.added : COPY.addedFallback;
    if (all) all.textContent = COPY.seeAll;
    var from = w ? w.start : sixtyDaysAgo(), now = today();
    var recent = rows.filter(function (r) { return String(r.type || '').toLowerCase() !== 'game' && r.added && r.added >= from && r.added <= now; })
      .sort(function (a, b) { return b.added.localeCompare(a.added) || String(a.title).localeCompare(String(b.title)); }).slice(0, 3);
    function tier(r) {
      var f = String(r.file || r.url || ''), t;
      for (var p of ['BUILD', 'GROW', 'LAUNCH']) {
        if (new RegExp('(?:^|/)' + p.charAt(0) + p.slice(1).toLowerCase() + '/').test(f) || f.split('/').some(function (x) { return x.toUpperCase().indexOf(p + '_') === 0; })) return p;
      }
      t = String(r.title || '').match(/^(BUILD|GROW|LAUNCH)(?![A-Za-z])/); return t ? t[1] : null;
    }
    function chips(tiers) { return tiers.map(function (p) { return '<span class="fd-chip ' + p.toLowerCase() + '">' + p + '</span>'; }).join(''); }
    rail.innerHTML = recent.map(function (r) {
      var path = r.file || r.url || '', pathway = tier(r), description = r.desc || r.description || '';
      var images = previewFor(r);
      var visual = images.length ? previewImage(images[0], 'fd-recent-preview') : '<span class="fd-resource-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z"/></svg></span>';
      return '<a class="acard" href="' + esc(safeHref(/^https?:\/\//i.test(path) ? path : '/Lessons/' + path)) + '" data-resource-path="' + esc(path) + '">' + visual + '<div class="fd-recent-copy"><h3>' + esc(displayTitle(r)) + '</h3><div class="fd-recent-meta">' + (pathway ? '<span class="fd-chips">' + chips([pathway]) + '</span>' : '') + '<span class="sub">' + esc(r.subject || '') + '</span></div>' + (description ? '<p>' + esc(description) + '</p>' : '') + '</div>' + (ext(path) === 'html' ? '<span class="fd-interactive">INTERACTIVE</span>' : '') + '</a>';
    }).join('');
    // The most recent calendar block already begun that has real packs; if
    // all packs are future blocks, choose the earliest available block.
    var packs = rows.filter(function (r) { return r.kind === 'pack' && r.companionOf && r.halfTerm && Array.isArray(r.files) && r.files.length; });
    var available = HALF_TERMS.filter(function (label) { return packs.some(function (r) { return r.halfTerm === label; }); });
    var begun = available.filter(function (label) { var b = spine && spine.blocks[label]; return b && (b.start || spine.weekStarts[String(b.abs[0])]) <= now; });
    var selected = begun.length ? begun[begun.length - 1] : available[0];
    var group = packs.filter(function (r) { return r.halfTerm === selected; });
    if (group.length) {
      var first = group.slice().sort(function (a, b) { return String(a.subject).localeCompare(String(b.subject)) || String(a.title).localeCompare(String(b.title)); })[0];
      var subjectGroup = group.filter(function (r) { return r.subject === first.subject; });
      var pictured = subjectGroup.filter(function (r) { return previewFor(r).length; }).sort(function (a,b) { return String(a.title).localeCompare(String(b.title)); })[0];
      d.querySelectorAll('[data-pack-preview]').forEach(function (el) {
        var images = pictured ? previewFor(pictured) : [];
        el.innerHTML = images.map(function (item) { return previewImage(item, 'fd-page-preview'); }).join('');
        el.hidden = !images.length;
        el.dataset.previewResource = pictured ? pictured.file : '';
      });
      var present = ['BUILD', 'GROW', 'LAUNCH'].filter(function (p) { return subjectGroup.some(function (r) { return tier(r) === p; }); });
      var formats = [['pptx', 'PowerPoint'], ['docx', 'Word'], ['pdf', 'PDF']].filter(function (pair) { return subjectGroup.some(function (r) { return r.files.some(function (f) { return String(f.type).toLowerCase() === pair[0]; }); }); }).map(function (pair) { return pair[1]; });
      d.querySelectorAll('[data-pack-heading]').forEach(function (el) { el.textContent = first.subject + ' · ' + selected; });
      d.querySelectorAll('[data-pack-pathways]').forEach(function (el) { el.innerHTML = chips(present); });
      d.querySelectorAll('[data-pack-formats]').forEach(function (el) { el.textContent = formats.join(' · '); });
      d.querySelectorAll('[data-pack-link]').forEach(function (el) { el.href = '/resources/?halfTerm=' + encodeURIComponent(selected) + '&type=pack'; });
      d.querySelectorAll('[data-pack-card]').forEach(function (el) { el.hidden = false; el.dataset.packHalfTerm = selected; });
    }
    section.hidden = !recent.length;
  }).catch(function () { section.hidden = true; });
})(window);
