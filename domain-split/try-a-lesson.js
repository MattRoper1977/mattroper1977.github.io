/* EDU-TRY-LESSON-20260915 (CX2 §5.3): the homepage "Try a lesson" rotation.
 *
 * The page renders every slide; without this script the first card shows, linked,
 * and the controls stay hidden. Here: 8-second rotation (data-try-seconds), Previous /
 * Next / Pause–Play, a visible "n of N" position, and these rules —
 *   stop  (until an explicit Play): keyboard focus enters the rotation, or a manual
 *         selection (Previous, Next, arrow keys, a horizontal swipe)
 *   pause (resumes by itself): pointer hover, a hidden page, an instance that is not
 *         displayed (the phone and desktop slots are the same rotation twice)
 *   prefers-reduced-motion starts stopped; no automatic focus; no live announcements;
 *   inactive slides are hidden, so nothing inside them is focusable.
 */
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var instances = [];
  Array.prototype.forEach.call(document.querySelectorAll('[data-try-lesson]'), function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-try-slide]'));
    if (slides.length < 2) return;
    var position = root.querySelector('[data-try-position]');
    var controls = root.querySelector('[data-try-controls]');
    var toggle = root.querySelector('[data-try-toggle]');
    var seconds = parseInt(root.getAttribute('data-try-seconds'), 10) || 8;
    var state = { index: 0, playing: !reduced, hovered: false, timer: null };

    function paint() {
      slides.forEach(function (slide, i) {
        if (i === state.index) slide.removeAttribute('hidden'); else slide.setAttribute('hidden', '');
      });
      if (position) position.textContent = (state.index + 1) + ' of ' + slides.length;
      root.setAttribute('data-try-index', String(state.index));
      root.setAttribute('data-try-state', state.playing ? 'playing' : 'stopped');
      if (toggle) {
        toggle.textContent = state.playing ? 'Pause' : 'Play';
        toggle.setAttribute('aria-label', state.playing ? 'Pause the rotation' : 'Play the rotation');
      }
    }
    function displayed() { return root.offsetParent !== null; }
    function ticking() { return state.playing && !state.hovered && !document.hidden && displayed(); }
    function schedule() {
      if (state.timer) { clearInterval(state.timer); state.timer = null; }
      if (!state.playing) return;
      state.timer = setInterval(function () {
        if (!ticking()) return;
        state.index = (state.index + 1) % slides.length; paint();
      }, seconds * 1000);
    }
    function go(delta) {
      state.index = (state.index + delta + slides.length) % slides.length;
      state.playing = false; paint(); schedule();
    }
    function play() { state.playing = true; paint(); schedule(); }
    function stop() { state.playing = false; paint(); schedule(); }

    if (controls) controls.removeAttribute('hidden');
    if (position) position.removeAttribute('hidden');
    root.querySelector('[data-try-prev]').addEventListener('click', function () { go(-1); });
    root.querySelector('[data-try-next]').addEventListener('click', function () { go(1); });
    toggle.addEventListener('click', function () { if (state.playing) stop(); else play(); });
    root.addEventListener('focusin', function () { if (state.playing) stop(); });
    root.addEventListener('mouseenter', function () { state.hovered = true; });
    root.addEventListener('mouseleave', function () { state.hovered = false; });
    root.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    });
    var touchX = null;
    root.addEventListener('pointerdown', function (event) { if (event.pointerType === 'touch') touchX = event.clientX; }, { passive: true });
    root.addEventListener('pointerup', function (event) {
      if (touchX === null || event.pointerType !== 'touch') return;
      var delta = event.clientX - touchX; touchX = null;
      if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
    }, { passive: true });
    root.addEventListener('pointercancel', function () { touchX = null; }, { passive: true });
    paint(); schedule();
    instances.push({ root: root, state: state });
  });
  document.addEventListener('visibilitychange', function () { /* ticking() reads document.hidden on each tick */ });
  document.documentElement.setAttribute('data-try-lesson-ready', String(instances.length));
})();
