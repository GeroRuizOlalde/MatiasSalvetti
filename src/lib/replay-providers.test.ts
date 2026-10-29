import { describe, expect, it } from "vitest";
import { matchProvider, normalizeDomain, replayHost } from "./replay-providers";

const providers = [
  { domain: "nolimitcity.com", name: "Nolimit City" },
  { domain: "ppreplaylink.net", name: "Pragmatic Play" },
  { domain: "eu.nolimitcity.com", name: "Nolimit EU" },
];

describe("replays", () => {
  it("saca el dominio del link", () => {
    expect(replayHost("https://www.ppreplaylink.net/IKfLBegbRp")).toBe("ppreplaylink.net");
    expect(replayHost("http://nolimitcity.com/replay/x")).toBeNull();
    expect(replayHost("cualquier cosa")).toBeNull();
  });

  it("reconoce el proveedor por dominio o subdominio", () => {
    expect(matchProvider("ppreplaylink.net", providers)?.name).toBe("Pragmatic Play");
    expect(matchProvider("replay.nolimitcity.com", providers)?.name).toBe("Nolimit City");
    expect(matchProvider("eu.nolimitcity.com", providers)?.name).toBe("Nolimit EU");
    expect(matchProvider("nolimitcity.com.falso.io", providers)).toBeNull();
  });

  it("normaliza lo que se escribe como dominio", () => {
    expect(normalizeDomain("https://www.hacksawgaming.com/replay/1")).toBe("hacksawgaming.com");
    expect(normalizeDomain("Relax-Gaming.com")).toBe("relax-gaming.com");
    expect(normalizeDomain("no es un dominio")).toBeNull();
  });
});
