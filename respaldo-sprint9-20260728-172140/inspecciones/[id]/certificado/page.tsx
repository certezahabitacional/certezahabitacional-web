"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Inspeccion = {
  id: string;
  folio: string;
  cliente: string;
  tipoServicio: string;
  tipoInmueble: string;
  direccion: string;
  ciudad: string;
  fecha: string;
  inspector: string;
};

type Hallazgo = { clasificacion: "C" | "O" | "NC" | "CR" | "NA" };
type Firmas = { inspector: string; cliente: string };

function calcularISH(hallazgos: Hallazgo[]) {
  const evaluables = hallazgos.filter((h) => h.clasificacion !== "NA");
  if (!evaluables.length) return 100;
  const valores = { C: 100, O: 80, NC: 50, CR: 0 } as const;
  return Math.round(evaluables.reduce((suma, h) => suma + (h.clasificacion === "NA" ? 0 : valores[h.clasificacion]), 0) / evaluables.length);
}

function dictamen(ish: number, criticos: number) {
  if (criticos > 0 || ish < 70) return { titulo: "CONDICIÓN PRIORITARIA", texto: "El inmueble presenta condiciones que requieren atención técnica prioritaria antes de emitir una certificación favorable.", clase: "text-rose-700 border-rose-300 bg-rose-50" };
  if (ish < 85) return { titulo: "CONDICIÓN CON OBSERVACIONES", texto: "El inmueble presenta una condición funcional con observaciones y acciones recomendadas de seguimiento.", clase: "text-amber-800 border-amber-300 bg-amber-50" };
  return { titulo: "CONDICIÓN FAVORABLE", texto: "Con base en la inspección visual y los hallazgos registrados, el inmueble presenta una condición habitacional favorable.", clase: "text-emerald-800 border-emerald-300 bg-emerald-50" };
}

