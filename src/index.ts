import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ApplicationIntegrationType,
  EmbedBuilder,
  GatewayIntentBits,
  InteractionContextType,
  Message,
  MessageFlags,
  Partials,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextChannel,
  DMChannel,
} from "discord.js";
import { config } from "./config.js";
import { getUsage, resetSession, runTurn } from "./agent/index.js";
import { seerr } from "./services/seerr.js";
import {
  extractPendingRequest,
  formatErrorMessage,
  getRequestStatusText,
  POSTER_REGEX,
  splitTrailingText,
} from "./utils.js";

interface ResponseSection {
  text: string;
  posterUrl: string | null;
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

function isAllowed(userId: string): boolean {
  const { allowedUserIds } = config.discord;
  return allowedUserIds.length === 0 || allowedUserIds.includes(userId);
}

function formatUsageStats(userId: string): string {
  const stats = getUsage(userId);
  if (!stats) return "No usage stats yet. Start by making a request!";
  const total = stats.inputTokens + stats.outputTokens;
  return (
    `**Your Usage Stats**\n` +
    `Requests: ${stats.turns.toLocaleString()}\n` +
    `Input tokens: ${stats.inputTokens.toLocaleString()}\n` +
    `Output tokens: ${stats.outputTokens.toLocaleString()}\n` +
    `Total tokens: ${total.toLocaleString()}\n` +
    `Est. cost: $${stats.cost.toFixed(4)}\n` +
    `Model: ${stats.model}`
  );
}

const commands = [
  new SlashCommandBuilder().setName("reset").setDescription("Start a new conversation"),
  new SlashCommandBuilder().setName("stats").setDescription("Show your token usage and estimated cost"),
].map((command) =>
  command
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .toJSON(),
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once("clientReady", async () => {
  console.log(`Seerr Bot is online as ${client.user?.tag}`);
  console.log(
    `Invite URL: https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&permissions=274877991936&scope=bot%20applications.commands`
  );
  // This call replaces the full global command list, so a removed command disappears from Discord.
  try {
    await client.application?.commands.set(commands);
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  let content = "You do not have access to this bot.";
  if (isAllowed(userId)) {
    if (interaction.commandName === "reset") {
      // Discord drops a reply that takes more than 3 seconds, so do not wait for a running turn.
      // The reset still runs after that turn and before the next message.
      void resetSession(userId);
      content = "Started a new conversation! What would you like to watch?";
    } else {
      content = formatUsageStats(userId);
    }
  }
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
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

  if (!isAllowed(message.author.id)) return;

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
        "- Approve request #42\n\n" +
        "Commands:\n" +
        "- /reset starts a new conversation\n" +
        "- /stats shows your token usage and estimated cost"
    );
    return;
  }

  // Get a text-capable channel
  const channel = message.channel;
  const isTextChannel =
    channel instanceof TextChannel || channel instanceof DMChannel;

  // Keep typing indicator active during processing
  const typingInterval = setInterval(() => {
    if (isTextChannel) channel.sendTyping().catch(() => {});
  }, 5000);

  try {
    if (isTextChannel) await channel.sendTyping();

    console.log(`Processing request from ${message.author.tag}: ${content}`);

    const { reply: response, messages, outcome } = await runTurn(message.author.id, content);

    // Extract pending request from tool call history (not from LLM text).
    // A turn that failed shows no confirm buttons.
    const pendingRequest = outcome === "ok" ? extractPendingRequest(messages) : null;

    // Build confirmation buttons if there's a pending request
    const buttonId = pendingRequest ? crypto.randomUUID() : "";
    const cancelButton = new ButtonBuilder()
      .setCustomId(`cancel-${buttonId}`)
      .setLabel("Wrong one")
      .setStyle(ButtonStyle.Secondary);
    const components = pendingRequest
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`confirm-${buttonId}`)
              .setLabel("For me")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`other-${buttonId}`)
              .setLabel("For someone else")
              .setStyle(ButtonStyle.Primary),
            cancelButton,
          ),
        ]
      : [];

    // Parse response into sections
    const { body, trailing } = splitTrailingText(response);
    const sections = parseResponseSections(body);

    // Check if any section has a poster
    const hasPosters = sections.some((s) => s.posterUrl);

    let sentMessage: Message;

    if (hasPosters) {
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

      sentMessage = await message.reply({
        content: trailing.slice(0, DISCORD_MAX_LENGTH) || undefined,
        embeds,
        components,
      });
    } else {
      const fullText = sections.map((s) => s.text).join("\n\n---\n\n");
      const chunks = splitTextIntoChunks(fullText);
      sentMessage = await message.reply({ content: chunks[0], components });
      if (isTextChannel) {
        for (let i = 1; i < chunks.length; i++) {
          await channel.send(chunks[i]);
        }
      }
    }

    // Set up button collector for pending requests
    if (pendingRequest) {
      const pr = pendingRequest;
      const collector = sentMessage.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 5 * 60 * 1000,
      });

      collector.on("collect", async (interaction) => {
        // "For someone else" swaps the buttons for a Seerr user picker.
        if (interaction.customId === `other-${buttonId}`) {
          try {
            const { results } = await seerr.listUsers();
            if (results.length === 0) throw new Error("Seerr returned no users");
            // ponytail: a Discord select menu holds 25 options; more users need paging or a search step.
            const options = results.map((u) => ({
              label: (u.displayName || u.username || u.email).slice(0, 100),
              value: String(u.id),
            }));
            await interaction.update({
              components: [
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                  new StringSelectMenuBuilder()
                    .setCustomId(`user-${buttonId}`)
                    .setPlaceholder("Request on behalf of...")
                    .addOptions(options),
                ),
                new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton),
              ],
            });
          } catch (error) {
            collector.stop();
            await interaction.update({ components: [] });
            await interaction.followUp(
              `Failed to load Seerr users: ${formatErrorMessage(error)}`,
            );
          }
          return;
        }

        // Read the picked user before the update below clears the components it comes from.
        const selected = interaction.isStringSelectMenu()
          ? interaction.component.options.find((o) => o.value === interaction.values[0])
          : undefined;
        collector.stop();
        // Leave the choice on the message as a disabled button, so the user sees what they picked.
        const cancelled = interaction.customId === `cancel-${buttonId}`;
        const choice = cancelled ? "Cancelled" : selected ? `For ${selected.label}` : "For me";
        await interaction.update({
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`done-${buttonId}`)
                .setLabel(choice.slice(0, 80))
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            ),
          ],
        });

        if (!cancelled) {
          // No userId means Seerr files the request as the API key owner.
          const userId = selected ? Number(selected.value) : undefined;
          try {
            const res =
              pr.mediaType === "movie"
                ? await seerr.requestMovie(pr.tmdbId, userId)
                : await seerr.requestTv(pr.tmdbId, pr.seasons!, userId);
            const status = getRequestStatusText(res.status);
            await interaction.followUp(
              `Request submitted for ${selected?.label ?? "you"}! (ID: ${res.id}, Status: ${status})`,
            );
          } catch (error) {
            await interaction.followUp(
              `Failed to submit request: ${formatErrorMessage(error)}`,
            );
          }
        } else {
          await interaction.followUp(
            "Request cancelled. Tell me what you're looking for instead!",
          );
        }
      });

      collector.on("end", (_collected, reason) => {
        if (reason === "time") {
          sentMessage.edit({ components: [] }).catch(() => {});
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
      // Reply may fail if the channel is gone
    }
  } finally {
    clearInterval(typingInterval);
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
