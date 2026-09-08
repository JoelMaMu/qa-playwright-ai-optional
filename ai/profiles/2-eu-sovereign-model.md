# Profile 2: EU sovereign model

An OpenAI-compatible endpoint hosted in the EU, under an enforceable data
processing agreement.

> **Status in this repository**: documented posture. The MCP hardening in
> `ai/policy/` and the prompts in `ai/prompts/` apply to it, but no spec in
> `tests/` was generated this way and no benchmark has been run.

## Who picks it

Public sector, health, EU finance. Anyone whose policy allows an outbound call
only under data residency and an article 28 agreement.

## What you configure

Exactly the same as profile 1, with a European endpoint. The client tool
allowlist, the egress-free container network and the prompts do not change.

## What leaves the machine

**The same accessibility tree as profile 1.** Byte for byte. Only the destination
jurisdiction changes.

## What it costs

The same as profile 1 in engineering terms, plus procurement time and usually a
higher price. What you buy is legal defensibility, not a smaller surface.

## The correction that matters most

**Sovereignty is not security.**

It addresses a **legal** risk (lawful basis for transfer, sub-processing,
competent jurisdiction) and a **dependency** risk (reversibility, continuity). It
does not address:

- exfiltration through indirect prompt injection, the channel is identical;
- secrets present in the transmitted DOM;
- compromise of the local MCP server.

Presenting this profile as "the secure one" is the most common error on the
subject, and the one that turns around fastest in a meeting. It is the
**compliant** one.

## What your legal team will ask

The same as profile 1, plus the clause of the processing agreement you are relying
on, with its URL, and the list of sub-processors.

---

> Egress at execution: none. The suite is identical across all four profiles.
> Deleting `ai/` changes nothing, and CI proves it on every pull request.
