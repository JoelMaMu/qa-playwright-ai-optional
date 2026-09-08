# QA automation

The deliverable. A Playwright suite against a pinned OWASP Juice Shop, plus the
instrument that measures whether the suite is worth anything.

**Zero AI dependency.** Nothing here imports from `ai-engineering/`, reads a model
provider variable, or branches on an AI posture. Deleting the AI layer leaves this
directory working and produces an identical result, and CI proves it on every pull
request.

```bash
npm run sut:up && npm run sut:seed
npm test                    # Chromium
npm run test:all-browsers   # Chromium, Firefox, WebKit
```

## Contents

| Path | Role |
|---|---|
| [`tests/`](tests/) | the suite: page objects, fixtures, seeded data, specs |
| [`sut/`](sut/) | Juice Shop pinned by digest, deterministic seed, mutant catalogue |
| [`metrics/`](metrics/) | the false-green harness and its committed results |
| [`tools/healer-diff-gate/`](tools/healer-diff-gate/) | rejects patches that silence a test instead of repairing it |

## The engineering decisions worth knowing

**Overlays are suppressed, not clicked away.** The SUT cookie banner and welcome
dialog are dismissed by setting their cookies before the first navigation. Closing
a fading banner is a race between `isVisible()` and `click()`, and it is the first
cause of flake here.

**Waits are on conditions, never on durations.** There is no `waitForTimeout` in
this directory. Adding a product waits for the `BasketItems` response; without it
two consecutive adds race and the basket ends at 1 instead of 2, failing a correct
assertion.

**Isolation comes from splitting the data twice.** One role per spec file, and one
account per browser project. The SUT is a single shared instance: without the
second split, the Chromium and WebKit copies of the basket spec fight over the same
server-side basket and the total assertion reads 3.98 instead of 1.99.

**Page objects hold no assertions.** They expose locators and actions. An assertion
hidden in a page object is invisible in a diff review and escapes the healer gate,
which only analyses `tests/specs`.

**Assertions are as strong as the journey allows.** Exact counts, exact prices,
exact quantities. A `toBeGreaterThan(0)` would let a catalogue collapsing from 15
items to 1 through, and that is exactly what mutant `M-SEARCH-004` does.

## How we know the suite is worth anything

Test count measures nothing, and code coverage measures what was executed rather
than what was verified. The question that matters is: **if the application breaks,
does the suite notice?**

The mutant catalogue injects known defects into HTTP responses and counts the ones
that pass unnoticed. See [`metrics/`](metrics/) for the method, the current rate,
and the two coverage gaps it exposes.
