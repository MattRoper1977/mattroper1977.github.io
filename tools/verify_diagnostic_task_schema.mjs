#!/usr/bin/env node
/*
 * S2.4 — the diagnostic-task schema, its fixtures, and the label map.
 *
 * No new dependency: this implements the JSON Schema subset the file actually
 * uses (type, enum, required, pattern, additionalProperties, min/maxLength,
 * minimum/maximum, items, object/array nesting). R10 forbids a second install
 * line, and pulling ajv in for eleven keywords would be one.
 *
 * It also asserts things a validator alone would not:
 *   - every enum slug has a display label, and no label is orphaned
 *     (the slug/display split is what stops a rename killing a shared URL)
 *   - additionalProperties:false actually rejects a stray key
 *   - a task cannot ship LAUNCH-only prose to a BUILD pupil
 *   - supportSummary cannot be set to a value a human did not choose
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

let pass = 0, fail = 0;
const ok = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${d ? '  — ' + d : ''}`); };

/* ---- the validator ---------------------------------------------------- */
function validate(node, schema, at = '') {
  const errs = [];
  const T = schema.type;
  if (T === 'object') {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return [`${at}: expected object`];
    for (const r of schema.required || []) if (!(r in node)) errs.push(`${at}.${r}: required but missing`);
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(node)) if (!(schema.properties || {})[k]) errs.push(`${at}.${k}: not permitted (additionalProperties false)`);
    }
    for (const [k, v] of Object.entries(node)) {
      const sub = (schema.properties || {})[k];
      if (sub) errs.push(...validate(v, sub, `${at}.${k}`));
    }
  } else if (T === 'array') {
    if (!Array.isArray(node)) return [`${at}: expected array`];
    node.forEach((it, i) => errs.push(...validate(it, schema.items || {}, `${at}[${i}]`)));
  } else if (T === 'string') {
    if (typeof node !== 'string') return [`${at}: expected string`];
    if (schema.enum && !schema.enum.includes(node)) errs.push(`${at}: "${node}" not in enum`);
    if (schema.pattern && !new RegExp(schema.pattern).test(node)) errs.push(`${at}: "${node}" fails pattern ${schema.pattern}`);
    if (schema.minLength != null && node.length < schema.minLength) errs.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength != null && node.length > schema.maxLength) errs.push(`${at}: longer than ${schema.maxLength} (${node.length})`);
  } else if (T === 'integer') {
    if (!Number.isInteger(node)) return [`${at}: expected integer`];
    if (schema.minimum != null && node < schema.minimum) errs.push(`${at}: below ${schema.minimum}`);
    if (schema.maximum != null && node > schema.maximum) errs.push(`${at}: above ${schema.maximum}`);
  }
  return errs;
}

const schema = rd('schema/diagnostic-task.schema.json');
const labels = rd('data/tag-labels.json');
console.log('== diagnostic task schema ==\n');

/* ---- the two fixtures -------------------------------------------------- */
const fixtures = fs.readdirSync(path.join(ROOT, 'schema/fixtures'))
  .filter((f) => f.endsWith('.task.json')).sort();
ok('both named sample topics have a fixture', fixtures.length === 2, fixtures.join(', '));
for (const f of fixtures) {
  const errs = validate(rd(`schema/fixtures/${f}`), schema, f.replace('.task.json', ''));
  ok(`${f} validates`, errs.length === 0, errs.length ? errs.join(' | ') : 'no errors');
}

/* ---- the label map ----------------------------------------------------- */
const dims = {
  classroomRole: schema.properties.classroomRole.enum,
  interactionModel: schema.properties.interactionModel.enum,
  specification: schema.properties.curriculum.properties.specification.enum,
  'supportGiven.kind': schema.properties.supportGiven.items.properties.kind.enum,
  supportSummary: schema.properties.supportSummary.enum,
};
for (const [dim, slugs] of Object.entries(dims)) {
  const map = labels[dim] || {};
  const missing = slugs.filter((s) => !map[s]);
  const orphan = Object.keys(map).filter((k) => !slugs.includes(k));
  ok(`${dim}: every slug has a label, no orphans`, missing.length === 0 && orphan.length === 0,
     `${slugs.length} slugs` + (missing.length ? `; MISSING ${missing.join(',')}` : '') + (orphan.length ? `; ORPHAN ${orphan.join(',')}` : ''));
}

/* ---- controls: the schema must REJECT, or it is decoration -------------- */
console.log('\n  controls — a schema that accepts everything asserts nothing');
const base = rd('schema/fixtures/electrolysis.task.json');
const clone = () => JSON.parse(JSON.stringify(base));
const rejects = (label, mutate, expectFragment) => {
  const t = clone(); mutate(t);
  const errs = validate(t, schema, 'ctl');
  const hit = errs.some((e) => e.includes(expectFragment));
  ok(label, errs.length > 0 && hit, errs.length ? errs[0] : 'ACCEPTED — the schema did not reject it');
};
rejects('CONTROL: a stray key is rejected (this is what keeps learnerName out)',
        (t) => { t.learnerName = 'Sam T'; }, 'not permitted');
rejects('CONTROL: an unknown classroomRole is rejected',
        (t) => { t.classroomRole = '15-Min Investigation'; }, 'not in enum');
rejects('CONTROL: LAUNCH-only prose cannot ship to a BUILD pupil',
        (t) => { delete t.feedback[0].register.build; }, 'required but missing');
rejects('CONTROL: supportSummary cannot hold a value no human chose',
        (t) => { t.supportSummary = 'independent-inferred'; }, 'not in enum');
rejects('CONTROL: a free-text note cannot be smuggled into supportGiven',
        (t) => { t.supportGiven = [{ kind: 'adult-prompt', at: '2026-08-24T10:00:00Z', note: 'helped a lot' }]; }, 'not permitted');

console.log('');
if (fail) { console.error(`${pass} passed, ${fail} FAILED`); process.exit(1); }
console.log(`all ${pass} schema checks passed`);
