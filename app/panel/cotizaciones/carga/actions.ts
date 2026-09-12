"use server";

import { EstadoCotizacion, EstadoPago, Prisma, RolUsuario, TipoCliente, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "cotizaciones";

function texto(fd: FormData, campo: string) { return String(fd.get(campo) ?? "").trim(); }
function numero(fd: FormData, campo: string) { const n = Number(texto(fd, campo)); return Number.isFinite(n) ? n : NaN; }
function volver(tipo: "ok" | "error", mensaje: string): never { redirect(`/panel/cotizaciones/carga?${tipo}=${encodeURIComponent(mensaje)}`); }
function normalizar(v: string) { return v.trim().toLocaleLowerCase("es-MX"); }

async function gestor() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const u = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, rol: true, activo: true } });
  if (!u?.activo || (u.rol !== RolUsuario.DIRECTOR && u.rol !== RolUsuario.ADMINISTRADOR)) redirect("/acceso");
  return u;
}

export async function incorporarCotizacionDefinitiva(fd: FormData) {
  const actor = await gestor();
  const pdf = fd.get("pdf");
  if (!(pdf instanceof File) || pdf.size === 0) volver("error", "Selecciona el PDF definitivo de la cotización.");
  if (pdf.type !== "application/pdf" && !pdf.name.toLowerCase().endsWith(".pdf")) volver("error", "El documento debe ser un archivo PDF.");
  if (pdf.size > 15 * 1024 * 1024) volver("error", "El PDF no puede exceder 15 MB.");

  const clienteIdElegido = texto(fd, "clienteId");
  const nombre = texto(fd, "nombre");
  const correo = texto(fd, "correo");
  const telefono = texto(fd, "telefono");
  const rfc = texto(fd, "rfc").toUpperCase();
  const curp = texto(fd, "curp").toUpperCase();
  const alias = texto(fd, "alias");
  const tipoInmueble = texto(fd, "tipoInmueble");
  const direccion = texto(fd, "direccion");
  const colonia = texto(fd, "colonia");
  const ciudad = texto(fd, "ciudad");
  const estado = texto(fd, "estado");
  const codigoPostal = texto(fd, "codigoPostal");
  const total = numero(fd, "total");
  const superficie = numero(fd, "superficieM2");
  const vigencia = texto(fd, "vigenciaHasta");

  if (!nombre || !alias || !tipoInmueble || !direccion || !ciudad || !estado || !Number.isFinite(total) || total <= 0 || !vigencia) volver("error", "Completa cliente, inmueble, importe y vigencia.");

  let clienteId = clienteIdElegido;
  if (!clienteId) {
    const criterios: Prisma.ClienteWhereInput[] = [
      ...(rfc ? [{ rfc: { equals: rfc, mode: Prisma.QueryMode.insensitive } }] : []),
      ...(curp ? [{ curp: { equals: curp, mode: Prisma.QueryMode.insensitive } }] : []),
      ...(correo ? [{ correo: { equals: correo, mode: Prisma.QueryMode.insensitive } }] : []),
      ...(telefono ? [{ telefono }] : []),
    ];
    const candidatos = criterios.length
      ? await prisma.cliente.findMany({
          where: { OR: criterios },
          select: { id: true, nombre: true, correo: true, telefono: true, rfc: true, curp: true },
          take: 3,
        })
      : [];
    if (candidatos.length > 1) volver("error", "Hay más de un cliente coincidente. Selecciona expresamente el cliente existente para evitar duplicados.");
    if (candidatos.length === 1) clienteId = candidatos[0].id;
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const cliente = clienteId
      ? await tx.cliente.findUnique({ where: { id: clienteId } })
      : await tx.cliente.create({ data: { nombre, correo: correo || null, telefono: telefono || null, rfc: rfc || null, curp: curp || null, tipo: TipoCliente.PARTICULAR } });
    if (!cliente) throw new Error("CLIENTE_NO_EXISTE");

    const inmuebles = await tx.inmueble.findMany({ where: { clienteId: cliente.id, ciudad: { equals: ciudad, mode: Prisma.QueryMode.insensitive } }, select: { id: true, direccion: true, alias: true } });
    const inmuebleCoincidente = inmuebles.find((i) => normalizar(i.direccion) === normalizar(direccion));
    const inmueble = inmuebleCoincidente
      ? await tx.inmueble.findUniqueOrThrow({ where: { id: inmuebleCoincidente.id } })
      : await tx.inmueble.create({ data: { clienteId: cliente.id, alias, tipo: tipoInmueble, direccion, colonia: colonia || null, ciudad, estado, codigoPostal: codigoPostal || null, superficieConstruccionM2: Number.isFinite(superficie) && superficie > 0 ? superficie : null } });

    const year = new Date().getFullYear();
    const [secuencia] = await tx.$queryRaw<Array<{ valor: bigint }>>`SELECT nextval('"Cotizacion_folio_seq"') AS valor`;
    const consecutivo = Number(secuencia.valor);
    const folio = `CH-COT-${year}-${String(consecutivo).padStart(5, "0")}`;

    const cotizacion = await tx.cotizacion.create({ data: {
      folio, clienteId: cliente.id, inmuebleId: inmueble.id, creadaPorId: actor.id,
      origenPublico: false, editablePublica: false, estado: EstadoCotizacion.BORRADOR, estadoPago: EstadoPago.PENDIENTE,
      superficieM2: Number.isFinite(superficie) && superficie > 0 ? superficie : null,
      precioBase: total, subtotal: total, total,
      vigenciaHasta: new Date(`${vigencia}T23:59:59.999Z`),
      notas: "Cotización definitiva incorporada mediante PDF.",
    } });
    return { cliente, inmueble, cotizacion };
  });

  const supabase = obtenerSupabaseAdmin();
  const ruta = `${resultado.cotizacion.id}/cotizacion-definitiva-v1.pdf`;
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(ruta, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    await prisma.cotizacion.delete({ where: { id: resultado.cotizacion.id } });
    volver("error", `No fue posible almacenar el PDF: ${uploadError.message}`);
  }

  await prisma.cotizacionVersion.create({ data: {
    cotizacionId: resultado.cotizacion.id,
    version: 1,
    total,
    datos: { tipo: "COTIZACION_DEFINITIVA_PDF", bucket: BUCKET, ruta, nombreOriginal: pdf.name, mimeType: "application/pdf", bytes: pdf.size } satisfies Prisma.InputJsonValue,
  } });

  await registrarAuditoria({
    tipo: TipoEvento.CREAR, entidad: "Cotizacion", entidadId: resultado.cotizacion.id, usuarioId: actor.id,
    descripcion: `${actor.rol} incorporó la cotización definitiva ${resultado.cotizacion.folio} mediante PDF y la vinculó al cliente ${resultado.cliente.nombre} e inmueble ${resultado.inmueble.alias}.`,
  });
  revalidatePath("/panel/cotizaciones"); revalidatePath("/panel/clientes"); revalidatePath("/panel/inmuebles");
  redirect(`/panel/cotizaciones?ok=${encodeURIComponent(`Cotización ${resultado.cotizacion.folio} incorporada. Asigna acceso al cliente y ponla a aceptación.`)}`);
}
