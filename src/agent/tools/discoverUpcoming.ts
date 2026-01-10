import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

export const discoverUpcomingTool = tool(
  "discover_upcoming",
  "Get upcoming movies or TV shows that are coming soon. Use this when users ask 'what's coming out', 'upcoming releases', or 'what's new'.",
  {
    mediaType: z
      .enum(["movie", "tv"])
      .describe("Whether to get upcoming movies or TV shows"),
  },
  async (args) => {
    try {
      const response =
        args.mediaType === "movie"
          ? await seerr.discoverUpcomingMovies()
          : await seerr.discoverUpcomingTv();

      if (response.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No upcoming ${args.mediaType === "movie" ? "movies" : "TV shows"} found.`,
            },
          ],
        };
      }

      const results = response.results.slice(0, 10);
      const typeLabel = args.mediaType === "movie" ? "movies" : "TV shows";

      // Format each item as a separate section with description and poster
      const sections = results.map((r, i) => {
        const title = r.title || r.name || "Unknown";
        const date = r.releaseDate || r.firstAirDate || "TBA";
        const rating = r.voteAverage ? `${r.voteAverage.toFixed(1)}/10` : "Not rated";
        const tmdbUrl = `https://www.themoviedb.org/${args.mediaType}/${r.id}`;
        const overview = r.overview ? r.overview.slice(0, 200) + (r.overview.length > 200 ? "..." : "") : "No overview available.";
        const poster = r.posterPath ? `\n[POSTER:${TMDB_IMAGE_BASE}${r.posterPath}]` : "";
        return `${i + 1}. ${title} (${date})\nRating: ${rating}\n${tmdbUrl}\n\n${overview}${poster}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Upcoming ${typeLabel}:\n\n${sections.join("\n\n---\n\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching upcoming: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  }
);
