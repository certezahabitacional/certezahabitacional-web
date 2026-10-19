import type { Prisma } from "@prisma/client";
// Read-only preflight. Schema/policy changes are a separate, explicitly approved operation.
export async function exigirPersistenciaSeguraPlan(db: Pick<Prisma.TransactionClient, "$queryRaw">, validarCierre = false) {
  const [estado] = await db.$queryRaw<Array<{ protegido: boolean; cierreCompatible: boolean }>>`
    SELECT
      COALESCE((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='PlanPrevioInspeccion'),false) AS "protegido",
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='validar_evidencia_minima_cierre_inspeccion' AND p.pronargs=0 AND position('CERTEZA_PLAN_CONFIRMADO_V1' in pg_get_functiondef(p.oid))>0) AS "cierreCompatible"
  `;
  if (!estado?.protegido) throw new Error("Antes de guardar planes debe validarse y habilitarse la protecci\u00f3n de datos de PlanPrevioInspeccion.");
  if (validarCierre && !estado.cierreCompatible) throw new Error("Falta validar la compatibilidad del cierre con el nuevo cat\u00e1logo. No se iniciar\u00e1 ni recuperar\u00e1 un recorrido que no pueda concluirse.");
}
