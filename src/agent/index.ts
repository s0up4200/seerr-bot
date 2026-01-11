import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { seerr } from "../services/seerr.js";
import { omdb } from "../services/omdb.js";
import { TMDB_IMAGE_BASE, MOVIE_GENRE_MAP, TV_GENRE_MAP } from "../constants.js";
import {
  getMediaStatusText,
  getRequestStatusText,
  formatErrorMessage,
  formatMediaResult,
} from "../utils.js";
import type { MediaRequestItem, RTRating, RequestFilter } from "../types/index.js";
import { RequestStatus } from "../types/index.js";

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

const SYSTEM_PROMPT = `You are Seerr Bot, an assistant for requesting movies and TV shows through Seerr.

## Requesting Media
When a user asks for media:
1. Search for the media using search_media
2. Get detailed information using get_media_details to confirm it's correct and see available seasons
3. Optionally verify with verify_imdb to cross-reference with IMDB data
4. Submit the request using request_media

For TV shows, understand these season patterns:
- "latest season" or "newest season" = the highest season number available
- "season X" = specific season number X
- "all seasons" = all available (1 through numberOfSeasons)
- "seasons 1-3" or "first 3 seasons" = [1, 2, 3]
- "new season" usually means the latest/most recent season

## Managing Requests
- list_requests: show pending requests (or filter by: approved, processing, available, failed)
- approve_request: approve a pending request by ID
- decline_request: decline a pending request by ID

## Discovery
You can help users discover content:
- discover_trending: What's trending now ("what's popular?", "what's hot?")
- discover_upcoming: Movies/TV coming soon ("what's coming out?", "upcoming movies")
- discover_movies: Browse movies by year, genre, rating ("top films of 2026", "best comedies")
- discover_tv: Browse TV shows by year, genre, rating ("best drama series of 2025")
- get_similar: Find similar movies or TV shows ("movies like Inception", "shows similar to The Bear")
- get_ratings: Get Rotten Tomatoes and IMDB ratings ("RT score for X", "ratings for Y")

For year-based queries like "anticipated films of 2026", use discover_movies with year filter.
For "what's coming soon", use discover_upcoming.
For "what's popular/trending", use discover_trending.
For "movies like X" or "similar to Y", use get_similar (requires TMDB ID, so search first if needed).

CRITICAL: When presenting discovery results, you MUST include for EACH item:
1. The TMDB URL (https://www.themoviedb.org/...) - users need this to click through
2. The [POSTER:url] tag - this displays the image in Discord
Copy these EXACTLY from the tool output. Do not drop or reformat them.

## Response Formatting
When presenting media details:
- Include TMDB and IMDB links from tools
- MUST copy the [POSTER:url] tag verbatim at end of response (this displays the poster image)
- Use **bold** for the title

Format:
**Title (Year)**
Rating: X/10 | Runtime: X min | Genres: X, Y
Status: Not Requested
TMDB: https://www.themoviedb.org/movie/123
IMDB: https://www.imdb.com/title/tt123

Overview here...

[POSTER:https://image.tmdb.org/t/p/w342/poster.jpg]

## Media Status Handling
Only offer to request media when status is "Not Requested". For any other status:
- **Pending**: Request submitted, awaiting admin approval. Do not request again.
- **Requested**: Approved and sent to download queue. Do not request again.
- **Partially Available**: Some content in library (for TV: some seasons/episodes). Can request missing content.
- **Available**: Fully in library. Do not request.
DO NOT offer to request media that is Pending, Requested, or Available.

## Guidelines
- Always get_media_details for TV shows before requesting to know season count
- Never request season 0 (specials) unless explicitly asked
- For "latest season", get numberOfSeasons from details and request only that one
- Keep responses concise - Discord has a 2000 character limit
- Never request 4K versions
- Be direct and factual - avoid filler phrases like "You're absolutely right" or "Great question"
- Never use emojis in responses`;

