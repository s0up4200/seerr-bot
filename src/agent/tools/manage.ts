import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { seerr } from "../../services/seerr.js";
import { getRequestStatusText, formatErrorMessage } from "../../utils.js";
import type { SeerrDeps } from "./types.js";
import type { MediaRequestItem, RequestFilter } from "../../types/index.js";

async function fetchMediaTitle(
  deps: { seerr: SeerrDeps },
  req: MediaRequestItem
): Promise<{ title: string; year: string }> {
  try {
    if (req.type === "movie") {
      const details = await deps.seerr.getMovieDetails(req.media.tmdbId);
      return { title: details.title, year: details.releaseDate?.slice(0, 4) || "" };
    } else {
      const details = await deps.seerr.getTvDetails(req.media.tmdbId);
      return { title: details.name, year: details.firstAirDate?.slice(0, 4) || "" };
    }
  } catch {
    return { title: `Unknown (TMDB ${req.media.tmdbId})`, year: "" };
  }
}

function formatRequestError(error: unknown, requestId: number, action: string): string {
  const message = formatErrorMessage(error);
  if (message.includes("403")) {
    return "Permission denied. The API key doesn't have MANAGE_REQUESTS permission.";
  }
  if (message.includes("404")) {
    return `Request #${requestId} not found. Use list_requests to see available requests.`;
  }
  return `Error ${action} request: ${message}`;
}

const listInputSchema = z.object({
  filter: z
    .enum(["pending", "approved", "processing", "available", "failed"])
    .optional()
    .describe("Filter by status. Default: pending"),
});

const requestIdSchema = z.object({
  requestId: z.number().describe("The request ID"),
});

export function createListRequestsTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "list_requests",
    description: "List media requests in Seerr. Default shows pending requests.",
    inputSchema: listInputSchema,
    run: async ({ filter }) => {
      try {
        const filterValue = (filter || "pending") as RequestFilter;
        const response = await deps.seerr.listRequests(filterValue, 20);

        if (response.results.length === 0) {
          return `No ${filterValue} requests found.`;
        }

        const mediaInfoPromises = response.results.map((req) =>
          fetchMediaTitle(deps, req)
        );
        const mediaInfos = await Promise.all(mediaInfoPromises);

        const formatted = response.results
          .map((req, index) => {
            const { title, year } = mediaInfos[index];
            const type = req.type === "movie" ? "Movie" : "TV";
            const status = getRequestStatusText(req.status);
            const requester =
              req.requestedBy.displayName ||
              req.requestedBy.username ||
              req.requestedBy.email.split("@")[0];
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
        return `${filterValue.charAt(0).toUpperCase() + filterValue.slice(1)} requests (${shown}${total > shown ? ` of ${total}` : ""}):\n\n${formatted}`;
      } catch (error) {
        return `Error: ${formatErrorMessage(error)}`;
      }
    },
  });
}

export function createApproveRequestTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "approve_request",
    description: "Approve a pending media request.",
    inputSchema: requestIdSchema,
    run: async ({ requestId }) => {
      try {
        const response = await deps.seerr.approveRequest(requestId);
        const title =
          response.media.title || response.media.name || `TMDB ${response.media.tmdbId}`;
        const type = response.type === "movie" ? "Movie" : "TV Show";
        const processor = response.type === "movie" ? "Radarr" : "Sonarr";
        return `Approved request #${requestId}!\n${type}: ${title}\nThe request has been sent to ${processor} for processing.`;
      } catch (error) {
        return formatRequestError(error, requestId, "approving");
      }
    },
  });
}

export function createDeclineRequestTool(deps: { seerr: SeerrDeps }) {
  return betaZodTool({
    name: "decline_request",
    description: "Decline a pending media request.",
    inputSchema: requestIdSchema,
    run: async ({ requestId }) => {
      try {
        const response = await deps.seerr.declineRequest(requestId);
        const title =
          response.media.title || response.media.name || `TMDB ${response.media.tmdbId}`;
        const type = response.type === "movie" ? "Movie" : "TV Show";
        return `Declined request #${requestId}.\n${type}: ${title}\nThe requester will be notified.`;
      } catch (error) {
        return formatRequestError(error, requestId, "declining");
      }
    },
  });
}

export const listRequestsTool = createListRequestsTool({ seerr });
export const approveRequestTool = createApproveRequestTool({ seerr });
export const declineRequestTool = createDeclineRequestTool({ seerr });
