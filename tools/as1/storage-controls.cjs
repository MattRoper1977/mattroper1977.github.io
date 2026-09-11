/* Deliberate fixture mutations for the source census; no runtime source is changed. */
'use strict';
const assert=require('node:assert/strict'),{analyse}=require('./storage-analyse.cjs');
const run=text=>analyse([{source:'fixture.js',text}]);
const resolved=text=>run(text).observations.filter(x=>x.key!==null);
const baseline=`const KEY='mbm_fixture_save';localStorage.getItem(KEY);localStorage.setItem(KEY,'a value naming another_key');sessionStorage.setItem('mbm_fixture_tab','x');`;
function expectBaseline(text){const rows=resolved(text);assert.equal(rows.filter(x=>x.operation==='getItem').length,1);assert.equal(rows.filter(x=>x.operation==='setItem').length,2);assert.deepEqual(new Set(rows.map(x=>x.key)),new Set(['mbm_fixture_save','mbm_fixture_tab']));assert.equal(rows.find(x=>x.key==='mbm_fixture_tab').storage,'sessionStorage');assert.equal(new Set(rows.map(x=>x.key).filter(x=>x.startsWith('mbm_'))).size,2);}
expectBaseline(baseline);console.log('GREEN call-site census baseline');
assert.throws(()=>expectBaseline(baseline.replace('localStorage.getItem(KEY)','localStorage.setItem(KEY,"changed")')));console.log('RED read-to-write mutation changes the operation count');
expectBaseline(baseline);console.log('GREEN read call restored');
assert.throws(()=>expectBaseline(baseline.replace("'mbm_fixture_tab'","'thirdparty_tab'")));console.log('RED key/prefix mutation changes the resolved key set');
expectBaseline(baseline);console.log('GREEN key restored');
assert.equal(resolved(`const copy="localStorage.setItem('not_a_call','x')";localStorage.setItem('real','not_a_key')`)[0].key,'real');console.log('GREEN string copy and value excluded by use site');
assert.equal(resolved(`function f(localStorage){localStorage.setItem('fake','x')}` ).length,0);console.log('GREEN shadowed receiver excluded; unresolved retained');
const dynamic=run(`const suffix=unknown;localStorage.setItem('mbm_'+suffix,'x')`);assert.equal(dynamic.unresolved.length,1);assert.equal(resolved(`localStorage.setItem('mbm_fixed','x')`).length,1);console.log('RED dynamic-key mutation leaves no resolved claim; GREEN literal restored');
console.log('PASS AS1 storage call-site firing controls');
