import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Certeza Técnica | Portafolio de servicios",
  description: "Servicios de presupuestación, planeación, supervisión y dirección de proyectos de Certeza Técnica.",
};

const areas = [
  {
    number: "01",
    title: "Presupuestos y Costos",
    description: "Control económico para tomar decisiones con información técnica confiable.",
    services: ["Presupuestación de obras y proyectos", "Análisis de costos y precios unitarios", "Control y seguimiento presupuestal"],
  },
  {
    number: "02",
    title: "Planeación y Administración",
    description: "Organización de recursos, actividades y tiempos durante el desarrollo del proyecto.",
    services: ["Programación de actividades", "Administración y coordinación de obra", "Seguimiento del programa de trabajo"],
  },
  {
    number: "03",
    title: "Supervisión y Auditoría",
    description: "Revisión técnica y seguimiento de la ejecución para respaldar la calidad de los trabajos.",
    services: ["Supervisión técnica de obra", "Auditorías y revisiones de avance", "Verificación de calidad y cumplimiento"],
  },
  {
    number: "04",
    title: "Dirección y Desarrollo",
    description: "Acompañamiento en la gestión y conducción integral de proyectos constructivos.",
    services: ["Dirección de proyectos", "Coordinación de especialidades", "Asesoría para desarrollo de proyectos"],
  },
];

export default function CertezaTecnicaPage() {
  return (
    <main style={{ background: "#071d38", color: "#fff", minHeight: "100vh" }}>
      <header style={{ maxWidth: 1180, margin: "auto", padding: "22px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Link href="/" style={{ color: "white", textDecoration: "none", fontWeight: 600 }}>← Volver a Grupo Certeza</Link>
        <span style={{ color: "#e9c67c", fontWeight: 800, letterSpacing: "0.09em" }}>CERTEZA TÉCNICA</span>
      </header>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 24px 70px" }} aria-labelledby="portfolio-title">
        <div style={{ textAlign: "center", marginBottom: 45 }}>
          <p style={{ color: "#e9c67c", letterSpacing: "0.18em", fontSize: 13, fontWeight: 700 }}>PORTAFOLIO DE SERVICIOS</p>
          <h1 id="portfolio-title" style={{ fontSize: "clamp(2.3rem, 5vw, 4.5rem)", lineHeight: 1.08, margin: "12px auto 18px", maxWidth: 900 }}>Soluciones técnicas para cada etapa de tu proyecto</h1>
          <p style={{ fontSize: "clamp(1rem, 2vw, 1.15rem)", lineHeight: 1.7, color: "#d7e2ef", margin: "0 auto", maxWidth: 780 }}>
            Planeación, presupuestos, supervisión y dirección, con una visión integral del proceso constructivo.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 20 }}>
          {areas.map((area) => (
            <article key={area.number} style={{ background: "#102c4b", border: "1px solid #51708a", borderTop: "4px solid #dfb96b", borderRadius: 14, padding: "30px 28px", boxShadow: "0 12px 28px rgba(0,0,0,.16)" }}>
              <span style={{ color: "#e9c67c", fontWeight: 800, fontSize: 14 }}>{area.number} / CERTEZA TÉCNICA</span>
              <h2 style={{ fontSize: "clamp(1.4rem, 2.5vw, 1.9rem)", lineHeight: 1.2, margin: "14px 0" }}>{area.title}</h2>
              <p style={{ color: "#e2eaf3", lineHeight: 1.7 }}>{area.description}</p>
              <ul style={{ paddingLeft: 22, color: "#eef3fa", lineHeight: 1.85, marginTop: 20 }}>
                {area.services.map((service) => <li key={service}>{service}</li>)}
              </ul>
            </article>
          ))}
        </div>
        <div style={{ textAlign: "center", padding: "40px 16px 0" }}>
          <p style={{ color: "#e9c67c", fontWeight: 700, fontSize: 18 }}>Certeza técnica para construir con confianza.</p>
          <Link href="/contacto" style={{ display: "inline-block", color: "#071d38", background: "#e9c67c", borderRadius: 8, padding: "14px 26px", fontWeight: 800, textDecoration: "none", marginTop: 10 }}>Solicitar información</Link>
        </div>
      </section>
    </main>
  );
}
