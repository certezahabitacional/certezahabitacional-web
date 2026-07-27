import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Certeza Habitacional | Inspección técnica de vivienda",
  description: "Inspecciones técnicas de vivienda con evidencia, clasificación de hallazgos e indicadores claros para tomar decisiones con certeza.",
  metadataBase: new URL("https://certezahabitacional.com"),
  openGraph: {
    title: "Certeza Habitacional",
    description: "Inspección técnica de vivienda para comprar, recibir y conservar con certeza.",
    url: "https://certezahabitacional.com",
    siteName: "Certeza Habitacional",
    locale: "es_MX",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
