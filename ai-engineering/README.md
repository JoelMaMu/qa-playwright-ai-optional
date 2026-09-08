# `ai-engineering/`, the removable layer

**Delete this directory and the test suite keeps working, identically.**

That is the whole claim, and it is checked mechanically:

```bash
npm run verify:no-ai     # fails if tests/ references ai/ or a model provider
rm -rf ai-engineering/ && npm test   # must produce the same result
```

`.github/workflows/airgap.yml` runs both on every pull request.

## Why the boundary

Generation modifies source code. Execution verifies it. The two never share a
runtime ([ADR-0001](../adr/0001-ai-as-a-removable-layer.md)).

A model in the execution loop makes a test non-deterministic, its cost variable,
its reproducibility dependent on a third party. Above all, a failure no longer
distinguishes an application regression from model drift. That last point
disqualifies the approach for a regression suite.

## Contents

| Path | Role |
|---|---|
| `profiles/` | one file per AI posture: what you configure, what leaves the machine, what it costs |
| `policy/mcp-client-allowlist.json` | client-side MCP tool allowlist |
| `policy/mcp-compose.yaml` | hardened MCP server, workstation only |
| `policy/sanitize-snapshot.mjs` | redaction and fencing of page content, with its limits under test |
| `prompts/` | system prompts, versioned and reviewed like code |

There are no model adapters here, and no provider SDK. This layer hardens an
assistant working on the repository and documents the postures; it does not embed
a client for anyone.

**The posture lives here and in `docs/`, never in `qa-automation/tests/`.** A directory per mode
would mean either four suites to keep in sync or three empty folders, and it would
make the central claim false: the suite cannot be identical across postures if the
filesystem says there are four of them.

## Three things to know first

**1. `browser_run_code_unsafe` is enabled by default.** It ships in the base tool
set of `@playwright/mcp` 0.0.80, under "Core automation", with no capability to
enable, and its description says "RCE-equivalent". The server offers **no option to
exclude an individual tool**: surface reduction happens **client-side**, through
`policy/mcp-client-allowlist.json`.

**2. Origin filters are not a security boundary.** Upstream states it plainly for
`--allowed-origins` and `--blocked-origins`: *"does not serve as a security
boundary and does not affect redirects"*. The real barrier is the `internal: true`
container network.

**3. `--secrets` is, in upstream's words, "a convenience and not a security
feature".** It is barrier 3 of [ADR-0003](../adr/0003-synthetic-data-only.md),
never barrier 1. Barrier 1 is that the secret does not exist.

Details and sources: [`ai-engineering/threat-model.md`](threat-model.md).

## Review rule

Prompts and MCP configuration are **executable code**: they are loaded and
interpreted on every session, on every workstation. They are versioned, reviewed in
pull requests, and linted for invisible characters (`npm run lint:unicode`).
