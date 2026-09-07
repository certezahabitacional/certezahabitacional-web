import Image from "next/image";
import Link from "next/link";

type ProximamentePageProps = {
  seccion?: string;
  mostrarCotizacion?: boolean;
};

export default function ProximamentePage({
  seccion,
  mostrarCotizacion = true,
}: ProximamentePageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020b14] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(214,162,61,0.10),transparent_34%),linear-gradient(145deg,#020912,#061423_52%,#020912)]" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <Image
          src="/branding/logo-gold.png"
          alt=""
          width={1500}
          height={1500}
          priority
          className="w-[118vw] max-w-none opacity-[0.07] sm:w-[95vw] lg:w-[82vw]"
        />
      </div>

      <section className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[900px] text-center">
          <Link href="/" aria-label="Volver al inicio" className="inline-block">
            <Image
              src="/branding/logo-gold.png"
              alt="Certeza Habitacional"
              width={320}
              height={230}
              priority
              className="mx-auto h-auto w-[220px] sm:w-[250px] lg:w-[285px]"
            />
          </Link>

          <div className="mx-auto mt-7 inline-flex items-center gap-3">
            <span className="h-px w-10 bg-[#D6A23D]" />
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#E2B34F] sm:text-sm">
              Próximamente
            </p>
            <span className="h-px w-10 bg-[#D6A23D]" />
          </div>

          {seccion ? (
            <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
              {seccion}
            </p>
          ) : null}

          <h1 className="mx-auto mt-5 max-w-[850px] text-[clamp(2.4rem,5vw,4.8rem)] font-black leading-[1.02] tracking-[-0.045em]">
            Estamos preparando
            <br />
            esta sección <span className="text-[#D6A23D]">para ti.</span>
          </h1>

          <div className="mx-auto mt-7 h-[2px] w-16 bg-[#D6A23D]" />

          <p className="mx-auto mt-7 max-w-[680px] text-base leading-8 text-slate-300 sm:text-lg">
            Queremos que cada espacio de nuestra plataforma sea claro, útil y esté
            listo antes de ponerlo a tu disposición.
          </p>

          <p className="mt-9 text-base font-semibold text-slate-200">
            Mientras tanto puedes:
          </p>

          <div className="mt-6 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
            <Link
              href="/"
              className="inline-flex min-h-[56px] items-center justify-center rounded-lg bg-gradient-to-r from-[#A96D13] via-[#D6A23D] to-[#E7BB58] px-7 text-sm font-black text-[#06111d] shadow-xl transition hover:-translate-y-0.5"
            >
              VOLVER AL INICIO
            </Link>

            {mostrarCotizacion ? (
              <Link
                href="/cotizar"
                className="inline-flex min-h-[56px] items-center justify-center rounded-lg border border-[#D6A23D] px-7 text-sm font-black text-white transition hover:bg-[#D6A23D]/10"
              >
                COTIZA TU INSPECCIÓN&nbsp;&nbsp; →
              </Link>
            ) : (
              <Link
                href="/portal"
                className="inline-flex min-h-[56px] items-center justify-center rounded-lg border border-[#D6A23D] px-7 text-sm font-black text-white transition hover:bg-[#D6A23D]/10"
              >
                ACCESO CLIENTES&nbsp;&nbsp; →
              </Link>
            )}
          </div>

          <p className="mx-auto mt-10 max-w-[620px] text-xs leading-6 text-slate-500">
            Certeza Habitacional · Revisamos cada rincón antes de que des el sí
          </p>
        </div>
      </section>

      <style>{`
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
      `}</style>
    </main>
  );
}
