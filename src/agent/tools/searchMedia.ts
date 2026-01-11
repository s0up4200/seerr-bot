import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { TMDB_IMAGE_BASE } from "../../constants.js";
import { formatErrorMessage } from "../../utils.js";

// Parse year from query like "Anaconda (2025)", "Anaconda 2025", "Anaconda - 2025"
function parseYearFromQuery(query: string): { title: string; year?: string } {
  // Match patterns: (2025), [2025], 2025 at end, - 2025
  const yearPatterns = [
    /\((\d{4})\)\s*$/,      // Title (2025)
    /\[(\d{4})\]\s*$/,      // Title [2025]
    /\s*-\s*(\d{4})\s*$/,   // Title - 2025
    /\s+(\d{4})\s*$/,       // Title 2025
  ];

  for (const pattern of yearPatterns) {
    const match = query.match(pattern);
    if (match) {
      const year = match[1];
      const title = query.replace(pattern, "").trim();
      return { title, year };
    }
  }

  return { title: query };
}

export const searchMediaTool = tool(
  "search_media",
  "Search Seerr for movies or TV shows by title. Returns a list of matching media with their TMDB IDs. Automatically handles year in query (e.g., 'Anaconda 2025' or 'Anaconda (2025)').",
  {
    query: z.string().describe("The search query (movie or TV show title, optionally with year)"),
  },
  async (args) => {
    try {
      // Parse out year if included in query
      const { title, year: targetYear } = parseYearFromQuery(args.query);

      const response = await seerr.search(title);

      if (response.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for "${title}". Try a different search term.`,
            },
          ],
        };
      }

      // Filter to only movies and TV shows
      let mediaResults = response.results
        .filter((r) => r.mediaType === "movie" || r.mediaType === "tv");

      // If year was specified, prioritize matches from that year
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

      // Include poster URL for first result if available
      const firstPoster = mediaResults[0]?.posterPath
        ? `\n[POSTER:${TMDB_IMAGE_BASE}${mediaResults[0].posterPath}]`
        : "";

      const yearNote = targetYear ? ` (prioritizing ${targetYear})` : "";
      return {
        content: [
          {
            type: "text",
            text: `Found ${response.totalResults} results${yearNote}. Top matches:\n\n${formatted}${firstPoster}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching: ${formatErrorMessage(error)}`,
          },
        ],
      };
    }
  }
);
