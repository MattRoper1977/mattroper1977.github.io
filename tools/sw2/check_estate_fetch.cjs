'use strict';
// Red proof for the two failure classes estate-fetch.cjs adds, run against two
// local origins so it needs no network and no deployment.
//
// The point of the exercise is the MESSAGE, not the exit code. Before this,
// aiming a verifier at the wrong origin produced "missing marker" -- a true
// statement about the stub that says nothing about why. The assertions below
// pin the wording, because the wording is the fix.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EstateMap } = require('../lib/estate-map.cjs');
const { fetchRoute, OffOriginError, RouteMovedError } = require('../lib/estate-fetch.cjs');

const MARKER = 'Gold Master v1.0 preview — the real page, served by Play';

// The shape build_education.moved_page emits, reduced to what a verifier sees.
const stub = destination =>
  '<!doctype html><html lang="en-GB"><head><meta charset="utf-8">' +
  '<meta name="robots" content="noindex"><title>This game has moved · Made by Matt</title>' +
  `<link rel="canonical" href="${destination}">` +
  '</head><body data-game-moved><main><h1>This game has moved</h1>' +
  `<p><a id="play-game" href="${destination}">Open the game</a></p></main></body></html>`;

function serve(handler) {
  return new Promise(resolve => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
}

(async () => {
  const play = await serve((request, response) => {
    if (request.url.startsWith('/townlife')) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html><head><title>Town Life</title></head><body><p>${MARKER}</p></body></html>`);
      return;
    }
    response.writeHead(404); response.end('no');
  });
  const education = await serve((request, response) => {
    if (request.url.startsWith('/moved-elsewhere')) {
      response.writeHead(302, { location: '/for/pupils/' }); response.end(); return;
    }
    if (request.url.startsWith('/for/pupils')) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html><body><h1>For pupils</h1></body></html>');
      return;
    }
    if (request.url.startsWith('/townlife')) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(stub(`${play.origin}/townlife/`));
      return;
    }
    response.writeHead(404); response.end('no');
  });

  const source = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/estate-map.json'), 'utf8'));
  source.origins = { education: education.origin, play: play.origin };
  // Only the education host is 127.0.0.1 here. Listing the loopback under BOTH
  // sets made the first clause of isPlayRoute -- "a Play host serves everything
  // but /game-saves" -- swallow every route, and the education control went to
  // Play. The fixture, not the predicate, was wrong; recorded because a fixture
  // that quietly disables the thing under test is the same defect this file is
  // about.
  source.hosts = { education: ['127.0.0.1'], play: [] };
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'estate-')), 'estate-map.json');
  fs.writeFileSync(file, JSON.stringify(source));
  // Routes are resolved against the education origin, so the hostname is always
  // the loopback and cannot decide anything; the map's route table decides,
  // which is the property under test.
  const map = EstateMap.load(file);

  try {
    // GREEN: the map sends a Play route to Play and the real page comes back.
    const good = await fetchRoute('/townlife/', { map });
    check('the map routes /townlife/ to the Play origin',
      good.origin === play.origin, good.origin);
    check('and the real page comes back',
      good.bytes.includes(Buffer.from(MARKER)));
    check('finalUrl is recorded and equals the request',
      good.finalUrl === good.requestedUrl, good.finalUrl);

    // RED 1: point the same verifier at the wrong origin. This is the whole ruling.
    let raised = null;
    try {
      await fetchRoute('/townlife/', { map, origin: education.origin });
    } catch (error) { raised = error; }
    check('pointing it at the education origin raises OffOriginError',
      raised instanceof OffOriginError, raised && raised.name);
    check('and the message names where the route lives, not a missing marker',
      raised && /lives on/.test(raised.message) && raised.livesOn === play.origin,
      raised && raised.message);
    check('the off-origin class fires BEFORE any content assertion',
      raised && !/marker|differs|bytes/i.test(raised.message));

    // RED 2: a redirect is reported as a move, not as wrong bytes.
    let moved = null;
    try {
      await fetchRoute('/moved-elsewhere/', { map, origin: education.origin });
    } catch (error) { moved = error; }
    check('a redirect raises RouteMovedError naming both URLs',
      moved instanceof RouteMovedError && /requested .*served /.test(moved.message),
      moved && moved.message);

    // CONTROL: an education route on the education origin is untouched by any
    // of this. A gate that reddened correct usage would be worse than none.
    const pupils = await fetchRoute('/for/pupils/', { map });
    check('an education route on the education origin still passes',
      pupils.origin === education.origin && pupils.status === 200);
  } finally {
    play.server.close();
    education.server.close();
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
})();
