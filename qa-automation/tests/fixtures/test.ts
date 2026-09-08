import { test as base, expect, type Page } from '@playwright/test';
import { BasketPage, HomePage, LoginPage } from '../pages';
import { accountFor } from '../data/seed';
import type { Role } from '../data/seed';
import { createEgressGuard } from './egress-guard';

/**
 * ADR-0001: nothing here imports from `ai/` or reads a model provider variable.
 * Enforced by `npm run verify:no-ai`.
 */

type EgressGuard = ReturnType<typeof createEgressGuard>;

interface Fixtures {
  homePage: HomePage;
  loginPage: LoginPage;
  basketPage: BasketPage;
  egress: EgressGuard;
  /** Signs in as the given role and resets that account's basket. */
  loggedInAs: (role: Role) => Promise<HomePage>;
}

export const test = base.extend<Fixtures>({
  // Always on. An opt-in guard would be forgotten in the test where it matters.
  egress: [
    async ({ baseURL }, use) => {
      await use(createEgressGuard(baseURL ?? 'http://localhost:3000'));
    },
    { scope: 'test' },
  ],

  context: async ({ context, egress, baseURL }, use) => {
    // The SUT stores the dismissed state of its cookie banner, welcome dialog and
    // language notice in cookies. Setting them before the first navigation means
    // the overlays never render. Closing a fading overlay is inherently a race.
    const host = new URL(baseURL ?? 'http://localhost:3000').hostname;
    await context.addCookies([
      { name: 'welcomebanner_status', value: 'dismiss', domain: host, path: '/' },
      { name: 'cookieconsent_status', value: 'dismiss', domain: host, path: '/' },
      { name: 'language', value: 'en', domain: host, path: '/' },
    ]);

    await egress.install(context);

    // Mutant injection, driven by qa-automation/metrics/harness/run-mutants.mjs. The import is
    // dynamic: without MUTANT the catalogue is never loaded and the suite behaves
    // exactly as if it did not exist.
    const mutantId = process.env.MUTANT;
    if (mutantId) {
      const { getMutant } = await import('../../sut/mutants/catalogue');
      await getMutant(mutantId).apply(context);
    }

    await use(context);

    // Disarm routes before closing: an in-flight request entering a handler whose
    // context is closing raises "not a part of any test" next to a green run.
    await context.unrouteAll({ behavior: 'ignoreErrors' });

    egress.assertNoEgress();
  },

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  basketPage: async ({ page }, use) => {
    await use(new BasketPage(page));
  },

  loggedInAs: async ({ page, loginPage, homePage }, use, testInfo) => {
    await use(async (role: Role) => {
      // The account is resolved per project: the same spec file runs concurrently
      // in chromium, firefox and webkit against one shared SUT. See data/seed.ts.
      const user = accountFor(role, testInfo.project.name);

      await loginPage.goto();
      await loginPage.login(user);

      // Poll for the token rather than sleeping: it is the real end-of-auth signal
      // and it does not drift with machine load.
      await expect
        .poll(() => page.evaluate(() => window.localStorage.getItem('token')), {
          timeout: 10_000,
          message: `no token in localStorage: authentication failed for ${user.email}`,
        })
        .not.toBeNull();

      // The basket is server state that survives between tests of the same file.
      await emptyBasket(page);

      await homePage.goto();
      return homePage;
    });
  },
});

/** Empties the current session's basket through the API, not the UI: setup should not add failure modes. */
async function emptyBasket(page: Page): Promise<void> {
  const credentials = await page.evaluate(() => ({
    token: window.localStorage.getItem('token'),
    basketId: window.sessionStorage.getItem('bid'),
  }));
  if (!credentials.token || !credentials.basketId) return;

  const headers = { Authorization: `Bearer ${credentials.token}` };
  const basket = await page.request.get(`/rest/basket/${credentials.basketId}`, { headers });
  if (!basket.ok()) return;

  const body = (await basket.json()) as {
    data?: { Products?: { BasketItem?: { id?: number } }[] };
  };

  for (const product of body.data?.Products ?? []) {
    const itemId = product.BasketItem?.id;
    if (itemId) await page.request.delete(`/api/BasketItems/${itemId}`, { headers });
  }
}

export { expect, accountFor };
export type { Role, SeededUser } from '../data/seed';
