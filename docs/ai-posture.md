# Choosing an AI posture

The question teams usually ask is "are we for or against AI in testing?", which is
a matter of opinion. The engineering question is different:

> **Where does your trust boundary sit, and what are you willing to pay to move it?**

This document answers it. It is a decision aid, not a description of what this
repository implements: **the suite here is written and run without a model**
(profile 0). The other three profiles describe what you configure if you adopt
them, and what it costs you.

## The decision

```
Does your test environment contain real data?
(staging seeded from production, customer records, health data)
│
├── YES ──▶ PROFILE 0, and fix that first.
│           No AI profile is acceptable while an agent can read those records.
│           This is an environment problem, not a tooling problem.
│           See adr/0003-synthetic-data-only.md
│
└── NO
    │
    └── Does your internal policy allow an outbound call to an AI service?
        │
        ├── NO, closed environment (defence, critical infrastructure, air-gapped)
        │   └──▶ PROFILE 3 if you have the GPU budget, otherwise PROFILE 0.
        │        Check the model licence PER VERSION before any use.
        │
        └── YES, under conditions
            │
            └── Do those conditions include EU data residency or an
                enforceable data processing agreement?
                │
                ├── YES ──▶ PROFILE 2, and read the warning below:
                │           sovereignty is not security.
                │
                └── NO ──▶ PROFILE 1. Fastest to set up, widest egress surface.
```

## The comparison

| | **0, no AI** | **1, hosted** | **2, EU sovereign** | **3, local** |
|---|---|---|---|---|
| **Typical fit** | bank, defence, health, industry | product company, scale-up | public sector, EU finance and health | R&D, air-gapped |
| **Stack** | Playwright, codegen, page objects, trace viewer | assistant plus MCP plus hosted endpoint | OpenAI-compatible EU endpoint | Ollama or vLLM plus an Apache 2.0 model |
| **Egress at execution** | **none** | **none** | **none** | **none** |
| **Egress at generation** | none | outside the EU | inside the EU | none |
| **What you gain** | the control baseline | writing speed, a usable healer | speed plus an enforceable DPA | no structural leak |
| **What you pay** | authoring time | your DOM leaves the organisation | your DOM leaves anyway | weaker output, GPU budget |
| **What will block you** | nothing | the security team | nothing, if the model inventory is kept | the model licence |

**The "egress at execution" row is identical in all four columns.** That is the
whole point, and it is enforced rather than claimed: see
[ADR-0001](../adr/0001-ai-as-a-removable-layer.md).

Operational detail for each profile: [`ai/profiles/`](../ai/profiles/).

## Three corrections that save expensive mistakes

### Profile 0 is not a degraded mode

It is the **control group**. Without it you cannot prove that AI brought
anything, you can only assert it. On simple forms, `codegen` beats a generator.
That is a result, not a concession.

### Sovereignty is not security

A European endpoint under an article 28 processing agreement receives **exactly
the same accessibility tree** as an American one. Byte for byte.

Sovereignty addresses a **legal** risk (lawful basis for transfer,
sub-processing, jurisdiction) and a **dependency** risk (reversibility). It does
not address:

- exfiltration through indirect prompt injection, the channel is identical;
- secrets present in the transmitted DOM;
- compromise of the local MCP server.

Presenting profile 2 as "the secure one" is the most common error on this
subject, and the one that turns around fastest in a meeting.

### The profile 3 licence trap

**"Open model" does not mean "usable in a company".** What your legal team will
look at is the right to **commercial use of the produced code**:

- **Apache 2.0 or MIT**: usable, no ambiguity.
- **"non-production" or "research only"**: forbidden as soon as generated code
  enters a product.

Two traps: the licence **changes between versions under the same commercial
name**, and one vendor often publishes under both regimes depending on the model
family. Knowing a vendor's general policy tells you **nothing** about the licence
of the weights you downloaded.

Rule: check the licence **per version**, **on the model card**, **at download
time**, and record the date.

## What does not depend on the profile

Whichever one you pick, these four stay identical:

1. **CI never calls a model** ([ADR-0002](../adr/0002-no-llm-in-ci.md)).
2. **Every generated artifact goes through human review**, like a pull request
   from an external contributor.
3. **Healer patches pass the gate**
   ([ADR-0004](../adr/0004-healer-patch-review-policy.md)), because a skip is not
   a pass.
4. **Agent configuration files are code**: versioned, reviewed, linted.

If your organisation cannot hold these four, choosing a profile is premature.
