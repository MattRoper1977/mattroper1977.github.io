/* Play discovery only. These exact keys never contain or clear game saves.
 * The page is complete without this file: every Play link is in the markup.
 * This adds the lanes, live filtering, the Filters drawer and the game sheet. */
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('play-data').textContent);
  const games = data.games, byId = new Map(games.map(g => [g.id, g]));
  const catalogue = games.filter(g => g.group === 'games');
  const keys = {favourites:'mbm_play_favourites_v1',recent:'mbm_play_recently_opened_v1',position:'mbm_play_browse_position_v1'};
  const fields = ['q', 'genre', 'control', 'mode', 'list'];
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
  const cards = [...grid.querySelectorAll('[data-card]')].map(el => ({el, ids: el.dataset.games.split(' ')}));
  const normalize = v => String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Search is scoped to catalogue titles and descriptions.
  const searchable = new Map(games.map(g => [g.id, normalize([g.title, g.displayTitle || '', g.series || '', g.description].join(' '))]));
  const state = {q: '', genre: '', control: '', mode: '', list: ''};
  let activeGame = null, returnFocus = null, cameFromGame = false, filtersOpener = null;

  /* ---- lanes: rendered from the same data the grid was built from ---- */
  function tile(g, meta) {
    const img = g.media && g.media.poster || g.image;
    return '<li class="tile"><button type="button" class="card-open" data-info="' + esc(g.id) + '" aria-haspopup="dialog"><span class="thumb' + (img ? '' : ' thumb-empty') + '">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" width="640" height="360">' : '') + '</span><span class="card-title">' + esc(title(g)) + '</span></button>' +
      (meta ? '<span class="tile-meta">' + esc(meta) + '</span>' : '') +
      '<a class="play small" data-play="' + esc(g.id) + '" href="' + esc(g.route) + '">Play<span class="sr-only"> ' + esc(title(g)) + '</span></a></li>';
  }
  function lane(id, heading, extra, items) {
    return '<section class="lane" id="lane-' + id + '" aria-labelledby="lane-' + id + '-title"><div class="lane-head"><h2 id="lane-' + id + '-title">' + heading + '</h2>' + extra + '</div><ul class="lane-track">' + items.join('') + '</ul></section>';
  }
  function renderLanes() {
    const played = recent.map(id => byId.get(id)).filter(g => g && g.group === 'games').slice(0, 12);
    $('lane-continue').innerHTML = played.length ? lane('continue', 'Continue playing', '<p class="muted">on this device</p><button type="button" id="clear-recent">Clear recently opened</button>', played.map(g => tile(g, g.genre))) : '';
    const updated = catalogue.filter(g => g.updated).sort((a, b) => b.updated.date < a.updated.date ? -1 : b.updated.date > a.updated.date ? 1 : 0);
    $('lane-updated').innerHTML = updated.length ? lane('updated', 'New and updated', '', updated.map(g => tile(g, g.updated.label))) : '';
    $('lanes-genre').innerHTML = data.genres.filter(x => x.count >= 3).map(x => {
      const members = catalogue.filter(g => g.genre === x.name);
      return lane('genre-' + x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), esc(x.name), '<a class="see-all" data-genre="' + esc(x.name) + '" href="?genre=' + encodeURIComponent(x.name) + '#all-games">See all ' + members.length + ' →</a>', members.slice(0, 8).map(g => tile(g, g.genre)));
    }).join('');
    bindImages($('lanes'));
  }
  function bindImages(root) {
    root.querySelectorAll('.thumb img').forEach(img => {
      if (img.dataset.bound) return; img.dataset.bound = '1';
      const failed = () => img.closest('.thumb').classList.add('failed');
      img.addEventListener('error', failed); if (img.complete && !img.naturalWidth && img.src) failed();
    });
  }

  /* ---- filtering ---- */
  function matches(g) {
    const words = normalize(state.q).split(/\s+/).filter(Boolean);
    const selected = state.list === 'favourites' ? favourites : state.list === 'recent' ? recent : null;
    return words.every(w => searchable.get(g.id).includes(w)) && (!state.genre || g.genre === state.genre) &&
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
    state.genre = data.genres.some(x => x.name === params.get('genre')) ? params.get('genre') : '';
    for (const k of ['control', 'mode', 'list']) { const el = $(k), v = params.get(k) || ''; state[k] = [...el.options].some(o => o.value === v) ? v : ''; }
    paintControls();
  }
  function paintControls() {
    query.value = state.q; ['control', 'mode', 'list'].forEach(k => { $(k).value = state[k]; });
    document.querySelectorAll('.chip-button').forEach(b => {
      const on = b.dataset.chip === 'favourites' ? state.list === 'favourites' : b.dataset.chip === 'genre' ? (state.list !== 'favourites' && b.dataset.genre === state.genre) : (state.list !== 'favourites' && !state.genre);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function render({url = true} = {}) {
    const focused = document.activeElement, focusedCard = focused && focused.closest('[data-card]');
    let shown = 0, visibleCards = 0;
    for (const card of cards) {
      const hits = card.ids.map(id => byId.get(id)).filter(g => g && matches(g)).length;
      card.el.hidden = hits === 0; if (hits) { shown += hits; visibleCards++; }
    }
    const ordered = state.list === 'recent' ? [...cards].sort((a, b) => Math.min(...a.ids.map(i => (recent.indexOf(i) + 1 || 1e9))) - Math.min(...b.ids.map(i => (recent.indexOf(i) + 1 || 1e9)))) : cards;
    ordered.forEach((card, index) => { if (grid.children[index] !== card.el) grid.insertBefore(card.el, grid.children[index] || null); });
    $('empty-state').hidden = visibleCards !== 0;
    const selected = state.list === 'favourites' ? favourites : state.list === 'recent' ? recent : null;
    $('empty-description').textContent = selected && selected.length === 0 ? (state.list === 'favourites' ? 'Open a game and press Favourite to start your favourites.' : 'Games appear here when you open them from this collection.') : 'Try a different word or clear a filter.';
    status.textContent = active() ? shown + ' of ' + data.catalogue + ' games' : data.catalogue + ' games';
    $('clear-favourites').hidden = state.list !== 'favourites';
    $('lanes').hidden = active();
    $('filters-open').setAttribute('aria-pressed', String(Boolean(state.control || state.mode || state.list)));
    paintFavourite();
    if (url) syncUrl();
    if (focusedCard) { if (!focusedCard.hidden) focused.focus(); else (grid.querySelector('[data-card]:not([hidden]) .card-open') || $('empty-reset')).focus(); }
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
  const support = [['controls', 'touch', 'Touch'], ['controls', 'keyboard', 'Keyboard'], ['controls', 'gamepad', 'Gamepad'], ['modes', 'single', '1 player'], ['modes', 'local', 'Local multiplayer']];
  const needsKeyboard = g => (g.controls || []).length > 0 && !(g.controls || []).includes('touch');
  function stopMedia() { const video = dialog.querySelector('video'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); } $('dialog-media').replaceChildren(); $('media-status').textContent = ''; }
  function poster(g) {
    const m = g.media || {}, source = m.poster || g.image, figure = document.createElement('figure'), holder = document.createElement('span');
    holder.className = 'thumb'; $('dialog-media').append(figure); figure.append(holder);
    if (!source) { holder.classList.add('failed'); holder.textContent = 'No artwork yet'; return; }
    const img = document.createElement('img'); img.alt = ''; img.width = 640; img.height = 360;
    img.addEventListener('error', () => { holder.classList.add('failed'); holder.textContent = 'Image unavailable'; }); img.src = source; holder.append(img);
  }
  // The address keeps the shelf state (search, chip, filters) and adds ?game=; the shared link is just the game.
  function addressWithGame(g) { const u = new URL(location.href); u.searchParams.set('game', g.id); return u.pathname + u.search + u.hash; }
  function shareUrl(g) { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('game', g.id); return u.href; }
  function openInfo(g, trigger, watch = false) {
    if (!g || typeof dialog.showModal !== 'function') return;
    stopMedia(); activeGame = g; returnFocus = trigger || returnFocus;
    $('dialog-title').textContent = title(g); $('dialog-kind').textContent = g.genre;
    $('dialog-description').textContent = g.description + (g.chapter ? ' New chapter: ' + g.chapter + '.' : '');
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
    const b = $('dialog-favourite'), on = Boolean(activeGame && favourites.includes(activeGame.id));
    b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', (on ? 'Remove favourite: ' : 'Favourite: ') + (activeGame ? title(activeGame) : ''));
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
  function closeInfo() { if (!dialog.open) return; stopMedia(); dialog.close(); activeGame = null; stripGameParam(); if (returnFocus && returnFocus.isConnected) returnFocus.focus(); }
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
  ['control', 'mode', 'list'].forEach(k => $(k).addEventListener('change', () => { state[k] = $(k).value; if (k === 'list' && state.list === 'favourites') state.genre = ''; paintControls(); render(); }));
  $('filters-reset').addEventListener('click', () => { reset(); $('filters-close').focus(); });
  $('filters-form').addEventListener('submit', () => { /* method=dialog closes the drawer */ });

  /* ---- wiring ---- */
  $('discovery-form').addEventListener('submit', e => { e.preventDefault(); state.q = query.value.slice(0, 160); render(); });
  query.addEventListener('input', () => { state.q = query.value.slice(0, 160); render(); });
  $('search-jump').addEventListener('click', e => { e.preventDefault(); query.scrollIntoView({block: 'center'}); query.focus({preventScroll: true}); });
  $('empty-reset').addEventListener('click', reset);
  $('clear-favourites').addEventListener('click', () => { favourites = []; saveList('favourites', []); render({url: false}); storageNotice('Favourites cleared. Game saves were not changed.' + (durable ? '' : ' Storage is unavailable.')); });
  document.addEventListener('click', e => {
    const chip = e.target.closest('.chip-button');
    if (chip) { const kind = chip.dataset.chip; if (kind === 'all') choose({genre: '', list: state.list === 'favourites' ? '' : state.list}, false); else if (kind === 'favourites') choose({genre: '', list: 'favourites'}, true); else choose({genre: chip.dataset.genre, list: state.list === 'favourites' ? '' : state.list}, true); return; }
    const seeAll = e.target.closest('a.see-all');
    if (seeAll && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); choose({genre: seeAll.dataset.genre, list: state.list === 'favourites' ? '' : state.list}, true); return; }
    const clearRecent = e.target.closest('#clear-recent');
    if (clearRecent) { recent = []; saveList('recent', []); renderLanes(); render({url: false}); storageNotice('Recently opened cleared. Game saves were not changed.' + (durable ? '' : ' Storage is unavailable.')); return; }
    const fav = e.target.closest('#dialog-favourite');
    if (fav && activeGame) { const id = activeGame.id; favourites = favourites.includes(id) ? favourites.filter(x => x !== id) : [...favourites, id]; saveList('favourites', favourites); render({url: false}); return; }
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
  window.addEventListener('pageshow', event => { if (durable) { favourites = readList('favourites'); recent = readList('recent'); } renderLanes(); render({url: false}); restorePosition(event); });
  window.addEventListener('popstate', () => { if (dialog.open) closeInfo(); applyUrl(); render({url: false}); });
  window.addEventListener('storage', e => { if (e.key === keys.favourites || e.key === keys.recent) { favourites = readList('favourites'); recent = readList('recent'); renderLanes(); render({url: false}); } });

  /* ---- first paint ---- */
  document.querySelectorAll('[data-editions]').forEach(list => { list.hidden = true; });  // the sheet's Editions row takes over
  if (typeof dialog.showModal === 'function') document.querySelectorAll('[data-watch]').forEach(b => { b.hidden = false; });
  if (coarse()) document.querySelectorAll('[data-needs-keyboard]').forEach(chip => { chip.hidden = false; });
  bindImages(document);
  const previous = browseSnapshot();
  if (previous) {
    try { const from = new URL(document.referrer), path = u => decodeURIComponent(u).replace(/index\.html$/, '').replace(/\/$/, ''); cameFromGame = from.origin === location.origin && games.some(g => path(g.route) === path(from.pathname)); const explicit = fields.some(k => new URLSearchParams(location.search).has(k)); if (cameFromGame && !explicit) history.replaceState({}, '', location.pathname + previous.search + location.hash); } catch (_) {}
  }
  applyUrl(); renderLanes(); render({url: false}); storageNotice(); restorePosition();
  const deepLink = new URLSearchParams(location.search).get('game');
  if (deepLink && byId.has(deepLink)) openInfo(byId.get(deepLink), document.querySelector('#game-grid [data-info="' + CSS.escape(deepLink) + '"], #classroom [data-info="' + CSS.escape(deepLink) + '"]') || $('all-games-title'));
})();
