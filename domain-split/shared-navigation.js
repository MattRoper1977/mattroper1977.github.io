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
    if (event.target.closest('a')) close(false);
  });
})();
