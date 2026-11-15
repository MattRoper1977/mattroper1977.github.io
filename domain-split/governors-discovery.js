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
  const topicPills = [...document.querySelectorAll('[data-topic-pick]')];
  const SYNS = {
    send: ['sen', 'ehcp', 'inclusion', 'neurodiversity', 'semh', 'accessibility'],
    sen: ['send', 'ehcp', 'inclusion'],
    ehcp: ['send', 'special'],
    semh: ['wellbeing', 'mental', 'behaviour', 'send'],
    online: ['safety', 'internet', 'cyber', 'digital', 'filter', 'ceop', 'childnet'],
    internet: ['online', 'safety', 'cyber'],
    cyber: ['online', 'safety', 'digital'],
    safeguarding: ['kcsie', 'nspcc', 'prevent', 'welfare', 'protection', 'dsl'],
    kcsie: ['safeguarding', 'statutory'],
    dsl: ['safeguarding'],
    wellbeing: ['mental', 'health', 'semh', 'pastoral', 'anxiety', 'support'],
    mental: ['wellbeing', 'health'],
    finance: ['funding', 'budget', 'academy', 'handbook', 'trust'],
    budget: ['finance', 'funding'],
    reading: ['phonics', 'literacy', 'books'],
    curriculum: ['science', 'humanities', 'art', 'lifeskills', 'lessons', 'resources'],
  };
  function syncPills() {
    topicPills.forEach(pill => {
      pill.setAttribute('aria-pressed', String((pill.dataset.topicPick || '') === topic.value));
    });
  }
  function filter() {
    const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    form.dataset.filtersActive = String(Boolean(words.length || origin.value || topic.value));
    syncPills();
    let count = 0;
    for (const card of cards) {
      const hay = card.dataset.search || '';
      const match = (!origin.value || origin.value === card.dataset.origin) &&
        (!topic.value || topic.value === card.dataset.topic) &&
        words.every(word => hay.includes(word) || (SYNS[word] || []).some(syn => hay.includes(syn)));
      card.hidden = !match;
      if (match) count++;
    }
    for (const group of groups) group.hidden = !group.querySelector('[data-governance-card]:not([hidden])');
    document.getElementById('gv-result-count').textContent = `${count} ${count === 1 ? 'resource' : 'resources'}`;
    document.getElementById('gv-empty').hidden = count !== 0;
  }
  topicPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const pick = pill.dataset.topicPick || '';
      topic.value = (pick && topic.value === pick) ? '' : pick;
      filter();
    });
  });
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('reset', () => { requestAnimationFrame(() => { filter(); search.focus(); }); });
  filter();
})();
