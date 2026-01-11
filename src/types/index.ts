// Seerr API Types

export interface SearchResult {
  id: number;
  mediaType: "movie" | "tv" | "person" | "collection";
  title?: string;
  name?: string;
  releaseDate?: string;
  firstAirDate?: string;
  overview: string;
  posterPath?: string | null;
  popularity: number;
  voteAverage: number;
}

export interface SearchResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SearchResult[];
}

export interface MovieDetails {
  id: number;
  imdbId?: string;
  title: string;
  originalTitle: string;
  releaseDate: string;
  overview: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  runtime?: number;
  genres: { id: number; name: string }[];
  status: string;
  mediaInfo?: MediaInfo;
}

export interface TvDetails {
  id: number;
  name: string;
  originalName: string;
  firstAirDate: string;
  overview: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  seasons: SeasonInfo[];
  genres: { id: number; name: string }[];
  status: string;
  externalIds?: {
    imdbId?: string;
    tvdbId?: number;
  };
  mediaInfo?: MediaInfo;
}

export interface SeasonInfo {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  overview?: string;
  posterPath?: string | null;
}

export interface MediaInfo {
  id: number;
  tmdbId: number;
  status: number;
  status4k: number;
  mediaType: "movie" | "tv";
}

export interface RequestResponse {
  id: number;
  status: number;
  type: "movie" | "tv";
  media: {
    id: number;
    tmdbId: number;
    status: number;
    mediaType: "movie" | "tv";
  };
  createdAt: string;
  seasons?: {
    seasonNumber: number;
    status: number;
  }[];
}

// Media Status enum (from Seerr)
export enum MediaStatus {
  UNKNOWN = 1,
  PENDING = 2,
  PROCESSING = 3,
  PARTIALLY_AVAILABLE = 4,
  AVAILABLE = 5,
  BLACKLISTED = 6,
}

// Request Status enum (from Seerr)
export enum RequestStatus {
  PENDING = 1,
  APPROVED = 2,
  DECLINED = 3,
  FAILED = 4,
  COMPLETED = 5,
}

// Request List Types
export interface MediaRequestUser {
  id: number;
  username: string;
  displayName?: string;
  email: string;
  avatar?: string;
}

export interface MediaRequestItem {
  id: number;
  status: RequestStatus;
  type: "movie" | "tv";
  is4k: boolean;
  createdAt: string;
  updatedAt: string;
  media: {
    id: number;
    tmdbId: number;
    tvdbId?: number;
    status: number;
    status4k: number;
    mediaType: "movie" | "tv";
    // Extended media info from API
    title?: string;
    name?: string;
    releaseDate?: string;
    firstAirDate?: string;
  };
  requestedBy: MediaRequestUser;
  modifiedBy?: MediaRequestUser;
  seasons?: {
    id: number;
    seasonNumber: number;
    status: number;
  }[];
}

export interface RequestListResponse {
  pageInfo: {
    pages: number;
    page: number;
    results: number;
    pageSize: number;
  };
  results: MediaRequestItem[];
}

export type RequestFilter =
  | "pending"
  | "approved"
  | "processing"
  | "available"
  | "failed";

// OMDb API Types

export interface OmdbSearchResult {
  Title: string;
  Year: string;
  imdbID: string;
  Type: "movie" | "series" | "episode";
  Poster: string;
}

export interface OmdbSearchResponse {
  Search?: OmdbSearchResult[];
  totalResults?: string;
  Response: "True" | "False";
  Error?: string;
}

export interface OmdbDetails {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: { Source: string; Value: string }[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: "movie" | "series" | "episode";
  totalSeasons?: string;
  Response: "True" | "False";
  Error?: string;
}

// Discovery Types

export interface DiscoverResult {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  releaseDate?: string;
  firstAirDate?: string;
  overview: string;
  posterPath?: string | null;
  voteAverage: number;
  popularity: number;
}

export interface DiscoverResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: DiscoverResult[];
}

export interface DiscoverMovieOptions {
  page?: number;
  sortBy?: string;
  year?: number;
  genre?: number;
  minRating?: number;
}

export interface DiscoverTvOptions {
  page?: number;
  sortBy?: string;
  year?: number;
  genre?: number;
  minRating?: number;
}

// Ratings Types

export interface RTRating {
  title?: string;
  url?: string;
  criticsScore?: number;
  criticsRating?: string;
  audienceScore?: number;
  audienceRating?: string;
}

export interface IMDBRating {
  title?: string;
  url?: string;
  criticsScore?: number;
}

export interface RatingsResponse {
  rt?: RTRating;
  imdb?: IMDBRating;
}
