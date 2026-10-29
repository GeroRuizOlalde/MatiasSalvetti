import type { Metadata } from "next";
import { Suspense } from "react";
import { ParticipationGate, ParticipationTitle, participationBox } from "@/components/participation-gate";
import { ReplayFeed } from "@/components/replays/replay-feed";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentProfile, isPanelRole } from "@/lib/auth/session";
import { getPublicReplays, getReplayProviders, type PublicReplay } from "@/lib/replays";
import { createClient } from "@/lib/supabase/server";
import { MyReplays } from "./my-replays";
import { ReplayForm } from "./replay-form";

export const metadata: Metadata = {
  title: "Replays",
  description: "Los mejores bonos de la comunidad: replays de slots compartidos por los viewers.",
};

export default async function ReplaysPage() {
  const [replays, providers] = await Promise.all([getPublicReplays(), getReplayProviders()]);

  return (
    <>
      <PageHeader kicker="de la comunidad" title="Replays">
        Los mejores bonos de los viewers. ¿Te pagó algo grande? Pegá el link del replay que te da el juego y, cuando lo
        apruebe el panel, aparece acá.
      </PageHeader>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 lg:grid-cols-[minmax(0,42rem)_22rem] lg:justify-center">
        <aside className="lg:order-2">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface" />}>
            <ParticipationGate
              next="/replays"
              loginHint="Entrá con tu cuenta de Twitch para compartir tus replays."
              title="Compartí tu replay"
            >
              {async (profile) => {
                const supabase = await createClient();
                const { data: mine } = await supabase
                  .from("replays")
                  .select("id, slot_name, status, reject_reason")
                  .eq("user_id", profile.id)
                  .order("created_at", { ascending: false })
                  .limit(10);
                return (
                  <section className={participationBox}>
                    <ParticipationTitle>Compartí tu replay</ParticipationTitle>
                    <div className="mt-4">
                      <ReplayForm providers={providers.map(({ name, domain }) => ({ name, domain }))} />
                    </div>
                    <MyReplays replays={mine ?? []} />
                  </section>
                );
              }}
            </ParticipationGate>
          </Suspense>
        </aside>
        <section aria-label="Replays" className="min-w-0 lg:order-1">
          {/* Primero se ve el feed tal cual; cuando se sabe quién mira, se marcan sus me gusta. */}
          <Suspense fallback={<ReplayFeed replays={replays} viewer={null} />}>
            <FeedForViewer replays={replays} />
          </Suspense>
        </section>
      </div>
    </>
  );
}

/** Lee la sesión: va dentro de un <Suspense>. */
async function FeedForViewer({ replays }: { replays: PublicReplay[] }) {
  const profile = await getCurrentProfile();
  if (!profile) return <ReplayFeed replays={replays} viewer={null} />;
  const supabase = await createClient();
  const { data: likes } = await supabase.from("replay_likes").select("replay_id").eq("user_id", profile.id);
  return (
    <ReplayFeed
      // Al cambiar de usuario, los me gusta se vuelven a leer.
      key={profile.id}
      replays={replays}
      viewer={{ id: profile.id, isMod: isPanelRole(profile.role), likedIds: (likes ?? []).map((l) => l.replay_id) }}
    />
  );
}
