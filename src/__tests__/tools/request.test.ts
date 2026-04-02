import { describe, expect, it, mock } from "bun:test";
import { createRequestMediaTool } from "../../agent/tools/request.js";
import type { SeerrDeps } from "../../agent/tools/types.js";

function mockSeerr(overrides: Partial<SeerrDeps> = {}): SeerrDeps {
  return {
    search: mock(() => Promise.reject(new Error("not mocked"))),
    getMovieDetails: mock(() => Promise.reject(new Error("not mocked"))),
    getTvDetails: mock(() => Promise.reject(new Error("not mocked"))),
    requestMovie: mock(() => Promise.reject(new Error("not mocked"))),
    requestTv: mock(() => Promise.reject(new Error("not mocked"))),
    listRequests: mock(() => Promise.reject(new Error("not mocked"))),
    approveRequest: mock(() => Promise.reject(new Error("not mocked"))),
    declineRequest: mock(() => Promise.reject(new Error("not mocked"))),
    discoverTrending: mock(() => Promise.reject(new Error("not mocked"))),
    discoverUpcomingMovies: mock(() => Promise.reject(new Error("not mocked"))),
    discoverUpcomingTv: mock(() => Promise.reject(new Error("not mocked"))),
    discoverMovies: mock(() => Promise.reject(new Error("not mocked"))),
    discoverTv: mock(() => Promise.reject(new Error("not mocked"))),
    getSimilarMovies: mock(() => Promise.reject(new Error("not mocked"))),
    getSimilarTv: mock(() => Promise.reject(new Error("not mocked"))),
    getMovieRatings: mock(() => Promise.reject(new Error("not mocked"))),
    getTvRatings: mock(() => Promise.reject(new Error("not mocked"))),
    ...overrides,
  };
}

describe("request_media tool", () => {
  it("returns confirmation message for movies when not requested", async () => {
    const seerr = mockSeerr({
      getMovieDetails: mock(() =>
        Promise.resolve({ mediaInfo: null } as any),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("Request prepared for user confirmation");
  });

  it("returns confirmation message for TV with seasons", async () => {
    const seerr = mockSeerr({
      getTvDetails: mock(() =>
        Promise.resolve({ mediaInfo: null } as any),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({
      tmdbId: 1396,
      mediaType: "tv",
      seasons: [3, 1, 2],
    });

    expect(result).toContain("Request prepared for user confirmation");
    expect(result).toContain("Seasons: 1, 2, 3");
  });

  it("returns error when TV request has no seasons", async () => {
    const seerr = mockSeerr();
    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({ tmdbId: 1396, mediaType: "tv" });

    expect(result).toContain("must specify which seasons");
  });

  it("blocks request when movie is already available", async () => {
    const seerr = mockSeerr({
      getMovieDetails: mock(() =>
        Promise.resolve({
          title: "Inception",
          mediaInfo: { status: 5 },
        } as any),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("Cannot request");
    expect(result).toContain("already");
  });

  it("blocks request when movie is already pending", async () => {
    const seerr = mockSeerr({
      getMovieDetails: mock(() =>
        Promise.resolve({
          title: "Dune 3",
          mediaInfo: { status: 2 },
        } as any),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({ tmdbId: 12345, mediaType: "movie" });

    expect(result).toContain("Cannot request");
    expect(result).toContain("already");
  });

  it("allows request for partially available TV show", async () => {
    const seerr = mockSeerr({
      getTvDetails: mock(() =>
        Promise.resolve({
          name: "Breaking Bad",
          mediaInfo: { status: 4 },
        } as any),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({
      tmdbId: 1396,
      mediaType: "tv",
      seasons: [4, 5],
    });

    expect(result).toContain("Request prepared for user confirmation");
  });

  it("blocks when all requested TV seasons are already covered", async () => {
    const seerr = mockSeerr({
      getTvDetails: mock(() =>
        Promise.resolve({
          name: "Breaking Bad",
          mediaInfo: {
            status: 3,
            seasons: [
              { seasonNumber: 1, status: 5, status4k: 1 },
              { seasonNumber: 2, status: 3, status4k: 1 },
              { seasonNumber: 3, status: 2, status4k: 1 },
            ],
          },
        } as any),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({
      tmdbId: 1396,
      mediaType: "tv",
      seasons: [1, 2],
    });

    expect(result).toContain("Cannot request");
    expect(result).toContain("already covered");
  });

  it("allows when some requested TV seasons are not yet covered", async () => {
    const seerr = mockSeerr({
      getTvDetails: mock(() =>
        Promise.resolve({
          name: "Breaking Bad",
          mediaInfo: {
            status: 3,
            seasons: [
              { seasonNumber: 1, status: 5, status4k: 1 },
              { seasonNumber: 2, status: 3, status4k: 1 },
            ],
          },
        } as any),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({
      tmdbId: 1396,
      mediaType: "tv",
      seasons: [2, 3, 4],
    });

    expect(result).toContain("Request prepared for user confirmation");
  });

  it("allows TV request when no season status data exists", async () => {
    const seerr = mockSeerr({
      getTvDetails: mock(() =>
        Promise.resolve({
          name: "Breaking Bad",
          mediaInfo: { status: 3 },
        } as any),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({
      tmdbId: 1396,
      mediaType: "tv",
      seasons: [4, 5],
    });

    expect(result).toContain("Request prepared for user confirmation");
  });

  it("blocks request when TV show is fully available", async () => {
    const seerr = mockSeerr({
      getTvDetails: mock(() =>
        Promise.resolve({
          name: "Breaking Bad",
          mediaInfo: { status: 5 },
        } as any),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({
      tmdbId: 1396,
      mediaType: "tv",
      seasons: [1, 2],
    });

    expect(result).toContain("Cannot request");
    expect(result).toContain("fully available");
  });

  it("proceeds if status check fails", async () => {
    const seerr = mockSeerr({
      getMovieDetails: mock(() =>
        Promise.reject(new Error("Network error")),
      ),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("Request prepared for user confirmation");
  });
});
