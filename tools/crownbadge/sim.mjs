#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gamePath = path.resolve(here, '../../crownbadge/index.html');
const RUNS = 120;

function engineSource() {
  const html = fs.readFileSync(gamePath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  const source = scripts.find(script => script.includes('root.FrontierCore=Object.freeze'));
  assert(source, 'FrontierCore script was not found');
  return source;
}

function loadCore(transform = source => source) {
  const context = Object.create(null);
  context.globalThis = context;
  vm.runInNewContext(transform(engineSource()), context, { filename: 'crownbadge-frontier-core.js' });
  assert(context.FrontierCore, 'FrontierCore did not load');
  return context.FrontierCore;
}

function sortedCalls(state) {
  return state.incidents
    .filter(incident => incident.status === 'active')
    .slice()
    .sort((a, b) => a.deadline - b.deadline || b.authorityPenalty - a.authorityPenalty || a.id.localeCompare(b.id));
}

function chooseSquad(Core, state, incident) {
  const chosen = [];
  let chance = -1;
  while (chosen.length < 3 && chance < .85) {
    const candidates = state.officers
      .filter(officer => officer.status === 'ready' && !chosen.includes(officer.id))
      .map(officer => {
        const ids = [...chosen, officer.id];
        const preview = Core.squadPreview(state, incident.id, ids, 'charge');
        return { id: officer.id, chance: preview ? preview.winChanceRaw : -1 };
      })
      .sort((a, b) => b.chance - a.chance || a.id.localeCompare(b.id));
    const best = candidates[0];
    if (!best || best.chance <= chance) break;
    chosen.push(best.id);
    chance = best.chance;
  }
  return chosen;
}

function play(Core, difficulty, seed, policy = 'greedy') {
  const state = Core.createCampaign(seed, {}, difficulty);
  let guard = 0;
  while (![Core.STATES.VICTORY, Core.STATES.DEFEAT].includes(state.gameState)) {
    assert(++guard <= 40, `campaign exceeded 40 turns: ${difficulty} ${seed}`);
    if (policy === 'greedy') {
      for (const call of sortedCalls(state)) {
        if (state.gameState !== Core.STATES.PLANNING) break;
        const incident = Core.getIncident(state, call.id);
        if (!incident || incident.status !== 'active') continue;
        const squad = chooseSquad(Core, state, incident);
        if (squad.length) Core.dispatchIncident(state, incident.id, squad, 'charge');
      }
    }
    if (state.gameState === Core.STATES.PLANNING) Core.advanceDay(state);
  }
  return state;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function batch(Core, difficulty, policy = 'greedy', count = RUNS) {
  const states = Array.from({ length: count }, (_, index) => play(Core, difficulty, `CROWN-SIM-${String(index + 1).padStart(3, '0')}`, policy));
  const wins = states.filter(state => state.outcome === 'VICTORY').length;
  const defeats = states.filter(state => state.outcome === 'DEFEAT');
  return {
    states,
    wins,
    rate: wins / count,
    medianEndDay: median(states.map(state => state.day)),
    medianDefeatAuthority: defeats.length ? median(defeats.map(state => state.resources.authority)) : null,
    maxLog: Math.max(...states.map(state => state.log.length))
  };
}

function replaceRequired(source, before, after, label) {
  const count = source.split(before).length - 1;
  assert.equal(count, 1, `${label}: expected one source match, found ${count}`);
  return source.replace(before, after);
}

const Core = loadCore();
const results = Object.fromEntries(['calm', 'standard', 'hard'].map(difficulty => [difficulty, batch(Core, difficulty)]));
const idle = Object.fromEntries(['calm', 'standard', 'hard'].map(difficulty => [difficulty, batch(Core, difficulty, 'idle')]));

assert(results.calm.rate >= .70 && results.calm.rate <= .85, `Calm win rate ${results.calm.rate} is outside 70–85%`);
assert(results.standard.rate >= .45 && results.standard.rate <= .65, `Standard win rate ${results.standard.rate} is outside 45–65%`);
assert(results.hard.rate >= .25 && results.hard.rate <= .45, `Hard win rate ${results.hard.rate} is outside 25–45%`);
assert(results.hard.medianEndDay >= 24, `Hard median end day ${results.hard.medianEndDay} is below 24`);

for (const difficulty of ['calm', 'standard', 'hard']) {
  assert.equal(idle[difficulty].wins, 0, `${difficulty} idle policy must never win`);
  assert(idle[difficulty].medianEndDay >= 6 && idle[difficulty].medianEndDay <= 9,
    `${difficulty} idle median ${idle[difficulty].medianEndDay} is outside day 6–9`);
  for (const state of results[difficulty].states) {
    assert(Number.isInteger(state.logGenerated), 'campaign must count Chronicle entries');
    assert.equal(state.log.length, state.logGenerated, 'Chronicle truncated a generated entry');
  }
}

for (let index = 1; index <= 20; index += 1) {
  const seed = `CROWN-DETERMINISM-${String(index).padStart(2, '0')}`;
  assert.equal(JSON.stringify(play(Core, 'hard', seed)), JSON.stringify(play(Core, 'hard', seed)), `determinism failed for ${seed}`);
}

const source = engineSource();
assert.equal((fs.readFileSync(gamePath, 'utf8').match(/Math\.random/g) || []).length, 1, 'Math.random occurrence ceiling changed');

const legacyHardCore = loadCore(current => replaceRequired(
  current,
  "hard:{id:'hard',name:'High Frontier',threat:1.06,penalty:1.05,spawn:1.11,valor:1.45}",
  "hard:{id:'hard',name:'High Frontier',threat:1.28,penalty:1.32,spawn:1.28,valor:1.45}",
  'legacy Hard control'
));
const legacyHard = batch(legacyHardCore, 'hard');
assert(!(legacyHard.rate >= .25 && legacyHard.rate <= .45 && legacyHard.medianEndDay >= 24), 'legacy Hard unexpectedly passed the launch band');

const cap40Core = loadCore(current => replaceRequired(current, 'state.log=state.log.slice(0,200)', 'state.log=state.log.slice(0,40)', 'Chronicle cap control'));
const cap40 = batch(cap40Core, 'calm');
assert(cap40.states.some(state => state.log.length !== state.logGenerated), '40-entry Chronicle control unexpectedly retained every entry');

const observedMax = Math.max(...Object.values(results).flatMap(result => result.states.map(state => state.logGenerated)));
for (const difficulty of ['calm', 'standard', 'hard']) {
  const result = results[difficulty];
  const idleResult = idle[difficulty];
  console.log(`${difficulty.padEnd(8)} greedy ${String(result.wins).padStart(3)}/${RUNS} (${(result.rate * 100).toFixed(1)}%) · median day ${result.medianEndDay} · idle 0/${RUNS}, median day ${idleResult.medianEndDay}`);
}
console.log(`legacy Hard control ${legacyHard.wins}/${RUNS} (${(legacyHard.rate * 100).toFixed(1)}%) · median day ${legacyHard.medianEndDay}`);
console.log(`Chronicle observed max ${observedMax}/200 · 40-cap control truncated ${cap40.states.filter(state => state.log.length !== state.logGenerated).length}/${RUNS}`);
console.log('determinism 20/20 seeds · Math.random 1 (audio noise only)');
