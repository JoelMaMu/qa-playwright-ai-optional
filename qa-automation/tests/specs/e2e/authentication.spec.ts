import { test, expect, accountFor } from '../../fixtures/test';

/** This file owns the `bruno` role. One spec file, one role. */
test.describe('Authentication', () => {
  test('a valid credential opens a session', async ({ page, loggedInAs }) => {
    await loggedInAs('bruno');

    const token = await page.evaluate(() => window.localStorage.getItem('token'));
    expect(token).not.toBeNull();
    // A JWT has three segments. not.toBeNull() alone would accept the string
    // "undefined", which is a real failure mode of the SUT.
    expect(token!.split('.')).toHaveLength(3);
  });

  test('a wrong password is rejected and issues no token', async ({ page, loginPage }, testInfo) => {
    const bruno = accountFor('bruno', testInfo.project.name);

    await loginPage.goto();
    await loginPage.login({ email: bruno.email, password: 'invalid-password' });

    await expect(loginPage.error).toBeVisible();
    await expect(loginPage.error).toContainText(/invalid email or password/i);

    // The part that matters: a visible rejection proves nothing if a token was
    // issued anyway. A test stopping at the assertion above is green and wrong.
    const token = await page.evaluate(() => window.localStorage.getItem('token'));
    expect(token).toBeNull();
    await expect(page).toHaveURL(/#\/login/);
  });
});
