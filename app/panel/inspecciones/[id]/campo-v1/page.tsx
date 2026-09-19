import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  agregarPuntoInspectorV1,
  cerrarAreaConHallazgosV1,
  cerrarAreaSinHallazgosV1,
  inicializarPlanAreasV1,
  marcarPuntoNoAplicaV1,
  marcarPuntoRevisadoV1,
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

export default async function CampoV1Page({ params, searchParams }: {
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
    select: {
      id: true, folio: true, numeroInspeccion: true, estado: true, inspectorId: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true, direccion: true } },
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}/flujo`);

  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const esDirectorPorAusencia = usuario.rol === RolUsuario.DIRECTOR && !inspeccion.inspectorId;
  const consulta = ([RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR] as RolUsuario[]).includes(usuario.rol);
  if (!esInspector && !consulta) redirect("/acceso");

  const [critical] = await prisma.$queryRaw<Array<{ total: number; bloqueantes: number }>>`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (
        WHERE p."estado" NOT IN ('COMPLETADO','NO_APLICA')
          AND NOT (
            p."clave" IN ('PC_HIDRAULICA','PC_GAS')
            AND p."lecturaInicial" IS NOT NULL
            AND p."lecturaFinal" IS NULL
            AND COALESCE((p."datos"->>'pruebaProlongada')::boolean,false)
            AND NOT EXISTS (
              SELECT 1
              FROM "GuiaInspeccionItem" g
              WHERE g."inspeccionId"=p."inspeccionId"
                AND g."area"=concat('__PUNTO_CRITICO__:',replace(p."clave",'PC_',''))
                AND g."estadoV3"='PENDIENTE'
                AND g."concepto" NOT ILIKE '%manómetro%'
                AND g."concepto" NOT ILIKE '%lectura final%'
            )
          )
      )::int AS "bloqueantes"
    FROM "ProtocoloInspeccionPaso" p
    WHERE p."inspeccionId"=${id} AND p."tipo"='PUNTO_CRITICO'
  `;
  if (Number(critical?.total ?? 0) < 7 || Number(critical?.bloqueantes ?? 0) > 0) {
    redirect(`/panel/inspecciones/${id}/puntos-criticos`);
  }

  const areas = await prisma.$queryRaw<Area[]>`
    SELECT a."id"::text,a."codigo",a."nombre",a."estado",a."resultado",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id") AS "fotos",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."areaId"=a."id" AND fa."seleccionadaReporte"=true) AS "seleccionadas",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre") AS "hallazgos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id") AS "puntos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."obligatorio"=true AND g."estadoV3"='PENDIENTE') AS "pendientes",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3"='NO_APLICA') AS "noAplica"
    FROM "AreaInspeccion" a
    WHERE a."inspeccionId"=${id} AND a."tipo" <> 'PUNTO_CRITICO'
    ORDER BY a."orden",a."nombre"
  `;

  const areaActiva = areas.find((a) => a.estado !== "REVISADA") ?? null;
  if (query.area && areaActiva) {
    const solicitada = areas.find((a) => a.id === query.area);
    if (solicitada && solicitada.estado !== "REVISADA" && solicitada.id !== areaActiva.id) {
      redirect(`/panel/inspecciones/${id}/campo-v1?area=${areaActiva.id}&error=${encodeURIComponent("Debes concluir al 100% el punto de área activo antes de avanzar al siguiente.")}`);
    }
  }
  const areaSeleccionada = areas.find((a) => a.id === query.area) ?? areaActiva ?? areas[0];
  const puntos = areaSeleccionada ? await prisma.$queryRaw<Punto[]>`
    SELECT g."id",g."concepto",p."grupo",g."estadoV3",g."origenV3",g."obligatorio",g."herramientaSugerida",g."motivoNoAplica"
    FROM "GuiaInspeccionItem" g LEFT JOIN "BibliotecaPuntoCerteza" p ON p."id"=g."bibliotecaPuntoId"
    WHERE g."areaId"=${areaSeleccionada.id}::uuid ORDER BY g."orden",g."concepto"
  ` : [];

  const totalPuntos = areas.reduce((s, a) => s + Number(a.puntos), 0);
  const totalPendientes = areas.reduce((s, a) => s + Number(a.pendientes), 0);
  const cerradas = areas.filter((a) => a.estado === "REVISADA").length;
  const avance = areas.length ? Math.round((cerradas / areas.length) * 100) : 0;
  const totalRecorrido = 8 + areas.length;
  const indiceAreaActiva = areaSeleccionada ? areas.findIndex((area) => area.id === areaSeleccionada.id) : -1;
  const numeroAreaActiva = indiceAreaActiva >= 0 ? 9 + indiceAreaActiva : null;
  const puedeCapturar = (esInspector || esDirectorPorAusencia) && inspeccion.estado === EstadoInspeccion.EN_PROCESO;
  const areaActivaId = areas.find((area) => area.estado !== "REVISADA")?.id ?? null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/flujo`} className="text-sm font-black text-cyan-300">← Flujo V1</Link>
          <div className="flex flex-wrap items-center gap-2">
            {esDirectorPorAusencia && <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200">DIRECTOR POR AUSENCIA</span>}
            <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-emerald-300">V1 · INSPECCIÓN INTEGRAL</span>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">
            {numeroAreaActiva ? `RECORRIDO TÉCNICO · PUNTO ${numeroAreaActiva} DE ${totalRecorrido}` : "RECORRIDO TÉCNICO"}
          </p>
          <h1 className="mt-2 text-3xl font-black">Recorrido guiado por puntos de área</h1>
          <p className="mt-2 text-sm text-slate-400">{inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? inspeccion.inmueble?.direccion ?? "Inmueble"}</p>
        </div>

        {(query.ok || query.error) && <div className={`mt-5 rounded-2xl p-4 text-sm font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{query.error ?? query.ok}</div>}

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <Card titulo="Puntos de área cerrados" valor={`${cerradas}/${areas.length}`} />
          <Card titulo="Puntos del plan" valor={String(totalPuntos)} />
          <Card titulo="Pendientes" valor={String(totalPendientes)} />
          <Card titulo="Avance" valor={`${avance}%`} />
        </section>

        {puedeCapturar && totalPuntos === 0 && areas.length > 0 && (
          <form action={inicializarPlanAreasV1} className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-5">
            <input type="hidden" name="inspeccionId" value={id}/>
            <h2 className="text-xl font-black">Preparar plan técnico V1</h2>
            <p className="mt-2 text-sm text-slate-300">El sistema cargará automáticamente los puntos mínimos de la Biblioteca Certeza para las áreas declaradas. Podrás excluir lo que no aplique y agregar puntos adicionales.</p>
            <button className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">Generar puntos mínimos</button>
          </form>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-2">
            {areas.map((area, index) => {
              const activa = area.id === areaActivaId;
              const cerrada = area.estado === "REVISADA";
              const bloqueada = !cerrada && !activa;
              const contenido = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-black text-slate-500">{9 + index}/{totalRecorrido}</span>
                    <span className={`text-xs font-black ${cerrada ? "text-emerald-300" : activa ? "text-amber-300" : "text-slate-600"}`}>
                      {cerrada ? "CERRADA 100%" : activa ? `${area.pendientes} pendientes` : "BLOQUEADO"}
                    </span>
                  </div>
                  <p className="mt-1 font-black">{area.nombre}</p>
                  <p className="mt-1 text-xs text-slate-400">{area.puntos} conceptos · {area.hallazgos} hallazgos · {area.noAplica} no aplica</p>
                </>
              );
              const clases = `block rounded-2xl border p-4 ${areaSeleccionada?.id === area.id
                ? "border-cyan-300/40 bg-cyan-300/10"
                : cerrada
                  ? "border-emerald-400/15 bg-emerald-400/5"
                  : bloqueada
                    ? "cursor-not-allowed border-white/5 bg-slate-950 text-slate-700"
                    : "border-amber-300/20 bg-amber-300/5"}`;
              return bloqueada ? (
                <div key={area.id} className={clases} aria-disabled="true">{contenido}</div>
              ) : (
                <Link key={area.id} href={`/panel/inspecciones/${id}/campo-v1?area=${area.id}`} className={clases}>{contenido}</Link>
              );
            })}
          </aside>

          <section>
            {!areaSeleccionada ? <div className="rounded-3xl border border-white/10 bg-slate-900 p-8 text-slate-400">Aún no existen áreas para V1.</div> : (
              <div className="rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-widest text-cyan-300">{numeroAreaActiva ? `Punto ${numeroAreaActiva} de ${totalRecorrido}` : "Área activa"}</p><h2 className="mt-1 text-2xl font-black">{areaSeleccionada.nombre}</h2><p className="mt-2 text-sm text-slate-400">{areaSeleccionada.puntos} conceptos · {areaSeleccionada.fotos} evidencias · {areaSeleccionada.hallazgos} hallazgos</p></div>
                  {areaSeleccionada.resultado && <span className="rounded-full bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-300">{areaSeleccionada.resultado.replaceAll("_"," ")}</span>}
                </div>

                <div className="mt-5 space-y-2">
                  {puntos.map((punto) => (
                    <article key={punto.id} className={`rounded-2xl border p-4 ${punto.estadoV3 === "NO_APLICA" ? "border-slate-700 bg-slate-950/50 opacity-70" : punto.estadoV3 === "PENDIENTE" ? "border-amber-300/15 bg-amber-300/5" : "border-emerald-300/15 bg-emerald-300/5"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><div className="flex flex-wrap gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{punto.grupo ?? "ADICIONAL"}</span>{punto.origenV3 === "INSPECTOR" && <span className="rounded-full bg-violet-300/10 px-2 py-0.5 text-[10px] font-black text-violet-300">AGREGADO EN CAMPO</span>}</div><p className="mt-1 font-bold">{punto.concepto}</p>{punto.herramientaSugerida && <p className="mt-1 text-xs text-slate-500">Herramienta sugerida: {punto.herramientaSugerida}</p>}{punto.motivoNoAplica && <p className="mt-1 text-xs text-slate-500">Motivo: {punto.motivoNoAplica}</p>}</div>
                        <span className={`text-xs font-black ${punto.estadoV3 === "PENDIENTE" ? "text-amber-300" : "text-emerald-300"}`}>{punto.estadoV3.replaceAll("_"," ")}</span>
                      </div>
                      {puedeCapturar && punto.estadoV3 === "PENDIENTE" && areaSeleccionada?.id === areaActivaId && (
                        <div className="mt-3 grid gap-2 md:grid-cols-[auto_1fr_auto]">
                          <form action={marcarPuntoRevisadoV1}>
                            <input type="hidden" name="inspeccionId" value={id}/>
                            <input type="hidden" name="itemId" value={punto.id}/>
                            <button className="w-full rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950">
                              REVISADO / CONFORME
                            </button>
                          </form>
                          <form action={marcarPuntoNoAplicaV1} className="contents">
                            <input type="hidden" name="inspeccionId" value={id}/>
                            <input type="hidden" name="itemId" value={punto.id}/>
                            <input name="motivo" placeholder="Si no aplica, indica por qué" className="min-w-0 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"/>
                            <button className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs font-black text-amber-200">NO APLICA</button>
                          </form>
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                {puedeCapturar && areaSeleccionada.estado !== "REVISADA" && areaSeleccionada.id === areaActivaId && (
                  <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    <form action={agregarPuntoInspectorV1} className="rounded-2xl border border-violet-300/15 bg-violet-300/5 p-4">
                      <input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={areaSeleccionada.id}/>
                      <p className="font-black text-violet-200">+ Agregar punto de inspección</p>
                      <p className="mt-1 text-xs text-slate-400">Amplía el plan cuando tu criterio profesional lo considere necesario.</p>
                      <input name="concepto" required placeholder="Ej. Revisar sellado en cancel fijo" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"/>
                      <button className="mt-3 rounded-xl border border-violet-300/30 px-4 py-2 text-sm font-black text-violet-200">Agregar al área</button>
                    </form>

                    {Number(areaSeleccionada.hallazgos) === 0 ? (
                      <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4">
                        <p className="font-black text-emerald-200">Cierre rápido sin hallazgos</p>
                        <p className="mt-1 text-xs text-slate-400">Todos los conceptos aplicables deben quedar resueltos individualmente como REVISADO / CONFORME o NO APLICA. El cierre sólo se habilita cuando el punto llega al 100%.</p>
                        <form action={cerrarAreaSinHallazgosV1} className="mt-3"><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={areaSeleccionada.id}/><button disabled={Number(areaSeleccionada.fotos)<1 || Number(areaSeleccionada.pendientes)>0} className="w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">CERRAR PUNTO AL 100% · SIN HALLAZGOS</button></form>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
                        <p className="font-black text-amber-200">Cierre con hallazgos</p>
                        <p className="mt-1 text-xs text-slate-400">El sistema comprobará que cada hallazgo tenga descripción y mínimo 4 evidencias antes de cerrar el área.</p>
                        <form action={cerrarAreaConHallazgosV1} className="mt-3"><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={areaSeleccionada.id}/><button disabled={Number(areaSeleccionada.pendientes)>0} className="w-full rounded-xl bg-amber-300 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">CERRAR PUNTO AL 100% · {areaSeleccionada.hallazgos} HALLAZGO(S)</button></form>
                      </div>
                    )}
                  </div>
                )}

                {puedeCapturar && areaSeleccionada.estado !== "REVISADA" && areaSeleccionada.id === areaActivaId && (
                  <div className="mt-4 flex flex-wrap gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-4">
                    <Link href={`/panel/inspecciones/${id}/areas`} className="rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-black text-cyan-200">Tomar / agregar fotografías</Link>
                    <Link href={`/panel/inspecciones/${id}/captura?area=${encodeURIComponent(areaSeleccionada.nombre)}`} className="rounded-xl border border-amber-300/30 px-4 py-2 text-sm font-black text-amber-200">Registrar hallazgo</Link>
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
