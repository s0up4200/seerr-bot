import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

// Common TV genre IDs from TMDB
const GENRE_MAP: Record<string, number> = {
  "action & adventure": 10759,
  action: 10759,
  adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  news: 10763,
  reality: 10764,
  "sci-fi & fantasy": 10765,
  "science fiction": 10765,
  "sci-fi": 10765,
  scifi: 10765,
  fantasy: 10765,
  soap: 10766,
  talk: 10767,
  "war & politics": 10768,
  war: 10768,
  western: 37,
};

export const discoverTvTool = tool(
  "discover_tv",
  "Discover TV shows by year, genre, or rating. Use for queries like 'best TV shows of 2025', 'top drama series', 'highest rated sci-fi shows'. Sorted by popularity by default.",
  {
    year: z
      .number()
      .optional()
      .describe("Filter by first air year (e.g., 2025)"),
    genre: z
      .string()
      .optional()
      .describe("Filter by genre name (e.g., 'drama', 'comedy', 'sci-fi')"),
    minRating: z
      .number()
      .optional()
      .describe("Minimum rating (0-10)"),
    sortBy: z
      .enum(["popularity", "rating", "first_air_date"])
      .optional()
      .describe("Sort order. Default: popularity"),
  },
  async (args) => {
    try {
      // Map sort option to API format
      const sortByMap: Record<string, string> = {
        popularity: "popularity.desc",
        rating: "vote_average.desc",
        first_air_date: "first_air_date.desc",
      };

      // Look up genre ID
      const genreId = args.genre
        ? GENRE_MAP[args.genre.toLowerCase()]
        : undefined;

      const response = await seerr.discoverTv({
        year: args.year,
        genre: genreId,
        minRating: args.minRating,
        sortBy: args.sortBy ? sortByMap[args.sortBy] : "popularity.desc",
      });

      if (response.results.length === 0) {
        return {
          content: [{ type: "text", text: "No TV shows found matching criteria." }],
        };
      }

      const results = response.results.slice(0, 10);

      // Build description of filters
      const filters: string[] = [];
      if (args.year) filters.push(`from ${args.year}`);
      if (args.genre) filters.push(`${args.genre}`);
      if (args.minRating) filters.push(`rated ${args.minRating}+`);
      const filterDesc = filters.length > 0 ? ` (${filters.join(", ")})` : "";

      // Format each TV show as a separate section with description and poster
      const sections = results.map((r, i) => {
        const title = r.name || r.title || "Unknown";
        const year = (r.firstAirDate || "").slice(0, 4) || "TBA";
        const rating = r.voteAverage ? `${r.voteAverage.toFixed(1)}/10` : "N/A";
        const tmdbUrl = `https://www.themoviedb.org/tv/${r.id}`;
        const overview = r.overview ? r.overview.slice(0, 200) + (r.overview.length > 200 ? "..." : "") : "No overview available.";
        const poster = r.posterPath ? `\n[POSTER:${TMDB_IMAGE_BASE}${r.posterPath}]` : "";
        return `${i + 1}. ${title} (${year})\nRating: ${rating}\n${tmdbUrl}\n\n${overview}${poster}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Top TV shows${filterDesc}:\n\n${sections.join("\n\n---\n\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error discovering TV shows: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  }
);
