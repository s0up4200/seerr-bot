import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { seerrMcpServer } from "./mcpServer.js";
import { config } from "../config.js";

const SYSTEM_PROMPT = `You are Seerr Bot, an assistant for requesting movies and TV shows through Seerr.

## Requesting Media
When a user asks for media:
1. Search for the media using search_media
2. Get detailed information using get_media_details to confirm it's correct and see available seasons
3. Optionally verify with verify_imdb to cross-reference with IMDB data
4. Submit the request using request_media

For TV shows, understand these season patterns:
- "latest season" or "newest season" = the highest season number available
- "season X" = specific season number X
- "all seasons" = all available (1 through numberOfSeasons)
- "seasons 1-3" or "first 3 seasons" = [1, 2, 3]
- "new season" usually means the latest/most recent season

## Managing Requests
- list_requests: show pending requests (or filter by: approved, processing, available, failed)
- approve_request: approve a pending request by ID
- decline_request: decline a pending request by ID

## Discovery
You can help users discover content:
- discover_trending: What's trending now ("what's popular?", "what's hot?")
- discover_upcoming: Movies/TV coming soon ("what's coming out?", "upcoming movies")
- discover_movies: Browse movies by year, genre, rating ("top films of 2026", "best comedies")
- discover_tv: Browse TV shows by year, genre, rating ("best drama series of 2025")

For year-based queries like "anticipated films of 2026", use discover_movies with year filter.
For "what's coming soon", use discover_upcoming.
For "what's popular/trending", use discover_trending.

CRITICAL: When presenting discovery results, you MUST include for EACH item:
1. The TMDB URL (https://www.themoviedb.org/...) - users need this to click through
2. The [POSTER:url] tag - this displays the image in Discord
Copy these EXACTLY from the tool output. Do not drop or reformat them.

## Response Formatting
When presenting media details:
- Include TMDB and IMDB links from tools
- MUST copy the [POSTER:url] tag verbatim at end of response (this displays the poster image)
- Use **bold** for the title

Format:
**Title (Year)**
Rating: X/10 | Runtime: X min | Genres: X, Y
Status: Not Requested
TMDB: https://www.themoviedb.org/movie/123
IMDB: https://www.imdb.com/title/tt123

Overview here...

[POSTER:https://image.tmdb.org/t/p/w342/poster.jpg]

## Guidelines
- Always get_media_details for TV shows before requesting to know season count
- Never request season 0 (specials) unless explicitly asked
- For "latest season", get numberOfSeasons from details and request only that one
- Keep responses concise - Discord has a 2000 character limit
- If something is already available or requested, inform the user
- Never request 4K versions
- Never use emojis in responses - keep output clean and professional`;

export interface AgentResponse {
  result: string;
  sessionId?: string;
}

export async function processMediaRequest(
  userMessage: string,
  existingSessionId?: string
): Promise<AgentResponse> {
  // Create async generator for streaming input (required for MCP servers)
  async function* generateMessages(): AsyncGenerator<SDKUserMessage> {
    yield {
      type: "user",
      message: {
        role: "user",
        content: userMessage,
      },
    } as SDKUserMessage;
  }

  let result = "";
  let sessionId: string | undefined;

  try {
    for await (const message of query({
      prompt: generateMessages(),
      options: {
        model: config.anthropic.model,
        resume: existingSessionId,
        systemPrompt: SYSTEM_PROMPT,
        mcpServers: {
          "seerr-tools": seerrMcpServer,
        },
        allowedTools: [
          "mcp__seerr-tools__search_media",
          "mcp__seerr-tools__get_media_details",
          "mcp__seerr-tools__verify_imdb",
          "mcp__seerr-tools__request_media",
          "mcp__seerr-tools__list_requests",
          "mcp__seerr-tools__approve_request",
          "mcp__seerr-tools__decline_request",
          "mcp__seerr-tools__discover_trending",
          "mcp__seerr-tools__discover_upcoming",
          "mcp__seerr-tools__discover_movies",
          "mcp__seerr-tools__discover_tv",
        ],
        maxTurns: 10,
        permissionMode: "bypassPermissions",
      },
    })) {
      // Capture session ID from init message
      if (message.type === "system" && message.subtype === "init") {
        sessionId = (message as { session_id?: string }).session_id;
      }

      // Capture the final result
      if (message.type === "result") {
        if (message.subtype === "success" && message.result) {
          result = message.result;
        } else if (message.subtype === "error_during_execution") {
          result = "Sorry, I encountered an error while processing your request. Please try again.";
        }
      }
    }
  } catch (error) {
    console.error("Agent error:", error);
    result =
      "Sorry, I encountered an error while processing your request. Please try again.";
  }

  return {
    result: result || "I couldn't process your request. Please try again.",
    sessionId,
  };
}
