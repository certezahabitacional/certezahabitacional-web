import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Costos y Presupuestos | Certeza Técnica",
  description:
    "Sistema técnico de estimación, cuantificación, análisis de precios unitarios, presupuesto, productividad y control de costos de obra.",
};

const questions = [
  ["01", "¿Qué se quiere construir?", "Alcance, criterios y supuestos."],
  ["02", "¿Cuánto se necesita?", "Cuantificaciones, generadores y catálogo."],
  ["03", "¿Cuánto cuesta producirlo?", "Materiales, mano de obra, equipo, indirectos y APU."],
  ["04", "¿Dónde probablemente terminará?", "Riesgos, contingencias y pronóstico al cierre."],
  ["05", "¿Qué debemos hacer ahora?", "Decisiones correctivas, ahorro y control oportuno."],
];

const method = [
  ["01", "Estimación conceptual", "Orden de magnitud."],
  ["02", "Estimación preliminar / paramétrica", "Escenarios y factibilidad."],
  ["03", "Presupuesto base", "Partidas, cantidades y costos de referencia."],
  ["04", "Presupuesto detallado", "APU, insumos y análisis completos."],
  ["05", "Presupuesto de control", "Línea base y seguimiento."],
  ["06", "Ejecución y control", "Avance, costos reales y desviaciones."],
  ["07", "Cierre y lecciones aprendidas", "Resultados y mejora continua."],
];

export default function PresupuestosCostosPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.shell}>
          <Link href="/certeza-tecnica" className={styles.brand} aria-label="Certeza Técnica">
            <Image
              src="/branding/logo-certeza-tecnica.png"
              alt="Certeza Técnica"
              width={210}
              height={84}
              priority
            />
          </Link>
          <Link href="/certeza-tecnica" className={styles.back}>
            ← Regresar a Certeza Técnica
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroMedia}>
          <Image
            src="/branding/nosotros-plataforma-aprobada.png"
            alt=""
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className={styles.heroOverlay} />
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.kicker}>CERTEZA TÉCNICA</span>
              <h1>COSTOS Y PRESUPUESTOS</h1>
              <p className={styles.heroLead}>De cuantificar conceptos a controlar decisiones.</p>
              <p className={styles.heroText}>
                Sistema técnico para estimar, estructurar, analizar, controlar y pronosticar
                el costo de obras de edificación.
              </p>
            </div>
            <div className={styles.logoCard}>
              <Image
                src="/branding/logo-certeza-tecnica.png"
                alt="Logotipo autorizado Certeza Técnica"
                width={270}
                height={270}
              />
              <strong>Más certeza financiera.</strong>
              <span>Más control. Mejores decisiones.</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.infographic}>
        <div className={styles.shell}>
          <div className={styles.introGrid}>
            <article className={styles.panel}>
              <div className={styles.panelTitle}><b>1</b><span>DEFINICIÓN</span></div>
              <p>
                Integra alcance, cuantificaciones, APU, presupuesto, productividad,
                riesgos, cambios y costo final en un mismo modelo de información.
              </p>
              <div className={styles.definitionFlow}>
                <span>Alcance</span><span>Cuantificación</span><span>APU</span>
                <span>Presupuesto</span><span>Productividad</span><span>Riesgos</span>
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelTitle}><b>2</b><span>LAS 5 PREGUNTAS CLAVE</span></div>
              <div className={styles.questions}>
                {questions.map(([n, q, a]) => (
                  <div key={n} className={styles.question}>
                    <b>{n}</b>
                    <div><strong>{q}</strong><span>{a}</span></div>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelTitle}><b>3</b><span>CICLO RECTOR</span></div>
              <div className={styles.cycle}>
                <div>Alcance</div><i>→</i><div>Cuantificación</div><i>→</i><div>APU y Presupuesto</div><i>→</i><div>Control</div>
                <span>↓</span>
                <div>Pronóstico</div><i>→</i><div>Alerta</div><i>→</i><div>Decisión</div><i>→</i><div>Acción</div><i>→</i><div>Verificación</div>
              </div>
            </article>
          </div>

          <div className={styles.methodPanel}>
            <div className={styles.panelTitle}><b>4</b><span>METODOLOGÍA CERTEZA COST</span></div>
            <div className={styles.methodGrid}>
              {method.map(([n, title, text]) => (
                <div key={n} className={styles.methodStep}>
                  <b>{n}</b><strong>{title}</strong><span>{text}</span>
                </div>
              ))}
            </div>
            <div className={styles.keyLine}>
              El presupuesto no es un archivo aislado; es una línea base viva para dirigir la obra.
            </div>
            <div className={styles.miniGrid}>
              <div><strong>Ejemplo APU</strong><span>1 m³ de concreto: cemento, arena, grava, agua, mano de obra, equipo y rendimiento.</span></div>
              <div><strong>Productividad</strong><span>ISP = rendimiento real / rendimiento previsto. Permite detectar desviaciones.</span></div>
              <div><strong>Costo del cambio</strong><span>Corregir tarde cuesta más. Las decisiones tempranas generan mayor valor.</span></div>
            </div>
          </div>

          <div className={styles.bottomGrid}>
            <article className={styles.panel}>
              <div className={styles.panelTitle}><b>5</b><span>DIFERENCIADOR</span></div>
              <div className={styles.diffGrid}>
                <div><strong>Cuantifica con trazabilidad</strong><span>Cada costo parte de cantidades verificables.</span></div>
                <div><strong>Explica de qué se compone</strong><span>APU, insumos, indirectos y supuestos claros.</span></div>
                <div><strong>Mide productividad real</strong><span>Compara rendimientos previstos contra ejecutados.</span></div>
                <div><strong>Ayuda a decidir temprano</strong><span>Detecta desviaciones y promueve ingeniería de valor.</span></div>
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelTitle}><b>6</b><span>RESULTADO ESPERADO</span></div>
              <div className={styles.results}>
                <span>Menos sobrecostos</span>
                <span>Más control del presupuesto</span>
                <span>Mejores decisiones</span>
                <span>Mayor certeza al cierre</span>
                <span>Base histórica para futuros proyectos</span>
              </div>
            </article>
          </div>

          <div className={styles.message}>
            <b>MENSAJE CLAVE</b>
            <span>
              Certeza Técnica no sólo calcula cuánto debería costar tu obra; te ayuda a entender
              de qué se compone, cómo controlarla, hacia dónde va y qué decisiones tomar a tiempo.
            </span>
          </div>
        </div>
      </section>

      <section className={styles.system}>
        <div className={styles.shell}>
          <div className={styles.systemHead}>
            <span className={styles.kicker}>PLATAFORMA INTEGRAL</span>
            <h2>Certeza Técnica 360</h2>
            <p>
              Accede desde un solo punto al sistema integral que conecta las cuatro áreas
              del portafolio de Certeza Técnica.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <Link href="/certeza-tecnica/app" className={styles.systemLink}>
              Entrar a Certeza Técnica 360 <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
