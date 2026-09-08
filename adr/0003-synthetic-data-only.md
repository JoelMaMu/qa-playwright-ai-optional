# ADR-0003: synthetic, seeded data only

- **Status**: accepted
- **Date**: 2026-09-04

## Context

Two needs collide in any end-to-end suite. **Determinism** requires that the same
spec, run twice, sees the same data. **Realism** pushes towards copying a
production extract, because that is faster than writing a generator and because
the interesting bugs come from real data.

The second is a trap in a public repository and a legal trap in a company: a
production copy, even partial, even "anonymised", remains personal-data
processing, and a pseudonymised extract is re-identified more often than not.

There is a third factor specific to this repository: an unseeded random generator
would break the false-green harness. Comparing measurements only means something
if every run starts from the same state.

## Decision

1. **No production data, ever, in any derived form.** No anonymised dump, no "a
   few real rows for testing", no screenshots of a real environment.
2. **All data is generated**, from a fixed set declared in `qa-automation/tests/data/seed.ts`.
3. **The seed is idempotent and replayable.** A test that leaves the SUT dirty is
   a bug in the test.
4. **Test credentials are public and documented.** They are worthless outside the
   local container, and committing them in clear is what makes the repository
   runnable by a third party.
5. **The SUT is OWASP Juice Shop**, run locally in a container pinned by digest.
   No third-party site is ever contacted, including during security demos.

### Secrets, three barriers

Protection relies on a hierarchy, never on the third alone:

1. **The secret does not exist.** Synthetic SUT, seeded data. The only barrier
   that cannot be worked around.
2. **The secret is outside the agent's reach.** The MCP container is read-only
   with minimal mounts; `qa-automation/tests/.auth/` and `.env*` are excluded.
3. **The secret is redacted if it shows up anyway.** Playwright MCP `--secrets`.
   Upstream calls this "a convenience and not a security feature": it is literal
   string substitution and fails as soon as the value is encoded or split.

## Consequences

**Positive.** No legal risk and no leak risk in the nominal flow. The harness is
valid because the initial state is constant. A third party can clone and run the
repository without private access.

**Negative.** Synthetic data does not reproduce production pathologies: exotic
encodings, records left inconsistent by migrations, volume. Journeys requiring a
real third-party account (real payment, enterprise SSO) are out of scope.

**If you reuse this repository on your own application, you lose barrier 1.** Your
accessibility tree becomes sensitive, your traces cannot ship as public artifacts,
and barrier 3 becomes your first line, which its own vendor calls a convenience.
