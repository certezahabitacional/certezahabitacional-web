import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Certeza Técnica | Portafolio de servicios",
  description: "Conoce las cuatro áreas y los servicios de Certeza Técnica para la administración, presupuestación, supervisión y dirección de proyectos.",
};

export default function CertezaTecnicaPage() {
  return (
    <main style={{ backgroundColor: "#071d38", color: "white" }}>
      <header style={{ maxWidth: 1400, margin: "0 auto", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>← Volver a Grupo Certeza</Link>
        <span style={{ color: "#edcb71", fontWeight: 700 }}>CERTEZA TÉCNICA</span>
      </header>
      <section aria-label="Portafolio de servicios de Certeza Técnica" style={{ padding: "0 12px", margin: "0 auto", maxWidth: 1400, height: "auto", overflow: "visible" }}>
        {/* Servir el PNG autorizado completo sin modificar sus pixeles. */}
        <Image
          src="/branding/portafolio-servicios-certeza-tecnica.png?v=0d7528594def"
          alt="Infografía del portafolio de Certeza Técnica: Presupuestos y Costos; Planeación y Administración; Supervisión y Auditoría; Dirección y Desarrollo. Sitio www.certezahabitacional.com."
          width={1254}
          height={1254}
          unoptimized
          priority
          sizes="(max-width: 1400px) 100vw, 1400px"
          style={{ width: "100%", height: "auto", maxWidth: "100%", objectFit: "contain", display: "block", borderRadius: 8 }}
        />
      </section>
    </main>
  );
}
