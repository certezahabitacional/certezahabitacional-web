import Image from "next/image";

import Link from "next/link";

const cotizarHref = "/cotizar";

const menu = [
  { label: "SERVICIOS", href: "/servicios" },
  { label: "MÉTODO CERTEZA", href: "/metodo" },
  { label: "TECNOLOGÍA", href: "/tecnologia" },
  { label: "INSPECCIONES", href: "/inspecciones" },
  { label: "NOSOTROS", href: "/nosotros" },
];

const inspectionItems = [
  { number: "01", icon: "○", label: "Humedad y filtraciones" },
  { number: "02", icon: "ϟ", label: "Instalaciones eléctricas" },
  { number: "03", icon: "▦", label: "Pisos y acabados" },
  { number: "04", icon: "♨", label: "Condiciones térmicas" },
  { number: "05", icon: "◎", label: "Elementos visibles" },
  { number: "06", icon: "⚙", label: "Funcionamiento general" },
];

const explica = [
  {
    category: "HUMEDAD",
    title: "¿Una mancha siempre significa una filtración?",
    text: "El origen de una señal de humedad puede ser distinto de lo que aparenta a simple vista.",
    number: "01",
  },
  {
    category: "PISOS",
    title: "¿Qué puede significar que una loseta suene hueca?",
    text: "Algunos sonidos pueden ser una señal que merece una revisión más cuidadosa.",
    number: "02",
  },
  {
    category: "ELECTRICIDAD",
    title: "¿Qué observamos en una instalación eléctrica?",
    text: "Una revisión ordenada permite documentar condiciones visibles y funcionales relevantes.",
    number: "03",
  },
  {
    category: "TECNOLOGÍA",
    title: "¿Qué puede ayudarnos a observar una cámara térmica?",
    text: "La termografía aporta información que complementa la inspección visual convencional.",
    number: "04",
  },
];

const conocimiento = [
  {
    eyebrow: "VIVIENDA NUEVA",
    title: "Nueva no necesariamente significa perfecta",
    description:
      "Conoce algunos puntos que conviene revisar antes de recibir una vivienda recién construida.",
  },
  {
    eyebrow: "VIVIENDA USADA",
    title: "Aprende a observar más allá de la primera impresión",
    description:
      "Una buena apariencia puede coexistir con condiciones que merecen una revisión más cuidadosa.",
  },
  {
    eyebrow: "ANTES DE FIRMAR",
    title: "La información también forma parte de una buena decisión",
    description:
      "Prepararte antes de comprometer tu patrimonio puede ayudarte a formular mejores preguntas.",
  },
];

const innovacion = [
  "Tecnología aplicada",
  "Metodología estructurada",
  "Sistema digital",
  "Capacitación continua",
  "Mejora constante",
];

const viviendaNuevaDetalles = [
  {
    number: "01",
    icon: "▰",
    title: "Acabados",
    text: "Revisa calidad, uniones, nivelación, sellos y detalles visibles antes de recibir tu vivienda.",
  },
  {
    number: "02",
    icon: "ϟ",
    title: "Instalaciones",
    text: "Verifica condiciones visibles y funcionamiento general de instalaciones eléctricas e hidráulicas.",
  },
  {
    number: "03",
    icon: "☑",
    title: "Funcionamiento",
    text: "Comprueba puertas, ventanas, llaves, sanitarios, contactos y otros elementos de uso cotidiano.",
  },
  {
    number: "04",
    icon: "⌕",
    title: "Detalles",
    text: "Observa más allá de la primera impresión y documenta condiciones que merecen seguimiento.",
  },
  {
    number: "05",
    icon: "◎",
    title: "Humedad",
    text: "Identifica señales visibles que conviene revisar antes de aceptar o habitar la vivienda.",
  },
  {
    number: "06",
    icon: "⚙",
    title: "Entrega",
    text: "Llega al proceso de entrega con información ordenada para formular mejores preguntas.",
  },
];


