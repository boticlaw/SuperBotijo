import { NextRequest, NextResponse } from "next/server";
import {
  TASK_COMMENT_TYPE,
  createTaskComment,
  getTask,
  listTaskComments,
} from "@/lib/kanban-db";
import {
  COMMENT_RATE_LIMIT_SCOPE,
  hasPotentialSecret,
  isCommentRateLimited,
  normalizeStructuredCommentPayload,
} from "@/lib/kanban-comments";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseLimit(raw: string | null): number {
  if (!raw) {
    return 50;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 50;
  }

  return Math.min(parsed, 200);
}

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const task = getTask(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const comments = listTaskComments({
      taskId: id,
      limit: parseLimit(searchParams.get("limit")),
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Failed to list task comments:", error);
    return NextResponse.json({ error: "Failed to list task comments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const task = getTask(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json() as Record<string, unknown>;
    const payload = normalizeStructuredCommentPayload(body);

    const ip = getClientIp(request);
    const rateLimit = isCommentRateLimited(COMMENT_RATE_LIMIT_SCOPE.HUMAN, ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many comments. Try again in a minute." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
        }
      );
    }

    const safetyScanInput = [payload.content, payload.evidence, payload.nextAction]
      .filter((value): value is string => typeof value === "string")
      .join("\n");

    if (hasPotentialSecret(safetyScanInput)) {
      return NextResponse.json({ error: "Comment rejected: remove sensitive information." }, { status: 400 });
    }

    const comment = createTaskComment({
      taskId: id,
      authorType: "human",
      authorId: "user",
      body: payload.content,
      commentType: TASK_COMMENT_TYPE.COMMENT,
      metadata: {
        source: "human-comments-api",
        commentType: payload.type,
        evidence: payload.evidence,
        nextAction: payload.nextAction,
        template: payload.templateKey,
        format: "structured-v1",
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task comment";
    console.error("Failed to create task comment:", error);

    if (message.includes("required") || message.includes("must be") || message.includes("Field length")) {
      return NextResponse.json({ error: "Invalid comment payload" }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create task comment" }, { status: 500 });
  }
}
