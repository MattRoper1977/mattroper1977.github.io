#!/usr/bin/env node
/**
 * Focused SAVE-05 regression: non-finite numbers nested in JSON arrays.
 * Sentinel: mbm-full-repair-upgrade-2026-08-07
 *
 * Usage:
 *   node tools/verify_ouroboros_save05_arrays.mjs ouroboros/index.html
 *   node tools/verify_ouroboros_save05_arrays.mjs --expect-gap pre-fix.html
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const expectGap = args.includes('--expect-gap');
const targetArg = args.find(arg => !arg.startsWith('--')) || 'ouroboros/index.html';
const target = path.resolve(targetArg);
const KEY = 'mbm_ouroboros_chronos_unbound_v1';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (!fs.existsSync(target)) throw new Error(`target not found: ${target}`);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));

try {
  await page.goto(pathToFileURL(target).href, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForFunction(() => typeof window.OuroborosDebug === 'object', null, { timeout: 25000 });

  const benign = await page.evaluate(key => {
    localStorage.setItem(key, '{"quest":{"stabilisers":["north","south"]}}');
    const ok = loadGame();
    return { ok, values: Game.save.quest.stabilisers.slice() };
  }, KEY);
  assert(benign.ok === true, 'benign array save did not load');
  assert(JSON.stringify(benign.values) === '["north","south"]', `benign array changed: ${JSON.stringify(benign.values)}`);

  const hostile = await page.evaluate(key => {
    localStorage.setItem(key, '{"quest":{"stabilisers":[1e999,{"charge":1e999}]}}');
    const ok = loadGame();
    const values = Game.save.quest.stabilisers;
    return {
      ok,
      first: values[0],
      firstFinite: Number.isFinite(values[0]),
      nested: values[1]?.charge,
      nestedFinite: Number.isFinite(values[1]?.charge),
      roundTrip: JSON.parse(JSON.stringify(values)),
    };
  }, KEY);

  const gapPresent = hostile.ok === true && (!hostile.firstFinite || !hostile.nestedFinite);
  if (expectGap) {
    assert(gapPresent, `negative control did not reproduce the array gap: ${JSON.stringify(hostile)}`);
  } else {
    assert(hostile.ok === true, 'hostile array save was rejected instead of sanitised');
    assert(hostile.firstFinite && hostile.nestedFinite, `non-finite array values reached live state: ${JSON.stringify(hostile)}`);
    assert(hostile.first === 0 && hostile.nested === 0, `array values did not fall back deterministically: ${JSON.stringify(hostile)}`);
    assert(hostile.roundTrip[0] === 0 && hostile.roundTrip[1]?.charge === 0,
      `round-trip changed sanitised values: ${JSON.stringify(hostile.roundTrip)}`);
  }
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);

  console.log(JSON.stringify({
    sentinel: 'mbm-full-repair-upgrade-2026-08-07',
    target,
    expectGap,
    benign,
    hostile,
    pageErrors,
  }, null, 2));
  console.log(expectGap
    ? 'POSITIVE CONTROL PASS — pre-fix array recursion gap reproduced'
    : 'SAVE-05 ARRAY PASS — benign arrays preserved; nested non-finite values sanitised and round-trip safely');
} finally {
  await context.close();
  await browser.close();
}