// Tool definitions
const tools: Anthropic.Tool[] = [
  {
    name: "search_media",
    description:
      "Search Seerr for movies or TV shows by title. Returns a list of matching media with their TMDB IDs. Automatically handles year in query.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query (movie or TV show title, optionally with year)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_media_details",
    description:
      "Get detailed information about a movie or TV show including IMDB ID, status, and seasons (for TV shows).",
    input_schema: {
      type: "object" as const,
      properties: {
        tmdbId: { type: "number", description: "The TMDB ID of the media" },
        mediaType: {
          type: "string",
          enum: ["movie", "tv"],
          description: "Whether this is a movie or TV show",
        },
      },
      required: ["tmdbId", "mediaType"],
    },
  },
  {
    name: "verify_imdb",
    description:
      "Verify a media selection by checking its IMDB information.",
    input_schema: {
      type: "object" as const,
      properties: {
        imdbId: { type: "string", description: "IMDB ID to look up directly" },
        title: { type: "string", description: "Title to search for on IMDB" },
        year: { type: "string", description: "Release year to help narrow search" },
        type: { type: "string", enum: ["movie", "series"], description: "Media type" },
      },
      required: [],
    },
  },
  {
    name: "request_media",
    description:
      "Submit a media request to Seerr. For movies, no seasons needed. For TV shows, you MUST specify which seasons.",
    input_schema: {
      type: "object" as const,
      properties: {
        tmdbId: { type: "number", description: "The TMDB ID of the media" },
        mediaType: { type: "string", enum: ["movie", "tv"], description: "Movie or TV" },
        seasons: {
          type: "array",
          items: { type: "number" },
          description: "For TV: array of season numbers to request",
        },
      },
      required: ["tmdbId", "mediaType"],
    },
  },
  {
    name: "list_requests",
    description: "List media requests in Seerr. Default shows pending requests.",
    input_schema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          enum: ["pending", "approved", "processing", "available", "failed"],
          description: "Filter by status. Default: pending",
        },
      },
      required: [],
    },
  },
  {
    name: "approve_request",
    description: "Approve a pending media request.",
    input_schema: {
      type: "object" as const,
      properties: {
        requestId: { type: "number", description: "The request ID to approve" },
      },
      required: ["requestId"],
    },
  },
  {
    name: "decline_request",
    description: "Decline a pending media request.",
    input_schema: {
      type: "object" as const,
      properties: {
        requestId: { type: "number", description: "The request ID to decline" },
      },
      required: ["requestId"],
    },
  },
  {
    name: "discover_trending",
    description: "Get trending movies and TV shows right now.",
    input_schema: {
      type: "object" as const,
      properties: {
        mediaType: {
          type: "string",
          enum: ["movie", "tv", "all"],
          description: "Filter by media type. Default: all",
        },
      },
      required: [],
    },
  },
  {
    name: "discover_upcoming",
    description: "Get upcoming movies or TV shows coming soon.",
    input_schema: {
      type: "object" as const,
      properties: {
        mediaType: {
          type: "string",
          enum: ["movie", "tv"],
          description: "Movies or TV shows",
        },
      },
      required: ["mediaType"],
    },
  },
  {
    name: "discover_movies",
    description: "Discover movies by year, genre, or rating.",
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Filter by release year" },
        genre: { type: "string", description: "Filter by genre name" },
        minRating: { type: "number", description: "Minimum rating (0-10)" },
        sortBy: {
          type: "string",
          enum: ["popularity", "rating", "release_date"],
          description: "Sort order. Default: popularity",
        },
      },
      required: [],
    },
  },
  {
    name: "discover_tv",
    description: "Discover TV shows by year, genre, or rating.",
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Filter by first air year" },
        genre: { type: "string", description: "Filter by genre name" },
        minRating: { type: "number", description: "Minimum rating (0-10)" },
        sortBy: {
          type: "string",
          enum: ["popularity", "rating", "first_air_date"],
          description: "Sort order. Default: popularity",
        },
      },
      required: [],
    },
  },
  {
    name: "get_similar",
    description: "Find movies or TV shows similar to a given title.",
    input_schema: {
      type: "object" as const,
      properties: {
        tmdbId: { type: "number", description: "The TMDB ID" },
        mediaType: { type: "string", enum: ["movie", "tv"], description: "Movie or TV" },
      },
      required: ["tmdbId", "mediaType"],
    },
  },
  {
    name: "get_ratings",
    description: "Get Rotten Tomatoes and IMDB ratings for a movie or TV show.",
    input_schema: {
      type: "object" as const,
      properties: {
        tmdbId: { type: "number", description: "The TMDB ID" },
        mediaType: { type: "string", enum: ["movie", "tv"], description: "Movie or TV" },
      },
      required: ["tmdbId", "mediaType"],
    },
  },
];

