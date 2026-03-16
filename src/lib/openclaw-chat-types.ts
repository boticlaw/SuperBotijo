export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatSessionEntry {
  key: string;
  sessionId: string;
  updatedAt: number;
  label: string;
  channel?: string;
  chatType?: string;
  isMain: boolean;
}

export interface ChatMessageEntry {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  runId?: string;
  toolName?: string;
}

export interface ChatGatewayStatus {
  available: boolean;
  latencyMs: number | null;
  error: string | null;
}

export interface ChatAgentSnapshot {
  agentId: string;
  readOnly: boolean;
  gateway: ChatGatewayStatus;
  session: ChatSessionEntry | null;
  sessions: ChatSessionEntry[];
  messages: ChatMessageEntry[];
}

export interface ChatApiError {
  code:
    | "INVALID_AGENT"
    | "SESSION_NOT_FOUND"
    | "TRANSCRIPT_UNAVAILABLE"
    | "GATEWAY_UNAVAILABLE"
    | "SEND_FAILED"
    | "INTERNAL_ERROR";
  message: string;
  details?: string;
}

export interface ChatStreamEvent {
  type: "status" | "assistant_delta" | "assistant_final" | "error" | "done";
  runId?: string;
  message?: string;
  text?: string;
  history?: ChatMessageEntry[];
}
