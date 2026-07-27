const services = [
  ["Compra de vivienda", "Revisión independiente antes de firmar o entregar recursos."],
  ["Entrega de vivienda nueva", "Detección documentada de detalles, faltantes y condiciones críticas."],
  ["Garantía y postventa", "Seguimiento técnico para sustentar solicitudes de corrección."],
  ["Inversionistas", "Evaluación objetiva del estado físico para decidir con mejores datos."],
  ["Supervisión de calidad", "Control preventivo durante procesos constructivos y de cierre."],
  ["Dictamen técnico", "Informe estructurado con evidencia, prioridades y recomendaciones."],
] as const;

const steps = [
  ["01", "Inspeccionamos", "Recorremos sistemas, espacios y componentes con una guía técnica estandarizada."],
  ["02", "Clasificamos", "Cada hallazgo se registra como Conforme, Observación, No Conforme o Condición Crítica."],
  ["03", "Priorizamos", "Asignamos prioridad P1–P5 para indicar qué atender primero."],
  ["04", "Entregamos certeza", "Recibes evidencia, conclusiones y un Índice de Salud Habitacional fácil de interpretar."],
] as const;

function Logo() {
  return (
    <a className="brand" href="#inicio" aria-label="Certeza Habitacional, inicio">
      <span className="brand-mark" aria-hidden="true">⌂</span>
      <span><strong>CERTEZA</strong><small>HABITACIONAL</small></span>
    </a>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="wrap header-inner">
          <Logo />
          <nav aria-label="Navegación principal">
            <a href="#servicios">Servicios</a>
            <a href="#metodo">Método Certeza®</a>
            <a href="#nosotros">Nosotros</a>
            <a href="#contacto">Contacto</a>
          </nav>
          <a className="button button-primary header-cta" href="#contacto">Solicitar inspección</a>
        </div>
      </header>

      <section id="inicio" className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Inspección técnica de vivienda</p>
            <h1>Decide sobre tu vivienda con información, evidencia y certeza.</h1>
            <p className="lead">Evaluamos el estado físico del inmueble y convertimos los hallazgos en un reporte claro, priorizado y respaldado con evidencia fotográfica.</p>
            <div className="actions">
              <a className="button button-primary" href="#contacto">Solicitar inspección</a>
              <a className="button button-secondary" href="#metodo">Conocer el método</a>
            </div>
            <div className="metrics">
              <div><strong>C–CR</strong><span>Clasificación clara</span></div>
              <div><strong>P1–P5</strong><span>Prioridad técnica</span></div>
              <div><strong>ISH</strong><span>Índice de salud</span></div>
            </div>
          </div>
          <div className="report-shell">
            <div className="report-card">
              <div className="report-top"><span>REPORTE EJECUTIVO</span><b>EVALUACIÓN COMPLETA</b></div>
              <p>Índice de Salud Habitacional</p>
              <div className="score"><strong>87</strong><span>/100</span></div>
              <div className="progress"><span /></div>
              <div className="report-stats"><div><b>24</b><span>Puntos conformes</span></div><div><b>6</b><span>Hallazgos priorizados</span></div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" className="section">
        <div className="wrap">
          <p className="eyebrow">Servicios</p>
          <div className="section-heading"><h2>Inspecciones diseñadas para decisiones importantes.</h2><p className="lead">Acompañamos a compradores, propietarios, desarrolladores e inversionistas con una evaluación independiente y ordenada.</p></div>
          <div className="card-grid">{services.map(([title, text], i) => <article className="card" key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section id="metodo" className="section method">
        <div className="wrap">
          <p className="eyebrow">Método Certeza®</p>
          <div className="section-heading"><h2>Un proceso técnico que se entiende.</h2><p className="lead">La inspección no termina al encontrar un defecto. Lo documentamos, clasificamos y explicamos su prioridad.</p></div>
          <div className="steps">{steps.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section id="nosotros" className="section">
        <div className="wrap about-grid">
          <div className="about-visual"><div><span className="large-mark">⌂</span><strong>CERTEZA HABITACIONAL</strong><small>INSPECCIÓN · EVIDENCIA · CONFIANZA</small></div></div>
          <div><p className="eyebrow">Nosotros</p><h2>Protegemos decisiones que impactan tu patrimonio.</h2><p className="lead">Certeza Habitacional nace para elevar la calidad de la inspección de vivienda en México mediante criterios técnicos, documentación estandarizada y comunicación clara.</p>
            <ul className="checks"><li>Independencia y objetividad técnica</li><li>Evidencia fotográfica organizada</li><li>Reportes claros para clientes no especialistas</li><li>Seguimiento con trazabilidad documental</li></ul>
          </div>
        </div>
      </section>

      <section id="contacto" className="section contact-section">
        <div className="wrap contact-card">
          <div className="contact-copy"><p className="eyebrow">Contacto</p><h2>Solicita una inspección.</h2><p>Cuéntanos qué tipo de vivienda deseas revisar y te contactaremos para definir alcance, fecha y cotización.</p><div className="contact-data"><p><b>Correo</b>contacto@certezahabitacional.com</p><p><b>Cobertura inicial</b>Hermosillo, Sonora y proyectos programados</p></div></div>
          <form action="mailto:contacto@certezahabitacional.com" method="post" encType="text/plain">
            <label>Nombre<input name="nombre" required /></label>
            <label>Teléfono o WhatsApp<input name="telefono" required /></label>
            <label>Correo electrónico<input type="email" name="correo" required /></label>
            <label>¿Qué necesitas inspeccionar?<textarea name="mensaje" required /></label>
            <button className="button button-primary" type="submit">Enviar solicitud</button>
          </form>
        </div>
      </section>

      <footer><div className="wrap footer-inner"><Logo /><p>© 2026 Certeza Habitacional. Todos los derechos reservados.</p></div></footer>
    </main>
  );
}
