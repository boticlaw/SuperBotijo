import { NextRequest, NextResponse } from "next/server";

import {
  listAgentSessions,
  resolveCanonicalSession,
} from "@/lib/openclaw-chat-sessions";
import { readTranscriptMessages } from "@/lib/openclaw-transcripts";
import { checkGatewayStatus } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    if (!agentId) {
      return NextResponse.json({ code: "INVALID_AGENT", message: "Invalid agent id" }, { status: 400 });
    }

    const selectedSessionKey = request.nextUrl.searchParams.get("sessionKey");
    const sessions = listAgentSessions(agentId);
    const fallbackSession = resolveCanonicalSession(agentId);
    
    let session = fallbackSession;
    let isNew = false;
    
    if (selectedSessionKey) {
      const existing = sessions.find((entry) => entry.key === selectedSessionKey);
      if (existing) {
        session = existing;
      } else {
        session = {
          key: selectedSessionKey,
          sessionId: selectedSessionKey.replace(/:/g, "-"),
          updatedAt: Date.now(),
          label: "New Session",
          isMain: false,
        };
        isNew = true;
      }
    }

    if (isNew && session) {
      sessions.unshift(session);
    }

    const messages = (session && !isNew) ? readTranscriptMessages(agentId, session) : [];
    const gateway = await checkGatewayStatus();
    const readOnly = !gateway.available;

    return NextResponse.json({
      agentId,
      readOnly,
      gateway,
      session,
      sessions,
      messages,
    });
  } catch (error) {
    console.error("[/api/chat/agents/[agentId]] Error", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to load chat snapshot" },
      { status: 500 },
    );
  }
}
