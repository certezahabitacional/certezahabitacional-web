import Link from "next/link";
import { EstadoInspeccion, Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { puedeVerExpedienteTecnico } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

function formatoFecha(fecha: Date, zonaHoraria: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zonaHoraria,
  }).format(fecha);
}

function etiquetaEstado(estado: EstadoInspeccion) {
  return estado.replaceAll("_", " ");
}

export default async function InspeccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; inspector?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      zonaId: true,
      inspector: { select: { id: true } },
    },
  });

  if (!usuario?.activo) redirect("/acceso");
  if (usuario.rol === RolUsuario.CLIENTE) redirect("/portal/inspecciones");

  const rolesPermitidos = [
    RolUsuario.DIRECTOR,
    RolUsuario.ADMINISTRADOR,
    RolUsuario.VENDEDOR,
    RolUsuario.GERENTE,
    RolUsuario.COORDINADOR,
    RolUsuario.INSPECTOR,
  ];
  if (!rolesPermitidos.includes(usuario.rol)) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const estado = (params.estado ?? "").trim();
  const inspector = (params.inspector ?? "").trim();

  let alcance: Prisma.InspeccionWhereInput = {};

  switch (usuario.rol) {
    case RolUsuario.DIRECTOR:
      alcance = {};
      break;
    case RolUsuario.ADMINISTRADOR:
    case RolUsuario.VENDEDOR:
      alcance = usuario.zonaId ? { zonaId: usuario.zonaId } : {};
      break;
    case RolUsuario.GERENTE:
      alcance = { inspector: { usuario: { gerenteId: usuario.id } } };
      break;
    case RolUsuario.COORDINADOR:
      alcance = { inspector: { usuario: { coordinadorId: usuario.id } } };
      break;
    case RolUsuario.INSPECTOR:
      if (!usuario.inspector?.id) redirect("/acceso");
      alcance = { inspectorId: usuario.inspector.id };
      break;
  }

  const where: Prisma.InspeccionWhereInput = {
    AND: [
      alcance,
      estado ? { estado: estado as EstadoInspeccion } : {},
      inspector
        ? { inspector: { usuario: { nombre: { contains: inspector, mode: "insensitive" } } } }
        : {},
      q
        ? {
            OR: [
              { folio: { contains: q, mode: "insensitive" } },
              { cliente: { nombre: { contains: q, mode: "insensitive" } } },
              { inmueble: { alias: { contains: q, mode: "insensitive" } } },
              { direccion: { contains: q, mode: "insensitive" } },
              { inspector: { usuario: { nombre: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {},
    ],
  };

  const inspecciones = await prisma.inspeccion.findMany({
    where,
    select: {
      id: true,
      folio: true,
      numeroInspeccion: true,
      fechaProgramada: true,
      estado: true,
      zonaHoraria: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true, direccion: true, ciudad: true } },
      inspector: { select: { usuario: { select: { nombre: true } } } },
      zona: { select: { nombre: true, codigo: true, zonaHoraria: true } },
    },
    orderBy: [{ fechaProgramada: "desc" }, { folio: "desc" }],
    take: 500,
  });

  const inspectores = Array.from(
    new Set(
      inspecciones
        .map((i) => i.inspector?.usuario.nombre)
        .filter((nombre): nombre is string => Boolean(nombre)),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const puedeAbrirExpediente = puedeVerExpedienteTecnico(usuario.rol);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1550px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Control operativo</p>
            <h1 className="mt-2 text-4xl font-black">Inspecciones</h1>
            <p className="mt-3 max-w-4xl text-slate-400">
              Panel de lectura ordenado por fecha agendada más reciente y, en segundo término, por folio más nuevo. Dirección consulta el universo completo; los demás roles ven únicamente el alcance que les corresponde.
            </p>
          </div>

          <form className="grid gap-2 sm:grid-cols-[minmax(260px,1fr)_200px_220px_auto]">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar folio, cliente, inmueble, domicilio o inspector"
              className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"
            />
            <select name="estado" defaultValue={estado} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm">
              <option value="">Todos los estatus</option>
              {Object.values(EstadoInspeccion).map((valor) => <option key={valor} value={valor}>{etiquetaEstado(valor)}</option>)}
            </select>
            <select name="inspector" defaultValue={inspector} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm">
              <option value="">Todos los inspectores</option>
              {inspectores.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
            <button className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Buscar / filtrar</button>
          </form>
        </div>

        <div className="mt-8 max-h-[72vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/70">
          <table className="min-w-[1300px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
              <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-4">Folio</th>
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Inmueble</th>
                <th className="px-4 py-4">Agenda</th>
                <th className="px-4 py-4">Inspector</th>
                <th className="px-4 py-4">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {inspecciones.map((i) => {
                const zona = i.zona?.zonaHoraria ?? i.zonaHoraria ?? "America/Ciudad_Juarez";
                const folio = (
                  <div>
                    <p className="font-mono text-xs font-black text-cyan-300">{i.folio}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">V{i.numeroInspeccion}{i.zona ? ` · ${i.zona.codigo}` : ""}</p>
                  </div>
                );

                return (
                  <tr key={i.id} className="border-t border-white/5 hover:bg-white/[0.025]">
                    <td className="px-4 py-4">
                      {puedeAbrirExpediente ? <Link href={`/panel/inspecciones/${i.id}`}>{folio}</Link> : folio}
                    </td>
                    <td className="px-4 py-4 font-bold">{i.cliente.nombre}</td>
                    <td className="px-4 py-4">
                      <p className="font-bold">{i.inmueble?.alias ?? "Sin alias"}</p>
                      <p className="mt-1 text-xs text-slate-500">{i.inmueble ? `${i.inmueble.direccion}, ${i.inmueble.ciudad}` : "Sin inmueble asociado"}</p>
                    </td>
                    <td className="px-4 py-4">{formatoFecha(i.fechaProgramada, zona)}</td>
                    <td className="px-4 py-4">{i.inspector?.usuario.nombre ?? "Sin asignar"}</td>
                    <td className="px-4 py-4"><Estado estado={i.estado} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {inspecciones.length === 0 && <div className="p-10 text-center text-slate-400">No hay inspecciones con esos filtros dentro de tu alcance.</div>}
        </div>
      </div>
    </main>
  );
}

function Estado({ estado }: { estado: EstadoInspeccion }) {
  const clase =
    estado === EstadoInspeccion.FINALIZADA
      ? "bg-emerald-400/15 text-emerald-300"
      : estado === EstadoInspeccion.CANCELADA
        ? "bg-rose-400/15 text-rose-300"
        : estado === EstadoInspeccion.EN_PROCESO
          ? "bg-amber-400/15 text-amber-300"
          : estado === EstadoInspeccion.REPORTE_PENDIENTE
            ? "bg-violet-400/15 text-violet-300"
            : "bg-sky-400/15 text-sky-300";

  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${clase}`}>{etiquetaEstado(estado)}</span>;
}
