export function numeroVisitaDesdeFolio(folio: string): number {
  const match = folio.match(/\s-\sV(\d+)$/i);
  if (!match) return 1;
  const numero = Number(match[1]);
  return Number.isInteger(numero) && numero >= 2 ? numero : 1;
}

export function folioBaseVisita(folio: string): string {
  return folio.replace(/\s-\sV\d+$/i, "").trim();
}

export function etiquetaVisita(
  folio: string,
  numeroInspeccion?: number | null,
): string {
  const numero =
    numeroInspeccion && numeroInspeccion >= 1
      ? numeroInspeccion
      : numeroVisitaDesdeFolio(folio);
  const base = folioBaseVisita(folio);

  return numero <= 1
    ? `${base} — V1 — Inspección inicial`
    : `${base} — V${numero} — Seguimiento de V${numero - 1}`;
}
