import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta.js";
import { anthropic } from "./client.js";
import { config } from "../config.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { tools } from "./tools/index.js";

export interface AgentResponse {
  result: string;
  messages: BetaMessageParam[];
  usage: { inputTokens: number; outputTokens: number };
}

export async function processMediaRequest(
  userMessage: string,
  existingMessages?: BetaMessageParam[]
): Promise<AgentResponse> {
  const messages: BetaMessageParam[] = existingMessages
    ? [...existingMessages, { role: "user", content: userMessage }]
    : [{ role: "user", content: userMessage }];

  try {
    const runner = anthropic.beta.messages.toolRunner({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    // The reply is the text of the last message that has any. A turn can end with a
    // message that has no text, after the model already wrote the reply before a tool call.
    let reply = "";

    for await (const msg of runner) {
      totalInputTokens += msg.usage.input_tokens;
      totalOutputTokens += msg.usage.output_tokens;
      const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
      if (text.trim()) reply = text;
    }

    return {
      result: reply || "No response",
      messages: [...runner.params.messages],
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    };
  } catch (error) {
    console.error("Agent error:", error);
    return {
      result:
        "Sorry, I encountered an error processing your request. Please try again.",
      messages,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
