import { config } from "../config.js";
import type { OmdbSearchResponse, OmdbDetails } from "../types/index.js";

class OmdbService {
  private apiKey: string;
  private baseUrl = "https://www.omdbapi.com";

  constructor() {
    this.apiKey = config.omdb.apiKey;
  }

  async searchByTitle(
    title: string,
    options?: {
      year?: string;
      type?: "movie" | "series";
    }
  ): Promise<OmdbSearchResponse> {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      s: title,
    });

    if (options?.year) {
      params.set("y", options.year);
    }
    if (options?.type) {
      params.set("type", options.type);
    }

    const response = await fetch(`${this.baseUrl}/?${params}`);
    return response.json();
  }

  async getByImdbId(imdbId: string): Promise<OmdbDetails> {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      i: imdbId,
      plot: "short",
    });

    const response = await fetch(`${this.baseUrl}/?${params}`);
    return response.json();
  }

  async getByTitle(
    title: string,
    options?: {
      year?: string;
      type?: "movie" | "series";
    }
  ): Promise<OmdbDetails> {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      t: title,
      plot: "short",
    });

    if (options?.year) {
      params.set("y", options.year);
    }
    if (options?.type) {
      params.set("type", options.type);
    }

    const response = await fetch(`${this.baseUrl}/?${params}`);
    return response.json();
  }
}

export const omdb = new OmdbService();
