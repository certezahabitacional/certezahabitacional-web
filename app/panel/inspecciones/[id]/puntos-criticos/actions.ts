"use server";

import { randomUUID } from "node:crypto";
import {
  ClasificacionHallazgo,
  EstadoInspeccion,
  PrioridadHallazgo,
  RolUsuario,
  TipoEvento,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  HERRAMIENTAS_INSPECCION,
  obtenerHerramientasCotizadasDesdeCotizacion,
  type CodigoHerramienta,
} from "@/lib/herramientas-inspeccion";
import {
  PUNTOS_CRITICOS_V1,
  plantillaAplicablePuntoCritico,
  proyectoDisponibleParaPuntoCritico,
  tienePruebaProlongadaCotizada,
  type CodigoPuntoCriticoV1,
} from "@/lib/puntos-criticos-v1";
import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
const CODIGOS = new Set(PUNTOS_CRITICOS_V1.map((p) => p.codigo));

type DatosPasoCritico = {
  configurado?: boolean;
  aplica?: boolean | null;
  fuente?: "PROYECTO" | "PLANTILLA" | null;
  proyectoDisponible?: boolean;
  pruebaProlongada?: boolean;
  herramientas?: CodigoHerramienta[];
};

type ObservacionItemCritico = {
  descripcionIa?: string;
  clasificacionSugerida?: string;
  justificacionIa?: string;
  descripcionFinal?: string;
  clasificacionFinal?: string;
  prioridadFinal?: string;
  lecturaFinalPropuesta?: string;
  unidadFinalPropuesta?: string;
  variacionPresion?: string;
  actualizadoEn?: string;
};

function esCodigo(valor: string): valor is CodigoPuntoCriticoV1 {
  return CODIGOS.has(valor as CodigoPuntoCriticoV1);
}

function datosObjeto(valor: unknown): DatosPasoCritico {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as DatosPasoCritico)
    : {};
}

function observacionObjeto(valor: string | null): ObservacionItemCritico {
  if (!valor) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ObservacionItemCritico)
      : {};
  } catch {
    return { descripcionFinal: valor };
  }
}

function numeroLectura(valor: string | null | undefined) {
  if (!valor) return null;
  const coincidencia = valor.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!coincidencia) return null;
  const numero = Number(coincidencia[0]);
  return Number.isFinite(numero) ? numero : null;
}

function calcularVariacionPresion(
  lecturaInicial: string | null | undefined,
  lecturaFinal: string | null | undefined,
  unidadInicial: string | null | undefined,
  unidadFinal: string | null | undefined,
) {
  const inicial = numeroLectura(lecturaInicial);
  const final = numeroLectura(lecturaFinal);
  const unidadA = (unidadInicial ?? unidadFinal ?? "").trim();
  const unidadB = (unidadFinal ?? unidadInicial ?? "").trim();
  if (inicial === null || final === null) return null;
  if (unidadA && unidadB && unidadA.toLowerCase() !== unidadB.toLowerCase()) return null;
  const diferencia = final - inicial;
  const redondeada = Math.round(diferencia * 100) / 100;
  const signo = redondeada > 0 ? "+" : "";
  return `${signo}${redondeada} ${unidadB || unidadA}`.trim();
}

type OrigenEvidencia = "CAMARA" | "GALERIA";

function origenEvidenciaDescripcion(valor: string | null | undefined): OrigenEvidencia | null {
  if (valor?.includes("[ORIGEN:GALERIA]")) return "GALERIA";
  if (valor?.includes("[ORIGEN:CAMARA]")) return "CAMARA";
  return null;
}

function esItemPruebaProlongada(concepto: string) {
  return /manómetro/i.test(concepto) || /lectura final/i.test(concepto);
}

function fotosRequeridas(origen: OrigenEvidencia | null, concepto: string) {
  if (esItemPruebaProlongada(concepto)) return 1;
  return origen === "GALERIA" ? 1 : 4;
}

function ruta(
  id: string,
  punto?: string,
  tipo?: "ok" | "error",
  mensaje?: string,
  foco?: string,
) {
  const params = new URLSearchParams();
  if (punto) params.set("punto", punto);
  if (tipo && mensaje) params.set(tipo, mensaje);
  if (foco) params.set("foco", foco);
  const query = params.toString();
  return `/panel/inspecciones/${id}/puntos-criticos${query ? `?${query}` : ""}`;
}

function volver(
  id: string,
  punto: string | undefined,
  tipo: "ok" | "error",
  mensaje: string,
  foco?: string,
): never {
  redirect(ruta(id, punto, tipo, mensaje, foco));
}

function puntoPorCodigo(codigo: CodigoPuntoCriticoV1) {
  const punto = PUNTOS_CRITICOS_V1.find((item) => item.codigo === codigo);
  if (!punto) throw new Error("Punto crítico no reconocido.");
  return punto;
}

function siguienteCodigo(codigo: CodigoPuntoCriticoV1) {
  const indice = PUNTOS_CRITICOS_V1.findIndex((item) => item.codigo === codigo);
  return PUNTOS_CRITICOS_V1[indice + 1]?.codigo ?? null;
}

async function exigirResponsable(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
    }),
    prisma.inspeccion.findUnique({
      where: { id: inspeccionId },
      select: {
        id: true,
        folio: true,
        estado: true,
        numeroInspeccion: true,
        inspectorId: true,
        cotizacionId: true,
        cotizacion: { select: { observacionesInternas: true } },
      },
    }),
  ]);

  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id;
  const director = usuario.rol === RolUsuario.DIRECTOR;
  if (!inspectorAsignado && !director) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) volver(inspeccionId, undefined, "error", "Los puntos críticos corresponden a la inspección V1.");
  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) volver(inspeccionId, undefined, "error", "Los puntos críticos sólo pueden capturarse mientras la inspección está EN PROCESO.");

  return {
    session,
    usuario,
    inspeccion,
    responsable: director ? "Dirección" : "Inspector",
  };
}

async function herramientasDeCotizacion(inspeccionId: string) {
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { cotizacion: { select: { observacionesInternas: true } } },
  });
  return obtenerHerramientasCotizadasDesdeCotizacion(inspeccion?.cotizacion?.observacionesInternas);
}

async function verificarSecuencia(inspeccionId: string, codigo: CodigoPuntoCriticoV1) {
  const indice = PUNTOS_CRITICOS_V1.findIndex((item) => item.codigo === codigo);
  const anteriores = PUNTOS_CRITICOS_V1.slice(0, indice).map((item) => `PC_${item.codigo}`);
  if (!anteriores.length) return;

  const pasos = await prisma.$queryRaw<Array<{ clave: string; estado: string; datos: unknown; lecturaInicial: string | null }>>`
    SELECT "clave","estado","datos","lecturaInicial" FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId} AND "clave"=ANY(${anteriores}::text[])
    ORDER BY "orden"
  `;

  for (const paso of pasos) {
    if (paso.estado === "COMPLETADO" || paso.estado === "NO_APLICA") continue;
    const datos = datosObjeto(paso.datos);
    if (paso.estado === "EN_PROCESO" && datos.pruebaProlongada && paso.lecturaInicial) {
      const [control] = await prisma.$queryRaw<Array<{ fotoInicial: number; pendientesOtros: number }>>`
        SELECT
          COUNT(*) FILTER (
            WHERE g."concepto" ILIKE '%manómetro%' AND fa."fotografiaId" IS NOT NULL
          )::int AS "fotoInicial",
          COUNT(DISTINCT g."id") FILTER (
            WHERE g."estadoV3"='PENDIENTE'
              AND g."concepto" NOT ILIKE '%manómetro%'
              AND g."concepto" NOT ILIKE '%lectura final%'
          )::int AS "pendientesOtros"
        FROM "GuiaInspeccionItem" g
        LEFT JOIN "FotografiaArea" fa ON fa."guiaItemId"=g."id"
        WHERE g."inspeccionId"=${inspeccionId}
          AND g."area"=concat('__PUNTO_CRITICO__:',replace(${paso.clave},'PC_',''))
      `;
      if (Number(control?.fotoInicial ?? 0) > 0 && Number(control?.pendientesOtros ?? 0) === 0) continue;
    }
    throw new Error("Debes cerrar al 100% el punto crítico anterior antes de continuar.");
  }
}

