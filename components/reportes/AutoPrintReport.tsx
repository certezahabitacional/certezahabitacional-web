"use client";

import { useEffect } from "react";

export default function AutoPrintReport() {
  useEffect(() => {
    let cancelado = false;

    const prepararEImprimir = async () => {
      const imagenes = Array.from(document.images);
      await Promise.all(
        imagenes.map((imagen) => {
          if (imagen.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            const terminar = () => resolve();
            imagen.addEventListener("load", terminar, { once: true });
            imagen.addEventListener("error", terminar, { once: true });
            window.setTimeout(terminar, 5000);
          });
        }),
      );

      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => window.setTimeout(resolve, 1200));

      if (!cancelado) {
        window.focus();
        window.print();
      }
    };

    void prepararEImprimir();

    return () => {
      cancelado = true;
    };
  }, []);

  return null;
}
