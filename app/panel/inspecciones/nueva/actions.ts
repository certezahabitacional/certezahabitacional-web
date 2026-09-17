"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { establecerAsignacionInspeccion } from "@/lib/asignaciones-inspeccion";
import { registrarAuditoria } from "@/lib/auditoria";
import { validarLiberacionCampoDesdeCaja } from "@/lib/caja-validaciones";
import { prisma } from "@/lib/prisma";
import { validarCotizacionParaNuevaInspeccion } from "./validacion-cotizacion";

function texto(formData:FormData,campo:string){return String(formData.get(campo)??"").trim();}
function decimalANumero(valor:unknown){if(valor===null||valor===undefined||valor==="")return null;const n=Number(valor);return Number.isFinite(n)?n:null;}
function errorNuevaInspeccion(mensaje:string,antecedenteId?:string):never{const p=new URLSearchParams({error:mensaje});if(antecedenteId)p.set("antecedenteId",antecedenteId);redirect(`/panel/inspecciones/nueva?${p.toString()}`);}
const ROLES_CREACION=new Set<RolUsuario>([RolUsuario.DIRECTOR,RolUsuario.ADMINISTRADOR]);

async function validarUsuarioAsignable(id:string,rol:RolUsuario,zonaId:string,etiqueta:string){
  if(!id)return null;
  const u=await prisma.usuario.findFirst({where:{id,rol,activo:true,zonaId},select:{id:true,nombre:true}});
  if(!u)errorNuevaInspeccion(`${etiqueta} seleccionado no está activo o no pertenece a la zona.`);
  return u;
}

