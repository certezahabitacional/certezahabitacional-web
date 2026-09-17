"use server";

import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { obtenerAsignacionesInspeccion } from "@/lib/asignaciones-inspeccion";
import { registrarAuditoria } from "@/lib/auditoria";
import { validarLiberacionCampoDesdeCaja } from "@/lib/caja-validaciones";
import { prisma } from "@/lib/prisma";
import { eliminarArchivoStorage, subirArchivoStorage } from "@/lib/storage-gateway";

const TIPOS = new Set([
  "AREAS_DECLARADAS",
  "DATOS_CLIENTE",
  "DATOS_INMUEBLE",
  "IMPORTE_COTIZACION",
]);

function texto(fd: FormData, campo: string) {
  return String(fd.get(campo) ?? "").trim();
}

function volver(id: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/inspecciones/${id}/revision-inicial?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function contextoResponsable(inspeccionId: string) {
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
        zonaId: true,
        cotizacionId: true,
        inspectorId: true,
        requiereGerenteZona: true,
        requiereCoordinador: true,
        inspector: { select: { usuarioId: true } },
      },
    }),
  ]);

  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id &&
    inspeccion.inspector?.usuarioId === usuario.id;
  const director = usuario.rol === RolUsuario.DIRECTOR;
  if (!inspectorAsignado && !director) redirect("/acceso");
  if (inspeccion.estado !== EstadoInspeccion.PROGRAMADA) {
    volver(inspeccionId, "error", "La revisión final solo se realiza antes de iniciar físicamente la inspección.");
  }
  return { session, usuario, inspeccion, inspectorAsignado, director };
}

export async function subirFotoFachadaPrevia(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const archivo = formData.get("archivo");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { session, usuario, inspeccion } = await contextoResponsable(inspeccionId);

  if (!(archivo instanceof File) || archivo.size === 0) volver(inspeccionId, "error", "Toma o selecciona una fotografía de la fachada.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) volver(inspeccionId, "error", "La fotografía debe ser JPG, PNG o WEBP.");
  if (archivo.size > 10 * 1024 * 1024) volver(inspeccionId, "error", "La fotografía supera 10 MB.");

  const [conteo] = await prisma.$queryRaw<Array<{ total: number; portada: number }>>`
    SELECT COUNT(*)::int AS "total", COUNT(*) FILTER (WHERE fa."candidataPortada"=true)::int AS "portada"
    FROM "FotografiaArea" fa
    JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
    WHERE a."inspeccionId"=${inspeccionId} AND a."codigo"='FACHADA_PRINCIPAL'
  `;
  if (Number(conteo?.portada ?? 0) === 1) volver(inspeccionId, "error", "La fotografía definitiva de fachada ya fue seleccionada.");
  if (Number(conteo?.total ?? 0) >= 4) volver(inspeccionId, "error", "Ya están registradas las 4 fotografías obligatorias de fachada. Selecciona la mejor.");

  const [area] = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "AreaInspeccion" ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria")
    VALUES (${inspeccionId},'FACHADA_PRINCIPAL','Fachada principal','EXTERIOR',0,'REVISION_CLIENTE',true)
    ON CONFLICT ("inspeccionId","codigo") DO UPDATE SET "nombre"=EXCLUDED."nombre"
    RETURNING "id"::text
  `;
  if (!area?.id) volver(inspeccionId, "error", "No fue posible preparar la evidencia de fachada.");

  const extension = archivo.name.split(".").pop()?.toLowerCase() || archivo.type.split("/").pop() || "jpg";
  const ruta = `${inspeccionId}/areas/${area.id}/${randomUUID()}.${extension}`;
  try {
    await subirArchivoStorage({ usuarioId: usuario.id, inspeccionId, ruta, archivo });
  } catch (error) {
    console.error("Error de Storage al cargar fachada:", error instanceof Error ? error.message : error);
    volver(inspeccionId, "error", "No se pudo guardar la fotografía de fachada. Intenta nuevamente.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const foto = await tx.fotografia.create({
        data: {
          inspeccionId,
          hallazgoId: null,
          url: ruta,
          subidaPorId: session.user.id,
          descripcion: `Fachada principal · revisión final previa al inicio`,
        },
      });
      const [orden] = await tx.$queryRaw<Array<{ siguiente: number }>>`
        SELECT COALESCE(MAX("orden"),0)::int + 1 AS "siguiente" FROM "FotografiaArea" WHERE "areaId"=${area.id}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO "FotografiaArea" ("fotografiaId","areaId","tipoEvidencia","orden","candidataReporte","candidataPortada")
        VALUES (${foto.id},${area.id}::uuid,'IDENTIFICACION',${Number(orden?.siguiente ?? 1)},true,false)
      `;
    });
  } catch (errorDb) {
    await eliminarArchivoStorage({ usuarioId: usuario.id, inspeccionId, ruta }).catch(() => undefined);
    throw errorDb;
  }

  await registrarAuditoria({
    tipo: TipoEvento.SUBIR_EVIDENCIA,
    entidad: "Fotografia",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} agregó fotografía obligatoria de fachada durante la revisión final con el cliente de ${inspeccion.folio}.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision-inicial`);
  volver(inspeccionId, "ok", "Fotografía de fachada registrada.");
}

