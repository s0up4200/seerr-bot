import { describe, expect, it } from "bun:test";
import { createRequestMediaTool } from "../../agent/tools/request.js";

describe("request_media tool", () => {
  it("returns confirmation message for movies", async () => {
    const tool = createRequestMediaTool();
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("Request prepared for user confirmation");
    expect(result).toContain("Confirmation buttons");
  });

  it("returns confirmation message for TV with seasons", async () => {
    const tool = createRequestMediaTool();
    const result = await tool.run({
      tmdbId: 1396,
      mediaType: "tv",
      seasons: [3, 1, 2],
    });

    expect(result).toContain("Request prepared for user confirmation");
    expect(result).toContain("Seasons: 1, 2, 3");
  });

  it("returns error when TV request has no seasons", async () => {
    const tool = createRequestMediaTool();
    const result = await tool.run({ tmdbId: 1396, mediaType: "tv" });

    expect(result).toContain("must specify which seasons");
  });
});