async function asegurarPasos(inspeccionId: string, usuarioId: string) {
  const herramientas = await herramientasDeCotizacion(inspeccionId);
  const documentos = await prisma.$queryRaw<Array<{ tipo: string; datosExtraidos: unknown }>>`
    SELECT "tipo","datosExtraidos" FROM "DocumentoProyectoInspeccion"
    WHERE "inspeccionId"=${inspeccionId} AND "estadoAnalisis"='COMPLETADO'
  `;

  let orden = 100;
  for (const punto of PUNTOS_CRITICOS_V1) {
    const proyectoDisponible = proyectoDisponibleParaPuntoCritico(punto, documentos);
    const pruebaProlongada = tienePruebaProlongadaCotizada(punto, herramientas);
    const datos: DatosPasoCritico = {
      configurado: false,
      aplica: null,
      fuente: proyectoDisponible ? "PROYECTO" : "PLANTILLA",
      proyectoDisponible,
      pruebaProlongada,
      herramientas,
    };
    await prisma.$executeRaw`
      INSERT INTO "ProtocoloInspeccionPaso"
        ("inspeccionId","clave","nombre","tipo","orden","obligatorio","estado","datos","actualizadoEn")
      VALUES
        (${inspeccionId},${`PC_${punto.codigo}`},${punto.etiqueta},'PUNTO_CRITICO',${orden},true,'PENDIENTE',${JSON.stringify(datos)}::jsonb,NOW())
      ON CONFLICT ("inspeccionId","clave") DO NOTHING
    `;
    orden += 10;
  }

  await registrarAuditoria({
    tipo: TipoEvento.CREAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId,
    descripcion: "Se inicializó la secuencia de 7 puntos críticos V1 desde Proyecto/Plantilla y el punto 4 de la cotización.",
  });
}


async function prepararPruebasHermeticidadIniciales(inspeccionId: string, usuarioId: string) {
  const herramientas = await herramientasDeCotizacion(inspeccionId);

  for (const codigo of ["HIDRAULICA", "GAS"] as CodigoPuntoCriticoV1[]) {
    const punto = puntoPorCodigo(codigo);
    if (!tienePruebaProlongadaCotizada(punto, herramientas)) continue;

    const plantilla = plantillaAplicablePuntoCritico(punto, herramientas)
      .filter((item) => /manómetro/i.test(item.nombre) || /lectura final/i.test(item.nombre));

    if (plantilla.length < 2) continue;

    const areaCodigo = `PC_${codigo}`;
    const areaMarcador = `__PUNTO_CRITICO__:${codigo}`;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "AreaInspeccion"
          ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria","estado")
        VALUES
          (${inspeccionId},${areaCodigo},${punto.etiqueta},'PUNTO_CRITICO',
           ${900 + PUNTOS_CRITICOS_V1.findIndex((item) => item.codigo === codigo) * 10},
           'PLANTILLA',false,'PENDIENTE')
        ON CONFLICT ("inspeccionId","codigo") DO NOTHING
      `;

      const [area] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"::text
        FROM "AreaInspeccion"
        WHERE "inspeccionId"=${inspeccionId} AND "codigo"=${areaCodigo}
        LIMIT 1
      `;
      if (!area) throw new Error("No fue posible preparar la prueba de hermeticidad.");

      let orden = 1;
      for (const item of plantilla) {
        await tx.$executeRaw`
          INSERT INTO "GuiaInspeccionItem"
            ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion",
             "orden","obligatorio","completado","creadoPorId","areaId","estadoV3","origenV3",
             "requiereMedicion","requiereComparacionProyecto","herramientaSugerida","creadoEn","actualizadoEn")
          SELECT
            ${randomUUID()},${inspeccionId},'PUNTO_CRITICO',${codigo},${areaMarcador},
            ${item.nombre},${item.descripcion},${orden},true,false,${usuarioId},
            ${area.id}::uuid,'PENDIENTE','PLANTILLA',${item.requiereMedicion},
            ${item.requiereComparacionProyecto},${item.herramientaSugerida},NOW(),NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM "GuiaInspeccionItem"
            WHERE "inspeccionId"=${inspeccionId}
              AND "area"=${areaMarcador}
              AND "concepto"=${item.nombre}
          )
        `;
        orden += 1;
      }
    });
  }
}

export async function iniciarPuntosCriticosV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario } = await exigirResponsable(inspeccionId);

  const [control] = await prisma.$queryRaw<Array<{ proyectoConfirmado: boolean }>>`
    SELECT "proyectoConfirmado" FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspeccionId} LIMIT 1
  `;
  if (!control?.proyectoConfirmado) volver(inspeccionId, undefined, "error", "Primero confirma Proyecto/Plantilla.");

  await asegurarPasos(inspeccionId, usuario.id);
  await prepararPruebasHermeticidadIniciales(inspeccionId, usuario.id);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  redirect(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad?fase=inicio`);
}

export async function reactivarPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  if (!inspeccionId || !esCodigo(codigoTexto)) redirect("/panel/inspecciones");

  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  const [paso] = await prisma.$queryRaw<Array<{ estado: string; datos: unknown }>>`
    SELECT "estado","datos"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId}
      AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;
  if (!paso) volver(inspeccionId, codigo, "error", "Punto crítico no encontrado.");
  if (paso.estado !== "NO_APLICA") {
    volver(inspeccionId, codigo, "error", "Sólo un punto completo marcado NO APLICA puede reactivarse.");
  }

  const datos = datosObjeto(paso.datos);
  const actualizados: DatosPasoCritico = {
    ...datos,
    configurado: false,
    aplica: null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='PENDIENTE',
          "datos"=${JSON.stringify(actualizados)}::jsonb,
          "comentario"=NULL,
          "completadoEn"=NULL,
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
        AND "clave"=${`PC_${codigo}`}
    `;

    await tx.$executeRaw`
      UPDATE "InspeccionControlV2"
      SET "preReporteGeneradoEn"=NULL,
          "revisionInspectorFinalEn"=NULL,
          "revisionInspectorFinalPorId"=NULL,
          "actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} reactivó el punto crítico completo “${puntoPorCodigo(codigo).etiqueta}” durante la revisión del expediente.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/reporte-v1`);
  volver(inspeccionId, codigo, "ok", "Punto crítico reactivado. Configúralo nuevamente y completa su revisión.");
}

