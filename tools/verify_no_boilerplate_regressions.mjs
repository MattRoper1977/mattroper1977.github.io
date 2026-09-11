#!/usr/bin/env node
/** AS1 §1.4. Read-only syntax/use-site audit, not a textual grep.
 * No directory is ignored. HTML examples in comments, template elements,
 * non-JavaScript script blocks and JavaScript string literals are data.
 * Parse failures and unproven audio execution contexts are INCONCLUSIVE (exit 2).
 * Reference originals must be audited separately; there is no blanket docs waiver.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const option = (flag, fallback) => argv.includes(flag) ? argv[argv.indexOf(flag)+1] : fallback;
const asJSON = argv.includes('--json');
const gestureEvents = new Set(['click','dblclick','pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','keydown','keyup']);
let acorn;
try {
  const module = {exports:{}};
  const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
  if (!source) throw new Error('Node bundled Acorn is unavailable');
  vm.runInNewContext(source, {module,exports:module.exports});
  acorn = module.exports;
} catch (error) {
  console.error(`MEASUREMENT INVALID: JavaScript parser unavailable: ${error.message}`);
  process.exit(2);
}

const children = node => Object.entries(node).flatMap(([key,value]) =>
  ['loc','start','end'].includes(key) ? [] : Array.isArray(value) ? value.filter(x=>x?.type) : value?.type ? [value] : []);
const isFunction = n => ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n?.type);
const property = n => n?.computed ? n.property?.type==='Literal' ? String(n.property.value) : null : n?.property?.name;
const literal = n => n?.type==='Literal' ? n.value : null;
const staticPath = n => n?.type==='Identifier' ? n.name : n?.type==='MemberExpression' && property(n) ? `${staticPath(n.object)}.${property(n)}` : null;
const isGlobal = (n,name) => staticPath(n)===name || ['window','globalThis','self'].some(p=>staticPath(n)===`${p}.${name}`);

function attributes(tag) {
  const result=[];
  const re=/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const body=tag.replace(/^<\/?\s*[^\s>]+/,'').replace(/\/?\s*>$/,'');
  for (const m of body.matchAll(re)) result.push({name:m[1].toLowerCase(),value:m[2]??m[3]??m[4]??''});
  return result;
}
function entities(value) {
  return value.replace(/&(?:quot|apos|amp|lt|gt|#(\d+)|#x([\da-f]+));/gi,(s,dec,hex)=>
    dec ? String.fromCodePoint(+dec) : hex ? String.fromCodePoint(parseInt(hex,16)) : ({'&quot;':'"','&apos;':"'",'&amp;':'&','&lt;':'<','&gt;':'>'}[s.toLowerCase()]));
}

function htmlUnits(source,file,findings) {
  const units=[];
  // Tokenise tags, including quoted greater-than characters; script contents are raw text.
  const re=/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;
  let match, templateDepth=0;
  while ((match=re.exec(source))) {
    const tag=match[0];
    if (/^<!/.test(tag)) continue;
    const name=tag.match(/^<\/?\s*([^\s/>]+)/)[1].toLowerCase();
    const closing=/^<\//.test(tag);
    if (name==='template') {templateDepth+=closing ? -1 : 1; templateDepth=Math.max(0,templateDepth);continue;}
    const attrs=Object.fromEntries(attributes(tag).map(x=>[x.name,entities(x.value)]));
    const line=source.slice(0,match.index).split('\n').length;
    if (!closing && !templateDepth && name==='meta' && attrs.name?.toLowerCase()==='viewport') {
      const content=attrs.content??'';
      if (/(?:^|[,;\s])user-scalable\s*=\s*(?:no|0)(?=$|[,;\s])/i.test(content) || /(?:^|[,;\s])maximum-scale\s*=/i.test(content))
        findings.push({rule:'viewport',file,line,detail:'Viewport disables or caps user zoom'});
    }
    if (!closing && !templateDepth) {
      for (const [key,value] of Object.entries(attrs)) {
        if (/^on[a-z]+$/.test(key)) units.push({file,line,source:value,event:key.slice(2),handler:true,
          defaultNavigation: ['a','area'].includes(name)&&key==='onclick'&&!!attrs.href&&!/^javascript:/i.test(attrs.href) || name==='form'&&key==='onsubmit'});
        if (['href','action','formaction'].includes(key) && /^\s*javascript:/i.test(value))
          units.push({file,line,source:value.replace(/^\s*javascript:/i,''),event:'click',handler:true});
      }
    }
    if (!closing && name==='script') {
      const end=/<\/script\s*>/gi;end.lastIndex=re.lastIndex;
      const endMatch=end.exec(source);
      if (!endMatch) throw new Error(`Unclosed script element at line ${line}`);
      const type=(attrs.type??'').trim().toLowerCase();
      const executable=type==='' || type==='module' || /^(?:text|application)\/(?:java|ecma)script(?:\s*;|$)/.test(type);
      if (!templateDepth && executable && !attrs.src) units.push({file,line:source.slice(0,re.lastIndex).split('\n').length,source:source.slice(re.lastIndex,endMatch.index)});
      if (!templateDepth && executable && attrs.src) units.push({file,line,externalSource:attrs.src});
      re.lastIndex=end.lastIndex;
    }
  }
  return units;
}

function analyse(units,findings,uncertain) {
  const owners=[];
  const parent=new WeakMap(), scopes=new WeakMap(), ownership=new WeakMap();
  const assignments=[];
  const globalScope={parent:null,bindings:new Map()};
  const bind=(scope,name,value)=>{if(!name)return;const set=scope.bindings.get(name)??new Set();set.add(value);scope.bindings.set(name,set);};
  const resolve=(scope,name)=>{for(let s=scope;s;s=s.parent)if(s.bindings.has(name))return s.bindings.get(name);return new Set([`global:${name}`]);};
  const makeOwner=(node,scope,unit,name)=>{const x={node,scope,unit,name,edges:new Set(),eventEdges:[],calls:[],audio:[],dialogs:[],navigates:false,mask:0};owners.push(x);return x;};
  function declare(node,scope,owner,unit,p=null) {
    if (!node)return;
    parent.set(node,p);scopes.set(node,scope);ownership.set(node,owner);
    if(isFunction(node)) {
      const inner={parent:scope,bindings:new Map()};
      const fn=makeOwner(node,inner,unit,node.id?.name??'anonymous');
      node._as1Owner=fn;
      if(node.type==='FunctionDeclaration')bind(scope,node.id?.name,fn);
      if(node.id)bind(inner,node.id.name,fn);
      for(const param of node.params)if(param.type==='Identifier')bind(inner,param.name,`parameter:${param.name}`);
      for(const child of children(node))declare(child,inner,fn,unit,node);
      return;
    }
    if(node.type==='VariableDeclarator'&&node.id.type==='Identifier') {bind(scope,node.id.name,`unresolved:${node.id.name}`);assignments.push({left:node.id,right:node.init,scope});}
    if(node.type==='AssignmentExpression')assignments.push({left:node.left,right:node.right,scope});
    if(node.type==='ClassDeclaration'&&node.id)bind(scope,node.id.name,{classNode:node});
    for(const child of children(node))declare(child,scope,owner,unit,node);
  }
  for(const unit of units) {
    let ast;
    const parseOptions={ecmaVersion:'latest',locations:true,allowReturnOutsideFunction:!!unit.handler,allowAwaitOutsideFunction:true};
    try {try {ast=acorn.parse(unit.source,{...parseOptions,sourceType:'module'});}catch {ast=acorn.parse(unit.source,{...parseOptions,sourceType:'script'});}}
    catch(error) {uncertain.push({file:unit.file,line:unit.line+(error.loc?.line??1)-1,detail:`JavaScript parse failed: ${error.message}`});continue;}
    // Classic scripts share the browser global lexical environment. Modules are
    // still audited conservatively; local declarations are retained per unit.
    const scope={parent:globalScope,bindings:new Map()};
    const owner=makeOwner(ast,scope,unit,'top-level');owner.mask=unit.handler?(gestureEvents.has(unit.event)?2:1):1;owner.navigates=!!unit.defaultNavigation;
    declare(ast,scope,owner,unit);
  }
  function values(node,scope,seen=new Set()) {
    if(!node||seen.has(node))return new Set();seen.add(node);
    if(isFunction(node))return new Set([node._as1Owner]);
    if(node.type==='Identifier')return resolve(scope,node.name);
    if(node.type==='ThisExpression') {
      // An arrow inherits this; an ordinary nested function does not. Resolve
      // only actual class/object method syntax, never a method-name guess.
      for(let p=parent.get(node);p;p=parent.get(p))if(isFunction(p)&&p.type!=='ArrowFunctionExpression') {
        const method=parent.get(p),container=parent.get(method);
        if(method?.type==='MethodDefinition'&&container?.type==='ClassBody')return new Set([{classNode:parent.get(container)}]);
        if(method?.type==='Property'&&container?.type==='ObjectExpression')return new Set([{objectNode:container}]);
        break;
      }
      return new Set();
    }
    if(node.type==='LogicalExpression'||node.type==='ConditionalExpression')return new Set([...values(node.left??node.consequent,scope,seen),...values(node.right??node.alternate,scope,seen)]);
    if(node.type==='SequenceExpression')return values(node.expressions.at(-1),scope,seen);
    if(node.type==='MemberExpression') {
      const prop=property(node), p=staticPath(node);
      if(['window','globalThis','self'].includes(staticPath(node.object)))return resolve(globalScope,prop);
      const exact=resolve(scope,p);
      if([...exact].some(x=>typeof x!=='string'||!x.startsWith('global:')))return exact;
      const found=new Set();
      for(const obj of values(node.object,scope,seen)) {
        if(obj?.objectNode)for(const entry of obj.objectNode.properties)if((entry.key?.name??entry.key?.value)===prop)for(const x of values(entry.value,scope,seen))found.add(x);
        if(obj?.classNode)for(const entry of obj.classNode.body.body)if((entry.key?.name??entry.key?.value)===prop)for(const x of values(entry.value,scope,seen))found.add(x);
      }
      return found.size?found:exact;
    }
    if(node.type==='ObjectExpression')return new Set([{objectNode:node}]);
    if(node.type==='ClassExpression')return new Set([{classNode:node}]);
    if(node.type==='NewExpression')return values(node.callee,scope,seen);
    return new Set();
  }
  // Resolve named functions, aliases and callback variables before graph traversal.
  for(let pass=0;pass<8;pass++)for(const a of assignments) {
    const name=staticPath(a.left);
    if(name)for(const value of values(a.right,a.scope))bind(a.scope,name,value);
  }
  // Share top-level classic-script declarations for calls across script blocks.
  for(const owner of owners)if(owner.name==='top-level'&&!owner.unit.handler)for(const [key,set]of owner.scope.bindings)for(const v of set)bind(globalScope,key,v);
  for(let pass=0;pass<3;pass++)for(const a of assignments)if(staticPath(a.left))for(const v of values(a.right,a.scope))bind(a.scope,staticPath(a.left),v);
  const at=(node,owner)=>({file:owner.unit.file,line:owner.unit.line+node.loc.start.line-1});
  function functionTargets(node,scope) {
    const found=new Set();
    for(const v of values(node,scope)) {
      if(v?.edges)found.add(v);
      if(v?.classNode)for(const method of v.classNode.body.body)if(method.kind==='constructor')found.add(method.value._as1Owner);
    }
    return found;
  }
  function visit(node) {
    const owner=ownership.get(node),scope=scopes.get(node);
    if(!owner)return;
    if(node.type==='NewExpression') {
      if([...values(node.callee,scope)].some(v=>typeof v==='string'&&/^global:(?:webkit)?AudioContext$/.test(v)))owner.audio.push(node);
      for(const fn of functionTargets(node.callee,scope))owner.edges.add(fn);
      if(isGlobal(node.callee,'Function'))uncertain.push({...at(node,owner),detail:'Dynamically compiled JavaScript requires a separate runtime proof'});
    }
    if(node.type==='CallExpression') {
      const p=staticPath(node.callee);
      if([...values(node.callee,scope)].some(v=>v==='global:confirm'||v==='global:alert'))owner.dialogs.push(node);
      if(isGlobal(node.callee,'btoa')&&node.arguments[0]?.type==='CallExpression'&&staticPath(node.arguments[0].callee)==='JSON.stringify')
        findings.push({rule:'unicode-base64',...at(node,owner),detail:'JSON text passed directly to btoa instead of encoding UTF-8 bytes'});
      if(p&&/^(?:(?:window|globalThis|self)\.)?location\.(?:assign|replace)$/.test(p)||p&&/^(?:window\.)?history\.(?:back|go)$/.test(p))owner.navigates=true;
      for(const fn of functionTargets(node.callee,scope))owner.edges.add(fn);
      const member=property(node.callee);
      if(member==='addEventListener') {
        const event=literal(node.arguments[0]);
        for(const fn of functionTargets(node.arguments[1],scope))owner.eventEdges.push({fn,mask:gestureEvents.has(event)?2:1});
      } else {
        // Unknown callback APIs, timers and promises do not prove user activation.
        for(const arg of node.arguments)for(const fn of functionTargets(arg,scope))owner.eventEdges.push({fn,mask:1});
      }
      if(isGlobal(node.callee,'eval') || isGlobal(node.callee,'Function'))uncertain.push({...at(node,owner),detail:'Dynamically compiled JavaScript requires a separate runtime proof'});
      if((isGlobal(node.callee,'setTimeout')||isGlobal(node.callee,'setInterval'))&&node.arguments[0]?.type==='Literal'&&typeof node.arguments[0].value==='string')uncertain.push({...at(node,owner),detail:'String timer callback requires a separate runtime proof'});
    }
    if(node.type==='AssignmentExpression') {
      const p=staticPath(node.left);
      if(p&&/^(?:(?:window|globalThis|self)\.)?location(?:\.(?:href|pathname))?$/.test(p))owner.navigates=true;
      const prop=property(node.left);
      if(prop&&/^on[a-z]+$/.test(prop))for(const fn of functionTargets(node.right,scope))owner.eventEdges.push({fn,mask:gestureEvents.has(prop.slice(2))?2:1});
    }
    if(node.type==='BinaryExpression'&&node.operator==='-'&&node.right.type==='BinaryExpression'&&node.right.operator==='%'&&node.right.left.type==='Identifier'&&node.right.left.name==='delta'&&node.right.right.type==='Identifier'&&node.right.right.name==='interval')
      findings.push({rule:'clock-carry',...at(node,owner),detail:'Millisecond clock carry subtracts delta % interval without unit conversion'});
    for(const child of children(node))visit(child);
  }
  for(const owner of owners)if(owner.name==='top-level')visit(owner.node);
  let changed=true;
  while(changed){changed=false;for(const owner of owners)if(owner.mask){for(const fn of owner.edges){const next=fn.mask|owner.mask;if(next!==fn.mask){fn.mask=next;changed=true;}}for(const edge of owner.eventEdges){const next=edge.fn.mask|edge.mask;if(next!==edge.fn.mask){edge.fn.mask=next;changed=true;}}}}
  const descendants=start=>{const seen=new Set(),stack=[start];while(stack.length){const item=stack.pop();if(seen.has(item))continue;seen.add(item);stack.push(...item.edges);}return seen;};
  const exitOwners=new Set();
  for(const owner of owners){const reach=descendants(owner);if([...reach].some(x=>x.navigates))for(const x of reach)exitOwners.add(x);}
  for(const owner of owners) {
    for(const node of owner.audio) {
      if(owner.mask&1)findings.push({rule:'load-audio',...at(node,owner),detail:'AudioContext reachable without a user gesture'});
      else if(!owner.mask)uncertain.push({...at(node,owner),detail:'AudioContext has no proven gesture-only caller; execution context unresolved'});
    }
    if(exitOwners.has(owner))for(const node of owner.dialogs)findings.push({rule:'exit-dialog',...at(node,owner),detail:'Blocking dialog is transitively reachable on a navigation/exit path'});
  }
}

function audit(root) {
  const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  const files=tracked.filter(file=>/\.(?:html?|[cm]?js)$/i.test(file));
  const findings=[],uncertain=[],groups=[],referencedScripts=new Set(),trackedSet=new Set(tracked);
  const read=file=>fs.readFileSync(path.join(root,file),'utf8');
  function localTarget(specifier,from) {
    if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(specifier))return null;
    const clean=decodeURIComponent(specifier.split(/[?#]/,1)[0]);
    const candidate=path.posix.normalize(clean.startsWith('/')?clean.slice(1):path.posix.join(path.posix.dirname(from),clean));
    if(candidate==='..'||candidate.startsWith('../'))throw new Error('Script dependency escapes repository');
    return candidate;
  }
  function expandScript(file,units,seen) {
    if(seen.has(file))return;seen.add(file);referencedScripts.add(file);
    if(!trackedSet.has(file)){uncertain.push({file,line:1,detail:'Local executable dependency is not tracked; its calling context is unverified'});return;}
    const source=read(file);units.push({file,line:1,source});
    let ast;try{ast=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});}catch{return;}
    const inspect=node=>{
      if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)&&typeof literal(node.source)==='string') {
        const specifier=literal(node.source);
        // Bare imports have no repository-relative identity without a resolver.
        if(specifier.startsWith('.')||specifier.startsWith('/')){const target=localTarget(specifier,file);if(target)expandScript(target,units,seen);}
      }
      for(const child of children(node))inspect(child);
    };inspect(ast);
  }
  // Each document has its own global environment. Only an actual script src
  // or static import supplies another file to that document's call graph.
  for(const file of files.filter(file=>/\.html?$/i.test(file))) {
    const units=[],seen=new Set();
    try {for(const unit of htmlUnits(read(file),file,findings)) {
      if(unit.externalSource){const target=localTarget(unit.externalSource,file);if(target)expandScript(target,units,seen);}
      else units.push(unit);
    }}catch(error){uncertain.push({file,line:1,detail:error.message});}
    groups.push({document:file,units});analyse(units,findings,uncertain);
  }
  for(const file of files.filter(file=>!/\.html?$/i.test(file)&&!referencedScripts.has(file))) {
    const units=[];try{expandScript(file,units,new Set());}catch(error){uncertain.push({file,line:1,detail:error.message});}
    groups.push({document:file,units});analyse(units,findings,uncertain);
  }
  const unique=list=>[...new Map(list.map(x=>[JSON.stringify(x),x])).values()];
  return {status:uncertain.length?'INCONCLUSIVE':findings.length?'RED':'GREEN',parser:`Acorn ${acorn.version}`,trackedFiles:tracked.length,executableFiles:files.length,documents:groups.map(g=>({entry:g.document,scripts:g.units.map(u=>u.file)})),scriptUnits:groups.reduce((sum,g)=>sum+g.units.length,0),findings:unique(findings),uncertain:unique(uncertain),exclusions:[],limits:['Static conservative call graph; dynamic compilation is inconclusive.','Different documents never share bindings. Only explicit local script src/import edges join files.','No directory exclusions or reference-copy exceptions.','Not a claim that existing estate files pass; default audit scans every tracked HTML and JavaScript file.']};
}

function selfTest() {
  const fixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'as1-regression-'));
  execFileSync('git',['init','-q'],{cwd:fixtureRoot});
  const fixture=path.join(fixtureRoot,'surface.html');
  fs.writeFileSync(fixture,'<!doctype html><p>Ready</p>');execFileSync('git',['add','surface.html'],{cwd:fixtureRoot});
  const cases=[
    ['viewport','<meta name="viewport" content="width=device-width, maximum-scale=1.0, user-scalable=no">','viewport'],
    ['audio','<script>new AudioContext();</script>','load-audio'],
    ['exit dialogs','<button onclick="leave()">Exit</button><script>function ask(){confirm("Leave?")} function leave(){ask();window.location.href="/"}</script>','exit-dialog'],
    ['base64','<script>btoa(JSON.stringify({word:"café"}));</script>','unicode-base64'],
    ['carry','<script>lastTime=currentTime-(delta % interval);</script>','clock-carry']
  ];
  const records=[];
  const run=(name,source,expected,rule)=>{fs.writeFileSync(fixture,source);const proc=spawnSync(process.execPath,[SELF,'--root',fixtureRoot,'--json'],{encoding:'utf8'});let report;try{report=JSON.parse(proc.stdout);}catch{throw new Error(`Invalid CLI output for ${name}: ${proc.stdout} ${proc.stderr}`);}const ok=proc.status===expected&&(!rule||report.findings.some(x=>x.rule===rule));records.push({name,expectedExit:expected,actualExit:proc.status,passed:ok,report});console.log(`${name}: ${report.status}; exit ${proc.status}; ${ok?'PASS':'FAIL'}`);if(!ok)throw new Error(`Firing control failed: ${name}`);};
  for(const [name,source,rule]of cases){run(`${name} planted`,source,1,rule);run(`${name} removed`,'<!doctype html><p>Ready</p>',0);}
  run('gesture audio permitted','<button id="start">Start</button><script>function make(){new AudioContext()}document.getElementById("start").addEventListener("click",make)</script>',0);
  run('boot helper audio rejected','<script>function make(){new AudioContext()}function boot(){make()}boot()</script>',1,'load-audio');
  run('constructor boot audio rejected','<script>class Host{constructor(){new AudioContext()}}const host=new Host()</script>',1,'load-audio');
  run('constructor this-method audio alias rejected','<script>class Host{constructor(){this.initAudio()}initAudio(){const AudioContextClass=window.AudioContext||window.webkitAudioContext;this.audioCtx=new AudioContextClass()}}const host=new Host()</script>',1,'load-audio');
  run('inline gesture audio permitted','<button onclick="new AudioContext()">Start</button>',0);
  run('inline load audio rejected','<body onload="new AudioContext()"></body>',1,'load-audio');
  run('transitive exit dialog rejected','<script>function ask(){alert("Leaving")}function helper(){ask()}function leave(){helper();location.assign("/")}document.body.addEventListener("click",leave)</script>',1,'exit-dialog');
  run('non-exit dialog not misclassified','<script>document.body.addEventListener("click",()=>confirm("Clear drawing?"))</script>',0);
  run('anchor default navigation dialog rejected','<a href="/" onclick="confirm(\'Leave?\')">Exit</a>',1,'exit-dialog');
  run('dynamic function cannot pass','<script>new Function("new AudioContext()")()</script>',2);
  run('string timer cannot pass','<script>setTimeout("new AudioContext()",0)</script>',2);
  run('strings comments and data ignored','<script>const example="new AudioContext(); btoa(JSON.stringify(x)); clock-(delta % interval)"; /* confirm("bye") */</script><script type="application/json">{"example":"new AudioContext()"}</script><!-- <meta name="viewport" content="maximum-scale=1"> -->',0);
  run('parse failure is inconclusive','<script>const broken = ; new AudioContext()</script>',2);
  run('viewport single quotes and entities','<meta content=\'width=device-width&#44;maximum-scale=1\' name=viewport>',1,'viewport');
  run('cross-script boot helper rejected','<script>function make(){new AudioContext()}</script><script>make()</script>',1,'load-audio');
  run('unknown audio context inconclusive','<script>export function libraryFactory(){new AudioContext()}</script>',2);
  const other=path.join(fixtureRoot,'other.html');
  fs.writeFileSync(other,'<script>document.body.addEventListener("click",make)</script>');execFileSync('git',['add','other.html'],{cwd:fixtureRoot});
  run('unrelated document cannot supply gesture caller','<script>function make(){new AudioContext()}</script>',2);
  execFileSync('git',['rm','-f','other.html'],{cwd:fixtureRoot});
  const helper=path.join(fixtureRoot,'helper.js');
  fs.writeFileSync(helper,'function make(){new AudioContext()}');execFileSync('git',['add','helper.js'],{cwd:fixtureRoot});
  run('explicit script src supplies gesture caller','<script src="./helper.js"></script><script>document.body.addEventListener("click",make)</script>',0);
  execFileSync('git',['rm','-f','helper.js'],{cwd:fixtureRoot});
  const reference=option('--reference',null);
  if(reference)run('unaltered attached ArcadeHost load audio rejected',fs.readFileSync(reference,'utf8'),1,'load-audio');
  run('restored fixture','<!doctype html><p>Ready</p>',0);
  const report={status:'PASS',fiveReds:5,fiveGreens:5,cases:records.length,records,fixtureRoot,fixtureTracked:true};
  const reportDir=option('--report-dir',null);
  if(reportDir){fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'as1_regression_controls.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(reportDir,'as1_regression_controls.txt'),records.map(x=>`${x.name}: ${x.report.status}; exit ${x.actualExit}; ${x.passed?'PASS':'FAIL'}`).join('\n')+'\nFive required reds: 5. Five required restored greens: 5.\n');}
  console.log(`Five required reds: 5. Five required restored greens: 5. ${records.length} controls passed.`);
}

try {
  if(argv.includes('--self-test'))selfTest();
  else {const result=audit(path.resolve(option('--root',process.cwd())));if(asJSON)console.log(JSON.stringify(result,null,2));else{console.log(`${result.status}: ${result.executableFiles} executable files, ${result.scriptUnits} script units`);for(const item of result.findings)console.log(`${item.file}:${item.line} ${item.rule}: ${item.detail}`);for(const item of result.uncertain)console.log(`${item.file}:${item.line} MEASUREMENT INVALID: ${item.detail}`);}process.exitCode=result.uncertain.length?2:result.findings.length?1:0;}
} catch(error) {console.error(`MEASUREMENT INVALID: ${error.stack??error.message}`);process.exitCode=2;}
