(function () {
  'use strict';
  const kind = document.body.dataset.siteKind;
  const page = document.body.dataset.page;
  const form = document.querySelector('[data-search]');
  const status = form && document.getElementById(page + '-status');
  const limitStep = 12;
  let limit = limitStep;
  let catalogue;
  function validURL(route) {
    try {
      const u = new URL(route, location.origin);
      if (u.origin === location.origin || (catalogue.externalRoutes || []).includes(route)) return u.href;
    } catch (_) {}
    return null;
  }
  function card(item, activity) {
    const url = validURL(item.route);
    if (!url) throw new Error('Unexpected catalogue destination');
    const a = document.createElement('a');
    a.className = 'result'; a.href = url;
    const label = document.createElement('small'); label.textContent = item.subject || item.category;
    const h = document.createElement('h3'); h.textContent = item.title;
    const p = document.createElement('p'); p.textContent = item.description || '';
    const action = document.createElement('span'); action.className = 'text-link';
    action.textContent = kind === 'games' ? (activity ? 'Open activity' : 'Play game') : 'Open resource';
    a.append(label, h, p, action); return a;
  }
  function render() {
    if (!form || !catalogue) return;
    const q = document.getElementById(page + '-q').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const pathwaySelect = document.getElementById(page + '-pathway');
    const pathway = pathwaySelect ? pathwaySelect.value.toLowerCase() : '';
    const rows = catalogue[page === 'teachers' ? 'education' : page].filter(item => {
      const text = [item.title, item.description, item.subject, ...(item.keywords || []), ...(Array.isArray(item.pathways) ? item.pathways : [item.pathways])].join(' ').toLowerCase();
      return q.every(w => text.includes(w)) && (!pathway || new RegExp('\\b' + pathway + '\\b').test(text));
    });
    const results = document.getElementById(page + '-results');
    results.replaceChildren(...rows.slice(0, limit).map(item => card(item, false)));
    status.textContent = rows.length ? 'Showing ' + results.children.length + ' of ' + rows.length + ' results.' : 'No matches. Try a shorter topic or choose all pathways.';
    document.getElementById(page + '-more').hidden = rows.length <= limit;
  }
  if (!form && kind !== 'games') return;
  if (status) status.textContent = 'Loading resources…';
  fetch('/data/domain-catalogue.json', { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Catalogue unavailable');
    return response.json();
  }).then(data => {
    catalogue = data;
    if (form) {
      const query = new URLSearchParams(location.search);
      document.getElementById(page + '-q').value = query.get('q') || '';
      form.addEventListener('submit', event => { event.preventDefault(); limit = limitStep; render(); });
      form.addEventListener('input', () => { limit = limitStep; render(); });
      form.addEventListener('change', () => { limit = limitStep; render(); });
      document.getElementById(page + '-more').addEventListener('click', () => {
        const n = document.getElementById(page + '-results').children.length;
        limit += limitStep; render();
        const next = document.getElementById(page + '-results').children[n];
        if (next) next.focus();
      });
      render();
    }
    const activities = document.getElementById('classroom-activities');
    if (activities) activities.replaceChildren(...catalogue.activities.map(item => card(item, true)));
    const staff = document.getElementById('staff-activities');
    if (staff) staff.replaceChildren(...catalogue.staff.map(item => card(item, true)));
  }).catch(() => {
    if (status) status.textContent = 'Search could not load. Please reload, or use the subject and game links above.';
  });
})();