// Tool handlers
async function handleToolCall(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "search_media":
        return await handleSearchMedia(input.query as string);
      case "get_media_details":
        return await handleGetMediaDetails(
          input.tmdbId as number,
          input.mediaType as "movie" | "tv"
        );
      case "verify_imdb":
        return await handleVerifyImdb(input);
      case "request_media":
        return await handleRequestMedia(
          input.tmdbId as number,
          input.mediaType as "movie" | "tv",
          input.seasons as number[] | undefined
        );
      case "list_requests":
        return await handleListRequests(input.filter as string | undefined);
      case "approve_request":
        return await handleApproveRequest(input.requestId as number);
      case "decline_request":
        return await handleDeclineRequest(input.requestId as number);
      case "discover_trending":
        return await handleDiscoverTrending(input.mediaType as string | undefined);
      case "discover_upcoming":
        return await handleDiscoverUpcoming(input.mediaType as "movie" | "tv");
      case "discover_movies":
        return await handleDiscoverMovies(input);
      case "discover_tv":
        return await handleDiscoverTv(input);
      case "get_similar":
        return await handleGetSimilar(
          input.tmdbId as number,
          input.mediaType as "movie" | "tv"
        );
      case "get_ratings":
        return await handleGetRatings(
          input.tmdbId as number,
          input.mediaType as "movie" | "tv"
        );
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error: ${formatErrorMessage(error)}`;
  }
}

// Tool implementations
function parseYearFromQuery(query: string): { title: string; year?: string } {
  const yearPatterns = [
    /\((\d{4})\)\s*$/,
    /\[(\d{4})\]\s*$/,
    /\s*-\s*(\d{4})\s*$/,
    /\s+(\d{4})\s*$/,
  ];
  for (const pattern of yearPatterns) {
    const match = query.match(pattern);
    if (match) {
      return { title: query.replace(pattern, "").trim(), year: match[1] };
    }
  }
  return { title: query };
}

async function handleSearchMedia(query: string): Promise<string> {
  const { title, year: targetYear } = parseYearFromQuery(query);
  const response = await seerr.search(title);

  if (response.results.length === 0) {
    return `No results found for "${title}". Try a different search term.`;
  }

  let mediaResults = response.results.filter(
    (r) => r.mediaType === "movie" || r.mediaType === "tv"
  );

  if (targetYear) {
    const matchingYear = mediaResults.filter((r) => {
      const resultYear = (r.releaseDate || r.firstAirDate || "").slice(0, 4);
      return resultYear === targetYear;
    });
    const otherResults = mediaResults.filter((r) => {
      const resultYear = (r.releaseDate || r.firstAirDate || "").slice(0, 4);
      return resultYear !== targetYear;
    });
    mediaResults = [...matchingYear, ...otherResults];
  }

  mediaResults = mediaResults.slice(0, 10);

  const formatted = mediaResults
    .map((r, i) => {
      const resultTitle = r.title || r.name || "Unknown";
      const resultYear = (r.releaseDate || r.firstAirDate || "").slice(0, 4);
      const type = r.mediaType === "movie" ? "Movie" : "TV";
      const tmdbUrl = `https://www.themoviedb.org/${r.mediaType}/${r.id}`;
      return `${i + 1}. ${resultTitle} (${resultYear}) - ${type} - TMDB:${r.id} - ${tmdbUrl}`;
    })
    .join("\n");

  const firstPoster = mediaResults[0]?.posterPath
    ? `\n[POSTER:${TMDB_IMAGE_BASE}${mediaResults[0].posterPath}]`
    : "";

  const yearNote = targetYear ? ` (prioritizing ${targetYear})` : "";
  return `Found ${response.totalResults} results${yearNote}. Top matches:\n\n${formatted}${firstPoster}`;
}