export async function configurarPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const aplicaTexto = texto(formData, "aplica");
  const fuenteTexto = texto(formData, "fuente");
  if (!inspeccionId || !esCodigo(codigoTexto)) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  try {
    await verificarSecuencia(inspeccionId, codigo);
  } catch (error) {
    volver(inspeccionId, codigo, "error", error instanceof Error ? error.message : "No puedes continuar todavía.");
  }

  if (!["SI", "NO"].includes(aplicaTexto)) volver(inspeccionId, codigo, "error", "Selecciona SI APLICA o NO APLICA.");
  if (!["PROYECTO", "PLANTILLA"].includes(fuenteTexto)) volver(inspeccionId, codigo, "error", "Selecciona PROYECTO o PLANTILLA PRECARGADA.");

  const punto = puntoPorCodigo(codigo);
  const herramientas = await herramientasDeCotizacion(inspeccionId);
  const documentos = await prisma.$queryRaw<Array<{ tipo: string; datosExtraidos: unknown }>>`
    SELECT "tipo","datosExtraidos" FROM "DocumentoProyectoInspeccion"
    WHERE "inspeccionId"=${inspeccionId} AND "estadoAnalisis"='COMPLETADO'
  `;
  const proyectoDisponible = proyectoDisponibleParaPuntoCritico(punto, documentos);
  if (fuenteTexto === "PROYECTO" && !proyectoDisponible) {
    volver(inspeccionId, codigo, "error", "No se detectó información de proyecto para este punto crítico. Usa la plantilla precargada.");
  }

  const [pasoExistente] = await prisma.$queryRaw<Array<{ datos: unknown }>>`
    SELECT "datos" FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;
  const datosExistentes = datosObjeto(pasoExistente?.datos);
  const pruebaProlongada =
    Boolean(datosExistentes.pruebaProlongada) ||
    tienePruebaProlongadaCotizada(punto, herramientas);
  const herramientasEfectivas = [...herramientas];
  if (pruebaProlongada && codigo === "HIDRAULICA") {
    if (!herramientasEfectivas.includes("HERMETICIDAD_HIDRAULICA")) herramientasEfectivas.push("HERMETICIDAD_HIDRAULICA");
    if (!herramientasEfectivas.includes("MANOMETRO_AGUA")) herramientasEfectivas.push("MANOMETRO_AGUA");
  }
  if (pruebaProlongada && codigo === "GAS") {
    if (!herramientasEfectivas.includes("HERMETICIDAD_GAS")) herramientasEfectivas.push("HERMETICIDAD_GAS");
  }
  const datos: DatosPasoCritico = {
    configurado: true,
    aplica: aplicaTexto === "SI",
    fuente: fuenteTexto as "PROYECTO" | "PLANTILLA",
    proyectoDisponible,
    pruebaProlongada,
    herramientas: herramientasEfectivas,
  };

  if (aplicaTexto === "NO") {
    await prisma.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='NO_APLICA',"datos"=${JSON.stringify(datos)}::jsonb,
          "comentario"='Declarado NO APLICA',"completadoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    `;
    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "ProtocoloInspeccionPaso",
      inspeccionId,
      usuarioId: usuario.id,
      descripcion: `${responsable} declaró ${punto.etiqueta} como NO APLICA.`,
    });
    const siguiente = siguienteCodigo(codigo);
    revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
    revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
    if (siguiente) redirect(ruta(inspeccionId, siguiente, "ok", `${punto.etiqueta} quedó NO APLICA.`));
    redirect(
      `/panel/inspecciones/${inspeccionId}/areas?ok=${encodeURIComponent("Puntos críticos completos. Continúa con las áreas de la vivienda.")}`,
    );
  }

  const plantilla = plantillaAplicablePuntoCritico(punto, herramientasEfectivas);
  const areaCodigo = `PC_${codigo}`;
  const areaMarcador = `__PUNTO_CRITICO__:${codigo}`;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "AreaInspeccion"
        ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria","estado")
      VALUES
        (${inspeccionId},${areaCodigo},${punto.etiqueta},'PUNTO_CRITICO',
         ${900 + PUNTOS_CRITICOS_V1.findIndex((item) => item.codigo === codigo) * 10},
         ${fuenteTexto},false,'PENDIENTE')
      ON CONFLICT ("inspeccionId","codigo") DO UPDATE
      SET "origen"=EXCLUDED."origen","actualizadoEn"=NOW()
    `;
    const [area] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"::text FROM "AreaInspeccion"
      WHERE "inspeccionId"=${inspeccionId} AND "codigo"=${areaCodigo}
      LIMIT 1
    `;
    if (!area) throw new Error("No fue posible preparar el punto crítico.");

    let orden = 10;
    for (const item of plantilla) {
      await tx.$executeRaw`
        INSERT INTO "GuiaInspeccionItem"
          ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion",
           "orden","obligatorio","completado","creadoPorId","areaId","estadoV3","origenV3",
           "requiereMedicion","requiereComparacionProyecto","herramientaSugerida","creadoEn","actualizadoEn")
        SELECT
          ${randomUUID()},${inspeccionId},'PUNTO_CRITICO',${codigo},${areaMarcador},
          ${item.nombre},${item.descripcion},${orden},true,false,${usuario.id},
          ${area.id}::uuid,'PENDIENTE',${fuenteTexto},${item.requiereMedicion},
          ${item.requiereComparacionProyecto},${item.herramientaSugerida},NOW(),NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM "GuiaInspeccionItem"
          WHERE "inspeccionId"=${inspeccionId} AND "area"=${areaMarcador} AND "concepto"=${item.nombre}
        )
      `;
      orden += 10;
    }

    await tx.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='EN_PROCESO',"datos"=${JSON.stringify(datos)}::jsonb,
          "iniciadoEn"=COALESCE("iniciadoEn",NOW()),"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} inició ${punto.etiqueta} con fuente ${fuenteTexto} y ${plantilla.length} concepto(s) aplicables al equipo cotizado.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", `${punto.etiqueta} lista para inspección.`);
}

