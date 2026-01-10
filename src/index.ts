import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Message,
  Partials,
  TextChannel,
  DMChannel,
} from "discord.js";

// Parse response into sections, each with optional poster
function parseResponseSections(text: string): Array<{ text: string; posterUrl: string | null }> {
  const posterRegex = /\[POSTER:(https:\/\/[^\]]+)\]/g;

  // Find all poster tags
  const posterMatches = [...text.matchAll(posterRegex)];

  if (posterMatches.length === 0) {
    // No posters - return as single section
    return [{ text: text.trim(), posterUrl: null }];
  }

  if (posterMatches.length === 1) {
    // Single poster - return as single section
    const posterUrl = posterMatches[0][1];
    const cleanText = text.replace(posterRegex, "").trim();
    return [{ text: cleanText, posterUrl }];
  }

  // Multiple posters - split by each [POSTER:url] tag to create sections
  const sections: Array<{ text: string; posterUrl: string | null }> = [];
  let lastIndex = 0;

  for (const match of posterMatches) {
    const posterUrl = match[1];
    const matchStart = match.index!;
    const matchEnd = matchStart + match[0].length;

    // Get text before this poster (belongs to this section)
    const sectionText = text.slice(lastIndex, matchStart).trim();

    if (sectionText) {
      sections.push({ text: sectionText, posterUrl });
    }

    lastIndex = matchEnd;
  }

  // Any remaining text after the last poster (unlikely but handle it)
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    sections.push({ text: remaining, posterUrl: null });
  }

  // Filter out empty header sections (like "Top movies (from 2026):")
  return sections.filter(s => s.text.length > 50 || s.posterUrl);
}
import { config } from "./config.js";
import { processMediaRequest } from "./agent/index.js";
import { sessionManager } from "./sessions.js";

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
    // Show typing indicator if channel supports it
    if (isTextChannel) {
      await channel.sendTyping();
    }

    // Set up a typing interval to keep the indicator active during processing
    const typingInterval = setInterval(() => {
      if (isTextChannel) {
        channel.sendTyping().catch(() => {});
      }
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

    // Get existing session for this user
    const existingSessionId = sessionManager.get(message.author.id);

    // Process with Claude Agent
    const { result: response, sessionId } = await processMediaRequest(
      content,
      existingSessionId
    );

    // Store the session ID for future messages
    if (sessionId) {
      sessionManager.set(message.author.id, sessionId);
    }

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
      // No posters - send as plain text
      const fullText = sections.map(s => s.text).join("\n\n---\n\n");

      if (fullText.length > 2000) {
        const chunks: string[] = [];
        let remaining = fullText;

        while (remaining.length > 0) {
          if (remaining.length <= 2000) {
            chunks.push(remaining);
            break;
          }

          let breakPoint = remaining.lastIndexOf("\n", 2000);
          if (breakPoint === -1 || breakPoint < 1000) {
            breakPoint = remaining.lastIndexOf(" ", 2000);
          }
          if (breakPoint === -1 || breakPoint < 1000) {
            breakPoint = 2000;
          }

          chunks.push(remaining.slice(0, breakPoint));
          remaining = remaining.slice(breakPoint).trim();
        }

        await message.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          if (isTextChannel) {
            await channel.send(chunks[i]);
          }
        }
      } else {
        await message.reply(fullText);
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
