import { expect, test } from "@playwright/test";
import { skipAgeGate } from "./helpers";

test.describe("gate +18", () => {
  test("pide confirmar la edad y lo recuerda", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "¿Sos mayor de 18?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Sí, tengo 18 o más" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("si dice que no, lo manda a juego responsable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "No", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Volvé cuando tengas 18" })).toBeVisible();
    await page.getByRole("link", { name: "Leer sobre juego responsable" }).click();
    await expect(page).toHaveURL(/\/juego-responsable$/);
  });
});

test.describe("páginas públicas", () => {
  test.beforeEach(async ({ page }) => skipAgeGate(page));

  const PAGES = [
    { path: "/bonus-hunt", heading: "Bonus Hunt" },
    { path: "/bonus-buys", heading: "Bonus Buy" },
    { path: "/bonus-battle", heading: "Bonus Battle" },
    { path: "/wager-race", heading: "Wager Race" },
    { path: "/sorteos", heading: "Sorteos" },
    { path: "/replays", heading: "Replays" },
    { path: "/como-participar", heading: "Cómo participar" },
    { path: "/juego-responsable", heading: "Juego responsable" },
    { path: "/bases-y-condiciones", heading: "Bases y condiciones" },
    { path: "/privacidad", heading: "Política de privacidad" },
  ];

  for (const { path, heading } of PAGES) {
    test(`${path} carga con su título`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole("contentinfo")).toContainText("Juego responsable");
    });
  }

  test("la home tiene las secciones principales", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Seguí cada sesión" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wager Race", level: 2 })).toBeVisible();
    // En celular el login está dentro del menú.
    if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(
      page.getByRole("button", { name: "Entrar con Twitch" }).filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test("navega desde el menú", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Sorteos" }).first().click();
    await expect(page).toHaveURL(/\/sorteos$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sorteos" })).toBeVisible();
  });

  test("detalle inexistente da 404", async ({ page }) => {
    await page.goto("/bonus-hunt/no-existe");
    await expect(page.getByText(/404|no existe|no encontramos/i).first()).toBeVisible();
  });

  test("no hay scroll horizontal en ninguna página principal", async ({ page }) => {
    for (const path of ["/", "/bonus-hunt", "/wager-race", "/sorteos"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("rutas protegidas", () => {
  test("el panel manda al login del panel", async ({ page }) => {
    await page.goto("/panel/hunts");
    await expect(page).toHaveURL(/\/panel\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Panel" })).toBeVisible();
  });

  test("el Cuartel y el perfil piden entrar", async ({ page }) => {
    await skipAgeGate(page);
    for (const path of ["/cuartel", "/perfil"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/entrar\\?next=${encodeURIComponent(path)}`));
      await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
    }
  });
});

test.describe("overlays de OBS", () => {
  test("sin token no muestran datos", async ({ page }) => {
    for (const kind of ["hunt", "buys", "battle", "wager", "sorteo"]) {
      await page.goto(`/overlay/${kind}`);
      await expect(page.getByText("Overlay sin permiso"), kind).toBeVisible();
    }
    await page.goto("/overlay/hunt?key=cualquier-cosa-1234567890");
    await expect(page.getByText("Overlay sin permiso")).toBeVisible();
  });

  test("no tienen header ni gate +18", async ({ page }) => {
    await page.goto("/overlay/hunt");
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("SEO", () => {
  test("robots, sitemap, manifest e imagen para redes", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /panel");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("/bonus-hunt");

    const manifest = await request.get("/manifest.webmanifest");
    expect((await manifest.json()).short_name).toBe("Chupetti");

    const og = await request.get("/opengraph-image");
    expect(og.headers()["content-type"]).toContain("image/png");
  });

  test("la home tiene metadata para compartir y datos estructurados", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(jsonLd ?? "{}")["@graph"][1].name).toBe("Chupetti");
  });

  test("las páginas mandan cabeceras de seguridad", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
  });
});
