#!/usr/bin/env node

/**
 * Titan Forge's DOM-free progression model and launch assertions.
 *
 * The shipped single-file game contains a minified React view. This module is
 * deliberately plain JavaScript: it owns the arithmetic that launch balance
 * is measured against and can run in Node without a DOM or React.
 */

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const LEGACY = Object.freeze({
  ascendAt: 900,
  gear: [
    { id: 0, power: 1, cost: 0, required: 0 },
    { id: 1, power: 3, cost: 120, required: 24 },
    { id: 2, power: 7, cost: 520, required: 90 },
    { id: 3, power: 15, cost: 1800, required: 260 },
    { id: 4, power: 34, cost: 7500, required: 720 },
  ],
  zones: [
    { id: 0, boost: 1, required: 0 },
    { id: 1, boost: 1.5, required: 150 },
    { id: 2, boost: 2.3, required: 600 },
  ],
  trials: [
    { id: 0, target: 26, reward: 180, required: 0 },
    { id: 1, target: 80, reward: 620, required: 120 },
    { id: 2, target: 210, reward: 2400, required: 500 },
  ],
  comboBase: 12,
  coinBase: 0.72,
});

export const BALANCED = Object.freeze({
  ascendAt: 50_000,
  gear: [
    { id: 0, power: 1, cost: 0, required: 0 },
    { id: 1, power: 3, cost: 120, required: 35 },
    { id: 2, power: 7, cost: 650, required: 250 },
    { id: 3, power: 15, cost: 2200, required: 1500 },
    { id: 4, power: 34, cost: 8000, required: 6000 },
  ],
  zones: [
    { id: 0, boost: 1, required: 0 },
    { id: 1, boost: 1.5, required: 1000 },
    { id: 2, boost: 2.3, required: 8000 },
  ],
  trials: [
    { id: 0, target: 26, reward: 180, required: 0 },
    { id: 1, target: 400, reward: 900, required: 2000 },
    { id: 2, target: 2200, reward: 4000, required: 12_000 },
  ],
  comboBase: 12,
  coinBase: 0.72,
  upgradeCosts: {
    starterTier: [12, 24, 40, 64],
    comboLevel: [10, 20, 35],
    windowLevel: [10, 20, 35],
  },
});

export function levelFor(strength) {
  return Math.max(1, Math.floor(Math.sqrt(strength) / 2.6));
}

export function nextLevelStrength(level) {
  return ((level + 1) * 2.6) ** 2;
}

export function liftGain({ gearPower, zoneBoost, timingMultiplier, combo, comboCap, ascensions }) {
  const comboMultiplier = 1 + Math.min(combo, comboCap) * 0.035;
  const ascensionMultiplier = 1 + ascensions * 0.35;
  return Math.max(1, Math.round(
    gearPower * zoneBoost * timingMultiplier * comboMultiplier * ascensionMultiplier,
  ));
}

export function coinGain(strengthBeforeLift, strengthGain, coinBase = BALANCED.coinBase) {
  return Math.max(1, Math.ceil(
    strengthGain * (coinBase + levelFor(strengthBeforeLift) * 0.015),
  ));
}

export function timingPosition(elapsedMs, { start = 0, trial = false } = {}) {
  const speed = trial ? 1.4375 : 1;
  const phase = ((start + elapsedMs / 1000 * speed) % 2 + 2) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

export function simulateMeter(frameMs, durationMs, legacy = false) {
  if (!legacy) return timingPosition(durationMs);
  let position = 0;
  let direction = 1;
  for (let t = frameMs; t <= durationMs; t += frameMs) {
    position += direction * 0.032;
    if (position >= 1) {
      position = 1;
      direction = -1;
    } else if (position <= 0) {
      position = 0;
      direction = 1;
    }
  }
  return position;
}

export function seededRandom(seed) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x1_0000_0000;
  };
}

function highestAvailable(items, strength) {
  return items.reduce((best, item) => item.required <= strength ? item : best, items[0]);
}

