import { describe, expect, it } from "bun:test";
import { createRequestMediaTool } from "../../agent/tools/request.js";

describe("request_media tool", () => {
  it("returns pending request tag for movies", async () => {
    const tool = createRequestMediaTool();
    const result = await tool.run({ tmdbId: 27205, mediaType: "movie" });

    expect(result).toContain("[PENDING_REQUEST:");
    expect(result).toContain('"tmdbId":27205');
    expect(result).toContain('"mediaType":"movie"');
    expect(result).not.toContain('"seasons"');
  });

  it("returns pending request tag for TV with seasons", async () => {
    const tool = createRequestMediaTool();
    const result = await tool.run({
      tmdbId: 1396,
      mediaType: "tv",
      seasons: [3, 1, 2],
    });

    expect(result).toContain("[PENDING_REQUEST:");
    expect(result).toContain('"tmdbId":1396');
    expect(result).toContain('"mediaType":"tv"');
    expect(result).toContain('"seasons":[1,2,3]');
    expect(result).toContain("Seasons 1, 2, 3");
  });

  it("returns error when TV request has no seasons", async () => {
    const tool = createRequestMediaTool();
    const result = await tool.run({ tmdbId: 1396, mediaType: "tv" });

    expect(result).toContain("must specify which seasons");
  });

  it("returns parseable JSON in the pending request tag", async () => {
    const tool = createRequestMediaTool();
    const result = (await tool.run({ tmdbId: 550, mediaType: "movie" })) as string;

    const match = result.match(/\[PENDING_REQUEST:(\{.*?\})\]/);
    expect(match).not.toBeNull();

    const payload = JSON.parse(match![1]);
    expect(payload).toEqual({ tmdbId: 550, mediaType: "movie" });
  });
});
