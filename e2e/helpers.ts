import type { Page } from "@playwright/test";

/** Marca el +18 como confirmado antes de cargar la página (el gate se prueba aparte). */
export async function skipAgeGate(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("ms-age-confirmed", "1");
    } catch {
      // sin storage
    }
  });
}
