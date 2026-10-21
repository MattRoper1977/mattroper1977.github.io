/* Play discovery only. These exact keys never contain or clear game saves.
 * The page is complete without this file: every Play link is in the markup.
 * This adds the spotlight's Next control, the shelves' previous/next controls,
 * live filtering (search, category and input chips), the Filters drawer and the
 * game sheet (deep links and Surprise me only; cards never open it). */
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('play-data').textContent);
  const games = data.games, byId = new Map(games.map(g => [g.id, g]));
  const catalogue = games.filter(g => g.group === 'games');
  const keys = {favourites:'mbm_play_favourites_v1',recent:'mbm_play_recently_opened_v1',position:'mbm_play_browse_position_v1'};
  const fields = ['q', 'mood', 'genre', 'control', 'mode', 'list'];
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title = g => g.displayTitle || g.title;
  const coarse = () => typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
  let durable = true;
  document.documentElement.classList.add('js');
  function readList(name) {
    try {
      const parsed = JSON.parse(localStorage.getItem(keys[name]) || '[]');
      return Array.isArray(parsed) ? [...new Set(parsed.filter(id => typeof id === 'string' && byId.has(id)))].slice(0, games.length) : [];
    } catch (_) { durable = false; return []; }
  }
  let favourites = readList('favourites'), recent = readList('recent');
  function storageNotice(message) {
    $('storage-status').textContent = message || (durable ? '' : 'Storage is unavailable. Your shortlist works for this open page only; games may have their own storage limits.');
  }
  function saveList(name, value) {
    try { localStorage.setItem(keys[name], JSON.stringify(value)); }
    catch (_) { durable = false; storageNotice(); }
  }
  const grid = $('game-grid'), status = $('result-count'), query = $('query'), dialog = $('game-dialog'), filters = $('filters');
  const cards = [...grid.querySelectorAll('[data-card]')].map(el => ({el, ids: el.dataset.games.split(' '), shown: el.dataset.card}));
  const activityCards = [...grid.querySelectorAll('[data-activity]')].map(el => ({el, g: byId.get(el.dataset.activity)}));
  const normalize = v => String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Search covers title, category and the one-line descriptions (TX (b)).
  const searchable = new Map(games.map(g => [g.id, normalize([g.title, g.displayTitle || '', g.series || '', g.genre, g.line || '', g.description].join(' '))]));
  const state = {q: '', mood: '', genre: '', control: '', mode: '', list: ''};
  let activeGame = null, returnFocus = null, cameFromGame = false, filtersOpener = null;

  /* ---- spotlight: one featured game at a time, advanced only by Next ---- */
  const spots = [...document.querySelectorAll('[data-spot]')];
  let spotIndex = 0;
  function showSpot(i) {
    spotIndex = (i + spots.length) % spots.length;
    spots.forEach((el, k) => { el.hidden = k !== spotIndex; });
    $('spot-status').textContent = (spotIndex + 1) + ' of ' + spots.length;
  }
  if (spots.length > 1) {
    $('spot-next').hidden = false; $('spot-status').hidden = false; showSpot(0);
    $('spot-next').addEventListener('click', () => showSpot(spotIndex + 1));
  }
  /* ---- shelves: 44px previous/next scroll each horizontal track ---- */
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shelves = [...document.querySelectorAll('[data-shelf]')].map(el => ({el, track: el.querySelector('.shelf-track'), nav: el.querySelector('.shelf-nav'), count: el.querySelector('[data-shelf-count]'), base: el.querySelector('[data-shelf-count]').textContent}));
  function paintShelfNav(s) {
    const t = s.track, overflow = t.scrollWidth > t.clientWidth + 1;
    s.nav.hidden = !overflow;
    const [prev, next] = s.nav.querySelectorAll('[data-shelf-step]');
    prev.disabled = t.scrollLeft <= 1; next.disabled = t.scrollLeft + t.clientWidth >= t.scrollWidth - 1;
  }
  shelves.forEach(s => {
    s.nav.addEventListener('click', e => { const b = e.target.closest('[data-shelf-step]'); if (!b) return; s.track.scrollBy({left: Number(b.dataset.shelfStep) * Math.max(160, s.track.clientWidth * 0.9), behavior: reduced() ? 'auto' : 'smooth'}); });
    s.track.addEventListener('scroll', () => paintShelfNav(s), {passive: true});
  });
  const paintShelves = () => shelves.forEach(paintShelfNav);
  window.addEventListener('resize', paintShelves);
  function bindImages(root) {
    root.querySelectorAll('.thumb img').forEach(img => {
      if (img.dataset.bound) return; img.dataset.bound = '1';
      const failed = () => { const t = img.closest('.thumb'), card = t.closest('[data-card],[data-activity],[data-spot]'), name = card && card.querySelector('.card-title,.feature-title'); t.className = 'thumb thumb-block failed'; t.innerHTML = '<span class="thumb-title">' + esc(name ? name.textContent : '') + '</span>'; };
      img.addEventListener('error', failed); if (img.complete && !img.naturalWidth && img.src) failed();
    });
  }

  /* ---- filtering ---- */
  function matches(g) {
    const words = normalize(state.q).split(/\s+/).filter(Boolean);
    const selected = state.list === 'favourites' ? favourites : state.list === 'recent' ? recent : null;
    return words.every(w => searchable.get(g.id).includes(w)) && (!state.genre || g.genre === state.genre) && (!state.mood || (g.moods || []).includes(state.mood)) &&
      (!state.control || (state.control === 'unknown' ? !(g.controls || []).length : (g.controls || []).includes(state.control))) &&
      (!state.mode || (state.mode === 'unknown' ? !(g.modes || []).length : (g.modes || []).includes(state.mode))) &&
      (!selected || selected.includes(g.id));
  }
  const active = () => fields.some(k => state[k]);
  function syncUrl() {
    const url = new URL(location.href); fields.forEach(k => url.searchParams.delete(k));
    fields.forEach(k => { if (state[k]) url.searchParams.set(k, state[k]); });
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  function applyUrl() {
    const params = new URLSearchParams(location.search);
    state.q = (params.get('q') || '').slice(0, 160);
    state.mood = ['Calm','Fast','Thinky','Together'].includes(params.get('mood')) ? params.get('mood') : '';
    state.genre = data.genres.some(x => x.name === params.get('genre')) ? params.get('genre') : '';
    for (const k of ['control', 'mode', 'list']) { const el = $(k), v = params.get(k) || ''; state[k] = [...el.options].some(o => o.value === v) ? v : ''; }
    paintControls();
  }
  function paintControls() {
    query.value = state.q; ['genre', 'control', 'mode', 'list'].forEach(k => { $(k).value = state[k]; });
    document.querySelectorAll('.chip-button').forEach(b => {
      const on = b.dataset.chip === 'genre' ? state.genre === b.dataset.genre : b.dataset.chip === 'control' ? state.control === b.dataset.control : !state.genre && !state.control && !state.mood;
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function render({url = true} = {}) {
    const focused = document.activeElement, focusedCard = focused && focused.closest('[data-card]');
    let shown = 0, visibleCards = 0;
    for (const card of cards) {
      const hits = card.ids.map(id => byId.get(id)).filter(g => g && matches(g));
      card.el.hidden = hits.length === 0;
      if (hits.length) {
        shown += hits.length; visibleCards++;
        // A series card must launch a matching edition, not its unfiltered lead.
        const g = hits[0], play = card.el.querySelector('.card-actions [data-play]');
        const changedEdition = card.shown !== g.id; card.shown = g.id;
        card.el.querySelector('.card-title').textContent = active() ? title(g) : (g.series || title(g));
        card.el.querySelector('.card-line').textContent = g.line || g.genre;
        play.dataset.play = g.id; play.href = g.route; play.querySelector('.sr-only').textContent = ' ' + title(g);
        // The card's Play anchor above is repointed at the matching edition, so the static
        // edition list is derived here too: exactly card.ids minus whoever the Play anchor
        // holds, in the markup's order. That is idempotent, so returning to the unfiltered
        // lead restores the original list, and the card's distinct hrefs always equal its
        // full edition set.
        const others = card.ids.filter(id => id !== g.id);
        card.el.querySelectorAll('[data-editions] > li').forEach((li, i) => {
          const edition = byId.get(others[i]), anchor = li.querySelector('a[data-play]');
          if (!edition || !anchor) return;
          anchor.dataset.play = edition.id; anchor.href = edition.route;
          const label = anchor.querySelector('.sr-only'); if (label) label.textContent = ' ' + title(edition);
          const name = li.querySelector('.edition-name'); if (name) name.textContent = title(edition);
        });
        card.el.querySelector('[data-favourite]').dataset.favourite = g.id;
        if (changedEdition) {
          const source = g.media && g.media.poster || g.image, thumb = card.el.querySelector('.thumb');
          thumb.className = 'thumb' + (source ? '' : ' thumb-block');
          thumb.innerHTML = source ? '<img src="' + esc(source) + '" alt="" loading="lazy" width="640" height="360">' : '<span class="thumb-title">' + esc(title(g)) + '</span>';
          if (source) thumb.removeAttribute('aria-hidden'); else thumb.setAttribute('aria-hidden', 'true');
          card.el.querySelector('.card-meta').innerHTML = (card.ids.length > 1 ? '<span class="chip">' + card.ids.length + ' editions</span>' : '') + (g.updated ? '<span class="chip">Updated ' + esc(g.updated.label) + '</span>' : '') + (needsKeyboard(g) ? '<span class="chip warn" data-needs-keyboard' + (coarse() ? '' : ' hidden') + '>Needs a keyboard</span>' : '');
          bindImages(card.el);
        }
      }
    }
    // Activities live on the Classroom shelf: shown for All, the Classroom chip and a search.
    const activityState = !state.mood && !state.control && !state.mode && !state.list && (!state.genre || state.genre === 'Classroom');
    const words = normalize(state.q).split(/\s+/).filter(Boolean);
    let shownActivities = 0;
    for (const a of activityCards) { const on = activityState && words.every(w => searchable.get(a.g.id).includes(w)); a.el.hidden = !on; if (on) shownActivities++; }
    // Recently opened orders cards within each shelf; every card keeps its own shelf.
    for (const s of shelves) {
      const own = cards.filter(c => c.el.parentElement === s.track);
      const ordered = state.list === 'recent' ? [...own].sort((a, b) => Math.min(...a.ids.map(i => (recent.indexOf(i) + 1 || 1e9))) - Math.min(...b.ids.map(i => (recent.indexOf(i) + 1 || 1e9)))) : own;
      ordered.forEach((card, index) => { if (s.track.children[index] !== card.el) s.track.insertBefore(card.el, s.track.children[index] || null); });
      const visibleHere = [...s.track.children].filter(el => !el.hidden);
      s.el.hidden = visibleHere.length === 0;
      if (active()) { const n = visibleHere.filter(el => el.dataset.card).reduce((t, el) => t + cards.find(c => c.el === el).ids.filter(id => matches(byId.get(id))).length, 0), m = visibleHere.length - visibleHere.filter(el => el.dataset.card).length; s.count.textContent = n + (n === 1 ? ' game' : ' games') + (m ? ' · ' + m + ' activities' : ''); } else s.count.textContent = s.base;
    }
    $('empty-state').hidden = visibleCards + shownActivities !== 0;
    const selected = state.list === 'favourites' ? favourites : state.list === 'recent' ? recent : null;
    $('empty-description').textContent = selected && selected.length === 0 ? (state.list === 'favourites' ? 'Press the heart on a game card to start your favourites.' : 'Games appear here when you open them from this collection.') : 'Try a different word or clear a filter.';
    status.textContent = active() ? shown + ' of ' + data.catalogue + ' games' : data.catalogue + ' games';
    $('clear-favourites').hidden = state.list !== 'favourites';
    $('clear-recent-list').hidden = state.list !== 'recent';
    $('list-note').hidden = state.list !== 'recent';
    $('surprise-status').textContent = '';
    grid.querySelectorAll('[data-remove-recent]').forEach(b => b.remove());
    if (state.list === 'recent') for (const card of cards.filter(c => !c.el.hidden)) {
      const g = byId.get(card.shown), button = document.createElement('button');
      button.type = 'button'; button.className = 'remove-recent'; button.dataset.removeRecent = g.id;
      button.textContent = 'Remove'; button.setAttribute('aria-label', 'Remove from recently opened: ' + title(g)); card.el.append(button);
    }
    $('lanes').hidden = active();
    $('filters-open').setAttribute('aria-pressed', String(Boolean(state.genre || state.control || state.mode || state.list)));
    document.querySelectorAll('[data-collection]').forEach(a => { if (a.dataset.collection === state.list) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    paintFavourite();
    if (url) syncUrl();
    paintShelves();
    if (focusedCard && !dialog.open) { if (!focusedCard.hidden && focused.isConnected) focused.focus(); else focusResults(); }
  }
  function reset() { fields.forEach(k => { state[k] = ''; }); paintControls(); render(); }
  function choose(patch, scroll) {
    Object.assign(state, patch); paintControls(); render();
    if (scroll) $('all-games').scrollIntoView();
  }

  /* ---- position memory across a game visit (sessionStorage; no saves) ---- */
  function rememberPosition() {
    try { sessionStorage.setItem(keys.position, JSON.stringify({url: location.pathname + location.search, y: scrollY})); } catch (_) {}
  }
  const shelfPaths = new Set(['/', '/games/', '/Games/', '/main/', '/for/pupils/', '/Lessons/']);
  function browseSnapshot() { try { const p = JSON.parse(sessionStorage.getItem(keys.position) || 'null'); if (!p || typeof p.url !== 'string' || !Number.isFinite(p.y) || p.y < 0) return null; const u = new URL(p.url, location.origin), pathname = u.pathname.replace(/index\.html$/, ''); if (u.origin !== location.origin || !shelfPaths.has(pathname) || u.search.length > 700) return null; return {url: pathname + u.search, y: p.y, search: u.search}; } catch (_) { return null; } }
  function restorePosition(event) {
    const p = browseSnapshot(), back = (event && event.persisted) || (performance.getEntriesByType('navigation')[0] || {}).type === 'back_forward';
    if (p && p.search === location.search && (cameFromGame || back)) requestAnimationFrame(() => scrollTo(0, p.y));
  }

  /* ---- the game sheet ---- */
  const support = [['controls', 'touch', 'Touch'], ['controls', 'keyboard', 'Keyboard'], ['controls', 'gamepad', 'Gamepad'], ['modes', 'single', '1 player'], ['modes', 'local', 'Local / same-network options'], ['modes', 'classroom-teams', 'Shared-screen teams']];
  const needsKeyboard = g => (g.controls || []).length > 0 && !(g.controls || []).includes('touch');
  function stopMedia() { const video = dialog.querySelector('video'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); } $('dialog-media').replaceChildren(); $('media-status').textContent = ''; }
  function poster(g) {
    const m = g.media || {}, source = m.poster || g.image, figure = document.createElement('figure'), holder = document.createElement('span');
    holder.className = 'thumb'; $('dialog-media').append(figure); figure.append(holder);
    if (!source) { holder.classList.add('failed'); holder.textContent = 'Game screen not yet available'; return; }
    const img = document.createElement('img'); img.alt = ''; img.width = 640; img.height = 360;
    img.addEventListener('error', () => { holder.classList.add('failed'); holder.textContent = 'Image unavailable'; }); img.src = source; holder.append(img);
    const caption = document.createElement('figcaption'); caption.textContent = m.poster ? 'Captured gameplay preview.' : g.imageCaption || 'Captured game screen.'; figure.append(caption);
  }
  // The address keeps the shelf state (search, chip, filters) and adds ?game=; the shared link is just the game.
  function addressWithGame(g) { const u = new URL(location.href); u.searchParams.set('game', g.id); return u.pathname + u.search + u.hash; }
  function shareUrl(g) { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('game', g.id); return u.href; }
  function openInfo(g, trigger, watch = false) {
    if (!g || typeof dialog.showModal !== 'function') return;
    stopMedia(); activeGame = g; returnFocus = trigger || returnFocus;
    $('dialog-title').textContent = title(g); $('dialog-kind').textContent = g.genre;
    $('dialog-description').textContent = g.description + (g.chapter ? ' New chapter: ' + g.chapter + '.' : '');
    const facts = g.details || {};
    $('dialog-mood').hidden = !g.moodReason; $('dialog-mood').textContent = g.moodReason || '';
    const usefulInstructions = g.instructions && !/Player modes|Command one campaign|Single pilot|Source documents|Same-device|Two players on one device/.test(g.instructions);
    $('dialog-controls').textContent = facts.controls || (usefulInstructions ? g.instructions : (g.controls || []).length ? 'Use the game’s How to play or Controls screen for its key bindings and touch actions.' : 'Controls and device support have not yet been verified.');
    $('dialog-players').textContent = facts.players || ((g.modes || []).length ? g.instructions : 'Player modes have not yet been verified.');
    $('dialog-accessibility').textContent = facts.accessibility || 'Check the game’s own settings for sound, motion and display options. Accessibility features have not yet been fully verified.';
    $('dialog-saves').textContent = facts.saves || 'Save support has not yet been verified for this game. Favourites and recent launches do not store game progress.';
    $('dialog-remove-recent').dataset.removeRecent = g.id;
    const chips = support.filter(([f, v]) => (g[f] || []).includes(v)).map(([, , label]) => label);
    $('dialog-support').innerHTML = (chips.length ? chips : ['Not yet verified']).map(c => '<span class="chip">' + esc(c) + '</span>').join('');
    $('dialog-keyboard').hidden = !(needsKeyboard(g) && coarse());
    const play = $('dialog-play'); play.href = g.route; play.dataset.play = g.id; play.textContent = 'Play ' + title(g) + ' →';
    $('dialog-watch').hidden = !(g.media && g.media.video);
    const editions = $('dialog-editions'), members = (g.editions || []).map(id => byId.get(id)).filter(Boolean);
    editions.hidden = members.length < 2;
    editions.querySelector('ul').innerHTML = members.map(m => '<li' + (m.id === g.id ? ' aria-current="true"' : '') + '><button type="button" class="edition-open" data-edition="' + esc(m.id) + '">' + esc(title(m)) + '</button><a class="play small" data-play="' + esc(m.id) + '" href="' + esc(m.route) + '">Play<span class="sr-only"> ' + esc(title(m)) + '</span></a></li>').join('');
    $('dialog-favourite').dataset.favourite = g.id; paintFavourite(); $('share-status').textContent = '';
    poster(g);
    history.replaceState(history.state, '', addressWithGame(g));
    if (!dialog.open) dialog.showModal();
    $('dialog-close').focus();
    if (watch) playPreview();
  }
  function paintFavourite() {
    document.querySelectorAll('[data-favourite]').forEach(b => {
      const g = byId.get(b.dataset.favourite); if (!g) return;
      const on = favourites.includes(g.id); b.hidden = false;
      b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', (on ? 'Remove favourite: ' : 'Favourite: ') + title(g));
      if (b.classList.contains('favourite')) b.innerHTML = (on ? '♥' : '♡') + '<span class="sr-only"> Favourite</span>';
    });
    $('dialog-remove-recent').hidden = !activeGame || !recent.includes(activeGame.id);
  }
  function focusResults() { (grid.querySelector('[data-shelf]:not([hidden]) :is([data-card],[data-activity]):not([hidden]) .card-actions a[data-play]') || $('empty-reset')).focus(); }
  function changeRecent(id) {
    const opener = document.activeElement, inSheet = dialog.open;
    recent = id ? recent.filter(x => x !== id) : []; saveList('recent', recent);
    render({url: false});
    storageNotice((id ? 'Removed from recently opened.' : 'Recently opened cleared.') + ' Game saves were not changed.' + (durable ? '' : ' Storage is unavailable.'));
    if (inSheet) $('dialog-close').focus();
    else if (!opener.isConnected || !opener.getClientRects().length) focusResults();
  }
  function playPreview() {
    const g = activeGame; if (!g || !g.media || !g.media.video) return; stopMedia();
    const figure = document.createElement('figure'), video = document.createElement('video'), caption = document.createElement('figcaption');
    video.controls = true; video.preload = 'none'; video.playsInline = true; video.poster = g.media.poster; video.src = g.media.video; video.setAttribute('aria-label', title(g) + ' gameplay preview, silent');
    caption.textContent = Math.round(g.media.duration_seconds) + '-second silent gameplay. ' + g.media.description; figure.append(video, caption); $('dialog-media').append(figure);
    video.addEventListener('error', () => { if (!video.isConnected || activeGame !== g) return; $('media-status').textContent = 'This preview could not play. You can still open the game.'; video.pause(); video.removeAttribute('src'); video.load(); figure.remove(); poster(g); }, {once: true});
    video.play().catch(() => { if (!video.isConnected || activeGame !== g) return; $('media-status').textContent = 'Use the video Play control to start this preview.'; });
  }
  function stripGameParam() { const u = new URL(location.href); if (u.searchParams.has('game')) { u.searchParams.delete('game'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } }
  function closeInfo() { if (!dialog.open) return; stopMedia(); dialog.close(); activeGame = null; stripGameParam(); if (returnFocus && returnFocus.isConnected && returnFocus.getClientRects().length) returnFocus.focus(); else focusResults(); }
  function share() {
    const g = activeGame; if (!g) return; const url = shareUrl(g), payload = {title: title(g) + ' · Made by Matt Play', url};
    if (navigator.share) { navigator.share(payload).catch(() => {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => { $('share-status').textContent = 'Link copied.'; }, () => { $('share-status').textContent = url; });
    else $('share-status').textContent = url;
  }
  function trapTab(host) {
    host.addEventListener('keydown', e => { if (e.key !== 'Tab') return; const stops = [...host.querySelectorAll('a[href],button,input,select,textarea,[tabindex],video[controls]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length); const first = stops[0], last = stops[stops.length - 1]; if (!first) { e.preventDefault(); host.focus(); return; } if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } });
    host.addEventListener('click', e => { if (e.target === host) { const r = host.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) (host === dialog ? closeInfo : closeFilters)(); } });
  }

  /* ---- the Filters drawer ---- */
  function openFilters(trigger) { if (typeof filters.showModal !== 'function') return; filtersOpener = trigger; filters.showModal(); $('filters-open').setAttribute('aria-expanded', 'true'); $('filters-close').focus(); }
  function closeFilters() { if (filters.open) filters.close(); }
  filters.addEventListener('close', () => { $('filters-open').setAttribute('aria-expanded', 'false'); if (filtersOpener && filtersOpener.isConnected) filtersOpener.focus(); });
  filters.addEventListener('cancel', e => { e.preventDefault(); closeFilters(); });
  $('filters-open').addEventListener('click', e => openFilters(e.currentTarget));
  ['genre', 'control', 'mode', 'list'].forEach(k => $(k).addEventListener('change', () => { state[k] = $(k).value; paintControls(); render(); }));
  $('filters-reset').addEventListener('click', () => { reset(); $('filters-close').focus(); });
  $('filters-form').addEventListener('submit', () => { /* method=dialog closes the drawer */ });

  /* ---- wiring ---- */
  $('discovery-form').addEventListener('submit', e => { e.preventDefault(); state.q = query.value.slice(0, 160); render(); });
  query.addEventListener('input', () => { state.q = query.value.slice(0, 160); render(); });
  $('search-jump').addEventListener('click', e => { e.preventDefault(); query.scrollIntoView({block: 'center'}); query.focus({preventScroll: true}); });
  $('empty-reset').addEventListener('click', () => { reset(); $('all-games-title').focus(); });
  $('surprise').hidden = false;
  $('surprise').addEventListener('click', e => {
    const eligible = catalogue.filter(matches);
    if (!eligible.length) { $('surprise-status').textContent = 'No games match these choices. Clear a filter to try Surprise me.'; $('empty-reset').focus(); return; }
    openInfo(eligible[Math.floor(Math.random() * eligible.length)], e.currentTarget);
  });
  $('clear-favourites').addEventListener('click', () => { favourites = []; saveList('favourites', []); render({url: false}); storageNotice('Favourites cleared. Game saves were not changed.' + (durable ? '' : ' Storage is unavailable.')); });
  document.addEventListener('click', e => {
    const collection = e.target.closest('a[data-collection]');
    if (collection && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); choose({q: '', mood: '', genre: '', control: '', mode: '', list: collection.dataset.collection}, true); $('all-games-title').focus({preventScroll: true}); return; }
    const chip = e.target.closest('.chip-button');
    if (chip) {
      const kind = chip.dataset.chip;
      if (kind === 'genre') choose({genre: state.genre === chip.dataset.genre ? '' : chip.dataset.genre}, true);
      else if (kind === 'control') choose({control: state.control === chip.dataset.control ? '' : chip.dataset.control}, true);
      else choose({mood: '', genre: '', control: ''}, false);
      return;
    }
    if (e.target.closest('[data-clear-recent]')) { changeRecent(); return; }
    const remove = e.target.closest('[data-remove-recent]');
    if (remove) { changeRecent(remove.dataset.removeRecent); return; }
    const fav = e.target.closest('[data-favourite]');
    if (fav && byId.has(fav.dataset.favourite)) {
      const id = fav.dataset.favourite; favourites = favourites.includes(id) ? favourites.filter(x => x !== id) : [...favourites, id];
      saveList('favourites', favourites); render({url: false}); return;
    }
    if (e.target.closest('#dialog-share')) { share(); return; }
    const link = e.target.closest('a[data-play]');
    if (link) { const id = link.dataset.play; if (byId.has(id)) { recent = [id, ...recent.filter(x => x !== id)].slice(0, 24); saveList('recent', recent); if (dialog.open && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) closeInfo(); rememberPosition(); } return; }
    const edition = e.target.closest('[data-edition]');
    if (edition) { openInfo(byId.get(edition.dataset.edition), returnFocus); return; }
    const info = e.target.closest('[data-info], [data-watch]');
    if (info) { openInfo(byId.get(info.dataset.info || info.dataset.watch), info, Boolean(info.dataset.watch)); }
  });
  document.addEventListener('auxclick', e => { const link = e.target.closest('a[data-play]'); if (e.button === 1 && link && byId.has(link.dataset.play)) { const id = link.dataset.play; recent = [id, ...recent.filter(x => x !== id)].slice(0, 24); saveList('recent', recent); rememberPosition(); } });
  $('dialog-watch').addEventListener('click', playPreview);
  $('dialog-close').addEventListener('click', () => closeInfo());
  dialog.addEventListener('cancel', e => { e.preventDefault(); closeInfo(); });
  trapTab(dialog); trapTab(filters);
  document.querySelector('.menu').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.open = false; e.currentTarget.querySelector('summary').focus(); } });
  document.querySelectorAll('.menu a').forEach(a => a.addEventListener('click', () => { document.querySelector('.menu').open = false; }));
  window.addEventListener('pagehide', () => { rememberPosition(); stopMedia(); });
  window.addEventListener('pageshow', event => { if (durable) { favourites = readList('favourites'); recent = readList('recent'); } render({url: false}); restorePosition(event); });
  window.addEventListener('popstate', () => { if (dialog.open) closeInfo(); applyUrl(); render({url: false}); });
  window.addEventListener('storage', e => { if (e.key === keys.favourites || e.key === keys.recent) { favourites = readList('favourites'); recent = readList('recent'); render({url: false}); } });

  /* ---- first paint ---- */
  if (coarse()) document.querySelectorAll('[data-needs-keyboard]').forEach(chip => { chip.hidden = false; });
  bindImages(document);
  const previous = browseSnapshot();
  if (previous) {
    try { const from = new URL(document.referrer), path = u => decodeURIComponent(u).replace(/index\.html$/, '').replace(/\/$/, ''); cameFromGame = from.origin === location.origin && games.some(g => path(g.route) === path(from.pathname)); const explicit = fields.some(k => new URLSearchParams(location.search).has(k)); if (cameFromGame && !explicit) history.replaceState({}, '', location.pathname + previous.search + location.hash); } catch (_) {}
  }
  applyUrl(); render({url: false}); storageNotice(); restorePosition();
  const deepLink = new URLSearchParams(location.search).get('game');
  if (deepLink && byId.has(deepLink)) openInfo(byId.get(deepLink), document.querySelector('#game-grid a[data-play="' + CSS.escape(deepLink) + '"]') || $('all-games-title'));
})();
