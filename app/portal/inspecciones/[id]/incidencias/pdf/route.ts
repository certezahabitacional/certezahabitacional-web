import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import { obtenerClienteActual } from "@/lib/cliente-actual";
import { ordenarYFiltrarFotografias, obtenerSeleccionEvidenciaReporte } from "@/lib/evidencia-reporte";
import { prisma } from "@/lib/prisma";
import { inspeccionLiberadaParaCliente } from "@/lib/portal-inspecciones";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const escapar = (v: unknown) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
export async function GET(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const cliente=await obtenerClienteActual();
  const {id}=await params;
  const inspeccion=await prisma.inspeccion.findFirst({
    where:{id,...inspeccionLiberadaParaCliente(cliente.id,cliente.zonaId)},
    select:{folio:true,direccion:true,ciudad:true,hallazgos:{
      orderBy:[{prioridad:"asc"},{creadoEn:"asc"}],
      include:{fotografias:{orderBy:{creadaEn:"asc"}}}
    }}
  });
  if(!inspeccion) return NextResponse.json({error:"Reporte no disponible."},{status:404});
  const seleccion=await obtenerSeleccionEvidenciaReporte(id);
  const hallazgos=inspeccion.hallazgos.map(h=>({...h,fotografias:ordenarYFiltrarFotografias(h.fotografias,seleccion)}));
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return NextResponse.json({error:"Servicio de evidencia no disponible."},{status:503});
  const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const bucket=process.env.SUPABASE_STORAGE_BUCKET||"evidencias";
  const rutas=[...new Set(hallazgos.flatMap(h=>h.fotografias.map(f=>f.url)))];
  const firmadas=await Promise.all(rutas.map(async ruta=>{
    if(/^https:\/\//i.test(ruta)) return [ruta,ruta] as const;
    const {data}=await sb.storage.from(bucket).createSignedUrl(ruta,3600);
    return [ruta,data?.signedUrl??""] as const;
  }));
  const urls=new Map(firmadas);
  const contenido=hallazgos.map((h,index)=>`<section class="hallazgo">
    <div class="cabecera"><span>INCIDENCIA ${index+1}</span><span>${escapar(h.prioridad)} · ${escapar(h.clasificacion)}</span></div>
    <h2>${escapar(h.titulo)}</h2>
    <p class="area">${escapar(h.area)}${h.ubicacion?" · "+escapar(h.ubicacion):""}</p>
    <p class="descripcion">${escapar(h.descripcion)}</p>
    ${h.recomendacion?`<p><strong>Recomendación:</strong> ${escapar(h.recomendacion)}</p>`:""}
    <div class="fotos">${h.fotografias.map(f=>urls.get(f.url)?`<figure><img src="${escapar(urls.get(f.url))}" /><figcaption>${escapar(f.descripcion||"Evidencia fotográfica")}</figcaption></figure>`:"").join("")}</div>
  </section>`).join("");
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><style>
    @page{size:letter;margin:17mm 15mm}*{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#162438;font-size:11px;line-height:1.45}
    header{border-bottom:3px solid #c69b32;padding-bottom:14px;margin-bottom:22px}
    .marca{font-size:12px;font-weight:bold;letter-spacing:2px;color:#957023}
    h1{font-size:23px;margin:10px 0 5px}h2{font-size:17px;margin:8px 0}
    .sub{color:#526174}.aviso{border:1px solid #c69b32;padding:10px;margin:18px 0;background:#fffbef}
    .hallazgo{border:1px solid #cbd3dd;border-radius:10px;padding:15px;margin:16px 0;break-inside:avoid-page}
    .cabecera{display:flex;justify-content:space-between;font-weight:bold;color:#946e22}
    .area{color:#677587}.descripcion{white-space:pre-wrap;font-size:12px}
    .fotos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
    figure{margin:0;break-inside:avoid}img{width:100%;max-height:230px;object-fit:contain;background:#f4f6f8}
    figcaption{font-size:10px;color:#526174;margin-top:5px}
    footer{margin-top:24px;font-size:10px;color:#586576;border-top:1px solid #ddd;padding-top:10px}
  </style></head><body><header><div class="marca">CERTEZA HABITACIONAL</div><h1>Relación de incidencias y evidencias</h1>
  <div class="sub">Inspección ${escapar(inspeccion.folio)} · ${escapar(inspeccion.direccion)}, ${escapar(inspeccion.ciudad)}</div></header>
  <div class="aviso">Extracto del reporte autorizado que contiene exclusivamente las incidencias documentadas y sus evidencias. No sustituye el reporte íntegro ni el certificado.</div>
  ${contenido||"<p>No se registraron incidencias en este reporte.</p>"}
  <footer>Documento facilitado al cliente para compartir las incidencias con la inmobiliaria. Información limitada al alcance de la inspección.</footer></body></html>`;
  let browser:Awaited<ReturnType<typeof puppeteer.launch>>|null=null;
  try{
    browser=await puppeteer.launch({
      args:chromium.args,
      executablePath:await chromium.executablePath(process.env.VERCEL
        ?"https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar":undefined),
      headless:"shell"
    });
    const page=await browser.newPage();
    await page.setContent(html,{waitUntil:"networkidle0",timeout:45000});
    await page.evaluate(async()=>{await Promise.all(Array.from(document.images).map(im=>im.complete?Promise.resolve():new Promise<void>(r=>{im.addEventListener("load",()=>r(),{once:true});im.addEventListener("error",()=>r(),{once:true});setTimeout(r,5000)})));});
    const pdf=await page.pdf({format:"Letter",printBackground:true});
    const nombre=`${inspeccion.folio}-incidencias-inmobiliaria.pdf`.replace(/[^a-zA-Z0-9._-]/g,"_");
    return new NextResponse(Buffer.from(pdf),{headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":`${request.nextUrl.searchParams.get("download")==="1"?"attachment":"inline"}; filename="${nombre}"`,
      "Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"
    }});
  }catch(error){
    console.error("No se pudo generar PDF de incidencias",error);
    return NextResponse.json({error:"No fue posible generar el PDF de incidencias."},{status:500});
  }finally{await browser?.close().catch(()=>undefined);}
}
