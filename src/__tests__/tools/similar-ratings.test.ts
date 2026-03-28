import { describe, expect, it, mock } from "bun:test";
import { createGetSimilarTool } from "../../agent/tools/similar.js";
import { createGetRatingsTool } from "../../agent/tools/ratings.js";
import type { SeerrDeps } from "../../agent/tools/types.js";
import type { DiscoverResponse, RatingsResponse, RTRating } from "../../types/index.js";

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

const similarResponse: DiscoverResponse = {
  page: 1,
  totalPages: 1,
  totalResults: 1,
  results: [
    {
      id: 500,
      mediaType: "movie",
      title: "Similar Movie",
      releaseDate: "2023-05-10",
      overview: "A similar movie.",
      posterPath: "/similar.jpg",
      voteAverage: 7.0,
      popularity: 80,
    },
  ],
};

describe("get_similar tool", () => {
  it("formats similar movies", async () => {
    const seerr = mockSeerr({
      getSimilarMovies: mock(() => Promise.resolve(similarResponse)),
    });

    const tool = createGetSimilarTool({ seerr });
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("Similar movies");
    expect(result).toContain("Similar Movie");
  });

  it("formats similar TV shows", async () => {
    const seerr = mockSeerr({
      getSimilarTv: mock(() => Promise.resolve(similarResponse)),
    });

    const tool = createGetSimilarTool({ seerr });
    const result = await tool.run({ tmdbId: 1396, mediaType: "tv" });

    expect(result).toContain("Similar TV shows");
  });

  it("returns no results message when empty", async () => {
    const seerr = mockSeerr({
      getSimilarMovies: mock(() =>
        Promise.resolve({ page: 1, totalPages: 0, totalResults: 0, results: [] })
      ),
    });

    const tool = createGetSimilarTool({ seerr });
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("No similar movies found");
  });
});

describe("get_ratings tool", () => {
  it("formats movie ratings with RT and IMDB", async () => {
    const ratingsResponse: RatingsResponse = {
      rt: {
        criticsScore: 87,
        audienceScore: 91,
        url: "https://www.rottentomatoes.com/m/inception",
      },
      imdb: {
        criticsScore: 8.8,
        url: "https://www.imdb.com/title/tt1375666",
      },
    };

    const seerr = mockSeerr({
      getMovieRatings: mock(() => Promise.resolve(ratingsResponse)),
    });

    const tool = createGetRatingsTool({ seerr });
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("Rotten Tomatoes: 87% Critics / 91% Audience");
    expect(result).toContain("IMDB: 8.8/10");
  });

  it("formats TV ratings (RT only)", async () => {
    const tvRatings: RTRating = {
      criticsScore: 96,
      audienceScore: 98,
      url: "https://www.rottentomatoes.com/tv/breaking_bad",
    };

    const seerr = mockSeerr({
      getTvRatings: mock(() => Promise.resolve(tvRatings)),
    });

    const tool = createGetRatingsTool({ seerr });
    const result = await tool.run({ tmdbId: 1396, mediaType: "tv" });

    expect(result).toContain("Rotten Tomatoes: 96% Critics / 98% Audience");
  });

  it("returns no ratings message when empty", async () => {
    const seerr = mockSeerr({
      getMovieRatings: mock(() => Promise.resolve({})),
    });

    const tool = createGetRatingsTool({ seerr });
    const result = await tool.run({ tmdbId: 99999, mediaType: "movie" });

    expect(result).toContain("No ratings available");
  });

  it("handles 404 errors gracefully", async () => {
    const seerr = mockSeerr({
      getMovieRatings: mock(() =>
        Promise.reject(new Error("Seerr API error (404): Not Found"))
      ),
    });

    const tool = createGetRatingsTool({ seerr });
    const result = await tool.run({ tmdbId: 99999, mediaType: "movie" });

    expect(result).toContain("No ratings found");
  });
});
