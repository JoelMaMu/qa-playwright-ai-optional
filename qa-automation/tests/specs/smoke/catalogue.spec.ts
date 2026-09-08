import { test, expect } from '../../fixtures/test';
import { CATALOGUE, PRODUCTS, SEARCH_TERMS } from '../../data/seed';

test.describe('Catalogue', () => {
  test('shows a full first page and the correct total', async ({ homePage }) => {
    await homePage.goto();

    // Exact counts, not toBeGreaterThan(0): a lower bound would let a catalogue
    // collapsing from 15 items to 1 through. That is mutant M-SEARCH-004.
    await expect(homePage.productCards).toHaveCount(CATALOGUE.itemsPerPage);
    await expect(homePage.paginatorRange).toHaveText(
      `1 – ${CATALOGUE.itemsPerPage} of ${CATALOGUE.totalItems}`,
    );
  });

  test('shows the exact price of the reference product', async ({ homePage }) => {
    await homePage.goto();

    const card = homePage.productCard(PRODUCTS.appleJuice.name);
    await expect(card).toBeVisible();
    // Exact price, not toContainText('1'): mutant M-PRICE-001 shifts it by 1.00.
    await expect(card).toContainText(`${PRODUCTS.appleJuice.price.toFixed(2)}¤`);
  });

  test('renders an empty catalogue when the search has no result', async ({ homePage }) => {
    await homePage.goto();
    await homePage.search(SEARCH_TERMS.none);

    await expect(homePage.productCards).toHaveCount(0);
  });
});
