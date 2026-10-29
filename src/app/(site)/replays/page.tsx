import type { Metadata } from "next";
import { Suspense } from "react";
import { ParticipationGate, ParticipationTitle, participationBox } from "@/components/participation-gate";
import { ReplayGrid } from "@/components/replays/replay-grid";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicReplays, getReplayProviders } from "@/lib/replays";
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
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 lg:grid-cols-[1fr_22rem]">
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
          <ReplayGrid replays={replays} />
        </section>
      </div>
    </>
  );
}
