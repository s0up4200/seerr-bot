import { config } from "./config.js";

interface UserUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
}

interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

const MODEL_PRICING: { prefix: string; pricing: ModelPricing }[] = [
  { prefix: "claude-opus-4", pricing: { inputPerMTok: 5, outputPerMTok: 25 } },
  {
    prefix: "claude-sonnet-4",
    pricing: { inputPerMTok: 3, outputPerMTok: 15 },
  },
  {
    prefix: "claude-haiku-4-5",
    pricing: { inputPerMTok: 1, outputPerMTok: 5 },
  },
  {
    prefix: "claude-haiku-3-5",
    pricing: { inputPerMTok: 0.8, outputPerMTok: 4 },
  },
];

const DEFAULT_PRICING: ModelPricing = { inputPerMTok: 1, outputPerMTok: 5 };

function getPricing(): ModelPricing {
  const model = config.anthropic.model;
  for (const { prefix, pricing } of MODEL_PRICING) {
    if (model.startsWith(prefix)) return pricing;
  }
  return DEFAULT_PRICING;
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getPricing();
  return (
    (inputTokens * pricing.inputPerMTok +
      outputTokens * pricing.outputPerMTok) /
    1_000_000
  );
}

class UsageTracker {
  private usage = new Map<string, UserUsage>();

  record(userId: string, inputTokens: number, outputTokens: number): void {
    const existing = this.usage.get(userId);
    if (existing) {
      existing.totalInputTokens += inputTokens;
      existing.totalOutputTokens += outputTokens;
      existing.requestCount++;
    } else {
      this.usage.set(userId, {
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        requestCount: 1,
      });
    }
  }

  get(userId: string): UserUsage | null {
    return this.usage.get(userId) ?? null;
  }

  reset(userId: string): void {
    this.usage.delete(userId);
  }
}

export const usageTracker = new UsageTracker();
