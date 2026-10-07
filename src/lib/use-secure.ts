"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Läuft die Seite in einem sicheren Kontext (HTTPS oder localhost)? Kamera, Passkeys, App-Installation, Offline-Modus
 * und Push gibt es nur dann. `null` beim Server-Rendern (noch unbekannt), damit nichts flackert oder falsch hydriert.
 */
export function useSecureContext(): boolean | null {
  return useSyncExternalStore(noop, () => window.isSecureContext, () => null);
}
