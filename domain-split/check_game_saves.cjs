'use strict';
const assert=require('node:assert/strict');
const api=require('./game-saves.js');
const rules=require('./game-storage-allowlist.json');
class Storage {
  constructor(values={}){this.values=new Map(Object.entries(values));this.fail=null;}
  get length(){return this.values.size;}
  key(i){return [...this.values.keys()][i];}
  getItem(k){return this.values.has(k)?this.values.get(k):null;}
  setItem(k,v){if(this.fail===k)throw Error('quota');this.values.set(k,String(v));}
  removeItem(k){this.values.delete(k);}
}
const old=new Storage({'cyberpulse_blackout_v1':'save','mbm_hud_names':'PRIVATE CLASS LIST','sb-token':'PRIVATE TOKEN','vir_pupil_name':'PRIVATE PUPIL','voxelfrontier.world.v2.-2147483648':'world','mbm_v6_profile':JSON.stringify({version:6,teacherRecords:'PRIVATE',games:{'cyberpulse-blackout':{score:42},unknown:{name:'PRIVATE'}}})});
const data=api.capture(old,rules);
assert.deepEqual(Object.keys(data.localStorage).sort(),['cyberpulse_blackout_v1','voxelfrontier.world.v2.-2147483648']);
assert.equal(JSON.stringify(data).includes('PRIVATE'),false);
assert.deepEqual(data.sharedProfiles.mbm_v6_profile,{'cyberpulse-blackout':{score:42}});
api.validate(data,rules);
for(const key of ['mbm_hud_names','sb-token','vir_pupil_name','__proto__','voxelfrontier.world.v2.2147483648','voxelfrontier.world.v2.1x','voxelfrontier.world.v2.1.0'])assert.equal(api.allowedKey(key,rules),false,key);
assert.equal(api.allowedKey('voxelfrontier.world.v2.2147483647',rules),true);
const dest=new Storage({'cyberpulse_blackout_v1':'keep','mbm_v6_profile':JSON.stringify({version:6,unrelated:'keep',games:{'cyberpulse-blackout':{score:7},other:{score:99}}})});
const skip=api.planImport(dest,data,rules,false);api.apply(dest,skip.writes);
assert.equal(dest.getItem('cyberpulse_blackout_v1'),'keep');
assert.equal(JSON.parse(dest.getItem('mbm_v6_profile')).games['cyberpulse-blackout'].score,7);
assert.equal(dest.getItem('voxelfrontier.world.v2.-2147483648'),'world');
const replace=api.planImport(dest,data,rules,true);api.apply(dest,replace.writes);
assert.equal(dest.getItem('cyberpulse_blackout_v1'),'save');
assert.equal(JSON.parse(dest.getItem('mbm_v6_profile')).games.other.score,99);
api.restore(dest,replace.writes);assert.equal(dest.getItem('cyberpulse_blackout_v1'),'keep');
const failing=new Storage({'cyberpulse_blackout_v1':'original'});failing.fail='voxelfrontier.world.v2.-2147483648';
assert.throws(()=>api.apply(failing,api.planImport(failing,data,rules,true).writes));
assert.deepEqual(Object.fromEntries(failing.values),{'cyberpulse_blackout_v1':'original'});
const bad=structuredClone(data);bad.localStorage['mbm_hud_names']='injected';assert.throws(()=>api.validate(bad,rules));
bad.localStorage={};bad.sharedProfiles.mbm_v6_profile={unknown:{}};assert.throws(()=>api.validate(bad,rules));
assert.equal(old.getItem('cyberpulse_blackout_v1'),'save');assert.equal(old.getItem('mbm_hud_names'),'PRIVATE CLASS LIST');
console.log('PASS: game-only export, dynamic-key bounds, profile scoping, conflict preservation, replacement, rollback and rejected injection');
