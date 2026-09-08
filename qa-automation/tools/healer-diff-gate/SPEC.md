# healer-diff-gate: design notes

## The problem

A test suite can be entirely green and entirely useless.

A healer optimises one observable signal: "the test passes". Two families of edits
satisfy it:

- **Repair**: the selector changed, update the selector. The test still verifies
  the same thing.
- **Silence**: add `test.skip`, widen `toHaveText('Order #1234 confirmed')` into
  `toBeVisible()`, raise a timeout until a regression is masked, drop a
  "redundant" assertion. The test passes. It verifies nothing.

Nothing in the signal separates them. An agent doing only the second produces a
100 % green, 100 % useless suite with impeccable commit messages.

## Principle

Treat every healer patch as **a pull request from a competent but untrusted
external contributor**: read in full, and subject to an automatic check that can
reject it.

## Pipeline

```
git diff --name-only base...HEAD
        │
        ▼
filter tests/**/*.spec.ts
        │
        ▼
git show base:path   and   git show HEAD:path
        │
        ▼
strip comments, then extract facts per version
  assertion count, matchers in order, skips, soft, slow, max timeout
        │
        ▼
apply HDG001..HDG007
        │
        ▼
read healer-gate:allow waivers
        │
        ▼
text and JSON report ──▶ exit code
```

## Why lexical rather than AST

The first draft of this tool specified a TypeScript AST parser. It was rewritten
against comment-stripped source, on purpose.

An AST comparison is more precise on paper, but the precision buys little here.
The facts the rules need, how many assertions, which matchers, in which order, are
recoverable lexically once comments are removed, and the failure mode is milder: a
lexical pass that misses a case is a gate that lets one patch through, while a
parser that chokes on a syntax it does not model is a gate that blocks everything
and gets disabled within a week.

**A gate the team disables is worse than no gate.** That is the trade-off, taken
knowingly. If false negatives ever become the binding constraint, moving to the
TypeScript compiler API is a contained change: only `lib/analyse.mjs` is affected,
and the 19 unit tests define the expected behaviour.

## HDG002, matching strategy

Matchers are grouped by family (`text`, `value`, `count`, `url`, `attribute`) and
compared by position within a family: the nth `text` assertion before against the
nth `text` assertion after.

The consequence is deliberate. Reordering assertions inside a file can produce a
spurious report, and inserting a new strong assertion ahead of an existing one
shifts the comparison. This is why HDG002 findings are worth reading rather than
worth trusting blindly, and why the waiver exists.

## Known limits

- **Same matcher, wrong target** is invisible. `toHaveText('Total: 12.00')` and
  `toHaveText('Total: 21.00')` have identical strength. Covered by the mutant
  catalogue, and there is a unit test named after this gap.
- **No business semantics.** The gate does not know what the application should do.
- **Renamed files** are seen as a deletion plus a new file, so a rename triggers
  `HDG005`. Splitting a rename from a content change into two commits avoids it.
- **It does not replace review.** It concentrates attention on the diffs that
  deserve it.

## Interface

```bash
healer-diff-gate --base origin/main [--json report.json] [--strict]
```

| Option | Effect |
|---|---|
| `--base` | comparison ref, default `origin/main` |
| `--json` | machine-readable report |
| `--strict` | also rejects waived violations |

Exit codes: `0` conformant, `1` violation, `2` analysis error.