export async function subirFotoPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const itemId = texto(formData, "itemId");
  const archivo = formData.get("archivo");
  const origenTexto = texto(formData, "origenEvidencia").toUpperCase();
  const retorno = texto(formData, "retorno");
  const origenEvidencia: OrigenEvidencia = origenTexto === "GALERIA" ? "GALERIA" : "CAMARA";
  if (!inspeccionId || !esCodigo(codigoTexto) || !itemId) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { session, usuario, responsable } = await exigirResponsable(inspeccionId);

  const [item] = await prisma.$queryRaw<Array<{
    id: string;
    areaId: string;
    concepto: string;
    estadoV3: string;
    fotos: number;
    ordenes: number[];
    descripcionPrimera: string | null;
  }>>`
    SELECT g."id",g."areaId"::text,g."concepto",g."estadoV3",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos",
      ARRAY(
        SELECT fa."orden" FROM "FotografiaArea" fa
        WHERE fa."guiaItemId"=g."id"
        ORDER BY fa."orden"
      )::int[] AS "ordenes",
      (
        SELECT f."descripcion"
        FROM "FotografiaArea" fa
        JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
        WHERE fa."guiaItemId"=g."id"
        ORDER BY fa."orden"
        LIMIT 1
      ) AS "descripcionPrimera"
    FROM "GuiaInspeccionItem" g
    WHERE g."id"=${itemId} AND g."inspeccionId"=${inspeccionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;
  if (!item?.areaId) volver(inspeccionId, codigo, "error", "El concepto no pertenece a este punto crítico.");
  if (item.estadoV3 !== "PENDIENTE") volver(inspeccionId, codigo, "error", "Este concepto ya está cerrado y su evidencia no puede modificarse.");
  const origenActual = origenEvidenciaDescripcion(item.descripcionPrimera) ?? (Number(item.fotos) > 0 ? "CAMARA" : null);
  if (!esItemPruebaProlongada(item.concepto) && origenActual && origenActual !== origenEvidencia) {
    volver(inspeccionId, codigo, "error", "No combines cámara y galería dentro del mismo concepto. Quita la evidencia actual para cambiar de modalidad.");
  }
  const origenRegla = esItemPruebaProlongada(item.concepto) ? origenEvidencia : (origenActual ?? origenEvidencia);
  const limiteFotos = fotosRequeridas(origenRegla, item.concepto);
  if (Number(item.fotos) >= limiteFotos) {
    volver(inspeccionId, codigo, "error", limiteFotos === 1
      ? "Este concepto ya tiene la evidencia requerida."
      : "Este concepto ya tiene sus 4 fotografías tomadas desde la aplicación.");
  }
  const ordenFoto = Array.from({ length: limiteFotos }, (_, index) => index + 1)
    .find((orden) => !item.ordenes.includes(orden));
  if (!ordenFoto) volver(inspeccionId, codigo, "error", "No hay un espacio disponible para otra fotografía.");
  if (!(archivo instanceof File) || archivo.size === 0) volver(inspeccionId, codigo, "error", "Selecciona una fotografía.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) volver(inspeccionId, codigo, "error", "La evidencia debe ser JPG, PNG o WEBP.");
  if (archivo.size > 10 * 1024 * 1024) volver(inspeccionId, codigo, "error", "La imagen supera 10 MB.");

  const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
  const rutaStorage = `${inspeccionId}/puntos-criticos/${codigo}/${itemId}/${randomUUID()}.${extension}`;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = obtenerSupabaseAdmin();
  const { error } = await sb.storage.from(bucket).upload(
    rutaStorage,
    Buffer.from(await archivo.arrayBuffer()),
    { contentType: archivo.type, upsert: false },
  );
  if (error) volver(inspeccionId, codigo, "error", "No fue posible guardar la fotografía.");

  try {
    await prisma.$transaction(async (tx) => {
      const foto = await tx.fotografia.create({
        data: {
          inspeccionId,
          hallazgoId: null,
          url: rutaStorage,
          subidaPorId: session.user.id,
          descripcion: `[ORIGEN:${origenEvidencia}] ${puntoPorCodigo(codigo).etiqueta} · ${item.concepto} · foto ${ordenFoto}/${limiteFotos}`,
        },
      });
      await tx.$executeRaw`
        INSERT INTO "FotografiaArea"
          ("fotografiaId","areaId","guiaItemId","tipoEvidencia","orden","candidataReporte","candidataPortada","seleccionadaReporte")
        VALUES
          (${foto.id},${item.areaId}::uuid,${itemId},'PUNTO_CRITICO',${ordenFoto},true,false,true)
      `;
    });
  } catch (errorRegistro) {
    await sb.storage.from(bucket).remove([rutaStorage]);
    throw errorRegistro;
  }

  await registrarAuditoria({
    tipo: TipoEvento.SUBIR_EVIDENCIA,
    entidad: "FotografiaArea",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} agregó evidencia ${ordenFoto}/${limiteFotos} (${origenEvidencia}) a ${item.concepto} en ${puntoPorCodigo(codigo).etiqueta}.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad`);
  if (retorno === "HERMETICIDAD_INICIO") {
    redirect(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad?fase=inicio&ok=${encodeURIComponent("Fotografía registrada.")}`);
  }
  if (retorno === "HERMETICIDAD_CIERRE") {
    redirect(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad?fase=cierre&ok=${encodeURIComponent("Fotografía registrada.")}`);
  }
  volver(inspeccionId, codigo, "ok", "Fotografía registrada.", itemId);
}

