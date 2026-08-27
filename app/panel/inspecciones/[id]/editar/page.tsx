import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { actualizarInspeccion } from "./actions";

type SearchParams = Promise<{
  error?: string;
}>;

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
  params: Promise<{
    id: string;
  }>;
  searchParams: SearchParams;
}) {
  const {
    id,
  } = await params;

  const query =
    await searchParams;

  const session =
    await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuarioActual =
    await prisma.usuario.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        rol: true,
        activo: true,
      },
    });

  if (
    !usuarioActual ||
    !usuarioActual.activo
  ) {
    redirect("/acceso");
  }

  if (
    usuarioActual.rol !==
      RolUsuario.GERENTE &&
    usuarioActual.rol !==
      RolUsuario.DIRECTOR
  ) {
    redirect("/acceso");
  }

  const inspeccion =
    await prisma.inspeccion.findUnique({
      where: {
        id,
      },
      include: {
        cliente: true,
        inmueble: true,
        certificado: {
          select: {
            vigente: true,
          },
        },
        inspector: {
          select: {
            usuario: {
              select: {
                nombre: true,
                gerenteId: true,
              },
            },
          },
        },
      },
    });

  if (!inspeccion) {
    notFound();
  }

  if (
    usuarioActual.rol ===
    RolUsuario.GERENTE
  ) {
    if (
      !inspeccion.inspectorId ||
      inspeccion.inspector?.usuario
        .gerenteId !==
        usuarioActual.id
    ) {
      redirect("/acceso");
    }

    if (
      inspeccion.estado !==
      EstadoInspeccion.PROGRAMADA
    ) {
      redirect(
        `/panel/inspecciones/${inspeccion.id}?error=${encodeURIComponent(
          "Gerencia solo puede editar los datos operativos mientras la inspección está PROGRAMADA.",
        )}`,
      );
    }
  }

  if (
    usuarioActual.rol ===
      RolUsuario.DIRECTOR &&
    inspeccion.estado ===
      EstadoInspeccion.CANCELADA
  ) {
    redirect(
      `/panel/inspecciones/${inspeccion.id}?error=${encodeURIComponent(
        "Una inspección CANCELADA no puede editarse desde el flujo ordinario.",
      )}`,
    );
  }

  if (
    usuarioActual.rol ===
      RolUsuario.DIRECTOR &&
    inspeccion.certificado?.vigente
  ) {
    redirect(
      `/panel/inspecciones/${inspeccion.id}?error=${encodeURIComponent(
        "El expediente tiene un certificado vigente. Revoca el certificado antes de modificar datos estructurales.",
      )}`,
    );
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

        <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-sm leading-6 text-slate-300">
          <p className="font-black text-cyan-300">
            Inspector asignado
          </p>

          <p className="mt-1">
            {inspeccion.inspector?.usuario
              .nombre ??
              "Sin asignar"}
          </p>

          <p className="mt-2 text-slate-500">
            La asignación o reasignación del Inspector se administra exclusivamente
            desde el expediente principal y no puede modificarse desde esta pantalla.
          </p>
        </div>

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
            value={
              inspeccion.cliente.nombre
            }
          />

          <CampoSoloLectura
            label="Inmueble"
            value={
              inspeccion.inmueble
                ?.alias ??
              inspeccion.tipoInmueble
            }
          />

          <CampoSoloLectura
            label="Dirección"
            value={`${inspeccion.direccion}, ${inspeccion.ciudad}`}
          />

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
              Zona horaria:{" "}
              {inspeccion.zonaHoraria}
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
