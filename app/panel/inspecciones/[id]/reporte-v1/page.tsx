import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

import { auth } from "@/auth";
import ReportBrandHeader from "@/components/branding/ReportBrandHeader";
import TecnologiaInspeccionV1 from "@/components/reportes/TecnologiaInspeccionV1";
import { extraerResultadosInstrumentales } from "@/lib/resultados-instrumentales";
import { prisma } from "@/lib/prisma";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signedUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const sb = supabaseAdmin();
  if (!sb) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

type Area = { id:string; nombre:string; resultado:string|null; comentarioFinal:string|null; puntos:number; noAplica:number; hallazgos:number };
type Proceso = { orden:number; nombre:string; estado:string; lecturaInicial:number|null; lecturaFinal:number|null; unidad:string|null; comentario:string|null };
type FotoArea = { areaId:string; url:string; descripcion:string|null };

const GLOSARIO = [
  ["P1", "Prioridad crítica o urgente; requiere atención inmediata por la relevancia de la condición observada."],
  ["P2", "Prioridad alta; condición relevante que debe atenderse con prontitud."],
  ["P3", "Prioridad media; condición que requiere corrección programada o seguimiento."],
  ["P4", "Prioridad baja; detalle de menor impacto que conviene corregir."],
  ["P5", "Prioridad muy baja; detalle menor, principalmente de terminación, apariencia o mejora."],
  ["Hermeticidad", "Capacidad de una instalación para mantener presión o estanqueidad durante una prueba controlada."],
  ["Desplome", "Desviación de un elemento vertical respecto de la vertical esperada."],
  ["Auscultación", "Revisión mediante percusión, rodamiento u otra técnica para identificar indicios de huecos, desprendimientos u otras condiciones."],
  ["Lambrín", "Recubrimiento colocado sobre muros, comúnmente cerámico, pétreo u otro acabado."],
  ["No aplica", "Punto previsto en la plantilla que no corresponde al elemento real del inmueble; queda justificado internamente y se excluye del reporte principal."],
] as const;

