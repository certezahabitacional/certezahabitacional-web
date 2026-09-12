"use server";

import { randomUUID } from "node:crypto";
import { Prisma, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";

const TIPOS = new Set(["ARQUITECTONICO","FACHADAS","HIDRAULICA","SANITARIA","GAS","ELECTRICA","PUERTAS_VENTANAS","ACABADOS","AIRE_ACONDICIONADO","VOZ_DATOS","OTROS"]);
const BASE: Record<string,string[]> = {
  ARQUITECTONICO:["Distribución y correspondencia de espacios","Dimensiones y circulaciones","Muros, vanos y niveles"],
  FACHADAS:["Correspondencia de fachadas","Alineamientos, desplomes y remates","Sellos y encuentros exteriores"],
  HIDRAULICA:["Alimentación y distribución de agua","Válvulas, conexiones y fugas","Presión y funcionamiento de muebles"],
  SANITARIA:["Descargas y pendientes","Registros y ventilaciones","Pruebas de funcionamiento y fugas"],
  GAS:["Tuberías, válvulas y conexiones","Ubicación y ventilación","Prueba de hermeticidad aplicable"],
  ELECTRICA:["Tablero, protecciones y circuitos","Contactos, apagadores y polaridad","Canalizaciones y puesta a tierra"],
  PUERTAS_VENTANAS:["Alineación, plomo y nivel","Apertura, cierre y herrajes","Sellos, vidrios y acabados"],
  ACABADOS:["Pisos y piezas huecas","Muros, plafones y pintura","Juntas, boquillas y remates"],
  AIRE_ACONDICIONADO:["Equipos y ubicación","Drenajes y alimentación","Operación y distribución"],
  VOZ_DATOS:["Salidas y canalizaciones","Ubicación contra proyecto","Identificación y terminaciones"],
  OTROS:["Conceptos particulares del proyecto"],
};
const CRITERIOS_ESTANDAR: Array<[string,string,string]> = [
  ["Exterior","Fachadas, desplomes, fisuras y sellos","Revisar continuidad, acabados, encuentros y signos de ingreso de agua."],
  ["Azotea / cubierta","Pendientes, impermeabilización y bajadas","Revisar pendientes, puntos bajos, sellos, pretiles y desalojo pluvial."],
  ["Interiores","Muros, plafones y acabados","Revisar fisuras, humedades, planeidad, pintura y remates."],
  ["Pisos","Nivel, piezas huecas y juntas","Auscultar piezas cerámicas, revisar desniveles, juntas, boquillas y remates."],
  ["Puertas y ventanas","Operación, herrajes y sellos","Verificar plomo, nivel, apertura, cierre, sellos, vidrios y fijaciones."],
  ["Instalación hidráulica","Presión, fugas y operación","Revisar alimentación, válvulas, conexiones, muebles y evidencia de fugas."],
  ["Instalación sanitaria","Descargas, pendientes y sellos","Probar funcionamiento, olores, fugas, ventilaciones y registros accesibles."],
  ["Instalación eléctrica","Tablero, protecciones y salidas","Revisar protecciones, polaridad, contactos, apagadores, tierra y canalizaciones visibles."],
  ["Instalación de gas","Tubería, válvulas y ventilación","Revisar ubicación, conexiones, fijaciones y condiciones de seguridad aplicables."],
  ["Aire acondicionado","Operación, drenajes y alimentación","Verificar equipos, drenajes, alimentación y distribución cuando exista."],
];

function t(fd:FormData,k:string){return String(fd.get(k)??"").trim()}
function volver(id:string,tipo:"ok"|"error",m:string):never{redirect(`/panel/inspecciones/${id}/preparacion?${tipo}=${encodeURIComponent(m)}`)}
async function actor(){const s=await auth();if(!s?.user?.id)redirect("/login");const u=await prisma.usuario.findUnique({where:{id:s.user.id},select:{id:true,rol:true,activo:true}});const permitido=u?.rol===RolUsuario.DIRECTOR||u?.rol===RolUsuario.ADMINISTRADOR||u?.rol===RolUsuario.GERENTE;if(!u?.activo||!permitido)redirect("/acceso");return u}
async function tablas(){const r=await prisma.$queryRaw<Array<{d:string|null;g:string|null}>>`SELECT to_regclass('public."DocumentoProyectoInspeccion"')::text d,to_regclass('public."GuiaInspeccionItem"')::text g`;return Boolean(r[0]?.d&&r[0]?.g)}
function extraerAreas(datos: Prisma.JsonValue | null): string[] {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return [];
  const obj=datos as Prisma.JsonObject;
  const claves=["areas","areasIncluidas","areasContratadas","alcance","espacios"];
  const halladas:string[]=[];
  for(const clave of claves){const valor=obj[clave];if(Array.isArray(valor)){for(const item of valor){if(typeof item==="string"&&item.trim())halladas.push(item.trim());else if(item&&typeof item==="object"&&!Array.isArray(item)){const nombre=(item as Prisma.JsonObject).nombre??(item as Prisma.JsonObject).area??(item as Prisma.JsonObject).descripcion;if(typeof nombre==="string"&&nombre.trim())halladas.push(nombre.trim());}}}}
  return [...new Set(halladas)];
}

export async function generarGuiaBase(fd:FormData){
  const u=await actor(),id=t(fd,"inspeccionId");
  if(!(await tablas()))volver(id,"error","La preparación técnica aún no está habilitada en esta base de datos.");
  const ins=await prisma.inspeccion.findUnique({where:{id},select:{id:true,estado:true,tipoInmueble:true,cotizacion:{select:{versiones:{orderBy:{version:"desc"},take:1,select:{datos:true}}}}}});
  if(!ins)volver(id,"error","La inspección no existe.");
  if(ins.estado!=="PROGRAMADA")volver(id,"error","La guía base debe definirse antes de iniciar la inspección.");
  const areasCotizacion=extraerAreas(ins.cotizacion?.versiones[0]?.datos??null);
  const existentes=await prisma.$queryRaw<Array<{n:number}>>`SELECT COUNT(*)::int n FROM "GuiaInspeccionItem" WHERE "inspeccionId"=${id} AND "origen" IN ('COTIZACION','ESTANDAR')`;
  if(Number(existentes[0]?.n??0)>0)volver(id,"ok","La guía base ya fue generada para esta inspección.");
  await prisma.$transaction(async tx=>{
    let orden=1000;
    for(const area of areasCotizacion){await tx.$executeRaw`INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","area","concepto","especificacion","orden","creadoPorId") VALUES (${randomUUID()},${id},'COTIZACION',${area},'Cobertura integral del área contratada','Revisar acabados, instalaciones visibles, operación, daños, humedad, seguridad y cualquier condición anómala aplicable.',${orden++},${u.id})`;}
    for(const [area,concepto,especificacion] of CRITERIOS_ESTANDAR){await tx.$executeRaw`INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","area","concepto","especificacion","orden","creadoPorId") VALUES (${randomUUID()},${id},'ESTANDAR',${area},${concepto},${especificacion},${orden++},${u.id})`;}
    if(areasCotizacion.length===0){await tx.$executeRaw`INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","area","concepto","especificacion","orden","creadoPorId") VALUES (${randomUUID()},${id},'ESTANDAR',${ins.tipoInmueble},'Recorrido completo del inmueble','Al no existir áreas estructuradas en la cotización, realizar recorrido completo y agregar manualmente cualquier área particular antes de campo.',${orden++},${u.id})`;}
  });
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"GuiaInspeccionItem",inspeccionId:id,usuarioId:u.id,descripcion:`${u.rol} generó la guía base con ${areasCotizacion.length} área(s) de cotización y criterios estándar.`});
  revalidatePath(`/panel/inspecciones/${id}/preparacion`);volver(id,"ok","Guía base generada con cobertura de cotización y criterios estándar.");
}

