/* s24-pathway-exclusions — an excluded class never carries a teaching-pathway facet.
 *
 * BUILD, GROW and LAUNCH are pathways and also three of the most ordinary verbs
 * in English. The index derives the facet by matching words against a record's
 * own prose with the case already flattened, so it cannot tell "build your
 * Keeper Record" from the BUILD pathway. Nine arcade records were filed under a
 * teaching pathway on exactly that confusion.
 *
 * data/pathway-exclusions.json is the reference and this gate holds no private
 * copy of it — a control carrying its own duplicate of the thing it checks is
 * the second-literal defect this estate keeps paying for.
 *
 * ABSENCE IS A FAILURE, NEVER A PASS. A vanished or empty record would restore
 * the broken behaviour while every check stayed green.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RECORD = path.join(ROOT, 'data', 'pathway-exclusions.json');
const INDEX = path.join(ROOT, 'data', 'mbm-search-index.json');

let fails = 0, checks = 0;
const check = (ok, what, detail = '') => {
  checks++; if (!ok) fails++;
  console.log(`  [${ok ? ' ok ' : 'FAIL'}] ${what}${detail ? '  — ' + detail : ''}`);
};

if (!existsSync(RECORD)) {
  console.error('MEASUREMENT INVALID: data/pathway-exclusions.json is absent. Without it this gate measures nothing, and the generator it guards falls back to unguarded text matching.');
  process.exit(2);
}
let record;
try { record = JSON.parse(readFileSync(RECORD, 'utf8')); }
catch (e) { console.error(`MEASUREMENT INVALID: data/pathway-exclusions.json does not parse — ${e.message}`); process.exit(2); }

const excluded = (record.excludedCategories || []).filter(Boolean);
if (excluded.length === 0) {
  console.error('MEASUREMENT INVALID: data/pathway-exclusions.json declares no excluded categories. An empty rule excludes nothing while reading as a guard.');
  process.exit(2);
}
if (!existsSync(INDEX)) { console.error('MEASUREMENT INVALID: the search index is absent.'); process.exit(2); }

const raw = JSON.parse(readFileSync(INDEX, 'utf8')).entries;
const entries = Array.isArray(raw) ? Object.fromEntries(raw.map(r => [r.id, r])) : raw;
const ids = Object.keys(entries);

check(ids.length > 0, 'the index has records to measure', `${ids.length}`);
check(excluded.length > 0, 'the record declares a class to exclude', excluded.join(', '));

/* Non-vacuity: if the excluded class matched nothing at all, this gate would
   pass for the wrong reason — it would be asserting over an empty set. */
const inClass = ids.filter(id => excluded.includes(entries[id].category));
check(inClass.length > 0,
  'the excluded class actually matches records — this gate is not asserting over an empty set',
  `${inClass.length} record(s) in ${excluded.join('/')}`);

const offenders = inClass.filter(id => {
  const p = entries[id].pathway;
  return Array.isArray(p) ? p.length > 0 : Boolean(p);
});
check(offenders.length === 0,
  `no ${excluded.join('/')} record carries a teaching-pathway facet`,
  offenders.length ? `${offenders.length} offender(s): ${offenders.slice(0, 6).join(', ')}` : `${inClass.length} checked`);

console.log(`\npathway exclusions: ${checks - fails}/${checks} passed`);
if (fails) {
  console.log(`${fails} FAILED — the classifier text-matches prose and cannot tell the verb from the pathway. Fix the exclusion record or the generator; never reword a description to dodge the scanner.`);
  process.exit(1);
}
