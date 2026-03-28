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
  RatingsResponse,
  RTRating,
  OmdbSearchResponse,
  OmdbDetails,
} from "../../types/index.js";

export interface SeerrDeps {
  search(query: string): Promise<SearchResponse>;
  getMovieDetails(tmdbId: number): Promise<MovieDetails>;
  getTvDetails(tmdbId: number): Promise<TvDetails>;
  requestMovie(tmdbId: number): Promise<RequestResponse>;
  requestTv(tmdbId: number, seasons: number[]): Promise<RequestResponse>;
  listRequests(filter?: RequestFilter, take?: number): Promise<RequestListResponse>;
  approveRequest(requestId: number): Promise<MediaRequestItem>;
  declineRequest(requestId: number): Promise<MediaRequestItem>;
  discoverTrending(page?: number): Promise<DiscoverResponse>;
  discoverUpcomingMovies(page?: number): Promise<DiscoverResponse>;
  discoverUpcomingTv(page?: number): Promise<DiscoverResponse>;
  discoverMovies(options?: DiscoverMovieOptions): Promise<DiscoverResponse>;
  discoverTv(options?: DiscoverTvOptions): Promise<DiscoverResponse>;
  getSimilarMovies(tmdbId: number): Promise<DiscoverResponse>;
  getSimilarTv(tmdbId: number): Promise<DiscoverResponse>;
  getMovieRatings(tmdbId: number): Promise<RatingsResponse>;
  getTvRatings(tmdbId: number): Promise<RTRating>;
}

export interface OmdbDeps {
  searchByTitle(
    title: string,
    options?: { year?: string; type?: "movie" | "series" }
  ): Promise<OmdbSearchResponse>;
  getByImdbId(imdbId: string): Promise<OmdbDetails>;
  getByTitle(
    title: string,
    options?: { year?: string; type?: "movie" | "series" }
  ): Promise<OmdbDetails>;
}
