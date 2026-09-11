'use strict';
// Node controls exercise the browser library in fresh isolated contexts.
// Browser UI, real track and clipboard measurements belong to the pilot harness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pako = require('../../assets/arcade/vendor/pako-1.0.11.min.js');
const root = path.resolve(__dirname, '../..');
const cartridgeSource = fs.readFileSync(path.join(root, 'assets/arcade/cartridge.js'), 'utf8');
const ghostSource = fs.readFileSync(path.join(root, 'assets/arcade/ghost.js'), 'utf8');
const rows = [];
const plain = value => JSON.parse(JSON.stringify(value));
let nativeRawSupported = false;
try { new CompressionStream('deflate-raw'); nativeRawSupported = true; } catch (_) {}
function runtime(mode = 'native') {
  const calls = {native: 0, fallback: 0, inflate: 0, sideEffects: 0};
  const sandbox = {
    TextEncoder, TextDecoder, Blob, Response, btoa, atob,
    CompressionStream: mode === 'disabled' ? undefined : class {
      constructor(format) { calls.native++; return new CompressionStream(format); }
    },
    pako: {
      deflateRaw(bytes) { calls.fallback++; return pako.deflateRaw(bytes); },
      Inflate: class extends pako.Inflate { constructor(options) { super(options); calls.inflate++; } }
    }
  };
  for (const name of ['localStorage', 'sessionStorage', 'indexedDB', 'document', 'requestAnimationFrame']) {
    Object.defineProperty(sandbox, name, {get() { calls.sideEffects++; throw Error('Forbidden boot or storage access: ' + name); }});
  }
  const context = vm.createContext(sandbox);
  vm.runInContext(cartridgeSource, context, {filename: 'cartridge.js'});
  vm.runInContext(ghostSource, context, {filename: 'ghost.js'});
  return {codec: context.MBMCartridge, ghost: context.MBMGhost, sandbox, calls};
}
function red(name, action) {
  assert.throws(action, undefined, name + ': deliberate mutation did not fire');
  rows.push({name, signal: 'RED'}); console.log('RED ' + name);
}
async function redAsync(name, action) {
  await assert.rejects(action, undefined, name + ': deliberate mutation did not fire');
  rows.push({name, signal: 'RED'}); console.log('RED ' + name);
}
function green(name, action) {
  action(); rows.push({name, signal: 'GREEN'}); console.log('GREEN ' + name);
}
function corrupt(code) {
  // Change an ordinary presentation character, preserving grouping and syntax.
  let i = code.length - 1;
  while (i >= 0 && (code[i] === '-' || code[i] === '0')) i--;
  return code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
}
function frame(codec, compressed, kind = 1) {
  const bytes = new Uint8Array(compressed.length + 6);
  bytes[0] = 1; bytes[1] = kind;
  new DataView(bytes.buffer).setUint32(2, codec.checksum(compressed));
  bytes.set(compressed, 6);
  return codec.base64(bytes);
}
const present = encoded => encoded.replace(/[A-Z0_-]/g, c => c === '0' ? '00' : c === '-' ? '01' : c === '_' ? '02' : '0' + c.toLowerCase()).toUpperCase().match(/.{1,5}/g).join('-');
function wrongPayload(codec, bytes, kind = 1) { return frame(codec, pako.deflateRaw(bytes), kind); }

