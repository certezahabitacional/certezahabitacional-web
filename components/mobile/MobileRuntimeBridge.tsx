"use client";

import { useEffect } from "react";

export default function MobileRuntimeBridge() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      try {
        const [{ Capacitor }, { Network }] = await Promise.all([
          import("@capacitor/core"),
          import("@capacitor/network"),
        ]);

        if (!Capacitor.isNativePlatform()) return;

        document.documentElement.dataset.certezaRuntime = Capacitor.getPlatform();

        const status = await Network.getStatus();
        window.dispatchEvent(
          new CustomEvent("certeza:native-network", {
            detail: { connected: status.connected, connectionType: status.connectionType },
          }),
        );

        const listener = await Network.addListener("networkStatusChange", (state) => {
          window.dispatchEvent(
            new CustomEvent("certeza:native-network", {
              detail: { connected: state.connected, connectionType: state.connectionType },
            }),
          );
        });

        cleanup = () => {
          void listener.remove();
        };
      } catch {
        // La web continúa funcionando aunque el runtime nativo no esté disponible.
      }
    }

    void init();

    return () => cleanup?.();
  }, []);

  return null;
}
