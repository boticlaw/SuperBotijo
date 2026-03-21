import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionStore } from "@/lib/session-store";

// Simple in-memory rate limiter (per-IP, resets on server restart)
// Sufficient for a personal dashboard — no external dependency needed
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout after max attempts

interface AttemptRecord {
  count: number;
  windowStart: number;
  lockedUntil?: number;
}

const attempts = new Map<string, AttemptRecord>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record) {
    return { allowed: true };
  }

  // Still locked out?
  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, retryAfterMs: record.lockedUntil - now };
  }

  // Window expired — reset
  if (now - record.windowStart > WINDOW_MS) {
    attempts.delete(ip);
    return { allowed: true };
  }

  // Within window, check count
  if (record.count >= MAX_ATTEMPTS) {
    // Lock out
    record.lockedUntil = now + LOCKOUT_MS;
    attempts.set(ip, record);
    return { allowed: false, retryAfterMs: LOCKOUT_MS };
  }

  return { allowed: true };
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
  } else {
    record.count += 1;
    attempts.set(ip, record);
  }
}

function clearAttempts(ip: string): void {
  attempts.delete(ip);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Rate limit check
  const { allowed, retryAfterMs } = checkRateLimit(ip);
  if (!allowed) {
    const retryAfterSec = Math.ceil((retryAfterMs ?? LOCKOUT_MS) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many failed attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  const { password } = await request.json();

  if (password === process.env.ADMIN_PASSWORD) {
    clearAttempts(ip); // Reset on success

    const ttlMs = 24 * 60 * 60 * 1000; // 24 hours
    const token = await sessionStore.generateToken(ttlMs);

    const response = NextResponse.json({
      success: true,
      expiresIn: Math.floor(ttlMs / 1000),
    });

    // Set httpOnly cookie for browser auth
    // Only use Secure flag if request is HTTPS (check x-forwarded-proto header)
    const isHttps = request.headers.get("x-forwarded-proto") === "https";
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: ttlMs / 1000,
      path: "/",
    });

    return response;
  }

  // Record failed attempt
  recordFailure(ip);

  return NextResponse.json(
    { success: false, error: "Invalid password" },
    { status: 401 }
  );
}
