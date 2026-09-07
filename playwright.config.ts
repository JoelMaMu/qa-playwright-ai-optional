import { defineConfig, devices } from '@playwright/test';

/**
 * ADR-0001: this file reads no model provider variable, imports nothing from
 * `ai/`, and has no branch on an "AI mode". Deleting `ai/` must not change the
 * result of a run.
 */

const BASE_URL = process.env.SUT_BASE_URL ?? 'http://localhost:3000';
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/specs',
  outputDir: './test-results',

  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  workers: IS_CI ? 2 : undefined,

  // Files run in parallel, tests inside a file run in series.
  //
  // The SUT is a single shared instance whose basket is server state bound to an
  // account. Two tests in the same file adding the same product contaminate each
  // other. Isolation comes from splitting the data, one role per spec file and one
  // account per browser project (tests/data/seed.ts), not from a global lock that
  // would serialise the whole suite.
  fullyParallel: false,

  timeout: 45_000,
  expect: { timeout: 7_000 },

  reporter: IS_CI
    ? [['github'], ['json', { outputFile: './test-results/report.json' }]]
    : [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],

  use: {
    baseURL: BASE_URL,

    // Traces and videos embed full DOM snapshots. The SUT is synthetic here, so
    // they are publishable; on a real application these three lines are an
    // exfiltration channel into CI artifacts.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 10_000,
    navigationTimeout: 20_000,

    // Timezone pinned: without it, a suite passing in Paris fails on a UTC runner
    // as soon as a date is displayed. Locale pinned because the SUT negotiates its
    // language on Accept-Language, which would make text selectors machine-dependent.
    locale: 'en-US',
    timezoneId: 'Europe/Paris',

    testIdAttribute: 'data-testid',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // The SUT is started by docker compose, not by Playwright: it must be identical
  // locally and in CI, and survive a `--ui` session. We only wait for it.
  webServer: process.env.SUT_EXTERNAL
    ? undefined
    : {
        command: 'npm run sut:up && npm run sut:seed',
        url: BASE_URL,
        reuseExistingServer: !IS_CI,
        timeout: 180_000,
        stdout: 'pipe',
      },
});
