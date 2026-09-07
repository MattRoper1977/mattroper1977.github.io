/* Exercise the actual sender planner; no game evaluation and no real storage. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./stub-handoff.js'),'utf8');
const route='https://madebymatt.uk/Lessons/Games/Glitch_Clash.html?view=calm#keep=one';
const key='glitchclash_save';
const seed={v:3,xp:123,extra:'Unicode café ⚽'};
const raw=JSON.stringify(seed),storage=new Map([[key,raw],['account-token','synthetic-never-read'],['other_game','untouched']]);
let reads=[];
const store={getItem(k){reads.push(k);return storage.get(k)??null;}};
function load(text){const context={module:{exports:{}},URL,URLSearchParams,TextEncoder,btoa,Set,Object};vm.runInNewContext(text,context);return context.module.exports;}
function good(api){reads=[];const result=api.plan(route,store);assert.equal(result.kind,'fragment');assert.equal(new URL(result.href).origin,'https://www.madebymatt-play.uk');assert.equal(new URL(result.href).search,'?view=calm');const params=new URLSearchParams(new URL(result.href).hash.slice(1));assert.equal(params.get('keep'),'one');assert.equal(Buffer.from(params.get('mbm_import'),'base64url').toString('utf8'),raw);assert.deepEqual(reads,[key]);}
const api=load(source);good(api);
const planted=source.replace("key: 'glitchclash_save'","key: 'other_game'");assert.notEqual(planted,source);assert.throws(()=>good(load(planted)));good(api);
console.log('Actual sender planner: real PASS / one wrong-key defect FAIL / restored PASS');
assert.equal(api.plan('https://madebymatt.uk/unknown/',store),null);assert.equal(api.plan('https://evil.invalid/Lessons/Games/Glitch_Clash.html',store),null);
assert.equal(api.plan('https://madebymatt-play.uk/Lessons/Games/Glitch_Clash.html',store),null);
assert.equal(api.plan(route,{getItem(){return null;}}),null);
assert.throws(()=>api.plan(route,{getItem(){throw Error('denied');}}));
for(const invalid of ['null','[]','{}','{"v":4}','{'])assert.throws(()=>api.plan(route,{getItem(){return invalid;}}));
const large=JSON.stringify({...seed,extra:'x'.repeat(40000)});assert.equal(api.plan(route,{getItem(){return large;}}).raw,large);assert.equal(api.plan(route,{getItem(){return large;}}).kind,'file');
const encodedLarge=JSON.stringify({...seed,extra:'x'.repeat(25000)});assert.equal(api.plan(route,{getItem(){return encodedLarge;}}).kind,'file');
assert.equal(storage.get(key),raw);assert.equal(storage.get('account-token'),'synthetic-never-read');assert.equal(storage.get('other_game'),'untouched');
assert(Buffer.byteLength(source)<=8192,'Shared sender exceeds8KB');
console.log('Exact route/origin, UTF-8, fragment/file bounds, source preservation and no unrelated-key reads PASS');