export async function seleccionarMejorFachada(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const fotografiaId = texto(formData, "fotografiaId");
  if (!inspeccionId || !fotografiaId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await contextoResponsable(inspeccionId);

  const fotos = await prisma.$queryRaw<Array<{ fotografiaId: string; ruta: string }>>`
    SELECT fa."fotografiaId",f."url" AS "ruta"
    FROM "FotografiaArea" fa
    JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE a."inspeccionId"=${inspeccionId} AND a."codigo"='FACHADA_PRINCIPAL'
    ORDER BY fa."orden",fa."creadoEn"
  `;
  if (fotos.length !== 4) volver(inspeccionId, "error", "Debes tener exactamente 4 fotografías antes de elegir la mejor.");
  if (!fotos.some((f) => f.fotografiaId === fotografiaId)) volver(inspeccionId, "error", "La fotografía seleccionada no pertenece a esta inspección.");

  const descartadas = fotos.filter((f) => f.fotografiaId !== fotografiaId);
  try {
    for (const foto of descartadas) {
      await eliminarArchivoStorage({ usuarioId: usuario.id, inspeccionId, ruta: foto.ruta });
    }
  } catch (error) {
    console.error("Error de Storage al depurar fachadas:", error instanceof Error ? error.message : error);
    volver(inspeccionId, "error", "No se pudieron eliminar las tres fotografías descartadas. Intenta nuevamente.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.fotografia.deleteMany({ where: { id: { in: descartadas.map((f) => f.fotografiaId) }, inspeccionId } });
    await tx.$executeRaw`
      UPDATE "FotografiaArea"
      SET "candidataPortada"=true,"candidataReporte"=true,"orden"=1
      WHERE "fotografiaId"=${fotografiaId}
    `;
  });

  await registrarAuditoria({
    tipo: TipoEvento.ELIMINAR_EVIDENCIA,
    entidad: "Fotografia",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} seleccionó la mejor fotografía de fachada de ${inspeccion.folio}; se conservó una como portada definitiva y se eliminaron las otras tres fotografías de selección.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision-inicial`);
  revalidatePath(`/panel/inspecciones/${inspeccionId}/areas`);
  volver(inspeccionId, "ok", "Fotografía definitiva seleccionada. Las otras tres fueron eliminadas.");
}

export async function solicitarCorreccionPrevia(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const tipo = texto(formData, "tipoCorreccion");
  const detalle = texto(formData, "detalle");
  if (!inspeccionId) redirect("/panel/inspecciones");
  if (!TIPOS.has(tipo)) volver(inspeccionId, "error", "Selecciona una opción válida de corrección.");

  const { usuario, inspeccion } = await contextoResponsable(inspeccionId);
  if (usuario.rol === RolUsuario.INSPECTOR || usuario.rol === RolUsuario.DIRECTOR) {
    const existente = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"::text FROM "SolicitudCorreccionInspeccion"
      WHERE "inspeccionId"=${inspeccionId} AND "tipo"=${tipo} AND "estado"='PENDIENTE'
      LIMIT 1
    `;
    if (existente.length > 0) volver(inspeccionId, "error", "Ya existe una solicitud pendiente para esa sección.");

    let responsable = inspeccion.zonaId
      ? await prisma.usuario.findFirst({
          where: { rol: RolUsuario.ADMINISTRADOR, activo: true, zonaId: inspeccion.zonaId },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, rol: true },
        })
      : null;

    if (!responsable) {
      responsable = await prisma.usuario.findFirst({
        where: { rol: RolUsuario.DIRECTOR, activo: true },
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, rol: true },
      });
    }
    if (!responsable) volver(inspeccionId, "error", "No hay Administrador ni Director activo para recibir la solicitud.");

    await prisma.$executeRaw`
      INSERT INTO "SolicitudCorreccionInspeccion" ("inspeccionId","tipo","detalle","solicitadaPorId","asignadaAId")
      VALUES (${inspeccionId},${tipo},${detalle || null},${usuario.id},${responsable.id})
    `;
    await registrarAuditoria({
      tipo: TipoEvento.EDITAR,
      entidad: "SolicitudCorreccionInspeccion",
      inspeccionId,
      usuarioId: usuario.id,
      descripcion: `${usuario.rol} solicitó corregir ${tipo}. La instrucción fue asignada prioritariamente a ${responsable.rol}: ${responsable.nombre}.`,
    });
    revalidatePath(`/panel/inspecciones/${inspeccionId}/revision-inicial`);
    volver(inspeccionId, "ok", `Solicitud enviada a ${responsable.nombre} (${responsable.rol}). La inspección no podrá iniciar hasta resolverla.`);
  }

  redirect("/acceso");
}

