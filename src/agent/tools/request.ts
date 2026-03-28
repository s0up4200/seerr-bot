import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { getRequestStatusText } from "../../utils.js";
import type { SeerrDeps } from "./types.js";

const inputSchema = z.object({
  tmdbId: z.number().describe("The TMDB ID of the media"),
  mediaType: z.enum(["movie", "tv"]).describe("Movie or TV"),
  seasons: z.array(z.number()).optional().describe("For TV: array of season numbers to request"),
});

export function createRequestMediaTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "request_media",
    description: "Submit a media request to Seerr. For movies, no seasons needed. For TV shows, you MUST specify which seasons.",
    inputSchema,
    run: async ({ tmdbId, mediaType, seasons }) => {
      try {
        if (mediaType === "movie") {
          const response = await deps.seerr.requestMovie(tmdbId);
          const status = getRequestStatusText(response.status);
          return `Movie request submitted successfully!
Request ID: ${response.id}
Status: ${status}
Created: ${new Date(response.createdAt).toLocaleString()}`;
        } else {
          if (!seasons || seasons.length === 0) {
            return "Error: For TV shows, you must specify which seasons to request. Use get_media_details first to see available seasons.";
          }
          const response = await deps.seerr.requestTv(tmdbId, seasons);
          const status = getRequestStatusText(response.status);
          const seasonsList = seasons.sort((a, b) => a - b).join(", ");
          return `TV show request submitted successfully!
Request ID: ${response.id}
Seasons requested: ${seasonsList}
Status: ${status}
Created: ${new Date(response.createdAt).toLocaleString()}`;
        }
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

export const requestMediaTool = createRequestMediaTool({ seerr });
