import type { Locator, Page } from '@playwright/test';

/**
 * Page objects expose locators and actions, never assertions. An assertion hidden
 * in a page object is invisible in a diff review and escapes the healer gate,
 * which only analyses `tests/specs`.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Hash route fragment, as used by the SUT. */
  abstract readonly path: string;

  async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.dismissOverlays();
  }

  /**
   * Safety net only. Overlays are normally suppressed by the cookies set in the
   * `context` fixture; this covers the case where a SUT upgrade renames one.
   * Short timeout and swallowed errors: a net must never fail the test it guards.
   */
  async dismissOverlays(): Promise<void> {
    for (const selector of ['button[aria-label="Close Welcome Banner"]', 'a.cc-btn.cc-dismiss']) {
      await this.page.locator(selector).first().click({ timeout: 1_000 }).catch(() => undefined);
    }
  }

  /**
   * Angular Material snackbar, the SUT's feedback channel for every action.
   * `.last()` because the SUT stacks them, and two matches would trip strict mode.
   */
  get snackbar(): Locator {
    return this.page.locator('simple-snack-bar').last();
  }
}
