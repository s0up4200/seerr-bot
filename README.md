# seerr-bot

A Discord bot that turns plain-language messages into [Seerr](https://github.com/seerr-team/seerr) media requests. Claude (Anthropic API) reads the message, the bot looks the title up in Seerr and OMDb, and the user confirms with a button before the bot sends the request to Seerr.

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

The bot shows the match with a poster and two buttons, **Request** and **Wrong one**. The bot sends the request to Seerr only after the user presses **Request**.

Extra commands:

- `stats` or `usage` shows the user's token usage and estimated cost.
- `reset`, `start over`, `forget` or `new conversation` clears the user's conversation. The bot also drops a conversation after 30 minutes without messages.

By default anyone who can message the bot can approve and decline Seerr requests. Set `DISCORD_ADMIN_USER_IDS` to limit that to named users. To limit who can talk to the bot, set Discord channel permissions on the bot role.

## Requirements

- [Bun](https://bun.sh) 1.x to install, build and run in development.
- Node.js 18 or newer to run the built bundle in production.
- A Seerr, Overseerr or Jellyseerr instance and its API key (Settings > General).
- A free [OMDb API key](https://www.omdbapi.com/apikey.aspx).
- An [Anthropic API key](https://console.anthropic.com/).
- A Discord bot token (see below).

## Discord setup

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications) and add a bot to it.
2. Under Bot, enable the Message Content Intent. Without it the bot receives empty messages.
3. Copy the bot token into `DISCORD_BOT_TOKEN`.
4. Under OAuth2 > URL Generator, select the `bot` scope and these permissions: View Channels, Send Messages, Read Message History, Embed Links. Open the generated URL to invite the bot.

## Run locally

```bash
bun install
cp .env.example .env   # fill in the values
bun run dev            # restarts on file changes
```

## Configuration

The bot reads `.env` from its working directory. Copy `.env.example` and fill in:

| Variable | Required | What it is |
|---|---|---|
| `DISCORD_BOT_TOKEN` | yes | Bot token from the Discord Developer Portal. |
| `SEERR_URL` | yes | Base URL of your Seerr instance, for example `http://localhost:5055`. |
| `SEERR_API_KEY` | yes | Seerr API key from Settings > General. |
| `OMDB_API_KEY` | yes | OMDb API key, used to verify titles against IMDb. |
| `ANTHROPIC_API_KEY` | yes | Anthropic API key. |
| `CLAUDE_MODEL` | no | Claude model ID. Defaults to `claude-haiku-4-5-20251001`. |
| `DISCORD_AUTO_RESPOND_USER_ID` | no | Discord user ID the bot answers without a mention. |
| `DISCORD_AUTO_RESPOND_CHANNEL_ID` | no | Channel ID where that user gets answers without a mention. |
| `DISCORD_ADMIN_USER_IDS` | no | Comma-separated user IDs that may approve and decline requests. Empty means everyone. |

Set both `DISCORD_AUTO_RESPOND_*` variables or neither. Leave them empty to require a mention everywhere.

## Deploy with systemd

The unit file in `distrib/` runs `/opt/seerr-bot/dist/index.js` with the host's Node.js as user `seerr-bot`.

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

To update, run `git pull`, `bun install --frozen-lockfile` and `bun run build`, then `sudo systemctl restart seerr-bot`.

## Development

```bash
bun run typecheck
bun test
```

See `CLAUDE.md` for the code layout and how to add a tool.

## License

GPL-2.0-or-later. See `LICENSE`.
