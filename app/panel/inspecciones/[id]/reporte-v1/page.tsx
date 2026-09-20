import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { auth } from "@/auth";
import ReportBrandHeader from "@/components/branding/ReportBrandHeader";
import { DATOS_DOCUMENTALES, datosContactoDocumento } from "@/lib/datos-documentales";
import TecnologiaInspeccionV1 from "@/components/reportes/TecnologiaInspeccionV1";
import { nivelEvaluacionV1, obtenerMetricasV1 } from "@/lib/calificacion-v1";
import { evaluarPromedioV1, referenciaPrioridadV1 } from "@/lib/evaluacion-reporte-v1";
import { extraerResultadosInstrumentales } from "@/lib/resultados-instrumentales";
import {
  HERRAMIENTAS_INSPECCION,
  obtenerHerramientasCotizadasDesdeCotizacion,
} from "@/lib/herramientas-inspeccion";
import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";
import { confirmarPreReporteSitioV1 } from "../pre-reporte/actions";

async function signedUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const sb = obtenerSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

type Area = {
  id:string;
  orden:number;
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
type FotoArea = { areaId:string; guiaItemId:string|null; url:string; descripcion:string|null };
type ConceptoReporte = {
  id:string;
  areaId:string;
  concepto:string;
  especificacion:string|null;
  observacion:string|null;
  estadoV3:string|null;
  valorMedido:string|null;
  valorProyecto:string|null;
  unidadMedida:string|null;
  orden:number|null;
};
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
  calificacionFinal?: number;
  evaluacionFinal?: number;
};
type SnapshotCotizacion = Record<string, unknown>;
type AutorizacionDireccion = { nombre: string; creadaEn: Date };