export async function resolverSolicitudCorreccion(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const solicitudId = texto(formData, "solicitudId");
  const comentario = texto(formData, "comentario");
  if (!inspeccionId || !solicitudId) redirect("/panel/inspecciones");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, rol: true, activo: true } });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.ADMINISTRADOR && usuario.rol !== RolUsuario.DIRECTOR)) redirect("/acceso");

  const [solicitud] = await prisma.$queryRaw<Array<{ asignadaAId: string | null; estado: string }>>`
    SELECT "asignadaAId","estado" FROM "SolicitudCorreccionInspeccion"
    WHERE "id"=${solicitudId}::uuid AND "inspeccionId"=${inspeccionId}
    LIMIT 1
  `;
  if (!solicitud || solicitud.estado !== "PENDIENTE") volver(inspeccionId, "error", "La solicitud ya no está pendiente.");
  if (usuario.rol === RolUsuario.ADMINISTRADOR && solicitud.asignadaAId !== usuario.id) redirect("/acceso");

  await prisma.$executeRaw`
    UPDATE "SolicitudCorreccionInspeccion"
    SET "estado"='RESUELTA',"resueltaPorId"=${usuario.id},"resueltaEn"=NOW(),"comentarioResolucion"=${comentario || null}
    WHERE "id"=${solicitudId}::uuid
  `;
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "SolicitudCorreccionInspeccion",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: `${usuario.rol} marcó como resuelta una corrección previa al inicio de la inspección.`,
  });
  revalidatePath(`/panel/inspecciones/${inspeccionId}/revision-inicial`);
  volver(inspeccionId, "ok", "Corrección marcada como resuelta. El responsable puede volver a revisar la información con el cliente.");
}

export async function iniciarInspeccionConfirmada(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await contextoResponsable(inspeccionId);

  const [fachada, pendientes] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number; portada: number }>>`
      SELECT COUNT(*)::int AS "total", COUNT(*) FILTER (WHERE fa."candidataPortada"=true)::int AS "portada"
      FROM "FotografiaArea" fa
      JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
      WHERE a."inspeccionId"=${inspeccionId} AND a."codigo"='FACHADA_PRINCIPAL'
    `,
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS "total" FROM "SolicitudCorreccionInspeccion"
      WHERE "inspeccionId"=${inspeccionId} AND "estado"='PENDIENTE'
    `,
  ]);
  if (Number(fachada[0]?.total ?? 0) !== 1 || Number(fachada[0]?.portada ?? 0) !== 1) {
    volver(inspeccionId, "error", "Antes de iniciar debes definir una sola fotografía definitiva de fachada: elegir la mejor entre 4 tomadas en sitio o usar 1 fotografía existente.");
  }
  if (Number(pendientes[0]?.total ?? 0) > 0) volver(inspeccionId, "error", "Hay solicitudes de corrección pendientes. No se puede iniciar la inspección todavía.");

  if (!inspeccion.cotizacionId) volver(inspeccionId, "error", "La inspección no tiene cotización asociada.");
  const liberacion = await validarLiberacionCampoDesdeCaja(inspeccion.cotizacionId);
  if (!liberacion.ok) volver(inspeccionId, "error", liberacion.error);

  const asignaciones = await obtenerAsignacionesInspeccion(inspeccionId);
  if (inspeccion.requiereGerenteZona && !asignaciones.gerenteId) volver(inspeccionId, "error", "La inspección requiere Gerente y todavía no tiene uno asignado.");
  if (inspeccion.requiereCoordinador && !asignaciones.coordinadorId) volver(inspeccionId, "error", "La inspección requiere Coordinador y todavía no tiene uno asignado.");

  await prisma.inspeccion.update({ where: { id: inspeccionId }, data: { estado: EstadoInspeccion.EN_PROCESO } });
  const directorPorAusencia = usuario.rol === RolUsuario.DIRECTOR && !inspeccion.inspectorId;
  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "Inspeccion",
    entidadId: inspeccionId,
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: directorPorAusencia
      ? `DIRECTOR confirmó con el cliente la información previa e inició ${inspeccion.folio} como Director por ausencia de Inspector.`
      : `${usuario.rol} confirmó con el cliente la revisión final de datos y dio INICIAR a ${inspeccion.folio}.`,
  });

  revalidatePath(`/panel/inspecciones/${inspeccionId}`);
  revalidatePath("/panel/inspecciones");
  revalidatePath("/panel/agenda");
  redirect(inspeccion.numeroInspeccion === 1 ? `/panel/inspecciones/${inspeccionId}/areas` : `/panel/inspecciones/${inspeccionId}/captura`);
}
