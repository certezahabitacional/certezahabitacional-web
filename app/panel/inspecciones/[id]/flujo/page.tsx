import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { validarInicioCampoPorCaja } from "@/lib/inspeccion-finanzas";
import { prisma } from "@/lib/prisma";
import { finalizarCapturaGuiada, iniciarInspeccionDesdeFlujo } from "./actions";

type ControlV1 = {
  proyectoConfirmado: boolean;
  areasConfirmadas: boolean;
  areasTotal: number;
  areasCompletas: number;
  protocoloTotal: number;
  protocoloCompleto: number;
  fachadaPortada: boolean;
};

type ControlV2 = {
  pendientesPrevios: number;
  pendientesAtendidos: number;
  hallazgosActuales: number;
  hallazgosConEvidencia: number;
};

async function controlV1(id: string): Promise<ControlV1> {
  const [r] = await prisma.$queryRaw<ControlV1[]>`
    SELECT
      COALESCE(c."proyectoConfirmado",false) AS "proyectoConfirmado",
      COALESCE(c."areasConfirmadas",false) AS "areasConfirmadas",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true) AS "areasTotal",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a
        WHERE a."inspeccionId"=${id} AND a."obligatoria"=true AND a."estado"='REVISADA'
          AND nullif(btrim(coalesce(a."comentarioFinal",'')),'') IS NOT NULL
          AND (SELECT COUNT(*) FROM "FotografiaArea" fa WHERE fa."areaId"=a."id") >= 4) AS "areasCompletas",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${id} AND p."obligatorio"=true) AS "protocoloTotal",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${id} AND p."obligatorio"=true AND p."estado" IN ('COMPLETADO','NO_APLICA')) AS "protocoloCompleto",
      EXISTS(
        SELECT 1 FROM "AreaInspeccion" a
        JOIN "FotografiaArea" fa ON fa."areaId"=a."id"
        WHERE a."inspeccionId"=${id} AND a."codigo"='FACHADA_PRINCIPAL' AND fa."candidataPortada"=true
      ) AS "fachadaPortada"
    FROM "InspeccionControlV2" c
    WHERE c."inspeccionId"=${id}
    LIMIT 1
  `;
  return r ?? { proyectoConfirmado: false, areasConfirmadas: false, areasTotal: 0, areasCompletas: 0, protocoloTotal: 0, protocoloCompleto: 0, fachadaPortada: false };
}

async function controlV2(id: string, anteriorId: string | null): Promise<ControlV2> {
  if (!anteriorId) return { pendientesPrevios: 0, pendientesAtendidos: 0, hallazgosActuales: 0, hallazgosConEvidencia: 0 };
  const [r] = await prisma.$queryRaw<ControlV2[]>`
    SELECT
      (SELECT COUNT(*)::int FROM "Hallazgo" h
       WHERE h."inspeccionId"=${anteriorId} AND COALESCE(h."resuelto",false)=false AND COALESCE(h."estadoSeguimiento"::text,'') <> 'CORREGIDO') AS "pendientesPrevios",
      (SELECT COUNT(*)::int FROM "Hallazgo" h
       WHERE h."inspeccionId"=${anteriorId} AND COALESCE(h."resuelto",false)=false AND COALESCE(h."estadoSeguimiento"::text,'') <> 'CORREGIDO'
         AND EXISTS(SELECT 1 FROM "Hallazgo" s WHERE s."inspeccionId"=${id} AND s."hallazgoAnteriorId"=h."id"
           AND s."estadoSeguimiento"::text IN ('CORREGIDO','PARCIALMENTE_CORREGIDO','NO_CORREGIDO','CORRECCION_NO_SATISFACTORIA','NO_VERIFICABLE')
           AND nullif(btrim(coalesce(s."observacionSeguimiento",'')),'') IS NOT NULL)) AS "pendientesAtendidos",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${id}) AS "hallazgosActuales",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${id}
         AND (SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id" AND f."inspeccionId"=${id}) >= 4) AS "hallazgosConEvidencia"
  `;
  return r ?? { pendientesPrevios: 0, pendientesAtendidos: 0, hallazgosActuales: 0, hallazgosConEvidencia: 0 };
}

