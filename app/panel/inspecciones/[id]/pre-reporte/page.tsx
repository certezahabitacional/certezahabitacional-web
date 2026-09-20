import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { auth } from "@/auth";
import ReportBrandHeader from "@/components/branding/ReportBrandHeader";
import TecnologiaInspeccionV1 from "@/components/reportes/TecnologiaInspeccionV1";
import { obtenerMetricasV1 } from "@/lib/calificacion-v1";
import { extraerResultadosInstrumentales } from "@/lib/resultados-instrumentales";
import { prisma } from "@/lib/prisma";
import DecisionClienteSitioV1 from "./DecisionClienteSitioV1";
import { confirmarPreReporteSitioV1 } from "./actions";

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

type AreaResumen = {
  nombre: string;
  resultado: string | null;
  hallazgos: number;
  definidos: number;
  aplicables: number;
  revisados: number;
  noAplica: number;
};

type Control = {
  inspeccionTecnicaConcluidaEn: Date | null;
  campoFinalizadoEn: Date | null;
  preReporteGeneradoEn: Date | null;
  coberturaPorcentaje: number | null;
};
type DecisionPreReporte = { decisionCliente: string | null; decisionRegistradaEn: Date | null };

export default async function PreReportePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: true,
      inmueble: true,
      inspector: { include: { usuario: true } },
      hallazgos: { orderBy: [{ prioridad: "asc" }, { creadoEn: "asc" }] },
      cotizacion: { select: { folio: true, observacionesInternas: true } },
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}`);

  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const puedeVer = esInspector || ([RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR] as RolUsuario[]).includes(usuario.rol);
  if (!puedeVer) redirect("/acceso");

  const [control] = await prisma.$queryRaw<Control[]>`
    SELECT "inspeccionTecnicaConcluidaEn","campoFinalizadoEn","preReporteGeneradoEn","coberturaPorcentaje"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${id}
    LIMIT 1
  `;

  const [decisionPreReporte] = await prisma.$queryRaw<DecisionPreReporte[]>`
    SELECT "decisionCliente","decisionRegistradaEn"
    FROM "PreReporteInspeccion"
    WHERE "inspeccionId"=${id}
    ORDER BY "generadoEn" DESC
    LIMIT 1
  `;

  const areas = await prisma.$queryRaw<AreaResumen[]>`
    SELECT a."nombre",a."resultado",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=a."inspeccionId" AND h."area"=a."nombre") "hallazgos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id") "definidos",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3" <> 'NO_APLICA') "aplicables",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3" IN ('REVISADO','CON_HALLAZGO')) "revisados",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3"='NO_APLICA') "noAplica"
    FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true ORDER BY a."orden",a."nombre"
  `;

  const [foto] = await prisma.$queryRaw<Array<{ url: string | null }>>`
    SELECT f."url" FROM "AreaInspeccion" a
    JOIN "FotografiaArea" fa ON fa."areaId"=a."id"
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE a."inspeccionId"=${id}
      AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL')
      AND fa."candidataPortada"=true
    LIMIT 1
  `;
  const portada = await signedUrl(foto?.url ?? null);

  const { resultados } = extraerResultadosInstrumentales(inspeccion.observaciones);
  const metricas = await obtenerMetricasV1(id);
  const prioridades = ["P1", "P2", "P3", "P4", "P5"] as const;
  const resumenPrioridades = prioridades.map((prioridad) => ({
    prioridad,
    total: metricas.resumenPrioridades[prioridad],
  }));

  const [estadoTecnico] = await prisma.$queryRaw<Array<{
    areasTotal: number;
    areasCompletas: number;
    procesosTotal: number;
    procesosCompletos: number;
    hallazgos: number;
    hallazgosCompletos: number;
    syncPendientes: number;
    portadaFachada: number;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true AND a."tipo" <> 'PUNTO_CRITICO') AS "areasTotal",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true AND a."tipo" <> 'PUNTO_CRITICO' AND a."estado"='REVISADA' AND a."resultado" IN ('SIN_HALLAZGOS','CON_HALLAZGOS')) AS "areasCompletas",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${id} AND p."obligatorio"=true) AS "procesosTotal",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${id} AND p."obligatorio"=true AND p."estado" IN ('COMPLETADO','NO_APLICA')) AS "procesosCompletos",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${id}) AS "hallazgos",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${id} AND (SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id") BETWEEN 1 AND 4 AND nullif(btrim(coalesce(h."descripcion",'')),'') IS NOT NULL) AS "hallazgosCompletos",
      (SELECT COUNT(*)::int FROM "OperacionCampoSync" s WHERE s."inspeccionId"=${id} AND s."estado" <> 'PROCESADA') AS "syncPendientes",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a JOIN "FotografiaArea" fa ON fa."areaId"=a."id" WHERE a."inspeccionId"=${id} AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL') AND fa."candidataPortada"=true) AS "portadaFachada"
  `;
  const tecnicoListo = Boolean(
    estadoTecnico &&
    estadoTecnico.areasTotal > 0 &&
    estadoTecnico.areasCompletas === estadoTecnico.areasTotal &&
    estadoTecnico.procesosTotal > 0 &&
    estadoTecnico.procesosCompletos === estadoTecnico.procesosTotal &&
    estadoTecnico.hallazgos === estadoTecnico.hallazgosCompletos &&
    estadoTecnico.syncPendientes === 0 &&
    estadoTecnico.portadaFachada === 1
  );
  const revisadoEnSitio = Boolean(control?.preReporteGeneradoEn);
  const campoTerminado = Boolean(control?.campoFinalizadoEn);

  return (
    <main className="min-h-screen bg-slate-200 px-3 py-5 text-slate-950">
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between print:hidden">
        <Link href={`/panel/inspecciones/${id}/cierre-v1`} className="font-black text-slate-700">← Cierre V1</Link>
        <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-900">PRELIMINAR · PENDIENTE DE REVISIÓN Y AUTORIZACIÓN</span>
      </div>

      {(query.ok || query.error) && (
        <div className={`mx-auto mb-4 max-w-4xl rounded-2xl px-5 py-4 text-sm font-bold print:hidden ${query.error ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-900"}`}>
          {query.error ?? query.ok}
        </div>
      )}

      <section className="mx-auto mb-4 max-w-4xl rounded-3xl border border-slate-300 bg-white p-5 shadow-sm print:hidden">
        <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Inspección técnica concluida</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Esta revisión sólo se habilita después de que el Inspector concluye formalmente la inspección. Si procede, aquí puede revisar el reporte preliminar antes de cerrar la visita.
        </p>
      </section>

      <article className="mx-auto max-w-4xl overflow-hidden bg-white shadow-xl">
        <section className="bg-slate-950 px-7 py-7 text-white">
          <ReportBrandHeader title="Pre-reporte de inspección" folio={inspeccion.folio} eyebrow="Resumen de cierre en sitio" dark />
          {portada && <img src={portada} alt="Fachada principal" className="mt-6 h-64 w-full rounded-2xl object-cover" />}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Dato label="Cliente" value={inspeccion.cliente.nombre} />
            <Dato label="Inmueble" value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble} />
            <Dato label="Dirección" value={inspeccion.direccion} />
            <Dato label="Inspector" value={inspeccion.inspector?.usuario.nombre ?? "Inspector asignado"} />
          </div>
        </section>

        <section className="px-7 py-7">
          <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-700">Resultado inmediato de la visita</p>
          <h2 className="mt-2 text-3xl font-black">Inspección de campo completada</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            <Metrica label="Cobertura" value={`${metricas.cobertura}%`} />
            <Metrica label="Calificación técnica preliminar" value={`${Math.round(metricas.calificacion)}/100`} />
            <Metrica label="Áreas" value={String(metricas.areas)} />
            <Metrica label="Puntos revisados" value={String(metricas.revisados)} />
            <Metrica label="Sin hallazgos" value={String(metricas.areasSinHallazgos)} />
          </div>
          <p className="mt-4 text-xs font-bold text-slate-500">Puntos definidos: {metricas.definidos} · No aplica: {metricas.noAplica} · Aplicables: {metricas.aplicables} · Revisados: {metricas.revisados}</p>
          <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Este documento es un resumen preliminar de lo observado en campo. La cobertura y la calificación técnica son indicadores separados. La calificación puede cambiar antes de la autorización final si el Inspector corrige información o Dirección solicita ajustes al expediente.
          </p>
        </section>

        <section className="border-t border-slate-200 px-7 py-7">
          <h2 className="text-2xl font-black">Hallazgos detectados</h2>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {resumenPrioridades.map(({prioridad,total}) => <Metrica key={prioridad} label={prioridad} value={String(total)} />)}
          </div>
          {inspeccion.hallazgos.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-5 font-bold text-emerald-900">No se registraron hallazgos durante la visita.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {inspeccion.hallazgos.slice(0, 6).map((h) => (
                <article key={h.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-black">{h.titulo}</h3><span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{h.prioridad}</span></div>
                  <p className="mt-2 text-sm text-slate-600">{h.area}{h.ubicacion ? ` · ${h.ubicacion}` : ""}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{h.descripcion}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-slate-200 px-7 py-7">
          <h2 className="text-2xl font-black">Áreas revisadas satisfactoriamente</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {areas.filter((a) => a.resultado === "SIN_HALLAZGOS").map((a) => (
              <div key={a.nombre} className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">✓ {a.nombre} · {a.aplicables} puntos aplicables</div>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 px-7 py-7">
          <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-700">Tecnología aplicada</p>
          <h2 className="mt-2 text-2xl font-black">Herramientas que respaldaron la inspección</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Se muestran las tecnologías y equipos con resultados registrados durante esta visita. La aplicación Certeza Habitacional guía y documenta todo el proceso.</p>
          <div className="mt-5"><TecnologiaInspeccionV1 resultados={resultados} compact /></div>
        </section>

        {!campoTerminado && esInspector && (
          <section className="border-t border-slate-200 bg-cyan-50 px-7 py-7 print:hidden">
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-800">Revisión obligatoria antes de salir del inmueble</p>
            <h2 className="mt-2 text-2xl font-black">Confirmar pre-reporte en sitio</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Revisa hallazgos, prioridades, fotografías, áreas satisfactorias, lecturas y datos del inmueble. Si detectas algo que deba corregirse, regresa al recorrido o a la evidencia antes de confirmar.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/panel/inspecciones/${id}/campo-v1`} className="rounded-xl border border-cyan-700/20 bg-white px-4 py-3 text-sm font-black text-cyan-900">Volver a corregir captura</Link>
              <Link href={`/panel/inspecciones/${id}/reporte-evidencias`} className="rounded-xl border border-cyan-700/20 bg-white px-4 py-3 text-sm font-black text-cyan-900">Revisar evidencias</Link>
            </div>
            <form action={confirmarPreReporteSitioV1} className="mt-5">
              <input type="hidden" name="inspeccionId" value={id}/>
              <button disabled={!tecnicoListo || revisadoEnSitio} className="w-full rounded-xl bg-cyan-800 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                {revisadoEnSitio ? "PRE-REPORTE YA REVISADO EN SITIO ✓" : "CONFIRMAR REVISIÓN PRELIMINAR EN SITIO"}
              </button>
            </form>
            {revisadoEnSitio && <Link href={`/panel/inspecciones/${id}/cierre-v1`} className="mt-4 block rounded-xl bg-emerald-700 px-5 py-3 text-center font-black text-white">CONTINUAR AL CIERRE DE VISITA →</Link>}
          </section>
        )}

        <DecisionClienteSitioV1
          inspeccionId={id}
          decisionActual={decisionPreReporte?.decisionCliente ?? null}
          puedeRegistrar={esInspector && inspeccion.estado === "EN_PROCESO"}
        />

        <section className="border-t border-slate-200 bg-slate-50 px-7 py-7">
          <h2 className="text-2xl font-black">Qué sigue</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Primero se confirma este pre-reporte todavía en el inmueble. Después se cierra la visita y el Inspector realiza una última revisión y ajuste editorial. Sólo entonces envía el expediente a Dirección, quien puede autorizarlo o devolverlo con retroalimentación.
          </p>
          <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-amber-800">PRELIMINAR · PENDIENTE DE REVISIÓN Y AUTORIZACIÓN</p>
        </section>
      </article>
    </main>
  );
}

function Dato({ label, value }: { label:string; value:string }) { return <div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
function Metrica({ label, value }: { label:string; value:string }) { return <div className="rounded-2xl bg-slate-100 p-3 text-center"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p></div>; }

function Etapa({ numero, titulo, activa, completa, detalle }: { numero:string; titulo:string; activa:boolean; completa:boolean; detalle:string }) {
  return (
    <div className={`rounded-2xl border p-4 ${completa ? "border-emerald-200 bg-emerald-50" : activa ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-slate-50"}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Etapa {numero}</p>
      <p className={`mt-1 font-black ${completa ? "text-emerald-800" : activa ? "text-cyan-900" : "text-slate-600"}`}>{titulo}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detalle}</p>
    </div>
  );
}
