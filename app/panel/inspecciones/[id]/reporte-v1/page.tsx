import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

import { auth } from "@/auth";
import ReportBrandHeader from "@/components/branding/ReportBrandHeader";
import TecnologiaInspeccionV1 from "@/components/reportes/TecnologiaInspeccionV1";
import { obtenerMetricasV1 } from "@/lib/calificacion-v1";
import { extraerResultadosInstrumentales } from "@/lib/resultados-instrumentales";
import {
  HERRAMIENTAS_INSPECCION,
  obtenerHerramientasCotizadasDesdeCotizacion,
} from "@/lib/herramientas-inspeccion";
import { prisma } from "@/lib/prisma";
import { confirmarPreReporteSitioV1 } from "../pre-reporte/actions";

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

type Area = {
  id:string;
  nombre:string;
  resultado:string|null;
  comentarioFinal:string|null;
  definidos:number;
  aplicables:number;
  revisados:number;
  noAplica:number;
  hallazgos:number;
};
type Proceso = { orden:number; nombre:string; estado:string; lecturaInicial:number|null; lecturaFinal:number|null; unidad:string|null; comentario:string|null };
type FotoArea = { areaId:string; url:string; descripcion:string|null };
type ControlReporte = {
  campoFinalizadoEn: Date | null;
  inspeccionTecnicaConcluidaEn: Date | null;
  preReporteGeneradoEn: Date | null;
};
type EvidenciaCompleta = {
  fotografiaId:string;
  areaId:string|null;
  areaNombre:string|null;
  concepto:string|null;
  especificacion:string|null;
  observacion:string|null;
  estadoV3:string|null;
  valorMedido:string|null;
  valorProyecto:string|null;
  unidadMedida:string|null;
  url:string;
  descripcion:string|null;
  orden:number|null;
};
type ObservacionConcepto = {
  descripcionFinal?: string;
  clasificacionFinal?: string;
  prioridadFinal?: string;
};
type SnapshotCotizacion = Record<string, unknown>;
type AutorizacionDireccion = { nombre: string; creadaEn: Date };

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

const ESPACIOS_COTIZACION = [
  ["sala","Sala"],["comedor","Comedor"],["cocina","Cocina"],["estancia","Estancia"],
  ["areaLavado","Área de lavado"],["lavadero","Lavadero"],["cochera","Cochera"],
  ["patio","Patio"],["jardin","Jardín"],["terraza","Terraza"],["balcon","Balcón"],
  ["sotano","Sótano"],["cuartoServicio","Cuarto de servicio"],["bodega","Bodega"],
] as const;

function objetoJson(valor: unknown): SnapshotCotizacion {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? valor as SnapshotCotizacion
    : {};
}

function textoSnapshot(snapshot: SnapshotCotizacion, clave: string) {
  const valor = snapshot[clave];
  return valor === null || valor === undefined ? "" : String(valor).trim();
}

function observacionConcepto(valor: string | null): ObservacionConcepto {
  if (!valor) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as ObservacionConcepto
      : {};
  } catch {
    return { descripcionFinal: valor };
  }
}

function referenciasNormativas(ciudad: string) {
  const normalizada = ciudad.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const referencias = [
    {
      titulo: "Código de Edificación de Vivienda (CONAVI), 3ª edición 2017",
      uso: "Referencia técnica nacional de apoyo para criterios de vivienda; es un modelo normativo y no sustituye por sí solo la regulación local.",
      fuente: "https://www.gob.mx/conavi/documentos/codigo-de-edificacion-de-vivienda-3ra-edicion-2017",
    },
    {
      titulo: "NOM-001-SEDE-2012, Instalaciones eléctricas (utilización)",
      uso: "Referencia federal para criterios de seguridad y utilización en instalaciones eléctricas cuando el alcance inspeccionado corresponda.",
      fuente: "https://www.dof.gob.mx/",
    },
    {
      titulo: "NOM-002-SECRE-2010, Instalaciones de aprovechamiento de gas natural",
      uso: "Referencia para requisitos mínimos de seguridad en instalaciones de aprovechamiento de gas natural, cuando el inmueble y el alcance correspondan.",
      fuente: "https://www.dof.gob.mx/",
    },
  ];
  if (normalizada.includes("JUAREZ")) {
    referencias.unshift({
      titulo: "Reglamento de Construcción para el Municipio de Juárez y sus Normas Técnicas Complementarias",
      uso: "Marco local de referencia para construcción en el Municipio de Juárez. Debe consultarse en su versión vigente y aplicarse únicamente al criterio efectivamente revisado.",
      fuente: "https://www.juarez.gob.mx/reglamento-de-construccion-para-el-municipio-de-juarez-y-sus-normas-tecnicas-complementarias/",
    });
  }
  return referencias;
}

