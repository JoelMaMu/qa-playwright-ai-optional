# qa-playwright-ai-optional

[![ci](https://github.com/JoelMaMu/qa-playwright-ai-optional/actions/workflows/ci.yml/badge.svg)](https://github.com/JoelMaMu/qa-playwright-ai-optional/actions/workflows/ci.yml)
[![airgap proof](https://github.com/JoelMaMu/qa-playwright-ai-optional/actions/workflows/airgap.yml/badge.svg)](https://github.com/JoelMaMu/qa-playwright-ai-optional/actions/workflows/airgap.yml)
[![supply chain](https://github.com/JoelMaMu/qa-playwright-ai-optional/actions/workflows/supply-chain.yml/badge.svg)](https://github.com/JoelMaMu/qa-playwright-ai-optional/actions/workflows/supply-chain.yml)

A Playwright end-to-end suite where **AI is a source-time tool, never a runtime
dependency**, and where that boundary is enforced by CI rather than claimed in a
README.

The middle badge is the one that matters: it runs the suite under a user whose
outbound traffic is rejected by iptables, and fails if a single connection is
attempted.

```bash
npm run verify:no-ai                  # fails if the suite references the AI layer
rm -rf ai-engineering/ && npm test    # identical result
```

## Three layers

The repository is organised the way the decision actually gets made in a company.

| Layer | Question it answers | Audience |
|---|---|---|
| [`ai-adoption/`](ai-adoption/) | Which AI posture, at what cost, and what will legal ask? | CTO, security team, QA lead |
| [`ai-engineering/`](ai-engineering/) | How do we make an assistant safe and useful on this codebase? | whoever integrates the tooling |
| [`qa-automation/`](qa-automation/) | Does the suite actually catch anything? | QA engineers, tech leads |

**Looking for the code?** It is in
[`qa-automation/tests/`](qa-automation/tests/), and it runs on Chromium, Firefox
and WebKit.

## Why this exists

Most "Playwright + AI" demos show an agent writing a test. The question teams
actually face is different, and it is usually asked in the wrong order:

> **Where does your trust boundary sit, and what are you willing to pay to move
> it?**

Four postures answer it, from no AI at all to a local model on your own hardware.
Pick yours with [`ai-adoption/`](ai-adoption/), then read the operational detail in
[`ai-adoption/profiles/`](ai-adoption/profiles/).

**The suite here was written under profile 0, without a model.** The other three
are documented postures with a hardened MCP policy, not measured results. No
comparative benchmark has been run, and none is claimed.

That separation is possible because of one invariant:

> Generation modifies source code. Execution verifies it.
> The two never share a runtime.

Consequences, enforced rather than stated:

| Rule | Enforced by |
|---|---|
| CI never calls a model, never starts an MCP server | `ai-engineering/assert-no-ai-imports.mjs`, on every PR |
| Nothing leaves the SUT during a run | the egress guard, plus iptables in `airgap.yml` |
| Generated patches cannot silently weaken the suite | `qa-automation/tools/healer-diff-gate/` |
| Test data is synthetic and seeded | `qa-automation/sut/seed/`, ADR-0003 |

## The measurement that matters

Not the number of tests. The **false-green rate**: inject known defects into the
system under test, run the suite, and count the ones that go unnoticed.

Neither test count nor code coverage answers this. A suite with no assertions at
all reaches 100 % coverage.

```bash
npm run metrics:mutants
```

Results and the two coverage gaps they expose:
[`qa-automation/metrics/`](qa-automation/metrics/).

## Two tools

| Tool | What it does |
|---|---|
| [`healer-diff-gate`](qa-automation/tools/healer-diff-gate/) | rejects patches that turn a build green without repairing it: removed or weakened assertion, unapproved skip, inflated timeout |
| [`invisible-unicode-lint`](ai-engineering/tools/invisible-unicode-lint/) | finds instructions hidden in invisible Unicode inside the files your assistant reads and interprets |

The second addresses a real and rarely checked vector. `AGENTS.md`, `CLAUDE.md`,
`.cursorrules` and `*.prompt.md` are **executable code**, loaded every session. A
zero-width instruction in them is invisible in a GitHub diff, invisible in an
editor, and perfectly readable by the model.

## Getting started

```bash
nvm use                                     # Node 22
npm ci --ignore-scripts
npx playwright install --with-deps chromium

npm run sut:up                              # OWASP Juice Shop, pinned by digest
npm run sut:seed                            # deterministic initial state

npm test                                    # the suite, zero AI dependency
npm run report
```

Requires Node >= 22.18 and Docker. `npm test` runs Chromium; use
`npm run test:all-browsers` for all three engines, after
`npx playwright install --with-deps`.

> **Warning.** The system under test is [OWASP Juice
> Shop](https://owasp.org/www-project-juice-shop/), deliberately vulnerable. It is
> bound to `127.0.0.1` only. Never expose it on another interface.

### Checks

```bash
npm run verify:no-ai     # the generation / execution boundary (ADR-0001, ADR-0002)
npm run lint:unicode     # no hidden instruction in assistant-read files
npm run test:unit        # both tools and the MCP policy layer
npm run typecheck
```

## Layout

```
ai-adoption/              choose a posture: decision tree, four profiles,
                          reusable internal policy
ai-engineering/           the removable layer: MCP hardening, prompts, threat
                          model, invisible-unicode-lint, and the static proof
                          that the boundary holds
qa-automation/            the suite, the pinned SUT, the false-green harness,
                          and healer-diff-gate
architecture-decisions/   the four decisions, in MADR format
```

The posture is documentation and configuration, never a directory of tests. Four
copies of a suite could not be compared against each other, and the claim that
removing the AI layer changes nothing would be false the moment the filesystem
said there were four suites.

## What this repository does not do

- **It does not generate tests at runtime.** That is the subject, not a gap.
- **Synthetic data does not reproduce production pathologies**: exotic encodings,
  records left inconsistent by migrations, volume. Bugs only production reveals
  will not be found here.
- **The mutant catalogue does not reach purely client-side defects.** It operates
  on HTTP responses. A 0 % false-green rate means "no mutant in this catalogue
  escapes the suite", not "the suite is perfect".
- **`healer-diff-gate` detects syntactic weakening only.** A patch that correctly
  rewrites an assertion onto the wrong target passes. That gap is covered by the
  mutant catalogue, and it has a test documenting it.
- **The suite is 10 tests across 4 files.** A foundation, not coverage. The two
  gaps the mutants expose are open and documented.

## Licence

MIT.
