import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import type { MediaRequestItem } from "../../types/index.js";
import { getRequestStatusText, formatErrorMessage } from "../../utils.js";

interface MediaTitleInfo {
  title: string;
  year: string;
}

async function fetchMediaTitle(req: MediaRequestItem): Promise<MediaTitleInfo> {
  try {
    if (req.type === "movie") {
      const details = await seerr.getMovieDetails(req.media.tmdbId);
      return {
        title: details.title,
        year: details.releaseDate?.slice(0, 4) || "",
      };
    } else {
      const details = await seerr.getTvDetails(req.media.tmdbId);
      return {
        title: details.name,
        year: details.firstAirDate?.slice(0, 4) || "",
      };
    }
  } catch {
    return {
      title: `Unknown (TMDB ${req.media.tmdbId})`,
      year: "",
    };
  }
}

export const listRequestsTool = tool(
  "list_requests",
  "List media requests in Seerr. Shows who requested what and the current status. Default shows pending requests awaiting approval.",
  {
    filter: z
      .enum(["pending", "approved", "processing", "available", "failed"])
      .optional()
      .describe(
        "Filter requests by status. Default: pending. Options: pending, approved, processing, available, failed"
      ),
  },
  async (args) => {
    try {
      const filter = args.filter || "pending";
      const response = await seerr.listRequests(filter);

      if (response.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No ${filter} requests found.`,
            },
          ],
        };
      }

      // Fetch actual titles for all requests in parallel
      const mediaInfoPromises = response.results.map((req) => fetchMediaTitle(req));
      const mediaInfos = await Promise.all(mediaInfoPromises);

      const formatted = response.results
        .map((req, index) => {
          const { title, year } = mediaInfos[index];
          const type = req.type === "movie" ? "Movie" : "TV";
          const status = getRequestStatusText(req.status);
          const requester = req.requestedBy.displayName || req.requestedBy.username || req.requestedBy.email.split("@")[0];
          const date = new Date(req.createdAt).toLocaleDateString();

          let seasonInfo = "";
          if (req.type === "tv" && req.seasons && req.seasons.length > 0) {
            const seasonNums = req.seasons.map((s) => s.seasonNumber).join(", ");
            seasonInfo = ` S${seasonNums}`;
          }

          const yearStr = year ? ` (${year})` : "";
          return `#${req.id}: ${title}${yearStr} - ${type}${seasonInfo} | Requested by: ${requester} | Status: ${status} | ${date}`;
        })
        .join("\n");

      const total = response.pageInfo.results;
      const shown = response.results.length;

      return {
        content: [
          {
            type: "text",
            text: `${filter.charAt(0).toUpperCase() + filter.slice(1)} requests (${shown}${total > shown ? ` of ${total}` : ""}):\n\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing requests: ${formatErrorMessage(error)}`,
          },
        ],
      };
    }
  }
);
