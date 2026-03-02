import fs from "fs";
import path from "path";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";
const SESSIONS_DIR = path.join(OPENCLAW_DIR, "sessions");

export type MessageType = "task" | "result" | "error" | "status" | "query";

export interface CommunicationMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  messageType: MessageType;
  timestamp: string;
  contentSummary: string;
  sessionId?: string;
}

export interface AgentNode {
  id: string;
  name: string;
  type: "main" | "subagent";
  messageCount: number;
  lastActive?: string;
}

export interface CommunicationEdge {
  id: string;
  source: string;
  target: string;
  messageCount: number;
  messageTypes: Record<MessageType, number>;
  lastMessage?: string;
}

export interface CommunicationGraph {
  nodes: AgentNode[];
  edges: CommunicationEdge[];
  messages: CommunicationMessage[];
}

function extractMessagesFromSession(sessionPath: string, sessionId: string): CommunicationMessage[] {
  const messages: CommunicationMessage[] = [];

  try {
    const content = fs.readFileSync(sessionPath, "utf-8");
    const lines = content.split("\n");

    let currentAgent = "main";
    let timestamp = "";

    for (const line of lines) {
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
      if (timestampMatch) {
        timestamp = timestampMatch[1];
      }

      if (line.includes("[subagent:") || line.includes("subagent:")) {
        const subagentMatch = line.match(/subagent[:\s]+([a-zA-Z0-9_-]+)/i);
        if (subagentMatch) {
          const subagentName = subagentMatch[1];
          messages.push({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fromAgent: currentAgent,
            toAgent: subagentName,
            messageType: "task",
            timestamp: timestamp || new Date().toISOString(),
            contentSummary: line.slice(0, 100),
            sessionId,
          });
          currentAgent = subagentName;
        }
      }

      if (line.includes("result") || line.includes("completed") || line.includes("done")) {
        if (currentAgent !== "main") {
          messages.push({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fromAgent: currentAgent,
            toAgent: "main",
            messageType: "result",
            timestamp: timestamp || new Date().toISOString(),
            contentSummary: line.slice(0, 100),
            sessionId,
          });
          currentAgent = "main";
        }
      }

      if (line.includes("error") || line.includes("failed") || line.includes("exception")) {
        messages.push({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fromAgent: currentAgent,
          toAgent: currentAgent === "main" ? "main" : "main",
          messageType: "error",
          timestamp: timestamp || new Date().toISOString(),
          contentSummary: line.slice(0, 100),
          sessionId,
        });
      }
    }
  } catch {
    return [];
  }

  return messages;
}

export function aggregateCommunications(options?: {
  sessionId?: string;
  startDate?: string;
  endDate?: string;
  messageTypes?: MessageType[];
}): CommunicationGraph {
  const allMessages: CommunicationMessage[] = [];

  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      return { nodes: [], edges: [], messages: [] };
    }

    const sessionFiles = fs.readdirSync(SESSIONS_DIR)
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse()
      .slice(0, 50);

    for (const file of sessionFiles) {
      const sessionId = file.replace(".jsonl", "");
      
      if (options?.sessionId && sessionId !== options.sessionId) {
        continue;
      }

      const sessionPath = path.join(SESSIONS_DIR, file);
      const messages = extractMessagesFromSession(sessionPath, sessionId);
      allMessages.push(...messages);
    }
  } catch (error) {
    console.error("[communication-aggregator] Error:", error);
  }

  const filteredMessages = allMessages.filter((msg) => {
    if (options?.messageTypes && options.messageTypes.length > 0) {
      if (!options.messageTypes.includes(msg.messageType)) {
        return false;
      }
    }

    if (options?.startDate && msg.timestamp < options.startDate) {
      return false;
    }

    if (options?.endDate && msg.timestamp > options.endDate) {
      return false;
    }

    return true;
  });

  const nodeMap = new Map<string, AgentNode>();
  const edgeMap = new Map<string, CommunicationEdge>();

  for (const msg of filteredMessages) {
    if (!nodeMap.has(msg.fromAgent)) {
      nodeMap.set(msg.fromAgent, {
        id: msg.fromAgent,
        name: msg.fromAgent,
        type: msg.fromAgent === "main" ? "main" : "subagent",
        messageCount: 0,
      });
    }
    nodeMap.get(msg.fromAgent)!.messageCount++;

    if (!nodeMap.has(msg.toAgent)) {
      nodeMap.set(msg.toAgent, {
        id: msg.toAgent,
        name: msg.toAgent,
        type: msg.toAgent === "main" ? "main" : "subagent",
        messageCount: 0,
      });
    }
    nodeMap.get(msg.toAgent)!.messageCount++;

    const edgeId = `${msg.fromAgent}-${msg.toAgent}`;
    if (!edgeMap.has(edgeId)) {
      edgeMap.set(edgeId, {
        id: edgeId,
        source: msg.fromAgent,
        target: msg.toAgent,
        messageCount: 0,
        messageTypes: { task: 0, result: 0, error: 0, status: 0, query: 0 },
      });
    }

    const edge = edgeMap.get(edgeId)!;
    edge.messageCount++;
    edge.messageTypes[msg.messageType]++;
    edge.lastMessage = msg.timestamp;
  }

  const nodes = Array.from(nodeMap.values()).sort((a, b) => {
    if (a.type === "main") return -1;
    if (b.type === "main") return 1;
    return b.messageCount - a.messageCount;
  });

  const edges = Array.from(edgeMap.values()).sort((a, b) => b.messageCount - a.messageCount);

  return {
    nodes,
    edges,
    messages: filteredMessages.slice(0, 200),
  };
}
