import Image from "next/image";
import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#02070D] text-white">
      <div className="mx-auto grid max-w-[1536px] gap-8 px-7 py-10 md:grid-cols-2 lg:grid-cols-[1.08fr_0.82fr_0.92fr_1.18fr_0.78fr]">
        <div>
          <Image
            src="/branding/logo-autorizado.png"
            alt="Certeza Habitacional"
            width={270}
            height={240}
            className="h-auto w-[180px]"
          />

          <p className="mt-3 max-w-[240px] text-[12px] leading-5 text-slate-400">
            Revisamos cada rincón antes de que des el sí.
          </p>
        </div>

        <div>
          <p className="text-xs font-black text-[#D79A21]">EXPLORA</p>

          <div className="mt-4 space-y-2 text-[13px] text-slate-300">
            <Link href="/nosotros" className="block transition hover:text-white">
              Nosotros
            </Link>
            <Link href="/inspecciones" className="block transition hover:text-white">
              Inspecciones
            </Link>
            <Link href="/tecnologia" className="block transition hover:text-white">
              Tecnología
            </Link>
            <Link href="/metodo" className="block transition hover:text-white">
              Método Certeza
            </Link>
            <Link href="/servicios" className="block transition hover:text-white">
              Servicios
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-black text-[#D79A21]">PARTICIPA</p>

          <div className="mt-4 space-y-2 text-[13px] text-slate-300">
            <span className="block">Únete a Certeza Habitacional</span>
            <span className="block">Quiero ser inspector</span>
            <span className="block">Quiero vender inspecciones</span>
            <span className="block">Alianzas</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-black text-[#D79A21]">ZONAS DE COBERTURA</p>

          <div className="mt-4 space-y-2 text-[13px] text-slate-300">
            <a
              href="https://wa.me/526562871218"
              target="_blank"
              rel="noreferrer"
              className="block transition hover:text-white"
            >
              Ciudad Juárez — WhatsApp 656 287 12 18
            </a>

            <a
              href="https://wa.me/526647599923"
              target="_blank"
              rel="noreferrer"
              className="block transition hover:text-white"
            >
              Tijuana — WhatsApp 664 759 9923
            </a>

            <span className="block text-slate-500">
              Guadalajara — Próximamente
            </span>

            <span className="block text-slate-500">
              Hermosillo — Próximamente
            </span>

            <a
              href="mailto:contacto@certezahabitacional.com"
              className="block break-all pt-2 transition hover:text-white"
            >
              contacto@certezahabitacional.com
            </a>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {["in", "◎", "f", "▶"].map((red) => (
              <span
                key={red}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-[11px] font-black"
              >
                {red}
              </span>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-[28px_1fr] gap-3">
            <span className="text-[#D79A21]">🚧</span>
            <div>
              <p className="text-[13px] font-black">Página en construcción</p>
              <p className="mt-1 text-[12px] leading-5 text-slate-400">
                Seguimos trabajando para servirte mejor.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1536px] flex-col gap-3 border-t border-white/10 px-7 py-5 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} Certeza Habitacional. Todos los derechos reservados.
        </p>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/aviso-privacidad" className="transition hover:text-white">
            Aviso de privacidad
          </Link>
          <Link href="/terminos" className="transition hover:text-white">
            Términos y condiciones
          </Link>
        </div>
      </div>
    </footer>
  );
}
