# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

```bash
bun install        # Install dependencies
bun run dev        # Run with watch mode for development
bun run build      # Bundle to dist/ for production
bun run start      # Run the built bundle with node
bun run typecheck  # Type-check with tsc (no emit)
bun run lint       # Run oxlint (the turn module guard)
bun test           # Run tests
```

## Architecture

This is a Discord bot that uses the Anthropic SDK (`@anthropic-ai/sdk`) to handle natural language media requests through Seerr (a media request management system for Plex/Jellyfin).

### Core Flow
1. **Discord Bot** (`src/index.ts`) - Listens for mentions or DMs and calls `runTurn` one time for each message
2. **Turn module** (`src/agent/index.ts`) - `runTurn` loads the session, runs `anthropic.beta.messages.toolRunner()` with the system prompt, applies the error policy, records usage, and saves the session. `resetSession` and `getUsage` serve `/reset` and `/stats`
3. **Client** (`src/agent/client.ts`) - Anthropic SDK client instance
4. **Prompt** (`src/agent/prompt.ts`) - System prompt defining media request behavior
5. **Tools** (`src/agent/tools/`) - Individual tool implementations using `betaZodTool()` with Zod v4 schemas
6. **Services** (`src/services/`) - API clients for Seerr and OMDB

### Key Patterns
- Tools use `betaZodTool()` from `@anthropic-ai/sdk/helpers/beta/zod` with Zod v4 schemas for type-safe inputs
- Most tool files export a factory function (`createXTool({ seerr })`) for testability and a default instance (some tools have no deps)
- The `toolRunner()` handles the entire tool-use loop automatically (no manual while loop)
- Tools return `[POSTER:url]` tags that the Discord handler parses to display images as embed thumbnails
- The `request_media` tool only prepares a request and returns the text "Request prepared for user confirmation". `extractPendingRequest` (`src/utils.ts`) finds that text in the tool results of the current turn, and the Discord handler shows confirm buttons. Seerr gets the request only after a click. Keep that text identical in `src/agent/tools/request.ts` and `src/utils.ts`, or the buttons stop showing
- Session management tracks conversation state per Discord user via `BetaMessageParam[]`
- Only the turn module calls the model or writes to the session and usage stores. `.oxlintrc.json` makes lint fail on an import that goes around it

### Adding New Tools
1. Create tool file in `src/agent/tools/` using `betaZodTool()` with a Zod schema and `run()` handler
2. Export a factory function (with service deps if needed) and a default instance
3. Add the tool to the `tools` array in `src/agent/tools/index.ts`
4. Update the system prompt in `src/agent/prompt.ts` if the agent needs to know when/how to use it
5. Add tests in `src/__tests__/tools/`

### Environment Variables
See `.env.example` for required variables: `DISCORD_BOT_TOKEN`, `SEERR_URL`, `SEERR_API_KEY`, `OMDB_API_KEY`, `ANTHROPIC_API_KEY`, and optional `CLAUDE_MODEL`, `DISCORD_AUTO_RESPOND_USER_ID`, `DISCORD_AUTO_RESPOND_CHANNEL_ID`, `DISCORD_ALLOWED_USER_IDS`.

## Commit Guidelines
- Do not add "Co-Authored-By" lines or any AI attribution to commits

## Agent skills

### Issue tracker

Issues are in GitHub Issues. Use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the six default triage labels with no changes. See `docs/agents/triage-labels.md`.

### Domain docs

The repo is single-context, with `GLOSSARY.md` and `docs/adr/` at the root. See `docs/agents/domain.md`.