export default function CertificadoPage() {
  const params = useParams();
  const inspeccionId = String(params.id);
  const [inspeccion, setInspeccion] = useState<Inspeccion | null>(null);
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [firmas, setFirmas] = useState<Firmas>({ inspector: "", cliente: "" });

  useEffect(() => {
    const registros = localStorage.getItem("certeza-habitacional-inspecciones");
    if (registros) {
      const lista = JSON.parse(registros) as Inspeccion[];
      setInspeccion(lista.find((item) => item.id === inspeccionId) ?? null);
    }
    const hallazgosGuardados = localStorage.getItem(`certeza-hallazgos-${inspeccionId}`);
    if (hallazgosGuardados) setHallazgos(JSON.parse(hallazgosGuardados) as Hallazgo[]);
    const firmasGuardadas = localStorage.getItem(`certeza-firmas-${inspeccionId}`);
    if (firmasGuardadas) setFirmas(JSON.parse(firmasGuardadas) as Firmas);
  }, [inspeccionId]);

  const ish = useMemo(() => calcularISH(hallazgos), [hallazgos]);
  const criticos = hallazgos.filter((h) => h.clasificacion === "CR").length;
  const resultado = dictamen(ish, criticos);
  const codigo = inspeccion ? `CEH-${inspeccion.folio.replaceAll("-", "")}` : "";

  if (!inspeccion) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Expediente no encontrado.</main>;

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-4 print:hidden">
        <Link href={`/panel/inspecciones/${inspeccionId}`} className="rounded-full bg-slate-950 px-6 py-3 font-bold text-white">← Regresar</Link>
        <button onClick={() => window.print()} className="rounded-full bg-cyan-500 px-7 py-3 font-black text-slate-950">Imprimir o guardar PDF</button>
      </div>

      <article className="mx-auto min-h-[1120px] max-w-5xl bg-white p-10 text-slate-900 shadow-2xl print:min-h-0 print:max-w-none print:shadow-none sm:p-16">
        <header className="border-b-4 border-cyan-500 pb-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-700">Certeza Habitacional</p>
              <h1 className="mt-3 text-4xl font-black">Certificado de Estado Habitacional</h1>
              <p className="mt-3 text-slate-500">Método Certeza® · CH-F-014</p>
            </div>
            <div className="rounded-2xl bg-slate-950 px-6 py-5 text-white">
              <p className="text-xs uppercase tracking-widest text-slate-400">Código de validación</p>
              <p className="mt-2 font-black">{codigo}</p>
            </div>
          </div>
        </header>

        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          <Dato titulo="Folio de inspección" valor={inspeccion.folio} />
          <Dato titulo="Fecha de inspección" valor={inspeccion.fecha} />
          <Dato titulo="Titular / cliente" valor={inspeccion.cliente} />
          <Dato titulo="Inspector responsable" valor={inspeccion.inspector} />
          <Dato titulo="Tipo de inmueble" valor={inspeccion.tipoInmueble} />
          <Dato titulo="Servicio" valor={inspeccion.tipoServicio} />
          <div className="sm:col-span-2"><Dato titulo="Ubicación" valor={`${inspeccion.direccion}, ${inspeccion.ciudad}`} /></div>
        </section>

        <section className="mt-10 grid gap-6 sm:grid-cols-[240px_1fr]">
          <div className="rounded-3xl bg-cyan-500 p-8 text-center text-slate-950">
            <p className="text-sm font-black uppercase tracking-widest">ISH</p>
            <p className="mt-3 text-7xl font-black">{ish}</p>
            <p className="mt-2 text-sm font-bold">de 100 puntos</p>
          </div>
          <div className={`rounded-3xl border-2 p-8 ${resultado.clase}`}>
            <p className="text-sm font-black uppercase tracking-widest">Dictamen</p>
            <h2 className="mt-3 text-3xl font-black">{resultado.titulo}</h2>
            <p className="mt-4 leading-7">{resultado.texto}</p>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200 p-8">
          <h2 className="text-xl font-black">Alcance del certificado</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Este documento resume el estado observado del inmueble durante una inspección visual no destructiva. No sustituye estudios estructurales, peritajes especializados, pruebas de laboratorio ni garantías de funcionamiento futuro.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Resumen titulo="Hallazgos registrados" valor={hallazgos.length} />
            <Resumen titulo="Condiciones críticas" valor={criticos} />
            <Resumen titulo="Firmas capturadas" valor={(firmas.inspector ? 1 : 0) + (firmas.cliente ? 1 : 0)} />
          </div>
        </section>

        <section className="mt-16 grid gap-12 sm:grid-cols-2">
          <Firma titulo={inspeccion.inspector} subtitulo="Inspector responsable" imagen={firmas.inspector} />
          <Firma titulo={inspeccion.cliente} subtitulo="Cliente / receptor" imagen={firmas.cliente} />
        </section>

        <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-xs leading-6 text-slate-500">
          Certificado generado por Certeza Habitacional. La validez digital definitiva requerirá almacenamiento central, sello de tiempo y consulta en línea del código de validación.
        </footer>
      </article>
    </main>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-widest text-slate-500">{titulo}</p><p className="mt-2 font-bold">{valor || "No registrado"}</p></div>;
}

function Resumen({ titulo, valor }: { titulo: string; valor: number }) {
  return <div className="rounded-2xl bg-slate-100 p-5 text-center"><p className="text-3xl font-black">{valor}</p><p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500">{titulo}</p></div>;
}

function Firma({ titulo, subtitulo, imagen }: { titulo: string; subtitulo: string; imagen: string }) {
  return <div className="text-center">{imagen ? <img src={imagen} alt={`Firma de ${titulo}`} className="mx-auto h-28 max-w-full object-contain" /> : <div className="h-28" />}<div className="border-t border-slate-500 pt-3"><p className="font-black">{titulo}</p><p className="text-sm text-slate-500">{subtitulo}</p></div></div>;
}
