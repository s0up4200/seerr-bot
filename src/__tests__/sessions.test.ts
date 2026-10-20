import { describe, expect, it } from "bun:test";
import { createSessionStore } from "../sessions.js";

const MINUTE = 60 * 1000;

describe("SessionManager", () => {
  it("returns undefined for unknown user", () => {
    expect(createSessionStore().get("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves messages", () => {
    const sessions = createSessionStore();
    const messages = [{ role: "user" as const, content: "hello" }];
    sessions.set("test-user", messages);
    expect(sessions.get("test-user")).toEqual(messages);
  });

  it("clears a session", () => {
    const sessions = createSessionStore();
    sessions.set("test-user", [{ role: "user" as const, content: "hi" }]);
    sessions.clear("test-user");
    expect(sessions.get("test-user")).toBeUndefined();
  });

  it("keeps a session for 30 minutes after the last set", () => {
    let now = 0;
    const sessions = createSessionStore(() => now);
    sessions.set("test-user", [{ role: "user" as const, content: "hi" }]);
    now = 20 * MINUTE;
    const newMessages = [
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: "hello" },
    ];
    sessions.set("test-user", newMessages);
    now = 50 * MINUTE;
    expect(sessions.get("test-user")).toEqual(newMessages);
    now = 50 * MINUTE + 1;
    expect(sessions.get("test-user")).toBeUndefined();
  });
});
