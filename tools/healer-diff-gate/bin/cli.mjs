#!/usr/bin/env node
/**
 * healer-diff-gate: rejects patches that turn a build green without repairing it.
 *
 * Usage:
 *   healer-diff-gate --base origin/main [--json report.json] [--strict]
 *
 * Exit codes: 0 clean, 1 violations, 2 analysis error.
 * See SPEC.md for the rules and, more importantly, for the known limits.
 */

import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { compare, RULES } from '../lib/analyse.mjs';

const run = promisify(execFile);

const args = process.argv.slice(2);
function option(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : true;
}

const base = option('--base', 'origin/main');
const jsonOut = option('--json');
const strict = args.includes('--strict');

const SPEC_PATTERN = /^tests\/.*\.spec\.ts$/;

async function git(...gitArgs) {
  const { stdout } = await run('git', gitArgs, { maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

/** Returns file content at a revision, or null when the file does not exist there. */
async function showOrNull(revision, path) {
  try {
    return await git('show', `${revision}:${path}`);
  } catch {
    return null;
  }
}

async function main() {
  let changed;
  try {
    changed = (await git('diff', '--name-only', `${base}...HEAD`))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => SPEC_PATTERN.test(line));
  } catch (err) {
    console.error(`healer-diff-gate: cannot diff against ${base}.`);
    console.error(err.message.split('\n')[0]);
    process.exit(2);
  }

  if (changed.length === 0) {
    console.log(`healer-diff-gate: no spec file changed against ${base}.`);
    return;
  }

  const violations = [];
  for (const path of changed) {
    const before = await showOrNull(base, path);
    const after = await showOrNull('HEAD', path);
    violations.push(...compare({ path, before, after }, { strict }));
  }

  const blocking = violations.filter((v) => !v.waived);
  const waived = violations.filter((v) => v.waived);

  if (jsonOut && typeof jsonOut === 'string') {
    await writeFile(
      jsonOut,
      `${JSON.stringify({ base, strict, blocking, waived }, null, 2)}\n`,
      'utf8',
    );
  }

  for (const v of waived) {
    console.log(`  waived  ${v.code}  ${v.file}: ${v.detail}`);
    console.log(`          reason: ${v.reason}`);
  }

  if (blocking.length === 0) {
    console.log(
      `healer-diff-gate: ${changed.length} spec file(s) checked, no weakening` +
        (waived.length ? `, ${waived.length} waived.` : '.'),
    );
    return;
  }

  console.error(`healer-diff-gate: ${blocking.length} violation(s).\n`);
  for (const v of blocking) {
    console.error(`  ${v.code}  ${v.file}`);
    console.error(`        ${RULES[v.code]}`);
    console.error(`        ${v.detail}\n`);
  }
  console.error(
    'A patch that makes a test pass without repairing it is worse than the failure\n' +
      'it fixes, because the failure was visible. If the weakening is justified by a\n' +
      'real specification change, annotate it:\n\n' +
      '  // healer-gate:allow HDG002 - button label changed to "Confirm order" (JIRA-1234)\n',
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(`healer-diff-gate failed: ${err.message}`);
  process.exit(2);
});
