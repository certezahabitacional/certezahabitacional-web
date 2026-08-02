const whatsappUrl =
  "https://wa.me/526561489459?text=Hola%2C%20me%20interesa%20una%20inspecci%C3%B3n%20de%20vivienda%20con%20Certeza%20Habitacional.%20Me%20gustar%C3%ADa%20recibir%20informaci%C3%B3n.";

const services = [
  {
    code: "01",
    title: "Inspección para compra",
    description:
      "Conoce las condiciones visibles de la vivienda antes de comprar y reduce riesgos en una decisión patrimonial importante.",
  },
  {
    code: "02",
    title: "Recepción de vivienda nueva",
    description:
      "Identificamos defectos, faltantes y observaciones antes de firmar la recepción del inmueble.",
  },
  {
    code: "03",
    title: "Inspección de garantía",
    description:
      "Documentamos hallazgos antes de que termine el periodo de garantía otorgado por el desarrollador.",
  },
  {
    code: "04",
    title: "Dictamen técnico",
    description:
      "Evaluación profesional con evidencia fotográfica, conclusiones y recomendaciones técnicas.",
  },
  {
    code: "05",
    title: "Supervisión de calidad",
    description:
      "Revisión de procesos, instalaciones, acabados y cumplimiento de especificaciones.",
  },
  {
    code: "06",
    title: "Inspección para inversionistas",
    description:
      "Información técnica para evaluar propiedades destinadas a renta, rehabilitación o reventa.",
  },
];

const processSteps = [
  {
    number: "01",
    title: "Agenda",
    description:
      "Recibimos los datos de la vivienda y programamos la visita.",
  },
  {
    number: "02",
    title: "Inspección",
    description:
      "Revisamos componentes, sistemas, instalaciones y acabados visibles.",
  },
  {
    number: "03",
    title: "Reporte técnico",
    description:
      "Clasificamos hallazgos y documentamos evidencia y recomendaciones.",
  },
  {
    number: "04",
    title: "Seguimiento",
    description:
      "Aclaramos resultados y apoyamos la interpretación del reporte.",
  },
];

