"use server";

import { EstadoCotizacion, EstadoInspeccion, Prisma, RolUsuario, TipoCliente, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) { return String(formData.get(campo) ?? "").trim(); }
async function gestor() {
  const session = await auth(); if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, nombre: true, rol: true, activo: true } });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) redirect("/acceso");
  return usuario;
}
function volver(tipo: "ok" | "error", mensaje: string): never { redirect(`/panel/cotizaciones?${tipo}=${encodeURIComponent(mensaje)}`); }
function estaVencida(vigenciaHasta: Date | null) { return Boolean(vigenciaHasta && vigenciaHasta < new Date()); }
function objeto(v: Prisma.JsonValue | undefined): Record<string, any> | null { return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : null; }

export async function marcarListaParaCliente(formData: FormData) {
  const usuario = await gestor(); const id = texto(formData, "id");
  const c = await prisma.cotizacion.findUnique({ where: { id }, select: { id:true,folio:true,estado:true,vigenciaHasta:true,total:true,inmuebleId:true,cliente:{select:{usuarioId:true}},versiones:{orderBy:{version:"desc"},take:1,select:{id:true}} } });
  if (!c) volver("error","La cotización no existe.");
  if (c.estado !== EstadoCotizacion.BORRADOR) volver("error","Solo una pre-cotización en borrador puede quedar lista para aceptación del cliente.");
  if (!c.cliente.usuarioId) volver("error","Asigna primero acceso al cliente para que pueda aceptar la pre-cotización en el portal.");
  if (!c.inmuebleId || Number(c.total)<=0 || !c.versiones[0]) volver("error","La pre-cotización no está completa.");
  if (estaVencida(c.vigenciaHasta)) volver("error","La pre-cotización ya está vencida. Actualiza la vigencia.");
  await prisma.cotizacion.update({where:{id},data:{estado:EstadoCotizacion.ENVIADA}});
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"Cotizacion",entidadId:id,usuarioId:usuario.id,descripcion:`${usuario.rol} dejó la pre-cotización ${c.folio} lista para aceptación del cliente.`});
  revalidatePath("/panel/pre-cotizaciones"); revalidatePath("/portal/cotizaciones"); volver("ok","Pre-cotización lista para aceptación del cliente.");
}

export async function aceptarEnRepresentacionDelCliente(formData: FormData) {
  const usuario=await gestor(); const id=texto(formData,"id"); const motivo=texto(formData,"motivo"); if(!motivo) volver("error","La aceptación por excepción requiere registrar el motivo.");
  const c=await prisma.cotizacion.findUnique({where:{id},select:{folio:true,estado:true,vigenciaHasta:true,total:true,inmuebleId:true,observacionesInternas:true}});
  if(!c) volver("error","La pre-cotización no existe."); if(c.estado!==EstadoCotizacion.ENVIADA) volver("error","La aceptación por representación solo procede cuando está pendiente del cliente."); if(estaVencida(c.vigenciaHasta)) volver("error","La pre-cotización está vencida."); if(!c.inmuebleId||Number(c.total)<=0) volver("error","La pre-cotización no está completa.");
  const ahora=new Date(); const nota=`[${ahora.toISOString()}] ACEPTACIÓN POR EXCEPCIÓN EN REPRESENTACIÓN DEL CLIENTE. Registró: ${usuario.nombre} (${usuario.rol}). Motivo: ${motivo}`;
  await prisma.cotizacion.update({where:{id},data:{estado:EstadoCotizacion.ACEPTADA,aceptadaEn:ahora,solicitudAutorizacionEn:ahora,observacionesInternas:c.observacionesInternas?.trim()?`${c.observacionesInternas.trim()}\n\n${nota}`:nota}});
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"Cotizacion",entidadId:id,usuarioId:usuario.id,descripcion:`${usuario.rol} registró aceptación por excepción de ${c.folio}. Motivo: ${motivo}`}); revalidatePath("/panel/pre-cotizaciones"); revalidatePath("/portal/cotizaciones"); volver("ok","Aceptación por excepción registrada. Pendiente de autorización interna.");
}

