import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { auth } from "@/auth";
import ReportBrandHeader from "@/components/branding/ReportBrandHeader";
import TecnologiaInspeccionV1 from "@/components/reportes/TecnologiaInspeccionV1";
import { extraerResultadosInstrumentales } from "@/lib/resultados-instrumentales";
import { prisma } from "@/lib/prisma";
import DecisionClienteSitioV1 from "./DecisionClienteSitioV1";

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

type Control = { campoFinalizadoEn: Date | null; coberturaPorcentaje: number | null };

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
    SELECT "campoFinalizadoEn","coberturaPorcentaje" FROM "InspeccionControlV2" WHERE "inspeccionId"=${id} LIMIT 1
  `;
  if (!control?.campoFinalizadoEn) redirect(`/panel/inspecciones/${id}/cierre-v1?error=${encodeURIComponent("El pre-reporte se habilita al terminar formalmente el trabajo de campo.")}`);

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
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3"='REVISADO') "revisados",
      (SELECT COUNT(*)::int FROM "GuiaInspeccionItem" g WHERE g."areaId"=a."id" AND g."estadoV3"='NO_APLICA') "noAplica"
    FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true ORDER BY a."orden",a."nombre"
  `;

  const [foto] = await prisma.$queryRaw<Array<{ url: string | null }>>`
    SELECT f."url" FROM "AreaInspeccion" a
    JOIN "FotografiaArea" fa ON fa."areaId"=a."id"
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE a."inspeccionId"=${id} AND a."codigo"='FACHADA_PRINCIPAL' AND fa."candidataPortada"=true
    LIMIT 1
  `;
  const portada = await signedUrl(foto?.url ?? null);

  const { resultados } = extraerResultadosInstrumentales(inspeccion.observaciones);
  const prioridades = ["P1", "P2", "P3", "P4", "P5"] as const;
  const resumenPrioridades = prioridades.map((prioridad) => ({
    prioridad,
    total: inspeccion.hallazgos.filter((h) => h.prioridad === prioridad).length,
  }));
  const sinHallazgos = areas.filter((a) => a.resultado === "SIN_HALLAZGOS").length;
  const puntosDefinidos = areas.reduce((s,a) => s + Number(a.definidos), 0);
  const puntosNoAplica = areas.reduce((s,a) => s + Number(a.noAplica), 0);
  const puntosAplicables = areas.reduce((s,a) => s + Number(a.aplicables), 0);
  const puntosRevisados = areas.reduce((s,a) => s + Number(a.revisados), 0);
  const cobertura = puntosAplicables > 0 ? Math.round((puntosRevisados / puntosAplicables) * 100) : 0;

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
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metrica label="Cobertura" value={`${cobertura}%`} />
            <Metrica label="Áreas" value={String(areas.length)} />
            <Metrica label="Puntos revisados" value={String(puntosRevisados)} />
            <Metrica label="Sin hallazgos" value={String(sinHallazgos)} />
          </div>
          <p className="mt-4 text-xs font-bold text-slate-500">Puntos definidos: {puntosDefinidos} · No aplica: {puntosNoAplica} · Aplicables: {puntosAplicables} · Revisados: {puntosRevisados}</p>
          <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Este documento es un resumen preliminar de lo observado en campo. El reporte formal puede recibir ajustes de redacción, selección de evidencias y revisión por Dirección antes de su autorización definitiva.
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

        <DecisionClienteSitioV1
          inspeccionId={id}
          decisionActual={decisionPreReporte?.decisionCliente ?? null}
          puedeRegistrar={esInspector && inspeccion.estado === "EN_PROCESO"}
        />

        <section className="border-t border-slate-200 bg-slate-50 px-7 py-7">
          <h2 className="text-2xl font-black">Qué sigue</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">El Inspector realizará la edición final dentro de la ventana establecida y enviará el reporte a Dirección. Una vez revisado y autorizado se liberará el reporte formal y el Certificado Certeza Habitacional.</p>
          <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-amber-800">PRELIMINAR · PENDIENTE DE REVISIÓN Y AUTORIZACIÓN</p>
        </section>
      </article>
    </main>
  );
}

function Dato({ label, value }: { label:string; value:string }) { return <div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
function Metrica({ label, value }: { label:string; value:string }) { return <div className="rounded-2xl bg-slate-100 p-3 text-center"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p></div>; }
