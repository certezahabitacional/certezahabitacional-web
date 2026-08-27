export const DATOS_DOCUMENTALES = {
  empresa: "Certeza Habitacional",
  eslogan: "Revisamos cada rincón antes de que des el sí.",
  logo: "/branding/logo-gold.png",

  telefono:
    process.env.NEXT_PUBLIC_EMPRESA_TELEFONO ?? "",
  email:
    process.env.NEXT_PUBLIC_EMPRESA_EMAIL ?? "",
  web:
    process.env.NEXT_PUBLIC_EMPRESA_WEB ?? "",
  ubicacion:
    process.env.NEXT_PUBLIC_EMPRESA_UBICACION ?? "",
} as const;

export function datosContactoDocumento() {
  return [
    DATOS_DOCUMENTALES.telefono
      ? `Tel./WhatsApp: ${DATOS_DOCUMENTALES.telefono}`
      : "",
    DATOS_DOCUMENTALES.email,
    DATOS_DOCUMENTALES.web,
    DATOS_DOCUMENTALES.ubicacion,
  ].filter(Boolean);
}
