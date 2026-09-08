# Profile 3: local model

An open-weights model running on your own hardware, through an OpenAI-compatible
local endpoint such as Ollama, vLLM or llama.cpp.

> **Status in this repository**: documented posture. The MCP hardening in
> `ai/policy/` and the prompts in `ai/prompts/` apply to it, but no spec in
> `tests/` was generated this way and no benchmark has been run.

## Who picks it

Air-gapped environments, defence, critical infrastructure, R&D. Anyone whose
policy forbids any outbound call to an AI service.

## What you configure

The same MCP hardening as profiles 1 and 2, pointed at a loopback endpoint. No
API key exists.

## What leaves the machine

Nothing. This is the only profile where "no data leaves" is **structural** rather
than contractual.

## What it costs

Output quality is noticeably weaker than a frontier hosted model, especially on
the healer. And it costs hardware: a GPU someone has to fund and maintain.

## The trap: licensing

**"Open model" does not mean "usable in a company".** The distinction your legal
team will draw is about the right to **commercial use of the produced code**:

- **Apache 2.0 or MIT**: allowed, no ambiguity.
- **"non-production" or "research only"**: forbidden as soon as generated code
  enters a product. Several popular code models sit here, including from vendors
  who also publish under Apache 2.0.

Two traps. The licence **changes between versions under the same commercial name**,
and one vendor often ships both regimes depending on the model family. Knowing a
vendor's general policy tells you nothing about the weights you downloaded.

**Rule**: verify the licence **per version**, **on the model card**, **at download
time**, and record the date. A model whose licence has not been verified does not
go into use.

---

> Egress at execution: none. The suite is identical across all four profiles.
> Deleting `ai/` changes nothing, and CI proves it on every pull request.
