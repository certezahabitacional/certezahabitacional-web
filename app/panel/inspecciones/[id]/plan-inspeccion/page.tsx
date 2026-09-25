import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PUNTOS_CRITICOS_V1 } from "@/lib/puntos-criticos-v1";
import { prisma } from "@/lib/prisma";
import { agruparPuntosMaestrosV1, estimarMinutosPlanV1, type PerfilInspeccionV1 } from "@/lib/plan-inspeccion-depurado-v1";
import { guardarPlanInspeccionV1, reabrirPlanInspeccionV1 } from "./actions";

type Snapshot = Record<string, unknown>;

type PartidaPlan = {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  origen: string;
  conceptos: number;
};

type ConceptoPlan = {
  areaId: string;
  codigo: string;
  concepto: string;
  especificacion: string | null;
  grupo: string | null;
  herramienta: string | null;
  orden: number;
};

type BibliotecaPartida = {
  codigo: string;
  nombre: string;
  puntos: number;
};

function numero(valor: unknown) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function booleano(snapshot: Snapshot, campo: string) {
  return snapshot[campo] === true;
}

function inferirCodigosPartidas(snapshot: Snapshot) {
  const codigos: string[] = [
    "FACHADA_PRINCIPAL",
    "FACHADA_LATERAL",
    "FACHADA_LATERAL",
    "FACHADA_LATERAL",
  ];

  if (booleano(snapshot, "sala")) codigos.push("SALA");
  if (booleano(snapshot, "comedor")) codigos.push("COMEDOR");
  if (booleano(snapshot, "cocina")) codigos.push("COCINA");
  if (booleano(snapshot, "estancia")) codigos.push("ESTANCIA");
  if (booleano(snapshot, "areaLavado") || booleano(snapshot, "lavadero")) codigos.push("LAVANDERIA");
  if (booleano(snapshot, "cochera")) codigos.push("COCHERA");
  if (booleano(snapshot, "patio")) codigos.push("PATIO");
  if (booleano(snapshot, "jardin")) codigos.push("JARDIN");
  if (booleano(snapshot, "terraza")) codigos.push("TERRAZA");
  if (booleano(snapshot, "balcon")) codigos.push("BALCON");
  if (booleano(snapshot, "sotano")) codigos.push("SOTANO");
  if (booleano(snapshot, "cuartoServicio")) codigos.push("CUARTO_SERVICIO");
  if (booleano(snapshot, "bodega")) codigos.push("BODEGA");

  const recamaras = Math.max(0, Math.floor(numero(snapshot.recamaras)));
  if (recamaras > 0) {
    codigos.push("RECAMARA_PRINCIPAL");
    for (let i = 1; i < recamaras; i += 1) codigos.push("RECAMARA");
  }

  const banos = Math.max(0, numero(snapshot.banos));
  const completos = Math.max(0, Math.floor(banos));
  const medio = banos - completos >= 0.4;
  for (let i = 0; i < completos; i += 1) codigos.push("BANO_COMPLETO");
  if (medio) codigos.push("MEDIO_BANO");

  const niveles = Math.max(0, Math.floor(numero(snapshot.niveles)));
  if (niveles > 1) codigos.push("ESCALERA");

  const otros = String(snapshot.otrosEspacios ?? "").trim();
  if (otros) {
    const estimados = otros.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
    for (const _ of estimados) codigos.push("OTRA_AREA");
  }

  return codigos;
}

