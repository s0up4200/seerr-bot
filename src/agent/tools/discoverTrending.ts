import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

export const discoverTrendingTool = tool(
  "discover_trending",
  "Get trending movies and TV shows right now. Use this when users ask 'what's trending', 'what's popular', or 'what's hot'.",
  {
    mediaType: z
      .enum(["movie", "tv", "all"])
      .optional()
      .describe("Filter by media type. Default: all"),
  },
  async (args) => {
    try {
      const response = await seerr.discoverTrending();

      if (response.results.length === 0) {
        return {
          content: [{ type: "text", text: "No trending content found." }],
        };
      }

      // Filter by media type if specified
      let results = response.results;
      if (args.mediaType && args.mediaType !== "all") {
        results = results.filter((r) => r.mediaType === args.mediaType);
      }

      // Filter out people, only show movies and TV
      results = results
        .filter((r) => r.mediaType === "movie" || r.mediaType === "tv")
        .slice(0, 10);

      // Format each item as a separate section with description and poster
      const sections = results.map((r, i) => {
        const title = r.title || r.name || "Unknown";
        const year = (r.releaseDate || r.firstAirDate || "").slice(0, 4);
        const type = r.mediaType === "movie" ? "Movie" : "TV";
        const rating = r.voteAverage?.toFixed(1) || "N/A";
        const tmdbUrl = `https://www.themoviedb.org/${r.mediaType}/${r.id}`;
        const overview = r.overview ? r.overview.slice(0, 200) + (r.overview.length > 200 ? "..." : "") : "No overview available.";
        const poster = r.posterPath ? `\n[POSTER:${TMDB_IMAGE_BASE}${r.posterPath}]` : "";
        return `${i + 1}. ${title} (${year}) - ${type}\nRating: ${rating}/10\n${tmdbUrl}\n\n${overview}${poster}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Trending now:\n\n${sections.join("\n\n---\n\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching trending: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  }
);