async function handleGetMediaDetails(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<string> {
  if (mediaType === "movie") {
    const movie = await seerr.getMovieDetails(tmdbId);
    const status = movie.mediaInfo
      ? getMediaStatusText(movie.mediaInfo.status)
      : "Not Requested";

    const tmdbUrl = `https://www.themoviedb.org/movie/${movie.id}`;
    const imdbUrl = movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}` : null;
    const posterTag = movie.posterPath
      ? `\n[POSTER:${TMDB_IMAGE_BASE}${movie.posterPath}]`
      : "";

    return `Movie: ${movie.title} (${movie.releaseDate?.slice(0, 4) || "N/A"})
Status: ${status}
Rating: ${movie.voteAverage.toFixed(1)}/10
Runtime: ${movie.runtime || "N/A"} minutes
Genres: ${movie.genres.map((g) => g.name).join(", ")}
TMDB: ${tmdbUrl}${imdbUrl ? `\nIMDB: ${imdbUrl}` : ""}

Overview: ${movie.overview || "No overview available."}${posterTag}`;
  } else {
    const tv = await seerr.getTvDetails(tmdbId);
    const status = tv.mediaInfo
      ? getMediaStatusText(tv.mediaInfo.status)
      : "Not Requested";

    const tmdbUrl = `https://www.themoviedb.org/tv/${tv.id}`;
    const imdbUrl = tv.externalIds?.imdbId
      ? `https://www.imdb.com/title/${tv.externalIds.imdbId}`
      : null;
    const posterTag = tv.posterPath
      ? `\n[POSTER:${TMDB_IMAGE_BASE}${tv.posterPath}]`
      : "";

    const seasonList = tv.seasons
      .filter((s) => s.seasonNumber > 0)
      .map(
        (s) =>
          `  S${s.seasonNumber}: ${s.episodeCount} eps${s.airDate ? ` (${s.airDate.slice(0, 4)})` : ""}`
      )
      .join("\n");

    return `TV Show: ${tv.name} (${tv.firstAirDate?.slice(0, 4) || "N/A"})
Status: ${status}
Rating: ${tv.voteAverage.toFixed(1)}/10
Seasons: ${tv.numberOfSeasons} (${tv.numberOfEpisodes} episodes)
Genres: ${tv.genres.map((g) => g.name).join(", ")}
Show Status: ${tv.status}
TMDB: ${tmdbUrl}${imdbUrl ? `\nIMDB: ${imdbUrl}` : ""}

${seasonList}

Overview: ${tv.overview || "No overview available."}${posterTag}`;
  }
}