function nombrePartidaInferida(codigo: string, indice: number, codigos: string[]) {
  if (codigo === "FACHADA_PRINCIPAL") return "Fachada frontal";
  if (codigo === "FACHADA_LATERAL") {
    const anteriores = codigos.slice(0, indice + 1).filter((x) => x === "FACHADA_LATERAL").length;
    if (anteriores === 1) return "Fachada posterior";
    if (anteriores === 2) return "Fachada lateral izquierda";
    return "Fachada lateral derecha";
  }
  if (codigo === "RECAMARA_PRINCIPAL") return "Recámara principal";
  if (codigo === "RECAMARA") {
    const anteriores = codigos.slice(0, indice + 1).filter((x) => x === "RECAMARA").length;
    return `Recámara ${anteriores + 1}`;
  }
  if (codigo === "BANO_COMPLETO") {
    const anteriores = codigos.slice(0, indice + 1).filter((x) => x === "BANO_COMPLETO").length;
    return anteriores === 1 ? "Baño principal / completo 1" : `Baño completo ${anteriores}`;
  }
  return codigo.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export default async function PlanInspeccionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ perfil?: string; ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const perfilSolicitado: PerfilInspeccionV1 = query.perfil === "USADA" ? "USADA" : "NUEVA";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true, direccion: true } },
      inspector: { select: { usuarioId: true } },
      cotizacion: {
        select: {
          versiones: { orderBy: { version: "desc" }, take: 1, select: { datos: true } },
        },
      },
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}`);

  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id &&
    inspeccion.inspector?.usuarioId === usuario.id;
  const consulta = ([RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR] as RolUsuario[]).includes(usuario.rol);
  if (!inspectorAsignado && !consulta) redirect("/acceso");

  const [planGuardado] = await prisma.$queryRaw<Array<{
    perfil: string;
    estado: string;
    seleccion: unknown;
    estimadoMinutos: number | null;
    confirmadoEn: Date | null;
  }>>`
    SELECT "perfil","estado","seleccion","estimadoMinutos","confirmadoEn"
    FROM "PlanInspeccionV1"
    WHERE "inspeccionId"=${id}
    LIMIT 1
  `;

  const perfil: PerfilInspeccionV1 = query.perfil
    ? perfilSolicitado
    : planGuardado?.perfil === "USADA"
      ? "USADA"
      : "NUEVA";

  const seleccionGuardada = planGuardado?.seleccion && typeof planGuardado.seleccion === "object" && !Array.isArray(planGuardado.seleccion)
    ? (planGuardado.seleccion as { partidas?: Array<{ clave: string; activa: boolean; puntos: string[] }> })
    : {};
  const guardadoPorClave = new Map((seleccionGuardada.partidas ?? []).map((p) => [p.clave, p]));
  const planConfirmado = planGuardado?.estado === "CONFIRMADO";
  const puedeEditarPlan = inspectorAsignado && inspeccion.estado === EstadoInspeccion.PROGRAMADA && !planConfirmado;

  const [partidasActuales, conceptosActuales, criticosActuales, biblioteca] = await Promise.all([
    prisma.$queryRaw<PartidaPlan[]>`
      SELECT a."id"::text,a."codigo",a."nombre",a."orden",a."origen",
        (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id") AS "conceptos"
      FROM "AreaInspeccion" a
      WHERE a."inspeccionId"=${id} AND a."tipo"<>'PUNTO_CRITICO'
      ORDER BY a."orden",a."nombre"
    `,
    prisma.$queryRaw<ConceptoPlan[]>`
      SELECT g."areaId"::text AS "areaId",COALESCE(p."codigo",g."concepto") AS "codigo",g."concepto",g."especificacion",
             p."grupo",g."herramientaSugerida" AS "herramienta",g."orden"
      FROM "GuiaInspeccionItem" g
      LEFT JOIN "BibliotecaPuntoCerteza" p ON p."id"=g."bibliotecaPuntoId"
      WHERE g."inspeccionId"=${id} AND g."areaId" IS NOT NULL
      ORDER BY g."areaId",g."orden",g."concepto"
    `,
    prisma.$queryRaw<Array<{ area: string; concepto: string; especificacion: string | null; herramienta: string | null; orden: number }>>`
      SELECT g."area",g."concepto",g."especificacion",g."herramientaSugerida" AS "herramienta",g."orden"
      FROM "GuiaInspeccionItem" g
      WHERE g."inspeccionId"=${id} AND g."area" LIKE '__PUNTO_CRITICO__:%'
      ORDER BY g."area",g."orden",g."concepto"
    `,
    prisma.$queryRaw<BibliotecaPartida[]>`
      SELECT b."codigo",b."nombre",COUNT(ap.*)::int AS "puntos"
      FROM "BibliotecaAreaCerteza" b
      LEFT JOIN "BibliotecaAreaPuntoCerteza" ap ON ap."areaBibliotecaId"=b."id"
      WHERE b."activa"=true
      GROUP BY b."id",b."codigo",b."nombre"
    `,
  ]);

  const snapshotRaw = inspeccion.cotizacion?.versiones[0]?.datos;
  const snapshot = snapshotRaw && typeof snapshotRaw === "object" && !Array.isArray(snapshotRaw)
    ? (snapshotRaw as Snapshot)
    : {};

  const bibliotecaPorCodigo = new Map(biblioteca.map((b) => [b.codigo, b]));
  const hayPlanMaterializado = partidasActuales.length > 0 && conceptosActuales.length > 0;

  const partidas = hayPlanMaterializado
    ? partidasActuales.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        conceptos: Number(p.conceptos),
        origen: p.origen,
      }))
    : inferirCodigosPartidas(snapshot).map((codigo, index, codigos) => {
        const plantillaCodigo =
          codigo === "FACHADA_PRINCIPAL" ? "FACHADA_PRINCIPAL" :
          codigo === "FACHADA_LATERAL" ? "FACHADA_LATERAL" :
          codigo;
        const b = bibliotecaPorCodigo.get(plantillaCodigo);
        return {
          id: `preview-${index}`,
          codigo,
          nombre: nombrePartidaInferida(codigo, index, codigos),
          conceptos: Number(b?.puntos ?? 0),
          origen: "PREVISIÓN DESDE COTIZACIÓN",
        };
      });

  const conceptosPorArea = new Map<string, ConceptoPlan[]>();
  for (const concepto of conceptosActuales) {
    conceptosPorArea.set(concepto.areaId, [...(conceptosPorArea.get(concepto.areaId) ?? []), concepto]);
  }

  const plantillasBiblioteca = await prisma.$queryRaw<Array<{
    codigoArea: string;
    codigo: string;
    concepto: string;
    especificacion: string | null;
    grupo: string | null;
    herramienta: string | null;
    orden: number;
  }>>`
    SELECT b."codigo" AS "codigoArea",p."codigo",p."nombre" AS "concepto",p."descripcion" AS "especificacion",
           p."grupo",p."herramientaSugerida" AS "herramienta",ap."orden"
    FROM "BibliotecaAreaCerteza" b
    JOIN "BibliotecaAreaPuntoCerteza" ap ON ap."areaBibliotecaId"=b."id"
    JOIN "BibliotecaPuntoCerteza" p ON p."id"=ap."puntoBibliotecaId"
    WHERE b."activa"=true AND p."activa"=true
    ORDER BY b."codigo",ap."orden",p."nombre"
  `;
  const plantillaPorCodigo = new Map<string, typeof plantillasBiblioteca>();
  for (const item of plantillasBiblioteca) {
    plantillaPorCodigo.set(item.codigoArea, [...(plantillaPorCodigo.get(item.codigoArea) ?? []), item]);
  }

  const totalConceptosAreas = partidas.reduce((s, p) => s + Number(p.conceptos), 0);
  const puntosMaestrosPorPartida = new Map<string, ReturnType<typeof agruparPuntosMaestrosV1>>();
  const clavesPartida = new Map<string, string>();
  let totalPuntosMaestros = 0;
  for (const [partidaIndex, partida] of partidas.entries()) {
    const clavePartida = String(partidaIndex) + ":" + partida.codigo + ":" + partida.nombre;
    clavesPartida.set(partida.id, clavePartida);
    const codigoPlantilla = partida.codigo === "FACHADA_FRONTAL" || partida.codigo === "FACHADA_PRINCIPAL"
      ? "FACHADA_PRINCIPAL"
      : partida.codigo.startsWith("FACHADA_")
        ? "FACHADA_LATERAL"
        : partida.codigo === "RECAMARA_PRINCIPAL"
          ? "RECAMARA_PRINCIPAL"
          : partida.codigo.startsWith("RECAMARA")
            ? "RECAMARA"
            : partida.codigo.startsWith("BANO") && partida.codigo !== "MEDIO_BANO"
              ? "BANO_COMPLETO"
              : partida.codigo;
    const reales = conceptosPorArea.get(partida.id) ?? [];
    const previstos = plantillaPorCodigo.get(codigoPlantilla) ?? [];
    const base = reales.length > 0 ? reales : previstos.map((x) => ({ areaId: partida.id, codigo: x.codigo, concepto: x.concepto, especificacion: x.especificacion, grupo: x.grupo, herramienta: x.herramienta, orden: x.orden }));
    const maestrosBase = agruparPuntosMaestrosV1(base, perfil);
    const guardada = guardadoPorClave.get(clavePartida);
    const maestros = maestrosBase.map((m) => ({
      ...m,
      seleccionado: guardada ? guardada.puntos.includes(m.codigo) : m.seleccionado,
    }));
    puntosMaestrosPorPartida.set(partida.id, maestros);
    if (guardada ? guardada.activa : true) {
      totalPuntosMaestros += maestros.filter((m) => m.seleccionado).length;
    }
  }
  const totalCriticos = criticosActuales.length > 0
    ? criticosActuales.length
    : PUNTOS_CRITICOS_V1.reduce((s, p) => s + p.plantilla.length, 0);
  const totalCriterios = totalConceptosAreas + totalCriticos;
  const tiempoEstimado = estimarMinutosPlanV1(totalPuntosMaestros, totalCriticos);
  const regreso = inspeccion.estado === EstadoInspeccion.PROGRAMADA
    ? `/panel/inspecciones/${id}/revision-inicial`
    : `/panel/inspecciones/${id}/flujo`;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={regreso} className="text-sm font-black text-cyan-300">← Regresar</Link>
          <span className={"rounded-full border px-4 py-2 text-xs font-black " + (planConfirmado ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10 text-slate-300")}>
            {planConfirmado ? "PLAN CONFIRMADO" : "PLANEAR INSPECCIÓN"}
          </span>
        </div>

        {(query.ok || query.error) && (
          <div className={"mt-5 rounded-2xl p-4 text-sm font-bold " + (query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300")}>
            {query.error ?? query.ok}
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-300">Preparación previa del Inspector</p>
          <h1 className="mt-2 text-3xl font-black">Qué voy a inspeccionar antes de llegar al inmueble</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">El sistema depura conceptos repetitivos en puntos maestros y prioriza el alcance según el tipo de servicio. El orden mostrado sigue siendo la ruta recomendada, pero durante la inspección podrás entrar a cualquier partida o concepto en cualquier momento.</p>
          <div className="mt-5 flex flex-wrap gap-2"><Link href={`/panel/inspecciones/${id}/plan-inspeccion?perfil=NUEVA`} className={`rounded-full px-4 py-2 text-xs font-black ${perfil==="NUEVA"?"bg-cyan-300 text-slate-950":"border border-white/10 text-slate-300"}`}>VIVIENDA NUEVA / ENTREGA</Link><Link href={`/panel/inspecciones/${id}/plan-inspeccion?perfil=USADA`} className={`rounded-full px-4 py-2 text-xs font-black ${perfil==="USADA"?"bg-amber-300 text-slate-950":"border border-white/10 text-slate-300"}`}>VIVIENDA USADA / COMPRA</Link></div>
          {!hayPlanMaterializado && (
            <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm font-bold text-amber-200">
              PLAN PRELIMINAR: todavía no existe una guía materializada completa para esta V1. Las partidas y cantidades se estiman con la cotización y la Biblioteca Certeza; pueden ajustarse al confirmar proyecto, áreas y condiciones reales del inmueble.
            </p>
          )}
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-4">
          <Resumen titulo="Partidas / áreas" valor={String(partidas.length)} />
          <Resumen titulo="Conceptos originales" valor={String(totalConceptosAreas)} />
          <Resumen titulo="Conceptos de partidas 2–8" valor={String(totalCriticos)} />
          <Resumen titulo="Puntos maestros propuestos" valor={String(totalPuntosMaestros)} />
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-5"><p className="text-xs font-black uppercase tracking-wider text-emerald-300">Perfil activo</p><p className="mt-2 text-2xl font-black">{perfil === "NUEVA" ? "Vivienda nueva / entrega" : "Vivienda usada / compra"}</p><p className="mt-2 text-sm text-slate-300">El perfil cambia prioridades y selección sugerida sin eliminar los subcriterios técnicos de respaldo.</p></div><div className="rounded-3xl border border-violet-300/20 bg-violet-300/5 p-5"><p className="text-xs font-black uppercase tracking-wider text-violet-300">Tiempo estimado de campo</p><p className="mt-2 text-3xl font-black">{Math.floor(tiempoEstimado/60)} h {tiempoEstimado%60} min</p><p className="mt-2 text-sm text-slate-300">Estimación operativa basada en puntos maestros seleccionados y puntos críticos; el objetivo es mantenerse dentro de 2–3 horas cuando el alcance lo permita.</p></div></section>

        <section className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5">
          <h2 className="text-xl font-black text-amber-200">Regla para evitar duplicidad de evidencias</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Antes de fotografiar, identifica primero la partida y el concepto exacto que estás documentando. Una fotografía puede mostrar varias condiciones físicamente, pero cada hallazgo debe quedar asociado al concepto que realmente describe. Si existen dos hallazgos distintos, confirma primero si son dos conceptos diferentes o una sola condición vista desde más de un ángulo.
          </p>
        </section>

        <section className="mt-7">
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Puntos técnicos previos</p>
          <h2 className="mt-2 text-2xl font-black">Puntos 1–8 del recorrido</h2>
          <div className="mt-4 space-y-3">
            <details className="rounded-2xl border border-white/10 bg-slate-900 p-4">
              <summary className="cursor-pointer font-black">1 · Pruebas de hermeticidad</summary>
              <p className="mt-3 text-sm leading-6 text-slate-400">Pruebas hidráulica y de gas con lectura inicial y final cuando correspondan. Revisa antes de la visita qué equipo y tiempos requiere cada prueba para que puedan permanecer abiertas mientras continúa el recorrido.</p>
            </details>
            {PUNTOS_CRITICOS_V1.map((punto, index) => {
              const claveArea = `__PUNTO_CRITICO__:${punto.codigo}`;
              const actuales = criticosActuales.filter((c) => c.area === claveArea);
              const conceptos = actuales.length > 0
                ? actuales
                : punto.plantilla.map((x, orden) => ({
                    area: claveArea,
                    concepto: x.nombre,
                    especificacion: x.descripcion,
                    herramienta: x.herramientaSugerida,
                    orden,
                  }));
              return (
                <details key={punto.codigo} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <summary className="cursor-pointer font-black">
                    Partida {index + 2} · {punto.etiqueta} <span className="ml-2 text-xs text-cyan-300">{conceptos.length} conceptos</span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-400">{punto.descripcion}</p>
                  <div className="mt-4 space-y-2">
                    {conceptos.map((c, i) => (
                      <div key={`${punto.codigo}-${i}-${c.concepto}`} className="rounded-xl bg-slate-950 p-3">
                        <p className="text-sm font-black">{i + 1}. {c.concepto}</p>
                        {c.especificacion && <p className="mt-1 text-xs leading-5 text-slate-400">{c.especificacion}</p>}
                        {c.herramienta && <p className="mt-1 text-[11px] font-bold text-amber-300">Herramienta sugerida: {c.herramienta}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <form action={guardarPlanInspeccionV1} className="mt-8">
          <input type="hidden" name="inspeccionId" value={id} />
          <input type="hidden" name="perfil" value={perfil} />
          <input type="hidden" name="estimadoMinutos" value={tiempoEstimado} />
          <input type="hidden" name="partidasMeta" value={JSON.stringify(partidas.map((partida, index) => ({
            clave: String(index) + ":" + partida.codigo + ":" + partida.nombre,
            codigo: partida.codigo,
            nombre: partida.nombre,
          })))} />

          <section>
          <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Partidas del inmueble</p>
          <h2 className="mt-2 text-2xl font-black">Relación completa de partidas y conceptos</h2>
          <p className="mt-2 text-sm text-slate-400">Abre cada partida para estudiar sus conceptos antes de la visita.</p>

          <div className="mt-4 space-y-3">
            {partidas.map((partida, index) => {
              const codigoPlantilla =
                partida.codigo === "FACHADA_FRONTAL" || partida.codigo === "FACHADA_PRINCIPAL"
                  ? "FACHADA_PRINCIPAL"
                  : partida.codigo.startsWith("FACHADA_")
                    ? "FACHADA_LATERAL"
                    : partida.codigo === "RECAMARA_PRINCIPAL"
                      ? "RECAMARA_PRINCIPAL"
                      : partida.codigo.startsWith("RECAMARA")
                        ? "RECAMARA"
                        : partida.codigo.startsWith("BANO") && partida.codigo !== "MEDIO_BANO"
                          ? "BANO_COMPLETO"
                          : partida.codigo;
              const reales = conceptosPorArea.get(partida.id) ?? [];
              const previstos = plantillaPorCodigo.get(codigoPlantilla) ?? [];
              const conceptos = reales.length > 0 ? reales : previstos.map((x) => ({
                areaId: partida.id,
                codigo: x.codigo,
                concepto: x.concepto,
                especificacion: x.especificacion,
                grupo: x.grupo,
                herramienta: x.herramienta,
                orden: x.orden,
              }));
              const maestros = puntosMaestrosPorPartida.get(partida.id) ?? [];
              const clavePartida = clavesPartida.get(partida.id) ?? String(index) + ":" + partida.codigo + ":" + partida.nombre;
              const guardada = guardadoPorClave.get(clavePartida);
              const partidaActiva = guardada ? guardada.activa : true;

              return (
                <details key={partida.id} className={"rounded-2xl border p-4 " + (partidaActiva ? "border-white/10 bg-slate-900" : "border-slate-800 bg-slate-950/60")}>
                  <summary className="cursor-pointer">
                    <span className="font-black">Partida {index + 9} · {partida.nombre}</span>
                    <span className="ml-2 text-xs font-black text-emerald-300">{conceptos.length} conceptos originales</span>
                  </summary>
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-slate-950 p-3">
                    <label className="flex items-center gap-2 text-sm font-black">
                      <input
                        type="checkbox"
                        name={"partida::" + clavePartida}
                        defaultChecked={partidaActiva}
                        disabled={!puedeEditarPlan}
                        className="h-4 w-4"
                      />
                      INCLUIR PARTIDA EN LA INSPECCIÓN
                    </label>
                    {!puedeEditarPlan && partidaActiva && <input type="hidden" name={"partida::" + clavePartida} value="1" />}
                  </div>
                  <div className="mt-4 grid gap-2">
                    {maestros.map((maestro, i) => (
                      <article key={`${partida.id}-${maestro.codigo}`} className={`rounded-xl border p-3 ${maestro.seleccionado ? "border-emerald-300/20 bg-emerald-300/5" : "border-white/10 bg-slate-950"}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <label className="flex items-start gap-2 text-sm font-black">
                            <input
                              type="checkbox"
                              name={"punto::" + clavePartida + "::" + maestro.codigo}
                              defaultChecked={maestro.seleccionado || maestro.prioridad === "OBLIGATORIO"}
                              disabled={!puedeEditarPlan || maestro.prioridad === "OBLIGATORIO"}
                              className="mt-0.5 h-4 w-4"
                            />
                            <span>{i + 1}. {maestro.nombre}</span>
                          </label>
                          {maestro.prioridad === "OBLIGATORIO" && <input type="hidden" name={"punto::" + clavePartida + "::" + maestro.codigo} value="1" />}
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${maestro.prioridad==="OBLIGATORIO"?"bg-rose-300/15 text-rose-200":maestro.prioridad==="RECOMENDADO"?"bg-cyan-300/15 text-cyan-200":"bg-white/5 text-slate-400"}`}>{maestro.prioridad}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{maestro.descripcion}</p>
                        <p className="mt-2 text-[11px] font-bold text-amber-300">{maestro.seleccionado ? "INCLUIDO EN PROPUESTA" : "CONDICIONAL / NO PRESELECCIONADO"} · {maestro.subcriterios.length} subcriterio(s)</p>
                        <details className="mt-2"><summary className="cursor-pointer text-[11px] font-black text-slate-300">Ver subcriterios técnicos</summary><div className="mt-2 space-y-1">{maestro.subcriterios.map((sub)=><p key={sub.codigo} className="text-[11px] text-slate-500">• {sub.concepto}</p>)}</div></details>
                      </article>
                    ))}
                    {conceptos.length === 0 && <p className="text-sm text-slate-500">La Biblioteca Certeza todavía no tiene conceptos precargados para esta partida.</p>}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

          <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-5">
            <h2 className="text-xl font-black">Confirmación del alcance</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              El plan confirmado define las partidas y puntos maestros que integrarán el alcance oficial de esta inspección. Los subcriterios permanecen como respaldo técnico y se despliegan cuando exista una condición que requiera profundización.
            </p>
            {puedeEditarPlan ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <button name="intencion" value="GUARDAR" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-black">
                  GUARDAR BORRADOR
                </button>
                <button name="intencion" value="CONFIRMAR" className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950">
                  CONFIRMAR PLAN DE INSPECCIÓN
                </button>
              </div>
            ) : planConfirmado ? (
              <p className="mt-4 text-sm font-black text-emerald-300">Plan confirmado · {planGuardado?.confirmadoEn ? planGuardado.confirmadoEn.toLocaleString("es-MX") : "listo para iniciar"}</p>
            ) : (
              <p className="mt-4 text-sm font-black text-slate-400">Vista de consulta.</p>
            )}
          </section>
        </form>

        {planConfirmado && inspectorAsignado && inspeccion.estado === EstadoInspeccion.PROGRAMADA && (
          <form action={reabrirPlanInspeccionV1} className="mt-4">
            <input type="hidden" name="inspeccionId" value={id} />
            <input type="hidden" name="perfil" value={perfil} />
            <button className="rounded-xl border border-amber-300/30 px-5 py-3 text-sm font-black text-amber-200">
              REABRIR PLAN PARA AJUSTAR
            </button>
          </form>
        )}

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-5">
          <h2 className="text-xl font-black">Datos de referencia</h2>
          <p className="mt-2 text-sm text-slate-400">
            {inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? inspeccion.inmueble?.direccion ?? inspeccion.direccion}
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Esta versión ya muestra la depuración propuesta por perfil. El siguiente paso del flujo será confirmar qué puntos maestros quedan incluidos para que ese alcance se convierta en el total oficial de la inspección.
          </p>
        </section>
      </div>
    </main>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="mt-2 text-3xl font-black text-cyan-300">{valor}</p>
    </div>
  );
}
