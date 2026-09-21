import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdminOpcional } from "@/lib/supabase-admin";
import CapturaCamara from "../CapturaCamara";
import CargaGaleriaConPreview from "../CargaGaleriaConPreview";
import BotonGenerarIa from "../BotonGenerarIa";
import {
  cerrarPruebaProlongadaV1,
  continuarPreReporteDesdeHermeticidadV1,
  eliminarFotoPuntoCriticoV1,
  generarInterpretacionIaPruebaProlongadaV1,
  reabrirPruebaProlongadaV1,
  registrarInicioPruebaProlongadaV1,
  subirFotoPuntoCriticoV1,
} from "../actions";
import {
  marcarPruebaProlongadaNoAplicaV1,
  reactivarPruebaProlongadaV1,
} from "../conceptos-actions";

type Paso = {
  clave: string;
  nombre: string;
  estado: string;
  datos: unknown;
  lecturaInicial: string | null;
  lecturaFinal: string | null;
  unidad: string | null;
};

type DatosPaso = {
  pruebaProlongada?: boolean;
  pruebaProlongadaNoAplica?: boolean;
};

type Item = {
  id: string;
  concepto: string;
  observacion: string | null;
};

type Foto = {
  fotografiaId: string;
  guiaItemId: string;
  ruta: string;
  urlTemporal: string | null;
};

type Observacion = {
  descripcionIa?: string;
  descripcionFinal?: string;
  clasificacionFinal?: string;
  prioridadFinal?: string;
  calificacionFinal?: number;
  justificacionCalificacionIa?: string;
  prioridadEvaluadaIa?: string;
  clasificacionSugerida?: string;
  justificacionIa?: string;
  lecturaFinalPropuesta?: string;
  unidadFinalPropuesta?: string;
  variacionPresion?: string;
  diagnosticoProbable?: string;
  causasPosibles?: string[];
  verificacionesSugeridas?: string[];
};

function datosPaso(valor: unknown): DatosPaso {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as DatosPaso)
    : {};
}

function observacion(valor: string | null): Observacion {
  if (!valor) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Observacion)
      : {};
  } catch {
    return {};
  }
}

async function urlTemporalFoto(ruta: string) {
  const sb = obtenerSupabaseAdminOpcional();
  if (!sb) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(ruta, 60 * 30);
  return error ? null : data.signedUrl;
}

