const services = [
  ["Compra de vivienda", "Conoce el estado visible del inmueble antes de tomar una decisión patrimonial."],
  ["Entrega de vivienda nueva", "Documentamos defectos, pendientes y condiciones que requieren atención del desarrollador."],
  ["Garantía y postventa", "Integramos evidencia técnica para dar seguimiento a fallas dentro del periodo de garantía."],
  ["Supervisión de calidad", "Apoyamos a propietarios, inversionistas y empresas con revisiones objetivas y trazables."]
];

const method = [
  ["1", "Inspección", "Revisión ordenada por sistemas y componentes de la vivienda."],
  ["2", "Clasificación", "Cada condición se registra como C, O, NC, CR o NA."],
  ["3", "Priorización", "Los hallazgos se ordenan de P1 a P5 según atención requerida."],
  ["4", "Reporte", "Entrega de evidencia, conclusiones y recomendaciones claras."]
];

export default function Home() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#inicio" aria-label="Certeza Habitacional, inicio">
          <span className="mark">CH</span>
          <span><strong>Certeza</strong> Habitacional</span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#servicios">Servicios</a>
          <a href="#metodo">Método Certeza®</a>
          <a href="#nosotros">Nosotros</a>
          <a className="navCta" href="#contacto">Solicitar inspección</a>
        </nav>
      </header>

      <section className="hero" id="inicio">
        <div className="shell heroGrid">
          <div>
            <p className="eyebrow">INSPECCIÓN TÉCNICA DE VIVIENDAS</p>
            <h1>Decisiones patrimoniales con evidencia, método y certeza.</h1>
            <p className="lead">Revisamos la vivienda, documentamos hallazgos y entregamos información clara para comprar, recibir o conservar un inmueble con mayor confianza.</p>
            <div className="actions">
              <a className="button primary" href="#contacto">Solicitar inspección</a>
              <a className="button secondary" href="#metodo">Conocer el método</a>
            </div>
            <div className="trust">
              <span>✓ Evidencia fotográfica</span><span>✓ Reporte profesional</span><span>✓ Priorización de hallazgos</span>
            </div>
          </div>
          <aside className="inspectionCard" aria-label="Resumen del Método Certeza">
            <div className="cardTop"><span>Índice de Salud Habitacional</span><strong>ISH</strong></div>
            <div className="gauge"><span>Evaluación integral</span><b>Método Certeza®</b></div>
            <div className="legend"><span className="ok">C</span><span className="obs">O</span><span className="nc">NC</span><span className="critical">CR</span><span className="na">NA</span></div>
            <p>Resultados estructurados para facilitar decisiones, correcciones y seguimiento.</p>
          </aside>
        </div>
      </section>

      <section className="section shell" id="servicios">
        <p className="eyebrow">SERVICIOS</p>
        <div className="sectionHeading"><h2>Inspección para cada momento de la vivienda</h2><p>Un servicio técnico independiente orientado a reducir incertidumbre y mejorar la toma de decisiones.</p></div>
        <div className="cards">{services.map(([title, text]) => <article className="service" key={title}><span className="serviceIcon">⌂</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="method" id="metodo">
        <div className="shell">
          <p className="eyebrow light">MÉTODO CERTEZA®</p>
          <div className="sectionHeading light"><h2>Un proceso claro, documentado y repetible</h2><p>La inspección no depende de impresiones aisladas: sigue una metodología y criterios definidos.</p></div>
          <div className="steps">{method.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section className="section shell about" id="nosotros">
        <div>
          <p className="eyebrow">CERTEZA HABITACIONAL</p>
          <h2>Información técnica comprensible para proteger tu patrimonio.</h2>
        </div>
        <div><p>Certeza Habitacional nace para brindar una revisión independiente de la vivienda y transformar observaciones técnicas en información útil para propietarios, compradores, desarrolladores e inversionistas.</p><p>Integramos experiencia en construcción, evidencia y criterios homogéneos para presentar resultados con claridad y responsabilidad.</p></div>
      </section>

      <section className="contact" id="contacto">
        <div className="shell contactGrid">
          <div><p className="eyebrow light">SOLICITA INFORMACIÓN</p><h2>Da el siguiente paso con certeza.</h2><p>Cuéntanos qué tipo de vivienda deseas inspeccionar y en qué ciudad se encuentra.</p></div>
          <a className="button white" href="mailto:contacto@certezahabitacional.com?subject=Solicitud%20de%20inspección">contacto@certezahabitacional.com</a>
        </div>
      </section>

      <footer><div className="shell footer"><span>© 2026 Certeza Habitacional</span><span>Método Certeza® · Inspección técnica de viviendas</span></div></footer>
    </main>
  );
}
