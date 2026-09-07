import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class HomePage extends BasePage {
  readonly path = '/#/';

  readonly productCards: Locator;
  readonly searchButton: Locator;
  readonly searchInput: Locator;
  readonly basketButton: Locator;
  readonly paginatorRange: Locator;

  constructor(page: Page) {
    super(page);
    // Filtered on the add-to-basket button: the SUT renders its empty state
    // ("No results found") in a mat-card too, so counting mat-card alone would
    // return 1 on a search with no results.
    this.productCards = page.locator('mat-card:has(button[aria-label="Add to Basket"])');
    this.searchButton = page.locator('#searchQuery');
    this.searchInput = page.locator('#searchQuery input');
    this.basketButton = page.locator('button[aria-label="Show the shopping cart"]');
    this.paginatorRange = page.locator('.mat-mdc-paginator-range-label');
  }

  /**
   * Navigates and waits for the catalogue to be rendered.
   *
   * `BasePage.goto()` returns when the Angular route is mounted, while the product
   * list is still empty. Asserting at that point reads an empty card set, which
   * looks like a broken locator and is really a race.
   *
   * The wait is on the DOM reaching a usable state, not on the search response.
   * Waiting on the response would couple this method to network timing, and it
   * breaks in specs that intercept `/rest/products/search` to inject a payload:
   * the extra round-trip of `route.fetch()` blows the action timeout. Raising that
   * timeout would only hide the coupling.
   */
  override async goto(): Promise<void> {
    await super.goto();
    await this.productCards.first().waitFor({ state: 'visible', timeout: 20_000 });
  }

  productCard(name: string): Locator {
    return this.productCards.filter({ hasText: name });
  }

  async search(term: string): Promise<void> {
    await this.searchButton.click();
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
  }

  /**
   * Adds a product and waits for the server to persist it. Without the wait, two
   * consecutive adds race and the basket ends up at 1 instead of 2, failing a
   * correct assertion. The SUT sends POST on the first add, PUT on the next ones.
   */
  async addToBasket(productName: string): Promise<void> {
    const persisted = this.page.waitForResponse(
      (response) =>
        /\/api\/BasketItems/.test(response.url()) &&
        ['POST', 'PUT'].includes(response.request().method()) &&
        response.ok(),
    );
    await this.productCard(productName).getByRole('button', { name: 'Add to Basket' }).click();
    await persisted;
  }
}
