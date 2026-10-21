import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const accesos = [
  ["🎯", "Resumen ejecutivo", "Estado general, salud, decisiones y prioridades."],
  ["📅", "Planeación", "Línea base, EDT, programa, Look Ahead e hitos."],
  ["💰", "Costos y EVM", "Presupuesto, costo, CPI, SPI y proyección al cierre."],
  ["⚠️", "Riesgos", "Riesgos, tratamientos y exposición residual."],
  ["🚧", "Restricciones", "Pendientes que pueden impedir la ejecución."],
  ["🔄", "Cambios", "Solicitudes, impactos, autorizaciones y trazabilidad."],
  ["📑", "Reportes", "Reportes ejecutivos, snapshots y comparativos."],
  ["🤖", "Inteligencia Certeza", "Alertas, análisis, agentes y recomendaciones."],
];

export default async function ProjectManagerPanelPage() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");

  return (
    <main style={{ minHeight: "100vh", background: "#06172c", color: "#fff" }}>
      <header style={{ maxWidth: 1440, margin: "0 auto", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/project-manager" style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>← Project Manager</Link>
        <div style={{ textAlign: "right" }}>
          <strong style={{ color: "#edcb71" }}>CERTEZA PROJECT MANAGER</strong>
          <div style={{ color: "#8fa5bb", fontSize: 13 }}>{session.user.name ?? session.user.email}</div>
        </div>
      </header>

      <section style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 22px 54px" }}>
        <p style={{ margin: 0, color: "#edcb71", fontWeight: 900, letterSpacing: ".08em", fontSize: 12 }}>PANEL OPERATIVO WEB</p>
        <h1 style={{ margin: "7px 0 8px", fontSize: "clamp(34px, 5vw, 54px)" }}>Centro de Control</h1>
        <p style={{ margin: 0, color: "#aabaca", maxWidth: 820, lineHeight: 1.55 }}>
          Esta es la estructura web de entrada. Los módulos se habilitarán con los datos migrados desde Certeza Project Manager v1.9.0, manteniendo permisos y trazabilidad por proyecto.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 28 }}>
          {accesos.map(([icono, titulo, descripcion]) => (
            <article key={titulo} style={{ minHeight: 150, borderRadius: 16, border: "1px solid rgba(255,255,255,.10)", background: "#0a223d", padding: 20 }}>
              <span style={{ fontSize: 30 }}>{icono}</span>
              <h2 style={{ margin: "12px 0 6px", fontSize: 20 }}>{titulo}</h2>
              <p style={{ margin: 0, color: "#9fb2c6", lineHeight: 1.5 }}>{descripcion}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
