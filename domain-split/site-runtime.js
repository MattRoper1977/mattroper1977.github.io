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
  function syncPickButtons() {
    const input = form && document.getElementById(page + '-q');
    const cur = input ? input.value.trim().toLowerCase() : '';
    document.querySelectorAll('[data-search-pick]').forEach(btn => {
      const val = (btn.dataset.searchPick || '').trim().toLowerCase();
      btn.setAttribute('aria-pressed', String(Boolean(val && cur === val)));
    });
  }
  function lessonEntry(raw) {
    const rawStr = typeof raw === 'string' ? raw.trim() : (raw && typeof raw === 'object' ? String(raw.route || raw.url || raw.path || '').trim() : '');
    if (!rawStr || /^(?:javascript|data):/i.test(rawStr)) return null;
    const candidate = rawStr.startsWith('/') ? rawStr : '/Lessons/' + rawStr.replace(/^\/+/, '');
    try {
      const u = new URL(candidate, location.origin);
      if (u.origin !== location.origin || !/^\/Lessons\/.*\.html$/i.test(u.pathname) || /\/games?\//i.test(u.pathname)) return null;
      const parts = u.pathname.replace(/^\/Lessons\//i, '').split('/').filter(Boolean);
      const filePart = parts.length ? parts[parts.length - 1] : '';
      const cleanTitle = decodeURIComponent(filePart.replace(/\.html$/i, '')).replace(/[_-]+/g, ' ').trim();
      const title = (typeof raw === 'object' && raw && raw.title) ? String(raw.title) : cleanTitle;
      if (!title) return null;
      const tierSeg = parts.find(s => /^(build|grow|launch)$/i.test(s));
      const tier = (typeof raw === 'object' && raw && /^(build|grow|launch)$/i.test(String(raw.pathway || '')))
        ? String(raw.pathway).toLowerCase()
        : (tierSeg ? tierSeg.toLowerCase() : '');
      const area = (typeof raw === 'object' && raw && raw.subject)
        ? String(raw.subject)
        : (parts.length > 1 ? decodeURIComponent(parts[0]).replace(/[_-]+/g, ' ').trim() : 'Lesson');
      return { href: u.pathname + u.search + u.hash, title, tier, area };
    } catch (_) {
      return null;
    }
  }
  function initFrontdoorExtras() {
    document.querySelectorAll('[data-search-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = form && document.getElementById(page + '-q');
        if (!input) return;
        const term = (btn.dataset.searchPick || '').trim();
        input.value = input.value.trim().toLowerCase() === term.toLowerCase() ? '' : term;
        syncPickButtons();
        limit = limitStep;
        if (catalogue) render();
      });
    });
    const recentPrefix = page === 'teachers' ? 'teacher' : (page === 'pupils' ? 'pupil' : page);
    const recentSection = document.getElementById(recentPrefix + '-recent');
    const recentList = document.getElementById(recentPrefix + '-recent-list');
    if (recentSection && recentList) {
      let stored = [];
      try { stored = JSON.parse(localStorage.getItem('mbm.lesson.recent.v1') || '[]'); } catch (_) { stored = []; }
      const entries = (Array.isArray(stored) ? stored : []).map(lessonEntry).filter(Boolean).slice(0, 3);
      if (entries.length) {
        recentList.replaceChildren(...entries.map(item => {
          const cardLink = document.createElement('a');
          cardLink.className = 'fd-recent-card';
          cardLink.href = item.href;
          if (item.tier) {
            const pill = document.createElement('span');
            pill.className = 'fd-tier-pill ' + item.tier;
            pill.textContent = ({ BUILD: 'BASE', GROW: 'TRACK', LAUNCH: 'SUMMIT' })[item.tier.toUpperCase()] || item.tier.toUpperCase();
            cardLink.appendChild(pill);
          }
          const h3 = document.createElement('h3');
          h3.textContent = item.title;
          const meta = document.createElement('p');
          meta.textContent = item.area;
          cardLink.append(h3, meta);
          return cardLink;
        }));
        recentSection.hidden = false;
      }
    }
    if (page === 'teachers') {
      const savedCopy = document.querySelector('.fd-shortcut[href="/Lessons/?view=saved"] p');
      if (savedCopy && !savedCopy.querySelector('.fd-saved-count')) {
        let saved = [];
        try { saved = JSON.parse(localStorage.getItem('mbm.lesson.saved.v1') || '[]'); } catch (_) { saved = []; }
        const count = Array.isArray(saved) ? saved.filter(x => (typeof x === 'string' && x.trim()) || (x && typeof x === 'object' && (x.route || x.url || x.path))).length : 0;
        if (count > 0) {
          const badge = document.createElement('span');
          badge.className = 'fd-saved-count';
          badge.textContent = count + (count === 1 ? ' saved lesson' : ' saved lessons');
          savedCopy.append(' ', badge);
        }
      }
    }
  }
  function render() {
    if (!form || !catalogue) return;
    syncPickButtons();
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
  initFrontdoorExtras();
  if (!form && kind !== 'games') return;
  if (status) status.textContent = kind === 'games' ? 'Loading games…' : 'Loading resources…';
  fetch('/data/domain-catalogue.json', { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Catalogue unavailable');
    return response.json();
  }).then(data => {
    catalogue = data;
    if (form) {
      const query = new URLSearchParams(location.search);
      const qInput = document.getElementById(page + '-q');
      if (qInput && !qInput.value) qInput.value = query.get('q') || '';
      form.addEventListener('submit', event => { event.preventDefault(); limit = limitStep; syncPickButtons(); render(); });
      form.addEventListener('input', () => { limit = limitStep; syncPickButtons(); render(); });
      form.addEventListener('change', event => { if (event.target === qInput) return; limit = limitStep; syncPickButtons(); render(); });
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
