import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePanelProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = { title: "Usuarios" };

const PAGE_SIZE = 50;

export default async function UsuariosPage({ searchParams }: PageProps<"/panel/usuarios">) {
  const me = await requirePanelProfile("admin");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 50) : "";

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, twitch_login, display_name, avatar_url, role, banned_at, ban_reason, created_at")
    .order("role", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (q) {
    const pattern = `%${q.replace(/[%_,()]/g, "")}%`;
    query = query.or(`twitch_login.ilike.${pattern},display_name.ilike.${pattern}`);
  }
  const { data: users, error } = await query;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">Usuarios</h1>
      <p className="text-sm text-muted">
        Para sumar un mod: la persona entra una vez a la web con Twitch y acá le cambiás el rol.
      </p>

      <form role="search" className="flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar por usuario de Twitch
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Buscar por usuario de Twitch"
          className="h-10 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm"
        />
        <button type="submit" className={buttonClasses({ size: "sm", className: "h-10" })}>
          <Search className="size-4" aria-hidden /> Buscar
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-live">
          No se pudieron cargar los usuarios.
        </p>
      ) : !users?.length ? (
        <EmptyState icon={Users} title="Sin resultados">
          {q ? `Nadie coincide con "${q}".` : "Todavía no entró nadie."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-2 text-xs text-subtle">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Usuario</th>
                <th scope="col" className="px-4 py-3 font-semibold">Alta</th>
                <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                <th scope="col" className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((user) => {
                const name = user.display_name || user.twitch_login || "Usuario";
                return (
                  <tr key={user.id} className="bg-surface">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar url={user.avatar_url} name={name} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{name}</p>
                          <p className="num truncate text-xs text-subtle">{user.twitch_login ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3">
                      {user.banned_at ? (
                        <span className="text-live" title={user.ban_reason ?? undefined}>
                          Baneado
                        </span>
                      ) : (
                        <span className="text-muted">Activo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.id === me.id ? (
                        <span className="text-xs text-subtle">Sos vos</span>
                      ) : (
                        <UserRowActions
                          userId={user.id}
                          role={user.role}
                          banned={Boolean(user.banned_at)}
                          displayName={name}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
