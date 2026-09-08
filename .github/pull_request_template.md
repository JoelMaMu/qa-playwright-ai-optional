## What this changes

<!-- One sentence. What changes, not how. -->

## Provenance

- [ ] Written by hand
- [ ] AI-assisted, model and exact version: ______

If assisted, the commit carries the trailer `Generated-By: <tool>@<model>@<version>`.

## The ADR-0004 question

> **Would these tests still fail if the original bug came back?**

<!-- Answer explicitly. "Yes" without justification is not an answer. -->

## If this PR touches assertions

- [ ] No assertion removed
- [ ] No assertion weakened (see `qa-automation/tools/healer-diff-gate/README.md`)
- [ ] No `skip` / `fixme` / `expect.soft` added
- [ ] No timeout raised

Otherwise a `healer-gate:allow <CODE> - <reason>` annotation is present in the
code, with a reason of at least 20 characters.

## If this PR touches `.github/` or `ai-engineering/prompts/`

> Those files are **executable code**: loaded and interpreted on every session.

- [ ] `npm run lint:unicode` passes
- [ ] Every content change is explained above
- [ ] No instruction added that widens the agent's scope of action

## Checks

- [ ] `npm run verify:no-ai`
- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm test`
