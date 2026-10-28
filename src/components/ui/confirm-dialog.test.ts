import { describe, expect, it } from "vitest";
import { confirmFromText, splitConfirmText } from "./confirm-dialog";

describe("diálogo de confirmación", () => {
  it("separa la pregunta del detalle", () => {
    expect(splitConfirmText("¿Borrar la carrera y su ranking? No se puede deshacer.")).toEqual({
      title: "¿Borrar la carrera y su ranking?",
      detail: "No se puede deshacer.",
    });
    expect(splitConfirmText("¿Borrar este bono?")).toEqual({ title: "¿Borrar este bono?", detail: null });
  });

  it("arma el botón con el verbo de la pregunta", () => {
    expect(confirmFromText("¿Borrar este bono?")).toMatchObject({ confirmLabel: "Borrar", danger: true });
    expect(confirmFromText("¿Arrancar la battle? Se arma el cuadro.")).toMatchObject({
      confirmLabel: "Arrancar",
      danger: false,
    });
    expect(confirmFromText("¿Canjear «Gorra» por 1.000 puntos?")).toMatchObject({ confirmLabel: "Canjear" });
  });
});
