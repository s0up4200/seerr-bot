import { describe, expect, it, beforeEach } from "bun:test";
import { sessionManager } from "../sessions.js";

describe("SessionManager", () => {
  beforeEach(() => {
    sessionManager.clear("test-user");
  });

  it("returns undefined for unknown user", () => {
    expect(sessionManager.get("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves messages", () => {
    const messages = [{ role: "user" as const, content: "hello" }];
    sessionManager.set("test-user", messages);
    expect(sessionManager.get("test-user")).toEqual(messages);
  });

  it("clears a session", () => {
    sessionManager.set("test-user", [{ role: "user" as const, content: "hi" }]);
    sessionManager.clear("test-user");
    expect(sessionManager.get("test-user")).toBeUndefined();
  });

  it("updates lastActivity on set", () => {
    sessionManager.set("test-user", [{ role: "user" as const, content: "hi" }]);
    const first = sessionManager.get("test-user");
    expect(first).toBeDefined();

    // Set again with new messages
    const newMessages = [
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: "hello" },
    ];
    sessionManager.set("test-user", newMessages);
    expect(sessionManager.get("test-user")).toEqual(newMessages);
  });
});
