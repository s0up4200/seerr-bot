# seerr-bot

Discord bot for Seerr media requests using the Anthropic SDK.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm start
```

## Deploy

```bash
sudo cp distrib/seerr-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now seerr-bot
```

## Env

- `DISCORD_BOT_TOKEN`
- `SEERR_URL`
- `SEERR_API_KEY`
- `OMDB_API_KEY`
- `ANTHROPIC_API_KEY`
- `CLAUDE_MODEL` (default: claude-haiku-4-5-20251001)
