import { describe, expect, it, mock } from "bun:test";
import { createRequestMediaTool } from "../../agent/tools/request.js";
import type { SeerrDeps } from "../../agent/tools/types.js";
import type { RequestResponse } from "../../types/index.js";

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

const movieResponse: RequestResponse = {
  id: 42,
  status: 2,
  type: "movie",
  media: { id: 1, tmdbId: 27205, status: 3, mediaType: "movie" },
  createdAt: "2024-01-15T10:00:00.000Z",
};

const tvResponse: RequestResponse = {
  id: 43,
  status: 2,
  type: "tv",
  media: { id: 2, tmdbId: 1396, status: 3, mediaType: "tv" },
  createdAt: "2024-01-15T10:00:00.000Z",
};

describe("request_media tool", () => {
  it("submits a movie request successfully", async () => {
    const seerr = mockSeerr({
      requestMovie: mock(() => Promise.resolve(movieResponse)),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("Movie request submitted successfully");
    expect(result).toContain("Request ID: 42");
    expect(seerr.requestMovie).toHaveBeenCalledWith(27205);
  });

  it("submits a TV request with seasons", async () => {
    const seerr = mockSeerr({
      requestTv: mock(() => Promise.resolve(tvResponse)),
    });

    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({
      tmdbId: 1396,
      mediaType: "tv",
      seasons: [1, 2, 3],
    });

    expect(result).toContain("TV show request submitted successfully");
    expect(result).toContain("Seasons requested: 1, 2, 3");
    expect(seerr.requestTv).toHaveBeenCalledWith(1396, [1, 2, 3]);
  });

  it("returns error when TV request has no seasons", async () => {
    const seerr = mockSeerr();
    const tool = createRequestMediaTool({ seerr });
    const result = await tool.run({ tmdbId: 1396, mediaType: "tv" });

    expect(result).toContain("must specify which seasons");
  });
});
