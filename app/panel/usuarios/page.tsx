import { RolUsuario } from "@prisma/client";
import PasswordField from "@/components/forms/PasswordField";
import { obtenerAdministradorActual } from "@/lib/administrador-actual";
import { prisma } from "@/lib/prisma";
import { cambiarEstadoUsuario, cambiarPasswordUsuario } from "./actions";
import { actualizarUsuarioFase2 } from "./actions-fase2";
import FormularioCrearUsuario from "./FormularioCrearUsuario";
import FormularioEditarUsuario from "./FormularioEditarUsuario";

type PageProps = {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; rol?: string; estado?: string; zonaId?: string }>;
};

const ROLES_INTERNOS = [RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR];

export default async function UsuariosPage({ searchParams }: PageProps) {
  const administrador = await obtenerAdministradorActual();
  const esDirector = administrador.rol === RolUsuario.DIRECTOR;
  const esAdministrador = administrador.rol === RolUsuario.ADMINISTRADOR;
  if (!esDirector && !esAdministrador) return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white"><div className="rounded-3xl border border-rose-400/20 bg-rose-400/5 p-8 text-center"><h1 className="text-2xl font-black text-rose-300">Acceso restringido</h1><p className="mt-3 text-slate-300">Solo Dirección y Administración pueden gestionar usuarios.</p></div></main>;

  const p = await searchParams;
  const q = (p.q ?? "").trim();
  const rolFiltro = Object.values(RolUsuario).includes((p.rol ?? "") as RolUsuario) ? (p.rol as RolUsuario) : undefined;
  const estadoFiltro = (p.estado ?? "").trim();
  const zonaFiltro = esDirector ? ((p.zonaId ?? "").trim() || undefined) : administrador.zonaId ?? undefined;

  const [usuarios, zonasTodas] = await Promise.all([
    prisma.usuario.findMany({
      where: {
        ...(zonaFiltro ? { zonaId: zonaFiltro } : {}),
        ...(rolFiltro ? { rol: rolFiltro } : {}),
        ...(estadoFiltro === "ACTIVO" ? { activo: true } : {}),
        ...(estadoFiltro === "INACTIVO" ? { activo: false } : {}),
        ...(q ? { OR: [
          { nombre: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { telefono: { contains: q, mode: "insensitive" } },
          { ciudad: { contains: q, mode: "insensitive" } },
        ] } : {}),
      },
      select: {
        id: true, nombre: true, email: true, telefono: true, ciudad: true, rol: true, activo: true, creadoEn: true, ultimoAcceso: true,
        zonaId: true, gerenteId: true, coordinadorId: true,
        zona: { select: { nombre: true, codigo: true } }, gerente: { select: { nombre: true } }, coordinador: { select: { nombre: true } },
        inspector: { select: { telefono: true, especialidad: true, cedula: true, ciudad: true, activo: true } }, cliente: { select: { folio: true, nombre: true } },
      },
      orderBy: [{ creadoEn: "desc" }, { nombre: "asc" }], take: 500,
    }),
    prisma.zona.findMany({ where: { activa: true }, select: { id: true, nombre: true, codigo: true }, orderBy: { nombre: "asc" } }),
  ]);

  const zonas = esDirector ? zonasTodas : zonasTodas.filter(z => z.id === administrador.zonaId);
  const zonaJerarquia = esDirector ? undefined : administrador.zonaId ?? undefined;
  const [gerentes, coordinadores] = await Promise.all([
    prisma.usuario.findMany({ where: { rol: RolUsuario.GERENTE, activo: true, zonaId: zonaJerarquia ? zonaJerarquia : { not: null } }, select: { id: true, nombre: true, email: true, zonaId: true }, orderBy: { nombre: "asc" } }),
    prisma.usuario.findMany({ where: { rol: RolUsuario.COORDINADOR, activo: true, zonaId: zonaJerarquia ? zonaJerarquia : { not: null }, gerenteId: { not: null } }, select: { id: true, nombre: true, email: true, zonaId: true, gerenteId: true }, orderBy: { nombre: "asc" } }),
  ]);

  const rolesCreables = esDirector ? ROLES_INTERNOS : [RolUsuario.VENDEDOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR];
  function puedeModificar(usuario: { id: string; rol: RolUsuario; zonaId: string | null }) { if (usuario.id === administrador.id || usuario.rol === RolUsuario.CLIENTE) return false; if (esDirector) return true; return usuario.zonaId === administrador.zonaId && usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR; }
  function rolesEditables(usuario: { rol: RolUsuario }) { if (usuario.rol === RolUsuario.CLIENTE) return [RolUsuario.CLIENTE]; return esDirector ? ROLES_INTERNOS : [RolUsuario.VENDEDOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR]; }

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-[1700px]">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Administración de accesos</p><h1 className="mt-2 text-4xl font-black">Usuarios</h1><p className="mt-3 max-w-4xl text-slate-400">{esDirector ? "Dirección administra el sistema completo y puede separar la consulta por zona." : `Administración solo puede consultar y gestionar usuarios de ${administrador.zona?.nombre ?? "su zona"}.`}</p></div>
    <form className="grid gap-2 sm:grid-cols-[minmax(230px,1fr)_190px_160px_210px_auto]"><input name="q" defaultValue={q} placeholder="Buscar nombre, correo, teléfono o ciudad" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"/><select name="rol" defaultValue={p.rol ?? ""} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todos los roles</option>{Object.values(RolUsuario).map(r=><option key={r} value={r}>{etiquetaRol(r)}</option>)}</select><select name="estado" defaultValue={estadoFiltro} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todos</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select>{esDirector?<select name="zonaId" defaultValue={p.zonaId??""} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm"><option value="">Todas las zonas</option>{zonasTodas.map(z=><option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select>:<div className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-5 py-3 text-sm font-bold text-cyan-200">{administrador.zona?.nombre}</div>}<button className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Buscar / filtrar</button></form></div>
    {(p.ok || p.error) && <p className={`mt-6 rounded-2xl border p-4 font-bold ${p.error ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>{p.error ?? p.ok}</p>}
    <section className="mt-8 grid gap-8 xl:grid-cols-[420px_1fr]">
      <aside className="h-fit rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-2xl font-black">Crear usuario</h2><p className="mt-2 text-sm leading-6 text-slate-400">Todos los usuarios salvo Director deben pertenecer a una zona. Administración solo puede crear usuarios dentro de su propia zona.</p><FormularioCrearUsuario rolesCreables={rolesCreables} zonas={zonas} gerentes={gerentes} coordinadores={coordinadores}/></aside>
      <div className="max-h-[78vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/70"><table className="min-w-[1450px] w-full border-collapse text-left"><thead className="sticky top-0 z-20 bg-slate-900"><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="px-4 py-4">Nombre</th><th className="px-4 py-4">Teléfono</th><th className="px-4 py-4">Correo</th><th className="px-4 py-4">Rol</th><th className="px-4 py-4">Ciudad</th><th className="px-4 py-4">Zona</th><th className="px-4 py-4">Estatus</th><th className="px-4 py-4">Gestión</th></tr></thead><tbody>
        {usuarios.map(u => { const modificable=puedeModificar(u); return <tr key={u.id} className="border-t border-white/5 align-top hover:bg-white/[0.025]"><td className="px-4 py-4"><p className="font-bold">{u.nombre}</p>{u.cliente && <p className="mt-1 text-[11px] text-cyan-300">Cliente {u.cliente.folio}</p>}</td><td className="px-4 py-4">{u.inspector?.telefono ?? u.telefono ?? "—"}</td><td className="px-4 py-4">{u.email}</td><td className="px-4 py-4"><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">{etiquetaRol(u.rol)}</span></td><td className="px-4 py-4">{u.inspector?.ciudad ?? u.ciudad ?? "—"}</td><td className="px-4 py-4"><p>{u.zona ? `${u.zona.nombre} · ${u.zona.codigo}` : u.rol===RolUsuario.DIRECTOR ? "Todas las zonas" : "SIN ZONA"}</p>{u.gerente && <p className="mt-1 text-xs text-slate-500">Gerente: {u.gerente.nombre}</p>}{u.coordinador && <p className="mt-1 text-xs text-slate-500">Coordinador: {u.coordinador.nombre}</p>}</td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${u.activo ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-400/10 text-slate-400"}`}>{u.activo ? "ACTIVO" : "INACTIVO"}</span></td><td className="px-4 py-4">{modificable ? <details><summary className="cursor-pointer font-black text-amber-300">Administrar</summary><div className="mt-4 w-[520px] max-w-[75vw] space-y-5 rounded-2xl border border-white/10 bg-slate-950 p-5"><FormularioEditarUsuario usuario={u} rolesEditables={rolesEditables(u)} zonas={zonas} gerentes={gerentes} coordinadores={coordinadores} action={actualizarUsuarioFase2}/><div className="border-t border-white/10 pt-4"><form action={cambiarPasswordUsuario} className="space-y-3"><input type="hidden" name="usuarioId" value={u.id}/><PasswordField name="password" label="Nueva contraseña" autoComplete="new-password" minLength={8} inputClassName="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 pr-24"/><button className="w-full rounded-full border border-cyan-300/30 px-4 py-2 font-black text-cyan-300">Restablecer contraseña</button></form></div><form action={cambiarEstadoUsuario}><input type="hidden" name="usuarioId" value={u.id}/><input type="hidden" name="activo" value={u.activo ? "false" : "true"}/><button className={`w-full rounded-full px-4 py-2 font-black ${u.activo ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{u.activo ? "Desactivar usuario" : "Activar usuario"}</button></form></div></details> : <span className="text-xs text-slate-500">{u.id===administrador.id ? "Cuenta actual" : u.rol===RolUsuario.CLIENTE ? "Cliente automático" : "Protegido"}</span>}</td></tr>; })}
      </tbody></table>{usuarios.length===0 && <div className="p-10 text-center text-slate-400">No hay usuarios con esos filtros dentro de la zona seleccionada.</div>}</div>
    </section>
  </div></main>;
}

function etiquetaRol(rol: RolUsuario) { switch (rol) { case RolUsuario.DIRECTOR:return "Director"; case RolUsuario.ADMINISTRADOR:return "Administrador"; case RolUsuario.VENDEDOR:return "Vendedor"; case RolUsuario.GERENTE:return "Gerente"; case RolUsuario.COORDINADOR:return "Coordinador"; case RolUsuario.INSPECTOR:return "Inspector"; case RolUsuario.CLIENTE:return "Cliente"; } }
