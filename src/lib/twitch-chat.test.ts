import { describe, expect, it } from "vitest";
import { parseIrcLine, readableColor, splitEmotes } from "./twitch-chat";

describe("chat de Twitch", () => {
  it("lee un mensaje con nombre, color, insignias y emotes", () => {
    const line =
      "@badges=moderator/1,subscriber/12;color=#0000FF;display-name=Lean66l;emotes=25:6-10;id=abc;user-id=42 " +
      ":lean66l!lean66l@lean66l.tmi.twitch.tv PRIVMSG #chupetti :hola  Kappa que tal";
    const event = parseIrcLine(line);
    expect(event).toMatchObject({
      type: "message",
      message: {
        id: "abc",
        userId: "42",
        login: "lean66l",
        name: "Lean66l",
        color: "#0000FF",
        badges: ["moderator", "subscriber"],
        action: false,
        parts: [
          { type: "text", text: "hola  " },
          { type: "emote", id: "25", name: "Kappa" },
          { type: "text", text: " que tal" },
        ],
      },
    });
  });

  it("entiende /me, PING y la moderación", () => {
    const me = parseIrcLine("@id=x;user-id=1 :a!a@a PRIVMSG #chupetti :\u0001ACTION baila\u0001");
    expect(me).toMatchObject({ message: { action: true, parts: [{ type: "text", text: "baila" }] } });
    expect(parseIrcLine("PING :tmi.twitch.tv")).toEqual({ type: "ping", payload: ":tmi.twitch.tv" });
    expect(parseIrcLine("@target-msg-id=abc :tmi.twitch.tv CLEARMSG #chupetti :hola")).toEqual({
      type: "delete",
      messageId: "abc",
    });
    expect(parseIrcLine("@target-user-id=42 :tmi.twitch.tv CLEARCHAT #chupetti :lean66l")).toEqual({
      type: "clear-user",
      userId: "42",
    });
    expect(parseIrcLine(":tmi.twitch.tv CLEARCHAT #chupetti")).toEqual({ type: "clear-all" });
    expect(parseIrcLine(":tmi.twitch.tv 001 justinfan123 :Welcome")).toBeNull();
  });

  it("cuenta las posiciones de los emotes por caracter, aunque haya emojis", () => {
    expect(splitEmotes("🔥 Kappa", "25:2-6")).toEqual([
      { type: "text", text: "🔥 " },
      { type: "emote", id: "25", name: "Kappa" },
    ]);
  });

  it("aclara los colores que no se leen sobre fondo oscuro", () => {
    expect(readableColor("#FF4500", "x")).toBe("#FF4500");
    expect(readableColor("#0000FF", "x")).not.toBe("#0000FF");
    expect(readableColor(null, "gerorou")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
