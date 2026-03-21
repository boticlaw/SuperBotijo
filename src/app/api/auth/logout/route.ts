import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionStore } from "@/lib/session-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;

  if (token) {
    sessionStore.invalidate(token);
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
