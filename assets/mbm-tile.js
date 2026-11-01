/* Shared hub tile enhancer (S-1-2, design ruling 16:47Z).
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
