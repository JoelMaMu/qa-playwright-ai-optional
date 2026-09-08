import type { BrowserContext } from '@playwright/test';

/**
 * Blocks and records any request leaving the SUT, then fails the test on context
 * teardown. This is the executable form of ADR-0001: "no model in the execution
 * path" becomes a property checked on every test instead of a claim in a README.
 *
 * It also catches third-party assets pulled by the SUT, which would make the
 * suite depend on internet access and flake offline.
 */

export interface EgressViolation {
  url: string;
  method: string;
  initiator: string;
}

const ALWAYS_ALLOWED = new Set(['localhost', '127.0.0.1', '[::1]']);

export function createEgressGuard(allowedOrigin: string) {
  const violations: EgressViolation[] = [];
  const expected: RegExp[] = [];

  let allowedHost: string;
  try {
    allowedHost = new URL(allowedOrigin).hostname;
  } catch {
    allowedHost = 'localhost';
  }

  async function install(context: BrowserContext): Promise<void> {
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = request.url();

      if (!/^https?:/i.test(url)) return route.continue();

      const host = new URL(url).hostname;
      if (host === allowedHost || ALWAYS_ALLOWED.has(host)) return route.continue();

      violations.push({ url, method: request.method(), initiator: request.frame().url() });
      return route.abort('blockedbyclient');
    });
  }

  /**
   * Declares that egress matching `pattern` is the expected outcome of this test.
   *
   * Without it, a spec demonstrating a blocked exfiltration would be failed by the
   * guard that proves the point. The guard also fails when the expected attempt
   * never happens, so a demonstration that stops demonstrating turns red.
   */
  function expectBlocked(pattern: RegExp): void {
    expected.push(pattern);
  }

  function assertNoEgress(): void {
    for (const pattern of expected) {
      if (!violations.some((v) => pattern.test(v.url))) {
        throw new Error(
          `Egress guard: the expected request to ${pattern} was never attempted, ` +
            `so this test no longer demonstrates what it claims.`,
        );
      }
    }

    const unexpected = violations.filter((v) => !expected.some((p) => p.test(v.url)));
    if (unexpected.length === 0) return;

    const detail = unexpected
      .map((v) => `  ${v.method} ${v.url}\n    from: ${v.initiator}`)
      .join('\n');
    throw new Error(
      `Egress guard: ${unexpected.length} request(s) left the SUT (${allowedOrigin}).\n` +
        `See ADR-0001 and ADR-0002.\n${detail}`,
    );
  }

  return { install, assertNoEgress, expectBlocked, violations };
}
