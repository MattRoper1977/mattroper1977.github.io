/* Make shared links to a particular FAQ open its native disclosure. */
(() => {
  'use strict';
  function revealFAQ() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    if (!id.startsWith('faq-')) return;
    const target = document.getElementById(id);
    if (!target || !target.matches('details.ad-faq')) return;
    target.open = true;
    target.scrollIntoView({block:'start'});
  }
  function revealSections() {
    document.documentElement.classList.remove('mbm-platform-ready');
    for (const el of document.querySelectorAll('.ad-main .mbm-reveal, .ad-main > .ad-section')) {
      el.classList.add('mbm-reveal', 'is-visible');
    }
  }
  function init() {
    revealSections();
    revealFAQ();
  }
  addEventListener('hashchange', revealFAQ);
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
