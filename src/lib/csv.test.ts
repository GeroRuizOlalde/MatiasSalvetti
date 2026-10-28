import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parsea filas simples y saltea líneas vacías", () => {
    expect(parseCsv("nombre,proveedor\nSlot A,Prov 1\n\nSlot B,\n")).toEqual([
      ["nombre", "proveedor"],
      ["Slot A", "Prov 1"],
      ["Slot B", ""],
    ]);
  });

  it("respeta comillas, comillas escapadas y saltos dentro de campos", () => {
    expect(parseCsv('"Slot, con coma","Dice ""hola"""\r\n"Multi\nlínea",x')).toEqual([
      ["Slot, con coma", 'Dice "hola"'],
      ["Multi\nlínea", "x"],
    ]);
  });

  it("detecta punto y coma y quita el BOM", () => {
    const text = "﻿id;wager\n123;1.500,50";
    expect(detectDelimiter(text)).toBe(";");
    expect(parseCsv(text)).toEqual([
      ["id", "wager"],
      ["123", "1.500,50"],
    ]);
  });
});
