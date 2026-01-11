import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { formatErrorMessage, formatMediaResult } from "../../utils.js";

export const discoverUpcomingTool = tool(
  "discover_upcoming",
  "Get upcoming movies or TV shows that are coming soon. Use this when users ask 'what's coming out', 'upcoming releases', or 'what's new'.",
  {
    mediaType: z
      .enum(["movie", "tv"])
      .describe("Whether to get upcoming movies or TV shows"),
  },
  async (args) => {
    try {
      const response =
        args.mediaType === "movie"
          ? await seerr.discoverUpcomingMovies()
          : await seerr.discoverUpcomingTv();

      if (response.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No upcoming ${args.mediaType === "movie" ? "movies" : "TV shows"} found.`,
            },
          ],
        };
      }

      const results = response.results.slice(0, 10);
      const typeLabel = args.mediaType === "movie" ? "movies" : "TV shows";

      const sections = results.map((r, i) =>
        formatMediaResult(r, i, args.mediaType, { useFullDate: true })
      );

      return {
        content: [
          {
            type: "text",
            text: `Upcoming ${typeLabel}:\n\n${sections.join("\n\n---\n\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching upcoming: ${formatErrorMessage(error)}`,
          },
        ],
      };
    }
  }
);
