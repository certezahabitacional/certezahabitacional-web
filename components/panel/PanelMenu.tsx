"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { OpcionNavegacionPanel } from "@/lib/panel-navegacion";

function esModuloActual(pathname: string, href: string) {
  if (href === "/panel/inspecciones") {
    return pathname === href;
  }
  if (href === "/panel/inspecciones/nueva") {
    return pathname.startsWith(href);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PanelMenu({ opciones }: { opciones: OpcionNavegacionPanel[] }) {
  const pathname = usePathname();
  const visibles = opciones.filter((opcion) => !esModuloActual(pathname, opcion.href));

  if (visibles.length === 0) return null;

  return (
    <nav className="border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
        {visibles.map((opcion) => (
          <Link
            key={opcion.modulo}
            href={opcion.href}
            className="rounded-full border border-slate-700 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-100"
          >
            {opcion.etiqueta}
          </Link>
        ))}
      </div>
    </nav>
  );
}
