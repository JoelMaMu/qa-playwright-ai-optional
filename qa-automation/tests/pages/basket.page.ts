import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class BasketPage extends BasePage {
  readonly path = '/#/basket';

  readonly rows: Locator;
  readonly total: Locator;
  readonly checkout: Locator;

  constructor(page: Page) {
    super(page);
    this.rows = page.locator('mat-row');
    this.total = page.locator('#price');
    this.checkout = page.locator('#checkoutButton');
  }

  /**
   * `BasePage.goto()` returns as soon as the Angular route is mounted, while the
   * table and total are still empty. Waiting on the API response rather than on a
   * row keeps the empty-basket case observable.
   */
  override async goto(): Promise<void> {
    const loaded = this.page.waitForResponse(
      (response) => /\/rest\/basket\/\d+/.test(response.url()) && response.ok(),
    );
    await super.goto();
    await loaded;
  }

  row(productName: string): Locator {
    return this.rows.filter({ hasText: productName });
  }

  quantityOf(productName: string): Locator {
    return this.row(productName).locator('.mat-column-quantity');
  }
}
