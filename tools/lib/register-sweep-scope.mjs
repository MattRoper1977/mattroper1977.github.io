/* Scope for the microcopy register sweep.
 *
 * The sweep for the register's banned phrasings reported a hit inside
 * schema/diagnostic-task.schema.json — in the description of `actionLabel`,
 * which reads "Replaces 'Try Again'". That is the specification of the rule
 * being flagged as a violation of itself. A sweep that reports its own
 * specification trains the next reader to skim its output, and a skimmed sweep
 * is a sweep that has stopped working.
 *
 * So every hit is classified before it is counted:
 *
 *   ship  a visitor can load this file, so the phrase is copy
 *   spec  this file DESCRIBES copy — a schema, a doc, a gate, a proof
 *
 * ROLE IS DECIDED BY WHAT LOADS THE FILE, NOT BY WHICH FOLDER IT SITS IN.
 * This matters more than it sounds: `tools/index.html` is the visitor-facing
 * Tools Hub, sitting in a directory otherwise full of gate scripts. An
 * exclusion written as "skip tools/" would have dropped a real, served surface
 * out of the sweep silently — the sweep would have got quieter and looked
 * healthier. That is the same failure in the opposite direction.
 */
import { readFileSync } from 'node:fs';

const IGNORE = /^(\.git|node_modules|__pycache__|_shelf)\//;
const SPEC_DIR = /^(schema|docs|reports|\.github)\//;

/** @returns {{role:'ship'|'spec'|'ignore', why:string}} */
export function classify(rel) {
  const p = String(rel).replace(/^\.\//, '');
  if (IGNORE.test(p)) return { role: 'ignore', why: 'not part of the estate' };
  if (SPEC_DIR.test(p)) return { role: 'spec', why: 'specification directory' };
  if (/\.md$/i.test(p)) return { role: 'spec', why: 'documentation' };
  if (/\.schema\.json$/i.test(p)) return { role: 'spec', why: 'schema' };
  // A .html or .css under tools/ is SERVED. Everything else under tools/ is a
  // gate or a renderer, and its strings describe copy rather than being it.
  if (/^tools\//.test(p) && !/\.(html|css)$/i.test(p)) return { role: 'spec', why: 'gate or renderer source' };
  return { role: 'ship', why: 'a visitor can load this' };
}

/* The swept terms are DERIVED from the schema that bans them, never retyped
   here. Failure mode 1 in docs/VERIFIER_FAILURE_MODES.md is a check holding its
   own copy of the value it checks; a hand-typed banned-phrase list in this file
   would be exactly that, and would go stale the first time the schema gained a
   rule. Today the schema states one: actionLabel "Replaces 'Try Again'". */
export function bannedPhrases(schemaPath) {
  const raw = readFileSync(schemaPath, 'utf8');
  const out = new Set();
  for (const m of raw.matchAll(/Replaces '([^']{1,40})'/g)) out.add(m[1]);
  return [...out];
}
