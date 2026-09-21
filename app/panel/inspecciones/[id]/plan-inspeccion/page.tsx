import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PUNTOS_CRITICOS_V1 } from "@/lib/puntos-criticos-v1";
import { prisma } from "@/lib/prisma";

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
  if (booleano(snapshot, "areaLavado") || booleano(snapshot, "lavadero")) codigos.push("LAVANDERIA");

  const niveles = Math.max(0, Math.floor(numero(snapshot.niveles)));
  if (niveles > 1 || booleano(snapshot, "escalera")) codigos.push("ESCALERA");

  if (booleano(snapshot, "estancia")) codigos.push("ESTANCIA");
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [partidasActuales, conceptosActuales, criticosActuales, biblioteca] = await Promise.all([
    prisma.$queryRaw<PartidaPlan[]>`
      SELECT a."id"::text,a."codigo",a."nombre",a."orden",a."origen",
        (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id") AS "conceptos"
      FROM "AreaInspeccion" a
      WHERE a."inspeccionId"=${id} AND a."tipo"<>'PUNTO_CRITICO'
      ORDER BY a."orden",a."nombre"
    `,
    prisma.$queryRaw<ConceptoPlan[]>`
      SELECT g."areaId"::text AS "areaId",g."concepto",g."especificacion",
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
    concepto: string;
    especificacion: string | null;
    grupo: string | null;
    herramienta: string | null;
    orden: number;
  }>>`
    SELECT b."codigo" AS "codigoArea",p."nombre" AS "concepto",p."descripcion" AS "especificacion",
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
  const totalCriticos = criticosActuales.length > 0
    ? criticosActuales.length
    : PUNTOS_CRITICOS_V1.reduce((s, p) => s + p.plantilla.length, 0);
  const totalCriterios = totalConceptosAreas + totalCriticos;
  const regreso = inspeccion.estado === EstadoInspeccion.PROGRAMADA
    ? `/panel/inspecciones/${id}/revision-inicial`
    : `/panel/inspecciones/${id}/flujo`;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={regreso} className="text-sm font-black text-cyan-300">← Regresar</Link>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300">
            PLAN DE INSPECCIÓN · SOLO CONSULTA
          </span>
        </div>

        <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-300">Preparación previa del Inspector</p>
          <h1 className="mt-2 text-3xl font-black">Qué voy a inspeccionar antes de llegar al inmueble</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            Esta vista existe para que estudies el alcance antes de iniciar físicamente la visita: lee cada partida, entiende cada concepto y planea la evidencia que necesitarás. La intención es reducir omisiones y evitar usar la misma evidencia para dos hallazgos distintos por una interpretación incorrecta.
          </p>
          {!hayPlanMaterializado && (
            <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm font-bold text-amber-200">
              PLAN PRELIMINAR: todavía no existe una guía materializada completa para esta V1. Las partidas y cantidades se estiman con la cotización y la Biblioteca Certeza; pueden ajustarse al confirmar proyecto, áreas y condiciones reales del inmueble.
            </p>
          )}
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-4">
          <Resumen titulo="Partidas / áreas" valor={String(partidas.length)} />
          <Resumen titulo="Conceptos de áreas" valor={String(totalConceptosAreas)} />
          <Resumen titulo="Conceptos de partidas 2–8" valor={String(totalCriticos)} />
          <Resumen titulo="Total de criterios previstos" valor={String(totalCriterios)} />
        </section>

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

        <section className="mt-8">
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
                concepto: x.concepto,
                especificacion: x.especificacion,
                grupo: x.grupo,
                herramienta: x.herramienta,
                orden: x.orden,
              }));

              return (
                <details key={partida.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <summary className="cursor-pointer">
                    <span className="font-black">Partida {index + 9} · {partida.nombre}</span>
                    <span className="ml-2 text-xs font-black text-emerald-300">{conceptos.length} conceptos</span>
                  </summary>
                  <div className="mt-4 grid gap-2">
                    {conceptos.map((concepto, i) => (
                      <article key={`${partida.id}-${i}-${concepto.concepto}`} className="rounded-xl bg-slate-950 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-black">{i + 1}. {concepto.concepto}</p>
                          {concepto.grupo && <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black text-slate-400">{concepto.grupo}</span>}
                        </div>
                        {concepto.especificacion && <p className="mt-1 text-xs leading-5 text-slate-400">{concepto.especificacion}</p>}
                        {concepto.herramienta && <p className="mt-1 text-[11px] font-bold text-amber-300">Herramienta sugerida: {concepto.herramienta}</p>}
                      </article>
                    ))}
                    {conceptos.length === 0 && <p className="text-sm text-slate-500">La Biblioteca Certeza todavía no tiene conceptos precargados para esta partida.</p>}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-5">
          <h2 className="text-xl font-black">Datos de referencia</h2>
          <p className="mt-2 text-sm text-slate-400">
            {inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? inspeccion.inmueble?.direccion ?? inspeccion.direccion}
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Esta pantalla es de consulta y preparación. No permite cerrar conceptos, registrar hallazgos ni modificar la inspección.
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
