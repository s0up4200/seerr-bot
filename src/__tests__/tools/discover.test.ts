import { describe, expect, it, mock } from "bun:test";
import {
  createDiscoverTrendingTool,
  createDiscoverUpcomingTool,
  createDiscoverMoviesTool,
  createDiscoverTvTool,
} from "../../agent/tools/discover.js";
import type { SeerrDeps } from "../../agent/tools/types.js";
import type { DiscoverResponse } from "../../types/index.js";

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

const discoverResponse: DiscoverResponse = {
  page: 1,
  totalPages: 5,
  totalResults: 100,
  results: [
    {
      id: 100,
      mediaType: "movie",
      title: "Trending Movie",
      releaseDate: "2024-03-01",
      overview: "A trending movie.",
      posterPath: "/trending.jpg",
      voteAverage: 7.5,
      popularity: 500,
    },
    {
      id: 200,
      mediaType: "tv",
      name: "Trending Show",
      firstAirDate: "2024-02-15",
      overview: "A trending TV show.",
      posterPath: "/trending-tv.jpg",
      voteAverage: 8.2,
      popularity: 400,
    },
  ],
};

describe("discover_trending tool", () => {
  it("formats trending results with media type labels", async () => {
    const seerr = mockSeerr({
      discoverTrending: mock(() => Promise.resolve(discoverResponse)),
    });

    const tool = createDiscoverTrendingTool({ seerr });
    const result = await tool.run({});

    expect(result).toContain("Trending now");
    expect(result).toContain("Trending Movie");
    expect(result).toContain("Trending Show");
  });

  it("filters by media type when specified", async () => {
    const seerr = mockSeerr({
      discoverTrending: mock(() => Promise.resolve(discoverResponse)),
    });

    const tool = createDiscoverTrendingTool({ seerr });
    const result = await tool.run({ mediaType: "movie" });

    expect(result).toContain("Trending Movie");
    expect(result).not.toContain("Trending Show");
  });

  it("returns no content message when empty", async () => {
    const seerr = mockSeerr({
      discoverTrending: mock(() =>
        Promise.resolve({ page: 1, totalPages: 0, totalResults: 0, results: [] })
      ),
    });

    const tool = createDiscoverTrendingTool({ seerr });
    const result = await tool.run({});

    expect(result).toContain("No trending content found");
  });
});

describe("discover_upcoming tool", () => {
  it("formats upcoming movies with full dates", async () => {
    const seerr = mockSeerr({
      discoverUpcomingMovies: mock(() => Promise.resolve(discoverResponse)),
    });

    const tool = createDiscoverUpcomingTool({ seerr });
    const result = await tool.run({ mediaType: "movie" });

    expect(result).toContain("Upcoming movies");
  });

  it("formats upcoming TV shows", async () => {
    const seerr = mockSeerr({
      discoverUpcomingTv: mock(() => Promise.resolve(discoverResponse)),
    });

    const tool = createDiscoverUpcomingTool({ seerr });
    const result = await tool.run({ mediaType: "tv" });

    expect(result).toContain("Upcoming TV shows");
  });
});

describe("discover_movies tool", () => {
  it("formats discovered movies", async () => {
    const seerr = mockSeerr({
      discoverMovies: mock(() => Promise.resolve(discoverResponse)),
    });

    const tool = createDiscoverMoviesTool({ seerr });
    const result = await tool.run({});

    expect(result).toContain("Top movies");
    expect(result).toContain("Trending Movie");
  });

  it("includes filter description", async () => {
    const seerr = mockSeerr({
      discoverMovies: mock(() => Promise.resolve(discoverResponse)),
    });

    const tool = createDiscoverMoviesTool({ seerr });
    const result = await tool.run({ year: 2024, genre: "action" });

    expect(result).toContain("from 2024");
    expect(result).toContain("action");
  });
});

describe("discover_tv tool", () => {
  it("formats discovered TV shows", async () => {
    const seerr = mockSeerr({
      discoverTv: mock(() => Promise.resolve(discoverResponse)),
    });

    const tool = createDiscoverTvTool({ seerr });
    const result = await tool.run({});

    expect(result).toContain("Top TV shows");
  });
});
