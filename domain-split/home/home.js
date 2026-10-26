/* Made by Matt — J93 Education Homepage pathway switch (home.js)
 * Progressive enhancement: reveals the flagship pathway switch and filters
 * the three pathway cards without animation, storage, key chords or requests.
 */
(function () {
  'use strict';

  function init() {
    var sw = document.querySelector('[data-pathway-switch]');
    if (!sw) return;

    var btns = sw.querySelectorAll('[data-pathway-btn]');
    var cards = document.querySelectorAll('[data-pathway-card]');
    if (!btns.length || !cards.length) return;

    function apply(mode) {
      var i, btn, card, match;
      for (i = 0; i < btns.length; i++) {
        btn = btns[i];
        btn.setAttribute(
          'aria-pressed',
          btn.getAttribute('data-pathway-btn') === mode ? 'true' : 'false'
        );
      }
      for (i = 0; i < cards.length; i++) {
        card = cards[i];
        match = mode === 'ALL' || card.getAttribute('data-pathway-card') === mode;
        if (match) {
          card.removeAttribute('hidden');
        } else {
          card.setAttribute('hidden', '');
        }
      }
    }

    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          apply(btn.getAttribute('data-pathway-btn') || 'ALL');
        });
      })(btns[i]);
    }

    apply('ALL');
    sw.removeAttribute('hidden');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
