/* Shared hub tile & AAA polish enhancer (S-1-2, S-7-3).
 * Active strictly on hub surfaces (home, the five audience pages, Lessons, Resources, Tools);
 * inert everywhere else (never inside lesson pages or packs).
 */
(function () {
  'use strict';

  function canonicalRoute(pathname) {
    var clean = String(pathname || '/').split('#')[0].split('?')[0].replace(/index\.html$/i, '');
    if (!clean.endsWith('/')) clean += '/';
    return clean;
  }

  function collectHubRoutes() {
    var routes = { '/': true };
    var brand = document.querySelector('a.mbm-brand[href], a.brand[href]');
    if (brand) {
      routes[canonicalRoute(brand.getAttribute('href'))] = true;
    }
    var hubLinks = document.querySelectorAll('[data-mbm-hub-links] a[href]');
    for (var i = 0; i < hubLinks.length; i++) {
      routes[canonicalRoute(hubLinks[i].getAttribute('href'))] = true;
    }
    if (document.querySelector('main.ad-main')) {
      var audienceLinks = document.querySelectorAll(
        'nav.ad-audiences a[href], .mbm-menu-group a[href^="/for/"], .mf-switch-grid a[href^="/for/"]'
      );
      for (var j = 0; j < audienceLinks.length; j++) {
        routes[canonicalRoute(audienceLinks[j].getAttribute('href'))] = true;
      }
    }
    return routes;
  }

  var TILE_SELECTOR = [
    '.home-door-card',
    '.home-pathway-card',
    'a.home-subject-tile',
    '.home-tool-card',
    '.ad-card',
    '.ad-steps > li',
    '.ad-nav > a',
    '.ad-audiences > a',
    '#subjects .scard',
    '.tiles > .tile',
    '#added-rail .acard',
    '.pillars > li',
    '.rx-cardx',
    '.th-card',
    '.th-collections a'
  ].join(', ');

  var PRIMARY_ACTION_SELECTOR = [
    'a.home-start-btn[href]',
    'a.ad-action[href]',
    'a.browse[href]',
    'a.go[href]',
    'a.home-card-link[href]'
  ].join(', ');

  function primaryLinkOf(tile) {
    if (!tile || tile.tagName === 'A') return null;
    var explicit = tile.querySelector(PRIMARY_ACTION_SELECTOR);
    if (explicit) return explicit;
    var links = tile.querySelectorAll('a[href]');
    return links.length === 1 ? links[0] : null;
  }

  function enhanceHero() {
    var h1 = document.querySelector('main .home-masthead h1#home-title.home-descriptor');
    if (!h1 || h1.hasAttribute('data-mbm-hero-enhanced')) return;
    var raw = h1.textContent || '';
    var sep = ' \u2014 ';
    var idx = raw.indexOf(sep);
    if (idx > 0) {
      var lead = raw.slice(0, idx);
      var sub = raw.slice(idx);
      h1.textContent = '';
      h1.appendChild(document.createTextNode(lead));
      var span = document.createElement('span');
      span.className = 'mbm-hero-sub';
      span.textContent = sub;
      h1.appendChild(span);
    }
    h1.setAttribute('data-mbm-hero-enhanced', 'true');
  }

  function enhancePackBoxes(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var boxes = scope.querySelectorAll('.home-pathway-card .home-pack-box');
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      var list = box.querySelector('ul.home-pack-badges');
      if (!list || list.hasAttribute('data-mbm-pack-enhanced')) continue;
      list.setAttribute('data-mbm-pack-enhanced', 'true');
      var items = list.querySelectorAll('li.home-pack-badge');
      for (var k = 0; k < items.length; k++) {
        if (k < 3) {
          items[k].setAttribute('data-mbm-primary-chip', 'true');
        }
      }
      if (items.length > 3) {
        list.classList.add('mbm-pack-collapsible');
        var total = items.length;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mbm-pack-more-btn';
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = 'All files (' + total + ')';
        (function (targetList, toggleBtn, count) {
          toggleBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var expanded = targetList.classList.toggle('is-expanded');
            toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            toggleBtn.textContent = expanded ? 'Show 3 primary files' : ('All files (' + count + ')');
          });
        })(list, btn, total);
        box.appendChild(btn);
      }
    }
  }

  function enhanceTiles(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll(TILE_SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var tile = nodes[i];
      if (!tile.classList.contains('mbm-tile')) {
        tile.classList.add('mbm-tile');
      }
      if (!tile.hasAttribute('data-mbm-tile')) {
        tile.setAttribute('data-mbm-tile', tile.tagName.toLowerCase());
      }
      var primary = primaryLinkOf(tile);
      if (primary && !tile.hasAttribute('data-mbm-tile-bound')) {
        tile.setAttribute('data-mbm-tile-bound', 'true');
        tile.style.cursor = 'pointer';
      }
    }
    enhanceHero();
    enhancePackBoxes(scope);
  }

  function start() {
    var route = canonicalRoute(window.location && window.location.pathname);
    var hubRoutes = collectHubRoutes();
    if (!hubRoutes[route]) return;

    document.documentElement.setAttribute('data-mbm-tile-hub', route);
    enhanceTiles(document);

    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('a, button, input, select, textarea, summary, label, [role="button"]')) return;
      var selection = window.getSelection ? String(window.getSelection()) : '';
      if (selection && selection.trim().length > 0) return;
      var tile = target.closest('.mbm-tile[data-mbm-tile-bound="true"]');
      if (!tile) return;
      var primary = primaryLinkOf(tile);
      if (primary) {
        primary.click();
      }
    });

    if (typeof MutationObserver === 'function' && document.body) {
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
            enhanceTiles(document);
            break;
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