export async function eliminarFotoPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const fotografiaId = texto(formData, "fotografiaId");
  if (!inspeccionId || !esCodigo(codigoTexto) || !fotografiaId) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario } = await exigirResponsable(inspeccionId);

  const [foto] = await prisma.$queryRaw<Array<{
    url: string;
    guiaItemId: string;
    estadoV3: string;
  }>>`
    SELECT f."url",g."id" AS "guiaItemId",g."estadoV3"
    FROM "Fotografia" f
    JOIN "FotografiaArea" fa ON fa."fotografiaId"=f."id"
    JOIN "GuiaInspeccionItem" g ON g."id"=fa."guiaItemId"
    WHERE f."id"=${fotografiaId} AND f."inspeccionId"=${inspeccionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;
  if (!foto) volver(inspeccionId, codigo, "error", "Fotografía no encontrada.");
  if (foto.estadoV3 !== "PENDIENTE") {
    volver(inspeccionId, codigo, "error", "Este concepto ya está cerrado y su evidencia no puede modificarse.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.fotografia.delete({ where: { id: fotografiaId } });
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "observacion"=${JSON.stringify({ actualizadoEn: new Date().toISOString() })},
          "actualizadoEn"=NOW()
      WHERE "id"=${foto.guiaItemId} AND "inspeccionId"=${inspeccionId}
    `;
  });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const sb = obtenerSupabaseAdmin();
  await sb.storage.from(bucket).remove([foto.url]);
  await registrarAuditoria({
    tipo: TipoEvento.ELIMINAR,
    entidad: "Fotografia",
    entidadId: fotografiaId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: "Se retiró una evidencia de punto crítico para permitir repetir la fotografía.",
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  volver(inspeccionId, codigo, "ok", "Fotografía retirada. Ya puedes repetirla.");
}

export async function registrarInicioPruebaProlongadaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const itemId = texto(formData, "itemId");
  const lecturaInicial = texto(formData, "lecturaInicial");
  const unidad = texto(formData, "unidad");
  const retorno = texto(formData, "retorno");
  if (!inspeccionId || !esCodigo(codigoTexto) || !itemId) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  const [paso] = await prisma.$queryRaw<Array<{ datos: unknown; lecturaInicial: string | null }>>`
    SELECT "datos","lecturaInicial"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;
  const datos = datosObjeto(paso?.datos);
  if (!paso || !datos.pruebaProlongada) {
    volver(inspeccionId, codigo, "error", "Este punto crítico no tiene una prueba prolongada contratada.");
  }
  if (paso.lecturaInicial) {
    volver(inspeccionId, codigo, "error", "La prueba prolongada ya tiene una lectura inicial registrada.");
  }
  if (!lecturaInicial || !unidad) {
    volver(inspeccionId, codigo, "error", "Registra la lectura inicial y su unidad.");
  }
  const lecturaInicialNumero = numeroLectura(lecturaInicial);
  if (lecturaInicialNumero === null) {
    volver(inspeccionId, codigo, "error", "La lectura inicial debe ser un valor numérico válido.");
  }

  const [item] = await prisma.$queryRaw<Array<{ concepto: string; fotos: number }>>`
    SELECT g."concepto",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    WHERE g."id"=${itemId} AND g."inspeccionId"=${inspeccionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
      AND g."concepto" ILIKE '%manómetro%'
    LIMIT 1
  `;
  if (!item) volver(inspeccionId, codigo, "error", "No se encontró el concepto inicial de manómetro.");
  if (Number(item.fotos) < 1) {
    volver(inspeccionId, codigo, "error", "Toma al menos una fotografía inicial del manómetro antes de arrancar la prueba.");
  }

  await prisma.$executeRaw`
    UPDATE "ProtocoloInspeccionPaso"
    SET "lecturaInicial"=CAST(${lecturaInicialNumero} AS numeric),"unidad"=${unidad},
        "iniciadoEn"=COALESCE("iniciadoEn",NOW()),"actualizadoEn"=NOW()
    WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
  `;

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} inició la prueba prolongada de ${puntoPorCodigo(codigo).etiqueta} con lectura ${lecturaInicial} ${unidad} y evidencia fotográfica inicial.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad`);
  if (retorno === "HERMETICIDAD_INICIO") {
    redirect(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad?fase=inicio&ok=${encodeURIComponent("Lectura inicial registrada.")}`);
  }
  volver(inspeccionId, codigo, "ok", "Prueba prolongada iniciada. Ya puedes continuar con el siguiente punto y regresar después para cerrarla.");
}

export async function generarInterpretacionIaPruebaProlongadaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const lecturaFinalPropuesta = texto(formData, "lecturaFinal");
  const unidadFinalPropuesta = texto(formData, "unidad");
  const retorno = texto(formData, "retorno");

  if (!inspeccionId || !esCodigo(codigoTexto)) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  await exigirResponsable(inspeccionId);

  if (!["HIDRAULICA", "GAS"].includes(codigo)) {
    volver(inspeccionId, codigo, "error", "La interpretación IA del manómetro sólo corresponde a Hidráulica o Gas.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) volver(inspeccionId, codigo, "error", "Falta GEMINI_API_KEY para generar la interpretación.");

  const [paso] = await prisma.$queryRaw<Array<{
    datos: unknown;
    lecturaInicial: string | null;
    unidad: string | null;
  }>>`
    SELECT "datos","lecturaInicial","unidad"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;
  if (!paso || !datosObjeto(paso.datos).pruebaProlongada) {
    volver(inspeccionId, codigo, "error", "Este punto no tiene habilitada la prueba prolongada.");
  }
  if (!paso.lecturaInicial) {
    volver(inspeccionId, codigo, "error", "Primero registra la foto y lectura inicial.");
  }
  if (!lecturaFinalPropuesta || !unidadFinalPropuesta) {
    volver(inspeccionId, codigo, "error", "Captura la lectura final y la unidad antes de solicitar la interpretación con IA.");
  }

  const variacionPresion = calcularVariacionPresion(
    paso.lecturaInicial,
    lecturaFinalPropuesta,
    paso.unidad,
    unidadFinalPropuesta,
  );

  const especiales = await prisma.$queryRaw<Array<{
    id: string;
    concepto: string;
    observacion: string | null;
  }>>`
    SELECT "id","concepto","observacion"
    FROM "GuiaInspeccionItem"
    WHERE "inspeccionId"=${inspeccionId}
      AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
      AND ("concepto" ILIKE '%manómetro%' OR "concepto" ILIKE '%lectura final%')
    ORDER BY "orden"
  `;
  const inicial = especiales.find((item) => /manómetro/i.test(item.concepto));
  const final = especiales.find((item) => /lectura final/i.test(item.concepto));
  if (!inicial || !final) volver(inspeccionId, codigo, "error", "No se encontraron los dos momentos de la prueba del manómetro.");

  const fotos = await prisma.$queryRaw<Array<{ guiaItemId: string; url: string }>>`
    SELECT fa."guiaItemId",f."url"
    FROM "FotografiaArea" fa
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE fa."guiaItemId"=ANY(${[inicial.id, final.id]}::text[])
    ORDER BY CASE WHEN fa."guiaItemId"=${inicial.id} THEN 1 ELSE 2 END,fa."orden"
  `;
  const fotoInicial = fotos.find((foto) => foto.guiaItemId === inicial.id);
  const fotoFinal = fotos.find((foto) => foto.guiaItemId === final.id);
  if (!fotoInicial || !fotoFinal) {
    volver(inspeccionId, codigo, "error", "La IA requiere la fotografía inicial y la fotografía final del manómetro.");
  }

  const sb = obtenerSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const partes: Array<Record<string, unknown>> = [];

  for (const [indice, foto] of [fotoInicial, fotoFinal].entries()) {
    const { data, error } = await sb.storage.from(bucket).download(foto.url);
    if (error || !data) volver(inspeccionId, codigo, "error", "No fue posible recuperar una de las fotografías del manómetro.");
    const mime = data.type || "image/jpeg";
    const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
    partes.push({
      text: indice === 0 ? "Fotografía inicial del manómetro:" : "Fotografía final del manómetro:",
    });
    partes.push({ inlineData: { mimeType: mime, data: base64 } });
  }

  partes.push({
    text: [
      "Actúa como asistente técnico de una inspección habitacional.",
      `Punto crítico: ${puntoPorCodigo(codigo).etiqueta}.`,
      "Prueba: hermeticidad con manómetro.",
      `Lectura inicial registrada por el inspector: ${paso.lecturaInicial} ${paso.unidad ?? unidadFinalPropuesta}.`,
      `Lectura final registrada para análisis: ${lecturaFinalPropuesta} ${unidadFinalPropuesta}.`,
      `Variación numérica calculada por el sistema: ${variacionPresion ?? "no calculable automáticamente"}.`,
      "Compara ambos momentos de la prueba y las dos fotografías.",
      "Describe objetivamente si la presión se mantiene, aumenta o disminuye según los valores proporcionados.",
      "No inventes causas, fugas ocultas, cumplimiento normativo ni condiciones que no puedan demostrarse con las fotografías y lecturas.",
      "Redacta una interpretación técnica breve y útil para expediente.",
      "Sugiere una clasificación C, O, NC, CR o NA; la decisión final corresponde al Inspector.",
      "Devuelve únicamente JSON con: descripcion, clasificacionSugerida, justificacion."
    ].join(" "),
  });

  const modelo = process.env.GEMINI_PROYECTO_MODEL || "gemini-3.5-flash-lite";
  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: partes }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
      cache: "no-store",
    },
  );

  const cuerpo = await respuesta.json().catch(() => ({})) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!respuesta.ok) {
    volver(inspeccionId, codigo, "error", `Gemini no pudo analizar la prueba del manómetro: ${cuerpo.error?.message || "error no identificado"}`);
  }

  const salida = cuerpo.candidates?.[0]?.content?.parts?.map((parte) => parte.text || "").join("").trim();
  if (!salida) volver(inspeccionId, codigo, "error", "Gemini no devolvió una interpretación.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(salida);
  } catch {
    volver(inspeccionId, codigo, "error", "Gemini devolvió una respuesta que no pudo estructurarse.");
  }

  const descripcionIa = String(parsed.descripcion ?? "").trim();
  const sugerida = String(parsed.clasificacionSugerida ?? "").trim().toUpperCase();
  const justificacionIa = String(parsed.justificacion ?? "").trim();
  if (!descripcionIa) volver(inspeccionId, codigo, "error", "Gemini no generó una interpretación técnica válida.");

  const anterior = observacionObjeto(final.observacion);
  const observacion: ObservacionItemCritico = {
    ...anterior,
    descripcionIa,
    clasificacionSugerida: ["C", "O", "NC", "CR", "NA"].includes(sugerida) ? sugerida : "O",
    justificacionIa,
    lecturaFinalPropuesta,
    unidadFinalPropuesta,
    variacionPresion: variacionPresion ?? undefined,
    actualizadoEn: new Date().toISOString(),
  };

  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "observacion"=${JSON.stringify(observacion)},"actualizadoEn"=NOW()
    WHERE "id"=${final.id} AND "inspeccionId"=${inspeccionId}
  `;

  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad`);
  if (retorno === "HERMETICIDAD_CIERRE") {
    redirect(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad?fase=cierre&ok=${encodeURIComponent("Interpretación IA generada. Revísala antes de cerrar.")}`);
  }
  redirect(`${ruta(inspeccionId, codigo, "ok", "Interpretación IA de la prueba generada. Revísala antes de cerrar.")}#prueba-manometro`);
}

export async function cerrarPruebaProlongadaV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const lecturaFinal = texto(formData, "lecturaFinal");
  const unidad = texto(formData, "unidad");
  const descripcionFinal = texto(formData, "descripcionFinal");
  const clasificacionTexto = texto(formData, "clasificacion").toUpperCase();
  const prioridadTexto = texto(formData, "prioridad").toUpperCase();
  const retorno = texto(formData, "retorno");

  if (!inspeccionId || !esCodigo(codigoTexto)) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);

  if (!["HIDRAULICA", "GAS"].includes(codigo)) {
    volver(inspeccionId, codigo, "error", "La prueba prolongada con manómetro sólo corresponde a Hidráulica o Gas.");
  }
  if (!lecturaFinal || !unidad) volver(inspeccionId, codigo, "error", "Registra la lectura final y su unidad.");
  const lecturaFinalNumero = numeroLectura(lecturaFinal);
  if (lecturaFinalNumero === null) volver(inspeccionId, codigo, "error", "La lectura final debe ser un valor numérico válido.");
  if (descripcionFinal.length < 10) volver(inspeccionId, codigo, "error", "Describe el resultado o hallazgo de la prueba con al menos 10 caracteres.");
  if (!["C","O","NC","CR","NA"].includes(clasificacionTexto)) volver(inspeccionId, codigo, "error", "Selecciona una clasificación válida.");
  if (!["P1","P2","P3","P4","P5"].includes(prioridadTexto)) volver(inspeccionId, codigo, "error", "Selecciona una prioridad válida.");

  const [paso] = await prisma.$queryRaw<Array<{
    datos: unknown;
    lecturaInicial: string | null;
    unidad: string | null;
    lecturaFinal: string | null;
  }>>`
    SELECT "datos","lecturaInicial","unidad","lecturaFinal"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    LIMIT 1
  `;
  if (!paso || !datosObjeto(paso.datos).pruebaProlongada) volver(inspeccionId, codigo, "error", "Este punto no tiene habilitada la prueba prolongada.");
  if (!paso.lecturaInicial) volver(inspeccionId, codigo, "error", "Primero registra la foto y lectura inicial.");
  if (paso.lecturaFinal) volver(inspeccionId, codigo, "error", "La prueba prolongada ya fue cerrada.");

  const especiales = await prisma.$queryRaw<Array<{ id: string; concepto: string; fotos: number }>>`
    SELECT g."id",g."concepto",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
    FROM "GuiaInspeccionItem" g
    WHERE g."inspeccionId"=${inspeccionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
      AND (g."concepto" ILIKE '%manómetro%' OR g."concepto" ILIKE '%lectura final%')
    ORDER BY g."orden"
  `;
  const inicial = especiales.find((item) => /manómetro/i.test(item.concepto));
  const final = especiales.find((item) => /lectura final/i.test(item.concepto));
  if (!inicial || Number(inicial.fotos) !== 1) volver(inspeccionId, codigo, "error", "Falta la fotografía inicial del manómetro.");
  if (!final || Number(final.fotos) !== 1) volver(inspeccionId, codigo, "error", "Falta la fotografía final del manómetro.");

  const [otros] = await prisma.$queryRaw<Array<{ pendientes: number }>>`
    SELECT COUNT(*) FILTER (
      WHERE "estadoV3"='PENDIENTE'
        AND "concepto" NOT ILIKE '%manómetro%'
        AND "concepto" NOT ILIKE '%lectura final%'
    )::int AS "pendientes"
    FROM "GuiaInspeccionItem"
    WHERE "inspeccionId"=${inspeccionId}
      AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
  `;
  if (Number(otros?.pendientes ?? 0) > 0) {
    volver(inspeccionId, codigo, "error", "Cierra primero todos los demás conceptos. La prueba con manómetro debe ser la única plantilla abierta.");
  }

  const observacion = JSON.stringify({
    descripcionFinal,
    clasificacionFinal: clasificacionTexto,
    prioridadFinal: prioridadTexto,
    actualizadoEn: new Date().toISOString(),
  });
  const clasificacion = clasificacionTexto as ClasificacionHallazgo;
  const prioridad = prioridadTexto as PrioridadHallazgo;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "lecturaFinal"=CAST(${lecturaFinalNumero} AS numeric),"unidad"=${unidad},
          "estado"='COMPLETADO',"completadoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    `;

    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "observacion"=${observacion},"estadoV3"='REVISADO',"completado"=true,
          "cerradoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "id"=ANY(${[inicial.id, final.id]}::text[])
    `;

    if (
      clasificacion === ClasificacionHallazgo.O ||
      clasificacion === ClasificacionHallazgo.NC ||
      clasificacion === ClasificacionHallazgo.CR
    ) {
      const hallazgo = await tx.hallazgo.create({
        data: {
          inspeccionId,
          creadoPorId: usuario.id,
          area: puntoPorCodigo(codigo).etiqueta,
          titulo: `${puntoPorCodigo(codigo).etiqueta} · Prueba de hermeticidad con manómetro`,
          descripcion: descripcionFinal,
          clasificacion,
          prioridad,
          guiaItemId: final.id,
          textoInspectorFinal: descripcionFinal,
        },
      });
      await tx.$executeRaw`
        UPDATE "Fotografia" f SET "hallazgoId"=${hallazgo.id}
        WHERE f."id" IN (
          SELECT fa."fotografiaId"
          FROM "FotografiaArea" fa
          WHERE fa."guiaItemId"=ANY(${[inicial.id, final.id]}::text[])
        )
      `;
    }

    await tx.$executeRaw`
      UPDATE "AreaInspeccion"
      SET "estado"='REVISADA',"resultado"=NULL,
          "comentarioFinal"=${`${puntoPorCodigo(codigo).etiqueta}: prueba de hermeticidad cerrada. ${descripcionFinal}`},
          "revisadaEn"=NOW(),"cerradaEn"=NOW(),"cerradaPorId"=${usuario.id},"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "codigo"=${`PC_${codigo}`}
    `;
  });

  await recalcularIndice(inspeccionId);
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} cerró la prueba prolongada de ${puntoPorCodigo(codigo).etiqueta}: ${paso.lecturaInicial} ${paso.unidad ?? unidad} → ${lecturaFinal} ${unidad}.`,
  });

  const siguiente = siguienteCodigo(codigo);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  if (retorno === "HERMETICIDAD_CIERRE") {
    redirect(`/panel/inspecciones/${inspeccionId}/puntos-criticos/hermeticidad?fase=cierre&ok=${encodeURIComponent("Prueba de hermeticidad cerrada.")}`);
  }
  if (siguiente) redirect(ruta(inspeccionId, siguiente, "ok", "Prueba de hermeticidad cerrada."));
  redirect(`/panel/inspecciones/${inspeccionId}/areas?ok=${encodeURIComponent("Prueba de hermeticidad cerrada.")}`);
}

