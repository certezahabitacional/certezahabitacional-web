import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import PublicPageStyles from "@/components/public/PublicPageStyles";

export default function Page() {
  return (
    <main className="ch-page">
      <PublicHeader active="tecnologia" />
      <section className="ch-section">
        <div className="ch-section-inner ch-split">
          <div>
            <p className="ch-kicker">TECNOLOGÍA</p>
            <h1 className="ch-title">Información técnica para proteger tu patrimonio</h1>
            <p className="ch-lead">
              Certeza Habitacional ayuda a compradores, propietarios e inversionistas a conocer mejor las condiciones visibles de una vivienda antes de tomar decisiones importantes.
            </p>
            <p className="ch-lead">
              Presentamos hallazgos de manera objetiva, priorizada y respaldada mediante evidencia.
            </p>
          </div>

          <div>
            <p className="ch-kicker">¿POR QUÉ ELEGIRNOS?</p>
            <div className="ch-benefits">
              {[
                "Criterio profesional de ingeniería",
                "Evidencia fotográfica organizada",
                "Clasificación clara de hallazgos",
                "Índice de Salud Habitacional",
                "Reportes digitales",
                "Atención directa por WhatsApp"
              ].map((item) => (
                <div className="ch-benefit" key={item}>
                  <span className="ch-check">✓</span>{item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <PublicPageStyles />

      <PublicFooter />
    </main>
  );
}

