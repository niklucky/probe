const { test, expect } = require("@playwright/test");

const TEST_URL = "https://analytic.mossport.ru";
const INVALID_CREDENTIALS = {
  username: "test",
  password: "test",
};

test.describe("Authentication", () => {
  test("rejects invalid username and password", async ({ page }) => {
    await page.goto(TEST_URL, { waitUntil: "domcontentloaded" });

    const usernameInput = page
      .locator(
        [
          'input[name="username"]',
          'input[name="login"]',
          'input[autocomplete="username"]',
          'input[type="email"]',
          'input[type="text"]',
        ].join(", "),
      )
      .first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page
      .getByRole("button", {
        name: /log\s*in|sign\s*in|войти|вход/i,
      })
      .first();

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeEnabled();

    await usernameInput.fill(INVALID_CREDENTIALS.username);
    await passwordInput.fill(INVALID_CREDENTIALS.password);
    await loginButton.click();

    const authenticationError = page
      .locator(
        [
          '[role="alert"]',
          '[aria-live="assertive"]',
          ".alert-danger",
          ".ant-message-error",
          ".el-message--error",
          ".toast-error",
        ].join(", "),
      )
      .filter({
        hasText:
          /invalid|incorrect|failed|unauthorized|неверн|ошибк|неправильн/i,
      })
      .first();

    await expect(authenticationError).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(page).toHaveURL(/analytic\.mossport\.ru/i);
  });
});
