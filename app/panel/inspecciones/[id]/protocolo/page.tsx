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
  lecturaInicial: number | null;
  lecturaFinal: number | null;
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
      id: true,
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
  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const rolesConsulta: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR];
  const consulta = rolesConsulta.includes(usuario.rol);
  if (!esInspector && !consulta) redirect("/acceso");

  if (numeroInspeccion > 1) {
    redirect(`/panel/inspecciones/${id}/captura`);
  }

  const pasos = await prisma.$queryRaw<Paso[]>`
    SELECT "id","clave","nombre","tipo","orden","obligatorio","estado",
           "lecturaInicial"::float8 AS "lecturaInicial",
           "lecturaFinal"::float8 AS "lecturaFinal",
           "unidad","comentario"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${id}
    ORDER BY "orden" ASC
  `;

  const siguiente = pasos.find((p) => p.obligatorio && !["COMPLETADO", "NO_APLICA"].includes(p.estado));
  const completos = pasos.filter((p) => ["COMPLETADO", "NO_APLICA"].includes(p.estado)).length;
  const avance = pasos.length ? Math.round((completos / pasos.length) * 100) : 0;
  const puedeCapturar = esInspector && inspeccion.estado === EstadoInspeccion.EN_PROCESO;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/flujo`} className="text-sm font-black text-cyan-300">← Flujo de campo</Link>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-400">V1 · VIVIENDA</span>
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[.22em] text-amber-300">Protocolo secuencial Método Certeza®</p>
        <h1 className="mt-2 text-4xl font-black">{inspeccion.folio}</h1>
        <p className="mt-2 text-slate-400">{inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"}</p>

        {(query.ok || query.error) && (
          <p className={`mt-5 rounded-2xl p-4 font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {query.error ?? query.ok}
          </p>
        )}

        {pasos.length === 0 ? (
          <section className="mt-7 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-xl font-black">Preparar protocolo V1</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              El sistema creará la secuencia obligatoria: fachada principal, apertura de prueba hidráulica, apertura de prueba de gas, recorrido por áreas, cierre hidráulico, cierre de gas y comprobación final.
            </p>
            {puedeCapturar && (
              <form action={inicializarProtocoloV1} className="mt-5">
                <input type="hidden" name="inspeccionId" value={id} />
                <button className="rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950">Preparar protocolo</button>
              </form>
            )}
          </section>
        ) : (
          <>
            <section className="mt-7 rounded-3xl border border-white/10 bg-slate-900 p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Avance del protocolo</p>
                  <p className="mt-2 text-2xl font-black">{completos}/{pasos.length} pasos</p>
                </div>
                <span className="text-3xl font-black text-cyan-300">{avance}%</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-cyan-300" style={{ width: `${avance}%` }} /></div>
              {siguiente ? (
                <p className="mt-4 text-sm text-amber-200"><strong>Siguiente paso:</strong> {siguiente.nombre}</p>
              ) : (
                <p className="mt-4 text-sm text-emerald-200">Protocolo secuencial completo. Continúa con el cierre del expediente.</p>
              )}
            </section>

            <div className="mt-6 space-y-4">
              {pasos.map((paso, index) => {
                const terminado = ["COMPLETADO", "NO_APLICA"].includes(paso.estado);
                const activo = siguiente?.id === paso.id;
                const lecturaRequerida = paso.tipo === "PRUEBA_INICIAL" || paso.tipo === "PRUEBA_FINAL";
                const esGas = paso.clave.startsWith("GAS_");

                return (
                  <article key={paso.id} className={`rounded-3xl border p-5 ${terminado ? "border-emerald-400/20 bg-emerald-400/5" : activo ? "border-amber-300/30 bg-amber-300/5" : "border-white/10 bg-slate-900"}`}>
                    <div className="grid gap-4 md:grid-cols-[55px_1fr_auto] md:items-start">
                      <span className={`grid h-11 w-11 place-items-center rounded-full font-black ${terminado ? "bg-emerald-300 text-slate-950" : activo ? "bg-amber-300 text-slate-950" : "bg-slate-800 text-slate-500"}`}>{terminado ? "✓" : index + 1}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black">{paso.nombre}</h2>
                          <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black text-slate-400">{paso.estado}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{paso.clave.replace(/_/g, " ")}</p>
                        {(paso.lecturaInicial !== null || paso.lecturaFinal !== null) && (
                          <p className="mt-3 text-sm text-slate-300">
                            {paso.lecturaInicial !== null ? `Inicial: ${paso.lecturaInicial}${paso.unidad ? ` ${paso.unidad}` : ""}` : ""}
                            {paso.lecturaInicial !== null && paso.lecturaFinal !== null ? " · " : ""}
                            {paso.lecturaFinal !== null ? `Final: ${paso.lecturaFinal}${paso.unidad ? ` ${paso.unidad}` : ""}` : ""}
                          </p>
                        )}
                        {paso.comentario && <p className="mt-2 text-sm text-slate-400">{paso.comentario}</p>}

                        {activo && puedeCapturar && (
                          <form action={actualizarPasoProtocolo} className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4 sm:grid-cols-2">
                            <input type="hidden" name="inspeccionId" value={id} />
                            <input type="hidden" name="pasoId" value={paso.id} />
                            {lecturaRequerida && (
                              <>
                                <label>
                                  <span className="mb-2 block text-xs font-black text-slate-400">Lectura {paso.tipo === "PRUEBA_INICIAL" ? "inicial" : "final"}</span>
                                  <input name="lectura" type="number" step="any" required className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3" />
                                </label>
                                <label>
                                  <span className="mb-2 block text-xs font-black text-slate-400">Unidad</span>
                                  <select name="unidad" defaultValue={esGas ? "psi" : "kg/cm²"} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3">
                                    <option value="kg/cm²">kg/cm²</option>
                                    <option value="psi">psi</option>
                                  </select>
                                </label>
                              </>
                            )}
                            <label className="sm:col-span-2">
                              <span className="mb-2 block text-xs font-black text-slate-400">Comentario</span>
                              <textarea name="comentario" rows={2} placeholder="Observación opcional" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3" />
                            </label>
                            <button name="accion" value={paso.tipo === "PRUEBA_INICIAL" ? "INICIAR" : "COMPLETAR"} className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 sm:col-span-2">
                              {paso.tipo === "PRUEBA_INICIAL" ? "Abrir prueba y registrar lectura" : "Completar paso"}
                            </button>
                            {paso.clave.includes("GAS") && (
                              <button name="accion" value="NO_APLICA" formNoValidate className="rounded-xl border border-white/15 px-4 py-3 font-black text-slate-300 sm:col-span-2">Marcar no aplica</button>
                            )}
                          </form>
                        )}
                      </div>
                      <span className={`text-xs font-black ${terminado ? "text-emerald-300" : activo ? "text-amber-300" : "text-slate-600"}`}>{terminado ? "COMPLETO" : activo ? "AHORA" : "BLOQUEADO"}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link href={`/panel/inspecciones/${id}/preparacion`} className="rounded-full border border-white/15 px-5 py-3 text-center font-black text-cyan-300">Preparación y áreas</Link>
              <Link href={`/panel/inspecciones/${id}/captura`} className="rounded-full border border-white/15 px-5 py-3 text-center font-black text-cyan-300">Hallazgos / seguimiento</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
