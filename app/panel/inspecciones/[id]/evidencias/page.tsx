import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { registrarEvidencia } from "./actions";

function obtenerSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function EvidenciasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      hallazgos: {
        orderBy: { creadoEn: "desc" },
        select: {
          id: true,
          titulo: true,
          area: true,
        },
      },
      fotografias: {
        orderBy: { creadaEn: "desc" },
        include: {
          hallazgo: {
            select: {
              titulo: true,
            },
          },
        },
      },
    },
  });

  if (!inspeccion) {
    notFound();
  }

  const supabase = obtenerSupabase();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";

  const fotografias = await Promise.all(
    inspeccion.fotografias.map(async (foto) => {
      // Conserva compatibilidad con registros antiguos que tengan URL pública.
      if (
        foto.url.startsWith("http://") ||
        foto.url.startsWith("https://")
      ) {
        return {
          ...foto,
          imagenUrl: foto.url,
        };
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(foto.url, 60 * 60);

      return {
        ...foto,
        imagenUrl: error ? null : data.signedUrl,
      };
    }),
  );

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/panel/inspecciones/${id}`}
          className="text-sm font-bold text-cyan-300"
        >
          ← Volver al expediente
        </Link>

        <p className="mt-5 font-black text-cyan-300">
          {inspeccion.folio}
        </p>

        <h1 className="mt-2 text-3xl font-black">
          Evidencias fotográficas
        </h1>

        <p className="mt-2 text-slate-400">
          Las fotografías se almacenan de forma privada en Supabase Storage.
        </p>

        {query.ok && (
          <p className="mt-5 rounded-2xl bg-emerald-400/10 px-5 py-4 font-bold text-emerald-300">
            {query.ok}
          </p>
        )}

        {query.error && (
          <p className="mt-5 rounded-2xl bg-rose-400/10 px-5 py-4 font-bold text-rose-300">
            {query.error}
          </p>
        )}

        <form
          action={registrarEvidencia}
          className="mt-7 grid gap-4 rounded-3xl border border-white/10 bg-slate-900 p-6 md:grid-cols-2"
        >
          <input type="hidden" name="inspeccionId" value={id} />

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-bold">
              Seleccionar fotografía *
            </span>

            <input
              name="archivo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:font-bold file:text-slate-950"
            />

            <span className="mt-2 block text-xs text-slate-400">
              Formatos permitidos: JPG, PNG y WEBP. Tamaño máximo: 10 MB.
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold">
              Vincular a hallazgo
            </span>

            <select
              name="hallazgoId"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            >
              <option value="">Evidencia general</option>

              {inspeccion.hallazgos.map((hallazgo) => (
                <option key={hallazgo.id} value={hallazgo.id}>
                  {hallazgo.area}: {hallazgo.titulo}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold">
              Descripción
            </span>

            <input
              name="descripcion"
              placeholder="Ejemplo: humedad debajo de la ventana"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            />
          </label>

          <button className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 md:col-span-2">
            Subir y registrar evidencia
          </button>
        </form>

        {fotografias.length === 0 ? (
          <div className="mt-7 rounded-3xl border border-white/10 bg-slate-900 p-10 text-center text-slate-400">
            Todavía no hay evidencias fotográficas registradas.
          </div>
        ) : (
          <section className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {fotografias.map((foto) => (
              <article
                key={foto.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900"
              >
                {foto.imagenUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={foto.imagenUrl}
                    alt={foto.descripcion ?? "Evidencia"}
                    className="h-56 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-56 place-items-center bg-slate-950 text-sm text-slate-500">
                    No se pudo cargar la imagen
                  </div>
                )}

                <div className="p-5">
                  <p className="font-black">
                    {foto.hallazgo?.titulo ?? "Evidencia general"}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {foto.descripcion ?? "Sin descripción"}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}