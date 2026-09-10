/* Native details supplies no-JS/keyboard access; this only adds dismissal. */
(() => {
  'use strict';
  const header = document.querySelector('[data-mbm-navigation="education"]');
  const menu = header?.querySelector('.mbm-unified-menu');
  if (!menu) return;
  const summary = menu.querySelector(':scope > summary');
  const close = returnFocus => {
    menu.open = false;
    menu.querySelectorAll('details[open]').forEach(item => { item.open = false; });
    if (returnFocus) summary.focus();
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (menu.open && !menu.contains(event.target)) close(false);
  }, { passive: true });
  document.addEventListener('focusin', event => {
    if (menu.open && !menu.contains(event.target)) close(false);
  });
  menu.addEventListener('click', event => {
    // The 44px close control returns focus to the control that opened the menu.
    if (event.target.closest('.mbm-menu-close')) { event.preventDefault(); close(true); return; }
    if (event.target.closest('a')) close(false);
  });
  // The header search control jumps to the page's own search field and focuses it.
  const search = header.querySelector('.mbm-unified-search');
  if (search && search.getAttribute('href').startsWith('#')) {
    search.addEventListener('click', event => {
      const field = document.getElementById(search.getAttribute('href').slice(1));
      if (!field) return;
      event.preventDefault();
      field.scrollIntoView({ block: 'center' });
      field.focus();
    });
  }
})();
