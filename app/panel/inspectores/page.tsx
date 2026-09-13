import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function InspectoresPage({ searchParams }: { searchParams: Promise<{ q?: string; zona?: string; estado?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });

  if (!usuarioActual?.activo) redirect("/acceso");
  const rol = usuarioActual.rol;
  const puedeConsultar = rol === RolUsuario.DIRECTOR || rol === RolUsuario.ADMINISTRADOR || rol === RolUsuario.GERENTE || rol === RolUsuario.COORDINADOR;
  if (!puedeConsultar) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const zona = (params.zona ?? "").trim();
  const estado = (params.estado ?? "").trim();

  const alcance = rol === RolUsuario.GERENTE
    ? { usuario: { gerenteId: usuarioActual.id } }
    : rol === RolUsuario.COORDINADOR
      ? { usuario: { coordinadorId: usuarioActual.id } }
      : {};

  const inspectores = await prisma.inspector.findMany({
    where: {
      ...alcance,
      ...(estado === "ACTIVO" ? { activo: true } : {}),
      ...(estado === "INACTIVO" ? { activo: false } : {}),
      ...(zona ? { usuario: { ...(alcance as any).usuario, zona: { nombre: zona } } } : {}),
      ...(q ? { OR: [
        { usuario: { nombre: { contains: q, mode: "insensitive" } } },
        { usuario: { email: { contains: q, mode: "insensitive" } } },
        { telefono: { contains: q, mode: "insensitive" } },
        { especialidad: { contains: q, mode: "insensitive" } },
        { cedula: { contains: q, mode: "insensitive" } },
        { ciudad: { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    select: {
      id: true,
      telefono: true,
      especialidad: true,
      cedula: true,
      ciudad: true,
      activo: true,
      usuario: {
        select: {
          nombre: true,
          email: true,
          zona: { select: { nombre: true, codigo: true } },
          coordinador: { select: { nombre: true } },
          gerente: { select: { nombre: true } },
        },
      },
    },
    orderBy: [{ usuario: { nombre: "asc" } }],
  });

  const zonas = Array.from(new Set(inspectores.map(i => i.usuario.zona?.nombre).filter((v): v is string => Boolean(v)))).sort((a,b)=>a.localeCompare(b,"es"));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1650px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Base maestra de consulta</p>
            <h1 className="mt-2 text-4xl font-black">Inspectores</h1>
            <p className="mt-3 max-w-4xl text-slate-400">Panel exclusivamente de lectura. Altas, cambios, contraseñas, jerarquías y activación se administran únicamente desde Usuarios.</p>
          </div>
          <form className="grid gap-2 sm:grid-cols-[minmax(280px,1fr)_220px_180px_auto]">
            <input name="q" defaultValue={q} placeholder="Buscar nombre, teléfono, correo, especialidad, cédula o ciudad" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm" />
            <select name="zona" defaultValue={zona} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todas las zonas</option>{zonas.map(z => <option key={z} value={z}>{z}</option>)}</select>
            <select name="estado" defaultValue={estado} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todos</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select>
            <button className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Buscar / filtrar</button>
          </form>
        </div>

        <div className="mt-8 max-h-[72vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/70">
          <table className="min-w-[1550px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
              <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-4">Nombre</th><th className="px-4 py-4">Teléfono</th><th className="px-4 py-4">Correo</th><th className="px-4 py-4">Especialidad</th><th className="px-4 py-4">Cédula</th><th className="px-4 py-4">Ciudad</th><th className="px-4 py-4">Zona</th><th className="px-4 py-4">Coordinador</th><th className="px-4 py-4">Gerente</th><th className="px-4 py-4">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {inspectores.map(i => <tr key={i.id} className="border-t border-white/5 hover:bg-white/[0.025]">
                <td className="px-4 py-4 font-bold">{i.usuario.nombre}</td><td className="px-4 py-4">{i.telefono ?? "—"}</td><td className="px-4 py-4">{i.usuario.email}</td><td className="px-4 py-4">{i.especialidad ?? "—"}</td><td className="px-4 py-4">{i.cedula ?? "—"}</td><td className="px-4 py-4">{i.ciudad ?? "—"}</td><td className="px-4 py-4">{i.usuario.zona ? `${i.usuario.zona.nombre} · ${i.usuario.zona.codigo}` : "—"}</td><td className="px-4 py-4">{i.usuario.coordinador?.nombre ?? "—"}</td><td className="px-4 py-4">{i.usuario.gerente?.nombre ?? "—"}</td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${i.activo ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-400/10 text-slate-400"}`}>{i.activo ? "ACTIVO" : "INACTIVO"}</span></td>
              </tr>)}
            </tbody>
          </table>
          {inspectores.length === 0 && <div className="p-10 text-center text-slate-400">No hay inspectores con esos filtros dentro de tu alcance.</div>}
        </div>
      </div>
    </main>
  );
}
