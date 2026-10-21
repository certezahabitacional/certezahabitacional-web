"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { resumenContratoVisita } from "@/lib/visitas-contrato";
import { habilitarVisita } from "./actions";

const dinero = (valor: string) => Number(valor).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
function Confirmar({ numero }: { numero: number }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950 disabled:opacity-50">{pending ? "Guardando..." : `CONFIRMAR IMPORTE Y HABILITAR V${numero}`}</button>;
}
export default function ImporteVisitaForm({ cotizacionId, inspeccionAnteriorId, numeroVisita }: { cotizacionId: string; inspeccionAnteriorId: string; numeroVisita: number }) {
  const [importe, setImporte] = useState("");
  const [estado, action] = useActionState(habilitarVisita, { error: null });
  let resumen: ReturnType<typeof resumenContratoVisita> | null = null;
  try { resumen = resumenContratoVisita(importe); } catch { /* Campo aun incompleto. El servidor vuelve a validar. */ }
  return <form action={action} className="mt-6 space-y-5 rounded-3xl border border-cyan-300/20 bg-slate-900 p-6">
    <input type="hidden" name="cotizacionId" value={cotizacionId} />
    <input type="hidden" name="inspeccionAnteriorId" value={inspeccionAnteriorId} />
    <h2 className="text-xl font-black">Habilitar visita V{numeroVisita}</h2>
    <label className="block font-bold">Importe contratado para esta inspección (MXN) *
      <input name="importeContratado" type="number" inputMode="decimal" required min="0.01" max="9999999999.99" step="0.01" value={importe} onChange={e => setImporte(e.target.value)} aria-describedby="importe-ayuda" className="mt-2 block w-full rounded-xl bg-slate-950 p-3" />
    </label>
    <p id="importe-ayuda" className="text-sm text-slate-400">Captura el importe acordado para V{numeroVisita}. No se copia el importe ni los pagos de V1.</p>
    <div aria-live="polite" className="grid gap-4 rounded-xl border border-white/10 p-4 sm:grid-cols-2">
      <p>Pago mínimo para agendar (50%): <strong>{resumen ? dinero(resumen.anticipoMinimo) : "—"}</strong></p>
      <p>Pago para iniciar (100%): <strong>{resumen ? dinero(resumen.importeContratado) : "—"}</strong></p>
    </div>
    <label className="block font-bold">Alcance y antecedente de contratación *
      <textarea name="motivo" required minLength={5} maxLength={1000} rows={3} placeholder="Describe la revisión contratada y cómo se confirmó el importe con el cliente." className="mt-2 block w-full rounded-xl bg-slate-950 p-3" />
    </label>
    <label className="flex items-start gap-3 text-sm"><input name="confirmarContratacion" type="checkbox" required className="mt-1" /><span>Confirmo que el cliente contrató esta visita por el importe indicado. Registro su aceptación en representación del cliente y autorizo esta contratación. Ambas acciones quedarán auditadas.</span></label>
    {estado.error && <p role="alert" className="rounded-xl border border-rose-400/30 p-3 text-rose-200">{estado.error}</p>}
    <Confirmar numero={numeroVisita} />
  </form>;
}
