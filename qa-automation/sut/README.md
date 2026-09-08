# System under test

[OWASP Juice Shop](https://owasp.org/www-project-juice-shop/) v20.2.0, pinned by
digest, run locally. A deliberately vulnerable e-commerce application, MIT
licensed.

## Why this one

- **Legitimate to attack.** The injection demonstrations need no fabricated
  vulnerability, and the rule "never test a third-party site you do not own" holds
  because the instance runs on your machine.
- **Known.** A tech lead already recognises it, so no time is spent justifying the
  target before discussing the subject.
- **Reproducible.** Pinned container, identical locally and in CI.
- **Rich enough.** Basket, authentication, search, uploads, reviews, admin panel.
  Enough for real journeys rather than five clicks.

Its defects are intentional and documented by OWASP. The tests here do not try to
prove it is secure; they exercise functional journeys and provide the measurement
ground for the mutant catalogue.

## Usage

```bash
npm run sut:up      # docker compose up -d --wait, waits for the healthcheck
npm run sut:seed    # deterministic initial state
npm run sut:down    # stop and remove volumes
```

The SUT listens on `http://localhost:3000`, **on the loopback only**.

> **Operating rule.** Never expose this container on a network interface other
> than `127.0.0.1`, and never deploy it on a shared or internet-reachable machine.
> The `127.0.0.1:3000:3000` binding in `docker/compose.yaml` is part of the threat
> model, not a preference.

## Contents

| Path | Role |
|---|---|
| `docker/compose.yaml` | container definition, pinned by digest, two networks |
| `seed/seed.mjs` | idempotent reset to a deterministic initial state |
| `mutants/catalogue.ts` | injected defects used to measure the false-green rate |
