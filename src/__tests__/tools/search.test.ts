import { describe, expect, it, mock } from "bun:test";
import { createSearchMediaTool } from "../../agent/tools/search.js";
import type { SeerrDeps } from "../../agent/tools/types.js";
import type { SearchResponse } from "../../types/index.js";

function mockSeerr(overrides: Partial<SeerrDeps> = {}): SeerrDeps {
  return {
    search: mock(() => Promise.resolve({ page: 1, totalPages: 1, totalResults: 0, results: [] } as SearchResponse)),
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

describe("search_media tool", () => {
  it("returns formatted results with POSTER tags and TMDB URLs", async () => {
    const seerr = mockSeerr({
      search: mock(() =>
        Promise.resolve({
          page: 1,
          totalPages: 1,
          totalResults: 1,
          results: [
            {
              id: 27205,
              mediaType: "movie" as const,
              title: "Inception",
              releaseDate: "2010-07-16",
              overview: "A thief who steals corporate secrets...",
              posterPath: "/inception.jpg",
              popularity: 100,
              voteAverage: 8.4,
            },
          ],
        })
      ),
    });

    const tool = createSearchMediaTool({ seerr });
    const result = await tool.run({ query: "Inception" });

    expect(result).toContain("Inception (2010)");
    expect(result).toContain("TMDB:27205");
    expect(result).toContain("https://www.themoviedb.org/movie/27205");
    expect(result).toContain("[POSTER:https://image.tmdb.org/t/p/w342/inception.jpg]");
  });

  it("prioritizes results matching year in query", async () => {
    const seerr = mockSeerr({
      search: mock(() =>
        Promise.resolve({
          page: 1,
          totalPages: 1,
          totalResults: 2,
          results: [
            {
              id: 1,
              mediaType: "movie" as const,
              title: "Dune",
              releaseDate: "1984-12-03",
              overview: "Old one",
              posterPath: null,
              popularity: 50,
              voteAverage: 6.0,
            },
            {
              id: 2,
              mediaType: "movie" as const,
              title: "Dune",
              releaseDate: "2021-10-22",
              overview: "New one",
              posterPath: null,
              popularity: 90,
              voteAverage: 8.0,
            },
          ],
        })
      ),
    });

    const tool = createSearchMediaTool({ seerr });
    const result = await tool.run({ query: "Dune (2021)" });

    // The 2021 version should appear first
    expect(typeof result).toBe("string");
    const text = result as string;
    const lines = text.split("\n");
    const firstResult = lines.find((l: string) => l.startsWith("1."));
    expect(firstResult).toContain("2021");
  });

  it("returns no results message when nothing found", async () => {
    const seerr = mockSeerr();
    const tool = createSearchMediaTool({ seerr });
    const result = await tool.run({ query: "xyznonexistent" });
    expect(result).toContain("No results found");
  });
});