export async function generarDescripcionIaPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const itemId = texto(formData, "itemId");
  if (!inspeccionId || !esCodigo(codigoTexto) || !itemId) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  await exigirResponsable(inspeccionId);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) volver(inspeccionId, codigo, "error", "Falta GEMINI_API_KEY para generar la descripción.");

  const [item] = await prisma.$queryRaw<Array<{
    concepto: string;
    especificacion: string | null;
    herramientaSugerida: string | null;
    observacion: string | null;
    estadoV3: string;
  }>>`
    SELECT "concepto","especificacion","herramientaSugerida","observacion","estadoV3"
    FROM "GuiaInspeccionItem"
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
      AND "area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;
  if (!item) volver(inspeccionId, codigo, "error", "Concepto no encontrado.");
  if (item.estadoV3 !== "PENDIENTE") volver(inspeccionId, codigo, "error", "Este concepto ya está cerrado y no puede volver a analizarse.");

  const fotos = await prisma.$queryRaw<Array<{ url: string; descripcion: string | null }>>`
    SELECT f."url",f."descripcion" FROM "FotografiaArea" fa
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE fa."guiaItemId"=${itemId}
    ORDER BY fa."orden",fa."creadoEn"
  `;
  const origenFotos = origenEvidenciaDescripcion(fotos[0]?.descripcion) ?? (fotos.length > 0 ? "CAMARA" : null);
  const requeridas = fotosRequeridas(origenFotos, item.concepto);
  if (fotos.length !== requeridas) {
    volver(inspeccionId, codigo, "error", requeridas === 1
      ? "La evidencia de galería requiere una fotografía antes del análisis con IA."
      : "Completa las 4 fotografías tomadas desde la aplicación antes del análisis con IA.");
  }

  const sb = obtenerSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const partes: Array<Record<string, unknown>> = [];
  for (const foto of fotos) {
    const { data, error } = await sb.storage.from(bucket).download(foto.url);
    if (error || !data) volver(inspeccionId, codigo, "error", "No fue posible recuperar una de las fotografías.");
    const mime = data.type || "image/jpeg";
    const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
    partes.push({ inlineData: { mimeType: mime, data: base64 } });
  }

  partes.push({
    text: [
      "Actúa como asistente técnico de una inspección habitacional.",
      `Punto crítico: ${puntoPorCodigo(codigo).etiqueta}.`,
      `Concepto: ${item.concepto}.`,
      item.especificacion ? `Criterio de revisión: ${item.especificacion}.` : "",
      item.herramientaSugerida ? `Herramienta asociada: ${item.herramientaSugerida}.` : "",
      `Analiza exclusivamente lo visible en ${fotos.length === 1 ? "la fotografía proporcionada" : "las fotografías proporcionadas"}. No inventes causas ocultas ni cumplimiento normativo que no pueda comprobarse.`,
      "Redacta una descripción técnica breve, objetiva y útil para expediente.",
      "Sugiere una clasificación C, O, NC, CR o NA; la decisión final siempre será del Inspector.",
      "Devuelve únicamente JSON con: descripcion, clasificacionSugerida, justificacion."
    ].filter(Boolean).join(" "),
  });

  const modelo = process.env.GEMINI_PROYECTO_MODEL || "gemini-3.5-flash-lite";
  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: partes }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
      cache: "no-store",
    },
  );
  const cuerpo = await respuesta.json().catch(() => ({})) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!respuesta.ok) volver(inspeccionId, codigo, "error", `Gemini no pudo analizar las fotografías: ${cuerpo.error?.message || "error no identificado"}`);
  const salida = cuerpo.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  if (!salida) volver(inspeccionId, codigo, "error", "Gemini no devolvió una descripción.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(salida);
  } catch {
    volver(inspeccionId, codigo, "error", "Gemini devolvió una respuesta que no pudo estructurarse.");
  }
  const descripcionIa = String(parsed.descripcion ?? "").trim();
  const sugerida = String(parsed.clasificacionSugerida ?? "").trim().toUpperCase();
  const justificacionIa = String(parsed.justificacion ?? "").trim();
  if (!descripcionIa) volver(inspeccionId, codigo, "error", "Gemini no generó una descripción técnica válida.");

  const anterior = observacionObjeto(item.observacion);
  const observacion: ObservacionItemCritico = {
    ...anterior,
    descripcionIa,
    clasificacionSugerida: ["C", "O", "NC", "CR", "NA"].includes(sugerida) ? sugerida : "O",
    justificacionIa,
    actualizadoEn: new Date().toISOString(),
  };
  await prisma.$executeRaw`
    UPDATE "GuiaInspeccionItem"
    SET "observacion"=${JSON.stringify(observacion)},"actualizadoEn"=NOW()
    WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
  `;
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  redirect(`${ruta(inspeccionId, codigo, "ok", "Descripción IA generada. Revísala y confirma la clasificación.")}#item-${itemId}`);
}

