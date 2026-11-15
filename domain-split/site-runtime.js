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
    if (kind === 'games' && !activity && item.image) {
      const src = validURL(item.image);
      if (src && new URL(src).origin === location.origin) {
        const img = document.createElement('img');
        img.src = src; img.alt = ''; img.loading = 'lazy';
        img.width = 450; img.height = 280;
        img.addEventListener('error', () => img.remove(), { once: true });
        a.classList.add('game-result'); a.append(img);
        const copy = document.createElement('div'); copy.className = 'result-copy';
        copy.append(label, h, p, action); a.append(copy); return a;
      }
    }
    a.append(label, h, p, action); return a;
  }
  const RT_SYNS = {
    electricity: ['circuits', 'current', 'voltage'],
    circuits: ['electricity', 'series', 'parallel'],
    plants: ['photosynthesis', 'leaves', 'roots'],
    photosynthesis: ['plants', 'leaves'],
    forces: ['gravity', 'friction', 'motion', 'magnets'],
    humanities: ['history', 'geography', 'religion', 'ethics'],
    lifeskills: ['money', 'wellbeing', 'careers', 'safety'],
    art: ['drawing', 'painting', 'sculpture'],
    base: ['build'],
    track: ['grow'],
    summit: ['launch'],
    pack: ['slides', 'worksheet', 'editable', 'pptx', 'docx'],
  };
  function rtFuzzy(hw, w) {
    if (w.length < 5 || !/^[a-z]+$/.test(w)) return false;
    const maxD = w.length >= 8 ? 2 : 1;
    for (let i = 0; i < hw.length; i++) {
      const c = hw[i];
      if (c.length < 4 || c[0] !== w[0] || (maxD === 2 && c.slice(0, 2) !== w.slice(0, 2)) || Math.abs(c.length - w.length) > maxD) continue;
      let p = Array.from({ length: w.length + 1 }, (_, k) => k);
      let ok = true;
      for (let a = 1; a <= c.length; a++) {
        const cur = [a];
        let m = a;
        for (let b = 1; b <= w.length; b++) {
          const cost = c[a - 1] === w[b - 1] ? 0 : 1;
          cur[b] = Math.min(cur[b - 1] + 1, p[b] + 1, p[b - 1] + cost);
          if (cur[b] < m) m = cur[b];
        }
        if (m > maxD) { ok = false; break; }
        p = cur;
      }
      if (ok && p[w.length] <= maxD) return true;
    }
    return false;
  }
  function render() {
    if (!form || !catalogue) return;
    const q = document.getElementById(page + '-q').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const pathwaySelect = document.getElementById(page + '-pathway');
    const pathway = pathwaySelect ? pathwaySelect.value.toLowerCase() : '';
    const rows = catalogue[page === 'teachers' ? 'education' : page].filter(item => {
      const text = [item.title, item.description, item.subject, ...(item.keywords || []), ...(Array.isArray(item.pathways) ? item.pathways : [item.pathways])].join(' ').toLowerCase();
      const hw = text.split(/[^a-z0-9]+/).filter(Boolean);
      const qOk = q.every(w => text.includes(w) || (RT_SYNS[w] || []).some(s => text.includes(s)) || rtFuzzy(hw, w));
      return qOk && (!pathway || new RegExp('\\b' + pathway + '\\b').test(text));
    });
    const results = document.getElementById(page + '-results');
    results.replaceChildren(...rows.slice(0, limit).map(item => card(item, false)));
    status.textContent = rows.length ? 'Showing ' + results.children.length + ' of ' + rows.length + (kind === 'games' ? ' games.' : ' results.') : (kind === 'games' ? 'No matches yet. Try a game name, football or adventure.' : 'No matches. Try a shorter topic or choose all pathways.');
    document.getElementById(page + '-more').hidden = rows.length <= limit;
  }
  if (!form && kind !== 'games') return;
  if (status) status.textContent = kind === 'games' ? 'Loading games…' : 'Loading resources…';
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
