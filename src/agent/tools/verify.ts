import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { omdb } from "../../services/omdb.js";
import type { OmdbDeps } from "./types.js";

const inputSchema = z.object({
  imdbId: z.string().optional().describe("IMDB ID to look up directly"),
  title: z.string().optional().describe("Title to search for on IMDB"),
  year: z.string().optional().describe("Release year to help narrow search"),
  type: z.enum(["movie", "series"]).optional().describe("Media type"),
});

export function createVerifyImdbTool(deps: { omdb: OmdbDeps }) {
  return betaZodTool({
    name: "verify_imdb",
    description: "Verify a media selection by checking its IMDB information.",
    inputSchema,
    run: async ({ imdbId, title, year, type }) => {
      try {
        if (imdbId) {
          const details = await deps.omdb.getByImdbId(imdbId);
          if (details.Response === "False") {
            return `IMDB lookup failed: ${details.Error || "Not found"}`;
          }
          return `IMDB Verification:
Title: ${details.Title} (${details.Year})
IMDB ID: ${details.imdbID}
Type: ${details.Type}
Rating: ${details.imdbRating}/10 (${details.imdbVotes} votes)
Genre: ${details.Genre}
Director: ${details.Director}
Actors: ${details.Actors}
${details.totalSeasons ? `Seasons: ${details.totalSeasons}` : ""}

Plot: ${details.Plot}`;
        }

        if (title) {
          const searchResults = await deps.omdb.searchByTitle(title, { year, type });
          if (searchResults.Response === "False" || !searchResults.Search?.length) {
            return `IMDB search failed: ${searchResults.Error || "No results found"}`;
          }
          const formatted = searchResults.Search.slice(0, 5)
            .map((r, i) => `${i + 1}. ${r.Title} (${r.Year}) - ${r.Type} [${r.imdbID}]`)
            .join("\n");
          return `IMDB Search Results for "${title}":\n\n${formatted}`;
        }

        return "Please provide either an IMDB ID or a title to search.";
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

export const verifyImdbTool = createVerifyImdbTool({ omdb });
