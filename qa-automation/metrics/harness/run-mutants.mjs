#!/usr/bin/env node
/**
 * False-green harness: break the SUT on purpose, then check whether the suite
 * notices.
 *
 *   suite RED   -> mutant detected, the suite is doing its job
 *   suite GREEN -> false green, a real coverage gap
 *
 *   false-green rate = undetected mutants / total mutants
 *
 * Neither test count nor code coverage answers this question: a suite with no
 * assertion at all reaches 100 % coverage.
 *
 * Requires a running SUT (`npm run sut:up && npm run sut:seed`).
 *
 * Usage:
 *   node qa-automation/metrics/harness/run-mutants.mjs             # whole catalogue
 *   node qa-automation/metrics/harness/run-mutants.mjs M-PRICE-001 # one mutant
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUTANTS } from '../../sut/mutants/catalogue.ts';

/**
 * Playwright must be spawned from the repository root, where its config lives.
 * Found by walking up rather than by counting `..` segments: a relative depth
 * silently breaks the day this file moves, and the symptom is unhelpful
 * ("no projects available") rather than "wrong directory".
 */
function repositoryRoot() {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, 'playwright.config.ts'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('playwright.config.ts not found in any parent directory');
    dir = parent;
  }
  return dir;
}

const ROOT = repositoryRoot();

const selected = process.argv.slice(2);
const catalogue = selected.length ? MUTANTS.filter((m) => selected.includes(m.id)) : MUTANTS;

if (catalogue.length === 0) {
  console.error(`No mutant matched. Known: ${MUTANTS.map((m) => m.id).join(', ')}`);
  process.exit(2);
}

function runSuite(env) {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['--no-install', 'playwright', 'test', '--project=chromium', '--reporter=line'],
      { cwd: ROOT, env: { ...process.env, SUT_EXTERNAL: '1', ...env }, stdio: 'pipe' },
    );
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => resolve({ code, output }));
  });
}

console.log('False-green measurement\n');

// Without a green baseline we could not tell a detected mutant from a broken suite.
process.stdout.write('baseline (no mutant) ... ');
const baseline = await runSuite({});
if (baseline.code !== 0) {
  console.log('RED\n');
  console.error('The suite already fails without a mutant. Measurement aborted:');
  console.error('no result would be interpretable. Fix the suite, then re-run.\n');
  console.error(baseline.output.split('\n').slice(-15).join('\n'));
  process.exit(1);
}
console.log('green\n');

const results = [];
for (const mutant of catalogue) {
  process.stdout.write(`${mutant.id.padEnd(16)} ... `);
  const run = await runSuite({ MUTANT: mutant.id });
  const detected = run.code !== 0;
  results.push({ id: mutant.id, description: mutant.description, detected });
  console.log(detected ? 'detected (suite red)' : '*** FALSE GREEN ***');
}

const missed = results.filter((r) => !r.detected);
const rate = missed.length / results.length;

console.log('\nResult');
console.log(`  mutants          : ${results.length}`);
console.log(`  detected         : ${results.length - missed.length}`);
console.log(`  false-green rate : ${(rate * 100).toFixed(1)} %`);

if (missed.length) {
  console.log('\nUndetected, i.e. real coverage gaps:');
  for (const m of missed) console.log(`  ${m.id}  ${m.description}`);
}

console.log(
  '\nInstrument scope: mutants operate on HTTP responses. A purely client-side\n' +
    'defect escapes them. A 0 % rate means "no mutant in this catalogue escapes the\n' +
    'suite", not "the suite is perfect".',
);

await writeFile(
  new URL('../results/false-green.json', import.meta.url),
  `${JSON.stringify({ total: results.length, missed: missed.length, rate, results }, null, 2)}\n`,
);
console.log('\nReport written to qa-automation/metrics/results/false-green.json');
