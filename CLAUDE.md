# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

```bash
bun install        # Install dependencies
bun run dev        # Run with watch mode for development
bun run start      # Run bot directly (no build step needed)
bun run typecheck  # Type-check with tsc (no emit)
bun test           # Run tests
```

## Architecture

This is a Discord bot that uses the Anthropic SDK (`@anthropic-ai/sdk`) to handle natural language media requests through Seerr (a media request management system for Plex/Jellyfin).

### Core Flow
1. **Discord Bot** (`src/index.ts`) - Listens for mentions or DMs, maintains per-user conversation sessions with 30-minute TTL
2. **Agent** (`src/agent/index.ts`) - Uses `anthropic.beta.messages.toolRunner()` to run a tool-use loop with the system prompt
3. **Client** (`src/agent/client.ts`) - Anthropic SDK client instance
4. **Prompt** (`src/agent/prompt.ts`) - System prompt defining media request behavior
5. **Tools** (`src/agent/tools/`) - Individual tool implementations using `betaZodTool()` with Zod v4 schemas
6. **Services** (`src/services/`) - API clients for Seerr and OMDB

### Key Patterns
- Tools use `betaZodTool()` from `@anthropic-ai/sdk/helpers/beta/zod` with Zod v4 schemas for type-safe inputs
- Most tool files export a factory function (`createXTool({ seerr })`) for testability and a default instance (some tools have no deps)
- The `toolRunner()` handles the entire tool-use loop automatically (no manual while loop)
- Tools return `[POSTER:url]` tags that the Discord handler parses to display images as embed thumbnails
- The `request_media` tool returns `[PENDING_REQUEST:json]` tags — the Discord handler parses these to show confirm/cancel buttons before submitting to Seerr
- Session management tracks conversation state per Discord user via `BetaMessageParam[]`

### Adding New Tools
1. Create tool file in `src/agent/tools/` using `betaZodTool()` with a Zod schema and `run()` handler
2. Export a factory function (with service deps if needed) and a default instance
3. Add the tool to the `tools` array in `src/agent/tools/index.ts`
4. Update the system prompt in `src/agent/prompt.ts` if the agent needs to know when/how to use it
5. Add tests in `src/__tests__/tools/`

### Environment Variables
See `.env.example` for required variables: `DISCORD_BOT_TOKEN`, `SEERR_URL`, `SEERR_API_KEY`, `OMDB_API_KEY`, `ANTHROPIC_API_KEY`, and optional `CLAUDE_MODEL`.

## Commit Guidelines
- Do not add "Co-Authored-By" lines or any AI attribution to commits
