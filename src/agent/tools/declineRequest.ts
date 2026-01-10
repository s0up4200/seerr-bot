import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";

export const declineRequestTool = tool(
  "decline_request",
  "Decline a pending media request in Seerr. The requester will be notified that their request was declined.",
  {
    requestId: z
      .number()
      .describe("The request ID to decline (shown as #ID in list_requests)"),
  },
  async (args) => {
    try {
      const response = await seerr.declineRequest(args.requestId);

      const title =
        response.media.title || response.media.name || `TMDB ${response.media.tmdbId}`;
      const type = response.type === "movie" ? "Movie" : "TV Show";

      return {
        content: [
          {
            type: "text",
            text: `Declined request #${args.requestId}.\n${type}: ${title}\nThe requester will be notified.`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message.includes("403")) {
        return {
          content: [
            {
              type: "text",
              text: "Permission denied. The API key doesn't have MANAGE_REQUESTS permission to decline requests.",
            },
          ],
        };
      }

      if (message.includes("404")) {
        return {
          content: [
            {
              type: "text",
              text: `Request #${args.requestId} not found. Use list_requests to see available requests.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Error declining request: ${message}`,
          },
        ],
      };
    }
  }
);
