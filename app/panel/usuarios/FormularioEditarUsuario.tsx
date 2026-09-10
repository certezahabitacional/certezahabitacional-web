"use client";

import { useMemo, useState } from "react";
import { RolUsuario } from "@prisma/client";

type Zona = {
  id: string;
  nombre: string;
};

type Gerente = {
  id: string;
  nombre: string;
  email: string;
  zonaId: string | null;
};

type UsuarioEditable = {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  zonaId: string | null;
  gerenteId: string | null;
};

type Props = {
  usuario: UsuarioEditable;
  rolesEditables: RolUsuario[];
  zonas: Zona[];
  gerentes: Gerente[];
  action: (formData: FormData) => void | Promise<void>;
};

export default function FormularioEditarUsuario({
  usuario,
  rolesEditables,
  zonas,
  gerentes,
  action,
}: Props) {
  const [rol, setRol] = useState<RolUsuario>(usuario.rol);
  const [zonaId, setZonaId] = useState(usuario.zonaId ?? "");
  const [alcanceAdministrador, setAlcanceAdministrador] =
    useState<"GLOBAL" | "ZONA">(
      usuario.rol === RolUsuario.ADMINISTRADOR && usuario.zonaId
        ? "ZONA"
        : "GLOBAL",
    );

  const esAdministrador = rol === RolUsuario.ADMINISTRADOR;
  const esGerente = rol === RolUsuario.GERENTE;
  const esCoordinador = rol === RolUsuario.COORDINADOR;

  const mostrarZona =
    esGerente ||
    esCoordinador ||
    (esAdministrador && alcanceAdministrador === "ZONA");

  const gerentesDeZona = useMemo(
    () => (zonaId ? gerentes.filter((g) => g.zonaId === zonaId) : []),
    [gerentes, zonaId],
  );

  function cambiarRol(valor: string) {
    const nuevoRol = valor as RolUsuario;
    setRol(nuevoRol);

    if (nuevoRol === RolUsuario.ADMINISTRADOR) {
      setAlcanceAdministrador("GLOBAL");
      setZonaId("");
    } else if (
      nuevoRol === RolUsuario.DIRECTOR ||
      nuevoRol === RolUsuario.CLIENTE
    ) {
      setZonaId("");
    }
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="usuarioId" value={usuario.id} />

      <Campo
        name="nombre"
        label="Nombre completo"
        type="text"
        defaultValue={usuario.nombre}
      />

      <Campo
        name="email"
        label="Correo electrónico"
        type="email"
        defaultValue={usuario.email}
      />

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-300">Rol</span>
        <select
          name="rol"
          required
          value={rol}
          onChange={(e) => cambiarRol(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
        >
          {rolesEditables.map((r) => (
            <option key={r} value={r}>
              {etiquetaRol(r)}
            </option>
          ))}
        </select>
      </label>

      {esAdministrador && (
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            Alcance administrativo
          </span>
          <select
            name="alcanceAdministrador"
            value={alcanceAdministrador}
            onChange={(e) => {
              const valor = e.target.value as "GLOBAL" | "ZONA";
              setAlcanceAdministrador(valor);
              if (valor === "GLOBAL") setZonaId("");
            }}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
          >
            <option value="GLOBAL">Global</option>
            <option value="ZONA">Por zona</option>
          </select>
        </label>
      )}

      {mostrarZona && (
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">Zona</span>
          <select
            name="zonaId"
            required
            value={zonaId}
            onChange={(e) => setZonaId(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
          >
            <option value="" disabled>
              Selecciona una zona
            </option>
            {zonas.map((zona) => (
              <option key={zona.id} value={zona.id}>
                {zona.nombre}
              </option>
            ))}
          </select>
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
            defaultValue={
              gerentesDeZona.some((g) => g.id === usuario.gerenteId)
                ? usuario.gerenteId ?? ""
                : ""
            }
            key={`${zonaId}-${usuario.gerenteId ?? ""}`}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none disabled:opacity-50 focus:border-cyan-300"
          >
            <option value="" disabled>
              {!zonaId
                ? "Primero selecciona una zona"
                : gerentesDeZona.length === 0
                  ? "No hay Gerentes activos en esta zona"
                  : "Selecciona un Gerente"}
            </option>
            {gerentesDeZona.map((gerente) => (
              <option key={gerente.id} value={gerente.id}>
                {gerente.nombre} — {gerente.email}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="submit"
        className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
      >
        Guardar cambios
      </button>
    </form>
  );
}

function Campo({
  name,
  label,
  type,
  defaultValue,
}: {
  name: string;
  label: string;
  type: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      <input
        name={name}
        type={type}
        required
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
      />
    </label>
  );
}

function etiquetaRol(rol: RolUsuario) {
  switch (rol) {
    case RolUsuario.DIRECTOR:
      return "Director";
    case RolUsuario.ADMINISTRADOR:
      return "Administrador";
    case RolUsuario.GERENTE:
      return "Gerente";
    case RolUsuario.COORDINADOR:
      return "Coordinador";
    case RolUsuario.CLIENTE:
      return "Cliente";
    case RolUsuario.INSPECTOR:
      return "Inspector";
    default:
      return rol;
  }
}
