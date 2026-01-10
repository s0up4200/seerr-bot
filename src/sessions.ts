interface Session {
  sessionId: string;
  lastUsed: number;
}

// Session TTL: 30 minutes of inactivity
const SESSION_TTL = 30 * 60 * 1000;

class SessionManager {
  private sessions = new Map<string, Session>();

  get(userId: string): string | undefined {
    const session = this.sessions.get(userId);
    if (!session) return undefined;

    // Check if session expired
    if (Date.now() - session.lastUsed > SESSION_TTL) {
      this.sessions.delete(userId);
      return undefined;
    }

    // Update last used time
    session.lastUsed = Date.now();
    return session.sessionId;
  }

  set(userId: string, sessionId: string): void {
    this.sessions.set(userId, {
      sessionId,
      lastUsed: Date.now(),
    });
  }

  clear(userId: string): void {
    this.sessions.delete(userId);
  }

  // Clean up expired sessions periodically
  cleanup(): void {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastUsed > SESSION_TTL) {
        this.sessions.delete(userId);
      }
    }
  }
}

export const sessionManager = new SessionManager();

// Run cleanup every 10 minutes
setInterval(() => sessionManager.cleanup(), 10 * 60 * 1000);
