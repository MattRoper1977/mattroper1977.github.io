'use strict';
// One way to fetch a published route, so that a wrong origin reports itself.
//
// The estate serves two trees. Ask the education origin for a Play route and it
// answers 200 with a two-kilobyte "This game has moved" stub carrying
// <link rel="canonical"> to the Play URL. Every assertion after that point is
// about the stub, and the one that happens to run first is the one the failure
// gets named after -- "missing marker", "differs from committed", "0 !== 1".
// The cause never appears. That is not hypothetical: it is how townlife-verify
// was read as a CDN race for a day.
//
// So three things happen here that a bare fetch() does not do:
//
//   1. The origin is derived from the route (tools/lib/estate-map.cjs), never
//      written as a literal at the call site.
//   2. The final URL is asserted. `redirect: 'follow'` silently turns "this
//      route moved" into "this page has the wrong bytes".
//   3. A served page whose canonical points off-origin fails as its own class,
//      OffOriginError -- "route lives on <origin>" -- BEFORE any content
//      assertion runs. The first thing the reader sees is the cause.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EstateMap } = require('./estate-map.cjs');

class OffOriginError extends Error {
  constructor(route, servedFrom, livesOn) {
    super(`${route} lives on ${livesOn} — it was requested from ${servedFrom}, ` +
          `which serves the split stub for this route, not the page`);
    this.name = 'OffOriginError';
    this.route = route;
    this.servedFrom = servedFrom;
    this.livesOn = livesOn;
  }
}

class RouteMovedError extends Error {
  constructor(route, requested, finalUrl) {
    super(`${route} redirected: requested ${requested}, served ${finalUrl}`);
    this.name = 'RouteMovedError';
    this.route = route;
    this.finalUrl = finalUrl;
  }
}

const CANONICAL = /<link\b[^>]*\brel\s*=\s*["']?canonical["']?[^>]*>/i;
const HREF = /\bhref\s*=\s*["']([^"']+)["']/i;

function canonicalOf(text, base) {
  const tag = CANONICAL.exec(text);
  if (!tag) return null;
  const href = HREF.exec(tag[0]);
  if (!href) return null;
  try {
    return new URL(href[1], base);
  } catch {
    return null;
  }
}

async function fetchRoute(route, options = {}) {
  const map = options.map || EstateMap.load(options.mapFile);
  const origin = options.origin || map.originFor(route);
  const requested = new URL(route, origin);
  const response = await fetch(requested, {
    redirect: options.redirect || 'follow',
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': options.agent || 'mbm-estate-verifier' },
    signal: AbortSignal.timeout(options.timeoutMs || 30000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());

  // (2) assert the final URL before anything reads the body. Compared on
  // origin+pathname: a trailing-slash normalisation is not a move, a different
  // host or a different page is.
  const finalUrl = new URL(response.url);
  const samePath = finalUrl.pathname.replace(/\/+$/, '') === requested.pathname.replace(/\/+$/, '');
  if (finalUrl.origin !== requested.origin || !samePath) {
    throw new RouteMovedError(route, requested.href, finalUrl.href);
  }

  // (3) the off-origin class, ahead of every content assertion.
  const contentType = response.headers.get('content-type') || '';
  if (/html/i.test(contentType)) {
    const canonical = canonicalOf(bytes.toString('utf8'), requested);
    if (canonical && canonical.origin !== requested.origin) {
      throw new OffOriginError(route, requested.origin, canonical.origin);
    }
  }

  assert.equal(response.status, 200, `${requested.href} returned ${response.status}`);
  return {
    route,
    origin: requested.origin,
    requestedUrl: requested.href,
    finalUrl: finalUrl.href,
    status: response.status,
    contentType: contentType || 'MISSING',
    headers: Object.fromEntries(['cache-control', 'etag', 'age', 'last-modified']
      .map(name => [name, response.headers.get(name) ?? 'MISSING'])),
    bytes,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

module.exports = { fetchRoute, canonicalOf, OffOriginError, RouteMovedError };
