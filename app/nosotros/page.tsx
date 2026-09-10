import Image from "next/image";
import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";

const GOLD = "#D79A21";

const metodologia = [
  {
    numero: "01",
    titulo: "OBSERVAMOS",
    simbolo: "⌕",
    texto:
      "Realizamos una revisión ordenada de los elementos accesibles de la vivienda siguiendo criterios y procedimientos definidos.",
  },
  {
    numero: "02",
    titulo: "COMPROBAMOS",
    simbolo: "▣",
    texto:
      "Utilizamos herramientas y tecnología de apoyo para complementar la observación.",
  },
  {
    numero: "03",
    titulo: "DOCUMENTAMOS",
    simbolo: "◎",
    texto:
      "Los hallazgos relevantes se registran mediante observaciones, fotografías y evidencia que permiten trazabilidad.",
  },
  {
    numero: "04",
    titulo: "INFORMAMOS",
    simbolo: "▤",
    texto:
      "Organizamos los resultados de manera clara para que el cliente pueda comprenderlos y utilizarlos para decidir.",
  },
];

const beneficiarios = [
  {
    simbolo: "◉",
    titulo: "Para quien compra\no recibe una vivienda",
    texto:
      "Información, mayor claridad y mejores elementos para tomar sus propias decisiones.",
  },
  {
    simbolo: "▦",
    titulo: "Para inmobiliarias\ny asesores",
    texto:
      "Operaciones con expectativas mejor informadas y clientes con mayor confianza.",
  },
  {
    simbolo: "⌂",
    titulo: "Para constructoras",
    texto:
      "Identificación oportuna de condiciones susceptibles de atención antes de generar inconformidades posteriores.",
  },
  {
    simbolo: "⌂",
    titulo: "Para quien vende\nuna vivienda",
    texto:
      "Una referencia documentada de las condiciones observadas en un momento determinado.",
  },
];

const valores = [
  {
    simbolo: "◇",
    titulo: "INTEGRIDAD",
    texto: "Actuamos con honestidad y transparencia en cada inspección.",
  },
  {
    simbolo: "⚖",
    titulo: "OBJETIVIDAD",
    texto: "Nuestra opinión está basada en evidencia, no en intereses.",
  },
  {
    simbolo: "◉",
    titulo: "RESPETO",
    texto: "Tratamos a todas las personas con cortesía y profesionalismo.",
  },
  {
    simbolo: "○",
    titulo: "RESPONSABILIDAD",
    texto: "Cumplimos lo que ofrecemos y cuidamos cada detalle.",
  },
  {
    simbolo: "↗",
    titulo: "MEJORA CONTINUA",
    texto: "Aprendemos, innovamos y mejoramos para servir mejor.",
  },
];

