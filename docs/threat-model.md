# Threat model

**Last reviewed**: 2026-09-07, against Playwright 1.62.1 and `@playwright/mcp` 0.0.80.
Tool defaults are implementation details: revalidate on every upgrade.

## 1. Scope

| Surface | Status |
|---|---|
| The SUT (Juice Shop) | **out of scope**: vulnerable by design, it is the target |
| The test tooling (local MCP server, workstation, supply chain) | **in scope** |
| The published repository (history, artifacts) | **in scope** |

The expensive mistake is to treat the first while neglecting the second: writing
security tests against the application while an MCP server listens on localhost
with an arbitrary-code-execution tool enabled by default.

## 2. Data flow

```
             ┌───────────────── DEVELOPER WORKSTATION ──────────────────┐
             │                                                          │
developer ───┼──▶ assistant ──▶ MCP server ──▶ browser ──▶ SUT          │
             │       │          (container)                 ▲           │
             │       └──── accessibility tree ◀─────────────┘           │
             │                    │                                     │
             └────────────────────┼─────────────────────────────────────┘
                                  ▼
                        model endpoint (off machine)

  ══════════ GENERATION / EXECUTION BOUNDARY (ADR-0001) ══════════

CI ──▶ npm ci --ignore-scripts ──▶ playwright test ──▶ SUT (ephemeral container)
       no model, no MCP, no provider secret (ADR-0002)
```

**The leak point is the arrow going down**: the accessibility tree leaving the
machine. It is the only place data exits.

## 3. STRIDE, applied to the tooling

| Category | Concrete threat | Mitigation | Residual |
|---|---|---|---|
| **S**poofing | A website drives the local MCP server through DNS rebinding (CVE-2025-9611) | version >= 0.0.40, explicit `--allowed-hosts`, stdio transport preferred | low |
| **T**ampering | A PR edits an agent definition with an invisible-Unicode payload | `invisible-unicode-lint` in CI, mandatory review of `.github/` and `ai/prompts/` | **medium**: the lint detects concealment, not intent |
| **R**epudiation | No way to know which model produced a spec | `Generated-By:` commit trailer | low |
| **I**nformation disclosure | The accessibility tree carries data to an endpoint | synthetic data (ADR-0003), three barriers | **high outside this repository**: barrier 1 disappears on a real application |
| **D**enial of service | A non-converging repair loop burns a budget | no model in CI (ADR-0002) | low |
| **E**levation of privilege | `browser_run_code_unsafe`, RCE-equivalent, **enabled by default** | client-side tool allowlist, non-root read-only container | **medium**: depends on client config, not on the server |

## 4. OWASP Top 10 for LLM applications

| Ref | Risk | Treatment |
|---|---|---|
| **LLM01** Prompt injection | **the main risk**, see section 5 | egress-free network, tool allowlist, fencing, human review |
| **LLM02** Sensitive information disclosure | accessibility tree, console, `storageState` | ADR-0003, section 6 |
| **LLM03** Supply chain | GitHub Actions, npm, container images | SHA pinning, `--ignore-scripts`, digests, SBOM |
| **LLM05** Improper output handling | generated code merged unread | mandatory review plus `healer-diff-gate` |
| **LLM06** Excessive agency | the agent can execute code and navigate anywhere | client-side tool allowlist, internal network |
| **LLM09** Misinformation | **false green**: the agent reports having tested what it did not | mutant catalogue plus `healer-diff-gate` (ADR-0004) |

LLM09 is the properly QA risk, and the one almost nobody discusses. An agent can
produce a success report for tests that no longer verify anything. That is why the
central metric here is not the number of tests but the false-green rate.

## 5. Indirect prompt injection, why it is structural

A browser agent does not see the page: it receives its **accessibility tree
serialised as text**. In that text, **nothing separates page content from system
instructions**. A customer review, a banner, a profile name arrive at the model at
the same level as the operator's task.

Three consequences that get underestimated:

1. **The payload can predate the attack by months.** It is planted by someone who
   was not targeting you, and waits for an agent to walk past.
2. **No lexical filter solves this.** A pattern filter is always one rephrasing
   behind. `ai/policy/sanitize-snapshot.mjs` ships a test that **documents this
   gap** rather than hiding it.
3. **Hosting region changes nothing.** The channel is identical whatever the
   jurisdiction of the endpoint. A European endpoint under a data processing
   agreement receives exactly the same tree, byte for byte. Sovereignty addresses
   a legal risk, not this one.

**What actually holds**, strongest first:

| Barrier | Strength | Where |
|---|---|---|
| Container network `internal: true`, no outbound route | **holds alone** | `sut/docker/compose.yaml` |
| **Client-side** tool allowlist | **holds alone** | `ai/policy/mcp-client-allowlist.json` |
| Fencing and redaction of page content | reduces likelihood | `ai/policy/sanitize-snapshot.mjs` |
| Human review of produced artifacts | reduces impact | ADR-0004 |

`--allowed-origins` and `--blocked-origins` are **absent from that table** on
purpose: upstream states they *"do not serve as a security boundary"* and *"do not
affect redirects"*. Counting them as a mitigation is an analysis error.

## 6. What the agent actually sees

A QA team handles sensitive data without noticing, because it never arrives
looking like a database. It arrives as artifacts.

| Channel | What it really contains | Where it ends up |
|---|---|---|
| Playwright trace | full DOM snapshot per action, request headers, responses | CI artifact, downloadable by anyone if the repository is public |
| `storageState.json` | session tokens, auth cookies | local disk, and the repository if `.gitignore` is wrong |
| Video and screenshots | everything that was on screen | CI artifact |
| Console log | complete API responses in a dev environment | model context, through MCP |
| Accessibility tree | all textual content of the page | model context, on every snapshot |

The last one is the one everyone forgets, because it exists nowhere as a file: it
is transmitted and gone. It is also the one that travels furthest.

## 7. Three verified facts about `@playwright/mcp` 0.0.80

Checked against the published package on 2026-09-07.

**a) `browser_run_code_unsafe` is enabled by default.** It sits in the "Core
automation" category with no capability to enable. Its own description reads:
*"Unsafe: executes arbitrary JavaScript in the Playwright server process and is
RCE-equivalent."* A default MCP installation therefore exposes an
arbitrary-code-execution path.

**b) The server offers no option to exclude an individual tool.** `--caps` only
**adds** capabilities. Surface reduction is the **client's** responsibility, via an
explicit `tools` list. Hardening the server does not remove the tool. This is the
opposite of what most people assume, and the reason
`ai/policy/mcp-client-allowlist.json` is an allowlist rather than a denylist: a
tool added by a future version must arrive disabled.

**c) Origin filters are not a security boundary.** Upstream says so in the
documentation of `--allowed-origins` and `--blocked-origins`, and calls `--secrets`
*"a convenience and not a security feature"*.

Do not confuse the two directions: `--allowed-hosts` protects the server
**inbound** against DNS rebinding (CVE-2025-9611, fixed in 0.0.40);
`--allowed-origins` restricts **outbound** and is not binding.

## 8. Accepted residual risks

Documenting a residual risk does not remove it. These four are accepted:

1. **A rephrased injection payload passes the heuristic filter.** Accepted: the
   network and tool barriers hold independently of the filter.
2. **`healer-diff-gate` does not detect an assertion rewritten onto the wrong
   target.** Accepted: partially covered by the mutant catalogue, whose scope is
   declared.
3. **Mutants do not reach purely client-side defects.** Accepted and published.
4. **Agent definition files are executable code reviewed by humans.** The lint
   catches concealment, not a hostile instruction written in plain ASCII.
