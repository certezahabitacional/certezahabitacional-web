import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { cambiarPasswordTemporal } from "./actions";

export default async function CambiarPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const params = await searchParams;
  const usuario = await obtenerUsuarioConAlcanceZona("/cambiar-password");
  const callbackUrl = params.callbackUrl?.startsWith("/") ? params.callbackUrl : "/panel";

  if (!usuario.requiereCambioPassword) redirect(callbackUrl);

  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-lg">
    <p className="text-xs font-black uppercase tracking-[.24em] text-amber-300">Seguridad de cuenta</p>
    <h1 className="mt-3 text-3xl font-black">Crea tu contraseña personal</h1>
    <p className="mt-3 text-sm leading-6 text-slate-400">La contraseña entregada por Administración o Dirección es temporal. Para proteger tu cuenta debes reemplazarla antes de continuar.</p>
    {params.error&&<p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm font-bold text-rose-200">{params.error}</p>}
    <form action={cambiarPasswordTemporal} className="mt-7 space-y-4 rounded-3xl border border-white/10 bg-slate-900 p-6">
      <input type="hidden" name="callbackUrl" value={callbackUrl}/>
      <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Contraseña temporal actual</span><input name="passwordActual" type="password" autoComplete="current-password" required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"/></label>
      <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Nueva contraseña</span><input name="passwordNueva" type="password" autoComplete="new-password" minLength={8} required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"/></label>
      <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Confirmar nueva contraseña</span><input name="passwordConfirmar" type="password" autoComplete="new-password" minLength={8} required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"/></label>
      <button className="w-full rounded-full bg-cyan-300 px-5 py-3 font-black text-slate-950">Guardar contraseña y continuar</button>
    </form>
  </div></main>;
}
