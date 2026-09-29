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
    autoRespondUserId: process.env.DISCORD_AUTO_RESPOND_USER_ID,
    autoRespondChannelId: process.env.DISCORD_AUTO_RESPOND_CHANNEL_ID,
    // Empty list means every user may talk to the bot.
    allowedUserIds:
      process.env.DISCORD_ALLOWED_USER_IDS?.split(",").map((id) => id.trim()).filter(Boolean) ?? [],
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
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
  },
} as const;
