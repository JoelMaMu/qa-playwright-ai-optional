import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
// fileURLToPath, not .pathname: the latter keeps percent-encoding, and a single
// space in the checkout path is enough to break the resolution.
const CLI = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));

async function lint(args) {
  try {
    const { stdout } = await run(process.execPath, [CLI, ...args]);
    return { code: 0, output: stdout };
  } catch (err) {
    return { code: err.code, output: `${err.stdout}${err.stderr}` };
  }
}

async function fixture(files) {
  const dir = await mkdtemp(join(tmpdir(), 'iul-'));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content, 'utf8');
  }
  return dir;
}

test('exits 0 on a clean tree', async () => {
  const dir = await fixture({ 'notes.md': 'nothing to see here\n' });
  const { code } = await lint([dir]);
  assert.equal(code, 0);
});

test('flags a zero-width character and exits 1', async () => {
  const dir = await fixture({ 'notes.md': `hidden${String.fromCodePoint(0x200b)}payload\n` });
  const { code, output } = await lint([dir]);
  assert.equal(code, 1);
  assert.match(output, /U\+200B/);
});

test('flags a plane 14 Unicode tag', async () => {
  const dir = await fixture({ 'notes.md': `visible${String.fromCodePoint(0xe0041)}\n` });
  const { code, output } = await lint([dir]);
  assert.equal(code, 1);
  assert.match(output, /U\+E0041/);
});

test('marks assistant-read files so they are triaged first', async () => {
  const dir = await fixture({ 'CLAUDE.md': `run${String.fromCodePoint(0x202e)}this\n` });
  const { output } = await lint([dir]);
  assert.match(output, /READ BY AN ASSISTANT/);
});

test('accepts a BOM as the first character of a file', async () => {
  const dir = await fixture({ 'notes.md': `${String.fromCodePoint(0xfeff)}title\n` });
  const { code } = await lint([dir]);
  assert.equal(code, 0);
});

test('--all reaches files the default extension filter skips', async () => {
  const dir = await fixture({ Makefile: `all:${String.fromCodePoint(0x200b)}\n` });

  const withoutFlag = await lint([dir]);
  assert.equal(withoutFlag.code, 0, 'Makefile is out of the default scope');

  const withFlag = await lint(['--all', dir]);
  assert.equal(withFlag.code, 1, '--all must widen the scope');
  assert.match(withFlag.output, /U\+200B/);
});

test('exits 2 on an unknown path', async () => {
  const { code } = await lint(['/definitely/not/here']);
  assert.equal(code, 2);
});
