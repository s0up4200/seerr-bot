import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { omdb } from "../../services/omdb.js";

export const verifyImdbTool = tool(
  "verify_imdb",
  "Verify a media selection by checking its IMDB information. Use this to confirm you have the correct movie or TV show.",
  {
    imdbId: z
      .string()
      .optional()
      .describe("IMDB ID to look up directly (e.g., tt1234567)"),
    title: z.string().optional().describe("Title to search for on IMDB"),
    year: z.string().optional().describe("Release year to help narrow search"),
    type: z
      .enum(["movie", "series"])
      .optional()
      .describe("Media type for search"),
  },
  async (args) => {
    try {
      // If IMDB ID is provided, get details directly
      if (args.imdbId) {
        const details = await omdb.getByImdbId(args.imdbId);

        if (details.Response === "False") {
          return {
            content: [
              {
                type: "text",
                text: `IMDB lookup failed: ${details.Error || "Not found"}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `IMDB Verification:
Title: ${details.Title} (${details.Year})
IMDB ID: ${details.imdbID}
Type: ${details.Type}
Rating: ${details.imdbRating}/10 (${details.imdbVotes} votes)
Genre: ${details.Genre}
Director: ${details.Director}
Actors: ${details.Actors}
${details.totalSeasons ? `Seasons: ${details.totalSeasons}` : ""}

Plot: ${details.Plot}`,
            },
          ],
        };
      }

      // Otherwise, search by title
      if (args.title) {
        const searchResults = await omdb.searchByTitle(args.title, {
          year: args.year,
          type: args.type,
        });

        if (
          searchResults.Response === "False" ||
          !searchResults.Search?.length
        ) {
          return {
            content: [
              {
                type: "text",
                text: `IMDB search failed: ${searchResults.Error || "No results found"}`,
              },
            ],
          };
        }

        const formatted = searchResults.Search.slice(0, 5)
          .map(
            (r, i) => `${i + 1}. ${r.Title} (${r.Year}) - ${r.Type} [${r.imdbID}]`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `IMDB Search Results for "${args.title}":\n\n${formatted}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "Please provide either an IMDB ID or a title to search.",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `IMDB verification error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  }
);