export function simulateLegacy(perfectRate, seed = 1) {
  const random = seededRandom(seed);
  let strength = 12;
  let coins = 80;
  let earnedCoins = 0;
  let combo = 0;
  let taps = 0;
  const purchased = new Set([0]);
  let equipped = 0;
  let zone = 0;

  while (strength < LEGACY.ascendAt) {
    for (const gear of LEGACY.gear.slice(1)) {
      if (!purchased.has(gear.id) && strength >= gear.required && coins >= gear.cost) {
        coins -= gear.cost;
        purchased.add(gear.id);
        equipped = gear.id;
      }
    }
    zone = highestAvailable(LEGACY.zones, strength).id;
    const perfect = random() < perfectRate;
    combo += 1;
    const gain = liftGain({
      gearPower: LEGACY.gear[equipped].power,
      zoneBoost: LEGACY.zones[zone].boost,
      timingMultiplier: perfect ? 2.6 : 1.55,
      combo,
      comboCap: LEGACY.comboBase,
      ascensions: 0,
    });
    const reward = coinGain(strength, gain, LEGACY.coinBase);
    strength += gain;
    coins += reward;
    earnedCoins += reward;
    taps += 1;
  }

  return { taps, equipped, earnedCoins, coins, strength };
}

function upgradeValue(kind, state, perfectRate, config) {
  const costs = config.upgradeCosts[kind];
  const level = state[kind];
  const cost = costs[level];
  if (cost === undefined || cost > state.gems) return null;

  if (kind === 'starterTier') {
    const next = level + 1;
    if (!state.purchased.has(next)) return null;
    return { kind, cost, value: (config.gear[next].power / config.gear[level].power - 1) / cost };
  }
  if (kind === 'comboLevel') return { kind, cost, value: 0.14 / cost };
  return { kind, cost, value: (0.04 * (1 - perfectRate)) / cost };
}

function spendOptimally(state, perfectRate, config) {
  for (;;) {
    const options = ['starterTier', 'comboLevel', 'windowLevel']
      .map(kind => upgradeValue(kind, state, perfectRate, config))
      .filter(Boolean)
      .sort((a, b) => b.value - a.value || a.cost - b.cost);
    if (!options.length) return;
    const chosen = options[0];
    state.gems -= chosen.cost;
    state.gemsSpent += chosen.cost;
    state[chosen.kind] += 1;
  }
}

function maybeClaimQuests(state) {
  if (!state.claimedQuests.has(0) && state.reps >= 12) {
    state.claimedQuests.add(0);
    state.coins += 140;
  }
  if (!state.claimedQuests.has(1) && state.perfects >= 5) {
    state.claimedQuests.add(1);
    state.gems += 2;
  }
  if (!state.claimedQuests.has(2) && state.strength >= 200) {
    state.claimedQuests.add(2);
    state.coins += 500;
  }
}

