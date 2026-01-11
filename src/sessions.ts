import Anthropic from "@anthropic-ai/sdk";

interface Session {
  messages: Anthropic.MessageParam[];
  lastActivity: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

class SessionManager {
  private sessions = new Map<string, Session>();

  get(userId: string): Anthropic.MessageParam[] | undefined {
    const session = this.sessions.get(userId);
    if (!session) return undefined;

    // Check if session has expired
    if (Date.now() - session.lastActivity > SESSION_TTL_MS) {
      this.sessions.delete(userId);
      return undefined;
    }

    return session.messages;
  }

  set(userId: string, messages: Anthropic.MessageParam[]): void {
    this.sessions.set(userId, {
      messages,
      lastActivity: Date.now(),
    });
  }

  clear(userId: string): void {
    this.sessions.delete(userId);
  }

  // Cleanup expired sessions periodically
  cleanup(): void {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        this.sessions.delete(userId);
      }
    }
  }
}

export const sessionManager = new SessionManager();

// Run cleanup every 5 minutes
setInterval(() => sessionManager.cleanup(), 5 * 60 * 1000);
