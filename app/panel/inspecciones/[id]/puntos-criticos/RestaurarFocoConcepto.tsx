"use client";

import { useEffect } from "react";

const CLAVE_FOCO = "ch:puntos-criticos:foco";

export default function RestaurarFocoConcepto({ itemId }: { itemId?: string }) {
  useEffect(() => {
    let temporizador: number | null = null;

    const enfocarGuardado = (focoForzado?: string) => {
      const foco = focoForzado || sessionStorage.getItem(CLAVE_FOCO) || undefined;
      if (!foco) return false;

      const objetivo = document.getElementById(`item-${foco}`);
      if (!objetivo) return false;

      objetivo.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "nearest",
      });
      sessionStorage.removeItem(CLAVE_FOCO);
      return true;
    };

    const programarEnfoque = (focoForzado?: string) => {
      if (temporizador !== null) window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            enfocarGuardado(focoForzado);
          });
        });
      }, 80);
    };

    const guardarFoco = (evento: Event) => {
      const formulario = evento.target;
      if (!(formulario instanceof HTMLFormElement)) return;

      const tarjeta = formulario.closest<HTMLElement>('[id^="item-"]');
      const idTarjeta = tarjeta?.id;
      if (!idTarjeta?.startsWith("item-")) return;

      const id = idTarjeta.slice("item-".length);
      if (id) sessionStorage.setItem(CLAVE_FOCO, id);
    };

    document.addEventListener("submit", guardarFoco, true);

    const observador = new MutationObserver(() => {
      if (sessionStorage.getItem(CLAVE_FOCO)) {
        programarEnfoque();
      }
    });
    observador.observe(document.body, {
      childList: true,
      subtree: true,
    });

    if (itemId) {
      sessionStorage.setItem(CLAVE_FOCO, itemId);
      programarEnfoque(itemId);
    } else if (sessionStorage.getItem(CLAVE_FOCO)) {
      programarEnfoque();
    }

    return () => {
      document.removeEventListener("submit", guardarFoco, true);
      observador.disconnect();
      if (temporizador !== null) window.clearTimeout(temporizador);
    };
  }, [itemId]);

  return null;
}
