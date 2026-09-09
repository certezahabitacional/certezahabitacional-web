import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { actualizarPlantilla, crearPlantilla } from "./actions";

type SearchParams = Promise<{
  ok?: string;
  error?: string;
}>;

export default async function PlantillasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });

  if (!usuario || !usuario.activo) redirect("/acceso");

  if (
    usuario.rol !== RolUsuario.DIRECTOR &&
    usuario.rol !== RolUsuario.ADMINISTRADOR
  ) {
    redirect("/acceso");
  }

  const [plantillas, params] = await Promise.all([
    prisma.plantillaInspeccion.findMany({
      orderBy: [{ activa: "desc" }, { nombre: "asc" }],
    }),
    searchParams,
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/panel/inspecciones/nueva"
            className="text-sm font-black text-cyan-300"
          >
            ← Nueva inspección
          </Link>

          <Link
            href="/panel"
            className="text-sm font-black text-slate-400"
          >
            Panel
          </Link>
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-amber-300">
          Operación V2
        </p>

        <h1 className="mt-3 text-4xl font-black">
          Plantillas de inspección
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Define si cada tipo de inspección requiere Gerente de Zona y/o
          Coordinador. La configuración se copia a cada inspección al crearla
          para conservar su historial.
        </p>

        {(params.ok || params.error) && (
          <div
            className={`mt-6 rounded-2xl border px-5 py-4 font-bold ${
              params.error
                ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
            }`}
          >
            {params.error ?? params.ok}
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <h2 className="text-xl font-black">Nueva plantilla</h2>

          <form
            action={crearPlantilla}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <Campo name="nombre" label="Nombre *" required />
            <Campo name="codigo" label="Código *" required />

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-300">
                Tipo de servicio *
              </span>

              <select
                name="tipoServicio"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
              >
                <option value="">Selecciona</option>
                <option value="ENTREGA">Entrega</option>
                <option value="GARANTIA">Garantía</option>
                <option value="USADA">Usada</option>
                <option value="PREVENTIVA">Preventiva</option>
                <option value="DICTAMEN">Dictamen</option>
              </select>
            </label>

            <Campo name="descripcion" label="Descripción" />

            <Check
              name="requiereGerenteZona"
              label="¿Requiere Gerente de Zona?"
            />

            <Check
              name="requiereCoordinador"
              label="¿Requiere Coordinador?"
            />

            <button
              type="submit"
              className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 md:col-span-2"
            >
              Crear plantilla
            </button>
          </form>
        </section>

        <section className="mt-8 space-y-5">
          {plantillas.map((p) => (
            <form
              key={p.id}
              action={actualizarPlantilla}
              className="rounded-3xl border border-white/10 bg-slate-900 p-6"
            >
              <input type="hidden" name="id" value={p.id} />

              <div className="grid gap-4 md:grid-cols-2">
                <Campo
                  name="nombre"
                  label={`${p.codigo} · Nombre`}
                  required
                  defaultValue={p.nombre}
                />

                <div className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                  <p>
                    <b>Tipo:</b> {p.tipoServicio}
                  </p>

                  <p className="mt-1">
                    <b>Creada:</b>{" "}
                    {p.creadoEn.toLocaleDateString("es-MX")}
                  </p>
                </div>

                <Campo
                  name="descripcion"
                  label="Descripción"
                  defaultValue={p.descripcion ?? ""}
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <Check
                    name="activa"
                    label="Activa"
                    defaultChecked={p.activa}
                  />

                  <Check
                    name="requiereGerenteZona"
                    label="Gerente"
                    defaultChecked={p.requiereGerenteZona}
                  />

                  <Check
                    name="requiereCoordinador"
                    label="Coordinador"
                    defaultChecked={p.requiereCoordinador}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-5 rounded-full border border-cyan-300/30 px-5 py-3 text-sm font-black text-cyan-300"
              >
                Guardar cambios
              </button>
            </form>
          ))}
        </section>
      </div>
    </main>
  );
}

function Campo({
  name,
  label,
  required = false,
  defaultValue = "",
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">
        {label}
      </span>

      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
      />
    </label>
  );
}

function Check({
  name,
  label,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        className="h-5 w-5"
      />
      {label}
    </label>
  );
}
