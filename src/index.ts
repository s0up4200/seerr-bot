import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Message,
  Partials,
  TextChannel,
  DMChannel,
} from "discord.js";
import { config } from "./config.js";
import { processMediaRequest } from "./agent/index.js";
import { sessionManager } from "./sessions.js";
import { usageTracker, calculateCost } from "./usageTracker.js";
import { LiveMessage } from "./liveMessage.js";
import { seerr } from "./services/seerr.js";
import { getRequestStatusText } from "./utils.js";

interface ResponseSection {
  text: string;
  posterUrl: string | null;
}

const POSTER_REGEX = /\[POSTER:(https:\/\/[^\]]+)\]/g;
const PENDING_REQUEST_REGEX = /\[PENDING_REQUEST:(\{.*?\})\]/;

interface PendingRequest {
  tmdbId: number;
  mediaType: "movie" | "tv";
  seasons?: number[];
}

function parseResponseSections(text: string): ResponseSection[] {
  const posterMatches = [...text.matchAll(POSTER_REGEX)];

  // No posters - return as single section
  if (posterMatches.length === 0) {
    return [{ text: text.trim(), posterUrl: null }];
  }

  // Single poster - attach to entire cleaned text
  if (posterMatches.length === 1) {
    const cleanText = text.replace(POSTER_REGEX, "").trim();
    return [{ text: cleanText, posterUrl: posterMatches[0][1] }];
  }

  // Multiple posters - split into sections where each poster attaches to preceding text
  const sections: ResponseSection[] = [];
  let lastIndex = 0;

  for (const match of posterMatches) {
    const sectionText = text.slice(lastIndex, match.index!).trim();
    if (sectionText) {
      sections.push({ text: sectionText, posterUrl: match[1] });
    }
    lastIndex = match.index! + match[0].length;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    sections.push({ text: remaining, posterUrl: null });
  }

  return sections.filter((s) => s.text.length > 50 || s.posterUrl);
}

const DISCORD_MAX_LENGTH = 2000;
const MIN_CHUNK_LENGTH = 1000;

