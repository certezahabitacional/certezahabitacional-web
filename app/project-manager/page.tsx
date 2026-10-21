import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Certeza Project Manager | Certeza Técnica",
  description: "Plataforma de planeación, administración, control y pronóstico de proyectos de construcción.",
};

const capacidades = [
  ["🎯", "Concepto rector", "Planear, medir, analizar, pronosticar y decidir."],
  ["🧩", "Sistema integrado", "Una sola fuente de información para todo el proyecto."],
  ["📋", "Línea base", "Alcance, costo, plazo y recursos autorizados."],
  ["📅", "Planeación integrada", "Cronograma maestro, Look Ahead y compromisos."],
  ["👷", "Ejecución y campo", "Avance, recursos, evidencias e incidencias."],
  ["📊", "Control integrado", "Avance + costo + productividad."],
  ["📈", "Forecast", "EAC, ETC, VAC y fecha probable de cierre."],
  ["⚠️", "Riesgos", "Causa, evento, consecuencia y tratamiento."],
  ["🚧", "Restricciones", "Liberar el trabajo antes de que se retrase."],
  ["🔄", "Alcance y cambios", "Evaluación, autorización y trazabilidad."],
  ["🗂️", "Multiproyecto", "Portafolio ejecutivo y priorización."],
  ["📑", "Reporte ejecutivo", "Información concreta para decidir."],
  ["📐", "Gestión del alcance", "Requisitos, entregables y exclusiones."],
  ["💹", "Valor ganado EVM", "PV, EV, AC, SPI, CPI y proyecciones."],
  ["🩺", "Salud del proyecto", "Diagnóstico integral del desempeño."],
  ["🔔", "Alertas tempranas", "Dato → tendencia → umbral → acción."],
  ["⚙️", "Productividad y Lean", "Rendimiento, desperdicio y mejora continua."],
  ["🔀", "Gestión híbrida", "Estructura predictiva + adaptación operativa."],
  ["🤖", "IA y agentes", "Análisis y recomendaciones bajo gobierno humano."],
  ["🛣️", "Hoja de ruta", "Adopción, madurez y escalamiento."],
];

export default async function ProjectManagerPage() {
  const session = await auth();

  return (
    <main style={{ minHeight: "100vh", background: "#06172c", color: "#fff" }}>
      <header
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "18px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link href="/certeza-tecnica" style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>
          ← Certeza Técnica
        </Link>
        <span style={{ color: "#edcb71", fontWeight: 900 }}>CERTEZA PROJECT MANAGER</span>
      </header>

      <section style={{ maxWidth: 1440, margin: "0 auto", padding: "34px 22px 20px" }}>
        <div
          style={{
            border: "1px solid rgba(237,203,113,.35)",
            borderRadius: 22,
            padding: "clamp(24px, 5vw, 54px)",
            background: "linear-gradient(135deg, #0d315a 0%, #071d38 58%, #10263e 100%)",
          }}
        >
          <p style={{ margin: 0, color: "#edcb71", fontWeight: 900, letterSpacing: ".09em", fontSize: 13 }}>
            CERTEZA TÉCNICA
          </p>
          <h1 style={{ margin: "10px 0 10px", fontSize: "clamp(38px, 7vw, 72px)", lineHeight: .98 }}>
            Project Manager
          </h1>
          <p style={{ maxWidth: 950, color: "#d4dfeb", fontSize: 19, lineHeight: 1.6, marginBottom: 0 }}>
            Plataforma inteligente para planear, administrar, controlar y pronosticar proyectos de construcción.
            Mucho análisis detrás, poca información al frente.
          </p>

          <div style={{ marginTop: 24 }}>
            {session?.user ? (
              <div
                style={{
                  display: "inline-flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(70,180,120,.12)",
                  border: "1px solid rgba(70,180,120,.35)",
                  color: "#bce7cd",
                }}
              >
                <strong>Sesión activa:</strong>
                <span>{session.user.name ?? session.user.email ?? "Usuario autorizado"}</span>
              </div>
            ) : (
              <Link
                href="/login"
                style={{
                  display: "inline-flex",
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 22px",
                  borderRadius: 12,
                  background: "#edcb71",
                  color: "#071d38",
                  textDecoration: "none",
                  fontWeight: 900,
                }}
              >
                Iniciar sesión para operar →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1440, margin: "0 auto", padding: "18px 22px 54px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "end", flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <p style={{ margin: 0, color: "#edcb71", fontWeight: 800, fontSize: 13, letterSpacing: ".06em" }}>
              MAPA DE CONTROL CERTEZA
            </p>
            <h2 style={{ margin: "5px 0 0", fontSize: 30 }}>20 capacidades integradas</h2>
          </div>
          <p style={{ margin: 0, color: "#8fa5bb", maxWidth: 620, lineHeight: 1.5 }}>
            Cada concepto tendrá una función operativa, un indicador visible y acceso directo dentro del sistema web.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(245px, 1fr))",
            gap: 14,
          }}
        >
          {capacidades.map(([icono, titulo, descripcion], index) => (
            <article
              key={titulo}
              style={{
                border: "1px solid rgba(255,255,255,.10)",
                borderRadius: 16,
                padding: 18,
                background: "#0a223d",
                minHeight: 150,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 30 }}>{icono}</span>
                <span style={{ color: "#edcb71", fontWeight: 900, fontSize: 12 }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 style={{ margin: "12px 0 6px", fontSize: 19 }}>{titulo}</h3>
              <p style={{ margin: 0, color: "#aabaca", lineHeight: 1.45, fontSize: 14 }}>{descripcion}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
