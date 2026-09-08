import type { BrowserContext } from '@playwright/test';

/**
 * Mutant catalogue: the measuring instrument for false green.
 *
 * A mutant is a defect injected on purpose. A healthy suite must turn red on each
 * one. A mutant that goes unnoticed is a false green: the suite reports success
 * while a defect is present.
 *
 *   false-green rate = undetected mutants / total mutants
 *
 * The SUT is a pinned container image we do not rebuild, so defects are injected
 * into the HTTP response through Playwright routing. The trade-off is declared:
 * this reaches business rules and data integrity, never a purely client-side
 * defect such as a rendering or CSS regression.
 *
 * Mutants are never active during a normal run. They are applied only by
 * qa-automation/metrics/harness/run-mutants.mjs through the MUTANT environment variable.
 */

export type MutantCategory = 'corrupt-data' | 'business-rule' | 'access-control' | 'performance';

export interface Mutant {
  /** Stable id. Never reuse a retired one. */
  id: string;
  category: MutantCategory;
  description: string;
  /** The assertion meant to catch it. A mutant without one is a known gap. */
  expectedDetector: string;
  apply: (context: BrowserContext) => Promise<void>;
}

/** Rewrites a JSON response body, leaving status and headers untouched. */
async function mutateJson(
  context: BrowserContext,
  urlPattern: RegExp,
  transform: (body: any) => any,
): Promise<void> {
  await context.route(urlPattern, async (route) => {
    const response = await route.fetch();
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Non-JSON response: pass through rather than break the page, otherwise the
      // mutant would be detected for the wrong reason.
      return route.fulfill({ response });
    }
    await route.fulfill({ response, json: transform(body) });
  });
}

export const MUTANTS: Mutant[] = [
  {
    id: 'M-PRICE-001',
    category: 'corrupt-data',
    description: 'Unit price returned by the catalogue is lowered by 1.00.',
    expectedDetector: 'exact price assertion on the product card',
    apply: (context) =>
      mutateJson(context, /\/rest\/products\/search/, (body) => {
        for (const p of body?.data ?? []) {
          if (typeof p.price === 'number') p.price = Math.max(0, p.price - 1);
        }
        return body;
      }),
  },
  {
    id: 'M-BASKET-002',
    category: 'business-rule',
    description: 'Basket quantity is capped at 1 regardless of how many are added.',
    expectedDetector: "quantity assertion after two adds (toHaveText '2')",
    // Mutates the read response, not the write. Mutating /api/BasketItems alone
    // produces an inert mutant: invisible on screen, so wrongly reported as a
    // false green. A broken instrument is worse than no instrument.
    apply: (context) =>
      mutateJson(context, /\/rest\/basket\/\d+$/, (body) => {
        for (const product of body?.data?.Products ?? []) {
          if (product?.BasketItem) product.BasketItem.quantity = 1;
        }
        return body;
      }),
  },
  {
    id: 'M-TOTAL-003',
    category: 'business-rule',
    description: 'Basket total ignores the last item.',
    expectedDetector: 'total compared against the sum of the lines',
    apply: (context) =>
      mutateJson(context, /\/rest\/basket\/\d+$/, (body) => {
        const products = body?.data?.Products;
        if (Array.isArray(products) && products.length > 0) products.pop();
        return body;
      }),
  },
  {
    id: 'M-SEARCH-004',
    category: 'corrupt-data',
    description: 'Search returns only the first result.',
    expectedDetector: 'exact result count (toHaveCount)',
    apply: (context) =>
      mutateJson(context, /\/rest\/products\/search/, (body) => {
        if (Array.isArray(body?.data)) body.data = body.data.slice(0, 1);
        return body;
      }),
  },
  {
    id: 'M-SESSION-005',
    category: 'access-control',
    description: 'Profile API answers 200 with an empty body instead of 401 without a token.',
    expectedDetector: 'NONE YET: no spec asserts a redirect to the login page',
    apply: async (context) => {
      await context.route(/\/rest\/user\/whoami/, async (route) => {
        const headers = route.request().headers();
        if (!headers['authorization']) return route.fulfill({ status: 200, json: { user: {} } });
        return route.fallback();
      });
    },
  },
  {
    id: 'M-LATENCY-006',
    category: 'performance',
    description: 'Catalogue answers with 4 s of added latency.',
    expectedDetector: 'NONE YET: the suite has no time budget assertion',
    apply: async (context) => {
      await context.route(/\/rest\/products\/search/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        await route.fallback();
      });
    },
  },
];

export function getMutant(id: string): Mutant {
  const mutant = MUTANTS.find((m) => m.id === id);
  if (!mutant) {
    throw new Error(`Unknown mutant: ${id}. Known: ${MUTANTS.map((m) => m.id).join(', ')}`);
  }
  return mutant;
}
