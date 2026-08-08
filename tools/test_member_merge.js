#!/usr/bin/env node
'use strict';
/* mbm-accounts-members-mailing-2026-08-08 — deterministic conflict tests. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','assets','mbm-account.js'),'utf8');
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const window={addEventListener(){},dispatchEvent(){},location:{origin:'https://madebymatt.uk'}};
const context={window,document:{},navigator:{onLine:true},location:window.location,localStorage,console,setTimeout,clearTimeout,Promise,URL,CustomEvent:function(){}};
context.fetch=async()=>({ok:true,json:async()=>({features:{accounts:{enabled:true,provider:'supabase',supabaseUrl:'',supabaseAnonKey:''},mailing:{enabled:false}}})});
vm.createContext(context);vm.runInContext(source,context,{filename:'mbm-account.js'});
const merge=window.MBMAccount._mergeMemberData;
function assert(c,m){if(!c)throw new Error(m);console.log('PASS',m)}
const A={schema:1,favourites:{'/games/':{href:'/games/',title:'Games',saved:true,updatedAt:'2026-08-08T08:00:00Z'}}};
const B={schema:1,favourites:{'/Lessons/':{href:'/Lessons/',title:'Lessons',saved:true,updatedAt:'2026-08-08T08:01:00Z'}}};
const union=merge(A,B);
assert(union.favourites['/games/'].saved===true&&union.favourites['/Lessons/'].saved===true,'independent favourites merge without loss');
const oldSaved={schema:1,favourites:{'/games/':{href:'/games/',title:'Games',saved:true,updatedAt:'2026-08-08T08:00:00Z'}}};
const newRemoved={schema:1,favourites:{'/games/':{href:'/games/',title:'Games',saved:false,updatedAt:'2026-08-08T08:05:00Z'}}};
assert(merge(oldSaved,newRemoved).favourites['/games/'].saved===false,'newer removal tombstone wins over older saved state');
assert(merge(newRemoved,oldSaved).favourites['/games/'].saved===false,'merge is timestamp-deterministic regardless of argument order');
const newSaved={schema:1,favourites:{'/games/':{href:'/games/',title:'Games updated',saved:true,updatedAt:'2026-08-08T08:06:00Z'}}};
assert(merge(newRemoved,newSaved).favourites['/games/'].title==='Games updated','newer saved record wins after an older removal');
console.log('member merge conflict tests passed');
