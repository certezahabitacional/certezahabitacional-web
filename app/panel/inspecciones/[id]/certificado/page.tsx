import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { auth } from "@/auth";
import LogoCerteza from "@/components/branding/LogoCerteza";
import ReportBrandHeader from "@/components/branding/ReportBrandHeader";
import { obtenerMetricasV1 } from "@/lib/calificacion-v1";
import { puede, puedeAbrirExpedienteTecnico } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import { emitirCertificado } from "../actions";
import PrintButton from "./PrintButton";
import { reactivarCertificado, revocarCertificado } from "./actions";

type ControlV1Certificado = { campoFinalizadoEn: Date | null };

export default async function CertificadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      zonaId: true,
      gerenteId: true,
      coordinadorId: true,
      inspector: { select: { id: true, activo: true } },
    },
  });
  if (!usuarioActual?.activo) redirect("/acceso");
  if (usuarioActual.rol === RolUsuario.CLIENTE || usuarioActual.rol === RolUsuario.ADMINISTRADOR) {
    redirect(usuarioActual.rol === RolUsuario.CLIENTE ? "/portal" : "/acceso");
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: true,
      inmueble: true,
      inspector: { include: { usuario: true } },
      certificado: true,
      hallazgos: true,
    },
  });
  if (!inspeccion) notFound();

  const esV1 = inspeccion.numeroInspeccion === 1;
  if (esV1 && inspeccion.estado === EstadoInspeccion.FINALIZADA && usuarioActual.rol === RolUsuario.INSPECTOR) {
    redirect(`/panel/inspecciones/${inspeccion.id}`);
  }

  const puedeAbrirCertificado =
    puede(usuarioActual.rol, "CERTIFICADO_VER") &&
    puedeAbrirExpedienteTecnico(
      {
        id: usuarioActual.id,
        rol: usuarioActual.rol,
        zonaId: usuarioActual.zonaId,
        gerenteId: usuarioActual.gerenteId,
        coordinadorId: usuarioActual.coordinadorId,
        inspectorId: usuarioActual.inspector?.id ?? null,
      },
      {
        id: inspeccion.id,
        zonaId: inspeccion.zonaId,
        clienteId: inspeccion.clienteId,
        inspectorId: inspeccion.inspectorId,
        inspectorUsuarioId: inspeccion.inspector?.usuarioId ?? null,
        inspectorZonaId: inspeccion.inspector?.usuario.zonaId ?? null,
        coordinadorUsuarioId: inspeccion.inspector?.usuario.coordinadorId ?? null,
        gerenteUsuarioId: inspeccion.inspector?.usuario.gerenteId ?? null,
      },
    );
  if (!puedeAbrirCertificado) redirect("/acceso");

  const inspeccionFinalizada = inspeccion.estado === EstadoInspeccion.FINALIZADA;
  const metricasV1 = esV1 ? await obtenerMetricasV1(inspeccion.id) : null;
  const controlV1 = esV1
    ? (await prisma.$queryRaw<ControlV1Certificado[]>`
        SELECT "campoFinalizadoEn" FROM "InspeccionControlV2" WHERE "inspeccionId"=${inspeccion.id} LIMIT 1
      `)[0] ?? null
    : null;
  const fechaInspeccion = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: inspeccion.zonaHoraria,
  }).format(controlV1?.campoFinalizadoEn ?? inspeccion.fechaProgramada);

  // V1 se certifica exclusivamente dentro de la autorización final de Dirección.
  // La emisión manual se conserva solo para expedientes heredados/no V1.
  const puedeEmitirManual =
    !esV1 &&
    inspeccionFinalizada &&
    puede(usuarioActual.rol, "CERTIFICADO_EMITIR") &&
    (usuarioActual.rol === RolUsuario.GERENTE || usuarioActual.rol === RolUsuario.DIRECTOR);

  const puedeImprimir =
    puede(usuarioActual.rol, "CERTIFICADO_IMPRIMIR") &&
    (usuarioActual.rol === RolUsuario.GERENTE || usuarioActual.rol === RolUsuario.DIRECTOR);
  const puedeRevocar = usuarioActual.rol === RolUsuario.DIRECTOR && puede(usuarioActual.rol, "CERTIFICADO_REVOCAR");
  const tieneFacultadReactivar = usuarioActual.rol === RolUsuario.DIRECTOR && puede(usuarioActual.rol, "CERTIFICADO_REACTIVAR");
  const puedeReactivar = tieneFacultadReactivar && inspeccionFinalizada;

  if (!inspeccion.certificado) {
    const calificacionMostrada = esV1 ? metricasV1?.calificacion : Number(inspeccion.ish ?? 100);
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-8 text-center">
          <div className="mb-6 flex justify-center"><LogoCerteza variant="gold" width={220} priority className="max-h-40" /></div>
          <h1 className="mt-4 text-3xl font-black">Certificado pendiente</h1>
          <p className="mt-3 leading-7 text-slate-400">
            {esV1
              ? "En V1 el certificado se genera automáticamente cuando Dirección autoriza el reporte final y se cumplen las condiciones de liberación."
              : "El expediente está preparado para emitir el certificado definitivo."}
          </p>
          <div className="mt-6 rounded-3xl bg-slate-950 p-6">
            <p className="text-sm text-slate-400">{esV1 ? "Calificación Técnica Certeza preliminar" : "Índice de Salud Habitacional"}</p>
            <p className="mt-2 text-6xl font-black text-cyan-300">{Number(calificacionMostrada ?? 0).toFixed(esV1 ? 2 : 0)}</p>
            {esV1 && metricasV1 ? <p className="mt-2 text-sm font-bold text-slate-400">Cobertura: {metricasV1.cobertura.toFixed(2)}%</p> : <p className="font-black">{inspeccion.semaforo ?? "SIN EVALUAR"}</p>}
          </div>

          {puedeEmitirManual ? (
            <form action={emitirCertificado} className="mt-7">
              <input type="hidden" name="inspeccionId" value={inspeccion.id} />
              <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">Emitir certificado definitivo</button>
            </form>
          ) : (
            <div className="mt-7 rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-400">
              {esV1
                ? "La emisión manual está deshabilitada para V1. Dirección debe completar la autorización final."
                : inspeccionFinalizada
                  ? "Tu rol puede consultar el expediente, pero no emitir el certificado."
                  : `El certificado solo puede emitirse después de completar captura, revisión y aprobación. Estado actual: ${inspeccion.estado.replaceAll("_", " ")}.`}
            </div>
          )}
          <Link href={`/panel/inspecciones/${inspeccion.id}`} className="mt-5 inline-block font-bold text-slate-400">← Volver al expediente</Link>
        </section>
      </main>
    );
  }

  const certificado = inspeccion.certificado;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const urlValidacion = `${baseUrl}/certificados/verificar/${certificado.codigoValidacion}`;
  const urlReporteOficial = `${baseUrl}/reportes/verificar/${certificado.codigoValidacion}/pdf`;
  const qrDataUrl = await QRCode.toDataURL(esV1 ? urlReporteOficial : urlValidacion, { width: 260, margin: 1, errorCorrectionLevel: "M" });

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <style>{`@page{size:Letter;margin:10mm}
      @media print{
        html,body{background:#fff!important}
        .certificate-shell{min-height:auto!important;break-inside:avoid;page-break-inside:avoid}
        .certificate-block{break-inside:avoid;page-break-inside:avoid}
        img,svg{break-inside:avoid;page-break-inside:avoid;max-width:100%!important}
        h1,h2,h3,p{orphans:3;widows:3}
        h1,h2,h3{break-after:avoid;page-break-after:avoid}
      }`}</style>
      <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between print:hidden">
        <Link href={`/panel/inspecciones/${inspeccion.id}`} className="font-bold text-slate-700">← Volver al expediente</Link>
        {puedeImprimir && <PrintButton />}
      </div>

      {query.ok && <div className="mx-auto mb-5 max-w-5xl rounded-2xl bg-emerald-100 px-5 py-4 font-bold text-emerald-800 print:hidden">{query.ok}</div>}
      {query.error && <div className="mx-auto mb-5 max-w-5xl rounded-2xl bg-rose-100 px-5 py-4 font-bold text-rose-800 print:hidden">{query.error}</div>}

      <article className="certificate-shell mx-auto max-w-5xl border-[12px] border-slate-950 bg-white p-12 shadow-2xl print:max-w-none print:shadow-none">
        <div className="border-2 border-amber-500 p-10 text-center">
          <ReportBrandHeader
            title={esV1 ? "Certificado Certeza Habitacional" : "Certificado de Estado Habitacional"}
            folio={certificado.folio}
            eyebrow="Documento oficial de inspección"
          />

          <div className={`mt-6 rounded-2xl border px-5 py-4 text-xs font-black uppercase tracking-[.2em] ${certificado.vigente ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-400 bg-rose-50 text-rose-800"}`}>
            {certificado.vigente ? "CERTIFICADO VIGENTE" : "CERTIFICADO REVOCADO"}
          </div>
          {!certificado.vigente && (
            <div className="mt-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-left text-sm text-rose-900">
              <p className="font-black">Este documento perdió vigencia y no debe utilizarse como certificado vigente.</p>
              {certificado.motivoRevocacion && <p className="mt-2">Motivo: {certificado.motivoRevocacion}</p>}
              {certificado.revocadoEn && <p className="mt-1 text-xs">Revocado el {certificado.revocadoEn.toLocaleString("es-MX")}</p>}
            </div>
          )}

          <div className="mt-8 flex justify-end"><LogoCerteza variant="badge" width={135} className="max-h-32" /></div>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Se hace constar que el inmueble descrito fue objeto de una inspección conforme al alcance y expediente técnico identificados en este certificado.
          </p>

          <div className="certificate-block mx-auto mt-10 max-w-3xl rounded-3xl bg-slate-950 p-8 text-left text-white">
            <dl className="grid gap-5 md:grid-cols-2">
              <Data label="Certificado" value={certificado.folio} />
              <Data label="Inspección" value={inspeccion.folio} />
              <Data label="Cliente" value={inspeccion.cliente.nombre} />
              <Data label="Inmueble" value={inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble} />
              <Data label="Dirección" value={`${inspeccion.direccion}, ${inspeccion.ciudad}`} />
              <Data label="Inspector" value={inspeccion.inspector?.usuario.nombre ?? "Sin asignar"} />
              {esV1 && <Data label="Fecha de inspección" value={fechaInspeccion} />}
              {esV1 && metricasV1 && <Data label="Cobertura" value={`${metricasV1.cobertura.toFixed(2)}%`} />}
              {esV1 && metricasV1 && <Data label="Áreas revisadas" value={String(metricasV1.areas)} />}
              {esV1 && metricasV1 && <Data label="Puntos revisados" value={String(metricasV1.revisados)} />}
              {esV1 && metricasV1 && <Data label="Áreas sin hallazgos" value={String(metricasV1.areasSinHallazgos)} />}
            </dl>
          </div>

          <div className="certificate-block mx-auto mt-10 grid max-w-3xl items-center gap-8 md:grid-cols-[220px_1fr]">
            <div className="rounded-3xl bg-cyan-300 p-8 text-slate-950">
              <p className="text-xs font-black uppercase tracking-widest">{esV1 ? "Calificación Técnica Certeza" : "Índice"}</p>
              <p className="text-6xl font-black">{Number(certificado.ish).toFixed(esV1 ? 2 : 0)}</p>
              <p className="mt-1 text-sm font-black">{esV1 ? "/100" : (inspeccion.semaforo ?? "EVALUADO")}</p>
            </div>
            <div className="text-left">
              <h2 className="text-2xl font-black">Dictamen</h2>
              <p className="mt-4 text-lg leading-8 text-slate-700">{certificado.dictamen}</p>
              {esV1 && metricasV1 && (
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  Hallazgos por prioridad: P1 {metricasV1.resumenPrioridades.P1} · P2 {metricasV1.resumenPrioridades.P2} · P3 {metricasV1.resumenPrioridades.P3} · P4 {metricasV1.resumenPrioridades.P4} · P5 {metricasV1.resumenPrioridades.P5}.
                </p>
              )}
            </div>
          </div>

          <div className="certificate-block mx-auto mt-12 grid max-w-3xl gap-8 border-t border-slate-300 pt-8 text-sm text-slate-600 md:grid-cols-[1fr_180px] md:items-center">
            <div>
              <p>Emitido el {certificado.emitidoEn.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</p>
              <p className="mt-3 font-black tracking-widest text-slate-950">CÓDIGO DE VALIDACIÓN: {certificado.codigoValidacion}</p>
              <p className="mt-5 leading-6">Este certificado debe interpretarse junto con el reporte técnico completo. No sustituye peritajes estructurales, dictámenes de instalaciones ocultas ni estudios especializados.</p>
              <p className="mt-5 text-xs">{esV1 ? "Escanee el código QR para abrir directamente el Reporte Oficial autorizado. Desde la página de validación también puede comprobar la vigencia y descargar el PDF." : "Escanee el código QR para verificar la autenticidad y vigencia del certificado."}</p>
            </div>
            <div className="flex flex-col items-center justify-center self-center">
              <img src={qrDataUrl} alt="Código QR de validación" className="mx-auto h-40 w-40" />
              <p className="mt-2 text-xs font-bold text-slate-700">{esV1 ? "Abrir Reporte Oficial" : "Verificar certificado"}</p>
            </div>
          </div>
        </div>
      </article>

      {esV1 && certificado.vigente && (
        <section className="mx-auto mt-6 max-w-5xl rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-xl print:hidden">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-800">Reporte Oficial compartible</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">El QR del certificado abre directamente la versión oficial autorizada. También puedes probar la vista o descargar el PDF desde aquí.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`/reportes/verificar/${certificado.codigoValidacion}/pdf`} target="_blank" rel="noreferrer" className="rounded-full bg-cyan-700 px-5 py-3 font-black text-white">VER REPORTE OFICIAL</a>
            <a href={`/reportes/verificar/${certificado.codigoValidacion}/pdf?download=1`} className="rounded-full border border-cyan-700 px-5 py-3 font-black text-cyan-800">DESCARGAR PDF</a>
          </div>
        </section>
      )}

      <section className="mx-auto mt-6 max-w-5xl rounded-3xl border border-slate-300 bg-white p-7 shadow-xl print:hidden">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Estado administrativo</p>
            <p className={certificado.vigente ? "mt-2 text-2xl font-black text-emerald-700" : "mt-2 text-2xl font-black text-rose-700"}>
              {certificado.vigente ? "CERTIFICADO VIGENTE" : "CERTIFICADO REVOCADO"}
            </p>
            {!certificado.vigente && certificado.motivoRevocacion && (
              <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
                <p className="font-black">Motivo de revocación</p>
                <p className="mt-1 leading-6">{certificado.motivoRevocacion}</p>
                {certificado.revocadoEn && <p className="mt-2 text-xs">Revocado el {certificado.revocadoEn.toLocaleString("es-MX")}</p>}
              </div>
            )}
          </div>

          {!certificado.vigente && puedeReactivar && (
            <form action={reactivarCertificado}>
              <input type="hidden" name="inspeccionId" value={inspeccion.id} />
              <button type="submit" className="rounded-full bg-emerald-500 px-6 py-3 font-black text-white">Reactivar certificado</button>
            </form>
          )}
        </div>

        {!certificado.vigente && tieneFacultadReactivar && !inspeccionFinalizada && (
          <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-black">Reactivación bloqueada hasta nueva aprobación</p>
            <p className="mt-2 leading-6">La revocación reabrió la inspección. Primero debe completarse otra vez la captura, revisión y aprobación. Estado actual: <strong>{inspeccion.estado.replaceAll("_", " ")}</strong>.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/panel/inspecciones/${inspeccion.id}/captura`} className="rounded-full border border-amber-500 px-4 py-2 font-black text-amber-900">Ir a captura</Link>
              <Link href={`/panel/inspecciones/${inspeccion.id}/revision`} className="rounded-full border border-amber-500 px-4 py-2 font-black text-amber-900">Ir a revisión</Link>
            </div>
          </div>
        )}

        {!puedeRevocar && !tieneFacultadReactivar && (
          <div className="mt-7 border-t border-slate-200 pt-6 text-sm text-slate-500">La revocación o reactivación de certificados corresponde exclusivamente a Dirección.</div>
        )}

        {certificado.vigente && puedeRevocar && (
          <form action={revocarCertificado} className="mt-7 border-t border-slate-200 pt-6">
            <input type="hidden" name="inspeccionId" value={inspeccion.id} />
            <label className="block">
              <span className="mb-2 block text-sm font-black">Motivo de revocación</span>
              <textarea name="motivo" required minLength={10} rows={3} placeholder="Ejemplo: certificado sustituido por una nueva inspección..." className="w-full rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
            <button type="submit" className="mt-4 rounded-full bg-rose-600 px-6 py-3 font-black text-white">Revocar certificado</button>
          </form>
        )}
      </section>
    </main>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-widest text-cyan-300">{label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}
