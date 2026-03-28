import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { TMDB_IMAGE_BASE } from "../../constants.js";
import type { SeerrDeps } from "./types.js";

function parseYearFromQuery(query: string): { title: string; year?: string } {
  const yearPatterns = [
    /\((\d{4})\)\s*$/,
    /\[(\d{4})\]\s*$/,
    /\s*-\s*(\d{4})\s*$/,
    /\s+(\d{4})\s*$/,
  ];
  for (const pattern of yearPatterns) {
    const match = query.match(pattern);
    if (match) {
      return { title: query.replace(pattern, "").trim(), year: match[1] };
    }
  }
  return { title: query };
}

const inputSchema = z.object({
  query: z.string().describe("The search query (movie or TV show title, optionally with year)"),
});

export function createSearchMediaTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "search_media",
    description: "Search Seerr for movies or TV shows by title. Returns a list of matching media with their TMDB IDs. Automatically handles year in query.",
    inputSchema,
    run: async ({ query }) => {
      try {
        const { title, year: targetYear } = parseYearFromQuery(query);
        const response = await deps.seerr.search(title);

        if (response.results.length === 0) {
          return `No results found for "${title}". Try a different search term.`;
        }

        let mediaResults = response.results.filter(
          (r) => r.mediaType === "movie" || r.mediaType === "tv"
        );

        if (targetYear) {
          const matchingYear = mediaResults.filter((r) => {
            const resultYear = (r.releaseDate || r.firstAirDate || "").slice(0, 4);
            return resultYear === targetYear;
          });
          const otherResults = mediaResults.filter((r) => {
            const resultYear = (r.releaseDate || r.firstAirDate || "").slice(0, 4);
            return resultYear !== targetYear;
          });
          mediaResults = [...matchingYear, ...otherResults];
        }

        mediaResults = mediaResults.slice(0, 10);

        const formatted = mediaResults
          .map((r, i) => {
            const resultTitle = r.title || r.name || "Unknown";
            const resultYear = (r.releaseDate || r.firstAirDate || "").slice(0, 4);
            const type = r.mediaType === "movie" ? "Movie" : "TV";
            const tmdbUrl = `https://www.themoviedb.org/${r.mediaType}/${r.id}`;
            return `${i + 1}. ${resultTitle} (${resultYear}) - ${type} - TMDB:${r.id} - ${tmdbUrl}`;
          })
          .join("\n");

        const firstPoster = mediaResults[0]?.posterPath
          ? `\n[POSTER:${TMDB_IMAGE_BASE}${mediaResults[0].posterPath}]`
          : "";

        const yearNote = targetYear ? ` (prioritizing ${targetYear})` : "";
        return `Found ${response.totalResults} results${yearNote}. Top matches:\n\n${formatted}${firstPoster}`;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

export const searchMediaTool = createSearchMediaTool({ seerr });
