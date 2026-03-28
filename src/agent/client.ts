import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

export const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});