export default async function ReporteV1Page({ params }: { params: Promise<{ id:string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({ where:{id:session.user.id}, select:{rol:true,activo:true,inspector:{select:{id:true}}} });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where:{id},
    include:{
      cliente:true,
      inmueble:true,
      inspector:{include:{usuario:true}},
      cotizacion:{select:{folio:true,observacionesInternas:true}},
      hallazgos:{orderBy:[{prioridad:"asc"},{creadoEn:"asc"}],include:{fotografias:true}},
      certificado:true,
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}/reporte`);
  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  if (!esInspector && ![RolUsuario.DIRECTOR,RolUsuario.GERENTE,RolUsuario.COORDINADOR].includes(usuario.rol)) redirect("/acceso");

  const areas = await prisma.$queryRaw<Area[]>`
    SELECT a."id"::text,a."nombre",a."resultado",a."comentarioFinal",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3" <> 'NO_APLICA') "puntos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3"='NO_APLICA') "noAplica",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."areaId"=a."id") "hallazgos"
    FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true ORDER BY a."orden",a."nombre"
  `;

  const procesos = await prisma.$queryRaw<Proceso[]>`
    SELECT "orden","nombre","estado","lecturaInicial","lecturaFinal","unidad","comentario"
    FROM "ProtocoloInspeccionPaso" WHERE "inspeccionId"=${id} ORDER BY "orden"
  `;

  const fotosArea = await prisma.$queryRaw<FotoArea[]>`
    SELECT fa."areaId"::text "areaId",f."url",f."descripcion"
    FROM "FotografiaArea" fa JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
    WHERE a."inspeccionId"=${id} AND fa."seleccionadaReporte"=true ORDER BY a."orden",fa."orden",fa."creadoEn"
  `;
  const fotosFirmadas = await Promise.all(fotosArea.map(async f => ({...f,urlFirmada:await signedUrl(f.url)})));
  const fotosPorArea = new Map<string, typeof fotosFirmadas>();
  for (const f of fotosFirmadas) fotosPorArea.set(f.areaId,[...(fotosPorArea.get(f.areaId)??[]),f]);

  const [fachada] = await prisma.$queryRaw<Array<{url:string|null}>>`
    SELECT f."url" FROM "AreaInspeccion" a JOIN "FotografiaArea" fa ON fa."areaId"=a."id" JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE a."inspeccionId"=${id} AND a."codigo"='FACHADA_PRINCIPAL' AND fa."candidataPortada"=true LIMIT 1
  `;
  const portada = await signedUrl(fachada?.url ?? null);
  const { resultados } = extraerResultadosInstrumentales(inspeccion.observaciones);

  const hallazgosP = [1,2,3,4,5].map(p => ({p,total:inspeccion.hallazgos.filter(h=>h.prioridad===p).length}));
  const puntosAplicables = areas.reduce((s,a)=>s+Number(a.puntos),0);
  const areasSinHallazgo = areas.filter(a=>a.resultado==='SIN_HALLAZGOS').length;
  const cobertura = areas.length ? Math.round(areas.filter(a=>a.resultado==='SIN_HALLAZGOS'||a.resultado==='CON_HALLAZGOS').length/areas.length*100) : 0;
  const fecha = new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});

  let qr:string|null=null;
  if (inspeccion.certificado) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    qr = await QRCode.toDataURL(`${base}/certificados/verificar/${inspeccion.certificado.codigoValidacion}`,{width:240,margin:1,errorCorrectionLevel:"M"});
  }

  return (
    <main className="min-h-screen bg-slate-200 px-3 py-6 text-slate-950 print:bg-white print:p-0">
      <style>{`@page{size:Letter;margin:12mm} @media print{.no-print{display:none!important}.page-break{break-before:page;page-break-before:always}.avoid-break{break-inside:avoid;page-break-inside:avoid}}`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-5xl justify-between"><Link href={`/panel/inspecciones/${id}/cierre-v1`} className="font-black text-slate-700">← Cierre V1</Link><span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">REPORTE V1</span></div>
      <article className="mx-auto max-w-5xl bg-white shadow-xl print:max-w-none print:shadow-none">
        <section className="min-h-[245mm] bg-slate-950 px-10 py-9 text-white">
          <ReportBrandHeader title="Reporte Final de Inspección V1" folio={inspeccion.folio} eyebrow="Método Certeza Habitacional · Inspección integral" dark />
          {portada && <img src={portada} alt="Fachada principal" className="mt-8 h-72 w-full rounded-3xl object-cover" />}
          <div className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2">
            <Dato label="Cliente" value={inspeccion.cliente.nombre}/><Dato label="Inmueble" value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}/><Dato label="Dirección" value={`${inspeccion.direccion}, ${inspeccion.ciudad}`}/><Dato label="Fecha" value={fecha}/><Dato label="Inspector" value={inspeccion.inspector?.usuario.nombre ?? "Inspector asignado"}/><Dato label="Cotización" value={inspeccion.cotizacion?.folio ?? "Sin folio"}/>
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[.24em] text-amber-300">Certeza Habitacional · Documento técnico de inspección</p>
        </section>

        <Seccion n="01" titulo="Índice" subtitulo="Estructura del reporte">
          <ol className="grid gap-2 sm:grid-cols-2">{["Resumen ejecutivo","Procedimiento y alcance","Funcionamiento e instalaciones","Desarrollo por áreas","Resumen estadístico","Herramientas y tecnología utilizadas","Glosario","Certificado Certeza Habitacional"].map((x,i)=><li key={x} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold">{String(i+1).padStart(2,"0")} · {x}</li>)}</ol>
        </Seccion>

        <Seccion n="02" titulo="Resumen ejecutivo" subtitulo="Lectura rápida de resultados">
          <div className="grid gap-3 sm:grid-cols-4"><Metrica label="Cobertura" value={`${cobertura}%`}/><Metrica label="Áreas" value={String(areas.length)}/><Metrica label="Puntos aplicables" value={String(puntosAplicables)}/><Metrica label="Áreas sin hallazgos" value={String(areasSinHallazgo)}/></div>
          <div className="mt-4 grid grid-cols-5 gap-2">{hallazgosP.map(({p,total})=><Metrica key={p} label={`P${p}`} value={String(total)}/>)}</div>
          <p className="mt-5 rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-200">La inspección V1 documenta el funcionamiento de los principales sistemas, el recorrido por las áreas contratadas, los puntos mínimos aplicables, los hallazgos detectados y las áreas verificadas sin anomalías relevantes. La interpretación final se apoya en evidencia de campo, tecnología utilizada y criterio profesional del Inspector.</p>
        </Seccion>

        <Seccion n="03" titulo="Procedimiento y alcance" subtitulo="Cómo se ejecutó la inspección">
          <p className="text-sm leading-7 text-slate-700">El Método Certeza Habitacional parte del alcance aceptado en la cotización, incorpora la información de proyecto disponible, inicia con las pruebas funcionales e instalaciones y continúa con una revisión secuencial área por área. Cada área se cierra con hallazgos documentados o con evidencia satisfactoria cuando no se identifican anomalías relevantes.</p>
        </Seccion>

        <Seccion n="04" titulo="Funcionamiento e instalaciones" subtitulo="Pruebas y procesos técnicos ejecutados">
          <div className="space-y-3">{procesos.map((p)=><article key={`${p.orden}-${p.nombre}`} className="avoid-break rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><h3 className="font-black">{p.nombre}</h3><span className="text-xs font-black text-cyan-700">{p.estado.replaceAll('_',' ')}</span></div>{(p.lecturaInicial!==null||p.lecturaFinal!==null)&&<p className="mt-2 text-sm font-bold text-slate-700">Lectura inicial: {p.lecturaInicial ?? '—'} {p.unidad ?? ''} · Lectura final: {p.lecturaFinal ?? '—'} {p.unidad ?? ''}</p>}{p.comentario&&<p className="mt-2 text-sm leading-6 text-slate-600">{p.comentario}</p>}</article>)}</div>
          <div className="mt-6 rounded-2xl bg-cyan-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-cyan-800">Tecnología aplicada en estos procesos</p><p className="mt-2 text-sm text-slate-700">Las lecturas y verificaciones instrumentales registradas se presentan en su contexto técnico y se resumen nuevamente en la sección de herramientas y tecnología.</p></div>
        </Seccion>

        <Seccion n="05" titulo="Desarrollo por áreas" subtitulo="Conceptos revisados, resultados, hallazgos y evidencia">
          <div className="space-y-6">{areas.map((a)=>{const hs=inspeccion.hallazgos.filter(h=>h.area===a.nombre);const fs=fotosPorArea.get(a.id)??[];return <article key={a.id} className="rounded-3xl border border-slate-200 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-black">{a.nombre}</h3><p className="mt-1 text-xs font-bold text-slate-500">{a.puntos} puntos aplicables · {a.noAplica} excluidos por No aplica</p></div><span className={`rounded-full px-3 py-2 text-xs font-black ${a.resultado==='SIN_HALLAZGOS'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900'}`}>{(a.resultado??'PENDIENTE').replaceAll('_',' ')}</span></div>{a.comentarioFinal&&<p className="mt-4 text-sm leading-7 text-slate-700">{a.comentarioFinal}</p>}{hs.map(h=><div key={h.id} className="mt-4 rounded-2xl bg-slate-950 p-4 text-white"><div className="flex justify-between gap-3"><h4 className="font-black">{h.titulo}</h4><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">P{h.prioridad}</span></div><p className="mt-2 text-sm leading-6 text-slate-300">{h.descripcion}</p></div>)}{fs.length>0&&<div className="mt-4 grid grid-cols-2 gap-3">{fs.slice(0,4).map((f,i)=><figure key={`${a.id}-${i}`} className="overflow-hidden rounded-2xl border border-slate-200">{f.urlFirmada?<img src={f.urlFirmada} alt={f.descripcion??a.nombre} className="h-44 w-full object-cover"/>:<div className="grid h-44 place-items-center bg-slate-100 text-xs text-slate-400">Imagen no disponible</div>}<figcaption className="p-2 text-xs text-slate-500">{f.descripcion??`Evidencia ${i+1}`}</figcaption></figure>)}</div>}</article>})}</div>
        </Seccion>

        <Seccion n="06" titulo="Resumen estadístico" subtitulo="Cobertura y distribución de resultados">
          <div className="grid gap-3 sm:grid-cols-4"><Metrica label="Cobertura efectiva" value={`${cobertura}%`}/><Metrica label="Puntos aplicables" value={String(puntosAplicables)}/><Metrica label="Hallazgos" value={String(inspeccion.hallazgos.length)}/><Metrica label="Áreas satisfactorias" value={String(areasSinHallazgo)}/></div>
          <div className="mt-4 grid grid-cols-5 gap-2">{hallazgosP.map(({p,total})=><Metrica key={p} label={`P${p}`} value={String(total)}/>)}</div>
        </Seccion>

        <Seccion n="07" titulo="Herramientas y tecnología utilizadas" subtitulo="Función, aplicación y ventaja técnica">
          <p className="mb-5 text-sm leading-6 text-slate-600">Esta relación se construye a partir de los resultados efectivamente registrados durante la inspección. La Aplicación Certeza Habitacional forma parte integral del método y los equipos físicos aparecen únicamente cuando su uso quedó documentado.</p>
          <TecnologiaInspeccionV1 resultados={resultados} mostrarNoEjecutadas />
        </Seccion>

        <Seccion n="08" titulo="Glosario" subtitulo="Términos para facilitar la lectura del reporte">
          <div className="grid gap-3 sm:grid-cols-2">{GLOSARIO.map(([t,d])=><article key={t} className="rounded-2xl bg-slate-100 p-4"><h3 className="font-black">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{d}</p></article>)}</div>
        </Seccion>

        <section className="page-break px-10 py-10">
          <ReportBrandHeader title="Certificado Certeza Habitacional" folio={inspeccion.certificado?.folio ?? inspeccion.folio} eyebrow="Resultado final autorizado" />
          {inspeccion.certificado ? <div className="mt-10 rounded-[2rem] border-8 border-slate-950 p-8"><div className="border-2 border-amber-500 p-8 text-center"><h2 className="text-3xl font-black">Certificado de Estado Habitacional</h2><div className="mt-8 grid gap-8 md:grid-cols-[1fr_190px]"><div className="text-left"><Fila label="Inmueble" value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}/><Fila label="Inspección" value={inspeccion.folio}/><Fila label="Fecha" value={fecha}/><Fila label="Calificación final" value={`${Math.round(Number(inspeccion.certificado.ish))}/100`}/><Fila label="Hallazgos" value={String(inspeccion.hallazgos.length)}/><Fila label="Áreas sin hallazgos" value={String(areasSinHallazgo)}/></div>{qr&&<div className="text-center"><img src={qr} alt="QR de validación" className="mx-auto h-44 w-44"/><p className="mt-2 text-xs font-black">Validar certificado y consultar información autorizada</p></div>}</div><p className="mt-8 text-sm leading-7 text-slate-600">{inspeccion.certificado.dictamen}</p></div></div>:<div className="mt-10 rounded-3xl bg-amber-50 p-8 text-amber-900">El certificado se generará cuando Dirección autorice el reporte final.</div>}
        </section>
      </article>
    </main>
  );
}

function Seccion({n,titulo,subtitulo,children}:{n:string;titulo:string;subtitulo:string;children:React.ReactNode}){return <section className="px-10 py-8"><header className="mb-5 flex gap-4 border-b border-slate-200 pb-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-sm font-black text-amber-300">{n}</span><div><h2 className="text-2xl font-black">{titulo}</h2><p className="mt-1 text-sm text-slate-500">{subtitulo}</p></div></header>{children}</section>}
function Dato({label,value}:{label:string;value:string}){return <div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{label}</p><p className="mt-1 font-bold">{value}</p></div>}
function Metrica({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-slate-100 p-3 text-center"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p></div>}
function Fila({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-6 border-b border-slate-100 py-2"><span className="text-slate-500">{label}</span><strong className="text-right">{value}</strong></div>}