function prioridadClasificacion(clasificacion: ClasificacionHallazgo): PrioridadHallazgo {
  if (clasificacion === ClasificacionHallazgo.CR) return PrioridadHallazgo.P1;
  if (clasificacion === ClasificacionHallazgo.NC) return PrioridadHallazgo.P3;
  return PrioridadHallazgo.P4;
}

async function recalcularIndice(inspeccionId: string) {
  const hallazgos = await prisma.hallazgo.findMany({
    where: { inspeccionId },
    select: { clasificacion: true },
  });
  const evaluables = hallazgos.map((h) => h.clasificacion).filter((v) => v !== ClasificacionHallazgo.NA);
  if (!evaluables.length) {
    await prisma.inspeccion.update({ where: { id: inspeccionId }, data: { ish: null, semaforo: null } });
    return;
  }
  const pesos: Record<string, number> = { C: 100, O: 90, NC: 70, CR: 35 };
  const indice = evaluables.reduce((s, v) => s + (pesos[v] ?? 0), 0) / evaluables.length;
  const semaforo = indice >= 90 ? "VERDE" : indice >= 75 ? "AMARILLO" : indice >= 60 ? "NARANJA" : "ROJO";
  await prisma.inspeccion.update({ where: { id: inspeccionId }, data: { ish: indice, semaforo } });
}

