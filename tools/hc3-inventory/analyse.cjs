/* Build-time inventory only. Parses source; never evaluates a game's code. */
'use strict';
const acorn = require('acorn');
const assert = require('node:assert/strict');
const UNKNOWN = Symbol('unresolved'), STORAGE = Symbol('localStorage');
function analyse(scripts) {
  const global = {parent:null, bindings:new Map(), functionScope:true};
  const scopes = new WeakMap(), calls = [], assignments = [], functions = [];
  const results = [], errors = [];
  let currentSource;
  const children = node => Object.values(node).flatMap(v => Array.isArray(v) ? v : [v]).filter(v => v && typeof v === 'object' && typeof v.type === 'string');
  function lookup(scope, name) {for(let s=scope;s;s=s.parent) if(s.bindings.has(name)) return s.bindings.get(name);return null;}
  function bind(scope,name,node,mutable=false) {if(!name)return; const prior=scope.bindings.get(name);scope.bindings.set(name,{node,scope,mutable:mutable||!!prior});}
  function bindPattern(scope,p){if(!p)return;if(p.type==='Identifier')bind(scope,p.name,null);else if(p.type==='Property')bindPattern(scope,p.value);else if(p.type==='AssignmentPattern')bindPattern(scope,p.left);else for(const c of children(p))bindPattern(scope,c);}
  function visit(node, scope, source) {
    if(!node)return;
    if (/Function(?:Declaration|Expression)$/.test(node.type)||node.type==='ArrowFunctionExpression') {
      if(node.type==='FunctionDeclaration')bind(scope,node.id?.name,node);
      const inner={parent:scope,bindings:new Map(),functionScope:true};
      for(const p of node.params){bindPattern(inner,p);if(p.type!=='Identifier')errors.push({source,line:p.loc.start.line,reason:'destructured/default/rest function parameter requires review'});}
      if(node.type==='FunctionExpression'&&node.id)bind(inner,node.id.name,node);
      scopes.set(node,scope);functions.push({node,inner,source});
      visit(node.body,inner,source);return;
    }
    if(node.type==='BlockStatement')scope={parent:scope,bindings:new Map()};
    if(node.type==='CatchClause'){scope={parent:scope,bindings:new Map()};bindPattern(scope,node.param);}
    scopes.set(node,scope);
    if(node.type==='ImportDeclaration')for(const s of node.specifiers)bind(scope,s.local.name,null);
    if(node.type==='ClassDeclaration')bind(scope,node.id?.name,null);
    if(node.type==='VariableDeclaration')for(const d of node.declarations){let target=scope;if(node.kind==='var')while(target.parent&&!target.functionScope)target=target.parent;if(d.id.type==='Identifier')bind(target,d.id.name,d.init);else {bindPattern(target,d.id);errors.push({source,line:d.loc.start.line,reason:'destructured binding requires review'});}}
    if(node.type==='AssignmentExpression'||node.type==='UpdateExpression')assignments.push({node:node.left||node.argument,scope});
    if(node.type==='CallExpression')calls.push({node,source});
    for(const child of children(node))visit(child,scope,source);
  }
  for(const script of scripts){currentSource=script.source;try{const ast=acorn.parse(script.text,{ecmaVersion:'latest',sourceType:script.module?'module':'script',locations:true});visit(ast,script.module?{parent:global,bindings:new Map()}:global,script.source);}catch(e){errors.push({source:currentSource,line:e.loc?.line,reason:'JavaScript parse failed: '+e.message});}}
  function markMutable(b,seen=new Set()){if(!b||seen.has(b))return;seen.add(b);b.mutable=true;if(b.node?.type==='Identifier')markMutable(lookup(scopes.get(b.node)||b.scope,b.node.name),seen);}
  for(const a of assignments){let n=a.node;while(n?.type==='MemberExpression')n=n.object;if(n?.type==='Identifier'){const b=lookup(a.scope,n.name);if(b)markMutable(b);else if(['localStorage','window','self','globalThis'].includes(n.name)){const p=a.node.type==='MemberExpression'?a.node.property:null;const field=p&&(a.node.computed?p.value:p.name);if(a.node===n||n.name==='localStorage'||field==='localStorage')bind(global,n.name,null,true);}}}
  const functionByNode=new Map(functions.map(f=>[f.node,f]));
  function value(node, context=new Map(), seen=new Set(), depth=0) {
    if(!node||depth>12)return UNKNOWN;
    const scope=scopes.get(node)||global;
    const next=(n,c=context,s=seen)=>value(n,c,s,depth+1);
    if(node.type==='Literal')return typeof node.value==='string'||typeof node.value==='number'?node.value:UNKNOWN;
    if(node.type==='Identifier'){
      const b=lookup(scope,node.name);
      if(b){if(context.has(b))return context.get(b);if(b.mutable||!b.node||seen.has(b))return UNKNOWN;return next(b.node,context,new Set([...seen,b]));}
      if(node.name==='localStorage')return STORAGE;
      if(['window','self','globalThis'].includes(node.name))return {global:true};
      return UNKNOWN;
    }
    if(node.type==='BinaryExpression'&&node.operator==='+'){const a=next(node.left),b=next(node.right);return (typeof a==='string'||typeof a==='number')&&(typeof b==='string'||typeof b==='number')?a+b:UNKNOWN;}
    if(node.type==='TemplateLiteral'){let out=node.quasis[0].value.cooked;for(let i=0;i<node.expressions.length;i++){const v=next(node.expressions[i]);if(typeof v!=='string'&&typeof v!=='number')return UNKNOWN;out+=v+node.quasis[i+1].value.cooked;}return out;}
    if(node.type==='ObjectExpression')return {object:node,context};
    if(functionByNode.has(node))return {fn:functionByNode.get(node),context};
    if(node.type==='MemberExpression'){
      const obj=next(node.object),name=node.computed?next(node.property):node.property.name;
      if(obj?.global&&name==='localStorage')return STORAGE;
      if(obj?.object){if(obj.object.properties.some(p=>p.type!=='Property'||(p.computed&&next(p.key)===UNKNOWN)))return UNKNOWN;const props=obj.object.properties.filter(p=>(p.computed?next(p.key):p.key.name??p.key.value)===name);return props.length===1?next(props[0].value,obj.context):UNKNOWN;}
      return UNKNOWN;
    }
    if(node.type==='CallExpression'){
      const f=next(node.callee);if(!f?.fn)return UNKNOWN;
      const ctx=callContext(f,node,context,next),returns=[];
      function scan(n){if(n!==f.fn.node&&functionByNode.has(n))return;if(n.type==='ReturnStatement')returns.push(next(n.argument,ctx));else for(const c of children(n))scan(c);}
      if(f.fn.node.body.type==='BlockStatement')scan(f.fn.node.body);else returns.push(next(f.fn.node.body,ctx));
      return returns.length&&returns.every(v=>v===returns[0])?returns[0]:UNKNOWN;
    }
    return UNKNOWN;
  }
  function callContext(f,call,context,evaluate=value){const c=new Map(f.context);f.fn.node.params.forEach((p,i)=>{const b=f.fn.inner.bindings.get(p.name);if(b)c.set(b,evaluate(call.arguments[i],context));});return c;}
  function record(node,source,context,via) {
    const callee=node.callee;if(callee.type!=='MemberExpression')return;
    const method=callee.computed?value(callee.property,context):callee.property.name;
    const receiver=value(callee.object,context),k=value(node.arguments[0],context);
    if(!['getItem','setItem','removeItem'].includes(method)){if(receiver===STORAGE&&method===UNKNOWN)results.push({source,line:node.loc.start.line,operation:null,key:null,reason:'storage method unresolved'});return;}
    results.push({source,line:node.loc.start.line,operation:method,expression:scripts.find(s=>s.source===source)?.text.slice(node.arguments[0]?.start,node.arguments[0]?.end)||'',key:receiver===STORAGE&&typeof k==='string'?k:null,reason:receiver!==STORAGE?'storage receiver unresolved':typeof k!=='string'?'key expression unresolved':null,...(via?{via}: {})});
  }
  function expand(call,source,context,via=[],seen=new Set()) {
    record(call,source,context,via.length?via:undefined);
    if(via.length>=4)return;
    const f=value(call.callee,context);if(!f?.fn||seen.has(f.fn.node))return;
    const ctx=callContext(f,call,context),visited=new Set([...seen,f.fn.node]);
    function scan(n){if(functionByNode.has(n))return;if(n.type==='CallExpression')expand(n,f.fn.source,ctx,[...via,{source,line:call.loc.start.line}],visited);for(const c of children(n))scan(c);}
    scan(f.fn.node.body);
  }
  for(const c of calls)expand(c.node,c.source,new Map());
  const groups=new Map();
  for(const r of results){const {via,...base}=r,key=JSON.stringify(base);if(groups.has(key))groups.get(key).observedContexts++;else groups.set(key,{...base,observedContexts:1,...(via?{exampleCallerChain:via}: {})});}
  const unique=[...groups.values()];
  return {observations:unique,unresolved:unique.filter(r=>r.key===null),parseOrScopeIssues:errors};
}
function selfTest(){
  const run=text=>analyse([{source:'fixture.js',text}]);const keys=text=>new Set(run(text).observations.map(x=>x.key).filter(x=>x!==null));
  assert.deepEqual(keys(`const help="localStorage.getItem('fake')";localStorage.getItem('real');`),new Set(['real']));
  assert.deepEqual(keys(`let KEY='old';KEY='new';localStorage.getItem(KEY)`),new Set());
  assert.deepEqual(keys(`const KEY='outer';function read(KEY){return localStorage.getItem(KEY)}read('inner')`),new Set(['inner']));
  assert.deepEqual(keys(`const NS={prefix:'demo.'};function read(k){return localStorage.getItem(NS.prefix+k)}read('save')`),new Set(['demo.save']));
  assert.deepEqual(keys(`function store(){return window.localStorage}store().getItem('glitchclash_save')`),new Set(['glitchclash_save']));
  assert.deepEqual(keys('const KEY="x=y";localStorage.getItem(KEY);const r=/["}]/'),new Set(['x=y']));
  assert.deepEqual(keys('const NS="demo.";localStorage.getItem(`${NS}save`)'),new Set(['demo.save']));
  assert(run(`const PREFIX='world.';localStorage.getItem(PREFIX+seed)`).unresolved.length);
  assert(run(`function recursive(x){return recursive(recursive(x))}localStorage.getItem(recursive('key'))`).unresolved.length);
  for(const s of [`try{}catch(localStorage){localStorage.getItem('wrong')}`,`function f({localStorage}){localStorage.getItem('wrong')}`,`const {localStorage}=other;localStorage.getItem('wrong')`,`localStorage=custom;localStorage.getItem('wrong')`,`const N={key:'wrong',...unknown};localStorage.getItem(N.key)`,`const N={key:'wrong',[unknown]:'actual'};localStorage.getItem(N.key)`])assert.deepEqual(keys(s),new Set());
  assert(run(`const operation=unknown;localStorage[operation]('candidate')`).unresolved.length);
  assert.deepEqual(keys(`const NS={key:'wrong'};const alias=NS;alias.key='actual';localStorage.getItem(NS.key)`),new Set());
  const real=`const NS='safe.';function load(k){return localStorage.getItem(NS+k)}load('save');`;
  assert.deepEqual(keys(real),new Set(['safe.save']));assert.notDeepEqual(keys(real.replace("load('save')","load('private')")),new Set(['safe.save']));assert.deepEqual(keys(real),new Set(['safe.save']));
  console.log('PASS: AST strings/regex, mutable/shadowed bindings, namespace/prefix, accessor/wrapper, template, unresolved dynamic key; real/planted/restored');
}
if(require.main===module){if(process.argv.includes('--self-test'))selfTest();else{const fs=require('node:fs');const rows=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(rows.map(r=>({route:r.route,...analyse(r.scripts)}))));}}
module.exports={analyse};
