# Profile 1: hosted model

A commercial model behind an API, hosted outside the EU. The fastest to set up and
the widest egress surface.

> **Status in this repository**: documented posture. The MCP hardening in
> `ai-engineering/policy/` and the prompts in `ai-engineering/prompts/` apply to it, but no spec in
> `qa-automation/tests/` was generated this way and no benchmark has been run.

## Who picks it

Product companies and scale-ups whose internal policy allows an outbound call to
an AI service, and whose test environment holds no real data.

## What you configure

An assistant in agent mode, plus a Playwright MCP server on the developer
workstation, containerised and hardened:

- tool allowlist on the **client** side, `ai-engineering/policy/mcp-client-allowlist.json`;
- container on the `internal: true` network, no outbound route;
- prompts from `ai-engineering/prompts/`, versioned and reviewed like code.

## What leaves the machine

**The accessibility tree of your application**, at generation time only. That is
not your source code, it is the data displayed on screen, which is often more
sensitive than the code.

Console messages leave too, which is why `--console-level=error` is set.

## What it costs

Writing speed is the gain, and a usable healer is the real one. The cost is the
egress above, plus the review time that demos never mention: a spec generated in
30 seconds that takes 20 minutes to review has saved nothing.

## What your legal team will ask

Vendor, exact model version (never a moving `latest` alias), hosting region,
retention period, and whether the vendor contractually commits not to train on
your data. Record the answers with the date you verified them. A stale retention
field is worse than a missing one: it gives the security team false assurance.

## The risk to name out loud

Indirect prompt injection (OWASP LLM01). Nothing in the transmitted text separates
page content from system instructions. See
[`ai-engineering/threat-model.md`](../../ai-engineering/threat-model.md), section 5.

---

> Egress at execution: none. The suite is identical across all four profiles.
> Deleting `ai-engineering/` changes nothing, and CI proves it on every pull request.
