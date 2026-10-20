import { describe, expect, it } from "bun:test";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createTurnRunner } from "../agent/index.js";
import { createSessionStore } from "../sessions.js";
import { UsageTracker } from "../usageTracker.js";

const ERROR_REPLY = "Sorry, I hit an error. Please try again.";
const LIMIT_REPLY = "I stopped after too many steps. Try a more specific request.";

type Scripted = { status?: number; body: object };

function message(content: object[], stopReason: string, inputTokens = 10, outputTokens = 5): Scripted {
  return {
    body: {
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "test",
      content,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    },
  };
}

const text = (t: string, inputTokens?: number, outputTokens?: number) =>
  message([{ type: "text", text: t }], "end_turn", inputTokens, outputTokens);
const echoCall = (inputTokens?: number, outputTokens?: number) =>
  message([{ type: "tool_use", id: "toolu_1", name: "echo", input: { text: "hi" } }], "tool_use", inputTokens, outputTokens);
const apiError: Scripted = {
  status: 400,
  body: { type: "error", error: { type: "invalid_request_error", message: "bad request" } },
};

const echo = betaZodTool({
  name: "echo",
  description: "Returns the text",
  inputSchema: z.object({ text: z.string() }),
  run: async ({ text }) => text,
});

// Each request gets the next scripted response. No request leaves the process.
function setup(responses: Scripted[], model = "claude-sonnet-5-5") {
  const requests: { messages: unknown[] }[] = [];
  const fetch = (async (_url: unknown, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    const next = responses.shift();
    if (!next) throw new Error("No scripted response left");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
  let now = 0;
  const sessions = createSessionStore(() => now);
  const usage = new UsageTracker();
  const turns = createTurnRunner({
    anthropic: new Anthropic({ apiKey: "test", baseURL: "https://example.invalid", maxRetries: 0, fetch }),
    tools: [echo],
    sessions,
    usage,
    model,
  });
  return { ...turns, sessions, requests, advance: (ms: number) => (now += ms) };
}

describe("runTurn", () => {
  it("records the usage of all iterations of a turn with tool calls", async () => {
    const t = setup([echoCall(10, 5), text("Done", 20, 7)]);
    const result = await t.runTurn("u1", "hello");
    expect(result.reply).toBe("Done");
    expect(result.outcome).toBe("ok");
    expect(t.getUsage("u1")).toMatchObject({ turns: 1, inputTokens: 30, outputTokens: 12 });
  });

  it("keeps a failed turn in the session and closes it with an apology", async () => {
    const t = setup([echoCall(10, 5), apiError]);
    const result = await t.runTurn("u1", "approve 42");
    expect(result.outcome).toBe("error");
    expect(result.reply).toBe(ERROR_REPLY);
    const session = t.sessions.get("u1")!;
    expect(session.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(session[2].content).toMatchObject([{ type: "tool_result", tool_use_id: "toolu_1" }]);
    expect(session.at(-1)).toEqual({ role: "assistant", content: ERROR_REPLY });
    expect(result.messages).toEqual(session);
    expect(t.getUsage("u1")).toMatchObject({ turns: 1, inputTokens: 10, outputTokens: 5 });
  });

  it("stops after 10 model calls and says so", async () => {
    const t = setup(Array.from({ length: 11 }, () => echoCall()));
    const result = await t.runTurn("u1", "loop");
    expect(t.requests).toHaveLength(10);
    expect(result.outcome).toBe("limit");
    expect(result.reply).toBe(LIMIT_REPLY);
    expect(t.sessions.get("u1")!.at(-1)).toEqual({ role: "assistant", content: LIMIT_REPLY });
  });

  it("returns only the messages of the current turn", async () => {
    const t = setup([text("First"), text("Second")]);
    await t.runTurn("u1", "one");
    const result = await t.runTurn("u1", "two");
    expect(result.messages).toEqual([
      { role: "user", content: "two" },
      { role: "assistant", content: [{ type: "text", text: "Second" }] },
    ]);
    expect(t.sessions.get("u1")).toHaveLength(4);
  });

  it("starts a new session after 30 minutes of no activity", async () => {
    const t = setup([text("First"), text("Second")]);
    await t.runTurn("u1", "one");
    t.advance(30 * 60 * 1000 + 1);
    await t.runTurn("u1", "two");
    expect(t.requests[1].messages).toEqual([{ role: "user", content: "two" }]);
  });

  it("clears the session on reset, also while a turn runs", async () => {
    const t = setup([text("First")]);
    const turn = t.runTurn("u1", "one");
    await t.resetSession("u1");
    await turn;
    expect(t.sessions.get("u1")).toBeUndefined();
  });

  it("keeps both turns when two start at the same time", async () => {
    const t = setup([text("First"), text("Second")]);
    await Promise.all([t.runTurn("u1", "one"), t.runTurn("u1", "two")]);
    expect(t.sessions.get("u1")).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: [{ type: "text", text: "First" }] },
      { role: "user", content: "two" },
      { role: "assistant", content: [{ type: "text", text: "Second" }] },
    ]);
  });
});

describe("getUsage", () => {
  it("returns null before the first turn", () => {
    expect(setup([]).getUsage("u1")).toBeNull();
  });

  it.each([
    ["claude-opus-5-5", 24],
    ["claude-opus-5", 30],
    ["claude-sonnet-5-5", 12],
    ["claude-haiku-4-5", 6],
  ])("prices %s", async (model, cost) => {
    const t = setup([text("Hi", 1_000_000, 1_000_000)], model);
    await t.runTurn("u1", "hello");
    expect(t.getUsage("u1")).toEqual({ turns: 1, inputTokens: 1_000_000, outputTokens: 1_000_000, cost, model });
  });
});
