# Integration profiles

One file per AI posture. Each describes what you configure, what leaves the
machine, what it costs, and what your legal team will ask.

Pick yours with [`docs/ai-posture.md`](../../docs/ai-posture.md).

| Profile | Egress at generation | Ships in this repository |
|---|---|---|
| [0, no AI](0-no-ai.md) | none | **yes, this is what the suite uses** |
| [1, hosted model](1-hosted-model.md) | outside the EU | configuration and policy only |
| [2, EU sovereign model](2-eu-sovereign-model.md) | inside the EU | configuration and policy only |
| [3, local model](3-local-model.md) | none | configuration and policy only |

**Read that last column carefully.** Every spec in `tests/` was written under
profile 0. Profiles 1 to 3 are documented postures with a hardened MCP policy and
reviewed prompts, not measured results. No comparative benchmark has been run, and
none is claimed.

Every profile ends on the same line, because it is the point of the repository:

> Egress at execution: none. The suite is identical. Deleting `ai/` changes
> nothing, and CI proves it on every pull request.
