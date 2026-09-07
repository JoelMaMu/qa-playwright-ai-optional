/**
 * Synthetic test data. No production data, ever (ADR-0003).
 *
 * These credentials are committed in clear text on purpose: they are worthless
 * outside the local container, and they make the repository runnable by anyone.
 */

export interface SeededUser {
  email: string;
  password: string;
}

/**
 * Account roles. One spec file owns one role, so files can run in parallel.
 *
 *   alice   basket journeys
 *   bruno   authentication journeys
 *   carine  reserved for security specs
 */
export const ROLES = ['alice', 'bruno', 'carine'] as const;
export type Role = (typeof ROLES)[number];

/** Must match the project names in playwright.config.ts. */
export const PROJECTS = ['chromium', 'firefox', 'webkit'] as const;

/**
 * Resolves the account for a role in a given browser project.
 *
 * A role alone is not enough. The SUT is a single shared instance, and the three
 * browser projects run the same spec file concurrently: with one account per role,
 * the chromium and webkit copies of the basket spec would fight over the same
 * server-side basket, and the total assertion would see 3.98 instead of 1.99.
 *
 * Isolation therefore comes from splitting the data twice, by role and by project.
 * The `loggedInAs` fixture resolves this from `testInfo`, so specs never see it.
 */
export function accountFor(role: Role, project: string): SeededUser {
  return {
    email: `${role}.${project}@qa-ai-optional.test`,
    password: `Seed!${role}2026`,
  };
}

/**
 * Values pinned to Juice Shop v20.2.0. A SUT upgrade must break these tests
 * loudly rather than let them drift.
 */
export const SEARCH_TERMS = {
  none: 'zzz-term-absent-from-catalogue',
} as const;

export const PRODUCTS = {
  appleJuice: { name: 'Apple Juice (1000ml)', price: 1.99 },
} as const;

export const CATALOGUE = {
  itemsPerPage: 15,
  totalItems: 46,
} as const;