(async () => {
  const value = {version: 1, label: 'Élodie, 日本語, 🏁', lap: 3, progress: [1, 0.25, true, null], settings: {calm: false}};
  const native = runtime(), fallback = runtime('disabled');
  green('no boot or storage access', () => assert.deepEqual([native.calls.sideEffects, fallback.calls.sideEffects], [0, 0]));
  red('no boot or storage access firing control', () => { void native.sandbox.localStorage; });
  const nativeCode = await native.codec.encode(value);
  green(nativeRawSupported ? 'native deflate-raw and UTF-8 round trip' : 'unsupported native raw format falls back; UTF-8 round trip', () => {
    assert.equal(native.calls.native, 1); assert.equal(native.calls.fallback, nativeRawSupported ? 0 : 1);
    assert.deepEqual(plain(native.codec.decode(nativeCode)), value);
  });
  red('native compression measurement control', () => assert.equal(native.calls.native, 0));
  const fallbackCode = await fallback.codec.encode(value);
  green('CompressionStream disabled; pako fallback and UTF-8 round trip', () => {
    assert.equal(fallback.calls.native, 0); assert.equal(fallback.calls.fallback, 1);
    assert.deepEqual(plain(fallback.codec.decode(fallbackCode)), value);
    assert.deepEqual(plain(native.codec.decode(fallbackCode)), value);
    assert.deepEqual(plain(fallback.codec.decode(nativeCode)), value);
  });
  const originalDeflate = fallback.sandbox.pako.deflateRaw;
  fallback.sandbox.pako.deflateRaw = () => { throw Error('Planted unavailable fallback'); };
  await redAsync('API-disabled fallback removal', () => fallback.codec.encode(value));
  fallback.sandbox.pako.deflateRaw = originalDeflate;
  green('API-disabled fallback restored', () => assert.deepEqual(plain(fallback.codec.decode(fallbackCode)), value));

  const forms = {
    hyphens: s => s,
    'en dashes': s => s.replace(/-/g, '\u2013'),
    'spaces around groups': s => ' \u00a0' + s.replace(/-/g, ' \t-\u00a0\n') + '\u202f ',
    'lower case': s => s.toLowerCase()
  };
  for (const [name, transform] of Object.entries(forms)) {
    red('paste ' + name + ': wrong character', () => fallback.codec.decode(transform(corrupt(fallbackCode))));
    green('paste ' + name + ': restored identically', () => assert.deepEqual(plain(fallback.codec.decode(transform(fallbackCode))), value));
  }
  const dashCharacters = Array.from({length: 0x110000}, (_, n) => n).filter(n => /\p{Dash}/u.test(String.fromCodePoint(n))).map(n => String.fromCodePoint(n));
  dashCharacters.push('\u00ad', '\u2043');
  for (const dash of dashCharacters) assert.deepEqual(plain(fallback.codec.decode(fallbackCode.replace(/-/g, dash))), value);
  green('all Unicode Dash characters accepted', () => assert.ok(dashCharacters.length > 20));
  red('dash normalization rejects a genuine punctuation substitution', () => fallback.codec.decode(fallbackCode.replace('-', '?')));

  const game = {state: {lap: 5, points: 710, settings: {calm: true}}};
  const box = {value: corrupt(fallbackCode)}, before = JSON.stringify(game.state), originalText = box.value;
  let refused = false;
  try { const decoded = fallback.codec.decode(box.value); game.state = decoded; } catch (_) { refused = true; }
  green('wrong-character control refuses before state assignment; text retained', () => {
    assert.equal(refused, true); assert.equal(JSON.stringify(game.state), before); assert.equal(box.value, originalText);
  });
  red('state-preservation assertion fires on planted lost state', () => assert.equal(JSON.stringify({...game.state, points: 0}), before));

  const raw = native.codec.unbase64(await native.codec.envelope(new TextEncoder().encode('{}'), 1));
  const wrongVersion = raw.slice(); wrongVersion[0] = 2;
  red('version byte changed', () => native.codec.open(native.codec.base64(wrongVersion), 1));
  const wrongKind = raw.slice(); wrongKind[1] = 2;
  red('payload kind changed', () => native.codec.open(native.codec.base64(wrongKind), 1));
  const wrongCRC = raw.slice(); wrongCRC[2] ^= 1;
  red('checksum byte changed', () => native.codec.open(native.codec.base64(wrongCRC), 1));
  const wrongByte = raw.slice(); wrongByte[6] ^= 1;
  red('compressed byte changed', () => native.codec.open(native.codec.base64(wrongByte), 1));
  green('envelope restored', () => assert.equal(new TextDecoder().decode(native.codec.open(native.codec.base64(raw), 1)), '{}'));
  const canonical = native.codec.base64(new Uint8Array([0]));
  red('nonzero base64 padding bits', () => native.codec.unbase64('AB'));
  green('canonical base64 restored', () => assert.equal(native.codec.unbase64(canonical)[0], 0));
  const compressed = pako.deflateRaw(new TextEncoder().encode('{}')), trailing = new Uint8Array(compressed.length + 1); trailing.set(compressed);
  red('trailing deflate byte with recomputed checksum', () => native.codec.open(frame(native.codec, trailing), 1));
  green('trailing deflate byte removed', () => assert.equal(new TextDecoder().decode(native.codec.open(frame(native.codec, compressed), 1)), '{}'));
  const tooLarge = new Uint8Array(2 * 1024 * 1024 + 1);
  red('inflate exceeds 2 MiB with valid checksum', () => native.codec.open(frame(native.codec, pako.deflateRaw(tooLarge)), 1));
  green('inflate at 2 MiB boundary', () => assert.equal(native.codec.open(frame(native.codec, pako.deflateRaw(tooLarge.subarray(1))), 1).length, 2 * 1024 * 1024));
  await redAsync('encode exceeds 2 MiB', () => native.codec.envelope(tooLarge, 1));
  red('malformed UTF-8 with valid checksum', () => native.codec.decode(present(wrongPayload(native.codec, new Uint8Array([0xff])))));
  red('malformed JSON with valid checksum', () => native.codec.decode(present(wrongPayload(native.codec, new TextEncoder().encode('{')))));
  green('UTF-8 and JSON restored', () => assert.deepEqual(plain(native.codec.decode(nativeCode)), value));

  // Fixture bounds are exclusively for codec controls. The pilot supplies its
  // actual map-derived bounds; no fixture values are imported by the game.
  const bounds = {minx: -100, maxx: 100, miny: -5, maxy: 25, minz: -200, maxz: 300};
  const samples = Array.from({length: 150}, (_, i) => ({x: -50 + i / 3, y: 10 + Math.sin(i / 10), z: i, angle: i / 20 - 3}));
  const ghostCode = await fallback.ghost.encode(samples, bounds);
  const decoded = plain(native.ghost.decode(ghostCode, bounds));
  const errors = {x: 0, y: 0, z: 0, angle: 0};
  for (let i = 0; i < samples.length; i++) {
    for (const axis of ['x', 'y', 'z']) errors[axis] = Math.max(errors[axis], Math.abs(decoded[i][axis] - samples[i][axis]));
    const d = decoded[i].angle - samples[i].angle;
    errors.angle = Math.max(errors.angle, Math.abs(Math.atan2(Math.sin(d), Math.cos(d))));
  }
  function assertTolerance() {
    for (const axis of ['x', 'y', 'z']) assert.ok(errors[axis] <= (bounds['max' + axis] - bounds['min' + axis]) / (2 * 65535) + 1e-12);
    assert.ok(errors.angle <= Math.PI / 256 + 1e-12);
  }
  green('ghost geometry round trip within quantization tolerance', assertTolerance);
  const actualX = errors.x; errors.x = 10;
  red('ghost tolerance assertion: planted displaced path', assertTolerance);
  errors.x = actualX; green('ghost tolerance restored', assertTolerance);
  red('wrong map bounds refused', () => native.ghost.decode(ghostCode, {...bounds, maxx: bounds.maxx + 1}));
  green('original map bounds restored', () => assert.equal(native.ghost.decode(ghostCode, bounds).length, 150));
  await redAsync('ghost free-text field refused', () => native.ghost.encode([{...samples[0], name: 'Pupil'}], bounds));
  await redAsync('ghost message field refused', () => native.ghost.encode([{...samples[0], message: 'Hello'}], bounds));
  await redAsync('ghost nonnumeric position refused', () => native.ghost.encode([{...samples[0], x: '10'}], bounds));
  await redAsync('ghost outside map refused', () => native.ghost.encode([{...samples[0], x: bounds.maxx + 1}], bounds));
  const packed = native.codec.open(ghostCode, 2), wrongCount = packed.slice();
  new DataView(wrongCount.buffer).setUint16(0, 149);
  red('ghost count-length mismatch', () => native.ghost.decode(wrongPayload(native.codec, wrongCount, 2), bounds));
  const ghostBytes = native.codec.unbase64(ghostCode); ghostBytes[ghostBytes.length - 1] ^= 1;
  red('ghost hash corrupted by one byte', () => native.ghost.decode(native.codec.base64(ghostBytes), bounds));
  green('ghost restored after corruption', () => assert.equal(native.ghost.decode(ghostCode, bounds).length, 150));
  const playable = {running: true, ghost: null};
  try { playable.ghost = native.ghost.decode(native.codec.base64(ghostBytes), bounds); } catch (_) {}
  green('corrupt ghost leaves simulated race runnable without ghost', () => assert.deepEqual(playable, {running: true, ghost: null}));
  red('runnable-state assertion fires on planted race stop', () => assert.deepEqual({...playable, running: false}, {running: true, ghost: null}));
  await redAsync('ghost exceeds 900 samples', () => native.ghost.encode(Array.from({length: 901}, () => samples[0]), bounds));
  const maximumGhost = await native.ghost.encode(Array.from({length: 900}, () => samples[0]), bounds);
  green('ghost at 900 sample boundary', () => assert.equal(native.ghost.decode(maximumGhost, bounds).length, 900));
  assert.equal(fallback.calls.sideEffects, 0);
  console.log('AS1_CODEC_RESULT ' + JSON.stringify({status: 'PASS', runtime: process.version, nativeDeflateRaw: nativeRawSupported, apiDisabledFallback: true, reds: rows.filter(x => x.signal === 'RED').length, greens: rows.filter(x => x.signal === 'GREEN').length, fixtureCodeCharacters: fallbackCode.length, fixtureGhostCharacters: ghostCode.length, dashCharacters: dashCharacters.length, quantizationErrors: errors, rows, limits: {uncompressedBytes: 2 * 1024 * 1024, ghostSamples: 900}, limitsAreTransportSafetyCapsNotDisplayThresholds: true, realPilotUIStateProof: 'Not exercised by this codec-only control', realTrackLengths: 'Not measured by fixture controls'}));
})().catch(error => { console.error(error); process.exitCode = 1; });
