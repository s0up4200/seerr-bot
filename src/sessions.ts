import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta.js";

interface Session {
  messages: BetaMessageParam[];
  lastActivity: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function createSessionStore(now: () => number = Date.now) {
  const sessions = new Map<string, Session>();
  const expired = (session: Session) => now() - session.lastActivity > SESSION_TTL_MS;

  return {
    get(userId: string): BetaMessageParam[] | undefined {
      const session = sessions.get(userId);
      if (!session) return undefined;
      if (expired(session)) {
        sessions.delete(userId);
        return undefined;
      }
      return session.messages;
    },

    set(userId: string, messages: BetaMessageParam[]): void {
      // Remove the expired sessions here, so the map does not grow with users who left.
      for (const [id, session] of sessions) {
        if (expired(session)) sessions.delete(id);
      }
      sessions.set(userId, { messages, lastActivity: now() });
    },

    clear(userId: string): void {
      sessions.delete(userId);
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;

export const sessionManager = createSessionStore();
