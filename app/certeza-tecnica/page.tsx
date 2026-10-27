import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Certeza Técnica | Portafolio de servicios",
  description: "Conoce las cuatro áreas y los servicios de Certeza Técnica para la administración, presupuestación, supervisión y dirección de proyectos.",
};

export default function CertezaTecnicaPage() {
  return (
    <main style={{ backgroundColor: "#071d38", color: "white", minHeight: "100vh" }}>
      <header style={{ maxWidth: 1400, margin: "0 auto", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>← Volver a Grupo Certeza</Link>
        <span style={{ color: "#edcb71", fontWeight: 700 }}>CERTEZA TÉCNICA</span>
      </header>

      <section aria-label="Portafolio de servicios de Certeza Técnica" style={{ padding: "0 12px 48px", margin: "0 auto", maxWidth: 1400, height: "auto", overflow: "visible" }}>
        {/* Imagen final aprobada de La Ruta Integral en versión HD, mostrada completa y sin deformación. */}
        <Image
          src="/branding/ruta-integral-certeza-tecnica-hd.webp?v=20261026-hd"
          alt="Ruta integral de Certeza Técnica que conecta Dirección y Desarrollo, Planeación y Administración, Presupuestos y Costos, y Supervisión y Auditoría alrededor del proyecto."
          width={1448}
          height={1086}
          unoptimized
          priority
          sizes="(max-width: 1400px) 100vw, 1400px"
          style={{ width: "100%", height: "auto", maxWidth: "100%", objectFit: "contain", display: "block", borderRadius: 8 }}
        />
      </section>


      <section
        aria-label="Acceso a Certeza Técnica 360"
        style={{
          maxWidth: 1254,
          margin: "22px auto 0",
          padding: "0 12px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(237,203,113,.55)",
            borderRadius: 18,
            background: "linear-gradient(135deg, #071d38 0%, #0b355b 55%, #0b5a84 100%)",
            padding: "28px",
            boxShadow: "0 22px 50px rgba(0,0,0,.24)",
          }}
        >
          <p style={{ margin: 0, color: "#edcb71", fontWeight: 900, letterSpacing: ".1em", fontSize: 13 }}>
            PLATAFORMA INTEGRAL
          </p>
          <h2 style={{ margin: "8px 0 8px", fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.05 }}>
            Certeza Técnica 360
          </h2>
          <p style={{ margin: 0, maxWidth: 930, color: "#dbe8f3", fontSize: 17, lineHeight: 1.65 }}>
            Un solo sistema para Dirección y Desarrollo, Planeación y Administración, Presupuestos y Costos,
            Supervisión y Auditoría, con expediente maestro, reportes e inteligencia del proyecto.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <Link
              href="/certeza-tecnica/login?callbackUrl=%2Fcerteza-tecnica%2Fapp"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 50,
                padding: "0 24px",
                borderRadius: 12,
                background: "#edcb71",
                color: "#071d38",
                textDecoration: "none",
                fontWeight: 950,
              }}
            >
              Entrar a Certeza Técnica 360 →
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
