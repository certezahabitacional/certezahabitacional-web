import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdminOpcional } from "@/lib/supabase-admin";
import BotonGenerarIa from "../puntos-criticos/BotonGenerarIa";
import CapturaConceptoArea from "./CapturaConceptoArea";
import GaleriaConceptoArea from "./GaleriaConceptoArea";
import { marcarPuntoNoAplicaV1 } from "./actions";
import {
  eliminarFotoConceptoAreaV1,
  generarDescripcionIaConceptoAreaV1,
  guardarResultadoConceptoAreaV1,
  reabrirConceptoAreaV1,
  reactivarConceptoAreaV1,
  subirFotoConceptoAreaV1,
} from "./conceptos-actions";

export type PuntoArea = {
  id: string;
  concepto: string;
  especificacion: string | null;
  grupo: string | null;
  estadoV3: string;
  origenV3: string;
  obligatorio: boolean;
  herramientaSugerida: string | null;
  motivoNoAplica: string | null;
  observacion: string | null;
  requiereMedicion: boolean;
  requiereComparacionProyecto: boolean;
  valorMedido: string | null;
  valorProyecto: string | null;
  unidadMedida: string | null;
};

type Observacion = {
  descripcionIa?: string;
  clasificacionSugerida?: string;
  justificacionIa?: string;
  descripcionFinal?: string;
  clasificacionFinal?: string;
  prioridadFinal?: string;
  calificacionFinal?: number;
  justificacionCalificacionIa?: string;
  prioridadEvaluadaIa?: string;
};

function observacion(valor: string | null): Observacion {
  if (!valor) return {};
  try {
    const p = JSON.parse(valor);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Observacion) : {};
  } catch {
    return { descripcionFinal: valor };
  }
}

async function urlTemporal(ruta: string) {
  const sb = obtenerSupabaseAdminOpcional();
  if (!sb) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(ruta, 60 * 15);
  return error ? null : data.signedUrl;
}

