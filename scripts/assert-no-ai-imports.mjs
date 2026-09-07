#!/usr/bin/env node
/**
 * Mechanical proof of ADR-0001 and ADR-0002.
 *
 * A repository can claim "no model is involved at execution time". This script
 * turns that claim into a property checked on every pull request. It rejects:
 *
 *   1. an import of `ai/` from the execution scope;
 *   2. a model provider environment variable read in that scope;
 *   3. a hard-coded provider endpoint in that scope;
 *   4. a CI workflow referencing a provider or starting an MCP server.
 *
 * Point 4 matters most: it is the only check that stops the boundary from eroding
 * one pull request at a time.
 *
 * No dependencies: it must run even when `npm ci` has failed.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: the latter keeps percent-encoding, and a single
// space in the checkout path is enough to break the script.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Execution scope: what runs when `playwright test` runs. */
const RUNTIME_SCOPE = ['tests', 'sut'];
const RUNTIME_FILES = ['playwright.config.ts'];

const AI_IMPORT = /(?:from|import|require)\s*\(?\s*['"][^'"]*\bai\/(?:prompts|policy)\b/;

const PROVIDER_ENV =
  /process\.env\.[A-Z_]*(?:OPENAI|ANTHROPIC|MISTRAL|OLLAMA|GEMINI|COHERE)[A-Z_]*/;

const PROVIDER_HOST =
  /https?:\/\/(?:[a-z0-9-]+\.)*(?:openai|anthropic|mistral|cohere|googleapis)\.[a-z]{2,}/i;

/** What CI is not allowed to contain (ADR-0002). */
const CI_FORBIDDEN = [
  { pattern: /playwright\/mcp|playwright-mcp/i, why: 'MCP server started in CI' },
  { pattern: PROVIDER_HOST, why: 'model provider endpoint' },
  { pattern: /\b(?:OPENAI|ANTHROPIC|MISTRAL|GEMINI|COHERE)_API_KEY\b/, why: 'provider secret' },
  { pattern: /init-agents/, why: 'agent definitions generated in CI' },
];

const violations = [];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function record(file, line, rule, excerpt) {
  violations.push({ file: relative(ROOT, file), line, rule, excerpt: excerpt.trim().slice(0, 140) });
}

async function checkRuntimeFile(file) {
  if (!/\.(ts|mts|mjs|js)$/.test(file)) return;
  const source = await readFile(file, 'utf8');
  source.split('\n').forEach((text, index) => {
    // Only code is checked. Comments legitimately name providers, and a rule that
    // fires on prose is a rule the team ends up disabling.
    const code = text.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (AI_IMPORT.test(code)) record(file, index + 1, 'import of ai/ in the execution scope', text);
    if (PROVIDER_ENV.test(code)) record(file, index + 1, 'provider environment variable', text);
    if (PROVIDER_HOST.test(code)) record(file, index + 1, 'hard-coded provider endpoint', text);
  });
}

async function checkWorkflow(file) {
  const source = await readFile(file, 'utf8');
  source.split('\n').forEach((text, index) => {
    if (text.trimStart().startsWith('#')) return;
    for (const { pattern, why } of CI_FORBIDDEN) {
      if (pattern.test(text)) record(file, index + 1, `ADR-0002: ${why}`, text);
    }
  });
}

async function main() {
  for (const dir of RUNTIME_SCOPE) {
    for await (const file of walk(join(ROOT, dir))) await checkRuntimeFile(file);
  }
  for (const file of RUNTIME_FILES) await checkRuntimeFile(join(ROOT, file));
  for await (const file of walk(join(ROOT, '.github', 'workflows'))) {
    if (/\.ya?ml$/.test(file)) await checkWorkflow(file);
  }

  if (violations.length === 0) {
    console.log('OK: the generation / execution boundary holds.');
    console.log('    tests/ and sut/ reference neither ai/ nor any model provider.');
    console.log('    no workflow calls a model or starts an MCP server.');
    return;
  }

  console.error(`FAILED: ${violations.length} boundary violation(s).\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    rule    : ${v.rule}`);
    console.error(`    excerpt : ${v.excerpt}\n`);
  }
  console.error('See adr/0001-ai-as-a-removable-layer.md and adr/0002-no-llm-in-ci.md');
  process.exit(1);
}

main().catch((err) => {
  console.error(`Check failed: ${err.message}`);
  process.exit(1);
});
