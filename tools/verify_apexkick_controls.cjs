const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const sourceFile = path.resolve(process.argv[2] || path.join(__dirname, '..', 'apexkick', 'index.html'));
const html = fs.readFileSync(sourceFile, 'utf8');
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}
function fn(name) {
  const start = html.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  const end = html.indexOf('\n}', start + 1) + 2;
  return html.slice(start, end);
}
function element(tag, parent) {
  return {nodeType: 1, parentElement: parent, closest(selector) {
    let el = this;
    while (el) {
      if (selector.split(',').includes(el.tag)) return el;
      el = el.parentElement;
    }
    return null;
  }, tag};
}
function inputHarness() {
  const listeners = {}, captured = new Set();
  let time = 1000, commits = 0, cancels = 0, releases = 0;
  const host = {
    addEventListener(name, callback) { listeners[name] = callback; },
    setPointerCapture(id) { captured.add(id); },
    hasPointerCapture(id) { return captured.has(id); },
    releasePointerCapture(id) { captured.delete(id); releases++; }
  };
  const ctx = vm.createContext({AK: {clamp: (v, a, b) => Math.max(a, Math.min(v, b))},
    window: {innerWidth: 1200, innerHeight: 900, performance: {}}, performance: {now: () => time}, Date});
  vm.runInContext(html.slice(html.indexOf('AK.Input = (function'), html.indexOf('/* AK:INPUT:END */')), ctx);
  const input = ctx.AK.Input;
  input.attach(host); input.enable(true); input.set(() => {}, () => commits++, () => cancels++);
  function emit(name, opts = {}) {
    time += 60;
    const ev = Object.assign({pointerId: 7, pointerType: 'mouse', button: 0,
      clientX: 600, clientY: 800, target: element('canvas'), prevented: false,
      preventDefault() { this.prevented = true; }}, opts);
    if (listeners[name]) listeners[name](ev);
    // Browsers release capture implicitly after up/cancel. The baseline must
    // receive that behaviour too; otherwise this harness invents a failure.
    if ((name === 'pointerup' || name === 'pointercancel') && captured.delete(ev.pointerId) && listeners.lostpointercapture) {
      listeners.lostpointercapture(ev);
    }
    return ev;
  }
  return {input, emit, captured, get commits() {return commits}, get cancels() {return cancels}, get releases() {return releases}};
}

