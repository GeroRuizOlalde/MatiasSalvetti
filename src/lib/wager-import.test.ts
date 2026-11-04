import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { extractWagerRows } from "./wager-import";

// El reporte del panel de afiliados, como se exporta.
const REPORT = `ID de la web,Sitio web,SUBID,ID del cliente,Fecha de registro,País,Suma de todos los depósitos,Importe total de las apuestas,Beneficio de la compañía (total)
1692949,https://www.twitch.tv/salvetti97,CHUPETTI,1231389069,2025-04-21,Argentina,0.00 $,1.06 $,0.03 $
1692949,https://www.twitch.tv/salvetti97,matisalvetti,829724263,2024-03-27,Argentina,41.88 $,121.76 $,35.82 $
1692949,https://www.twitch.tv/salvetti97,Salvetti,576384215,2023-03-15,Argentina,11.98 $,"1,232.07 $",-17.27 $
,,,,,,111.67 $,"1,154.50 $",61.48 $`;

describe("importar wager", () => {
  it("lee el reporte del panel de afiliados tal cual", () => {
    const result = extractWagerRows(parseCsv(REPORT));
    expect(result.columns).toEqual({ id: "ID del cliente", wager: "Importe total de las apuestas" });
    expect(result.rows).toEqual([
      { account_id: "1231389069", wager: 1.06 },
      { account_id: "829724263", wager: 121.76 },
      { account_id: "576384215", wager: 1232.07 },
    ]);
    // La fila de totales no cuenta como error.
    expect(result.invalid).toBe(0);
  });

  it("también si viene con punto y coma y montos en formato argentino", () => {
    const csv = "ID del cliente;Importe total de las apuestas\n1231389069;1.500,50\n829724263;abc";
    const result = extractWagerRows(parseCsv(csv));
    expect(result.rows).toEqual([{ account_id: "1231389069", wager: 1500.5 }]);
    expect(result.invalid).toBe(1);
  });

  it("sigue aceptando el CSV simple de dos columnas", () => {
    expect(extractWagerRows(parseCsv("Player,Wager\nabc123,500\nxyz,1.000")).rows).toEqual([
      { account_id: "abc123", wager: 500 },
      { account_id: "xyz", wager: 1000 },
    ]);
    expect(extractWagerRows(parseCsv("abc123,500")).columns).toBeNull();
  });
});
