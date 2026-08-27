"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChangeEvent,
  PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

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
  puedeModificar: boolean;
  motivoSoloLectura?: string;
};

const firmasIniciales: Firmas = {
  inspector: "",
  cliente: "",
  fechaInspector: "",
  fechaCliente: "",
  puedeModificar: false,
  motivoSoloLectura: "",
};

const TIPOS_IMAGEN_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

const TAMANO_MAXIMO_FIRMA = 5 * 1024 * 1024;

function FirmaCanvas({
  titulo,
  valor,
  onChange,
  disabled = false,
}: {
  titulo: string;
  valor: string;
  onChange: (firma: string) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);
  const dibujandoRef = useRef(false);

  const [errorArchivo, setErrorArchivo] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const contexto = canvas.getContext("2d");
    if (!contexto) return;

    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.lineWidth = 3;
    contexto.lineCap = "round";
    contexto.lineJoin = "round";
    contexto.strokeStyle = "#0f172a";

    if (valor) {
      const imagen = new Image();

      imagen.onload = () => {
        contexto.fillStyle = "#ffffff";
        contexto.fillRect(0, 0, canvas.width, canvas.height);

        const escala = Math.min(
          canvas.width / imagen.width,
          canvas.height / imagen.height,
        );

        const ancho = imagen.width * escala;
        const alto = imagen.height * escala;
        const x = (canvas.width - ancho) / 2;
        const y = (canvas.height - alto) / 2;

        contexto.drawImage(imagen, x, y, ancho, alto);
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
    if (disabled) return;

    const contexto = canvasRef.current?.getContext("2d");
    if (!contexto) return;

    dibujandoRef.current = true;

    const punto = posicion(evento);

    contexto.beginPath();
    contexto.moveTo(punto.x, punto.y);

    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function dibujar(evento: PointerEvent<HTMLCanvasElement>) {
    if (disabled || !dibujandoRef.current) return;

    const contexto = canvasRef.current?.getContext("2d");
    if (!contexto) return;

    const punto = posicion(evento);

    contexto.lineTo(punto.x, punto.y);
    contexto.stroke();
  }

  function finalizar() {
    if (disabled || !dibujandoRef.current) return;

    dibujandoRef.current = false;

    const canvas = canvasRef.current;

    if (canvas) {
      onChange(canvas.toDataURL("image/png"));
    }
  }

  function limpiar() {
    if (disabled) return;

    const canvas = canvasRef.current;
    const contexto = canvas?.getContext("2d");

    if (!canvas || !contexto) return;

    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);

    if (inputArchivoRef.current) {
      inputArchivoRef.current.value = "";
    }

    setErrorArchivo("");
    onChange("");
  }

  function abrirSelectorArchivo() {
    if (disabled) return;

    setErrorArchivo("");
    inputArchivoRef.current?.click();
  }

  function insertarFirmaDigital(evento: ChangeEvent<HTMLInputElement>) {
    if (disabled) {
      evento.target.value = "";
      return;
    }

    const archivo = evento.target.files?.[0];

    if (!archivo) return;

    if (!TIPOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
      setErrorArchivo(
        "Formato no permitido. Usa una imagen PNG, JPG, JPEG o WEBP.",
      );
      evento.target.value = "";
      return;
    }

    if (archivo.size > TAMANO_MAXIMO_FIRMA) {
      setErrorArchivo(
        "La imagen de la firma no debe superar los 5 MB.",
      );
      evento.target.value = "";
      return;
    }

    const lector = new FileReader();

    lector.onload = () => {
      if (typeof lector.result !== "string") {
        setErrorArchivo("No fue posible leer la imagen seleccionada.");
        return;
      }

      const imagen = new Image();

      imagen.onload = () => {
        const canvas = canvasRef.current;

        if (!canvas) {
          setErrorArchivo("No fue posible preparar la firma digital.");
          return;
        }

        const contexto = canvas.getContext("2d");

        if (!contexto) {
          setErrorArchivo("No fue posible preparar la firma digital.");
          return;
        }

        contexto.fillStyle = "#ffffff";
        contexto.fillRect(0, 0, canvas.width, canvas.height);

        const escala = Math.min(
          canvas.width / imagen.width,
          canvas.height / imagen.height,
        );

        const ancho = imagen.width * escala;
        const alto = imagen.height * escala;
        const x = (canvas.width - ancho) / 2;
        const y = (canvas.height - alto) / 2;

        contexto.drawImage(imagen, x, y, ancho, alto);

        setErrorArchivo("");
        onChange(canvas.toDataURL("image/png"));
      };

      imagen.onerror = () => {
        setErrorArchivo("La imagen seleccionada no es válida.");
      };

      imagen.src = lector.result;
    };

    lector.onerror = () => {
      setErrorArchivo("No fue posible leer la imagen seleccionada.");
    };

    lector.readAsDataURL(archivo);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-black">{titulo}</h2>

        {!disabled && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputArchivoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={insertarFirmaDigital}
              className="hidden"
            />

            <button
              type="button"
              onClick={abrirSelectorArchivo}
              className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950"
            >
              Insertar firma digital
            </button>

            <button
              type="button"
              onClick={limpiar}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-400">
        {disabled
          ? "Firma registrada en el expediente. Esta vista es de solo lectura."
          : "Firma dentro del recuadro usando el mouse o la pantalla táctil, o inserta una imagen de firma digital."}
      </p>

      {!disabled && (
        <p className="mt-1 text-xs text-slate-500">
          Formatos permitidos: PNG, JPG, JPEG o WEBP. Tamaño mÃ¡ximo: 5 MB.
        </p>
      )}

      {errorArchivo && (
        <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-300">
          {errorArchivo}
        </p>
      )}

      <canvas
        ref={canvasRef}
        width={900}
        height={300}
        onPointerDown={iniciar}
        onPointerMove={dibujar}
        onPointerUp={finalizar}
        onPointerCancel={finalizar}
        onPointerLeave={finalizar}
        className={`mt-5 h-56 w-full rounded-2xl bg-white ${
          disabled ? "cursor-not-allowed opacity-90" : "touch-none"
        }`}
      />

      {valor && !disabled && (
        <p className="mt-3 text-xs font-bold text-emerald-300">
          Firma preparada para guardar.
        </p>
      )}
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
          fetch(`/api/inspecciones/${inspeccionId}`, {
            cache: "no-store",
          }),
          fetch(`/api/inspecciones/${inspeccionId}/firmas`, {
            cache: "no-store",
          }),
        ]);

        if (!respuestaInspeccion.ok || !respuestaFirmas.ok) {
          if (activo) {
            setInspeccion(null);

            const error = (await respuestaFirmas.json().catch(() => null)) as
              | { error?: string }
              | null;

            setMensaje(
              error?.error ||
                "No tienes acceso a las firmas de este expediente.",
            );
          }
          return;
        }

        const datosInspeccion =
          (await respuestaInspeccion.json()) as Inspeccion;

        const datosFirmas = (await respuestaFirmas.json()) as Firmas;

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
    if (!inspeccion || !firmas.puedeModificar) return;

    if (!firmas.inspector || !firmas.cliente) {
      setMensaje(
        "Debes registrar la firma del Inspector y la firma del Cliente antes de guardar.",
      );
      return;
    }

    setGuardando(true);
    setMensaje("");

    try {
      const respuesta = await fetch(
        `/api/inspecciones/${inspeccionId}/firmas`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inspector: {
              imagen: firmas.inspector,
            },
            cliente: {
              imagen: firmas.cliente,
            },
          }),
        },
      );

      if (!respuesta.ok) {
        const error = (await respuesta.json().catch(() => null)) as
          | { error?: string }
          | null;

        setMensaje(
          error?.error || "No fue posible guardar las firmas.",
        );
        return;
      }

      const respuestaActualizada = await fetch(
        `/api/inspecciones/${inspeccionId}/firmas`,
        {
          cache: "no-store",
        },
      );

      if (respuestaActualizada.ok) {
        const datosFirmas =
          (await respuestaActualizada.json()) as Firmas;

        setFirmas(datosFirmas);
      }

      setMensaje(
        "Firmas guardadas correctamente en el expediente.",
      );
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
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
        {mensaje || "Expediente no encontrado."}
      </main>
    );
  }

  const mensajeEsError =
    Boolean(mensaje) &&
    mensaje !== "Firmas guardadas correctamente en el expediente.";

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

            <h1 className="mt-3 text-3xl font-black">
              Firmas del expediente
            </h1>

            <p className="mt-2 text-slate-400">
              {inspeccion.folio} · {inspeccion.cliente}
            </p>
          </div>

          {firmas.puedeModificar && (
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-full bg-cyan-400 px-7 py-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar firmas"}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {!firmas.puedeModificar && (
          <div className="mb-7 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm text-amber-100">
            {firmas.motivoSoloLectura ||
              "Las firmas se encuentran en modo solo lectura."}
          </div>
        )}

        <div className="mb-7 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <p className="text-sm font-bold text-slate-400">
            Inmueble
          </p>

          <p className="mt-2 font-bold">
            {inspeccion.direccion}, {inspeccion.ciudad}
          </p>
        </div>

        <div className="grid gap-7 lg:grid-cols-2">
          <FirmaCanvas
            titulo={`Inspector: ${inspeccion.inspector}`}
            valor={firmas.inspector}
            disabled={!firmas.puedeModificar}
            onChange={(firma) =>
              setFirmas((actual) => ({
                ...actual,
                inspector: firma,
                fechaInspector: "",
              }))
            }
          />

          <FirmaCanvas
            titulo={`Cliente: ${inspeccion.cliente}`}
            valor={firmas.cliente}
            disabled={!firmas.puedeModificar}
            onChange={(firma) =>
              setFirmas((actual) => ({
                ...actual,
                cliente: firma,
                fechaCliente: "",
              }))
            }
          />
        </div>

        {mensaje && (
          <p
            className={`mt-7 rounded-2xl px-5 py-4 font-bold ${
              mensajeEsError
                ? "border border-rose-400/20 bg-rose-400/10 text-rose-300"
                : "bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {mensaje}
          </p>
        )}

        <div className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-6 text-sm leading-7 text-cyan-100">
          Las firmas quedan asociadas al expediente y pueden consultarse
          desde los perfiles autorizados. La modificación queda restringida
          al Inspector asignado mientras la inspecciÃ³n se encuentre EN PROCESO.
        </div>
      </div>
    </main>
  );
}
