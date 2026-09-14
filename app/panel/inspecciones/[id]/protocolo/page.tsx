import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { actualizarPasoProtocolo, inicializarProtocoloV1 } from "./actions";

type Paso = {
  id: string;
  clave: string;
  nombre: string;
  tipo: string;
  orden: number;
  obligatorio: boolean;
  estado: string;
  unidad: string | null;
  comentario: string | null;
};

export default async function ProtocoloPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true, inspector: { select: { id: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      folio: true,
      estado: true,
      numeroInspeccion: true,
      inspectorId: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
    },
  });
  if (!inspeccion) notFound();

  const numeroInspeccion = inspeccion.numeroInspeccion ?? 1;
  if (numeroInspeccion > 1) redirect(`/panel/inspecciones/${id}/captura`);

  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const puedeConsultar = usuario.rol === RolUsuario.DIRECTOR || usuario.rol === RolUsuario.GERENTE || usuario.rol === RolUsuario.COORDINADOR;
  if (!esInspector && !puedeConsultar) redirect("/acceso");

  const pasos = await prisma.$queryRaw<Paso[]>`
    SELECT "id","clave","nombre","tipo","orden","obligatorio","estado","unidad","comentario"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${id}
    ORDER BY "orden" ASC
  `;

  const siguiente = pasos.find((paso) => paso.obligatorio && paso.estado !== "COMPLETADO" && paso.estado !== "NO_APLICA");
  const puedeCapturar = esInspector && inspeccion.estado === EstadoInspeccion.EN_PROCESO;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href={`/panel/inspecciones/${id}/flujo`} className="text-sm font-black text-cyan-300">← Flujo de campo</Link>
        <p className="mt-7 text-xs font-black uppercase tracking-[.22em] text-amber-300">Protocolo secuencial Método Certeza</p>
        <h1 className="mt-2 text-4xl font-black">{inspeccion.folio}</h1>
        <p className="mt-2 text-slate-400">{inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"}</p>

        {query.error ? <p className="mt-5 rounded-2xl bg-rose-400/10 p-4 text-rose-300">{query.error}</p> : null}
        {query.ok ? <p className="mt-5 rounded-2xl bg-emerald-400/10 p-4 text-emerald-300">{query.ok}</p> : null}

        {pasos.length === 0 ? (
          <section className="mt-7 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-xl font-black">Preparar protocolo V1</h2>
            <p className="mt-2 text-sm text-slate-300">Fachada, apertura de pruebas, recorrido, cierre de pruebas y comprobación final.</p>
            {puedeCapturar ? (
              <form action={inicializarProtocoloV1} className="mt-5">
                <input type="hidden" name="inspeccionId" value={id} />
                <button className="rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950">Preparar protocolo</button>
              </form>
            ) : null}
          </section>
        ) : (
          <div className="mt-7 space-y-4">
            {pasos.map((paso, index) => {
              const terminado = paso.estado === "COMPLETADO" || paso.estado === "NO_APLICA";
              const activo = siguiente?.id === paso.id;
              const lecturaRequerida = paso.tipo === "PRUEBA_INICIAL" || paso.tipo === "PRUEBA_FINAL";
              const esGas = paso.clave.indexOf("GAS_") === 0;

              return (
                <article key={paso.id} className="rounded-3xl border border-white/10 bg-slate-900 p-5">
                  <p className="text-xs font-black text-slate-500">PASO {index + 1} · {paso.estado}</p>
                  <h2 className="mt-2 text-lg font-black">{paso.nombre}</h2>
                  {paso.comentario ? <p className="mt-2 text-sm text-slate-400">{paso.comentario}</p> : null}

                  {activo && puedeCapturar ? (
                    <form action={actualizarPasoProtocolo} className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950 p-4">
                      <input type="hidden" name="inspeccionId" value={id} />
                      <input type="hidden" name="pasoId" value={paso.id} />
                      {lecturaRequerida ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input name="lectura" type="number" step="any" required placeholder="Lectura" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3" />
                          <select name="unidad" defaultValue={esGas ? "psi" : "kg/cm²"} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3">
                            <option value="kg/cm²">kg/cm²</option>
                            <option value="psi">psi</option>
                          </select>
                        </div>
                      ) : null}
                      <textarea name="comentario" rows={2} placeholder="Comentario opcional" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3" />
                      <button name="accion" value={paso.tipo === "PRUEBA_INICIAL" ? "INICIAR" : "COMPLETAR"} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">
                        {paso.tipo === "PRUEBA_INICIAL" ? "Abrir prueba y registrar lectura" : "Completar paso"}
                      </button>
                      {esGas ? <button name="accion" value="NO_APLICA" formNoValidate className="w-full rounded-xl border border-white/15 px-4 py-3 font-black text-slate-300">Marcar no aplica</button> : null}
                    </form>
                  ) : null}

                  {terminado ? <p className="mt-3 text-xs font-black text-emerald-300">COMPLETO</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
