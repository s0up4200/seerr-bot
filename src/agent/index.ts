import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta.js";
import { anthropic } from "./client.js";
import { config } from "../config.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { tools } from "./tools/index.js";

export interface AgentResponse {
  result: string;
  messages: BetaMessageParam[];
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

    const finalMessage = await runner;

    const textBlocks = finalMessage.content.filter(
      (block): block is Anthropic.Beta.Messages.BetaTextBlock =>
        block.type === "text"
    );

    return {
      result: textBlocks.map((b) => b.text).join("\n") || "No response",
      messages: [...runner.params.messages],
    };
  } catch (error) {
    console.error("Agent error:", error);
    return {
      result:
        "Sorry, I encountered an error processing your request. Please try again.",
      messages,
    };
  }
}