function splitTextIntoChunks(text: string, maxLength = DISCORD_MAX_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point: prefer newline, then space, then hard cut
    let breakPoint = remaining.lastIndexOf("\n", maxLength);
    if (breakPoint === -1 || breakPoint < MIN_CHUNK_LENGTH) {
      breakPoint = remaining.lastIndexOf(" ", maxLength);
    }
    if (breakPoint === -1 || breakPoint < MIN_CHUNK_LENGTH) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once("ready", () => {
  console.log(`Seerr Bot is online as ${client.user?.tag}`);
  console.log(
    `Invite URL: https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&permissions=274877958144&scope=bot`
  );
});

client.on("messageCreate", async (message: Message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if bot is mentioned or if it's a DM
  const isMentioned = client.user && message.mentions.has(client.user);
  const isDM = !message.guild;
  const isAutoRespond =
    config.discord.autoRespondUserId &&
    config.discord.autoRespondChannelId &&
    message.author.id === config.discord.autoRespondUserId &&
    message.channel.id === config.discord.autoRespondChannelId;

  if (!isMentioned && !isDM && !isAutoRespond) return;

  // Extract the request text (remove mention if present)
  let content = message.content;
  if (client.user) {
    content = content
      .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
      .trim();
  }

  if (!content) {
    await message.reply(
      "I can help you request movies and TV shows. Just tell me what you want.\n\n" +
        "Examples:\n" +
        "- Request the movie Inception\n" +
        "- Get me the latest season of Severance\n" +
        "- Add all seasons of The Bear\n" +
        "- Show pending requests\n" +
        "- Approve request #42"
    );
    return;
  }

  // Get a text-capable channel
  const channel = message.channel;
  const isTextChannel =
    channel instanceof TextChannel || channel instanceof DMChannel;

  try {
    // Keep typing indicator active during processing
    if (isTextChannel) await channel.sendTyping();
    const typingInterval = setInterval(() => {
      if (isTextChannel) channel.sendTyping().catch(() => {});
    }, 5000);

    console.log(`Processing request from ${message.author.tag}: ${content}`);

    // Check for stats command
    const lowerContent = content.toLowerCase();
    if (lowerContent === "stats" || lowerContent === "usage") {
      clearInterval(typingInterval);
      const stats = usageTracker.get(message.author.id);
      if (!stats) {
        await message.reply("No usage stats yet. Start by making a request!");
        return;
      }
      const total = stats.totalInputTokens + stats.totalOutputTokens;
      const cost = calculateCost(
        stats.totalInputTokens,
        stats.totalOutputTokens
      );
      await message.reply(
        `**Your Usage Stats**\n` +
          `Requests: ${stats.requestCount.toLocaleString()}\n` +
          `Input tokens: ${stats.totalInputTokens.toLocaleString()}\n` +
          `Output tokens: ${stats.totalOutputTokens.toLocaleString()}\n` +
          `Total tokens: ${total.toLocaleString()}\n` +
          `Est. cost: $${cost.toFixed(4)}\n` +
          `Model: ${config.anthropic.model}`
      );
      return;
    }

    // Check for session reset commands
    const resetCommands = ["new conversation", "start over", "reset", "forget"];
    if (resetCommands.some((cmd) => lowerContent.includes(cmd))) {
      sessionManager.clear(message.author.id);
      clearInterval(typingInterval);
      await message.reply(
        "Started a new conversation! What would you like to watch?"
      );
      return;
    }

    // Get existing conversation for this user
    const existingMessages = sessionManager.get(message.author.id);

    // Set up live message for streaming
    const liveMessage = new LiveMessage(message);
    let typingCleared = false;

    const onText = (textSnapshot: string) => {
      // Stop typing indicator once real text starts flowing
      if (!typingCleared) {
        clearInterval(typingInterval);
        typingCleared = true;
      }
      // Strip pending request tags so they don't appear during streaming
      liveMessage.update(textSnapshot.replace(PENDING_REQUEST_REGEX, "").trim());
    };

    // Process with Claude (streaming)
    const {
      result: response,
      messages: newMessages,
      usage,
    } = await processMediaRequest(content, existingMessages, onText);

    // Store the conversation for future messages
    sessionManager.set(message.author.id, newMessages);

    // Record usage
    usageTracker.record(message.author.id, usage.inputTokens, usage.outputTokens);

    // Clear typing interval if not already cleared (e.g., no text was streamed)
    if (!typingCleared) {
      clearInterval(typingInterval);
    }

    // Extract and validate pending request before parsing sections
    const pendingMatch = response.match(PENDING_REQUEST_REGEX);
    let pendingRequest: PendingRequest | null = null;
    if (pendingMatch) {
      try {
        const parsed = JSON.parse(pendingMatch[1]);
        if (
          typeof parsed.tmdbId === "number" &&
          (parsed.mediaType === "movie" || parsed.mediaType === "tv") &&
          (parsed.mediaType === "movie" ||
            (Array.isArray(parsed.seasons) && parsed.seasons.length > 0))
        ) {
          pendingRequest = parsed as PendingRequest;
        } else {
          console.error("Invalid pending request payload:", parsed);
        }
      } catch {
        console.error("Failed to parse pending request:", pendingMatch[1]);
      }
    }

    // Strip the pending request tag from display text
    const displayResponse = response.replace(PENDING_REQUEST_REGEX, "").trim();

    // Build confirmation buttons if there's a pending request
    let components: ActionRowBuilder<ButtonBuilder>[] = [];
    const buttonId = pendingRequest ? crypto.randomUUID() : "";
    if (pendingRequest) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm-${buttonId}`)
          .setLabel("Request")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel-${buttonId}`)
          .setLabel("Wrong one")
          .setStyle(ButtonStyle.Secondary),
      );
      components = [row];
    }

    // Parse response into sections
    const sections = parseResponseSections(displayResponse);

    // Check if any section has a poster
    const hasPosters = sections.some((s) => s.posterUrl);

    let sentMessage: Message | null = null;

    if (hasPosters) {
      // Delete the streamed message and replace with embeds
      await liveMessage.delete();

      // Create embeds for each section (max 10 per message)
      const embeds = sections.slice(0, 10).map((section) => {
        const embed = new EmbedBuilder()
          .setDescription(section.text.slice(0, 4096))
          .setColor(0x2b2d31);

        if (section.posterUrl) {
          embed.setThumbnail(section.posterUrl);
        }

        return embed;
      });

      sentMessage = await message.reply({ embeds, components });
    } else {
      // Finalize the live message with the complete text
      sentMessage = await liveMessage.finalize();

      // Add buttons if pending request (also ensures clean display text)
      if (sentMessage && components.length > 0) {
        const cleanContent = displayResponse.slice(0, DISCORD_MAX_LENGTH);
        sentMessage = await sentMessage.edit({
          content: cleanContent,
          components,
        });
      }

      // If text exceeds Discord limit, send overflow as additional messages
      const fullText = sections.map((s) => s.text).join("\n\n---\n\n");
      if (fullText.length > DISCORD_MAX_LENGTH && isTextChannel) {
        const chunks = splitTextIntoChunks(fullText);
        // First chunk is already in the live message, send the rest
        for (let i = 1; i < chunks.length; i++) {
          await channel.send(chunks[i]);
        }
      }
    }

    // Set up button collector for pending requests
    if (pendingRequest && sentMessage) {
      const pr = pendingRequest;
      const collector = sentMessage.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 5 * 60 * 1000,
        max: 1,
      });

      collector.on("collect", async (interaction) => {
        if (interaction.customId === `confirm-${buttonId}`) {
          try {
            const res =
              pr.mediaType === "movie"
                ? await seerr.requestMovie(pr.tmdbId)
                : await seerr.requestTv(pr.tmdbId, pr.seasons!);
            const status = getRequestStatusText(res.status);
            await interaction.update({
              components: [],
            });
            await interaction.followUp(
              `Request submitted! (ID: ${res.id}, Status: ${status})`,
            );
          } catch (error) {
            await interaction.update({ components: [] });
            await interaction.followUp(
              `Failed to submit request: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        } else {
          await interaction.update({ components: [] });
          await interaction.followUp(
            "Request cancelled. Tell me what you're looking for instead!",
          );
        }
      });

      collector.on("end", (collected, reason) => {
        if (reason === "time" && collected.size === 0) {
          sentMessage?.edit({ components: [] }).catch(() => {});
        }
      });
    }

    console.log(`Responded to ${message.author.tag}`);
  } catch (error) {
    console.error("Error processing request:", error);
    try {
      await message.reply(
        "Sorry, I encountered an error processing your request. Please try again later."
      );
    } catch {
      // Reply may fail if the live message already replied
    }
  }
});

// Handle errors
client.on("error", (error) => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

// Login
client.login(config.discord.token);
