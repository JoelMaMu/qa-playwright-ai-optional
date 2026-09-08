import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse, compare, stripComments } from '../lib/analyse.mjs';

const spec = (body) => `import { test, expect } from '../../fixtures/test';\n${body}\n`;

function codes(violations) {
  return violations.filter((v) => !v.waived).map((v) => v.code);
}

test('counts assertions and ignores commented-out ones', () => {
  const source = spec(`
    await expect(a).toHaveText('x');
    // await expect(b).toHaveText('y');
    await expect.poll(() => c).not.toBeNull();
  `);
  assert.equal(analyse(source).assertions, 2);
});

test('stripComments removes block comments without eating URLs', () => {
  const stripped = stripComments("const u = 'https://example.test'; /* gone */ // gone too");
  assert.match(stripped, /https:\/\/example\.test/);
  assert.doesNotMatch(stripped, /gone/);
});

test('HDG001 fires when an assertion disappears', () => {
  const before = spec(`await expect(a).toHaveText('x');\nawait expect(b).toHaveCount(3);`);
  const after = spec(`await expect(a).toHaveText('x');`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), ['HDG001']);
});

test('HDG002 fires on toHaveText -> toBeVisible', () => {
  const before = spec(`await expect(a).toHaveText('Order #1234 confirmed');`);
  const after = spec(`await expect(a).toBeVisible();`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), ['HDG002']);
});

test('HDG002 fires on an exact count turning into toBeTruthy', () => {
  const before = spec(`await expect(rows).toHaveCount(15);`);
  const after = spec(`expect(rows).toBeTruthy();`);
  assert.ok(codes(compare({ path: 'tests/a.spec.ts', before, after })).includes('HDG002'));
});

test('HDG002 stays silent when an assertion is strengthened', () => {
  const before = spec(`await expect(a).toBeVisible();`);
  const after = spec(`await expect(a).toHaveText('exact');`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), []);
});

test('HDG002 does not compare across matcher families', () => {
  const before = spec(`await expect(a).toHaveText('x');\nawait expect(b).toHaveCount(2);`);
  const after = spec(`await expect(a).toHaveText('x');\nawait expect(b).toHaveCount(2);`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), []);
});

test('HDG003 fires when a skip appears', () => {
  const before = spec(`test('a', async () => {});`);
  const after = spec(`test.skip('a', async () => {});`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), ['HDG003']);
});

test('HDG004 fires when a timeout is raised', () => {
  const before = spec(`await expect(a).toHaveText('x', { timeout: 5_000 });`);
  const after = spec(`await expect(a).toHaveText('x', { timeout: 60_000 });`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), ['HDG004']);
});

test('HDG005 fires when a spec file is deleted', () => {
  const before = spec(`await expect(a).toHaveText('x');`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after: null })), ['HDG005']);
});

test('HDG006 fires on expect.soft', () => {
  const before = spec(`await expect(a).toHaveText('x');`);
  const after = spec(`await expect(a).toHaveText('x');\nexpect.soft(b).toBe(1);`);
  assert.ok(codes(compare({ path: 'tests/a.spec.ts', before, after })).includes('HDG006'));
});

test('HDG007 fires on test.slow()', () => {
  const before = spec(`test('a', async () => {});`);
  const after = spec(`test('a', async () => { test.slow(); });`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), ['HDG007']);
});

test('a new file born skipped is rejected', () => {
  const after = spec(`test.skip('a', async () => {});`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before: null, after })), ['HDG003']);
});

test('a valid waiver downgrades a violation instead of blocking', () => {
  const before = spec(`await expect(a).toHaveText('Validate');`);
  const after = spec(`
    // healer-gate:allow HDG002 - label changed to "Confirm order" (JIRA-1234)
    await expect(a).toBeVisible();
  `);
  const result = compare({ path: 'tests/a.spec.ts', before, after });
  assert.deepEqual(codes(result), []);
  assert.equal(result[0].waived, true);
});

test('a waiver with a token reason does not pass', () => {
  const before = spec(`await expect(a).toHaveText('Validate');`);
  const after = spec(`
    // healer-gate:allow HDG002 - fix
    await expect(a).toBeVisible();
  `);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), ['HDG002']);
});

test('a waiver for another rule does not cover this one', () => {
  const before = spec(`test('a', async () => {});`);
  const after = spec(`
    // healer-gate:allow HDG002 - unrelated but long enough to look valid
    test.skip('a', async () => {});
  `);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), ['HDG003']);
});

test('--strict rejects waived violations too', () => {
  const before = spec(`await expect(a).toHaveText('Validate');`);
  const after = spec(`
    // healer-gate:allow HDG002 - label changed to "Confirm order" (JIRA-1234)
    await expect(a).toBeVisible();
  `);
  const result = compare({ path: 'tests/a.spec.ts', before, after }, { strict: true });
  assert.deepEqual(codes(result), ['HDG002']);
});

test('a genuine repair passes clean', () => {
  const before = spec(`await expect(page.locator('#old')).toHaveText('Total: 12.00');`);
  const after = spec(`await expect(page.locator('#new')).toHaveText('Total: 12.00');`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), []);
});

test('known limit: rewriting an assertion onto the wrong value is not detected', () => {
  // Documents a gap rather than a protection. Same matcher, same strength, wrong
  // expectation. This is what the mutant catalogue covers, not the gate.
  const before = spec(`await expect(total).toHaveText('Total: 12.00');`);
  const after = spec(`await expect(total).toHaveText('Total: 21.00');`);
  assert.deepEqual(codes(compare({ path: 'tests/a.spec.ts', before, after })), []);
});
