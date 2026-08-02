"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PointerEvent, useEffect, useRef, useState } from "react";

type Inspeccion = {
  id: string;
  folio: string;
  cliente: string;
  inspector: string;
  direccion: string;
  ciudad: string;
};

type Firmas = {
  inspector: string;
  cliente: string;
  fechaInspector: string;
  fechaCliente: string;
};

const firmasIniciales: Firmas = {
  inspector: "",
  cliente: "",
  fechaInspector: "",
  fechaCliente: "",
};

function FirmaCanvas({
  titulo,
  valor,
  onChange,
}: {
  titulo: string;
  valor: string;
  onChange: (firma: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dibujandoRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const contexto = canvas.getContext("2d");
    if (!contexto) return;

    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.lineWidth = 3;
    contexto.lineCap = "round";
    contexto.strokeStyle = "#0f172a";

    if (valor) {
      const imagen = new Image();
      imagen.onload = () => {
        contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      };
      imagen.src = valor;
    }
  }, [valor]);

  function posicion(evento: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    return {
      x: ((evento.clientX - rect.left) / rect.width) * canvas.width,
      y: ((evento.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function iniciar(evento: PointerEvent<HTMLCanvasElement>) {
    const contexto = canvasRef.current?.getContext("2d");
    if (!contexto) return;

    dibujandoRef.current = true;
    const punto = posicion(evento);
    contexto.beginPath();
    contexto.moveTo(punto.x, punto.y);
    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function dibujar(evento: PointerEvent<HTMLCanvasElement>) {
    if (!dibujandoRef.current) return;

    const contexto = canvasRef.current?.getContext("2d");
    if (!contexto) return;

    const punto = posicion(evento);
    contexto.lineTo(punto.x, punto.y);
    contexto.stroke();
  }

  function finalizar() {
    if (!dibujandoRef.current) return;

    dibujandoRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const contexto = canvas?.getContext("2d");
    if (!canvas || !contexto) return;

    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-black">{titulo}</h2>
        <button
          type="button"
          onClick={limpiar}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-slate-300"
        >
          Limpiar
        </button>
      </div>

      <p className="mt-2 text-sm text-slate-400">
        Firma dentro del recuadro usando el mouse o la pantalla táctil.
      </p>

      <canvas
        ref={canvasRef}
        width={900}
        height={300}
        onPointerDown={iniciar}
        onPointerMove={dibujar}
        onPointerUp={finalizar}
        onPointerCancel={finalizar}
        onPointerLeave={finalizar}
        className="mt-5 h-56 w-full touch-none rounded-2xl bg-white"
      />
    </section>
  );
}

export default function FirmasPage() {
  const params = useParams();
  const inspeccionId = String(params.id);
  const [inspeccion, setInspeccion] = useState<Inspeccion | null>(null);
  const [firmas, setFirmas] = useState<Firmas>(firmasIniciales);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setMensaje("");

      try {
        const [respuestaInspeccion, respuestaFirmas] = await Promise.all([
          fetch(`/api/inspecciones/${inspeccionId}`, { cache: "no-store" }),
          fetch(`/api/inspecciones/${inspeccionId}/firmas`, {
            cache: "no-store",
          }),
        ]);

        if (!respuestaInspeccion.ok) {
          if (activo) setInspeccion(null);
          return;
        }

        const datosInspeccion = (await respuestaInspeccion.json()) as Inspeccion;
        const datosFirmas = respuestaFirmas.ok
          ? ((await respuestaFirmas.json()) as Firmas)
          : firmasIniciales;

        if (activo) {
          setInspeccion(datosInspeccion);
          setFirmas(datosFirmas);
        }
      } catch {
        if (activo) {
          setInspeccion(null);
          setMensaje("No fue posible cargar el expediente.");
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, [inspeccionId]);

  async function guardar() {
    if (!inspeccion) return;

    setGuardando(true);
    setMensaje("");

    try {
      const respuesta = await fetch(
        `/api/inspecciones/${inspeccionId}/firmas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inspector: {
              imagen: firmas.inspector,
              nombre: inspeccion.inspector,
            },
            cliente: {
              imagen: firmas.cliente,
              nombre: inspeccion.cliente,
            },
          }),
        },
      );

      if (!respuesta.ok) {
        const error = (await respuesta.json().catch(() => null)) as
          | { error?: string }
          | null;
        setMensaje(error?.error || "No fue posible guardar las firmas.");
        return;
      }

      const ahora = new Date().toISOString();
      setFirmas((actuales) => ({
        ...actuales,
        fechaInspector: actuales.inspector
          ? actuales.fechaInspector || ahora
          : "",
        fechaCliente: actuales.cliente
          ? actuales.fechaCliente || ahora
          : "",
      }));
      setMensaje("Firmas guardadas permanentemente en Supabase.");
    } catch {
      setMensaje("No fue posible guardar las firmas.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        Cargando expediente...
      </main>
    );
  }

  if (!inspeccion) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        {mensaje || "Expediente no encontrado."}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 px-6 py-7 sm:flex-row sm:items-center">
          <div>
            <Link
              href={`/panel/inspecciones/${inspeccionId}`}
              className="text-sm font-bold text-cyan-300"
            >
              ← Regresar al expediente
            </Link>
            <h1 className="mt-3 text-3xl font-black">Firmas del expediente</h1>
            <p className="mt-2 text-slate-400">
              {inspeccion.folio} · {inspeccion.cliente}
            </p>
          </div>

          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-full bg-cyan-400 px-7 py-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? "Guardando..." : "Guardar firmas"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-7 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <p className="text-sm font-bold text-slate-400">Inmueble</p>
          <p className="mt-2 font-bold">
            {inspeccion.direccion}, {inspeccion.ciudad}
          </p>
        </div>

        <div className="grid gap-7 lg:grid-cols-2">
          <FirmaCanvas
            titulo={`Inspector: ${inspeccion.inspector}`}
            valor={firmas.inspector}
            onChange={(firma) =>
              setFirmas((actual) => ({ ...actual, inspector: firma }))
            }
          />
          <FirmaCanvas
            titulo={`Cliente: ${inspeccion.cliente}`}
            valor={firmas.cliente}
            onChange={(firma) =>
              setFirmas((actual) => ({ ...actual, cliente: firma }))
            }
          />
        </div>

        {mensaje && (
          <p className="mt-7 rounded-2xl bg-emerald-400/10 px-5 py-4 font-bold text-emerald-300">
            {mensaje}
          </p>
        )}

        <div className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-6 text-sm leading-7 text-cyan-100">
          Las firmas quedan asociadas al expediente y pueden consultarse desde
          cualquier equipo autorizado.
        </div>
      </div>
    </main>
  );
}
