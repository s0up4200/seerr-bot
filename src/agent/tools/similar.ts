import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { formatMediaResult } from "../../utils.js";
import type { SeerrDeps } from "./types.js";

const inputSchema = z.object({
  tmdbId: z.number().describe("The TMDB ID"),
  mediaType: z.enum(["movie", "tv"]).describe("Movie or TV"),
});

export function createGetSimilarTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "get_similar",
    description: "Find movies or TV shows similar to a given title.",
    inputSchema,
    run: async ({ tmdbId, mediaType }) => {
      try {
        const response =
          mediaType === "movie"
            ? await deps.seerr.getSimilarMovies(tmdbId)
            : await deps.seerr.getSimilarTv(tmdbId);

        const typeLabel = mediaType === "movie" ? "movies" : "TV shows";
        if (response.results.length === 0) {
          return `No similar ${typeLabel} found.`;
        }

        const results = response.results.slice(0, 10);
        const sections = results.map((r, i) => formatMediaResult(r, i, mediaType));
        return `Similar ${typeLabel}:\n\n${sections.join("\n\n---\n\n")}`;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

export const getSimilarTool = createGetSimilarTool({ seerr });
