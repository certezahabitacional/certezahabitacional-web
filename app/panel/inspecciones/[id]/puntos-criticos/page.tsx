import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  HERRAMIENTAS_INSPECCION,
  obtenerHerramientasCotizadasDesdeCotizacion,
  type CodigoHerramienta,
} from "@/lib/herramientas-inspeccion";
import {
  PUNTOS_CRITICOS_V1,
  herramientasAplicablesPuntoCritico,
  type CodigoPuntoCriticoV1,
} from "@/lib/puntos-criticos-v1";
import { prisma } from "@/lib/prisma";
import CapturaCamara from "./CapturaCamara";
import {
  cerrarPuntoCriticoV1,
  configurarPuntoCriticoV1,
  eliminarFotoPuntoCriticoV1,
  generarDescripcionIaPuntoCriticoV1,
  guardarResultadoPuntoCriticoV1,
  iniciarPuntosCriticosV1,
  registrarInicioPruebaProlongadaV1,
  subirFotoPuntoCriticoV1,
} from "./actions";

type Paso = {
  clave: string;
  nombre: string;
  orden: number;
  estado: string;
  datos: unknown;
  lecturaInicial: string | null;
  lecturaFinal: string | null;
  unidad: string | null;
};

type Item = {
  id: string;
  concepto: string;
  especificacion: string | null;
  herramientaSugerida: string | null;
  estadoV3: string;
  observacion: string | null;
  requiereMedicion: boolean;
  requiereComparacionProyecto: boolean;
  valorMedido: string | null;
  valorProyecto: string | null;
  unidadMedida: string | null;
  fotos: number;
};

type Foto = {
  fotografiaId: string;
  guiaItemId: string;
  orden: number;
};

type DatosPaso = {
  configurado?: boolean;
  aplica?: boolean | null;
  fuente?: "PROYECTO" | "PLANTILLA" | null;
  proyectoDisponible?: boolean;
  pruebaProlongada?: boolean;
  herramientas?: CodigoHerramienta[];
};

type ObservacionItem = {
  descripcionIa?: string;
  clasificacionSugerida?: string;
  justificacionIa?: string;
  descripcionFinal?: string;
  clasificacionFinal?: string;
};

function esCodigo(valor: string): valor is CodigoPuntoCriticoV1 {
  return PUNTOS_CRITICOS_V1.some((item) => item.codigo === valor);
}

function datosPaso(valor: unknown): DatosPaso {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as DatosPaso)
    : {};
}

function observacionItem(valor: string | null): ObservacionItem {
  if (!valor) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ObservacionItem)
      : {};
  } catch {
    return { descripcionFinal: valor };
  }
}

function nombreHerramienta(codigo: CodigoHerramienta) {
  return HERRAMIENTAS_INSPECCION.find((item) => item.codigo === codigo)?.nombre ?? codigo;
}

