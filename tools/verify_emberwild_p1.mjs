#!/usr/bin/env node
/*
 * verify_emberwild_p1.mjs — first-mission repair contract for Emberwild.
 *
 * Usage:
 *   node tools/verify_emberwild_p1.mjs [emberwild/index.html]
 *   node tools/verify_emberwild_p1.mjs [emberwild/index.html] --selftest
 *
 * The verifier serves the supplied HTML from its own loopback origin and drives
 * Chromium. Routes are derived afresh in the rendered build by invoking the
 * shipped PlayerController.tryMove method for every BFS edge. The resulting
 * routes are then replayed with real keyboard events; no measured destination
 * is reached by teleport during an acceptance test.
 *
 * --selftest serves throwaway, in-memory mutations and sends them through the
 * same gate entry points as the candidate. No mutation is written to the tree.
 */

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const SELFTEST = argv.includes('--selftest');
const gameArg = argv.find(arg => !arg.startsWith('--'));
const GAME = path.resolve(gameArg || path.join(ROOT, 'emberwild', 'index.html'));
const NAV_MS = 60_000;
const STEP_MS = 4_000;

let passed = 0;
let failed = 0;
let skipped = 0;

function report(ok, id, detail = '') {
  if (ok) passed += 1;
  else failed += 1;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? `  ${detail}` : ''}\n`);
  return Boolean(ok);
}

function skip(id, detail) {
  skipped += 1;
  process.stdout.write(`SKIP  ${id}  ${detail}\n`);
  return false;
}

function fatal(message) {
  process.stderr.write(`FATAL  ${message}\n`);
  process.exit(2);
}

function findExecutable() {
  const explicit = process.env.EMBERWILD_CHROME;
  if (explicit) return fs.existsSync(explicit) ? explicit : null;

  const candidates = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    '/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',
  ];
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  try {
    for (const entry of fs.readdirSync(cache)) {
      candidates.push(path.join(cache, entry, 'chrome-linux', 'chrome'));
      candidates.push(path.join(cache, entry, 'chrome-linux', 'headless_shell'));
    }
  } catch (_) {}
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

async function loadChromium() {
  const specs = [
    'playwright',
    process.env.MBM_PLAYWRIGHT,
    process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
      ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright', 'index.js')
      : null,
    '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js',
    '/opt/node22/lib/node_modules/playwright/index.js',
  ].filter(Boolean);
  for (const spec of specs) {
    try {
      const mod = await import(spec);
      const chromium = mod.chromium || mod.default?.chromium;
      if (chromium) return chromium;
    } catch (_) {}
  }
  return null;
}

function makeServer(variants) {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch (_) { res.writeHead(400).end('bad request'); return; }
    const match = /^\/__emberwild_p1\/([^/]+)\/?$/.exec(pathname);
    if (match && variants.has(match[1])) {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(variants.get(match[1]));
      return;
    }
    if (pathname === '/games/' || pathname === '/games') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>Arcade probe</title><p>Arcade</p>');
      return;
    }
    if (pathname === '/__emberwild_p1_seed') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end('<!doctype html><title>Emberwild storage seed</title>');
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });
}

function urlFor(origin, variant) {
  return `${origin}/__emberwild_p1/${variant}?splash=skip&dev=1`;
}

function plainUrlFor(origin, variant) {
  return `${origin}/__emberwild_p1/${variant}?dev=1`;
}

async function openPage(browser, url, {
  start = true,
  initScript = null,
  beforeNavigate = null,
} = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  if (beforeNavigate) await beforeNavigate(page, context);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForFunction(() => Boolean(window.__EMBERWILD__), null, { timeout: NAV_MS });
  if (start) {
    await page.locator('#start-new').click();
    await page.waitForFunction(() => window.__EMBERWILD_READY__ === true, null, { timeout: NAV_MS });
    for (let i = 0; i < 8; i += 1) {
      const active = await page.evaluate(() => Boolean(window.__EMBERWILD__.ui.dialogue.active));
      if (!active) break;
      await page.keyboard.press('KeyZ');
      await page.waitForTimeout(80);
    }
    await page.waitForFunction(() => {
      const g = window.__EMBERWILD__;
      return g.mode === 'OVERWORLD' && !g.ui.dialogue.active;
    }, null, { timeout: NAV_MS });
    await page.evaluate(() => {
      document.activeElement?.blur?.();
      window.__EMBERWILD__.encounters.onStep = () => false;
    });
  }
  return { context, page, errors };
}

const DIRECTIONS = Object.freeze([
  { name: 'N', dx: 0, dz: -1, key: 'KeyW' },
  { name: 'S', dx: 0, dz: 1, key: 'KeyS' },
  { name: 'E', dx: 1, dz: 0, key: 'KeyD' },
  { name: 'W', dx: -1, dz: 0, key: 'KeyA' },
]);

/*
 * Invoke the shipped tryMove for every possible edge. startMotion is replaced
 * only while probing so movement is observed without allowing a measuring pass
 * to trigger encounters or trainer sight. Occupancy, height, stairs and ledges
 * are still decided inside the shipped tryMove implementation.
 */
async function deriveWorld(page) {
  return page.evaluate((directions) => {
    const g = window.__EMBERWILD__;
    const player = g.player;
    const spawn = { ...player.grid };
    const saved = {
      grid: { ...player.grid },
      render: { ...player.render },
      facing: player.facing,
      motionState: player.motionState,
      buffered: player.buffered,
      mode: g.mode,
      startMotion: player.startMotion,
    };

    const edge = (state, direction) => {
      const cell = g.map.getCell(state.x, state.z);
      if (!cell) return null;
      player.teleport(state.x, state.z, cell.height);
      player.buffered = null;
      g.mode = 'OVERWORLD';
      let landing = null;
      player.startMotion = (x, z, y, motionState) => {
        landing = { x, z, y, motionState };
      };
      let accepted = false;
      try { accepted = player.tryMove(direction.dx, direction.dz); }
      finally { player.startMotion = saved.startMotion; }
      return accepted && landing ? landing : null;
    };

    const routes = new Map([[`${spawn.x},${spawn.z}`, { dirs: [], cells: [{ ...spawn }] }]]);
    const queue = [{ ...spawn }];
    for (let at = 0; at < queue.length && at < 1_200; at += 1) {
      const state = queue[at];
      const base = routes.get(`${state.x},${state.z}`);
      for (const direction of directions) {
        const landing = edge(state, direction);
        if (!landing) continue;
        const key = `${landing.x},${landing.z}`;
        if (routes.has(key)) continue;
        routes.set(key, {
          dirs: [...base.dirs, direction.name],
          cells: [...base.cells, { x: landing.x, z: landing.z, y: landing.y }],
        });
        queue.push({ x: landing.x, z: landing.z, y: landing.y });
      }
    }

    player.grid = saved.grid;
    player.render = saved.render;
    player.facing = saved.facing;
    player.motionState = saved.motionState;
    player.buffered = saved.buffered;
    player.startMotion = saved.startMotion;
    g.mode = saved.mode;

    const warden = g.npcs.find(npc => npc.id === 'warden_lyle');
    const cone = [];
    const vectors = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    const [dx, dz] = vectors[warden.facing];
    for (let k = 1; k <= warden.sight; k += 1) {
      const x = warden.grid.x + dx * k;
      const z = warden.grid.z + dz * k;
      const cell = g.map.getCell(x, z);
      if (!cell || cell.surface === 1 || cell.height !== warden.grid.y) break;
      cone.push({ x, z });
    }

    const patches = [[12, 14, 19, 18], [12, 9, 15, 10], [2, 14, 7, 17], [13, 2, 18, 7]];
    const grass = [];
    for (let z = 0; z < g.map.depth; z += 1) {
      for (let x = 0; x < g.map.width; x += 1) {
        if (g.map.getCell(x, z)?.surface === 2) grass.push({ x, z });
      }
    }
    const bedCounts = patches.map(([x1, z1, x2, z2]) => grass.filter(({ x, z }) =>
      x >= x1 && x <= x2 && z >= z1 && z <= z2).length);
    const authoredCounts = patches.map(([x1, z1, x2, z2]) => {
      let count = 0;
      for (let z = z1; z <= z2; z += 1) for (let x = x1; x <= x2; x += 1) {
        if ((x + z) % 5 !== 0) count += 1;
      }
      return count;
    });

    return {
      spawn,
      reachable: routes.size,
      routes: Object.fromEntries(routes),
      warden: { x: warden.grid.x, z: warden.grid.z, y: warden.grid.y,
        facing: warden.facing, sight: warden.sight },
      cone,
      grassTotal: grass.length,
      bedCounts,
      authoredCounts,
    };
  }, DIRECTIONS);
}

function directionSpec(name) {
  const spec = DIRECTIONS.find(direction => direction.name === name);
  if (!spec) throw new Error(`unknown direction ${name}`);
  return spec;
}

async function replayRoute(page, route) {
  if (!route || !Array.isArray(route.dirs) || route.cells.length !== route.dirs.length + 1) {
    throw new Error('route is absent or malformed');
  }
  for (let i = 0; i < route.dirs.length; i += 1) {
    const direction = directionSpec(route.dirs[i]);
    const expected = route.cells[i + 1];
    await page.keyboard.press(direction.key);
    try {
      await page.waitForFunction(({ x, z }) => {
        const p = window.__EMBERWILD__.player;
        return p.grid.x === x && p.grid.z === z
          && (p.motionState === 0 || p.motionState === 'IDLE');
      }, { x: expected.x, z: expected.z }, { timeout: STEP_MS });
    } catch (error) {
      const actual = await page.evaluate(() => {
        const g = window.__EMBERWILD__;
        return { grid: { ...g.player.grid }, motion: g.player.motionState, mode: g.mode,
          dialogue: g.ui.dialogue.active, battle: Boolean(g.battle) };
      });
      throw new Error(`route step ${i + 1}/${route.dirs.length} ${direction.name} expected `
        + `${expected.x},${expected.z}; actual=${JSON.stringify(actual)}; ${error}`);
    }
  }
}

function facingDirection(from, target) {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  return DIRECTIONS.find(direction => direction.dx === dx && direction.dz === dz) || null;
}

async function advanceTrainerDialogue(page) {
  for (let i = 0; i < 60; i += 1) {
    const state = await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      return { battle: g.mode === 'BATTLE' && Boolean(g.battle), dialogue: g.ui.dialogue.active };
    });
    if (state.battle) return true;
    if (state.dialogue) await page.keyboard.press('KeyZ');
    await page.waitForTimeout(120);
  }
  return false;
}

async function testDA(browser, url, world) {
  const adjacent = [
    { x: 16, z: 4 },
    { x: 16, z: 6 },
    { x: 15, z: 5 },
    { x: 17, z: 5 },
  ];
  const attempts = [];
  for (const target of adjacent) {
    const route = world.routes[`${target.x},${target.z}`];
    if (!route) {
      attempts.push({ target, reachable: false, battle: false, errors: [] });
      continue;
    }
    const session = await openPage(browser, url);
    const { page, context, errors } = session;
    try {
      await page.evaluate(() => {
        const g = window.__EMBERWILD__;
        const warden = g.npcs.find(npc => npc.id === 'warden_lyle');
        warden.__p1Sight = warden.sight;
        warden.sight = 0;
        g.delay = async () => {};
      });
      await replayRoute(page, route);
      const player = await page.evaluate(() => ({ ...window.__EMBERWILD__.player.grid }));
      const face = facingDirection(player, { x: 16, z: 5 });
      if (!face) throw new Error(`target ${target.x},${target.z} is not Warden-adjacent after replay`);
      await page.evaluate(() => {
        const warden = window.__EMBERWILD__.npcs.find(npc => npc.id === 'warden_lyle');
        warden.sight = warden.__p1Sight;
      });
      await page.keyboard.press(face.key);
      await page.waitForTimeout(50);
      await page.keyboard.press('KeyZ');
      const battle = await advanceTrainerDialogue(page);
      const proof = await page.evaluate(() => {
        const g = window.__EMBERWILD__;
        return {
          trainer: Boolean(g.battle?.trainer),
          active: g.activeTrainerNPC?.id || null,
          position: { x: g.player.grid.x, z: g.player.grid.z },
        };
      });
      attempts.push({ target, reachable: true,
        battle: battle && proof.trainer && proof.active === 'warden_lyle', proof, errors });
    } catch (error) {
      attempts.push({ target, reachable: true, battle: false,
        error: String(error), errors });
    } finally {
      await context.close();
    }
  }
  return {
    ok: attempts.length === 4 && attempts.every(attempt => attempt.reachable && attempt.battle && attempt.errors.length === 0),
    attempts,
  };
}

async function testRegistry(browser, url) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_MS });
    await page.waitForTimeout(250);
    const scripts = (await page.locator('script').allTextContents()).join('\n');
    const numericCalls = [...scripts.matchAll(/flags\.(?:get|set)\(\s*\d+/g)].map(match => match[0]);
    const numericClaims = [...scripts.matchAll(/\bflag:\s*\d+/g)].map(match => match[0]);
    const result = await page.evaluate(() => {
      const engine = window.EmberwildEngine;
      const registry = window.__EMBERWILD_FLAGS__;
      if (!registry || typeof engine?.assertFlagRegistry !== 'function') {
        return { present: false, frozen: false, asserted: false, unique: false, entries: null };
      }
      let asserted = true;
      let error = null;
      try { engine.assertFlagRegistry(registry); }
      catch (caught) { asserted = false; error = String(caught); }
      const values = Object.values(registry);
      return {
        present: true,
        frozen: Object.isFrozen(registry),
        asserted,
        error,
        unique: new Set(values).size === values.length,
        entries: {
          WARDEN_LYLE_DEFEATED: registry.WARDEN_LYLE_DEFEATED,
          DEPTHS_CLEARED: registry.DEPTHS_CLEARED,
          PRISM_CACHE_COLLECTED: registry.PRISM_CACHE_COLLECTED,
        },
      };
    });
    result.numericCalls = numericCalls;
    result.numericClaims = numericClaims;
    result.namedCallSites = numericCalls.length === 0 && numericClaims.length === 0;
    const exact = result.entries?.WARDEN_LYLE_DEFEATED === 12
      && result.entries?.DEPTHS_CLEARED === 13
      && result.entries?.PRISM_CACHE_COLLECTED === 14;
    return { ok: result.present && result.frozen && result.asserted && result.unique
        && result.namedCallSites && exact && errors.length === 0,
      result, errors };
  } finally {
    await context.close();
  }
}

async function testPickup(browser, url, world) {
  const route = world.routes['19,3'];
  if (!route) return { okReload: false, okItem: false, error: 'BFS did not reach prism_cache at 19,3' };
  const { context, page, errors } = await openPage(browser, url);
  try {
    await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      const warden = g.npcs.find(npc => npc.id === 'warden_lyle');
      warden.sight = 0;
      g.encounters.onStep = () => false;
    });
    await replayRoute(page, route);
    await page.waitForFunction(() => (window.__EMBERWILD__.inventory.bright_pod || 0) >= 2,
      null, { timeout: STEP_MS });
    const collected = await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      const F = window.__EMBERWILD_FLAGS__ || {};
      const item = g.npcs.find(npc => npc.id === 'prism_cache');
      const cacheBit = F.PRISM_CACHE_COLLECTED ?? item.flag;
      const depthsBit = F.DEPTHS_CLEARED ?? 13;
      return {
        cacheBit,
        depthsBit,
        cacheSet: g.flags.get(cacheBit),
        depthsSet: g.flags.get(depthsBit),
        inventory: g.inventory.bright_pod || 0,
      };
    });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_MS });
    await page.waitForFunction(() => Boolean(window.__EMBERWILD__), null, { timeout: NAV_MS });
    await page.locator('#start-continue').click();
    await page.waitForFunction(() => window.__EMBERWILD_READY__ === true, null, { timeout: NAV_MS });
    // The save correctly restores the player on the cache tile. isOccupied()
    // includes the player by design, so take one real step away before asking
    // whether the collected ITEM itself still blocks its former tile.
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('KeyA');
    await page.waitForFunction(() => {
      const p = window.__EMBERWILD__.player;
      return p.grid.x === 18 && p.grid.z === 3 && (p.motionState === 0 || p.motionState === 'IDLE');
    }, null, { timeout: STEP_MS });
    const loaded = await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      const F = window.__EMBERWILD_FLAGS__ || {};
      const item = g.npcs.find(npc => npc.id === 'prism_cache');
      const cacheBit = F.PRISM_CACHE_COLLECTED ?? item.flag;
      const depthsBit = F.DEPTHS_CLEARED ?? 13;
      return {
        objective: g.objective,
        cacheBit,
        depthsBit,
        cacheSet: g.flags.get(cacheBit),
        depthsSet: g.flags.get(depthsBit),
        inventory: g.inventory.bright_pod || 0,
        entityGone: !g.entityAt(item.grid.x, item.grid.z, npc => npc.id === 'prism_cache'),
        nonblocking: !g.isOccupied(item.grid.x, item.grid.z),
      };
    });
    const wardenLine = /warden|prism route/i.test(loaded.objective)
      && !/ascension complete/i.test(loaded.objective);
    return {
      okReload: collected.cacheSet && !collected.depthsSet && collected.inventory === 2
        && loaded.cacheSet && !loaded.depthsSet && loaded.inventory === 2 && wardenLine
        && errors.length === 0,
      okItem: loaded.entityGone && loaded.nonblocking && errors.length === 0,
      collected,
      loaded,
      errors,
    };
  } catch (error) {
    return { okReload: false, okItem: false, error: String(error), errors };
  } finally {
    await context.close();
  }
}

async function routeToSightBattle(page, world) {
  const target = world.cone[world.cone.length - 1];
  if (!target) return false;
  const route = world.routes[`${target.x},${target.z}`];
  if (!route) return false;
  await page.evaluate(() => {
    const g = window.__EMBERWILD__;
    g.encounters.onStep = () => false;
    g.delay = async () => {};
  });
  await replayRoute(page, route);
  return advanceTrainerDialogue(page);
}

async function forceActualVictory(page) {
  await page.waitForFunction(() => {
    const b = window.__EMBERWILD__.battle;
    return Boolean(b && b.trainer && !b.busy && b.menu === 'main');
  }, null, { timeout: NAV_MS });
  await page.evaluate(() => {
    const g = window.__EMBERWILD__;
    const b = g.battle;
    b.enemy.currentHP = 1;
    b.enemyDisplayHP = 1;
    b.player.stats.speed = 99_999;
    b.rng.random = () => 0;
    g.delay = async () => {};
  });
  await page.keyboard.press('KeyZ');
  await page.waitForFunction(() => window.__EMBERWILD__.battle?.menu === 'moves',
    null, { timeout: STEP_MS });
  await page.keyboard.press('KeyZ');
  await page.waitForFunction(() => {
    const g = window.__EMBERWILD__;
    const F = window.__EMBERWILD_FLAGS__ || {};
    return g.flags.get(F.WARDEN_LYLE_DEFEATED ?? 12) && g.mode === 'OVERWORLD' && !g.battle;
  }, null, { timeout: NAV_MS });
}

async function testDDWarden(browser, url, world) {
  const { context, page, errors } = await openPage(browser, url);
  try {
    const entered = await routeToSightBattle(page, world);
    if (!entered) return { ok: false, error: 'shipped sight route did not start the trainer battle', errors };
    await forceActualVictory(page);
    const after = await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      const F = window.__EMBERWILD_FLAGS__ || {};
      const warden = g.npcs.find(npc => npc.id === 'warden_lyle');
      return {
        flagSet: g.flags.get(F.WARDEN_LYLE_DEFEATED ?? 12),
        warden: { x: warden.grid.x, z: warden.grid.z, y: warden.grid.y },
        entity: g.entityAt(warden.grid.x, warden.grid.z, npc => npc.id === 'warden_lyle')?.id || null,
        occupied: g.isOccupied(warden.grid.x, warden.grid.z),
      };
    });

    const refreshed = await deriveWorld(page);
    const candidates = [
      { x: after.warden.x, z: after.warden.z - 1 },
      { x: after.warden.x, z: after.warden.z + 1 },
      { x: after.warden.x - 1, z: after.warden.z },
      { x: after.warden.x + 1, z: after.warden.z },
    ];
    const target = candidates.find(candidate => refreshed.routes[`${candidate.x},${candidate.z}`]);
    if (!target) return { ok: false, after, error: 'no post-victory adjacent route to Warden', errors };
    await replayRoute(page, refreshed.routes[`${target.x},${target.z}`]);
    const player = await page.evaluate(() => ({ ...window.__EMBERWILD__.player.grid }));
    const face = facingDirection(player, after.warden);
    if (!face) return { ok: false, after, error: 'post-victory route did not finish adjacent', errors };
    await page.keyboard.press(face.key);
    await page.waitForTimeout(50);
    await page.keyboard.press('KeyZ');
    await page.waitForTimeout(100);
    const dialogue = await page.evaluate(() => ({
      active: window.__EMBERWILD__.ui.dialogue.active,
      lines: window.__EMBERWILD__.ui.dialogue.lines.slice(),
    }));
    const victoryLine = dialogue.active && dialogue.lines.some(line => /Your signal held\. Keep mapping the route\./i.test(line));
    return {
      ok: after.flagSet && after.entity === 'warden_lyle' && after.occupied && victoryLine
        && errors.length === 0,
      after,
      dialogue,
      errors,
    };
  } catch (error) {
    return { ok: false, error: String(error), errors };
  } finally {
    await context.close();
  }
}

async function testV2Mission(browser, url, world) {
  const westRoute = world.routes['15,5'];
  if (!westRoute) return { ok: false, error: 'natural west-adjacent route is absent' };
  const { context, page, errors } = await openPage(browser, url);
  try {
    await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      const warden = g.npcs.find(npc => npc.id === 'warden_lyle');
      warden.__p1Sight = warden.sight;
      warden.sight = 0;
      g.encounters.onStep = () => false;
      g.delay = async () => {};
    });
    await replayRoute(page, westRoute);
    const beforeConfirm = await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      const warden = g.npcs.find(npc => npc.id === 'warden_lyle');
      return { player: { ...g.player.grid }, warden: { ...warden.grid } };
    });
    const faceWarden = facingDirection(beforeConfirm.player, beforeConfirm.warden);
    if (!faceWarden) return { ok: false, error: 'natural west route did not end Warden-adjacent', errors };
    await page.evaluate(() => {
      const warden = window.__EMBERWILD__.npcs.find(npc => npc.id === 'warden_lyle');
      warden.sight = warden.__p1Sight;
    });
    await page.keyboard.press(faceWarden.key);
    await page.waitForTimeout(50);
    await page.keyboard.press('KeyZ');
    if (!await advanceTrainerDialogue(page)) {
      return { ok: false, stage: 'face-confirm', error: 'face-confirm did not start trainer battle', errors };
    }

    await forceActualVictory(page);
    const victory = await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      const F = window.__EMBERWILD_FLAGS__ || {};
      return { flag: g.flags.get(F.WARDEN_LYLE_DEFEATED ?? 12),
        objective: g.objective, player: { ...g.player.grid } };
    });
    if (!victory.flag) return { ok: false, stage: 'victory', victory, errors };

    const postVictoryWorld = await deriveWorld(page);
    const mouth = await page.evaluate(() => {
      const npc = window.__EMBERWILD__.npcs.find(entity => entity.id === 'depths_mouth');
      return { x: npc.grid.x, z: npc.grid.z, y: npc.grid.y };
    });
    const candidates = [
      { x: mouth.x, z: mouth.z - 1 },
      { x: mouth.x, z: mouth.z + 1 },
      { x: mouth.x - 1, z: mouth.z },
      { x: mouth.x + 1, z: mouth.z },
    ];
    const mouthAdjacent = candidates
      .map(target => ({ target, route: postVictoryWorld.routes[`${target.x},${target.z}`] }))
      .filter(entry => entry.route)
      .sort((a, b) => a.route.dirs.length - b.route.dirs.length)[0];
    if (!mouthAdjacent) return { ok: false, stage: 'depths-route', error: 'no reachable adjacent tile', victory, errors };
    await replayRoute(page, mouthAdjacent.route);
    const atMouth = await page.evaluate(() => ({ ...window.__EMBERWILD__.player.grid }));
    const faceMouth = facingDirection(atMouth, mouth);
    if (!faceMouth) return { ok: false, stage: 'depths-face', error: 'route did not end mouth-adjacent', errors };
    await page.keyboard.press(faceMouth.key);
    await page.waitForTimeout(50);
    await page.keyboard.press('KeyZ');
    for (let i = 0; i < 30; i += 1) {
      const entered = await page.evaluate(() => Boolean(window.__EMBERWILD__.depths));
      if (entered) break;
      const dialogue = await page.evaluate(() => window.__EMBERWILD__.ui.dialogue.active);
      if (dialogue) await page.keyboard.press('KeyZ');
      await page.waitForTimeout(100);
    }
    const final = await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      const F = window.__EMBERWILD_FLAGS__ || {};
      return {
        wardenFlag: g.flags.get(F.WARDEN_LYLE_DEFEATED ?? 12),
        depthsEntered: Boolean(g.depths),
        floor: g.depths?.floorIndex ?? null,
      };
    });
    return {
      ok: victory.flag && final.wardenFlag && final.depthsEntered && final.floor === 0
        && errors.length === 0,
      naturalSteps: westRoute.dirs.length,
      coneCrossings: westRoute.cells.filter(cell => world.cone.some(cone => cone.x === cell.x && cone.z === cell.z)).length,
      victory,
      mouthAdjacent,
      final,
      errors,
    };
  } catch (error) {
    return { ok: false, error: String(error), errors };
  } finally {
    await context.close();
  }
}

async function testSplashMigration(browser, origin, variant) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let legacyReads = 0;
  await context.exposeFunction('__ewP1LegacyRead', () => { legacyReads += 1; });
  await context.addInitScript(({ legacy }) => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(key) {
      if (key === legacy) window.__ewP1LegacyRead();
      return original.call(this, key);
    };
  }, { legacy: 'mbm_emberwild_splash_last' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(`${origin}/__emberwild_p1_seed`, { waitUntil: 'domcontentloaded', timeout: NAV_MS });
    const timestamp = Date.now() - 1_000;
    const seeded = await page.evaluate(({ legacy, timestamp }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(legacy, String(timestamp));
      return { local: Object.keys(localStorage), session: Object.keys(sessionStorage) };
    }, { legacy: 'mbm_emberwild_splash_last', timestamp });

    await page.goto(plainUrlFor(origin, variant), { waitUntil: 'domcontentloaded', timeout: NAV_MS });
    await page.waitForFunction(() => document.getElementById('mbmSplash')?.getAttribute('data-mbm-splash-state') === 'closed',
      null, { timeout: NAV_MS });
    await page.waitForTimeout(100);
    const afterFirst = await page.evaluate(({ legacy, shared }) => ({
      legacy: localStorage[legacy] ?? null,
      shared: localStorage[shared] ?? null,
      sessionShared: sessionStorage[shared] ?? null,
      state: document.getElementById('mbmSplash')?.getAttribute('data-mbm-splash-state'),
      hidden: document.getElementById('mbmSplash')?.classList.contains('hidden'),
    }), { legacy: 'mbm_emberwild_splash_last', shared: 'mbm_splash_last' });
    const readsAfterFirst = legacyReads;

    await page.goto(plainUrlFor(origin, variant), { waitUntil: 'domcontentloaded', timeout: NAV_MS });
    await page.waitForFunction(() => document.getElementById('mbmSplash')?.getAttribute('data-mbm-splash-state') === 'closed',
      null, { timeout: NAV_MS });
    await page.waitForTimeout(100);
    const afterSecond = await page.evaluate(({ legacy, shared }) => ({
      legacy: localStorage[legacy] ?? null,
      shared: localStorage[shared] ?? null,
      state: document.getElementById('mbmSplash')?.getAttribute('data-mbm-splash-state'),
      hidden: document.getElementById('mbmSplash')?.classList.contains('hidden'),
    }), { legacy: 'mbm_emberwild_splash_last', shared: 'mbm_splash_last' });
    const readsAfterSecond = legacyReads;
    const exact = String(timestamp);
    return {
      ok: JSON.stringify(seeded.local) === JSON.stringify(['mbm_emberwild_splash_last'])
        && seeded.session.length === 0
        && afterFirst.legacy === exact && afterFirst.shared === exact
        && afterFirst.state === 'closed' && afterFirst.hidden
        && readsAfterFirst === 1
        && afterSecond.legacy === exact && afterSecond.shared === exact
        && afterSecond.state === 'closed' && afterSecond.hidden
        && readsAfterSecond === readsAfterFirst
        && errors.length === 0,
      timestamp: exact,
      seeded,
      afterFirst,
      afterSecond,
      readsAfterFirst,
      readsAfterSecond,
      errors,
    };
  } catch (error) {
    return { ok: false, error: String(error), legacyReads, errors };
  } finally {
    await context.close();
  }
}

async function testRuntimeNetwork(browser, url) {
  const routeOrigin = new URL(url).origin;
  const external = [];
  const session = await openPage(browser, url, {
    beforeNavigate: page => {
      page.on('request', request => {
        let parsed;
        try { parsed = new URL(request.url()); }
        catch (_) { return; }
        if ((parsed.protocol === 'http:' || parsed.protocol === 'https:')
            && parsed.origin !== routeOrigin) external.push(request.url());
      });
    },
  });
  try {
    await session.page.waitForTimeout(250);
    return { ok: external.length === 0 && session.errors.length === 0,
      external, errors: session.errors };
  } finally {
    await session.context.close();
  }
}

async function testSportsPassport(browser, url) {
  const session = await openPage(browser, url, {
    initScript: () => {
      const key = 'mbm_sports_passport_v4';
      const sentinel = '{"owner":"ew-v6-p1-sentinel","xp":1977}';
      const proto = Storage.prototype;
      const rawSet = proto.setItem;
      const rawRemove = proto.removeItem;
      const rawClear = proto.clear;
      rawSet.call(localStorage, key, sentinel);
      window.__ewP1SportsOps = [];
      proto.setItem = function setItem(name, value) {
        if (String(name).startsWith('mbm_sports_passport')) {
          window.__ewP1SportsOps.push({ method: 'setItem', key: String(name) });
        }
        return rawSet.call(this, name, value);
      };
      proto.removeItem = function removeItem(name) {
        if (String(name).startsWith('mbm_sports_passport')) {
          window.__ewP1SportsOps.push({ method: 'removeItem', key: String(name) });
        }
        return rawRemove.call(this, name);
      };
      proto.clear = function clear() {
        window.__ewP1SportsOps.push({ method: 'clear', key: '*' });
        return rawClear.call(this);
      };
    },
  });
  try {
    await session.page.waitForTimeout(250);
    const result = await session.page.evaluate(() => ({
      value: localStorage.getItem('mbm_sports_passport_v4'),
      operations: (window.__ewP1SportsOps || []).slice(),
    }));
    const sentinel = '{"owner":"ew-v6-p1-sentinel","xp":1977}';
    return { ok: result.value === sentinel && result.operations.length === 0
        && session.errors.length === 0,
      ...result, errors: session.errors };
  } finally {
    await session.context.close();
  }
}

function summarizeDA(result) {
  return result.attempts.map(attempt =>
    `${attempt.target.x},${attempt.target.z}:${attempt.reachable ? (attempt.battle ? 'battle' : 'no-battle') : 'unreachable'}`)
    .join(' ');
}

function assessWorld(world) {
  const coneExact = JSON.stringify(world.cone) === JSON.stringify([
    { x: 16, z: 6 }, { x: 16, z: 7 }, { x: 16, z: 8 },
  ]) && world.warden.x === 16 && world.warden.z === 5 && world.warden.y === 1
    && world.warden.facing === 'S' && world.warden.sight === 4;
  const westRoute = world.routes['15,5'];
  const westCells = westRoute?.cells || [];
  const coneKeys = new Set(world.cone.map(cell => `${cell.x},${cell.z}`));
  const stairIndexes = ['15,10', '15,9', '15,8'].map(key =>
    westCells.findIndex(cell => `${cell.x},${cell.z}` === key));
  const naturalApproach = Boolean(westRoute)
    && westRoute.cells.at(-1)?.x === 15 && westRoute.cells.at(-1)?.z === 5
    && westCells.every(cell => !coneKeys.has(`${cell.x},${cell.z}`));
  const grassExact = world.grassTotal === 38
    && JSON.stringify(world.bedCounts) === JSON.stringify([32, 6, 0, 0]);
  return { coneExact, westRoute, westCells, coneKeys, stairIndexes, naturalApproach, grassExact };
}

async function testWorld(browser, url) {
  const session = await openPage(browser, url);
  try {
    const world = await deriveWorld(session.page);
    return { world, ...assessWorld(world), errors: session.errors };
  } finally {
    await session.context.close();
  }
}

async function runCandidate(browser, url, origin, variant = 'candidate') {
  const probe = await openPage(browser, url);
  let world;
  try { world = await deriveWorld(probe.page); }
  finally { await probe.context.close(); }

  const measured = assessWorld(world);
  report(measured.coneExact, 'D-B_CONE', `cone=${world.cone.map(cell => `${cell.x},${cell.z}`).join('|') || 'empty'}`);
  report(measured.naturalApproach, 'D-B_APPROACH',
    `west route=${measured.westRoute?.dirs.length ?? 'missing'} steps stairs=${measured.stairIndexes.join('/')} cone-crossings=${measured.westCells.filter(cell => measured.coneKeys.has(`${cell.x},${cell.z}`)).length}`);
  report(measured.grassExact, 'D-E_GRASS',
    `surviving=${world.grassTotal} beds=${world.bedCounts.join('/')} authored=${world.authoredCounts.join('/')} judgement=plateau and lodge overwrite their earlier beds`);

  const da = await testDA(browser, url, world);
  report(da.ok, 'D-A_FACE_CONFIRM', summarizeDA(da));

  const mission = await testV2Mission(browser, url, world);
  report(mission.ok, 'V2_MISSION', mission.error ||
    `naturalSteps=${mission.naturalSteps} coneCrossings=${mission.coneCrossings} wardenFlag=${mission.final?.wardenFlag} depthsEntered=${mission.final?.depthsEntered} floor=${mission.final?.floor}`);

  const registry = await testRegistry(browser, url);
  report(registry.ok, 'D-C_REGISTRY',
    `present=${registry.result?.present} frozen=${registry.result?.frozen} asserted=${registry.result?.asserted} unique=${registry.result?.unique} namedCallSites=${registry.result?.namedCallSites} entries=${JSON.stringify(registry.result?.entries)} errors=${registry.errors?.length || 0}`);

  const pickup = await testPickup(browser, url, world);
  report(pickup.okReload, 'D-C_RELOAD', pickup.error ||
    `collected=${JSON.stringify(pickup.collected)} loaded=${JSON.stringify(pickup.loaded)}`);
  report(pickup.okItem, 'D-D_ITEM', pickup.error ||
    `entityGone=${pickup.loaded?.entityGone} nonblocking=${pickup.loaded?.nonblocking}`);

  const warden = await testDDWarden(browser, url, world);
  report(warden.ok, 'D-D_WARDEN', warden.error ||
    `flag=${warden.after?.flagSet} entity=${warden.after?.entity} occupied=${warden.after?.occupied} dialogue=${JSON.stringify(warden.dialogue?.lines)}`);

  const splash = await testSplashMigration(browser, origin, variant);
  report(splash.ok, 'SPLASH_MIGRATION', splash.error ||
    `legacyReads=${splash.readsAfterFirst}->${splash.readsAfterSecond} shared=${splash.afterSecond?.shared} retained=${splash.afterSecond?.legacy === splash.timestamp} suppressed=${splash.afterSecond?.state}/${splash.afterSecond?.hidden}`);

  const network = await testRuntimeNetwork(browser, url);
  report(network.ok, 'V10_RUNTIME_NETWORK',
    `external=${network.external.length} errors=${network.errors.length}`);

  const sports = await testSportsPassport(browser, url);
  report(sports.ok, 'SPORTS_PASSPORT_PRESERVED',
    `operations=${JSON.stringify(sports.operations)} sentinel=${sports.value === '{"owner":"ew-v6-p1-sentinel","xp":1977}'}`);

  return { world, da, mission, registry, pickup, warden, splash, network, sports };
}

function mutateDA(html) {
  const start = html.indexOf('checkInteraction(){');
  const end = html.indexOf('handleConfirm(){', start);
  if (start < 0 || end < 0) throw new Error('D-A mutation could not find checkInteraction');
  const section = html.slice(start, end);
  const repaired = "if(npc.type==='TRAINER'){if(npc.flag!=null&&this.flags.get(npc.flag))this.ui.dialogue.show([`${npc.name}: “Your signal held. Keep mapping the route.”`],this);else this.triggerTrainer(npc);return true;}";
  const oldBranch = "if(npc.type==='TRAINER'&&npc.flag!=null&&this.flags.get(npc.flag)){this.ui.dialogue.show([`${npc.name}: “Your signal held. Keep mapping the route.”`],this);return true;}";
  const changed = section.replace(repaired, oldBranch);
  if (changed === section) throw new Error('D-A mutation did not find repaired trainer branch');
  return html.slice(0, start) + changed + html.slice(end);
}

function mutateDuplicateFlag(html) {
  const marker = 'PRISM_CACHE_COLLECTED:14';
  if (!html.includes(marker)) throw new Error('D-C mutation could not find registry claim');
  return html.replace(marker, 'PRISM_CACHE_COLLECTED:13');
}

function mutateGenericFlagExclusion(html) {
  const start = html.indexOf('isOccupied(x,z)');
  const end = html.indexOf('onPlayerStepComplete(', start);
  const entityStart = html.indexOf('entityAt(x,z', end);
  const entityEnd = html.indexOf('checkItemPickup(){', entityStart);
  if (start < 0 || end < 0 || entityStart < 0 || entityEnd < 0) throw new Error('D-D Warden mutation could not locate entity helpers');
  const section = html.slice(start, entityEnd);
  const occupiedClean = "return this.npcs.some(n=>n.type!=='ITEM'&&n.grid.x===x&&n.grid.z===z);";
  const occupiedGeneric = "return this.npcs.some(n=>n.type!=='ITEM'&&n.grid.x===x&&n.grid.z===z&&!(n.flag!=null&&this.flags.get(n.flag)));";
  if (!section.includes(occupiedClean)) throw new Error('D-D Warden mutation found no repaired isOccupied');
  const scoped = /!\(n\.type==='ITEM'&&n\.flag!=null&&this\.flags\.get\(n\.flag\)\)/g;
  if (!(section.match(scoped) || []).length) throw new Error('D-D Warden mutation found no item-scoped entityAt exclusion');
  const changed = section.replace(occupiedClean, occupiedGeneric)
    .replace(scoped, '!(n.flag!=null&&this.flags.get(n.flag))');
  return html.slice(0, start) + changed + html.slice(entityEnd);
}

function mutateBrokenItemScope(html) {
  const start = html.indexOf('entityAt(x,z');
  const end = html.indexOf('checkItemPickup(', start);
  if (start < 0 || end < 0) throw new Error('D-D ITEM mutation could not locate entityAt');
  const section = html.slice(start, end);
  const scoped = /&&?!\(n\.type==='ITEM'&&n\.flag!=null&&this\.flags\.get\([^)]*\)\)/;
  let changed = section.replace(scoped, '');
  if (changed === section) {
    changed = section.replace(/&&?!\(n\.flag!=null&&this\.flags\.get\(n\.flag\)&&n\.type==='ITEM'\)/, '');
  }
  if (changed === section) throw new Error('D-D ITEM mutation found no entityAt item exclusion');
  return html.slice(0, start) + changed + html.slice(end);
}

function mutateConeSight(html) {
  const pattern = /(id:\s*'warden_lyle'[\s\S]{0,180}?sight:\s*)4/;
  const changed = html.replace(pattern, '$1' + '2');
  if (changed === html) throw new Error('D-B cone mutation could not change Warden sight');
  return changed;
}

function mutateApproachFacing(html) {
  const pattern = /(id:\s*'warden_lyle'[\s\S]{0,140}?facing:\s*)'S'/;
  const changed = html.replace(pattern, "$1'W'");
  if (changed === html) throw new Error('D-B approach mutation could not turn Warden west');
  return changed;
}

function mutateGrass(html) {
  const marker = '    map.entities = [';
  if (!html.includes(marker)) throw new Error('D-E mutation could not find map entity insertion point');
  return html.replace(marker,
    "    map.setCell(12,14,{ground:Ground.MEADOW,surface:Surface.WALKABLE,tags:['p1-control']});\n" + marker);
}

function mutateReloadCollision(html) {
  const pattern = /(id:\s*'prism_cache'[\s\S]{0,180}?flag:\s*)EWFlags\.PRISM_CACHE_COLLECTED/;
  const changed = html.replace(pattern, '$1EWFlags.DEPTHS_CLEARED');
  if (changed === html) throw new Error('D-C reload mutation could not collide prism_cache with Depths');
  return changed;
}

function mutateSplashMigration(html) {
  const pattern = "var KEY='mbm_splash_last',DAY=86400000";
  if (!html.includes(pattern)) throw new Error('splash mutation could not find shared key branch');
  return html.replace(pattern, "var KEY='mbm_splash_last_broken',DAY=86400000");
}

function mutateRuntimeNetwork(html) {
  const marker = '</head>';
  if (!html.includes(marker)) throw new Error('network mutation could not find </head>');
  return html.replace(marker,
    '<script>fetch("https://example.invalid/ewv6-firing-control").catch(function(){})</script></head>');
}

function mutateSportsPassport(html) {
  const marker = "const APP_VERSION = '2.0.1';";
  if (!html.includes(marker)) throw new Error('sports-passport mutation could not find APP_VERSION');
  return html.replace(marker,
    "localStorage.removeItem('mbm_sports_passport_v4');\n  " + marker);
}

async function runControl(id, buildMutation, evaluator, { expectKey = 'ok' } = {}) {
  let mutated;
  try {
    mutated = buildMutation();
  } catch (error) {
    report(false, `NV_${id}`, `mutation setup failed: ${error}`);
    return;
  }
  const result = await evaluator(mutated);
  const caught = result && result[expectKey] === false;
  report(caught, `NV_${id}`, caught ? 'deliberate violation caught by named gate'
    : `deliberate violation MISSED result=${JSON.stringify(result)}`);
}

async function main() {
  if (!fs.existsSync(GAME)) fatal(`game file not found: ${GAME}`);
  const source = fs.readFileSync(GAME, 'utf8');
  const chromium = await loadChromium();
  if (!chromium) {
    skip('BROWSER', 'Playwright is not importable');
    fatal('required browser gate skipped');
  }
  const executablePath = findExecutable();
  if (process.env.EMBERWILD_CHROME && !executablePath) {
    skip('BROWSER', `EMBERWILD_CHROME does not exist: ${process.env.EMBERWILD_CHROME}`);
    fatal('required browser gate skipped');
  }

  const variants = new Map([['candidate', source]]);
  const server = makeServer(variants);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    process.stdout.write(`Emberwild P1 verifier\nfile=${GAME}\nbytes=${Buffer.byteLength(source)}\nselftest=${SELFTEST}\n`);
    await runCandidate(browser, urlFor(origin, 'candidate'), origin, 'candidate');

    if (SELFTEST) {
      process.stdout.write('SELFTEST  throwaway mutations through the same gate entry points\n');
      const baseWorldSession = await openPage(browser, urlFor(origin, 'candidate'));
      let baseWorld;
      try { baseWorld = await deriveWorld(baseWorldSession.page); }
      finally { await baseWorldSession.context.close(); }

      let serial = 0;
      const installEntry = html => {
        const name = `control${serial++}`;
        variants.set(name, html);
        return { name, url: urlFor(origin, name) };
      };
      const install = html => installEntry(html).url;

      await runControl('D-B_CONE', () => mutateConeSight(source), async html =>
        testWorld(browser, install(html)), { expectKey: 'coneExact' });
      await runControl('D-B_APPROACH', () => mutateApproachFacing(source), async html =>
        testWorld(browser, install(html)), { expectKey: 'naturalApproach' });
      await runControl('D-E_GRASS', () => mutateGrass(source), async html =>
        testWorld(browser, install(html)), { expectKey: 'grassExact' });
      await runControl('D-A_FACE_CONFIRM', () => mutateDA(source), async html =>
        testDA(browser, install(html), baseWorld));
      await runControl('V2_MISSION', () => mutateDA(source), async html =>
        testV2Mission(browser, install(html), baseWorld));
      await runControl('D-C_REGISTRY', () => mutateDuplicateFlag(source), async html =>
        testRegistry(browser, install(html)));
      await runControl('D-C_RELOAD', () => mutateReloadCollision(source), async html =>
        testPickup(browser, install(html), baseWorld), { expectKey: 'okReload' });
      await runControl('D-D_WARDEN', () => mutateGenericFlagExclusion(source), async html =>
        testDDWarden(browser, install(html), baseWorld));
      await runControl('D-D_ITEM', () => mutateBrokenItemScope(source), async html =>
        testPickup(browser, install(html), baseWorld), { expectKey: 'okItem' });
      await runControl('SPLASH_MIGRATION', () => mutateSplashMigration(source), async html => {
        const entry = installEntry(html);
        return testSplashMigration(browser, origin, entry.name);
      });
      await runControl('V10_RUNTIME_NETWORK', () => mutateRuntimeNetwork(source), async html =>
        testRuntimeNetwork(browser, install(html)));
      await runControl('SPORTS_PASSPORT_PRESERVED', () => mutateSportsPassport(source), async html =>
        testSportsPassport(browser, install(html)));
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  process.stdout.write(`RESULT  pass=${passed} fail=${failed} skip=${skipped}\n`);
  if (skipped > 0) process.exit(2);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(error => {
  process.stderr.write(`HARNESS ERROR  ${error?.stack || error}\n`);
  process.stdout.write(`RESULT  pass=${passed} fail=${failed + 1} skip=${skipped}\n`);
  process.exit(2);
});
