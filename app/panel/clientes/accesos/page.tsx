import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, zonaEfectivaId } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";
import { asignarAccesoCliente } from "./actions";

export default async function AccesosClientesPage({ searchParams }: { searchParams: Promise<{ ok?:string; error?:string; zonaId?:string }> }) {
  const usuario=await obtenerUsuarioConAlcanceZona("/panel/clientes/accesos");
  if(usuario.rol!==RolUsuario.DIRECTOR&&usuario.rol!==RolUsuario.ADMINISTRADOR) redirect("/acceso");
  const params=await searchParams;
  const zonaId=zonaEfectivaId(usuario,params.zonaId);
  const zonas=usuario.rol===RolUsuario.DIRECTOR?await prisma.zona.findMany({where:{activa:true},select:{id:true,nombre:true,codigo:true},orderBy:{nombre:"asc"}}):[];
  const clientes=await prisma.cliente.findMany({where:zonaId?{OR:[{cotizaciones:{some:{zonaId}}},{inspecciones:{some:{zonaId}}}]}:{},select:{id:true,nombre:true,correo:true,telefono:true,usuario:{select:{email:true,activo:true,zonaId:true}}},orderBy:{nombre:"asc"}});
  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white"><div className="mx-auto max-w-5xl"><Link href="/panel/clientes" className="text-sm font-bold text-cyan-300">← Clientes</Link><div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="text-3xl font-black">Acceso de clientes</h1><p className="mt-2 max-w-3xl text-slate-400">Cada cuenta Cliente hereda obligatoriamente la zona de su operación.</p></div>{usuario.rol===RolUsuario.DIRECTOR?<form className="flex gap-2"><select name="zonaId" defaultValue={params.zonaId??""} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3"><option value="">Todas las zonas</option>{zonas.map(z=><option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select><button className="rounded-full border border-white/15 px-5 font-black">Aplicar</button></form>:<div className="rounded-full border border-cyan-300/20 px-5 py-3 text-cyan-200">{usuario.zona?.nombre}</div>}</div>
  {(params.ok||params.error)&&<p className={`mt-6 rounded-2xl p-4 font-bold ${params.error?"bg-rose-400/10 text-rose-300":"bg-emerald-400/10 text-emerald-300"}`}>{params.error??params.ok}</p>}
  <div className="mt-8 space-y-4">{clientes.map(cliente=><details key={cliente.id} className="rounded-3xl border border-white/10 bg-slate-900 p-5"><summary className="cursor-pointer font-black text-cyan-300">{cliente.nombre} · {cliente.usuario?`Acceso: ${cliente.usuario.email}`:"Sin acceso"}</summary><p className="mt-3 text-sm text-slate-400">{cliente.correo??"Sin correo"} · {cliente.telefono??"Sin teléfono"}</p><form action={asignarAccesoCliente} className="mt-5 grid gap-4 md:grid-cols-3"><input type="hidden" name="clienteId" value={cliente.id}/><label><span className="mb-2 block text-sm font-bold text-slate-300">Usuario / correo</span><input name="email" type="email" required defaultValue={cliente.usuario?.email??cliente.correo??""} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"/></label><label><span className="mb-2 block text-sm font-bold text-slate-300">Contraseña temporal</span><input name="password" type="password" minLength={8} required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"/></label><div className="flex items-end"><button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">{cliente.usuario?"Restablecer acceso":"Asignar acceso"}</button></div></form></details>)}{clientes.length===0&&<p className="rounded-3xl border border-white/10 p-8 text-center text-slate-400">No hay clientes dentro de la zona seleccionada.</p>}</div></div></main>;
}
