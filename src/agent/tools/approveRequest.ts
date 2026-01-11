import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { formatErrorMessage } from "../../utils.js";

export const approveRequestTool = tool(
  "approve_request",
  "Approve a pending media request in Seerr. This will send the request to Radarr/Sonarr for downloading.",
  {
    requestId: z
      .number()
      .describe("The request ID to approve (shown as #ID in list_requests)"),
  },
  async (args) => {
    try {
      const response = await seerr.approveRequest(args.requestId);

      const title =
        response.media.title || response.media.name || `TMDB ${response.media.tmdbId}`;
      const type = response.type === "movie" ? "Movie" : "TV Show";

      return {
        content: [
          {
            type: "text",
            text: `Approved request #${args.requestId}!\n${type}: ${title}\nThe request has been sent to ${response.type === "movie" ? "Radarr" : "Sonarr"} for processing.`,
          },
        ],
      };
    } catch (error) {
      const message = formatErrorMessage(error);

      if (message.includes("403")) {
        return {
          content: [
            {
              type: "text",
              text: "Permission denied. The API key doesn't have MANAGE_REQUESTS permission to approve requests.",
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
            text: `Error approving request: ${message}`,
          },
        ],
      };
    }
  }
);
