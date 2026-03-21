/**
 * Session store that works across Edge and Node.js runtimes.
 * Uses base64-encoded tokens with expiry timestamp.
 * Token format: base64({exp:timestamp})
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SessionPayload {
  exp: number; // expiry timestamp
  // Also store a random part to make tokens unique and non-guessable
  rnd?: string;
}

function base64UrlEncode(str: string): string {
  if (typeof globalThis !== "undefined" && globalThis.Buffer) {
    return globalThis.Buffer.from(str).toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  // Fallback for Edge runtime without Buffer
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  if (typeof globalThis !== "undefined" && globalThis.Buffer) {
    return globalThis.Buffer.from(str, "base64").toString("utf8");
  }
  // Fallback for Edge runtime without Buffer  
  return atob(str);
}

class SessionStore {
  create(token: string, ttlMs: number = DEFAULT_TTL_MS): void {
    // Token is already generated before calling create
    // This method is kept for compatibility but does nothing
  }

  validate(token: string): boolean {
    try {
      const payloadB64 = token.split(".")[0];
      if (!payloadB64) return false;

      const payload: SessionPayload = JSON.parse(base64UrlDecode(payloadB64));

      if (Date.now() > payload.exp) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  generateToken(ttlMs: number = DEFAULT_TTL_MS): string {
    const payload: SessionPayload = {
      exp: Date.now() + ttlMs,
      rnd: Math.random().toString(36).substring(2, 15),
    };
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    return payloadB64;
  }

  invalidate(token: string): void {
    // No-op for stateless validation
  }

  cleanup(): void {
    // No-op for stateless validation
  }
}

export const sessionStore = new SessionStore();
