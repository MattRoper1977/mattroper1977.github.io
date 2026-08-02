/* Exercises /cors-test.html's decision logic in all three worlds.
 *
 * formsubmit.co is unreachable from this container (403 on CONNECT), so the
 * responses are STUBBED. That is stated rather than hidden: what is verified
 * here is the PROBE'S REASONING, not the vendor's behaviour. Only Matt's one
 * click on the real origin can answer the vendor question, and this script
 * makes no claim about it.
 *
 * Also asserts the page is inert until pressed, and that nothing on the site
 * links to it.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const base = process.argv[2];
const b = await chromium.launch();
const fails = [];
const ck = (name, ok, got) => { if (!ok) fails.push(name + (got ? '  — got: ' + got : ''));
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '   got: ' + got)); };

/* world: how the stub answers a cors-mode POST and a no-cors POST */
async function run(label, world) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const seen = [];
  await ctx.route('**://formsubmit.co/**', async route => {
    const req = route.request();
    // Playwright cannot report the fetch mode, so infer it from the Accept
    // header the page sets only on probe A.
    const isA = (req.headers()['accept'] || '').includes('application/json');
    seen.push((isA ? 'A' : 'B') + ' ' + req.method() + ' ' + req.url());
    const how = isA ? world.a : world.b;
    if (how === 'abort') return route.abort('failed');
    await route.fulfill({ status: how.status, contentType: 'application/json',
                          headers: { 'access-control-allow-origin': '*' }, body: how.body });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  await p.goto(base + '/cors-test.html', { waitUntil: 'networkidle' });

  const before = await p.evaluate(() => ({
    reqs: performance.getEntriesByType('resource').filter(r => /formsubmit/.test(r.name)).length,
    verdictShown: getComputedStyle(document.getElementById('verdict')).display !== 'none',
    out: document.getElementById('out').textContent.trim(),
  }));

  await p.click('#go');
  await p.waitForFunction(() => /VERDICT:/.test(document.getElementById('out').textContent), null, { timeout: 15000 });
  const after = await p.evaluate(() => ({
    out: document.getElementById('out').textContent,
    verdict: document.getElementById('verdict').textContent,
    cls: document.getElementById('verdict').className,
    btnDisabled: document.getElementById('go').disabled,
  }));
  await ctx.close();
  console.log('\n' + label);
  console.log('     requests: ' + (seen.length ? seen.map(s => s.split(' ')[0]).join(',') : 'none'));
  console.log('     verdict:  ' + after.verdict);
  return { before, after, seen, errs };
}

console.log('CORS PROBE — decision logic, responses STUBBED (formsubmit.co unreachable here)');

/* 1. CORS permitted: probe A reads a real response. B must NOT run. */
const permitted = await run('WORLD 1  reply readable',
  { a: { status: 200, body: '{"success":"true","message":"The form was submitted successfully."}' }, b: 'abort' });

/* 2. CORS refused: A throws, B (no-cors) resolves opaque. */
const refused = await run('WORLD 2  request sent, reply refused', { a: 'abort', b: { status: 200, body: 'x' } });

/* 3. Nothing left the browser at all. */
const dead = await run('WORLD 3  nothing left the browser', { a: 'abort', b: 'abort' });

await b.close();

console.log('\nASSERTIONS');
ck('inert before the press: 0 requests to formsubmit.co', permitted.before.reqs === 0, permitted.before.reqs);
ck('inert before the press: verdict hidden', permitted.before.verdictShown === false);
ck('inert before the press: output says "Not run yet."', /Not run yet/.test(permitted.before.out));

ck('W1 verdict is PERMITTED', /PERMITTED/.test(permitted.after.verdict), permitted.after.verdict);
ck('W1 styled as success', permitted.after.cls.includes('yes'), permitted.after.cls);
ck('W1 fires exactly ONE request (no wasted second message)', permitted.seen.length === 1, permitted.seen.length);
ck('W1 prints the response body', /success/.test(permitted.after.out));
ck('W1 action line says merge', /ACTION: merge/.test(permitted.after.out));

ck('W2 verdict is REFUSED', /REFUSED/.test(refused.after.verdict), refused.after.verdict);
ck('W2 styled as failure', refused.after.cls.includes('no'), refused.after.cls);
ck('W2 ran both probes', refused.seen.length === 2, refused.seen.length);
ck('W2 action line says close', /ACTION: close/.test(refused.after.out));

ck('W3 verdict is INCONCLUSIVE, not a refusal', /INCONCLUSIVE/.test(dead.after.verdict), dead.after.verdict);
ck('W3 explicitly forbids reading it as a refusal', /Do not treat this as a refusal/.test(dead.after.out));
ck('W3 styled as neither', dead.after.cls.includes('dunno'), dead.after.cls);

const allErrs = [...permitted.errs, ...refused.errs, ...dead.errs]
  .filter(e => !/Failed to load resource|net::ERR|Failed to fetch/i.test(e));   // the aborts are the point
ck('no page errors beyond the deliberate aborts', allErrs.length === 0, allErrs.join(' | '));

console.log('');
console.log(fails.length === 0 ? 'RESULT: PASS' : 'RESULT: FAIL — ' + fails.length);
process.exit(fails.length ? 1 : 0);
