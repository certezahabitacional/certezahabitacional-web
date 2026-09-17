import { createClient } from "@supabase/supabase-js";

import { prisma } from "@/lib/prisma";
import { subirFotoFachadaPrevia } from "./actions";
import { importarFotoFachadaDesdeBase } from "./fuentes-actions";

type FotoHistorica = {
  fotografiaId: string;
  ruta: string;
  folio: string;
  fechaProgramada: Date;
  candidataPortada: boolean;
};

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function urlTemporal(ruta: string) {
  const sb = supabaseAdmin();
  if (!sb) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(ruta, 60 * 15);
  return error ? null : data.signedUrl;
}

export async function FuentesAlternasFachada({
  inspeccionId,
}: {
  inspeccionId: string;
}) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { inmuebleId: true },
  });

  const historicas = inspeccion?.inmuebleId
    ? await prisma.$queryRaw<FotoHistorica[]>`
        SELECT f."id" AS "fotografiaId", f."url" AS "ruta", i."folio", i."fechaProgramada", fa."candidataPortada"
        FROM "FotografiaArea" fa
        JOIN "AreaInspeccion" a ON a."id" = fa."areaId"
        JOIN "Fotografia" f ON f."id" = fa."fotografiaId"
        JOIN "Inspeccion" i ON i."id" = f."inspeccionId"
        WHERE i."inmuebleId" = ${inspeccion.inmuebleId}
          AND i."id" <> ${inspeccionId}
          AND a."codigo" = 'FACHADA_PRINCIPAL'
        ORDER BY fa."candidataPortada" DESC, i."fechaProgramada" DESC, f."creadoEn" DESC
        LIMIT 12
      `
    : [];

  const historicasConUrl = await Promise.all(
    historicas.map(async (foto) => ({ ...foto, urlTemporal: await urlTemporal(foto.ruta) })),
  );

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4 sm:p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Fuentes alternas</p>
        <h3 className="mt-1 text-lg font-black">Si no puedes tomar la foto en ese momento</h3>
        <p className="mt-2 text-sm text-slate-400">
          Puedes cargarla desde la galería/archivos del dispositivo o reutilizar una fachada histórica del mismo inmueble. La imagen elegida se copiará al expediente actual y conservará trazabilidad.
        </p>
      </div>

      <form action={subirFotoFachadaPrevia} className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
        <input type="hidden" name="inspeccionId" value={inspeccionId} />
        <label className="block text-sm font-black text-cyan-200">Galería o archivos del dispositivo</label>
        <input
          name="archivo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="mt-3 block w-full text-xs text-slate-300"
        />
        <button className="mt-3 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">
          AGREGAR DESDE GALERÍA / ARCHIVOS
        </button>
      </form>

      <div className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h4 className="text-sm font-black">Base de evidencias del inmueble</h4>
            <p className="mt-1 text-xs text-slate-500">Muestra fachadas registradas en inspecciones anteriores del mismo inmueble.</p>
          </div>
          <span className="text-xs font-bold text-slate-500">{historicasConUrl.length} disponibles</span>
        </div>

        {historicasConUrl.length === 0 ? (
          <p className="mt-3 rounded-xl border border-white/10 p-3 text-xs text-slate-500">
            Este inmueble todavía no tiene fotografías históricas de fachada disponibles en la base de evidencias.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {historicasConUrl.map((foto) => (
              <article key={foto.fotografiaId} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                {foto.urlTemporal ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto.urlTemporal} alt={`Fachada histórica ${foto.folio}`} className="h-36 w-full object-cover" />
                ) : (
                  <div className="grid h-36 place-items-center text-2xl text-slate-600">📷</div>
                )}
                <div className="p-3">
                  <p className="text-xs font-black text-slate-200">{foto.folio}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(foto.fechaProgramada)}
                    {foto.candidataPortada ? " · portada histórica" : ""}
                  </p>
                  <form action={importarFotoFachadaDesdeBase} className="mt-3">
                    <input type="hidden" name="inspeccionId" value={inspeccionId} />
                    <input type="hidden" name="fotografiaOrigenId" value={foto.fotografiaId} />
                    <button className="w-full rounded-xl border border-emerald-300/30 px-3 py-2 text-xs font-black text-emerald-300">
                      USAR ESTA FOTO
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