export default function NosotrosPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020B14] text-white">

      <PublicHeader active="nosotros" />

      {/* =========================================================
          HERO
      ========================================================== */}
      <section className="border-b border-[#D79A21]/45">
        <div className="mx-auto grid max-w-[1536px] lg:grid-cols-[0.40fr_0.60fr]">
          <div className="flex min-h-[410px] flex-col justify-center px-7 py-10 lg:px-9 lg:py-8">
            <Eyebrow>NOSOTROS</Eyebrow>

            <h1 className="mt-4 max-w-[610px] text-[clamp(2.05rem,3.25vw,3.45rem)] font-black leading-[1.03] tracking-[-0.04em]">
              Queremos cambiar
              <br />
              la forma en que México conoce
              <br />
              una vivienda antes de tomar
              <br />
              una decisión.
            </h1>

            <p className="mt-5 max-w-[575px] text-[15px] leading-7 text-slate-300">
              Certeza Habitacional nace para convertir incertidumbre en
              información útil, documentada y comprensible.
            </p>

            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
              <MiniPilar icon="◉" label="EXPERIENCIA" />
              <MiniPilar icon="▤" label="METODOLOGÍA" />
              <MiniPilar icon="▣" label="TECNOLOGÍA" />
              <MiniPilar icon="◎" label="EVIDENCIA" />
            </div>
          </div>

          <div className="relative min-h-[390px] overflow-hidden lg:min-h-full">
            <Image
              src="/branding/nosotros-hero-aprobado.png"
              alt="Inspector de Certeza Habitacional frente a una vivienda"
              width={1200}
              height={820}
              priority
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#020B14] via-[#020B14]/10 to-transparent" />
          </div>
        </div>
      </section>

      {/* =========================================================
          EXPERIENCIA / IMPARCIALIDAD / PRINCIPIOS
      ========================================================== */}
      <section className="border-b border-[#D79A21]/45">
        <div className="mx-auto grid max-w-[1536px] items-stretch lg:grid-cols-[1.12fr_0.95fr_0.78fr]">
          <article className="border-[#D79A21]/30 p-7 text-center lg:border-r">
            <Eyebrow>EXPERIENCIA QUE NOS RESPALDA</Eyebrow>

            <h2 className="mt-3 text-[1.42rem] font-bold leading-tight">
              Antes de Certeza Habitacional
              <br />
              ya había miles de viviendas de experiencia.
            </h2>

            <div className="mt-7 grid grid-cols-3 items-start">
              <Metric number="+40,000" label="VIVIENDAS" />
              <Metric number="+15" label="CIUDADES" borders />
              <Metric number="11" label="ESTADOS DE MÉXICO" />
            </div>

            <p className="mt-6 text-[14px] leading-6 text-slate-300">
              Una trayectoria desarrollada a través de la participación directa
              e indirecta en procesos relacionados con construcción,
              supervisión, desarrollo y entrega de vivienda.
            </p>

            <p className="mt-5 border border-[#D79A21]/75 px-4 py-2.5 text-xs font-black text-[#D79A21]">
              La experiencia no se queda en una persona. La convertimos en un
              sistema.
            </p>

            <p className="mt-4 text-[12px] leading-5 text-slate-500">
              *Las cifras corresponden a experiencia acumulada mediante
              participación directa e indirecta en proyectos habitacionales y
              no representan el número de inspecciones realizadas por Certeza
              Habitacional.
            </p>
          </article>

          <article className="border-[#D79A21]/30 p-7 text-center lg:border-r">
            <Eyebrow>IMPARCIALIDAD E INDEPENDENCIA</Eyebrow>

            <h2 className="mt-4 text-[1.45rem] font-black leading-tight">
              No estamos de un lado o del otro.
              <br />
              Estamos del lado de la evidencia.
            </h2>

            <p className="mt-5 text-[14px] leading-6 text-slate-300">
              Una inspección profesional no debería comenzar buscando problemas
              ni terminar exagerando lo encontrado.
            </p>

            <p className="mt-4 text-[14px] leading-6 text-slate-300">
              No calificamos una vivienda para favorecer una negociación. No
              buscamos generar argumentos para obtener ventajas frente a quien
              vende, construye o entrega el inmueble. Tampoco minimizamos un
              hallazgo para favorecer una operación.
            </p>

            <p className="mt-7 text-[1.05rem] font-black text-[#D79A21]">
              La evidencia determina lo que informamos.
            </p>
          </article>

          <article className="p-7">
            <div className="text-center">
              <Eyebrow>NUESTROS PRINCIPIOS</Eyebrow>
            </div>

            <Principio simbolo="ⓘ" titulo="INFORMACIÓN">
              para quien nos contrata.
            </Principio>

            <Principio simbolo="⚖" titulo="OBJETIVIDAD">
              frente a lo que encontramos.
            </Principio>

            <Principio simbolo="◇" titulo="RESPETO">
              hacia todas las partes involucradas.
            </Principio>

            <p className="mt-7 text-center text-[1.05rem] font-black leading-7 text-[#D79A21]">
              Certeza basada en evidencia.
              <br />
              Confianza basada en integridad.
            </p>
          </article>
        </div>
      </section>

      {/* =========================================================
          UNA INSPECCIÓN DONDE TODOS PUEDEN GANAR
      ========================================================== */}
      <section className="border-b border-[#D79A21]/45">
        <div className="mx-auto grid max-w-[1536px] items-stretch lg:grid-cols-[0.28fr_0.72fr]">
          <div className="relative min-h-[315px] overflow-hidden">
            <Image
              src="/branding/nosotros-acuerdo-aprobado.png"
              alt="Acuerdo profesional en una operación inmobiliaria"
              width={900}
              height={720}
              className="h-full w-full object-cover object-center"
            />
          </div>

          <div className="p-7">
            <div className="text-center">
              <Eyebrow>UNA INSPECCIÓN DONDE TODOS PUEDEN GANAR</Eyebrow>

              <h2 className="mt-2 text-[1.45rem] font-bold">
                Una mejor vivienda beneficia a todas las partes.
              </h2>
            </div>

            <div className="mt-7 grid gap-0 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.18fr]">
              {beneficiarios.map((item) => (
                <Beneficiario
                  key={item.titulo}
                  simbolo={item.simbolo}
                  titulo={item.titulo}
                  texto={item.texto}
                />
              ))}

              <div className="mx-3 flex min-h-[220px] flex-col justify-center border border-[#D79A21] p-5 text-center">
                <p className="text-[0.98rem] leading-6">
                  Nuestro objetivo
                  <br />
                  no es detener
                  <br />
                  una operación.
                </p>

                <p className="mt-4 text-[1.05rem] font-black leading-6 text-[#D79A21]">
                  Es aportar información
                  <br />
                  para que pueda
                  <br />
                  concluirse de la mejor
                  <br />
                  manera posible.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          METODOLOGÍA / TECNOLOGÍA
      ========================================================== */}
      <section className="border-b border-[#D79A21]/45">
        <div className="mx-auto grid max-w-[1536px] items-stretch lg:grid-cols-2">
          <article className="border-[#D79A21]/30 p-7 lg:border-r">
            <div className="text-center">
              <Eyebrow>NUESTRA METODOLOGÍA</Eyebrow>

              <h2 className="mt-2 text-[1.45rem] font-bold">
                No improvisamos una revisión. Seguimos un proceso.
              </h2>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-4">
              {metodologia.map((item, index) => (
                <Paso
                  key={item.numero}
                  {...item}
                  ultimo={index === metodologia.length - 1}
                />
              ))}
            </div>

            <p className="mt-5 text-center text-sm font-black text-[#D79A21]">
              Una inspección termina. La información permanece.
            </p>
          </article>

          <article className="grid min-h-[380px] grid-cols-1 overflow-hidden lg:grid-cols-[1fr_185px] xl:grid-cols-[1fr_215px]">
            <div className="p-7">
              <div className="text-center">
                <Eyebrow>TECNOLOGÍA CON PROPÓSITO</Eyebrow>

                <h2 className="mt-2 text-[1.45rem] font-bold">
                  La tecnología no sustituye la experiencia.
                  <br />
                  La amplifica.
                </h2>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Formula simbolo="◉" label="EXPERIENCIA" />
                <Signo>+</Signo>
                <Formula simbolo="▤" label="METODOLOGÍA" />
                <Signo>+</Signo>
                <Formula simbolo="⌕" label="HERRAMIENTAS" />
                <Signo>+</Signo>
                <Formula simbolo="◎" label="EVIDENCIA" />
                <Signo>=</Signo>

                <Image
                  src="/branding/logo-autorizado.png"
                  alt="Certeza Habitacional"
                  width={130}
                  height={115}
                  className="h-auto w-[88px]"
                />
              </div>

              <p className="mt-7 text-[14px] leading-6 text-slate-300">
                Utilizamos herramientas especializadas para ampliar nuestra
                capacidad de observación y comprobación. Ninguna herramienta
                interpreta por sí sola una vivienda. La experiencia del inspector
                es insustituible.
              </p>
            </div>

            <div className="relative hidden min-h-[380px] border-l border-[#D79A21]/20 lg:block">
              <Image
                src="/branding/nosotros-termica-aprobada.png"
                alt="Cámara térmica utilizada durante una inspección"
                width={430}
                height={760}
                className="h-full w-full object-cover object-center"
              />
            </div>
          </article>
        </div>
      </section>

      {/* =========================================================
          CAPACIDAD / PLATAFORMA / COMPROMISO
      ========================================================== */}
      <section className="border-b border-[#D79A21]/45">
        <div className="mx-auto grid max-w-[1536px] items-stretch lg:grid-cols-[0.92fr_1.14fr_0.94fr]">
          <article className="border-[#D79A21]/30 p-7 text-center lg:border-r">
            <Eyebrow>DE EXPERIENCIA A CAPACIDAD INSTITUCIONAL</Eyebrow>

            <h2 className="mt-4 text-[1.38rem] font-bold leading-tight">
              Queremos que la calidad dependa
              <br />
              de un estándar, no solamente
              <br />
              de una persona.
            </h2>

            <div className="mt-7 hidden items-start justify-between gap-1 xl:flex">
              <Cadena simbolo="◉" label="EXPERIENCIA" />
              <Arrow />
              <Cadena simbolo="▤" label="METODOLOGÍA" />
              <Arrow />
              <Cadena simbolo="◇" label="CAPACITACIÓN" />
              <Arrow />
              <Cadena simbolo="⌕" label="HERRAMIENTAS" />
              <Arrow />
              <Cadena simbolo="▣" label="TECNOLOGÍA" />
            </div>

            <div className="mt-7 grid grid-cols-5 gap-1 xl:hidden">
              <Cadena simbolo="◉" label="EXPERIENCIA" />
              <Cadena simbolo="▤" label="METODOLOGÍA" />
              <Cadena simbolo="◇" label="CAPACITACIÓN" />
              <Cadena simbolo="⌕" label="HERRAMIENTAS" />
              <Cadena simbolo="▣" label="TECNOLOGÍA" />
            </div>

            <Image
              src="/branding/logo-autorizado.png"
              alt="Certeza Habitacional"
              width={150}
              height={130}
              className="mx-auto mt-5 h-auto w-[102px]"
            />

            <p className="mt-5 text-[14px] leading-6 text-slate-400">
              Transformamos experiencia en procedimientos, capacitación,
              herramientas y tecnología para que cada inspector siga criterios
              definidos y consistentes.
            </p>
          </article>

          <article className="border-[#D79A21]/30 p-7 text-center lg:border-r">
            <Eyebrow>TECNOLOGÍA PROPIA</Eyebrow>

            <h2 className="mt-4 text-[1.38rem] font-bold leading-tight">
              Estamos construyendo una plataforma
              <br />
              alrededor de cada inspección.
            </h2>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[11px] font-black">
              {[
                "CLIENTE",
                "INMUEBLE",
                "INSPECCIÓN",
                "HALLAZGOS",
                "EVIDENCIA",
                "REPORTE",
                "HISTORIAL",
              ].map((item, index, arr) => (
                <span key={item} className="flex items-center gap-2 whitespace-nowrap">
                  {item}
                  {index < arr.length - 1 && (
                    <span className="text-[#D79A21]">→</span>
                  )}
                </span>
              ))}
            </div>

            <div className="relative mx-auto mt-6 h-[185px] max-w-[430px]">
              <Image
                src="/branding/nosotros-plataforma-aprobada.png"
                alt="Plataforma tecnológica de Certeza Habitacional"
                width={860}
                height={370}
                className="h-full w-full object-contain"
              />
            </div>

            <p className="mt-5 text-[14px] leading-6 text-slate-400">
              Tecnología que permite trazabilidad, control, consistencia y una
              mejor experiencia para nuestros clientes e inspectores.
            </p>
          </article>

          <article className="p-7">
            <div className="text-center">
              <Eyebrow>NUESTRO COMPROMISO</Eyebrow>

              <h2 className="mt-4 text-[1.42rem] font-black leading-tight">
                La confianza exige ética,
                <br />
                incluso cuando nadie
                <br />
                está mirando.
              </h2>
            </div>

            <div className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
              <Check> Cada hallazgo debe tener sustento.</Check>
              <Check>
                Cada observación debe comunicarse con responsabilidad.
              </Check>
              <Check>
                Nuestro criterio no está condicionado por intereses comerciales
                de ninguna de las partes.
              </Check>
            </div>

            <p className="mt-6 text-center text-[1.05rem] font-black text-[#D79A21]">
              No exageramos. No minimizamos.
              <br />
              Documentamos.
            </p>
          </article>
        </div>
      </section>

      {/* =========================================================
          MISIÓN / VALORES / VISIÓN
      ========================================================== */}
      <section className="border-b border-[#D79A21]/45">
        <div className="mx-auto grid max-w-[1536px] items-stretch lg:grid-cols-[0.85fr_1.65fr_0.9fr]">
          <article className="border-[#D79A21]/30 p-7 lg:border-r">
            <Eyebrow>NUESTRA MISIÓN</Eyebrow>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Ofrecer inspecciones profesionales e independientes de vivienda
              que proporcionen información objetiva, clara y documentada, para
              que nuestros clientes tomen decisiones más informadas y con mayor
              certeza.
            </p>
          </article>

          <article className="border-[#D79A21]/30 p-7 lg:border-r">
            <div className="text-center">
              <Eyebrow>NUESTROS VALORES</Eyebrow>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-5">
              {valores.map((valor) => (
                <Valor key={valor.titulo} {...valor} />
              ))}
            </div>
          </article>

          <article className="p-7">
            <Eyebrow>NUESTRA VISIÓN</Eyebrow>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Ser la empresa líder y referente en inspección profesional de
              vivienda en México, reconocida por nuestra independencia,
              metodología, tecnología y compromiso con la ética, contribuyendo
              a elevar el estándar de confianza en cada operación inmobiliaria.
            </p>
          </article>
        </div>
      </section>

      {/* =========================================================
          CTA
      ========================================================== */}
      <section className="border-b border-white/10 py-5">
        <div className="mx-auto flex max-w-[1536px] flex-col items-center justify-between gap-5 px-7 lg:flex-row">
          <div>
            <p className="text-center text-sm text-slate-300 lg:text-left">
              Información. Objetividad. Respeto.
            </p>
            <p className="text-center text-[1.35rem] font-black text-[#D79A21] lg:text-left">
              Tres principios que generan certeza.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/inspecciones"
              className="bg-[#D79A21] px-7 py-3 text-sm font-black text-[#020B14] transition hover:brightness-110"
            >
              CONOCE NUESTRAS INSPECCIONES →
            </Link>

            <Link
              href="/cotizar"
              className="border border-[#D79A21] px-7 py-3 text-sm font-black transition hover:bg-[#D79A21]/10"
            >
              COTIZA TU INSPECCIÓN →
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
          FOOTER
      ========================================================== */}
      <footer className="bg-[#02070D] py-7">
        <div className="mx-auto grid max-w-[1536px] gap-8 px-7 md:grid-cols-2 lg:grid-cols-[1.05fr_1fr_0.8fr_0.7fr]">
          <div>
            <Image
              src="/branding/logo-autorizado.png"
              alt="Certeza Habitacional"
              width={270}
              height={240}
              className="h-auto w-[180px]"
            />

            <p className="mt-2 max-w-xs text-[12px] leading-5 text-slate-500">
              Inspecciones profesionales e independientes para ayudarte a tomar
              mejores decisiones sobre tu patrimonio.
            </p>
          </div>

          <div>
            <p className="text-xs font-black text-[#D79A21]">ZONAS DE COBERTURA</p>

            <div className="mt-3 space-y-1.5 text-xs text-slate-400">
              <a
                href="https://wa.me/526562871218"
                target="_blank"
                rel="noopener noreferrer"
                className="block whitespace-nowrap hover:text-white"
              >
                Ciudad Juárez — WhatsApp 656 287 12 18
              </a>

              <a
                href="https://wa.me/526647599923"
                target="_blank"
                rel="noopener noreferrer"
                className="block whitespace-nowrap hover:text-white"
              >
                Tijuana — WhatsApp 664 759 9923
              </a>

              <p>Guadalajara — Próximamente</p>
              <p>Hermosillo — Próximamente</p>

              <a
                href="mailto:contacto@certezahabitacional.com"
                className="block hover:text-white"
              >
                ✉ contacto@certezahabitacional.com
              </a>

              <p>◎ www.certezahabitacional.com</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-black text-[#D79A21]">SÍGUENOS</p>

            <div className="mt-4 flex gap-3">
              {["f", "◎", "◉", "▶", "in"].map((red) => (
                <span
                  key={red}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D79A21] text-xs font-black"
                >
                  {red}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-400">
            <Link href="/aviso-privacidad" className="block hover:text-white">
              Aviso de privacidad
            </Link>

            <Link href="/terminos" className="block hover:text-white">
              Términos y condiciones
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-slate-600">
          © {new Date().getFullYear()} Certeza Habitacional. Todos los derechos
          reservados.
        </p>
      </footer>

      <style>{`
        html,
        body {
          margin: 0;
          padding: 0;
          background: #020b14;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        html::-webkit-scrollbar,
        body::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
    </main>
  );
}

function Nav({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "border-b-2 border-[#D79A21] pb-2 text-sm font-black text-[#D79A21]"
          : "text-sm font-bold transition hover:text-[#D79A21]"
      }
    >
      {label}
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-black uppercase tracking-[0.04em] text-[#D79A21]">
      {children}
    </p>
  );
}

function MiniPilar({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-black">
      <span className="text-xl text-[#D79A21]">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function Metric({
  number,
  label,
  borders = false,
}: {
  number: string;
  label: string;
  borders?: boolean;
}) {
  return (
    <div className={borders ? "border-x border-[#D79A21]/35 px-3" : "px-3"}>
      <p className="whitespace-nowrap text-[clamp(1.8rem,2.8vw,2.9rem)] font-black tracking-[-0.04em] text-[#D79A21]">
        {number}
      </p>
      <p className="mt-1 text-[11px] font-black leading-4 text-[#D79A21]">
        {label}
      </p>
    </div>
  );
}

function Principio({
  simbolo,
  titulo,
  children,
}: {
  simbolo: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex gap-4">
      <span className="shrink-0 text-3xl text-[#D79A21]">{simbolo}</span>
      <div>
        <p className="font-black">{titulo}</p>
        <p className="mt-1 text-sm leading-5 text-slate-400">{children}</p>
      </div>
    </div>
  );
}

function Beneficiario({
  simbolo,
  titulo,
  texto,
}: {
  simbolo: string;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="min-h-[220px] border-[#D79A21]/30 px-4 py-2 text-center xl:border-r">
      <div className="text-3xl text-[#D79A21]">{simbolo}</div>
      <h3 className="mt-3 whitespace-pre-line text-[13px] font-black leading-5">
        {titulo}
      </h3>
      <p className="mt-3 text-[13px] leading-6 text-slate-300">{texto}</p>
    </div>
  );
}

function Paso({
  numero,
  titulo,
  simbolo,
  texto,
  ultimo,
}: {
  numero: string;
  titulo: string;
  simbolo: string;
  texto: string;
  ultimo: boolean;
}) {
  return (
    <div className="relative text-center">
      <p className="font-black text-[#D79A21]">{numero}</p>

      <div className="mx-auto mt-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#D79A21] text-2xl text-[#D79A21]">
        {simbolo}
      </div>

      <p className="mt-3 text-[12px] font-black">{titulo}</p>

      <p className="mt-2 text-[12px] leading-5 text-slate-300">{texto}</p>

      {!ultimo && (
        <span className="absolute -right-3 top-9 hidden text-lg text-[#D79A21] sm:block">
          →
        </span>
      )}
    </div>
  );
}

function Formula({ simbolo, label }: { simbolo: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl text-[#D79A21]">{simbolo}</div>
      <p className="mt-2 text-[10px] font-black">{label}</p>
    </div>
  );
}

function Signo({ children }: { children: React.ReactNode }) {
  return <span className="text-lg font-black text-[#D79A21]">{children}</span>;
}

function Cadena({ simbolo, label }: { simbolo: string; label: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className="text-xl text-[#D79A21]">{simbolo}</div>
      <p className="mt-2 text-[9px] font-black leading-3">{label}</p>
    </div>
  );
}

function Arrow() {
  return <span className="pt-2 text-[#D79A21]">→</span>;
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <p>
      <span className="mr-2 font-black text-[#D79A21]">✓</span>
      {children}
    </p>
  );
}

function Valor({
  simbolo,
  titulo,
  texto,
}: {
  simbolo: string;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#D79A21] text-xl text-[#D79A21]">
        {simbolo}
      </div>

      <p className="mt-3 text-[11px] font-black leading-4 text-[#D79A21]">
        {titulo}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-slate-300">{texto}</p>
    </div>
  );
}
