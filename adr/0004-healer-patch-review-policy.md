# ADR-0004: healer patch review policy

- **Status**: accepted
- **Date**: 2026-09-04

## Context

A test healer runs the suite and repairs failing tests. It is the agent with the
best cost/benefit ratio, and it is also the only one that can **destroy the value
of the suite without anyone noticing**.

The reason is structural. A healer optimises one observable signal: "the test
passes". Two families of edits satisfy it:

- **Repair**: the selector changed, update the selector. The test still checks the
  same thing.
- **Silence**: add `test.skip`, widen `toHaveText('Order #1234 confirmed')` into
  `toBeVisible()`, raise a timeout until a performance regression is hidden, drop
  a "redundant" assertion. The test passes. It verifies nothing.

Nothing in the signal separates the two. An agent doing only the second produces a
fully green, fully useless suite with impeccable commit messages.

A report showing 100 % success on 87 tests, 12 of which are skipped, lies by
omission. **A skip is not a pass.**

This risk is not specific to AI: a developer in a hurry does the same thing on a
Friday evening. What AI changes is throughput. A human weakens three assertions a
quarter; an agent weakens thirty in an afternoon.

## Decision

Every healer patch is treated as **a pull request from a competent but untrusted
external contributor**: reviewed line by line, and subject to an automated check
that can reject it.

### 1. Human review

- No healer patch merges without a line-by-line read.
- The reviewer answers one question, present in the PR template:
  **would this test still fail if the original bug came back?**
- A patch touching both a selector and an assertion is split in two.

### 2. The automated gate

`qa-automation/tools/healer-diff-gate/` fails on a diff restricted to `qa-automation/tests/**/*.spec.ts`:

| Code | Rule |
|---|---|
| `HDG001` | the file's assertion count decreases |
| `HDG002` | an assertion is replaced by a strictly weaker form |
| `HDG003` | `test.skip` / `test.fixme` / `test.fail` added without a waiver |
| `HDG004` | an explicit timeout is added or raised |
| `HDG005` | a spec file is deleted |
| `HDG006` | `expect` becomes `expect.soft` |
| `HDG007` | `test.slow()` is added |

Assertion strength, strongest first, compared within a matcher family:

```
toHaveText(exact) > toContainText > toBeVisible > toBeAttached
toHaveCount(n)    > toBeTruthy    > toBeDefined
```

### 3. The waiver

Weakening is sometimes legitimate: the functional specification really changed.
The waiver is explicit, traced and loud:

```ts
// healer-gate:allow HDG002 - label changed from "Validate" to "Confirm order"
// (JIRA-1234). Assertion rewritten onto the new value, not weakened.
```

The rule code **and** a reason of at least 20 characters are required. A bare
disable does not pass. `--strict` rejects waived violations too, for periodic
audits.

### 4. The false-green measurement

The gate detects **syntactic** weakening. It does not detect a patch that
correctly rewrites an assertion onto the wrong target. That gap is covered by the
mutant catalogue (`qa-automation/sut/mutants/`), and there is a unit test documenting it.

The protocol is before/after: measure the false-green rate, break the SUT, run the
healer, merge, measure again. **If the rate went up, the healer degraded the
suite**, however green the build is.

## Consequences

**Positive.** The healer becomes usable in a regulated environment, because its
most dangerous failure mode is caught mechanically rather than left to a tired
reviewer. The gate protects against the human equivalent too, which makes it
adoptable by a team using no AI at all.

**Negative.** False positives are certain: a legitimate refactor will trip the
gate. The cost is real and accepted; the inverse cost, an undetected false green,
is paid in production. Waivers will become noise without periodic review of their
count, which is why they are counted.

**Neutral.** The analysis is lexical, not semantic. `toHaveText('Total: 12.00')`
and `toHaveText('Total: 21.00')` have exactly the same strength. This is a net
with known mesh size, documented in `qa-automation/tools/healer-diff-gate/SPEC.md`.
