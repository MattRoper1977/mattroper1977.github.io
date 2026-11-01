/* Your shelf — read-only local Save Vault badge wall.
 * Reads existing browser Save Vault keys locally; writes nothing and sends nothing anywhere. */
(function () {
  'use strict';
  var storageBlocked = false;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      if (c === '&') return '&amp;';
      if (c === '<') return '&lt;';
      if (c === '>') return '&gt;';
      if (c === '"') return '&quot;';
      return '&#39;';
    });
  }

  function isPlain(v) {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  function humanLabel(raw) {
    var clean = String(raw || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    if (!clean) return 'Milestone Badge';
    return clean.split(' ').map(function (w) {
      return w.slice(0, 1).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  function formatDate(iso) {
    if (typeof iso !== 'string' || !iso.trim()) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function parseJson(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  var allowEl = $('vault-allowlist');
  var allowMeta = allowEl ? parseJson(allowEl.textContent) : null;
  var exactList = allowMeta && Array.isArray(allowMeta.exactKeys) ? allowMeta.exactKeys : [];
  var sourceMap = allowMeta && isPlain(allowMeta.sources) ? allowMeta.sources : {};
  var allowSet = new Set(exactList);

  var PASSPORT_LABELS = {
    'potion-works': 'Potion Works',
    'sports-passport': 'Sports Passport',
    'arcade-passport': 'Arcade Passport'
  };

  function resolveSource(slug) {
    var key = String(slug || '').toLowerCase();
    var compact = key.replace(/[^a-z0-9]+/g, '');
    if (isPlain(sourceMap[key])) return sourceMap[key];
    if (isPlain(sourceMap[compact])) return sourceMap[compact];
    return { name: PASSPORT_LABELS[key] || humanLabel(slug), route: '' };
  }

  var ARTEFACT_DEFS = {
    crown_core_shifter: { label: 'Crown Core Shifter', source: 'relicforge', kind: 'Arcade Passport artefact' },
    stormbreak_capacitor: { label: 'Stormbreak Capacitor', source: 'trailrunner', kind: 'Arcade Passport artefact' },
    beacon_prism: { label: 'Beacon Prism', source: 'voxel', kind: 'Arcade Passport artefact' },
    geometric_optic: { label: 'Geometric Optic', source: 'offbrand', kind: 'Arcade Passport artefact' }
  };

  var badges = [];
  var seen = new Set();

  function addBadge(sourceSlug, id, label, detail, earnedAt) {
    var cleanId = String(id || label || '').trim();
    if (!cleanId) return;
    var info = resolveSource(sourceSlug);
    var dedupe = info.name.toLowerCase() + ':' + cleanId.toLowerCase();
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    badges.push({
      sourceSlug: String(sourceSlug || 'vault'),
      sourceName: info.name,
      id: cleanId,
      label: label ? String(label).trim() : humanLabel(cleanId),
      detail: detail ? String(detail).trim() : 'Saved locally in your browser Save Vault',
      dateLabel: formatDate(earnedAt),
      route: info.route || ''
    });
  }

  function extractCollection(listOrMap, sourceSlug, fallbackDetail) {
    if (Array.isArray(listOrMap)) {
      listOrMap.forEach(function (item) {
        if (typeof item === 'string') {
          addBadge(sourceSlug, item, humanLabel(item), fallbackDetail, '');
        } else if (isPlain(item)) {
          var itemId = item.id || item.code || item.slug || item.label || item.title || item.name;
          var itemLabel = item.label || item.title || item.name || humanLabel(itemId);
          var tier = item.tier ? (String(item.tier) + ' · ' + fallbackDetail) : (item.description || fallbackDetail);
          addBadge(sourceSlug, itemId, itemLabel, tier, item.earnedAt || item.unlockedAt || item.date || '');
        }
      });
    } else if (isPlain(listOrMap)) {
      Object.keys(listOrMap).forEach(function (k) {
        var val = listOrMap[k];
        if (val === true || typeof val === 'number' && val > 0) {
          addBadge(sourceSlug, k, humanLabel(k), fallbackDetail, '');
        } else if (isPlain(val) && val.unlocked !== false && val.earned !== false) {
          addBadge(sourceSlug, val.id || k, val.label || val.title || val.name || humanLabel(k), val.description || fallbackDetail, val.earnedAt || val.unlockedAt || '');
        }
      });
    }
  }

  function readPotionWorks(doc) {
    if (!isPlain(doc)) return;
    extractCollection(doc.badges, 'potion-works', 'Potion Works mastery badge');
    extractCollection(doc.achievements, 'potion-works', 'Potion Works achievement');
    extractCollection(doc.medals, 'potion-works', 'Potion Works medal');
    extractCollection(doc.masteries, 'potion-works', 'Potion Works recipe mastery');
  }

  var rawPw1 = null;
  var rawPw2 = null;
  var rawSp4 = null;
  var rawSp3 = null;
  var rawAp4 = null;
  var rawCrown = null;
  var rawVec = null;
  var rawV6a = null;
  var rawV6b = null;
  try {
    rawPw1 = localStorage.getItem('mbm_potion_works_v1');
    rawPw2 = localStorage.getItem('mbm_potionworks_v1');
    rawSp4 = localStorage.getItem('mbm_sports_passport_v4');
    rawSp3 = localStorage.getItem('mbm_sports_passport_v3');
    rawAp4 = localStorage.getItem('mbm_arcade_passport_v4');
    rawCrown = localStorage.getItem('mbm_crownbadge_meta_v1');
    rawVec = localStorage.getItem('mbm_vector_overdrive_rewards_v1');
    rawV6a = localStorage.getItem('mbm_v6_profile');
    rawV6b = localStorage.getItem('madebymatt_v6_profile');
  } catch (_) {
    storageBlocked = true;
  }

  readPotionWorks(parseJson(rawPw1));
  readPotionWorks(parseJson(rawPw2));

  var sportsV4 = parseJson(rawSp4);
  var houseTag = '';
  if (isPlain(sportsV4)) {
    if (isPlain(sportsV4.profile) && isPlain(sportsV4.profile.house) && typeof sportsV4.profile.house.value === 'string' && sportsV4.profile.house.value) {
      houseTag = sportsV4.profile.house.value;
    }
    var badgeOrigin = {};
    var receiptDate = {};
    if (Array.isArray(sportsV4.receipts)) {
      sportsV4.receipts.forEach(function (pair) {
        if (!Array.isArray(pair) || pair.length < 2 || !isPlain(pair[1])) return;
        var rec = pair[1];
        if (typeof rec.badge === 'string' && rec.badge.trim()) {
          var bKey = rec.badge.trim();
          var gSlug = (typeof rec.game === 'string' && rec.game !== 'legacy') ? rec.game : 'sports-passport';
          badgeOrigin[bKey] = gSlug;
          receiptDate[bKey] = rec.earnedAt || '';
          addBadge(gSlug, bKey, humanLabel(bKey), houseTag ? ('Sports Passport · House ' + houseTag) : 'Sports Passport medal', rec.earnedAt || '');
        }
      });
    }
    if (isPlain(sportsV4.sets) && isPlain(sportsV4.sets.badges)) {
      var removed = new Set();
      if (Array.isArray(sportsV4.sets.badges.removes)) {
        sportsV4.sets.badges.removes.forEach(function (pair) {
          if (Array.isArray(pair) && typeof pair[0] === 'string') removed.add(pair[0]);
        });
      }
      if (Array.isArray(sportsV4.sets.badges.adds)) {
        sportsV4.sets.badges.adds.forEach(function (pair) {
          if (!Array.isArray(pair) || typeof pair[0] !== 'string') return;
          var tag = pair[0];
          if (removed.has(tag)) return;
          var meta = isPlain(pair[1]) ? pair[1] : {};
          var badgeId = meta.id || meta.value || tag;
          var origin = badgeOrigin[badgeId] || 'sports-passport';
          if (origin === 'sports-passport') {
            ['aurora-links', 'apex-kick', 'apex-pool', 'global-games', 'house-olympiad'].forEach(function (cand) {
              var shortPrefix = cand.split('-')[0];
              if (String(badgeId).toLowerCase().indexOf(shortPrefix) === 0) origin = cand;
            });
          }
          addBadge(origin, badgeId, meta.label || humanLabel(badgeId), houseTag ? ('Sports Passport · House ' + houseTag) : 'Sports Passport badge', meta.earnedAt || receiptDate[badgeId] || '');
        });
      }
    }
  }

  var sportsV3 = parseJson(rawSp3);
  if (isPlain(sportsV3)) {
    extractCollection(sportsV3.badges, 'sports-passport', 'Sports Passport V3 badge');
    if (isPlain(sportsV3.season)) extractCollection(sportsV3.season.badges, 'sports-passport', 'Sports Passport season badge');
  }

  var arcadeV4 = parseJson(rawAp4);
  if (isPlain(arcadeV4)) {
    var artMap = {};
    if (isPlain(arcadeV4.artifacts)) Object.keys(arcadeV4.artifacts).forEach(function (k) { artMap[k] = arcadeV4.artifacts[k]; });
    if (isPlain(arcadeV4.artefacts)) Object.keys(arcadeV4.artefacts).forEach(function (k) { artMap[k] = arcadeV4.artefacts[k]; });
    if (Array.isArray(arcadeV4.unlocks)) {
      arcadeV4.unlocks.forEach(function (id) {
        if (typeof id === 'string' && !artMap[id]) artMap[id] = { id: id };
      });
    }
    Object.keys(artMap).forEach(function (id) {
      var entry = artMap[id];
      if (!isPlain(entry)) return;
      var def = ARTEFACT_DEFS[id] || { label: humanLabel(id), source: entry.source || 'arcade-passport', kind: 'Arcade Passport artefact' };
      var srcSlug = (typeof entry.source === 'string' && entry.source.trim()) ? entry.source.trim() : def.source;
      addBadge(srcSlug, id, entry.label || def.label, def.kind, entry.unlockedAt || arcadeV4.updatedAt || '');
    });
  }

  var crownMeta = parseJson(rawCrown);
  if (isPlain(crownMeta)) {
    extractCollection(crownMeta.badges, 'frontier-watch', 'Frontier Watch commendation');
    extractCollection(crownMeta.medals, 'frontier-watch', 'Frontier Watch medal');
  }

  var vectorRewards = parseJson(rawVec);
  if (isPlain(vectorRewards)) {
    extractCollection(vectorRewards.badges, 'vector-overdrive', 'Vector Overdrive reward');
    extractCollection(vectorRewards.unlocks, 'vector-overdrive', 'Vector Overdrive unlock');
  }

  function readSharedProfile(doc) {
    if (!isPlain(doc) || !isPlain(doc.games)) return;
    Object.keys(doc.games).forEach(function (gKey) {
      var gState = doc.games[gKey];
      if (!isPlain(gState)) return;
      extractCollection(gState.badges, gKey, 'Save Vault profile badge');
      extractCollection(gState.achievements, gKey, 'Save Vault profile achievement');
      extractCollection(gState.medals, gKey, 'Save Vault profile medal');
    });
  }

  readSharedProfile(parseJson(rawV6a));
  readSharedProfile(parseJson(rawV6b));

  var vaultSaves = 0;
  try {
    var totalLen = localStorage.length;
    for (var i = 0; i < totalLen; i++) {
      var storedKey = localStorage.key(i);
      if (storedKey && (allowSet.has(storedKey) || storedKey === 'mbm_potion_works_v1' || storedKey === 'mbm_potionworks_v1' || storedKey.indexOf('voxelfrontier.world.v2.') === 0)) {
        vaultSaves++;
      }
    }
  } catch (_) {
    storageBlocked = true;
  }

  var countEl = $('badge-count');
  var vaultEl = $('vault-key-count');
  var houseEl = $('shelf-house-chip');
  var statusEl = $('shelf-storage-note');
  var emptyEl = $('badge-wall-empty');
  var gridEl = $('badge-wall-grid');

  if (countEl) countEl.textContent = String(badges.length);
  if (vaultEl) vaultEl.textContent = String(vaultSaves);
  if (houseEl && houseTag) {
    houseEl.textContent = 'House ' + houseTag;
    houseEl.hidden = false;
  }
  if (statusEl && storageBlocked) {
    statusEl.textContent = 'Browser storage is blocked in this tab, so local Save Vault badges cannot be read right now.';
    statusEl.hidden = false;
  }

  if (!emptyEl || !gridEl) return;

  if (!badges.length) {
    emptyEl.hidden = false;
    gridEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  gridEl.hidden = false;
  gridEl.innerHTML = badges.map(function (b) {
    var actionHtml = b.route
      ? '<div class="card-actions"><a class="button" href="' + esc(b.route) + '">Open ' + esc(b.sourceName) + ' guide <span aria-hidden="true">→</span></a></div>'
      : '<div class="card-meta"><span class="chip">' + esc(b.sourceName) + ' · Local vault</span></div>';
    var dateChip = b.dateLabel ? '<span class="chip">Earned ' + esc(b.dateLabel) + '</span>' : '';
    return (
      '<article class="launch-card badge-card" data-badge-source="' + esc(b.sourceSlug) + '">'
      + '<div class="badge-card-top">'
      + '<span class="badge-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" focusable="false"><path d="M12 2.5 14.8 8l6 .9-4.3 4.2 1 6-5.5-2.9-5.5 2.9 1-6L3.2 8.9l6-.9L12 2.5Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg></span>'
      + '<div class="badge-heading"><p class="feature-kicker">' + esc(b.sourceName) + '</p>'
      + '<h3 class="badge-title">' + esc(b.label) + '</h3></div>'
      + '</div>'
      + '<p class="muted">' + esc(b.detail) + '</p>'
      + (dateChip ? ('<div class="card-meta">' + dateChip + '</div>') : '')
      + actionHtml
      + '</article>'
    );
  }).join('');
})();
