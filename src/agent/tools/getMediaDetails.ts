import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { MediaStatus } from "../../types/index.js";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

function getStatusText(status: number): string {
  switch (status) {
    case MediaStatus.AVAILABLE:
      return "Available";
    case MediaStatus.PARTIALLY_AVAILABLE:
      return "Partially Available";
    case MediaStatus.PROCESSING:
      return "Processing";
    case MediaStatus.PENDING:
      return "Pending";
    case MediaStatus.BLACKLISTED:
      return "Blacklisted";
    default:
      return "Not Requested";
  }
}

export const getMediaDetailsTool = tool(
  "get_media_details",
  "Get detailed information about a movie or TV show including IMDB ID, status, and seasons (for TV shows).",
  {
    tmdbId: z.number().describe("The TMDB ID of the media"),
    mediaType: z
      .enum(["movie", "tv"])
      .describe("Whether this is a movie or TV show"),
  },
  async (args) => {
    try {
      if (args.mediaType === "movie") {
        const movie = await seerr.getMovieDetails(args.tmdbId);
        const status = movie.mediaInfo
          ? getStatusText(movie.mediaInfo.status)
          : "Not Requested";

        const tmdbUrl = `https://www.themoviedb.org/movie/${movie.id}`;
        const imdbUrl = movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}` : null;
        const posterTag = movie.posterPath ? `\n[POSTER:${TMDB_IMAGE_BASE}${movie.posterPath}]` : "";

        return {
          content: [
            {
              type: "text",
              text: `Movie: ${movie.title} (${movie.releaseDate?.slice(0, 4) || "N/A"})
Status: ${status}
Rating: ${movie.voteAverage.toFixed(1)}/10
Runtime: ${movie.runtime || "N/A"} minutes
Genres: ${movie.genres.map((g) => g.name).join(", ")}
TMDB: ${tmdbUrl}${imdbUrl ? `\nIMDB: ${imdbUrl}` : ""}

Overview: ${movie.overview || "No overview available."}${posterTag}`,
            },
          ],
        };
      } else {
        const tv = await seerr.getTvDetails(args.tmdbId);
        const status = tv.mediaInfo
          ? getStatusText(tv.mediaInfo.status)
          : "Not Requested";

        const tmdbUrl = `https://www.themoviedb.org/tv/${tv.id}`;
        const imdbUrl = tv.externalIds?.imdbId ? `https://www.imdb.com/title/${tv.externalIds.imdbId}` : null;
        const posterTag = tv.posterPath ? `\n[POSTER:${TMDB_IMAGE_BASE}${tv.posterPath}]` : "";

        const seasonList = tv.seasons
          .filter((s) => s.seasonNumber > 0) // Exclude specials (season 0)
          .map(
            (s) =>
              `  S${s.seasonNumber}: ${s.episodeCount} eps${s.airDate ? ` (${s.airDate.slice(0, 4)})` : ""}`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `TV Show: ${tv.name} (${tv.firstAirDate?.slice(0, 4) || "N/A"})
Status: ${status}
Rating: ${tv.voteAverage.toFixed(1)}/10
Seasons: ${tv.numberOfSeasons} (${tv.numberOfEpisodes} episodes)
Genres: ${tv.genres.map((g) => g.name).join(", ")}
Show Status: ${tv.status}
TMDB: ${tmdbUrl}${imdbUrl ? `\nIMDB: ${imdbUrl}` : ""}

${seasonList}

Overview: ${tv.overview || "No overview available."}${posterTag}`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting details: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  }
);
