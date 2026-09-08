#!/usr/bin/env node
/**
 * Detects invisible Unicode characters in the files an AI assistant reads and
 * interprets. Those files (AGENTS.md, CLAUDE.md, .cursorrules, system prompts)
 * are loaded every session on every workstation: a hidden instruction in one of
 * them is invisible in a GitHub diff, invisible in an editor, and perfectly
 * readable by the model.
 *
 * No dependencies: it must run in a pre-commit hook and in a minimal CI job,
 * including when `npm ci` has failed.
 *
 * Usage:
 *   node bin/cli.mjs [path...]   default: current directory, text + agent files
 *   node bin/cli.mjs --all       every file, whatever its extension
 *
 * Exit codes: 0 clean, 1 findings, 2 execution error.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename, relative, resolve } from 'node:path';

const SUSPECTS = [
  { from: 0x200b, to: 0x200f, label: 'zero-width / directional mark', severity: 'high' },
  { from: 0x202a, to: 0x202e, label: 'bidi override (Trojan Source)', severity: 'critical' },
  { from: 0x2060, to: 0x2064, label: 'invisible joiner', severity: 'high' },
  { from: 0x2066, to: 0x2069, label: 'directional isolate', severity: 'critical' },
  { from: 0xfeff, to: 0xfeff, label: 'BOM in inner position', severity: 'medium' },
  { from: 0x180e, to: 0x180e, label: 'Mongolian vowel separator', severity: 'high' },
  { from: 0xe0000, to: 0xe007f, label: 'Unicode tag (plane 14)', severity: 'critical' },
];

/** Files loaded and interpreted by an assistant. These are the ones that execute. */
const AGENT_FILES = [
  /^AGENTS?\.md$/i,
  /^CLAUDE\.md$/i,
  /^GEMINI\.md$/i,
  /^\.cursorrules$/,
  /^\.windsurfrules$/,
  /^copilot-instructions\.md$/i,
  /\.(chatmode|prompt|instructions)\.md$/i,
  /^mcp[-.]?config\.json$/i,
];
const AGENT_DIRS = [/(^|\/)\.github\//, /(^|\/)ai\//, /(^|\/)\.claude\//];

const TEXT_EXT = /\.(md|mdx|txt|json|ya?ml|toml|ts|tsx|js|mjs|cjs|sh)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'test-results']);

const args = process.argv.slice(2);
const scanAll = args.includes('--all');
const targets = args.filter((a) => !a.startsWith('--'));
const roots = targets.length ? targets : ['.'];

function classify(codePoint) {
  return SUSPECTS.find((s) => codePoint >= s.from && codePoint <= s.to) ?? null;
}

function isAgentFile(relPath) {
  const name = basename(relPath);
  return AGENT_FILES.some((r) => r.test(name)) || AGENT_DIRS.some((r) => r.test(`/${relPath}`));
}

/**
 * Replaces every suspect character with a visible dot, so the report can quote a
 * line without reproducing the payload.
 *
 * Derived from SUSPECTS rather than from a hard-coded character class: the ranges
 * live in one place, and this file contains no invisible literal, so it passes its
 * own lint. A security tool that has to exempt itself is a tool that gets disabled.
 */
function redactInvisible(line) {
  let out = '';
  for (const char of line) out += classify(char.codePointAt(0)) ? '·' : char;
  return out;
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const findings = [];
let scanned = 0;

async function scanFile(file, relPath) {
  let source;
  try {
    source = await readFile(file, 'utf8');
  } catch {
    return;
  }
  scanned += 1;

  source.split('\n').forEach((line, lineIndex) => {
    let column = 0;
    for (const char of line) {
      column += 1;
      const codePoint = char.codePointAt(0);
      // U+FEFF as the very first byte of the file is a legitimate BOM.
      if (codePoint === 0xfeff && lineIndex === 0 && column === 1) continue;
      const suspect = classify(codePoint);
      if (!suspect) continue;
      findings.push({
        file: relPath,
        line: lineIndex + 1,
        column,
        codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
        label: suspect.label,
        severity: suspect.severity,
        isAgentFile: isAgentFile(relPath),
        context: redactInvisible(line).slice(0, 100),
      });
    }
  });
}

async function main() {
  const cwd = process.cwd();

  for (const root of roots) {
    const abs = resolve(root);
    const info = await stat(abs).catch(() => null);
    if (!info) {
      console.error(`path not found: ${root}`);
      process.exit(2);
    }

    const files = info.isDirectory()
      ? walk(abs)
      : (async function* () {
          yield abs;
        })();

    for await (const file of files) {
      const relPath = relative(cwd, file) || basename(file);
      if (!scanAll && !TEXT_EXT.test(file) && !isAgentFile(relPath)) continue;
      await scanFile(file, relPath);
    }
  }

  if (findings.length === 0) {
    console.log(`invisible-unicode-lint: ${scanned} file(s) scanned, nothing hidden.`);
    return;
  }

  // Assistant-read files first: those are the ones that execute.
  findings.sort((a, b) => Number(b.isAgentFile) - Number(a.isAgentFile));

  console.error(`invisible-unicode-lint: ${findings.length} finding(s) in ${scanned} file(s).\n`);
  for (const f of findings) {
    const flag = f.isAgentFile ? '  [READ BY AN ASSISTANT]' : '';
    console.error(`  ${f.file}:${f.line}:${f.column}${flag}`);
    console.error(`    ${f.codePoint} ${f.label} (severity: ${f.severity})`);
    console.error(`    ${f.context}\n`);
  }

  const critical = findings.filter((f) => f.isAgentFile);
  if (critical.length) {
    console.error(
      `${critical.length} finding(s) in files an AI assistant loads and interprets.\n` +
        `Those files are executable code: a hidden instruction runs on every session,\n` +
        `on every workstation, and stays invisible in PR review.`,
    );
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(`invisible-unicode-lint failed: ${err.message}`);
  process.exit(2);
});
