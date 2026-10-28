"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Tablas que la base "toca" cuando cambia algo de su sesión (bonos, compras, cruces). */
type LiveTable = "hunts" | "buy_sessions" | "battles";

/**
 * Escucha los cambios de una fila por Supabase Realtime y vuelve a pedir la
 * página. Los datos vienen del caché del servidor, que el panel invalida en
 * cada cambio, así que no hace falta armar el estado acá.
 */
export function RealtimeRefresh({ table, id }: { table: LiveTable; id: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Agrupa ráfagas (varios bonos seguidos) y le da tiempo al panel de invalidar el caché.
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 600);
    };

    const channel = supabase
      .channel(`${table}:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter: `id=eq.${id}` }, schedule)
      .subscribe();

    // Al volver a la pestaña puede haberse perdido algún evento.
    const onVisible = () => document.visibilityState === "visible" && schedule();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [table, id, router]);

  return null;
}
