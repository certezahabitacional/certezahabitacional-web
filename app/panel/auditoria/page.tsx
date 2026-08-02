import Link from "next/link";
import { TipoEvento } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const etiquetas: Record<TipoEvento, string> = {
  LOGIN: "Inicio de sesión",
  LOGOUT: "Cierre de sesión",
  CREAR: "Creación",
  EDITAR: "Edición",
  ELIMINAR: "Eliminación",
  EMITIR_CERTIFICADO: "Certificado emitido",
  REVOCAR_CERTIFICADO: "Certificado revocado",
  REACTIVAR_CERTIFICADO: "Certificado reactivado",
  SUBIR_EVIDENCIA: "Evidencia registrada",
  ELIMINAR_EVIDENCIA: "Evidencia eliminada",
  FIRMAR: "Firma registrada",
  DESCARGAR_REPORTE: "Reporte consultado",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    texto?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const query = await searchParams;

  const texto = query.texto?.trim() ?? "";

  const tipo =
    query.tipo &&
      Object.values(TipoEvento).includes(query.tipo as TipoEvento)
      ? (query.tipo as TipoEvento)
      : undefined;

  const desde = query.desde
    ? new Date(`${query.desde}T00:00:00`)
    : undefined;

  const hasta = query.hasta
    ? new Date(`${query.hasta}T23:59:59`)
    : undefined;

  const eventos = await prisma.eventoAuditoria.findMany({
    where: {
      tipo,
      creadoEn:
        desde || hasta
          ? {
            gte: desde,
            lte: hasta,
          }
          : undefined,
      OR: texto
        ? [
          {
            descripcion: {
              contains: texto,
              mode: "insensitive",
            },
          },
          {
            entidad: {
              contains: texto,
              mode: "insensitive",
            },
          },
          {
            usuario: {
              nombre: {
                contains: texto,
                mode: "insensitive",
              },
            },
          },
          {
            usuario: {
              email: {
                contains: texto,
                mode: "insensitive",
              },
            },
          },
        ]
        : undefined,
    },
    include: {
      usuario: {
        select: {
          nombre: true,
          email: true,
          rol: true,
        },
      },
    },
    orderBy: {
      creadoEn: "desc",
    },
    take: 250,
  });

  const eventosHoy = await prisma.eventoAuditoria.count({
    where: {
      creadoEn: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  const certificadosRevocados = await prisma.eventoAuditoria.count({
    where: {
      tipo: TipoEvento.REVOCAR_CERTIFICADO,
    },
  });

  const certificadosEmitidos = await prisma.eventoAuditoria.count({
    where: {
      tipo: TipoEvento.EMITIR_CERTIFICADO,
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/panel"
          className="font-bold text-cyan-300"
        >
          ← Volver al panel
        </Link>

        <header className="mt-6">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Control y trazabilidad
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Bitácora de auditoría
          </h1>

          <p className="mt-3 text-slate-400">
            Historial de operaciones relevantes realizadas en el sistema.
          </p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <Metrica
            titulo="Eventos de hoy"
            valor={eventosHoy}
          />

          <Metrica
            titulo="Certificados emitidos"
            valor={certificadosEmitidos}
          />

          <Metrica
            titulo="Certificados revocados"
            valor={certificadosRevocados}
          />
        </section>

        <form className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-slate-900 p-6 lg:grid-cols-[1fr_240px_180px_180px_auto]">
          <input
            name="texto"
            defaultValue={texto}
            placeholder="Buscar usuario, descripción o entidad..."
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
          />

          <select
            name="tipo"
            defaultValue={tipo ?? ""}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
          >
            <option value="">Todos los eventos</option>

            {Object.values(TipoEvento).map((valor) => (
              <option key={valor} value={valor}>
                {etiquetas[valor]}
              </option>
            ))}
          </select>

          <input
            type="date"
            name="desde"
            defaultValue={query.desde ?? ""}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
          />

          <input
            type="date"
            name="hasta"
            defaultValue={query.hasta ?? ""}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
          />

          <button className="rounded-full bg-cyan-400 px-6 py-3 font-black text-slate-950">
            Filtrar
          </button>
        </form>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-slate-950 text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-5 py-4">Fecha</th>
                  <th className="px-5 py-4">Evento</th>
                  <th className="px-5 py-4">Usuario</th>
                  <th className="px-5 py-4">Entidad</th>
                  <th className="px-5 py-4">Descripción</th>
                  <th className="px-5 py-4">IP</th>
                </tr>
              </thead>

              <tbody>
                {eventos.map((evento) => (
                  <tr
                    key={evento.id}
                    className="border-t border-white/10 align-top"
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-400">
                    {evento.creadoEn.toLocaleString("es-MX", {
                      timeZone: "America/Hermosillo",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    })}
                  
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
                        {etiquetas[evento.tipo]}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm">
                      <p className="font-bold">
                        {evento.usuario?.nombre ?? "Sistema"}
                      </p>

                      {evento.usuario?.email && (
                        <p className="mt-1 text-xs text-slate-500">
                          {evento.usuario.email}
                        </p>
                      )}

                      {evento.usuario?.rol && (
                        <p className="mt-1 text-xs text-cyan-300">
                          {evento.usuario.rol}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm">
                      <p className="font-bold">
                        {evento.entidad}
                      </p>

                      {evento.entidadId && (
                        <p className="mt-1 max-w-44 truncate text-xs text-slate-500">
                          {evento.entidadId}
                        </p>
                      )}
                    </td>

                    <td className="max-w-xl px-5 py-4 text-sm leading-6 text-slate-300">
                      {evento.descripcion}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-500">
                      {evento.ip ?? "No disponible"}
                    </td>
                  </tr>
                ))}

                {eventos.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center text-slate-500"
                    >
                      Aún no existen eventos o ningún registro coincide con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metrica({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="text-sm font-bold text-slate-400">
        {titulo}
      </p>

      <p className="mt-2 text-4xl font-black text-cyan-300">
        {valor}
      </p>
    </article>
  );
}