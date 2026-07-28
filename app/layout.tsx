import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://certezahabitacional.com"),
  title: "Certeza Habitacional | Inspección técnica de viviendas",
  description:
    "Inspección técnica de vivienda con evidencia fotográfica, clasificación de hallazgos y reportes profesionales para comprar, recibir o conservar una vivienda con certeza.",
  openGraph: {
    title: "Certeza Habitacional",
    description: "Inspeccionamos hoy para que decidas con certeza mañana.",
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
