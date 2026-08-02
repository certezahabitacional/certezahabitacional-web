"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type EstadoInspeccion =
  | "Programada"
  | "En proceso"
  | "Reporte pendiente"
  | "Finalizada";

type Inspeccion = {
  id: string;
  folio: string;
  cliente: string;
  telefono: string;
  correo: string;
  tipoServicio: string;
  tipoInmueble: string;
  direccion: string;
  ciudad: string;
  superficie: string;
  fecha: string;
  inspector: string;
  estado: EstadoInspeccion;
  observaciones: string;
  creadaEn: string;
};

const ESTADOS: EstadoInspeccion[] = [
  "Programada",
  "En proceso",
  "Reporte pendiente",
  "Finalizada",
];

const SERVICIOS = [
  "Inspección para compra",
  "Recepción de vivienda nueva",
  "Inspección de garantía",
  "Dictamen técnico",
  "Supervisión de calidad",
  "Inspección para inversionistas",
];

const INMUEBLES = [
  "Casa habitación",
  "Departamento",
  "Vivienda nueva",
  "Local comercial",
  "Oficina",
  "Otro",
];

const formularioInicial = {
  cliente: "",
  telefono: "",
  correo: "",
  tipoServicio: SERVICIOS[0],
  tipoInmueble: INMUEBLES[0],
  direccion: "",
  ciudad: "Ciudad Juárez, Chihuahua",
  superficie: "",
  fecha: "",
  inspector: "Celedonio Gil Rodríguez",
  estado: "Programada" as EstadoInspeccion,
  observaciones: "",
};

function generarFolio(numero: number) {
  const anio = new Date().getFullYear();
  return `CH-${anio}-${String(numero).padStart(4, "0")}`;
}

function claseEstado(estado: EstadoInspeccion) {
  const clases: Record<EstadoInspeccion, string> = {
    Programada: "bg-sky-400/10 text-sky-300",
    "En proceso": "bg-amber-400/10 text-amber-300",
    "Reporte pendiente": "bg-orange-400/10 text-orange-300",
    Finalizada: "bg-emerald-400/10 text-emerald-300",
  };

  return clases[estado];
}

