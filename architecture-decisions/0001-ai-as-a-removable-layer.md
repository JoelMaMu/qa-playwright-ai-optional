# ADR-0001: AI is a removable layer, not a dependency

- **Status**: accepted
- **Date**: 2026-09-04

## Context

Two architectures share the name "AI-driven testing".

The first puts a model **inside the execution loop**: while the test runs, an LLM
decides which selector to use, or whether an assertion holds. The test becomes
non-deterministic, its cost variable, its reproducibility dependent on a third
party. Worse, a failure no longer distinguishes an application regression from
model drift. That last point alone disqualifies the approach for a regression
suite.

The second puts the model **before the execution loop**: it helps write the test.
What it produces is ordinary Playwright code, reviewed, versioned, and run without
a model.

Conflating the two is the main reason QA teams in regulated environments reject AI
tooling outright.

## Decision

**Generation modifies source code. Execution verifies it. The two never share a
runtime.**

Concretely:

1. `qa-automation/tests/` contains no import from `ai-engineering/`, no network call to a model provider,
   and no model-related environment variable.
2. Deleting `ai-engineering/` entirely must leave the suite working and produce an identical
   result. Checked by `ai-engineering/assert-no-ai-imports.mjs`.
3. No Playwright configuration branches on the presence of AI tooling.

## Consequences

**Positive.** The suite runs in an environment with no outbound network other than
the SUT. A team that forbids AI can adopt `qa-automation/tests/` as is, with no code to strip.
The `ai-engineering/` layer can move fast, with its own dependencies, without triggering a
revalidation of the suite.

**Negative.** We give up the capabilities that genuinely require a model at
runtime: natural-language element selection, semantic visual assertions, live
self-healing. These are out of scope, not worked around. When a selector breaks, a
human or a local agent repairs it, not CI.

## Verification

```bash
npm run verify:no-ai
rm -rf ai-engineering/ && npm test
```

Both run on every pull request through `.github/workflows/airgap.yml`.
