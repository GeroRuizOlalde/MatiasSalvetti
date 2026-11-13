import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ActionButton } from "@/components/panel/action-button";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { requirePanelProfile } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { formatDateTime, formatInteger } from "@/lib/format";
import { currentOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import {
  eventSubCallbackUrl,
  EVENTSUB_TYPES,
  getChannelStatus,
  missingTwitchEnv,
  twitchRedirectUri,
} from "@/lib/twitch/channel";
import { disconnect, syncEvents } from "./actions";

export const metadata: Metadata = { title: "Twitch" };

const NOTICES: Record<string, { text: string; error?: boolean }> = {
  connected: { text: "Canal conectado y eventos sincronizados." },
  connected_no_events: {
    text: "Canal conectado, pero no se pudieron crear todos los eventos. Tocá «Sincronizar eventos».",
    error: true,
  },
  denied: { text: "Se canceló la autorización en Twitch.", error: true },
  state: { text: "La autorización venció. Probá de nuevo.", error: true },
  exchange: {
    text: "Twitch no aceptó la autorización. Revisá la URL de redirección en la consola de Twitch.",
    error: true,
  },
  wrong_account: {
    text: "Esa no es la cuenta del canal. Entrá a Twitch con la cuenta de Chupetti y volvé a conectar.",
    error: true,
  },
  missing_scopes: { text: "Faltó aceptar algún permiso. Volvé a conectar y aceptá todos.", error: true },
  save: { text: "No se pudo guardar la conexión. ¿Está corrido el SQL de esta etapa?", error: true },
  config: { text: "Faltan TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET en Vercel.", error: true },
};

const STATUS_LABEL: Record<string, string> = {
  enabled: "Activo",
  webhook_callback_verification_pending: "Verificando…",
  webhook_callback_verification_failed: "Twitch no pudo llegar a la web",
  notification_failures_exceeded: "Caído: la web no respondió",
  authorization_revoked: "Caído: se sacó el permiso",
  moderator_removed: "Caído: falta el permiso de moderador",
  user_removed: "Caído: la cuenta ya no existe",
  version_removed: "Caído: versión vieja",
  revoked: "Caído",
};

export default async function TwitchPage({ searchParams }: PageProps<"/panel/twitch">) {
  await requirePanelProfile("admin");
  const params = await searchParams;
  const noticeKey = typeof params.ok === "string" ? params.ok : typeof params.error === "string" ? params.error : null;
  const notice = noticeKey ? NOTICES[noticeKey] : null;

  const supabase = await createClient();
  const [origin, status, { data: subscriptions }, { data: stream }, { data: events }, { count: eventCount }] =
    await Promise.all([
      currentOrigin(),
      getChannelStatus().catch(() => null),
      supabase.from("twitch_subscriptions").select("type, status, updated_at"),
      supabase.from("twitch_streams").select("started_at").is("ended_at", null).maybeSingle(),
      supabase
        .from("twitch_events")
        .select("id, type, twitch_user_id, created_at")
        .neq("type", "channel.chat.message")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("twitch_events").select("id", { count: "exact", head: true }),
    ]);
  const missing = missingTwitchEnv();
  const connected = Boolean(status?.connected && !status.needsReconnect);
  const labelOf = (type: string) => EVENTSUB_TYPES.find((t) => t.type === type)?.label ?? type;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Twitch</h1>
      <p className="text-sm text-muted">
        La conexión con el canal: con esto la web sabe quién mira, chatea, sigue, se suscribe o tira bits, y suma los
        puntos sola.
      </p>

      {notice ? (
        <p
          role={notice.error ? "alert" : "status"}
          className={
            notice.error
              ? "rounded-xl border border-live/40 bg-live/5 px-4 py-3 text-sm text-live"
              : "rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent-text"
          }
        >
          {notice.text}
        </p>
      ) : null}

      {missing.length ? (
        <Section title="Falta configurar">
          <p className="text-sm text-muted">Faltan estas variables en Vercel (Settings → Environment Variables):</p>
          <ul className="num mt-2 list-inside list-disc text-sm text-gold">
            {missing.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-subtle">Después de cargarlas hay que volver a desplegar la web.</p>
        </Section>
      ) : null}

      <Section title="Canal">
        {status === null ? (
          <p className="text-sm text-live">No se pudo leer la conexión. ¿Está corrido el SQL de esta etapa?</p>
        ) : connected ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="text-sm">
              <span className="font-semibold text-accent-text">Conectado</span> como{" "}
              <strong>twitch.tv/{status.login}</strong>
              {status.connectedAt ? (
                <span className="text-subtle"> · desde {formatDateTime(status.connectedAt)}</span>
              ) : null}
            </p>
            <ActionButton
              action={disconnect}
              fields={{}}
              variant="ghost"
              pendingLabel="Desconectando…"
              confirmText="¿Desconectar el canal? Se dejan de sumar los puntos por ver, chat, follow, subs y bits hasta volver a conectar."
            >
              Desconectar
            </ActionButton>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {status.needsReconnect
                ? "Twitch dio de baja la autorización (pasa si se cambia la contraseña o se desconecta la app). Hay que conectar de nuevo."
                : "Todavía no está conectado. Lo tiene que hacer Matías, con la cuenta del canal: Twitch le muestra los permisos y toca «Autorizar»."}
            </p>
            {/* Navegación completa (no del router): la ruta redirige a Twitch. */}
            <form action="/api/twitch/connect" method="get">
              <button type="submit" className={buttonClasses({ size: "sm" })}>
                Conectar canal de Twitch
              </button>
            </form>
          </div>
        )}
      </Section>

      <Section
        title="Eventos"
        description="Lo que Twitch le avisa a la web. Si alguno figura caído, tocá «Sincronizar eventos»."
      >
        <ul className="divide-y divide-line rounded-xl border border-line">
          {EVENTSUB_TYPES.map((wanted) => {
            const row = subscriptions?.find((s) => s.type === wanted.type);
            const ok = row?.status === "enabled";
            return (
              <li key={wanted.type} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-semibold">{wanted.label}</span>
                <span className="num text-xs text-subtle">{wanted.type}</span>
                <span className={ok ? "ml-auto text-accent-text" : row ? "ml-auto text-live" : "ml-auto text-subtle"}>
                  {row ? (STATUS_LABEL[row.status] ?? `Error (${row.status})`) : "Sin crear"}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <ActionButton action={syncEvents} fields={{}} variant="primary" pendingLabel="Sincronizando…">
            Sincronizar eventos
          </ActionButton>
        </div>
      </Section>

      <Section title="Actividad">
        <p className="text-sm">
          Stream:{" "}
          {stream ? (
            <span className="font-semibold text-live">en vivo desde {formatDateTime(stream.started_at)}</span>
          ) : (
            <span className="text-muted">offline</span>
          )}
          <span className="text-subtle"> · {formatInteger(eventCount ?? 0)} eventos recibidos</span>
        </p>
        {events?.length ? (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-x-4 px-4 py-2 text-sm">
                <span className="font-semibold">{labelOf(event.type)}</span>
                {event.twitch_user_id ? (
                  <span className="num text-xs text-subtle">ID {event.twitch_user_id}</span>
                ) : null}
                <span className="ml-auto text-xs text-subtle">{formatDateTime(event.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-subtle">Todavía no llegó ningún evento.</p>
        )}
      </Section>

      <Section
        title="Datos para configurar"
        description="Lo que hay que cargar en la consola de Twitch y en Supabase. El paso a paso está en docs/twitch.md."
      >
        <dl className="space-y-3 text-sm">
          <Row label="URL de redirección (consola de Twitch → OAuth Redirect URLs)" value={twitchRedirectUri(origin)} />
          <Row label="URL de los eventos (se carga sola al sincronizar)" value={eventSubCallbackUrl(origin)} />
          <Row label="URL de la tarea de 5 minutos (pg_cron en Supabase)" value={`${origin}/api/cron/watch`} />
          {serverEnv.TWITCH_BROADCASTER_ID ? null : status?.broadcasterId ? (
            <Row label="ID del canal (para TWITCH_BROADCASTER_ID)" value={status.broadcasterId} />
          ) : null}
        </dl>
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl tracking-wide uppercase">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2">
        <code className="num rounded-md bg-surface-2 px-2 py-1 text-xs break-all">{value}</code>
        <CopyButton value={value} label="Copiar" />
      </dd>
    </div>
  );
}
