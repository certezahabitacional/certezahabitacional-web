"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const num=(v:FormDataEntryValue|null)=>{
  const n=Number(clean(v)); return Number.isFinite(n)&&n>=0?n:0;
};

function structure(tipo:string){
  switch(tipo){
    case "VIVIENDA_INDIVIDUAL": return ["Proyecto","Partida","Concepto"];
    case "RESIDENCIA": return ["Proyecto","Zona","Partida","Concepto"];
    case "GRUPO_RESIDENCIAS": return ["Proyecto","Etapa","Residencia","Zona","Partida","Concepto"];
    case "VIVIENDA_SERIE": return ["Proyecto","Etapa","Frente","Manzana","Lote","Vivienda","Partida"];
    case "DESARROLLO_HABITACIONAL": return ["Proyecto","Etapa","Frente","Manzana","Lote","Vivienda","Partida"];
    case "EDIFICIO": return ["Proyecto","Edificio","Nivel","Zona","Especialidad","Concepto"];
    case "CONJUNTO_EDIFICIOS": return ["Proyecto","Etapa","Edificio","Nivel","Zona","Especialidad","Concepto"];
    case "COMERCIAL": return ["Proyecto","Edificio/Zona","Nivel","Área","Especialidad","Concepto"];
    case "INDUSTRIAL": return ["Proyecto","Nave/Área","Frente","Especialidad","Concepto"];
    case "INSTITUCIONAL": return ["Proyecto","Edificio/Zona","Nivel","Área","Especialidad","Concepto"];
    case "URBANIZACION": return ["Proyecto","Etapa","Frente","Calle/Tramo","Infraestructura","Concepto"];
    case "INFRAESTRUCTURA": return ["Proyecto","Etapa","Frente","Tramo/Sistema","Concepto"];
    case "MIXTO": return ["Proyecto","Etapa","Componente","Subcomponente","Frente/Zona","Concepto"];
    default:return ["Proyecto","Etapa","Frente","Concepto"];
  }
}

export async function guardarProductoConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const tipo=clean(formData.get("tipoProyecto"));
  const productoEscala={
    tipoProyecto:tipo,
    segmento:clean(formData.get("segmento")),
    unidades:num(formData.get("unidades")),
    edificios:num(formData.get("edificios")),
    niveles:num(formData.get("niveles")),
    prototipos:num(formData.get("prototipos")),
    etapas:num(formData.get("etapas")),
    frentes:num(formData.get("frentes")),
    manzanas:num(formData.get("manzanas")),
    hectareas:num(formData.get("hectareas")),
    m2Construccion:num(formData.get("m2Construccion")),
    repetitivo:clean(formData.get("repetitivo")),
    observaciones:clean(formData.get("observaciones")),
  };

  const jerarquia=structure(tipo);
  const estructuraControl={
    jerarquia,
    requiereControlUnidad:["VIVIENDA_SERIE","DESARROLLO_HABITACIONAL","GRUPO_RESIDENCIAS","CONJUNTO_EDIFICIOS"].includes(tipo),
    requiereFrentes:productoEscala.frentes>1 || ["VIVIENDA_SERIE","DESARROLLO_HABITACIONAL","URBANIZACION","INFRAESTRUCTURA"].includes(tipo),
    requiereEtapas:productoEscala.etapas>1 || ["DESARROLLO_HABITACIONAL","CONJUNTO_EDIFICIOS","MIXTO"].includes(tipo),
  };

  const riesgos:string[]=[];
  if(!tipo) riesgos.push("Tipo de proyecto no definido");
  if(["VIVIENDA_SERIE","DESARROLLO_HABITACIONAL","GRUPO_RESIDENCIAS"].includes(tipo) && productoEscala.unidades<1) riesgos.push("Cantidad de unidades no definida");
  if(["EDIFICIO","CONJUNTO_EDIFICIOS"].includes(tipo) && productoEscala.niveles<1) riesgos.push("Número de niveles no definido");
  if(estructuraControl.requiereFrentes && productoEscala.frentes<1) riesgos.push("Número de frentes no definido");
  if(estructuraControl.requiereEtapas && productoEscala.etapas<1) riesgos.push("Número de etapas no definido");

  const entregables=[
    "Ficha de producto y escala",
    "Jerarquía física de control",
    "Estructura de frentes y etapas",
    "Criterio de consolidación de reportes",
  ];

  const required=[tipo, clean(formData.get("segmento"))];
  let score=required.filter(Boolean).length*20;
  if(productoEscala.m2Construccion>0||productoEscala.hectareas>0) score+=15;
  if(productoEscala.unidades>0||productoEscala.edificios>0) score+=15;
  if(productoEscala.etapas>0) score+=10;
  if(productoEscala.frentes>0) score+=10;
  if(productoEscala.prototipos>0||["EDIFICIO","INDUSTRIAL","COMERCIAL","INSTITUCIONAL","INFRAESTRUCTURA","URBANIZACION"].includes(tipo)) score+=10;
  const avance=Math.min(100,score);

  const current=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id},select:{modulosSugeridos:true}});
  const curr=Array.isArray(current?.modulosSugeridos)?current.modulosSugeridos.map(String):[];
  const mods=new Set(curr);
  mods.add("Estructura física de control");
  if(["VIVIENDA_SERIE","DESARROLLO_HABITACIONAL","GRUPO_RESIDENCIAS"].includes(tipo)) mods.add("Control por unidad / vivienda");
  if(["EDIFICIO","CONJUNTO_EDIFICIOS"].includes(tipo)) mods.add("Control por edificio / nivel");
  if(tipo==="URBANIZACION") mods.add("Control por calle / tramo");
  if(tipo==="INFRAESTRUCTURA") mods.add("Control por sistema / tramo");
  if(productoEscala.frentes>1) mods.add("Control por frentes");

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id, productoEscala, estructuraControl,
      entregablesPaso5:entregables, riesgosPaso5:riesgos,
      modulosSugeridos:Array.from(mods),
      progresoPaso5:avance, estadoPaso5:avance>=80?"COMPLETO":"EN_PROCESO"
    },
    update:{
      productoEscala, estructuraControl,
      entregablesPaso5:entregables, riesgosPaso5:riesgos,
      modulosSugeridos:Array.from(mods),
      progresoPaso5:avance, estadoPaso5:avance>=80?"COMPLETO":"EN_PROCESO"
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/producto`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/producto?guardado=1`);
}
