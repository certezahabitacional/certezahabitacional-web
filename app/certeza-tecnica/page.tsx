import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Certeza Técnica | Administración y presupuestación de obras",
  description:
    "Presupuestos y costos, revisión y auditoría de presupuestos, supervisión y auditoría, dirección y desarrollo de obras de edificación.",
};

const services = [
  {
    number: "01",
    title: "Presupuestos y Costos",
    summary:
      "Elaboración y análisis de presupuestos con alto nivel de detalle y precisión para tomar mejores decisiones.",
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
      "Validación técnica independiente para asegurar la precisión, transparencia y rentabilidad de tus proyectos.",
    items: [
      "Validación de cantidades y alcances",
      "Revisión de precios unitarios",
      "Comparativos y desviaciones",
      "Detección de omisiones y oportunidades de ahorro",
    ],
  },
  {
    number: "03",
    title: "Supervisión y Auditoría",
    summary:
      "Control técnico y seguimiento en campo para garantizar la correcta ejecución de la obra conforme a proyecto y presupuesto.",
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
      "Acompañamiento estratégico en todas las etapas del proyecto para lograr resultados exitosos y sostenibles.",
    items: [
      "Planeación y definición de alcances",
      "Coordinación de especialidades",
      "Estrategia de contratación y ejecución",
      "Dirección integral y control del proyecto",
    ],
  },
];

const values = [
  ["◎", "Enfoque en resultados", "Optimizamos recursos y generamos valor real en cada proyecto."],
  ["⚖", "Transparencia y objetividad", "Análisis independientes y procesos claros que brindan confianza."],
  ["♙", "Experiencia en el sector", "Conocimiento técnico y práctica comprobada en obras de edificación."],
  ["⚙", "Soluciones a la medida", "Nos adaptamos a las necesidades específicas de cada cliente y proyecto."],
];

const steps = [
  ["1", "Análisis", "Estudiamos tus necesidades, proyecto y objetivos."],
  ["2", "Planeación", "Definimos la estrategia técnica y el plan de trabajo."],
  ["3", "Ejecución y Control", "Implementamos, supervisamos y damos seguimiento."],
  ["4", "Resultados", "Entregamos certeza, valor y bases para el éxito."],
];

export default function CertezaTecnicaPage() {
  return (
    <main className="ct-root">
      <header className="ct-header">
        <div className="ct-header-inner">
          <Link href="/certeza-tecnica" className="ct-brand ct-brand-authorized" aria-label="Certeza Técnica">
            <Image
              src="/branding/logo-certeza-tecnica.png"
              alt="Certeza Técnica - Servicios de Administración y Presupuestación de Obras de Edificación"
              width={260}
              height={100}
              priority
            />
          </Link>

          <nav className="ct-nav" aria-label="Navegación Certeza Técnica">
            <Link href="/">Inicio</Link>
            <Link href="/certeza-tecnica" className="is-active">Certeza Técnica</Link>
            <Link href="/certeza-habitacional">Certeza Habitacional</Link>
            <Link href="/nosotros">Nosotros</Link>
            <a href="mailto:contacto@certezahabitacional.com">Contacto</a>
          </nav>

          <Link href="/login" className="ct-back">
            ♙ Acceso clientes
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

        <div className="ct-hero-logo-mark" aria-hidden="true">
          <Image
            src="/branding/logo-certeza-tecnica.png"
            alt=""
            width={170}
            height={170}
            priority
          />
        </div>

        <div className="ct-shell ct-hero-content">
          <div className="ct-eyebrow"><span /> SERVICIOS DE ADMINISTRACIÓN Y PRESUPUESTACIÓN</div>
          <h1>
            CERTEZA
            <em>TÉCNICA</em>
          </h1>
          <h2>Experiencia, análisis y control para proyectos más eficientes, seguros y rentables.</h2>
          <p>
            Soluciones técnicas y estratégicas para la administración,
            presupuestación y control de obras de edificación.
          </p>

          <div className="ct-hero-actions">
            <a href="#servicios" className="ct-button ct-button-gold">
              Conoce nuestros servicios <span>→</span>
            </a>
          </div>

          <div className="ct-hero-metrics ct-hero-benefits">
            <div><b>▣</b><span>Proyectos<br />más eficientes</span></div>
            <div><b>◇</b><span>Obras<br />más seguras</span></div>
            <div><b>▥</b><span>Mayor<br />rentabilidad</span></div>
          </div>
        </div>
      </section>

      <section id="servicios" className="ct-services">
        <div className="ct-shell">
          <div className="ct-section-head ct-section-head-centered">
            <div>
              <span className="ct-section-kicker">NUESTROS SERVICIOS</span>
              <h2>Soluciones especializadas para cada etapa de tu proyecto</h2>
              <p className="ct-section-subtitle">
                Aportamos certeza técnica, control y valor en la administración de obras de edificación.
              </p>
            </div>
          </div>

          <div className="ct-service-grid ct-service-grid-four">
            {services.map((service) => (
              <article key={service.number} className="ct-service-card">
                <div className="ct-service-badge">
                  <Image
                    src="/branding/logo-certeza-tecnica.png"
                    alt=""
                    width={54}
                    height={54}
                  />
                </div>
                <div className="ct-service-number">{service.number}</div>
                <h3>{service.title}</h3>
                <p>{service.summary}</p>
                <ul>
                  {service.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <a href="mailto:contacto@certezahabitacional.com" className="ct-service-link">
                  Ver más <span>→</span>
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ct-value">
        <div className="ct-shell ct-value-grid">
          <div className="ct-value-copy">
            <span className="ct-section-kicker">NUESTRO VALOR</span>
            <h2>Más que números,<br />certeza <em>en cada obra.</em></h2>
            <p>
              Combinamos experiencia, rigor técnico y un compromiso real con el
              éxito de cada proyecto.
            </p>
          </div>

          <div className="ct-value-items">
            {values.map(([icon, title, text]) => (
              <div key={title} className="ct-value-item">
                <span>{icon}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="metodo" className="ct-method ct-method-light">
        <div className="ct-shell">
          <div className="ct-section-head">
            <div>
              <span className="ct-section-kicker">NUESTRA METODOLOGÍA</span>
              <h2>Un proceso claro para resultados de alto valor</h2>
            </div>
            <p>
              Aplicamos una metodología enfocada en análisis riguroso, control
              efectivo y acompañamiento durante todo el ciclo del proyecto.
            </p>
          </div>

          <div className="ct-steps ct-steps-light">
            {steps.map(([number, title, text]) => (
              <div key={number} className="ct-step ct-step-light">
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contacto" className="ct-cta ct-cta-dark">
        <div className="ct-shell ct-cta-inner">
          <div>
            <span className="ct-section-kicker">HABLEMOS DE TU PROYECTO</span>
            <h2>Planeamos y controlamos tu obra con certeza</h2>
            <p>
              Te ayudamos a tomar mejores decisiones con información técnica,
              confiable y orientada a resultados.
            </p>
          </div>

          <div className="ct-contact-actions">
            <ul>
              <li>Atención personalizada</li>
              <li>Respuesta oportuna</li>
              <li>Compromiso con tus objetivos</li>
            </ul>
            <a href="mailto:contacto@certezahabitacional.com" className="ct-button ct-button-gold">
              Contactar ahora <span>→</span>
            </a>
          </div>
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
