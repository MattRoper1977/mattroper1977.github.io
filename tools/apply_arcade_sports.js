#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'games', 'index.html');

function transform(input) {
  let source = input;
  function replaceOnce(label, before, after) {
    if (source.includes(after) && !source.includes(before)) return;
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`${label}: expected one source anchor, found ${count}`);
    source = source.replace(before, after);
  }

  replaceOnce(
    'Sports card layout',
    '.class .gcard{flex:0 0 250px}\n/* all grid */',
    '.class .gcard{flex:0 0 250px}\n/* Sports is a collection rail, not a tag: two named games sit together without changing their chips. */\n.sports .gcard{flex:0 0 min(420px,calc(100vw - 2.2rem))}\n@media(min-width:760px){.sports .rail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}.sports .gcard{min-width:0}}\n/* all grid */'
  );
  replaceOnce(
    'Top-picks count copy',
    '<p class="sub">The eight I\'d put in front of anyone first — and one line each on why.</p>',
    '<p class="sub">The seven I\'d put in front of anyone first — and one line each on why.</p>'
  );
  replaceOnce(
    'Sports section',
    '<div class="rail" id="topRail" aria-label="Matt\'s top picks"></div>\n</div></section>\n\n<section class="sec gx-watch">',
    '<div class="rail" id="topRail" aria-label="Matt\'s top picks"></div>\n</div></section>\n\n<section class="sec sports" id="sports" hidden><div class="wrap">\n<h2>Sports <small>· precision and position play</small></h2>\n<p class="sub">Two Apex games, side by side: bend the ball in Apex Kick, then control the cue ball\'s leave in Apex Pool.</p>\n<div class="rail" id="sportsRail" aria-label="Sports games"></div>\n</div></section>\n\n<section class="sec gx-watch">'
  );
  replaceOnce(
    'Whole-shelf copy',
    '<h2>The whole shelf</h2>\n<p class="sub" id="shelfSub">Every game, A to Z — search and filters above work on this grid.</p>',
    '<h2>The rest of the shelf</h2>\n<p class="sub" id="shelfSub">Every other game, A to Z — search and filters above work on this grid.</p>'
  );
  replaceOnce(
    'Top-picks membership',
    'var TOP=["Apex Kick","Voxel Frontier","Off-Brand","Glitch Clash","Hold the Mark","Orbital","Slipstream - GP","Grid Chase"];',
    'var TOP=["Voxel Frontier","Off-Brand","Glitch Clash","Hold the Mark","Orbital","Slipstream - GP","Grid Chase"];'
  );
  replaceOnce(
    'Sports collection renderer',
    ' TOP.forEach(function(t,i){var g=gs.find(function(x){return x.title===t});if(g)rail.appendChild(pickCard(g,i===0))});\n /* themed grids */',
    ' TOP.forEach(function(t,i){var g=gs.find(function(x){return x.title===t});if(g)rail.appendChild(pickCard(g,i===0))});\n /* Sports is driven by the manifest collection field; it is hidden until the two entries exist. */\n var sports=gs.filter(function(g){return g.collection==="Sports"});\n var sportsSection=$("sports"),sportsRail=$("sportsRail");sportsRail.textContent="";\n sports.forEach(function(g){sportsRail.appendChild(gCard(g,false))});\n sportsSection.hidden=sports.length===0;\n /* themed grids */'
  );
  replaceOnce(
    'Whole-shelf collection exclusion',
    'function drawGrid(){\n var gs=state.games.slice();',
    'function drawGrid(){\n var all=state.games.slice(),sportsCount=all.filter(function(g){return g.collection==="Sports"}).length;\n var gs=all.filter(function(g){return g.collection!=="Sports"});'
  );
  replaceOnce(
    'Derived shelf totals',
    ' var n=state.games.length;\n $("countline").textContent=gs.length===n?\n  (CURATED.length+" curated favourites of "+n+" games — every one free, single-file and offline-friendly."):\n  ("Showing "+gs.length+" of "+n+" games.");',
    ' var n=state.games.length-sportsCount,total=state.games.length;\n $("countline").textContent=gs.length===n?\n  (CURATED.length+" curated favourites across "+total+" games — "+n+" more on the shelf below."):\n  ("Showing "+gs.length+" of "+n+" shelf games ("+total+" total).");'
  );
  return source;
}

const before = fs.readFileSync(file, 'utf8');
const after = transform(before);
const second = transform(after);
if (second !== after) throw new Error('Idempotency failure: second transform changed the renderer');
if (after === before) throw new Error('Renderer already contains the complete Sports change; refusing a duplicate run');
fs.writeFileSync(file, after);
console.log('Applied the collection-driven Sports rail; second transform was a no-op.');
