import { searchMediaTool } from "./search.js";
import { getMediaDetailsTool } from "./details.js";
import { verifyImdbTool } from "./verify.js";
import { requestMediaTool } from "./request.js";
import {
  listRequestsTool,
  approveRequestTool,
  declineRequestTool,
} from "./manage.js";
import {
  discoverTrendingTool,
  discoverUpcomingTool,
  discoverMoviesTool,
  discoverTvTool,
} from "./discover.js";
import { getSimilarTool } from "./similar.js";
import { getRatingsTool } from "./ratings.js";

export const tools = [
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
];
