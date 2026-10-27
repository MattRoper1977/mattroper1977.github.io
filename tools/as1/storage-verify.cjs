/* AS1-H: read-only ownership verification. Never opens browser storage. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),BASELINE_PATH='tools/as1/baselines/storage-2026-09-11.json',FROZEN_ON='2026-09-11';
// AS1-H authorised and pinned on 2026-09-11: the immutable, already measured registry blob.
// Its 51 conflicts are the ceiling; editing or backdating the baseline cannot enlarge it.
const APPROVED_REGISTRY_BLOB='7872d57fdaadd81e517183059c68672e2d4a8436';
function collectClaims(registry){
  assert.equal(registry.schema,1,'Unsupported registry schema');
  assert(Array.isArray(registry.entries)&&registry.entries.length>0,'An empty registry is not evidence');
  const claimed=new Map();
  for(const entry of registry.entries){
    assert(['localStorage','sessionStorage'].includes(entry.storage),'Missing storage area');
    assert(typeof entry.key==='string'&&entry.key.length>0,'Missing key');
    assert(typeof entry.owner==='string'&&entry.owner.length>0,'Missing owner');
    assert(['per-game','per-surface','cross-surface'].includes(entry.scope),'Missing scope');
    assert(entry.survivesProfileWipe===null||typeof entry.survivesProfileWipe==='boolean','Missing wipe status');
    assert(Array.isArray(entry.reads)&&Array.isArray(entry.writes),'Separate read/write evidence required');
    assert(entry.reads.length+entry.writes.length>0,'An unevidenced claim is not valid');
    if(!entry.writes.length)continue;
    const id=entry.storage+':'+entry.key,owners=claimed.get(id)||new Set();owners.add(entry.owner);claimed.set(id,owners);
  }
  assert(claimed.size>0,'A registry without writing ownership claims is not evidence');return claimed;
}
function makeBaseline(registry){
  return {schema:1,frozenOn:FROZEN_ON,sourceRegistryBlob:APPROVED_REGISTRY_BLOB,
    entries:[...collectClaims(registry)].filter(([,v])=>v.size>1).sort(([a],[b])=>a.localeCompare(b)).map(([id,owners])=>{
      const colon=id.indexOf(':');return {storage:id.slice(0,colon),key:id.slice(colon+1),owners:[...owners].sort(),observedOn:FROZEN_ON};
    })};
}
function baselineMap(doc){
  assert.equal(doc.schema,1,'Unsupported baseline schema');assert.equal(doc.frozenOn,FROZEN_ON,'The baseline freeze date is immutable');
  assert.equal(doc.sourceRegistryBlob,APPROVED_REGISTRY_BLOB,'The approved source is immutable');assert(Array.isArray(doc.entries),'Missing baseline entries');
  const map=new Map();
  for(const e of doc.entries){
    assert(['localStorage','sessionStorage'].includes(e.storage),'Missing baseline storage area');assert(typeof e.key==='string'&&e.key.length,'Missing baseline key');
    assert.equal(e.observedOn,FROZEN_ON,'Baseline entry added after the freeze date or given an unreviewed date');
    assert(Array.isArray(e.owners)&&e.owners.length>1,'A baseline entry needs at least two claiming owners');
    assert(e.owners.every(o=>typeof o==='string'&&o.length),'Missing baseline owner');assert.equal(new Set(e.owners).size,e.owners.length,'Duplicate baseline owner');
    const id=e.storage+':'+e.key;assert(!map.has(id),'Duplicate baseline entry: '+id);map.set(id,new Set(e.owners));
  }return map;
}
function verifyBaseline(baseline,approved,previous){
  const now=baselineMap(baseline),ceiling=baselineMap(approved),before=previous===null?null:baselineMap(previous);
  for(const [id,owners] of now){
    assert(ceiling.has(id),'Baseline may only shrink: unapproved entry '+id);
    for(const owner of owners)assert(ceiling.get(id).has(owner),'Baseline may only shrink: unapproved owner '+id+' / '+owner);
    if(before!==null){
      assert(before.has(id),'Baseline may only shrink: removed entry re-added '+id);
      for(const owner of owners)assert(before.get(id).has(owner),'Baseline may only shrink: removed owner re-added '+id+' / '+owner);
    }
  }return now;
}
function verify(registry,baseline,approved,previous){
  const allowed=verifyBaseline(baseline,approved,previous),claimed=collectClaims(registry),errors=[];let baselinedConflicts=0;
  for(const [id,owners] of claimed){
    if(owners.size<2)continue;
    if(!allowed.has(id)||[...owners].some(o=>!allowed.get(id).has(o)))errors.push({key:id,owners:[...owners].sort()});else baselinedConflicts++;
  }
  if(errors.length){const error=new Error('New independent-owner conflicts: '+errors.length);error.conflicts=errors;throw error;}
  return {claimedKeys:claimed.size,baselineEntries:allowed.size,baselinedConflicts,newConflicts:0};
}
function git(args){
  const r=cp.spawnSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});
  if(r.status!==0)throw new Error('Git evidence unavailable: '+(r.stderr||r.error||r.status));return r.stdout;
}
function approvedRegistry(){return JSON.parse(git(['cat-file','blob',APPROVED_REGISTRY_BLOB]));}
function previousBaseline(ref){
  // Compare the actual PR base: a removed exception cannot return in a later PR.
  const resolved=git(['rev-parse','--verify',ref+'^{commit}']).trim();
  if(!git(['ls-tree','--name-only',resolved,'--',BASELINE_PATH]).trim())return null;
  return JSON.parse(git(['show',resolved+':'+BASELINE_PATH]));
}
function baseRef(){
  if(process.env.AS1_STORAGE_BASE_REF)return process.env.AS1_STORAGE_BASE_REF;
  if(process.env.GITHUB_EVENT_PATH){const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
    if(event.pull_request?.base?.sha)return event.pull_request.base.sha;if(event.before&&!/^0+$/.test(event.before))return event.before;}
  return 'HEAD^';
}
function selfTest(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'as1-storage-h-')),fixture=path.join(dir,'registry.json'),baselineFile=path.join(dir,'baseline.json');
  const registry=approvedRegistry(),approved=makeBaseline(registry);let doc=structuredClone(registry),baseline=structuredClone(approved);
  const run=()=>{fs.writeFileSync(fixture,JSON.stringify(doc));fs.writeFileSync(baselineFile,JSON.stringify(baseline));
    return cp.spawnSync(process.execPath,[__filename,fixture,'--baseline',baselineFile,'--base-ref','HEAD'],{encoding:'utf8',maxBuffer:4*1024*1024});};
  function expect(status,label,pattern){const r=run();assert.equal(r.status,status,label+'\n'+r.stderr);if(pattern)assert.match(r.stderr,pattern);console.log((status?'RED ':'GREEN ')+label);}
  const one={storage:'localStorage',key:'mbm_as1_h_new_conflict',owner:'fixture:a',scope:'per-game',survivesProfileWipe:null,reads:[],writes:[{source:'fixture.js',line:1,operation:'setItem',expression:'fixture'}]};
  try{
    expect(0,'51 approved baseline conflicts accepted');
    doc.entries.push(one,{...one,owner:'fixture:b'});expect(1,'new conflict outside the baseline planted',/New independent-owner conflicts/);
    doc=structuredClone(registry);expect(0,'new conflict removed');
    const known=baseline.entries[0];doc.entries.push({...one,key:known.key,storage:known.storage,owner:'fixture:new-claimant'});
    expect(1,'new claimant on a baselined key planted',/New independent-owner conflicts/);doc=structuredClone(registry);expect(0,'new claimant removed');
    baseline.entries.push({storage:one.storage,key:one.key,owners:['fixture:a','fixture:b'],observedOn:'2026-09-12'});
    expect(1,'post-freeze baseline addition rejected',/freeze date/);baseline.entries.at(-1).observedOn=FROZEN_ON;
    expect(1,'backdating cannot admit a new baseline entry',/Baseline may only shrink/);baseline=structuredClone(approved);expect(0,'baseline restored');
    const prior=structuredClone(approved);prior.entries.shift();assert.throws(()=>verifyBaseline(baseline,approved,prior),/removed entry re-added/);
    console.log('RED previously removed baseline entry re-added');verifyBaseline(prior,approved,prior);console.log('GREEN baseline shrink retained');
    doc.entries=[];expect(1,'empty registry rejected',/empty registry/);doc=structuredClone(registry);expect(0,'registry restored');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module){try{
  if(process.argv.includes('--self-test'))selfTest();else{
    const args=process.argv.slice(2),file=args.shift();assert(file,'Provide the registry path or --self-test');let baselineFile=path.join(ROOT,BASELINE_PATH),ref=baseRef();
    while(args.length){const option=args.shift();if(option==='--baseline')baselineFile=args.shift();else if(option==='--base-ref')ref=args.shift();else throw Error('Unknown option '+option);}
    assert(ref&&baselineFile,'Missing baseline argument');const authority=makeBaseline(approvedRegistry()),previous=previousBaseline(ref);
    const result=verify(JSON.parse(fs.readFileSync(file,'utf8')),JSON.parse(fs.readFileSync(baselineFile,'utf8')),authority,previous);
    console.log('GREEN no new storage conflict '+JSON.stringify({...result,previousBaseline:previous===null?'first introduction':previous.entries.length,freeze:FROZEN_ON}));
  }
}catch(error){console.error('RED '+error.message);if(error.conflicts)for(const e of error.conflicts)console.error(e.key+' — '+e.owners.join(', '));process.exitCode=1;}}
module.exports={collectClaims,makeBaseline,verifyBaseline,verify};
