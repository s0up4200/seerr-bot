import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const inputSchema = z.object({
  tmdbId: z.number().describe("The TMDB ID of the media"),
  mediaType: z.enum(["movie", "tv"]).describe("Movie or TV"),
  seasons: z.array(z.number()).optional().describe("For TV: array of season numbers to request"),
});

export function createRequestMediaTool() {
  return betaZodTool({
    name: "request_media",
    description:
      "Prepare a media request for user confirmation. Returns a pending request tag that the Discord interface presents with confirm/cancel buttons. Does NOT submit to Seerr directly.",
    inputSchema,
    run: async ({ tmdbId, mediaType, seasons }) => {
      if (mediaType === "tv" && (!seasons || seasons.length === 0)) {
        return "Error: For TV shows, you must specify which seasons to request. Use get_media_details first to see available seasons.";
      }

      const payload: Record<string, unknown> = { tmdbId, mediaType };
      if (seasons) {
        payload.seasons = seasons.sort((a, b) => a - b);
      }

      const seasonsList =
        mediaType === "tv" && seasons
          ? ` (Seasons ${seasons.sort((a, b) => a - b).join(", ")})`
          : "";

      return `Request prepared for confirmation.${seasonsList}

[PENDING_REQUEST:${JSON.stringify(payload)}]`;
    },
  });
}

export const requestMediaTool = createRequestMediaTool();
