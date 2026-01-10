import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

// Common genre IDs from TMDB
const GENRE_MAP: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "science fiction": 878,
  "sci-fi": 878,
  scifi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

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
        ? GENRE_MAP[args.genre.toLowerCase()]
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

      // Format each movie as a separate section with description and poster
      const sections = results.map((r, i) => {
        const title = r.title || r.name || "Unknown";
        const year = (r.releaseDate || "").slice(0, 4) || "TBA";
        const rating = r.voteAverage ? `${r.voteAverage.toFixed(1)}/10` : "N/A";
        const tmdbUrl = `https://www.themoviedb.org/movie/${r.id}`;
        const overview = r.overview ? r.overview.slice(0, 200) + (r.overview.length > 200 ? "..." : "") : "No overview available.";
        const poster = r.posterPath ? `\n[POSTER:${TMDB_IMAGE_BASE}${r.posterPath}]` : "";
        return `${i + 1}. ${title} (${year})\nRating: ${rating}\n${tmdbUrl}\n\n${overview}${poster}`;
      });

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
            text: `Error discovering movies: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  }
);