export default async function FlujoCampoPage({
  params,
  searchParams,
}: {
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
      estado: true,
      numeroInspeccion: true,
      inspeccionAnteriorId: true,
      inspectorId: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
      firmas: { select: { tipo: true } },
    },
  });
  if (!inspeccion) notFound();

  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const consulta = [RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR].includes(usuario.rol);
  if (!esInspector && !consulta) redirect("/acceso");

  const liberacionCaja = inspeccion.estado === EstadoInspeccion.PROGRAMADA ? await validarInicioCampoPorCaja(id) : null;
  const firmaInspector = inspeccion.firmas.some((f) => f.tipo.toLowerCase().includes("inspector"));
  const firmaCliente = inspeccion.firmas.some((f) => f.tipo.toLowerCase().includes("cliente"));
  const firmasListas = firmaInspector && firmaCliente;

  const [sync] = await prisma.$queryRaw<Array<{ pendientes: number }>>`
    SELECT COUNT(*)::int AS "pendientes" FROM "OperacionCampoSync" WHERE "inspeccionId"=${id} AND "estado" <> 'PROCESADA'
  `;
  const syncPendientes = Number(sync?.pendientes ?? 0);

  const esV1 = inspeccion.numeroInspeccion === 1;
  const v1 = esV1 ? await controlV1(id) : null;
  const v2 = !esV1 ? await controlV2(id, inspeccion.inspeccionAnteriorId) : null;

  const v1Tecnico = Boolean(v1 && v1.proyectoConfirmado && v1.areasConfirmadas && v1.areasTotal > 0 && v1.areasCompletas === v1.areasTotal && v1.protocoloTotal > 0 && v1.protocoloCompleto === v1.protocoloTotal && v1.fachadaPortada);
  const v2Tecnico = Boolean(v2 && v2.pendientesAtendidos === v2.pendientesPrevios && v2.hallazgosConEvidencia === v2.hallazgosActuales);
  const listo = inspeccion.estado === EstadoInspeccion.EN_PROCESO && (esV1 ? v1Tecnico : v2Tecnico) && firmasListas && syncPendientes === 0;

  const pasos = esV1
    ? [
        { n: 1, t: "Proyecto y áreas", ok: Boolean(v1?.proyectoConfirmado && v1?.areasConfirmadas), d: `Proyecto: ${v1?.proyectoConfirmado ? "confirmado" : "pendiente"} · áreas: ${v1?.areasConfirmadas ? "confirmadas" : "pendientes"}`, href: `/panel/inspecciones/${id}/areas` },
        { n: 2, t: "Protocolo secuencial", ok: Boolean(v1 && v1.protocoloTotal > 0 && v1.protocoloCompleto === v1.protocoloTotal), d: `${v1?.protocoloCompleto ?? 0}/${v1?.protocoloTotal ?? 0} pasos obligatorios completos`, href: `/panel/inspecciones/${id}/protocolo` },
        { n: 3, t: "Cobertura por áreas", ok: Boolean(v1 && v1.areasTotal > 0 && v1.areasCompletas === v1.areasTotal && v1.fachadaPortada), d: `${v1?.areasCompletas ?? 0}/${v1?.areasTotal ?? 0} áreas completas · fachada/portada: ${v1?.fachadaPortada ? "sí" : "pendiente"}`, href: `/panel/inspecciones/${id}/areas` },
        { n: 4, t: "Hallazgos", ok: true, d: "Solo registra defectos reales. V1 puede cerrar con cero hallazgos.", href: `/panel/inspecciones/${id}/captura` },
        { n: 5, t: "Firmas", ok: firmasListas, d: `Inspector: ${firmaInspector ? "sí" : "pendiente"} · Cliente: ${firmaCliente ? "sí" : "pendiente"}`, href: `/panel/inspecciones/${id}/firmas` },
      ]
    : [
        { n: 1, t: `Pendientes heredados de V${inspeccion.numeroInspeccion - 1}`, ok: Boolean(v2 && v2.pendientesAtendidos === v2.pendientesPrevios), d: `${v2?.pendientesAtendidos ?? 0}/${v2?.pendientesPrevios ?? 0} pendientes verificados`, href: `/panel/inspecciones/${id}/captura` },
        { n: 2, t: "Evidencia de seguimiento", ok: Boolean(v2 && v2.hallazgosConEvidencia === v2.hallazgosActuales), d: `${v2?.hallazgosConEvidencia ?? 0}/${v2?.hallazgosActuales ?? 0} verificaciones/hallazgos con 4+ fotos`, href: `/panel/inspecciones/${id}/captura` },
        { n: 3, t: "Nuevo hallazgo / solicitud especial", ok: true, d: "Opcional. Solo si surge una condición nueva o una solicitud adicional del cliente.", href: `/panel/inspecciones/${id}/captura` },
        { n: 4, t: "Firmas", ok: firmasListas, d: `Inspector: ${firmaInspector ? "sí" : "pendiente"} · Cliente: ${firmaCliente ? "sí" : "pendiente"}`, href: `/panel/inspecciones/${id}/firmas` },
      ];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href={`/panel/inspecciones/${id}`} className="text-sm font-black text-cyan-300">← Expediente</Link>
        <p className="mt-7 text-xs font-black uppercase tracking-[.25em] text-amber-300">Flujo operativo de campo</p>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-4xl font-black">{inspeccion.folio}</h1><span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-300">V{inspeccion.numeroInspeccion}</span></div>
        <p className="mt-2 text-slate-400">{inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"}</p>

        {(query.ok || query.error) && <p className={`mt-5 rounded-2xl p-4 font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{query.error ?? query.ok}</p>}

        {inspeccion.estado === EstadoInspeccion.PROGRAMADA && (
          <section className={`mt-7 rounded-3xl border p-6 ${liberacionCaja?.ok ? "border-emerald-300/25 bg-emerald-300/5" : "border-amber-300/20 bg-amber-300/5"}`}>
            <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Liberación financiera de Caja</p>
            <h2 className="mt-2 text-xl font-black">Inicio de trabajo de campo</h2>
            {liberacionCaja?.ok ? <><p className="mt-2 text-sm text-emerald-100">Caja autoriza el inicio.</p>{esInspector && <form action={iniciarInspeccionDesdeFlujo} className="mt-5"><input type="hidden" name="inspeccionId" value={id}/><button className="rounded-full bg-emerald-300 px-6 py-3 font-black text-slate-950">Iniciar inspección en campo</button></form>}</> : <p className="mt-2 text-sm text-amber-100">{liberacionCaja?.error ?? "Caja no ha liberado el inicio de campo."}</p>}
          </section>
        )}

        {inspeccion.estado !== EstadoInspeccion.PROGRAMADA && (
          <>
            <div className="mt-8 space-y-4">
              {pasos.map((p) => <Link key={p.n} href={p.href} className={`grid gap-3 rounded-3xl border p-5 transition md:grid-cols-[55px_1fr_auto] md:items-center ${p.ok ? "border-emerald-400/20 bg-emerald-400/5" : "border-white/10 bg-slate-900 hover:border-cyan-300/30"}`}><span className={`grid h-11 w-11 place-items-center rounded-full font-black ${p.ok ? "bg-emerald-300 text-slate-950" : "bg-slate-800 text-cyan-300"}`}>{p.ok ? "✓" : p.n}</span><div><h2 className="text-lg font-black">{p.t}</h2><p className="mt-1 text-sm text-slate-400">{p.d}</p></div><span className="text-sm font-black text-cyan-300">Abrir →</span></Link>)}
            </div>

            <section className={`mt-6 rounded-3xl border p-5 ${syncPendientes === 0 ? "border-emerald-300/20 bg-emerald-300/5" : "border-amber-300/20 bg-amber-300/5"}`}>
              <p className="font-black">Sincronización de campo</p>
              <p className="mt-2 text-sm text-slate-300">{syncPendientes === 0 ? "No hay operaciones pendientes de sincronizar." : `${syncPendientes} operación(es) siguen pendientes. El cierre permanecerá bloqueado hasta sincronizarlas.`}</p>
            </section>

            <section className={`mt-7 rounded-3xl border p-6 ${listo ? "border-emerald-300/25 bg-emerald-300/5" : "border-amber-300/20 bg-amber-300/5"}`}>
              <h2 className="text-xl font-black">Entrega a revisión</h2>
              {listo ? <><p className="mt-2 text-sm text-emerald-100">La visita cumple los requisitos técnicos, firmas y sincronización. El Inspector puede entregar el expediente.</p>{esInspector && <form action={finalizarCapturaGuiada} className="mt-5"><input type="hidden" name="inspeccionId" value={id}/><button className="rounded-full bg-emerald-300 px-6 py-3 font-black text-slate-950">Finalizar captura y enviar a revisión</button></form>}</> : <p className="mt-2 text-sm text-amber-100">Completa los pasos pendientes. El sistema no habilitará la entrega mientras falte un requisito.</p>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
