#!/usr/bin/env node

/* Static launch contract. Runtime geometry, hostile saves, image paint and
 * offline behaviour live in browser.mjs; balance lives in the two DOM-free
 * models. This file is also the verifier named by data/hud-coverage.json. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const titan = read('titanforge/index.html');
const crown = read('crownbadge/index.html');
const manifest = JSON.parse(read('data/source-manifests/games.json')).games;
let passed = 0;

function gate(label, fn) {
  try {
    const detail = fn();
    passed += 1;
    console.log(`  [PASS] ${label}${detail ? ` · ${detail}` : ''}`);
  } catch (error) {
    console.error(`  [FAIL] ${label} · ${error.message}`);
    process.exitCode = 1;
  }
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function noExternalRuntime(source, label) {
  assert.equal((source.match(/<script\b[^>]*\bsrc\s*=/gi) || []).length, 0, `${label} has script src`);
  assert.equal((source.match(/<(?:link|iframe|audio|video|source)\b[^>]*(?:href|src)\s*=/gi) || []).length, 0, `${label} has an external-capable element`);
  const urls = [...source.matchAll(/https?:\/\/[^"'\s)<]+/g)].map(match => match[0]);
  const allowed = urls.filter(url => /^(?:http:\/\/www\.w3\.org\/|https:\/\/react\.dev\/errors\/)/.test(url));
  assert.equal(allowed.length, urls.length, `${label} unexpected URL(s): ${urls.filter(url => !allowed.includes(url)).join(', ')}`);
  assert.equal((source.match(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/g) || []).length, 0, `${label} carries a request API`);
  return `${urls.length} inert namespace/error URL occurrence(s), 0 request-capable subresources`;
}

console.log('\n=== TITAN FORGE + CROWN & BADGE · STATIC LAUNCH CONTRACT ===\n');

gate('both launch routes are on the shelf exactly once and remain uncurated', () => {
  for (const route of ['/titanforge/', '/crownbadge/']) {
    const matches = manifest.filter(game => game.href === route);
    assert.equal(matches.length, 1, `${route} shelf count`);
    assert.equal(matches[0].featured, false, `${route} featured`);
    assert.equal(matches[0].hero, false, `${route} hero`);
  }
  const gamesPage = read('games/index.html');
  const curation = gamesPage.slice(gamesPage.indexOf('var CURATION=['), gamesPage.indexOf('var GENRE_ORDER=['));
  assert(!curation.includes('/titanforge/') && !curation.includes('/crownbadge/'), 'a launch route entered CURATION/TOP/TAKES');
  return `${manifest.length} shelf entries`;
});

gate('Titan payload is below 1,000,000 B with two WebPs and zero PNG data URIs', () => {
  const bytes = fs.statSync(path.join(ROOT, 'titanforge/index.html')).size;
  assert(bytes <= 1_000_000, `${bytes} B`);
  assert.equal(count(titan, 'data:image/png;base64'), 0);
  assert.equal(count(titan, 'data:image/webp;base64'), 2);
  return `${bytes} B`;
});

gate('Titan has no new off-origin/runtime request surface', () => noExternalRuntime(titan, 'Titan'));

gate('Titan storage, touch and wall-clock timing contracts are present', () => {
  assert.equal(count(titan, 'titan-forge-save-v1'), 0, 'old storage key survives');
  assert.equal(count(titan, 'mbm_titanforge_save_v1'), 1, 'new storage key count');
  assert(titan.includes('touch-action:manipulation'), 'touch-action manipulation missing');
  assert(titan.includes('function mbmTitanTimingPosition'), 'analytic timing function missing');
  assert(titan.includes('requestAnimationFrame'), 'rAF timing loop missing');
  assert(titan.includes('window.__MBM_TITAN_TEST__'), 'hostile-save/timing hook missing');
});

gate('Titan balance and prestige state match the modelled launch configuration', () => {
  for (const token of [
    'MBM_TITAN_ASCEND=5e4',
    'cost:8000,required:6000',
    'required:8000,boost:2.3',
    'attemptedTrials',
    'starterTier',
    'comboLevel',
    'windowLevel',
    'bestCombo:I.bestCombo',
    'claimedQuests:[...I.claimedQuests]',
  ]) assert(titan.includes(token), `missing ${token}`);
});

gate('Titan reduced motion keeps gameplay motion and uses the OS as a floor', () => {
  assert(titan.includes('MBM_OS_REDUCED_MOTION'), 'OS floor missing');
  assert(titan.includes('.game-shell.reduced-motion .sky-noise'), 'named decorative suppression missing');
  assert(!titan.includes('.game-shell.reduced-motion .fighter-stage'), 'lift gameplay animation was suppressed');
  assert(!titan.includes('.game-shell.reduced-motion .meter-needle'), 'timing gameplay animation was suppressed');
});

gate('Crown preserves its exact launch CSP and has no external runtime surface', () => {
  const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; media-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; worker-src \'none\'">';
  assert.equal(count(crown, csp), 1, 'CSP changed or duplicated');
  return noExternalRuntime(crown, 'Crown');
});

gate('Crown storage keys are final and the bounded validator remains in the load path', () => {
  for (const old of ['cbfw_v1_campaign', 'cbfw_v1_meta', 'cbfw_v1_scores', 'cbfw_v1_settings']) assert.equal(count(crown, old), 0, `${old} survives`);
  for (const current of ['mbm_crownbadge_campaign_v1', 'mbm_crownbadge_meta_v1', 'mbm_crownbadge_scores_v1', 'mbm_crownbadge_settings_v1']) assert.equal(count(crown, current), 1, `${current} count`);
  assert(crown.includes('raw.length > 1048576'), '1 MiB read bound missing');
  assert(crown.includes('Core.migrateState(loadJSON(STORAGE.campaign, null))'), 'validated campaign load path missing');
});

gate('Crown Hard, Chronicle and determinism constants are the tested ones', () => {
  assert(crown.includes("hard:{id:'hard',name:'High Frontier',threat:1.06,penalty:1.05,spawn:1.11,valor:1.45}"), 'Hard multipliers drifted');
  assert(crown.includes('state.log=state.log.slice(0,200)'), 'Chronicle cap is not 200');
  assert(crown.includes('logGenerated'), 'Chronicle generation counter missing');
  assert.equal(count(crown, 'Math.random'), 1, 'Math.random ceiling changed');
  const randomAt = crown.indexOf('Math.random');
  assert(crown.slice(Math.max(0, randomAt - 250), randomAt + 250).includes('noiseBuffer'), 'Math.random moved outside audio noise');
});

gate('Crown phone objective, ledger and Valor surfaces are present', () => {
  for (const id of ['mobileGoalProgress', 'endDayLedger', 'valorVal']) assert(crown.includes(`id="${id}"`), `${id} missing`);
  assert(!crown.includes('.resource.valor{display:none}'), 'Valor still hidden on phones');
  assert(!crown.includes('@media(max-width:760px){.map-card .frontier-svg,.map-nodes'), 'trailing 760 map patch survives');
  assert(!crown.includes('@media(max-width:430px){.map-card .frontier-svg,.map-nodes'), 'trailing 430 map patch survives');
});

gate('Crown keeps escaped dynamic markup, seed whitelist and scoped reduced motion', () => {
  assert(crown.includes("replace(/[^A-Z0-9 _-]/g, '')"), 'seed whitelist changed');
  assert(crown.includes("const esc = value =>"), 'central escape helper missing');
  assert(!crown.includes('.reduced *{'), 'blanket in-game motion suppression survives');
  assert(!crown.includes('@media(prefers-reduced-motion:reduce){*{'), 'blanket OS motion suppression survives');
  assert(crown.includes("now - lastFullFlashAt < 500"), 'sub-3 Hz flash throttle missing');
  assert(crown.includes('root.__MBM_CROWN_TEST__'), 'runtime measurement hook missing');
});

gate('both generated splash and exit regions are present exactly once', () => {
  for (const [label, source] of [['Titan', titan], ['Crown', crown]]) {
    assert.equal(count(source, '<!-- MBM-SPLASH:BEGIN'), 1, `${label} splash region`);
    assert.equal(count(source, '<!-- MBM-INLINE-EXIT:BEGIN'), 1, `${label} exit region`);
  }
});

console.log(`\nstatic launch contract: ${passed}/12 passed`);
if (process.exitCode) process.exit(process.exitCode);
