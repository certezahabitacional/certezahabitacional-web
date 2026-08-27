import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { crearInspeccion } from "./actions";

type SearchParams = Promise<{
  error?: string;
  antecedenteId?: string;
}>;

type Opcion = {
  value: string;
  label: string;
};

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
    where: { id: session.user.id },
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
    usuarioActual.rol !== RolUsuario.GERENTE &&
    usuarioActual.rol !== RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  const esDirector = usuarioActual.rol === RolUsuario.DIRECTOR;
  const esGerente = usuarioActual.rol === RolUsuario.GERENTE;

  const params = await searchParams;
  const antecedenteId = params.antecedenteId?.trim() || "";

  const antecedente = antecedenteId
    ? await prisma.inspeccion.findUnique({
        where: { id: antecedenteId },
        select: {
          id: true,
          folio: true,
          numeroInspeccion: true,
          estado: true,
          clienteId: true,
          inmuebleId: true,
          inspectorId: true,
          tipoServicio: true,
          zonaId: true,
          inspector: {
            select: {
              usuario: {
                select: {
                  zonaId: true,
                  gerenteId: true,
                },
              },
            },
          },
          cliente: {
            select: {
              nombre: true,
            },
          },
          inmueble: {
            select: {
              id: true,
              alias: true,
              direccion: true,
              ciudad: true,
            },
          },
        },
      })
    : null;

  if (antecedenteId && !antecedente) {
    redirect(
      `/panel/inspecciones/nueva?error=${encodeURIComponent(
        "La inspección antecedente no existe.",
      )}`,
    );
  }

  if (
    antecedente &&
    esGerente &&
    antecedente.inspector?.usuario.gerenteId !== usuarioActual.id
  ) {
    redirect(
      `/panel/inspecciones?error=${encodeURIComponent(
        "La inspección antecedente no pertenece a tu Gerencia.",
      )}`,
    );
  }

  if (antecedente && antecedente.estado !== "FINALIZADA") {
    redirect(
      `/panel/inspecciones/${antecedente.id}?error=${encodeURIComponent(
        "Solo una inspección FINALIZADA puede generar una nueva inspección de seguimiento.",
      )}`,
    );
  }

  if (antecedente && !antecedente.inmuebleId) {
    redirect(
      `/panel/inspecciones/${antecedente.id}?error=${encodeURIComponent(
        "La inspección antecedente no tiene un inmueble relacionado.",
      )}`,
    );
  }

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
      where: {
        activo: true,
        usuario: {
          activo: true,
          ...(esGerente
            ? { gerenteId: usuarioActual.id }
            : {}),
        },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            zona: {
              select: {
                nombre: true,
                codigo: true,
              },
            },
          },
        },
      },
      orderBy: { creadoEn: "asc" },
    }),
  ]);

  const hayDatosBasicos =
    clientes.length > 0 && inmuebles.length > 0;

  const esSeguimiento = Boolean(antecedente);
  const siguienteVersion = antecedente
    ? antecedente.numeroInspeccion + 1
    : null;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href={
            antecedente
              ? `/panel/inspecciones/${antecedente.id}`
              : "/panel/inspecciones"
          }
          className="text-sm font-bold text-cyan-300"
        >
          ← {antecedente ? "Volver al antecedente" : "Inspecciones"}
        </Link>

        <h1 className="mt-2 text-3xl font-black">
          {esSeguimiento
            ? `Nueva inspección de seguimiento · V${siguienteVersion}`
            : "Nueva inspección"}
        </h1>

        <p className="mt-1 text-slate-400">
          {esSeguimiento
            ? "Programa la siguiente visita del mismo inmueble y conserva la cadena histórica V1 → V2 → V3."
            : "Programa la visita y abre el expediente técnico."}
        </p>

        {antecedente ? (
          <div className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-400/5 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              Inspección antecedente
            </p>
            <p className="mt-2 text-lg font-black text-white">
              V{antecedente.numeroInspeccion} · {antecedente.folio}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {antecedente.cliente.nombre} · {antecedente.inmueble?.alias ?? "Inmueble"}
            </p>
            {antecedente.inmueble && (
              <p className="mt-1 text-sm text-slate-500">
                {antecedente.inmueble.direccion}, {antecedente.inmueble.ciudad}
              </p>
            )}
            <p className="mt-3 text-sm text-violet-200">
              La nueva inspección se guardará como V{siguienteVersion} y tendrá a V{antecedente.numeroInspeccion} como antecedente directo.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-5 py-4 text-sm leading-6 text-cyan-100">
            La creación y programación de nuevas inspecciones estÃ¡ reservada a Gerencia y DirecciÃ³n. La ejecución en campo corresponde exclusivamente al Inspector asignado.
          </div>
        )}

        {esGerente && (
          <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-4 text-sm leading-6 text-emerald-100">
            Estás operando como Gerencia. Solo puedes programar inspecciones
            con Inspectores adscritos a tu Gerencia.
          </div>
        )}

        {params.error && (
          <p className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 font-bold text-rose-300">
            {params.error}
          </p>
        )}

        <form
          action={crearInspeccion}
          className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-slate-900 p-7"
        >
          {antecedente ? (
            <>
              <input type="hidden" name="antecedenteId" value={antecedente.id} />
              <input type="hidden" name="clienteId" value={antecedente.clienteId} />
              <input type="hidden" name="inmuebleId" value={antecedente.inmuebleId ?? ""} />

              <DatoBloqueado
                etiqueta="Cliente"
                valor={antecedente.cliente.nombre}
              />

              <DatoBloqueado
                etiqueta="Inmueble"
                valor={antecedente.inmueble?.alias ?? "Inmueble"}
              />
            </>
          ) : (
            <>
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
            </>
          )}

          <CampoSelect
            name="inspectorId"
            label={esGerente ? "Inspector *" : "Inspector"}
            required={esGerente}
            defaultValue={antecedente?.inspectorId ?? ""}
            options={[
              ...(esDirector
                ? [{ value: "", label: "Sin asignar" }]
                : []),
              ...inspectores.map((inspector) => ({
                value: inspector.id,
                label: inspector.usuario.zona
                  ? `${inspector.usuario.nombre} · ${inspector.usuario.zona.nombre}`
                  : inspector.usuario.nombre,
              })),
            ]}
          />

          <CampoSelect
            name="tipoServicio"
            label="Tipo de inspección *"
            required
            defaultValue={antecedente?.tipoServicio ?? "ENTREGA"}
            options={[
              {
                value: "ENTREGA",
                label: "Entrega de vivienda",
              },
              {
                value: "GARANTIA",
                label: "Garantía",
              },
              {
                value: "USADA",
                label: "Vivienda usada",
              },
              {
                value: "PREVENTIVA",
                label: "Preventiva",
              },
              {
                value: "DICTAMEN",
                label: "Dictamen técnico",
              },
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
              defaultValue={
                antecedente
                  ? `Inspección de seguimiento V${siguienteVersion} de ${antecedente.folio}.`
                  : ""
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
            />
          </label>

          <button
            type="submit"
            disabled={!hayDatosBasicos}
            className={`w-full rounded-full px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 ${
              esSeguimiento
                ? "bg-violet-300 hover:bg-violet-200"
                : "bg-cyan-400 hover:bg-cyan-300"
            }`}
          >
            {esSeguimiento
              ? `Crear inspección de seguimiento · V${siguienteVersion}`
              : "Crear inspección"}
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

function DatoBloqueado({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        {etiqueta}
      </p>
      <p className="mt-1 font-bold text-slate-200">{valor}</p>
    </div>
  );
}

function CampoSelect({
  name,
  label,
  options,
  required = false,
  defaultValue,
}: {
  name: string;
  label: string;
  options: Opcion[];
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
        defaultValue={defaultValue ?? options[0]?.value ?? ""}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
      >
        {options.map((option) => (
          <option
            key={`${name}-${option.value || "vacio"}`}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