const GLOSARIO = [
  ["P1 · 0–49", "Nivel de evaluación correspondiente a una condición crítica o severamente deficiente."],
  ["P2 · 50–69", "Nivel de evaluación correspondiente a una condición deficiente que requiere atención importante."],
  ["P3 · 70–79", "Nivel de evaluación aceptable con deficiencias relevantes o seguimiento necesario."],
  ["P4 · 80–89", "Nivel de evaluación de condición buena con observaciones menores."],
  ["P5 · 90–99", "Nivel de evaluación de condición muy buena con detalles menores."],
  ["SH · 100", "Sin Hallazgo. El concepto inspeccionado no registró una condición adversa dentro del alcance revisado."],
  ["Conforme", "Clasificación técnica para un elemento que satisface el criterio revisado dentro del alcance de la inspección."],
  ["Observación", "Condición que conviene documentar o dar seguimiento sin que necesariamente implique una no conformidad."],
  ["No Conforme", "Condición que no satisface el criterio técnico considerado dentro del alcance revisado."],
  ["Crítico", "Condición que por su naturaleza, riesgo o impacto requiere atención prioritaria."],
  ["Hermeticidad", "Capacidad de una instalación para mantener presión o estanqueidad durante una prueba controlada."],
  ["Desplome", "Desviación de un elemento vertical respecto de la vertical esperada."],
  ["Auscultación", "Revisión mediante percusión, rodamiento u otra técnica para identificar indicios de huecos, desprendimientos u otras condiciones."],
  ["Lambrín", "Recubrimiento colocado sobre muros, comúnmente cerámico, pétreo u otro acabado."],
  ["No aplica", "Punto previsto en la plantilla que no corresponde al elemento real del inmueble y se excluye de la evaluación."],
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
    SELECT a."id"::text,a."orden",a."nombre",a."resultado",a."comentarioFinal",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id") "definidos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3" <> 'NO_APLICA') "aplicables",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3" IN ('REVISADO','CON_HALLAZGO')) "revisados",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3"='NO_APLICA') "noAplica",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre") "hallazgos"
    FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true ORDER BY a."orden",a."nombre"
  `;

  const conceptosReporte = await prisma.$queryRaw<ConceptoReporte[]>`
    SELECT
      g."id"::text AS "id",
      g."areaId"::text AS "areaId",
      g."concepto",
      g."especificacion",
      g."observacion",
      g."estadoV3",
      g."valorMedido",
      g."valorProyecto",
      g."unidadMedida",
      g."orden"
    FROM "GuiaInspeccionItem" g
    WHERE g."inspeccionId"=${id}
    ORDER BY g."areaId", COALESCE(g."orden",999999), g."concepto"
  `;
  const conceptosPorArea = new Map<string, ConceptoReporte[]>();
  for (const concepto of conceptosReporte) {
    if (!["REVISADO","CON_HALLAZGO"].includes(concepto.estadoV3 ?? "")) continue;
    conceptosPorArea.set(concepto.areaId,[...(conceptosPorArea.get(concepto.areaId)??[]),concepto]);
  }

  const procesos = await prisma.$queryRaw<Proceso[]>`
    SELECT "orden","nombre","estado","lecturaInicial","lecturaFinal","unidad","comentario"
    FROM "ProtocoloInspeccionPaso" WHERE "inspeccionId"=${id} ORDER BY "orden"
  `;

  const fotosArea = await prisma.$queryRaw<FotoArea[]>`
    SELECT fa."areaId"::text "areaId",fa."guiaItemId"::text "guiaItemId",f."url",f."descripcion"
    FROM "FotografiaArea" fa JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
    WHERE a."inspeccionId"=${id} AND fa."seleccionadaReporte"=true ORDER BY a."orden",fa."orden",fa."creadoEn"
  `;
  const fotosFirmadas = await Promise.all(fotosArea.map(async f => ({...f,urlFirmada:await signedUrl(f.url)})));
  const fotosPorArea = new Map<string, typeof fotosFirmadas>();
  const fotosPorConcepto = new Map<string, typeof fotosFirmadas>();
  for (const f of fotosFirmadas) {
    fotosPorArea.set(f.areaId,[...(fotosPorArea.get(f.areaId)??[]),f]);
    if (f.guiaItemId) fotosPorConcepto.set(f.guiaItemId,[...(fotosPorConcepto.get(f.guiaItemId)??[]),f]);
  }

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
    ORDER BY COALESCE(a."orden",999999),COALESCE(g."orden",999999),COALESCE(fa."orden",999999),f."creadaEn"
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
  const alcanceCotizacion = textoSnapshot(snapshot,"procedimientoAlcance")
    || textoSnapshot(snapshot,"alcance")
    || textoSnapshot(snapshot,"punto3")
    || inspeccion.cotizacion?.paquete?.descripcion
    || "El alcance se limita al servicio contratado, a las áreas declaradas, accesibles y seguras para inspección y a las verificaciones visuales, funcionales e instrumentales que correspondan.";
  const serviciosCotizacion = textoSnapshot(snapshot,"serviciosVerificaciones")
    || textoSnapshot(snapshot,"verificacionesInstrumentales")
    || textoSnapshot(snapshot,"punto4");
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

  const evaluacionConcepto = (concepto: ConceptoReporte) => {
    const obs = observacionConcepto(concepto.observacion);
    const hallazgo = inspeccion.hallazgos.find((h) => h.guiaItemId === concepto.id);
    const capturada = Number(obs.calificacionFinal ?? obs.evaluacionFinal);
    const calificacion = Number.isFinite(capturada) && capturada >= 0 && capturada <= 100
      ? capturada
      : hallazgo
        ? referenciaPrioridadV1(hallazgo.prioridad)
        : 100;
    return { calificacion, nivel: nivelEvaluacionV1(calificacion), hallazgo };
  };

  const evaluacionesPorArea = new Map<string,{calificacion:number;nivel:string}>();
  const numeroConcepto = new Map<string,number>();
  let consecutivoConcepto = 1;
  for (const area of areas) {
    const conceptos = conceptosPorArea.get(area.id) ?? [];
    for (const concepto of conceptos) {
      numeroConcepto.set(concepto.id,consecutivoConcepto);
      consecutivoConcepto += 1;
    }
    evaluacionesPorArea.set(area.id,evaluarPromedioV1(conceptos.map((g)=>evaluacionConcepto(g).calificacion)));
  }

  const prioridades = ["P1","P2","P3","P4","P5"] as const;
  const hallazgosP = prioridades.map(prioridad => ({prioridad,total:metricas.resumenPrioridades[prioridad]}));
  const autorizado = Boolean(inspeccion.certificado?.vigente);
  const calificacion = autorizado && inspeccion.certificado ? Number(inspeccion.certificado.ish) : metricas.calificacion;
  const calificacionTexto = Number(calificacion).toFixed(2);
  const nivelEvaluacion = nivelEvaluacionV1(Number(calificacion));
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
  const tituloReporte = autorizado ? "Reporte Final de Inspección V1" : "Pre-Reporte de Inspección V1";
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
      {!autorizado && esInspector && controlReporte?.inspeccionTecnicaConcluidaEn && inspeccion.estado === "EN_PROCESO" && (
        <section className="no-print mx-auto mb-4 max-w-5xl rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-800">
            {controlReporte.campoFinalizadoEn ? "Pre-reporte actualizado · última revisión del Inspector" : "Pre-reporte para revisión antes de salir del inmueble"}
          </p>
          <h2 className="mt-2 text-xl font-black">Revisa el documento completo</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Verifica portada, cotización, áreas declaradas, alcances, herramientas, hallazgos, evidencias, interpretaciones, calificación, conclusiones, referencias y glosario. Si detectas una corrección, pasa a la última revisión y ajuste; cualquier cambio invalidará esta confirmación hasta que vuelvas a revisar el pre-reporte actualizado.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {controlReporte.preReporteGeneradoEn && (
              <Link href={`/panel/inspecciones/${id}/revision-final-inspector`} className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white">ÚLTIMA REVISIÓN Y AJUSTE</Link>
            )}
            <Link href={`/panel/inspecciones/${id}/campo-v1`} className="rounded-xl border border-cyan-700/20 bg-white px-4 py-3 text-sm font-black text-cyan-900">CORREGIR PARTIDAS / CONCEPTOS</Link>
            <Link href={`/panel/inspecciones/${id}/reporte-evidencias`} className="rounded-xl border border-cyan-700/20 bg-white px-4 py-3 text-sm font-black text-cyan-900">REVISAR EVIDENCIAS</Link>
          </div>
          <form action={confirmarPreReporteSitioV1} className="mt-4">
            <input type="hidden" name="inspeccionId" value={id}/>
            <button disabled={Boolean(controlReporte.preReporteGeneradoEn)} className="w-full rounded-xl bg-cyan-800 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
              {controlReporte.preReporteGeneradoEn
                ? "PRE-REPORTE ACTUAL CONFIRMADO ✓"
                : controlReporte.campoFinalizadoEn
                  ? "CONFIRMAR PRE-REPORTE ACTUALIZADO"
                  : "CONFIRMAR REVISIÓN DEL PRE-REPORTE INTEGRAL"}
            </button>
          </form>
          {controlReporte.preReporteGeneradoEn && (
            <Link href={`/panel/inspecciones/${id}/revision-final-inspector`} className="mt-4 block rounded-xl bg-violet-700 px-5 py-3 text-center font-black text-white">
              PASAR A ÚLTIMA REVISIÓN Y AJUSTE →
            </Link>
          )}
        </section>
      )}
      <article className="mx-auto max-w-5xl bg-white shadow-xl print:max-w-none print:shadow-none">
        <section className="min-h-[245mm] bg-slate-950 p-6 text-white">
          <div className="min-h-[232mm] border-[3px] border-amber-400/80 p-2">
            <div className="min-h-[228mm] border border-amber-200/30 px-8 py-7">
              <ReportBrandHeader title={autorizado?"REPORTE FINAL":"PRE-REPORTE"} folio={inspeccion.folio} eyebrow="Certeza Habitacional · Inspección profesional de vivienda" dark />
              <div className={`mt-5 rounded-xl border px-5 py-3 text-center text-[10px] font-black uppercase tracking-[.2em] ${autorizado?"border-emerald-300/30 bg-emerald-300/10 text-emerald-200":"border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>{estadoReporte}</div>
              {portada?<figure className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-2"><img src={portada} alt="Fachada frontal de la vivienda" className="h-[310px] w-full object-contain"/><figcaption className="pt-2 text-center text-[10px] uppercase tracking-wider text-slate-400">Fachada frontal de la vivienda inspeccionada</figcaption></figure>:<div className="mt-6 grid h-[310px] place-items-center rounded-2xl border border-dashed border-white/20 text-sm text-slate-400">Fotografía frontal no disponible</div>}
              <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-2">
                <Dato label="Cliente" value={inspeccion.cliente.nombre}/>
                <Dato label="Inmueble" value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}/>
                <Dato label="Dirección" value={`${inspeccion.direccion}, ${inspeccion.ciudad}`}/>
                <Dato label="Fecha de inspección" value={fecha}/>
                <Dato label="Inspector" value={inspeccion.inspector?.usuario.nombre ?? "Inspector asignado"}/>
                <Dato label="Cotización de origen" value={inspeccion.cotizacion?.folio ?? "Sin folio"}/>
              </div>
              <div className="mt-5 flex items-end justify-between border-t border-amber-300/30 pt-4">
                <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Método Certeza</p><p className="mt-1 text-xs text-slate-400">Experiencia técnica + metodología + tecnología + criterio profesional</p></div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{DATOS_DOCUMENTALES.eslogan}</p>
              </div>
            </div>
          </div>
        </section>

        <Seccion folio={inspeccion.folio} n="01" titulo="Índice" subtitulo="Estructura del reporte">
          <ol className="grid gap-2 sm:grid-cols-2">{[
            "Resumen ejecutivo",
            "Datos declarados",
            "Procedimiento y alcance",
            "Servicios y verificaciones instrumentales",
            "Desarrollo de la inspección",
            "Resumen por partida",
            "Tecnología Certeza Habitacional",
            "Conclusiones",
            "Bibliografía y normatividad de apoyo",
            "Glosario",
            "Certificado Certeza Habitacional",
          ].map((x,i)=><li key={x} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold">{String(i+1).padStart(2,"0")} · {x}</li>)}</ol>
        </Seccion>

        <Seccion folio={inspeccion.folio} n="02" titulo="Resumen ejecutivo" subtitulo="Lectura rápida de resultados">
          <div className="grid gap-3 sm:grid-cols-6"><Metrica label="Cobertura" value={`${coberturaTexto}%`}/><Metrica label={etiquetaCalificacion} value={`${calificacionTexto}/100`}/><Metrica label="Nivel de evaluación" value={nivelEvaluacion}/><Metrica label="Áreas" value={String(metricas.areas)}/><Metrica label="Puntos revisados" value={String(metricas.revisados)}/><Metrica label="Áreas sin hallazgos" value={String(metricas.areasSinHallazgos)}/></div>
          <p className="mt-3 text-xs font-bold text-slate-500">Puntos definidos: {metricas.definidos} · Inspeccionados: {metricas.revisados} · No aplica: {metricas.noAplica} · No inspeccionados / sin acceso u otra causa: {Math.max(metricas.aplicables - metricas.revisados, 0)}</p>
          <div className="mt-4 grid grid-cols-5 gap-2">{hallazgosP.map(({prioridad,total})=><Metrica key={prioridad} label={`Prioridad ${prioridad}`} value={String(total)}/>)}</div>
          <p className="mt-5 rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-200">La cobertura expresa qué proporción de los puntos aplicables fue efectivamente revisada. La calificación se expresa de 0 a 100 y se traduce a la escala de evaluación P1 0–49, P2 50–69, P3 70–79, P4 80–89, P5 90–99 y SH 100. La prioridad P1–P5 de cada hallazgo se presenta por separado y no debe confundirse con el nivel global de evaluación.</p>
        </Seccion>

        <Seccion folio={inspeccion.folio} n="03" titulo="Datos declarados" subtitulo="Información proporcionada y registrada antes de la visita">
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
              
            </article>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 p-5">
            <h3 className="font-black">Áreas declaradas por el cliente</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {areasDeclaradas.length > 0 ? areasDeclaradas.join(" · ") : "No existen áreas booleanas declaradas en la versión disponible de la cotización."}
              {otrosEspacios ? ` · Otros espacios: ${otrosEspacios}` : ""}
            </p>
          </div>
                  </Seccion>

        <Seccion folio={inspeccion.folio} n="04" titulo="Procedimiento y alcance" subtitulo="Alcance contratado y metodología aplicada">
          <div className="rounded-2xl border-l-4 border-amber-500 bg-amber-50 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-amber-900">Alcance documentado en la cotización</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{alcanceCotizacion}</p>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 p-5">
            <h3 className="font-black">Procedimiento de inspección</h3>
            <p className="mt-2 text-sm leading-7 text-slate-700">La inspección se desarrolla de manera secuencial y trazable: revisión de información disponible, pruebas y verificaciones iniciales, recorrido sistemático por partidas y conceptos, registro de evidencia, interpretación técnica y cierre de cada punto. Las condiciones se documentan únicamente dentro del alcance accesible y seguro observado durante la visita.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-100 p-4"><p className="text-xs font-black uppercase text-slate-500">Áreas declaradas</p><p className="mt-2 text-sm leading-6">{areasDeclaradas.length?areasDeclaradas.join(" · "):"Sin áreas estructuradas declaradas"}{otrosEspacios?` · ${otrosEspacios}`:""}</p></div>
            <div className="rounded-2xl bg-slate-100 p-4"><p className="text-xs font-black uppercase text-slate-500">Limitación esencial</p><p className="mt-2 text-sm leading-6">El reporte no afirma condiciones de elementos ocultos, inaccesibles, no aplicables o no inspeccionados; dichas exclusiones se contabilizan en las estadísticas de alcance.</p></div>
          </div>
        </Seccion>

        <Seccion folio={inspeccion.folio} n="05" titulo="Servicios y verificaciones instrumentales" subtitulo="Servicios previstos en cotización y verificaciones efectivamente ejecutadas">
          {serviciosCotizacion&&<div className="mb-5 rounded-2xl border-l-4 border-amber-500 bg-amber-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-amber-900">Servicios documentados en la cotización</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{serviciosCotizacion}</p></div>}
          <div className="rounded-2xl border border-slate-200 p-5">
            <h3 className="font-black">Herramientas y verificaciones previstas</h3>
            {herramientasPropuestas.length>0?<div className="mt-3 grid gap-3 sm:grid-cols-2">{herramientasPropuestas.map((h)=><article key={h.codigo} className="rounded-xl bg-cyan-50 p-3"><p className="font-black text-cyan-900">{h.nombre}</p><p className="mt-1 text-xs leading-5 text-slate-600">{h.aplicacionCotizacion}</p></article>)}</div>:<p className="mt-3 text-sm text-slate-600">La cotización disponible no contiene una selección instrumental estructurada.</p>}
          </div>
          <div className="mt-5 space-y-3">
            {procesos.map((p)=><article key={`${p.orden}-${p.nombre}`} className="avoid-break rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">Verificación {p.orden}</p><h3 className="font-black">{p.nombre}</h3></div><span className="text-xs font-black text-cyan-700">{p.estado.replaceAll("_"," ")}</span></div>{(p.lecturaInicial!==null||p.lecturaFinal!==null)&&<p className="mt-2 text-sm font-bold text-slate-700">Lectura inicial: {p.lecturaInicial??"—"} {p.unidad??""} · Lectura final: {p.lecturaFinal??"—"} {p.unidad??""}</p>}{p.comentario&&<p className="mt-2 text-sm leading-6 text-slate-600">{p.comentario}</p>}</article>)}
          </div>
        </Seccion>

        <Seccion folio={inspeccion.folio} n="06" titulo="Desarrollo de la inspección" subtitulo="Inspección documentada punto por punto y organizada por partida">
          <div className="space-y-8">
            {areas.filter((a)=>(conceptosPorArea.get(a.id)??[]).length>0).map((a)=>{
              const conceptos=conceptosPorArea.get(a.id)??[];
              const evaluacionArea=evaluacionesPorArea.get(a.id);
              return <article key={a.id} className="rounded-3xl border-2 border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-amber-700">Partida {a.orden}</p>
                    <h3 className="mt-1 text-2xl font-black">{a.nombre}</h3>
                    <p className="mt-2 text-xs font-bold text-slate-500">{conceptos.length} conceptos inspeccionados · {a.noAplica} no aplica · {Math.max(a.aplicables-a.revisados,0)} no inspeccionados / sin acceso u otra causa</p>
                  </div>
                  {evaluacionArea&&<div className="rounded-2xl bg-slate-950 px-5 py-3 text-right text-white"><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Evaluación de partida</p><p className="mt-1 text-2xl font-black">{evaluacionArea.calificacion.toFixed(2)} <span className="text-base text-amber-300">{evaluacionArea.nivel}</span></p></div>}
                </div>
                <div className="mt-5 space-y-5">
                  {conceptos.map((g)=>{
                    const obs=observacionConcepto(g.observacion);
                    const ev=evaluacionConcepto(g);
                    const fotos=fotosPorConcepto.get(g.id)??[];
                    const tieneHallazgo=Boolean(ev.hallazgo)||g.estadoV3==="CON_HALLAZGO";
                    return <section key={g.id} className="avoid-break rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-700">Punto {numeroConcepto.get(g.id)} · Partida {a.orden}</p>
                          <h4 className="mt-1 text-lg font-black">{g.concepto}</h4>
                          {g.especificacion&&<p className="mt-1 text-xs leading-5 text-slate-500">{g.especificacion}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black ${tieneHallazgo?"bg-amber-100 text-amber-900":"bg-emerald-100 text-emerald-900"}`}>{tieneHallazgo?"CON HALLAZGO":"SIN HALLAZGO"}</span>
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black text-white">{ev.calificacion.toFixed(0)}/100 · {ev.nivel}</span>
                        </div>
                      </div>
                      {ev.hallazgo&&<div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Hallazgo</p><p className="mt-1 text-sm font-black">{ev.hallazgo.titulo}</p><p className="mt-2 text-sm leading-6 text-slate-300">{ev.hallazgo.descripcion}</p>{ev.hallazgo.recomendacion&&<p className="mt-2 text-sm leading-6 text-slate-300"><strong>Recomendación:</strong> {ev.hallazgo.recomendacion}</p>}</div>}
                      {obs.descripcionFinal&&<p className="mt-4 text-sm leading-6 text-slate-700"><strong>Interpretación final del Inspector:</strong> {obs.descripcionFinal}</p>}
                      {(g.valorMedido||g.valorProyecto)&&<p className="mt-3 text-sm text-slate-700"><strong>Medición:</strong> {g.valorMedido??"—"} {g.unidadMedida??""}{g.valorProyecto?` · Referencia/proyecto: ${g.valorProyecto} ${g.unidadMedida??""}`:""}</p>}
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-600">
                        <span>Clasificación: {obs.clasificacionFinal??ev.hallazgo?.clasificacion??(tieneHallazgo?"—":"SIN HALLAZGO")}</span>
                        <span>Prioridad: {obs.prioridadFinal??ev.hallazgo?.prioridad??"—"}</span>
                        <span>Evaluación: {ev.calificacion.toFixed(0)}/100 · {ev.nivel}</span>
                      </div>
                      {fotos.length>0&&<div className="mt-4 grid gap-3 sm:grid-cols-2">{fotos.slice(0,4).map((foto,i)=><figure key={`${g.id}-${i}`} className="overflow-hidden rounded-2xl border border-slate-200">{foto.urlFirmada?<img src={foto.urlFirmada} alt={foto.descripcion??g.concepto} className="h-52 w-full bg-slate-950 object-contain"/>:<div className="grid h-52 place-items-center bg-slate-100 text-xs text-slate-400">Imagen no disponible</div>}<figcaption className="p-3 text-xs text-slate-500">{foto.descripcion??`Evidencia ${i+1}`}</figcaption></figure>)}</div>}
                    </section>;
                  })}
                </div>
              </article>;
            })}
          </div>
          <p className="mt-6 rounded-2xl bg-slate-100 p-4 text-xs leading-6 text-slate-600">Los conceptos marcados como No aplica o no inspeccionados por falta de acceso, seguridad, obstrucción u otra causa no se muestran individualmente en este desarrollo. Su cantidad sí se informa en el resumen estadístico y por partida para transparentar el alcance efectivo de la inspección.</p>
        </Seccion>

        <Seccion folio={inspeccion.folio} n="07" titulo="Resumen por partida" subtitulo="Resultados, alcance efectivo y evaluación de cada partida">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.5fr_.65fr_.65fr_.65fr_.65fr_.65fr] gap-2 bg-slate-950 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white">
              <span>Partida</span><span className="text-center">Inspeccionados</span><span className="text-center">Hallazgos</span><span className="text-center">No aplica</span><span className="text-center">Calificación</span><span className="text-center">Nivel</span>
            </div>
            {areas.map((a)=>{
              const conceptos=conceptosPorArea.get(a.id)??[];
              const ev=evaluacionesPorArea.get(a.id);
              return <div key={a.id} className="grid grid-cols-[1.5fr_.65fr_.65fr_.65fr_.65fr_.65fr] gap-2 border-t border-slate-200 px-4 py-3 text-xs">
                <span><strong>{a.orden}. {a.nombre}</strong><span className="mt-1 block text-[10px] text-slate-500">{Math.max(a.aplicables-a.revisados,0)} no inspeccionados / sin acceso u otra causa</span></span>
                <span className="text-center font-bold">{conceptos.length}</span>
                <span className="text-center font-bold">{a.hallazgos}</span>
                <span className="text-center font-bold">{a.noAplica}</span>
                <span className="text-center font-black">{conceptos.length&&ev?ev.calificacion.toFixed(2):"—"}</span>
                <span className="text-center font-black">{conceptos.length&&ev?ev.nivel:"—"}</span>
              </div>;
            })}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Metrica label="Evaluación global" value={`${calificacionTexto}/100`}/>
            <Metrica label="Nivel global" value={nivelEvaluacion}/>
            <Metrica label="No aplica" value={String(metricas.noAplica)}/>
            <Metrica label="No inspeccionados / sin acceso" value={String(Math.max(metricas.aplicables-metricas.revisados,0))}/>
          </div>
        </Seccion>

        <Seccion folio={inspeccion.folio} n="08" titulo="Tecnología Certeza Habitacional" subtitulo="Método Certeza, plataforma, IA, instrumentación y criterio técnico humano">
          <p className="mb-5 text-sm leading-6 text-slate-600">El Método Certeza integra una metodología sistematizada de revisión, la experiencia acumulada del equipo, evidencia fotográfica, mediciones y verificaciones instrumentales, una plataforma tecnológica que conserva trazabilidad y herramientas de inteligencia artificial como apoyo analítico. La IA ayuda a ordenar evidencia, comparar datos y proponer interpretaciones; no sustituye al Inspector. La interpretación, clasificación y decisión técnica final corresponden al criterio profesional humano autorizado.</p>
          <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-100 p-4"><strong>Cobertura sistemática</strong><p className="mt-2 text-xs leading-5 text-slate-600">La plataforma organiza partidas y conceptos para reducir omisiones y conservar trazabilidad.</p></div><div className="rounded-2xl bg-slate-100 p-4"><strong>Instrumentación</strong><p className="mt-2 text-xs leading-5 text-slate-600">Las herramientas complementan la observación cuando la prueba corresponde y quedó documentada.</p></div><div className="rounded-2xl bg-slate-100 p-4"><strong>Criterio profesional</strong><p className="mt-2 text-xs leading-5 text-slate-600">La tecnología apoya; el Inspector y Dirección conservan la decisión técnica final.</p></div></div>
          <TecnologiaInspeccionV1 resultados={resultados} mostrarNoEjecutadas />
        </Seccion>

        <Seccion folio={inspeccion.folio} n="09" titulo="Conclusiones" subtitulo="Síntesis técnica objetiva del resultado de la inspección">
          <p className="rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-200">{metricas.dictamen}</p>
          <p className="mt-4 text-sm leading-7 text-slate-700">Cobertura efectiva: <strong>{coberturaTexto}%</strong>. Calificación Técnica Certeza: <strong>{calificacionTexto}/100</strong>. Hallazgos documentados: <strong>{metricas.totalHallazgos}</strong>. La conclusión se limita al alcance contratado, a las áreas accesibles y a las condiciones visibles o medibles durante la visita.</p>
        </Seccion>

        <Seccion folio={inspeccion.folio} n="10" titulo="Bibliografía y normatividad de apoyo" subtitulo="Referencias utilizadas como marco técnico">
          <p className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Las referencias se aplican únicamente cuando corresponden al elemento y alcance efectivamente revisado. Una inspección visual o instrumental de vivienda no sustituye por sí sola un dictamen oficial de cumplimiento normativo, estructural, eléctrico o de gas emitido por la autoridad o especialista competente.</p>
          <div className="space-y-3">{referencias.map((ref)=><article key={ref.titulo} className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">{ref.titulo}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{ref.uso}</p><p className="mt-2 break-all text-xs text-cyan-700">{ref.fuente}</p></article>)}</div>
        </Seccion>

        <Seccion folio={inspeccion.folio} n="11" titulo="Glosario" subtitulo="Términos para facilitar la lectura del reporte">
          <div className="grid gap-3 sm:grid-cols-2">{GLOSARIO.map(([t,d])=><article key={t} className="rounded-2xl bg-slate-100 p-4"><h3 className="font-black">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{d}</p></article>)}</div>
        </Seccion>

        <section className="page-break px-10 py-10">
          <div className="mb-4 text-xs font-black uppercase tracking-[.2em] text-cyan-700">12 · Certificado Certeza Habitacional</div><ReportBrandHeader title="Certificado Certeza Habitacional" folio={autorizado && inspeccion.certificado ? inspeccion.certificado.folio : inspeccion.folio} eyebrow="Resultado final autorizado" />
          {autorizado && inspeccion.certificado ? <div className="mt-10 rounded-[2rem] border-8 border-slate-950 p-8"><div className="border-2 border-amber-500 p-8 text-center"><h2 className="text-3xl font-black">Certificado Certeza Habitacional</h2><div className="mt-8 grid gap-8 md:grid-cols-[1fr_190px]"><div className="text-left"><Fila label="Inmueble" value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}/><Fila label="Inspección" value={inspeccion.folio}/><Fila label="Fecha de inspección" value={fecha}/>{autorizacionDireccion&&fechaAutorizacion&&<Fila label="Autorizado por Dirección" value={`${autorizacionDireccion.nombre} · ${fechaAutorizacion}`}/>}<Fila label="Cobertura" value={`${coberturaTexto}%`}/><Fila label="Calificación Técnica Certeza" value={`${Number(inspeccion.certificado.ish).toFixed(2)}/100`}/><Fila label="Nivel de evaluación" value={nivelEvaluacion}/><Fila label="Áreas revisadas" value={String(metricas.areas)}/><Fila label="Puntos revisados" value={String(metricas.revisados)}/><Fila label="Hallazgos P1–P5" value={`P1 ${metricas.resumenPrioridades.P1} · P2 ${metricas.resumenPrioridades.P2} · P3 ${metricas.resumenPrioridades.P3} · P4 ${metricas.resumenPrioridades.P4} · P5 ${metricas.resumenPrioridades.P5}`}/><Fila label="Áreas sin hallazgos" value={String(metricas.areasSinHallazgos)}/></div>{qr&&<div className="text-center"><img src={qr} alt="QR de validación" className="mx-auto h-44 w-44"/><p className="mt-2 text-xs font-black">Validar certificado y consultar información autorizada</p></div>}</div><p className="mt-8 text-sm leading-7 text-slate-600">{inspeccion.certificado.dictamen}</p></div></div>:<div className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900"><p className="font-black">Certificado pendiente de autorización</p><p className="mt-2 text-sm leading-6">Este reporte todavía es preliminar. El certificado se generará únicamente cuando Dirección autorice el reporte final.</p></div>}
        </section>
      </article>
    </main>
  );
}

function Seccion({n,titulo,subtitulo,folio,children}:{n:string;titulo:string;subtitulo:string;folio:string;children:React.ReactNode}){const contacto=datosContactoDocumento();return <section className="page-break relative min-h-[245mm] px-10 py-8"><ReportBrandHeader title={titulo} folio={folio} eyebrow={`${n} · ${subtitulo}`}/><div className="mt-7">{children}</div><footer className="mt-10 border-t border-amber-500/50 pt-4 text-[10px] text-slate-500"><div className="flex justify-between gap-6"><div><p className="font-black uppercase tracking-wider text-slate-800">{DATOS_DOCUMENTALES.empresa}</p><p className="mt-1">{DATOS_DOCUMENTALES.eslogan}</p>{contacto.slice(0,2).map(x=><p key={x} className="mt-1">{x}</p>)}</div><div className="text-right"><p className="font-black text-slate-700">Pre-Reporte de Inspección</p><p className="mt-1">Folio {folio}</p></div></div></footer></section>}
function Dato({label,value}:{label:string;value:string}){return <div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{label}</p><p className="mt-1 font-bold">{value}</p></div>}
function Metrica({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-slate-100 p-3 text-center"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p></div>}
function Fila({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-6 border-b border-slate-100 py-2"><span className="text-slate-500">{label}</span><strong className="text-right">{value}</strong></div>}