export async function autorizarCotizacionAceptada(formData: FormData) {
  const usuario=await gestor(); const id=texto(formData,"id");
  const c=await prisma.cotizacion.findUnique({where:{id},select:{id:true,folio:true,estado:true,aceptadaEn:true,vigenciaHasta:true,total:true,montoPagado:true,inmuebleId:true,clienteId:true,versionActual:true,versiones:{orderBy:{version:"desc"},take:1,select:{version:true,datos:true,total:true}},inspeccion:{select:{id:true}}}});
  if(!c) volver("error","La pre-cotización no existe."); if(c.estado!==EstadoCotizacion.ACEPTADA||!c.aceptadaEn) volver("error","Debe ser aceptada antes de la autorización interna."); if(estaVencida(c.vigenciaHasta)) volver("error","La pre-cotización venció antes de su autorización."); if(!c.inmuebleId||!c.versiones[0]||Number(c.total)<=0) volver("error","La pre-cotización no está completa.");
  const datos=objeto(c.versiones[0].datos); const cliente=objeto(datos?.cliente); const inmueble=objeto(datos?.inmueble);
  await prisma.$transaction(async tx=>{
    if(cliente){ await tx.cliente.update({where:{id:c.clienteId},data:{nombre:String(cliente.nombre??""),telefono:String(cliente.telefono??"")||null,correo:String(cliente.correo??"")||null,tipo:Object.values(TipoCliente).includes(cliente.tipo as TipoCliente)?cliente.tipo as TipoCliente:undefined,empresa:String(cliente.empresa??"")||null,direccion:String(cliente.direccion??"")||null,colonia:String(cliente.colonia??"")||null,ciudad:String(cliente.ciudad??"")||null,estado:String(cliente.estado??"")||null,codigoPostal:String(cliente.codigoPostal??"")||null}}); }
    if(inmueble){ await tx.inmueble.update({where:{id:c.inmuebleId!},data:{alias:String(inmueble.alias??""),direccion:String(inmueble.direccion??""),colonia:String(inmueble.colonia??"")||null,ciudad:String(inmueble.ciudad??""),estado:String(inmueble.estado??""),codigoPostal:String(inmueble.codigoPostal??"")||null,superficieTerrenoM2:new Prisma.Decimal(Number(inmueble.m2Terreno??0)),superficieConstruccionM2:new Prisma.Decimal(Number(inmueble.m2Construccion??0))}}); }
    await tx.cotizacion.update({where:{id},data:{estado:EstadoCotizacion.AUTORIZADA,autorizadaPorId:usuario.id,autorizadaEn:new Date(),editablePublica:false}});
    if(c.inspeccion&&inmueble){ await tx.inspeccion.update({where:{id:c.inspeccion.id},data:{direccion:String(inmueble.direccion??""),ciudad:String(inmueble.ciudad??""),superficieM2:new Prisma.Decimal(Number(inmueble.m2Construccion??0))}}); }
  });
  const sobrepago=Number(c.montoPagado)>Number(c.total);
  await registrarAuditoria({tipo:TipoEvento.AUTORIZAR,entidad:"Cotizacion",entidadId:id,usuarioId:usuario.id,descripcion:`${usuario.rol} autorizó ${c.folio}, versión ${c.versionActual}. Se sincronizaron Cliente/Inmueble sin alterar pagos, agenda, asignaciones ni inspección.${sobrepago?" ALERTA: el importe autorizado es menor al monto ya pagado; requiere revisión administrativa.":""}`});
  revalidatePath("/panel/pre-cotizaciones"); revalidatePath("/panel/cotizaciones"); revalidatePath("/panel/clientes"); revalidatePath("/panel/inmuebles"); revalidatePath("/panel/caja"); revalidatePath("/panel/agenda"); revalidatePath("/panel/inspecciones"); volver("ok",sobrepago?"Cotización autorizada. ALERTA: el importe es menor a lo ya pagado; Caja requiere revisión administrativa.":"Pre-cotización autorizada y sincronizada. Pagos y operación previa fueron preservados.");
}

