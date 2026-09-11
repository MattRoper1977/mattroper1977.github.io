#!/usr/bin/env node
/**
 * AS1 §1.5: inspect text-bearing HTML use sites and JavaScript DOM output.
 *
 * Default universe: git ls-files, never a directory walk. --files-from accepts
 * an explicit JSON array of repository-relative paths; output labels that mode.
 * There are no path exclusions. Documentation .md is not HTML; HTML examples in
 * docs are checked exactly like other HTML. Comments, CSS and JS identifiers are
 * not pupil-facing text. Dynamic/unsupported DOM output is INCONCLUSIVE and
 * exits 2, never silently green. A found placeholder exits 1.
 *
 * Generic English words Heading, Title, Label and Placeholder are rejected when
 * they comprise a label (with optional number/punctuation), not when they are
 * words in an ordinary sentence. TODO/TBC/Lorem/Your text here/X{3,} are rejected
 * as word-delimited tokens or phrases. This is a use-site test, not a grep.
 *
 * Requires Python 3 and Acorn. Acorn is loaded from a normal installation or
 * Node's bundled parser. Failure of either dependency fails closed.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const self = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const relevant = /\.(?:html?|xhtml|svg|[cm]?js|jsx|tsx?|vue|svelte|njk|hbs|liquid)$/i;
const htmlFile = /\.(?:html?|xhtml|svg|vue|svelte|njk|hbs|liquid)$/i;
const textProps = new Set(['textContent', 'innerText', 'title', 'alt', 'placeholder', 'ariaLabel', 'ariaDescription']);
const htmlProps = new Set(['innerHTML', 'outerHTML', 'srcdoc']);
const displayAttrs = new Set(['title', 'alt', 'aria-label', 'aria-description', 'aria-roledescription', 'placeholder']);

function run(command, args, options = {}) {
  const r = spawnSync(command, args, {encoding:'utf8', maxBuffer:64 * 1024 * 1024, ...options});
  if (r.error || r.status !== 0) throw new Error(`${command} failed: ${r.error?.message || r.stderr || r.status}`);
  return r.stdout;
}

function loadParser() {
  try { return require('acorn'); } catch {}
  const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
  if (!source) throw new Error('Acorn unavailable; JavaScript coverage cannot be established');
  const module = {exports:{}};
  vm.runInNewContext(source, {module, exports:module.exports}, {timeout:5000});
  if (typeof module.exports.parse !== 'function') throw new Error('Acorn did not export parse');
  return module.exports;
}

function placeholder(text) {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  const whole = normalized.match(/^(Heading|Title|Label|Placeholder)(?:\s*\d+)?\s*[:.!?]?$/iu);
  if (whole) return whole[1];
  const token = normalized.match(/(?<![\p{L}\p{N}_])(Lorem|TODO|TBC|Your\s+text\s+here|X{3,})(?![\p{L}\p{N}_])/iu);
  return token?.[1] || null;
}

function htmlExtract(source) {
  return JSON.parse(run('python3', [path.join(here,'as1_placeholder_html.py')], {input:JSON.stringify({source})}));
}

function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') fn(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'range') continue;
    if (Array.isArray(value)) value.forEach(item => walk(item, fn));
    else if (value && typeof value === 'object') walk(value, fn);
  }
}

function scanFile(source, file, parser) {
  const findings = [];
  const add = (kind, line, use, detail) => findings.push({kind,file,line,use,detail});
  const inspectText = (text, line, use) => {
    const match = placeholder(text);
    if (match) add('RED', line, use, `placeholder ${JSON.stringify(match)} in ${JSON.stringify(text.replace(/\s+/gu,' ').trim().slice(0,160))}`);
    if (/\{\{|<%|\{%/.test(text)) add('INCONCLUSIVE',line,use,'Template expression requires its rendered output to be checked');
  };
  const inspectHTML = (markup, offset=0, use='markup') => {
    const extracted = htmlExtract(markup);
    for (const t of extracted.texts) {
      if (t.html) inspectHTML(t.text,offset+t.line-1,`${use}/${t.use}`);
      else inspectText(t.text,offset+t.line,`${use}/${t.use}`);
    }
    for (const s of extracted.scripts) inspectJS(s.text,offset+s.line-1,s.handler);
  };
  const inspectJS = (code, offset=0, handler=false) => {
    let tree;
    try { tree = parser.parse(code,{ecmaVersion:'latest',sourceType:'module',locations:true,allowReturnOutsideFunction:handler}); }
    catch (err) { add('INCONCLUSIVE',offset+(err.loc?.line||1),'JavaScript parser',`${err.message}; JSX/TypeScript must be rendered or parsed before a green claim`); return; }
    // Resolve only uniquely declared, never subsequently assigned constants.
    // Shadowed/ambiguous declarations and data arriving from calls stay unknown.
    const bindings = new Map();
    const changed = new Set();
    const declaredNames = pattern => {
      if (!pattern) return [];
      if (pattern.type==='Identifier') return [pattern.name];
      if (pattern.type==='RestElement') return declaredNames(pattern.argument);
      if (pattern.type==='AssignmentPattern') return declaredNames(pattern.left);
      if (pattern.type==='ArrayPattern') return pattern.elements.flatMap(declaredNames);
      if (pattern.type==='ObjectPattern') return pattern.properties.flatMap(p=>declaredNames(p.type==='RestElement'?p.argument:p.value));
      return [];
    };
    walk(tree,node=>{
      if (node.type==='VariableDeclarator') {
        for (const key of declaredNames(node.id)) bindings.set(key,bindings.has(key)||node.id.type!=='Identifier'?null:node.init);
      }
      if (['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type)) {
        for (const p of node.params) for (const key of declaredNames(p)) bindings.set(key,null);
        if (node.id) bindings.set(node.id.name,null);
      }
      if (node.type==='CatchClause') for(const key of declaredNames(node.param)) bindings.set(key,null);
      if (node.type==='ImportDeclaration') for(const s of node.specifiers) bindings.set(s.local.name,null);
      if ((node.type==='AssignmentExpression' || node.type==='UpdateExpression')) {
        const target=node.left||node.argument;
        if (target.type==='Identifier') changed.add(target.name);
      }
    });
    const value = (node, seen=new Set()) => {
      if (!node) return {known:false};
      if (node.type==='Literal') return {known:true,value:node.value};
      if (node.type==='Identifier' && bindings.get(node.name) && !changed.has(node.name) && !seen.has(node.name)) {
        return value(bindings.get(node.name),new Set([...seen,node.name]));
      }
      if (node.type==='TemplateLiteral') {
        let out=node.quasis[0].value.cooked??node.quasis[0].value.raw;
        for (let i=0;i<node.expressions.length;i++) {
          const v=value(node.expressions[i],seen);
          if (!v.known) return {known:false};
          out+=String(v.value)+(node.quasis[i+1].value.cooked??node.quasis[i+1].value.raw);
        }
        return {known:true,value:out};
      }
      if (node.type==='BinaryExpression' && node.operator==='+') {
        const l=value(node.left,seen),r=value(node.right,seen);
        if (l.known&&r.known) return {known:true,value:l.value+r.value};
      }
      if (node.type==='ArrayExpression') {
        const arr=node.elements.map(n=>value(n,seen));
        if (arr.every(x=>x.known)) return {known:true,value:arr.map(x=>x.value)};
      }
      if (node.type==='CallExpression' && memberName(node.callee)==='join') {
        const arr=value(node.callee.object,seen), sep=node.arguments.length?value(node.arguments[0],seen):{known:true,value:','};
        if (arr.known&&Array.isArray(arr.value)&&sep.known) return {known:true,value:arr.value.join(sep.value)};
      }
      return {known:false};
    };
    function memberName(node) {
      if (node?.type!=='MemberExpression') return null;
      return node.computed ? (node.property.type==='Literal'?node.property.value:null) : node.property.name;
    }
    const checkOutput = (node, arg, mode, use) => {
      const line=offset+(node.loc?.start.line||1),v=value(arg);
      if (v.known) {
        if (mode==='html') inspectHTML(String(v.value??''),line-1,use);
        else inspectText(String(v.value??''),line,use);
      } else {
        // Inspect static pieces even when interpolation prevents a full proof.
        if (arg?.type==='TemplateLiteral') for (const q of arg.quasis) {
          if (mode==='html') inspectHTML(q.value.cooked??q.value.raw,offset+q.loc.start.line-1,use+'/static-template-part');
          else inspectText(q.value.cooked??q.value.raw,offset+q.loc.start.line,use+'/static-template-part');
        }
        add('INCONCLUSIVE',line,use,'DOM output is not statically resolved; check the composed output before claiming green');
      }
    };
    walk(tree,node=>{
      if (node.type==='AssignmentExpression' && node.left.type==='MemberExpression') {
        const prop=memberName(node.left);
        if (htmlProps.has(prop)) checkOutput(node,node.right,'html',`DOM .${prop}`);
        if (textProps.has(prop)) checkOutput(node,node.right,'text',`DOM .${prop}`);
        if (node.left.computed && prop===null) add('INCONCLUSIVE',offset+node.loc.start.line,'computed property assignment','Property name is unresolved and may be a DOM text/HTML sink');
      }
      if (node.type==='CallExpression') {
        const name=memberName(node.callee);
        const directName=node.callee.type==='Identifier'?node.callee.name:null;
        if (name==='insertAdjacentHTML') checkOutput(node,node.arguments[1],'html','DOM insertAdjacentHTML');
        if (name==='insertAdjacentText') checkOutput(node,node.arguments[1],'text','DOM insertAdjacentText');
        if (name==='createTextNode') checkOutput(node,node.arguments[0],'text','DOM createTextNode');
        if (name==='setAttribute') {
          const attr=value(node.arguments[0]);
          if (!attr.known) add('INCONCLUSIVE',offset+node.loc.start.line,'DOM setAttribute','Attribute name is unresolved');
          else if (displayAttrs.has(String(attr.value).toLowerCase())) checkOutput(node,node.arguments[1],'text',`DOM setAttribute(${attr.value})`);
          else if (String(attr.value).toLowerCase()==='srcdoc') checkOutput(node,node.arguments[1],'html','DOM setAttribute(srcdoc)');
        }
        if ((name==='write'||name==='writeln')&&node.callee.object?.type==='Identifier'&&node.callee.object.name==='document') {
          for (const arg of node.arguments) checkOutput(node,arg,'html',`document.${name}`);
        }
        if (['append','prepend','replaceChildren'].includes(name)) {
          for (const arg of node.arguments) {
            const v=value(arg);
            if (v.known&&typeof v.value==='string') checkOutput(node,arg,'text',`DOM ${name}`);
            else if (!v.known) add('INCONCLUSIVE',offset+node.loc.start.line,`DOM ${name}`,'Argument may contain text; composed output must be checked');
          }
        }
        if (node.callee.type==='Identifier' && ['eval','Function'].includes(node.callee.name)) add('INCONCLUSIVE',offset+node.loc.start.line,'dynamic code','Dynamic code may create DOM output');
        if (['jsx','jsxs','jsxDEV','h','html'].includes(directName)||(['createElement','jsx','jsxs'].includes(name)&&node.callee.object?.name!=='document')) {
          add('INCONCLUSIVE',offset+node.loc.start.line,'UI factory output','UI factory output must be rendered/parsed before claiming green');
          for (const arg of node.arguments.slice(2)) {
            const v=value(arg);
            if(v.known&&typeof v.value==='string') inspectText(v.value,offset+arg.loc.start.line,'UI factory text child');
          }
        }
      }
      if (node.type==='TaggedTemplateExpression') add('INCONCLUSIVE',offset+node.loc.start.line,'tagged template','Tagged template may generate markup; its output must be checked');
      if (node.type==='NewExpression'&&node.callee.type==='Identifier'&&node.callee.name==='Function') add('INCONCLUSIVE',offset+node.loc.start.line,'dynamic code','Dynamic code may create DOM output');
    });
  };
  if (htmlFile.test(file)) inspectHTML(source);
  else inspectJS(source);
  return [...new Map(findings.map(f=>[JSON.stringify(f),f])).values()];
}

function parseArgs(argv) {
  const options={root:process.cwd()};
  for (let i=0;i<argv.length;i++) {
    if (argv[i]==='--root') options.root=path.resolve(argv[++i]);
    else if (argv[i]==='--files-from') options.filesFrom=path.resolve(argv[++i]);
    else if (argv[i]==='--json') options.json=path.resolve(argv[++i]);
    else if (argv[i]==='--self-test') options.selfTest=true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return options;
}

function selfTest() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'as1-placeholder-'));
  const lines=[];
  try {
    run('git',['init','--quiet',root]);
    const fixture=path.join(root,'fixture.html');
    const safe='<!doctype html><title>Orbit race</title><style>.title{color:red}</style><!-- Heading TODO XXX --><h1>Choose a route</h1><p>Give your story a title and label the diagram.</p><script>const title="Title";const label="Label";const heading="Heading";</script>';
    fs.writeFileSync(fixture,safe); run('git',['add','fixture.html'],{cwd:root});
    const invoke=()=>spawnSync(process.execPath,[self,'--root',root],{encoding:'utf8'});
    const assertCase=(name,content,expected)=>{
      fs.writeFileSync(fixture,content); const r=invoke();
      const passed=r.status===expected;
      lines.push(`${name}: expected exit ${expected}; measured exit ${r.status}; ${passed?'PASS':'FAIL'}`);
      if(!passed) throw new Error(`${name}: ${r.stdout}${r.stderr}`);
    };
    assertCase('Harmless identifier, CSS, comments and ordinary sentence',safe,0);
    for (const word of ['Heading','Title','Label','Lorem','TODO','TBC','Placeholder','Your text here','XXX','XXXX']) {
      assertCase(`PLANT ${word}`,safe+`<h2>${word}</h2>`,1);
      assertCase(`REMOVE ${word}`,safe,0);
    }
    for (const [name,content] of [
      ['nested label','<button>Your <b>text</b> here</button>'],
      ['accessible attribute','<button aria-label="Placeholder"></button>'],
      ['visible input value','<input value="Your text here">'],
      ['metadata title','<meta property="og:title" content="Title">'],
      ['innerHTML','<script>document.body.innerHTML="<h2>Heading</h2>";</script>'],
      ['textContent','<script>document.body.textContent="Title";</script>'],
      ['constant dataflow','<script>const label="Label";document.body.textContent=label;</script>'],
      ['template literal','<script>document.body.innerHTML=`<h2>Heading</h2>`;</script>'],
      ['array join','<script>document.body.innerHTML=["<h2>","Placeholder","</h2>"].join("");</script>'],
      ['document write','<script>document.write("<h2>TODO</h2>");</script>'],
      ['event handler','<button onclick="this.textContent=\'Title\'">Go</button>'],
    ]) {
      assertCase(`PLANT ${name}`,safe+content,1);
      assertCase(`REMOVE ${name}`,safe,0);
    }
    assertCase('Unresolved DOM output fails closed',safe+'<script>document.body.textContent=window.userLabel;</script>',2);
    assertCase('Unresolved computed sink fails closed',safe+'<script>document.body[window.property]="Heading";</script>',2);
    assertCase('Shadowed parameter is not a false constant',safe+'<script>const output="Start";function render(output){document.body.textContent=output;}</script>',2);
    assertCase('JSX fails closed',safe+'<script>const panel=<h2>Heading</h2>;</script>',2);
    assertCase('Compiled JSX fails closed',safe+'<script>const panel=jsx("h2",{children:"Heading"});</script>',2);
    assertCase('React factory text child red',safe+'<script>const panel=React.createElement("h2",null,"Heading");</script>',1);
    assertCase('RESTORED final green',safe,0);
    console.log(lines.join('\n'));
    console.log('PLACEHOLDER_SELF_TEST PASS; real CLI mutations and restoration proved');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}

try {
  const opts=parseArgs(process.argv.slice(2));
  if (opts.selfTest) selfTest();
  else {
    const parser=loadParser();
    const files=opts.filesFrom?JSON.parse(fs.readFileSync(opts.filesFrom,'utf8')):run('git',['ls-files','-z'],{cwd:opts.root}).split('\0').filter(Boolean);
    if (!Array.isArray(files)||files.some(f=>typeof f!=='string'||path.isAbsolute(f)||f.split(/[\\/]/).includes('..'))) throw new Error('File universe must be an array of repository-relative paths without traversal');
    const selected=[...new Set(files)].filter(f=>relevant.test(f));
    const findings=[];
    for (const file of selected) {
      const target=path.join(opts.root,file);
      if (!fs.existsSync(target)) { findings.push({kind:'INCONCLUSIVE',file,line:1,use:'file universe',detail:'Listed file is absent'}); continue; }
      const canonical=fs.realpathSync(target);
      if (!canonical.startsWith(fs.realpathSync(opts.root)+path.sep)) throw new Error(`File escapes root: ${file}`);
      findings.push(...scanFile(fs.readFileSync(target,'utf8'),file,parser));
    }
    const red=findings.filter(f=>f.kind==='RED').length;
    const inconclusive=findings.filter(f=>f.kind==='INCONCLUSIVE').length;
    const result={mode:opts.filesFrom?'EXPLICIT_FILE_LIST':'TRACKED_GIT_UNIVERSE',root:opts.root,listed:files.length,eligible:selected.length,red,inconclusive,findings};
    console.log(`PLACEHOLDER_GATE mode=${result.mode}; listed=${files.length}; markup/script files=${selected.length}`);
    for (const f of findings) console.log(`${f.kind} ${f.file}:${f.line} ${f.use}: ${f.detail}`);
    console.log(`PLACEHOLDER_GATE ${red?'RED':inconclusive?'INCONCLUSIVE':'GREEN'}; placeholders=${red}; inconclusive=${inconclusive}`);
    if(opts.json) fs.writeFileSync(opts.json,JSON.stringify(result,null,2)+'\n');
    process.exitCode=red?1:inconclusive?2:0;
  }
} catch(err) { console.error(`MEASUREMENT INVALID: ${err.message}`); process.exitCode=2; }
