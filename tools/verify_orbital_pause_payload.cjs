#!/usr/bin/env node
/** Verify the Orbital pause-state repair against preserved pre-fix controls. */
const fs = require('fs');

function extractFunction(text, name, useLast = false) {
  const marker = `function ${name}(){`;
  const start = useLast ? text.lastIndexOf(marker) : text.indexOf(marker);
  if (start < 0) throw new Error(`${name}: function marker missing`);
  const braceStart = text.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = braceStart; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return text.slice(start, index + 1);
  }
  throw new Error(`${name}: unterminated function`);
}

function exerciseReadable(html) {
  const fn = extractFunction(html, 'togglePause');
  const game = new Function(`
    let gameState='MENU', pauseReturnState='AIM';
    let probe={flying:false};
    const document={getElementById(){return {classList:{add(){}}}}};
    function show(){}
    ${fn}
    return {set(state,flying){gameState=state;probe.flying=flying},toggle:togglePause,read(){return gameState}};
  `)();
  return exercise(game);
}

function exerciseBundled(html) {
  const fn = extractFunction(html, 'ca', true);
  const game = new Function(`
    let Ve='MENU', pauseReturnState='AIM';
    let We={flying:false};
    const document={getElementById(){return {classList:{add(){}}}}};
    function Qi(){}
    ${fn}
    return {set(state,flying){Ve=state;We.flying=flying},toggle:ca,read(){return Ve}};
  `)();
  return exercise(game);
}

function exercise(game) {
  game.set('AIM', false);
  game.toggle();
  const aimPause = game.read();
  game.toggle();
  const aimResume = game.read();

  game.set('FLY', true);
  game.toggle();
  const flyPause = game.read();
  game.toggle();
  const flyResume = game.read();

  game.set('FLY', false);
  game.toggle();
  game.toggle();
  const staleResume = game.read();

  return { aimPause, aimResume, flyPause, flyResume, staleResume };
}

function hasGap(result) {
  return result.flyResume !== 'FLY';
}

function assertFixed(result, label) {
  const expected = {
    aimPause: 'PAUSE',
    aimResume: 'AIM',
    flyPause: 'PAUSE',
    flyResume: 'FLY',
    staleResume: 'AIM',
  };
  for (const [key, value] of Object.entries(expected)) {
    if (result[key] !== value) throw new Error(`${label} ${key}: ${result[key]} != ${value}`);
  }
}

const [beforeReadablePath, beforeBundledPath, afterReadablePath, afterBundledPath, outputPath] = process.argv.slice(2);
if (!outputPath) {
  throw new Error('usage: before-readable before-bundled after-readable after-bundled output-json');
}

const before = {
  readable: exerciseReadable(fs.readFileSync(beforeReadablePath, 'utf8')),
  bundled: exerciseBundled(fs.readFileSync(beforeBundledPath, 'utf8')),
};
const after = {
  readable: exerciseReadable(fs.readFileSync(afterReadablePath, 'utf8')),
  bundled: exerciseBundled(fs.readFileSync(afterBundledPath, 'utf8')),
};

if (!hasGap(before.readable) || !hasGap(before.bundled)) {
  throw new Error(`negative control did not reproduce: ${JSON.stringify(before)}`);
}
assertFixed(after.readable, 'readable');
assertFixed(after.bundled, 'bundled');

const report = {
  sentinel: 'mbm-full-repair-upgrade-2026-08-07',
  before,
  after,
};
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log('ORBITAL PAUSE PASS — pre-fix copies resume a live flight as AIM; repaired copies preserve FLY and safely fall back from stale flight');
console.log(JSON.stringify(report, null, 2));
