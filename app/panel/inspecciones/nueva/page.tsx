import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { crearInspeccion } from "./actions";
import ClienteInmuebleSelect from "./ClienteInmuebleSelect";
import ZonaInspectorSelect from "./ZonaInspectorSelect";

type SearchParams = Promise<{
  error?: string;
  antecedenteId?: string;
}>;

export default async function NuevaInspeccionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuarioActual = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      rol: true,
      activo: true,
      zonaId: true,
    },
  });

  if (!usuarioActual || !usuarioActual.activo) {
    redirect("/acceso");
  }

  if (
    usuarioActual.rol !== RolUsuario.DIRECTOR &&
    usuarioActual.rol !== RolUsuario.ADMINISTRADOR &&
    usuarioActual.rol !== RolUsuario.GERENTE
  ) {
    redirect("/acceso");
  }

  const params = await searchParams;
  const antecedenteId = params.antecedenteId?.trim() || "";

  const antecedente = antecedenteId
    ? await prisma.inspeccion.findUnique({
        where: {
          id: antecedenteId,
        },
        select: {
          id: true,
          folio: true,
          estado: true,
          clienteId: true,
          inmuebleId: true,
          inspectorId: true,
          plantillaId: true,
          zonaId: true,
          cliente: {
            select: {
              nombre: true,
            },
          },
          inmueble: {
            select: {
              alias: true,
              direccion: true,
            },
          },
        },
      })
    : null;

  if (antecedenteId && !antecedente) {
    redirect(
      `/panel/inspecciones/nueva?error=${encodeURIComponent(
        "La inspección antecedente no existe."
      )}`
    );
  }

  const [
    clientes,
    inmuebles,
    inspectores,
    zonas,
    plantillas,
  ] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: {
        nombre: "asc",
      },
      select: {
        id: true,
        nombre: true,
      },
    }),

    prisma.inmueble.findMany({
      select: {
        id: true,
        alias: true,
        ciudad: true,
        direccion: true,
        clienteId: true,
      },
      orderBy: [
        {
          ciudad: "asc",
        },
        {
          alias: "asc",
        },
      ],
    }),

    prisma.inspector.findMany({
      where: {
        activo: true,
        usuario: {
          activo: true,
          rol: RolUsuario.INSPECTOR,
        },
      },
      select: {
        id: true,
        usuario: {
          select: {
            nombre: true,
            zonaId: true,
            gerenteId: true,
            coordinadorId: true,
          },
        },
      },
      orderBy: {
        creadoEn: "asc",
      },
    }),

    prisma.zona.findMany({
      where: {
        activa: true,
      },
      select: {
        id: true,
        nombre: true,
        codigo: true,
      },
      orderBy: {
        nombre: "asc",
      },
    }),

    prisma.plantillaInspeccion.findMany({
      where: {
        activa: true,
      },
      orderBy: {
        nombre: "asc",
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/panel/inspecciones"
            className="text-sm font-black text-cyan-300"
          >
            ← Inspecciones
          </Link>

          {(usuarioActual.rol === RolUsuario.DIRECTOR ||
            usuarioActual.rol === RolUsuario.ADMINISTRADOR) && (
            <Link
              href="/panel/configuracion/plantillas"
              className="rounded-full border border-amber-300/30 px-4 py-2 text-sm font-black text-amber-300"
            >
              Configurar plantillas
            </Link>
          )}
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-amber-300">
          Operación V2
        </p>

        <h1 className="mt-3 text-4xl font-black">
          Nueva inspección
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Dirección y Administración pueden crear, programar y asignar inspecciones.
          Gerencia solo participa cuando la plantilla lo requiere.
        </p>

        {params.error && (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 font-bold text-rose-200">
            {params.error}
          </div>
        )}

        <form
          action={crearInspeccion}
          className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-slate-900 p-7"
        >
          {antecedente && (
            <input
              type="hidden"
              name="antecedenteId"
              value={antecedente.id}
            />
          )}

          {antecedente ? (
            <div className="grid gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5 md:grid-cols-2">
              <Dato
                label="Antecedente"
                value={antecedente.folio}
              />

              <Dato
                label="Cliente"
                value={antecedente.cliente.nombre}
              />

              <Dato
                label="Inmueble"
                value={antecedente.inmueble?.alias ?? "Inmueble"}
              />

              <Dato
                label="Dirección"
                value={antecedente.inmueble?.direccion ?? "—"}
              />

              <input
                type="hidden"
                name="clienteId"
                value={antecedente.clienteId}
              />

              <input
                type="hidden"
                name="inmuebleId"
                value={antecedente.inmuebleId ?? ""}
              />
            </div>
          ) : (
            <ClienteInmuebleSelect
              clientes={clientes}
              inmuebles={inmuebles}
            />
          )}

          <CampoSelect
            name="plantillaId"
            label="Plantilla de inspección *"
            required
            defaultValue={antecedente?.plantillaId ?? ""}
            options={plantillas.map((plantilla) => ({
              value: plantilla.id,
              label:
                `${plantilla.nombre} · ` +
                `Gerente: ${plantilla.requiereGerenteZona ? "Sí" : "No"} · ` +
                `Coordinador: ${plantilla.requiereCoordinador ? "Sí" : "No"}`,
            }))}
          />

          <ZonaInspectorSelect
            zonas={zonas}
            inspectores={inspectores}
            zonaInicial={
              antecedente?.zonaId ??
              usuarioActual.zonaId ??
              ""
            }
            inspectorInicial={
              antecedente?.inspectorId ??
              ""
            }
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

          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-6 text-slate-300">
            <p className="font-black text-amber-300">
              Regla de jerarquía
            </p>

            <p className="mt-2">
              Cuando la plantilla no requiera Gerente ni Coordinador,
              esos roles se ignoran. Si la plantilla los requiere,
              el Inspector seleccionado debe tener esas relaciones configuradas.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-cyan-400 px-6 py-3 font-black text-slate-950"
          >
            Crear y programar inspección
          </button>
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
  defaultValue = "",
}: {
  name: string;
  label: string;
  options: {
    value: string;
    label: string;
  }[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">
        {label}
      </span>

      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
      >
        {!defaultValue && (
          <option value="">
            Selecciona una opción
          </option>
        )}

        {options.map((opcion) => (
          <option
            key={`${name}-${opcion.value}-${opcion.label}`}
            value={opcion.value}
          >
            {opcion.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Dato({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold">
        {value}
      </p>
    </div>
  );
}
