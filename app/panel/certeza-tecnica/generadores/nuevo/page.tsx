import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { crearProyectoGeneradores } from "./actions";

export default async function NuevoProyectoGeneradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const usuarioActual = await obtenerUsuarioConAlcanceZona("/panel/certeza-tecnica/generadores/nuevo");
  const puedeEntrar =
    usuarioActual.rol === RolUsuario.DIRECTOR ||
    usuarioActual.rol === RolUsuario.ADMINISTRADOR;

  if (!puedeEntrar) redirect("/acceso");
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
              Certeza Técnica · Generadores y Cuantificación
            </p>
            <h1 className="mt-2 text-4xl font-black">Nuevo proyecto</h1>
            <p className="mt-3 text-sm text-slate-400">
              Registra los datos base del expediente. Después incorporaremos documentos, catálogo y cuantificación.
            </p>
          </div>
          <Link href="/panel/certeza-tecnica/generadores" className="text-sm font-black text-cyan-200 hover:text-cyan-100">
            Volver al módulo
          </Link>
        </div>

        {params.error ? (
          <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-bold text-rose-200">
            {params.error}
          </div>
        ) : null}

        <form action={crearProyectoGeneradores} className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-8">
          <section>
            <h2 className="text-lg font-black">Identificación del proyecto</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Nombre del proyecto *</span>
                <input name="nombre" required className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" placeholder="Ej. Edificio habitacional 4 niveles" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Cliente *</span>
                <input name="clienteNombre" required className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" placeholder="Nombre o razón social" />
              </label>
              <label className="grid gap-2 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Ubicación</span>
                <input name="ubicacion" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" placeholder="Ciudad, estado y referencia del proyecto" />
              </label>
            </div>
          </section>

          <section className="border-t border-white/10 pt-6">
            <h2 className="text-lg font-black">Datos técnicos iniciales</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Tipo de edificación</span>
                <input name="tipoEdificacion" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" placeholder="Vivienda, edificio, nave..." />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Superficie aproximada (m²)</span>
                <input name="superficieM2" inputMode="decimal" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" placeholder="0.00" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Niveles</span>
                <input name="niveles" inputMode="numeric" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" placeholder="1" />
              </label>
            </div>
          </section>

          <section className="border-t border-white/10 pt-6">
            <h2 className="text-lg font-black">Alcance inicial</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Alcance contratado</span>
                <select name="alcance" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                  <option value="CUANTIFICACION">Cuantificación</option>
                  <option value="CUANTIFICACION_GENERADORES">Cuantificación y generadores</option>
                  <option value="REVISION_GENERADORES">Revisión de generadores existentes</option>
                  <option value="CATALOGO_CUANTIFICACION_GENERADORES">Catálogo, cuantificación y generadores</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Observaciones iniciales</span>
                <textarea name="observaciones" rows={5} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" placeholder="Información disponible, condiciones del servicio, prioridades o restricciones." />
              </label>
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
            <Link href="/panel/certeza-tecnica/generadores" className="rounded-2xl border border-white/10 px-6 py-3 text-center text-sm font-black">
              Cancelar
            </Link>
            <button type="submit" className="rounded-2xl bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 hover:bg-amber-200">
              Crear proyecto
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
