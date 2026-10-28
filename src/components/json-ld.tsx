/** Datos estructurados (schema.org) para buscadores. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // `<` escapado para que el contenido no pueda cerrar el <script>.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
