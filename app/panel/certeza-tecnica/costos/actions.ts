"use server";

import { EstadoGeneradorObra, EstadoTarjetaAPU, TipoInsumoAPU } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireCertezaCostAccess } from "@/lib/certeza-tecnica/access";
import { prisma } from "@/lib/prisma";

const ESTADOS_GENERADOR_VALIDOS: EstadoGeneradorObra[] = [
  EstadoGeneradorObra.APROBADO,
  EstadoGeneradorObra.AUTORIZADO,
  EstadoGeneradorObra.CERRADO,
];

const ESTADOS_APU_VALIDOS: EstadoTarjetaAPU[] = [
  EstadoTarjetaAPU.APROBADA,
];

type TotalesExplosion = Record<TipoInsumoAPU, number>;

function ceroTotales(): TotalesExplosion {
  return {
    MATERIAL: 0,
    MANO_OBRA: 0,
    EQUIPO: 0,
    HERRAMIENTA: 0,
    SUBCONTRATO: 0,
    AUXILIAR: 0,
  };
}

export async function recalcularCostosProyecto(proyectoId: string) {
  await requireCertezaCostAccess("/panel/certeza-tecnica/presupuestos");

  const proyecto = await prisma.proyectoGeneradores.findUnique({
    where: { id: proyectoId },
    include: {
      conceptos: {
        include: {
          generadores: {
            where: { estado: { in: ESTADOS_GENERADOR_VALIDOS } },
            select: { total: true, estado: true },
          },
          tarjetasAPU: {
            where: { estado: { in: ESTADOS_APU_VALIDOS } },
            include: {
              componentes: {
                include: { insumo: true },
              },
            },
            orderBy: { version: "desc" },
          },
        },
      },
      presupuestos: {
        orderBy: { version: "desc" },
        take: 1,
      },
      explosionesInsumos: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!proyecto) {
    throw new Error("Proyecto no encontrado.");
  }

  const conceptosUtilizables = proyecto.conceptos
    .map((concepto) => {
      const cantidad = concepto.generadores.reduce(
        (suma, generador) => suma + Number(generador.total),
        0
      );
      const tarjeta = concepto.tarjetasAPU[0] ?? null;
      return { concepto, cantidad, tarjeta };
    })
    .filter((item) => item.cantidad > 0 && item.tarjeta);

  if (conceptosUtilizables.length === 0) {
    throw new Error(
      "No hay conceptos con generadores aprobados/autorizados/cerrados y una Tarjeta APU aprobada."
    );
  }

  const ultimoPresupuesto = proyecto.presupuestos[0] ?? null;
  const versionPresupuesto =
    ultimoPresupuesto && ultimoPresupuesto.estado === "LINEA_BASE"
      ? ultimoPresupuesto.version + 1
      : ultimoPresupuesto?.version ?? 1;

  const ultimaExplosion = proyecto.explosionesInsumos[0] ?? null;
  const versionExplosion =
    ultimaExplosion && ultimaExplosion.estado === "CERRADO"
      ? ultimaExplosion.version + 1
      : ultimaExplosion?.version ?? 1;

  const detallesExplosion = new Map<
    string,
    {
      insumoId: string;
      tipo: TipoInsumoAPU;
      unidad: string;
      cantidadTotal: number;
      precioReferencia: number;
      importeTotal: number;
    }
  >();

  let costoDirecto = 0;
  let importeAPUFinal = 0;

  const conceptosPresupuesto = conceptosUtilizables.map(({ concepto, cantidad, tarjeta }) => {
    if (!tarjeta) throw new Error("Tarjeta APU faltante.");

    costoDirecto += cantidad * Number(tarjeta.costoDirecto);
    importeAPUFinal += cantidad * Number(tarjeta.precioUnitario);

    for (const componente of tarjeta.componentes) {
      const factorDesperdicio = 1 + Number(componente.desperdicioPct) / 100;
      const cantidadInsumo = cantidad * Number(componente.cantidad) * factorDesperdicio;
      const precio = Number(componente.precioAplicado);
      const importe = cantidadInsumo * precio;
      const previo = detallesExplosion.get(componente.insumoId);

      if (previo) {
        previo.cantidadTotal += cantidadInsumo;
        previo.importeTotal += importe;
      } else {
        detallesExplosion.set(componente.insumoId, {
          insumoId: componente.insumoId,
          tipo: componente.insumo.tipo,
          unidad: componente.insumo.unidad,
          cantidadTotal: cantidadInsumo,
          precioReferencia: precio,
          importeTotal: importe,
        });
      }
    }

    return {
      conceptoId: concepto.id,
      tarjetaAPUId: tarjeta.id,
      partida: concepto.partida,
      clave: concepto.clave,
      descripcion: concepto.descripcion,
      unidad: concepto.unidad,
      cantidad,
      precioUnitario: Number(tarjeta.precioUnitario),
      importe: cantidad * Number(tarjeta.precioUnitario),
    };
  });

  const totales = ceroTotales();
  for (const detalle of detallesExplosion.values()) {
    totales[detalle.tipo] += detalle.importeTotal;
  }
  const totalExplosion = Object.values(totales).reduce((a, b) => a + b, 0);

  const referencia = conceptosUtilizables[0].tarjeta!;
  const porcentajeIndirectos = Number(referencia.porcentajeIndirectos);
  const porcentajeFinanciamiento = Number(referencia.porcentajeFinanciamiento);
  const porcentajeUtilidad = Number(referencia.porcentajeUtilidad);
  const porcentajeCargosAdicionales = Number(referencia.porcentajeCargosAdicionales);

  const indirectos = costoDirecto * (porcentajeIndirectos / 100);
  const financiamiento = (costoDirecto + indirectos) * (porcentajeFinanciamiento / 100);
  const utilidad = (costoDirecto + indirectos + financiamiento) * (porcentajeUtilidad / 100);
  const cargosAdicionales =
    (costoDirecto + indirectos + financiamiento + utilidad) *
    (porcentajeCargosAdicionales / 100);

  const subtotalCalculado =
    costoDirecto + indirectos + financiamiento + utilidad + cargosAdicionales;

  const subtotal = importeAPUFinal > 0 ? importeAPUFinal : subtotalCalculado;

  await prisma.$transaction(async (tx) => {
    const presupuesto = await tx.presupuestoProyectoCT.upsert({
      where: {
        proyectoId_version: {
          proyectoId,
          version: versionPresupuesto,
        },
      },
      update: {
        nombre: `Presupuesto ${proyecto.codigo} v${versionPresupuesto}`,
        estado: "BORRADOR",
        fechaCorte: new Date(),
        porcentajeIndirectos,
        porcentajeFinanciamiento,
        porcentajeUtilidad,
        porcentajeCargosAdicionales,
        costoDirecto,
        indirectos,
        financiamiento,
        utilidad,
        cargosAdicionales,
        subtotal,
        totalPresupuesto: subtotal,
      },
      create: {
        proyectoId,
        version: versionPresupuesto,
        nombre: `Presupuesto ${proyecto.codigo} v${versionPresupuesto}`,
        porcentajeIndirectos,
        porcentajeFinanciamiento,
        porcentajeUtilidad,
        porcentajeCargosAdicionales,
        costoDirecto,
        indirectos,
        financiamiento,
        utilidad,
        cargosAdicionales,
        subtotal,
        totalPresupuesto: subtotal,
      },
    });

    await tx.presupuestoConceptoCT.deleteMany({
      where: { presupuestoId: presupuesto.id },
    });

    await tx.presupuestoConceptoCT.createMany({
      data: conceptosPresupuesto.map((item, index) => ({
        presupuestoId: presupuesto.id,
        conceptoId: item.conceptoId,
        tarjetaAPUId: item.tarjetaAPUId,
        partida: item.partida,
        clave: item.clave,
        descripcion: item.descripcion,
        unidad: item.unidad,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        importe: item.importe,
        orden: index + 1,
      })),
    });

    const explosion = await tx.explosionInsumosProyecto.upsert({
      where: {
        proyectoId_version: {
          proyectoId,
          version: versionExplosion,
        },
      },
      update: {
        estado: "BORRADOR",
        fechaCorte: new Date(),
        totalMateriales: totales.MATERIAL,
        totalManoObra: totales.MANO_OBRA,
        totalEquipo: totales.EQUIPO,
        totalHerramienta: totales.HERRAMIENTA,
        totalSubcontratos: totales.SUBCONTRATO,
        totalAuxiliares: totales.AUXILIAR,
        totalGeneral: totalExplosion,
      },
      create: {
        proyectoId,
        version: versionExplosion,
        totalMateriales: totales.MATERIAL,
        totalManoObra: totales.MANO_OBRA,
        totalEquipo: totales.EQUIPO,
        totalHerramienta: totales.HERRAMIENTA,
        totalSubcontratos: totales.SUBCONTRATO,
        totalAuxiliares: totales.AUXILIAR,
        totalGeneral: totalExplosion,
      },
    });

    await tx.explosionInsumoDetalle.deleteMany({
      where: { explosionId: explosion.id },
    });

    if (detallesExplosion.size > 0) {
      await tx.explosionInsumoDetalle.createMany({
        data: Array.from(detallesExplosion.values()).map((detalle) => ({
          explosionId: explosion.id,
          insumoId: detalle.insumoId,
          tipo: detalle.tipo,
          unidad: detalle.unidad,
          cantidadTotal: detalle.cantidadTotal,
          precioReferencia: detalle.precioReferencia,
          importeTotal: detalle.importeTotal,
          fuenteCalculo: "Generadores aprobados + Tarjeta APU aprobada",
        })),
      });
    }
  });

  revalidatePath("/panel/certeza-tecnica/generadores");
  revalidatePath("/panel/certeza-tecnica/apu");
  revalidatePath("/panel/certeza-tecnica/explosion-insumos");
  revalidatePath("/panel/certeza-tecnica/presupuestos");

  return {
    conceptos: conceptosPresupuesto.length,
    insumos: detallesExplosion.size,
    costoDirecto,
    totalPresupuesto: subtotal,
  };
}
