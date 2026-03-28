import { describe, expect, it, mock } from "bun:test";
import { createGetMediaDetailsTool } from "../../agent/tools/details.js";
import type { SeerrDeps } from "../../agent/tools/types.js";
import type { MovieDetails, TvDetails } from "../../types/index.js";

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

const movieDetails: MovieDetails = {
  id: 27205,
  imdbId: "tt1375666",
  title: "Inception",
  originalTitle: "Inception",
  releaseDate: "2010-07-16",
  overview: "A thief who steals corporate secrets through dream-sharing technology.",
  posterPath: "/inception.jpg",
  backdropPath: null,
  popularity: 100,
  voteAverage: 8.367,
  voteCount: 30000,
  runtime: 148,
  genres: [
    { id: 28, name: "Action" },
    { id: 878, name: "Science Fiction" },
  ],
  status: "Released",
};

const tvDetails: TvDetails = {
  id: 1396,
  name: "Breaking Bad",
  originalName: "Breaking Bad",
  firstAirDate: "2008-01-20",
  overview: "A chemistry teacher turned meth kingpin.",
  posterPath: "/bb.jpg",
  backdropPath: null,
  popularity: 200,
  voteAverage: 8.9,
  voteCount: 50000,
  numberOfSeasons: 5,
  numberOfEpisodes: 62,
  seasons: [
    { id: 1, seasonNumber: 0, name: "Specials", episodeCount: 5 },
    { id: 2, seasonNumber: 1, name: "Season 1", episodeCount: 7, airDate: "2008-01-20" },
    { id: 3, seasonNumber: 2, name: "Season 2", episodeCount: 13, airDate: "2009-03-08" },
    { id: 4, seasonNumber: 3, name: "Season 3", episodeCount: 13, airDate: "2010-03-21" },
    { id: 5, seasonNumber: 4, name: "Season 4", episodeCount: 13, airDate: "2011-07-17" },
    { id: 6, seasonNumber: 5, name: "Season 5", episodeCount: 16, airDate: "2012-07-15" },
  ],
  genres: [{ id: 18, name: "Drama" }],
  status: "Ended",
  externalIds: { imdbId: "tt0903747" },
};

describe("get_media_details tool", () => {
  it("formats movie details with status, poster, and links", async () => {
    const seerr = mockSeerr({
      getMovieDetails: mock(() => Promise.resolve(movieDetails)),
    });

    const tool = createGetMediaDetailsTool({ seerr });
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("Movie: Inception (2010)");
    expect(result).toContain("Status: Not Requested");
    expect(result).toContain("Rating: 8.4/10");
    expect(result).toContain("Runtime: 148 minutes");
    expect(result).toContain("Action, Science Fiction");
    expect(result).toContain("https://www.themoviedb.org/movie/27205");
    expect(result).toContain("https://www.imdb.com/title/tt1375666");
    expect(result).toContain("[POSTER:https://image.tmdb.org/t/p/w342/inception.jpg]");
  });

  it("formats TV details with season list", async () => {
    const seerr = mockSeerr({
      getTvDetails: mock(() => Promise.resolve(tvDetails)),
    });

    const tool = createGetMediaDetailsTool({ seerr });
    const result = await tool.run({ tmdbId: 1396, mediaType: "tv" });

    expect(result).toContain("TV Show: Breaking Bad (2008)");
    expect(result).toContain("Seasons: 5 (62 episodes)");
    expect(result).toContain("S1: 7 eps (2008)");
    expect(result).toContain("S5: 16 eps (2012)");
    // Season 0 (Specials) should be filtered out
    expect(result).not.toContain("S0:");
    expect(result).toContain("https://www.imdb.com/title/tt0903747");
  });

  it("shows media status when mediaInfo is present", async () => {
    const withStatus = {
      ...movieDetails,
      mediaInfo: { id: 1, tmdbId: 27205, status: 5, status4k: 1, mediaType: "movie" as const },
    };
    const seerr = mockSeerr({
      getMovieDetails: mock(() => Promise.resolve(withStatus)),
    });

    const tool = createGetMediaDetailsTool({ seerr });
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("Status: Available");
  });
});
