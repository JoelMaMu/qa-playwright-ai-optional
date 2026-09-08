#!/usr/bin/env node
/**
 * Puts the SUT into a deterministic initial state.
 *
 * Idempotent: a 400 "already exists" on a second run is a success, not an error.
 * Synthetic data only (ADR-0003). Emits no request outside the SUT.
 *
 * One account is created per (role, browser project). The three projects run the
 * same spec file concurrently against a single shared SUT, so a single account per
 * role would let them fight over the same server-side basket. This mirrors
 * `accountFor()` in tests/data/seed.ts.
 */

import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.SUT_BASE_URL ?? 'http://localhost:3000';
const HEALTH = `${BASE}/rest/admin/application-version`;

const ROLES = ['alice', 'bruno', 'carine'];
const PROJECTS = ['chromium', 'firefox', 'webkit'];

const SECURITY_QUESTION_ID = 1;
const SECURITY_ANSWER = 'synthetic-seed-answer';

function accounts() {
  return ROLES.flatMap((role) =>
    PROJECTS.map((project) => ({
      email: `${role}.${project}@qa-ai-optional.test`,
      password: `Seed!${role}2026`,
    })),
  );
}

async function waitForSut(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no attempt yet';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        console.log(`  SUT ready, version ${body.version ?? 'unknown'}`);
        return;
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
    await sleep(2000);
  }
  throw new Error(
    `SUT unreachable on ${BASE} after ${timeoutMs / 1000}s (last error: ${lastError}).\n` +
      `Check that the container is running: npm run sut:up`,
  );
}

async function registerUser(user) {
  const res = await fetch(`${BASE}/api/Users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      passwordRepeat: user.password,
      securityQuestion: { id: SECURITY_QUESTION_ID },
      securityAnswer: SECURITY_ANSWER,
    }),
  });

  if (res.ok) return 'created';

  // Juice Shop answers 400 with a uniqueness constraint when the email exists.
  // That is the nominal case on a second run.
  const body = await res.text();
  if (res.status === 400 && /already|unique|exist/i.test(body)) return 'already present';

  throw new Error(`Could not create ${user.email}: HTTP ${res.status} ${body.slice(0, 200)}`);
}

async function main() {
  console.log(`[seed] SUT: ${BASE}`);
  await waitForSut();

  const users = accounts();
  console.log(`[seed] ${users.length} synthetic accounts (${ROLES.length} roles x ${PROJECTS.length} projects)`);

  let created = 0;
  for (const user of users) {
    if ((await registerUser(user)) === 'created') created += 1;
  }

  console.log(`[seed] ${created} created, ${users.length - created} already present`);
  console.log('[seed] initial state established');
}

main().catch((err) => {
  console.error(`[seed] FAILED: ${err.message}`);
  process.exit(1);
});
