"use client";

import { useEffect } from "react";

const CLAVE_FOCO = "ch:puntos-criticos:foco";

export default function RestaurarFocoConcepto({ itemId }: { itemId?: string }) {
  useEffect(() => {
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
    return () => document.removeEventListener("submit", guardarFoco, true);
  }, []);

  useEffect(() => {
    const foco = itemId || sessionStorage.getItem(CLAVE_FOCO) || undefined;
    if (!foco) return;

    let intentos = 0;
    let cancelado = false;

    const enfocar = () => {
      if (cancelado) return;

      const objetivo = document.getElementById(`item-${foco}`);
      if (objetivo) {
        objetivo.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "nearest",
        });
        sessionStorage.removeItem(CLAVE_FOCO);
        return;
      }

      intentos += 1;
      if (intentos < 12) {
        window.setTimeout(enfocar, 100);
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(enfocar));

    return () => {
      cancelado = true;
    };
  }, [itemId]);

  return null;
}
