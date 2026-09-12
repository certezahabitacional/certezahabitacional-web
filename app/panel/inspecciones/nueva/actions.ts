"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { validarCotizacionParaNuevaInspeccion } from "./validacion-cotizacion";

function texto(formData: FormData, campo: string): string { return String(formData.get(campo) ?? "").trim(); }
function decimalANumero(valor: unknown): number | null { if (valor === null || valor === undefined || valor === "") return null; const numero = Number(valor); return Number.isFinite(numero) ? numero : null; }
function errorNuevaInspeccion(mensaje: string, antecedenteId?: string): never { const parametros = new URLSearchParams({ error: mensaje }); if (antecedenteId) parametros.set("antecedenteId", antecedenteId); redirect(`/panel/inspecciones/nueva?${parametros.toString()}`); }
const ROLES_CREACION = new Set<RolUsuario>([RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.GERENTE]);

export async function crearInspeccion(formData: FormData) {
  const session = await auth(); if (!session?.user) redirect("/login");
  const usuarioActual = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, nombre: true, rol: true, activo: true, zonaId: true } });
  if (!usuarioActual?.activo || !ROLES_CREACION.has(usuarioActual.rol)) redirect("/acceso");

  const antecedenteId = texto(formData, "antecedenteId"), cotizacionId = texto(formData, "cotizacionId"), clienteId = texto(formData, "clienteId"), inmuebleId = texto(formData, "inmuebleId"), inspectorId = texto(formData, "inspectorId"), plantillaId = texto(formData, "plantillaId"), zonaId = texto(formData, "zonaId"), fechaProgramadaTexto = texto(formData, "fechaProgramada"), observaciones = texto(formData, "observaciones");
  if (!cotizacionId) errorNuevaInspeccion("Selecciona la cotización autorizada que origina esta inspección.", antecedenteId || undefined);
  if (!clienteId || !inmuebleId || !plantillaId || !zonaId || !fechaProgramadaTexto) errorNuevaInspeccion("Completa los campos obligatorios.", antecedenteId || undefined);

  const validacion = await validarCotizacionParaNuevaInspeccion({ cotizacionId, clienteId, inmuebleId });
  if (!validacion.ok) errorNuevaInspeccion(validacion.error, antecedenteId || undefined);

  const [plantilla, zona, inmueble] = await Promise.all([
    prisma.plantillaInspeccion.findFirst({ where: { id: plantillaId, activa: true }, select: { id: true, nombre: true, tipoServicio: true, requiereGerenteZona: true, requiereCoordinador: true } }),
    prisma.zona.findFirst({ where: { id: zonaId, activa: true }, select: { id: true, nombre: true, zonaHoraria: true } }),
    prisma.inmueble.findUnique({ where: { id: inmuebleId }, select: { id: true, clienteId: true, tipo: true, direccion: true, ciudad: true, superficieConstruccionM2: true } }),
  ]);
  if (!plantilla) errorNuevaInspeccion("La plantilla seleccionada no existe o está inactiva.", antecedenteId || undefined);
  if (!zona) errorNuevaInspeccion("La zona seleccionada no existe o está inactiva.", antecedenteId || undefined);
  if (!inmueble || inmueble.clienteId !== clienteId) errorNuevaInspeccion("El inmueble no corresponde al cliente.", antecedenteId || undefined);

  let inspectorSeleccionado: { id: string; usuario: { id: string; nombre: string; zonaId: string | null; gerenteId: string | null; coordinadorId: string | null } } | null = null;
  if (inspectorId) {
    inspectorSeleccionado = await prisma.inspector.findFirst({ where: { id: inspectorId, activo: true, usuario: { activo: true, rol: RolUsuario.INSPECTOR } }, select: { id: true, usuario: { select: { id: true, nombre: true, zonaId: true, gerenteId: true, coordinadorId: true } } } });
    if (!inspectorSeleccionado) errorNuevaInspeccion("El Inspector seleccionado no está disponible.", antecedenteId || undefined);
    if (inspectorSeleccionado.usuario.zonaId !== zona.id) errorNuevaInspeccion("El Inspector seleccionado no pertenece a la zona elegida.", antecedenteId || undefined);
  }
  if (plantilla.requiereGerenteZona) {
    if (!inspectorSeleccionado?.usuario.gerenteId) errorNuevaInspeccion("Esta plantilla requiere un Inspector con Gerente de Zona asignado.", antecedenteId || undefined);
    const gerenteValido = await prisma.usuario.findFirst({ where: { id: inspectorSeleccionado.usuario.gerenteId, rol: RolUsuario.GERENTE, activo: true, zonaId: zona.id }, select: { id: true } });
    if (!gerenteValido) errorNuevaInspeccion("El Gerente asignado al Inspector no está activo o no pertenece a la zona seleccionada.", antecedenteId || undefined);
  }
  if (plantilla.requiereCoordinador) {
    if (!inspectorSeleccionado?.usuario.coordinadorId) errorNuevaInspeccion("Esta plantilla requiere un Inspector con Coordinador asignado.", antecedenteId || undefined);
    const coordinadorValido = await prisma.usuario.findFirst({ where: { id: inspectorSeleccionado.usuario.coordinadorId, rol: RolUsuario.COORDINADOR, activo: true, zonaId: zona.id }, select: { id: true } });
    if (!coordinadorValido) errorNuevaInspeccion("El Coordinador asignado al Inspector no está activo o no pertenece a la zona seleccionada.", antecedenteId || undefined);
  }

  let numeroInspeccion = 1; let inspeccionAnterior: { id: string; folio: string; numeroInspeccion: number } | null = null;
  if (antecedenteId) {
    const antecedente = await prisma.inspeccion.findUnique({ where: { id: antecedenteId }, select: { id: true, folio: true, estado: true, clienteId: true, inmuebleId: true, numeroInspeccion: true, zonaId: true } });
    if (!antecedente) errorNuevaInspeccion("La inspección antecedente no existe.");
    if (antecedente.estado !== EstadoInspeccion.FINALIZADA) errorNuevaInspeccion("Solo una inspección FINALIZADA puede generar una nueva inspección de seguimiento.", antecedente.id);
    if (antecedente.clienteId !== clienteId || antecedente.inmuebleId !== inmuebleId) errorNuevaInspeccion("La nueva cotización debe corresponder al mismo cliente e inmueble de la inspección antecedente.", antecedente.id);
    if (antecedente.zonaId && antecedente.zonaId !== zona.id) errorNuevaInspeccion("La inspección de seguimiento debe conservar la misma zona del antecedente.", antecedente.id);
    const seguimientoExistente = await prisma.inspeccion.findFirst({ where: { inspeccionAnteriorId: antecedente.id }, select: { id: true, folio: true, numeroInspeccion: true } });
    if (seguimientoExistente) redirect(`/panel/inspecciones/${seguimientoExistente.id}?ok=${encodeURIComponent(`Ya existe la inspección de seguimiento V${seguimientoExistente.numeroInspeccion} (${seguimientoExistente.folio}).`)}`);
    inspeccionAnterior = { id: antecedente.id, folio: antecedente.folio, numeroInspeccion: antecedente.numeroInspeccion }; numeroInspeccion = antecedente.numeroInspeccion + 1;
  } else {
    const maximo = await prisma.inspeccion.aggregate({ where: { inmuebleId }, _max: { numeroInspeccion: true } }); numeroInspeccion = (maximo._max.numeroInspeccion ?? 0) + 1;
  }

  const fechaProgramada = fromZonedTime(fechaProgramadaTexto, zona.zonaHoraria); if (Number.isNaN(fechaProgramada.getTime())) errorNuevaInspeccion("Selecciona una fecha y hora válidas.", antecedenteId || undefined);
  const year = fechaProgramada.getFullYear(), inicioYear = new Date(Date.UTC(year, 0, 1)), inicioSiguienteYear = new Date(Date.UTC(year + 1, 0, 1));
  const totalDelYear = await prisma.inspeccion.count({ where: { creadoEn: { gte: inicioYear, lt: inicioSiguienteYear } } }); let consecutivo = totalDelYear + 1; let folio = `CH-${year}-${String(consecutivo).padStart(4, "0")}`;
  while (await prisma.inspeccion.findUnique({ where: { folio }, select: { id: true } })) { consecutivo += 1; folio = `CH-${year}-${String(consecutivo).padStart(4, "0")}`; }

  const inspeccion = await prisma.inspeccion.create({ data: {
    folio, plantillaId: plantilla.id, requiereGerenteZona: plantilla.requiereGerenteZona, requiereCoordinador: plantilla.requiereCoordinador, zonaId: zona.id, clienteId, inmuebleId, cotizacionId, numeroInspeccion, inspeccionAnteriorId: inspeccionAnterior?.id ?? null, inspectorId: inspectorSeleccionado?.id ?? null, agendadaPorId: session.user.id, tipoServicio: plantilla.tipoServicio, tipoInmueble: inmueble.tipo, direccion: inmueble.direccion, ciudad: inmueble.ciudad, superficieM2: decimalANumero(inmueble.superficieConstruccionM2), fechaProgramada, zonaHoraria: zona.zonaHoraria, estado: EstadoInspeccion.PROGRAMADA, observaciones: observaciones || null,
    inicioLiberadoSinPago: validacion.cotizacion.excepcionInicio,
  }, select: { id: true, folio: true, numeroInspeccion: true } });

  await registrarAuditoria({ tipo: TipoEvento.CREAR, entidad: "Inspeccion", entidadId: inspeccion.id, inspeccionId: inspeccion.id, usuarioId: session.user.id, descripcion: `${usuarioActual.rol} creó y programó ${inspeccion.folio} V${inspeccion.numeroInspeccion} desde la cotización ${validacion.cotizacion.folio}${inspeccionAnterior ? `, conservando antecedente ${inspeccionAnterior.folio}` : ""}. Excepción de inicio: ${validacion.cotizacion.excepcionInicio ? "Sí, autorizada previamente por Dirección" : "No"}.` });
  revalidatePath("/panel"); revalidatePath("/panel/agenda"); revalidatePath("/panel/inspecciones"); revalidatePath("/panel/caja"); revalidatePath("/portal/inspecciones");
  redirect(`/panel/inspecciones/${inspeccion.id}?ok=${encodeURIComponent("Inspección creada y programada correctamente.")}`);
}