async function handleVerifyImdb(input: Record<string, unknown>): Promise<string> {
  const imdbId = input.imdbId as string | undefined;
  const title = input.title as string | undefined;
  const year = input.year as string | undefined;
  const type = input.type as "movie" | "series" | undefined;

  if (imdbId) {
    const details = await omdb.getByImdbId(imdbId);
    if (details.Response === "False") {
      return `IMDB lookup failed: ${details.Error || "Not found"}`;
    }
    return `IMDB Verification:
Title: ${details.Title} (${details.Year})
IMDB ID: ${details.imdbID}
Type: ${details.Type}
Rating: ${details.imdbRating}/10 (${details.imdbVotes} votes)
Genre: ${details.Genre}
Director: ${details.Director}
Actors: ${details.Actors}
${details.totalSeasons ? `Seasons: ${details.totalSeasons}` : ""}

Plot: ${details.Plot}`;
  }

  if (title) {
    const searchResults = await omdb.searchByTitle(title, { year, type });
    if (searchResults.Response === "False" || !searchResults.Search?.length) {
      return `IMDB search failed: ${searchResults.Error || "No results found"}`;
    }
    const formatted = searchResults.Search.slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.Title} (${r.Year}) - ${r.Type} [${r.imdbID}]`)
      .join("\n");
    return `IMDB Search Results for "${title}":\n\n${formatted}`;
  }

  return "Please provide either an IMDB ID or a title to search.";
}

async function handleRequestMedia(
  tmdbId: number,
  mediaType: "movie" | "tv",
  seasons?: number[]
): Promise<string> {
  if (mediaType === "movie") {
    const response = await seerr.requestMovie(tmdbId);
    const status = getRequestStatusText(response.status);
    return `Movie request submitted successfully!
Request ID: ${response.id}
Status: ${status}
Created: ${new Date(response.createdAt).toLocaleString()}`;
  } else {
    if (!seasons || seasons.length === 0) {
      return "Error: For TV shows, you must specify which seasons to request. Use get_media_details first to see available seasons.";
    }
    const response = await seerr.requestTv(tmdbId, seasons);
    const status = getRequestStatusText(response.status);
    const seasonsList = seasons.sort((a, b) => a - b).join(", ");
    return `TV show request submitted successfully!
Request ID: ${response.id}
Seasons requested: ${seasonsList}
Status: ${status}
Created: ${new Date(response.createdAt).toLocaleString()}`;
  }
}

async function fetchMediaTitle(req: MediaRequestItem): Promise<{ title: string; year: string }> {
  try {
    if (req.type === "movie") {
      const details = await seerr.getMovieDetails(req.media.tmdbId);
      return { title: details.title, year: details.releaseDate?.slice(0, 4) || "" };
    } else {
      const details = await seerr.getTvDetails(req.media.tmdbId);
      return { title: details.name, year: details.firstAirDate?.slice(0, 4) || "" };
    }
  } catch {
    return { title: `Unknown (TMDB ${req.media.tmdbId})`, year: "" };
  }
}

async function handleListRequests(filter?: string): Promise<string> {
  const filterValue = (filter || "pending") as RequestFilter;
  const response = await seerr.listRequests(filterValue);

  if (response.results.length === 0) {
    return `No ${filterValue} requests found.`;
  }

  const mediaInfoPromises = response.results.map((req) => fetchMediaTitle(req));
  const mediaInfos = await Promise.all(mediaInfoPromises);

  const formatted = response.results
    .map((req, index) => {
      const { title, year } = mediaInfos[index];
      const type = req.type === "movie" ? "Movie" : "TV";
      const status = getRequestStatusText(req.status);
      const requester =
        req.requestedBy.displayName ||
        req.requestedBy.username ||
        req.requestedBy.email.split("@")[0];
      const date = new Date(req.createdAt).toLocaleDateString();

      let seasonInfo = "";
      if (req.type === "tv" && req.seasons && req.seasons.length > 0) {
        const seasonNums = req.seasons.map((s) => s.seasonNumber).join(", ");
        seasonInfo = ` S${seasonNums}`;
      }

      const yearStr = year ? ` (${year})` : "";
      return `#${req.id}: ${title}${yearStr} - ${type}${seasonInfo} | Requested by: ${requester} | Status: ${status} | ${date}`;
    })
    .join("\n");

  const total = response.pageInfo.results;
  const shown = response.results.length;
  return `${filterValue.charAt(0).toUpperCase() + filterValue.slice(1)} requests (${shown}${total > shown ? ` of ${total}` : ""}):\n\n${formatted}`;
}

function formatRequestError(error: unknown, requestId: number, action: string): string {
  const message = formatErrorMessage(error);
  if (message.includes("403")) {
    return "Permission denied. The API key doesn't have MANAGE_REQUESTS permission.";
  }
  if (message.includes("404")) {
    return `Request #${requestId} not found. Use list_requests to see available requests.`;
  }
  return `Error ${action} request: ${message}`;
}

