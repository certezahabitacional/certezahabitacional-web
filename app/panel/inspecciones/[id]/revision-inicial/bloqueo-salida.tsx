"use client";

import { useEffect } from "react";

export function BloqueoSalidaRevision({ activo }: { activo: boolean }) {
  useEffect(() => {
    if (!activo) return;

    const mensaje = "Debes tomar las 4 fotografías y elegir la fachada definitiva antes de salir de esta revisión.";
    const urlActual = window.location.href;
    const enlaces = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"));
    const estilosPrevios = enlaces.map((enlace) => ({ enlace, display: enlace.style.display }));

    enlaces.forEach((enlace) => {
      enlace.style.display = "none";
      enlace.setAttribute("aria-hidden", "true");
      enlace.tabIndex = -1;
    });

    window.history.pushState({ revisionInicialBloqueada: true }, "", urlActual);

    const bloquearEnlace = (event: MouseEvent) => {
      const objetivo = event.target;
      if (!(objetivo instanceof Element)) return;
      const enlace = objetivo.closest("a");
      if (!enlace) return;

      event.preventDefault();
      event.stopPropagation();
      window.alert(mensaje);
    };

    const bloquearAtras = () => {
      window.history.pushState({ revisionInicialBloqueada: true }, "", urlActual);
      window.alert(mensaje);
    };

    const advertirCierre = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("click", bloquearEnlace, true);
    window.addEventListener("popstate", bloquearAtras);
    window.addEventListener("beforeunload", advertirCierre);

    return () => {
      estilosPrevios.forEach(({ enlace, display }) => {
        enlace.style.display = display;
        enlace.removeAttribute("aria-hidden");
        enlace.removeAttribute("tabindex");
      });
      document.removeEventListener("click", bloquearEnlace, true);
      window.removeEventListener("popstate", bloquearAtras);
      window.removeEventListener("beforeunload", advertirCierre);
    };
  }, [activo]);

  if (!activo) return null;

  return (
    <div className="fixed inset-x-0 bottom-3 z-50 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-amber-300/30 bg-slate-950/95 px-4 py-3 text-center text-xs font-black text-amber-200 shadow-2xl backdrop-blur">
      SALIDA BLOQUEADA HASTA ELEGIR LA FOTOGRAFÍA DEFINITIVA DE FACHADA
    </div>
  );
}
