import { test, expect } from '../../fixtures/test';
import { PRODUCTS } from '../../data/seed';

/** This file owns the `alice` role. The basket is server state. */
test.describe('Basket', () => {
  test.beforeEach(async ({ loggedInAs }) => {
    await loggedInAs('alice');
  });

  test('an added product appears with the right quantity', async ({ homePage, basketPage }) => {
    await homePage.addToBasket(PRODUCTS.appleJuice.name);
    await expect(homePage.snackbar).toContainText(/placed .* into basket/i);

    await basketPage.goto();

    await expect(basketPage.row(PRODUCTS.appleJuice.name)).toBeVisible();
    await expect(basketPage.quantityOf(PRODUCTS.appleJuice.name)).toHaveText('1');
  });

  test('adding the same product twice yields a quantity of 2', async ({ homePage, basketPage }) => {
    await homePage.addToBasket(PRODUCTS.appleJuice.name);
    await homePage.addToBasket(PRODUCTS.appleJuice.name);

    await basketPage.goto();

    // Declared detector for mutant M-BASKET-002, which caps the quantity at 1.
    await expect(basketPage.rows).toHaveCount(1);
    await expect(basketPage.quantityOf(PRODUCTS.appleJuice.name)).toHaveText('2');
  });

  test('the basket total equals the sum of its lines', async ({ homePage, basketPage }) => {
    await homePage.addToBasket(PRODUCTS.appleJuice.name);
    await basketPage.goto();
    await expect(basketPage.row(PRODUCTS.appleJuice.name)).toBeVisible();

    const totalText = (await basketPage.total.textContent()) ?? '';
    const total = Number.parseFloat(totalText.replace(/[^0-9.,]/g, '').replace(',', '.'));

    // Declared detector for M-TOTAL-003. A visibility check on #price would let a
    // wrong total through.
    expect(total).toBeCloseTo(PRODUCTS.appleJuice.price, 2);
  });
});
