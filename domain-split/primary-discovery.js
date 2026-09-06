/* Primary publication navigation and filters; no teaching content is replaced. */
(function () {
  'use strict';
  const HUB = '/Lessons/primary/';
  if (!location.pathname.startsWith(HUB) || window.__mbmPrimaryDiscovery) return;
  window.__mbmPrimaryDiscovery = true;
  const isHub = [HUB, HUB + 'index.html'].includes(location.pathname);
  const keys = ['q', 'year_group', 'subject', 'term', 'unit'];
  const cleanText = value => typeof value === 'string' && !/[\\\u0000-\u001f]/.test(value);
  function primaryReturn(value) {
    if (!cleanText(value)) return null;
    try {
      const url = new URL(value, location.origin);
      if (url.origin !== location.origin || ![HUB, HUB + 'index.html'].includes(url.pathname)) return null;
      const result = new URL(HUB, location.origin);
      for (const key of keys) {
        const text = url.searchParams.get(key);
        if (text && cleanText(text)) result.searchParams.set(key, text.slice(0, 200));
      }
      return result.pathname + result.search;
    } catch (_) { return null; }
  }
  function setHref(anchor, value) {
    if (anchor.getAttribute('href') !== value) anchor.setAttribute('href', value);
  }
  function carryReturn(anchor, back) {
    if (anchor.hasAttribute('download')) return;
    try {
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(HUB) || !url.pathname.endsWith('.html')) return;
      if ([HUB, HUB + 'index.html'].includes(url.pathname)) { setHref(anchor, back); return; }
      if (url.pathname === location.pathname) return;
      url.searchParams.set('primary_return', back);
      setHref(anchor, url.pathname + url.search + url.hash);
    } catch (_) {}
  }
  if (isHub) {
    const dataNode = document.getElementById('primary-data');
    if (!dataNode) return;
    const data = JSON.parse(dataNode.textContent), units = data.units;
    const form = document.getElementById('primary-filters');
    const inputs = { q: document.getElementById('primary-search'), year_group: document.getElementById('primary-year'),
      subject: document.getElementById('primary-subject'), term: document.getElementById('primary-term'), unit: document.getElementById('primary-unit') };
    const count = document.getElementById('primary-count'), empty = document.getElementById('primary-empty');
    const blocks = new Map([...document.querySelectorAll('.primary-unit')].map(node => [node.dataset.unit, node]));
    function readLocation() {
      const params = new URLSearchParams(location.search);
      inputs.unit.replaceChildren(new Option('All units', ''), ...units.map(unit => new Option('Year ' + unit.year_group + ' · ' + unit.title, unit.id)));
      for (const key of keys) {
        const value = (params.get(key) || '').slice(0, 200);
        inputs[key].value = key === 'q' || [...inputs[key].options].some(option => option.value === value) ? value : '';
      }
    }
    function render(writeURL = true) {
      const query = inputs.q.value.trim().toLowerCase(), words = query.split(/\s+/).filter(Boolean);
      const selectedYear = inputs.year_group.value, subject = inputs.subject.value, term = inputs.term.value;
      const available = units.filter(unit => (!selectedYear || String(unit.year_group) === selectedYear) && (!subject || unit.subject === subject) && (!term || unit.term === term));
      const previousUnit = inputs.unit.value;
      inputs.unit.replaceChildren(new Option('All units', ''), ...available.map(unit => new Option('Year ' + unit.year_group + ' · ' + unit.title, unit.id)));
      inputs.unit.value = available.some(unit => unit.id === previousUnit) ? previousUnit : '';
      const selectedUnit = inputs.unit.value;
      let unitCount = 0, lessonCount = 0;
      for (const unit of units) {
        const block = blocks.get(unit.id);
        const eligible = available.includes(unit) && (!selectedUnit || unit.id === selectedUnit);
        const common = ['Primary', unit.subject, 'Year ' + unit.year_group, 'Y' + unit.year_group,
          unit.title, unit.term, unit.block, ...unit.tiers, 'scheme of work', 'lesson plans', 'Word', 'download'].join(' ').toLowerCase();
        let matches = 0;
        for (const lesson of unit.lessons) {
          const searchable = [common, lesson.title, lesson.description, ...lesson.keywords].join(' ').toLowerCase();
          const shown = eligible && words.every(word => searchable.includes(word));
          const item = [...block.querySelectorAll('[data-primary-lesson]')].find(node => node.dataset.primaryLesson === lesson.route);
          item.hidden = !shown;
          if (shown) matches++;
        }
        block.hidden = !matches;
        if (matches) { unitCount++; lessonCount += matches; }
      }
      count.textContent = unitCount + ' units · ' + lessonCount + ' lessons · ' + unitCount + ' Word downloads';
      empty.hidden = unitCount > 0;
      const params = new URLSearchParams();
      for (const key of keys) if (inputs[key].value.trim()) params.set(key, inputs[key].value.trim());
      const back = HUB + (params.size ? '?' + params : '');
      if (writeURL) history.replaceState(null, '', back);
      document.querySelectorAll('.primary-lesson, .primary-scheme').forEach(anchor => carryReturn(anchor, back));
    }
    form.addEventListener('submit', event => { event.preventDefault(); render(); });
    inputs.q.addEventListener('input', () => render());
    for (const key of keys.filter(key => key !== 'q')) inputs[key].addEventListener('change', () => render());
    document.getElementById('primary-clear').addEventListener('click', () => {
      for (const input of Object.values(inputs)) input.value = '';
      render(); inputs.q.focus();
    });
    addEventListener('popstate', () => { readLocation(); render(false); });
    readLocation(); render(false);
    return;
  }
  const params = new URLSearchParams(location.search);
  let back = primaryReturn(params.get('primary_return'));
  let primaryReferrer = false;
  try { const referrer = new URL(document.referrer); primaryReferrer = referrer.origin === location.origin && referrer.pathname.startsWith(HUB); } catch (_) {}
  // A lesson reached from the main catalogue must keep its accepted filters.
  // Explicit Primary context travels in links, including links opened in a tab.
  if (!back && !primaryReferrer) {
    try {
      const saved = JSON.parse(sessionStorage.getItem('mbm.lesson.return.v1') || '{}')[location.pathname];
      const url = new URL(saved, location.origin);
      if (cleanText(saved) && url.origin === location.origin && ['/Lessons/', '/Lessons/index.html',
        '/Lessons/Science_Teesside/', '/Lessons/Science_Teesside/index.html',
        '/Lessons/Humanities_Teesside/', '/Lessons/Humanities_Teesside/index.html'].includes(url.pathname)) return;
    } catch (_) {}
  }
  if (!back) {
    const match = location.pathname.match(/^\/Lessons\/primary\/year(\d+)\/([^/]+)\/([^/]+)\/([^/]+)\//);
    const fallback = new URL(HUB, location.origin);
    if (match) {
      fallback.searchParams.set('year_group', match[1]);
      fallback.searchParams.set('subject', match[2][0].toUpperCase() + match[2].slice(1));
      fallback.searchParams.set('term', match[3][0].toUpperCase() + match[3].slice(1));
      fallback.searchParams.set('unit', 'year' + match[1] + '-' + match[4]);
    }
    back = primaryReturn(fallback.href) || HUB;
  }
  function updateReturn() {
    const button = document.getElementById('mbmhud-back');
    if (button) {
      setHref(button, back);
      if (button.textContent !== '← Primary') button.textContent = '← Primary';
      button.setAttribute('aria-label', 'Return to your Primary selection');
    }
    document.querySelectorAll('a[href]').forEach(anchor => {
      if (anchor.matches('a.mbmhome, a[data-lesson-home]')) setHref(anchor, back);
      else carryReturn(anchor, back);
    });
  }
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; updateReturn(); });
  }
  updateReturn();
  new MutationObserver(mutations => {
    if (mutations.some(change => (change.type === 'attributes' && change.target.id === 'mbmhud-back') ||
      (change.type === 'childList' && [...change.addedNodes].some(node => node.nodeType === 1)))) schedule();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
})();
