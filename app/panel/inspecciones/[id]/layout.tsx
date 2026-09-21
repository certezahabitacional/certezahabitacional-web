import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { rolAsignableDesdeUsuario, usuarioAsignadoAInspeccion } from "@/lib/asignaciones-inspeccion";
import { prisma } from "@/lib/prisma";
import RevisionCanonicaNotice from "./RevisionCanonicaNotice";

export default async function InspeccionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await obtenerUsuarioConAlcanceZona(`/panel/inspecciones/${id}`);
  if (usuario.rol === RolUsuario.CLIENTE) redirect(`/portal/inspecciones/${id}`);

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { id: true, zonaId: true, numeroInspeccion: true, estado: true },
  });
  if (!inspeccion) notFound();
  if (!puedeAccederZona(usuario, inspeccion.zonaId)) redirect("/acceso");

  const rolAsignable = rolAsignableDesdeUsuario(usuario.rol);
  if (rolAsignable && !(await usuarioAsignadoAInspeccion(id, usuario.id, rolAsignable))) redirect("/acceso");

  const permitidos: RolUsuario[] = [RolUsuario.DIRECTOR,RolUsuario.ADMINISTRADOR,RolUsuario.VENDEDOR,RolUsuario.GERENTE,RolUsuario.COORDINADOR,RolUsuario.INSPECTOR];
  if (!permitidos.includes(usuario.rol)) redirect("/acceso");

  const esV1 = inspeccion.numeroInspeccion === 1;
  const [controlV1] = esV1
    ? await prisma.$queryRaw<Array<{
        inspeccionTecnicaConcluidaEn: Date | null;
        preReporteGeneradoEn: Date | null;
        campoFinalizadoEn: Date | null;
        revisionInspectorFinalEn: Date | null;
      }>>`
        SELECT "inspeccionTecnicaConcluidaEn","preReporteGeneradoEn","campoFinalizadoEn","revisionInspectorFinalEn"
        FROM "InspeccionControlV2"
        WHERE "inspeccionId"=${id}
        LIMIT 1
      `
    : [null];

  const [portadaV1] = esV1
    ? await prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COUNT(*) FILTER (WHERE fa."candidataPortada"=true)::int AS "total"
        FROM "FotografiaArea" fa
        JOIN "AreaInspeccion" a ON a."id"=fa."areaId"
        WHERE a."inspeccionId"=${id}
          AND a."codigo" IN ('FACHADA_PRINCIPAL','FACHADA_FRONTAL')
      `
    : [{ total: 0 }];

  const pasoInspectorV1 =
    !esV1 ? 0 :
    inspeccion.estado === EstadoInspeccion.FINALIZADA ? 6 :
    inspeccion.estado === EstadoInspeccion.REPORTE_PENDIENTE ? 6 :
    controlV1?.revisionInspectorFinalEn ? 6 :
    controlV1?.campoFinalizadoEn ? 5 :
    controlV1?.preReporteGeneradoEn ? 5 :
    controlV1?.inspeccionTecnicaConcluidaEn ? 4 :
    inspeccion.estado === EstadoInspeccion.EN_PROCESO ? 3 :
    Number(portadaV1?.total ?? 0) > 0 ? 2 : 1;

  const etapaPosteriorHabilitada =
    !esV1 ||
    Boolean(controlV1?.inspeccionTecnicaConcluidaEn) ||
    inspeccion.estado !== EstadoInspeccion.EN_PROCESO;

  const rolesAjustes: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.INSPECTOR];
  const puedeVerAjustes = etapaPosteriorHabilitada && rolesAjustes.includes(usuario.rol);
  const rolesRevision: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR];
  const puedeVerRevision = etapaPosteriorHabilitada && rolesRevision.includes(usuario.rol);
  const mostrarBarraInferior = !esV1 && (puedeVerRevision || puedeVerAjustes);

  const esInspectorV1 = esV1 && usuario.rol === RolUsuario.INSPECTOR;
  const pasosInspector = [
    { n: 1, titulo: "Foto de portada", href: `/panel/inspecciones/${id}/revision-inicial` },
    { n: 2, titulo: "Validar datos", href: `/panel/inspecciones/${id}/revision-inicial` },
    { n: 3, titulo: "Desarrollo de inspección", href: `/panel/inspecciones/${id}/flujo` },
    { n: 4, titulo: "Generar PRE REPORTE", href: `/panel/inspecciones/${id}/reporte-v1` },
    { n: 5, titulo: "Revisión y ajustes", href: `/panel/inspecciones/${id}/revision-final-inspector` },
    { n: 6, titulo: "Enviar / autorización Dirección", href: inspeccion.estado === EstadoInspeccion.FINALIZADA ? `/panel/inspecciones/${id}/reporte-v1` : `/panel/inspecciones/${id}/cierre-v1` },
  ];

  return <>
    <RevisionCanonicaNotice inspeccionId={id} visible={!esV1 && puedeVerRevision} />
    {esInspectorV1 && (
      <div className="print:hidden border-b border-white/10 bg-slate-950 px-4 py-3 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Ruta del Inspector · 6 pasos</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {pasosInspector.map((paso) => {
              const actual = paso.n === pasoInspectorV1;
              const disponible = paso.n <= pasoInspectorV1 || (paso.n === 4 && Boolean(controlV1?.inspeccionTecnicaConcluidaEn));
              return disponible ? (
                <Link key={paso.n} href={paso.href} className={`rounded-xl border px-3 py-2 text-xs font-black ${actual ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-200" : "border-white/10 bg-slate-900 text-slate-300"}`}>
                  <span className="block text-[10px] text-slate-500">PASO {paso.n}</span>{paso.titulo}
                </Link>
              ) : (
                <div key={paso.n} className="rounded-xl border border-white/5 bg-slate-950 px-3 py-2 text-xs font-black text-slate-700">
                  <span className="block text-[10px]">PASO {paso.n}</span>{paso.titulo}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}
    <div className="expediente-metodo-certeza">{children}</div>
    {mostrarBarraInferior ? (
      <>
        <nav className="print:hidden fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[980px] -translate-x-1/2 rounded-3xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {!esV1 && (
              <>
                <Link href={`/panel/inspecciones/${id}/captura`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-violet-300 sm:text-sm">
                  Seguimiento V{inspeccion.numeroInspeccion}
                </Link>
                <Link href={`/panel/inspecciones/${id}/evidencia-control`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-amber-300 sm:text-sm">
                  Evidencia 4+
                </Link>
              </>
            )}
            {puedeVerRevision ? (
              <Link href={`/panel/inspecciones/${id}/revision`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-fuchsia-300 sm:text-sm">
                Revisión
              </Link>
            ) : null}
            {puedeVerAjustes ? (
              <Link href={`/panel/inspecciones/${id}/ajustes`} className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-orange-300 sm:text-sm">
                Ajustes
              </Link>
            ) : null}
          </div>
        </nav>
        <div className="print:hidden h-32" aria-hidden="true" />
      </>
    ) : null}
  </>;
}
