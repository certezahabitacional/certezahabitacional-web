import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  extraerConfiguracionHerramientas,
  HERRAMIENTAS_INSPECCION,
} from "@/lib/herramientas-inspeccion";
import { prisma } from "@/lib/prisma";
import { guardarHerramientasCotizacion } from "../../actions-herramientas";

export default async function HerramientasCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });

  if (!usuario?.activo) {
    redirect("/acceso");
  }

  const puedeEditar =
    usuario.rol === "DIRECTOR" || usuario.rol === "ADMINISTRADOR";

  if (!puedeEditar && usuario.rol !== "GERENTE") {
    redirect("/acceso");
  }

  const { id } = await params;

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true } },
      inmueble: {
        select: { alias: true, direccion: true },
      },
    },
  });

  if (!cotizacion) notFound();

  const configuracion = extraerConfiguracionHerramientas(
    cotizacion.observacionesInternas,
  );
  const seleccionadas = new Set(configuracion.herramientas);
  const editable = puedeEditar && cotizacion.estado === "BORRADOR";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/panel/cotizaciones"
          className="text-sm font-black text-cyan-300"
        >
          ← Volver a cotizaciones
        </Link>

        <header className="mt-7 rounded-3xl border border-white/10 bg-slate-900 p-7">
          <p className="font-mono text-xs font-bold text-cyan-300">
            {cotizacion.folio}
          </p>
          <h1 className="mt-3 text-3xl font-black">
            Herramientas y pruebas incluidas
          </h1>
          <p className="mt-3 text-slate-400">
            {cotizacion.cliente.nombre}
            {cotizacion.inmueble
              ? ` · ${cotizacion.inmueble.alias} — ${cotizacion.inmueble.direccion}`
              : ""}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
            Esta selección define el alcance instrumental de la cotización. Solo las herramientas marcadas deberán trasladarse a la inspección y al reporte técnico. Las herramientas no seleccionadas no deberán mencionarse como parte del alcance contratado.
          </p>
        </header>

        <form
          action={guardarHerramientasCotizacion}
          className="mt-7 rounded-3xl border border-cyan-400/20 bg-slate-900 p-7"
        >
          <input type="hidden" name="id" value={cotizacion.id} />

          <div className="grid gap-4 md:grid-cols-2">
            {HERRAMIENTAS_INSPECCION.map((herramienta) => (
              <label
                key={herramienta.codigo}
                className={`rounded-2xl border p-5 ${
                  seleccionadas.has(herramienta.codigo)
                    ? "border-cyan-300/40 bg-cyan-400/10"
                    : "border-white/10 bg-slate-950"
                } ${editable ? "cursor-pointer" : "opacity-80"}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="herramientas"
                    value={herramienta.codigo}
                    defaultChecked={seleccionadas.has(herramienta.codigo)}
                    disabled={!editable}
                    className="mt-1 h-4 w-4"
                  />

                  <div>
                    <p className="font-black text-white">
                      {herramienta.nombre}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {herramienta.aplicacionCotizacion}
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {editable ? (
            <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
              <button
                type="submit"
                className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950"
              >
                Guardar selección
              </button>
              <p className="text-xs text-slate-500">
                La selección puede modificarse mientras la cotización permanezca en borrador.
              </p>
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm text-amber-200">
              La selección quedó bloqueada porque la cotización ya salió de borrador. Gerencia puede consultarla en modo solo lectura.
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
