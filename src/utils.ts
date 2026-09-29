import { MediaStatus, RequestStatus } from "./types/index.js";
import type { DiscoverResult } from "./types/index.js";
import { TMDB_IMAGE_BASE } from "./constants.js";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta.js";

export function getMediaStatusText(status: number): string {
  switch (status) {
    case MediaStatus.AVAILABLE:
      return "Available";
    case MediaStatus.PARTIALLY_AVAILABLE:
      return "Partially Available";
    case MediaStatus.PROCESSING:
      return "Requested";
    case MediaStatus.PENDING:
      return "Pending";
    case MediaStatus.BLACKLISTED:
      return "Blacklisted";
    default:
      return "Not Requested";
  }
}

export function getRequestStatusText(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.PENDING:
      return "Pending";
    case RequestStatus.APPROVED:
      return "Approved";
    case RequestStatus.DECLINED:
      return "Declined";
    case RequestStatus.FAILED:
      return "Failed";
    case RequestStatus.COMPLETED:
      return "Completed";
    default:
      return "Unknown";
  }
}

export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getPosterTag(posterPath: string | null | undefined): string {
  return posterPath ? `\n[POSTER:${TMDB_IMAGE_BASE}${posterPath}]` : "";
}

function truncateOverview(overview: string | undefined, maxLength = 200): string {
  if (!overview) {
    return "No overview available.";
  }
  if (overview.length <= maxLength) {
    return overview;
  }
  return overview.slice(0, maxLength) + "...";
}

export interface FormatMediaResultOptions {
  /** Show "Movie" or "TV" label after the title (for mixed results) */
  showMediaType?: boolean;
  /** Show full date (YYYY-MM-DD) instead of just year (for upcoming) */
  useFullDate?: boolean;
}

export function formatMediaResult(
  result: DiscoverResult,
  index: number,
  mediaType: "movie" | "tv",
  options: FormatMediaResultOptions = {}
): string {
  const { showMediaType = false, useFullDate = false } = options;

  const title = result.title || result.name || "Unknown";
  const dateField = mediaType === "movie" ? result.releaseDate : result.firstAirDate;
  const dateDisplay = useFullDate
    ? dateField || "TBA"
    : (dateField || "").slice(0, 4) || "TBA";
  const typeLabel = showMediaType ? ` - ${mediaType === "movie" ? "Movie" : "TV"}` : "";
  const rating = result.voteAverage ? `${result.voteAverage.toFixed(1)}/10` : "N/A";
  const tmdbUrl = `https://www.themoviedb.org/${mediaType}/${result.id}`;
  const overview = truncateOverview(result.overview);
  const poster = getPosterTag(result.posterPath);

  return `${index + 1}. ${title} (${dateDisplay})${typeLabel}\nRating: ${rating}\n${tmdbUrl}\n\n${overview}${poster}`;
}

export const POSTER_REGEX = /\[POSTER:(https:\/\/[^\]]+)\]/g;

// Text after the last poster tag, such as a question to the user, belongs
// outside the embeds. If no text comes before the tag, nothing is split off.
export function splitTrailingText(text: string): { body: string; trailing: string } {
  const last = [...text.matchAll(POSTER_REGEX)].at(-1);
  if (!last || !text.slice(0, last.index).replace(POSTER_REGEX, "").trim()) {
    return { body: text, trailing: "" };
  }
  const end = last.index + last[0].length;
  return { body: text.slice(0, end), trailing: text.slice(end).trim() };
}

export interface PendingRequest {
  tmdbId: number;
  mediaType: "movie" | "tv";
  seasons?: number[];
}

// Returns the text of the tool result for a tool_use block in messages[i], if any.
function toolResultText(messages: BetaMessageParam[], i: number, toolUseId: string): string | undefined {
  const resultMsg = messages[i + 1];
  if (resultMsg?.role !== "user" || !Array.isArray(resultMsg.content)) return undefined;
  const toolResult = resultMsg.content.find(
    (b) => b.type === "tool_result" && b.tool_use_id === toolUseId,
  );
  return toolResult && "content" in toolResult && typeof toolResult.content === "string"
    ? toolResult.content
    : undefined;
}

// Pass only the messages of the current turn, so an old request does not show buttons again.
export function extractPendingRequest(messages: BetaMessageParam[]): PendingRequest | null {
  const lookedUp = new Set<number>();
  let requestable: number | undefined;
  let calledRequestMedia = false;

  // Newest first: the last accepted request_media call wins.
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type !== "tool_use") continue;
      const input = block.input as Record<string, unknown>;
      if (typeof input.tmdbId !== "number") continue;
      const result = toolResultText(messages, i, block.id);

      if (block.name === "get_media_details") {
        lookedUp.add(input.tmdbId);
        if (input.mediaType === "movie" && result?.includes("Status: Not Requested")) {
          requestable = input.tmdbId;
        }
        continue;
      }
      if (block.name !== "request_media") continue;
      calledRequestMedia = true;
      if (input.mediaType !== "movie" && input.mediaType !== "tv") continue;
      if (input.mediaType === "tv" && (!Array.isArray(input.seasons) || input.seasons.length === 0)) {
        continue;
      }
      // Verify the tool result confirms the request was prepared, not rejected
      if (result !== undefined && !result.includes("Request prepared for user confirmation")) {
        continue;
      }
      return input as unknown as PendingRequest;
    }
  }

  // The model sometimes shows a movie and asks who the request is for without calling
  // request_media. If this turn looked up exactly one title, and it is a movie Seerr has
  // not requested, offer the buttons for it anyway.
  return !calledRequestMedia && lookedUp.size === 1 && requestable !== undefined
    ? { tmdbId: requestable, mediaType: "movie" }
    : null;
}
