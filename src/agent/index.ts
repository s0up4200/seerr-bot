import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta.js";
import type { BetaToolRunnerParams } from "@anthropic-ai/sdk/resources/beta/messages/messages.js";
import { anthropic } from "./client.js";
import { config } from "../config.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { tools } from "./tools/index.js";
import { sessionManager, type SessionStore } from "../sessions.js";
import { calculateCost, usageTracker, type UsageTracker } from "../usageTracker.js";

const MAX_ITERATIONS = 10;
const ERROR_REPLY = "Sorry, I hit an error. Please try again.";
const LIMIT_REPLY = "I stopped after too many steps. Try a more specific request.";

export type TurnOutcome = "ok" | "error" | "limit";

export interface TurnResult {
  reply: string;
  /** Only the messages of this turn. */
  messages: BetaMessageParam[];
  outcome: TurnOutcome;
}

export interface UsageReport {
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}

export function createTurnRunner(deps: {
  anthropic: Anthropic;
  tools: BetaToolRunnerParams["tools"];
  sessions: SessionStore;
  usage: UsageTracker;
  model: string;
}) {
  const { sessions, usage, model } = deps;
  // The turns of one session run one after the other, so each turn reads the session that the turn before saved.
  const queues = new Map<string, Promise<unknown>>();

  function enqueue<T>(sessionKey: string, task: () => Promise<T>): Promise<T> {
    const result = (queues.get(sessionKey) ?? Promise.resolve()).then(task);
    queues.set(sessionKey, result.catch(() => {}));
    return result;
  }

  async function turn(sessionKey: string, text: string): Promise<TurnResult> {
    const history = sessions.get(sessionKey) ?? [];
    const runner = deps.anthropic.beta.messages.toolRunner({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: deps.tools,
      messages: [...history, { role: "user", content: text }],
      max_iterations: MAX_ITERATIONS,
    });

    let inputTokens = 0;
    let outputTokens = 0;
    // The reply is the text of the last message that has any. A turn can end with a
    // message that has no text, after the model already wrote the reply before a tool call.
    let reply = "";
    let outcome: TurnOutcome = "ok";

    try {
      for await (const msg of runner) {
        inputTokens += msg.usage.input_tokens;
        outputTokens += msg.usage.output_tokens;
        const msgText = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
        if (msgText.trim()) reply = msgText;
      }
    } catch (error) {
      console.error("Turn failed:", error);
      outcome = "error";
    }

    // Keep a failed turn in the session. Its tool calls ran, for example an approve, and the
    // model must not do them again or deny them. The runner history then ends with the user
    // text or a tool result, so a reply from the bot closes it.
    const messages = [...runner.params.messages];
    if (outcome === "ok" && messages.at(-1)?.role === "user") outcome = "limit";
    if (outcome !== "ok") {
      reply = outcome === "error" ? ERROR_REPLY : LIMIT_REPLY;
      messages.push({ role: "assistant", content: reply });
    }

    sessions.set(sessionKey, messages);
    usage.record(sessionKey, inputTokens, outputTokens);
    return { reply: reply || "No response", messages: messages.slice(history.length), outcome };
  }

  return {
    runTurn: (sessionKey: string, text: string) => enqueue(sessionKey, () => turn(sessionKey, text)),

    resetSession: (sessionKey: string) => enqueue(sessionKey, async () => sessions.clear(sessionKey)),

    getUsage(sessionKey: string): UsageReport | null {
      const stats = usage.get(sessionKey);
      if (!stats) return null;
      return {
        turns: stats.requestCount,
        inputTokens: stats.totalInputTokens,
        outputTokens: stats.totalOutputTokens,
        cost: calculateCost(model, stats.totalInputTokens, stats.totalOutputTokens),
        model,
      };
    },
  };
}

export const { runTurn, resetSession, getUsage } = createTurnRunner({
  anthropic,
  tools,
  sessions: sessionManager,
  usage: usageTracker,
  model: config.anthropic.model,
});
