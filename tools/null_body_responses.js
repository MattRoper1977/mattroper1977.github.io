#!/usr/bin/env node
/* MKT1-A item 3: a static guard over supabase/functions/**\/*.ts.
   Fetch standard: a Response whose status is a null-body status (101, 103, 204,
   205, 304) must be built with a null body. A string body, even '', throws a
   TypeError in Deno and the Supabase edge runtime, so the function answers 500.
   Until 26 Sep 2026 all three mailing and account functions answered the
   browser's CORS preflight that way, while every repository check was green.
   The Response constructor also accepts only 200-599, so 101 and 103 throw a
   RangeError whatever the body.
   Shapes scanned:
     direct   new Response(<body>, { status: N, ... })            N literal
              Response.json(<any>, { status: N, ... })            always has a body
     helper   function f(status, ...) { ... new Response(<body>, { status ... }) }
              const f = (status, ...) => new Response(<body>, { status ... })
              const f = (status, ...) => { ... }                  (block body)
              called as f(N, ...), unless <body> maps N itself to null
              (status === N ? null : ...), which Response.json never can
     wrapper  a function or arrow whose first parameter is passed straight
              through as a helper's first argument is a helper too
   Scope: PER FILE and LITERAL STATUS ONLY. These shapes pass unseen:
     - a helper defined in one file and called from another (an import from
       ../usage-shared/handler.ts, say): helpers are not followed across files
     - a status that is not a three-digit literal where it is used: a named
       constant (NO_CONTENT = 204), `204 as number`, a ternary
       (ok ? 204 : 200), or an init object held in a variable
     - a helper or wrapper whose status is not its first parameter
     - a function expression (const f = function (status) {...}) or an object
       method as the helper
   On 27 Sep 2026 the only one in use under supabase/functions is a ternary
   in usage-shared/handler.ts, send(code === ... ? 413 : ... ? 415 : 400),
   none of whose values is a null-body status.
   verify_accounts_members_mailing.js runs scanTree() in CI with positive
   controls; `node tools/null_body_responses.js [root]` runs the full planted
   set standalone. */
'use strict';
const fs = require('fs'), path = require('path');
const NULL_BODY = [101, 103, 204, 205, 304];
const constructible = n => n >= 200 && n <= 599;

function args(src, open) { // split the argument list starting after '(' at index open
  let depth = 0, cur = '', out = [], quote = null;
  for (let i = open + 1; i < src.length; i++) {
    const c = src[i];
    if (quote) { cur += c; if (c === '\\') { cur += src[++i]; continue } if (c === quote) quote = null; continue }
    if (c === "'" || c === '"' || c === '`') { quote = c; cur += c; continue }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) { if (depth === 0) { out.push(cur.trim()); return { args: out, end: i } } depth-- }
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += c;
  }
  return { args: out, end: src.length };
}
const isNull = b => /^(null|undefined)$/.test(b) || b === '';
const line = (src, i) => src.slice(0, i).split('\n').length;
const esc = s => s.replace(/[$]/g, '\\$');
const nullFor = (body, param, n) => new RegExp('\\b(?:' + esc(param) + '|status)\\s*===?\\s*' + n + '\\s*\\?\\s*null\\b').test(body);