export async function subirProyecto(fd:FormData){const u=await actor(),id=t(fd,"inspeccionId"),tipo=t(fd,"tipo"),archivo=fd.get("archivo");if(!(await tablas()))volver(id,"error","La preparación técnica requiere aplicar primero su migración en preproducción.");if(!TIPOS.has(tipo))volver(id,"error","Tipo de proyecto inválido.");if(!(archivo instanceof File)||archivo.size===0)volver(id,"error","Selecciona un PDF.");if(archivo.type!=="application/pdf")volver(id,"error","Solo se permiten archivos PDF.");if(archivo.size>25*1024*1024)volver(id,"error","El PDF no puede exceder 25 MB.");const ins=await prisma.inspeccion.findUnique({where:{id},select:{id:true,estado:true}});if(!ins)volver(id,"error","La inspección no existe.");if(ins.estado!=="PROGRAMADA")volver(id,"error","Los proyectos deben cargarse antes de iniciar la inspección.");const docId=randomUUID(),ruta=`${id}/proyectos/${tipo.toLowerCase()}-${docId}.pdf`,bucket=process.env.SUPABASE_PROYECTOS_BUCKET||"proyectos-inspeccion",supabase=obtenerSupabaseAdmin();const bytes=Buffer.from(await archivo.arrayBuffer());const {error}=await supabase.storage.from(bucket).upload(ruta,bytes,{contentType:"application/pdf",upsert:false});if(error)volver(id,"error",`No fue posible guardar el PDF: ${error.message}`);try{await prisma.$transaction(async tx=>{await tx.$executeRaw`INSERT INTO "DocumentoProyectoInspeccion" ("id","inspeccionId","tipo","nombreOriginal","bucket","ruta","mimeType","bytes","subidoPorId") VALUES (${docId},${id},${tipo},${archivo.name},${bucket},${ruta},'application/pdf',${archivo.size},${u.id})`;const existentes=await tx.$queryRaw<Array<{n:number}>>`SELECT COUNT(*)::int n FROM "GuiaInspeccionItem" WHERE "inspeccionId"=${id} AND "tipoProyecto"=${tipo}`;if(Number(existentes[0]?.n??0)===0){let orden=100;for(const concepto of BASE[tipo]??BASE.OTROS){await tx.$executeRaw`INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","tipoProyecto","area","concepto","orden","creadoPorId") VALUES (${randomUUID()},${id},'PROYECTO',${tipo},${tipo.replaceAll('_',' ')},${concepto},${orden++},${u.id})`;}}});}catch(e){await supabase.storage.from(bucket).remove([ruta]);throw e}await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"DocumentoProyectoInspeccion",entidadId:docId,inspeccionId:id,usuarioId:u.id,descripcion:`${u.rol} cargó proyecto ${tipo}: ${archivo.name}.`});revalidatePath(`/panel/inspecciones/${id}/preparacion`);volver(id,"ok","Proyecto cargado y agregado a la guía técnica.")}
export async function agregarItemManual(fd:FormData){const u=await actor(),id=t(fd,"inspeccionId"),area=t(fd,"area"),concepto=t(fd,"concepto"),especificacion=t(fd,"especificacion")||null;if(!(await tablas()))volver(id,"error","La preparación técnica aún no está habilitada en esta base de datos.");if(!area||!concepto)volver(id,"error","Área y concepto son obligatorios.");await prisma.$executeRaw`INSERT INTO "GuiaInspeccionItem" ("id","inspeccionId","origen","area","concepto","especificacion","orden","creadoPorId") VALUES (${randomUUID()},${id},'MANUAL',${area},${concepto},${especificacion},9999,${u.id})`;await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"GuiaInspeccionItem",inspeccionId:id,usuarioId:u.id,descripcion:`${u.rol} agregó manualmente a la guía: ${area} / ${concepto}.`});revalidatePath(`/panel/inspecciones/${id}/preparacion`);volver(id,"ok","Concepto agregado a la guía.")}
export async function cambiarEstadoItemGuia(fd:FormData){const u=await actor(),id=t(fd,"inspeccionId"),itemId=t(fd,"itemId"),completado=t(fd,"completado")==="true";if(!(await tablas()))volver(id,"error","La guía técnica aún no está habilitada.");const ins=await prisma.inspeccion.findUnique({where:{id},select:{estado:true}});if(!ins)volver(id,"error","La inspección no existe.");if(ins.estado==="FINALIZADA"||ins.estado==="CANCELADA")volver(id,"error","El expediente ya no admite cambios en la guía.");await prisma.$executeRaw`UPDATE "GuiaInspeccionItem" SET "completado"=${completado},"actualizadoEn"=NOW() WHERE "id"=${itemId} AND "inspeccionId"=${id}`;await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"GuiaInspeccionItem",entidadId:itemId,inspeccionId:id,usuarioId:u.id,descripcion:`${u.rol} marcó un concepto de la guía como ${completado?'completado':'pendiente'}.`});revalidatePath(`/panel/inspecciones/${id}/preparacion`);volver(id,"ok",completado?"Concepto marcado como revisado.":"Concepto devuelto a pendiente.")}
