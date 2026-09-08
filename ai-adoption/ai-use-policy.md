# AI use policy for a test team

> One page, MIT licensed. Written to be copied into an internal wiki with minimal
> editing. Pick your profile first: [`ai-posture.md`](README.md).

## 1. The principle

**Generation modifies source code. Execution verifies it. The two never share a
runtime.**

Everything below follows from that sentence.

## 2. Allowed

- Using an assistant to **draft** a test plan, a spec, a page object.
- Using a healer to **propose** a repair.
- Using an agent to **explore** an application and describe its journeys.

## 3. Not allowed

- Calling a model **during** test execution, for any reason.
- Calling a model **from CI**, in any workflow.
- Merging a generated artifact **without a line-by-line human read**.
- Pointing an agent at an environment holding **real data**.
- Pointing an agent at a **third-party system your organisation does not own**.

## 4. The review rule

Every generated artifact enters through a pull request, reviewed **as if it came
from a competent but untrusted external contributor**.

The reviewer answers one question, present in the PR template:

> **Would this test still fail if the original bug came back?**

If the answer is no, the patch is rejected, even when CI is green. **Especially**
when CI is green.

## 5. False green

A patch that turns a build green by weakening an assertion, adding a skip or
inflating a timeout is **worse than the failure it fixes**, because the failure
was visible and the false green is not.

A report showing 100 percent success on 87 tests, 12 of which are skipped, lies by
omission. **A skip is not a pass.**

This check is automated (`qa-automation/tools/healer-diff-gate/`) rather than left to a tired
reviewer on a Friday evening.

## 6. Data

- Test data is **synthetic and seeded**. Never a production copy, including an
  "anonymised" one: pseudonymised extracts get re-identified.
- Secrets never transit through the model context. Protection is three barriers in
  this order: **the secret does not exist** > **it is outside the agent's reach** >
  **it is redacted**. Never rely on the third alone: redaction mechanisms are
  described by their own vendors as a convenience, not a security feature.
- Traces, videos and screenshots ship as CI artifacts and embed full DOM
  snapshots. Short retention, and never on a public repository without review.

## 7. Tooling

- MCP server in a **container**: non-root, read-only filesystem, `cap_drop: ALL`,
  minimal mounts, **no outbound network route**.
- **Client-side tool allowlist, never a denylist**: a tool added by a future
  version must arrive disabled.
- **Pinned versions**, never `latest`, for packages, images and CI actions.
- Re-check **what is enabled by default** on every upgrade. Default tool sets
  change, and an arbitrary-code-execution tool can be among them.

## 8. Agent configuration files are code

`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `*.prompt.md`, system prompts: loaded
and interpreted on every session, on every workstation. Therefore:

- **versioned** and **reviewed in pull requests** like code;
- **linted for invisible Unicode**, because a hidden instruction is invisible in a
  diff, invisible in an editor, and perfectly readable by the model;
- **regenerated** on every tooling upgrade.

## 9. Transparency

Every commit produced with assistance carries an attribution trailer:

```
Generated-By: <tool>@<model>@<version>
```

The organisation keeps an inventory of the models actually used: vendor, exact
version, region, retention, training commitment, licence, and a verification date.
A stale retention field is worse than a missing one, because it gives the security
team false assurance.

## 10. Reviewing this policy

Every six months, or on any major tooling change. The internal version carries the
date of its last review.
