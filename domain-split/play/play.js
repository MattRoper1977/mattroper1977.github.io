/* Made by Matt Play front page (PLAY-D2, 21 Nov 2026).
 * The page is complete without this file: every game is a direct Play link in the
 * A-Z grid and in the noscript list. This adds the four Pick-a-game cards, the mood
 * buttons, Play again, live search, Pick for me, Calm, the How to play guides and
 * the game sheet (?game= deep links). Everything it shows comes from #play-data,
 * which build.py derives from the catalogue and discovery-moods.json.
 * Storage: the existing keys mbm_play_favourites_v1 and mbm_play_recently_opened_v1
 * (same JSON id-list format), mbm_play_browse_position_v1 in sessionStorage, and one
 * new key, mbm_play_calm_v1, written only when Calm is pressed. Game saves are never
 * read, written or cleared here. Nothing on the page moves on its own; no sound. */
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('play-data').textContent);
  const rows = data.games, byId = new Map(rows.map(g => [g.id, g]));
  const catalogue = rows.filter(g => g.group === 'games');
  const keys = {favourites: 'mbm_play_favourites_v1', recent: 'mbm_play_recently_opened_v1', position: 'mbm_play_browse_position_v1', calm: 'mbm_play_calm_v1'};
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const title = g => g.displayTitle || g.title;
  const d = g => g.discovery || {};
  const coarse = () => typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
  const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moods = new Map(data.moods.map(m => [m.id, m]));
  const icon = id => '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false"><use href="#m-' + id + '"/></svg>';
  const TRI = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#i-tri"/></svg>';
  const HEART = '<svg class="heart" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><use href="#i-heart"/></svg>';
  const KEYS_ICON = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><use href="#i-keys"/></svg>';

  /* ---- storage: exact existing format; a blocked store keeps an in-page list ---- */
  let durable = true;
  function readList(name) {
    try {
      const parsed = JSON.parse(localStorage.getItem(keys[name]) || '[]');
      return Array.isArray(parsed) ? [...new Set(parsed.filter(id => typeof id === 'string' && byId.has(id)))].slice(0, rows.length) : [];
    } catch (_) { durable = false; return []; }
  }
  function storageNotice(message) {
    $('storage-status').textContent = message || (durable ? '' : 'Storage is unavailable. Your list works for this open page only; games may have their own storage limits.');
  }
  function saveList(name, value) {
    try { localStorage.setItem(keys[name], JSON.stringify(value)); }
    catch (_) { durable = false; storageNotice(); }
  }
  let favourites = readList('favourites'), recent = readList('recent');

  /* ---- Calm: its own key, on by default under reduced motion ---- */
  function applyCalm(on, persist) {
    document.documentElement.classList.toggle('calm', on);
    $('calm-btn').setAttribute('aria-pressed', String(on));
    if (persist) { try { localStorage.setItem(keys.calm, on ? '1' : '0'); } catch (_) { durable = false; storageNotice(); } }
  }
  function initCalm() {
    let saved = null;
    try { saved = localStorage.getItem(keys.calm); } catch (_) {}
    applyCalm(saved === null ? reducedMotion() : saved === '1', false);
  }

  /* ---- one card design, two sizes; the same markup build.py writes ---- */
  let eagerLeft = data.eager;
  function cardHTML(g, size, extra = {}) {
    const x = d(g), m = moods.get(x.primary), eager = extra.eager || eagerLeft-- > 0;
    return '<article class="card card-' + size + '" data-mood="' + esc(x.primary) + '" data-pick="' + esc(g.id) + '"' + (x.keysOnly ? ' data-keys-only' : '') + '>'
      + '<a class="card-link" href="' + esc(g.route) + '" data-play="' + esc(g.id) + '" aria-label="Play ' + esc(title(g)) + '">'
      + '<span class="card-media thumb"><img src="' + esc(x.picture) + '" alt="" width="640" height="360" ' + (eager ? 'loading="eager"' : 'loading="lazy" decoding="async"') + '>'
      + '<span class="thumb-title" aria-hidden="true">' + esc(title(g)) + '</span>'
      + '<span class="mood-chip" aria-hidden="true">' + icon(m.id) + '<span>' + esc(m.label) + '</span></span>'
      + (extra.today ? '<span class="today-ribbon">Today</span>' : '')
      + (x.keysOnly ? '<span class="kb-badge" data-needs-keyboard' + (coarse() ? '' : ' hidden') + '>' + KEYS_ICON + '<span>Needs keyboard</span></span>' : '') + '</span>'
      + '<span class="card-body"><span class="card-head"><span class="card-title">' + esc(title(g)) + '</span><span class="play-tri" aria-hidden="true">' + TRI + '</span></span>'
      + '<span class="card-hook">' + esc(x.hook) + '</span></span></a>'
      + '<button type="button" class="fav-btn" data-favourite="' + esc(g.id) + '" aria-pressed="' + String(favourites.includes(g.id)) + '" aria-label="Save ' + esc(title(g)) + '">' + HEART + '</button></article>';
  }
  function bindImages(root) {
    root.querySelectorAll('.card-media img, .thumb img').forEach(img => {
      if (img.dataset.bound) return; img.dataset.bound = '1';
      const failed = () => { const box = img.closest('.card-media, .thumb'); if (box) box.classList.add('failed'); img.hidden = true; };
      img.addEventListener('error', failed); if (img.complete && !img.naturalWidth && img.src) failed();
    });
  }
  function paint(host, html) { host.innerHTML = html; bindImages(host); }

  /* ---- date maths: this week's pack by ISO week, Today's pick by local date ---- */
  const isoWeek = (y, m, day) => { const t = new Date(Date.UTC(y, m, day)), n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil((((t - start) / 86400000) + 1) / 7); };
  const dayIndex = (y, m, day) => Math.floor(Date.UTC(y, m, day) / 86400000);
  function forcedPack() {
    const raw = (new URLSearchParams(location.search).get('pack') || '').trim().toLowerCase();
    if (!raw) return null;
    const compact = raw.replace(/[^a-z0-9]/g, '');
    return data.packs.find(p => p.slug === raw || p.name.toLowerCase() === raw || p.slug.replace(/[^a-z0-9]/g, '') === compact || p.slug.startsWith(raw) || p.name.toLowerCase().startsWith(raw)) || null;
  }
  function schedule(date, forced) {
    const y = date.getFullYear(), m = date.getMonth(), day = date.getDate(), week = isoWeek(y, m, day);
    const pack = forced || data.packs[week % data.packs.length], pool = data.todayPool, n = pool.length, di = dayIndex(y, m, day);
    let today = pool[((di % n) + n) % n];
    for (const s of [0, 18, 12, 24, 6, 30]) { const c = pool[(((di + s) % n) + n) % n]; if (!pack.games.includes(c)) { today = c; break; } }
    return {week, pack, today};
  }
  window.__playSchedule = iso => { const [Y, M, D] = iso.split('-').map(Number), s = schedule(new Date(Y, M - 1, D), null); return {date: iso, week: s.week, pack: s.pack.slug, packGames: [...s.pack.games], today: s.today}; };
  function renderPick() {
    const now = new Date(), s = schedule(now, forcedPack()), y = schedule(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), null);
    $('pack-tag').textContent = 'This week: ' + s.pack.name;
    const slots = [...s.pack.games, s.today].map(id => byId.get(id)).filter(Boolean);
    paint($('pick-grid'), slots.map((g, i) => cardHTML(g, 'lg', {eager: true, today: i === 3})).join(''));
    const yg = byId.get(y.today);
    $('yesterday-bar').innerHTML = yg ? '<span>Yesterday’s pick:</span> <a class="yesterday-link" href="' + esc(yg.route) + '" data-play="' + esc(yg.id) + '">' + esc(title(yg)) + '</a>' : '';
  }

  /* ---- moods: primary matches first, then secondary; kept in #mood= ---- */
  const az = [...catalogue].sort((a, b) => title(a).localeCompare(title(b), 'en', {sensitivity: 'base'}));
  const forDevice = list => coarse() ? [...list.filter(g => !d(g).keysOnly), ...list.filter(g => d(g).keysOnly)] : list;
  let activeMood = 'all';
  const moodFromHash = () => { const m = /^#mood=([a-z]+)$/i.exec(location.hash || ''); return m && moods.has(m[1].toLowerCase()) ? m[1].toLowerCase() : 'all'; };
  function renderMoods() {
    document.querySelectorAll('#mood-grid .mood-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mood === activeMood)));
    const box = $('mood-results');
    if (!moods.has(activeMood)) { box.hidden = true; $('mood-cards').innerHTML = ''; return; }
    const list = [...forDevice(az.filter(g => d(g).primary === activeMood)), ...forDevice(az.filter(g => d(g).secondary === activeMood))], m = moods.get(activeMood);
    $('mood-results-title').innerHTML = '<span class="mood-ic" data-mood="' + esc(activeMood) + '">' + icon(m.id) + '</span><span>' + esc(m.label) + ' (' + list.length + ')</span>';
    paint($('mood-cards'), list.map(g => cardHTML(g, 'lg')).join(''));
    box.hidden = false;
  }
  function setMood(mood) {
    activeMood = moods.has(mood) ? mood : 'all';
    const hash = activeMood === 'all' ? '' : '#mood=' + activeMood;
    if (location.hash !== hash) history.pushState(history.state, '', location.pathname + location.search + hash);
    renderMoods();
  }

  /* ---- Play again: up to three recent launches, then Saved ---- */
  function renderAgain() {
    const rec = recent.map(id => byId.get(id)).filter(g => g && g.group === 'games').slice(0, 3), fav = favourites.map(id => byId.get(id)).filter(g => g && g.group === 'games');
    $('again-section').hidden = !rec.length && !fav.length;
    $('recent-block').hidden = !rec.length; $('clear-again-btn').hidden = !rec.length; paint($('recent-grid'), rec.map(g => cardHTML(g, 'sm')).join(''));
    $('saved-block').hidden = !fav.length; paint($('saved-grid'), fav.map(g => cardHTML(g, 'sm')).join(''));
  }

  /* ---- the A-Z grid: server-rendered, filtered here; word-start search ---- */
  const grid = $('game-grid'), query = $('query'), status = $('result-count');
  const gridCards = [...grid.querySelectorAll('[data-card]')];
  if (coarse()) { gridCards.filter(c => c.hasAttribute('data-keys-only')).forEach(c => grid.append(c)); }
  const fold = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const synonyms = {};
  for (const [word, list] of Object.entries(data.synonyms || {})) synonyms[fold(word)] = list.map(fold).filter(Boolean);
  const blobs = new Map(catalogue.map(g => {
    const x = d(g), m1 = moods.get(x.primary), m2 = x.secondary ? moods.get(x.secondary) : null;
    return [g.id, ' ' + fold([title(g), g.title, g.series || '', x.hook, x.primary, x.secondary || '', m1 ? m1.label : '', m2 ? m2.label : '', x.words, x.twoPlayer ? '2p 2 player two player mates versus' : '', x.wholeClass ? 'class team quiz' : ''].join(' '))];
  }));
  function matches(g, raw) {
    const q = fold(raw); if (!q) return true;
    const blob = blobs.get(g.id) || '', has = w => blob.includes(' ' + w);
    if (synonyms[q] && [q, ...synonyms[q]].some(v => v && has(v))) return true;
    return q.split(' ').every(t => has(t) || (synonyms[t] || []).some(has));
  }
  let expanded = false;
  function renderGrid({url = true} = {}) {
    const q = query.value.slice(0, 100), searching = Boolean(fold(q));
    let shown = 0, listed = 0;
    for (const card of grid.querySelectorAll('[data-card]')) {
      const ok = matches(byId.get(card.dataset.card), q);
      if (ok) listed++;
      card.hidden = !ok || (!searching && !expanded && listed > data.collapsed);
      if (!card.hidden) shown++;
    }
    status.textContent = searching ? listed + ' of ' + catalogue.length + ' games' : catalogue.length + ' games';
    $('query-clear').hidden = !q;
    $('empty-state').hidden = listed > 0;
    $('expand-wrap').hidden = searching || listed <= data.collapsed;
    $('expand-btn').textContent = expanded ? 'Show fewer' : 'Show all ' + catalogue.length;
    $('expand-btn').setAttribute('aria-expanded', String(expanded));
    if (url) { const u = new URL(location.href); if (searching) u.searchParams.set('q', q); else u.searchParams.delete('q'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
    return shown;
  }
  function paintFavourites() {
    document.querySelectorAll('[data-favourite]').forEach(b => {
      const g = byId.get(b.dataset.favourite); if (!g) return;
      const on = favourites.includes(g.id); b.hidden = false; b.setAttribute('aria-pressed', String(on));
      if (b.id === 'dialog-favourite') { b.textContent = on ? 'Saved' : 'Favourite'; b.setAttribute('aria-label', (on ? 'Remove favourite: ' : 'Favourite: ') + title(g)); }
    });
    $('dialog-remove-recent').hidden = !activeGame || !recent.includes(activeGame.id);
  }
  function renderAll({url = false} = {}) { renderAgain(); renderGrid({url}); paintFavourites(); }

  /* ---- dialogs: focus stays inside, Escape closes, focus returns ---- */
  function trapTab(host, close) {
    host.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const stops = [...host.querySelectorAll('a[href],button,input,select,textarea,[tabindex],video[controls]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
      const first = stops[0], last = stops[stops.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    host.addEventListener('cancel', e => { e.preventDefault(); close(); });
    host.addEventListener('click', e => { if (e.target === host) { const r = host.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); } });
  }

  /* ---- Pick for me: respects the mood and the device; no repeat of the last six ---- */
  let pickHistory = [], pickOpener = null;
  function pickPool() {
    return catalogue.filter(g => { const x = d(g); if (coarse() && x.keysOnly) return false; if (activeMood !== 'mates' && x.wholeClass) return false; return activeMood === 'all' || x.primary === activeMood || x.secondary === activeMood; });
  }
  function choose() {
    const pool = pickPool(); if (!pool.length) return null;
    const blocked = new Set(pickHistory.slice(-Math.min(6, pool.length - 1))), fresh = pool.filter(g => !blocked.has(g.id)), list = fresh.length ? fresh : pool;
    const g = list[Math.floor(Math.random() * list.length)]; pickHistory = [...pickHistory, g.id].slice(-12); return g;
  }
  function paintPick(g) {
    const x = d(g), m = moods.get(x.primary);
    $('pick-context').textContent = activeMood === 'all' ? 'From all ready games' : 'From ' + moods.get(activeMood).label;
    paint($('pick-card'), '<div class="card pick-media" data-mood="' + esc(x.primary) + '"><span class="card-media thumb"><img src="' + esc(x.picture) + '" alt="" width="640" height="360"><span class="thumb-title" aria-hidden="true">' + esc(title(g)) + '</span><span class="mood-chip" aria-hidden="true">' + icon(m.id) + '<span>' + esc(m.label) + '</span></span></span></div><div class="pick-card-copy"><h3 class="pick-card-title" id="pick-card-title">' + esc(title(g)) + '</h3><p class="pick-card-hook">' + esc(x.hook) + '</p></div>');
    const play = $('pick-play'); play.href = g.route; play.dataset.play = g.id; play.setAttribute('aria-label', 'Play ' + title(g)); $('pick-dialog').dataset.picked = g.id;
  }
  function openPick(trigger) { const g = choose(); if (!g) return; pickOpener = trigger; paintPick(g); if (!$('pick-dialog').open) $('pick-dialog').showModal(); $('pick-play').focus(); }
  function closePick() { if ($('pick-dialog').open) $('pick-dialog').close(); if (pickOpener && pickOpener.isConnected) pickOpener.focus(); }

  /* ---- How to play guides: every game, each opening its game sheet ---- */
  let guidesOpener = null;
  function renderGuides(filter) {
    const q = fold(filter || '');
    $('guides-list').innerHTML = az.filter(g => !q || (' ' + fold(title(g) + ' ' + d(g).hook)).includes(' ' + q)).map(g => '<li class="guide-row"><div class="guide-info"><p class="guide-name">' + esc(title(g)) + '</p><p class="guide-note">' + esc(d(g).hook) + '</p></div><button type="button" class="btn" data-guide="' + esc(g.id) + '" aria-label="How to play ' + esc(title(g)) + '">Guide</button><a class="btn btn-primary" href="' + esc(g.route) + '" data-play="' + esc(g.id) + '" aria-label="Play ' + esc(title(g)) + '">Play</a></li>').join('');
  }
  function openGuides(trigger) { guidesOpener = trigger; $('guides-search').value = ''; renderGuides(''); if (!$('guides-dialog').open) $('guides-dialog').showModal(); $('guides-search').focus(); }
  function closeGuides() { if ($('guides-dialog').open) $('guides-dialog').close(); if (guidesOpener && guidesOpener.isConnected) guidesOpener.focus(); }

  /* ---- the game sheet (How to play guide), unchanged facts from the record ---- */
  const dialog = $('game-dialog');
  let activeGame = null, returnFocus = null;
  const bandLabel = g => (g.sessionBand && data.bandLabels && data.bandLabels[g.sessionBand]) || '';
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
  function addressWithGame(g) { const u = new URL(location.href); u.searchParams.set('game', g.id); return u.pathname + u.search + u.hash; }
  function shareUrl(g) { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('game', g.id); return u.href; }
  function openInfo(g, trigger) {
    if (!g || typeof dialog.showModal !== 'function') return;
    stopMedia(); activeGame = g; returnFocus = trigger || returnFocus;
    $('dialog-title').textContent = title(g); $('dialog-kind').textContent = g.group === 'games' && moods.get(d(g).primary) ? moods.get(d(g).primary).label : 'Lesson activity';
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
    editions.querySelector('ul').innerHTML = members.map(m => '<li' + (m.id === g.id ? ' aria-current="true"' : '') + '><button type="button" class="btn edition-open" data-edition="' + esc(m.id) + '">' + esc(title(m)) + '</button><a class="btn btn-primary play small" data-play="' + esc(m.id) + '" href="' + esc(m.route) + '">Play<span class="sr-only"> ' + esc(title(m)) + '</span></a></li>').join('');
    const lines = g.whatYouDo || [], pills = (g.inputs || []).map(i => '<span class="chip pill-input">' + esc(i) + '</span>').join('') + (bandLabel(g) ? '<span class="chip pill-session">' + esc(bandLabel(g)) + '</span>' : '');
    $('dialog-what-you-do').hidden = !lines.length;
    $('dialog-what-list').innerHTML = lines.map(l => '<li>' + esc(l) + '</li>').join('');
    $('dialog-inputs').innerHTML = lines.length ? pills : '';
    $('dialog-favourite').dataset.favourite = g.id; $('dialog-favourite').hidden = g.group !== 'games'; paintFavourites(); $('share-status').textContent = '';
    poster(g);
    history.replaceState(history.state, '', addressWithGame(g));
    if (!dialog.open) dialog.showModal();
    $('dialog-close').focus();
  }
  function stripGameParam() { const u = new URL(location.href); if (u.searchParams.has('game')) { u.searchParams.delete('game'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } }
  function focusResults() { (grid.querySelector('[data-card]:not([hidden]) a[data-play]') || $('all-games-title')).focus(); }
  function closeInfo() {
    if (!dialog.open) return; stopMedia(); dialog.close(); activeGame = null; stripGameParam();
    // A deep-linked card can sit past the collapsed A-Z view: show the full list so focus returns to it.
    const card = returnFocus && returnFocus.closest && returnFocus.closest('#game-grid [data-card]');
    if (card && card.hidden && !expanded && matches(byId.get(card.dataset.card), query.value)) { expanded = true; renderGrid({url: false}); }
    if (returnFocus && returnFocus.isConnected && returnFocus.getClientRects().length) returnFocus.focus(); else focusResults();
  }
  function playPreview() {
    const g = activeGame; if (!g || !g.media || !g.media.video) return; stopMedia();
    const figure = document.createElement('figure'), video = document.createElement('video'), caption = document.createElement('figcaption');
    video.controls = true; video.preload = 'none'; video.playsInline = true; video.poster = g.media.poster; video.src = g.media.video; video.setAttribute('aria-label', title(g) + ' gameplay preview, silent');
    caption.textContent = Math.round(g.media.duration_seconds) + '-second silent gameplay. ' + g.media.description; figure.append(video, caption); $('dialog-media').append(figure);
    video.addEventListener('error', () => { if (!video.isConnected || activeGame !== g) return; $('media-status').textContent = 'This preview could not play. You can still open the game.'; video.pause(); video.removeAttribute('src'); video.load(); figure.remove(); poster(g); }, {once: true});
    video.play().catch(() => { if (!video.isConnected || activeGame !== g) return; $('media-status').textContent = 'Use the video Play control to start this preview.'; });
  }
  function share() {
    const g = activeGame; if (!g) return; const url = shareUrl(g), payload = {title: title(g) + ' · Made by Matt Play', url};
    if (navigator.share) { navigator.share(payload).catch(() => {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => { $('share-status').textContent = 'Link copied.'; }, () => { $('share-status').textContent = url; });
    else $('share-status').textContent = url;
  }
  function changeRecent(id) {
    recent = recent.filter(x => x !== id); saveList('recent', recent); renderAll();
    storageNotice('Removed from recently opened. Game saves were not changed.' + (durable ? '' : ' Storage is unavailable.'));
    if (dialog.open) $('dialog-close').focus();
  }

  /* ---- position memory across a game visit (sessionStorage; no saves) ---- */
  function rememberPosition() { try { sessionStorage.setItem(keys.position, JSON.stringify({url: location.pathname + location.search, y: scrollY})); } catch (_) {} }
  function restorePosition(event) {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (!((event && event.persisted) || (nav && nav.type === 'back_forward'))) return;
      const p = JSON.parse(sessionStorage.getItem(keys.position) || 'null');
      if (p && typeof p.url === 'string' && Number.isFinite(p.y) && p.y >= 0 && p.url === location.pathname + location.search) requestAnimationFrame(() => scrollTo(0, p.y));
    } catch (_) {}
  }

  /* ---- wiring ---- */
  const menu = document.querySelector('.menu');
  const closeMenu = () => { menu.open = false; };
  $('calm-btn').addEventListener('click', () => applyCalm(!document.documentElement.classList.contains('calm'), true));
  $('search-jump').addEventListener('click', e => { e.preventDefault(); closeMenu(); $('all-games').scrollIntoView({block: 'start'}); query.focus({preventScroll: true}); });
  $('pick-btn').addEventListener('click', e => { closeMenu(); openPick(e.currentTarget); });
  $('pick-another').addEventListener('click', () => { const g = choose(); if (g) paintPick(g); });
  $('pick-close').addEventListener('click', closePick); trapTab($('pick-dialog'), closePick);
  $('guides-close').addEventListener('click', closeGuides); trapTab($('guides-dialog'), closeGuides);
  $('guides-search').addEventListener('input', e => renderGuides(e.target.value));
  $('menu-guides').addEventListener('click', e => { e.preventDefault(); closeMenu(); openGuides(menu.querySelector('summary')); });
  $('teacher-guides').addEventListener('click', e => { e.preventDefault(); openGuides(e.currentTarget); });
  $('menu-teacher').addEventListener('click', e => { e.preventDefault(); closeMenu(); const t = $('classroom'); t.open = true; t.scrollIntoView({block: 'start'}); t.querySelector('summary').focus({preventScroll: true}); });
  menu.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.open) { e.preventDefault(); closeMenu(); menu.querySelector('summary').focus(); } });
  document.addEventListener('click', e => { if (menu.open && !e.target.closest('.menu')) closeMenu(); });
  $('mood-grid').addEventListener('click', e => { const b = e.target.closest('.mood-btn'); if (b) setMood(b.dataset.mood === activeMood ? 'all' : b.dataset.mood); });
  $('mood-back-btn').addEventListener('click', () => { setMood('all'); document.querySelector('#mood-grid .mood-btn[data-mood="all"]').focus(); });
  $('clear-again-btn').addEventListener('click', () => {
    // Clears the recently opened list only: Saved is the player's own choice and is unsaved with its heart.
    recent = []; saveList('recent', []); renderAll();
    storageNotice('List cleared. Game saves were not changed.' + (durable ? '' : ' Storage is unavailable.'));
    $('all-games-title').focus();
  });
  $('discovery-form').addEventListener('submit', e => { e.preventDefault(); renderGrid(); });
  query.addEventListener('input', () => renderGrid());
  query.addEventListener('keydown', e => { if (e.key === 'Escape' && query.value && !dialog.open) { e.preventDefault(); e.stopPropagation(); query.value = ''; renderGrid(); } });
  $('query-clear').addEventListener('click', () => { query.value = ''; renderGrid(); query.focus(); });
  $('empty-reset').addEventListener('click', () => { query.value = ''; renderGrid(); $('all-games-title').focus(); });
  $('expand-btn').addEventListener('click', () => { expanded = !expanded; renderGrid({url: false}); });
  document.addEventListener('click', e => {
    if (e.target.closest('#dialog-share')) { share(); return; }
    if (e.target.closest('#dialog-watch')) { playPreview(); return; }
    const remove = e.target.closest('[data-remove-recent]');
    if (remove) { changeRecent(remove.dataset.removeRecent); return; }
    const fav = e.target.closest('[data-favourite]');
    if (fav && byId.has(fav.dataset.favourite)) {
      const id = fav.dataset.favourite; favourites = favourites.includes(id) ? favourites.filter(x => x !== id) : [...favourites, id];
      saveList('favourites', favourites); renderAgain(); paintFavourites(); storageNotice();
      if (!fav.isConnected) { const twin = document.querySelector('#game-grid [data-favourite="' + CSS.escape(id) + '"]'); (twin && twin.getClientRects().length ? twin : $('all-games-title')).focus(); }
      return;
    }
    const guide = e.target.closest('[data-guide]');
    if (guide) { const g = byId.get(guide.dataset.guide); closeGuides(); openInfo(g, guidesOpener); return; }
    const edition = e.target.closest('[data-edition]');
    if (edition) { openInfo(byId.get(edition.dataset.edition), returnFocus); return; }
    const link = e.target.closest('a[data-play]');
    if (link && byId.has(link.dataset.play)) {
      const id = link.dataset.play; recent = [id, ...recent.filter(x => x !== id)].slice(0, 24); saveList('recent', recent);
      if (dialog.open && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) closeInfo();
      rememberPosition();
    }
  });
  document.addEventListener('auxclick', e => { const link = e.target.closest('a[data-play]'); if (e.button === 1 && link && byId.has(link.dataset.play)) { const id = link.dataset.play; recent = [id, ...recent.filter(x => x !== id)].slice(0, 24); saveList('recent', recent); rememberPosition(); } });
  $('dialog-close').addEventListener('click', () => closeInfo());
  trapTab(dialog, closeInfo);
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !dialog.open && !$('pick-dialog').open && !$('guides-dialog').open && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); $('all-games').scrollIntoView({block: 'start'}); query.focus({preventScroll: true});
    }
  });
  window.addEventListener('hashchange', () => { activeMood = moodFromHash(); renderMoods(); });
  window.addEventListener('popstate', () => { if (dialog.open) closeInfo(); activeMood = moodFromHash(); renderMoods(); });
  window.addEventListener('pagehide', () => { rememberPosition(); stopMedia(); });
  window.addEventListener('pageshow', event => { if (durable) { favourites = readList('favourites'); recent = readList('recent'); } renderAll(); restorePosition(event); });
  window.addEventListener('storage', e => { if (e.key === keys.favourites || e.key === keys.recent) { favourites = readList('favourites'); recent = readList('recent'); renderAll(); } });

  /* ---- first paint ---- */
  document.querySelectorAll('.js-only[hidden]').forEach(el => { el.hidden = false; });
  if (coarse()) document.querySelectorAll('[data-needs-keyboard]').forEach(b => { b.hidden = false; });
  initCalm();
  const params = new URLSearchParams(location.search);
  if (params.get('q')) query.value = params.get('q').slice(0, 100);
  renderPick();
  activeMood = moodFromHash(); renderMoods();
  bindImages(document);
  renderAll(); storageNotice(); restorePosition();
  document.documentElement.dataset.playReady = '1';
  const deepLink = params.get('game');
  if (deepLink && byId.has(deepLink)) openInfo(byId.get(deepLink), grid.querySelector('a[data-play="' + CSS.escape(deepLink) + '"]') || $('all-games-title'));
})();
