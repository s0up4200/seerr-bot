import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { formatErrorMessage, formatMediaResult } from "../../utils.js";

export const getSimilarTool = tool(
  "get_similar",
  "Find movies or TV shows similar to a given title. Use when users ask for 'movies like X' or 'shows similar to Y'.",
  {
    tmdbId: z.number().describe("The TMDB ID of the movie or TV show"),
    mediaType: z
      .enum(["movie", "tv"])
      .describe("Whether this is a movie or TV show"),
  },
  async (args) => {
    try {
      const response =
        args.mediaType === "movie"
          ? await seerr.getSimilarMovies(args.tmdbId)
          : await seerr.getSimilarTv(args.tmdbId);

      const typeLabel = args.mediaType === "movie" ? "movies" : "TV shows";

      if (response.results.length === 0) {
        return {
          content: [{ type: "text", text: `No similar ${typeLabel} found.` }],
        };
      }

      const results = response.results.slice(0, 10);

      const sections = results.map((r, i) =>
        formatMediaResult(r, i, args.mediaType)
      );

      return {
        content: [
          {
            type: "text",
            text: `Similar ${typeLabel}:\n\n${sections.join("\n\n---\n\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error finding similar titles: ${formatErrorMessage(error)}`,
          },
        ],
      };
    }
  }
);
