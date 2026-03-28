import { describe, expect, it } from "bun:test";
import {
  getMediaStatusText,
  getRequestStatusText,
  formatErrorMessage,
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
