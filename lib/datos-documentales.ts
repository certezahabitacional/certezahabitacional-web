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


export type ContactoZonaDocumento = {
  empresa: string;
  logo: string;
  telefono: string;
  email: string;
  web: string;
  zona: string;
};

function normalizarZona(codigo?: string | null, ciudad?: string | null) {
  return `${codigo ?? ""} ${ciudad ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function contactoDocumentoPorZona(codigo?: string | null, ciudad?: string | null): ContactoZonaDocumento {
  const zona = normalizarZona(codigo, ciudad);

  const telefonoCorporativo =
    process.env.NEXT_PUBLIC_EMPRESA_TELEFONO ?? "656 287 12 18";
  const emailCorporativo =
    process.env.NEXT_PUBLIC_EMPRESA_EMAIL ?? "contacto@certezahabitacional.com";
  const webCorporativa =
    process.env.NEXT_PUBLIC_EMPRESA_WEB ?? "https://www.certezahabitacional.com";

  let telefono = telefonoCorporativo;

  if (zona.includes("JUAREZ")) {
    telefono = process.env.NEXT_PUBLIC_EMPRESA_TELEFONO_CIUDAD_JUAREZ ?? telefonoCorporativo;
  } else if (zona.includes("TIJUANA")) {
    telefono = process.env.NEXT_PUBLIC_EMPRESA_TELEFONO_TIJUANA ?? telefonoCorporativo;
  } else if (zona.includes("GUADALAJARA")) {
    telefono = process.env.NEXT_PUBLIC_EMPRESA_TELEFONO_GUADALAJARA ?? telefonoCorporativo;
  } else if (zona.includes("HERMOSILLO")) {
    telefono = process.env.NEXT_PUBLIC_EMPRESA_TELEFONO_HERMOSILLO ?? telefonoCorporativo;
  }

  return {
    empresa: DATOS_DOCUMENTALES.empresa,
    logo: DATOS_DOCUMENTALES.logo,
    telefono,
    email: emailCorporativo,
    web: webCorporativa,
    zona: codigo ?? ciudad ?? "Corporativo",
  };
}
