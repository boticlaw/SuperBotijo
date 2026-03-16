import { NextResponse } from "next/server";

import { readTranscriptMessages } from "@/lib/openclaw-transcripts";
import { checkGatewayStatus, startGatewayChat } from "@/lib/openclaw-gateway";
import { listAgentSessions, resolveCanonicalSession } from "@/lib/openclaw-chat-sessions";
import type { ChatStreamEvent } from "@/lib/openclaw-chat-types";

export const dynamic = "force-dynamic";

interface SendBody {
  message?: string;
  sessionKey?: string;
}

function messageFromUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallback;
}

function sse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function textFromMessage(input: unknown): string {
  if (!input || typeof input !== "object") {
    return "";
  }

  const directText = (input as { text?: unknown }).text;
  if (typeof directText === "string") {
    return directText;
  }

  const content = (input as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const chunks: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const text = (block as { text?: unknown }).text;
    if (typeof text === "string") {
      chunks.push(text);
    }
  }

  return chunks.join("\n").trim();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    const body = (await request.json()) as SendBody;
    const message = body.message?.trim() ?? "";

    if (!agentId) {
      return NextResponse.json({ code: "INVALID_AGENT", message: "Invalid agent id" }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ code: "SEND_FAILED", message: "Message cannot be empty" }, { status: 400 });
    }

    const gateway = await checkGatewayStatus();
    if (!gateway.available) {
      return NextResponse.json(
        { code: "GATEWAY_UNAVAILABLE", message: gateway.error ?? "Gateway unavailable" },
        { status: 503 },
      );
    }

    const sessions = listAgentSessions(agentId);
    const fallbackSession = resolveCanonicalSession(agentId);
    let sessionKey = fallbackSession?.key;

    if (body.sessionKey) {
      const existingSession = sessions.find((entry) => entry.key === body.sessionKey);
      if (existingSession) {
        sessionKey = existingSession.key;
      } else if (body.sessionKey.startsWith("agent:")) {
        sessionKey = body.sessionKey;
      }
    }

    if (!sessionKey) {
      return NextResponse.json(
        { code: "SESSION_NOT_FOUND", message: "No chat session found for agent" },
        { status: 404 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let run = null as Awaited<ReturnType<typeof startGatewayChat>> | null;
        try {
          run = await startGatewayChat({
            sessionKey: sessionKey as string,
            message,
          });

          controller.enqueue(
            encoder.encode(
              sse({
                type: "status",
                runId: run.runId,
                message: "started",
              }),
            ),
          );

          run.onChatEvent((payload) => {
            const chatPayload = payload as { state?: string; runId?: string; message?: unknown; errorMessage?: string };
            if (!chatPayload.state) {
              return;
            }

            if (chatPayload.state === "delta") {
              const delta = textFromMessage(chatPayload.message);
              if (delta) {
                controller.enqueue(
                  encoder.encode(
                    sse({
                      type: "assistant_delta",
                      runId: chatPayload.runId,
                      text: delta,
                    }),
                  ),
                );
              }
              return;
            }

            if (chatPayload.state === "final") {
              controller.enqueue(
                encoder.encode(
                  sse({
                    type: "assistant_final",
                    runId: chatPayload.runId,
                    text: textFromMessage(chatPayload.message),
                  }),
                ),
              );
              return;
            }

            if (chatPayload.state === "error" || chatPayload.state === "aborted") {
              controller.enqueue(
                encoder.encode(
                  sse({
                    type: "error",
                    runId: chatPayload.runId,
                    message: chatPayload.errorMessage ?? "Chat run failed",
                  }),
                ),
              );
            }
          });

          await run.waitForCompletion(120_000);
          const updatedSessions = listAgentSessions(agentId);
          const activeSession = updatedSessions.find((entry) => entry.key === sessionKey);
          const refreshedMessages = activeSession ? readTranscriptMessages(agentId, activeSession) : [];
          controller.enqueue(
            encoder.encode(
              sse({
                type: "done",
                runId: run.runId,
                history: refreshedMessages,
              }),
            ),
          );
        } catch (error) {
          const message = messageFromUnknownError(error, "Chat send failed");
          controller.enqueue(
            encoder.encode(
              sse({
                type: "error",
                message,
              }),
            ),
          );
        } finally {
          run?.close();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[/api/chat/agents/[agentId]/send] Error", error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: messageFromUnknownError(error, "Failed to send message"),
        details: "Unhandled send-route failure before SSE stream was established",
      },
      { status: 500 },
    );
  }
}
