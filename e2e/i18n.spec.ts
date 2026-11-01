import { expect, test } from "@playwright/test";
import { skipAgeGate } from "./helpers";

test.describe("inglés", () => {
  test.beforeEach(async ({ page }) => skipAgeGate(page));

  const PAGES = [
    { path: "/en/bonus-hunt", heading: "Bonus Hunt" },
    { path: "/en/sorteos", heading: "Giveaways" },
    { path: "/en/replays", heading: "Replays" },
    { path: "/en/como-participar", heading: "How to join" },
    { path: "/en/bases-y-condiciones", heading: "Terms and conditions" },
  ];

  for (const { path, heading } of PAGES) {
    test(`${path} está en inglés`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("contentinfo")).toContainText("Terms and conditions");
    });
  }

  test("la home en inglés", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { name: "Follow every session" })).toBeVisible();
    await expect(page.getByText("Adults only. Please gamble responsibly.")).toBeVisible();
  });

  test("ESP / ENG lleva a la misma página en el otro idioma", async ({ page, isMobile }) => {
    await page.goto("/sorteos");
    if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("link", { name: "ENG" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en\/sorteos$/);
    await expect(page.getByRole("heading", { level: 1, name: "Giveaways" })).toBeVisible();

    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "ESP" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/sorteos$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sorteos" })).toBeVisible();
  });

  test("los links del menú se quedan en inglés", async ({ page, isMobile }) => {
    await page.goto("/en");
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Replays" }).first().click();
    await expect(page).toHaveURL(/\/en\/replays$/);
  });

  test("/es redirige a la URL sin prefijo", async ({ page }) => {
    await page.goto("/es/sorteos");
    await expect(page).toHaveURL(/\/sorteos$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sorteos" })).toBeVisible();
  });

  test("el Cuartel pide entrar en inglés", async ({ page }) => {
    await page.goto("/en/cuartel");
    await expect(page).toHaveURL(/\/en\/entrar\?next=%2Fen%2Fcuartel/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("el gate +18 en inglés", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/en");
    await expect(page.getByRole("dialog", { name: "Are you 18 or older?" })).toBeVisible();
  });
});