async function handleApproveRequest(requestId: number): Promise<string> {
  try {
    const response = await seerr.approveRequest(requestId);
    const title = response.media.title || response.media.name || `TMDB ${response.media.tmdbId}`;
    const type = response.type === "movie" ? "Movie" : "TV Show";
    const processor = response.type === "movie" ? "Radarr" : "Sonarr";
    return `Approved request #${requestId}!\n${type}: ${title}\nThe request has been sent to ${processor} for processing.`;
  } catch (error) {
    return formatRequestError(error, requestId, "approving");
  }
}

async function handleDeclineRequest(requestId: number): Promise<string> {
  try {
    const response = await seerr.declineRequest(requestId);
    const title = response.media.title || response.media.name || `TMDB ${response.media.tmdbId}`;
    const type = response.type === "movie" ? "Movie" : "TV Show";
    return `Declined request #${requestId}.\n${type}: ${title}\nThe requester will be notified.`;
  } catch (error) {
    return formatRequestError(error, requestId, "declining");
  }
}

async function handleDiscoverTrending(mediaType?: string): Promise<string> {
  const response = await seerr.discoverTrending();
  if (response.results.length === 0) {
    return "No trending content found.";
  }

  let results = response.results;
  if (mediaType && mediaType !== "all") {
    results = results.filter((r) => r.mediaType === mediaType);
  }
  results = results
    .filter((r) => r.mediaType === "movie" || r.mediaType === "tv")
    .slice(0, 10);

  const sections = results.map((r, i) =>
    formatMediaResult(r, i, r.mediaType as "movie" | "tv", { showMediaType: true })
  );
  return `Trending now:\n\n${sections.join("\n\n---\n\n")}`;
}

async function handleDiscoverUpcoming(mediaType: "movie" | "tv"): Promise<string> {
  const response =
    mediaType === "movie"
      ? await seerr.discoverUpcomingMovies()
      : await seerr.discoverUpcomingTv();

  if (response.results.length === 0) {
    return `No upcoming ${mediaType === "movie" ? "movies" : "TV shows"} found.`;
  }

  const results = response.results.slice(0, 10);
  const typeLabel = mediaType === "movie" ? "movies" : "TV shows";
  const sections = results.map((r, i) =>
    formatMediaResult(r, i, mediaType, { useFullDate: true })
  );
  return `Upcoming ${typeLabel}:\n\n${sections.join("\n\n---\n\n")}`;
}

function buildFilterDescription(input: Record<string, unknown>): string {
  const filters: string[] = [];
  if (input.year) filters.push(`from ${input.year}`);
  if (input.genre) filters.push(`${input.genre}`);
  if (input.minRating) filters.push(`rated ${input.minRating}+`);
  return filters.length > 0 ? ` (${filters.join(", ")})` : "";
}

async function handleDiscoverMovies(input: Record<string, unknown>): Promise<string> {
  const sortByMap: Record<string, string> = {
    popularity: "popularity.desc",
    rating: "vote_average.desc",
    release_date: "release_date.desc",
  };

  const genre = input.genre as string | undefined;
  const genreId = genre ? MOVIE_GENRE_MAP[genre.toLowerCase()] : undefined;

  const response = await seerr.discoverMovies({
    year: input.year as number | undefined,
    genre: genreId,
    minRating: input.minRating as number | undefined,
    sortBy: input.sortBy ? sortByMap[input.sortBy as string] : "popularity.desc",
  });

  if (response.results.length === 0) {
    return "No movies found matching criteria.";
  }

  const results = response.results.slice(0, 10);
  const sections = results.map((r, i) => formatMediaResult(r, i, "movie"));
  return `Top movies${buildFilterDescription(input)}:\n\n${sections.join("\n\n---\n\n")}`;
}

