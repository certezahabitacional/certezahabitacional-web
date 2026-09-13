import Link from "next/link";
import { EstadoInspeccion, Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function PanelPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, zonaId: true },
  });

  if (!usuarioActual?.activo) redirect("/acceso");

  const rol = usuarioActual.rol;
  const esDirector = rol === RolUsuario.DIRECTOR;
  const esAdministrador = rol === RolUsuario.ADMINISTRADOR;
  const esGerente = rol === RolUsuario.GERENTE;
  const esCoordinador = rol === RolUsuario.COORDINADOR;

  if (!esDirector && !esAdministrador && !esGerente && !esCoordinador) {
    redirect("/acceso");
  }

  let alcanceInspecciones: Prisma.InspeccionWhereInput = {};

  if (esGerente) {
    alcanceInspecciones = usuarioActual.zonaId
      ? {
          OR: [
            { zonaId: usuarioActual.zonaId },
            {
              zonaId: null,
              inspector: { usuario: { zonaId: usuarioActual.zonaId } },
            },
          ],
        }
      : { id: "__SIN_ALCANCE__" };
  }

  if (esCoordinador) {
    alcanceInspecciones = {
      inspector: { usuario: { coordinadorId: usuarioActual.id } },
    };
  }

  const [inspeccionesPorEstado, recientes, clientes, certificados] = await Promise.all([
    prisma.inspeccion.groupBy({
      by: ["estado"],
      where: alcanceInspecciones,
      _count: { _all: true },
    }),
    prisma.inspeccion.findMany({
      where: alcanceInspecciones,
      select: {
        id: true,
        folio: true,
        tipoInmueble: true,
        ciudad: true,
        estado: true,
        ish: true,
        cliente: { select: { nombre: true } },
      },
      orderBy: { actualizadoEn: "desc" },
      take: esAdministrador ? 4 : 6,
    }),
    esDirector || esAdministrador ? prisma.cliente.count() : Promise.resolve(0),
    esDirector
      ? prisma.certificado.groupBy({ by: ["vigente"], _count: { _all: true } })
      : Promise.resolve(null),
  ]);

  function cantidad(estado: EstadoInspeccion) {
    return inspeccionesPorEstado.find((item) => item.estado === estado)?._count._all ?? 0;
  }

  const activas = cantidad(EstadoInspeccion.EN_PROCESO);
  const programadas = cantidad(EstadoInspeccion.PROGRAMADA);
  const reportesPendientes = cantidad(EstadoInspeccion.REPORTE_PENDIENTE);
  const certificadosEmitidos = certificados?.reduce((total, item) => total + item._count._all, 0) ?? 0;

  const indicadores = esDirector
    ? [
        { titulo: "Inspecciones activas", valor: activas, detalle: "Actualmente en proceso" },
        { titulo: "Programadas", valor: programadas, detalle: "Pendientes de iniciar" },
        { titulo: "Reportes pendientes", valor: reportesPendientes, detalle: "Por completar o emitir" },
        { titulo: "Clientes registrados", valor: clientes, detalle: "Base total de clientes" },
        { titulo: "Certificados emitidos", valor: certificadosEmitidos, detalle: "Total histórico" },
      ]
    : esAdministrador
      ? [
          { titulo: "Inspecciones activas", valor: activas, detalle: "Seguimiento administrativo" },
          { titulo: "Programadas", valor: programadas, detalle: "Servicios agendados" },
          { titulo: "Reportes pendientes", valor: reportesPendientes, detalle: "Seguimiento del proceso" },
          { titulo: "Clientes registrados", valor: clientes, detalle: "Base total de clientes" },
        ]
      : [
          { titulo: "Inspecciones activas", valor: activas, detalle: "Dentro de tu alcance" },
          { titulo: "Programadas", valor: programadas, detalle: "Dentro de tu alcance" },
          {
            titulo: "Reportes pendientes",
            valor: reportesPendientes,
            detalle: esGerente ? "Pendientes de control o aprobación" : "Pendientes de revisión técnica",
          },
        ];

  const tituloPanel = esDirector
    ? "Dashboard ejecutivo"
    : esAdministrador
      ? "Panel de administración"
      : esGerente
        ? "Panel de gerencia"
        : "Panel de coordinación técnica";

  const descripcionPanel = esDirector
    ? "Resumen operativo, control y estado general de la plataforma."
    : esAdministrador
      ? "Seguimiento administrativo y comercial de la operación."
      : esGerente
        ? "Control operativo y seguimiento de tu zona."
        : "Revisión técnica y seguimiento de Inspectores bajo tu coordinación.";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">Certeza Habitacional</p>
          <h1 className="mt-2 text-4xl font-black">{tituloPanel}</h1>
          <p className="mt-2 text-slate-400">{descripcionPanel}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-300">Sesión: {rol}</p>
          <p className="mt-4 max-w-3xl text-sm text-slate-500">
            Utiliza el menú principal superior para cambiar de módulo. El Dashboard ya no duplica accesos ni muestra módulos fuera de la matriz vigente.
          </p>
        </header>

        <section className={`mt-8 grid gap-5 sm:grid-cols-2 ${esDirector ? "xl:grid-cols-5" : indicadores.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
          {indicadores.map((indicador) => (
            <Metrica key={indicador.titulo} {...indicador} />
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <header className="border-b border-white/10 p-6">
            <h2 className="text-xl font-black">Actividad reciente</h2>
            <p className="mt-1 text-sm text-slate-500">Últimas inspecciones actualizadas dentro de tu alcance.</p>
          </header>

          {recientes.length === 0 ? (
            <p className="p-12 text-center text-slate-400">Aún no hay inspecciones registradas dentro de tu alcance.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-slate-950 text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Folio</th>
                    <th className="px-6 py-4">{esDirector || esAdministrador ? "Cliente" : "Referencia"}</th>
                    <th className="px-6 py-4">Inmueble</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">ISH</th>
                  </tr>
                </thead>
                <tbody>
                  {recientes.map((inspeccion) => (
                    <tr key={inspeccion.id} className="border-t border-white/10">
                      <td className="px-6 py-5">
                        <Link href={`/panel/inspecciones/${inspeccion.id}`} className="font-black text-cyan-300">
                          {inspeccion.folio}
                        </Link>
                      </td>
                      <td className="px-6 py-5 font-bold">
                        {esDirector || esAdministrador ? inspeccion.cliente.nombre : "Expediente operativo"}
                      </td>
                      <td className="px-6 py-5 text-slate-400">
                        <p>{inspeccion.tipoInmueble}</p>
                        <p className="mt-1 text-xs text-slate-600">{inspeccion.ciudad}</p>
                      </td>
                      <td className="px-6 py-5">
                        <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300">
                          {inspeccion.estado.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-5 font-black">{inspeccion.ish !== null ? Number(inspeccion.ish).toFixed(0) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metrica({ titulo, valor, detalle }: { titulo: string; valor: number; detalle: string }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="text-sm font-bold text-slate-400">{titulo}</p>
      <p className="mt-4 text-4xl font-black text-cyan-300">{String(valor).padStart(2, "0")}</p>
      <p className="mt-2 text-sm text-slate-500">{detalle}</p>
    </article>
  );
}
