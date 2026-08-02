import Link from "next/link";
import { redirect } from "next/navigation";

async function verificarCertificado(formData: FormData) {
  "use server";

  const codigo = String(formData.get("codigo") ?? "")
    .trim()
    .toUpperCase();

  if (!codigo) {
    redirect("/certificados?error=Escribe%20el%20código%20de%20validación");
  }

  redirect(`/certificados/verificar/${encodeURIComponent(codigo)}`);
}

export default async function CertificadosPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const query = await searchParams;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
              Certeza Habitacional
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-5xl">
              Validación de certificados
            </h1>
          </div>

          <Link
            href="/"
            className="hidden rounded-full border border-white/15 px-5 py-3 font-bold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-300 sm:inline-block"
          >
            Página principal
          </Link>
        </header>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_380px]">
          <section className="rounded-[2rem] border border-white/10 bg-slate-900 p-7 shadow-2xl sm:p-10">
            <p className="text-sm font-black uppercase tracking-widest text-cyan-300">
              Consulta pública
            </p>

            <h2 className="mt-3 text-3xl font-black">
              Verifica la autenticidad de un certificado
            </h2>

            <p className="mt-4 max-w-2xl leading-7 text-slate-400">
              Introduce el código impreso en el documento. El sistema
              comprobará si el certificado está registrado y si continúa
              vigente.
            </p>

            {query.error && (
              <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 font-bold text-rose-300">
                {query.error}
              </div>
            )}

            <form
              action={verificarCertificado}
              className="mt-8"
            >
              <label className="block">
                <span className="mb-3 block text-sm font-black">
                  Código de validación
                </span>

                <input
                  name="codigo"
                  required
                  autoComplete="off"
                  placeholder="Ejemplo: CH-A7CAD8A4F49440CB"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-lg font-bold uppercase outline-none transition placeholder:normal-case placeholder:text-slate-600 focus:border-cyan-300"
                />
              </label>

              <button
                type="submit"
                className="mt-5 w-full rounded-full bg-cyan-400 px-6 py-4 font-black text-slate-950 transition hover:bg-cyan-300"
              >
                Verificar certificado
              </button>
            </form>

            <div className="mt-8 border-t border-white/10 pt-6 text-sm leading-6 text-slate-500">
              También puedes escanear el código QR que aparece en el
              certificado. No necesitas iniciar sesión para realizar esta
              consulta.
            </div>
          </section>

          <aside className="rounded-[2rem] bg-cyan-300 p-8 text-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.28em]">
              Resultado verificable
            </p>

            <h2 className="mt-4 text-3xl font-black">
              Información que podrás consultar
            </h2>

            <div className="mt-7 space-y-4">
              <Caracteristica
                simbolo="✓"
                titulo="Autenticidad"
                descripcion="Confirma que el documento fue emitido por Certeza Habitacional."
              />

              <Caracteristica
                simbolo="●"
                titulo="Vigencia"
                descripcion="Indica si el certificado continúa vigente o fue revocado."
              />

              <Caracteristica
                simbolo="#"
                titulo="Folios"
                descripcion="Muestra los folios del certificado y de la inspección."
              />

              <Caracteristica
                simbolo="100"
                titulo="Índice ISH"
                descripcion="Presenta el Índice de Salud Habitacional registrado."
              />
            </div>
          </aside>
        </div>

        <footer className="mt-10 text-center text-sm text-slate-600">
          Consulta directa desde los registros de Certeza Habitacional.
        </footer>
      </section>
    </main>
  );
}

function Caracteristica({
  simbolo,
  titulo,
  descripcion,
}: {
  simbolo: string;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950/10 p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-11 min-w-11 place-items-center rounded-full bg-slate-950 font-black text-white">
          {simbolo}
        </div>

        <div>
          <p className="font-black">
            {titulo}
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-800">
            {descripcion}
          </p>
        </div>
      </div>
    </div>
  );
}