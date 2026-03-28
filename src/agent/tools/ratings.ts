import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { formatErrorMessage } from "../../utils.js";
import type { SeerrDeps } from "./types.js";
import type { RTRating } from "../../types/index.js";

function formatRTScore(rt: RTRating): string[] {
  const lines: string[] = [];
  const critics = rt.criticsScore ? `${rt.criticsScore}% Critics` : null;
  const audience = rt.audienceScore ? `${rt.audienceScore}% Audience` : null;
  const rtParts = [critics, audience].filter(Boolean).join(" / ");
  if (rtParts) {
    lines.push(`Rotten Tomatoes: ${rtParts}`);
    if (rt.url) lines.push(`  ${rt.url}`);
  }
  return lines;
}

const inputSchema = z.object({
  tmdbId: z.number().describe("The TMDB ID"),
  mediaType: z.enum(["movie", "tv"]).describe("Movie or TV"),
});

export function createGetRatingsTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "get_ratings",
    description: "Get Rotten Tomatoes and IMDB ratings for a movie or TV show.",
    inputSchema,
    run: async ({ tmdbId, mediaType }) => {
      const typeLabel = mediaType === "movie" ? "movie" : "TV show";
      const lines: string[] = [];

      try {
        if (mediaType === "movie") {
          const ratings = await deps.seerr.getMovieRatings(tmdbId);
          if (ratings.rt) lines.push(...formatRTScore(ratings.rt));
          if (ratings.imdb?.criticsScore) {
            lines.push(`IMDB: ${ratings.imdb.criticsScore}/10`);
            if (ratings.imdb.url) lines.push(`  ${ratings.imdb.url}`);
          }
        } else {
          const ratings = await deps.seerr.getTvRatings(tmdbId);
          lines.push(...formatRTScore(ratings));
        }

        if (lines.length === 0) {
          return `No ratings available for this ${typeLabel}.`;
        }
        return lines.join("\n");
      } catch (error) {
        const message = formatErrorMessage(error);
        if (message.includes("404")) {
          return `No ratings found for this ${typeLabel}.`;
        }
        return `Error fetching ratings: ${message}`;
      }
    },
  });
}

export const getRatingsTool = createGetRatingsTool({ seerr });
