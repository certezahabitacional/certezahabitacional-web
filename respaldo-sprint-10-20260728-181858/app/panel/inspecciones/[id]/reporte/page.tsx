"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Clasificacion = "C" | "O" | "NC" | "CR" | "NA";
type Prioridad = "P1" | "P2" | "P3" | "P4" | "P5";

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
  estado: string;
  observaciones: string;
  creadaEn: string;
};

type Hallazgo = {
  id: string;
  inspeccionId: string;
  area: string;
  elemento: string;
  ubicacion: string;
  descripcion: string;
  clasificacion: Clasificacion;
  prioridad: Prioridad;
  recomendacion: string;
  evidencia?: string;
  evidenciaNombre?: string;
  creadoEn: string;
};

const etiquetas: Record<Clasificacion, string> = {
  C: "Conforme",
  O: "Observación",
  NC: "No Conforme",
  CR: "Condición Crítica",
  NA: "No Aplica",
};

function calcularISH(hallazgos: Hallazgo[]) {
  const evaluables = hallazgos.filter((hallazgo) => hallazgo.clasificacion !== "NA");
  if (evaluables.length === 0) return 100;

  const valores: Record<Exclude<Clasificacion, "NA">, number> = {
    C: 100,
    O: 80,
    NC: 50,
    CR: 0,
  };

  const total = evaluables.reduce((suma, hallazgo) => {
    if (hallazgo.clasificacion === "NA") return suma;
    return suma + valores[hallazgo.clasificacion];
  }, 0);

  return Math.round(total / evaluables.length);
}

function semaforo(ish: number) {
  if (ish >= 85) return "Condición favorable";
  if (ish >= 70) return "Requiere atención";
  return "Condición prioritaria";
}

