import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { formatErrorMessage, formatMediaResult } from "../../utils.js";

export const discoverTrendingTool = tool(
  "discover_trending",
  "Get trending movies and TV shows right now. Use this when users ask 'what's trending', 'what's popular', or 'what's hot'.",
  {
    mediaType: z
      .enum(["movie", "tv", "all"])
      .optional()
      .describe("Filter by media type. Default: all"),
  },
  async (args) => {
    try {
      const response = await seerr.discoverTrending();

      if (response.results.length === 0) {
        return {
          content: [{ type: "text", text: "No trending content found." }],
        };
      }

      // Filter by media type if specified
      let results = response.results;
      if (args.mediaType && args.mediaType !== "all") {
        results = results.filter((r) => r.mediaType === args.mediaType);
      }

      // Filter out people, only show movies and TV
      results = results
        .filter((r) => r.mediaType === "movie" || r.mediaType === "tv")
        .slice(0, 10);

      const sections = results.map((r, i) =>
        formatMediaResult(r, i, r.mediaType as "movie" | "tv", { showMediaType: true })
      );

      return {
        content: [
          {
            type: "text",
            text: `Trending now:\n\n${sections.join("\n\n---\n\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching trending: ${formatErrorMessage(error)}`,
          },
        ],
      };
    }
  }
);
