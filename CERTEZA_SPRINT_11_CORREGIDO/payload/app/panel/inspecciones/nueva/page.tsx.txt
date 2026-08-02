import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { crearInspeccion } from "./actions";

type SearchParams = Promise<{ error?: string }>;

type Opcion = {
  value: string;
  label: string;
};

export default async function NuevaInspeccionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const [clientes, inmuebles, inspectores] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    prisma.inmueble.findMany({
      include: {
        cliente: {
          select: { nombre: true },
        },
      },
      orderBy: { alias: "asc" },
    }),
    prisma.inspector.findMany({
      where: { activo: true },
      include: {
        usuario: {
          select: { nombre: true },
        },
      },
      orderBy: { creadoEn: "asc" },
    }),
  ]);

  const hayDatosBasicos = clientes.length > 0 && inmuebles.length > 0;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/panel" className="text-sm font-bold text-cyan-300">
          ← Panel
        </Link>

        <h1 className="mt-2 text-3xl font-black">Nueva inspección</h1>
        <p className="mt-1 text-slate-400">
          Programa la visita y abre el expediente técnico.
        </p>

        {params.error && (
          <p className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 font-bold text-rose-300">
            {params.error}
          </p>
        )}

        <form
          action={crearInspeccion}
          className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-slate-900 p-7"
        >
          <CampoSelect
            name="clienteId"
            label="Cliente *"
            required
            options={clientes.map((cliente) => ({
              value: cliente.id,
              label: cliente.nombre,
            }))}
          />

          <CampoSelect
            name="inmuebleId"
            label="Inmueble *"
            required
            options={inmuebles.map((inmueble) => ({
              value: inmueble.id,
              label: `${inmueble.alias} — ${inmueble.cliente.nombre}`,
            }))}
          />

          <CampoSelect
            name="inspectorId"
            label="Inspector"
            options={[
              { value: "", label: "Sin asignar" },
              ...inspectores.map((inspector) => ({
                value: inspector.id,
                label: inspector.usuario.nombre,
              })),
            ]}
          />

          <CampoSelect
            name="tipoServicio"
            label="Tipo de inspección *"
            required
            options={[
              { value: "ENTREGA", label: "Entrega de vivienda" },
              { value: "GARANTIA", label: "Garantía" },
              { value: "USADA", label: "Vivienda usada" },
              { value: "PREVENTIVA", label: "Preventiva" },
              { value: "DICTAMEN", label: "Dictamen técnico" },
            ]}
          />

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Fecha y hora *
            </span>
            <input
              name="fechaProgramada"
              type="datetime-local"
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Observaciones
            </span>
            <textarea
              name="observaciones"
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
            />
          </label>

          <button
            type="submit"
            disabled={!hayDatosBasicos}
            className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Crear inspección
          </button>

          {!hayDatosBasicos && (
            <p className="text-center text-sm text-amber-300">
              Registra al menos un cliente y un inmueble antes de continuar.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

function CampoSelect({
  name,
  label,
  options,
  required = false,
}: {
  name: string;
  label: string;
  options: Opcion[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">
        {label}
      </span>
      <select
        name={name}
        required={required}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value || "vacio"}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