export function simulateBalanced(
  perfectRate,
  seed = 1,
  ascensionTarget = 3,
  { legacyPrestige = false } = {},
) {
  const config = BALANCED;
  const random = seededRandom(seed);
  const state = {
    strength: 12,
    coins: 80,
    gems: 3,
    reps: 0,
    perfects: 0,
    bestCombo: 0,
    ascensions: 0,
    purchased: new Set([0]),
    equipped: 0,
    zone: 0,
    claimedQuests: new Set(),
    lastDaily: '',
    attemptedTrials: new Set(),
    starterTier: 0,
    comboLevel: 0,
    windowLevel: 0,
    gemsSpent: 0,
  };

  const result = {
    tapsPerAscension: [],
    gearFirstOwned: new Map([[0, 0]]),
    zoneFirstEntered: new Map([[0, 0]]),
    trialCoins: 0,
    liftCoins: 0,
    dailyClaims: 0,
    ascensionSnapshots: [],
    ascensionTransitions: [],
  };

  let combo = 0;
  let runTaps = 0;
  let activeTrial = null;

  while (state.ascensions < ascensionTarget) {
    if (!state.lastDaily) {
      state.lastDaily = '2026-08-27';
      state.dailyClaims += 1;
      result.dailyClaims += 1;
      state.coins += 175;
      state.gems += 1;
    }

    for (const gear of config.gear.slice(1)) {
      if (!state.purchased.has(gear.id)
          && state.strength >= gear.required
          && state.coins >= gear.cost) {
        state.coins -= gear.cost;
        state.purchased.add(gear.id);
        state.equipped = gear.id;
        if (!result.gearFirstOwned.has(gear.id)) {
          result.gearFirstOwned.set(gear.id, state.ascensions + 1);
        }
      }
    }

    const availableZone = highestAvailable(config.zones, state.strength).id;
    if (availableZone !== state.zone) {
      state.zone = availableZone;
      if (!result.zoneFirstEntered.has(availableZone)) {
        result.zoneFirstEntered.set(availableZone, state.ascensions + 1);
      }
    }

    spendOptimally(state, perfectRate, config);

    if (!activeTrial) {
      const nextTrial = config.trials.find(trial =>
        trial.required <= state.strength && !state.attemptedTrials.has(trial.id));
      if (nextTrial) {
        state.attemptedTrials.add(nextTrial.id);
        activeTrial = { ...nextTrial, power: 0 };
      }
    }

    const effectivePerfectRate = Math.min(
      1,
      perfectRate + (1 - perfectRate) * state.windowLevel * 0.04,
    );
    const perfect = random() < effectivePerfectRate;
    combo += 1;
    state.bestCombo = Math.max(state.bestCombo, combo);
    const gain = liftGain({
      gearPower: config.gear[state.equipped].power,
      zoneBoost: config.zones[state.zone].boost,
      timingMultiplier: perfect ? 2.6 : 1.55,
      combo,
      comboCap: config.comboBase + state.comboLevel * 4,
      ascensions: state.ascensions,
    });
    const oldLevel = levelFor(state.strength);
    const reward = coinGain(state.strength, gain, config.coinBase);
    state.strength += gain;
    state.coins += reward;
    state.reps += 1;
    state.perfects += perfect ? 1 : 0;
    result.liftCoins += reward;
    runTaps += 1;

    if (levelFor(state.strength) > oldLevel) state.gems += 1;
    if (activeTrial) {
      activeTrial.power += Math.round(gain * 2.15);
      if (activeTrial.power >= activeTrial.target) {
        state.coins += activeTrial.reward;
        result.trialCoins += activeTrial.reward;
        activeTrial = null;
      }
    }
    maybeClaimQuests(state);

    if (state.strength >= config.ascendAt) {
      const beforeAscend = {
        reps: state.reps,
        perfects: state.perfects,
        bestCombo: state.bestCombo,
        lastDaily: state.lastDaily,
        claimedQuests: [...state.claimedQuests].sort(),
      };
      result.tapsPerAscension.push(runTaps);
      result.ascensionSnapshots.push(beforeAscend);
      runTaps = 0;
      state.ascensions += 1;
      state.gems += 8;
      spendOptimally(state, perfectRate, config);

      // Only run-scoped fields reset. Lifetime records, daily state, quest
      // claims and upgrades deliberately survive the prestige action.
      state.strength = 12;
      state.coins = 80;
      state.purchased = new Set(
        Array.from({ length: state.starterTier + 1 }, (_, id) => id),
      );
      state.equipped = state.starterTier;
      state.zone = 0;
      state.attemptedTrials = new Set();
      combo = 0;
      activeTrial = null;
      if (legacyPrestige) {
        state.purchased = new Set([0]);
        state.equipped = 0;
        state.reps = 0;
        state.perfects = 0;
        state.bestCombo = 0;
        state.lastDaily = '';
        state.claimedQuests = new Set();
        state.starterTier = 0;
        state.comboLevel = 0;
        state.windowLevel = 0;
      }
      result.ascensionTransitions.push({
        before: beforeAscend,
        after: {
          reps: state.reps,
          perfects: state.perfects,
          bestCombo: state.bestCombo,
          lastDaily: state.lastDaily,
          claimedQuests: [...state.claimedQuests].sort(),
        },
      });
    }
  }

  return { state, ...result };
}

export function sustainableTapRatePerMinute() {
  // Six energy per lift; 1.4 energy every 100 ms = 14 energy/second.
  return 14 / 6 * 60;
}

export function bestNonTrialCoinRate(
  config,
  strength,
  perfectRate = 0.5,
  { gearId, zoneId } = {},
) {
  const gear = gearId === undefined
    ? highestAvailable(config.gear, strength)
    : config.gear[gearId];
  const zone = zoneId === undefined
    ? highestAvailable(config.zones, strength)
    : config.zones[zoneId];
  const expectedTiming = perfectRate * 2.6 + (1 - perfectRate) * 1.55;
  const expectedGain = liftGain({
    gearPower: gear.power,
    zoneBoost: zone.boost,
    timingMultiplier: expectedTiming,
    combo: config.comboBase,
    comboCap: config.comboBase,
    ascensions: 0,
  });
  return coinGain(strength, expectedGain, config.coinBase) * sustainableTapRatePerMinute();
}

