import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdminOpcional } from "@/lib/supabase-admin";
import {
  agregarAreaManual,
  confirmarAreasV1,
  generarAreasDesdeGuia,
  subirFotoArea,
} from "./actions";
import { seleccionarPortadaFachadaV1 } from "./portada-actions";

type Area = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  origen: string;
  obligatoria: boolean;
  estado: string;
  comentarioFinal: string | null;
  fotos: number;
  portada: boolean;
};

type FotoFachada = {
  fotografiaId: string;
  descripcion: string | null;
  ruta: string;
  candidataPortada: boolean;
  orden: number;
  creadaEn: Date;
};

type Control = {
  proyectoConfirmado: boolean;
  areasConfirmadas: boolean;
} | null;

async function urlTemporalFoto(ruta: string) {
  const sb = obtenerSupabaseAdminOpcional();
  if (!sb) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(ruta, 60 * 15);
  return error ? null : data.signedUrl;
}

export default async function AreasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
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
      id: true,
      folio: true,
      numeroInspeccion: true,
      estado: true,
      inspectorId: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion > 1) redirect(`/panel/inspecciones/${id}/captura`);

  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const esDirectorPorAusencia = usuario.rol === RolUsuario.DIRECTOR && !inspeccion.inspectorId;
  const rolesConsulta: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR];
  const consulta = rolesConsulta.includes(usuario.rol);
  if (!esInspector && !consulta) redirect("/acceso");

  const [controlRows, criticalRows, areas, fotosFachada] = await Promise.all([
    prisma.$queryRaw<Control[]>`
      SELECT "proyectoConfirmado","areasConfirmadas"
      FROM "InspeccionControlV2" WHERE "inspeccionId"=${id} LIMIT 1
    `,
    prisma.$queryRaw<Array<{ total: number; bloqueantes: number; pruebasAbiertas: number }>>`
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
        )::int AS "bloqueantes",
        COUNT(*) FILTER (
          WHERE p."clave" IN ('PC_HIDRAULICA','PC_GAS')
            AND p."lecturaInicial" IS NOT NULL
            AND p."lecturaFinal" IS NULL
            AND COALESCE((p."datos"->>'pruebaProlongada')::boolean,false)
        )::int AS "pruebasAbiertas"
      FROM "ProtocoloInspeccionPaso" p
      WHERE p."inspeccionId"=${id} AND p."tipo"='PUNTO_CRITICO'
    `,
    prisma.$queryRaw<Area[]>`
      SELECT a."id",a."codigo",a."nombre",a."tipo",a."origen",a."obligatoria",a."estado",a."comentarioFinal",
             COUNT(fa."id")::int AS "fotos",
             COALESCE(BOOL_OR(fa."candidataPortada"),false) AS "portada"
      FROM "AreaInspeccion" a
      LEFT JOIN "FotografiaArea" fa ON fa."areaId"=a."id"
      WHERE a."inspeccionId"=${id} AND a."tipo" <> 'PUNTO_CRITICO'
      GROUP BY a."id"
      ORDER BY a."orden",a."nombre"
    `,
    prisma.$queryRaw<FotoFachada[]>`
      SELECT fa."fotografiaId",f."descripcion",f."url" AS "ruta",fa."candidataPortada",fa."orden",fa."creadoEn"
      FROM "FotografiaArea" fa
      JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
      JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
      WHERE a."inspeccionId"=${id} AND a."codigo"='FACHADA_PRINCIPAL'
      ORDER BY fa."orden",fa."creadoEn"
    `,
  ]);

  const control = controlRows[0] ?? null;
  if (inspeccion.estado === EstadoInspeccion.EN_PROCESO && !control?.proyectoConfirmado) {
    redirect(`/panel/inspecciones/${id}/proyecto-v1`);
  }
  const critical = criticalRows[0];
  if (
    inspeccion.estado === EstadoInspeccion.EN_PROCESO &&
    control?.proyectoConfirmado &&
    (Number(critical?.total ?? 0) < 7 || Number(critical?.bloqueantes ?? 0) > 0)
  ) {
    redirect(`/panel/inspecciones/${id}/puntos-criticos`);
  }

  const fotosFachadaConUrl = await Promise.all(
    fotosFachada.map(async (foto) => ({
      ...foto,
      urlTemporal: await urlTemporalFoto(foto.ruta),
    })),
  );

  const puedeCapturar = (esInspector || esDirectorPorAusencia) && inspeccion.estado === EstadoInspeccion.EN_PROCESO;
  const completas = areas.filter((a) => a.estado === "REVISADA").length;
  const avance = areas.length ? Math.round((completas / areas.length) * 100) : 0;
  const totalRecorrido = 8 + areas.length;
  const primerPuntoArea = areas.length > 0 ? 9 : null;
  const ultimoPuntoArea = areas.length > 0 ? totalRecorrido : null;
  const areaActivaId = areas.find((area) => area.estado !== "REVISADA")?.id ?? null;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}`} className="text-sm font-black text-cyan-300">← Expediente</Link>
          <div className="flex flex-wrap gap-2">
            {esDirectorPorAusencia && <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200">DIRECTOR POR AUSENCIA</span>}
            <Link href={`/panel/inspecciones/${id}/campo-v1`} className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-black text-cyan-300">Recorrido V1</Link>
            <Link href={`/panel/inspecciones/${id}/protocolo`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-amber-300">Protocolo V1</Link>
          </div>
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[.24em] text-emerald-300">
          RECORRIDO TÉCNICO · {primerPuntoArea ? `PUNTOS ${primerPuntoArea} A ${ultimoPuntoArea}` : "ÁREAS PENDIENTES DE DEFINIR"}
        </p>
        <h1 className="mt-2 text-4xl font-black">Áreas de la vivienda como puntos del recorrido</h1>
        <p className="mt-2 text-slate-400">{inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"}</p>

        {(query.ok || query.error) && (
          <p className={`mt-5 rounded-2xl p-4 font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {query.error ?? query.ok}
          </p>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-4">
          <Resumen titulo="Proyecto / Plantilla" valor={control?.proyectoConfirmado ? "Confirmado" : "Pendiente"} />
          <Resumen titulo="Puntos de área" valor={String(areas.length)} />
          <Resumen titulo="Cerradas" valor={`${completas}/${areas.length}`} />
          <Resumen titulo="Avance" valor={`${avance}%`} />
        </section>

        {puedeCapturar && areas.length === 0 && (
          <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-xl font-black">Definir puntos de área del recorrido</h2>
            <p className="mt-2 text-sm text-slate-300">Genera cualquier área adicional desde la guía técnica. La correlación Proyecto/Plantilla ya incorporó al expediente las áreas identificadas antes de llegar a esta pantalla.</p>
            <form action={generarAreasDesdeGuia} className="mt-4"><input type="hidden" name="inspeccionId" value={id}/><button className="rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">Generar áreas desde guía</button></form>
          </section>
        )}

        {puedeCapturar && areas.length > 0 && !control?.areasConfirmadas && (
          <section className="mt-6 rounded-3xl border border-violet-300/20 bg-violet-300/5 p-6">
            <h2 className="text-xl font-black">Verificar y confirmar puntos de área</h2>
            <p className="mt-2 text-sm text-slate-300">Antes de confirmar, agrega cualquier recámara, baño, estancia, patio, cochera u otra área física que no haya surgido del proyecto, la cotización o la guía.</p>
            <form action={agregarAreaManual} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <input type="hidden" name="inspeccionId" value={id}/>
              <input name="nombre" required placeholder="Ej. Recámara 3" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"/>
              <select name="tipo" defaultValue="INTERIOR" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"><option value="INTERIOR">Interior</option><option value="EXTERIOR">Exterior</option><option value="INSTALACION">Instalación</option></select>
              <button className="rounded-xl border border-violet-300/30 px-5 py-3 font-black text-violet-300">Agregar área</button>
            </form>
            <form action={confirmarAreasV1} className="mt-4"><input type="hidden" name="inspeccionId" value={id}/><button className="rounded-xl bg-violet-300 px-5 py-3 font-black text-slate-950">Confirmar puntos de área</button></form>
          </section>
        )}

        <div className="mt-7 space-y-4">
          {areas.map((area, index) => {
            const fotos = Number(area.fotos);
            const completa = area.estado === "REVISADA";
            const fachada = area.codigo === "FACHADA_PRINCIPAL";
            const minimo = 1;
            const evidenciaLista = fotos >= minimo;
            const cerrada = completa;
            const activa = area.id === areaActivaId;
            const bloqueada = !cerrada && !activa;
            return (
              <article key={area.id} className={`rounded-3xl border p-5 ${completa ? "border-emerald-400/20 bg-emerald-400/5" : bloqueada ? "border-white/5 bg-slate-950 opacity-60" : fachada ? "border-cyan-300/30 bg-cyan-300/5" : "border-amber-300/20 bg-amber-300/5"}`}>
                <div className="grid gap-4 lg:grid-cols-[65px_1fr_300px]">
                  <span className="font-mono text-lg font-black text-cyan-300">{9 + index}/{totalRecorrido}</span>
                  <div>
                    <div className="flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">{area.tipo}</span><span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">{area.origen}</span>{fachada && <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-300">IDENTIFICACIÓN / PORTADA</span>}</div>
                    <p className="mt-2 text-xs font-black uppercase tracking-wider text-emerald-300">Punto {9 + index} del recorrido · {completa ? "CERRADO 100%" : activa ? "ACTIVO" : "BLOQUEADO"}</p>
                    <h2 className="mt-1 text-xl font-black">{area.nombre}</h2>
                    <p className={`mt-2 text-sm font-bold ${evidenciaLista ? "text-emerald-300" : "text-amber-300"}`}>{fotos}/{minimo} fotografía{minimo === 1 ? " mínima" : "s mínimas"}{area.portada ? " · portada seleccionada" : fachada ? " · portada pendiente" : ""}</p>
                    {area.comentarioFinal && <p className="mt-3 text-sm text-slate-300"><strong>Resultado del recorrido:</strong> {area.comentarioFinal}</p>}
                    <p className="mt-3 text-xs text-slate-500">El cierre técnico del área se realiza únicamente desde Recorrido V1.</p>

                    {fachada && fotosFachadaConUrl.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-slate-950/60 p-4">
                        <p className="text-sm font-black text-cyan-200">Seleccionar foto de portada</p>
                        <p className="mt-1 text-xs text-slate-400">Elige una de las fotografías de fachada. El sistema mantendrá exactamente una como portada.</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {fotosFachadaConUrl.map((foto, fotoIndex) => (
                            <form key={foto.fotografiaId} action={seleccionarPortadaFachadaV1} className={`overflow-hidden rounded-xl border ${foto.candidataPortada ? "border-emerald-300/30 bg-emerald-300/10" : "border-white/10 bg-slate-950"}`}>
                              <input type="hidden" name="inspeccionId" value={id}/>
                              <input type="hidden" name="fotografiaId" value={foto.fotografiaId}/>
                              {foto.urlTemporal ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={foto.urlTemporal} alt={`Foto ${fotoIndex + 1} de fachada`} className="h-36 w-full object-cover" />
                              ) : (
                                <div className="flex h-36 items-center justify-center bg-white/5 px-4 text-center text-xs font-bold text-slate-500">Vista previa no disponible</div>
                              )}
                              <div className="p-3">
                                <p className="text-xs font-black">Foto {fotoIndex + 1} {foto.candidataPortada ? "· PORTADA ACTUAL" : ""}</p>
                                <p className="mt-1 min-h-8 text-xs text-slate-500">{foto.descripcion || "Sin descripción"}</p>
                                {puedeCapturar && (
                                  <button disabled={foto.candidataPortada} className="mt-2 w-full rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-black text-cyan-200 disabled:border-emerald-300/20 disabled:text-emerald-300 disabled:opacity-70">
                                    {foto.candidataPortada ? "PORTADA SELECCIONADA" : "USAR COMO PORTADA"}
                                  </button>
                                )}
                              </div>
                            </form>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {puedeCapturar && control?.areasConfirmadas && activa ? (
                    <div className="space-y-3">
                      <form action={subirFotoArea} className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                        <input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={area.id}/>
                        <input name="archivo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="block w-full text-xs text-slate-400"/>
                        <input name="descripcion" placeholder="Descripción opcional" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"/>
                        <button className="mt-3 w-full rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-slate-950">Tomar / agregar foto</button>
                      </form>
                      <Link href={`/panel/inspecciones/${id}/campo-v1?area=${area.id}`} className="block rounded-xl border border-emerald-300/30 px-4 py-3 text-center text-sm font-black text-emerald-300">{completa ? "Ver resultado en Recorrido V1" : "Continuar revisión en Recorrido V1"}</Link>
                    </div>
                  ) : (
                    <div className={`rounded-2xl p-4 text-sm font-bold ${completa ? "bg-emerald-300/10 text-emerald-300" : bloqueada ? "bg-white/5 text-slate-600" : "bg-white/5 text-slate-500"}`}>{completa ? "Punto cerrado al 100% ✓" : bloqueada ? "BLOQUEADO · concluye el punto anterior al 100%" : control?.areasConfirmadas ? "Punto activo pendiente de recorrido" : "Confirma primero los puntos de área"}</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {areas.length > 0 && completas === areas.length && control?.areasConfirmadas && (
          <div className="mt-7 rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-6 text-emerald-200">
            <p className="font-black">Recorrido por áreas completo</p>
            {Number(critical?.pruebasAbiertas ?? 0) > 0 ? (
              <>
                <p className="mt-2 text-sm">
                  Ya terminaste Sala, Comedor, Cocina, Baños, Recámaras y demás áreas. Ahora corresponde regresar a las pruebas de hermeticidad para tomar las lecturas finales de Hidráulica y Gas.
                </p>
                <Link
                  href={`/panel/inspecciones/${id}/puntos-criticos/hermeticidad?fase=cierre`}
                  className="mt-4 inline-block rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950"
                >
                  TOMAR LECTURAS FINALES DE HERMETICIDAD
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm">Todas las áreas obligatorias y las pruebas de hermeticidad están cerradas. Puedes continuar al cierre formal de la inspección.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return <article className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{titulo}</p><p className="mt-2 text-2xl font-black text-cyan-300">{valor}</p></article>;
}
