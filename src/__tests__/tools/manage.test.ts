import { describe, expect, it, mock } from "bun:test";
import {
  createListRequestsTool,
  createApproveRequestTool,
  createDeclineRequestTool,
} from "../../agent/tools/manage.js";
import type { SeerrDeps } from "../../agent/tools/types.js";
import type { MediaRequestItem, RequestListResponse, MovieDetails } from "../../types/index.js";
import { RequestStatus } from "../../types/index.js";

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

const listResponse: RequestListResponse = {
  pageInfo: { pages: 1, page: 1, results: 1, pageSize: 20 },
  results: [
    {
      id: 10,
      status: RequestStatus.PENDING,
      type: "movie",
      is4k: false,
      createdAt: "2024-01-15T10:00:00.000Z",
      updatedAt: "2024-01-15T10:00:00.000Z",
      media: {
        id: 1,
        tmdbId: 27205,
        status: 2,
        status4k: 1,
        mediaType: "movie",
      },
      requestedBy: {
        id: 1,
        username: "john",
        displayName: "John Doe",
        email: "john@example.com",
      },
    },
  ],
};

const approvedItem: MediaRequestItem = {
  ...listResponse.results[0],
  status: RequestStatus.APPROVED,
  media: {
    ...listResponse.results[0].media,
    title: "Inception",
  },
};

describe("list_requests tool", () => {
  it("formats pending requests with media titles", async () => {
    const movieDetails = {
      id: 27205,
      title: "Inception",
      releaseDate: "2010-07-16",
    } as MovieDetails;

    const seerr = mockSeerr({
      listRequests: mock(() => Promise.resolve(listResponse)),
      getMovieDetails: mock(() => Promise.resolve(movieDetails)),
    });

    const tool = createListRequestsTool({ seerr });
    const result = await tool.run({});

    expect(result).toContain("Pending requests");
    expect(result).toContain("#10:");
    expect(result).toContain("Inception");
    expect(result).toContain("John Doe");
  });

  it("returns no results message for empty list", async () => {
    const seerr = mockSeerr({
      listRequests: mock(() =>
        Promise.resolve({
          pageInfo: { pages: 0, page: 1, results: 0, pageSize: 20 },
          results: [],
        })
      ),
    });

    const tool = createListRequestsTool({ seerr });
    const result = await tool.run({ filter: "approved" });

    expect(result).toContain("No approved requests found");
  });
});

describe("approve_request tool", () => {
  it("returns success message on approve", async () => {
    const seerr = mockSeerr({
      approveRequest: mock(() => Promise.resolve(approvedItem)),
    });

    const tool = createApproveRequestTool({ seerr });
    const result = await tool.run({ requestId: 10 });

    expect(result).toContain("Approved request #10");
    expect(result).toContain("Inception");
    expect(result).toContain("Radarr");
  });

  it("handles 403 permission error", async () => {
    const seerr = mockSeerr({
      approveRequest: mock(() =>
        Promise.reject(new Error("Seerr API error (403): Forbidden"))
      ),
    });

    const tool = createApproveRequestTool({ seerr });
    const result = await tool.run({ requestId: 10 });

    expect(result).toContain("Permission denied");
  });

  it("handles 404 not found error", async () => {
    const seerr = mockSeerr({
      approveRequest: mock(() =>
        Promise.reject(new Error("Seerr API error (404): Not Found"))
      ),
    });

    const tool = createApproveRequestTool({ seerr });
    const result = await tool.run({ requestId: 999 });

    expect(result).toContain("not found");
  });
});

describe("decline_request tool", () => {
  it("returns success message on decline", async () => {
    const declinedItem = { ...approvedItem, status: RequestStatus.DECLINED };
    const seerr = mockSeerr({
      declineRequest: mock(() => Promise.resolve(declinedItem)),
    });

    const tool = createDeclineRequestTool({ seerr });
    const result = await tool.run({ requestId: 10 });

    expect(result).toContain("Declined request #10");
    expect(result).toContain("Inception");
  });
});
