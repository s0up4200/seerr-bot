import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { getMediaStatusText } from "../../utils.js";
import { MediaStatus } from "../../types/index.js";
import type { SeerrDeps } from "./types.js";

const inputSchema = z.object({
  tmdbId: z.number().describe("The TMDB ID of the media"),
  mediaType: z.enum(["movie", "tv"]).describe("Movie or TV"),
  seasons: z.array(z.number()).optional().describe("For TV: array of season numbers to request"),
});

export function createRequestMediaTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "request_media",
    description:
      "Prepare a media request for user confirmation. Checks if the media is already requested/available before proceeding. The Discord interface will show confirm/cancel buttons. Does NOT submit to Seerr directly.",
    inputSchema,
    run: async ({ tmdbId, mediaType, seasons }) => {
      if (mediaType === "tv" && (!seasons || seasons.length === 0)) {
        return "Error: For TV shows, you must specify which seasons to request. Use get_media_details first to see available seasons.";
      }

      // Pre-check: verify the media isn't already requested/available
      try {
        if (mediaType === "movie") {
          const details = await deps.seerr.getMovieDetails(tmdbId);
          if (details.mediaInfo) {
            const status = getMediaStatusText(details.mediaInfo.status);
            if (status !== "Not Requested") {
              return `Cannot request: ${details.title} is already ${status}.`;
            }
          }
        } else {
          const details = await deps.seerr.getTvDetails(tmdbId);
          if (details.mediaInfo) {
            // Fast path: entire show is available
            if (details.mediaInfo.status === MediaStatus.AVAILABLE) {
              return `Cannot request: ${details.name} is already fully available.`;
            }

            // Season-level check: block if ALL requested seasons are already covered
            const seasonStatuses = details.mediaInfo.seasons ?? [];
            if (seasonStatuses.length && seasons) {
              const coveredEntries = seasons
                .map((s) => seasonStatuses.find((si) => si.seasonNumber === s))
                .filter((si) => si && si.status !== MediaStatus.UNKNOWN);

              if (coveredEntries.length === seasons.length) {
                const statusList = coveredEntries
                  .map((si) => `S${si!.seasonNumber}: ${getMediaStatusText(si!.status)}`)
                  .join(", ");
                return `Cannot request: all requested seasons are already covered (${statusList}).`;
              }
            }
          }
        }
      } catch {
        // If status check fails, proceed anyway — the actual submission will catch errors
      }

      const seasonsList = seasons
        ? ` Seasons: ${seasons.sort((a, b) => a - b).join(", ")}.`
        : "";

      return `Request prepared for user confirmation.${seasonsList} Confirmation buttons have been added to the message.`;
    },
  });
}

export const requestMediaTool = createRequestMediaTool({ seerr });