export default async function HermeticidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fase?: string; ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const fase = query.fase === "cierre" ? "cierre" : "inicio";

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
    }),
    prisma.inspeccion.findUnique({
      where: { id },
      select: {
        id: true,
        folio: true,
        numeroInspeccion: true,
        estado: true,
        inspectorId: true,
        cliente: { select: { nombre: true } },
        inmueble: { select: { alias: true, direccion: true } },
      },
    }),
  ]);

  if (!usuario?.activo) redirect("/acceso");
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}/captura`);

  const esInspector =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    usuario.inspector?.id === inspeccion.inspectorId;
  const esDirector = usuario.rol === RolUsuario.DIRECTOR;
  const consulta = usuario.rol === RolUsuario.GERENTE || usuario.rol === RolUsuario.COORDINADOR;
  if (!esInspector && !esDirector && !consulta) redirect("/acceso");

  const puedeCapturar =
    (esInspector && inspeccion.estado === EstadoInspeccion.EN_PROCESO) ||
    (esDirector &&
      (inspeccion.estado === EstadoInspeccion.EN_PROCESO ||
       inspeccion.estado === EstadoInspeccion.REPORTE_PENDIENTE));

  const pasos = await prisma.$queryRaw<Paso[]>`
    SELECT "clave","nombre","estado","datos","lecturaInicial","lecturaFinal","unidad"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${id}
      AND "clave" IN ('PC_HIDRAULICA','PC_GAS')
    ORDER BY "orden"
  `;

  const [areasRecorrido] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS "total"
    FROM "AreaInspeccion"
    WHERE "inspeccionId"=${id} AND "tipo" <> 'PUNTO_CRITICO'
  `;
  const totalRecorrido = 8 + Number(areasRecorrido?.total ?? 0);

  const pruebas = [];
  for (const paso of pasos) {
    const codigo = paso.clave === "PC_GAS" ? "GAS" : "HIDRAULICA";
    const datos = datosPaso(paso.datos);
    if (!datos.pruebaProlongada && !datos.pruebaProlongadaNoAplica) continue;

    const items = await prisma.$queryRaw<Item[]>`
      SELECT "id","concepto","observacion"
      FROM "GuiaInspeccionItem"
      WHERE "inspeccionId"=${id}
        AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
        AND ("concepto" ILIKE '%manómetro%' OR "concepto" ILIKE '%lectura final%')
      ORDER BY "orden"
    `;

    const inicial = items.find((item) => /manómetro/i.test(item.concepto));
    const final = items.find((item) => /lectura final/i.test(item.concepto));
    const ids = [inicial?.id, final?.id].filter((x): x is string => Boolean(x));

    const fotosBase = ids.length
      ? await prisma.$queryRaw<Array<{ fotografiaId: string; guiaItemId: string; ruta: string }>>`
          SELECT f."id" AS "fotografiaId", fa."guiaItemId", f."url" AS "ruta"
          FROM "FotografiaArea" fa
          JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
          WHERE fa."guiaItemId"=ANY(${ids}::text[])
          ORDER BY fa."orden"
        `
      : [];

    const fotos: Foto[] = await Promise.all(
      fotosBase.map(async (foto) => ({
        ...foto,
        urlTemporal: await urlTemporalFoto(foto.ruta),
      })),
    );

    pruebas.push({
      codigo,
      paso,
      datos,
      inicial,
      final,
      fotoInicial: inicial ? fotos.find((f) => f.guiaItemId === inicial.id) : undefined,
      fotoFinal: final ? fotos.find((f) => f.guiaItemId === final.id) : undefined,
      obs: observacion(final?.observacion ?? null),
    });
  }

  const inicioCompleto = pruebas.every(
    (p) => p.datos.pruebaProlongadaNoAplica || Boolean(p.paso.lecturaInicial),
  );
  const cierreCompleto = pruebas.every(
    (p) => p.datos.pruebaProlongadaNoAplica || Boolean(p.paso.lecturaFinal),
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-7 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/flujo`} className="text-sm font-black text-cyan-300">
            ← Retomar recorrido
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/panel/inspecciones/${id}/plan-inspeccion`} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs font-black text-amber-200">CONSULTAR PLAN DE {totalRecorrido} PARTIDAS</Link>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200">
              {fase === "inicio" ? "ETAPA INICIAL" : "ETAPA FINAL"}
            </span>
          </div>
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[.24em] text-amber-300">
          RECORRIDO TÉCNICO · PARTIDA 1 DE {totalRecorrido}
        </p>
        <h1 className="mt-2 text-4xl font-black">
          {fase === "inicio" ? "Lecturas iniciales antes del recorrido" : "Lecturas finales al terminar la inspección"}
        </h1>
        <p className="mt-3 max-w-4xl text-slate-300">
          {inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? inspeccion.inmueble?.direccion ?? "Inmueble"}
        </p>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">
          {fase === "inicio"
            ? "Primero se documenta Hidráulica y enseguida Gas. Después comienza el recorrido normal de Puntos Críticos."
            : "Compara las lecturas inicial y final de Hidráulica y Gas. Estas pruebas deben quedar cerradas antes del cierre final de la inspección."}
        </p>

        {(query.ok || query.error) && (
          <div className={`mt-5 rounded-2xl p-4 text-sm font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {query.error ?? query.ok}
          </div>
        )}

        <div className="mt-7 space-y-6">
          {pruebas.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 text-slate-400">
              La cotización no tiene pruebas de hermeticidad con manómetro configuradas.
            </div>
          )}

          {pruebas.map(({ codigo, paso, datos, inicial, final, fotoInicial, fotoFinal, obs }) => {
            const etiqueta = codigo === "HIDRAULICA" ? "INSTALACIÓN HIDRÁULICA" : "INSTALACIÓN DE GAS";
            const noAplica = Boolean(datos.pruebaProlongadaNoAplica);

            return (
              <section key={codigo} className="rounded-3xl border border-amber-300/25 bg-amber-300/5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-amber-200">{codigo === "HIDRAULICA" ? "CONCEPTO 1" : "CONCEPTO 2"} · {etiqueta}</p>
                    <h2 className="mt-1 text-2xl font-black">Prueba de hermeticidad con manómetro</h2>
                  </div>
                  <span className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-slate-300">
                    {noAplica ? "NO APLICA" : paso.lecturaFinal ? "CERRADA" : paso.lecturaInicial ? "ABIERTA · EN PRUEBA" : "PENDIENTE DE INICIO"}
                  </span>
                </div>

                {noAplica ? (
                  <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-slate-300">
                    <p className="font-black">NO APLICA ✓</p>
                    {puedeCapturar && (
                      <form action={reactivarPruebaProlongadaV1} className="mt-3">
                        <input type="hidden" name="inspeccionId" value={id} />
                        <input type="hidden" name="codigo" value={codigo} />
                        <button className="rounded-xl border border-cyan-300/30 px-4 py-2 text-xs font-black text-cyan-200">
                          REACTIVAR PRUEBA
                        </button>
                      </form>
                    )}
                  </div>
                ) : fase === "inicio" ? (
                  <div className="mt-5">
                    {!inicial ? (
                      <p className="rounded-xl bg-rose-400/10 p-4 text-sm font-bold text-rose-300">
                        No se encontró el concepto inicial del manómetro.
                      </p>
                    ) : paso.lecturaInicial ? (
                      <div className="rounded-2xl bg-emerald-300/10 p-4 text-emerald-200">
                        <p className="font-black">LECTURA INICIAL REGISTRADA ✓</p>
                        <p className="mt-2 text-sm">{paso.lecturaInicial} {paso.unidad ?? ""}</p>
                        {fotoInicial?.urlTemporal && (
                          <a href={fotoInicial.urlTemporal} target="_blank" rel="noreferrer" className="mt-3 block max-w-xl bg-black">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fotoInicial.urlTemporal} alt={`Lectura inicial ${etiqueta}`} className="h-64 w-full object-contain" />
                          </a>
                        )}
                        {puedeCapturar && (
                          <form action={reabrirPruebaProlongadaV1} className="mt-4">
                            <input type="hidden" name="inspeccionId" value={id}/>
                            <input type="hidden" name="codigo" value={codigo}/>
                            <input type="hidden" name="etapa" value="INICIAL"/>
                            <button className="rounded-xl border border-cyan-300/30 px-4 py-2 text-xs font-black text-cyan-200">
                              EDITAR LECTURA INICIAL / EVIDENCIA
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <>
                        {!fotoInicial?.urlTemporal ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <CapturaCamara inspeccionId={id} codigo={codigo} itemId={inicial.id} numeroFoto={1} totalFotos={1} retorno="HERMETICIDAD_INICIO" subirFoto={subirFotoPuntoCriticoV1} />
                            <CargaGaleriaConPreview inspeccionId={id} codigo={codigo} itemId={inicial.id} numeroFoto={1} totalFotos={1} retorno="HERMETICIDAD_INICIO" subirFoto={subirFotoPuntoCriticoV1} />
                          </div>
                        ) : (
                          <div className="max-w-xl">
                            <a href={fotoInicial.urlTemporal} target="_blank" rel="noreferrer" className="block bg-black">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={fotoInicial.urlTemporal} alt={`Lectura inicial ${etiqueta}`} className="h-64 w-full object-contain" />
                            </a>
                            {puedeCapturar && (
                              <form action={eliminarFotoPuntoCriticoV1} className="mt-2">
                                <input type="hidden" name="inspeccionId" value={id}/>
                                <input type="hidden" name="codigo" value={codigo}/>
                                <input type="hidden" name="fotografiaId" value={fotoInicial.fotografiaId}/>
                                <input type="hidden" name="retorno" value="HERMETICIDAD_INICIO"/>
                                <button className="w-full rounded-xl border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-300">QUITAR / REPETIR FOTO INICIAL</button>
                              </form>
                            )}
                          </div>
                        )}

                        {fotoInicial && (
                          <form action={registrarInicioPruebaProlongadaV1} className="mt-4 max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-4">
                            <input type="hidden" name="inspeccionId" value={id} />
                            <input type="hidden" name="codigo" value={codigo} />
                            <input type="hidden" name="itemId" value={inicial.id} />
                            <input type="hidden" name="retorno" value="HERMETICIDAD_INICIO" />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="text-xs font-bold text-slate-400">
                                Lectura inicial
                                <input name="lecturaInicial" required className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                              </label>
                              <label className="text-xs font-bold text-slate-400">
                                Unidad
                                <input name="unidad" required placeholder="psi, kPa, bar..." className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                              </label>
                            </div>
                            <button className="mt-3 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950">
                              REGISTRAR LECTURA INICIAL
                            </button>
                          </form>
                        )}

                        {!fotoInicial && puedeCapturar && (
                          <form action={marcarPruebaProlongadaNoAplicaV1} className="mt-4">
                            <input type="hidden" name="inspeccionId" value={id} />
                            <input type="hidden" name="codigo" value={codigo} />
                            <button className="rounded-xl border border-slate-500/40 px-4 py-2 text-xs font-black text-slate-300">
                              NO APLICA A ESTA PRUEBA
                            </button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-5">
                    {!paso.lecturaInicial ? (
                      <p className="rounded-xl bg-rose-400/10 p-4 text-sm font-bold text-rose-300">
                        Falta la lectura inicial. Debe registrarse antes del recorrido.
                      </p>
                    ) : paso.lecturaFinal ? (
                      <div className="rounded-2xl bg-emerald-300/10 p-4 text-emerald-200">
                        <p className="font-black">PRUEBA CERRADA ✓ · EDITABLE</p>
                        <p className="mt-2 text-sm">{paso.lecturaInicial} {paso.unidad ?? ""} → {paso.lecturaFinal} {paso.unidad ?? ""}</p>
                        {obs.descripcionFinal && <p className="mt-3 whitespace-pre-line text-xs leading-5 text-emerald-100"><strong>Interpretación final:</strong> {obs.descripcionFinal}</p>}
                        {puedeCapturar && (
                          <form action={reabrirPruebaProlongadaV1} className="mt-4">
                            <input type="hidden" name="inspeccionId" value={id}/>
                            <input type="hidden" name="codigo" value={codigo}/>
                            <input type="hidden" name="etapa" value="FINAL"/>
                            <button className="rounded-xl border border-cyan-300/30 px-4 py-2 text-xs font-black text-cyan-200">
                              EDITAR PRUEBA CERRADA
                            </button>
                          </form>
                        )}
                      </div>
                    ) : !final ? (
                      <p className="rounded-xl bg-rose-400/10 p-4 text-sm font-bold text-rose-300">
                        No se encontró el concepto final del manómetro.
                      </p>
                    ) : (
                      <>
                        {!fotoFinal?.urlTemporal ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <CapturaCamara inspeccionId={id} codigo={codigo} itemId={final.id} numeroFoto={1} totalFotos={1} retorno="HERMETICIDAD_CIERRE" subirFoto={subirFotoPuntoCriticoV1} />
                            <CargaGaleriaConPreview inspeccionId={id} codigo={codigo} itemId={final.id} numeroFoto={1} totalFotos={1} retorno="HERMETICIDAD_CIERRE" subirFoto={subirFotoPuntoCriticoV1} />
                          </div>
                        ) : (
                          <div className="max-w-xl">
                            <a href={fotoFinal.urlTemporal} target="_blank" rel="noreferrer" className="block bg-black">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={fotoFinal.urlTemporal} alt={`Lectura final ${etiqueta}`} className="h-64 w-full object-contain" />
                            </a>
                            {puedeCapturar && (
                              <form action={eliminarFotoPuntoCriticoV1} className="mt-2">
                                <input type="hidden" name="inspeccionId" value={id}/>
                                <input type="hidden" name="codigo" value={codigo}/>
                                <input type="hidden" name="fotografiaId" value={fotoFinal.fotografiaId}/>
                                <input type="hidden" name="retorno" value="HERMETICIDAD_CIERRE"/>
                                <button className="w-full rounded-xl border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-300">QUITAR / REPETIR FOTO FINAL</button>
                              </form>
                            )}
                          </div>
                        )}

                        {fotoFinal && (
                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <form action={generarInterpretacionIaPruebaProlongadaV1} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
                              <input type="hidden" name="inspeccionId" value={id} />
                              <input type="hidden" name="codigo" value={codigo} />
                              <input type="hidden" name="retorno" value="HERMETICIDAD_CIERRE" />
                              <p className="text-xs font-black uppercase text-cyan-200">Interpretación IA · obligatoria antes del cierre</p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <input name="lecturaFinal" required defaultValue={obs.lecturaFinalPropuesta ?? ""} placeholder="Lectura final" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2" />
                                <input name="unidad" required defaultValue={obs.unidadFinalPropuesta ?? paso.unidad ?? ""} placeholder="Unidad" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2" />
                              </div>
                              <div className="mt-3"><BotonGenerarIa /></div>
                              {obs.descripcionIa ? (
                                <div className="mt-4 rounded-xl border border-cyan-300/20 bg-slate-950 p-4 text-sm text-cyan-50">
                                  <p className="text-[11px] font-black uppercase tracking-wider text-cyan-300">Interpretación generada por IA</p>
                                  <p className="mt-2 whitespace-pre-line leading-6">{obs.descripcionIa}</p>
                                  {obs.variacionPresion && <p className="mt-3 text-xs text-cyan-200"><strong>Variación:</strong> {obs.variacionPresion}</p>}
                                  {obs.diagnosticoProbable && (
                                    <div className="mt-3 rounded-lg bg-cyan-300/10 p-3">
                                      <p className="text-xs font-black uppercase text-cyan-200">Diagnóstico probable</p>
                                      <p className="mt-1 text-xs leading-5 text-cyan-50">{obs.diagnosticoProbable}</p>
                                    </div>
                                  )}
                                  {obs.causasPosibles && obs.causasPosibles.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-black uppercase text-cyan-200">Posibles causas a considerar</p>
                                      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">
                                        {obs.causasPosibles.map((causa) => <li key={causa}>{causa}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {obs.verificacionesSugeridas && obs.verificacionesSugeridas.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-black uppercase text-cyan-200">Qué conviene verificar</p>
                                      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">
                                        {obs.verificacionesSugeridas.map((paso) => <li key={paso}>{paso}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {obs.clasificacionSugerida && <p className="mt-3 text-xs text-cyan-200"><strong>Clasificación sugerida:</strong> {obs.clasificacionSugerida}</p>}
                                  {obs.justificacionIa && <p className="mt-2 text-xs leading-5 text-slate-400"><strong>Justificación IA:</strong> {obs.justificacionIa}</p>}
                                </div>
                              ) : (
                                <p className="mt-3 rounded-xl bg-amber-300/10 p-3 text-xs font-bold text-amber-200">
                                  Genera primero la interpretación de IA. El sistema no permitirá cerrar la prueba sin este paso.
                                </p>
                              )}
                            </form>

                            <form action={cerrarPruebaProlongadaV1} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                              <input type="hidden" name="inspeccionId" value={id} />
                              <input type="hidden" name="codigo" value={codigo} />
                              <input type="hidden" name="retorno" value="HERMETICIDAD_CIERRE" />
                              <p className="text-xs font-black uppercase text-emerald-200">Cierre técnico · interpretación final del Inspector</p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <input name="lecturaFinal" required defaultValue={obs.lecturaFinalPropuesta ?? ""} placeholder="Lectura final" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2" />
                                <input name="unidad" required defaultValue={obs.unidadFinalPropuesta ?? paso.unidad ?? ""} placeholder="Unidad" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2" />
                              </div>
                              <label className="mt-3 block text-xs font-black uppercase tracking-wider text-emerald-200">
                                Interpretación final del Inspector
                                <textarea name="descripcionFinal" required defaultValue={obs.descripcionFinal ?? obs.descripcionIa ?? ""} placeholder="La interpretación IA aparecerá aquí automáticamente para que el Inspector la confirme o ajuste." className="mt-2 min-h-32 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case tracking-normal text-white" />
                              </label>
                              <p className="mt-2 text-xs leading-5 text-slate-400">
                                La IA sirve como propuesta técnica. Este campo es la interpretación final que quedará en el reporte; puede conservarse tal cual o ajustarse por el Inspector.
                              </p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <select name="clasificacion" defaultValue={obs.clasificacionFinal ?? obs.clasificacionSugerida ?? "C"} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2">
                                  <option value="C">C · Conforme</option>
                                  <option value="O">O · Observación</option>
                                  <option value="NC">NC · No conformidad</option>
                                  <option value="CR">CR · Crítico</option>
                                </select>
                                <select name="prioridad" defaultValue={obs.prioridadFinal ?? "P3"} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2">
                                  <option value="P1">P1</option>
                                  <option value="P2">P2</option>
                                  <option value="P3">P3</option>
                                  <option value="P4">P4</option>
                                  <option value="P5">P5</option>
                                </select>
                              </div>
                              <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3">
                                <p className="text-xs font-black uppercase text-cyan-200">Calificación automática por IA</p>
                                <p className="mt-2 text-xs leading-5 text-cyan-50">El Inspector selecciona la prioridad del resultado y la IA define la calificación exacta dentro de ese rango. P1 0–49 · P2 50–69 · P3 70–79 · P4 80–89 · P5 90–99. Conforme = SH 100.</p>
                              </div>
                              <button disabled={!obs.descripcionIa} className="mt-3 w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">
                                {obs.descripcionIa ? "REGISTRAR LECTURA FINAL Y CERRAR PRUEBA" : "GENERA PRIMERO LA INTERPRETACIÓN IA"}
                              </button>
                            </form>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {fase === "inicio" && inicioCompleto && (
          <div className="mt-7 rounded-3xl border border-emerald-300/25 bg-emerald-300/5 p-6">
            <p className="font-black text-emerald-200">LECTURAS INICIALES COMPLETAS ✓</p>
            <p className="mt-2 text-sm text-slate-300">
              Continúa ahora con el recorrido normal de Puntos Críticos, iniciando en Instalación Hidráulica.
            </p>
            <Link href={`/panel/inspecciones/${id}/puntos-criticos?punto=HIDRAULICA`} className="mt-4 inline-block rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950">
              INICIAR RECORRIDO DE PUNTOS CRÍTICOS
            </Link>
          </div>
        )}

        {fase === "cierre" && cierreCompleto && (
          <div className="mt-7 rounded-3xl border border-emerald-300/25 bg-emerald-300/5 p-6">
            <p className="font-black text-emerald-200">PRUEBAS DE HERMETICIDAD CERRADAS ✓</p>
            <p className="mt-2 text-sm text-slate-300">
              Las lecturas iniciales y finales de Hidráulica y Gas ya quedaron documentadas. El siguiente paso es el pre-reporte integral.
            </p>
            <form action={continuarPreReporteDesdeHermeticidadV1} className="mt-4">
              <input type="hidden" name="inspeccionId" value={id}/>
              <button className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950">
                CONTINUAR AL PRE-REPORTE
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