function blockEnd(src, open) { // index of the '}' matching the '{' at open
  let depth = 0, quote = null;
  for (let i = open; i < src.length; i++) { const c = src[i];
    if (quote) { if (c === '\\') { i++; continue } if (c === quote) quote = null; continue }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '{') depth++; if (c === '}' && --depth === 0) return i; }
  return -1;
}
function expressionEnd(src, start) { // end of an arrow's expression body
  let depth = 0, quote = null, seen = false;
  for (let i = start; i < src.length; i++) { const c = src[i];
    if (quote) { if (c === '\\') { i++; continue } if (c === quote) quote = null; continue }
    if (c === "'" || c === '"' || c === '`') { quote = c; seen = true; continue }
    if ('([{'.includes(c)) { depth++; seen = true; continue }
    if (')]}'.includes(c)) { if (depth === 0) return i; depth--; continue }
    if (depth === 0 && (c === ';' || c === ',')) return i;
    if (depth === 0 && c === '\n' && seen) { const next = src.slice(i).match(/^\s*(\S)/); if (!next || !'.?:+-*/%&|<>=(['.includes(next[1])) return i }
    if (!/\s/.test(c)) seen = true;
  }
  return src.length;
}
function functions(src) { // every named function or arrow: { name, param, open, close }
  const out = [];
  for (const f of src.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)/g)) {
    const params = args(src, src.indexOf('(', f.index)); const open = src.indexOf('{', params.end);
    if (open >= 0) out.push({ name: f[1], param: f[2], open, close: blockEnd(src, open) });
  }
  for (const f of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(?:async\s*)?(?:\(\s*([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)\s*=>)/g)) {
    let after;
    if (f[2]) { const params = args(src, src.lastIndexOf('(', f.index + f[0].length - f[2].length)); const arrow = src.slice(params.end + 1).match(/^\s*(?::[^=;{]*?)?\s*=>/); if (!arrow) continue; after = params.end + 1 + arrow[0].length }
    else after = f.index + f[0].length;
    const open = after + src.slice(after).match(/^\s*/)[0].length;
    out.push({ name: f[1], param: f[2] || f[3], open, close: src[open] === '{' ? blockEnd(src, open) : expressionEnd(src, open) });
  }
  return out;
}
function enclosing(fns, at) { // innermost function or arrow whose body contains index `at`
  let best = null;
  for (const f of fns) if (f.open <= at && f.close > at && (!best || f.open > best.open)) best = f;
  return best;
}
function scanText(rel, src) {
  const findings = [], helpers = [], fns = functions(src);
  const sites = [...[...src.matchAll(/new\s+Response\s*\(/g)].map(m => ({ m, json: false })),
                 ...[...src.matchAll(/(?<![\w$.])Response\s*\.\s*json\s*\(/g)].map(m => ({ m, json: true }))];
  for (const { m, json } of sites) {
    const a = args(src, m.index + m[0].length - 1).args, body = a[0] || '', opts = a[1] || '';
    const shown = (json ? 'Response.json(' : 'new Response(') + body.slice(0, 40);
    const lit = opts.match(/\bstatus\s*:\s*(\d{3})\b/);
    if (lit && !constructible(+lit[1]))
      findings.push(`${rel}:${line(src, m.index)} ${shown}, { status: ${lit[1]} }) is outside 200-599, so the constructor throws whatever the body`);
    else if (lit && NULL_BODY.includes(+lit[1]) && (json || !isNull(body)))
      findings.push(`${rel}:${line(src, m.index)} ${shown}, { status: ${lit[1]} }) gives a body to a null-body status`);
    // A helper passes its own status parameter through: remember it.
    const fn = enclosing(fns, m.index), flat = opts.replace(/\s+/g, ' ');
    if (!lit && fn && ((fn.param === 'status' && /(^|[{,\s])status\s*[,}]/.test(flat)) || new RegExp('\\bstatus\\s*:\\s*' + esc(fn.param) + '\\b').test(opts)))
      helpers.push({ name: fn.name, param: fn.param, body, json, empty: !json && isNull(body) });
  }
  // A wrapper whose first parameter goes straight through as a helper's first argument.
  for (let grew = true; grew;) {
    grew = false;
    for (const h of [...helpers]) for (const c of src.matchAll(new RegExp('(?<![\\w$.])' + esc(h.name) + '\\s*\\(\\s*([A-Za-z_$][\\w$]*)', 'g'))) {
      const fn = enclosing(fns, c.index);
      if (fn && fn.param === c[1] && fn.name !== h.name && !helpers.some(x => x.name === fn.name)) { helpers.push({ ...h, name: fn.name, param: fn.param, via: h.name }); grew = true }
    }
  }
  for (const h of helpers) for (const c of src.matchAll(new RegExp('(?<![\\w$.])' + esc(h.name) + '\\s*\\(', 'g'))) {
    const first = (args(src, c.index + c[0].length - 1).args[0] || '').trim();
    if (!/^\d{3}$/.test(first)) continue;
    const n = +first, what = (h.json ? 'Response.json(' : 'new Response(') + h.body.slice(0, 40) + ')';
    if (!constructible(n))
      findings.push(`${rel}:${line(src, c.index)} ${h.name}(${first}, ...) builds ${what} outside 200-599, so the constructor throws whatever the body`);
    else if (NULL_BODY.includes(n) && !h.empty && (h.json || !nullFor(h.body, h.param, n)))
      findings.push(`${rel}:${line(src, c.index)} ${h.name}(${first}, ...) builds ${what} for a null-body status`);
  }
  return findings;
}
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []) }
function scanTree(root, overrides = {}) {
  const base = path.join(root, 'supabase/functions');
  return walk(base).flatMap(f => { const rel = path.relative(root, f); return scanText(rel, Object.prototype.hasOwnProperty.call(overrides, rel) ? overrides[rel] : fs.readFileSync(f, 'utf8')) });
}
module.exports = { scanTree, scanText, NULL_BODY };
if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  const files = walk(path.join(root, 'supabase/functions'));
  const real = scanTree(root);
  const sites = files.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/new\s+Response\s*\(|(?<![\w$.])Response\s*\.\s*json\s*\(/g) || []).length, 0);
  console.log(`scanned ${files.length} .ts files, ${sites} Response construction sites`);
  real.forEach(x => console.log('FINDING', x));
  // Planted controls. Each must add a finding; each safe form must add none.
  const sub = 'supabase/functions/subscribe-mailing-list/index.ts', subSrc = fs.readFileSync(path.join(root, sub), 'utf8');
  const shared = 'supabase/functions/usage-shared/handler.ts', sharedSrc = fs.readFileSync(path.join(root, shared), 'utf8');
  const sendCall = n => sharedSrc.replace('if (req.method === "OPTIONS") return send(204, null);', 'if (req.method === "OPTIONS") return send(' + n + ', null);');
  const controls = [];
  for (const n of NULL_BODY) for (const body of ["''", '""', '``', "'x'", 'JSON.stringify({})'])
    controls.push(['direct ' + body + ' ' + n, sub, subSrc + `\nconst planted = new Response(${body}, { status: ${n}, headers: {} })\n`]);
  for (const n of NULL_BODY) controls.push(['helper json(' + n + ')', sub, subSrc + `\nconst planted = json(${n}, { ok: true }, null)\n`]);
  for (const n of [101, 103, 205, 304]) controls.push(['wrapper send(' + n + ') through response()', shared, sendCall(n)]);
  for (const n of NULL_BODY) controls.push(['Response.json ' + n, sub, subSrc + `\nconst planted = Response.json({ ok: true }, { status: ${n} })\n`]);
  for (const n of [101, 103]) controls.push(['null body ' + n, sub, subSrc + `\nconst planted = new Response(null, { status: ${n} })\n`]);
  controls.push(['arrow helper, expression body', sub, subSrc + '\nconst planted = (status: number, b: unknown) => new Response(JSON.stringify(b), { status })\nconst r = planted(204, {})\n']);
  controls.push(['arrow helper, block body', sub, subSrc + '\nconst planted = (status: number, b: unknown): Response => { return new Response(JSON.stringify(b), { status }) }\nconst r = planted(205, {})\n']);
  controls.push(['arrow helper, Response.json', sub, subSrc + '\nconst planted = (status: number, b: unknown) => Response.json(b, { status })\nconst r = planted(304, {})\n']);
  controls.push(['arrow helper with a null body, 101', sub, subSrc + '\nconst planted = (status: number) => new Response(null, { status })\nconst r = planted(101)\n']);
  const safe = [
    ['null body 204', sub, subSrc + '\nconst ok1 = new Response(null, { status: 204 })\n'],
    ['json 200', sub, subSrc + '\nconst ok2 = json(200, {}, null)\n'],
    ['string 200', sub, subSrc + "\nconst ok3 = new Response('', { status: 200 })\n"],
    ['Response.json 200', sub, subSrc + '\nconst ok4 = Response.json({ ok: true }, { status: 200 })\n'],
    ['send(204, null): the helper maps 204 to null', shared, sharedSrc],
    ['arrow helper mapping 204 to null', sub, subSrc + '\nconst ok5 = (status: number, b: unknown) => new Response(status === 204 ? null : JSON.stringify(b), { status })\nconst r5 = ok5(204, {})\n'],
  ];
  let missed = 0, falsePos = 0;
  for (const [label, rel, text] of controls) if (!(scanTree(root, { [rel]: text }).length > real.length)) { missed++; console.log('MISSED control', label) }
  for (const [label, rel, text] of safe) if (scanTree(root, { [rel]: text }).length > real.length) { falsePos++; console.log('FALSE POSITIVE', label) }
  console.log(`controls: ${controls.length - missed}/${controls.length} planted defects fire; ${safe.length - falsePos}/${safe.length} safe forms pass`);
  process.exit(real.length || missed || falsePos ? 1 : 0);
}
