import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createTwitchUser, type TestDb } from "./harness";

let db: TestDb;
let admin: { id: string };
let viewer: { id: string };
let other: { id: string };
let viewerTwitch: string;
let otherTwitch: string;
let n = 0;

const twitchIdOf = async (user: { id: string }) =>
  (await db.query<{ twitch_id: string }>("select twitch_id from public.profiles where id = $1", [user.id])).rows[0]
    .twitch_id;

const points = async (user: { id: string }) =>
  (await db.query<{ points: number }>("select points from public.profiles where id = $1", [user.id])).rows[0].points;

/** Un evento como lo manda EventSub; devuelve si era nuevo. */
const event = async (type: string, payload: Record<string, unknown>, messageId = `msg-${(n += 1)}`) =>
  (
    await db.query<{ ok: boolean }>("select public.twitch_handle_event($1, $2, $3::jsonb) as ok", [
      messageId,
      type,
      JSON.stringify(payload),
    ])
  ).rows[0].ok;

const chat = (twitchUser: string, text: string) =>
  event("channel.chat.message", { chatter_user_id: twitchUser, message_id: `chat-${(n += 1)}`, message: { text } });

const tick = async (users: string[]) =>
  (await db.query<{ n: number }>("select public.twitch_watch_tick($1::text[]) as n", [users])).rows[0].n;

beforeAll(async () => {
  db = await createTestDb();
  admin = await createTwitchUser(db, "admin_twitch");
  viewer = await createTwitchUser(db, "viewer_twitch");
  other = await createTwitchUser(db, "otro_twitch");
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin.id]);
  viewerTwitch = await twitchIdOf(viewer);
  otherTwitch = await twitchIdOf(other);
}, 60_000);

describe("eventos de Twitch", () => {
  it("descarta los reintentos: el mismo mensaje se procesa una sola vez", async () => {
    expect(await event("channel.cheer", { user_id: viewerTwitch, bits: 100 }, "dup-1")).toBe(true);
    expect(await event("channel.cheer", { user_id: viewerTwitch, bits: 100 }, "dup-1")).toBe(false);
    expect(await points(viewer)).toBe(100);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.twitch_events where message_id = 'dup-1'",
    );
    expect(rows[0].n).toBe(1);
  });

  it("follow paga una sola vez; la sub, una por mes; las regaladas las cobra el que regala", async () => {
    const before = await points(other);
    await event("channel.follow", { user_id: otherTwitch });
    await event("channel.follow", { user_id: otherTwitch });
    expect((await points(other)) - before).toBe(200);

    await event("channel.subscribe", { user_id: otherTwitch, is_gift: false });
    await event("channel.subscription.message", { user_id: otherTwitch, cumulative_months: 1 });
    expect((await points(other)) - before).toBe(200 + 1500);

    // A viewer le regalan una sub: no suma. El que regala 3 cobra 3000.
    const viewerBefore = await points(viewer);
    await event("channel.subscribe", { user_id: viewerTwitch, is_gift: true });
    expect(await points(viewer)).toBe(viewerBefore);
    await event("channel.subscription.gift", { user_id: otherTwitch, total: 3 });
    expect((await points(other)) - before).toBe(200 + 1500 + 3000);

    // Anónimos y gente sin cuenta en la web: se guarda el evento y nada más.
    expect(await event("channel.cheer", { user_id: null, bits: 500, is_anonymous: true })).toBe(true);
    expect(await event("channel.raid", { from_broadcaster_user_id: "999", viewers: 40 })).toBe(true);
  });

  it("chat: tope por minuto y los repetidos seguidos no cuentan", async () => {
    const before = await points(viewer);
    await chat(viewerTwitch, "hola");
    await chat(viewerTwitch, "vamos chupetti");
    expect((await points(viewer)) - before).toBe(2);

    // Pasa un minuto: cuenta de nuevo, pero no si repite el último mensaje.
    await db.query("update public.twitch_chat_state set minute = minute - interval '1 minute'");
    await chat(viewerTwitch, "  Vamos   CHUPETTI ");
    expect((await points(viewer)) - before).toBe(2);
    await chat(viewerTwitch, "otra cosa");
    expect((await points(viewer)) - before).toBe(4);
  });

  it("quien se registra después cobra el follow y la sub que ya tenía", async () => {
    await event("channel.follow", { user_id: "555001" });
    await event("channel.subscribe", { user_id: "555001", is_gift: false });
    await event("channel.cheer", { user_id: "555001", bits: 300 });
    const late = await createTwitchUser(db, "tarde_twitch");
    expect(await points(late)).toBe(0);
    await db.query("update public.profiles set twitch_id = '555001' where id = $1", [late.id]);
    expect(await points(late)).toBe(200 + 1500);
  });
});

describe("puntos por ver", () => {
  it("offline no suma; online suma una vez por intervalo y registra los minutos", async () => {
    expect(await tick([viewerTwitch, otherTwitch])).toBe(0);

    await event("stream.online", { id: "stream-1", started_at: new Date().toISOString() });
    const before = await points(viewer);
    expect(await tick([viewerTwitch, "no-registrado"])).toBe(1);
    expect(await tick([viewerTwitch])).toBe(0);
    expect((await points(viewer)) - before).toBe(10);

    // Siguiente intervalo.
    await db.query(
      "update public.point_events set source_ref = source_ref || '-prev' where kind = 'twitch_watch' and user_id = $1",
      [viewer.id],
    );
    expect(await tick([viewerTwitch])).toBe(1);
    const { rows } = await db.query("select minutes from public.watch_minutes where user_id = $1", [viewer.id]);
    expect(rows).toEqual([{ minutes: 10 }]);

    await event("stream.offline", {});
    expect(await tick([viewerTwitch])).toBe(0);
    const open = await db.query("select 1 from public.twitch_streams where ended_at is null");
    expect(open.rows).toHaveLength(0);
  });

  it("los bloqueados y baneados no suman", async () => {
    await db.query("select public.twitch_set_stream(true, 'stream-2', now())");
    await db.query("update public.profiles set points_blocked_at = now() where id = $1", [other.id]);
    expect(await tick([otherTwitch])).toBe(0);
    await db.query("update public.profiles set points_blocked_at = null where id = $1", [other.id]);
    expect(await tick([otherTwitch])).toBe(1);
    await db.query("select public.twitch_set_stream(false)");
  });
});

describe("permisos", () => {
  it("nadie lee los tokens del canal ni llama a las funciones desde el cliente", async () => {
    await db.query(
      "insert into public.twitch_channel_auth (broadcaster_id, login, access_token, refresh_token, expires_at) values ('1', 'chupetti', 'a', 'r', now())",
    );
    for (const who of [viewer, admin]) {
      await expect(as(db, who, () => db.query("select * from public.twitch_channel_auth"))).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(
      as(db, viewer, () =>
        db.query("select public.twitch_handle_event('x', 'channel.cheer', '{\"bits\": 99999}'::jsonb)"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(as(db, viewer, () => db.query("select public.twitch_watch_tick('{1}'::text[])"))).rejects.toThrow(
      /permission denied/,
    );
    const seen = await as(db, viewer, () => db.query("select id from public.twitch_events"));
    expect(seen.rows).toHaveLength(0);
    const adminSees = await as(db, admin, () => db.query("select id from public.twitch_events limit 1"));
    expect(adminSees.rows).toHaveLength(1);
  });
});
