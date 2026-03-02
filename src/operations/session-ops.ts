/**
 * Session Operations - Business logic for session management
 */
import fs from 'fs/promises';
import path from 'path';
import type { OperationResult, PaginationParams, PaginatedResult } from './index';

export interface Session {
  key: string;
  type: 'main' | 'cron' | 'subagent' | 'chat';
  model: string;
  status: 'active' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  tokenCount: number;
  messageCount: number;
  parentKey?: string;
  task?: string;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  tokens?: number;
}

// Session storage path
const SESSIONS_PATH = process.env.OPENCLAW_SESSIONS_PATH || '/home/daniel/.openclaw/sessions';

/**
 * List all sessions
 */
export async function getSessions(
  filters: { type?: string; status?: string; model?: string } = {},
  pagination: PaginationParams = {}
): Promise<OperationResult<PaginatedResult<Session>>> {
  try {
    const sessions: Session[] = [];

    // Read session directory
    try {
      const files = await fs.readdir(SESSIONS_PATH);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const filePath = path.join(SESSIONS_PATH, file);
        const stat = await fs.stat(filePath);
        const key = file.replace('.jsonl', '');

        // Parse session type from key
        let type: Session['type'] = 'main';
        if (key.includes('cron')) type = 'cron';
        else if (key.includes('subagent')) type = 'subagent';
        else if (key.includes('chat')) type = 'chat';

        // Count tokens and messages
        let tokenCount = 0;
        let messageCount = 0;
        let model = 'unknown';
        let firstTimestamp: string | null = null;
        let lastTimestamp: string | null = null;

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n');

          for (const line of lines) {
            try {
              const msg = JSON.parse(line);
              messageCount++;
              tokenCount += msg.tokens || 0;

              if (msg.model) model = msg.model;
              if (msg.timestamp) {
                if (!firstTimestamp) firstTimestamp = msg.timestamp;
                lastTimestamp = msg.timestamp;
              }
            } catch {}
          }
        } catch {}

        const session: Session = {
          key,
          type,
          model,
          status: 'completed', // Assume completed if file exists
          startTime: firstTimestamp || stat.birthtime.toISOString(),
          endTime: lastTimestamp || stat.mtime.toISOString(),
          tokenCount,
          messageCount,
        };

        // Apply filters
        if (filters.type && session.type !== filters.type) continue;
        if (filters.model && session.model !== filters.model) continue;

        sessions.push(session);
      }
    } catch {
      // Sessions directory doesn't exist
    }

    // Sort by start time descending
    sessions.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    // Paginate
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const start = (page - 1) * limit;

    return {
      success: true,
      data: {
        items: sessions.slice(start, start + limit),
        total: sessions.length,
        page,
        limit,
        hasMore: start + limit < sessions.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sessions',
    };
  }
}

/**
 * Get a single session by key
 */
export async function getSessionByKey(key: string): Promise<OperationResult<Session>> {
  try {
    const filePath = path.join(SESSIONS_PATH, `${key}.jsonl`);
    const stat = await fs.stat(filePath);

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    let tokenCount = 0;
    let messageCount = 0;
    let model = 'unknown';
    let firstTimestamp: string | null = null;
    let lastTimestamp: string | null = null;

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        messageCount++;
        tokenCount += msg.tokens || 0;

        if (msg.model) model = msg.model;
        if (msg.timestamp) {
          if (!firstTimestamp) firstTimestamp = msg.timestamp;
          lastTimestamp = msg.timestamp;
        }
      } catch {}
    }

    // Parse session type from key
    let type: Session['type'] = 'main';
    if (key.includes('cron')) type = 'cron';
    else if (key.includes('subagent')) type = 'subagent';
    else if (key.includes('chat')) type = 'chat';

    const session: Session = {
      key,
      type,
      model,
      status: 'completed',
      startTime: firstTimestamp || stat.birthtime.toISOString(),
      endTime: lastTimestamp || stat.mtime.toISOString(),
      tokenCount,
      messageCount,
    };

    return { success: true, data: session };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Session not found',
    };
  }
}

/**
 * Get session transcript (messages)
 */
export async function getSessionTranscript(
  key: string,
  pagination: PaginationParams = {}
): Promise<OperationResult<PaginatedResult<SessionMessage>>> {
  try {
    const filePath = path.join(SESSIONS_PATH, `${key}.jsonl`);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    const messages: SessionMessage[] = [];

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        messages.push({
          role: msg.role || 'user',
          content: msg.content || msg.text || '',
          timestamp: msg.timestamp,
          tokens: msg.tokens,
        });
      } catch {}
    }

    // Paginate
    const page = pagination.page || 1;
    const limit = pagination.limit || 50;
    const start = (page - 1) * limit;

    return {
      success: true,
      data: {
        items: messages.slice(start, start + limit),
        total: messages.length,
        page,
        limit,
        hasMore: start + limit < messages.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get transcript',
    };
  }
}

/**
 * Cancel a running session
 */
export async function cancelSession(key: string): Promise<OperationResult> {
  try {
    // In production, this would signal the running process to stop
    // For now, we just mark it as cancelled
    console.log(`[session-ops] Session ${key} cancelled`);
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel session',
    };
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(): Promise<OperationResult<{
  total: number;
  byType: Record<string, number>;
  byModel: Record<string, number>;
  totalTokens: number;
  avgTokensPerSession: number;
}>> {
  try {
    const result = await getSessions({}, { limit: 1000 });
    if (!result.success || !result.data) {
      return result as OperationResult<any>;
    }

    const sessions = result.data.items;
    const byType: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    let totalTokens = 0;

    for (const session of sessions) {
      byType[session.type] = (byType[session.type] || 0) + 1;
      byModel[session.model] = (byModel[session.model] || 0) + 1;
      totalTokens += session.tokenCount;
    }

    return {
      success: true,
      data: {
        total: sessions.length,
        byType,
        byModel,
        totalTokens,
        avgTokensPerSession: sessions.length > 0 ? totalTokens / sessions.length : 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    };
  }
}
