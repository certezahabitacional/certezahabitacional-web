import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  agregarPuntoInspectorV3,
  cerrarAreaSinHallazgosV3,
  inicializarPlanAreasV3,
  marcarPuntoNoAplicaV3,
} from "./actions";

type Punto = {
  id: string;
  concepto: string;
  grupo: string | null;
  estadoV3: string;
  origenV3: string;
  obligatorio: boolean;
  herramientaSugerida: string | null;
  motivoNoAplica: string | null;
};

type Area = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  resultado: string | null;
  fotos: number;
  seleccionadas: number;
  hallazgos: number;
  puntos: number;
  pendientes: number;
  noAplica: number;
};

export default async function CampoV3Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; area?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true, inspector: { select: { id: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { id: true, folio: true, estado: true, inspectorId: true, cliente: { select: { nombre: true } }, inmueble: { select: { alias: true, direccion: true } } },
  });
  if (!inspeccion) notFound();

  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const consulta = ([RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR] as RolUsuario[]).includes(usuario.rol);
  if (!esInspector && !consulta) redirect("/acceso");

  const areas = await prisma.$queryRaw<Area[]>`
    SELECT a."id"::text,a."codigo",a."nombre",a."estado",a."resultado",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id") AS "fotos",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id" AND fa."seleccionadaReporte"=true) AS "seleccionadas",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."areaId"=a."id") AS "hallazgos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id") AS "puntos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."obligatorio"=true AND g."estadoV3"='PENDIENTE') AS "pendientes",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3"='NO_APLICA') AS "noAplica"
    FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} ORDER BY a."orden",a."nombre"
  `;

  const activas = areas.filter((a) => a.estado !== "REVISADA");
  const areaSeleccionada = areas.find((a) => a.id === query.area) ?? activas[0] ?? areas[0];
  const puntos = areaSeleccionada ? await prisma.$queryRaw<Punto[]>`
    SELECT g."id",g."concepto",p."grupo",g."estadoV3",g."origenV3",g."obligatorio",g."herramientaSugerida",g."motivoNoAplica"
    FROM "GuiaInspeccionItem" g
    LEFT JOIN "BibliotecaPuntoCerteza" p ON p."id"=g."bibliotecaPuntoId"
    WHERE g."areaId"=${areaSeleccionada.id}::uuid ORDER BY g."orden",g."concepto"
  ` : [];

  const totalPuntos = areas.reduce((s, a) => s + Number(a.puntos), 0);
  const totalPendientes = areas.reduce((s, a) => s + Number(a.pendientes), 0);
  const cerradas = areas.filter((a) => a.estado === "REVISADA").length;
  const avance = areas.length ? Math.round((cerradas / areas.length) * 100) : 0;
  const puedeCapturar = esInspector && inspeccion.estado === EstadoInspeccion.EN_PROCESO;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/flujo`} className="text-sm font-black text-cyan-300">← Flujo de inspección</Link>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300">CAMPO V3</span>
        </div>

        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">Método Certeza Habitacional</p>
          <h1 className="mt-2 text-3xl font-black">Inspección guiada por áreas</h1>
          <p className="mt-2 text-sm text-slate-400">{inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"}</p>
        </div>

        {(query.ok || query.error) && <div className={`mt-5 rounded-2xl p-4 text-sm font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{query.error ?? query.ok}</div>}

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <Card titulo="Áreas cerradas" valor={`${cerradas}/${areas.length}`} />
          <Card titulo="Puntos del plan" valor={String(totalPuntos)} />
          <Card titulo="Pendientes" valor={String(totalPendientes)} />
          <Card titulo="Avance" valor={`${avance}%`} />
        </section>

        {puedeCapturar && totalPuntos === 0 && areas.length > 0 && (
          <form action={inicializarPlanAreasV3} className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-5">
            <input type="hidden" name="inspeccionId" value={id}/>
            <h2 className="text-xl font-black">Preparar plan técnico</h2>
            <p className="mt-2 text-sm text-slate-300">El sistema tomará las áreas declaradas y cargará sus puntos mínimos desde la Biblioteca Certeza. El Inspector podrá excluir lo que no aplique y agregar puntos adicionales.</p>
            <button className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">Generar puntos mínimos</button>
          </form>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-2">
            {areas.map((area, index) => (
              <Link key={area.id} href={`/panel/inspecciones/${id}/campo-v3?area=${area.id}`} className={`block rounded-2xl border p-4 ${areaSeleccionada?.id === area.id ? "border-cyan-300/40 bg-cyan-300/10" : area.estado === "REVISADA" ? "border-emerald-400/15 bg-emerald-400/5" : "border-white/10 bg-slate-900"}`}>
                <div className="flex items-start justify-between gap-3"><span className="text-xs font-black text-slate-500">{String(index + 1).padStart(2,"0")}</span><span className={`text-xs font-black ${area.estado === "REVISADA" ? "text-emerald-300" : "text-amber-300"}`}>{area.estado === "REVISADA" ? "CERRADA" : `${area.pendientes} pendientes`}</span></div>
                <p className="mt-1 font-black">{area.nombre}</p>
                <p className="mt-1 text-xs text-slate-400">{area.puntos} puntos · {area.hallazgos} hallazgos · {area.noAplica} no aplica</p>
              </Link>
            ))}
          </aside>

          <section>
            {!areaSeleccionada ? (
              <div className="rounded-3xl border border-white/10 bg-slate-900 p-8 text-slate-400">Aún no existen áreas de inspección.</div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-widest text-cyan-300">Área activa</p><h2 className="mt-1 text-2xl font-black">{areaSeleccionada.nombre}</h2><p className="mt-2 text-sm text-slate-400">{areaSeleccionada.puntos} puntos · {areaSeleccionada.fotos} evidencias · {areaSeleccionada.hallazgos} hallazgos</p></div>
                  {areaSeleccionada.resultado && <span className="rounded-full bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-300">{areaSeleccionada.resultado.replaceAll("_"," ")}</span>}
                </div>

                <div className="mt-5 space-y-2">
                  {puntos.map((punto) => (
                    <article key={punto.id} className={`rounded-2xl border p-4 ${punto.estadoV3 === "NO_APLICA" ? "border-slate-700 bg-slate-950/50 opacity-70" : punto.estadoV3 === "PENDIENTE" ? "border-amber-300/15 bg-amber-300/5" : "border-emerald-300/15 bg-emerald-300/5"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><div className="flex flex-wrap gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{punto.grupo ?? "ADICIONAL"}</span>{punto.origenV3 === "INSPECTOR" && <span className="rounded-full bg-violet-300/10 px-2 py-0.5 text-[10px] font-black text-violet-300">AGREGADO POR INSPECTOR</span>}</div><p className="mt-1 font-bold">{punto.concepto}</p>{punto.herramientaSugerida && <p className="mt-1 text-xs text-slate-500">Herramienta sugerida: {punto.herramientaSugerida}</p>}{punto.motivoNoAplica && <p className="mt-1 text-xs text-slate-500">Motivo: {punto.motivoNoAplica}</p>}</div>
                        <span className={`text-xs font-black ${punto.estadoV3 === "PENDIENTE" ? "text-amber-300" : "text-emerald-300"}`}>{punto.estadoV3.replaceAll("_"," ")}</span>
                      </div>
                      {puedeCapturar && punto.estadoV3 === "PENDIENTE" && (
                        <form action={marcarPuntoNoAplicaV3} className="mt-3 flex gap-2">
                          <input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="itemId" value={punto.id}/>
                          <input name="motivo" placeholder="Si no aplica, indica por qué" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"/>
                          <button className="rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-slate-300">NO APLICA</button>
                        </form>
                      )}
                    </article>
                  ))}
                </div>

                {puedeCapturar && areaSeleccionada.estado !== "REVISADA" && (
                  <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    <form action={agregarPuntoInspectorV3} className="rounded-2xl border border-violet-300/15 bg-violet-300/5 p-4">
                      <input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={areaSeleccionada.id}/>
                      <p className="font-black text-violet-200">+ Agregar punto de inspección</p>
                      <p className="mt-1 text-xs text-slate-400">Amplía el plan cuando tu criterio profesional lo considere necesario.</p>
                      <input name="concepto" required placeholder="Ej. Revisar sellado en cancel fijo" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"/>
                      <button className="mt-3 rounded-xl border border-violet-300/30 px-4 py-2 text-sm font-black text-violet-200">Agregar al área</button>
                    </form>

                    <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4">
                      <p className="font-black text-emerald-200">Cierre rápido sin hallazgos</p>
                      <p className="mt-1 text-xs text-slate-400">Cuando todos los puntos aplicables estén atendidos y exista evidencia, el sistema redactará automáticamente el resultado satisfactorio.</p>
                      <form action={cerrarAreaSinHallazgosV3} className="mt-3"><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={areaSeleccionada.id}/><button disabled={Number(areaSeleccionada.pendientes)>0 || Number(areaSeleccionada.fotos)<1 || Number(areaSeleccionada.hallazgos)>0} className="w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">SIN HALLAZGOS · CERRAR ÁREA</button></form>
                      <p className="mt-2 text-[11px] text-slate-500">Requiere 0 pendientes, 0 hallazgos y al menos 1 fotografía.</p>
                    </div>
                  </div>
                )}

                {puedeCapturar && areaSeleccionada.estado !== "REVISADA" && (
                  <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-4">
                    <p className="font-black text-cyan-200">Evidencia fotográfica</p>
                    <p className="mt-1 text-sm text-slate-300">La captura de fotos sigue disponible en el módulo de Áreas mientras integramos la cámara directamente en esta pantalla V3.</p>
                    <Link href={`/panel/inspecciones/${id}/areas`} className="mt-3 inline-block rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-black text-cyan-200">Tomar / agregar fotografías</Link>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{titulo}</p><p className="mt-2 text-2xl font-black text-cyan-300">{valor}</p></div>;
}