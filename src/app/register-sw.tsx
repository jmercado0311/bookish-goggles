"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silencioso: la app sigue funcionando normalmente sin PWA offline.
      });
    }
  }, []);

  return null;
}
