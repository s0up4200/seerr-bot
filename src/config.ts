import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discord: {
    token: requireEnv("DISCORD_BOT_TOKEN"),
  },
  seerr: {
    url: requireEnv("SEERR_URL"),
    apiKey: requireEnv("SEERR_API_KEY"),
  },
  omdb: {
    apiKey: requireEnv("OMDB_API_KEY"),
  },
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
  },
} as const;