// CORRECCION/AJUSTE: vuelve temporalmente a Pre-cotizaciones y conserva toda la operacion.
export async function regresarAPrecotizacion(formData: FormData) {
  const usuario=await gestor(); const id=texto(formData,"id"); const motivo=texto(formData,"motivo"); if(!motivo) volver("error","Registra el motivo del cambio o ajuste.");
  const c=await prisma.cotizacion.findUnique({where:{id},select:{folio:true,estado:true,montoPagado:true,observacionesInternas:true}}); if(!c) volver("error","La cotización no existe."); if(c.estado!==EstadoCotizacion.AUTORIZADA) volver("error","Solo una cotización autorizada puede regresar temporalmente a pre-cotización.");
  const ahora=new Date(); const nota=`[${ahora.toISOString()}] REGRESO POR CORRECCIÓN/AJUSTE. Ejecutó: ${usuario.nombre} (${usuario.rol}). Motivo: ${motivo}. Se preservan pagos, saldo, agenda, inspección, inspector, evidencias y antecedentes.`;
  await prisma.cotizacion.update({where:{id},data:{estado:EstadoCotizacion.BORRADOR,aceptadaEn:null,solicitudAutorizacionEn:null,autorizadaPorId:null,autorizadaEn:null,editablePublica:true,observacionesInternas:c.observacionesInternas?.trim()?`${c.observacionesInternas.trim()}\n\n${nota}`:nota}});
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"Cotizacion",entidadId:id,usuarioId:usuario.id,descripcion:`${usuario.rol} abrió ciclo de CORRECCIÓN/AJUSTE para ${c.folio}. Motivo: ${motivo}. Pagos (${Number(c.montoPagado).toLocaleString("es-MX",{style:"currency",currency:"MXN"})}) y operación existente preservados.`});
  revalidatePath("/panel/pre-cotizaciones"); revalidatePath("/panel/cotizaciones"); revalidatePath("/panel/caja"); revalidatePath("/panel/agenda"); revalidatePath("/panel/inspecciones"); volver("ok","Cotización enviada a Pre-cotizaciones para corrección/ajuste. La nueva versión deberá aceptarse y autorizarse nuevamente.");
}

// CANCELACION/FALTA DE RESPUESTA: cierra comercialmente sin regresar a Pre-cotizaciones.
export async function cancelarCotizacion(formData: FormData) {
  const usuario=await gestor(); const id=texto(formData,"id"); const tipoCierre=texto(formData,"tipoCierre"); const motivo=texto(formData,"motivo");
  if(!["CANCELACION_CLIENTE","SIN_RESPUESTA_CLIENTE"].includes(tipoCierre)) volver("error","Selecciona cancelación del cliente o falta de respuesta.");
  if(!motivo) volver("error","Registra el motivo o antecedente del cierre.");
  const c=await prisma.cotizacion.findUnique({where:{id},select:{folio:true,estado:true,montoPagado:true,observacionesInternas:true,inspeccion:{select:{id:true,folio:true,estado:true}}}});
  if(!c) volver("error","La cotización no existe."); if(c.estado!==EstadoCotizacion.AUTORIZADA) volver("error","Solo una cotización autorizada activa puede cerrarse desde este panel.");
  if(c.inspeccion&&[EstadoInspeccion.EN_PROCESO,EstadoInspeccion.REPORTE_PENDIENTE,EstadoInspeccion.FINALIZADA].includes(c.inspeccion.estado)) volver("error",`La inspección ${c.inspeccion.folio} ya avanzó a ${c.inspeccion.estado.replaceAll("_"," ")}. Requiere resolución administrativa del expediente.`);
  const ahora=new Date(); const etiqueta=tipoCierre==="CANCELACION_CLIENTE"?"CANCELACIÓN DEL CLIENTE":"FALTA DE RESPUESTA DEL CLIENTE"; const nota=`[${ahora.toISOString()}] CIERRE POR ${etiqueta}. Ejecutó: ${usuario.nombre} (${usuario.rol}). Motivo/antecedente: ${motivo}. Pagos e historial se conservan.`;
  await prisma.$transaction(async tx=>{
    await tx.cotizacion.update({where:{id},data:{estado:EstadoCotizacion.CANCELADA,editablePublica:false,observacionesInternas:c.observacionesInternas?.trim()?`${c.observacionesInternas.trim()}\n\n${nota}`:nota}});
    if(c.inspeccion?.estado===EstadoInspeccion.PROGRAMADA) await tx.inspeccion.update({where:{id:c.inspeccion.id},data:{estado:EstadoInspeccion.CANCELADA}});
  });
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"Cotizacion",entidadId:id,usuarioId:usuario.id,descripcion:`${usuario.rol} cerró ${c.folio} por ${etiqueta}. Motivo: ${motivo}. Pagos preservados: ${Number(c.montoPagado).toLocaleString("es-MX",{style:"currency",currency:"MXN"})}.${c.inspeccion?.estado===EstadoInspeccion.PROGRAMADA?` Inspección ${c.inspeccion.folio} cancelada sin eliminarse.`:""}`});
  revalidatePath("/panel/cotizaciones"); revalidatePath("/panel/caja"); revalidatePath("/panel/agenda"); revalidatePath("/panel/inspecciones"); volver("ok",`Cotización cerrada por ${etiqueta.toLowerCase()}. No regresó a Pre-cotizaciones y el historial quedó preservado.`);
}
