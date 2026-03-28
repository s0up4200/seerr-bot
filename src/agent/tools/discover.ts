import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { MOVIE_GENRE_MAP, TV_GENRE_MAP } from "../../constants.js";
import { formatMediaResult } from "../../utils.js";
import type { SeerrDeps } from "./types.js";

function buildFilterDescription(input: {
  year?: number;
  genre?: string;
  minRating?: number;
}): string {
  const filters: string[] = [];
  if (input.year) filters.push(`from ${input.year}`);
  if (input.genre) filters.push(`${input.genre}`);
  if (input.minRating) filters.push(`rated ${input.minRating}+`);
  return filters.length > 0 ? ` (${filters.join(", ")})` : "";
}

export function createDiscoverTrendingTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "discover_trending",
    description: "Get trending movies and TV shows right now.",
    inputSchema: z.object({
      mediaType: z
        .enum(["movie", "tv", "all"])
        .optional()
        .describe("Filter by media type. Default: all"),
    }),
    run: async ({ mediaType }) => {
      try {
        const response = await deps.seerr.discoverTrending();
        if (response.results.length === 0) {
          return "No trending content found.";
        }

        let results = response.results;
        if (mediaType && mediaType !== "all") {
          results = results.filter((r) => r.mediaType === mediaType);
        }
        results = results
          .filter((r) => r.mediaType === "movie" || r.mediaType === "tv")
          .slice(0, 10);

        const sections = results.map((r, i) =>
          formatMediaResult(r, i, r.mediaType as "movie" | "tv", {
            showMediaType: true,
          })
        );
        return `Trending now:\n\n${sections.join("\n\n---\n\n")}`;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

export function createDiscoverUpcomingTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "discover_upcoming",
    description: "Get upcoming movies or TV shows coming soon.",
    inputSchema: z.object({
      mediaType: z.enum(["movie", "tv"]).describe("Movies or TV shows"),
    }),
    run: async ({ mediaType }) => {
      try {
        const response =
          mediaType === "movie"
            ? await deps.seerr.discoverUpcomingMovies()
            : await deps.seerr.discoverUpcomingTv();

        if (response.results.length === 0) {
          return `No upcoming ${mediaType === "movie" ? "movies" : "TV shows"} found.`;
        }

        const results = response.results.slice(0, 10);
        const typeLabel = mediaType === "movie" ? "movies" : "TV shows";
        const sections = results.map((r, i) =>
          formatMediaResult(r, i, mediaType, { useFullDate: true })
        );
        return `Upcoming ${typeLabel}:\n\n${sections.join("\n\n---\n\n")}`;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

export function createDiscoverMoviesTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "discover_movies",
    description: "Discover movies by year, genre, or rating.",
    inputSchema: z.object({
      year: z.number().optional().describe("Filter by release year"),
      genre: z.string().optional().describe("Filter by genre name"),
      minRating: z.number().optional().describe("Minimum rating (0-10)"),
      sortBy: z
        .enum(["popularity", "rating", "release_date"])
        .optional()
        .describe("Sort order. Default: popularity"),
    }),
    run: async ({ year, genre, minRating, sortBy }) => {
      try {
        const sortByMap: Record<string, string> = {
          popularity: "popularity.desc",
          rating: "vote_average.desc",
          release_date: "release_date.desc",
        };

        const genreId = genre ? MOVIE_GENRE_MAP[genre.toLowerCase()] : undefined;

        const response = await deps.seerr.discoverMovies({
          year,
          genre: genreId,
          minRating,
          sortBy: sortBy ? sortByMap[sortBy] : "popularity.desc",
        });

        if (response.results.length === 0) {
          return "No movies found matching criteria.";
        }

        const results = response.results.slice(0, 10);
        const sections = results.map((r, i) => formatMediaResult(r, i, "movie"));
        return `Top movies${buildFilterDescription({ year, genre, minRating })}:\n\n${sections.join("\n\n---\n\n")}`;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

export function createDiscoverTvTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "discover_tv",
    description: "Discover TV shows by year, genre, or rating.",
    inputSchema: z.object({
      year: z.number().optional().describe("Filter by first air year"),
      genre: z.string().optional().describe("Filter by genre name"),
      minRating: z.number().optional().describe("Minimum rating (0-10)"),
      sortBy: z
        .enum(["popularity", "rating", "first_air_date"])
        .optional()
        .describe("Sort order. Default: popularity"),
    }),
    run: async ({ year, genre, minRating, sortBy }) => {
      try {
        const sortByMap: Record<string, string> = {
          popularity: "popularity.desc",
          rating: "vote_average.desc",
          first_air_date: "first_air_date.desc",
        };

        const genreId = genre ? TV_GENRE_MAP[genre.toLowerCase()] : undefined;

        const response = await deps.seerr.discoverTv({
          year,
          genre: genreId,
          minRating,
          sortBy: sortBy ? sortByMap[sortBy] : "popularity.desc",
        });

        if (response.results.length === 0) {
          return "No TV shows found matching criteria.";
        }

        const results = response.results.slice(0, 10);
        const sections = results.map((r, i) => formatMediaResult(r, i, "tv"));
        return `Top TV shows${buildFilterDescription({ year, genre, minRating })}:\n\n${sections.join("\n\n---\n\n")}`;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

export const discoverTrendingTool = createDiscoverTrendingTool({ seerr });
export const discoverUpcomingTool = createDiscoverUpcomingTool({ seerr });
export const discoverMoviesTool = createDiscoverMoviesTool({ seerr });
export const discoverTvTool = createDiscoverTvTool({ seerr });
