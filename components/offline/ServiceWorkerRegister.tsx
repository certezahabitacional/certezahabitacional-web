"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registrar = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch (error) {
        console.error(
          "No fue posible registrar el Service Worker de Certeza Habitacional.",
          error,
        );
      }
    };

    void registrar();
  }, []);

  return null;
}
