# False-green measurement

## The problem

A test suite can be entirely green and entirely useless. Nothing in a Playwright
report separates "87 tests pass because the application works" from "87 tests pass
because they no longer check anything".

Test count measures nothing. Code coverage measures what was *executed*, not what
was *verified*: a suite with no assertions at all reaches 100 % coverage. The only
honest question is: **if I break the application, does the suite notice?**

## Method

A mutant is a deliberately injected defect. Run the suite with one active:

- suite **red**, the mutant is detected, the suite is doing its job;
- suite **green**, that is a **false green**, and a real coverage gap.

```
false-green rate = undetected mutants / total mutants
```

Mutants are injected into the HTTP response through Playwright routing rather than
by rebuilding the SUT, which is pinned by digest. The trade-off is declared: this
reaches business rules and data integrity, never a purely client-side defect.

```bash
npm run sut:up && npm run sut:seed
npm run metrics:mutants                             # whole catalogue
node metrics/harness/run-mutants.mjs M-PRICE-001    # one mutant
```

The harness refuses to measure if the suite is already red without a mutant:
without a green baseline, a detected mutant is indistinguishable from a broken
suite.

## Catalogue

| id | Category | Injected defect |
|---|---|---|
| `M-PRICE-001` | corrupt data | unit price lowered by 1.00 |
| `M-BASKET-002` | business rule | quantity capped at 1 |
| `M-TOTAL-003` | business rule | total ignores the last item |
| `M-SEARCH-004` | corrupt data | search truncated to the first result |
| `M-SESSION-005` | access control | 200 instead of 401 without a token |
| `M-LATENCY-006` | performance | 4 s added on the catalogue |

Each mutant declares its `expectedDetector`, the assertion meant to catch it. A
mutant without one is a **known** gap, which is better than an ignored one.

## Results

Current measurement is committed in
[`results/false-green.json`](results/false-green.json). It is versioned on purpose:
it is a measurement, not a run artifact, and its history is the history of the
suite's health.

Two mutants are undetected, and both correspond to tests that do not exist yet:
`M-SESSION-005` (no spec asserts API-side access control) and `M-LATENCY-006` (the
suite has no time budget). Published as is: writing those two tests is what will
bring the rate down.

## A note on the instrument

An early run reported a higher rate because one mutant was **inert**: it mutated
the basket write response while the display reads the read response. It changed
nothing on screen and accused the suite of a gap that did not exist.

A broken measuring instrument is worse than no measurement. Hence the rule: every
undetected mutant is verified by hand before being published as a coverage gap,
and `M-BASKET-002` now mutates `/rest/basket/:id` rather than `/api/BasketItems`.

## Scope

A 0 % false-green rate means "no mutant in this catalogue escapes the suite", not
"the suite is perfect". Publishing that limit is part of the deliverable.
