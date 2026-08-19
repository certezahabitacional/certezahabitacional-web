import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { actualizarInspeccion } from "./actions";

type SearchParams = Promise<{ error?: string }>;

const ZONAS_HORARIAS = [
  {
    value: "America/Ciudad_Juarez",
    label: "Ciudad Juárez",
  },
  {
    value: "America/Tijuana",
    label: "Tijuana",
  },
  {
    value: "America/Hermosillo",
    label: "Hermosillo",
  },
  {
    value: "America/Chihuahua",
    label: "Chihuahua",
  },
  {
    value: "America/Mazatlan",
    label: "Mazatlán",
  },
  {
    value: "America/Monterrey",
    label: "Monterrey",
  },
  {
    value: "America/Mexico_City",
    label: "Ciudad de México",
  },
  {
    value: "America/Cancun",
    label: "Cancún",
  },
];

function fechaLocal(
  fecha: Date,
  zonaHoraria: string,
) {
  return formatInTimeZone(
    fecha,
    zonaHoraria,
    "yyyy-MM-dd'T'HH:mm",
  );
}

export default async function EditarInspeccionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;

  const [inspeccion, inspectores] = await Promise.all([
    prisma.inspeccion.findUnique({
      where: { id },
      include: {
        cliente: true,
        inmueble: true,
      },
    }),

    prisma.inspector.findMany({
      where: {
        activo: true,
        usuario: {
          activo: true,
        },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        creadoEn: "asc",
      },
    }),
  ]);

  if (!inspeccion) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/panel/inspecciones/${inspeccion.id}`}
          className="text-sm font-bold text-cyan-300"
        >
          ← Regresar al expediente
        </Link>

        <p className="mt-5 font-black text-cyan-300">
          {inspeccion.folio}
        </p>

        <h1 className="text-3xl font-black">
          Editar inspección
        </h1>

        <p className="mt-2 text-slate-400">
          {inspeccion.cliente.nombre} ·{" "}
          {inspeccion.inmueble?.alias ??
            inspeccion.tipoInmueble}
        </p>

        {query.error && (
          <p className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 font-bold text-rose-300">
            {query.error}
          </p>
        )}

        <form
          action={actualizarInspeccion}
          className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-slate-900 p-7"
        >
          <input
            type="hidden"
            name="id"
            value={inspeccion.id}
          />

          <CampoSoloLectura
            label="Cliente"
            value={inspeccion.cliente.nombre}
          />

          <CampoSoloLectura
            label="Inmueble"
            value={
              inspeccion.inmueble?.alias ??
              inspeccion.tipoInmueble
            }
          />

          <CampoSoloLectura
            label="Dirección"
            value={`${inspeccion.direccion}, ${inspeccion.ciudad}`}
          />

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Inspector
            </span>

            <select
              name="inspectorId"
              defaultValue={
                inspeccion.inspectorId ?? ""
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            >
              <option value="">
                Sin asignar
              </option>

              {inspectores.map(
                (inspector) => (
                  <option
                    key={inspector.id}
                    value={inspector.id}
                  >
                    {
                      inspector.usuario
                        .nombre
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Tipo de inspección *
            </span>

            <select
              name="tipoServicio"
              defaultValue={
                inspeccion.tipoServicio
              }
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            >
              <option value="ENTREGA">
                Entrega de vivienda
              </option>

              <option value="GARANTIA">
                Garantía
              </option>

              <option value="USADA">
                Vivienda usada
              </option>

              <option value="PREVENTIVA">
                Preventiva
              </option>

              <option value="DICTAMEN">
                Dictamen técnico
              </option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Fecha y hora *
            </span>

            <input
              type="datetime-local"
              name="fechaProgramada"
              required
              defaultValue={fechaLocal(
                inspeccion.fechaProgramada,
                inspeccion.zonaHoraria,
              )}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            />

            <p className="mt-2 text-xs text-slate-500">
              La hora se interpreta según la zona
              horaria seleccionada.
            </p>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Zona horaria *
            </span>

            <select
              name="zonaHoraria"
              defaultValue={
                inspeccion.zonaHoraria
              }
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            >
              {ZONAS_HORARIAS.map(
                (zona) => (
                  <option
                    key={zona.value}
                    value={zona.value}
                  >
                    {zona.label}
                  </option>
                ),
              )}
            </select>

            <p className="mt-2 text-xs text-slate-500">
              Debe corresponder a la ubicación donde
              se realizará la inspección.
            </p>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Observaciones
            </span>

            <textarea
              name="observaciones"
              rows={5}
              defaultValue={
                inspeccion.observaciones ??
                ""
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            />
          </label>

          <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300">
            Guardar cambios
          </button>
        </form>
      </div>
    </main>
  );
}

function CampoSoloLectura({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-slate-300">
        {label}
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-slate-300">
        {value}
      </div>
    </div>
  );
}