export default async function ReporteV1Page({ params, searchParams }: {
  params: Promise<{ id:string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
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
      cotizacion:{select:{
        folio:true,observacionesInternas:true,notas:true,total:true,subtotal:true,precioBase:true,
        metrosAdicionales:true,cargoMetrosAdicionales:true,cargosExtra:true,descuento:true,
        paquete:{select:{nombre:true,descripcion:true}},
        versiones:{orderBy:{version:"desc"},take:1,select:{version:true,datos:true,total:true}},
      }},
      hallazgos:{orderBy:[{prioridad:"asc"},{creadoEn:"asc"}],include:{fotografias:true}},
      certificado:true,
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}/reporte`);
  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  if (!esInspector && !([RolUsuario.DIRECTOR,RolUsuario.GERENTE,RolUsuario.COORDINADOR] as RolUsuario[]).includes(usuario.rol)) redirect("/acceso");

  const areas = await prisma.$queryRaw<Area[]>`
    SELECT a."id"::text,a."nombre",a."resultado",a."comentarioFinal",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id") "definidos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3" <> 'NO_APLICA') "aplicables",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3" IN ('REVISADO','CON_HALLAZGO')) "revisados",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3"='NO_APLICA') "noAplica",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre") "hallazgos"
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
    WHERE a."inspeccionId"=${id} AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL') AND fa."candidataPortada"=true LIMIT 1
  `;
  const [controlReporte] = await prisma.$queryRaw<ControlReporte[]>`
    SELECT "campoFinalizadoEn","inspeccionTecnicaConcluidaEn","preReporteGeneradoEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${id}
    LIMIT 1
  `;
  const portada = await signedUrl(fachada?.url ?? null);

  const evidenciasBase = await prisma.$queryRaw<EvidenciaCompleta[]>`
    SELECT
      f."id" AS "fotografiaId",
      fa."areaId"::text AS "areaId",
      a."nombre" AS "areaNombre",
      g."concepto",
      g."especificacion",
      g."observacion",
      g."estadoV3",
      g."valorMedido",
      g."valorProyecto",
      g."unidadMedida",
      f."url",
      f."descripcion",
      fa."orden"
    FROM "Fotografia" f
    LEFT JOIN "FotografiaArea" fa ON fa."fotografiaId"=f."id"
    LEFT JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
    LEFT JOIN "GuiaInspeccionItem" g ON g."id"=fa."guiaItemId"
    WHERE f."inspeccionId"=${id}
    ORDER BY COALESCE(a."orden",999999),COALESCE(g."orden",999999),COALESCE(fa."orden",999999),f."creadoEn"
  `;
  const evidencias = await Promise.all(
    evidenciasBase.map(async (e) => ({...e,urlFirmada:await signedUrl(e.url)})),
  );

  const hallazgosConEvidencia = await Promise.all(
    inspeccion.hallazgos.map(async (h) => ({
      ...h,
      fotografiasFirmadas: await Promise.all(
        h.fotografias.map(async (foto) => ({...foto,urlFirmada:await signedUrl(foto.url)})),
      ),
    })),
  );

  const snapshot = objetoJson(inspeccion.cotizacion?.versiones[0]?.datos);
  const areasDeclaradas = ESPACIOS_COTIZACION
    .filter(([clave]) => snapshot[clave] === true)
    .map(([,etiqueta]) => etiqueta);
  const otrosEspacios = textoSnapshot(snapshot,"otrosEspacios");
  const herramientasCotizadas = obtenerHerramientasCotizadasDesdeCotizacion(
    inspeccion.cotizacion?.observacionesInternas,
  );
  const herramientasPropuestas = HERRAMIENTAS_INSPECCION.filter((h) =>
    herramientasCotizadas.includes(h.codigo),
  );
  const referencias = referenciasNormativas(inspeccion.ciudad);

  const { resultados } = extraerResultadosInstrumentales(inspeccion.observaciones);
  const metricas = await obtenerMetricasV1(id);

  const prioridades = ["P1","P2","P3","P4","P5"] as const;
  const hallazgosP = prioridades.map(prioridad => ({prioridad,total:metricas.resumenPrioridades[prioridad]}));
  const autorizado = Boolean(inspeccion.certificado?.vigente);
  const calificacion = autorizado && inspeccion.certificado ? Number(inspeccion.certificado.ish) : metricas.calificacion;
  const calificacionTexto = Number(calificacion).toFixed(2);
  const coberturaTexto = metricas.cobertura.toFixed(2);
  const [autorizacionDireccion] = autorizado
    ? await prisma.$queryRaw<AutorizacionDireccion[]>`
        SELECT u."nombre", r."creadaEn"
        FROM "RevisionInspeccion" r
        JOIN "Usuario" u ON u."id"=r."usuarioId"
        WHERE r."inspeccionId"=${id}
          AND r."rol"='DIRECTOR'
          AND r."decision"='APROBADO'
          AND r."estado"='VIGENTE'
        ORDER BY r."creadaEn" DESC
        LIMIT 1
      `
    : [];
  const etiquetaCalificacion = autorizado ? "Calificación Técnica Certeza final" : "Calificación Técnica Certeza preliminar";
  const fechaEfectiva = controlReporte?.campoFinalizadoEn ?? inspeccion.fechaProgramada;
  const fecha = new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"long",year:"numeric",timeZone:inspeccion.zonaHoraria}).format(fechaEfectiva);
  const fechaAutorizacion = autorizacionDireccion
    ? new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:inspeccion.zonaHoraria}).format(autorizacionDireccion.creadaEn)
    : null;
  const tituloReporte = autorizado ? "Reporte Final de Inspección V1" : "Reporte de Inspección V1";
  const estadoReporte = autorizado ? "REPORTE FINAL AUTORIZADO" : "PRELIMINAR — PENDIENTE DE REVISIÓN Y AUTORIZACIÓN";

  let qr:string|null=null;
  if (autorizado && inspeccion.certificado) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    qr = await QRCode.toDataURL(`${base}/certificados/verificar/${inspeccion.certificado.codigoValidacion}`,{width:240,margin:1,errorCorrectionLevel:"M"});
  }

  return (
    <main className="min-h-screen bg-slate-200 px-3 py-6 text-slate-950 print:bg-white print:p-0">
      <style>{`@page{size:Letter;margin:12mm} @media print{.no-print{display:none!important}.page-break{break-before:page;page-break-before:always}.avoid-break{break-inside:avoid;page-break-inside:avoid}}`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3"><Link href={`/panel/inspecciones/${id}/cierre-v1`} className="font-black text-slate-700">← Cierre V1</Link><span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">{autorizado ? "REPORTE FINAL V1" : "PRE-REPORTE INTEGRAL V1"}</span></div>
      {(query.ok || query.error) && <div className={`no-print mx-auto mb-4 max-w-5xl rounded-2xl p-4 text-sm font-bold ${query.error ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-900"}`}>{query.error ?? query.ok}</div>}
      {!autorizado && esInspector && controlReporte?.inspeccionTecnicaConcluidaEn && !controlReporte.campoFinalizadoEn && (
        <section className="no-print mx-auto mb-4 max-w-5xl rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-800">Pre-reporte para revisión antes de salir del inmueble</p>
          <h2 className="mt-2 text-xl font-black">Revisa el documento completo</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">Verifica portada, cotización, áreas declaradas, alcances, herramientas, hallazgos, evidencias, interpretaciones, calificación, conclusiones, referencias y glosario. Si detectas una corrección, vuelve a la inspección antes de confirmar.</p>
          <div className="mt-4 flex flex-wrap gap-3"><Link href={`/panel/inspecciones/${id}/campo-v1`} className="rounded-xl border border-cyan-700/20 bg-white px-4 py-3 text-sm font-black text-cyan-900">VOLVER A CORREGIR INSPECCIÓN</Link><Link href={`/panel/inspecciones/${id}/reporte-evidencias`} className="rounded-xl border border-cyan-700/20 bg-white px-4 py-3 text-sm font-black text-cyan-900">REVISAR EVIDENCIAS</Link></div>
          <form action={confirmarPreReporteSitioV1} className="mt-4"><input type="hidden" name="inspeccionId" value={id}/><button disabled={Boolean(controlReporte.preReporteGeneradoEn)} className="w-full rounded-xl bg-cyan-800 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{controlReporte.preReporteGeneradoEn ? "PRE-REPORTE REVISADO EN SITIO ✓" : "CONFIRMAR REVISIÓN DEL PRE-REPORTE INTEGRAL"}</button></form>
        </section>
      )}
      <article className="mx-auto max-w-5xl bg-white shadow-xl print:max-w-none print:shadow-none">
        <section className="min-h-[245mm] bg-slate-950 px-10 py-9 text-white">
          <ReportBrandHeader title={tituloReporte} folio={inspeccion.folio} eyebrow="Método Certeza Habitacional · Inspección integral" dark />
          <div className={`mt-6 rounded-2xl border px-5 py-4 text-center text-xs font-black uppercase tracking-[.2em] ${autorizado ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>{estadoReporte}</div>
          {portada && <img src={portada} alt="Fachada principal" className="mt-8 h-72 w-full rounded-3xl object-cover" />}
          <div className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2">
            <Dato label="Cliente" value={inspeccion.cliente.nombre}/><Dato label="Inmueble" value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}/><Dato label="Dirección" value={`${inspeccion.direccion}, ${inspeccion.ciudad}`}/><Dato label="Fecha de inspección" value={fecha}/><Dato label="Inspector" value={inspeccion.inspector?.usuario.nombre ?? "Inspector asignado"}/><Dato label="Cotización" value={inspeccion.cotizacion?.folio ?? "Sin folio"}/>
          </div>
          {autorizacionDireccion && fechaAutorizacion && (
            <div className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-200">Autorizado por Dirección</p>
              <p className="mt-1 font-black text-white">{autorizacionDireccion.nombre}</p>
              <p className="mt-1 text-xs text-slate-300">{fechaAutorizacion}</p>
            </div>
          )}
          <p className="mt-8 text-xs font-black uppercase tracking-[.24em] text-amber-300">Certeza Habitacional · Documento técnico de inspección</p>
        </section>

        <Seccion n="01" titulo="Índice" subtitulo="Estructura del reporte">
          <ol className="grid gap-2 sm:grid-cols-2">{[
            "Resumen ejecutivo",
            "Datos declarados y alcance de la cotización",
            "Procedimiento y alcance técnico",
            "Funcionamiento e instalaciones",
            "Resumen de hallazgos por clasificación",
            "Reporte detallado de hallazgos",
            "Desarrollo por áreas",
            "Anexo completo de evidencias",
            "Resumen estadístico y calificación",
            "Herramientas propuestas y utilizadas",
            "Conclusiones finales",
            "Normatividad y bibliografía de apoyo",
            "Glosario",
            "Certificado Certeza Habitacional",
          ].map((x,i)=><li key={x} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold">{String(i+1).padStart(2,"0")} · {x}</li>)}</ol>
        </Seccion>

        <Seccion n="02" titulo="Resumen ejecutivo" subtitulo="Lectura rápida de resultados">
          <div className="grid gap-3 sm:grid-cols-5"><Metrica label="Cobertura" value={`${coberturaTexto}%`}/><Metrica label={etiquetaCalificacion} value={`${calificacionTexto}/100`}/><Metrica label="Áreas" value={String(metricas.areas)}/><Metrica label="Puntos revisados" value={String(metricas.revisados)}/><Metrica label="Áreas sin hallazgos" value={String(metricas.areasSinHallazgos)}/></div>
          <p className="mt-3 text-xs font-bold text-slate-500">Puntos definidos: {metricas.definidos} · No aplica: {metricas.noAplica} · Aplicables: {metricas.aplicables} · Revisados: {metricas.revisados}</p>
          <div className="mt-4 grid grid-cols-5 gap-2">{hallazgosP.map(({prioridad,total})=><Metrica key={prioridad} label={prioridad} value={String(total)}/>)}</div>
          <p className="mt-5 rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-200">La cobertura expresa qué proporción de los puntos aplicables fue efectivamente revisada. La Calificación Técnica Certeza es un indicador distinto y refleja la severidad acumulada de los hallazgos P1–P5. Una inspección puede alcanzar 100% de cobertura y, al mismo tiempo, obtener una calificación técnica baja si se detectaron condiciones relevantes.</p>
        </Seccion>

        <Seccion n="03" titulo="Datos declarados y alcance de la cotización" subtitulo="Información base proporcionada antes de la visita">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl bg-slate-100 p-4">
              <h3 className="font-black">Cliente e inmueble declarados</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">Cliente: {inspeccion.cliente.nombre}</p>
              <p className="text-sm leading-6 text-slate-700">Domicilio: {inspeccion.direccion}, {inspeccion.ciudad}</p>
              <p className="text-sm leading-6 text-slate-700">Terreno declarado: {textoSnapshot(snapshot,"m2Terreno") || "—"} m² · Construcción declarada: {textoSnapshot(snapshot,"m2Construccion") || inspeccion.superficieM2?.toString() || "—"} m²</p>
              <p className="text-sm leading-6 text-slate-700">Niveles: {textoSnapshot(snapshot,"niveles") || "—"} · Recámaras: {textoSnapshot(snapshot,"recamaras") || "—"} · Baños: {textoSnapshot(snapshot,"banos") || "—"}</p>
            </article>
            <article className="rounded-2xl bg-slate-100 p-4">
              <h3 className="font-black">Servicio contratado</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">Cotización: {inspeccion.cotizacion?.folio ?? "—"}</p>
              <p className="text-sm leading-6 text-slate-700">Paquete / servicio: {inspeccion.cotizacion?.paquete?.nombre ?? inspeccion.tipoServicio}</p>
              {inspeccion.cotizacion?.paquete?.descripcion && <p className="mt-2 text-sm leading-6 text-slate-600">{inspeccion.cotizacion.paquete.descripcion}</p>}
              <p className="mt-2 text-sm leading-6 text-slate-700">Importe cotizado: {new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(inspeccion.cotizacion?.total ?? 0))}</p>
            </article>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 p-5">
            <h3 className="font-black">Áreas declaradas por el cliente</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {areasDeclaradas.length > 0 ? areasDeclaradas.join(" · ") : "No existen áreas booleanas declaradas en la versión disponible de la cotización."}
              {otrosEspacios ? ` · Otros espacios: ${otrosEspacios}` : ""}
            </p>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 p-5">
            <h3 className="font-black">Alcances comerciales registrados</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Fila label="Precio base" value={new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(inspeccion.cotizacion?.precioBase ?? 0))}/>
              <Fila label="Metros adicionales" value={String(inspeccion.cotizacion?.metrosAdicionales ?? "0")}/>
              <Fila label="Cargo por metros adicionales" value={new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(inspeccion.cotizacion?.cargoMetrosAdicionales ?? 0))}/>
              <Fila label="Cargos extra" value={new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(inspeccion.cotizacion?.cargosExtra ?? 0))}/>
              <Fila label="Descuento" value={new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(inspeccion.cotizacion?.descuento ?? 0))}/>
              <Fila label="Total" value={new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(inspeccion.cotizacion?.total ?? 0))}/>
            </div>
            {inspeccion.cotizacion?.notas && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">Notas de cotización: {inspeccion.cotizacion.notas}</p>}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 p-5">
            <h3 className="font-black">Herramienta propuesta en la cotización</h3>
            {herramientasPropuestas.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {herramientasPropuestas.map((h) => <article key={h.codigo} className="rounded-xl bg-cyan-50 p-3"><p className="font-black text-cyan-900">{h.nombre}</p><p className="mt-1 text-xs leading-5 text-slate-600">{h.aplicacionCotizacion}</p></article>)}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">No existe una selección instrumental estructurada registrada en esta cotización. El reporte no presume herramientas que no estén documentadas.</p>
            )}
          </div>
        </Seccion>

        <Seccion n="04" titulo="Procedimiento y alcance" subtitulo="Cómo se ejecutó la inspección">
          <p className="text-sm leading-7 text-slate-700">El Método Certeza Habitacional parte del alcance aceptado en la cotización, incorpora la información de proyecto disponible, inicia con las pruebas funcionales e instalaciones y continúa con una revisión secuencial área por área. Cada área se cierra con hallazgos documentados o con evidencia satisfactoria cuando no se identifican anomalías relevantes.</p>
        </Seccion>

        <Seccion n="05" titulo="Funcionamiento e instalaciones" subtitulo="Pruebas y procesos técnicos ejecutados">
          <div className="space-y-3">{procesos.map((p)=><article key={`${p.orden}-${p.nombre}`} className="avoid-break rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><h3 className="font-black">{p.nombre}</h3><span className="text-xs font-black text-cyan-700">{p.estado.replaceAll('_',' ')}</span></div>{(p.lecturaInicial!==null||p.lecturaFinal!==null)&&<p className="mt-2 text-sm font-bold text-slate-700">Lectura inicial: {p.lecturaInicial ?? '—'} {p.unidad ?? ''} · Lectura final: {p.lecturaFinal ?? '—'} {p.unidad ?? ''}</p>}{p.comentario&&<p className="mt-2 text-sm leading-6 text-slate-600">{p.comentario}</p>}</article>)}</div>
          <div className="mt-6 rounded-2xl bg-cyan-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-cyan-800">Tecnología aplicada en estos procesos</p><p className="mt-2 text-sm text-slate-700">Las lecturas y verificaciones instrumentales registradas se presentan en su contexto técnico y se resumen nuevamente en la sección de herramientas y tecnología.</p></div>
        </Seccion>

        <Seccion n="06" titulo="Resumen de hallazgos por clasificación" subtitulo="Prioridad, clasificación y distribución">
          <div className="grid gap-3 sm:grid-cols-5">{hallazgosP.map(({prioridad,total})=><Metrica key={prioridad} label={prioridad} value={String(total)}/>)}</div>
          <div className="mt-5 space-y-3">
            {hallazgosConEvidencia.map((h) => <article key={h.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-black">{h.titulo}</h3><div className="flex gap-2"><span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{h.clasificacion}</span><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">{h.prioridad}</span></div></div><p className="mt-2 text-sm text-slate-500">{h.area}{h.ubicacion ? ` · ${h.ubicacion}` : ""}</p><p className="mt-2 text-sm leading-6 text-slate-700">{h.descripcion}</p></article>)}
          </div>
        </Seccion>

        <Seccion n="07" titulo="Reporte detallado de hallazgos" subtitulo="Hallazgo por hallazgo, con evidencia e interpretación final">
          <div className="space-y-8">
            {hallazgosConEvidencia.length === 0 && <p className="rounded-2xl bg-emerald-50 p-5 font-bold text-emerald-900">No se registraron hallazgos.</p>}
            {hallazgosConEvidencia.map((h,index) => <article key={h.id} className="avoid-break rounded-3xl border border-slate-200 p-5">
              <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-cyan-700">Hallazgo {index+1}</p><h3 className="mt-1 text-xl font-black">{h.titulo}</h3></div><div className="flex gap-2"><span className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">{h.clasificacion}</span><span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-black text-amber-900">{h.prioridad}</span></div></div>
              <p className="mt-4 text-sm leading-7 text-slate-700"><strong>Interpretación final confirmada por el Inspector:</strong> {h.descripcion}</p>
              {h.recomendacion && <p className="mt-2 text-sm leading-7 text-slate-700"><strong>Recomendación:</strong> {h.recomendacion}</p>}
              {h.fotografiasFirmadas.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{h.fotografiasFirmadas.map((foto,i)=><figure key={foto.id} className="overflow-hidden rounded-2xl border border-slate-200">{foto.urlFirmada?<img src={foto.urlFirmada} alt={foto.descripcion ?? h.titulo} className="h-56 w-full object-contain bg-slate-950"/>:<div className="grid h-56 place-items-center bg-slate-100 text-xs text-slate-400">Imagen no disponible</div>}<figcaption className="p-3 text-xs text-slate-500">{foto.descripcion ?? `Evidencia ${i+1}`}</figcaption></figure>)}</div>}
            </article>)}
          </div>
        </Seccion>

        <Seccion n="08" titulo="Desarrollo por áreas" subtitulo="Conceptos revisados, resultados, hallazgos y evidencia">
          <div className="space-y-6">{areas.map((a)=>{const hs=inspeccion.hallazgos.filter(h=>h.area===a.nombre);const fs=fotosPorArea.get(a.id)??[];return <article key={a.id} className="rounded-3xl border border-slate-200 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-black">{a.nombre}</h3><p className="mt-1 text-xs font-bold text-slate-500">{a.aplicables} puntos aplicables · {a.noAplica} excluidos por No aplica</p></div><span className={`rounded-full px-3 py-2 text-xs font-black ${a.resultado==='SIN_HALLAZGOS'?'bg-emerald-100 text-emerald-800':a.resultado==='NO_APLICA'?'bg-slate-200 text-slate-700':'bg-amber-100 text-amber-900'}`}>{a.resultado==='NO_APLICA'?'NO INSPECCIONADA / DESHABILITADA':(a.resultado??'PENDIENTE').replaceAll('_',' ')}</span></div>{a.comentarioFinal&&<p className="mt-4 text-sm leading-7 text-slate-700">{a.comentarioFinal}</p>}{hs.map(h=><div key={h.id} className="mt-4 rounded-2xl bg-slate-950 p-4 text-white"><div className="flex justify-between gap-3"><h4 className="font-black">{h.titulo}</h4><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{h.prioridad}</span></div><p className="mt-2 text-sm leading-6 text-slate-300">{h.descripcion}</p></div>)}{fs.length>0&&<div className="mt-4 grid grid-cols-2 gap-3">{fs.slice(0,4).map((f,i)=><figure key={`${a.id}-${i}`} className="overflow-hidden rounded-2xl border border-slate-200">{f.urlFirmada?<img src={f.urlFirmada} alt={f.descripcion??a.nombre} className="h-44 w-full object-cover"/>:<div className="grid h-44 place-items-center bg-slate-100 text-xs text-slate-400">Imagen no disponible</div>}<figcaption className="p-2 text-xs text-slate-500">{f.descripcion??`Evidencia ${i+1}`}</figcaption></figure>)}</div>}</article>})}</div>
        </Seccion>

        <Seccion n="09" titulo="Anexo completo de evidencias" subtitulo="Todas las fotografías y datos asociados registrados en la inspección">
          <div className="space-y-5">
            {evidencias.length === 0 && <p className="rounded-2xl bg-slate-100 p-5 text-sm text-slate-600">No existen evidencias fotográficas registradas.</p>}
            {evidencias.map((e,index) => {
              const obs = observacionConcepto(e.observacion);
              return <article key={e.fotografiaId} className="avoid-break rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-4 md:grid-cols-[260px_1fr]">
                  {e.urlFirmada?<img src={e.urlFirmada} alt={e.descripcion ?? e.concepto ?? `Evidencia ${index+1}`} className="h-52 w-full rounded-xl bg-slate-950 object-contain"/>:<div className="grid h-52 place-items-center rounded-xl bg-slate-100 text-xs text-slate-400">Imagen no disponible</div>}
                  <div><p className="text-xs font-black uppercase tracking-wider text-cyan-700">Evidencia {index+1}</p><h3 className="mt-1 font-black">{e.areaNombre ?? "Evidencia general"}{e.concepto ? ` · ${e.concepto}` : ""}</h3>{e.especificacion&&<p className="mt-2 text-xs leading-5 text-slate-500">{e.especificacion}</p>}{obs.descripcionFinal&&<p className="mt-3 text-sm leading-6 text-slate-700"><strong>Interpretación final:</strong> {obs.descripcionFinal}</p>}{e.valorMedido&&<p className="mt-2 text-sm text-slate-700"><strong>Medición:</strong> {e.valorMedido} {e.unidadMedida ?? ""}{e.valorProyecto ? ` · Proyecto: ${e.valorProyecto} ${e.unidadMedida ?? ""}` : ""}</p>}<p className="mt-2 text-xs text-slate-500">{e.descripcion ?? "Sin descripción adicional de archivo."}</p></div>
                </div>
              </article>;
            })}
          </div>
        </Seccion>

        <Seccion n="10" titulo="Resumen estadístico" subtitulo="Cobertura, calificación y distribución de resultados">
          <div className="grid gap-3 sm:grid-cols-5"><Metrica label="Cobertura efectiva" value={`${coberturaTexto}%`}/><Metrica label="Calificación Técnica Certeza" value={`${calificacionTexto}/100`}/><Metrica label="Puntos aplicables" value={String(metricas.aplicables)}/><Metrica label="Puntos revisados" value={String(metricas.revisados)}/><Metrica label="Hallazgos" value={String(metricas.totalHallazgos)}/></div>
          <p className="mt-3 text-xs font-bold text-slate-500">Áreas satisfactorias: {metricas.areasSinHallazgos} · Carga de severidad: {metricas.cargaSeveridad}</p>
          <div className="mt-4 grid grid-cols-5 gap-2">{hallazgosP.map(({prioridad,total})=><Metrica key={prioridad} label={prioridad} value={String(total)}/>)}</div>
        </Seccion>

        <Seccion n="11" titulo="Herramientas y tecnología utilizadas" subtitulo="Función, aplicación y ventaja técnica">
          <p className="mb-5 text-sm leading-6 text-slate-600">Esta relación se construye a partir de los resultados efectivamente registrados durante la inspección. La Aplicación Certeza Habitacional forma parte integral del método y los equipos físicos aparecen únicamente cuando su uso quedó documentado.</p>
          <TecnologiaInspeccionV1 resultados={resultados} mostrarNoEjecutadas />
        </Seccion>

        <Seccion n="12" titulo="Conclusiones finales" subtitulo="Síntesis técnica del resultado de la inspección">
          <p className="rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-200">{metricas.dictamen}</p>
          <p className="mt-4 text-sm leading-7 text-slate-700">Cobertura efectiva: <strong>{coberturaTexto}%</strong>. Calificación Técnica Certeza: <strong>{calificacionTexto}/100</strong>. Hallazgos documentados: <strong>{metricas.totalHallazgos}</strong>. La conclusión se limita al alcance contratado, a las áreas accesibles y a las condiciones visibles o medibles durante la visita.</p>
        </Seccion>

        <Seccion n="13" titulo="Normatividad y bibliografía de apoyo" subtitulo="Referencias utilizadas como marco técnico">
          <p className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Las referencias se aplican únicamente cuando corresponden al elemento y alcance efectivamente revisado. Una inspección visual o instrumental de vivienda no sustituye por sí sola un dictamen oficial de cumplimiento normativo, estructural, eléctrico o de gas emitido por la autoridad o especialista competente.</p>
          <div className="space-y-3">{referencias.map((ref)=><article key={ref.titulo} className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">{ref.titulo}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{ref.uso}</p><p className="mt-2 break-all text-xs text-cyan-700">{ref.fuente}</p></article>)}</div>
        </Seccion>

        <Seccion n="14" titulo="Glosario" subtitulo="Términos para facilitar la lectura del reporte">
          <div className="grid gap-3 sm:grid-cols-2">{GLOSARIO.map(([t,d])=><article key={t} className="rounded-2xl bg-slate-100 p-4"><h3 className="font-black">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{d}</p></article>)}</div>
        </Seccion>

        <section className="page-break px-10 py-10">
          <ReportBrandHeader title="Certificado Certeza Habitacional" folio={autorizado && inspeccion.certificado ? inspeccion.certificado.folio : inspeccion.folio} eyebrow="Resultado final autorizado" />
          {autorizado && inspeccion.certificado ? <div className="mt-10 rounded-[2rem] border-8 border-slate-950 p-8"><div className="border-2 border-amber-500 p-8 text-center"><h2 className="text-3xl font-black">Certificado Certeza Habitacional</h2><div className="mt-8 grid gap-8 md:grid-cols-[1fr_190px]"><div className="text-left"><Fila label="Inmueble" value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}/><Fila label="Inspección" value={inspeccion.folio}/><Fila label="Fecha de inspección" value={fecha}/>{autorizacionDireccion&&fechaAutorizacion&&<Fila label="Autorizado por Dirección" value={`${autorizacionDireccion.nombre} · ${fechaAutorizacion}`}/>}<Fila label="Cobertura" value={`${coberturaTexto}%`}/><Fila label="Calificación Técnica Certeza" value={`${Number(inspeccion.certificado.ish).toFixed(2)}/100`}/><Fila label="Áreas revisadas" value={String(metricas.areas)}/><Fila label="Puntos revisados" value={String(metricas.revisados)}/><Fila label="Hallazgos P1–P5" value={`P1 ${metricas.resumenPrioridades.P1} · P2 ${metricas.resumenPrioridades.P2} · P3 ${metricas.resumenPrioridades.P3} · P4 ${metricas.resumenPrioridades.P4} · P5 ${metricas.resumenPrioridades.P5}`}/><Fila label="Áreas sin hallazgos" value={String(metricas.areasSinHallazgos)}/></div>{qr&&<div className="text-center"><img src={qr} alt="QR de validación" className="mx-auto h-44 w-44"/><p className="mt-2 text-xs font-black">Validar certificado y consultar información autorizada</p></div>}</div><p className="mt-8 text-sm leading-7 text-slate-600">{inspeccion.certificado.dictamen}</p></div></div>:<div className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900"><p className="font-black">Certificado pendiente de autorización</p><p className="mt-2 text-sm leading-6">Este reporte todavía es preliminar. El certificado se generará únicamente cuando Dirección autorice el reporte final.</p></div>}
        </section>
      </article>
    </main>
  );
}

function Seccion({n,titulo,subtitulo,children}:{n:string;titulo:string;subtitulo:string;children:React.ReactNode}){return <section className="px-10 py-8"><header className="mb-5 flex gap-4 border-b border-slate-200 pb-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-sm font-black text-amber-300">{n}</span><div><h2 className="text-2xl font-black">{titulo}</h2><p className="mt-1 text-sm text-slate-500">{subtitulo}</p></div></header>{children}</section>}
function Dato({label,value}:{label:string;value:string}){return <div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{label}</p><p className="mt-1 font-bold">{value}</p></div>}
function Metrica({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-slate-100 p-3 text-center"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p></div>}
function Fila({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-6 border-b border-slate-100 py-2"><span className="text-slate-500">{label}</span><strong className="text-right">{value}</strong></div>}