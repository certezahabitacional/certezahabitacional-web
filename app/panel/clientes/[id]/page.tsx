"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Cliente = { id: string; nombre: string; telefono: string; correo: string; ciudad: string; direccion: string; tipo: string; notas: string; creadoEn: string };
type Inspeccion = { id: string; folio: string; cliente: string; telefono: string; correo: string; tipoServicio: string; tipoInmueble: string; direccion: string; ciudad: string; fecha: string; estado: string };

export default function ClienteDetallePage() {
  const params = useParams();
  const id = String(params.id);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    try {
      const clientes = JSON.parse(localStorage.getItem("certeza-habitacional-clientes") || "[]") as Cliente[];
      const expedientes = JSON.parse(localStorage.getItem("certeza-habitacional-inspecciones") || "[]") as Inspeccion[];
      setCliente(clientes.find((item) => item.id === id) || null);
      setInspecciones(expedientes);
    } finally { setCargando(false); }
  }, [id]);

  const relacionados = useMemo(() => {
    if (!cliente) return [];
    const telefono = cliente.telefono.replace(/\D/g, "");
    return inspecciones.filter((item) => item.telefono?.replace(/\D/g, "") === telefono || (!!cliente.correo && item.correo?.toLowerCase() === cliente.correo.toLowerCase()) || item.cliente?.toLowerCase() === cliente.nombre.toLowerCase());
  }, [cliente, inspecciones]);

  if (cargando) return <main className="grid min-h-screen place-items-center bg-slate-950 text-cyan-300">Cargando cliente...</main>;
  if (!cliente) return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white"><div className="text-center"><h1 className="text-4xl font-black">Cliente no encontrado</h1><Link href="/panel/clientes" className="mt-7 inline-block rounded-full bg-cyan-400 px-6 py-4 font-black text-slate-950">Regresar</Link></div></main>;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10"><div className="mx-auto max-w-[1400px] px-6 py-6"><Link href="/panel/clientes" className="text-sm font-bold text-cyan-300">← Regresar a clientes</Link><h1 className="mt-3 text-4xl font-black">{cliente.nombre}</h1><p className="mt-2 text-slate-400">{cliente.tipo} · Cliente desde {new Date(cliente.creadoEn).toLocaleDateString("es-MX")}</p></div></header>
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <article className="rounded-3xl border border-white/10 bg-slate-900 p-7"><p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Información de contacto</p><div className="mt-7 grid gap-6 sm:grid-cols-2"><Dato titulo="Teléfono" valor={cliente.telefono} /><Dato titulo="Correo" valor={cliente.correo || "No registrado"} /><Dato titulo="Ciudad" valor={cliente.ciudad} /><Dato titulo="Dirección" valor={cliente.direccion || "No registrada"} /></div>{cliente.notas && <div className="mt-7 rounded-2xl bg-white/5 p-5"><p className="text-sm font-bold text-slate-400">Notas</p><p className="mt-2 leading-7 text-slate-200">{cliente.notas}</p></div>}</article>
          <aside className="rounded-3xl bg-cyan-300 p-7 text-slate-950"><p className="text-sm font-black uppercase tracking-[0.2em]">Actividad del cliente</p><p className="mt-6 text-7xl font-black">{relacionados.length}</p><p className="mt-2 font-bold">expediente(s) relacionados</p><Link href="/panel/inspecciones" className="mt-7 block rounded-full bg-slate-950 px-5 py-4 text-center font-black text-white">Nueva inspección</Link></aside>
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900"><div className="border-b border-white/10 p-6"><h2 className="text-2xl font-black">Historial de inspecciones</h2></div>{relacionados.length === 0 ? <div className="px-6 py-16 text-center text-slate-400">Este cliente todavía no tiene expedientes relacionados.</div> : <div className="divide-y divide-white/10">{relacionados.map((item) => <article key={item.id} className="grid gap-5 p-6 lg:grid-cols-[1fr_1.4fr_auto] lg:items-center"><div><p className="font-black text-cyan-300">{item.folio}</p><p className="mt-2 text-sm text-slate-400">{item.fecha}</p></div><div><p className="font-bold">{item.tipoServicio}</p><p className="mt-1 text-sm text-slate-500">{item.direccion}, {item.ciudad}</p></div><div className="flex flex-col gap-3"><span className="rounded-full bg-white/5 px-4 py-2 text-center text-xs font-black text-slate-300">{item.estado}</span><Link href={`/panel/inspecciones/${item.id}`} className="rounded-full bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950">Abrir expediente</Link></div></article>)}</div>}</section>
      </div>
    </main>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) { return <div><p className="text-sm font-bold text-slate-500">{titulo}</p><p className="mt-2 font-bold text-slate-200">{valor}</p></div>; }
