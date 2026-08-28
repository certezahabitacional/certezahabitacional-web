"use client";

import {
  useMemo,
  useState,
} from "react";
import { RolUsuario } from "@prisma/client";

import PasswordField from "@/components/forms/PasswordField";

import { crearUsuario } from "./actions";

type ZonaDisponible = {
  id: string;
  nombre: string;
};

type GerenteDisponible = {
  id: string;
  nombre: string;
  email: string;
  zonaId: string | null;
};

type Props = {
  rolesCreables: RolUsuario[];
  zonas: ZonaDisponible[];
  gerentes: GerenteDisponible[];
};

type AlcanceAdministrador =
  | "GLOBAL"
  | "ZONA";

export default function FormularioCrearUsuario({
  rolesCreables,
  zonas,
  gerentes,
}: Props) {
  const [rol, setRol] =
    useState<RolUsuario | "">("");

  const [
    alcanceAdministrador,
    setAlcanceAdministrador,
  ] =
    useState<AlcanceAdministrador>(
      "GLOBAL",
    );

  const [zonaId, setZonaId] =
    useState("");

  const esAdministrador =
    rol === RolUsuario.ADMINISTRADOR;

  const esGerente =
    rol === RolUsuario.GERENTE;

  const esCoordinador =
    rol === RolUsuario.COORDINADOR;

  const mostrarZona =
    esGerente ||
    esCoordinador ||
    (esAdministrador &&
      alcanceAdministrador ===
        "ZONA");

  const gerentesDeZona =
    useMemo(() => {
      if (
        !esCoordinador ||
        !zonaId
      ) {
        return [];
      }

      return gerentes.filter(
        (gerente) =>
          gerente.zonaId ===
          zonaId,
      );
    }, [
      esCoordinador,
      gerentes,
      zonaId,
    ]);

  function cambiarRol(
    nuevoRol: string,
  ) {
    const rolSeleccionado =
      nuevoRol as
        | RolUsuario
        | "";

    setRol(
      rolSeleccionado,
    );

    /*
     * Cada cambio de rol limpia
     * la selección organizacional
     * anterior para evitar enviar
     * datos que pertenecían a otro rol.
     */
    setZonaId("");

    setAlcanceAdministrador(
      "GLOBAL",
    );
  }

  function cambiarAlcance(
    nuevoAlcance: string,
  ) {
    const alcance =
      nuevoAlcance as
        AlcanceAdministrador;

    setAlcanceAdministrador(
      alcance,
    );

    if (
      alcance === "GLOBAL"
    ) {
      setZonaId("");
    }
  }

  return (
    <form
      action={crearUsuario}
      className="mt-7 space-y-5"
    >
      <Campo
        nombre="nombre"
        etiqueta="Nombre completo"
        tipo="text"
        autocompletar="name"
      />

      <Campo
        nombre="email"
        etiqueta="Correo electrónico"
        tipo="email"
        autocompletar="email"
      />

      <PasswordField
        name="password"
        label="Contraseña inicial"
        autoComplete="new-password"
        minLength={8}
        inputClassName="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-24 outline-none focus:border-cyan-300"
      />

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-300">
          Rol
        </span>

        <select
          name="rol"
          required
          value={rol}
          onChange={(event) =>
            cambiarRol(
              event.target.value,
            )
          }
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
        >
          <option
            value=""
            disabled
          >
            Selecciona un rol
          </option>

          {rolesCreables.map(
            (rolDisponible) => (
              <option
                key={
                  rolDisponible
                }
                value={
                  rolDisponible
                }
              >
                {etiquetaRol(
                  rolDisponible,
                )}
              </option>
            ),
          )}
        </select>
      </label>

      {esAdministrador && (
        <div className="rounded-2xl border border-violet-300/20 bg-violet-300/5 p-4">
          <p className="text-sm font-black text-violet-300">
            Alcance administrativo
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            El Administrador puede
            operar de forma global o
            limitarse a una zona
            específica.
          </p>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Alcance
            </span>

            <select
              name="alcanceAdministrador"
              value={
                alcanceAdministrador
              }
              onChange={(event) =>
                cambiarAlcance(
                  event.target
                    .value,
                )
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-violet-300"
            >
              <option value="GLOBAL">
                Global
              </option>

              <option value="ZONA">
                Por zona
              </option>
            </select>
          </label>

          {alcanceAdministrador ===
            "GLOBAL" && (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-400">
              Este Administrador
              tendrá alcance
              administrativo sobre
              todas las zonas.
            </div>
          )}
        </div>
      )}

      {mostrarZona && (
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            Zona
          </span>

          <select
            name="zonaId"
            required
            value={zonaId}
            onChange={(event) =>
              setZonaId(
                event.target.value,
              )
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
          >
            <option
              value=""
              disabled
            >
              Selecciona una zona
            </option>

            {zonas.map(
              (zona) => (
                <option
                  key={zona.id}
                  value={zona.id}
                >
                  {zona.nombre}
                </option>
              ),
            )}
          </select>

          {zonas.length ===
            0 && (
            <span className="mt-2 block text-xs leading-5 text-rose-300">
              No existen zonas
              activas disponibles.
              Debes crear o activar
              una zona antes de
              asignar este rol.
            </span>
          )}
        </label>
      )}

      {esCoordinador && (
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            Gerente responsable
          </span>

          <select
            name="gerenteId"
            required
            disabled={!zonaId}
            defaultValue=""
            key={zonaId}
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-cyan-300"
          >
            <option
              value=""
              disabled
            >
              {!zonaId
                ? "Primero selecciona una zona"
                : gerentesDeZona
                      .length ===
                    0
                  ? "No hay Gerentes disponibles en esta zona"
                  : "Selecciona un Gerente"}
            </option>

            {gerentesDeZona.map(
              (gerente) => (
                <option
                  key={
                    gerente.id
                  }
                  value={
                    gerente.id
                  }
                >
                  {
                    gerente.nombre
                  }{" "}
                  — {gerente.email}
                </option>
              ),
            )}
          </select>

          {zonaId &&
            gerentesDeZona.length ===
              0 && (
              <span className="mt-2 block text-xs leading-5 text-amber-300">
                Para crear un
                Coordinador en esta
                zona primero debe
                existir un Gerente
                activo asignado a la
                misma zona.
              </span>
            )}
        </label>
      )}

      {esGerente && (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-xs leading-5 text-emerald-100/80">
          El Gerente quedará
          vinculado a la zona
          seleccionada. Los
          Coordinadores de su
          estructura podrán
          asignarse posteriormente
          a esta Gerencia.
        </div>
      )}

      {esCoordinador && (
        <div className="rounded-2xl border border-indigo-300/20 bg-indigo-300/5 px-4 py-3 text-xs leading-5 text-indigo-100/80">
          El Coordinador quedará
          vinculado tanto a la zona
          seleccionada como al
          Gerente responsable.
        </div>
      )}

      <button
        type="submit"
        disabled={
          mostrarZona &&
          zonas.length === 0
        }
        className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Crear usuario
      </button>
    </form>
  );
}

function etiquetaRol(
  rol: RolUsuario,
) {
  switch (rol) {
    case RolUsuario.DIRECTOR:
      return "Director";

    case RolUsuario.ADMINISTRADOR:
      return "Administrador";

    case RolUsuario.GERENTE:
      return "Gerente";

    case RolUsuario.COORDINADOR:
      return "Coordinador";

    case RolUsuario.INSPECTOR:
      return "Inspector";

    case RolUsuario.CLIENTE:
      return "Cliente";

    default:
      return rol;
  }
}

function Campo({
  nombre,
  etiqueta,
  tipo,
  autocompletar,
  minimo,
}: {
  nombre: string;
  etiqueta: string;
  tipo: string;
  autocompletar: string;
  minimo?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">
        {etiqueta}
      </span>

      <input
        type={tipo}
        name={nombre}
        required
        minLength={minimo}
        autoComplete={
          autocompletar
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
      />
    </label>
  );
}