const benefits = [
  "Criterio profesional de ingeniería",
  "Evidencia fotográfica organizada",
  "Clasificación clara de hallazgos",
  "Índice de Salud Habitacional",
  "Reportes digitales",
  "Atención directa por WhatsApp",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#inicio" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 font-black text-slate-950">
              CH
            </div>

            <div>
              <p className="font-black tracking-wide">CERTEZA HABITACIONAL</p>
              <p className="text-xs text-slate-400">
                Inspección técnica de viviendas
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-300 lg:flex">
            <a href="#inicio" className="transition hover:text-cyan-300">
              Inicio
            </a>
            <a href="#servicios" className="transition hover:text-cyan-300">
              Servicios
            </a>
            <a href="#metodo" className="transition hover:text-cyan-300">
              Método Certeza®
            </a>
            <a href="#nosotros" className="transition hover:text-cyan-300">
              Nosotros
            </a>
            <a href="#contacto" className="transition hover:text-cyan-300">
              Contacto
            </a>
          </nav>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
          >
            Solicitar inspección
          </a>
        </div>
      </header>

      <section
        id="inicio"
        className="relative isolate overflow-hidden border-b border-white/10"
      >
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_75%_25%,rgba(34,211,238,0.22),transparent_35%),linear-gradient(to_bottom_right,#020617,#0f172a,#020617)]" />

        <div className="mx-auto grid min-h-[720px] max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-6 font-black uppercase tracking-[0.2em] text-cyan-300">
              Inspección basada en evidencia
            </p>

            <h1 className="max-w-4xl text-5xl font-black leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
              Conoce la vivienda antes de{" "}
              <span className="text-cyan-300">tomar la decisión.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
              Identificamos condiciones visibles, documentamos hallazgos y
              entregamos información técnica para ayudarte a comprar, recibir o
              invertir con mayor certeza.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-cyan-400 px-7 py-4 text-center font-black text-slate-950 transition hover:bg-cyan-300"
              >
                Contactar por WhatsApp
              </a>

              <a
                href="#servicios"
                className="rounded-full border border-white/20 px-7 py-4 text-center font-bold transition hover:border-cyan-300 hover:text-cyan-300"
              >
                Conocer servicios
              </a>
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
              <div>
                <p className="text-3xl font-black text-cyan-300">400+</p>
                <p className="mt-1 text-sm text-slate-400">
                  puntos potenciales de revisión
                </p>
              </div>

              <div>
                <p className="text-3xl font-black text-cyan-300">100%</p>
                <p className="mt-1 text-sm text-slate-400">
                  evidencia organizada
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-3xl font-black text-cyan-300">ISH</p>
                <p className="mt-1 text-sm text-slate-400">
                  Índice de Salud Habitacional
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
            <div className="rounded-[1.5rem] bg-slate-900 p-7">
              <p className="text-sm text-slate-400">Método Certeza®</p>
              <h2 className="mt-3 text-3xl font-black">
                Información clara y organizada
              </h2>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-emerald-400/10 p-5">
                  <p className="font-black text-emerald-300">C</p>
                  <p className="mt-2">Conforme</p>
                </div>

                <div className="rounded-2xl bg-amber-400/10 p-5">
                  <p className="font-black text-amber-300">O</p>
                  <p className="mt-2">Observación</p>
                </div>

                <div className="rounded-2xl bg-orange-400/10 p-5">
                  <p className="font-black text-orange-300">NC</p>
                  <p className="mt-2">No Conforme</p>
                </div>

                <div className="rounded-2xl bg-rose-400/10 p-5">
                  <p className="font-black text-rose-300">CR</p>
                  <p className="mt-2">Condición Crítica</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-cyan-300 p-6 text-slate-950">
                <p className="text-sm font-bold">
                  Índice de Salud Habitacional
                </p>
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-5xl font-black">ISH</p>
                  <p className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                    Evaluación integral
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" className="bg-slate-50 py-24 text-slate-950">
        <div className="mx-auto max-w-7xl px-6">
          <p className="font-black uppercase tracking-[0.2em] text-cyan-700">
            Servicios
          </p>

          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Inspecciones para decisiones importantes
          </h2>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Cada servicio se adapta al objetivo del cliente y documenta las
            condiciones relevantes de manera clara, profesional y ordenada.
          </p>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.code}
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-xl"
              >
                <p className="text-sm font-black text-cyan-700">
                  {service.code}
                </p>
                <h3 className="mt-8 text-xl font-black">{service.title}</h3>
                <p className="mt-4 leading-7 text-slate-600">
                  {service.description}
                </p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-block font-black text-cyan-700"
                >
                  Solicitar información →
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="metodo" className="bg-cyan-300 py-24 text-slate-950">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="font-black uppercase tracking-[0.2em]">
              Método Certeza®
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Un proceso claro, desde la agenda hasta el seguimiento
            </h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step) => (
              <article
                key={step.number}
                className="rounded-3xl border border-slate-950/10 bg-white/60 p-7"
              >
                <p className="text-sm font-black">{step.number}</p>
                <h3 className="mt-10 text-2xl font-black">{step.title}</h3>
                <p className="mt-4 leading-7 text-slate-700">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="nosotros" className="bg-slate-950 py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-2">
          <div>
            <p className="font-black uppercase tracking-[0.2em] text-cyan-300">
              Nosotros
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Información técnica para proteger tu patrimonio
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              Certeza Habitacional ayuda a compradores, propietarios e
              inversionistas a conocer mejor las condiciones visibles de una
              vivienda antes de tomar decisiones importantes.
            </p>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Presentamos hallazgos de manera objetiva, priorizada y respaldada
              mediante evidencia.
            </p>
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
              ¿Por qué elegirnos?
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <p className="font-bold">
                    <span className="mr-2 text-cyan-300">✓</span>
                    {benefit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contacto" className="bg-white py-24 text-slate-950">
        <div className="mx-auto max-w-7xl px-6">
          <div className="overflow-hidden rounded-[2rem] bg-slate-950">
            <div className="grid lg:grid-cols-[1fr_0.8fr]">
              <div className="p-8 text-white sm:p-12 lg:p-16">
                <p className="font-black uppercase tracking-[0.2em] text-cyan-300">
                  Contacto
                </p>

                <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
                  Toma tu próxima decisión con mayor certeza
                </h2>

                <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                  Cuéntanos qué tipo de vivienda necesitas inspeccionar y
                  prepararemos una propuesta de servicio.
                </p>

                <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-cyan-400 px-7 py-4 text-center font-black text-slate-950 transition hover:bg-cyan-300"
                  >
                    WhatsApp: +52 656 148 9459
                  </a>

                  <a
                    href="mailto:contacto@certezahabitacional.com"
                    className="rounded-full border border-white/20 px-7 py-4 text-center font-bold transition hover:border-cyan-300 hover:text-cyan-300"
                  >
                    Enviar correo
                  </a>
                </div>
              </div>

              <div className="bg-cyan-300 p-8 sm:p-12 lg:p-16">
                <p className="font-black uppercase tracking-[0.2em]">
                  Información
                </p>

                <div className="mt-8 space-y-7">
                  <div>
                    <p className="text-sm font-bold text-slate-700">WhatsApp</p>
                    <p className="mt-1 text-xl font-black">
                      +52 656 148 9459
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-700">Correo</p>
                    <p className="mt-1 break-all text-lg font-black">
                      contacto@certezahabitacional.com
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      Sitio oficial
                    </p>
                    <p className="mt-1 text-lg font-black">
                      certezahabitacional.com
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-700">Atención</p>
                    <p className="mt-1 text-lg font-black">
                      Mediante cita programada
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Certeza Habitacional. Todos los derechos
            reservados.
          </p>

          <div className="flex flex-wrap gap-5">
            <a href="#inicio" className="hover:text-cyan-300">
              Inicio
            </a>
            <a href="#servicios" className="hover:text-cyan-300">
              Servicios
            </a>
            <a href="#metodo" className="hover:text-cyan-300">
              Método Certeza®
            </a>
            <a href="#contacto" className="hover:text-cyan-300">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}