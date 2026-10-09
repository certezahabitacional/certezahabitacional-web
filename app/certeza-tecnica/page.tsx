import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Certeza Técnica | Servicios técnicos para proyectos y construcción",
  description:
    "Presupuestos y costos, revisión y auditoría de presupuestos, supervisión y auditoría, dirección y desarrollo de proyectos.",
};

const services = [
  {
    number: "01",
    title: "Presupuestos y Costos",
    summary:
      "Integramos presupuestos claros, trazables y técnicamente sustentados para conocer el costo real de un proyecto antes de comprometer recursos.",
    items: [
      "Catálogos de conceptos y cuantificaciones",
      "Análisis de precios unitarios",
      "Presupuesto base y escenarios de costo",
      "Control y actualización de costos",
    ],
  },
  {
    number: "02",
    title: "Revisión y Auditoría de Presupuestos",
    summary:
      "Revisamos presupuestos existentes para detectar diferencias, duplicidades, omisiones, precios fuera de mercado y riesgos económicos.",
    items: [
      "Validación de cantidades y alcances",
      "Revisión de precios unitarios",
      "Comparativos y desviaciones",
      "Informe de observaciones y oportunidades de ahorro",
    ],
  },
  {
    number: "03",
    title: "Supervisión y Auditoría",
    summary:
      "Damos seguimiento técnico y documental a la ejecución para verificar que obra, calidad, avance y recursos correspondan con lo contratado.",
    items: [
      "Supervisión de calidad y procesos",
      "Seguimiento físico y documental",
      "Revisión de estimaciones y avances",
      "Auditoría técnica de obra y contratistas",
    ],
  },
  {
    number: "04",
    title: "Dirección y Desarrollo",
    summary:
      "Acompañamos proyectos desde su definición hasta su ejecución, coordinando decisiones técnicas, económicas y operativas.",
    items: [
      "Planeación y definición de alcances",
      "Coordinación de especialidades",
      "Estrategia de contratación y ejecución",
      "Dirección integral y control del proyecto",
    ],
  },
];

const steps = [
  ["01", "Entender", "Definimos objetivo, alcance, información disponible y nivel de profundidad requerido."],
  ["02", "Analizar", "Revisamos información técnica, económica y contractual con criterios verificables."],
  ["03", "Controlar", "Convertimos hallazgos y datos en decisiones, prioridades, controles y seguimiento."],
  ["04", "Respaldar", "Entregamos resultados claros, documentados y útiles para decidir con mayor certeza."],
];

export default function CertezaTecnicaPage() {
  return (
    <main className="ct-root">
      <header className="ct-header">
        <div className="ct-header-inner">
          <Link href="/certeza-tecnica" className="ct-brand" aria-label="Certeza Técnica">
            <Image
              src="/branding/logo-certeza-tecnica.png"
              alt="Certeza Técnica"
              width={58}
              height={58}
              priority
            />
            <div>
              <strong>CERTEZA TÉCNICA</strong>
              <span>Diagnóstico · Control · Dirección</span>
            </div>
          </Link>

          <nav className="ct-nav" aria-label="Navegación Certeza Técnica">
            <a href="#servicios">Servicios</a>
            <a href="#metodo">Cómo trabajamos</a>
            <a href="#contacto">Contacto</a>
          </nav>

          <Link href="/" className="ct-back">
            ← Grupo Certeza
          </Link>
        </div>
      </header>

      <section className="ct-hero">
        <Image
          src="/branding/nosotros-plataforma-aprobada.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="ct-hero-image"
        />
        <div className="ct-hero-overlay" />
        <div className="ct-shell ct-hero-content">
          <div className="ct-eyebrow"><span /> CERTEZA TÉCNICA</div>
          <h1>
            Control técnico y económico para
            <em> tomar mejores decisiones.</em>
          </h1>
          <p>
            Acompañamos proyectos de construcción con información confiable,
            revisión independiente y seguimiento profesional para reducir
            desviaciones, anticipar riesgos y proteger la inversión.
          </p>

          <div className="ct-hero-actions">
            <a href="#servicios" className="ct-button ct-button-gold">
              Conocer servicios <span>↓</span>
            </a>
            <a href="mailto:contacto@certezahabitacional.com" className="ct-button ct-button-ghost">
              Solicitar información
            </a>
          </div>

          <div className="ct-hero-metrics">
            <div><b>4</b><span>líneas de servicio</span></div>
            <div><b>360°</b><span>visión técnica y económica</span></div>
            <div><b>1</b><span>criterio: información verificable</span></div>
          </div>
        </div>
      </section>

      <section className="ct-intro">
        <div className="ct-shell ct-intro-grid">
          <div>
            <span className="ct-section-kicker">NUESTRO ENFOQUE</span>
            <h2>Más control antes, durante y después de cada decisión.</h2>
          </div>
          <p>
            Certeza Técnica nace para apoyar a propietarios, desarrolladores,
            inversionistas y empresas que necesitan una lectura independiente
            de costos, avances, calidad y viabilidad. Nuestro trabajo busca que
            cada decisión tenga respaldo técnico y económico, no sólo percepción.
          </p>
        </div>
      </section>

      <section id="servicios" className="ct-services">
        <div className="ct-shell">
          <div className="ct-section-head">
            <div>
              <span className="ct-section-kicker">SERVICIOS</span>
              <h2>Cuatro líneas para controlar mejor un proyecto.</h2>
            </div>
            <p>
              Podemos intervenir de manera puntual en una etapa específica o
              acompañar integralmente el proyecto.
            </p>
          </div>

          <div className="ct-service-grid">
            {services.map((service) => (
              <article key={service.number} className="ct-service-card">
                <div className="ct-service-number">{service.number}</div>
                <h3>{service.title}</h3>
                <p>{service.summary}</p>
                <ul>
                  {service.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <a href="mailto:contacto@certezahabitacional.com" className="ct-service-link">
                  Consultar este servicio <span>→</span>
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="metodo" className="ct-method">
        <div className="ct-shell">
          <div className="ct-section-head ct-section-head-light">
            <div>
              <span className="ct-section-kicker">FORMA DE TRABAJO</span>
              <h2>Una ruta simple para convertir información en control.</h2>
            </div>
            <p>
              Cada intervención debe dejar evidencia, criterio y una ruta clara
              de decisión.
            </p>
          </div>

          <div className="ct-steps">
            {steps.map(([number, title, text]) => (
              <div key={number} className="ct-step">
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contacto" className="ct-cta">
        <div className="ct-shell ct-cta-inner">
          <div>
            <span className="ct-section-kicker">HABLEMOS DE TU PROYECTO</span>
            <h2>Antes de comprometer recursos, construyamos certeza.</h2>
            <p>
              Cuéntanos en qué etapa se encuentra tu proyecto y qué necesitas
              revisar, controlar o desarrollar.
            </p>
          </div>
          <a href="mailto:contacto@certezahabitacional.com" className="ct-button ct-button-gold">
            Contactar a Certeza Técnica <span>→</span>
          </a>
        </div>
      </section>

      <footer className="ct-footer">
        <div className="ct-shell ct-footer-inner">
          <span>© 2026 Certeza Técnica · Grupo Certeza</span>
          <Link href="/">← Regresar a Grupo Certeza</Link>
        </div>
      </footer>
    </main>
  );
}
