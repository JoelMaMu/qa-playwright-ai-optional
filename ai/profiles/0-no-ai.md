# Profile 0: no AI

**This is what the suite in `tests/` uses.** Every spec here was written by hand,
with `codegen` and the trace viewer.

## Who picks it

Banks, defence, health, industrial systems, and any consultancy under a strict
client policy. Also anyone who wants a measurement baseline before adopting
anything else.

## What you configure

Nothing. Playwright, `npx playwright codegen`, page objects, the trace viewer.

## What leaves the machine

Nothing, at generation and at execution. The egress guard
(`tests/fixtures/egress-guard.ts`) blocks and records any request that is not
going to the system under test, and fails the test on teardown.

## What it costs

Authoring time. That is the honest cost, and it is the number the other three
profiles have to beat.

## What your legal team will ask

Nothing. There is no processing, no transfer, no sub-processor.

## Why this profile is not a fallback

It is the **control group**. "Faster" only means something against a baseline
measured under the same conditions. Without profile 0, any claim about what AI
brought is an assertion, not a result.

On simple forms `codegen` beats a generator, and the review time it saves is real.
That is a result, not a concession.

---

> Egress at execution: none. The suite is identical across all four profiles.
> Deleting `ai/` changes nothing, and CI proves it on every pull request.
