"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { OpcionNavegacionPanel } from "@/lib/panel-navegacion";

function esModuloActual(pathname: string, href: string) {
  if (href === "/panel/inspecciones") return pathname === href;
  if (href === "/panel/inspecciones/nueva") return pathname.startsWith(href);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PanelMenu({ opciones }: { opciones: OpcionNavegacionPanel[] }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const visibles = opciones.filter((opcion) => !esModuloActual(pathname, opcion.href));

  if (visibles.length === 0) return null;

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-4 py-2 backdrop-blur sm:static sm:py-3">
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-left text-sm font-black uppercase tracking-wide text-slate-100 sm:hidden"
          aria-expanded={abierto}
        >
          <span>Menú</span>
          <span aria-hidden="true">{abierto ? "✕" : "☰"}</span>
        </button>

        <div className={`${abierto ? "grid" : "hidden"} mt-2 grid-cols-2 gap-2 sm:mt-0 sm:flex sm:flex-wrap sm:gap-2`}>
          {visibles.map((opcion) => (
            <Link
              key={opcion.modulo}
              href={opcion.href}
              onClick={() => setAbierto(false)}
              className="flex min-h-11 items-center justify-center rounded-2xl border border-slate-700 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-slate-200 transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-100 sm:min-h-0 sm:rounded-full"
            >
              {opcion.etiqueta}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