export default function InspeccionesPage() {
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const registrosGuardados = localStorage.getItem(
      "certeza-habitacional-inspecciones",
    );

    if (registrosGuardados) {
      try {
        const registros = JSON.parse(registrosGuardados) as Inspeccion[];
        setInspecciones(registros);
      } catch {
        localStorage.removeItem("certeza-habitacional-inspecciones");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "certeza-habitacional-inspecciones",
      JSON.stringify(inspecciones),
    );
  }, [inspecciones]);

  const inspeccionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return inspecciones.filter((inspeccion) => {
      const coincideTexto =
        !texto ||
        inspeccion.folio.toLowerCase().includes(texto) ||
        inspeccion.cliente.toLowerCase().includes(texto) ||
        inspeccion.direccion.toLowerCase().includes(texto) ||
        inspeccion.ciudad.toLowerCase().includes(texto);

      const coincideEstado =
        filtroEstado === "Todos" || inspeccion.estado === filtroEstado;

      return coincideTexto && coincideEstado;
    });
  }, [inspecciones, busqueda, filtroEstado]);

  const resumen = useMemo(
    () => ({
      total: inspecciones.length,
      programadas: inspecciones.filter(
        (inspeccion) => inspeccion.estado === "Programada",
      ).length,
      proceso: inspecciones.filter(
        (inspeccion) => inspeccion.estado === "En proceso",
      ).length,
      finalizadas: inspecciones.filter(
        (inspeccion) => inspeccion.estado === "Finalizada",
      ).length,
    }),
    [inspecciones],
  );

  function actualizarCampo(
    campo: keyof typeof formularioInicial,
    valor: string,
  ) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function guardarInspeccion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !formulario.cliente.trim() ||
      !formulario.telefono.trim() ||
      !formulario.direccion.trim() ||
      !formulario.fecha
    ) {
      setMensaje(
        "Completa cliente, teléfono, dirección y fecha de inspección.",
      );
      return;
    }

    const siguienteNumero = inspecciones.length + 1;

    const nuevaInspeccion: Inspeccion = {
      id: crypto.randomUUID(),
      folio: generarFolio(siguienteNumero),
      ...formulario,
      creadaEn: new Date().toISOString(),
    };

    setInspecciones((actuales) => [nuevaInspeccion, ...actuales]);
    setFormulario(formularioInicial);
    setMensaje("");
    setMostrarFormulario(false);
  }

  function cambiarEstado(id: string, estado: EstadoInspeccion) {
    setInspecciones((actuales) =>
      actuales.map((inspeccion) =>
        inspeccion.id === id ? { ...inspeccion, estado } : inspeccion,
      ),
    );
  }

  function eliminarInspeccion(id: string) {
    const confirmar = window.confirm(
      "¿Deseas eliminar este expediente? Esta acción no se puede deshacer.",
    );

    if (!confirmar) return;

    setInspecciones((actuales) =>
      actuales.filter((inspeccion) => inspeccion.id !== id),
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex max-w-[1500px] flex-col justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/panel"
              className="text-sm font-bold text-cyan-300 hover:text-cyan-200"
            >
              ← Regresar al panel
            </Link>

            <h1 className="mt-2 text-3xl font-black">
              Gestión de inspecciones
            </h1>

            <p className="mt-1 text-slate-400">
              Expedientes, programación y seguimiento operativo.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <Link
              href="/panel/agenda"
              className="rounded-full border border-white/15 px-5 py-4 text-center font-black text-slate-200 transition hover:border-cyan-300 hover:text-cyan-300"
            >
              Agenda
            </Link>

            <Link
              href="/panel/inspectores"
              className="rounded-full border border-white/15 px-5 py-4 text-center font-black text-slate-200 transition hover:border-cyan-300 hover:text-cyan-300"
            >
              Inspectores
            </Link>

            <Link
              href="/panel/clientes"
              className="rounded-full border border-cyan-300/30 px-5 py-4 text-center font-black text-cyan-300 transition hover:bg-cyan-300/10"
            >
              Clientes
            </Link>

            <button
              type="button"
              onClick={() => {
                setMensaje("");
                setMostrarFormulario(true);
              }}
              className="rounded-full bg-cyan-400 px-6 py-4 font-black text-slate-950 transition hover:bg-cyan-300"
            >
              + Nueva inspección
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-6 py-8">
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <p className="text-sm font-bold text-slate-400">
              Total de expedientes
            </p>
            <p className="mt-4 text-4xl font-black text-cyan-300">
              {resumen.total}
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <p className="text-sm font-bold text-slate-400">Programadas</p>
            <p className="mt-4 text-4xl font-black text-sky-300">
              {resumen.programadas}
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <p className="text-sm font-bold text-slate-400">En proceso</p>
            <p className="mt-4 text-4xl font-black text-amber-300">
              {resumen.proceso}
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <p className="text-sm font-bold text-slate-400">Finalizadas</p>
            <p className="mt-4 text-4xl font-black text-emerald-300">
              {resumen.finalizadas}
            </p>
          </article>
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <div className="grid gap-4 border-b border-white/10 p-6 lg:grid-cols-[1fr_240px_auto]">
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por folio, cliente, dirección o ciudad"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300"
            />

            <select
              value={filtroEstado}
              onChange={(event) => setFiltroEstado(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-white outline-none focus:border-cyan-300"
            >
              <option>Todos</option>
              {ESTADOS.map((estado) => (
                <option key={estado}>{estado}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setFiltroEstado("Todos");
              }}
              className="rounded-2xl border border-white/10 px-5 py-4 font-bold text-slate-300 hover:border-cyan-300 hover:text-cyan-300"
            >
              Limpiar filtros
            </button>
          </div>

          {inspeccionesFiltradas.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyan-400/10 text-2xl">
                📋
              </div>

              <h2 className="mt-6 text-2xl font-black">
                No hay inspecciones registradas
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Crea el primer expediente para comenzar a administrar clientes,
                viviendas y servicios de inspección.
              </p>

              <button
                type="button"
                onClick={() => setMostrarFormulario(true)}
                className="mt-7 rounded-full bg-cyan-400 px-6 py-4 font-black text-slate-950"
              >
                Crear primera inspección
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {inspeccionesFiltradas.map((inspeccion) => (
                <article key={inspeccion.id} className="p-6">
                  <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr_0.85fr_auto] xl:items-center">
                    <div>
                      <p className="text-lg font-black text-cyan-300">
                        {inspeccion.folio}
                      </p>
                      <p className="mt-2 font-bold">{inspeccion.cliente}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {inspeccion.telefono}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold">{inspeccion.tipoServicio}</p>
                      <p className="mt-2 text-sm text-slate-400">
                        {inspeccion.tipoInmueble}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {inspeccion.direccion}, {inspeccion.ciudad}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-400">
                        Fecha programada
                      </p>
                      <p className="mt-1 font-black">{inspeccion.fecha}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        Inspector: {inspeccion.inspector}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <select
                        value={inspeccion.estado}
                        onChange={(event) =>
                          cambiarEstado(
                            inspeccion.id,
                            event.target.value as EstadoInspeccion,
                          )
                        }
                        className={`rounded-full border border-white/10 px-4 py-3 text-sm font-black outline-none ${claseEstado(
                          inspeccion.estado,
                        )}`}
                      >
                        {ESTADOS.map((estado) => (
                          <option
                            key={estado}
                            value={estado}
                            className="bg-slate-950 text-white"
                          >
                            {estado}
                          </option>
                        ))}
                      </select>

                      <Link
                        href={`/panel/inspecciones/${inspeccion.id}`}
                        className="rounded-full bg-cyan-400 px-4 py-3 text-center text-sm font-black text-slate-950 hover:bg-cyan-300"
                      >
                        Abrir expediente
                      </Link>

                      <button
                        type="button"
                        onClick={() => eliminarInspeccion(inspeccion.id)}
                        className="rounded-full border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-400/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {inspeccion.observaciones && (
                    <div className="mt-5 rounded-2xl bg-white/5 p-4 text-sm text-slate-400">
                      <span className="font-bold text-slate-300">
                        Observaciones:
                      </span>{" "}
                      {inspeccion.observaciones}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 px-4 py-8 backdrop-blur">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6 sm:p-8">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
                  Nuevo expediente
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  Registrar inspección
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 text-xl text-slate-400 hover:border-white/30 hover:text-white"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardarInspeccion} className="p-6 sm:p-8">
              <div className="grid gap-6 md:grid-cols-2">
                <Campo
                  etiqueta="Nombre del cliente *"
                  valor={formulario.cliente}
                  cambiar={(valor) => actualizarCampo("cliente", valor)}
                  placeholder="Nombre completo"
                />

                <Campo
                  etiqueta="Teléfono o WhatsApp *"
                  valor={formulario.telefono}
                  cambiar={(valor) => actualizarCampo("telefono", valor)}
                  placeholder="+52 656..."
                />

                <Campo
                  etiqueta="Correo electrónico"
                  tipo="email"
                  valor={formulario.correo}
                  cambiar={(valor) => actualizarCampo("correo", valor)}
                  placeholder="cliente@correo.com"
                />

                <Seleccion
                  etiqueta="Tipo de servicio"
                  valor={formulario.tipoServicio}
                  opciones={SERVICIOS}
                  cambiar={(valor) => actualizarCampo("tipoServicio", valor)}
                />

                <Seleccion
                  etiqueta="Tipo de inmueble"
                  valor={formulario.tipoInmueble}
                  opciones={INMUEBLES}
                  cambiar={(valor) => actualizarCampo("tipoInmueble", valor)}
                />

                <Campo
                  etiqueta="Superficie aproximada"
                  valor={formulario.superficie}
                  cambiar={(valor) => actualizarCampo("superficie", valor)}
                  placeholder="Ejemplo: 180 m²"
                />

                <div className="md:col-span-2">
                  <Campo
                    etiqueta="Dirección del inmueble *"
                    valor={formulario.direccion}
                    cambiar={(valor) => actualizarCampo("direccion", valor)}
                    placeholder="Calle, número, colonia"
                  />
                </div>

                <Campo
                  etiqueta="Ciudad"
                  valor={formulario.ciudad}
                  cambiar={(valor) => actualizarCampo("ciudad", valor)}
                  placeholder="Ciudad y estado"
                />

                <Campo
                  etiqueta="Fecha programada *"
                  tipo="date"
                  valor={formulario.fecha}
                  cambiar={(valor) => actualizarCampo("fecha", valor)}
                />

                <Campo
                  etiqueta="Inspector asignado"
                  valor={formulario.inspector}
                  cambiar={(valor) => actualizarCampo("inspector", valor)}
                  placeholder="Nombre del inspector"
                />

                <Seleccion
                  etiqueta="Estado inicial"
                  valor={formulario.estado}
                  opciones={ESTADOS}
                  cambiar={(valor) =>
                    actualizarCampo("estado", valor as EstadoInspeccion)
                  }
                />

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-300">
                    Observaciones iniciales
                  </label>

                  <textarea
                    value={formulario.observaciones}
                    onChange={(event) =>
                      actualizarCampo("observaciones", event.target.value)
                    }
                    rows={4}
                    placeholder="Información adicional del servicio o del inmueble"
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300"
                  />
                </div>
              </div>

              {mensaje && (
                <p className="mt-6 rounded-2xl bg-rose-400/10 px-5 py-4 font-bold text-rose-300">
                  {mensaje}
                </p>
              )}

              <div className="mt-8 flex flex-col justify-end gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="rounded-full border border-white/15 px-7 py-4 font-bold text-slate-300"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="rounded-full bg-cyan-400 px-7 py-4 font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Guardar expediente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

type CampoProps = {
  etiqueta: string;
  valor: string;
  cambiar: (valor: string) => void;
  placeholder?: string;
  tipo?: string;
};

function Campo({
  etiqueta,
  valor,
  cambiar,
  placeholder,
  tipo = "text",
}: CampoProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-300">
        {etiqueta}
      </label>

      <input
        type={tipo}
        value={valor}
        onChange={(event) => cambiar(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300"
      />
    </div>
  );
}

type SeleccionProps = {
  etiqueta: string;
  valor: string;
  opciones: readonly string[];
  cambiar: (valor: string) => void;
};

function Seleccion({
  etiqueta,
  valor,
  opciones,
  cambiar,
}: SeleccionProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-300">
        {etiqueta}
      </label>

      <select
        value={valor}
        onChange={(event) => cambiar(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-white outline-none focus:border-cyan-300"
      >
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </div>
  );
}