import { describe, expect, it } from "bun:test";
import {
  getMediaStatusText,
  getRequestStatusText,
  formatErrorMessage,
  splitTrailingText,
  extractPendingRequest,
  formatMediaResult,
} from "../utils.js";
import { MediaStatus, RequestStatus } from "../types/index.js";
import type { DiscoverResult } from "../types/index.js";

describe("getMediaStatusText", () => {
  it("returns Available for AVAILABLE status", () => {
    expect(getMediaStatusText(MediaStatus.AVAILABLE)).toBe("Available");
  });

  it("returns Partially Available for PARTIALLY_AVAILABLE", () => {
    expect(getMediaStatusText(MediaStatus.PARTIALLY_AVAILABLE)).toBe(
      "Partially Available"
    );
  });

  it("returns Requested for PROCESSING", () => {
    expect(getMediaStatusText(MediaStatus.PROCESSING)).toBe("Requested");
  });

  it("returns Pending for PENDING", () => {
    expect(getMediaStatusText(MediaStatus.PENDING)).toBe("Pending");
  });

  it("returns Blacklisted for BLACKLISTED", () => {
    expect(getMediaStatusText(MediaStatus.BLACKLISTED)).toBe("Blacklisted");
  });

  it("returns Not Requested for unknown status", () => {
    expect(getMediaStatusText(999)).toBe("Not Requested");
  });
});

describe("getRequestStatusText", () => {
  it("returns Pending for PENDING", () => {
    expect(getRequestStatusText(RequestStatus.PENDING)).toBe("Pending");
  });

  it("returns Approved for APPROVED", () => {
    expect(getRequestStatusText(RequestStatus.APPROVED)).toBe("Approved");
  });

  it("returns Declined for DECLINED", () => {
    expect(getRequestStatusText(RequestStatus.DECLINED)).toBe("Declined");
  });

  it("returns Failed for FAILED", () => {
    expect(getRequestStatusText(RequestStatus.FAILED)).toBe("Failed");
  });

  it("returns Completed for COMPLETED", () => {
    expect(getRequestStatusText(RequestStatus.COMPLETED)).toBe("Completed");
  });

  it("returns Unknown for unrecognized status", () => {
    expect(getRequestStatusText(999 as RequestStatus)).toBe("Unknown");
  });
});

describe("formatErrorMessage", () => {
  it("extracts message from Error instance", () => {
    expect(formatErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("returns Unknown error for non-Error values", () => {
    expect(formatErrorMessage("a string")).toBe("Unknown error");
    expect(formatErrorMessage(42)).toBe("Unknown error");
    expect(formatErrorMessage(null)).toBe("Unknown error");
  });
});

describe("formatMediaResult", () => {
  const baseResult: DiscoverResult = {
    id: 123,
    mediaType: "movie",
    title: "Test Movie",
    releaseDate: "2024-06-15",
    overview: "A great movie about testing.",
    posterPath: "/abc123.jpg",
    voteAverage: 8.5,
    popularity: 100,
  };

  it("formats a movie result with poster tag", () => {
    const result = formatMediaResult(baseResult, 0, "movie");
    expect(result).toContain("1. Test Movie (2024)");
    expect(result).toContain("Rating: 8.5/10");
    expect(result).toContain("https://www.themoviedb.org/movie/123");
    expect(result).toContain("[POSTER:https://image.tmdb.org/t/p/w342/abc123.jpg]");
    expect(result).toContain("A great movie about testing.");
  });

  it("formats a TV result using name and firstAirDate", () => {
    const tvResult: DiscoverResult = {
      ...baseResult,
      mediaType: "tv",
      title: undefined,
      name: "Test Show",
      releaseDate: undefined,
      firstAirDate: "2023-01-20",
    };
    const result = formatMediaResult(tvResult, 2, "tv");
    expect(result).toContain("3. Test Show (2023)");
    expect(result).toContain("https://www.themoviedb.org/tv/123");
  });

  it("shows media type label when showMediaType is true", () => {
    const result = formatMediaResult(baseResult, 0, "movie", {
      showMediaType: true,
    });
    expect(result).toContain("- Movie");
  });

  it("shows full date when useFullDate is true", () => {
    const result = formatMediaResult(baseResult, 0, "movie", {
      useFullDate: true,
    });
    expect(result).toContain("(2024-06-15)");
  });

  it("handles missing poster", () => {
    const noPoster = { ...baseResult, posterPath: null };
    const result = formatMediaResult(noPoster, 0, "movie");
    expect(result).not.toContain("[POSTER:");
  });

  it("truncates long overviews", () => {
    const longOverview = { ...baseResult, overview: "A".repeat(250) };
    const result = formatMediaResult(longOverview, 0, "movie");
    expect(result).toContain("...");
    // 200 chars + "..."
    expect(result).toContain("A".repeat(200) + "...");
  });

  it("shows TBA for missing date", () => {
    const noDate = { ...baseResult, releaseDate: undefined };
    const result = formatMediaResult(noDate, 0, "movie");
    expect(result).toContain("(TBA)");
  });
});

describe("splitTrailingText", () => {
  const poster = "[POSTER:https://image.tmdb.org/t/p/w342/a.jpg]";

  it("splits off text after the last poster", () => {
    expect(splitTrailingText(`**Dune**\n\n${poster}\n\nRequest it?`)).toEqual({
      body: `**Dune**\n\n${poster}`,
      trailing: "Request it?",
    });
  });

  it("keeps everything when the poster comes first", () => {
    const text = `${poster}\n**Dune**`;
    expect(splitTrailingText(text)).toEqual({ body: text, trailing: "" });
  });

  it("keeps everything when there is no poster", () => {
    expect(splitTrailingText("No match.")).toEqual({ body: "No match.", trailing: "" });
  });
});

describe("extractPendingRequest", () => {
  const call = (id: string, name: string, input: object, result: string): any[] => [
    { role: "assistant", content: [{ type: "tool_use", id, name, input }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: result }] },
  ];
  const details = (id: string, tmdbId: number, status: string) =>
    call(id, "get_media_details", { tmdbId, mediaType: "movie" }, `Movie: X\nStatus: ${status}`);

  it("uses a prepared request_media call", () => {
    const messages = call("a", "request_media", { tmdbId: 1, mediaType: "tv", seasons: [2] }, "Request prepared for user confirmation.");
    expect(extractPendingRequest(messages)).toEqual({ tmdbId: 1, mediaType: "tv", seasons: [2] });
  });

  it("ignores a rejected request_media call", () => {
    const messages = call("a", "request_media", { tmdbId: 1, mediaType: "movie" }, "Cannot request: X is already Available.");
    expect(extractPendingRequest(messages)).toBeNull();
  });

  it("falls back to the one requestable movie that was looked up", () => {
    expect(extractPendingRequest(details("a", 7, "Not Requested"))).toEqual({ tmdbId: 7, mediaType: "movie" });
  });

  it("does not fall back when the movie is already requested", () => {
    expect(extractPendingRequest(details("a", 7, "Pending"))).toBeNull();
  });

  it("does not fall back when several titles were looked up", () => {
    const messages = [...details("a", 7, "Not Requested"), ...details("b", 8, "Not Requested")];
    expect(extractPendingRequest(messages)).toBeNull();
  });
});
