import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { actualizarOrdenEvidencia, cambiarSeleccionEvidencia } from "./actions";

type Seleccion = { id: string; fotografiaId: string; seleccionada: boolean; orden: number; notaEditorial: string | null };

async function leerSelecciones(inspeccionId: string): Promise<{ disponible: boolean; filas: Seleccion[] }> {
  try {
    const t = await prisma.$queryRaw<Array<{ tabla: string | null }>>`SELECT to_regclass('public."SeleccionEvidenciaReporte"')::text AS "tabla"`;
    if (!t[0]?.tabla) return { disponible: false, filas: [] };
    const filas = await prisma.$queryRaw<Seleccion[]>`
      SELECT "id","fotografiaId","seleccionada","orden","notaEditorial"
      FROM "SeleccionEvidenciaReporte" WHERE "inspeccionId"=${inspeccionId}
    `;
    return { disponible: true, filas };
  } catch {
    return { disponible: false, filas: [] };
  }
}

export default async function ReporteEvidenciasPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, rol: true, activo: true } });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true, folio: true, estado: true,
      inspector: { select: { usuario: { select: { gerenteId: true, coordinadorId: true } } } },
      hallazgos: {
        orderBy: [{ prioridad: "asc" }, { creadoEn: "asc" }],
        select: {
          id: true, area: true, titulo: true, clasificacion: true, prioridad: true,
          fotografias: { orderBy: { creadaEn: "asc" }, select: { id: true, url: true, descripcion: true } },
        },
      },
    },
  });
  if (!inspeccion) notFound();

  const puedeEditar =
    usuario.rol === RolUsuario.DIRECTOR ||
    (usuario.rol === RolUsuario.GERENTE && inspeccion.inspector?.usuario.gerenteId === usuario.id) ||
    (usuario.rol === RolUsuario.COORDINADOR && inspeccion.inspector?.usuario.coordinadorId === usuario.id);
  if (!puedeEditar) redirect("/acceso");

  const seleccion = await leerSelecciones(id);
  const mapa = new Map(seleccion.filas.map((f) => [f.fotografiaId, f]));
  const seleccionadas = seleccion.filas.filter((f) => f.seleccionada).sort((a, b) => a.orden - b.orden);
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const supabaseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && key ? createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  async function urlFoto(url: string) {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(url, 60 * 60);
    return error ? null : data.signedUrl;
  }

  const hallazgos = await Promise.all(inspeccion.hallazgos.map(async (h) => ({
    ...h,
    fotografias: await Promise.all(h.fotografias.map(async (f) => ({ ...f, imagenUrl: await urlFoto(f.url) }))),
  })));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-7 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}`} className="font-black text-cyan-300">← Expediente</Link>
          <Link href={`/panel/inspecciones/${id}/evidencia-control`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-amber-300">Control 4 fotos</Link>
        </div>

        <header className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Edición del reporte · {inspeccion.folio}</p>
          <h1 className="mt-2 text-3xl font-black">Selección de evidencias</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Las fotografías originales del expediente no se eliminan. Aquí únicamente se decide cuáles aparecerán en el reporte final y en qué orden.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-white/5 px-3 py-2">Estado: {inspeccion.estado}</span>
            <span className="rounded-full bg-violet-400/10 px-3 py-2 text-violet-300">Seleccionadas: {seleccionadas.length}</span>
          </div>
        </header>

        {!seleccion.disponible && <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">La pantalla está preparada, pero la selección editorial permanecerá deshabilitada hasta aplicar la migración correspondiente en la base de datos.</div>}
        {query.ok && <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 font-bold text-emerald-300">{query.ok}</div>}
        {query.error && <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 font-bold text-rose-300">{query.error}</div>}

        {seleccion.disponible && seleccionadas.length > 0 && (
          <section className="mt-7 rounded-3xl border border-violet-400/20 bg-slate-900 p-5">
            <h2 className="text-xl font-black">Orden del reporte</h2>
            <div className="mt-4 space-y-2">
              {seleccionadas.map((s, index) => {
                const foto = hallazgos.flatMap((h) => h.fotografias.map((f) => ({ ...f, hallazgo: h }))).find((f) => f.id === s.fotografiaId);
                return <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 p-3">
                  <p className="text-sm"><b>#{index + 1}</b> · {foto?.hallazgo.area} · {foto?.hallazgo.titulo}</p>
                  <div className="flex gap-2">
                    <form action={actualizarOrdenEvidencia}><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="seleccionId" value={s.id}/><input type="hidden" name="direccion" value="SUBIR"/><button disabled={index === 0} className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-30">↑</button></form>
                    <form action={actualizarOrdenEvidencia}><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="seleccionId" value={s.id}/><input type="hidden" name="direccion" value="BAJAR"/><button disabled={index === seleccionadas.length - 1} className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-30">↓</button></form>
                  </div>
                </div>;
              })}
            </div>
          </section>
        )}

        <section className="mt-7 space-y-5">
          {hallazgos.map((h, hi) => (
            <article key={h.id} className="rounded-3xl border border-white/10 bg-slate-900 p-5">
              <div className="flex flex-wrap gap-2 text-xs font-black"><span className="text-cyan-300">#{hi + 1} · {h.area}</span><span className="rounded-full bg-white/5 px-2 py-1">{h.clasificacion}</span><span className="rounded-full bg-white/5 px-2 py-1">{h.prioridad}</span></div>
              <h2 className="mt-2 text-xl font-black">{h.titulo}</h2>
              <p className="mt-1 text-sm text-slate-400">{h.fotografias.length} fotografía(s) disponibles · mínimo operativo de campo: 4.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {h.fotografias.map((f) => {
                  const s = mapa.get(f.id);
                  const activa = Boolean(s?.seleccionada);
                  return <div key={f.id} className={`overflow-hidden rounded-2xl border ${activa ? "border-violet-300/50" : "border-white/10"} bg-slate-950`}>
                    {f.imagenUrl ? <img src={f.imagenUrl} alt={f.descripcion ?? `Evidencia de ${h.titulo}`} className="aspect-[4/3] w-full object-cover"/> : <div className="flex aspect-[4/3] items-center justify-center text-xs text-slate-500">Vista no disponible</div>}
                    <form action={cambiarSeleccionEvidencia} className="p-3">
                      <input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="fotografiaId" value={f.id}/><input type="hidden" name="seleccionada" value={String(!activa)}/>
                      <p className="min-h-10 text-xs text-slate-400">{f.descripcion || "Sin descripción"}</p>
                      {activa && <input name="notaEditorial" defaultValue={s?.notaEditorial ?? ""} placeholder="Nota editorial opcional" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs"/>}
                      <button disabled={!seleccion.disponible} className={`mt-3 w-full rounded-xl px-3 py-2 text-sm font-black disabled:opacity-40 ${activa ? "border border-rose-400/30 text-rose-300" : "bg-violet-300 text-slate-950"}`}>{activa ? "Quitar del reporte" : "Seleccionar para reporte"}</button>
                    </form>
                  </div>;
                })}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