test('every inline script parses', () => {
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/application\/ld\+json/.test(match[1])) continue;
    new vm.Script(match[2]); count++;
  }
  assert(count > 0);
});
for (const pointerType of ['mouse', 'touch', 'pen']) for (const tag of ['button', 'span', 'svg', 'path']) {
  test(pointerType + ' on ' + tag + ' inside Pause stays native', () => {
    const h = inputHarness(), button = element('button');
    const ev = h.emit('pointerdown', {pointerType, target: tag === 'button' ? button : element(tag, button)});
    assert.equal(h.input.state.active, false); assert.equal(ev.prevented, false); assert.equal(h.captured.size, 0);
  });
}
test('canvas drag still captures and commits exactly once', () => {
  const h = inputHarness(); h.emit('pointerdown'); assert(h.captured.has(7));
  h.emit('pointermove', {clientY: 650}); h.emit('pointerup', {clientY: 500});
  h.emit('lostpointercapture'); assert.equal(h.commits, 1); assert.equal(h.cancels, 0);
  assert.equal(h.input.state.active, false); assert.equal(h.captured.size, 0);
});
test('secondary pointer cannot end current drag', () => {
  const h = inputHarness(); h.emit('pointerdown');
  h.emit('pointerup', {pointerId: 8, clientY: 500}); assert(h.input.state.active);
  h.emit('pointercancel'); assert.equal(h.commits, 0); assert.equal(h.cancels, 1);
});
test('pointer cancellation clears capture and never shoots', () => {
  const h = inputHarness(); h.emit('pointerdown'); h.emit('pointermove', {clientY: 500}); h.emit('pointercancel');
  assert.equal(h.input.state.active, false); assert.equal(h.captured.size, 0); assert.equal(h.commits, 0); assert.equal(h.cancels, 1);
});
test('unexpected lost capture cancels aim so next pointer works', () => {
  const h = inputHarness(); h.emit('pointerdown'); h.captured.delete(7); h.emit('lostpointercapture');
  assert.equal(h.input.state.active, false); assert.equal(h.cancels, 1);
  h.emit('pointerdown', {pointerId: 8}); assert.equal(h.input.state.id, 8);
});
test('pausing during drag releases capture without committing', () => {
  const h = inputHarness(); h.emit('pointerdown'); h.emit('pointermove', {clientY: 500}); h.input.enable(false);
  assert.equal(h.captured.size, 0); assert.equal(h.input.state.active, false); assert.equal(h.commits, 0); assert.equal(h.cancels, 1);
});
function pauseHarness() {
  let time = 11000;
  const els = {}, state = {state: 'aim', paused: false, pauseStartedAt: null, startedAt: 1000};
  const el = id => els[id] ||= {textContent: '', classList: {contains: () => true, toggle() {}}, focus() {}};
  const ctx = vm.createContext({G: state, $: el, performance: {now: () => time},
    AK: {Input: {enable() {}}, Audio: {isMuted: () => false}, FX: {isCalm: () => false}}});
  vm.runInContext(fn('togglePause') + '\n' + fn('updateBroadcast') + '\n' + fn('keyboardControl'), ctx);
  return {ctx, state, el, now(v) {time = v}};
}
test('pause clock holds, repeated force-pause does not restart anchor, resume excludes pause', () => {
  const h = pauseHarness(); h.ctx.togglePause(true); h.now(16000); h.ctx.updateBroadcast();
  assert.equal(h.el('broadcastClock').textContent, '00:10');
  h.ctx.togglePause(true); h.now(21000); h.ctx.updateBroadcast(); assert.equal(h.el('broadcastClock').textContent, '00:10');
  h.ctx.togglePause(false); h.now(24000); h.ctx.updateBroadcast(); assert.equal(h.el('broadcastClock').textContent, '00:13');
});
for (const key of ['Escape', 'p']) test(key + ' closes pause from focused Resume button', () => {
  const h = pauseHarness(); h.ctx.togglePause(true); h.ctx.keyboardControl({key, target: element('button'), preventDefault() {}});
  assert.equal(h.state.paused, false);
});
test('held pause key cannot oscillate pause state', () => {
  const h = pauseHarness(); h.ctx.togglePause(true);
  h.ctx.keyboardControl({key: 'p', repeat: true, target: element('canvas'), preventDefault() {}}); assert.equal(h.state.paused, true);
});
test('pause shortcuts leave form fields and native Enter alone', () => {
  const h = pauseHarness();
  h.ctx.keyboardControl({key: 'p', target: element('input'), preventDefault() {throw Error('intercepted input')}});
  h.ctx.keyboardControl({key: 'Enter', target: element('button'), preventDefault() {throw Error('intercepted button')}});
  assert.equal(h.state.paused, false);
});
test('aim buffer follows a height-only resize', () => {
  const cv = {width: 1200, height: 700, clientWidth: 1200, clientHeight: 900};
  const ctx = vm.createContext({aimCv: cv, aimCx: {setTransform() {}, clearRect() {}}, window: {devicePixelRatio: 1}, G: {moment: null}});
  vm.runInContext(fn('drawAim'), ctx); ctx.drawAim(null); assert.equal(cv.height, 900);
});
test('fallback observes changes from the original motion preference authority', () => {
  const start = html.indexOf('var fallbackMotion=AK.FX;');
  assert(start >= 0, 'fallback motion bridge missing');
  const end = html.indexOf('    }catch(canvasError)', start);
  let preference = false, canvasCalm = false;
  const original = {isCalm: () => preference, setCalm: v => {preference = !!v}};
  const ctx = vm.createContext({AK: {FX: original}, Sc: {setCalm: v => {canvasCalm = v}, updateWeather() {}},
    document: {body: {classList: {toggle() {}}}}});
  vm.runInContext(html.slice(start, end), ctx);
  // Model a media-query event updating the already-registered authority,
  // without invoking the replacement fallback's own settings method.
  preference = true; ctx.AK.FX.update(.016);
  assert.equal(ctx.AK.FX.isCalm(), true); assert.equal(canvasCalm, true);
  ctx.AK.FX.setCalm(false); assert.equal(preference, false); assert.equal(canvasCalm, false);
});
console.log(JSON.stringify({source: sourceFile, passed, failed}));
process.exitCode = failed ? 1 : 0;
