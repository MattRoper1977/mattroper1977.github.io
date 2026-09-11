/* Registry verification only; never accesses a browser or pupil storage. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
function verify(registry){
  assert.equal(registry.schema,1,'Unsupported registry schema');
  assert(Array.isArray(registry.entries)&&registry.entries.length>0,'An empty registry is not evidence');
  const claimed=new Map(),errors=[];
  for(const entry of registry.entries){
    assert(['localStorage','sessionStorage'].includes(entry.storage),'Missing storage area');
    assert(typeof entry.key==='string'&&entry.key.length>0,'Missing key');
    assert(typeof entry.owner==='string'&&entry.owner.length>0,'Missing owner');
    assert(['per-game','per-surface','cross-surface'].includes(entry.scope),'Missing scope');
    assert(entry.survivesProfileWipe===null||typeof entry.survivesProfileWipe==='boolean','Missing wipe status');
    assert(Array.isArray(entry.reads)&&Array.isArray(entry.writes),'Separate read/write evidence required');
    assert(entry.reads.length+entry.writes.length>0,'An unevidenced claim is not valid');
    // Reading another component's key is a consumer use, not a writing ownership claim.
    if(!entry.writes.length)continue;
    const id=entry.storage+':'+entry.key,owners=claimed.get(id)||new Set();owners.add(entry.owner);claimed.set(id,owners);
  }
  assert(claimed.size>0,'A registry without writing ownership claims is not evidence');
  for(const [key,owners] of claimed)if(owners.size>1)errors.push({key,owners:[...owners].sort()});
  if(errors.length){const error=new Error('Independent owners claim '+errors.length+' storage keys');error.conflicts=errors;throw error;}
  return {claimedKeys:claimed.size};
}
function selfTest(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'as1-storage-gate-')),fixture=path.join(dir,'registry.json');
  const one={storage:'localStorage',key:'mbm_fixture_save',owner:'Site:fixture-a.html',scope:'per-surface',survivesProfileWipe:null,reads:[],writes:[{source:'fixture.js',line:1,operation:'setItem',expression:'"mbm_fixture_save"'}]};
  const doc={schema:1,entries:[one]};
  const run=()=>cp.spawnSync(process.execPath,[__filename,fixture],{encoding:'utf8'});
  try{
    fs.writeFileSync(fixture,JSON.stringify(doc));assert.equal(run().status,0);console.log('GREEN duplicate-owner control baseline');
    doc.entries.push({...one,owner:'Site:fixture-b.html'});fs.writeFileSync(fixture,JSON.stringify(doc));const bad=run();assert.equal(bad.status,1);assert.match(bad.stderr,/Independent owners claim 1 storage keys/);console.log('RED duplicate independent owner planted');
    doc.entries.pop();fs.writeFileSync(fixture,JSON.stringify(doc));assert.equal(run().status,0);console.log('GREEN duplicate independent owner removed');
    doc.entries=[];fs.writeFileSync(fixture,JSON.stringify(doc));assert.equal(run().status,1);console.log('RED absent registry rejected (non-vacuous control)');
    doc.entries=[one];fs.writeFileSync(fixture,JSON.stringify(doc));assert.equal(run().status,0);console.log('GREEN registry restored');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module){try{if(process.argv.includes('--self-test'))selfTest();else{const file=process.argv[2];assert(file,'Provide the registry path or --self-test');const result=verify(JSON.parse(fs.readFileSync(file,'utf8')));console.log('GREEN registry ownership '+JSON.stringify(result));}}catch(error){console.error('RED '+error.message);if(error.conflicts)for(const conflict of error.conflicts)console.error(conflict.key+' — '+conflict.owners.join(', '));process.exitCode=1;}}
module.exports={verify};
