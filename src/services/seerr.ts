import { config } from "../config.js";
import type {
  SearchResponse,
  MovieDetails,
  TvDetails,
  RequestResponse,
  RequestListResponse,
  RequestFilter,
  MediaRequestItem,
  DiscoverResponse,
  DiscoverMovieOptions,
  DiscoverTvOptions,
} from "../types/index.js";

class SeerrService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.seerr.url.replace(/\/$/, "");
    this.apiKey = config.seerr.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Seerr API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async search(query: string): Promise<SearchResponse> {
    const encodedQuery = encodeURIComponent(query);
    return this.request<SearchResponse>(`/api/v1/search?query=${encodedQuery}`);
  }

  async getMovieDetails(tmdbId: number): Promise<MovieDetails> {
    return this.request<MovieDetails>(`/api/v1/movie/${tmdbId}`);
  }

  async getTvDetails(tmdbId: number): Promise<TvDetails> {
    return this.request<TvDetails>(`/api/v1/tv/${tmdbId}`);
  }

  async requestMovie(tmdbId: number): Promise<RequestResponse> {
    return this.request<RequestResponse>("/api/v1/request", {
      method: "POST",
      body: JSON.stringify({
        mediaType: "movie",
        mediaId: tmdbId,
        is4k: false,
      }),
    });
  }

  async requestTv(
    tmdbId: number,
    seasons: number[]
  ): Promise<RequestResponse> {
    return this.request<RequestResponse>("/api/v1/request", {
      method: "POST",
      body: JSON.stringify({
        mediaType: "tv",
        mediaId: tmdbId,
        seasons: seasons,
        is4k: false,
      }),
    });
  }

  async listRequests(
    filter?: RequestFilter,
    take: number = 20
  ): Promise<RequestListResponse> {
    const params = new URLSearchParams();
    params.set("take", take.toString());
    if (filter) {
      params.set("filter", filter);
    }
    return this.request<RequestListResponse>(`/api/v1/request?${params}`);
  }

  async approveRequest(requestId: number): Promise<MediaRequestItem> {
    return this.request<MediaRequestItem>(
      `/api/v1/request/${requestId}/approve`,
      { method: "POST" }
    );
  }

  async declineRequest(requestId: number): Promise<MediaRequestItem> {
    return this.request<MediaRequestItem>(
      `/api/v1/request/${requestId}/decline`,
      { method: "POST" }
    );
  }

  // Discovery methods

  async discoverTrending(page: number = 1): Promise<DiscoverResponse> {
    return this.request<DiscoverResponse>(
      `/api/v1/discover/trending?page=${page}`
    );
  }

  async discoverUpcomingMovies(page: number = 1): Promise<DiscoverResponse> {
    return this.request<DiscoverResponse>(
      `/api/v1/discover/movies/upcoming?page=${page}`
    );
  }

  async discoverUpcomingTv(page: number = 1): Promise<DiscoverResponse> {
    return this.request<DiscoverResponse>(
      `/api/v1/discover/tv/upcoming?page=${page}`
    );
  }

  async discoverMovies(options: DiscoverMovieOptions = {}): Promise<DiscoverResponse> {
    const params = new URLSearchParams();
    if (options.page) params.set("page", options.page.toString());
    if (options.sortBy) params.set("sortBy", options.sortBy);
    if (options.year) {
      params.set("primaryReleaseDateGte", `${options.year}-01-01`);
      params.set("primaryReleaseDateLte", `${options.year}-12-31`);
    }
    if (options.genre) params.set("genre", options.genre.toString());
    if (options.minRating) params.set("voteAverageGte", options.minRating.toString());

    const query = params.toString();
    return this.request<DiscoverResponse>(
      `/api/v1/discover/movies${query ? `?${query}` : ""}`
    );
  }

  async discoverTv(options: DiscoverTvOptions = {}): Promise<DiscoverResponse> {
    const params = new URLSearchParams();
    if (options.page) params.set("page", options.page.toString());
    if (options.sortBy) params.set("sortBy", options.sortBy);
    if (options.year) {
      params.set("firstAirDateGte", `${options.year}-01-01`);
      params.set("firstAirDateLte", `${options.year}-12-31`);
    }
    if (options.genre) params.set("genre", options.genre.toString());
    if (options.minRating) params.set("voteAverageGte", options.minRating.toString());

    const query = params.toString();
    return this.request<DiscoverResponse>(
      `/api/v1/discover/tv${query ? `?${query}` : ""}`
    );
  }
}

export const seerr = new SeerrService();