export default function ReportePage() {
  const params = useParams();
  const inspeccionId = String(params.id);
  const [inspeccion, setInspeccion] = useState<Inspeccion | null>(null);
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    try {
      const inspeccionesGuardadas = localStorage.getItem("certeza-habitacional-inspecciones");
      const lista = inspeccionesGuardadas
        ? (JSON.parse(inspeccionesGuardadas) as Inspeccion[])
        : [];
      setInspeccion(lista.find((item) => item.id === inspeccionId) ?? null);

      const hallazgosGuardados = localStorage.getItem(`certeza-hallazgos-${inspeccionId}`);
      setHallazgos(hallazgosGuardados ? (JSON.parse(hallazgosGuardados) as Hallazgo[]) : []);
    } catch {
      setInspeccion(null);
      setHallazgos([]);
    } finally {
      setCargando(false);
    }
  }, [inspeccionId]);

  const ish = useMemo(() => calcularISH(hallazgos), [hallazgos]);
  const resumen = useMemo(
    () => ({
      total: hallazgos.length,
      conformes: hallazgos.filter((h) => h.clasificacion === "C").length,
      observaciones: hallazgos.filter((h) => h.clasificacion === "O").length,
      noConformes: hallazgos.filter((h) => h.clasificacion === "NC").length,
      criticos: hallazgos.filter((h) => h.clasificacion === "CR").length,
    }),
    [hallazgos],
  );

  if (cargando) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Cargando reporte...</main>;
  }

  if (!inspeccion) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-black">Expediente no encontrado</h1>
          <Link href="/panel/inspecciones" className="mt-6 inline-block rounded-full bg-cyan-400 px-6 py-3 font-black text-slate-950">
            Regresar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-200 py-8 text-slate-950 print:bg-white print:py-0">
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mx-auto mb-5 flex max-w-5xl flex-col justify-between gap-3 px-4 sm:flex-row">
        <Link href={`/panel/inspecciones/${inspeccionId}`} className="rounded-full bg-slate-950 px-6 py-3 text-center font-black text-white">
          ← Regresar al expediente
        </Link>
        <button onClick={() => window.print()} className="rounded-full bg-cyan-500 px-6 py-3 font-black text-slate-950">
          Imprimir o guardar como PDF
        </button>
      </div>

      <article className="print-page mx-auto max-w-5xl bg-white p-8 shadow-2xl sm:p-12">
        <header className="border-b-4 border-cyan-500 pb-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-600">Certeza Habitacional</p>
              <h1 className="mt-3 text-4xl font-black">Reporte Técnico de Inspección</h1>
              <p className="mt-3 text-slate-600">Método Certeza® · Evaluación visual y documental</p>
            </div>
            <div className="rounded-2xl bg-slate-950 px-6 py-5 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Folio</p>
              <p className="mt-2 text-2xl font-black">{inspeccion.folio}</p>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-5 sm:grid-cols-2">
          <Dato titulo="Cliente" valor={inspeccion.cliente} />
          <Dato titulo="Teléfono" valor={inspeccion.telefono} />
          <Dato titulo="Correo" valor={inspeccion.correo || "No registrado"} />
          <Dato titulo="Servicio" valor={inspeccion.tipoServicio} />
          <Dato titulo="Inmueble" valor={inspeccion.tipoInmueble} />
          <Dato titulo="Superficie" valor={inspeccion.superficie || "No registrada"} />
          <Dato titulo="Dirección" valor={`${inspeccion.direccion}, ${inspeccion.ciudad}`} />
          <Dato titulo="Fecha de inspección" valor={inspeccion.fecha} />
          <Dato titulo="Inspector" valor={inspeccion.inspector} />
          <Dato titulo="Estado" valor={inspeccion.estado} />
        </section>

        <section className="avoid-break mt-10 rounded-3xl bg-slate-950 p-7 text-white">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Índice de Salud Habitacional</p>
              <p className="mt-3 text-6xl font-black">{ish}<span className="text-2xl text-slate-400">/100</span></p>
              <p className="mt-2 font-bold text-cyan-300">{semaforo(ish)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              <Mini titulo="Total" valor={resumen.total} />
              <Mini titulo="Conformes" valor={resumen.conformes} />
              <Mini titulo="Observaciones" valor={resumen.observaciones} />
              <Mini titulo="No conformes" valor={resumen.noConformes} />
              <Mini titulo="Críticos" valor={resumen.criticos} />
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black">Hallazgos registrados</h2>
          <p className="mt-2 text-sm text-slate-600">Clasificación conforme al Método Certeza®.</p>

          {hallazgos.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              No se registraron hallazgos en este expediente.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {hallazgos.map((hallazgo, indice) => (
                <article key={hallazgo.id} className="avoid-break rounded-2xl border border-slate-200 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-cyan-700">Hallazgo {indice + 1} · {hallazgo.area}</p>
                      <h3 className="mt-2 text-xl font-black">{hallazgo.elemento}</h3>
                      <p className="mt-1 text-sm text-slate-500">Ubicación: {hallazgo.ubicacion}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">{hallazgo.clasificacion} · {etiquetas[hallazgo.clasificacion]}</span>
                      <span className="rounded-full bg-cyan-100 px-4 py-2 text-xs font-black text-cyan-900">{hallazgo.prioridad}</span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_220px]">
                    <div>
                      <p className="text-sm font-bold text-slate-500">Descripción</p>
                      <p className="mt-2 leading-7">{hallazgo.descripcion}</p>
                      {hallazgo.recomendacion && (
                        <div className="mt-4 rounded-xl bg-cyan-50 p-4">
                          <p className="text-sm font-bold text-cyan-800">Recomendación técnica</p>
                          <p className="mt-2 leading-7">{hallazgo.recomendacion}</p>
                        </div>
                      )}
                    </div>
                    {hallazgo.evidencia ? (
                      <img src={hallazgo.evidencia} alt={hallazgo.evidenciaNombre || "Evidencia"} className="h-44 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="grid h-44 place-items-center rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-400">Sin evidencia fotográfica</div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="avoid-break mt-12 grid gap-8 border-t border-slate-300 pt-10 sm:grid-cols-2">
          <Firma titulo="Inspector responsable" nombre={inspeccion.inspector} />
          <Firma titulo="Cliente o receptor" nombre={inspeccion.cliente} />
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          <p className="font-bold">Certeza Habitacional · Método Certeza®</p>
          <p className="mt-1">Documento generado desde el expediente digital {inspeccion.folio}.</p>
        </footer>
      </article>
    </main>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{titulo}</p>
      <p className="mt-2 font-bold">{valor}</p>
    </div>
  );
}

function Mini({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3">
      <p className="text-xs text-slate-300">{titulo}</p>
      <p className="mt-1 text-2xl font-black">{valor}</p>
    </div>
  );
}

function Firma({ titulo, nombre }: { titulo: string; nombre: string }) {
  return (
    <div className="pt-16 text-center">
      <div className="border-t border-slate-500 pt-3">
        <p className="font-black">{nombre}</p>
        <p className="mt-1 text-sm text-slate-500">{titulo}</p>
      </div>
    </div>
  );
}
