/**
 * Tamper-proof session store with HMAC-SHA256 signatures.
 *
 * SECURITY MODEL:
 * - Tokens are signed with HMAC-SHA256 using AUTH_SECRET from environment
 * - Token format: base64url(payload).base64url(signature)
 * - Payload contains: {exp: timestamp, jti: unique-id}
 * - Any modification to payload invalidates signature → token rejected
 * - Revocation via in-memory Set of revoked JTIs (resets on server restart)
 *
 * LIMITATIONS:
 * - Revocation list is in-memory only (lost on restart)
 * - For multi-instance deployments, use a shared store (Redis, DB)
 *
 * @module session-store
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface SessionPayload {
  exp: number;
  jti: string;
}

const revokedTokens = new Set<string>();

function base64UrlEncode(str: string): string {
  if (typeof globalThis !== "undefined" && globalThis.Buffer) {
    // Use 'binary' encoding for strings that contain raw bytes (like HMAC signatures)
    return globalThis.Buffer.from(str, "binary").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  if (typeof globalThis !== "undefined" && globalThis.Buffer) {
    return globalThis.Buffer.from(str, "base64").toString("utf8");
  }
  return atob(str);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  
  // Use Buffer directly if available (Node.js runtime)
  if (typeof globalThis !== "undefined" && globalThis.Buffer) {
    return globalThis.Buffer.from(bytes).toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  
  // Fallback for Edge Runtime: use btoa with binary string
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlToBuffer(base64: string): ArrayBuffer {
  let standardBase64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  while (standardBase64.length % 4) standardBase64 += "=";

  const binary = typeof atob === "function"
    ? atob(standardBase64)
    : Buffer.from(standardBase64, "base64").toString("binary");

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function generateJti(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error("AUTH_SECRET environment variable is not set!");
    throw new Error("AUTH_SECRET not configured");
  }
  if (secret.length < 32) {
    console.warn("AUTH_SECRET should be at least 32 characters for security");
  }
  return secret;
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bufferToBase64Url(signature);
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signatureBuffer = base64UrlToBuffer(signature);
    return await crypto.subtle.verify("HMAC", key, signatureBuffer, encoder.encode(data));
  } catch {
    return false;
  }
}

class SessionStore {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(_token: string, _ttlMs?: number): void {
    // Kept for compatibility — tokens are now generated via generateToken()
  }

  /**
   * Validate a session token.
   * Checks: 1) valid format, 2) HMAC signature, 3) not expired, 4) not revoked
   *
   * @param token - The token to validate
   * @returns Promise resolving to true if valid, false otherwise
   */
  async validate(token: string): Promise<boolean> {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) {
        return false;
      }

      const [payloadB64, signature] = parts;
      if (!payloadB64 || !signature) {
        return false;
      }

      const secret = getAuthSecret();
      const isValidSignature = await hmacVerify(payloadB64, signature, secret);
      if (!isValidSignature) {
        return false;
      }

      const payload: SessionPayload = JSON.parse(base64UrlDecode(payloadB64));
      if (Date.now() > payload.exp) {
        return false;
      }

      if (revokedTokens.has(payload.jti)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a new signed session token.
   *
   * @param ttlMs - Time to live in milliseconds
   * @returns Promise resolving to the signed token
   */
  async generateToken(ttlMs: number = DEFAULT_TTL_MS): Promise<string> {
    const payload: SessionPayload = {
      exp: Date.now() + ttlMs,
      jti: generateJti(),
    };
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const secret = getAuthSecret();
    const signature = await hmacSign(payloadB64, secret);
    return `${payloadB64}.${signature}`;
  }

  /**
   * Invalidate (revoke) a session token.
   * Extracts the JTI and adds it to the revocation list.
   *
   * @param token - The token to invalidate
   */
  invalidate(token: string): void {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) return;

      const payload: SessionPayload = JSON.parse(base64UrlDecode(parts[0]));
      if (payload.jti) {
        revokedTokens.add(payload.jti);
      }
    } catch {
      // Invalid token format — nothing to revoke
    }
  }

  /**
   * Clear expired tokens from the revocation list.
   * Note: We keep revoked JTIs until cleanup to prevent replay attacks.
   * Since we don't store exp in the revocation list, this is a no-op.
   * For production with long-running servers, consider periodic cleanup
   * based on max TTL.
   */
  cleanup(): void {
    // No-op for in-memory revocation without expiration tracking
    // In production, implement periodic cleanup of old JTIs
  }

  /**
   * Get the count of revoked tokens (for monitoring/debugging).
   */
  getRevokedCount(): number {
    return revokedTokens.size;
  }

  /**
   * Clear all revoked tokens (for testing only).
   */
  clearRevoked(): void {
    revokedTokens.clear();
  }
}

export const sessionStore = new SessionStore();
