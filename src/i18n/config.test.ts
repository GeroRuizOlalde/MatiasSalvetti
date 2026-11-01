import { describe, expect, it } from "vitest";
import { localePath, routePath, splitLocale } from "./config";

describe("idiomas", () => {
  it("arma la ruta en cada idioma", () => {
    expect(localePath("es", "/bonus-hunt")).toBe("/bonus-hunt");
    expect(localePath("en", "/bonus-hunt")).toBe("/en/bonus-hunt");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "https://twitch.tv/chupetti")).toBe("https://twitch.tv/chupetti");
  });

  it("separa el idioma de la ruta", () => {
    expect(splitLocale("/en/sorteos")).toEqual({ lang: "en", path: "/sorteos" });
    expect(splitLocale("/en")).toEqual({ lang: "en", path: "/" });
    expect(splitLocale("/entrar")).toEqual({ lang: "es", path: "/entrar" });
    expect(splitLocale("/")).toEqual({ lang: "es", path: "/" });
  });

  it("saca el idioma también de la ruta interna de español", () => {
    expect(routePath("/es/bonus-hunt")).toBe("/bonus-hunt");
    expect(routePath("/es")).toBe("/");
    expect(routePath("/en/replays")).toBe("/replays");
    expect(routePath("/replays")).toBe("/replays");
  });
});
