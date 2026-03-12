export const COMMENT_REQUIRED_STATUSES = {
  BLOCKED: "blocked",
  WAITING: "waiting",
  REVIEW: "review",
  DONE: "done",
} as const;

const COMMENT_REQUIRED_STATUS_SET = new Set<string>(Object.values(COMMENT_REQUIRED_STATUSES));

export const COMMENT_TYPE = {
  PROGRESS: "progress",
  BLOCKED: "blocked",
  WAITING: "waiting",
  HANDOFF: "handoff",
  DONE: "done",
  NOTE: "note",
} as const;

export type StructuredCommentType = (typeof COMMENT_TYPE)[keyof typeof COMMENT_TYPE];

export interface StructuredCommentInput {
  type: StructuredCommentType;
  content: string;
  evidence: string | null;
  nextAction: string | null;
  templateKey: string | null;
}

export interface StructuredCommentRequestPayload {
  type?: unknown;
  content?: unknown;
  evidence?: unknown;
  nextAction?: unknown;
  template?: unknown;
  body?: unknown;
  comment?: unknown;
}

export const COMMENT_RATE_LIMIT_SCOPE = {
  HUMAN: "human",
  AGENT: "agent",
} as const;

type CommentRateLimitScope = (typeof COMMENT_RATE_LIMIT_SCOPE)[keyof typeof COMMENT_RATE_LIMIT_SCOPE];

interface RateLimitWindowConfig {
  maxEvents: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export interface CommentRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

const MAX_CONTENT_LENGTH = 2000;
const MAX_EVIDENCE_LENGTH = 500;
const MAX_NEXT_ACTION_LENGTH = 280;

const RATE_LIMIT_CONFIG: Record<CommentRateLimitScope, RateLimitWindowConfig> = {
  [COMMENT_RATE_LIMIT_SCOPE.HUMAN]: {
    maxEvents: 12,
    windowMs: 60_000,
  },
  [COMMENT_RATE_LIMIT_SCOPE.AGENT]: {
    maxEvents: 24,
    windowMs: 60_000,
  },
};

const commentRateLimitStore = new Map<string, RateLimitEntry>();

const STRUCTURED_COMMENT_TYPES = new Set<string>(Object.values(COMMENT_TYPE));

const SECRET_PATTERNS = [
  /sk-[a-z0-9]{16,}/i,
  /ghp_[a-z0-9]{20,}/i,
  /glpat-[a-z0-9\-_]{20,}/i,
  /xox[baprs]-[a-z0-9-]{10,}/i,
  /-----begin [a-z ]*private key-----/i,
  /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[a-z0-9_\-\/+=]{12,}/i,
  /eyj[a-z0-9_\-]{10,}\.[a-z0-9_\-]{10,}\.[a-z0-9_\-]{10,}/i,
];

export function isCommentRequiredStatus(status: string): boolean {
  return COMMENT_REQUIRED_STATUS_SET.has(status);
}

export function isRequireCommentOnStatusFeatureEnabled(): boolean {
  const raw = process.env.FEATURE_REQUIRE_COMMENT_ON_STATUS?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function shouldRequireTransitionComment(previousStatus: string, nextStatus: string): boolean {
  return previousStatus !== nextStatus && isCommentRequiredStatus(nextStatus);
}

export function normalizeCommentBody(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTextField(value: unknown, maxLength: number): string | null {
  const normalized = normalizeCommentBody(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new Error(`Field length exceeds ${maxLength} characters`);
  }

  return normalized;
}

function normalizeCommentType(value: unknown): StructuredCommentType {
  if (typeof value !== "string") {
    return COMMENT_TYPE.NOTE;
  }

  const normalized = value.trim().toLowerCase();
  if (STRUCTURED_COMMENT_TYPES.has(normalized)) {
    return normalized as StructuredCommentType;
  }

  return COMMENT_TYPE.NOTE;
}

export function normalizeStructuredCommentPayload(payload: StructuredCommentRequestPayload): StructuredCommentInput {
  const content = normalizeTextField(payload.content ?? payload.body ?? payload.comment, MAX_CONTENT_LENGTH);
  if (!content) {
    throw new Error("Comment content is required");
  }

  return {
    type: normalizeCommentType(payload.type),
    content,
    evidence: normalizeTextField(payload.evidence, MAX_EVIDENCE_LENGTH),
    nextAction: normalizeTextField(payload.nextAction, MAX_NEXT_ACTION_LENGTH),
    templateKey: normalizeTextField(payload.template, 80),
  };
}

export function hasPotentialSecret(value: string): boolean {
  const candidate = value.trim();
  if (candidate.length === 0) {
    return false;
  }

  return SECRET_PATTERNS.some((pattern) => pattern.test(candidate));
}

export function isCommentRateLimited(scope: CommentRateLimitScope, actorId: string): CommentRateLimitResult {
  const normalizedActorId = actorId.trim().toLowerCase() || "unknown";
  const key = `${scope}:${normalizedActorId}`;
  const config = RATE_LIMIT_CONFIG[scope];
  const now = Date.now();
  const record = commentRateLimitStore.get(key);

  if (!record || now - record.windowStart >= config.windowMs) {
    commentRateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (record.count >= config.maxEvents) {
    const retryAfterMs = Math.max(0, config.windowMs - (now - record.windowStart));
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  record.count += 1;
  commentRateLimitStore.set(key, record);
  return { allowed: true };
}

export function resetCommentRateLimitForTesting(): void {
  commentRateLimitStore.clear();
}
