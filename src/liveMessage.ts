import type { Message } from "discord.js";

const EDIT_INTERVAL_MS = 1200;
const DISCORD_MAX_LENGTH = 2000;
const TRUNCATION_SUFFIX = "...";

export class LiveMessage {
  private message: Message | null = null;
  private lastEditTime = 0;
  private pendingText: string | null = null;
  private editTimer: Timer | null = null;
  private latestSnapshot = "";
  private sendPromise: Promise<void> | null = null;

  constructor(private replyTarget: Message) {}

  update(textSnapshot: string): void {
    this.latestSnapshot = textSnapshot;

    // First text: send the initial reply
    if (!this.message && !this.sendPromise) {
      this.sendPromise = this.sendInitial(textSnapshot);
      return;
    }

    // Throttle subsequent edits
    const now = Date.now();
    const elapsed = now - this.lastEditTime;

    if (elapsed >= EDIT_INTERVAL_MS && !this.sendPromise) {
      this.doEdit(textSnapshot);
    } else {
      // Queue for later
      this.pendingText = textSnapshot;
      if (!this.editTimer) {
        const delay = Math.max(0, EDIT_INTERVAL_MS - elapsed);
        this.editTimer = setTimeout(() => {
          this.editTimer = null;
          if (this.pendingText && this.message) {
            this.doEdit(this.pendingText);
            this.pendingText = null;
          }
        }, delay);
      }
    }
  }

  async finalize(): Promise<Message | null> {
    // Clear pending timer
    if (this.editTimer) {
      clearTimeout(this.editTimer);
      this.editTimer = null;
    }

    // Wait for initial send if still in flight
    if (this.sendPromise) {
      await this.sendPromise;
    }

    // Do one final edit with the latest text
    if (this.message && this.latestSnapshot) {
      const display = truncateForDiscord(this.latestSnapshot);
      try {
        await this.message.edit(display);
      } catch (error) {
        console.error("Failed to finalize live message:", error);
      }
    }

    return this.message;
  }

  async delete(): Promise<void> {
    this.destroy();
    if (this.sendPromise) {
      await this.sendPromise;
    }
    if (this.message) {
      try {
        await this.message.delete();
      } catch (error) {
        console.error("Failed to delete live message:", error);
      }
    }
  }

  destroy(): void {
    if (this.editTimer) {
      clearTimeout(this.editTimer);
      this.editTimer = null;
    }
  }

  private async sendInitial(text: string): Promise<void> {
    try {
      const display = truncateForDiscord(text);
      this.message = await this.replyTarget.reply(display);
      this.lastEditTime = Date.now();
    } catch (error) {
      console.error("Failed to send initial live message:", error);
    } finally {
      this.sendPromise = null;
    }
  }

  private doEdit(text: string): void {
    if (!this.message) return;
    const display = truncateForDiscord(text);
    this.lastEditTime = Date.now();
    // Fire and forget — don't block streaming on edit completion
    this.message.edit(display).catch((error) => {
      console.error("Failed to edit live message:", error);
    });
  }
}

function truncateForDiscord(text: string): string {
  if (text.length <= DISCORD_MAX_LENGTH) return text;
  return (
    text.slice(0, DISCORD_MAX_LENGTH - TRUNCATION_SUFFIX.length) +
    TRUNCATION_SUFFIX
  );
}
