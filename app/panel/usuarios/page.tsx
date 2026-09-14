import { RolUsuario } from "@prisma/client";
import PasswordField from "@/components/forms/PasswordField";
import { obtenerAdministradorActual } from "@/lib/administrador-actual";
import { prisma } from "@/lib/prisma";
import { cambiarEstadoUsuarioZona, cambiarPasswordUsuarioZona } from "./actions-zona";
import { actualizarUsuarioFase2 } from "./actions-fase2";
import FormularioCrearUsuario from "./FormularioCrearUsuario";
import FormularioEditarUsuario from "./FormularioEditarUsuario";

type PageProps = { searchParams: Promise<{ ok?: string; error?: string; q?: string; rol?: string; estado?: string; zonaId?: string }> };
const ROLES_INTERNOS = [RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR, RolUsuario.INSPECTOR];

export default async function UsuariosPage({ searchParams }: PageProps) {
  const administrador = await obtenerAdministradorActual();
  const esDirector = administrador.rol === RolUsuario.DIRECTOR;
  if (!esDirector && administrador.rol !== RolUsuario.ADMINISTRADOR) return null;
  const p = await searchParams;
  const q = (p.q ?? "").trim();
  const rolFiltro = Object.values(RolUsuario).includes((p.rol ?? "") as RolUsuario) ? p.rol as RolUsuario : undefined;
  const estadoFiltro = (p.estado ?? "").trim();
  const zonaFiltro = esDirector ? ((p.zonaId ?? "").trim() || undefined) : administrador.zonaId ?? undefined;

  const zonasTodas = await prisma.zona.findMany({ where: { activa: true }, select: { id: true, nombre: true, codigo: true }, orderBy: { nombre: "asc" } });
  const zonas = esDirector ? zonasTodas : zonasTodas.filter(z => z.id === administrador.zonaId);
  const usuarios = await prisma.usuario.findMany({
    where: {
      ...(zonaFiltro ? { zonaId: zonaFiltro } : {}),
      ...(rolFiltro ? { rol: rolFiltro } : {}),
      ...(estadoFiltro === "ACTIVO" ? { activo: true } : {}),
      ...(estadoFiltro === "INACTIVO" ? { activo: false } : {}),
      ...(q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { telefono: { contains: q, mode: "insensitive" } }, { ciudad: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: { id:true,nombre:true,email:true,telefono:true,ciudad:true,rol:true,activo:true,zonaId:true,gerenteId:true,coordinadorId:true,zona:{select:{nombre:true,codigo:true}},gerente:{select:{nombre:true}},coordinador:{select:{nombre:true}},inspector:{select:{telefono:true,especialidad:true,cedula:true,ciudad:true,activo:true}},cliente:{select:{folio:true,nombre:true}} },
    orderBy: [{ creadoEn: "desc" }, { nombre: "asc" }], take: 500,
  });
  const jerarquiaZona = esDirector ? undefined : administrador.zonaId ?? undefined;
  const [gerentes, coordinadores] = await Promise.all([
    prisma.usuario.findMany({ where: { rol: RolUsuario.GERENTE, activo: true, zonaId: jerarquiaZona ? jerarquiaZona : { not: null } }, select: { id:true,nombre:true,email:true,zonaId:true }, orderBy:{nombre:"asc"} }),
    prisma.usuario.findMany({ where: { rol: RolUsuario.COORDINADOR, activo: true, zonaId: jerarquiaZona ? jerarquiaZona : { not: null }, gerenteId:{not:null} }, select:{id:true,nombre:true,email:true,zonaId:true,gerenteId:true}, orderBy:{nombre:"asc"} }),
  ]);
  const rolesCreables = esDirector ? ROLES_INTERNOS : [RolUsuario.VENDEDOR,RolUsuario.GERENTE,RolUsuario.COORDINADOR,RolUsuario.INSPECTOR];
  const rolesEditables = esDirector ? ROLES_INTERNOS : [RolUsuario.VENDEDOR,RolUsuario.GERENTE,RolUsuario.COORDINADOR,RolUsuario.INSPECTOR];

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-[1700px]">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.28em] text-amber-300">Administración de accesos</p><h1 className="mt-2 text-4xl font-black">Usuarios</h1><p className="mt-3 text-slate-400">{esDirector?"Dirección administra todas las zonas y puede filtrarlas de forma independiente.":`Solo usuarios de ${administrador.zona?.nombre ?? "tu zona"}.`}</p></div><form className="grid gap-2 sm:grid-cols-[1fr_180px_160px_210px_auto]"><input name="q" defaultValue={q} placeholder="Buscar usuario" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3"/><select name="rol" defaultValue={p.rol??""} className="rounded-full border border-white/10 bg-slate-900 px-4"><option value="">Todos los roles</option>{Object.values(RolUsuario).map(r=><option key={r} value={r}>{r}</option>)}</select><select name="estado" defaultValue={estadoFiltro} className="rounded-full border border-white/10 bg-slate-900 px-4"><option value="">Todos</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select>{esDirector?<select name="zonaId" defaultValue={p.zonaId??""} className="rounded-full border border-white/10 bg-slate-900 px-4"><option value="">Todas las zonas</option>{zonasTodas.map(z=><option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select>:<div className="rounded-full border border-cyan-300/20 px-4 py-3 text-cyan-200">{administrador.zona?.nombre}</div>}<button className="rounded-full border border-white/15 px-5 font-black">Filtrar</button></form></div>
    {(p.ok||p.error)&&<p className={`mt-6 rounded-2xl border p-4 font-bold ${p.error?"border-rose-400/20 text-rose-300":"border-emerald-400/20 text-emerald-300"}`}>{p.error??p.ok}</p>}
    <section className="mt-8 grid gap-8 xl:grid-cols-[420px_1fr]"><aside className="h-fit rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-2xl font-black">Crear usuario</h2><p className="mt-2 text-sm text-slate-400">Todos salvo Director requieren zona.</p><FormularioCrearUsuario rolesCreables={rolesCreables} zonas={zonas} gerentes={gerentes} coordinadores={coordinadores}/></aside>
    <div className="max-h-[78vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900/70"><table className="min-w-[1400px] w-full text-left"><thead className="sticky top-0 bg-slate-900"><tr className="text-xs uppercase text-slate-400"><th className="p-4">Nombre</th><th className="p-4">Correo</th><th className="p-4">Rol</th><th className="p-4">Zona</th><th className="p-4">Estatus</th><th className="p-4">Gestión</th></tr></thead><tbody>{usuarios.map(u=>{const modificable=u.id!==administrador.id&&u.rol!==RolUsuario.CLIENTE&&(esDirector||(u.zonaId===administrador.zonaId&&u.rol!==RolUsuario.DIRECTOR&&u.rol!==RolUsuario.ADMINISTRADOR));return <tr key={u.id} className="border-t border-white/5 align-top"><td className="p-4 font-bold">{u.nombre}</td><td className="p-4">{u.email}</td><td className="p-4">{u.rol}</td><td className="p-4">{u.zona?`${u.zona.nombre} · ${u.zona.codigo}`:u.rol===RolUsuario.DIRECTOR?"Todas las zonas":"SIN ZONA"}</td><td className="p-4">{u.activo?"ACTIVO":"INACTIVO"}</td><td className="p-4">{modificable?<details><summary className="cursor-pointer font-black text-amber-300">Administrar</summary><div className="mt-4 w-[520px] max-w-[75vw] space-y-5 rounded-2xl bg-slate-950 p-5"><FormularioEditarUsuario usuario={u} rolesEditables={rolesEditables} zonas={zonas} gerentes={gerentes} coordinadores={coordinadores} action={actualizarUsuarioFase2}/><form action={cambiarPasswordUsuarioZona} className="space-y-3"><input type="hidden" name="usuarioId" value={u.id}/><PasswordField name="password" label="Nueva contraseña" autoComplete="new-password" minLength={8} inputClassName="w-full rounded-2xl bg-slate-900 px-4 py-3 pr-24"/><button className="w-full rounded-full border border-cyan-300/30 py-2 font-black text-cyan-300">Restablecer contraseña</button></form><form action={cambiarEstadoUsuarioZona}><input type="hidden" name="usuarioId" value={u.id}/><input type="hidden" name="activo" value={u.activo?"false":"true"}/><button className="w-full rounded-full border border-white/15 py-2 font-black">{u.activo?"Desactivar":"Activar"}</button></form></div></details>:<span className="text-xs text-slate-500">Protegido</span>}</td></tr>})}</tbody></table>{usuarios.length===0&&<div className="p-10 text-center text-slate-400">Sin usuarios en esta zona.</div>}</div></section>
  </div></main>;
}
