# ADR-0002: no LLM call in CI

- **Status**: accepted
- **Date**: 2026-09-04

## Context

Calling a model from a GitHub Actions job is trivial. It also creates five
distinct problems at once:

1. **Non-determinism.** Two runs of the same commit can diverge. CI stops being an
   oracle.
2. **Availability coupling.** A provider outage becomes a delivery outage.
3. **Unbounded cost.** A repair loop that does not converge burns tokens until the
   job times out.
4. **Exfiltration surface.** A runner holds the repository secrets, a
   `GITHUB_TOKEN`, and on a self-hosted runner access to the internal network.
5. **False green.** An agent able to modify code during the run can turn a build
   green without fixing anything (ADR-0004).

Point 4 is not theoretical. The March 2026 Trivy supply-chain incident
(CVE-2026-33634, CVSS v4 9.4) showed an attacker with execution inside a runner
pulling tokens straight out of the `Runner.Worker` process memory, including
short-lived OIDC tokens. A runner is a high-value environment. You do not add an
interpreter of instructions fetched from the web to it.

## Decision

**No workflow in this repository calls a model provider or starts an MCP server.**

Workflows install a pinned Playwright version, install browsers, and run specs
that are already committed. No provider secret exists in the repository settings.

`airgap.yml` goes further than not calling: it runs the suite under a dedicated
user whose outbound traffic is rejected everywhere except the loopback and the
Docker network, logs any attempt, and fails if one is logged.

## Consequences

**Positive.** CI is an oracle again: same commit, same result. No provider secret
exists, so none can leak. The repository is adoptable by a team whose policy
forbids outbound calls to an AI service, without modification.

**Negative.** No self-healing in CI. A test broken by a UI change stays red until a
human runs the healer locally and opens a pull request. That delay is a real cost,
accepted: the delay is visible, a false green is not.

## Verification

`scripts/assert-no-ai-imports.mjs` fails if a workflow file references a provider
endpoint, a provider secret, or an MCP server image.