export async function crearInspeccion(formData:FormData){
  const usuarioActual=await obtenerUsuarioConAlcanceZona("/panel/inspecciones/nueva");
  if(!ROLES_CREACION.has(usuarioActual.rol))redirect("/acceso");

  const antecedenteId=texto(formData,"antecedenteId"),cotizacionId=texto(formData,"cotizacionId"),clienteId=texto(formData,"clienteId"),inmuebleId=texto(formData,"inmuebleId"),inspectorIdFormulario=texto(formData,"inspectorId"),gerenteIdFormulario=texto(formData,"gerenteId"),coordinadorIdFormulario=texto(formData,"coordinadorId"),plantillaIdFormulario=texto(formData,"plantillaId"),zonaIdFormulario=texto(formData,"zonaId"),fechaProgramadaTexto=texto(formData,"fechaProgramada"),observacionesFormulario=texto(formData,"observaciones"),accion=texto(formData,"accion")||"agendar";
  const iniciarAhora=accion==="iniciar";

  if(iniciarAhora&&usuarioActual.rol!==RolUsuario.DIRECTOR)errorNuevaInspeccion("Solo Dirección puede iniciar una inspección desde Agendar Inspección.",antecedenteId||undefined);
  if(!cotizacionId)errorNuevaInspeccion("Selecciona la cotización autorizada que origina esta inspección.",antecedenteId||undefined);
  if(!clienteId||!inmuebleId)errorNuevaInspeccion("La cotización debe identificar cliente e inmueble.",antecedenteId||undefined);

  const validacion=await validarCotizacionParaNuevaInspeccion({cotizacionId,clienteId,inmuebleId});
  if(!validacion.ok)errorNuevaInspeccion(validacion.error,antecedenteId||undefined);
  if(iniciarAhora){const liberacion=await validarLiberacionCampoDesdeCaja(cotizacionId);if(!liberacion.ok)errorNuevaInspeccion(liberacion.error,antecedenteId||undefined);}

  const existente=validacion.modo==="RETOMAR"?validacion.inspeccionExistente:null;
  const plantillaId=plantillaIdFormulario||existente?.plantillaId||"";
  const zonaId=zonaIdFormulario||existente?.zonaId||"";
  if(!plantillaId||!zonaId)errorNuevaInspeccion("Completa plantilla y zona para agendar la inspección.",antecedenteId||undefined);
  if(!puedeAccederZona(usuarioActual,zonaId))errorNuevaInspeccion("No puedes crear o reagendar una inspección en una zona distinta a la asignada a tu usuario.",antecedenteId||undefined);

  const cotizacionZona=await prisma.cotizacion.findUnique({where:{id:cotizacionId},select:{zonaId:true}});
  if(!cotizacionZona?.zonaId||cotizacionZona.zonaId!==zonaId)errorNuevaInspeccion("La zona de la inspección debe coincidir con la zona de la cotización.",antecedenteId||undefined);

  const [plantilla,zona,inmueble]=await Promise.all([
    prisma.plantillaInspeccion.findFirst({where:{id:plantillaId,activa:true},select:{id:true,tipoServicio:true,requiereGerenteZona:true,requiereCoordinador:true}}),
    prisma.zona.findFirst({where:{id:zonaId,activa:true},select:{id:true,nombre:true,zonaHoraria:true}}),
    prisma.inmueble.findUnique({where:{id:inmuebleId},select:{id:true,clienteId:true,tipo:true,direccion:true,ciudad:true,superficieConstruccionM2:true}}),
  ]);
  if(!plantilla)errorNuevaInspeccion("La plantilla seleccionada no existe o está inactiva.",antecedenteId||undefined);
  if(!zona)errorNuevaInspeccion("La zona seleccionada no existe o está inactiva.",antecedenteId||undefined);
  if(!inmueble||inmueble.clienteId!==clienteId)errorNuevaInspeccion("El inmueble no corresponde al cliente.",antecedenteId||undefined);

  const inspectorId=inspectorIdFormulario||existente?.inspectorId||"";
  const gerenteId=gerenteIdFormulario||existente?.asignaciones.gerenteId||"";
  const coordinadorId=coordinadorIdFormulario||existente?.asignaciones.coordinadorId||"";

  let inspectorSeleccionado:{id:string;usuario:{id:string;nombre:string;zonaId:string|null}}|null=null;
  if(inspectorId){
    inspectorSeleccionado=await prisma.inspector.findFirst({where:{id:inspectorId,activo:true,usuario:{activo:true,rol:RolUsuario.INSPECTOR,zonaId:zona.id}},select:{id:true,usuario:{select:{id:true,nombre:true,zonaId:true}}}});
    if(!inspectorSeleccionado)errorNuevaInspeccion("El Inspector seleccionado no está disponible en esta zona.",antecedenteId||undefined);
  }
  const gerente=await validarUsuarioAsignable(gerenteId,RolUsuario.GERENTE,zona.id,"El Gerente");
  const coordinador=await validarUsuarioAsignable(coordinadorId,RolUsuario.COORDINADOR,zona.id,"El Coordinador");

  let fechaProgramada=existente?.fechaProgramada??null;
  if(fechaProgramadaTexto){fechaProgramada=fromZonedTime(fechaProgramadaTexto,zona.zonaHoraria);if(Number.isNaN(fechaProgramada.getTime()))errorNuevaInspeccion("Selecciona una fecha y hora válidas.",antecedenteId||undefined);}
  if(!fechaProgramada)errorNuevaInspeccion("Selecciona una fecha y hora para agendar la inspección.",antecedenteId||undefined);

  if(existente){
    if(antecedenteId&&existente.inspeccionAnteriorId!==antecedenteId)errorNuevaInspeccion("La cotización seleccionada pertenece a otra programación.",antecedenteId);
    const inspeccion=await prisma.inspeccion.update({where:{id:existente.id},data:{plantillaId:plantilla.id,requiereGerenteZona:plantilla.requiereGerenteZona,requiereCoordinador:plantilla.requiereCoordinador,zonaId:zona.id,inspectorId:inspectorSeleccionado?.id??null,agendadaPorId:usuarioActual.id,tipoServicio:plantilla.tipoServicio,tipoInmueble:inmueble.tipo,direccion:inmueble.direccion,ciudad:inmueble.ciudad,superficieM2:decimalANumero(inmueble.superficieConstruccionM2),fechaProgramada,zonaHoraria:zona.zonaHoraria,observaciones:observacionesFormulario||existente.observaciones||null,inicioLiberadoSinPago:validacion.cotizacion.excepcionInicio},select:{id:true,folio:true,numeroInspeccion:true}});
    await Promise.all([
      establecerAsignacionInspeccion(inspeccion.id,"GERENTE",gerente?.id??null),
      establecerAsignacionInspeccion(inspeccion.id,"COORDINADOR",coordinador?.id??null),
      establecerAsignacionInspeccion(inspeccion.id,"INSPECTOR",inspectorSeleccionado?.usuario.id??null),
    ]);
    const responsable=inspectorSeleccionado?.usuario.nombre??"sin asignar";
    await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"Inspeccion",entidadId:inspeccion.id,inspeccionId:inspeccion.id,usuarioId:usuarioActual.id,descripcion:`${usuarioActual.rol} retomó/reagendó ${inspeccion.folio} V${inspeccion.numeroInspeccion} en ${zona.nombre}. Responsable de campo: ${responsable}; Coordinador ${coordinador?.nombre??"sin asignar"}; Gerente ${gerente?.nombre??"sin asignar"}.`});
    revalidatePath("/panel");revalidatePath("/panel/agenda");revalidatePath("/panel/inspecciones");revalidatePath(`/panel/inspecciones/${inspeccion.id}`);revalidatePath("/panel/caja");
    if(iniciarAhora)redirect(`/panel/inspecciones/${inspeccion.id}/revision-inicial`);
    redirect(`/panel/inspecciones/${inspeccion.id}?ok=${encodeURIComponent("Inspección actualizada/reagendada correctamente.")}`);
  }

  let numeroInspeccion=1;let inspeccionAnterior:{id:string;folio:string;numeroInspeccion:number}|null=null;
  if(antecedenteId){
    const a=await prisma.inspeccion.findUnique({where:{id:antecedenteId},select:{id:true,folio:true,estado:true,clienteId:true,inmuebleId:true,numeroInspeccion:true,zonaId:true}});
    if(!a)errorNuevaInspeccion("La inspección antecedente no existe.");
    if(!puedeAccederZona(usuarioActual,a.zonaId))errorNuevaInspeccion("La inspección antecedente pertenece a otra zona.");
    if(a.estado!==EstadoInspeccion.FINALIZADA)errorNuevaInspeccion("Solo una inspección FINALIZADA puede generar seguimiento.",a.id);
    if(a.clienteId!==clienteId||a.inmuebleId!==inmuebleId)errorNuevaInspeccion("La nueva cotización debe corresponder al mismo cliente e inmueble del antecedente.",a.id);
    if(a.zonaId!==zona.id)errorNuevaInspeccion("El seguimiento debe conservar la misma zona del antecedente.",a.id);
    const seguimientoExistente=await prisma.inspeccion.findFirst({where:{inspeccionAnteriorId:a.id},select:{id:true,folio:true,numeroInspeccion:true}});
    if(seguimientoExistente)redirect(`/panel/inspecciones/${seguimientoExistente.id}?ok=${encodeURIComponent(`Ya existe la inspección de seguimiento V${seguimientoExistente.numeroInspeccion} (${seguimientoExistente.folio}).`)}`);
    inspeccionAnterior={id:a.id,folio:a.folio,numeroInspeccion:a.numeroInspeccion};numeroInspeccion=a.numeroInspeccion+1;
  }else{
    const max=await prisma.inspeccion.aggregate({where:{inmuebleId},_max:{numeroInspeccion:true}});numeroInspeccion=(max._max.numeroInspeccion??0)+1;
  }

  const year=fechaProgramada.getFullYear(),inicioYear=new Date(Date.UTC(year,0,1)),inicioSiguienteYear=new Date(Date.UTC(year+1,0,1));
  let consecutivo=(await prisma.inspeccion.count({where:{creadoEn:{gte:inicioYear,lt:inicioSiguienteYear}}}))+1;
  let folio=`CH-${year}-${String(consecutivo).padStart(4,"0")}`;
  while(await prisma.inspeccion.findUnique({where:{folio},select:{id:true}})){consecutivo++;folio=`CH-${year}-${String(consecutivo).padStart(4,"0")}`;}

  const inspeccion=await prisma.inspeccion.create({data:{folio,plantillaId:plantilla.id,requiereGerenteZona:plantilla.requiereGerenteZona,requiereCoordinador:plantilla.requiereCoordinador,zonaId:zona.id,clienteId,inmuebleId,cotizacionId,numeroInspeccion,inspeccionAnteriorId:inspeccionAnterior?.id??null,inspectorId:inspectorSeleccionado?.id??null,agendadaPorId:usuarioActual.id,tipoServicio:plantilla.tipoServicio,tipoInmueble:inmueble.tipo,direccion:inmueble.direccion,ciudad:inmueble.ciudad,superficieM2:decimalANumero(inmueble.superficieConstruccionM2),fechaProgramada,zonaHoraria:zona.zonaHoraria,estado:EstadoInspeccion.PROGRAMADA,observaciones:observacionesFormulario||null,inicioLiberadoSinPago:validacion.cotizacion.excepcionInicio},select:{id:true,folio:true,numeroInspeccion:true}});
  await Promise.all([
    establecerAsignacionInspeccion(inspeccion.id,"GERENTE",gerente?.id??null),
    establecerAsignacionInspeccion(inspeccion.id,"COORDINADOR",coordinador?.id??null),
    establecerAsignacionInspeccion(inspeccion.id,"INSPECTOR",inspectorSeleccionado?.usuario.id??null),
  ]);
  const responsable=inspectorSeleccionado?.usuario.nombre??(iniciarAhora&&usuarioActual.rol===RolUsuario.DIRECTOR?"Director por ausencia":"sin asignar");
  await registrarAuditoria({tipo:TipoEvento.CREAR,entidad:"Inspeccion",entidadId:inspeccion.id,inspeccionId:inspeccion.id,usuarioId:usuarioActual.id,descripcion:`${usuarioActual.rol} ${iniciarAhora?"agendó y abrió revisión final":"agendó"} ${inspeccion.folio} V${inspeccion.numeroInspeccion} en ${zona.nombre}. Responsable de campo: ${responsable}; Coordinador ${coordinador?.nombre??"sin asignar"}; Gerente ${gerente?.nombre??"sin asignar"}.`});
  revalidatePath("/panel");revalidatePath("/panel/agenda");revalidatePath("/panel/inspecciones");revalidatePath("/panel/caja");revalidatePath("/portal/inspecciones");
  if(iniciarAhora)redirect(`/panel/inspecciones/${inspeccion.id}/revision-inicial`);
  redirect(`/panel/inspecciones/${inspeccion.id}?ok=${encodeURIComponent("Inspección agendada correctamente.")}`);
}