export async function guardarResultadoPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  const itemId = texto(formData, "itemId");
  const descripcionFinal = texto(formData, "descripcionFinal");
  const clasificacionTexto = texto(formData, "clasificacion").toUpperCase();
  const prioridadTexto = texto(formData, "prioridad").toUpperCase();
  const valorMedido = texto(formData, "valorMedido");
  const valorProyecto = texto(formData, "valorProyecto");
  const unidadMedida = texto(formData, "unidadMedida");
  if (!inspeccionId || !esCodigo(codigoTexto) || !itemId) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);
  if (!["C", "O", "NC", "CR", "NA"].includes(clasificacionTexto)) volver(inspeccionId, codigo, "error", "Selecciona una clasificación válida.");
  if (!["P1", "P2", "P3", "P4", "P5"].includes(prioridadTexto)) volver(inspeccionId, codigo, "error", "Selecciona un nivel de prioridad válido.");
  if (descripcionFinal.length < 10) volver(inspeccionId, codigo, "error", "Confirma una interpretación o comentario técnico de al menos 10 caracteres.");

  const [item] = await prisma.$queryRaw<Array<{
    concepto: string;
    observacion: string | null;
    fotos: number;
    requiereMedicion: boolean;
    requiereComparacionProyecto: boolean;
    origenV3: string;
    estadoV3: string;
    descripcionPrimera: string | null;
  }>>`
    SELECT g."concepto",g."observacion",g."requiereMedicion",g."requiereComparacionProyecto",g."origenV3",g."estadoV3",
      (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos",
      (
        SELECT f."descripcion"
        FROM "FotografiaArea" fa
        JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
        WHERE fa."guiaItemId"=g."id"
        ORDER BY fa."orden"
        LIMIT 1
      ) AS "descripcionPrimera"
    FROM "GuiaInspeccionItem" g
    WHERE g."id"=${itemId} AND g."inspeccionId"=${inspeccionId}
      AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
    LIMIT 1
  `;
  if (!item) volver(inspeccionId, codigo, "error", "Concepto no encontrado.");
  if (item.estadoV3 !== "PENDIENTE") volver(inspeccionId, codigo, "error", "Este concepto ya está cerrado y no puede modificarse.");
  const origenFotosItem = origenEvidenciaDescripcion(item.descripcionPrimera) ?? (Number(item.fotos) > 0 ? "CAMARA" : null);
  const requeridasItem = fotosRequeridas(origenFotosItem, item.concepto);
  if (Number(item.fotos) !== requeridasItem) {
    volver(inspeccionId, codigo, "error", requeridasItem === 1
      ? `${item.concepto} requiere una fotografía de galería antes de cerrarse.`
      : `${item.concepto} requiere 4 fotografías tomadas desde la aplicación antes de cerrarse.`);
  }
  if (item.requiereMedicion && !valorMedido) {
    volver(inspeccionId, codigo, "error", `${item.concepto} requiere registrar el valor medido.`);
  }
  if (item.requiereMedicion && !unidadMedida) {
    volver(inspeccionId, codigo, "error", `${item.concepto} requiere indicar la unidad de medición.`);
  }
  if (item.requiereComparacionProyecto && item.origenV3 === "PROYECTO" && !valorProyecto) {
    volver(inspeccionId, codigo, "error", `${item.concepto} requiere registrar el valor de proyecto para la comparación.`);
  }

  const anterior = observacionObjeto(item.observacion);
  const observacion: ObservacionItemCritico = {
    ...anterior,
    descripcionFinal,
    clasificacionFinal: clasificacionTexto,
    prioridadFinal: prioridadTexto,
    actualizadoEn: new Date().toISOString(),
  };

  const clasificacion = clasificacionTexto as ClasificacionHallazgo;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "GuiaInspeccionItem"
      SET "observacion"=${JSON.stringify(observacion)},"estadoV3"='REVISADO',
          "valorMedido"=${valorMedido || null},"valorProyecto"=${valorProyecto || null},
          "unidadMedida"=${unidadMedida || null},
          "completado"=true,"cerradoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "id"=${itemId} AND "inspeccionId"=${inspeccionId}
    `;

    if (
      clasificacion === ClasificacionHallazgo.O ||
      clasificacion === ClasificacionHallazgo.NC ||
      clasificacion === ClasificacionHallazgo.CR
    ) {
      const existente = await tx.hallazgo.findFirst({
        where: { inspeccionId, guiaItemId: itemId },
        select: { id: true },
      });
      const hallazgo = existente
        ? await tx.hallazgo.update({
            where: { id: existente.id },
            data: {
              titulo: `${puntoPorCodigo(codigo).etiqueta} · ${item.concepto}`,
              area: puntoPorCodigo(codigo).etiqueta,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadTexto as PrioridadHallazgo,
              textoIaOriginal: anterior.descripcionIa || null,
              textoInspectorFinal: descripcionFinal,
            },
          })
        : await tx.hallazgo.create({
            data: {
              inspeccionId,
              creadoPorId: usuario.id,
              area: puntoPorCodigo(codigo).etiqueta,
              titulo: `${puntoPorCodigo(codigo).etiqueta} · ${item.concepto}`,
              descripcion: descripcionFinal,
              clasificacion,
              prioridad: prioridadTexto as PrioridadHallazgo,
              guiaItemId: itemId,
              textoIaOriginal: anterior.descripcionIa || null,
              textoInspectorFinal: descripcionFinal,
            },
          });
      await tx.$executeRaw`
        UPDATE "Fotografia" f SET "hallazgoId"=${hallazgo.id}
        WHERE f."id" IN (SELECT fa."fotografiaId" FROM "FotografiaArea" fa WHERE fa."guiaItemId"=${itemId})
      `;
    }

    if (/lectura final/i.test(item.concepto) && valorMedido) {
      await tx.$executeRaw`
        UPDATE "ProtocoloInspeccionPaso"
        SET "lecturaFinal"=${valorMedido},
            "unidad"=COALESCE(NULLIF(${unidadMedida},''),"unidad"),
            "actualizadoEn"=NOW()
        WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
      `;
    }
  });

  await recalcularIndice(inspeccionId);
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "GuiaInspeccionItem",
    entidadId: itemId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} cerró el concepto crítico “${item.concepto}” con clasificación ${clasificacionTexto}, prioridad ${prioridadTexto} y ${requeridasItem} evidencia(s).`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/captura`);
  volver(inspeccionId, codigo, "ok", "Concepto cerrado y clasificado.", itemId);
}

export async function cerrarPuntoCriticoV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const codigoTexto = texto(formData, "codigo");
  if (!inspeccionId || !esCodigo(codigoTexto)) redirect("/panel/inspecciones");
  const codigo = codigoTexto;
  const { usuario, responsable } = await exigirResponsable(inspeccionId);
  const punto = puntoPorCodigo(codigo);

  const [estado] = await prisma.$queryRaw<Array<{
    total: number;
    pendientes: number;
    incompletosFotos: number;
    pruebaProlongada: boolean;
    lecturaInicial: string | null;
    lecturaFinal: string | null;
  }>>`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE g."estadoV3"='PENDIENTE')::int AS "pendientes",
      COUNT(*) FILTER (
        WHERE g."estadoV3" <> 'NO_APLICA'
          AND CASE
            WHEN g."concepto" ILIKE '%manómetro%' OR g."concepto" ILIKE '%lectura final%'
              THEN (SELECT COUNT(*) FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") <> 1
            WHEN EXISTS (
              SELECT 1
              FROM "FotografiaArea" fa
              JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
              WHERE fa."guiaItemId"=g."id"
                AND f."descripcion" LIKE '[ORIGEN:GALERIA]%'
            )
              THEN (SELECT COUNT(*) FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") <> 1
            ELSE (SELECT COUNT(*) FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") <> 4
          END
      )::int AS "incompletosFotos",
      COALESCE((SELECT ("datos"->>'pruebaProlongada')::boolean FROM "ProtocoloInspeccionPaso"
        WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`} LIMIT 1),false) AS "pruebaProlongada",
      (SELECT "lecturaInicial" FROM "ProtocoloInspeccionPaso"
        WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`} LIMIT 1) AS "lecturaInicial",
      (SELECT "lecturaFinal" FROM "ProtocoloInspeccionPaso"
        WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`} LIMIT 1) AS "lecturaFinal"
    FROM "GuiaInspeccionItem" g
    WHERE g."inspeccionId"=${inspeccionId} AND g."area"=${`__PUNTO_CRITICO__:${codigo}`}
  `;
  if (Number(estado?.total ?? 0) === 0) volver(inspeccionId, codigo, "error", "Primero configura este punto como SI APLICA.");
  if (Number(estado?.pendientes ?? 0) > 0) volver(inspeccionId, codigo, "error", `Faltan ${estado.pendientes} concepto(s) por cerrar.`);
  if (Number(estado?.incompletosFotos ?? 0) > 0) volver(inspeccionId, codigo, "error", "Hay conceptos sin la evidencia requerida: 1 foto de galería o 4 fotos tomadas desde la aplicación.");
  if (estado?.pruebaProlongada && !estado.lecturaInicial) {
    volver(inspeccionId, codigo, "error", "Falta registrar la lectura inicial de la prueba prolongada.");
  }
  if (estado?.pruebaProlongada && !estado.lecturaFinal) {
    volver(inspeccionId, codigo, "error", "Falta registrar la lectura final de la prueba prolongada.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "ProtocoloInspeccionPaso"
      SET "estado"='COMPLETADO',"completadoEn"=NOW(),"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "clave"=${`PC_${codigo}`}
    `;
    await tx.$executeRaw`
      UPDATE "AreaInspeccion"
      SET "estado"='REVISADA',"resultado"=NULL,
          "comentarioFinal"=${`${punto.etiqueta} completada al 100%.`},
          "revisadaEn"=NOW(),"cerradaEn"=NOW(),"cerradaPorId"=${usuario.id},"actualizadoEn"=NOW()
      WHERE "inspeccionId"=${inspeccionId} AND "codigo"=${`PC_${codigo}`}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${responsable} cerró al 100% el punto crítico ${punto.etiqueta}.`,
  });

  const siguiente = siguienteCodigo(codigo);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/puntos-criticos`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  if (siguiente) redirect(ruta(inspeccionId, siguiente, "ok", `${punto.etiqueta} cerrada al 100%.`));
  redirect(`/panel/inspecciones/${inspeccionId}/areas?ok=${encodeURIComponent("Puntos críticos completos. Continúa con las áreas de la vivienda.")}`);
}
