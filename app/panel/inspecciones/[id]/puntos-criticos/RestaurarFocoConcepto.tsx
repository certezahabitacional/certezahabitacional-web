"use client";

import { useEffect } from "react";

export default function RestaurarFocoConcepto({ itemId }: { itemId?: string }) {
  useEffect(() => {
    if (!itemId) return;

    let intentos = 0;
    let cancelado = false;

    const enfocar = () => {
      if (cancelado) return;
      const objetivo = document.getElementById(`item-${itemId}`);

      if (objetivo) {
        objetivo.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "nearest",
        });
        return;
      }

      intentos += 1;
      if (intentos < 10) {
        window.setTimeout(enfocar, 80);
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(enfocar));

    return () => {
      cancelado = true;
    };
  }, [itemId]);

  return null;
}
