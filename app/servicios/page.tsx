import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import PublicPageStyles from "@/components/public/PublicPageStyles";

export default function Page() {
  return (
    <main className="ch-page">
      <PublicHeader active="servicios" />
      <section className="ch-section">
        <div className="ch-section-inner">
          <p className="ch-kicker">SERVICIOS</p>
          <h1 className="ch-title">Inspecciones para decisiones importantes</h1>
          <p className="ch-lead">
            Cada servicio se adapta al objetivo del cliente y documenta las condiciones relevantes de manera clara, profesional y ordenada.
          </p>

          <div className="ch-cards ch-cards-3">
            {[
              ["01","Inspección para compra","Conoce las condiciones visibles de la vivienda antes de comprar y reduce riesgos en una decisión patrimonial importante."],
              ["02","Recepción de vivienda nueva","Identificamos defectos, faltantes y observaciones antes de firmar la recepción del inmueble."],
              ["03","Inspección de garantía","Documentamos hallazgos antes de que termine el periodo de garantía otorgado por el desarrollador."],
              ["04","Dictamen técnico","Evaluación profesional con evidencia fotográfica, conclusiones y recomendaciones técnicas."],
              ["05","Supervisión de calidad","Revisión de procesos, instalaciones, acabados y cumplimiento de especificaciones."],
              ["06","Inspección para inversionistas","Información técnica para evaluar propiedades destinadas a renta, rehabilitación o reventa."]
            ].map(([numero,titulo,texto]) => (
              <article className="ch-card" key={numero}>
                <span className="ch-number">{numero}</span>
                <h2>{titulo}</h2>
                <p>{texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <PublicPageStyles />

      <PublicFooter />
    </main>
  );
}

