# seerr-bot

A Discord bot that turns plain-language messages into [Seerr](https://github.com/seerr-team/seerr) media requests. It uses Claude (Anthropic API) to understand the request, looks the title up in Seerr and OMDb, and asks the user to confirm with a button before it sends anything to Seerr.

Works with Seerr, Overseerr and Jellyseerr.

## What users can do

Mention the bot in a channel, or send it a DM:

- `@seerr-bot request the movie Inception`
- `@seerr-bot get me the latest season of Severance`
- `@seerr-bot add all seasons of The Bear`
- `@seerr-bot what's trending?`
- `@seerr-bot movies like Interstellar`
- `@seerr-bot show pending requests`
- `@seerr-bot approve request #42`

The bot shows the match with a poster and two buttons: **Request** and **Wrong one**. Nothing reaches Seerr until the user presses **Request**.

Extra commands:

- `stats` or `usage` shows the user's token usage and estimated cost.
- `reset`, `start over`, `forget` or `new conversation` clears the user's conversation. Conversations also expire after 30 minutes of silence.

**Anyone who can message the bot can approve and decline Seerr requests.** Give the bot only to servers and channels where you trust every member, or remove `approveRequestTool` and `declineRequestTool` from `src/agent/tools/index.ts`.

## Requirements

- [Bun](https://bun.sh) 1.x to install, build and run in development.
- Node.js 18 or newer to run the built bundle in production.
- A Seerr, Overseerr or Jellyseerr instance and its API key (Settings > General).
- A free [OMDb API key](https://www.omdbapi.com/apikey.aspx).
- An [Anthropic API key](https://console.anthropic.com/).
- A Discord bot token (see below).

## Discord setup

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications) and add a bot to it.
2. Under **Bot**, enable the **Message Content Intent**. Without it the bot receives empty messages.
3. Copy the bot token into `DISCORD_BOT_TOKEN`.
4. Under **OAuth2 > URL Generator**, select the `bot` scope and these permissions: View Channels, Send Messages, Read Message History, Embed Links. Open the generated URL to invite the bot.

## Run locally

```bash
bun install
cp .env.example .env   # fill in the values
bun run dev            # restarts on file changes
```

`.env.example` documents every variable. The two optional `DISCORD_AUTO_RESPOND_*` variables make the bot answer one user in one channel without a mention. Leave them empty to require a mention everywhere.

## Deploy with systemd

The unit file in `distrib/` expects the bot in `/opt/seerr-bot`, run by a `seerr-bot` user, with Node.js on the host.

```bash
sudo useradd --system --home /opt/seerr-bot --shell /usr/sbin/nologin seerr-bot
sudo git clone https://github.com/s0up4200/seerr-bot /opt/seerr-bot
cd /opt/seerr-bot
sudo cp .env.example .env   # fill in the values
sudo bun install --frozen-lockfile
sudo bun run build
sudo chown -R seerr-bot:seerr-bot /opt/seerr-bot
sudo cp distrib/seerr-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now seerr-bot
journalctl -u seerr-bot -f
```

To update: `git pull`, `bun install --frozen-lockfile`, `bun run build`, `sudo systemctl restart seerr-bot`.

## Development

```bash
bun run typecheck
bun test
```

See `CLAUDE.md` for the code layout and how to add a tool.

## License

GPL-2.0-or-later. See `LICENSE`.
