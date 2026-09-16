import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enviarReporteDireccionV1, terminarTrabajoCampoV1 } from "./actions";

type Estado = {
  campoFinalizadoEn: Date | null;
  reporteLimiteEn: Date | null;
  areasTotal: number;
  areasCompletas: number;
  procesosTotal: number;
  procesosCompletos: number;
  hallazgos: number;
  hallazgosCompletos: number;
  fotosFachada: number;
  portadaFachada: number;
  syncPendientes: number;
};

export default async function CierreV1Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true, inspector: { select: { id: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      numeroInspeccion: true,
      estado: true,
      inspectorId: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true, direccion: true } },
      firmas: { select: { tipo: true } },
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}`);

  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const consulta = ([RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR] as RolUsuario[]).includes(usuario.rol);
  if (!esInspector && !consulta) redirect("/acceso");

  const [estado] = await prisma.$queryRaw<Estado[]>`
    SELECT
      c."campoFinalizadoEn", c."reporteLimiteEn",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true) AS "areasTotal",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true AND a."estado"='REVISADA' AND a."resultado" IN ('SIN_HALLAZGOS','CON_HALLAZGOS')) AS "areasCompletas",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${id} AND p."obligatorio"=true) AS "procesosTotal",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${id} AND p."obligatorio"=true AND p."estado" IN ('COMPLETADO','NO_APLICA')) AS "procesosCompletos",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${id}) AS "hallazgos",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${id} AND (SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id") >= 4 AND nullif(btrim(coalesce(h."descripcion",'')),'') IS NOT NULL) AS "hallazgosCompletos",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a JOIN "FotografiaArea" fa ON fa."areaId"=a."id" WHERE a."inspeccionId"=${id} AND a."codigo"='FACHADA_PRINCIPAL') AS "fotosFachada",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a JOIN "FotografiaArea" fa ON fa."areaId"=a."id" WHERE a."inspeccionId"=${id} AND a."codigo"='FACHADA_PRINCIPAL' AND fa."candidataPortada"=true) AS "portadaFachada",
      (SELECT COUNT(*)::int FROM "OperacionCampoSync" s WHERE s."inspeccionId"=${id} AND s."estado" <> 'PROCESADA') AS "syncPendientes"
    FROM "InspeccionControlV2" c WHERE c."inspeccionId"=${id} LIMIT 1
  `;

  const firmaInspector = inspeccion.firmas.some((f) => f.tipo.toLowerCase().includes("inspector"));
  const firmaCliente = inspeccion.firmas.some((f) => f.tipo.toLowerCase().includes("cliente"));
  const listoCampo = Boolean(
    estado && estado.areasTotal > 0 && estado.areasCompletas === estado.areasTotal &&
    estado.procesosTotal > 0 && estado.procesosCompletos === estado.procesosTotal &&
    estado.hallazgos === estado.hallazgosCompletos && estado.fotosFachada >= 4 &&
    estado.portadaFachada === 1 && estado.syncPendientes === 0 && firmaInspector && firmaCliente
  );
  const campoTerminado = Boolean(estado?.campoFinalizadoEn);
  const ahora = new Date();
  const limite = estado?.reporteLimiteEn ? new Date(estado.reporteLimiteEn) : null;
  const minutosRestantes = limite ? Math.floor((limite.getTime() - ahora.getTime()) / 60000) : null;
  const vencido = minutosRestantes !== null && minutosRestantes < 0;
  const horasRestantes = minutosRestantes !== null ? Math.max(0, Math.floor(minutosRestantes / 60)) : null;
  const mins = minutosRestantes !== null ? Math.max(0, minutosRestantes % 60) : null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/flujo`} className="text-sm font-black text-cyan-300">← Flujo V1</Link>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300">CIERRE V1</span>
        </div>

        <header className="mt-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">Método Certeza Habitacional</p>
          <h1 className="mt-2 text-3xl font-black">Cierre de inspección en sitio</h1>
          <p className="mt-2 text-sm text-slate-400">{inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? inspeccion.inmueble?.direccion ?? "Inmueble"}</p>
        </header>

        {(query.ok || query.error) && <div className={`mt-5 rounded-2xl p-4 text-sm font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{query.error ?? query.ok}</div>}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="Áreas" valor={`${estado?.areasCompletas ?? 0}/${estado?.areasTotal ?? 0}`} ok={Boolean(estado && estado.areasTotal > 0 && estado.areasCompletas === estado.areasTotal)} />
          <Card titulo="Procesos" valor={`${estado?.procesosCompletos ?? 0}/${estado?.procesosTotal ?? 0}`} ok={Boolean(estado && estado.procesosTotal > 0 && estado.procesosCompletos === estado.procesosTotal)} />
          <Card titulo="Hallazgos completos" valor={`${estado?.hallazgosCompletos ?? 0}/${estado?.hallazgos ?? 0}`} ok={Boolean(estado && estado.hallazgosCompletos === estado.hallazgos)} />
          <Card titulo="Firmas" valor={`${Number(firmaInspector) + Number(firmaCliente)}/2`} ok={firmaInspector && firmaCliente} />
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-5">
          <h2 className="text-xl font-black">Semáforo de salida</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Linea ok={(estado?.fotosFachada ?? 0) >= 4} texto={`Fachada: ${estado?.fotosFachada ?? 0}/4 fotografías`} />
            <Linea ok={(estado?.portadaFachada ?? 0) === 1} texto={`Foto de portada: ${estado?.portadaFachada ?? 0 === 1 ? "seleccionada" : "pendiente"}`} />
            <Linea ok={(estado?.syncPendientes ?? 0) === 0} texto={`Sincronización: ${estado?.syncPendientes ?? 0} pendientes`} />
            <Linea ok={firmaInspector} texto={`Firma Inspector: ${firmaInspector ? "lista" : "pendiente"}`} />
            <Linea ok={firmaCliente} texto={`Firma cliente: ${firmaCliente ? "lista" : "pendiente"}`} />
            <Linea ok={listoCampo} texto={listoCampo ? "Visita lista para terminar" : "Aún existen requisitos pendientes"} />
          </div>
        </section>

        {!campoTerminado && inspeccion.estado === EstadoInspeccion.EN_PROCESO && (
          <section className={`mt-5 rounded-3xl border p-6 ${listoCampo ? "border-emerald-300/20 bg-emerald-300/5" : "border-amber-300/20 bg-amber-300/5"}`}>
            <h2 className="text-xl font-black">Terminar trabajo de campo</h2>
            <p className="mt-2 text-sm text-slate-300">Al terminar, el cliente podrá ver el pre-reporte y comenzará la ventana máxima de 12 horas para la edición final del reporte.</p>
            {esInspector && <form action={terminarTrabajoCampoV1} className="mt-4"><input type="hidden" name="inspeccionId" value={id}/><button disabled={!listoCampo} className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">TERMINAR TRABAJO DE CAMPO</button></form>}
          </section>
        )}

        {campoTerminado && (
          <section className={`mt-5 rounded-3xl border p-6 ${vencido ? "border-rose-300/20 bg-rose-300/5" : "border-cyan-300/20 bg-cyan-300/5"}`}>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Ventana de edición</p>
            <h2 className="mt-2 text-2xl font-black">{vencido ? "Plazo objetivo vencido" : `${horasRestantes} h ${mins} min restantes`}</h2>
            {limite && <p className="mt-2 text-sm text-slate-300">Límite registrado: {limite.toLocaleString("es-MX")}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/panel/inspecciones/${id}/pre-reporte`} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950">Ver pre-reporte</Link>
              <Link href={`/panel/inspecciones/${id}/reporte-v1`} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-black">Revisar reporte V1</Link>
              <Link href={`/panel/inspecciones/${id}/reporte-evidencias`} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-black">Editar evidencias</Link>
            </div>
            {esInspector && inspeccion.estado === EstadoInspeccion.EN_PROCESO && <form action={enviarReporteDireccionV1} className="mt-5"><input type="hidden" name="inspeccionId" value={id}/><button className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">ENVIAR REPORTE A DIRECCIÓN</button></form>}
          </section>
        )}
      </div>
    </main>
  );
}

function Card({ titulo, valor, ok }: { titulo: string; valor: string; ok: boolean }) {
  return <article className={`rounded-2xl border p-4 ${ok ? "border-emerald-300/15 bg-emerald-300/5" : "border-white/10 bg-slate-900"}`}><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-2 text-2xl font-black ${ok ? "text-emerald-300" : "text-amber-300"}`}>{valor}</p></article>;
}

function Linea({ ok, texto }: { ok: boolean; texto: string }) {
  return <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${ok ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{ok ? "✓" : "•"} {texto}</div>;
}