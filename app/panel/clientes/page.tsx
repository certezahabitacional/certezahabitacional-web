import { RolUsuario, TipoCliente } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, zonaEfectivaId } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";

const etiquetas: Record<TipoCliente, string> = {
  PARTICULAR: "Particular",
  INMOBILIARIA: "Inmobiliaria",
  CONSTRUCTORA: "Constructora",
  INVERSIONISTA: "Inversionista",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; acceso?: string; zonaId?: string }>;
}) {
  const usuarioActual = await obtenerUsuarioConAlcanceZona("/panel/clientes");
  const puedeEntrar = usuarioActual.rol === RolUsuario.DIRECTOR || usuarioActual.rol === RolUsuario.ADMINISTRADOR || usuarioActual.rol === RolUsuario.VENDEDOR;
  if (!puedeEntrar) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const tipo = (params.tipo ?? "").trim();
  const acceso = (params.acceso ?? "").trim();
  const zonaSeleccionada = zonaEfectivaId(usuarioActual, params.zonaId);
  const zonas = usuarioActual.rol === RolUsuario.DIRECTOR
    ? await prisma.zona.findMany({ where: { activa: true }, select: { id: true, nombre: true, codigo: true }, orderBy: { nombre: "asc" } })
    : [];

  const clientes = await prisma.cliente.findMany({
    where: {
      ...(zonaSeleccionada ? {
        OR: [
          { cotizaciones: { some: { zonaId: zonaSeleccionada } } },
          { inspecciones: { some: { zonaId: zonaSeleccionada } } },
        ],
      } : {}),
      ...(tipo ? { tipo: tipo as TipoCliente } : {}),
      ...(acceso === "ASIGNADO" ? { usuarioId: { not: null } } : {}),
      ...(acceso === "SIN_ACCESO" ? { usuarioId: null } : {}),
      ...(q ? { AND: [{ OR: [
        { folio: { contains: q, mode: "insensitive" } },
        { nombre: { contains: q, mode: "insensitive" } },
        { telefono: { contains: q, mode: "insensitive" } },
        { correo: { contains: q, mode: "insensitive" } },
        { direccion: { contains: q, mode: "insensitive" } },
        { ciudad: { contains: q, mode: "insensitive" } },
      ] }] } : {}),
    },
    select: {
      id: true, folio: true, nombre: true, tipo: true, telefono: true, correo: true,
      direccion: true, colonia: true, ciudad: true, estado: true,
      usuario: { select: { activo: true } },
    },
    orderBy: [{ creadoEn: "desc" }, { folio: "desc" }],
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Base maestra de consulta</p>
            <h1 className="mt-2 text-4xl font-black">Clientes</h1>
            <p className="mt-3 max-w-4xl text-slate-400">{usuarioActual.rol === RolUsuario.DIRECTOR ? "Dirección consulta todas las zonas, separadas mediante el filtro de zona." : `Consulta limitada a ${usuarioActual.zona?.nombre ?? "tu zona"}.`}</p>
          </div>

          <form className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_180px_180px_210px_auto]">
            <input name="q" defaultValue={q} placeholder="Buscar folio, nombre, teléfono, correo o domicilio" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm" />
            <select name="tipo" defaultValue={tipo} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todos los tipos</option>{Object.entries(etiquetas).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select>
            <select name="acceso" defaultValue={acceso} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todos los accesos</option><option value="ASIGNADO">Acceso asignado</option><option value="SIN_ACCESO">Sin acceso</option></select>
            {usuarioActual.rol === RolUsuario.DIRECTOR ? <select name="zonaId" defaultValue={params.zonaId ?? ""} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todas las zonas</option>{zonas.map(z => <option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select> : <div className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-5 py-3 text-sm font-bold text-cyan-200">{usuarioActual.zona?.nombre}</div>}
            <button className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Buscar / filtrar</button>
          </form>
        </div>

        <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/70">
          <table className="min-w-[1350px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.08)]"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="px-4 py-4">Folio</th><th className="px-4 py-4">Nombre</th><th className="px-4 py-4">Tipo de cliente</th><th className="px-4 py-4">Teléfono</th><th className="px-4 py-4">Correo</th><th className="px-4 py-4">Domicilio</th><th className="px-4 py-4">Estatus</th></tr></thead>
            <tbody>{clientes.map((cliente) => <tr key={cliente.id} className="border-t border-white/5 hover:bg-white/[0.025]"><td className="px-4 py-4 font-mono text-xs font-black text-cyan-300">{cliente.folio}</td><td className="px-4 py-4 font-bold">{cliente.nombre}</td><td className="px-4 py-4">{etiquetas[cliente.tipo]}</td><td className="px-4 py-4">{cliente.telefono ?? "—"}</td><td className="px-4 py-4">{cliente.correo ?? "—"}</td><td className="px-4 py-4 text-slate-300">{[cliente.direccion, cliente.colonia, cliente.ciudad, cliente.estado].filter(Boolean).join(", ") || "—"}</td><td className="px-4 py-4">{cliente.usuario ? <span className={`rounded-full px-3 py-1 text-xs font-black ${cliente.usuario.activo ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{cliente.usuario.activo ? "ACCESO ASIGNADO" : "ACCESO INACTIVO"}</span> : <span className="rounded-full bg-slate-400/10 px-3 py-1 text-xs font-black text-slate-400">SIN ACCESO</span>}</td></tr>)}</tbody>
          </table>
          {clientes.length === 0 && <div className="p-10 text-center text-slate-400">No hay clientes con esos filtros dentro de la zona seleccionada.</div>}
        </div>
      </div>
    </main>
  );
}
