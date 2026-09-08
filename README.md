# qa-playwright-ai-optional

A Playwright end-to-end suite where **AI is a source-time tool, never a runtime
dependency**, and where that boundary is enforced by CI rather than claimed in a
README.

```bash
npm run verify:no-ai     # fails if tests/ references ai/ or a model provider
rm -rf ai/ && npm test   # identical result
```

## Why this exists

Most "Playwright + AI" demos show an agent writing a test. The question teams
actually face is different, and it is usually asked in the wrong order:

> **Where does your trust boundary sit, and what are you willing to pay to move
> it?**

Four postures answer it, from no AI at all to a local model on your own hardware.
Pick yours with [`docs/ai-posture.md`](docs/ai-posture.md), then read the
operational detail in [`ai/profiles/`](ai/profiles/).

**The suite in this repository was written under profile 0, without a model.** The
other three are documented postures with a hardened MCP policy, not measured
results. No comparative benchmark has been run, and none is claimed.

That is possible because of one invariant, applied everywhere:

> Generation modifies source code. Execution verifies it.
> The two never share a runtime.

Consequences, enforced rather than stated:

| Rule | Enforced by |
|---|---|
| CI never calls a model, never starts an MCP server | `scripts/assert-no-ai-imports.mjs`, run on every PR |
| Nothing leaves the SUT during a run | `tests/fixtures/egress-guard.ts`, plus iptables in `airgap.yml` |
| Generated patches cannot silently weaken the suite | `tools/healer-diff-gate/` |
| Test data is synthetic and seeded | `sut/seed/seed.mjs`, ADR-0003 |

## The measurement that matters

Not the number of tests. The **false-green rate**: inject known defects into the
system under test, run the suite, and count the ones that go unnoticed.

Neither test count nor code coverage answers this. A suite with no assertions at
all reaches 100 % coverage.

```bash
npm run metrics:mutants
```

Latest measurement, 6 mutants, is committed in
[`metrics/results/false-green.json`](metrics/results/false-green.json) and
discussed in [`metrics/README.md`](metrics/README.md), including the two known
coverage gaps it exposes.

## Two tools

| Tool | What it does |
|---|---|
| [`tools/healer-diff-gate/`](tools/healer-diff-gate/) | rejects patches that turn a build green without repairing it: removed or weakened assertion, unapproved skip, inflated timeout |
| [`tools/invisible-unicode-lint/`](tools/invisible-unicode-lint/) | finds instructions hidden in invisible Unicode inside the files your assistant reads and interprets |

The second addresses a real and rarely checked vector. `AGENTS.md`, `CLAUDE.md`,
`.cursorrules` and `.github/*.prompt.md` are **executable code**, loaded every
session. A zero-width instruction in them is invisible in a GitHub diff, invisible
in an editor, and perfectly readable by the model.

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
`npm run test:all-browsers` for Chromium, Firefox and WebKit, after
`npx playwright install --with-deps`.

> **Warning.** The system under test is [OWASP Juice
> Shop](https://owasp.org/www-project-juice-shop/), deliberately vulnerable. It is
> bound to `127.0.0.1` only. Never expose it on another interface.

### Checks

```bash
npm run verify:no-ai     # the generation / execution boundary (ADR-0001, ADR-0002)
npm run lint:unicode     # no hidden instruction in assistant-read files
npm run test:unit        # tools and MCP policy layer
npm run typecheck
```

## Layout

```
docs/      choose a posture, then the threat model and the reusable policy
ai/        the removable layer: one profile per posture, MCP policy, prompts
tests/     the suite. One suite, zero AI dependency. This is the deliverable.
sut/       pinned Juice Shop, deterministic seed, mutant catalogue
metrics/   false-green harness and committed results
tools/     healer-diff-gate, invisible-unicode-lint
adr/       the four architecture decisions
scripts/   the static proof that the boundary holds
```

The posture is documentation and configuration, never a directory of tests. Four
copies of a suite could not be compared against each other, and the claim that
removing AI changes nothing would be false the moment the filesystem said
otherwise.

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
