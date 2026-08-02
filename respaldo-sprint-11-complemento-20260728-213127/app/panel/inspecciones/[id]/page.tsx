import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cambiarEstado, crearHallazgo } from "./actions";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    include: {
      cliente: true,
      inmueble: true,
      inspector: { include: { usuario: true } },
      certificado: true,
      hallazgos: { orderBy: { creadoEn: "desc" } },
    },
  });

  if (!inspeccion) notFound();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/panel" className="text-sm font-bold text-cyan-300">
          ← Panel
        </Link>

        <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <p className="font-black text-cyan-300">{inspeccion.folio}</p>
            <h1 className="text-3xl font-black">
              {inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}
            </h1>
            <p className="mt-2 text-slate-400">
              {inspeccion.cliente.nombre} · {inspeccion.direccion}, {inspeccion.ciudad}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Inspector: {inspeccion.inspector?.usuario.nombre ?? "Sin asignar"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/panel/inspecciones/${inspeccion.id}/reporte`}
              className="rounded-full border border-white/15 px-5 py-3 text-center font-black hover:bg-white/5"
            >
              Ver reporte
            </Link>
            <Link
              href={`/panel/inspecciones/${inspeccion.id}/certificado`}
              className="rounded-full border border-cyan-300/40 px-5 py-3 text-center font-black text-cyan-300 hover:bg-cyan-300/10"
            >
              {inspeccion.certificado ? "Ver certificado" : "Emitir certificado"}
            </Link>
            <div className="rounded-3xl bg-cyan-300 px-7 py-5 text-slate-950">
              <p className="text-xs font-black uppercase tracking-widest">Índice</p>
              <p className="text-5xl font-black">
                {Math.round(Number(inspeccion.ish ?? 100))}
              </p>
              <p className="font-black">{inspeccion.semaforo ?? "SIN EVALUAR"}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[390px_1fr]">
          <section className="h-fit rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-2xl font-black">Registrar hallazgo</h2>
            <form action={crearHallazgo} className="mt-6 space-y-4">
              <input type="hidden" name="inspeccionId" value={inspeccion.id} />
              <Input name="area" label="Área *" placeholder="Instalación eléctrica" />
              <Input
                name="titulo"
                label="Título *"
                placeholder="Contacto sin tierra física"
              />
              <Input
                name="ubicacion"
                label="Ubicación"
                placeholder="Recámara principal"
              />

              <label className="block">
                <span className="mb-2 block text-sm font-bold">Descripción *</span>
                <textarea
                  required
                  name="descripcion"
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  name="clasificacion"
                  label="Clasificación"
                  options={[
                    ["C", "Conforme"],
                    ["O", "Observación"],
                    ["NC", "No conforme"],
                    ["CR", "Crítico"],
                    ["NA", "No aplica"],
                  ]}
                />
                <Select
                  name="prioridad"
                  label="Prioridad"
                  options={[
                    ["P1", "P1 Inmediata"],
                    ["P2", "P2 Alta"],
                    ["P3", "P3 Media"],
                    ["P4", "P4 Baja"],
                    ["P5", "P5 Informativa"],
                  ]}
                />
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold">Recomendación</span>
                <textarea
                  name="recomendacion"
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
                />
              </label>

              <Input name="costoEstimado" label="Costo estimado (MXN)" type="number" />
              <Input name="tiempoReparacion" label="Tiempo de reparación" />
              <Input name="responsable" label="Responsable sugerido" />

              <button className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950">
                Guardar hallazgo
              </button>
            </form>

            <form action={cambiarEstado} className="mt-6 border-t border-white/10 pt-6">
              <input type="hidden" name="id" value={inspeccion.id} />
              <Select
                name="estado"
                label="Estado del expediente"
                options={[
                  ["PROGRAMADA", "Programada"],
                  ["EN_PROCESO", "En proceso"],
                  ["REPORTE_PENDIENTE", "Reporte pendiente"],
                  ["FINALIZADA", "Finalizada"],
                  ["CANCELADA", "Cancelada"],
                ]}
              />
              <button className="mt-3 w-full rounded-full border border-white/15 px-5 py-3 font-bold">
                Actualizar estado
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
            <div className="border-b border-white/10 p-6">
              <h2 className="text-2xl font-black">
                Hallazgos ({inspeccion.hallazgos.length})
              </h2>
            </div>

            {inspeccion.hallazgos.length === 0 ? (
              <p className="p-14 text-center text-slate-400">
                Aún no se han capturado hallazgos.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {inspeccion.hallazgos.map((hallazgo) => (
                  <article key={hallazgo.id} className="p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          hallazgo.clasificacion === "CR"
                            ? "bg-rose-400/15 text-rose-300"
                            : hallazgo.clasificacion === "NC"
                              ? "bg-orange-400/15 text-orange-300"
                              : hallazgo.clasificacion === "O"
                                ? "bg-amber-400/15 text-amber-300"
                                : "bg-emerald-400/15 text-emerald-300"
                        }`}
                      >
                        {hallazgo.clasificacion}
                      </span>
                      <span className="text-xs font-black text-slate-400">
                        {hallazgo.prioridad}
                      </span>
                      <span className="text-xs text-slate-500">{hallazgo.area}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-black">{hallazgo.titulo}</h3>
                    <p className="mt-2 leading-7 text-slate-300">{hallazgo.descripcion}</p>
                    {hallazgo.recomendacion && (
                      <p className="mt-3 rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">
                        <b>Recomendación:</b> {hallazgo.recomendacion}
                      </p>
                    )}
                    {hallazgo.costoEstimado && (
                      <p className="mt-3 text-sm font-bold text-cyan-300">
                        Costo estimado:{" "}
                        {Number(hallazgo.costoEstimado).toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Input({
  name,
  label,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        required={label.includes("*")}
        name={name}
        type={type}
        placeholder={placeholder}
        step="any"
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[][];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        name={name}
        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
      >
        {options.map((option) => (
          <option key={option[0]} value={option[0]}>
            {option[1]}
          </option>
        ))}
      </select>
    </label>
  );
}
