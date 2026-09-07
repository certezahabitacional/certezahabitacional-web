import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import PublicPageStyles from "@/components/public/PublicPageStyles";

export default function Page() {
  return (
    <main className="ch-page">
      <PublicHeader active="inspecciones" />
      <section className="ch-section">
        <div className="ch-section-inner ch-construction">
          <div>
            <p className="ch-kicker">INSPECCIONES</p>
            <h1 className="ch-title">Página en construcción</h1>
            <p className="ch-lead" style={{ marginLeft: "auto", marginRight: "auto" }}>
              Estamos preparando esta sección para explicar con mayor detalle el alcance y características de nuestras inspecciones.
            </p>
          </div>
        </div>
      </section>
      <PublicPageStyles />

      <PublicFooter />
    </main>
  );
}

