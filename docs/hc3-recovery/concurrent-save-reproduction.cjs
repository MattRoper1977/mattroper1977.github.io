/* Unit model of interleaved storage calls, not a browser/production measurement. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('const SAVE_VERSION = 3;'));
const context={TextEncoder,TextDecoder,URL,URLSearchParams,atob,btoa};vm.createContext(context);vm.runInContext(script,context);
const {CampaignImport,STARTERS}=vm.runInContext('({CampaignImport,STARTERS})',context);
const seed={v:3,owned:[...STARTERS],dups:{},team:[...STARTERS],cleared:[],xp:123,stickers:{},settings:{calm:false,motion:'auto',hc:false,cb:false},seen:{},stats:{wins:0,clashWins:0}};
const url='https://www.madebymatt-play.uk/Lessons/Games/Glitch_Clash.html#mbm_import='+Buffer.from(JSON.stringify(seed)).toString('base64url');
const other=JSON.stringify({...seed,xp:999});let value=null,reads=0;
const storage={getItem(){const seen=value;if(++reads===2)value=other;return seen;},setItem(k,v){value=v;},removeItem(){value=null;}};
CampaignImport.receive(url,storage);
console.log(JSON.stringify({scope:'Deterministic unit interleaving model; not live browser proof',expectedXP:999,actualXP:JSON.parse(value).xp,preserved:value===other},null,2));
if(value!==other)process.exitCode=1;
