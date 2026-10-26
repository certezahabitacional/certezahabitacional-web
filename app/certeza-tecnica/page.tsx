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

      <section aria-label="Portafolio de servicios de Certeza Técnica" style={{ padding: "0 12px", margin: "0 auto", maxWidth: 1400, height: "auto", overflow: "visible" }}>
        {/* Servir el PNG autorizado completo sin modificar sus pixeles. */}
        <Image
          src="/branding/ruta-integral-certeza-tecnica.svg?v=c3b53c13427e"
          alt="Ruta integral de Certeza Técnica que conecta Dirección y Desarrollo, Planeación y Administración, Presupuestos y Costos, y Supervisión y Auditoría alrededor del proyecto."
          width={1600}
          height={1067}
          unoptimized
          priority
          sizes="(max-width: 1400px) 100vw, 1400px"
          style={{ width: "100%", height: "auto", maxWidth: "100%", objectFit: "contain", display: "block", borderRadius: 8 }}
        />
      </section>

      <section
        aria-label="Acceso a Certeza Cost"
        style={{
          maxWidth: 1254,
          margin: "22px auto 0",
          padding: "0 12px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(237,203,113,.42)",
            borderRadius: 18,
            background: "linear-gradient(135deg, #102b46 0%, #071d38 58%, #0b2a4f 100%)",
            padding: "26px",
            boxShadow: "0 22px 50px rgba(0,0,0,.22)",
          }}
        >
          <p style={{ margin: 0, color: "#edcb71", fontWeight: 800, letterSpacing: ".08em", fontSize: 13 }}>
            PRESUPUESTOS Y COSTOS
          </p>
          <h2 style={{ margin: "8px 0 8px", fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 1.05 }}>
            Sistema Certeza Cost
          </h2>
          <p style={{ margin: 0, maxWidth: 900, color: "#d5e0ec", fontSize: 17, lineHeight: 1.65 }}>
            Generadores, cuantificaciones, tarjetas de precios unitarios, explosión de insumos y presupuestos
            integrados en un mismo flujo técnico para analizar y controlar el costo del proyecto.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <Link
              href="/certeza-tecnica/presupuestos-costos"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                padding: "0 22px",
                borderRadius: 12,
                background: "#edcb71",
                color: "#071d38",
                textDecoration: "none",
                fontWeight: 900,
              }}
            >
              Ver Costos y Presupuestos →
            </Link>
            <span style={{ display: "inline-flex", alignItems: "center", color: "#9fb2c6", fontSize: 14 }}>
              Herramientas operativas para usuarios autorizados
            </span>
          </div>
        </div>
      </section>

      <section
        aria-label="Acceso a Certeza Project Manager"
        style={{
          maxWidth: 1254,
          margin: "22px auto 0",
          padding: "0 12px 48px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(237,203,113,.42)",
            borderRadius: 18,
            background: "linear-gradient(135deg, #0b2a4f 0%, #071d38 58%, #102b46 100%)",
            padding: "26px",
            boxShadow: "0 22px 50px rgba(0,0,0,.22)",
          }}
        >
          <p style={{ margin: 0, color: "#edcb71", fontWeight: 800, letterSpacing: ".08em", fontSize: 13 }}>
            PLATAFORMA DE DIRECCIÓN Y CONTROL DE PROYECTOS
          </p>
          <h2 style={{ margin: "8px 0 8px", fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 1.05 }}>
            Certeza Project Manager
          </h2>
          <p style={{ margin: 0, maxWidth: 860, color: "#d5e0ec", fontSize: 17, lineHeight: 1.65 }}>
            Planeación, alcance, costos, riesgos, restricciones, valor ganado, pronóstico, alertas tempranas,
            reportes ejecutivos e inteligencia aplicada al proyecto en una sola plataforma.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <Link
              href="/project-manager"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                padding: "0 22px",
                borderRadius: 12,
                background: "#edcb71",
                color: "#071d38",
                textDecoration: "none",
                fontWeight: 900,
              }}
            >
              Entrar a Certeza Project Manager →
            </Link>
            <span style={{ display: "inline-flex", alignItems: "center", color: "#9fb2c6", fontSize: 14 }}>
              Acceso controlado para usuarios autorizados
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
