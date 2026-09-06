/* Local, optional filtering. No requests, storage or search analytics. */
(() => {
  'use strict';
  const form = document.getElementById('gv-search-form');
  if (!form) return;
  const search = document.getElementById('gv-search');
  const origin = document.getElementById('gv-origin');
  const topic = document.getElementById('gv-topic');
  const cards = [...document.querySelectorAll('[data-governance-card]')];
  const groups = [...document.querySelectorAll('[data-governance-group]')];
  function filter() {
    const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      const match = (!origin.value || origin.value === card.dataset.origin) &&
        (!topic.value || topic.value === card.dataset.topic) &&
        words.every(word => card.dataset.search.includes(word));
      card.hidden = !match;
      if (match) count++;
    }
    for (const group of groups) group.hidden = !group.querySelector('[data-governance-card]:not([hidden])');
    document.getElementById('gv-result-count').textContent = `${count} ${count === 1 ? 'resource' : 'resources'}`;
    document.getElementById('gv-empty').hidden = count !== 0;
  }
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('reset', () => { requestAnimationFrame(() => { filter(); search.focus(); }); });
  filter();
})();