async function handleDiscoverTv(input: Record<string, unknown>): Promise<string> {
  const sortByMap: Record<string, string> = {
    popularity: "popularity.desc",
    rating: "vote_average.desc",
    first_air_date: "first_air_date.desc",
  };

  const genre = input.genre as string | undefined;
  const genreId = genre ? TV_GENRE_MAP[genre.toLowerCase()] : undefined;

  const response = await seerr.discoverTv({
    year: input.year as number | undefined,
    genre: genreId,
    minRating: input.minRating as number | undefined,
    sortBy: input.sortBy ? sortByMap[input.sortBy as string] : "popularity.desc",
  });

  if (response.results.length === 0) {
    return "No TV shows found matching criteria.";
  }

  const results = response.results.slice(0, 10);
  const sections = results.map((r, i) => formatMediaResult(r, i, "tv"));
  return `Top TV shows${buildFilterDescription(input)}:\n\n${sections.join("\n\n---\n\n")}`;
}

async function handleGetSimilar(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<string> {
  const response =
    mediaType === "movie"
      ? await seerr.getSimilarMovies(tmdbId)
      : await seerr.getSimilarTv(tmdbId);

  const typeLabel = mediaType === "movie" ? "movies" : "TV shows";
  if (response.results.length === 0) {
    return `No similar ${typeLabel} found.`;
  }

  const results = response.results.slice(0, 10);
  const sections = results.map((r, i) => formatMediaResult(r, i, mediaType));
  return `Similar ${typeLabel}:\n\n${sections.join("\n\n---\n\n")}`;
}

function formatRTScore(rt: RTRating): string[] {
  const lines: string[] = [];
  const critics = rt.criticsScore ? `${rt.criticsScore}% Critics` : null;
  const audience = rt.audienceScore ? `${rt.audienceScore}% Audience` : null;
  const rtParts = [critics, audience].filter(Boolean).join(" / ");
  if (rtParts) {
    lines.push(`Rotten Tomatoes: ${rtParts}`);
    if (rt.url) lines.push(`  ${rt.url}`);
  }
  return lines;
}

async function handleGetRatings(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<string> {
  const typeLabel = mediaType === "movie" ? "movie" : "TV show";
  const lines: string[] = [];

  try {
    if (mediaType === "movie") {
      const ratings = await seerr.getMovieRatings(tmdbId);
      if (ratings.rt) lines.push(...formatRTScore(ratings.rt));
      if (ratings.imdb?.criticsScore) {
        lines.push(`IMDB: ${ratings.imdb.criticsScore}/10`);
        if (ratings.imdb.url) lines.push(`  ${ratings.imdb.url}`);
      }
    } else {
      const ratings = await seerr.getTvRatings(tmdbId);
      lines.push(...formatRTScore(ratings));
    }

    if (lines.length === 0) {
      return `No ratings available for this ${typeLabel}.`;
    }
    return lines.join("\n");
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message.includes("404")) {
      return `No ratings found for this ${typeLabel}.`;
    }
    return `Error fetching ratings: ${message}`;
  }
}

// Main agent function
export interface AgentResponse {
  result: string;
  messages: Anthropic.MessageParam[];
}

export async function processMediaRequest(
  userMessage: string,
  existingMessages?: Anthropic.MessageParam[]
): Promise<AgentResponse> {
  const messages: Anthropic.MessageParam[] = existingMessages
    ? [...existingMessages, { role: "user", content: userMessage }]
    : [{ role: "user", content: userMessage }];

  try {
    let response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    // Handle tool use loop
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`Tool call: ${toolUse.name}`, toolUse.input);
        const result = await handleToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );
        console.log(`Tool result: ${result.slice(0, 200)}...`);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });
    }

    // Extract text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    // Add assistant response to messages for context
    messages.push({ role: "assistant", content: response.content });

    return {
      result: textBlocks.map((block) => block.text).join("\n") || "No response",
      messages,
    };
  } catch (error) {
    console.error("Agent error:", error);
    return {
      result: "Sorry, I encountered an error processing your request. Please try again.",
      messages,
    };
  }
}