export default function Home() {

  return (
    <main className="home-root">
      <section className="home-hero-section">
        <div className="home-hero-bg" />

        <header className="home-header">
          <div className="home-header-inner">
            <Link href="/" aria-label="Inicio Certeza Habitacional" className="home-brand">
              <Image
                src="/branding/logo-autorizado.png"
                alt="Certeza Habitacional"
                width={260}
                height={210}
                priority
                loading="eager"
                style={{ width: "210px", height: "auto" }}
              />
            </Link>

            <nav className="home-nav">
              {menu.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="home-header-actions">
              <Link href="/login" className="btn btn-outline">
                <UserMenuIcon />
                Acceso clientes
              </Link>
              <Link href={cotizarHref} className="btn btn-gold">
                <QuoteMenuIcon />
                COTIZA TU INSPECCIÓN →
              </Link>
            </div>
          </div>
        </header>

        <div className="home-hero-wrap">
          <div className="home-hero-copy">
            <div className="eyebrow-row">
              <span className="eyebrow-dot" />
              <p>Información para decidir con certeza</p>
            </div>

            <h1>
              CONOCE TU CASA
              <br />
              ANTES DE HACERLA <span>TUYA.</span>
            </h1>

            <p className="home-hero-lead">
              Inspecciones profesionales de vivienda para ayudarte a conocer mejor
              el inmueble antes de tomar una decisión importante.
            </p>

            <div className="home-hero-buttons">
              <Link href={cotizarHref} className="btn btn-gold btn-lg">COTIZA TU INSPECCIÓN →</Link>
              <Link href="/inspecciones" className="btn btn-outline btn-lg">CONOCE NUESTRAS INSPECCIONES</Link>
            </div>

          </div>

          <div className="home-hero-media">
            <div className="hero-image-card">
              <Image
                src="/branding/nosotros-hero-aprobado.png"
                alt="Inspector de Certeza Habitacional frente a una vivienda"
                fill
                priority
                loading="eager"
                sizes="(max-width: 1024px) 100vw, 55vw"
                style={{ objectFit: "cover", objectPosition: "center" }}
              />
              <div className="hero-image-shade" />
              <div className="hero-image-footer">
                <span>INSPECCIÓN QUE DA TRANQUILIDAD</span>
              </div>
            </div>

            <div className="hero-inspection-panel">
              <h2>LO QUE NO SE VE, <span>TAMBIÉN IMPORTA.</span></h2>
              <div className="inspection-grid">
                {inspectionItems.map((item) => (
                  <div key={item.number} className="inspection-cell">
                    <div className="inspection-icon">{item.icon}</div>
                    <div>
                      <div className="inspection-number">{item.number}</div>
                      <div className="inspection-label">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="section-inner">
          <div className="section-head centered">
            <p className="section-kicker">Ahora en Certeza Habitacional</p>
            <h2>Una vivienda nueva también merece ser conocida.</h2>
            <p>
              La apariencia, la edad o el precio de una vivienda no sustituyen una revisión ordenada.
              Conocer sus condiciones antes de recibirla puede darte información valiosa para tomar mejores decisiones.
            </p>
          </div>

          <div className="feature-strip">
            <div className="feature-strip-copy">
              <span>VIVIENDA NUEVA</span>
              <strong>“Nueva” describe la antigüedad de una vivienda.<br />No necesariamente describe su condición.</strong>
            </div>

            <div className="feature-viewport">
              <div className="feature-slider feature-slider-static">
                {viviendaNuevaDetalles.slice(0, 4).map((item, index) => {
                  const featureImages = [
                    "/branding/home-acabados.png",
                    "/branding/home-instalaciones.png",
                    "/branding/home-funcionamiento.png",
                    "/branding/home-detalles.png",
                  ];

                  return (
                    <article key={item.number} className="feature-item feature-detail">
                      <div className="feature-copy">
                        <div className="feature-number">{item.number}</div>
                        <div className="feature-title">{item.title}</div>
                        <p>{item.text}</p>
                      </div>
                      <div className="feature-photo">
                        <img
                          src={featureImages[index]}
                          alt={item.title}
                          className="feature-photo-img"
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <div className="section-head split">
            <div>
              <p className="section-kicker">Certeza explica</p>
              <h2>Entender también da certeza.</h2>
            </div>
          </div>

          <div className="cards four">
            {explica.map((item) => (
              <article key={item.number} className="card">
                <div className="card-topline">
                  <span>{item.category}</span>
                  <span>{item.number}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="section-inner visual-split">
          <div>
            <p className="section-kicker">Mira más allá de lo evidente</p>
            <h2>Una inspección comienza donde termina una visita convencional.</h2>
            <p className="section-text">
              Observamos de manera sistemática, utilizamos herramientas de apoyo y documentamos información
              que puede ser relevante para comprender mejor una vivienda.
            </p>
          </div>

          <div className="compare-panel">
              <div className="compare-box compare-photo">
                <img src="/branding/home-simple-vista-clean.png" alt="Superficie observada a simple vista" className="compare-photo-img" />
                <div className="compare-overlay" />
                <div className="compare-copy">
                  <h3>A simple vista</h3>
                  <p>Una superficie puede parecer completamente normal.</p>
                </div>
              </div>
              <div className="compare-box compare-photo">
                <img src="/branding/home-otra-perspectiva-clean.png" alt="Vista térmica de una superficie" className="compare-photo-img" />
                <div className="compare-overlay compare-overlay-thermal" />
                <div className="compare-copy">
                  <h3>Otra perspectiva</h3>
                  <p>Algunas herramientas pueden aportar información adicional para orientar la inspección.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      <section className="section">
        <div className="section-inner">
          <p className="section-kicker">Antes de comprar</p>
          <h2 className="section-title-wide">Estás por tomar una decisión importante. <span>Esto te interesa.</span></h2>

          <div className="cards three">
            {conocimiento.map((item, index) => (
              <article key={item.eyebrow} className="card knowledge-card">
                <div className="card-topline">
                  <span>{item.eyebrow}</span>
                  <span>0{index + 1}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="section-inner innovation-layout">
          <div>
            <p className="section-kicker">Innovación Certeza Habitacional</p>
            <h2>La forma de inspeccionar también puede evolucionar.</h2>
            <p className="section-text">
              Combinamos metodología, tecnología, capacitación y herramientas digitales para mejorar continuamente
              la experiencia del cliente.
            </p>
          </div>

          <div className="innovation-grid">
            {innovacion.map((item, index) => (
              <div key={item} className="innovation-item">
                <span>0{index + 1}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner ecosystem ecosystem-clean">
          <div>
            <p className="section-kicker">Ecosistema Certeza Habitacional</p>
            <h2>Productos y servicios útiles para una nueva etapa de tu vivienda.</h2>
          </div>
        </div>
      </section>

      <section className="cta-final">
        <div className="section-inner cta-final-inner">
          <div>
            <p className="cta-kicker">Tu próxima vivienda</p>
            <h2 className="cta-home-title">Ya encontraste una casa. Ahora conócela.</h2>
          </div>
          <p>Inicia el proceso para solicitar una cotización de inspección Certeza Habitacional.</p>
          <Link href={cotizarHref} className="btn btn-dark btn-lg">COTIZA TU INSPECCIÓN →</Link>
        </div>
      </section>

      <footer className="home-footer">
        <div className="section-inner footer-grid">
          <div>
            <Image
              src="/branding/logo-autorizado.png"
              alt="Certeza Habitacional"
              width={250}
              height={190}
              style={{ width: "190px", height: "auto" }}
            />
            <p className="footer-slogan">Revisamos cada rincón antes de que des el si</p>
          </div>

          <div>
            <h4>EXPLORA</h4>
            {menu.map((item) => (
              <Link key={item.href} href="/proximamente">{item.label}</Link>
            ))}
          </div>

          <div>
            <h4>PARTICIPA</h4>
            <Link href="/proximamente">Únete a Certeza Habitacional</Link>
            <Link href="/proximamente">Quiero ser inspector</Link>
            <Link href="/proximamente">Quiero vender inspecciones</Link>
            <Link href="/proximamente">Alianzas</Link>
          </div>

          <div>
            <h4>AYUDA</h4>
            <a
              href="https://wa.me/526562871218"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-whatsapp"
              aria-label="Abrir WhatsApp al 656 287 12 18"
            >
              <svg
                className="whatsapp-svg"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M12 2a9.8 9.8 0 0 0-8.38 14.89L2.2 22l5.23-1.37A9.94 9.94 0 1 0 12 2Zm0 17.9a8 8 0 0 1-4.08-1.12l-.29-.17-3.1.81.83-3.02-.19-.31A7.91 7.91 0 1 1 12 19.9Zm4.35-5.92c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.47-.39-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.1.16 1.51.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
                />
              </svg>
              <span>WhatsApp 656 287 12 18</span>
            </a>
            <Link href="/portal">Acceso clientes</Link>
            <Link href={cotizarHref}>Cotizar inspección</Link>
            <a href="mailto:contacto@certezahabitacional.com">contacto@certezahabitacional.com</a>
          </div>

          <div className="footer-social-area">
            <div className="social-icons" aria-label="Redes sociales">
              <span className="social-icon" aria-label="LinkedIn" title="LinkedIn">in</span>
              <span className="social-icon" aria-label="Instagram" title="Instagram">◎</span>
              <span className="social-icon" aria-label="Facebook" title="Facebook">f</span>
              <span className="social-icon" aria-label="YouTube" title="YouTube">▶</span>
            </div>

            <div className="construction-note">
              <span className="construction-icon" aria-hidden="true">🚧</span>
              <div>
                <strong>Página en construcción</strong>
                <p>Seguimos trabajando para servirte mejor.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="section-inner footer-bottom">
          <p>© {new Date().getFullYear()} Certeza Habitacional. Todos los derechos reservados.</p>
          <div>
            <Link href="/aviso-privacidad">Aviso de privacidad</Link>
            <Link href="/terminos">Términos y condiciones</Link>
          </div>
        </div>
      </footer>

      <style>{`
        :root {
          --bg: #020b14;
          --bg2: #061422;
          --panel: #081522;
          --line: rgba(255,255,255,.12);
          --muted: #9db2c9;
          --gold: #d8a22f;
          --gold2: #efc55f;
        }

        .home-root {
          min-height: 100vh;
          overflow-x: hidden;
          background: var(--bg);
          color: white;
          font-family: Arial, Helvetica, sans-serif;
        }

        .home-root * { box-sizing: border-box; }
        .home-root a { text-decoration: none; color: inherit; }

        .home-hero-section {
          position: relative;
          overflow: hidden;
          min-height: 700px;
          background:
            radial-gradient(circle at 72% 18%, rgba(216,162,47,.10), transparent 28%),
            linear-gradient(135deg, #020912 0%, #06111d 52%, #020912 100%);
          border-bottom: 1px solid rgba(216,162,47,.35);
        }

        .home-hero-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.18));
        }

        .home-header {
          position: relative;
          z-index: 10;
        }

        .home-header-inner {
          width: min(1500px, calc(100% - 48px));
          margin: 0 auto;
          min-height: 136px;
          display: grid;
          grid-template-columns: 210px 1fr auto;
          gap: 28px;
          align-items: center;
        }

        .home-brand { display: inline-flex; align-items: center; }

        .home-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 26px;
          font-size: 14px;
          font-weight: 800;
        }

        .home-nav a:hover, .text-link:hover, .home-footer a:hover { color: var(--gold2); }

        .home-header-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .btn {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          padding: 0 20px;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: .01em;
          transition: transform .18s ease, background .18s ease, border-color .18s ease;
        }

        .btn:hover { transform: translateY(-1px); }

        .btn-lg { min-height: 54px; padding: 0 24px; }

        .btn-gold {
          background: linear-gradient(90deg, #a76c13, var(--gold), var(--gold2));
          color: #07111c;
          box-shadow: 0 12px 30px rgba(216,162,47,.20);
        }

        .btn-outline {
          border: 1px solid rgba(216,162,47,.75);
          background: rgba(255,255,255,.01);
          color: white;
        }

        .btn-dark {
          background: #020b14;
          color: white;
          border: 1px solid rgba(2,11,20,.3);
        }

        .home-hero-wrap {
          position: relative;
          z-index: 2;
          width: min(1500px, calc(100% - 48px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 46fr) minmax(0, 54fr);
          gap: 34px;
          align-items: center;
          padding: 6px 0 34px;
        }

        .home-hero-copy { padding: 4px 0 18px; }

        .eyebrow-row {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--gold2);
          text-transform: uppercase;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .06em;
        }

        .eyebrow-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--gold);
          flex: 0 0 auto;
        }

        .home-hero-copy h1 {
          margin: 18px 0 0;
          max-width: 650px;
          font-size: clamp(40px, 3.75vw, 60px);
          line-height: 1.04;
          letter-spacing: -.035em;
          font-weight: 950;
        }

        .home-hero-copy h1 span { color: var(--gold2); }

        .home-hero-lead {
          margin: 22px 0 0;
          max-width: 560px;
          color: #c8d4e1;
          font-size: 17px;
          line-height: 1.7;
        }

        .home-hero-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 28px;
        }

        .scroll-hint {
          margin-top: 22px;
          color: #90a7be;
          font-size: 14px;
        }

        .home-hero-media {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 16px;
        }

        .hero-image-card {
          position: relative;
          min-height: 320px;
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(216,162,47,.26);
          box-shadow: 0 24px 70px rgba(0,0,0,.35);
        }

        .hero-image-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(2,11,20,.02), rgba(2,11,20,.10));
          pointer-events: none;
        }

        .hero-image-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          min-height: 42px;
          display: flex;
          align-items: center;
          padding: 0 14px;
          background: linear-gradient(90deg, rgba(2,11,20,.98) 0%, rgba(2,11,20,.95) 36%, rgba(2,11,20,.84) 68%, rgba(2,11,20,.72) 100%);
          color: white;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .05em;
          text-transform: uppercase;
          pointer-events: none;
          z-index: 3;
        }

        .hero-inspection-panel {
          border: 1px solid rgba(255,255,255,.15);
          background: rgba(6,17,29,.92);
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 18px 55px rgba(0,0,0,.28);
        }

        .hero-inspection-panel h2 {
          margin: 0;
          padding: 20px 24px;
          font-size: 20px;
          font-weight: 950;
          border-bottom: 1px solid var(--line);
        }

        .hero-inspection-panel h2 span { color: var(--gold2); }

        .inspection-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
        }

        .inspection-cell {
          min-height: 90px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          border-right: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }

        .inspection-cell:nth-child(3n) { border-right: 0; }
        .inspection-cell:nth-child(n+4) { border-bottom: 0; }

        .inspection-icon { color: var(--gold2); font-size: 25px; line-height: 1; margin-top: 3px; }
        .inspection-number { color: var(--gold2); font-size: 11px; font-weight: 900; }
        .inspection-label { margin-top: 5px; font-size: 14px; line-height: 1.35; font-weight: 800; }

        .section {
          padding: 48px 0;
          background: var(--bg);
          border-bottom: 1px solid rgba(255,255,255,.07);
        }

        .section-soft { background: #06111d; }

        .section-inner {
          width: min(1300px, calc(100% - 48px));
          margin: 0 auto;
        }

        .section-head.three-col {
          display: grid;
          grid-template-columns: .95fr 1fr .35fr;
          gap: 30px;
          align-items: end;
        }

        .section-head.split {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 26px;
        }

        .section-kicker {
          margin: 0;
          color: var(--gold2);
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: .06em;
          font-weight: 900;
        }

        .section h2 {
          margin: 3px 0 0;
          font-size: clamp(24px, 2vw, 32px);
          line-height: 1.08;
          letter-spacing: -.025em;
          font-weight: 950;
        }

        .section h2 span, .section-title-wide span { color: var(--gold2); }

        .section-text,
        .section-head p,
        .ecosystem > p {
          color: var(--muted);
          font-size: 16px;
          line-height: 1.75;
        }

        .text-link {
          color: var(--gold2);
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
        }

        .text-link.small { font-size: 12px; }

        .feature-strip {
          margin-top: 30px;
          display: grid;
          grid-template-columns: 1.05fr 2.2fr;
          border: 1px solid var(--line);
          border-radius: 18px;
          overflow: hidden;
          background: #071522;
        }

        .feature-strip-copy {
          padding: 26px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 12px;
          background: #07111b;
        }

        .feature-strip-copy span,
        .feature-number {
          color: var(--gold2);
          font-size: 11px;
          font-weight: 900;
        }

        .feature-strip-copy strong {
          font-size: 17px;
          line-height: 1.55;
        }

        .feature-viewport {
          overflow: hidden;
          min-width: 0;
        }

        .feature-slider {
          display: flex;
          width: 100%;
        }

        .feature-slider-static .feature-item {
          flex: 0 0 25%;
        }

        .feature-item {
          min-height: 172px;
          flex: 0 0 25%;
          display: grid;
          grid-template-columns: minmax(0, 58%) minmax(0, 42%);
          align-items: stretch;
          gap: 0;
          padding: 0;
          border-left: 1px solid var(--line);
          text-align: left;
          overflow: hidden;
        }

        .feature-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 18px;
        }

        .feature-photo {
          position: relative;
          min-height: 172px;
          overflow: hidden;
        }

        .feature-photo-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
        }

        .feature-detail p {
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
        }


        .feature-icon { color: var(--gold2); font-size: 27px; }
        .feature-title { font-size: 14px; font-weight: 800; }

        .cards {
          display: grid;
          gap: 16px;
          margin-top: 26px;
        }

        .cards.four { grid-template-columns: repeat(4, 1fr); }
        .cards.three { grid-template-columns: repeat(3, 1fr); }

        .card {
          min-height: 276px;
          display: flex;
          flex-direction: column;
          padding: 22px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: #071522;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.02);
        }

        .card-topline {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          color: var(--gold2);
          font-size: 11px;
          font-weight: 900;
        }

        .card h3 {
          margin: 28px 0 0;
          font-size: 20px;
          line-height: 1.2;
          font-weight: 950;
        }

        .card p {
          margin: 16px 0 20px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        .card .text-link { margin-top: auto; }

                .visual-split {
          display: grid;
          grid-template-columns: .82fr 1.18fr;
          gap: 42px;
          align-items: center;
        }

        .innovation-layout,
        .ecosystem {
          display: grid;
          grid-template-columns: .82fr 1.18fr;
          gap: 38px;
          align-items: center;
        }

                .cta-final-inner {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px 235px;
          gap: 24px;
          align-items: center;
          min-height: 94px;
        }

                .compare-panel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          width: 100%;
          min-width: 0;
          min-height: 300px;
          border: 1px solid var(--line);
          border-radius: 18px;
          overflow: hidden;
        }

                .compare-box {
          position: relative;
          min-width: 0;
          min-height: 300px;
          overflow: hidden;
        }

        .compare-photo {
          position: relative;
        }

        .compare-photo-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
        }

        .compare-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(180deg, rgba(2,11,20,.06), rgba(2,11,20,.72));
        }

        .compare-overlay-thermal {
          background: linear-gradient(180deg, rgba(26,8,48,.03), rgba(26,8,48,.42));
        }

                .compare-copy {
          position: absolute;
          left: 28px;
          right: 28px;
          bottom: 24px;
          z-index: 2;
        }

        .compare-copy h3 {
          margin: 0;
          font-size: 28px;
          font-weight: 950;
        }

        .compare-copy p {
          margin: 12px 0 0;
          color: #f1f5f9;
          line-height: 1.6;
        }

        .section-title-wide { max-width: 1000px; }

        .innovation-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        .innovation-item {
          min-height: 138px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 18px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: #071522;
        }

        .innovation-item span { color: var(--gold2); font-size: 11px; font-weight: 900; }
        .innovation-item strong { font-size: 16px; line-height: 1.35; }

        .ecosystem {
          grid-template-columns: .95fr 1.05fr;
          align-items: center;
        }

        .ecosystem-clean {
          display: block;
          text-align: center;
        }

        .ecosystem-clean > div:first-child {
          max-width: 900px;
          margin: 0 auto;
        }

        .cta-final {
          padding: 12px 0;
          background: linear-gradient(90deg,#b67817 0%, #dca52f 48%, #f2c75d 100%);
          color: #06111d;
        }

        .cta-kicker {
          margin: 0;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: .14em;
          font-weight: 900;
        }

        .cta-final p { font-size: 16px; line-height: 1.6; }

        .home-footer {
          padding: 48px 0 24px;
          background: #02070d;
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 1.15fr .8fr .95fr .95fr .9fr;
          gap: 34px;
        }

        .home-footer h4 {
          margin: 0 0 18px;
          color: var(--gold2);
          font-size: 12px;
          font-weight: 900;
        }

        .home-footer p {
          margin: 18px 0 0;
          color: #8ba0b7;
          font-size: 14px;
          line-height: 1.7;
        }

        .home-footer .footer-slogan {
          width: max-content;
          max-width: none;
          white-space: nowrap;
          font-size: 13px;
          line-height: 1.4;
        }

        .footer-grid > div:not(:first-child) {
          display: flex;
          flex-direction: column;
          gap: 11px;
          font-size: 14px;
          color: #a8bacd;
        }

        .footer-bottom {
          margin-top: 28px;
          padding-top: 22px;
          border-top: 1px solid var(--line);
          display: flex;
          justify-content: space-between;
          gap: 20px;
          color: #71869d;
          font-size: 12px;
        }

        .footer-bottom > div { display: flex; gap: 18px; }


        .home-hero-copy {
          align-self: center;
        }

        .home-hero-media {
          align-self: stretch;
        }

        .section-head.three-col > p {
          max-width: 520px;
          margin: 0;
        }

        .section-head.three-col .text-link {
          align-self: end;
          justify-self: end;
        }

        .knowledge-card h3 {
          font-size: 21px;
        }

        .innovation-layout > div:first-child {
          max-width: 500px;
        }

        .ecosystem > div:first-child {
          max-width: 560px;
        }

        .cta-final h2 {
          font-size: clamp(34px, 3vw, 46px);
        }

        .cta-final .btn-dark {
          width: 100%;
          max-width: 230px;
          min-width: 0;
          justify-self: end;
          padding: 0 14px;
          white-space: nowrap;
          font-size: 12px;
        }

        .cta-final .btn-dark:hover {
          background: #0a1724;
        }

        .footer-grid > div:first-child {
          align-self: start;
        }

        .home-footer img {
          display: block;
        }


        .footer-social-area {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 18px;
          padding-left: 22px;
          border-left: 1px solid var(--line);
        }

        .social-icons {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .social-icon {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 7px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          line-height: 1;
          background: rgba(255,255,255,.02);
        }

        .construction-note {
          min-height: auto;
          display: flex;
          align-items: center;
          gap: 14px;
          padding-left: 0;
          border-left: 0;
          color: #d5deea;
        }

        .construction-note .construction-icon {
          font-size: 30px;
          line-height: 1;
        }

        .construction-note strong {
          display: block;
          color: white;
          font-size: 14px;
        }

        .construction-note p {
          margin: 6px 0 0;
          color: #8ba0b7;
          font-size: 12px;
          line-height: 1.5;
        }

        
        


        .cta-final-inner > p {
          margin: 0;
          width: 285px;
          max-width: 285px;
          min-width: 0;
          font-size: 13px;
          line-height: 1.45;
        }

        .cta-final .btn-dark {
          width: 230px;
          min-width: 230px;
          max-width: 230px;
          justify-self: end;
          padding-left: 12px;
          padding-right: 12px;
          white-space: nowrap;
          font-size: 12px;
        }

        @media (max-width: 1120px) {
          .cta-final-inner {
            grid-template-columns: 1fr 220px;
          }
          .cta-final-inner > p { display: none; }
          .cta-final h2 { white-space: normal; }
          .cta-final .btn-dark {
            width: 220px;
            min-width: 220px;
            max-width: 220px;
          }
        }

        @media (max-width: 1100px) {
          
        }

@media (max-width: 1180px) {
          .home-header-inner {
            grid-template-columns: 190px 1fr;
          }

          .home-nav { display: none; }

          .home-header-actions { justify-self: end; }

          .home-hero-wrap {
            grid-template-columns: 1fr;
          }

          .home-hero-copy { max-width: 760px; }

          .section-head.three-col,
          .visual-split,
          .innovation-layout,
          .ecosystem,
          .cta-final-inner {
            grid-template-columns: 1fr;
          }

          .cards.four { grid-template-columns: repeat(2, 1fr); }
          .innovation-grid { grid-template-columns: repeat(3, 1fr); }
          .footer-grid { grid-template-columns: repeat(2, 1fr); }
          .footer-social-area { border-left: 0; padding-left: 0; }
          .construction-note { border-left: 0; padding-left: 0; }
        }

        @media (max-width: 760px) {
          .home-header-inner,
          .home-hero-wrap,
          .section-inner {
            width: min(100% - 28px, 1300px);
          }

          .home-header-inner {
            min-height: 132px;
            grid-template-columns: 1fr;
            gap: 14px;
            padding: 14px 0 20px;
          }

          .home-brand { justify-content: center; }

          .home-header-actions {
            width: 100%;
            justify-self: stretch;
            display: grid;
            grid-template-columns: .95fr 1.05fr;
          }

          .home-hero-copy h1 { font-size: 42px; }

          .hero-image-card { min-height: 280px; }

          .inspection-grid,
          .compare-panel,
          .cards.four,
          .cards.three,
          .innovation-grid,
          .footer-grid {
            grid-template-columns: 1fr;
          }

          .inspection-cell,
          .inspection-cell:nth-child(3n),
          .inspection-cell:nth-child(n+4) {
            border-right: 0;
            border-bottom: 1px solid var(--line);
          }

          .inspection-cell:last-child { border-bottom: 0; }

          .feature-strip {
            grid-template-columns: 1fr;
          }

          .feature-slider {
            width: 300%;
          }

          .feature-item {
            flex-basis: 16.666666%;
            grid-template-columns: 1fr;
            border-left: 1px solid var(--line);
            border-top: 0;
          }

          .feature-photo {
            min-height: 180px;
          }

          .section-head.split {
            align-items: flex-start;
            flex-direction: column;
          }

          .footer-bottom {
            flex-direction: column;
          }

          .footer-bottom > div {
            flex-wrap: wrap;
          }
        }

        html,
        body {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        html::-webkit-scrollbar,
        body::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .home-footer .footer-whatsapp {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #ffffff;
          font-weight: 700;
        }
        .home-footer .whatsapp-svg {
          width: 21px;
          height: 21px;
          flex: 0 0 21px;
          color: var(--gold2);
        }

        

        .cta-final > .section-inner > p,
        .cta-final-inner > p {
          margin: 0;
          max-width: 300px;
          min-width: 0;
          font-size: 14px;
          line-height: 1.45;
        }


        .cta-final .btn-dark {
          width: 100%;
          max-width: 245px;
          min-width: 0;
          justify-self: end;
          padding-left: 14px;
          padding-right: 14px;
          white-space: nowrap;
          font-size: 12px;
        }



        .cta-final-inner > p {
          box-sizing: border-box;
          width: 300px;
          max-width: 300px;
          min-width: 0;
          margin: 0;
          padding-left: 20px;
          border-left: 1px solid rgba(6,17,29,.55);
          font-size: 13px;
          line-height: 1.45;
        }

        .cta-final .btn-dark {
          box-sizing: border-box;
          width: 235px;
          min-width: 235px;
          max-width: 235px;
          justify-self: end;
          padding: 0 14px;
          white-space: nowrap;
          font-size: 12px;
        }

        @media (max-width: 1120px) {
          .visual-split {
            grid-template-columns: 1fr;
          }

          .cta-final-inner {
            grid-template-columns: 1fr 220px;
          }

          .cta-final-inner > p {
            display: none;
          }

          .cta-final h2 {
            white-space: normal;
          }

          .cta-final .btn-dark {
            width: 220px;
            min-width: 220px;
            max-width: 220px;
          }
        }


        /* Correccion final: comparativo + franja de cotizacion */
        .visual-split {
          display: grid;
          grid-template-columns: minmax(0, .78fr) minmax(620px, 1.22fr);
          gap: 42px;
          align-items: center;
        }

        .visual-split .compare-panel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          width: 100%;
          min-width: 0;
          height: 320px;
          border: 1px solid var(--line);
          border-radius: 18px;
          overflow: hidden;
          background: #071522;
        }

        .visual-split .compare-box {
          position: relative;
          min-width: 0;
          height: 320px;
          overflow: hidden;
        }

        .visual-split .compare-box + .compare-box {
          border-left: 1px solid rgba(255,255,255,.16);
        }

        .visual-split .compare-photo-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .visual-split .compare-copy {
          left: 26px;
          right: 26px;
          bottom: 24px;
        }

        .visual-split .compare-copy h3 {
          font-size: 27px;
          line-height: 1.08;
        }

        .visual-split .compare-copy p {
          max-width: 270px;
          font-size: 15px;
          line-height: 1.5;
        }

        .cta-final {
          padding: 12px 0;
        }

        .cta-final .section-inner.cta-final-inner {
          width: min(1300px, calc(100% - 64px));
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px 235px;
          column-gap: 24px;
          align-items: center;
          min-height: 96px;
        }

        .cta-final h2.cta-home-title {
          margin: 0;
          font-size: clamp(28px, 2.35vw, 38px);
          line-height: 1.02;
          white-space: nowrap;
        }

        .cta-final .cta-final-inner > p {
          display: block;
          width: 300px;
          max-width: 300px;
          margin: 0;
          padding: 0 0 0 20px;
          border-left: 1px solid rgba(6,17,29,.45);
          font-size: 13px;
          line-height: 1.45;
        }

        .cta-final .cta-final-inner > .btn-dark {
          width: 235px;
          min-width: 235px;
          max-width: 235px;
          min-height: 54px;
          justify-self: end;
          padding: 0 14px;
          color: #fff;
          white-space: nowrap;
          font-size: 12px;
        }

        @media (max-width: 1180px) {
          .visual-split {
            grid-template-columns: 1fr;
          }

          .visual-split .compare-panel {
            max-width: 760px;
          }

          .cta-final .section-inner.cta-final-inner {
            grid-template-columns: minmax(0, 1fr) 220px;
          }

          .cta-final .cta-final-inner > p {
            display: none;
          }

          .cta-final h2.cta-home-title {
            white-space: normal;
          }

          .cta-final .cta-final-inner > .btn-dark {
            width: 220px;
            min-width: 220px;
            max-width: 220px;
          }
        }

        @media (max-width: 760px) {
          .visual-split .compare-panel {
            grid-template-columns: 1fr;
            height: auto;
          }

          .visual-split .compare-box {
            height: 280px;
          }

          .visual-split .compare-box + .compare-box {
            border-left: 0;
            border-top: 1px solid rgba(255,255,255,.16);
          }

          .cta-final .section-inner.cta-final-inner {
            width: min(100% - 28px, 1300px);
            grid-template-columns: 1fr;
            row-gap: 18px;
          }

          .cta-final .cta-final-inner > .btn-dark {
            width: 100%;
            min-width: 0;
            max-width: 100%;
            justify-self: stretch;
          }
        }


        /* Ajuste fino aprobado del bloque comparativo */
        .visual-split {
          grid-template-columns: minmax(0, .72fr) minmax(680px, 1.28fr);
          gap: 38px;
          align-items: center;
        }

        .visual-split > div:first-child {
          align-self: center;
          padding-top: 0;
        }

        .visual-split .compare-panel {
          height: 300px;
        }

        .visual-split .compare-box {
          height: 300px;
        }

        .visual-split .compare-copy {
          left: 24px;
          right: 24px;
          bottom: 18px;
        }

        .visual-split .compare-copy h3 {
          margin: 0;
          font-size: 23px;
          line-height: 1.08;
          font-weight: 950;
        }

        .visual-split .compare-copy p {
          margin: 9px 0 0;
          max-width: 245px;
          font-size: 13px;
          line-height: 1.45;
        }

        @media (max-width: 1180px) {
          .visual-split {
            grid-template-columns: 1fr;
          }

          .visual-split .compare-panel {
            max-width: 780px;
            height: 300px;
          }
        }

        @media (max-width: 760px) {
          .visual-split .compare-panel {
            height: auto;
          }

          .visual-split .compare-box {
            height: 260px;
          }

          .visual-split .compare-copy h3 {
            font-size: 22px;
          }

          .visual-split .compare-copy p {
            font-size: 13px;
          }
        }


        /* Ajuste definitivo del comparativo: imágenes limpias + textos legibles */
        .visual-split {
          grid-template-columns: minmax(0, .76fr) minmax(660px, 1.24fr);
          gap: 40px;
        }

        .visual-split .compare-panel {
          height: 300px;
        }

        .visual-split .compare-box {
          height: 300px;
        }

        .visual-split .compare-photo-img {
          object-fit: cover;
          object-position: center center;
        }

        .visual-split .compare-overlay {
          background: linear-gradient(
            180deg,
            rgba(2,11,20,.02) 35%,
            rgba(2,11,20,.78) 100%
          );
        }

        .visual-split .compare-overlay-thermal {
          background: linear-gradient(
            180deg,
            rgba(32,8,55,.01) 35%,
            rgba(32,8,55,.60) 100%
          );
        }

        .visual-split .compare-copy {
          left: 24px;
          right: 24px;
          bottom: 20px;
        }

        .visual-split .compare-copy h3 {
          font-size: 22px;
          line-height: 1.05;
        }

        .visual-split .compare-copy p {
          margin-top: 8px;
          max-width: 255px;
          font-size: 13px;
          line-height: 1.4;
        }

        @media (max-width: 1180px) {
          .visual-split {
            grid-template-columns: 1fr;
          }

          .visual-split .compare-panel {
            max-width: 780px;
          }
        }

      `}</style>
    </main>
  );
}

function UserMenuIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c.8-4.2 3.5-6.5 8-6.5s7.2 2.3 8 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function QuoteMenuIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 4.5V3h6v1.5M8.5 13l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
