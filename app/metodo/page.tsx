import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import PublicPageStyles from "@/components/public/PublicPageStyles";

export default function Page() {
  return (
    <main className="ch-page">
      <PublicHeader active="metodo" />
      <section className="ch-section">
        <div className="ch-section-inner">
          <p className="ch-kicker">MÉTODO CERTEZA®</p>
          <h1 className="ch-title">Un proceso claro, desde la agenda hasta el seguimiento</h1>

          <div className="ch-cards ch-cards-4">
            {[
              ["01","Agenda","Recibimos los datos de la vivienda y programamos la visita."],
              ["02","Inspección","Revisamos componentes, sistemas, instalaciones y acabados visibles."],
              ["03","Reporte técnico","Clasificamos hallazgos y documentamos evidencia y recomendaciones."],
              ["04","Seguimiento","Aclaramos resultados y apoyamos la interpretación del reporte."]
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

