(() => {
  'use strict';

  const THEMES = [
    ['cream', 'Cream', '#f6f1e7'],
    ['pink', 'Pink', '#f9e8ec'],
    ['blue', 'Blue', '#e7eef7'],
    ['light', 'White', '#f7f7f4'],
    ['dark', 'Dark', '#101929'],
    ['highlumen', 'High contrast', '#ffffff'],
  ];
  const SCALES = [
    ['100', '100%'],
    ['115', '115%'],
    ['130', '130%'],
  ];
  const THEME_KEY = 'mbm_reading_theme';
  const SCALE_KEY = 'mbm_edu_scale';
  const SPACE_KEY = 'mbm_edu_spacing';
  const RECENT_KEY = 'mbm.lesson.recent.v1';
  const SYNONYMS = {
    electricity: ['circuits', 'current', 'voltage', 'charge', 'bulb'],
    circuits: ['electricity', 'series', 'parallel', 'current'],
    plants: ['photosynthesis', 'leaves', 'roots', 'pollination', 'botany'],
    photosynthesis: ['plants', 'leaves', 'chlorophyll'],
    forces: ['gravity', 'friction', 'motion', 'magnets', 'balanced'],
    matter: ['states', 'particles', 'solids', 'liquids', 'gases'],
    humanities: ['history', 'geography', 'religion', 'ethics', 'community'],
    lifeskills: ['money', 'wellbeing', 'careers', 'safety', 'cooking', 'independence'],
    art: ['drawing', 'painting', 'sculpture', 'printmaking', 'sketchbook', 'studio'],
    base: ['build', 'foundation'],
    track: ['grow', 'core'],
    summit: ['launch', 'extension'],
    timer: ['clock', 'countdown', 'stopwatch', 'toolkit'],
    picker: ['random', 'wheel', 'names', 'toolkit'],
    seating: ['desk', 'room', 'plan'],
    register: ['outcomes', 'portfolio', 'evidence', 'tracking'],
    phonics: ['reading', 'sound', 'decodable'],
    pack: ['slides', 'worksheet', 'editable', 'pptx', 'docx'],
  };

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key) || ''; } catch (_) { return ''; }
  }
  function safeStorageSet(key, value) {
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    } catch (_) {}
  }

  function syncThemeAttr(val) {
    [document.documentElement, document.body].forEach(el => {
      if (!el) return;
      if (val === 'cream') el.removeAttribute('data-theme');
      else el.setAttribute('data-theme', val);
    });
  }

  function applyTheme(t) {
    const val = THEMES.some(([id]) => id === t) ? t : 'cream';
    syncThemeAttr(val);
    safeStorageSet(THEME_KEY, val === 'cream' ? '' : val);
    if (typeof window.__mbmApplyTheme === 'function') window.__mbmApplyTheme(val, true);
    document.querySelectorAll('[data-mbm-theme-slot] [data-t]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-t') === val));
    });
  }
  function applyScale(s) {
    const val = SCALES.some(([id]) => id === s) ? s : '100';
    if (val === '100') document.documentElement.removeAttribute('data-edu-scale');
    else document.documentElement.setAttribute('data-edu-scale', val);
    safeStorageSet(SCALE_KEY, val === '100' ? '' : val);
    document.querySelectorAll('[data-edu-scale]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-edu-scale') === val));
    });
  }
  function applySpacing(on) {
    if (on) document.documentElement.setAttribute('data-edu-spacing', 'dyslexia');
    else document.documentElement.removeAttribute('data-edu-spacing');
    safeStorageSet(SPACE_KEY, on ? 'dyslexia' : '');
    document.querySelectorAll('[data-edu-spacing]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(Boolean(on)));
    });
  }

  // Apply persisted display accommodations immediately.
  const rawTheme = safeStorageGet(THEME_KEY);
  const initTheme = THEMES.some(([id]) => id === rawTheme) ? rawTheme : 'cream';
  if (initTheme !== 'cream') syncThemeAttr(initTheme);
  const initScale = safeStorageGet(SCALE_KEY) || '100';
  if (initScale === '115' || initScale === '130') document.documentElement.setAttribute('data-edu-scale', initScale);
  const initSpace = safeStorageGet(SPACE_KEY) === 'dyslexia';
  if (initSpace) document.documentElement.setAttribute('data-edu-spacing', 'dyslexia');

  function editWithin(a, b, maxD) {
    if (Math.abs(a.length - b.length) > maxD) return false;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const curr = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > maxD) return false;
      prev = curr;
    }
    return prev[b.length] <= maxD;
  }

  function fuzzyWordMatch(hayWords, token) {
    if (token.length < 5 || !/^[a-z]+$/.test(token)) return false;
    const maxD = token.length >= 8 ? 2 : 1;
    for (let i = 0; i < hayWords.length; i++) {
      const cand = hayWords[i];
      if (cand.length < 4 || cand[0] !== token[0]) continue;
      if (maxD === 2 && cand.slice(0, 2) !== token.slice(0, 2)) continue;
      if (Math.abs(cand.length - token.length) > maxD) continue;
      if (editWithin(cand, token, maxD)) return true;
    }
    return false;
  }

  function tokensMatch(hay, query) {
    const clean = String(query || '').toLowerCase().trim();
    if (!clean) return true;
    const words = clean.split(/\s+/).filter(Boolean);
    const hayLower = String(hay || '').toLowerCase();
    const hayWords = hayLower.split(/[^a-z0-9]+/).filter(Boolean);
    return words.every(tok => {
      if (hayLower.includes(tok)) return true;
      const syns = SYNONYMS[tok] || [];
      if (syns.some(s => hayLower.includes(s))) return true;
      return fuzzyWordMatch(hayWords, tok);
    });
  }

  window.MBM_EDU_SEARCH = Object.freeze({ SYNONYMS, fuzzyWordMatch, tokensMatch });

  const header = document.querySelector('[data-mbm-navigation="education"]');
  const menu = header?.querySelector('.mbm-unified-menu');
  if (!header || !menu) return;

  const summary = menu.querySelector(':scope > summary');
  const display = header.querySelector('.mbm-unified-display');
  const displaySummary = display?.querySelector(':scope > summary');
  const closeMenu = returnFocus => {
    menu.open = false;
    menu.querySelectorAll('details[open]').forEach(item => { item.open = false; });
    if (returnFocus && summary) summary.focus();
  };
  const closeDisplay = returnFocus => {
    if (!display) return;
    display.open = false;
    if (returnFocus && displaySummary) displaySummary.focus();
  };

  // Display options: one panel, one tap from the header. Six named reading
  // backgrounds (a swatch and a word each), three text sizes, extra spacing and
  // a reset. Stored keys and values are the ones the site has always used.
  // A page published before this header keeps Display options inside its Menu.
  const displayBox = display?.querySelector('.mbm-display-panel') || header.querySelector('.mbm-menu-display');
  const themeSlot = displayBox?.querySelector('[data-mbm-theme-slot]');
  const hasNativeTheme = Boolean(
    window.__mbmTheme ||
    [...document.scripts].some(s => /(?:^|\/)(?:mbm-)?theme\.js(?:[?#]|$)/i.test(s.getAttribute('src') || ''))
  );
  const heading = text => {
    const h = document.createElement('h3');
    h.textContent = text;
    return h;
  };
  // The older theme script draws six unlabelled dots. Give each its word.
  const nameSwatches = () => {
    if (!themeSlot) return;
    THEMES.forEach(([id, label, fill]) => {
      themeSlot.querySelectorAll('[data-t="' + id + '"]').forEach(btn => {
        btn.setAttribute('aria-label', label + ' reading background');
        btn.title = label;
        if (btn.querySelector('.mbm-sw-word')) return;
        if (!btn.querySelector('i')) {
          const dot = document.createElement('i');
          dot.className = 'mbm-sw-dot';
          btn.textContent = '';
          btn.appendChild(dot);
        }
        btn.querySelector('i').style.background = fill;
        const word = document.createElement('span');
        word.className = 'mbm-sw-word';
        word.textContent = label;
        btn.appendChild(word);
      });
    });
  };
  if (displayBox && themeSlot) {
    header.setAttribute('data-mbm-display', 'ready');
    themeSlot.setAttribute('role', 'group');
    themeSlot.setAttribute('aria-label', 'Reading background');
    themeSlot.before(heading('Reading background'));
    if (!hasNativeTheme && !themeSlot.querySelector('[data-t]')) {
      const cur = document.documentElement.getAttribute('data-theme') || 'cream';
      THEMES.forEach(([id]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mbm-fallback-theme-btn';
        btn.setAttribute('data-t', id);
        btn.setAttribute('aria-pressed', String(id === cur));
        btn.addEventListener('click', () => applyTheme(id));
        themeSlot.appendChild(btn);
      });
    }
    nameSwatches();
    // The theme script may fill the slot after this script has run.
    document.addEventListener('DOMContentLoaded', nameSwatches);
    window.addEventListener('load', nameSwatches);
    if (!displayBox.querySelector('.mbm-display-extras')) {
      const sizes = document.createElement('div');
      sizes.className = 'mbm-display-extras';
      sizes.setAttribute('role', 'group');
      sizes.setAttribute('aria-label', 'Text size');
      SCALES.forEach(([val, label]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-edu-scale', val);
        btn.setAttribute('aria-pressed', String((document.documentElement.getAttribute('data-edu-scale') || '100') === val));
        btn.textContent = 'Text ' + label;
        btn.addEventListener('click', () => applyScale(val));
        sizes.appendChild(btn);
      });
      const spacing = document.createElement('div');
      spacing.className = 'mbm-display-extras';
      const spaceBtn = document.createElement('button');
      spaceBtn.type = 'button';
      spaceBtn.setAttribute('data-edu-spacing', 'dyslexia');
      spaceBtn.setAttribute('aria-pressed', String(document.documentElement.getAttribute('data-edu-spacing') === 'dyslexia'));
      spaceBtn.textContent = 'Extra spacing';
      spaceBtn.addEventListener('click', () => {
        applySpacing(document.documentElement.getAttribute('data-edu-spacing') !== 'dyslexia');
      });
      spacing.appendChild(spaceBtn);
      const reset = document.createElement('div');
      reset.className = 'mbm-display-extras mbm-display-reset';
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'mbm-display-reset-btn';
      resetBtn.textContent = 'Reset to default';
      resetBtn.addEventListener('click', () => { applyTheme('cream'); applyScale('100'); applySpacing(false); });
      reset.appendChild(resetBtn);
      displayBox.append(heading('Text size'), sizes, heading('Spacing'), spacing, reset);
    }
  }

  // Only one of the two panels is open at a time; a tap or focus outside closes it.
  menu.addEventListener('toggle', () => { if (menu.open) closeDisplay(false); });
  display?.addEventListener('toggle', () => { if (display.open) closeMenu(false); });
  document.addEventListener('pointerdown', event => {
    if (menu.open && !menu.contains(event.target)) closeMenu(false);
    if (display?.open && !display.contains(event.target)) closeDisplay(false);
  }, { passive: true });
  document.addEventListener('focusin', event => {
    if (menu.open && !menu.contains(event.target)) closeMenu(false);
    if (display?.open && !display.contains(event.target)) closeDisplay(false);
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('.mbm-menu-close')) { event.preventDefault(); closeMenu(true); return; }
    if (event.target.closest('.mbm-menu-display-open') && display) {
      event.preventDefault();
      closeMenu(false);
      display.open = true;
      displaySummary.focus();
      return;
    }
    if (event.target.closest('a')) closeMenu(false);
  });
  display?.addEventListener('click', event => {
    if (event.target.closest('.mbm-display-close')) { event.preventDefault(); closeDisplay(true); }
  });

  const search = header.querySelector('.mbm-unified-search');
  if (search && (search.getAttribute('href') || '').startsWith('#')) {
    search.addEventListener('click', event => {
      const field = document.getElementById(search.getAttribute('href').slice(1));
      if (!field) return;
      event.preventDefault();
      field.scrollIntoView({ block: 'center' });
      field.focus();
    });
  }

  // Lazy-loaded Global Quick-Search Command Palette (#edu-cmd-dialog).
  let searchEntries = null;
  let searchLoading = null;
  let cmdKind = '';
  let lastOpener = null;

  function loadUnifiedEntries() {
    if (searchEntries) return Promise.resolve(searchEntries);
    if (searchLoading) return searchLoading;
    searchLoading = fetch('/data/mbm-unified-search.json', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => {
        const list = Array.isArray(data.entries) ? data.entries : [];
        searchEntries = list;
        return searchEntries;
      })
      .catch(() => {
        const fallback = [];
        if (window.MBM_HUB?.state?.rows) {
          window.MBM_HUB.state.rows.forEach(r => {
            if (r._path) {
              fallback.push({
                title: r.displayTitle || r.title || r._path,
                route: '/Lessons/' + String(r._path).replace(/^\/+/, ''),
                kind: r.kind === 'pack' ? 'packs' : 'lessons',
                meta: [r.subject, r.halfTerm, r._tier].filter(Boolean).join(' · '),
                hay: [r.displayTitle, r.title, r.subject, r.family, r.unit, r.halfTerm, ...(r.keywords || [])].join(' '),
              });
            }
          });
        }
        document.querySelectorAll('main a[href]').forEach(a => {
          const href = a.getAttribute('href') || '';
          const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
          if (href.startsWith('/') && text) {
            fallback.push({ title: text, route: href, kind: 'tools', meta: href, hay: text + ' ' + href });
          }
        });
        searchEntries = fallback;
        return searchEntries;
      });
    return searchLoading;
  }

  function ensureCmdDialog() {
    let dlg = document.getElementById('edu-cmd-dialog');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'edu-cmd-dialog';
    dlg.className = 'edu-cmd-dialog';
    dlg.setAttribute('aria-labelledby', 'edu-cmd-title');
    dlg.innerHTML =
      '<div class="edu-cmd-wrap">' +
      '<div class="edu-cmd-top"><h2 id="edu-cmd-title">Quick find</h2>' +
      '<button type="button" class="edu-cmd-close" id="edu-cmd-close">Close</button></div>' +
      '<label class="sr-only" for="edu-cmd-input">Search lessons, help, packs and tools</label>' +
      '<input id="edu-cmd-input" class="edu-cmd-input" type="search" autocomplete="off" spellcheck="false" placeholder="Type a topic, week, subject or tool…">' +
      '<div class="edu-cmd-chips" role="group" aria-label="Filter quick find">' +
      '<button type="button" class="edu-cmd-chip" data-cmd-kind="" aria-pressed="true">All</button>' +
      '<button type="button" class="edu-cmd-chip" data-cmd-kind="lessons" aria-pressed="false">Lessons</button>' +
      '<button type="button" class="edu-cmd-chip" data-cmd-kind="packs" aria-pressed="false">Packs</button>' +
      '<button type="button" class="edu-cmd-chip" data-cmd-kind="tools" aria-pressed="false">Tools &amp; Studios</button>' +
      '</div>' +
      '<p class="edu-cmd-status" id="edu-cmd-status" aria-live="polite"></p>' +
      '<ul class="edu-cmd-list" id="edu-cmd-list"></ul>' +
      '</div>';
    document.body.appendChild(dlg);

    const input = dlg.querySelector('#edu-cmd-input');
    const closeBtn = dlg.querySelector('#edu-cmd-close');
    const status = dlg.querySelector('#edu-cmd-status');
    const listEl = dlg.querySelector('#edu-cmd-list');

    function renderResults() {
      const q = (input.value || '').trim();
      const rows = (searchEntries || []).filter(item => (!cmdKind || item.kind === cmdKind) && tokensMatch(item.hay || (item.title + ' ' + item.meta), q));
      const shown = rows.slice(0, 12);
      status.textContent = q ? `${rows.length} matches${rows.length > 12 ? ' (showing first 12)' : ''}` : `${rows.length} items indexed`;
      listEl.replaceChildren();
      shown.forEach(item => {
        const li = document.createElement('li');
        li.className = 'edu-cmd-item';
        const a = document.createElement('a');
        a.href = item.route;
        const strong = document.createElement('strong');
        strong.textContent = item.title;
        const small = document.createElement('small');
        small.textContent = item.meta || item.route;
        a.appendChild(strong);
        a.appendChild(small);
        li.appendChild(a);
        listEl.appendChild(li);
      });
    }

    input.addEventListener('input', renderResults);
    dlg.querySelectorAll('.edu-cmd-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        cmdKind = chip.getAttribute('data-cmd-kind') || '';
        dlg.querySelectorAll('.edu-cmd-chip').forEach(c => {
          c.setAttribute('aria-pressed', String(c === chip));
        });
        renderResults();
      });
    });
    const hideCmd = () => {
      if (typeof dlg.close === 'function' && dlg.open) dlg.close();
      else {
        dlg.removeAttribute('open');
        if (lastOpener && lastOpener.isConnected) lastOpener.focus();
      }
    };
    closeBtn.addEventListener('click', hideCmd);
    dlg.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hideCmd();
      }
    });
    dlg.addEventListener('click', e => {
      if (e.target === dlg) hideCmd();
    });
    dlg.addEventListener('close', () => {
      if (lastOpener && lastOpener.isConnected) lastOpener.focus();
    });
    dlg._renderResults = renderResults;
    return dlg;
  }

  function openCmd(opener) {
    lastOpener = opener || document.activeElement;
    const dlg = ensureCmdDialog();
    if (!dlg.open) {
      if (typeof dlg.showModal === 'function') {
        try { dlg.showModal(); } catch (_) { dlg.setAttribute('open', ''); }
      } else {
        dlg.setAttribute('open', '');
      }
    }
    const status = dlg.querySelector('#edu-cmd-status');
    status.textContent = 'Loading quick find…';
    dlg.querySelector('#edu-cmd-input').focus();
    loadUnifiedEntries().then(() => dlg._renderResults());
  }

  // Site-wide Ctrl/Cmd+K and non-destructive / keyboard shortcuts.
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === 'Escape' && display?.open) {
      event.preventDefault();
      closeDisplay(true);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openCmd(document.activeElement);
      return;
    }
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.key !== '/') return;
    const active = document.activeElement;
    if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)) return;
    if (document.querySelector('dialog[open]') || menu.open || display?.open) return;
    const localSearch = document.querySelector('#search, #tq, #rxSearch, #teachers-q, #pupils-q, #teach-search, #teach-results-query, #resource-q, #gv-search');
    if (localSearch && localSearch.offsetParent !== null) {
      event.preventDefault();
      localSearch.scrollIntoView({ block: 'center' });
      localSearch.focus();
    } else {
      event.preventDefault();
      openCmd(active);
    }
  });

  // Collapsible Snake-Side Wayfinder Rail on workspace/catalogue surfaces.
  const normPath = location.pathname.replace(/index\.html$/i, '');
  const RAIL_ROUTES = ['/Lessons/', '/Lessons/subject.html', '/resources/', '/tools/', '/teach/'];
  if (RAIL_ROUTES.includes(normPath)) {
    const rail = document.createElement('aside');
    rail.id = 'edu-snake-rail';
    rail.className = 'edu-snake-rail';
    rail.setAttribute('aria-label', 'Wayfinder and quick navigation');
    rail.innerHTML =
      '<div class="edu-snake-bar">' +
      '<button type="button" class="edu-snake-fab" id="edu-snake-toggle" aria-expanded="false" aria-controls="edu-snake-panel">Wayfinder</button>' +
      '<button type="button" class="edu-snake-fab" id="edu-cmd-open" aria-haspopup="dialog">Quick find</button>' +
      '</div>' +
      '<div class="edu-snake-panel" id="edu-snake-panel" hidden>' +
      '<div class="snake-head"><p class="snake-title">Wayfinder</p>' +
      '<button type="button" class="snake-close" id="edu-snake-close">Close</button></div>' +
      '<div class="snake-sec"><p class="snake-h">Subjects &amp; areas</p>' +
      '<div class="snake-links">' +
      '<a href="/Lessons/">All lessons</a>' +
      '<a href="/Lessons/subject.html?subject=science">Science</a>' +
      '<a href="/Lessons/subject.html?subject=humanities-re">Humanities &amp; RE</a>' +
      '<a href="/Lessons/subject.html?subject=art-studio">Art Studio</a>' +
      '<a href="/Lessons/subject.html?subject=lifeskills">Lifeskills</a>' +
      '<a href="/resources/">Packs</a>' +
      '<a href="/tools/">Tools</a>' +
      '<a href="/Matt-s-Apps-/">Studios</a>' +
      '<a href="/teach/">Workspace</a>' +
      '</div></div>' +
      '<div class="snake-sec" id="snake-pathway-sec" hidden><p class="snake-h">Pathway bridge</p><div class="snake-links" id="snake-pathways"></div></div>' +
      '<div class="snake-sec" id="snake-week-sec" hidden><p class="snake-h">Half-term snake track</p><div class="snake-weeks" id="snake-weeks"></div></div>' +
      '<div class="snake-sec" id="snake-recent-sec" hidden><p class="snake-h">Pick up where you left off</p><div class="snake-links" id="snake-recent"></div></div>' +
      '</div>';
    header.insertAdjacentElement('afterend', rail);

    const toggleBtn = rail.querySelector('#edu-snake-toggle');
    const closeBtn = rail.querySelector('#edu-snake-close');
    const panel = rail.querySelector('#edu-snake-panel');
    const cmdBtn = rail.querySelector('#edu-cmd-open');

    function setRailOpen(open, restoreFocus) {
      panel.hidden = !open;
      toggleBtn.setAttribute('aria-expanded', String(open));
      if (open) {
        syncRailState();
        closeBtn.focus();
      } else if (restoreFocus) {
        toggleBtn.focus();
      }
    }

    function syncRailState() {
      const currentHref = location.pathname + location.search;
      rail.querySelectorAll('.snake-links a[href]').forEach(a => {
        const href = a.getAttribute('href');
        const active = href === currentHref || (normPath === '/Lessons/' && href === '/Lessons/') || (!location.search && href === normPath);
        if (active) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });

      const segTabs = [...document.querySelectorAll('#seg [role="tab"]')];
      const pwSec = rail.querySelector('#snake-pathway-sec');
      const pwBox = rail.querySelector('#snake-pathways');
      if (segTabs.length) {
        pwSec.hidden = false;
        pwBox.replaceChildren();
        const names = { BUILD: 'BASE', GROW: 'TRACK', SUMMIT: 'SUMMIT', LAUNCH: 'SUMMIT', ALL: 'All' };
        segTabs.forEach(tab => {
          const btn = document.createElement('button');
          btn.type = 'button';
          const key = tab.dataset.pathway || '';
          btn.textContent = names[key] || tab.textContent.trim();
          btn.setAttribute('aria-pressed', tab.getAttribute('aria-selected') || 'false');
          btn.addEventListener('click', () => { tab.click(); syncRailState(); });
          pwBox.appendChild(btn);
        });
      } else {
        pwSec.hidden = true;
      }

      const wkBtns = [...document.querySelectorAll('#sci-weeks button[data-week-filter]')];
      const wkSec = rail.querySelector('#snake-week-sec');
      const wkBox = rail.querySelector('#snake-weeks');
      if (wkBtns.length > 1) {
        wkSec.hidden = false;
        wkBox.replaceChildren();
        const specific = wkBtns.filter(b => b.getAttribute('data-week-filter'));
        for (let i = 0; i < specific.length; i += 3) {
          const row = document.createElement('div');
          row.className = 'snake-row' + ((Math.floor(i / 3) % 2 === 1) ? ' snake-row-rev' : '');
          specific.slice(i, i + 3).forEach(srcBtn => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'snake-wk-btn';
            b.textContent = srcBtn.textContent.replace(/^.*?·\s*/, '').trim() || srcBtn.textContent.trim();
            b.setAttribute('aria-label', srcBtn.textContent.trim());
            b.setAttribute('aria-pressed', srcBtn.getAttribute('aria-pressed') || 'false');
            b.addEventListener('click', () => { srcBtn.click(); syncRailState(); });
            row.appendChild(b);
          });
          wkBox.appendChild(row);
        }
      } else {
        wkSec.hidden = true;
      }

      const recSec = rail.querySelector('#snake-recent-sec');
      const recBox = rail.querySelector('#snake-recent');
      let recentList = [];
      try { recentList = JSON.parse(safeStorageGet(RECENT_KEY) || '[]'); } catch (_) { recentList = []; }
      const firstRecent = Array.isArray(recentList) ? recentList.find(p => typeof p === 'string' && p && !/^(?:javascript|data):/i.test(p)) : '';
      if (firstRecent) {
        recSec.hidden = false;
        recBox.replaceChildren();
        const a = document.createElement('a');
        a.href = firstRecent.startsWith('/') ? firstRecent : '/Lessons/' + firstRecent.replace(/^\/+/, '');
        const cleanTitle = decodeURIComponent(firstRecent.split('/').pop().replace(/\.[^.]+$/, '')).replace(/[_-]+/g, ' ');
        a.textContent = cleanTitle || 'Resume last lesson';
        recBox.appendChild(a);
      } else {
        recSec.hidden = true;
      }
    }

    toggleBtn.addEventListener('click', () => setRailOpen(panel.hidden, false));
    closeBtn.addEventListener('click', () => setRailOpen(false, true));
    cmdBtn.addEventListener('click', () => openCmd(cmdBtn));
    rail.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.hidden) {
        e.preventDefault();
        setRailOpen(false, true);
      }
    });
  }
})();
