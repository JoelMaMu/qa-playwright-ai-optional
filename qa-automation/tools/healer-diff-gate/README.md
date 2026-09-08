# healer-diff-gate

Rejects patches that turn a build green **without repairing anything**.

## In one sentence

A healer optimises "the test passes". It can get there by repairing the test, or
by silencing it. **Nothing in the signal separates the two.** This gate does.

## Usage

```bash
node bin/cli.mjs --base origin/main [--json report.json] [--strict]
npm run gate:healer
```

Exit codes: `0` clean, `1` violations, `2` analysis error.
`--strict` also rejects waived violations, for periodic audits.

## Rules

Applied to the diff restricted to `qa-automation/tests/**/*.spec.ts`.

| Code | Rule |
|---|---|
| `HDG001` | the file's assertion count decreases |
| `HDG002` | an assertion becomes strictly weaker |
| `HDG003` | `test.skip` / `test.fixme` / `test.fail` added without a waiver |
| `HDG004` | an explicit timeout added or raised |
| `HDG005` | a spec file deleted |
| `HDG006` | `expect` turned into `expect.soft` |
| `HDG007` | `test.slow()` added |

Assertion strength, strongest first, compared **within a matcher family** so that
`toHaveText` is never compared against `toHaveCount`:

```
toHaveText(exact) > toContainText > toBeVisible > toBeAttached
toHaveValue       > not.toBeEmpty
toHaveCount(n)    > toBeTruthy    > toBeDefined
```

## The waiver

Weakening is sometimes legitimate: the specification really changed. The waiver is
explicit, traced and loud.

```ts
// healer-gate:allow HDG002 - label changed from "Validate" to "Confirm order"
// (JIRA-1234). Assertion rewritten onto the new value, not weakened.
await expect(page.getByRole('button')).toHaveText('Confirm order');
```

The rule code **and** a reason of at least 20 characters are required. A bare
`// eslint-disable` does not pass, and a waiver for `HDG002` does not cover an
`HDG003` violation.

## What it does not do

This section matters most. A tool whose limits are unknown gets used beyond what
it guarantees.

- It detects **syntactic** weakening. A patch that correctly rewrites an assertion
  onto **the wrong target** passes. `toHaveText('Total: 12.00')` and
  `toHaveText('Total: 21.00')` have exactly the same strength. That gap is covered
  by [`qa-automation/sut/mutants/`](../../sut/mutants/), not by this gate, and there is a unit
  test documenting it.
- The analysis is lexical, over comment-stripped source, not a full TypeScript AST.
  It is deliberately simple so that it produces few false positives: a gate the
  team disables is worse than no gate.
- It does not replace human review. It makes review possible, by focusing
  attention on the diffs that deserve it.

A net with known mesh size. The mesh size is documented in [SPEC.md](SPEC.md).

## Who it is for, even without AI

A developer in a hurry weakens an assertion on a Friday evening exactly like an
agent does. AI does not create this risk, it multiplies its throughput. The gate is
adoptable by a team using no model at all.

The decision behind it is
[ADR-0004](../../../architecture-decisions/0004-healer-patch-review-policy.md).
