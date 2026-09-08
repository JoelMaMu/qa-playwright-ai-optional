import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import type { SeededUser } from '../data/seed';

export class LoginPage extends BasePage {
  readonly path = '/#/login';

  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    // Technical ids rather than labels: labels change with Accept-Language.
    this.email = page.locator('#email');
    this.password = page.locator('#password');
    this.submit = page.locator('#loginButton');
    this.error = page.locator('.error');
  }

  async login(user: SeededUser): Promise<void> {
    await this.email.fill(user.email);
    await this.password.fill(user.password);
    await this.submit.click();
  }
}
