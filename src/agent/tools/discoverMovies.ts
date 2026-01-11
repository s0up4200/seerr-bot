import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { MOVIE_GENRE_MAP } from "../../constants.js";
import { formatErrorMessage, formatMediaResult } from "../../utils.js";

export const discoverMoviesTool = tool(
  "discover_movies",
  "Discover movies by year, genre, or rating. Use for queries like 'top films of 2026', 'best comedy movies', 'highest rated sci-fi'. Sorted by popularity by default.",
  {
    year: z
      .number()
      .optional()
      .describe("Filter by release year (e.g., 2026)"),
    genre: z
      .string()
      .optional()
      .describe("Filter by genre name (e.g., 'comedy', 'sci-fi', 'horror')"),
    minRating: z
      .number()
      .optional()
      .describe("Minimum rating (0-10)"),
    sortBy: z
      .enum(["popularity", "rating", "release_date"])
      .optional()
      .describe("Sort order. Default: popularity"),
  },
  async (args) => {
    try {
      // Map sort option to API format
      const sortByMap: Record<string, string> = {
        popularity: "popularity.desc",
        rating: "vote_average.desc",
        release_date: "release_date.desc",
      };

      // Look up genre ID
      const genreId = args.genre
        ? MOVIE_GENRE_MAP[args.genre.toLowerCase()]
        : undefined;

      const response = await seerr.discoverMovies({
        year: args.year,
        genre: genreId,
        minRating: args.minRating,
        sortBy: args.sortBy ? sortByMap[args.sortBy] : "popularity.desc",
      });

      if (response.results.length === 0) {
        return {
          content: [{ type: "text", text: "No movies found matching criteria." }],
        };
      }

      const results = response.results.slice(0, 10);

      // Build description of filters
      const filters: string[] = [];
      if (args.year) filters.push(`from ${args.year}`);
      if (args.genre) filters.push(`${args.genre}`);
      if (args.minRating) filters.push(`rated ${args.minRating}+`);
      const filterDesc = filters.length > 0 ? ` (${filters.join(", ")})` : "";

      const sections = results.map((r, i) => formatMediaResult(r, i, "movie"));

      return {
        content: [
          {
            type: "text",
            text: `Top movies${filterDesc}:\n\n${sections.join("\n\n---\n\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error discovering movies: ${formatErrorMessage(error)}`,
          },
        ],
      };
    }
  }
);
