import { MediaStatus, RequestStatus } from "./types/index.js";
import { TMDB_IMAGE_BASE } from "./constants.js";

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

function truncateOverview(
  overview: string | undefined,
  maxLength: number = 200
): string {
  if (!overview) {
    return "No overview available.";
  }
  if (overview.length <= maxLength) {
    return overview;
  }
  return overview.slice(0, maxLength) + "...";
}

export interface DiscoverResult {
  id: number;
  mediaType?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  releaseDate?: string;
  firstAirDate?: string;
  overview: string;
  posterPath?: string | null;
  voteAverage: number;
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
