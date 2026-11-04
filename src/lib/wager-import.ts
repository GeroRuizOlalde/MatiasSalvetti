import { parseAmount } from "@/lib/amounts";

// Filas de wager a partir del reporte del casino (CSV). Sirve el reporte tal cual lo
// exporta el panel de afiliados (con muchas columnas, totales al final y montos como
// «1,154.50 $») o un CSV simple de dos columnas: ID de cuenta y wager.

const ID_HEADER =
  /id\s*del?\s*(cliente|jugador)|player\s*id|client\s*id|customer\s*id|account\s*id|id\s*de\s*(la\s*)?cuenta/i;
const WAGER_HEADER =
  /importe\s*total\s*de\s*las\s*apuestas|total\s*de\s*apuestas|apuestas|apostado|turnover|wager|bets/i;

export type WagerRow = { account_id: string; wager: number };

export type WagerImport = {
  rows: WagerRow[];
  /** Filas que no se pudieron leer (sin ID o sin monto). La de totales no cuenta. */
  invalid: number;
  /** Columnas usadas cuando el reporte trae encabezados reconocibles. */
  columns: { id: string; wager: string } | null;
};

export function extractWagerRows(table: string[][]): WagerImport {
  // Encabezado del reporte del casino: la primera fila con columna de ID y de apuestas.
  for (let h = 0; h < Math.min(table.length, 10); h++) {
    const header = table[h].map((cell) => cell.trim());
    const idCol = header.findIndex((cell) => ID_HEADER.test(cell));
    const wagerCol = header.findIndex((cell, i) => i !== idCol && WAGER_HEADER.test(cell));
    if (idCol >= 0 && wagerCol >= 0) {
      return {
        ...readRows(table.slice(h + 1), idCol, wagerCol),
        columns: { id: header[idCol], wager: header[wagerCol] },
      };
    }
  }

  // CSV simple: primera columna el ID, segunda el wager (con o sin encabezado).
  const rows = [...table];
  if (rows.length && parseAmount(rows[0][1] ?? "") === null) rows.shift();
  return { ...readRows(rows, 0, 1), columns: null };
}

function readRows(table: string[][], idCol: number, wagerCol: number) {
  const rows: WagerRow[] = [];
  let invalid = 0;
  for (const cells of table) {
    const accountId = (cells[idCol] ?? "").trim();
    // La fila de totales del final no tiene ID: se saltea sin contarla como error.
    if (!accountId) continue;
    const wager = parseAmount(cells[wagerCol] ?? "");
    if (wager === null || wager < 0) {
      invalid++;
      continue;
    }
    rows.push({ account_id: accountId, wager });
  }
  return { rows, invalid };
}
