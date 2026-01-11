import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { searchMediaTool } from "./tools/searchMedia.js";
import { getMediaDetailsTool } from "./tools/getMediaDetails.js";
import { verifyImdbTool } from "./tools/verifyImdb.js";
import { requestMediaTool } from "./tools/requestMedia.js";
import { listRequestsTool } from "./tools/listRequests.js";
import { approveRequestTool } from "./tools/approveRequest.js";
import { declineRequestTool } from "./tools/declineRequest.js";
import { discoverTrendingTool } from "./tools/discoverTrending.js";
import { discoverUpcomingTool } from "./tools/discoverUpcoming.js";
import { discoverMoviesTool } from "./tools/discoverMovies.js";
import { discoverTvTool } from "./tools/discoverTv.js";
import { getSimilarTool } from "./tools/getSimilar.js";
import { getRatingsTool } from "./tools/getRatings.js";

export const seerrMcpServer = createSdkMcpServer({
  name: "seerr-tools",
  version: "1.0.0",
  tools: [
    searchMediaTool,
    getMediaDetailsTool,
    verifyImdbTool,
    requestMediaTool,
    listRequestsTool,
    approveRequestTool,
    declineRequestTool,
    discoverTrendingTool,
    discoverUpcomingTool,
    discoverMoviesTool,
    discoverTvTool,
    getSimilarTool,
    getRatingsTool,
  ],
});
