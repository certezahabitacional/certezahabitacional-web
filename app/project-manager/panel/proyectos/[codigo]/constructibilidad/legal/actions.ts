"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const checked=(fd:FormData,k:string)=>fd.get(k)==="on";

function progress(fd:FormData){
  const required=["tenencia","situacionRegistral","usoSueloEstado","densidad","cos","cus"];
  let score=required.filter(k=>clean(fd.get(k))).length*12;
  if(checked(fd,"escritura")) score+=8;
  if(checked(fd,"registroPublico")) score+=8;
  if(checked(fd,"libertadGravamen")) score+=8;
  if(checked(fd,"usoSueloDocumento")) score+=8;
  return Math.min(100,score);
}

export async function guardarLegalConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const situacionJuridica={
    tenencia:clean(formData.get("tenencia")),
    situacionRegistral:clean(formData.get("situacionRegistral")),
    escritura:checked(formData,"escritura"),
    registroPublico:checked(formData,"registroPublico"),
    libertadGravamen:checked(formData,"libertadGravamen"),
    gravamenes:checked(formData,"gravamenes"),
    servidumbres:checked(formData,"servidumbres"),
    derechosVia:checked(formData,"derechosVia"),
    litigios:checked(formData,"litigios"),
    fusionesSubdivisiones:checked(formData,"fusionesSubdivisiones"),
  };

  const usoSuelo={
    estado:clean(formData.get("usoSueloEstado")),
    documento:checked(formData,"usoSueloDocumento"),
    compatibilidad:clean(formData.get("compatibilidad")),
    requiereCambio:checked(formData,"requiereCambio"),
  };

  const parametrosUrbanisticos={
    densidad:clean(formData.get("densidad")),
    cos:clean(formData.get("cos")),
    cus:clean(formData.get("cus")),
    alturaMaxima:clean(formData.get("alturaMaxima")),
    retiros:clean(formData.get("retiros")),
    estacionamiento:clean(formData.get("estacionamiento")),
    donaciones:clean(formData.get("donaciones")),
    restricciones:clean(formData.get("restricciones")),
  };

  const riesgos:string[]=[];
  if(!situacionJuridica.escritura) riesgos.push("Escritura pendiente");
  if(!situacionJuridica.registroPublico) riesgos.push("Registro Público pendiente");
  if(!situacionJuridica.libertadGravamen) riesgos.push("Libertad de gravamen pendiente");
  if(situacionJuridica.gravamenes) riesgos.push("Existen gravámenes por resolver");
  if(situacionJuridica.litigios) riesgos.push("Existe litigio o controversia jurídica");
  if(usoSuelo.estado!=="AUTORIZADO" && usoSuelo.estado!=="COMPATIBLE") riesgos.push("Uso de suelo no liberado");
  if(usoSuelo.requiereCambio) riesgos.push("Requiere cambio o modificación de uso de suelo");

  const entregables=[
    "Expediente jurídico del predio",
    "Dictamen de disponibilidad jurídica",
    "Documento de uso de suelo",
    "Matriz de restricciones urbanísticas",
    "Parámetros máximos de desarrollo",
  ];

  const avance=progress(formData);

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,
      situacionJuridica,
      usoSuelo,
      parametrosUrbanisticos,
      entregablesPaso2:entregables,
      riesgosPaso2:riesgos,
      progresoPaso2:avance,
      estadoPaso2:avance>=80?"COMPLETO":"EN_PROCESO",
    },
    update:{
      situacionJuridica,
      usoSuelo,
      parametrosUrbanisticos,
      entregablesPaso2:entregables,
      riesgosPaso2:riesgos,
      progresoPaso2:avance,
      estadoPaso2:avance>=80?"COMPLETO":"EN_PROCESO",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/legal`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/legal?guardado=1`);
}
