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
import { obtenerSupabaseAdminOpcional } from "@/lib/supabase-admin";
import CapturaCamara from "./CapturaCamara";
import CargaGaleriaConPreview from "./CargaGaleriaConPreview";
import BotonGenerarIa from "./BotonGenerarIa";
import RestaurarFocoConcepto from "./RestaurarFocoConcepto";
import {
  cerrarPuntoCriticoV1,
  cerrarPruebaProlongadaV1,
  configurarPuntoCriticoV1,
  eliminarFotoPuntoCriticoV1,
  generarDescripcionIaPuntoCriticoV1,
  generarInterpretacionIaPruebaProlongadaV1,
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
  ruta: string;
  descripcionArchivo: string | null;
  urlTemporal: string | null;
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
  prioridadFinal?: string;
  lecturaFinalPropuesta?: string;
  unidadFinalPropuesta?: string;
  variacionPresion?: string;
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

async function urlTemporalFoto(ruta: string) {
  const sb = obtenerSupabaseAdminOpcional();
  if (!sb) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(ruta, 60 * 30);
  return error ? null : data.signedUrl;
}

export default async function PuntosCriticosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ punto?: string; ok?: string; error?: string; foco?: string }>;
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

  const pendientesNoPruebaRows = await prisma.$queryRaw<Array<{ codigo: string; pendientes: number }>>`
    SELECT replace("area",'__PUNTO_CRITICO__:','') AS "codigo",
           COUNT(*) FILTER (
             WHERE "estadoV3"='PENDIENTE'
               AND "concepto" NOT ILIKE '%manómetro%'
               AND "concepto" NOT ILIKE '%lectura final%'
           )::int AS "pendientes"
    FROM "GuiaInspeccionItem"
    WHERE "inspeccionId"=${id} AND "area" LIKE '__PUNTO_CRITICO__:%'
    GROUP BY "area"
  `;
  const pendientesNoPrueba = new Map(
    pendientesNoPruebaRows.map((fila) => [fila.codigo, Number(fila.pendientes)]),
  );

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
        Boolean(pasoAnterior.lecturaInicial) &&
        Number(pendientesNoPrueba.get(anterior.codigo) ?? 0) === 0
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

  const itemManometroInicial = items.find((item) => /manómetro/i.test(item.concepto));
  const itemLecturaFinal = items.find((item) => /lectura final/i.test(item.concepto));
  const observacionPrueba = itemLecturaFinal ? observacionItem(itemLecturaFinal.observacion) : {};
  const idsPrueba = new Set(
    [itemManometroInicial?.id, itemLecturaFinal?.id].filter((valor): valor is string => Boolean(valor)),
  );
  const itemsNormales = items.filter((item) => !idsPrueba.has(item.id));

  const fotosBase = items.length
    ? await prisma.$queryRaw<Array<Omit<Foto, "urlTemporal">>>`
        SELECT fa."fotografiaId",fa."guiaItemId",fa."orden",f."url" AS "ruta",f."descripcion" AS "descripcionArchivo"
        FROM "FotografiaArea" fa
        JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
        WHERE fa."guiaItemId"=ANY(${items.map((item) => item.id)}::text[])
        ORDER BY fa."guiaItemId",fa."orden"
      `
    : [];

  const fotos: Foto[] = await Promise.all(
    fotosBase.map(async (foto) => ({
      ...foto,
      urlTemporal: await urlTemporalFoto(foto.ruta),
    })),
  );

  const completadosNormales = itemsNormales.filter((item) => item.estadoV3 !== "PENDIENTE").length;
  const pruebaCompleta = Boolean(
    itemManometroInicial &&
    itemLecturaFinal &&
    paso.lecturaInicial &&
    paso.lecturaFinal &&
    itemManometroInicial.estadoV3 !== "PENDIENTE" &&
    itemLecturaFinal.estadoV3 !== "PENDIENTE"
  );
  const totalVisual = itemsNormales.length + (datos.pruebaProlongada && itemManometroInicial && itemLecturaFinal ? 1 : 0);
  const completadosVisual = completadosNormales + (pruebaCompleta ? 1 : 0);
  const porcentaje = totalVisual ? Math.round((completadosVisual / totalVisual) * 100) : paso.estado === "NO_APLICA" ? 100 : 0;
  const equipoAplicable = herramientasAplicablesPuntoCritico(punto, herramientasCotizadas);
  const otrosConceptosCompletos = itemsNormales.every((item) => item.estadoV3 !== "PENDIENTE");
  const indicePunto = PUNTOS_CRITICOS_V1.findIndex((item) => item.codigo === codigoSolicitado);
  const siguientePunto = PUNTOS_CRITICOS_V1[indicePunto + 1];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-7 text-white">
      <RestaurarFocoConcepto itemId={query.foco} />
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

        {datos.configurado && datos.aplica && datos.pruebaProlongada && itemManometroInicial && itemLecturaFinal && (
          <section id="prueba-manometro-inicio" className="scroll-mt-24 mt-7 rounded-3xl border border-amber-300/30 bg-amber-300/5 p-6">
            {(() => {
              const fotoInicial = fotos.find((foto) => foto.guiaItemId === itemManometroInicial.id);
              const fotoFinal = fotos.find((foto) => foto.guiaItemId === itemLecturaFinal.id);
              return (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-amber-200">
                        Plantilla especial · única que puede permanecer abierta
                      </p>
                      <h2 className="mt-1 text-2xl font-black">Prueba de hermeticidad con manómetro</h2>
                      <p className="mt-2 max-w-3xl text-sm text-slate-300">
                        En esta misma plantilla se documentan el inicio de carga y la lectura al terminar la inspección.
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-2 text-xs font-black ${paso.lecturaFinal ? "bg-emerald-300/10 text-emerald-200" : paso.lecturaInicial ? "bg-amber-300/10 text-amber-200" : "bg-white/5 text-slate-400"}`}>
                      {paso.lecturaFinal ? "CERRADA" : paso.lecturaInicial ? "ABIERTA · EN PRUEBA" : "PENDIENTE DE INICIO"}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <article className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                      <p className="text-xs font-black uppercase text-cyan-200">1 · Inicio de carga</p>
                      <p className="mt-2 text-sm text-slate-400">Toma o carga una foto del manómetro y registra la lectura inicial.</p>

                      {fotoInicial?.urlTemporal ? (
                        <a href={fotoInicial.urlTemporal} target="_blank" rel="noreferrer" className="mt-3 block bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fotoInicial.urlTemporal} alt="Lectura inicial del manómetro" className="h-64 w-full object-contain" />
                        </a>
                      ) : puedeCapturar ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <CapturaCamara
                            inspeccionId={id}
                            codigo={codigoSolicitado}
                            itemId={itemManometroInicial.id}
                            numeroFoto={1}
                            totalFotos={1}
                            subirFoto={subirFotoPuntoCriticoV1}
                          />
                          <CargaGaleriaConPreview
                            inspeccionId={id}
                            codigo={codigoSolicitado}
                            itemId={itemManometroInicial.id}
                            numeroFoto={1}
                            totalFotos={1}
                            subirFoto={subirFotoPuntoCriticoV1}
                          />
                        </div>
                      ) : null}

                      {fotoInicial && !paso.lecturaInicial && puedeCapturar && (
                        <form action={registrarInicioPruebaProlongadaV1} className="mt-4">
                          <input type="hidden" name="inspeccionId" value={id} />
                          <input type="hidden" name="codigo" value={codigoSolicitado} />
                          <input type="hidden" name="itemId" value={itemManometroInicial.id} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-bold text-slate-400">
                              Lectura inicial
                              <input name="lecturaInicial" required className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                            </label>
                            <label className="text-xs font-bold text-slate-400">
                              Unidad
                              <input name="unidad" required placeholder="psi, kPa, bar..." className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                            </label>
                          </div>
                          <button className="mt-3 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950">
                            INICIAR PRUEBA
                          </button>
                        </form>
                      )}

                      {paso.lecturaInicial && (
                        <p className="mt-4 rounded-xl bg-emerald-300/10 p-3 text-sm font-black text-emerald-200">
                          Lectura inicial: {paso.lecturaInicial} {paso.unidad ?? ""}
                        </p>
                      )}
                    </article>

                    <article className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                      <p className="text-xs font-black uppercase text-violet-200">2 · Al terminar la inspección</p>
                      <p className="mt-2 text-sm text-slate-400">
                        Regresa a esta misma plantilla, toma o carga la foto final y registra la lectura final.
                      </p>

                      {!paso.lecturaInicial ? (
                        <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-slate-500">Primero inicia la prueba.</p>
                      ) : fotoFinal?.urlTemporal ? (
                        <a href={fotoFinal.urlTemporal} target="_blank" rel="noreferrer" className="mt-3 block bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fotoFinal.urlTemporal} alt="Lectura final del manómetro" className="h-64 w-full object-contain" />
                        </a>
                      ) : puedeCapturar ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <CapturaCamara
                            inspeccionId={id}
                            codigo={codigoSolicitado}
                            itemId={itemLecturaFinal.id}
                            numeroFoto={1}
                            totalFotos={1}
                            subirFoto={subirFotoPuntoCriticoV1}
                          />
                          <CargaGaleriaConPreview
                            inspeccionId={id}
                            codigo={codigoSolicitado}
                            itemId={itemLecturaFinal.id}
                            numeroFoto={1}
                            totalFotos={1}
                            subirFoto={subirFotoPuntoCriticoV1}
                          />
                        </div>
                      ) : null}

                      {fotoFinal && !paso.lecturaFinal && puedeCapturar && (
                        <div id="prueba-manometro" className="mt-4 space-y-4">
                          <form action={generarInterpretacionIaPruebaProlongadaV1} className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
                            <input type="hidden" name="inspeccionId" value={id} />
                            <input type="hidden" name="codigo" value={codigoSolicitado} />
                            <p className="text-xs font-black uppercase text-cyan-200">Interpretación IA de la prueba</p>
                            <p className="mt-2 text-xs text-cyan-50">
                              Captura la lectura final. La IA comparará lectura inicial, lectura final y ambas fotografías.
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="text-xs font-bold text-slate-400">
                                Lectura final
                                <input
                                  name="lecturaFinal"
                                  required
                                  defaultValue={observacionPrueba.lecturaFinalPropuesta ?? ""}
                                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                                />
                              </label>
                              <label className="text-xs font-bold text-slate-400">
                                Unidad
                                <input
                                  name="unidad"
                                  required
                                  defaultValue={observacionPrueba.unidadFinalPropuesta ?? paso.unidad ?? ""}
                                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                                />
                              </label>
                            </div>
                            <div className="mt-3">
                              <BotonGenerarIa />
                            </div>
                          </form>

                          {observacionPrueba.descripcionIa && (
                            <div className="rounded-xl border border-cyan-300/20 bg-slate-950 p-4">
                              <p className="text-xs font-black uppercase text-cyan-200">Comparativo de presión e interpretación sugerida por IA</p>
                              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                                <div className="rounded-lg bg-white/5 p-3">
                                  <span className="block text-slate-500">Lectura inicial</span>
                                  <strong className="mt-1 block text-white">{paso.lecturaInicial} {paso.unidad ?? ""}</strong>
                                </div>
                                <div className="rounded-lg bg-white/5 p-3">
                                  <span className="block text-slate-500">Lectura final</span>
                                  <strong className="mt-1 block text-white">{observacionPrueba.lecturaFinalPropuesta} {observacionPrueba.unidadFinalPropuesta ?? ""}</strong>
                                </div>
                                <div className="rounded-lg bg-white/5 p-3">
                                  <span className="block text-slate-500">Variación calculada</span>
                                  <strong className="mt-1 block text-amber-200">{observacionPrueba.variacionPresion ?? "No calculable"}</strong>
                                </div>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-cyan-50">{observacionPrueba.descripcionIa}</p>
                              {observacionPrueba.justificacionIa && (
                                <p className="mt-2 text-xs text-cyan-200/80">{observacionPrueba.justificacionIa}</p>
                              )}
                            </div>
                          )}

                          <form action={cerrarPruebaProlongadaV1} className="space-y-3 rounded-xl border border-violet-300/20 bg-violet-300/5 p-4">
                            <input type="hidden" name="inspeccionId" value={id} />
                            <input type="hidden" name="codigo" value={codigoSolicitado} />
                            <input type="hidden" name="lecturaFinal" value={observacionPrueba.lecturaFinalPropuesta ?? ""} />
                            <input type="hidden" name="unidad" value={observacionPrueba.unidadFinalPropuesta ?? paso.unidad ?? ""} />

                            <label className="block text-xs font-black uppercase text-slate-400">
                              Interpretación / comentario del inspector
                              <textarea
                                name="descripcionFinal"
                                required
                                defaultValue={observacionPrueba.descripcionFinal ?? observacionPrueba.descripcionIa ?? ""}
                                placeholder="Describe estabilidad o variación de presión y cualquier hallazgo observado."
                                className="mt-2 min-h-32 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                              />
                            </label>

                            <label className="block text-xs font-black uppercase text-slate-400">
                              Clasificación final
                              <select
                                name="clasificacion"
                                defaultValue={observacionPrueba.clasificacionFinal ?? observacionPrueba.clasificacionSugerida ?? "C"}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                              >
                                <option value="C">C · Conforme</option>
                                <option value="O">O · Observación</option>
                                <option value="NC">NC · No conformidad</option>
                                <option value="CR">CR · Crítico</option>
                                <option value="NA">NA · No aplica</option>
                              </select>
                            </label>

                            <label className="block text-xs font-black uppercase text-slate-400">
                              Nivel de prioridad
                              <select
                                name="prioridad"
                                defaultValue={observacionPrueba.prioridadFinal ?? "P3"}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                              >
                                <option value="P1">P1 · Atención inmediata / crítica</option>
                                <option value="P2">P2 · Muy alta</option>
                                <option value="P3">P3 · Alta / corregir</option>
                                <option value="P4">P4 · Media / observación</option>
                                <option value="P5">P5 · Baja / seguimiento</option>
                              </select>
                            </label>

                            <p className="text-[11px] leading-5 text-slate-400">
                              La interpretación de IA es una sugerencia. El comentario, clasificación y prioridad final los confirma el Inspector.
                            </p>

                            <button
                              disabled={!observacionPrueba.lecturaFinalPropuesta || !observacionPrueba.unidadFinalPropuesta}
                              className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              REGISTRAR LECTURA FINAL Y CERRAR PRUEBA
                            </button>
                          </form>
                        </div>
                      )}

                      {paso.lecturaFinal && (
                        <p className="mt-4 rounded-xl bg-emerald-300/10 p-3 text-sm font-black text-emerald-200">
                          Lectura final: {paso.lecturaFinal} {paso.unidad ?? ""} · PRUEBA CERRADA ✓
                        </p>
                      )}
                    </article>
                  </div>
                </>
              );
            })()}
          </section>
        )}

        {datos.configurado && datos.aplica && (
          <section className="mt-7 space-y-4">
            {itemsNormales.map((item, index) => {
              const obs = observacionItem(item.observacion);
              const fotosItem = fotos.filter((foto) => foto.guiaItemId === item.id);
              const origenGaleria = fotosItem.some((foto) => foto.descripcionArchivo?.includes("[ORIGEN:GALERIA]"));
              const requeridas = origenGaleria ? 1 : 4;
              const evidenciaCompleta = fotosItem.length === requeridas;
              const cerrado = item.estadoV3 !== "PENDIENTE";
              return (
                <article id={`item-${item.id}`} key={item.id} className={`scroll-mt-24 rounded-3xl border p-5 ${cerrado ? "border-emerald-300/20 bg-emerald-300/5" : "border-white/10 bg-slate-900"}`}>
                  <div className="grid gap-5 lg:grid-cols-[70px_1fr_340px]">
                    <div className="font-mono text-lg font-black text-cyan-300">{String(index + 1).padStart(2, "0")}</div>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black text-slate-400">{datos.fuente}</span>
                        {item.herramientaSugerida && <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-200">{item.herramientaSugerida}</span>}
                      </div>
                      <h3 className="mt-2 text-xl font-black">{item.concepto}</h3>
                      <p className="mt-2 text-sm text-slate-300">{item.especificacion}</p>
                      <p className={`mt-3 text-sm font-black ${evidenciaCompleta ? "text-emerald-300" : "text-amber-300"}`}>
                        📷 Evidencia obligatoria: {origenGaleria ? "1 foto de galería" : "4 fotos tomadas desde la aplicación"} · {fotosItem.length}/{requeridas}
                      </p>
                      {fotosItem.length > 0 && (
                        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                          {fotosItem.map((foto) => (
                            <article key={foto.fotografiaId} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                              {foto.urlTemporal ? (
                                <a
                                  href={foto.urlTemporal}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block bg-black"
                                  title={`Abrir foto ${foto.orden} en tamaño completo`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={foto.urlTemporal}
                                    alt={`Evidencia ${foto.orden} de ${item.concepto}`}
                                    className="h-72 w-full object-contain sm:h-80"
                                  />
                                </a>
                              ) : (
                                <div className="flex h-72 items-center justify-center bg-black px-5 text-center text-sm font-bold text-slate-500 sm:h-80">
                                  Vista previa no disponible
                                </div>
                              )}
                              <div className="p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-black text-emerald-300">📷 Foto {foto.orden}</span>
                                  {foto.urlTemporal && (
                                    <a
                                      href={foto.urlTemporal}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs font-black text-cyan-300 underline"
                                    >
                                      VER EN GRANDE
                                    </a>
                                  )}
                                </div>
                                {!cerrado && puedeCapturar && (
                                  <form action={eliminarFotoPuntoCriticoV1} className="mt-3">
                                    <input type="hidden" name="inspeccionId" value={id} />
                                    <input type="hidden" name="codigo" value={codigoSolicitado} />
                                    <input type="hidden" name="fotografiaId" value={foto.fotografiaId} />
                                    <button className="w-full rounded-xl border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-300">
                                      QUITAR / REPETIR ESTA FOTO
                                    </button>
                                  </form>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                      {obs.justificacionIa && (
                        <p className="mt-3 rounded-xl bg-cyan-300/5 p-3 text-xs text-cyan-100"><strong>IA:</strong> {obs.justificacionIa}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      {!cerrado && puedeCapturar && !evidenciaCompleta && (
                        <div className="rounded-2xl border border-cyan-300/20 bg-slate-950 p-4">
                          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                            {fotosItem.length === 0 ? "Elige una modalidad de evidencia" : `Agregar fotografía ${fotosItem.length + 1}/4`}
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {!origenGaleria && (
                              <CapturaCamara
                                inspeccionId={id}
                                codigo={codigoSolicitado}
                                itemId={item.id}
                                numeroFoto={fotosItem.length + 1}
                                totalFotos={4}
                                subirFoto={subirFotoPuntoCriticoV1}
                              />
                            )}

                            {fotosItem.length === 0 && (
                              <CargaGaleriaConPreview
                                inspeccionId={id}
                                codigo={codigoSolicitado}
                                itemId={item.id}
                                numeroFoto={1}
                                totalFotos={1}
                                subirFoto={subirFotoPuntoCriticoV1}
                              />
                            )}
                          </div>
                          <p className="mt-3 text-[11px] leading-5 text-slate-500">
                            Elige una sola modalidad por concepto: 4 fotografías si las tomas desde la aplicación, o 1 fotografía si la seleccionas de la galería.
                          </p>
                        </div>
                      )}

                      {!cerrado && puedeCapturar && evidenciaCompleta && !obs.descripcionIa && (
                        <form action={generarDescripcionIaPuntoCriticoV1}>
                          <input type="hidden" name="inspeccionId" value={id} />
                          <input type="hidden" name="codigo" value={codigoSolicitado} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <BotonGenerarIa />
                        </form>
                      )}

                      {!cerrado && puedeCapturar && evidenciaCompleta && (
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
                          {obs.descripcionIa ? (
                            <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3">
                              <p className="text-xs font-black uppercase text-cyan-200">Interpretación sugerida por IA</p>
                              <p className="mt-2 text-xs leading-5 text-cyan-50">{obs.descripcionIa}</p>
                              {obs.justificacionIa && <p className="mt-2 text-[11px] text-cyan-200/80">{obs.justificacionIa}</p>}
                            </div>
                          ) : (
                            <p className="mb-4 rounded-xl bg-white/5 p-3 text-xs text-slate-400">
                              La IA es opcional. El inspector puede capturar directamente su interpretación y cerrar el concepto.
                            </p>
                          )}
                          <label className="text-xs font-black uppercase text-slate-400">Interpretación / comentario del inspector</label>
                          <textarea
                            name="descripcionFinal"
                            required
                            defaultValue={obs.descripcionFinal ?? obs.descripcionIa ?? ""}
                            placeholder="Describe lo observado en la evidencia, condición encontrada y criterio técnico del inspector."
                            className="mt-2 min-h-32 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                          />
                          <label className="mt-3 block text-xs font-black uppercase text-slate-400">Clasificación final del Inspector</label>
                          <select name="clasificacion" defaultValue={obs.clasificacionFinal ?? obs.clasificacionSugerida ?? "C"} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2">
                            <option value="C">C · Conforme</option>
                            <option value="O">O · Observación</option>
                            <option value="NC">NC · No conformidad</option>
                            <option value="CR">CR · Crítico</option>
                            <option value="NA">NA · No aplica al concepto</option>
                          </select>

                          <label className="mt-3 block text-xs font-black uppercase text-slate-400">Nivel de prioridad del hallazgo</label>
                          <select name="prioridad" defaultValue={obs.prioridadFinal ?? "P3"} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2">
                            <option value="P1">P1 · Atención inmediata / crítica</option>
                            <option value="P2">P2 · Muy alta</option>
                            <option value="P3">P3 · Alta / corregir</option>
                            <option value="P4">P4 · Media / observación</option>
                            <option value="P5">P5 · Baja / seguimiento</option>
                          </select>
                          <p className="mt-2 text-[11px] text-slate-500">
                            La IA sólo puede sugerir la interpretación y clasificación; comentario, clasificación y prioridad final los confirma el Inspector.
                          </p>
                          <button className="mt-3 w-full rounded-xl bg-violet-300 px-3 py-2 text-sm font-black text-slate-950">CERRAR CONCEPTO</button>
                        </form>
                      )}

                      {cerrado && (
                        <div className="rounded-2xl bg-emerald-300/10 p-4 text-sm text-emerald-200">
                          <p className="font-black">CONCEPTO CERRADO ✓</p>
                          <p className="mt-2">Clasificación: <strong>{obs.clasificacionFinal ?? "registrada"}</strong></p>
                          {obs.prioridadFinal && <p className="mt-1">Prioridad: <strong>{obs.prioridadFinal}</strong></p>}
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

            {puedeCapturar && datos.pruebaProlongada && !paso.lecturaInicial && otrosConceptosCompletos && (
              <div className="rounded-3xl border border-amber-300/30 bg-amber-300/5 p-6">
                <p className="font-black text-amber-200">FALTA INICIAR LA PRUEBA DEL MANÓMETRO</p>
                <p className="mt-2 text-sm text-slate-300">
                  Los demás conceptos de {punto.etiqueta.toLowerCase()} ya están cerrados. Para continuar al siguiente punto crítico debes registrar la fotografía y la lectura inicial del manómetro. La lectura final se capturará al terminar la inspección.
                </p>
                <a
                  href="#prueba-manometro-inicio"
                  className="mt-4 inline-block rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950"
                >
                  IR A MEDICIÓN INICIAL DEL MANÓMETRO
                </a>
              </div>
            )}

            {puedeCapturar && datos.pruebaProlongada && paso.lecturaInicial && !paso.lecturaFinal && otrosConceptosCompletos && siguientePunto && (
              <div className="rounded-3xl border border-amber-300/25 bg-amber-300/5 p-6">
                <p className="font-black text-amber-200">PRUEBA CON MANÓMETRO ABIERTA</p>
                <p className="mt-2 text-sm text-slate-300">
                  Todos los demás conceptos de {punto.etiqueta.toLowerCase()} están cerrados. La prueba del manómetro es la única que permanece abierta.
                </p>
                <Link
                  href={`/panel/inspecciones/${id}/puntos-criticos?punto=${siguientePunto.codigo}`}
                  className="mt-4 inline-block rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950"
                >
                  CONTINUAR A {siguientePunto.etiqueta}
                </Link>
              </div>
            )}

            {puedeCapturar && !datos.pruebaProlongada && itemsNormales.length > 0 && (
              <form action={cerrarPuntoCriticoV1} className="rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-6">
                <input type="hidden" name="inspeccionId" value={id} />
                <input type="hidden" name="codigo" value={codigoSolicitado} />
                <p className="font-black text-emerald-200">CIERRE DEL PUNTO CRÍTICO</p>
                <p className="mt-2 text-sm text-slate-300">
                  Se habilita cuando todos los conceptos aplicables tienen evidencia completa, comentario técnico, clasificación y prioridad final.
                </p>
                <button disabled={completadosNormales !== itemsNormales.length} className="mt-4 rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">
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
