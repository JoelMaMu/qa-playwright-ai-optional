/**
 * Static analysis of a spec file, used to compare a file before and after a patch.
 *
 * A healer optimises one observable signal: "the test passes". Two families of
 * edits satisfy it. Repairing keeps the test checking the same thing; silencing
 * (skip, weakened matcher, inflated timeout, soft assertion) makes it check
 * nothing. Nothing in the signal separates the two. This module extracts the
 * facts that do.
 */

/**
 * Assertion strength, strongest first. Any move down this list is a weakening.
 * Rank is per family: comparing toHaveText with toHaveCount is meaningless, so
 * families are compared only against themselves.
 */
const STRENGTH = {
  text: ['toHaveText', 'toContainText', 'toBeVisible', 'toBeAttached'],
  value: ['toHaveValue', 'not.toBeEmpty'],
  count: ['toHaveCount', 'toBeTruthy', 'toBeDefined'],
  url: ['toHaveURL'],
  attribute: ['toHaveAttribute'],
};

const FAMILY_OF = new Map();
for (const [family, matchers] of Object.entries(STRENGTH)) {
  matchers.forEach((matcher, rank) => FAMILY_OF.set(matcher, { family, rank }));
}

const SKIP_MODIFIERS = /\btest\.(skip|fixme|fail)\b/g;
const SOFT_ASSERTIONS = /\bexpect\.soft\s*\(/g;
const SLOW_MODIFIER = /\btest\.slow\s*\(/g;
/** `timeout: 30_000`, `{ timeout: 30000 }`, `test.setTimeout(60000)`. */
const TIMEOUTS = /\b(?:timeout\s*:\s*|setTimeout\s*\(\s*)([\d_]+)/g;
/** `expect(...)` and `await expect.poll(...)`, but not `expect.soft`. */
const ASSERTIONS = /\bexpect(?:\.poll)?\s*\(/g;

/**
 * Waiver comment: `// healer-gate:allow HDG002 - reason of at least 20 chars`.
 * The rule code and a real reason are both required; a bare disable does not pass.
 */
const WAIVER = /healer-gate:allow\s+(HDG\d{3})\s*[-:—]?\s*(.+)/g;

const MIN_REASON_LENGTH = 20;

function countMatches(source, pattern) {
  return (source.match(pattern) ?? []).length;
}

/** Matchers used, in order of appearance, ignoring comments and string literals. */
function matchersOf(source) {
  const found = [];
  const pattern = /\.(?:not\.)?(toHave[A-Za-z]+|toContainText|toBe[A-Za-z]+)\s*\(/g;
  let match;
  while ((match = pattern.exec(source)) !== null) found.push(match[1]);
  return found;
}

/** Strips line and block comments so a commented-out assertion is not counted. */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function collectWaivers(source) {
  const waivers = [];
  let match;
  WAIVER.lastIndex = 0;
  while ((match = WAIVER.exec(source)) !== null) {
    const [, code, rawReason] = match;
    const reason = rawReason.trim();
    waivers.push({ code, reason, valid: reason.length >= MIN_REASON_LENGTH });
  }
  return waivers;
}

export function analyse(source) {
  const code = stripComments(source);
  const timeouts = [...code.matchAll(TIMEOUTS)].map((m) => Number(m[1].replace(/_/g, '')));

  return {
    assertions: countMatches(code, ASSERTIONS),
    matchers: matchersOf(code),
    skips: countMatches(code, SKIP_MODIFIERS),
    soft: countMatches(code, SOFT_ASSERTIONS),
    slow: countMatches(code, SLOW_MODIFIER),
    maxTimeout: timeouts.length ? Math.max(...timeouts) : 0,
    waivers: collectWaivers(source),
  };
}

/**
 * Compares two matcher lists and reports weakenings.
 *
 * Position-based within a family: the nth `text` assertion before is compared to
 * the nth `text` assertion after. This is deliberately simple, and it is why
 * HDG002 reports are advisory rather than absolute, see SPEC.md.
 */
function weakenings(before, after) {
  const byFamily = (matchers) => {
    const groups = new Map();
    for (const matcher of matchers) {
      const info = FAMILY_OF.get(matcher);
      if (!info) continue;
      if (!groups.has(info.family)) groups.set(info.family, []);
      groups.get(info.family).push(info);
    }
    return groups;
  };

  const groupsBefore = byFamily(before);
  const groupsAfter = byFamily(after);
  const found = [];

  for (const [family, listBefore] of groupsBefore) {
    const listAfter = groupsAfter.get(family) ?? [];
    const shared = Math.min(listBefore.length, listAfter.length);
    for (let i = 0; i < shared; i += 1) {
      const from = listBefore[i];
      const to = listAfter[i];
      if (to.rank > from.rank) {
        found.push({
          family,
          from: STRENGTH[family][from.rank],
          to: STRENGTH[family][to.rank],
        });
      }
    }
  }
  return found;
}

export const RULES = {
  HDG001: 'the number of assertions in the file decreased',
  HDG002: 'an assertion was replaced by a weaker form',
  HDG003: 'test.skip / test.fixme / test.fail was added',
  HDG004: 'an explicit timeout was added or raised',
  HDG005: 'a spec file was deleted',
  HDG006: 'expect was turned into expect.soft',
  HDG007: 'test.slow() was added',
};

/**
 * @param {{path: string, before: string|null, after: string|null}} file
 * @param {{strict?: boolean}} options `strict` also rejects waived violations.
 * @returns {{code: string, file: string, detail: string, waived: boolean}[]}
 */
export function compare(file, options = {}) {
  const { path, before, after } = file;
  const violations = [];
  const push = (code, detail) => violations.push({ code, file: path, detail, waived: false });

  if (before !== null && after === null) {
    push('HDG005', 'spec file deleted');
    return applyWaivers(violations, before, options);
  }
  if (after === null) return [];

  const now = analyse(after);

  if (before !== null) {
    const then = analyse(before);

    if (now.assertions < then.assertions) {
      push('HDG001', `${then.assertions} assertions before, ${now.assertions} after`);
    }
    for (const w of weakenings(then.matchers, now.matchers)) {
      push('HDG002', `${w.from} -> ${w.to} (${w.family})`);
    }
    if (now.skips > then.skips) {
      push('HDG003', `${now.skips - then.skips} skip/fixme/fail added`);
    }
    if (now.maxTimeout > then.maxTimeout) {
      push('HDG004', `longest timeout raised from ${then.maxTimeout} to ${now.maxTimeout}`);
    }
    if (now.soft > then.soft) {
      push('HDG006', `${now.soft - then.soft} expect.soft added`);
    }
    if (now.slow > then.slow) {
      push('HDG007', `${now.slow - then.slow} test.slow() added`);
    }
  } else {
    // New file: nothing to compare against, but a spec born skipped or soft is
    // still a spec that verifies nothing.
    if (now.skips > 0) push('HDG003', `new file already contains ${now.skips} skip/fixme/fail`);
    if (now.soft > 0) push('HDG006', `new file already contains ${now.soft} expect.soft`);
  }

  return applyWaivers(violations, after, options);
}

function applyWaivers(violations, source, options) {
  const waivers = collectWaivers(source);
  return violations.map((violation) => {
    const waiver = waivers.find((w) => w.code === violation.code && w.valid);
    if (!waiver || options.strict) return violation;
    return { ...violation, waived: true, reason: waiver.reason };
  });
}
