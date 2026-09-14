"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function RevisionCanonicaNotice({
  inspeccionId,
  visible,
}: {
  inspeccionId: string;
  visible: boolean;
}) {
  const pathname = usePathname();
  const esExpedientePrincipal = pathname === `/panel/inspecciones/${inspeccionId}`;

  if (!visible || !esExpedientePrincipal) return null;

  return (
    <>
      <style jsx global>{`
        /*
         * El expediente principal conserva información histórica/operativa,
         * pero la revisión y aprobación se centralizan en /revision.
         * Se ocultan únicamente los indicadores/controles heredados que todavía
         * calculaban avance a partir de la existencia de hallazgos.
         */
        .expediente-metodo-certeza
          section[class*="border-cyan-400/20"][class*="mt-7"][class*="bg-slate-900"] {
          display: none;
        }

        .expediente-metodo-certeza
          section[class*="xl:grid-cols-5"][class*="mt-7"] {
          display: none;
        }

        .expediente-metodo-certeza
          div[class*="xl:grid-cols-[360px_1fr]"]
          > aside
          > section:first-child {
          display: none;
        }
      `}</style>

      <div className="print:hidden border-b border-fuchsia-300/20 bg-fuchsia-300/10 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">
              Revisión oficial Método Certeza®
            </p>
            <p className="mt-1 text-sm text-slate-300">
              El cierre, firmas vigentes y aprobaciones se validan exclusivamente en la pantalla de Revisión.
              Una V1 correctamente documentada puede quedar completa aun cuando no existan defectos.
            </p>
          </div>

          <Link
            href={`/panel/inspecciones/${inspeccionId}/revision`}
            className="shrink-0 rounded-full bg-fuchsia-300 px-5 py-3 text-center text-sm font-black text-slate-950"
          >
            Abrir Revisión
          </Link>
        </div>
      </div>
    </>
  );
}
