import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { RequestStatus } from "../../types/index.js";
import { formatErrorMessage } from "../../utils.js";

function getRequestStatusText(status: number): string {
  switch (status) {
    case RequestStatus.APPROVED:
      return "Approved";
    case RequestStatus.PENDING:
      return "Pending Approval";
    case RequestStatus.DECLINED:
      return "Declined";
    case RequestStatus.FAILED:
      return "Failed";
    default:
      return "Unknown";
  }
}

export const requestMediaTool = tool(
  "request_media",
  "Submit a media request to Seerr. For movies, no seasons needed. For TV shows, you MUST specify which seasons to request.",
  {
    tmdbId: z.number().describe("The TMDB ID of the media to request"),
    mediaType: z
      .enum(["movie", "tv"])
      .describe("Whether this is a movie or TV show"),
    seasons: z
      .array(z.number())
      .optional()
      .describe(
        "For TV shows: array of season numbers to request (e.g., [1, 2, 3] for seasons 1-3). Required for TV requests."
      ),
  },
  async (args) => {
    try {
      if (args.mediaType === "movie") {
        const response = await seerr.requestMovie(args.tmdbId);
        const status = getRequestStatusText(response.status);

        return {
          content: [
            {
              type: "text",
              text: `Movie request submitted successfully!
Request ID: ${response.id}
Status: ${status}
Created: ${new Date(response.createdAt).toLocaleString()}`,
            },
          ],
        };
      } else {
        // TV show request
        if (!args.seasons || args.seasons.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Error: For TV shows, you must specify which seasons to request. Use get_media_details first to see available seasons.",
              },
            ],
          };
        }

        const response = await seerr.requestTv(args.tmdbId, args.seasons);
        const status = getRequestStatusText(response.status);

        const seasonsList = args.seasons.sort((a, b) => a - b).join(", ");

        return {
          content: [
            {
              type: "text",
              text: `TV show request submitted successfully!
Request ID: ${response.id}
Seasons requested: ${seasonsList}
Status: ${status}
Created: ${new Date(response.createdAt).toLocaleString()}`,
            },
          ],
        };
      }
    } catch (error) {
      const message = formatErrorMessage(error);

      if (message.includes("409") || message.includes("already")) {
        return {
          content: [
            {
              type: "text",
              text: "This media has already been requested or is already available.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Error submitting request: ${message}`,
          },
        ],
      };
    }
  }
);