export default async function ConceptoAreaCard({
  inspeccionId,
  areaId,
  punto,
  numeroConcepto,
  puedeCapturar,
  areaActiva,
}: {
  inspeccionId: string;
  areaId: string;
  punto: PuntoArea;
  numeroConcepto: number;
  puedeCapturar: boolean;
  areaActiva: boolean;
}) {
  const fotos = await prisma.$queryRaw<Array<{
    fotografiaId: string;
    orden: number;
    ruta: string;
    descripcion: string | null;
  }>>`
    SELECT fa."fotografiaId",fa."orden",f."url" AS "ruta",f."descripcion"
    FROM "FotografiaArea" fa
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE fa."guiaItemId"=${punto.id}
    ORDER BY fa."orden",fa."creadoEn"
  `;
  const fotosConUrl = await Promise.all(
    fotos.map(async (foto) => ({ ...foto, urlTemporal: await urlTemporal(foto.ruta) })),
  );

  const obs = observacion(punto.observacion);
  const noAplica = punto.estadoV3 === "NO_APLICA";
  const cerrado = punto.estadoV3 !== "PENDIENTE";
  const evidenciaCompleta = noAplica || (fotos.length >= 1 && fotos.length <= 4);
  const editable = puedeCapturar && areaActiva && !cerrado;
  const puedeReabrir = puedeCapturar && cerrado && !noAplica;

  return (
    <article
      id={`item-${punto.id}`}
      className={`scroll-mt-24 rounded-3xl border p-5 ${
        noAplica
          ? "border-slate-700 bg-slate-950/50"
          : cerrado
            ? "border-emerald-300/20 bg-emerald-300/5"
            : "border-white/10 bg-slate-900"
      }`}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase text-cyan-200">
              CONCEPTO {numeroConcepto}
            </span>
            <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black uppercase text-slate-400">
              {punto.grupo ?? "ADICIONAL"}
            </span>
            {punto.origenV3 === "INSPECTOR" && (
              <span className="rounded-full bg-violet-300/10 px-2 py-1 text-[10px] font-black text-violet-300">
                AGREGADO EN CAMPO
              </span>
            )}
            {punto.herramientaSugerida && (
              <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-200">
                {punto.herramientaSugerida}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-xl font-black">{punto.concepto}</h3>
          {punto.especificacion && <p className="mt-2 text-sm leading-6 text-slate-300">{punto.especificacion}</p>}

          {noAplica ? (
            <div className="mt-4 rounded-xl bg-slate-950 p-3 text-sm text-slate-300">
              <strong>NO APLICA.</strong> Motivo: {punto.motivoNoAplica || "registrado por el Inspector"}.
            </div>
          ) : (
            <p className={`mt-3 text-sm font-black ${evidenciaCompleta ? "text-emerald-300" : "text-amber-300"}`}>
              📷 Evidencia: mínimo 1 y máximo 4 fotografías · {fotos.length}/4
            </p>
          )}

          {fotosConUrl.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {fotosConUrl.map((foto) => (
                <div key={foto.fotografiaId} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                  {foto.urlTemporal ? (
                    <a href={foto.urlTemporal} target="_blank" rel="noreferrer" className="block bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.urlTemporal} alt={`Evidencia ${foto.orden} de ${punto.concepto}`} className="h-56 w-full object-contain" />
                    </a>
                  ) : (
                    <div className="flex h-56 items-center justify-center text-xs text-slate-500">Vista previa no disponible</div>
                  )}
                  {editable && (
                    <form action={eliminarFotoConceptoAreaV1} className="p-3">
                      <input type="hidden" name="inspeccionId" value={inspeccionId}/>
                      <input type="hidden" name="areaId" value={areaId}/>
                      <input type="hidden" name="itemId" value={punto.id}/>
                      <input type="hidden" name="fotografiaId" value={foto.fotografiaId}/>
                      <button className="w-full rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-300">
                        QUITAR / REPETIR FOTO
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {obs.justificacionIa && (
            <p className="mt-3 rounded-xl bg-cyan-300/5 p-3 text-xs leading-5 text-cyan-100">
              <strong>IA:</strong> {obs.justificacionIa}
            </p>
          )}
        </div>

        <div className="space-y-3">
          {editable && (
            <form action={marcarPuntoNoAplicaV1} className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
              <input type="hidden" name="inspeccionId" value={inspeccionId}/>
              <input type="hidden" name="itemId" value={punto.id}/>
              <p className="text-xs font-black uppercase text-amber-200">Opción por concepto</p>
              <input
                name="motivo"
                required
                minLength={3}
                placeholder="Motivo por el que este concepto no aplica"
                className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              />
              <button className="mt-2 w-full rounded-xl border border-amber-300/40 px-3 py-2 text-sm font-black text-amber-200">
                MARCAR NO APLICA
              </button>
            </form>
          )}

          {editable && fotos.length < 4 && (
            <div className="rounded-2xl border border-cyan-300/20 bg-slate-950 p-4">
              <p className="text-xs font-black uppercase text-slate-400">
                {fotos.length === 0 ? "Agrega la primera evidencia" : `Agregar evidencia opcional ${fotos.length + 1}/4`}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <CapturaConceptoArea
                  inspeccionId={inspeccionId}
                  areaId={areaId}
                  itemId={punto.id}
                  numeroFoto={fotos.length + 1}
                  totalFotos={4}
                  subirFoto={subirFotoConceptoAreaV1}
                />
                <GaleriaConceptoArea
                  inspeccionId={inspeccionId}
                  areaId={areaId}
                  itemId={punto.id}
                  subirFoto={subirFotoConceptoAreaV1}
                />
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                Puedes conservar de 1 a 4 fotografías, tomadas con cámara o seleccionadas de galería. Si modificas la evidencia después de generar IA, deberás generar nuevamente la interpretación.
              </p>
            </div>
          )}

          {editable && evidenciaCompleta && !obs.descripcionIa && (
            <form action={generarDescripcionIaConceptoAreaV1}>
              <input type="hidden" name="inspeccionId" value={inspeccionId}/>
              <input type="hidden" name="areaId" value={areaId}/>
              <input type="hidden" name="itemId" value={punto.id}/>
              <BotonGenerarIa />
            </form>
          )}

          {editable && evidenciaCompleta && (obs.descripcionIa || obs.descripcionFinal) && (
            <form action={guardarResultadoConceptoAreaV1} className="rounded-2xl border border-violet-300/20 bg-violet-300/5 p-4">
              <input type="hidden" name="inspeccionId" value={inspeccionId}/>
              <input type="hidden" name="areaId" value={areaId}/>
              <input type="hidden" name="itemId" value={punto.id}/>

              {punto.requiereMedicion && (
                <div className="mb-4 rounded-xl border border-amber-300/20 bg-slate-950 p-3">
                  <p className="text-xs font-black uppercase text-amber-200">Medición obligatoria</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input name="valorMedido" required defaultValue={punto.valorMedido ?? ""} placeholder="Valor medido" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"/>
                    <input name="unidadMedida" required defaultValue={punto.unidadMedida ?? ""} placeholder="Unidad" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"/>
                  </div>
                  {punto.requiereComparacionProyecto && punto.origenV3 === "PROYECTO" && (
                    <input name="valorProyecto" required defaultValue={punto.valorProyecto ?? ""} placeholder="Valor de proyecto" className="mt-3 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"/>
                  )}
                </div>
              )}

              {obs.descripcionIa ? (
                <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3">
                  <p className="text-xs font-black uppercase text-cyan-200">Interpretación inicial de IA</p>
                  <p className="mt-2 text-xs leading-5 text-cyan-50">{obs.descripcionIa}</p>
                  <p className="mt-2 text-[11px] leading-5 text-cyan-200/70">La IA relacionó la partida, el concepto y el grupo completo de fotografías. El texto de abajo se carga automáticamente como copia editable.</p>
                </div>
              ) : (
                <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">
                  Este concepto fue reabierto. Puedes editar directamente la descripción final ya guardada o generar nuevamente la IA si deseas una nueva interpretación.
                </div>
              )}

              <label className="text-xs font-black uppercase text-slate-400">Descripción final editable por el Inspector</label>
              <textarea
                name="descripcionFinal"
                required
                defaultValue={obs.descripcionFinal ?? obs.descripcionIa ?? ""}
                placeholder="Describe condición observada, funcionamiento, nivelación, acabado, sellado o criterio aplicable."
                className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              />

              <label className="mt-3 block text-xs font-black uppercase text-slate-400">Clasificación final</label>
              <select name="clasificacion" defaultValue={obs.clasificacionFinal ?? obs.clasificacionSugerida ?? "C"} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2">
                <option value="C">C · Conforme</option>
                <option value="O">O · Observación</option>
                <option value="NC">NC · No conformidad</option>
                <option value="CR">CR · Crítico</option>
              </select>

              <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3">
                <p className="text-xs font-black uppercase text-cyan-200">Calificación automática por IA</p>
                <p className="mt-2 text-[11px] leading-5 text-cyan-50">El Inspector selecciona la prioridad. Al cerrar, la IA asigna la calificación exacta dentro del rango de esa prioridad: P1 0–49, P2 50–69, P3 70–79, P4 80–89, P5 90–99. Si el concepto es Conforme, el sistema asigna SH = 100.</p>
              </div>

              <label className="mt-3 block text-xs font-black uppercase text-slate-400">Prioridad del hallazgo</label>
              <select name="prioridad" defaultValue={obs.prioridadFinal ?? "P3"} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2">
                <option value="P1">P1 · Inmediata / crítica</option>
                <option value="P2">P2 · Muy alta</option>
                <option value="P3">P3 · Alta / corregir</option>
                <option value="P4">P4 · Media / observación</option>
                <option value="P5">P5 · Baja / seguimiento</option>
              </select>
              <button className="mt-3 w-full rounded-xl bg-violet-300 px-3 py-2 text-sm font-black text-slate-950">
                CERRAR CONCEPTO
              </button>
            </form>
          )}

          {cerrado && !noAplica && (
            <div className="rounded-2xl bg-emerald-300/10 p-4 text-sm text-emerald-200">
              <p className="font-black">CONCEPTO CERRADO ✓</p>
              <p className="mt-2">Clasificación: <strong>{obs.clasificacionFinal ?? "registrada"}</strong></p>
              {obs.calificacionFinal !== undefined && <p>Evaluación IA: <strong>{obs.calificacionFinal}/100</strong>{obs.prioridadEvaluadaIa ? <> · Rango <strong>{obs.prioridadEvaluadaIa}</strong></> : null}</p>}{obs.justificacionCalificacionIa && <p className="mt-1 text-xs text-emerald-100/80">{obs.justificacionCalificacionIa}</p>}{obs.prioridadFinal && <p>Prioridad elegida por el Inspector: <strong>{obs.prioridadFinal}</strong></p>}
              {obs.descripcionFinal && <p className="mt-2 text-xs leading-5">{obs.descripcionFinal}</p>}
              {puedeReabrir && (
                <form action={reabrirConceptoAreaV1} className="mt-4">
                  <input type="hidden" name="inspeccionId" value={inspeccionId}/>
                  <input type="hidden" name="areaId" value={areaId}/>
                  <input type="hidden" name="itemId" value={punto.id}/>
                  <button className="w-full rounded-xl border border-cyan-300/30 px-3 py-2 text-xs font-black text-cyan-200">
                    EDITAR CONCEPTO CERRADO
                  </button>
                </form>
              )}
            </div>
          )}

          {noAplica && puedeCapturar && (
            <form action={reactivarConceptoAreaV1} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
              <input type="hidden" name="inspeccionId" value={inspeccionId}/>
              <input type="hidden" name="areaId" value={areaId}/>
              <input type="hidden" name="itemId" value={punto.id}/>
              <button className="w-full rounded-xl border border-cyan-300/30 px-3 py-2 text-xs font-black text-cyan-200">
                REACTIVAR CONCEPTO
              </button>
            </form>
          )}
        </div>
      </div>
    </article>
  );
}
