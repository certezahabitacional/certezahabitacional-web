import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const accesos = [
  ["🏗️", "Proyectos", "Proyecto, línea base, EDT, programa y presupuesto.", "/project-manager/panel/proyectos"],
  ["🗂️", "Portafolio", "Visión ejecutiva de múltiples proyectos.", "/project-manager/panel/portafolio"],
  ["🎯", "Resumen ejecutivo", "Estado general, salud, decisiones y prioridades.", "/project-manager/panel/proyectos/pr-0002/resumen"],
  ["🩺", "Salud del proyecto", "Índice integral y diagnóstico por dimensiones.", "/project-manager/panel/proyectos/pr-0002/salud"],
  ["🔔", "Alertas tempranas", "Dato, tendencia, umbral, causa y acción.", "/project-manager/panel/proyectos/pr-0002/alertas"],
  ["✍️", "Captura de corte", "Avance, productividad, costos reales y evidencias.", "/project-manager/panel/proyectos/pr-0002/captura"],
  ["📅", "Planeación", "Línea base, EDT, programa, Look Ahead e hitos.", "/project-manager/panel/proyectos/pr-0002"],
  ["🏗️", "Avance", "Avance físico y financiero contra la línea base.", "/project-manager/panel/proyectos/pr-0002/avance"],
  ["⚙️", "Productividad", "Rendimiento, HH por unidad, retrabajo e improductividad.", "/project-manager/panel/proyectos/pr-0002/productividad"],
  ["📊", "EVM", "PV, EV, AC, SPI, CPI, SV y CV.", "/project-manager/panel/proyectos/pr-0002/evm"],
  ["📈", "Forecast", "EAC, ETC, VAC y fecha probable de cierre.", "/project-manager/panel/proyectos/pr-0002/forecast"],
  ["⚠️", "Riesgos", "Riesgos, tratamientos y exposición residual.", "/project-manager/panel/proyectos/pr-0002/riesgos"],
  ["🚧", "Restricciones", "Pendientes que pueden impedir la ejecución.", "/project-manager/panel/proyectos/pr-0002/restricciones"],
  ["🔄", "Cambios", "Solicitudes, impactos, autorizaciones y trazabilidad.", "/project-manager/panel/proyectos/pr-0002/cambios"],
  ["✅", "Decisiones", "Asuntos que requieren resolución humana.", "/project-manager/panel/proyectos/pr-0002/decisiones"],
  ["👥", "Accesos", "Permisos por proyecto y perfil externo.", "/project-manager/panel/accesos"],
  ["🌐", "Portal del cliente", "Vista externa controlada de PR-0002.", "/project-manager/portal/pr-0002"],
  ["📑", "Reportes", "Reportes ejecutivos, snapshots y comparativos.", "/project-manager/panel/reportes"],
  ["🤖", "Inteligencia Certeza", "Alertas, análisis, agentes y recomendaciones.", "/project-manager/panel/inteligencia"],
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
        <p style={{ margin: 0, color: "#aabaca", maxWidth: 960, lineHeight: 1.55 }}>
          PR-0002 ya integra planeación, captura de corte, costo, riesgos, restricciones, decisiones, avance, productividad, EVM, forecast, salud, alertas, reportes, portafolio, accesos, portal de cliente e inteligencia Certeza.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 28 }}>
          {accesos.map(([icono, titulo, descripcion, href]) => (
            <Link key={titulo} href={href} style={{ textDecoration: "none", color: "inherit" }}>
              <article style={{ minHeight: 150, borderRadius: 16, border: "1px solid rgba(255,255,255,.10)", background: "#0a223d", padding: 20 }}>
                <span style={{ fontSize: 30 }}>{icono}</span>
                <h2 style={{ margin: "12px 0 6px", fontSize: 20 }}>{titulo}</h2>
                <p style={{ margin: 0, color: "#9fb2c6", lineHeight: 1.5 }}>{descripcion}</p>
                <div style={{ marginTop: 14, color: "#edcb71", fontWeight: 800, fontSize: 14 }}>Abrir módulo →</div>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
