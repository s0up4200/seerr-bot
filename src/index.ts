import {
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

interface ResponseSection {
  text: string;
  posterUrl: string | null;
}

const POSTER_REGEX = /\[POSTER:(https:\/\/[^\]]+)\]/g;

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

  if (!isMentioned && !isDM) return;

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

    // Check for session reset commands
    const resetCommands = ["new conversation", "start over", "reset", "forget"];
    if (resetCommands.some((cmd) => content.toLowerCase().includes(cmd))) {
      sessionManager.clear(message.author.id);
      clearInterval(typingInterval);
      await message.reply(
        "Started a new conversation! What would you like to watch?"
      );
      return;
    }

    // Get existing conversation for this user
    const existingMessages = sessionManager.get(message.author.id);

    // Process with Claude
    const { result: response, messages: newMessages } = await processMediaRequest(
      content,
      existingMessages
    );

    // Store the conversation for future messages
    sessionManager.set(message.author.id, newMessages);

    // Clear typing interval
    clearInterval(typingInterval);

    // Parse response into sections
    const sections = parseResponseSections(response);

    // Check if any section has a poster
    const hasPosters = sections.some(s => s.posterUrl);

    if (hasPosters) {
      // Create embeds for each section (max 10 per message)
      const embeds = sections.slice(0, 10).map(section => {
        const embed = new EmbedBuilder()
          .setDescription(section.text.slice(0, 4096))
          .setColor(0x2b2d31);

        if (section.posterUrl) {
          embed.setThumbnail(section.posterUrl);
        }

        return embed;
      });

      await message.reply({ embeds });
    } else {
      // No posters - send as plain text, chunked if needed
      const fullText = sections.map((s) => s.text).join("\n\n---\n\n");
      const chunks = splitTextIntoChunks(fullText);

      await message.reply(chunks[0]);
      for (let i = 1; i < chunks.length; i++) {
        if (isTextChannel) {
          await channel.send(chunks[i]);
        }
      }
    }

    console.log(`Responded to ${message.author.tag}`);
  } catch (error) {
    console.error("Error processing request:", error);
    await message.reply(
      "Sorry, I encountered an error processing your request. Please try again later."
    );
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
