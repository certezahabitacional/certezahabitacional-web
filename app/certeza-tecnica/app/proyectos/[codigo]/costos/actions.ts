"use server";

import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";
import { recalcularCostosProyecto } from "@/app/panel/certeza-tecnica/costos/actions";

function toJson(value:unknown):Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function hashPayload(payload:unknown){
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function refresh(codigo:string){
  const code=codigo.toLowerCase();
  revalidatePath(`/certeza-tecnica/app/proyectos/${code}/costos`);
  revalidatePath(`/certeza-tecnica/app/proyectos/${code}/tablero`);
  revalidatePath(`/project-manager/panel/proyectos/${code}`);
  revalidatePath(`/project-manager/panel/proyectos/${code}/linea-base`);
}

export async function inicializarCertezaCost(codigo:string){
  const access=await requireProjectWriteAccess(codigo);
  const p=access.proyecto;

  const existente=await prisma.proyectoGeneradores.findUnique({where:{codigo:p.codigo}});
  if(!existente){
    await prisma.proyectoGeneradores.create({
      data:{
        codigo:p.codigo,
        nombre:p.nombre,
        clienteNombre:p.cliente || "Cliente por definir",
        ubicacion:p.ubicacion || null,
        alcance:p.descripcion || "Proyecto vinculado desde Certeza Técnica 360",
        observaciones:"Vinculado automáticamente con Certeza Project Manager por código de proyecto.",
        creadoPorId:access.userId,
        responsableId:access.userId,
      },
    });
  }
  refresh(p.codigo);
}

export async function recalcularCertezaCostVinculado(codigo:string){
  const access=await requireProjectWriteAccess(codigo);
  const cost=await prisma.proyectoGeneradores.findUnique({where:{codigo:access.proyecto.codigo},select:{id:true}});
  if(!cost) throw new Error("Primero debe inicializar Certeza Cost para este proyecto.");

  await recalcularCostosProyecto(cost.id);
  refresh(access.proyecto.codigo);
}

export async function establecerPresupuestoComoLineaBase(codigo:string){
  const access=await requireProjectWriteAccess(codigo);
  const p=access.proyecto;

  const cost=await prisma.proyectoGeneradores.findUnique({
    where:{codigo:p.codigo},
    include:{
      presupuestos:{
        include:{conceptos:{orderBy:{orden:"asc"}}},
        orderBy:{version:"desc"},
        take:1,
      },
    },
  });

  if(!cost) throw new Error("Certeza Cost no está inicializado para este proyecto.");
  const budget=cost.presupuestos[0];
  if(!budget) throw new Error("No existe un presupuesto para establecer como línea base.");
  if(budget.conceptos.length===0) throw new Error("El presupuesto no contiene conceptos.");

  const partidasMap=new Map<string,{partida:string;importe:number;conceptos:Array<Record<string,unknown>>}>();
  for(const item of budget.conceptos){
    const partida=(item.partida || "SIN PARTIDA").trim() || "SIN PARTIDA";
    const row={
      id:item.id,
      orden:item.orden,
      partida,
      subpartida:item.subpartida,
      clave:item.clave,
      descripcion:item.descripcion,
      unidad:item.unidad,
      cantidad:Number(item.cantidad),
      precioUnitario:Number(item.precioUnitario),
      importe:Number(item.importe),
      conceptoId:item.conceptoId,
      tarjetaAPUId:item.tarjetaAPUId,
    };
    const current=partidasMap.get(partida) ?? {partida,importe:0,conceptos:[]};
    current.importe+=Number(item.importe);
    current.conceptos.push(row);
    partidasMap.set(partida,current);
  }

  const snapshot={
    fuente:"CERTEZA_COST",
    codigoProyecto:p.codigo,
    proyectoCostId:cost.id,
    presupuestoId:budget.id,
    version:budget.version,
    estado:"LINEA_BASE",
    fechaCorte:budget.fechaCorte.toISOString(),
    aprobadoEn:new Date().toISOString(),
    aprobadoPorId:access.userId,
    costoDirecto:Number(budget.costoDirecto),
    indirectos:Number(budget.indirectos),
    financiamiento:Number(budget.financiamiento),
    utilidad:Number(budget.utilidad),
    cargosAdicionales:Number(budget.cargosAdicionales),
    impuestos:Number(budget.impuestos),
    subtotal:Number(budget.subtotal),
    totalPresupuesto:Number(budget.totalPresupuesto),
    porcentajes:{
      indirectos:Number(budget.porcentajeIndirectos),
      financiamiento:Number(budget.porcentajeFinanciamiento),
      utilidad:Number(budget.porcentajeUtilidad),
      cargosAdicionales:Number(budget.porcentajeCargosAdicionales),
    },
    partidas:Array.from(partidasMap.values()),
    conceptos:budget.conceptos.map(item=>({
      id:item.id,
      orden:item.orden,
      partida:item.partida,
      subpartida:item.subpartida,
      clave:item.clave,
      descripcion:item.descripcion,
      unidad:item.unidad,
      cantidad:Number(item.cantidad),
      precioUnitario:Number(item.precioUnitario),
      importe:Number(item.importe),
      conceptoId:item.conceptoId,
      tarjetaAPUId:item.tarjetaAPUId,
    })),
  };

  await prisma.$transaction(async tx=>{
    await tx.presupuestoProyectoCT.updateMany({
      where:{proyectoId:cost.id,estado:"LINEA_BASE",id:{not:budget.id}},
      data:{estado:"CERRADO"},
    });
    await tx.presupuestoProyectoCT.update({
      where:{id:budget.id},
      data:{estado:"LINEA_BASE"},
    });

    const actual=await tx.lineaBasePM.findUnique({where:{proyectoId:p.id}});
    const indicadoresPrevios=(actual?.indicadoresBase && typeof actual.indicadoresBase==="object" && !Array.isArray(actual.indicadoresBase))
      ? actual.indicadoresBase as Record<string,unknown>
      : {};

    const indicadores=toJson({
      ...indicadoresPrevios,
      costoOriginal:Number(budget.totalPresupuesto),
      presupuestoCertezaCost:Number(budget.totalPresupuesto),
      versionPresupuestoCertezaCost:budget.version,
      presupuestoIdCertezaCost:budget.id,
      fechaBaseCostos:new Date().toISOString(),
    });

    if(actual){
      await tx.lineaBasePM.update({
        where:{proyectoId:p.id},
        data:{
          presupuesto:toJson(snapshot),
          indicadoresBase:indicadores,
          hashReferencia:hashPayload({
            alcance:actual.alcance,
            presupuesto:snapshot,
            programa:actual.programa,
            estructuraFisica:actual.estructuraFisica,
            contratos:actual.contratos,
          }),
        },
      });
    }else{
      await tx.lineaBasePM.create({
        data:{
          proyectoId:p.id,
          version:1,
          estado:"BORRADOR",
          presupuesto:toJson(snapshot),
          indicadoresBase:indicadores,
          cambiosBase:toJson([]),
          hashReferencia:hashPayload({presupuesto:snapshot}),
        },
      });
    }

    await tx.proyectoPM.update({
      where:{id:p.id},
      data:{presupuesto:Number(budget.totalPresupuesto)},
    });
  });

  refresh(p.codigo);
}
