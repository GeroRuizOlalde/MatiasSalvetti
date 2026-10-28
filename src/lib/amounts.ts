// Montos escritos a mano o exportados por un casino: "1.500", "1,234.56",
// "1.234,56", "$ 2000", "US$ 10,5". Devuelve null si no es un número.
export function parseAmount(raw: string): number | null {
  let text = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(text) || text.lastIndexOf("-") > 0) return null;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Los dos: el último es el separador decimal.
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    text = text.split(thousands).join("").replace(decimal, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const groups = text.split(sep);
    // "1.500" o "1,500,000": separador de miles. "10.5" o "10,50": decimal.
    const isThousands = groups.length > 2 || (groups[1]?.length === 3 && groups[0].replace("-", "").length <= 3);
    text = isThousands ? groups.join("") : groups.join(".");
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Lista de montos separada por renglones, punto y coma o barras ("1000 / 500 / 250"). */
export function parseAmountList(raw: string): number[] | null {
  const tokens = raw
    .split(/[\n;|/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const values = tokens.map(parseAmount);
  return values.every((v): v is number => v !== null && v >= 0) ? values : null;
}
