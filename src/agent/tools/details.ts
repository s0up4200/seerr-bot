import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { TMDB_IMAGE_BASE } from "../../constants.js";
import { getMediaStatusText } from "../../utils.js";
import type { SeerrDeps } from "./types.js";

const inputSchema = z.object({
  tmdbId: z.number().describe("The TMDB ID of the media"),
  mediaType: z.enum(["movie", "tv"]).describe("Whether this is a movie or TV show"),
});

export function createGetMediaDetailsTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "get_media_details",
    description: "Get detailed information about a movie or TV show including IMDB ID, status, and seasons (for TV shows).",
    inputSchema,
    run: async ({ tmdbId, mediaType }) => {
      try {
      if (mediaType === "movie") {
        const movie = await deps.seerr.getMovieDetails(tmdbId);
        const status = movie.mediaInfo
          ? getMediaStatusText(movie.mediaInfo.status)
          : "Not Requested";

        const tmdbUrl = `https://www.themoviedb.org/movie/${movie.id}`;
        const imdbUrl = movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}` : null;
        const posterTag = movie.posterPath
          ? `\n[POSTER:${TMDB_IMAGE_BASE}${movie.posterPath}]`
          : "";

        return `Movie: ${movie.title} (${movie.releaseDate?.slice(0, 4) || "N/A"})
Status: ${status}
Rating: ${movie.voteAverage.toFixed(1)}/10
Runtime: ${movie.runtime || "N/A"} minutes
Genres: ${movie.genres.map((g) => g.name).join(", ")}
TMDB: ${tmdbUrl}${imdbUrl ? `\nIMDB: ${imdbUrl}` : ""}

Overview: ${movie.overview || "No overview available."}${posterTag}`;
      } else {
        const tv = await deps.seerr.getTvDetails(tmdbId);
        const status = tv.mediaInfo
          ? getMediaStatusText(tv.mediaInfo.status)
          : "Not Requested";

        const tmdbUrl = `https://www.themoviedb.org/tv/${tv.id}`;
        const imdbUrl = tv.externalIds?.imdbId
          ? `https://www.imdb.com/title/${tv.externalIds.imdbId}`
          : null;
        const posterTag = tv.posterPath
          ? `\n[POSTER:${TMDB_IMAGE_BASE}${tv.posterPath}]`
          : "";

        const seasonList = tv.seasons
          .filter((s) => s.seasonNumber > 0)
          .map(
            (s) =>
              `  S${s.seasonNumber}: ${s.episodeCount} eps${s.airDate ? ` (${s.airDate.slice(0, 4)})` : ""}`
          )
          .join("\n");

        return `TV Show: ${tv.name} (${tv.firstAirDate?.slice(0, 4) || "N/A"})
Status: ${status}
Rating: ${tv.voteAverage.toFixed(1)}/10
Seasons: ${tv.numberOfSeasons} (${tv.numberOfEpisodes} episodes)
Genres: ${tv.genres.map((g) => g.name).join(", ")}
Show Status: ${tv.status}
TMDB: ${tmdbUrl}${imdbUrl ? `\nIMDB: ${imdbUrl}` : ""}

${seasonList}

Overview: ${tv.overview || "No overview available."}${posterTag}`;
      }
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

export const getMediaDetailsTool = createGetMediaDetailsTool({ seerr });