export default async function PuntosCriticosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ punto?: string; ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
    }),
    prisma.inspeccion.findUnique({
      where: { id },
      select: {
        id: true,
        folio: true,
        numeroInspeccion: true,
        estado: true,
        inspectorId: true,
        cliente: { select: { nombre: true } },
        inmueble: { select: { alias: true, direccion: true } },
        cotizacion: { select: { observacionesInternas: true } },
      },
    }),
  ]);
  if (!usuario?.activo) redirect("/acceso");
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}/captura`);

  const esInspector =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    usuario.inspector?.id === inspeccion.inspectorId;
  const esDirector = usuario.rol === RolUsuario.DIRECTOR;
  const consulta =
    usuario.rol === RolUsuario.GERENTE ||
    usuario.rol === RolUsuario.COORDINADOR;
  if (!esInspector && !esDirector && !consulta) redirect("/acceso");

  const [control] = await prisma.$queryRaw<Array<{ proyectoConfirmado: boolean }>>`
    SELECT "proyectoConfirmado" FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${id} LIMIT 1
  `;
  if (inspeccion.estado === EstadoInspeccion.EN_PROCESO && !control?.proyectoConfirmado) {
    redirect(`/panel/inspecciones/${id}/proyecto-v1`);
  }

  const pasos = await prisma.$queryRaw<Paso[]>`
    SELECT "clave","nombre","orden","estado","datos","lecturaInicial","lecturaFinal","unidad"
    FROM "ProtocoloInspeccionPaso"
    WHERE "inspeccionId"=${id} AND "tipo"='PUNTO_CRITICO'
    ORDER BY "orden"
  `;

  const puedeEntrarPunto = (codigo: CodigoPuntoCriticoV1) => {
    const indice = PUNTOS_CRITICOS_V1.findIndex((item) => item.codigo === codigo);
    for (const anterior of PUNTOS_CRITICOS_V1.slice(0, indice)) {
      const pasoAnterior = pasos.find((item) => item.clave === `PC_${anterior.codigo}`);
      if (!pasoAnterior) return false;
      if (pasoAnterior.estado === "COMPLETADO" || pasoAnterior.estado === "NO_APLICA") continue;
      const datosAnterior = datosPaso(pasoAnterior.datos);
      if (
        pasoAnterior.estado === "EN_PROCESO" &&
        datosAnterior.pruebaProlongada &&
        Boolean(pasoAnterior.lecturaInicial)
      ) {
        continue;
      }
      return false;
    }
    return true;
  };

  const herramientasCotizadas = obtenerHerramientasCotizadasDesdeCotizacion(
    inspeccion.cotizacion?.observacionesInternas,
  );

  if (pasos.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
        <div className="mx-auto max-w-5xl">
          <Link href={`/panel/inspecciones/${id}/proyecto-v1`} className="text-sm font-black text-cyan-300">
            ← Proyecto digital
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[.24em] text-amber-300">
            Etapa obligatoria V1
          </p>
          <h1 className="mt-2 text-4xl font-black">INICIO DE INSPECCIÓN DE PUNTOS CRÍTICOS</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            La secuencia inicia en Instalación Hidráulica y continúa de forma bloqueada hasta completar los siete puntos críticos.
          </p>
          <form action={iniciarPuntosCriticosV1} className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
            <input type="hidden" name="inspeccionId" value={id} />
            <button className="rounded-xl bg-cyan-300 px-6 py-3 font-black text-slate-950">
              INICIAR EN INSTALACIÓN HIDRÁULICA
            </button>
          </form>
        </div>
      </main>
    );
  }

  const codigoSolicitado = query.punto && esCodigo(query.punto) ? query.punto : "HIDRAULICA";
  if (!puedeEntrarPunto(codigoSolicitado)) {
    const primerPendiente = PUNTOS_CRITICOS_V1.find((item) => {
      const pasoItem = pasos.find((pasoActual) => pasoActual.clave === `PC_${item.codigo}`);
      return pasoItem && pasoItem.estado !== "COMPLETADO" && pasoItem.estado !== "NO_APLICA";
    });
    redirect(
      `/panel/inspecciones/${id}/puntos-criticos?punto=${primerPendiente?.codigo ?? "HIDRAULICA"}&error=${encodeURIComponent("Debes respetar la secuencia obligatoria de puntos críticos.")}`,
    );
  }
  const punto = PUNTOS_CRITICOS_V1.find((item) => item.codigo === codigoSolicitado)!;
  const paso = pasos.find((item) => item.clave === `PC_${codigoSolicitado}`);
  if (!paso) redirect(`/panel/inspecciones/${id}/puntos-criticos?punto=HIDRAULICA`);

  const datos = datosPaso(paso.datos);
  const puedeCapturar = (esInspector || esDirector) && inspeccion.estado === EstadoInspeccion.EN_PROCESO;

  const items = datos.configurado && datos.aplica
    ? await prisma.$queryRaw<Item[]>`
        SELECT g."id",g."concepto",g."especificacion",g."herramientaSugerida",g."estadoV3",g."observacion",
          g."requiereMedicion",g."requiereComparacionProyecto",g."valorMedido",g."valorProyecto",g."unidadMedida",
          (SELECT COUNT(*)::int FROM "FotografiaArea" fa WHERE fa."guiaItemId"=g."id") AS "fotos"
        FROM "GuiaInspeccionItem" g
        WHERE g."inspeccionId"=${id} AND g."area"=${`__PUNTO_CRITICO__:${codigoSolicitado}`}
        ORDER BY g."orden"
      `
    : [];

  const itemManometroInicial = items.find((item) =>
    /manómetro/i.test(item.concepto),
  );

  const fotos = items.length
    ? await prisma.$queryRaw<Foto[]>`
        SELECT fa."fotografiaId",fa."guiaItemId",fa."orden"
        FROM "FotografiaArea" fa
        WHERE fa."guiaItemId"=ANY(${items.map((item) => item.id)}::text[])
        ORDER BY fa."guiaItemId",fa."orden"
      `
    : [];

  const completados = items.filter((item) => item.estadoV3 !== "PENDIENTE").length;
  const porcentaje = items.length ? Math.round((completados / items.length) * 100) : paso.estado === "NO_APLICA" ? 100 : 0;
  const equipoAplicable = herramientasAplicablesPuntoCritico(punto, herramientasCotizadas);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-7 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/proyecto-v1`} className="text-sm font-black text-cyan-300">
            ← Proyecto digital
          </Link>
          <Link href={`/panel/inspecciones/${id}`} className="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-slate-300">
            Expediente
          </Link>
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[.24em] text-amber-300">
          INICIO DE INSPECCIÓN DE PUNTOS CRÍTICOS
        </p>
        <h1 className="mt-2 text-3xl font-black">{punto.etiqueta}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? inspeccion.inmueble?.direccion ?? "Inmueble"}
        </p>

        {(query.ok || query.error) && (
          <div className={`mt-5 rounded-2xl p-4 text-sm font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {query.error ?? query.ok}
          </div>
        )}

        <section className="mt-6 grid gap-2 md:grid-cols-7">
          {PUNTOS_CRITICOS_V1.map((item, index) => {
            const estado = pasos.find((p) => p.clave === `PC_${item.codigo}`)?.estado ?? "PENDIENTE";
            const activo = item.codigo === codigoSolicitado;
            const habilitado = puedeEntrarPunto(item.codigo);
            const contenido = (
              <>
                <span className="block text-[10px] text-slate-500">{index + 1}/7</span>
                <span className="mt-1 block">{item.etiqueta}</span>
                <span className="mt-2 block text-[10px]">
                  {habilitado ? estado.replaceAll("_", " ") : "BLOQUEADO"}
                </span>
              </>
            );
            const clases = `rounded-2xl border p-3 text-xs font-black ${activo
              ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200"
              : !habilitado
                ? "cursor-not-allowed border-white/5 bg-slate-950 text-slate-700"
                : estado === "COMPLETADO" || estado === "NO_APLICA"
                  ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-300"
                  : estado === "EN_PROCESO"
                    ? "border-amber-300/20 bg-amber-300/5 text-amber-200"
                    : "border-white/10 bg-slate-900 text-slate-500"}`;
            return habilitado ? (
              <Link
                key={item.codigo}
                href={`/panel/inspecciones/${id}/puntos-criticos?punto=${item.codigo}`}
                className={clases}
              >
                {contenido}
              </Link>
            ) : (
              <div key={item.codigo} className={clases} aria-disabled="true">
                {contenido}
              </div>
            );
          })}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-cyan-300">Punto crítico activo</p>
                <h2 className="mt-1 text-2xl font-black">{punto.etiqueta}</h2>
                <p className="mt-2 text-sm text-slate-300">{punto.descripcion}</p>
              </div>
              <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right">
                <p className="text-xs text-slate-500">Avance</p>
                <p className="text-2xl font-black text-cyan-300">{porcentaje}%</p>
              </div>
            </div>

            {datos.pruebaProlongada && (
              <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-100">
                <strong>Prueba prolongada con manómetro:</strong> inicia al arrancar este punto y puede permanecer abierta mientras continúas la inspección. Debe cerrarse con lectura final antes del cierre total.
                {paso.lecturaInicial && (
                  <p className="mt-2 text-xs font-bold text-emerald-200">
                    Prueba iniciada: {paso.lecturaInicial} {paso.unidad ?? ""}.
                    {paso.lecturaFinal ? <> Lectura final: {paso.lecturaFinal} {paso.unidad ?? ""}.</> : " Pendiente lectura final."}
                  </p>
                )}
              </div>
            )}

            {!datos.configurado && puedeCapturar && (
              <form action={configurarPuntoCriticoV1} className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-300/5 p-5">
                <input type="hidden" name="inspeccionId" value={id} />
                <input type="hidden" name="codigo" value={codigoSolicitado} />
                <h3 className="text-lg font-black">Definir alcance de este punto</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <fieldset>
                    <legend className="text-xs font-black uppercase text-slate-400">¿Aplica?</legend>
                    <div className="mt-2 flex gap-3">
                      <label className="rounded-xl border border-white/10 px-4 py-3"><input type="radio" name="aplica" value="SI" required /> <span className="ml-2 font-black">SI APLICA</span></label>
                      <label className="rounded-xl border border-white/10 px-4 py-3"><input type="radio" name="aplica" value="NO" required /> <span className="ml-2 font-black">NO APLICA</span></label>
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-xs font-black uppercase text-slate-400">Fuente de inspección</legend>
                    <div className="mt-2 grid gap-2">
                      <label className={`rounded-xl border px-4 py-3 ${datos.proyectoDisponible ? "border-white/10" : "border-white/5 opacity-40"}`}>
                        <input type="radio" name="fuente" value="PROYECTO" disabled={!datos.proyectoDisponible} required={datos.proyectoDisponible} /> <span className="ml-2 font-black">PROYECTO</span>
                      </label>
                      <label className="rounded-xl border border-white/10 px-4 py-3">
                        <input type="radio" name="fuente" value="PLANTILLA" defaultChecked={!datos.proyectoDisponible} required /> <span className="ml-2 font-black">PLANTILLA PRECARGADA</span>
                      </label>
                    </div>
                  </fieldset>
                </div>
                <button className="mt-5 rounded-xl bg-violet-300 px-5 py-3 font-black text-slate-950">CONFIRMAR E INICIAR</button>
              </form>
            )}

            {paso.estado === "NO_APLICA" && (
              <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 p-5 text-slate-400">
                Este punto fue declarado <strong>NO APLICA</strong>.
              </div>
            )}
          </article>

          <aside className="rounded-3xl border border-white/10 bg-slate-900 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-amber-300">Punto 4 de la cotización</p>
            <h3 className="mt-2 text-lg font-black">Equipo aplicable</h3>
            {equipoAplicable.length > 0 ? (
              <div className="mt-3 space-y-2">
                {equipoAplicable.map((codigo) => (
                  <div key={codigo} className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm font-bold">
                    {nombreHerramienta(codigo)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-amber-300/5 p-3 text-xs text-amber-200">
                Esta cotización no tiene equipo estructurado aplicable a este punto. La plantilla base permanece disponible; no se inventan instrumentos fuera del punto 4.
              </p>
            )}
            <p className="mt-4 text-xs text-slate-500">
              Fuente activa: <strong>{datos.fuente ?? "pendiente"}</strong>
            </p>
          </aside>
        </section>

        {datos.configurado && datos.aplica && datos.pruebaProlongada && !paso.lecturaInicial && itemManometroInicial && Number(itemManometroInicial.fotos) >= 1 && puedeCapturar && (
          <form action={registrarInicioPruebaProlongadaV1} className="mt-7 rounded-3xl border border-amber-300/25 bg-amber-300/5 p-6">
            <input type="hidden" name="inspeccionId" value={id} />
            <input type="hidden" name="codigo" value={codigoSolicitado} />
            <input type="hidden" name="itemId" value={itemManometroInicial.id} />
            <p className="text-xs font-black uppercase tracking-wider text-amber-200">Inicio de prueba prolongada</p>
            <p className="mt-2 text-sm text-slate-300">
              Ya existe evidencia fotográfica inicial. Registra la lectura del manómetro para habilitar la continuación temporal al siguiente punto crítico.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-400">
                Lectura inicial
                <input name="lecturaInicial" required className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <label className="text-xs font-bold text-slate-400">
                Unidad
                <input name="unidad" required placeholder="psi, kPa, bar..." className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
              </label>
            </div>
            <button className="mt-4 rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950">
              INICIAR PRUEBA Y HABILITAR CONTINUACIÓN
            </button>
          </form>
        )}

        {datos.configurado && datos.aplica && (
          <section className="mt-7 space-y-4">
            {items.map((item, index) => {
              const obs = observacionItem(item.observacion);
              const fotosItem = fotos.filter((foto) => foto.guiaItemId === item.id);
              const cerrado = item.estadoV3 !== "PENDIENTE";
              return (
                <article key={item.id} className={`rounded-3xl border p-5 ${cerrado ? "border-emerald-300/20 bg-emerald-300/5" : "border-white/10 bg-slate-900"}`}>
                  <div className="grid gap-5 lg:grid-cols-[70px_1fr_340px]">
                    <div className="font-mono text-lg font-black text-cyan-300">{String(index + 1).padStart(2, "0")}</div>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black text-slate-400">{datos.fuente}</span>
                        {item.herramientaSugerida && <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-200">{item.herramientaSugerida}</span>}
                      </div>
                      <h3 className="mt-2 text-xl font-black">{item.concepto}</h3>
                      <p className="mt-2 text-sm text-slate-300">{item.especificacion}</p>
                      <p className={`mt-3 text-sm font-black ${Number(item.fotos) === 4 ? "text-emerald-300" : "text-amber-300"}`}>
                        📷 Evidencia obligatoria: {item.fotos}/4 fotografías
                      </p>
                      {fotosItem.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {fotosItem.map((foto) => (
                            <form key={foto.fotografiaId} action={eliminarFotoPuntoCriticoV1} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs">
                              <input type="hidden" name="inspeccionId" value={id} />
                              <input type="hidden" name="codigo" value={codigoSolicitado} />
                              <input type="hidden" name="fotografiaId" value={foto.fotografiaId} />
                              <span className="font-black text-emerald-300">📷 Foto {foto.orden}</span>
                              {!cerrado && puedeCapturar && <button className="ml-3 text-rose-300">QUITAR</button>}
                            </form>
                          ))}
                        </div>
                      )}
                      {obs.justificacionIa && (
                        <p className="mt-3 rounded-xl bg-cyan-300/5 p-3 text-xs text-cyan-100"><strong>IA:</strong> {obs.justificacionIa}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      {!cerrado && puedeCapturar && Number(item.fotos) < 4 && (
                        <div className="rounded-2xl border border-cyan-300/20 bg-slate-950 p-4">
                          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                            Agregar fotografía {Number(item.fotos) + 1}/4
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <CapturaCamara
                              inspeccionId={id}
                              codigo={codigoSolicitado}
                              itemId={item.id}
                              numeroFoto={Number(item.fotos) + 1}
                              subirFoto={subirFotoPuntoCriticoV1}
                            />

                            <form action={subirFotoPuntoCriticoV1}>
                              <input type="hidden" name="inspeccionId" value={id} />
                              <input type="hidden" name="codigo" value={codigoSolicitado} />
                              <input type="hidden" name="itemId" value={item.id} />
                              <label className="block cursor-pointer rounded-xl border border-dashed border-violet-300/40 px-4 py-5 text-center font-black text-violet-200">
                                <span className="block text-2xl">🖼️</span>
                                <span className="mt-1 block">ELEGIR DE GALERÍA</span>
                                <span className="mt-1 block text-[10px] font-bold text-slate-500">Foto existente</span>
                                <input
                                  name="archivo"
                                  type="file"
                                  accept="image/*"
                                  required
                                  className="sr-only"
                                />
                              </label>
                              <button className="mt-2 w-full rounded-xl bg-violet-300 px-3 py-2 text-sm font-black text-slate-950">
                                GUARDAR DE GALERÍA
                              </button>
                            </form>
                          </div>
                          <p className="mt-3 text-[11px] leading-5 text-slate-500">
                            Puedes combinar fotografías tomadas en el momento con imágenes seleccionadas de la galería. El concepto requiere exactamente 4 evidencias antes del análisis con IA.
                          </p>
                        </div>
                      )}

                      {!cerrado && puedeCapturar && Number(item.fotos) === 4 && !obs.descripcionIa && (
                        <form action={generarDescripcionIaPuntoCriticoV1}>
                          <input type="hidden" name="inspeccionId" value={id} />
                          <input type="hidden" name="codigo" value={codigoSolicitado} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <button className="w-full rounded-xl border border-violet-300/30 px-4 py-3 text-sm font-black text-violet-200">
                            ✨ GENERAR DESCRIPCIÓN CON IA
                          </button>
                        </form>
                      )}

                      {!cerrado && puedeCapturar && Number(item.fotos) === 4 && obs.descripcionIa && (
                        <form action={guardarResultadoPuntoCriticoV1} className="rounded-2xl border border-violet-300/20 bg-violet-300/5 p-4">
                          <input type="hidden" name="inspeccionId" value={id} />
                          <input type="hidden" name="codigo" value={codigoSolicitado} />
                          <input type="hidden" name="itemId" value={item.id} />
                          {item.requiereMedicion && (
                            <div className="mb-4 rounded-xl border border-amber-300/20 bg-slate-950 p-3">
                              <p className="text-xs font-black uppercase text-amber-200">Medición obligatoria</p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <label className="text-xs font-bold text-slate-400">
                                  Valor medido
                                  <input name="valorMedido" required defaultValue={item.valorMedido ?? ""} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                                </label>
                                <label className="text-xs font-bold text-slate-400">
                                  Unidad
                                  <input name="unidadMedida" required defaultValue={item.unidadMedida ?? ""} placeholder="psi, V, %, cm/m..." className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                                </label>
                              </div>
                              {item.requiereComparacionProyecto && datos.fuente === "PROYECTO" && (
                                <label className="mt-3 block text-xs font-bold text-slate-400">
                                  Valor de proyecto
                                  <input name="valorProyecto" required defaultValue={item.valorProyecto ?? ""} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                                </label>
                              )}
                            </div>
                          )}
                          <label className="text-xs font-black uppercase text-slate-400">Descripción técnica</label>
                          <textarea name="descripcionFinal" required defaultValue={obs.descripcionFinal ?? obs.descripcionIa} className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
                          <label className="mt-3 block text-xs font-black uppercase text-slate-400">Clasificación final del Inspector</label>
                          <select name="clasificacion" defaultValue={obs.clasificacionFinal ?? obs.clasificacionSugerida ?? "C"} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2">
                            <option value="C">C · Conforme</option>
                            <option value="O">O · Observación</option>
                            <option value="NC">NC · No conformidad</option>
                            <option value="CR">CR · Crítico</option>
                            <option value="NA">NA · No aplica al concepto</option>
                          </select>
                          <p className="mt-2 text-[11px] text-slate-500">La IA sólo sugiere; la clasificación final la confirma el Inspector.</p>
                          <button className="mt-3 w-full rounded-xl bg-violet-300 px-3 py-2 text-sm font-black text-slate-950">CERRAR CONCEPTO</button>
                        </form>
                      )}

                      {cerrado && (
                        <div className="rounded-2xl bg-emerald-300/10 p-4 text-sm text-emerald-200">
                          <p className="font-black">CONCEPTO CERRADO ✓</p>
                          <p className="mt-2">Clasificación: <strong>{obs.clasificacionFinal ?? "registrada"}</strong></p>
                          {item.requiereMedicion && item.valorMedido && (
                            <p className="mt-2 text-xs">
                              Medición: <strong>{item.valorMedido} {item.unidadMedida ?? ""}</strong>
                              {item.valorProyecto ? <> · Proyecto: <strong>{item.valorProyecto} {item.unidadMedida ?? ""}</strong></> : null}
                            </p>
                          )}
                          {obs.descripcionFinal && <p className="mt-2 text-xs">{obs.descripcionFinal}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {puedeCapturar && items.length > 0 && (
              <form action={cerrarPuntoCriticoV1} className="rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-6">
                <input type="hidden" name="inspeccionId" value={id} />
                <input type="hidden" name="codigo" value={codigoSolicitado} />
                <p className="font-black text-emerald-200">CIERRE DEL PUNTO CRÍTICO</p>
                <p className="mt-2 text-sm text-slate-300">
                  Se habilita únicamente cuando todos los conceptos aplicables tienen 4 fotografías, descripción y clasificación final.
                </p>
                <button disabled={completados !== items.length} className="mt-4 rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">
                  CERRAR {punto.etiqueta} AL 100%
                </button>
              </form>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
