import type { PrioridadHallazgo } from "@prisma/client";

import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";

const RANGOS: Record<PrioridadHallazgo,{min:number;max:number}> = {
  P1:{min:0,max:49},
  P2:{min:50,max:69},
  P3:{min:70,max:79},
  P4:{min:80,max:89},
  P5:{min:90,max:99},
};

export async function calificarPuntoConIaV1({
  prioridad,
  partida,
  concepto,
  descripcionFinal,
  especificacion,
  valorMedido,
  valorProyecto,
  unidadMedida,
  rutasEvidencia,
}:{
  prioridad: PrioridadHallazgo;
  partida:string;
  concepto:string;
  descripcionFinal:string;
  especificacion?:string|null;
  valorMedido?:string|null;
  valorProyecto?:string|null;
  unidadMedida?:string|null;
  rutasEvidencia:string[];
}) {
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey) throw new Error("Falta GEMINI_API_KEY para calcular la evaluación del punto.");

  const rango=RANGOS[prioridad];
  const sb=obtenerSupabaseAdmin();
  const bucket=process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const partes:Array<Record<string,unknown>>=[];

  for(const ruta of rutasEvidencia.slice(0,4)){
    const {data,error}=await sb.storage.from(bucket).download(ruta);
    if(error||!data) throw new Error("No fue posible recuperar una evidencia para calcular la evaluación.");
    const mime=data.type||"image/jpeg";
    const base64=Buffer.from(await data.arrayBuffer()).toString("base64");
    partes.push({inlineData:{mimeType:mime,data:base64}});
  }

  partes.push({text:[
    "Actúa como evaluador técnico auxiliar de una inspección habitacional.",
    "El Inspector ya determinó la prioridad del hallazgo. NO cambies la prioridad.",
    `Prioridad elegida por el Inspector: ${prioridad}.`,
    `Rango obligatorio para esta prioridad: ${rango.min} a ${rango.max} puntos.`,
    `Partida: ${partida}.`,
    `Concepto inspeccionado: ${concepto}.`,
    especificacion?`Criterio o especificación: ${especificacion}.`:"",
    `Interpretación técnica final del Inspector: ${descripcionFinal}.`,
    valorMedido?`Valor medido: ${valorMedido} ${unidadMedida??""}.`:"",
    valorProyecto?`Valor de referencia/proyecto: ${valorProyecto} ${unidadMedida??""}.`:"",
    "Analiza en conjunto las fotografías, la interpretación final y las mediciones disponibles.",
    "Asigna UN número entero dentro del rango obligatorio. Usa el extremo inferior cuando la evidencia muestre una condición más severa dentro de la prioridad seleccionada, y el extremo superior cuando la condición sea menor dentro de esa misma prioridad.",
    "No inventes condiciones no visibles ni cambies el nivel de prioridad.",
    "Devuelve únicamente JSON con: calificacion y justificacion.",
  ].filter(Boolean).join(" ")});

  const modelo=process.env.GEMINI_PROYECTO_MODEL || "gemini-3.5-flash-lite";
  const respuesta=await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({
        contents:[{role:"user",parts:partes}],
        generationConfig:{responseMimeType:"application/json",temperature:0.05},
      }),
      cache:"no-store",
    },
  );
  const cuerpo=(await respuesta.json().catch(()=>({}))) as {
    error?:{message?:string};
    candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>;
  };
  if(!respuesta.ok) throw new Error(`Gemini no pudo calcular la evaluación: ${cuerpo.error?.message||"error no identificado"}`);
  const salida=cuerpo.candidates?.[0]?.content?.parts?.map((p)=>p.text||"").join("").trim();
  if(!salida) throw new Error("Gemini no devolvió una evaluación.");

  let parsed:Record<string,unknown>;
  try{parsed=JSON.parse(salida);}catch{throw new Error("Gemini devolvió una evaluación que no pudo estructurarse.");}

  const calificacion=Math.round(Number(parsed.calificacion));
  const justificacion=String(parsed.justificacion??"").trim();
  if(!Number.isFinite(calificacion)||calificacion<rango.min||calificacion>rango.max){
    throw new Error(`La IA devolvió una calificación fuera del rango ${prioridad} (${rango.min}-${rango.max}). Intenta nuevamente.`);
  }
  return {calificacion,justificacion,rango};
}

export function rangoPrioridadV1(prioridad:PrioridadHallazgo){
  return RANGOS[prioridad];
}
