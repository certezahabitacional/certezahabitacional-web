import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Grupo Certeza | Certeza Técnica y Certeza Habitacional",
  description:
    "Dos soluciones, una misma filosofía de confianza. Accede a Certeza Técnica o Certeza Habitacional.",
};

const benefits = [
  { icon: "◎", title: "Metodología", text: "Procesos rigurosos y estandarizados." },
  { icon: "▣", title: "Tecnología", text: "Herramientas avanzadas para mejores resultados." },
  { icon: "◇", title: "Confianza", text: "Experiencia, transparencia y compromiso." },
];

export default function GrupoCertezaHome() {
  return (
    <main className="grupo-root">
      <header className="grupo-header">
        <div className="grupo-header-inner">
          <Link href="/" className="grupo-brand" aria-label="Grupo Certeza">
            <span className="grupo-wordmark">CERTEZ<span>A</span></span>
            <small>Grupo Certeza</small>
          </Link>

          <nav className="grupo-nav" aria-label="Navegación principal">
            <Link href="/" className="active">Inicio</Link>
            <Link href="/certeza-tecnica">Certeza Técnica</Link>
            <Link href="/certeza-habitacional">Certeza Habitacional</Link>
            <Link href="/nosotros">Nosotros</Link>
            <a href="mailto:contacto@certezahabitacional.com">Contacto</a>
          </nav>

          <Link href="/login" className="access-button">♙ <span>Acceso clientes</span></Link>
        </div>
      </header>

      <section className="grupo-hero">
        <div className="grupo-hero-copy">
          <h1>Dos soluciones, una misma filosofía de confianza.</h1>
          <p>Selecciona la división que deseas explorar.</p>
          <span className="hero-accent" />
        </div>

        <div className="division-grid">
          <article className="division-card tecnica">
            <Image
              src="/branding/nosotros-plataforma-aprobada.png"
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
              className="division-bg"
            />
            <div className="division-overlay" />
            <div className="division-content">
              <div className="division-topline"><span /> DIAGNÓSTICO Y RESPALDO TÉCNICO</div>

              <div className="division-heading-row">
                <div>
                  <h2>CERTEZA <strong>TÉCNICA</strong></h2>
                  <p>
                    Servicios técnicos, análisis especializados, evaluación profesional
                    y soluciones con enfoque técnico.
                  </p>
                </div>
                <Image
                  src="/branding/logo-certeza-tecnica.webp"
                  alt="Certeza Técnica"
                  width={128}
                  height={128}
                  className="division-logo tecnica-logo"
                />
              </div>

              <div className="feature-row">
                <span><b>▥</b>Diagnóstico</span>
                <span><b>▤</b>Evaluación</span>
                <span><b>⚙</b>Soporte técnico</span>
              </div>

              <Link href="/certeza-tecnica" className="division-button gold">
                Entrar a Certeza Técnica <span>→</span>
              </Link>
            </div>
          </article>

          <article className="division-card habitacional">
            <Image
              src="/branding/nosotros-hero-aprobado.png"
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
              className="division-bg"
            />
            <div className="division-overlay" />
            <div className="division-content">
              <div className="division-topline"><span /> INSPECCIONES DE VIVIENDA</div>

              <div className="division-heading-row">
                <div>
                  <h2>CERTEZA <strong>HABITACIONAL</strong></h2>
                  <h3>Conoce tu casa antes de hacerla tuya.</h3>
                  <p>
                    Inspecciones profesionales de vivienda para ayudarte a conocer mejor
                    el inmueble antes de tomar una decisión importante.
                  </p>
                </div>
                <div className="habitacional-logo-wrap">
                  <Image
                    src="/branding/logo-certeza-habitacional-azul.webp"
                    alt="Certeza Habitacional"
                    width={128}
                    height={128}
                    className="division-logo"
                  />
                </div>
              </div>

              <div className="feature-row">
                <span><b>⌂</b>Inspecciones</span>
                <span><b>◇</b>Método Certeza</span>
                <span><b>▣</b>Tecnología</span>
              </div>

              <Link href="/certeza-habitacional" className="division-button blue">
                Entrar a Certeza Habitacional <span>→</span>
              </Link>
              <p className="preserve-note">ⓘ La página actual de Certeza Habitacional se conserva sin cambios al ingresar.</p>
            </div>
          </article>
        </div>

        <div className="trust-strip">
          {benefits.map((item) => (
            <div key={item.title} className="trust-item">
              <div className="trust-icon">{item.icon}</div>
              <div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="grupo-footer">
        <span>© {new Date().getFullYear()} Grupo Certeza. Todos los derechos reservados.</span>
        <span className="footer-tagline"><i /> MISMAS PERSONAS. MÁS CERTEZA.</span>
      </footer>
    </main>
  );
}
