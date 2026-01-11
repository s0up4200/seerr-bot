import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import type { RTRating } from "../../types/index.js";
import { formatErrorMessage } from "../../utils.js";

function formatRTScore(rt: RTRating): string[] {
  const lines: string[] = [];
  const critics = rt.criticsScore ? `${rt.criticsScore}% Critics` : null;
  const audience = rt.audienceScore ? `${rt.audienceScore}% Audience` : null;
  const rtParts = [critics, audience].filter(Boolean).join(" / ");

  if (rtParts) {
    lines.push(`Rotten Tomatoes: ${rtParts}`);
    if (rt.url) {
      lines.push(`  ${rt.url}`);
    }
  }
  return lines;
}

export const getRatingsTool = tool(
  "get_ratings",
  "Get Rotten Tomatoes and IMDB ratings for a movie or TV show. Use when users ask for 'RT score', 'Rotten Tomatoes rating', or general ratings.",
  {
    tmdbId: z.number().describe("The TMDB ID of the movie or TV show"),
    mediaType: z
      .enum(["movie", "tv"])
      .describe("Whether this is a movie or TV show"),
  },
  async (args) => {
    const typeLabel = args.mediaType === "movie" ? "movie" : "TV show";

    try {
      const lines: string[] = [];

      if (args.mediaType === "movie") {
        const ratings = await seerr.getMovieRatings(args.tmdbId);

        if (ratings.rt) {
          lines.push(...formatRTScore(ratings.rt));
        }

        if (ratings.imdb?.criticsScore) {
          lines.push(`IMDB: ${ratings.imdb.criticsScore}/10`);
          if (ratings.imdb.url) {
            lines.push(`  ${ratings.imdb.url}`);
          }
        }
      } else {
        const ratings = await seerr.getTvRatings(args.tmdbId);
        lines.push(...formatRTScore(ratings));
      }

      if (lines.length === 0) {
        return {
          content: [{ type: "text", text: `No ratings available for this ${typeLabel}.` }],
        };
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    } catch (error) {
      const message = formatErrorMessage(error);
      if (message.includes("404")) {
        return {
          content: [{ type: "text", text: `No ratings found for this ${typeLabel}.` }],
        };
      }
      return {
        content: [{ type: "text", text: `Error fetching ratings: ${message}` }],
      };
    }
  }
);
