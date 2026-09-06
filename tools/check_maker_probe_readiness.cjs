'use strict';
// Deterministic callback-order control for the real verifier helper. Browser
// geometry and product focus remain covered by the ordinary CI route probes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('tools/verify_maker_splash.mjs', 'utf8');
const start = source.indexOf('async function settleProbeFrames(page) {');
const end = source.indexOf('\n\nasync function pageProbe', start);
assert(start >= 0 && end > start);
const helperSource = source.slice(start, end);
const real = vm.runInNewContext('(' + helperSource + ')');
async function run(helper, breakFocus = false) {
  let queue = [];
  const state = { active: 'BODY', geometry: null, window: { __makerProbe: {} }, requestAnimationFrame: fn => queue.push(fn) };
  const context = vm.createContext(state);
  state.requestAnimationFrame(() => { state.geometry = { width: 390, height: 844 }; if (!breakFocus) state.active = 'start'; });
  const page = {
    async evaluate(fn) { return vm.runInContext('(' + fn.toString() + ')()', context); },
    async waitForFunction(fn, argument, options) {
      assert.equal(options.timeout, 5000, 'The barrier must remain bounded');
      for (let frame = 0; frame < 2; frame++) { const callbacks = queue; queue = []; callbacks.forEach(fn => fn()); }
      assert.equal(vm.runInContext('(' + fn.toString() + ')()', context), true);
    },
  };
  await helper(page);
  return state.window.__makerProbe.readyAfterFrames === true && state.geometry !== null && state.active === 'start';
}
(async () => {
  assert.equal(await run(real), true, 'Run 1: real helper waits for pending rendering callbacks');
  const planted = vm.runInNewContext('(async function settleProbeFrames(page) {})');
  assert.equal(await run(planted), false, 'Run 2: skipped suppressed barrier must be red');
  assert.equal(await run(real), true, 'Run 3: restored helper returns green');
  assert.equal(await run(real, true), false, 'A persistent focus failure remains red after readiness');
  console.log('PASS: real rendering barrier, planted missing barrier rejected, restored barrier, persistent focus failure rejected');
})().catch(error => { console.error(error); process.exitCode = 1; });
