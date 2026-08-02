import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { crearHallazgo } from "../actions";

export default async function CapturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inspeccion = await prisma.inspeccion.findUnique({
  where: {
    id,
  },
  include: {
    cliente: {
      select: {
        nombre: true,
      },
    },
    inmueble: true,
    hallazgos: {
      orderBy: {
        creadoEn: "desc",
      },
    },
  },
});

  if (!inspeccion) notFound();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href={`/panel/inspecciones/${id}`} className="text-sm font-bold text-cyan-300">
          ← Volver al expediente
        </Link>
        <p className="mt-5 font-black text-cyan-300">{inspeccion.folio}</p>
        <h1 className="mt-2 text-3xl font-black">Captura Método Certeza®</h1>
        <p className="mt-2 text-slate-400">
          {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}
        </p>

        <section className="mt-7 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <h2 className="text-2xl font-black">Nuevo hallazgo</h2>
          <form action={crearHallazgo} className="mt-5 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="inspeccionId" value={id} />
            <Campo name="area" label="Área *" placeholder="Instalación eléctrica" />
            <Campo name="titulo" label="Título *" placeholder="Contacto sin tierra física" />
            <Campo name="ubicacion" label="Ubicación" placeholder="Recámara principal" />
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Clasificación</span>
              <select name="clasificacion" defaultValue="O" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                <option value="C">Conforme</option>
                <option value="O">Observación</option>
                <option value="NC">No conforme</option>
                <option value="CR">Crítico</option>
                <option value="NA">No aplica</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold">Descripción *</span>
              <textarea name="descripcion" required rows={4} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Prioridad</span>
              <select name="prioridad" defaultValue="P3" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                <option value="P1">P1 Inmediata</option>
                <option value="P2">P2 Alta</option>
                <option value="P3">P3 Media</option>
                <option value="P4">P4 Baja</option>
                <option value="P5">P5 Informativa</option>
              </select>
            </label>
            <Campo name="costoEstimado" label="Costo estimado (MXN)" type="number" />
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold">Recomendación</span>
              <textarea name="recomendacion" rows={3} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
            </label>
            <button className="md:col-span-2 rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">
              Guardar hallazgo
            </button>
          </form>
        </section>

        <section className="mt-7 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <h2 className="text-2xl font-black">Hallazgos capturados ({inspeccion.hallazgos.length})</h2>
          {inspeccion.hallazgos.length === 0 ? (
            <p className="mt-5 text-slate-400">Aún no hay hallazgos registrados.</p>
          ) : (
            <div className="mt-5 divide-y divide-white/10">
              {inspeccion.hallazgos.map((hallazgo) => (
                <article key={hallazgo.id} className="py-5 first:pt-0">
                  <div className="flex flex-wrap gap-3 text-xs font-black">
                    <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-300">{hallazgo.clasificacion}</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">{hallazgo.prioridad}</span>
                    <span className="px-1 py-1 text-slate-500">{hallazgo.area}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-black">{hallazgo.titulo}</h3>
                  <p className="mt-1 leading-6 text-slate-300">{hallazgo.descripcion}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Campo({ name, label, type = "text", placeholder }: { name: string; label: string; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input name={name} type={type} required={label.includes("*")} placeholder={placeholder} step="any" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
    </label>
  );
}
