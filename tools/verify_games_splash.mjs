#!/usr/bin/env node
/* Compatibility entry point for older game-release workflows.
 *
 * The estate-wide verifier is the behavioral owner. Run both its known-state
 * controls (including a real-region removal control) and its complete Site
 * target sweep, while leaving reports outside the checkout.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifier = path.join(root, 'tools', 'verify_maker_splash.mjs');
for (const mode of ['controls', 'verify']) {
  const report = path.join(process.env.RUNNER_TEMP || '/tmp', `maker-splash-site-${mode}.json`);
  const result = spawnSync(process.execPath, [
    verifier,
    `--mode=${mode}`,
    '--scope=site',
    `--site-root=${root}`,
    `--report=${report}`,
  ], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
