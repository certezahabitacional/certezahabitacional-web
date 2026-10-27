"use server";

import {
  EstadoConceptoGeneradores,
  EstadoGeneradorObra,
  EstadoTarjetaAPU,
  OrigenConceptoGeneradores,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireCertezaCostProjectAccess } from "@/lib/certeza-tecnica/access";
import { prisma } from "@/lib/prisma";
import { recalcularCostosProyecto } from "@/app/panel/certeza-tecnica/costos/actions";

function texto(fd: FormData, campo: string) {
  return String(fd.get(campo) ?? "").trim();
}

function numero(fd: FormData, campo: string, defecto = 0) {
  const raw = texto(fd, campo).replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : defecto;
}

async function autorizar(proyectoId: string) {
  return requireCertezaCostProjectAccess(
    proyectoId,
    `/certeza-tecnica/app/costos/generadores/${proyectoId}`
  );
}

export async function crearConcepto(proyectoId: string, fd: FormData) {
  await autorizar(proyectoId);
  const descripcion = texto(fd, "descripcion");
  const unidad = texto(fd, "unidad");
  if (!descripcion || !unidad) throw new Error("Descripción y unidad son obligatorias.");

  await prisma.conceptoGeneradores.create({
    data: {
      proyectoId,
      clave: texto(fd, "clave") || null,
      partida: texto(fd, "partida") || null,
      descripcion,
      unidad,
      origen: OrigenConceptoGeneradores.CERTEZA_TECNICA,
      estado: EstadoConceptoGeneradores.APROBADO_PARA_CUANTIFICACION,
      observaciones: texto(fd, "observaciones") || null,
    },
  });
  revalidatePath(`/certeza-tecnica/app/costos/generadores/${proyectoId}`);
}

export async function crearGenerador(proyectoId: string, fd: FormData) {
  const { usuario } = await autorizar(proyectoId);
  const conceptoId = texto(fd, "conceptoId");
  const total = numero(fd, "total");
  if (!conceptoId || total <= 0) throw new Error("Concepto y cantidad son obligatorios.");

  const count = await prisma.generadorObra.count({ where: { proyectoId } });
  const folio = `GEN-${String(count + 1).padStart(3, "0")}`;

  await prisma.generadorObra.create({
    data: {
      proyectoId,
      conceptoId,
      folio,
      estado: EstadoGeneradorObra.APROBADO,
      total,
      elaboradoPorId: usuario.id,
      revisadoPorId: usuario.id,
      revisadoEn: new Date(),
      autorizadoPorId: usuario.id,
      autorizadoEn: new Date(),
      observaciones: texto(fd, "observaciones") || null,
    },
  });
  revalidatePath(`/certeza-tecnica/app/costos/generadores/${proyectoId}`);
}

export async function crearTarjetaAPU(proyectoId: string, fd: FormData) {
  await autorizar(proyectoId);
  const conceptoId = texto(fd, "conceptoId");
  if (!conceptoId) throw new Error("Seleccione un concepto.");

  const ultima = await prisma.tarjetaPrecioUnitario.findFirst({
    where: { conceptoId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const costoDirecto = numero(fd, "costoDirecto");
  const indirectos = numero(fd, "porcentajeIndirectos");
  const financiamiento = numero(fd, "porcentajeFinanciamiento");
  const utilidad = numero(fd, "porcentajeUtilidad");
  const cargos = numero(fd, "porcentajeCargosAdicionales");

  const i = costoDirecto * indirectos / 100;
  const f = (costoDirecto + i) * financiamiento / 100;
  const u = (costoDirecto + i + f) * utilidad / 100;
  const c = (costoDirecto + i + f + u) * cargos / 100;
  const precioUnitario = costoDirecto + i + f + u + c;

  await prisma.tarjetaPrecioUnitario.create({
    data: {
      proyectoId,
      conceptoId,
      version: (ultima?.version ?? 0) + 1,
      estado: EstadoTarjetaAPU.BORRADOR,
      rendimiento: numero(fd, "rendimiento") || null,
      costoDirecto,
      porcentajeIndirectos: indirectos,
      porcentajeFinanciamiento: financiamiento,
      porcentajeUtilidad: utilidad,
      porcentajeCargosAdicionales: cargos,
      precioUnitario,
      observaciones: texto(fd, "observaciones") || null,
    },
  });
  revalidatePath(`/certeza-tecnica/app/costos/generadores/${proyectoId}`);
}

export async function agregarComponenteAPU(proyectoId: string, fd: FormData) {
  await autorizar(proyectoId);
  const tarjetaId = texto(fd, "tarjetaId");
  const insumoId = texto(fd, "insumoId");
  const cantidad = numero(fd, "cantidad");
  const desperdicioPct = numero(fd, "desperdicioPct");
  if (!tarjetaId || !insumoId || cantidad <= 0) throw new Error("Tarjeta, insumo y cantidad son obligatorios.");

  const insumo = await prisma.insumoAPU.findUnique({ where: { id: insumoId } });
  if (!insumo) throw new Error("Insumo no encontrado.");

  const precioAplicado = numero(fd, "precioAplicado", Number(insumo.precioBase));
  const importe = cantidad * (1 + desperdicioPct / 100) * precioAplicado;

  await prisma.tarjetaAPUInsumo.create({
    data: {
      tarjetaId,
      insumoId,
      cantidad,
      desperdicioPct,
      precioAplicado,
      importe,
      observaciones: texto(fd, "observaciones") || null,
    },
  });

  const suma = await prisma.tarjetaAPUInsumo.aggregate({
    where: { tarjetaId },
    _sum: { importe: true },
  });
  const tarjeta = await prisma.tarjetaPrecioUnitario.findUnique({ where: { id: tarjetaId } });
  if (tarjeta) {
    const cd = Number(suma._sum.importe ?? 0);
    const i = cd * Number(tarjeta.porcentajeIndirectos) / 100;
    const f = (cd + i) * Number(tarjeta.porcentajeFinanciamiento) / 100;
    const u = (cd + i + f) * Number(tarjeta.porcentajeUtilidad) / 100;
    const c = (cd + i + f + u) * Number(tarjeta.porcentajeCargosAdicionales) / 100;
    await prisma.tarjetaPrecioUnitario.update({
      where: { id: tarjetaId },
      data: { costoDirecto: cd, precioUnitario: cd + i + f + u + c },
    });
  }

  revalidatePath(`/certeza-tecnica/app/costos/generadores/${proyectoId}`);
}

export async function aprobarTarjetaAPU(proyectoId: string, tarjetaId: string) {
  await autorizar(proyectoId);
  const count = await prisma.tarjetaAPUInsumo.count({ where: { tarjetaId } });
  if (count === 0) throw new Error("No se puede aprobar una APU sin insumos.");

  await prisma.tarjetaPrecioUnitario.update({
    where: { id: tarjetaId },
    data: { estado: EstadoTarjetaAPU.APROBADA },
  });
  revalidatePath(`/certeza-tecnica/app/costos/generadores/${proyectoId}`);
  revalidatePath("/certeza-tecnica/app/costos/apu");
}

export async function recalcularProyectoDesdeFicha(proyectoId: string) {
  await autorizar(proyectoId);
  await recalcularCostosProyecto(proyectoId);
  revalidatePath(`/certeza-tecnica/app/costos/generadores/${proyectoId}`);
}