export function repeatedTrialRate(trial) {
  return trial.reward / (12 / 60);
}

export function oneAttemptTrialRate(trial, observedWindows = 10) {
  return trial.reward / (observedWindows * 12 / 60);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function runLaunchAssertions() {
  const legacyPerfect = simulateLegacy(1, 1);
  assert.equal(legacyPerfect.taps, 56, 'legacy model must reproduce 56 perfect taps');
  assert.equal(legacyPerfect.equipped, 2, 'legacy model must finish on gear id 2');
  assert.equal(legacyPerfect.earnedCoins, 776, 'legacy model must reproduce 776 earned coins');
  const legacyQuarter = mean(Array.from({ length: 1000 }, (_, seed) =>
    simulateLegacy(0.25, seed + 1).taps));
  assert.ok(legacyQuarter >= 78 && legacyQuarter <= 79,
    `legacy 25% model drifted: ${legacyQuarter}`);

  const rates = [0.25, 0.5, 1];
  const cohorts = new Map(rates.map(rate => [
    rate,
    Array.from({ length: 1000 }, (_, seed) => simulateBalanced(rate, seed + 1)),
  ]));
  const firstAscension = Object.fromEntries(rates.map(rate => [
    rate,
    mean(cohorts.get(rate).map(run => run.tapsPerAscension[0])),
  ]));

  assert.ok(firstAscension[0.5] >= 250 && firstAscension[0.5] <= 450,
    `50% first ascension out of band: ${firstAscension[0.5]}`);
  assert.ok(firstAscension[1] >= 180,
    `100% first ascension is too short: ${firstAscension[1]}`);

  const allRuns = [...cohorts.values()].flat();
  const titanCoreBy = Math.max(...allRuns.map(run => run.gearFirstOwned.get(4) ?? Infinity));
  const allGearBy = Math.max(...allRuns.flatMap(run => [...run.gearFirstOwned.values()]));
  const allZonesBy = Math.max(...allRuns.flatMap(run => [...run.zoneFirstEntered.values()]));
  const minGemsSpent = Math.min(...allRuns.map(run => run.state.gemsSpent));
  const coreGate = ascension => ascension <= 3;
  const trialGate = ratio => ratio <= 3;
  const gemGate = spent => spent > 0;
  assert.ok(coreGate(titanCoreBy), `Titan Core first owned in ascension ${titanCoreBy}`);
  assert.ok(allGearBy <= 3, `a gear tier was not entered by ascension 3: ${allGearBy}`);
  assert.ok(allZonesBy <= 3, `a zone was not entered by ascension 3: ${allZonesBy}`);
  assert.ok(gemGate(minGemsSpent), 'optimal policy spent no gems');

  const finalAtlas = BALANCED.trials[2];
  const finalNonTrial = bestNonTrialCoinRate(BALANCED, finalAtlas.required);
  const finalTrial = oneAttemptTrialRate(finalAtlas);
  const finalTrialRatio = finalTrial / finalNonTrial;
  assert.ok(trialGate(finalTrialRatio), `final trial rate ratio is ${finalTrialRatio}`);

  // Controls. Each old defect must still make its own gate red.
  const legacyAtlas = LEGACY.trials[2];
  // At Atlas-9's legacy unlock the measured competent path still owns Ember
  // Bells (id 2) in Neon Foundry (id 1); Storm Bar's 1,800-coin price is the
  // unreachable tier this control is proving rather than granting for free.
  const legacyTrialRatio = repeatedTrialRate(legacyAtlas)
    / bestNonTrialCoinRate(LEGACY, legacyAtlas.required, 0.5, { gearId: 2, zoneId: 1 });
  assert.equal(trialGate(legacyTrialRatio), false,
    `CONTROL DID NOT BITE: legacy repeatable trial ratio ${legacyTrialRatio}`);
  const legacyTitanCoreBy = legacyPerfect.equipped === 4 ? 1 : Infinity;
  assert.equal(coreGate(legacyTitanCoreBy), false,
    'CONTROL DID NOT BITE: legacy prices unexpectedly passed the Titan Core gate');
  assert.equal(gemGate(0), false,
    'CONTROL DID NOT BITE: removing the gem sink unexpectedly passed the spend gate');

  const normalMeter = simulateMeter(32, 1000, false);
  const stretchedMeter = simulateMeter(96, 1000, false);
  assert.ok(Math.abs(normalMeter - stretchedMeter) <= 0.03,
    'wall-clock meter changed under a 3x frame stretch');
  const legacyNormalMeter = simulateMeter(32, 1000, true);
  const legacyStretchedMeter = simulateMeter(96, 1000, true);
  assert.ok(Math.abs(legacyNormalMeter - legacyStretchedMeter) > 0.03,
    'CONTROL DID NOT BITE: fixed-increment meter survived 3x stretch');

  for (const run of allRuns) {
    assert.equal(run.dailyClaims, 1, 'daily cache was claimable after ascension');
    for (const transition of run.ascensionTransitions) {
      assert.ok(transition.after.bestCombo >= transition.before.bestCombo,
        'best combo decreased during ascension');
      assert.equal(transition.after.reps, transition.before.reps,
        'lifetime reps changed during ascension');
      assert.deepEqual(transition.after.claimedQuests, transition.before.claimedQuests,
        'quest claims changed during ascension');
      assert.equal(transition.after.lastDaily, transition.before.lastDaily,
        'daily cache marker changed during ascension');
    }
    for (let i = 1; i < run.ascensionSnapshots.length; i += 1) {
      const previous = run.ascensionSnapshots[i - 1];
      const current = run.ascensionSnapshots[i];
      assert.ok(current.bestCombo >= previous.bestCombo, 'best combo decreased on ascension');
      assert.ok(current.reps > previous.reps, 'lifetime reps did not increase');
      assert.deepEqual(current.claimedQuests, previous.claimedQuests,
        'claimed quests changed across ascension');
    }
  }

  const legacyHistory = simulateBalanced(0.5, 777, 3, { legacyPrestige: true });
  const legacyBestPreserved = legacyHistory.ascensionTransitions.every(
    transition => transition.after.bestCombo >= transition.before.bestCombo,
  );
  const legacyRepsPreserved = legacyHistory.ascensionTransitions.every(
    transition => transition.after.reps === transition.before.reps,
  );
  const legacyClaimsPreserved = legacyHistory.ascensionTransitions.every(
    transition => JSON.stringify(transition.after.claimedQuests) === JSON.stringify(transition.before.claimedQuests),
  );
  assert.equal(legacyBestPreserved, false,
    'CONTROL DID NOT BITE: legacy ascend preserved bestCombo');
  assert.equal(legacyRepsPreserved, false,
    'CONTROL DID NOT BITE: legacy ascend preserved lifetime reps');
  assert.equal(legacyClaimsPreserved, false,
    'CONTROL DID NOT BITE: legacy ascend preserved quest claims');
  assert.notEqual(legacyHistory.dailyClaims, 1,
    'CONTROL DID NOT BITE: legacy ascend kept the daily cache single-claim');

  return {
    legacy: {
      perfectTaps: legacyPerfect.taps,
      quarterPerfectTaps: legacyQuarter,
      finalGear: legacyPerfect.equipped,
      earnedCoins: legacyPerfect.earnedCoins,
    },
    balanced: {
      firstAscensionMeanTaps: firstAscension,
      titanCoreByAscension: titanCoreBy,
      allGearByAscension: allGearBy,
      allZonesByAscension: allZonesBy,
      minimumGemsSpentOverThreeAscensions: minGemsSpent,
      trialToBestNonTrialRateRatio: finalTrialRatio,
      legacyTrialControlRatio: legacyTrialRatio,
      meterFrameStretchDelta: Math.abs(normalMeter - stretchedMeter),
      legacyMeterControlDelta: Math.abs(legacyNormalMeter - legacyStretchedMeter),
      legacyHistoryDailyClaims: legacyHistory.dailyClaims,
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = runLaunchAssertions();
  console.log(JSON.stringify(report, null, 2));
}
