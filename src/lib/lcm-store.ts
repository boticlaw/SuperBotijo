/**
 * LCM (Lossless-Claw Memory) Read-Only SQLite Store
 *
 * Provides read-only access to the lcm.db SQLite database created by the
 * lossless-claw plugin. Follows the singleton pattern from kanban-db.ts.
 *
 * IMPORTANT: This module MUST NEVER write to lcm.db.
 */

import Database from "better-sqlite3";
import { LCM_DB_PATH } from "@/lib/paths";

// ============================================================================
// Types
// ============================================================================

export interface LcmConversation {
  conversation_id: string;
  title: string | null;
  active: number;
  created_at: string;
  updated_at: string | null;
  message_count: number;
}

export interface LcmMessage {
  message_id: string;
  seq: number;
  role: string;
  content: string;
  token_count: number;
  created_at: string;
}

export interface LcmSummary {
  summary_id: string;
  kind: string;
  depth: number;
  content: string;
  token_count: number;
  descendant_count: number;
  parent_ids: string[];
  child_message_ids: string[];
}

export interface LcmSearchResult {
  type: "message" | "summary";
  conversation_id: string;
  content: string;
  rank: number;
}

// ============================================================================
// Database Singleton
// ============================================================================

let _db: Database.Database | null = null;

/**
 * Reset the database connection (for testing only)
 */
export function resetDbForTesting(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Get the read-only database connection singleton.
 * Opens lcm.db in WAL mode with read-only access.
 */
function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(LCM_DB_PATH, { readonly: true });

  // WAL mode for better concurrency (read-only connection can still set this)
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");

  return _db;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all conversations with message counts
 */
export function getConversations(): LcmConversation[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      c.conversation_id,
      c.title,
      c.active,
      c.created_at,
      c.updated_at,
      COUNT(m.message_id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON c.conversation_id = m.conversation_id
    GROUP BY c.conversation_id
    ORDER BY c.updated_at DESC
  `).all() as LcmConversation[];

  return rows;
}

/** Default pagination limit for messages */
const DEFAULT_MESSAGE_LIMIT = 50;
/** Maximum pagination limit for messages */
const MAX_MESSAGE_LIMIT = 200;

/**
 * Get paginated messages for a conversation
 * @param conversationId - Conversation UUID
 * @param offset - Number of messages to skip
 * @param limit - Maximum messages to return (default 50, max 200)
 */
export function getMessages(
  conversationId: string,
  offset: number,
  limit: number = DEFAULT_MESSAGE_LIMIT
): { messages: LcmMessage[]; total: number; hasMore: boolean } {
  const db = getDb();

  // Clamp limit to [1, 200]
  const clampedLimit = Math.max(1, Math.min(MAX_MESSAGE_LIMIT, limit));

  // Count total messages
  const countRow = db.prepare(
    "SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?"
  ).get(conversationId) as { total: number };

  const total = countRow.total;

  // Fetch paginated messages
  const messages = db.prepare(`
    SELECT
      message_id,
      seq,
      role,
      content,
      token_count,
      created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY seq ASC
    LIMIT ? OFFSET ?
  `).all(conversationId, clampedLimit, offset) as LcmMessage[];

  const hasMore = offset + messages.length < total;

  return { messages, total, hasMore };
}

/**
 * Get summaries for a conversation, including parent IDs and child message IDs
 * @param conversationId - Conversation UUID
 */
export function getSummaries(conversationId: string): LcmSummary[] {
  const db = getDb();

  // Main summaries query
  const summaries = db.prepare(`
    SELECT
      summary_id,
      kind,
      depth,
      content,
      token_count,
      descendant_count
    FROM summaries
    WHERE conversation_id = ?
    ORDER BY depth ASC
  `).all(conversationId) as Array<Omit<LcmSummary, "parent_ids" | "child_message_ids">>;

  // For each summary, fetch related parent_ids and child_message_ids
  const parentStmt = db.prepare(
    "SELECT parent_id FROM summary_parents WHERE summary_id = ?"
  );
  const childStmt = db.prepare(
    "SELECT message_id FROM summary_messages WHERE summary_id = ?"
  );

  return summaries.map((summary) => {
    const parentRows = parentStmt.all(summary.summary_id) as Array<{ parent_id: string }>;
    const childRows = childStmt.all(summary.summary_id) as Array<{ message_id: string }>;

    return {
      ...summary,
      parent_ids: parentRows.map((r) => r.parent_id),
      child_message_ids: childRows.map((r) => r.message_id),
    };
  });
}

/**
 * Sanitize a search query for FTS5.
 * Strips special characters and operators that would cause FTS5 syntax errors.
 */
function sanitizeFtsQuery(query: string): string {
  return query
    .replace(/["*()]/g, "")
    .replace(/\b(AND|OR|NOT)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if a table exists in the database
 */
function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(tableName) as { "1": number } | undefined;
  return row !== undefined;
}

/**
 * Search across messages and summaries using FTS5 (with LIKE fallback)
 * @param query - Search query string
 */
export function search(query: string): LcmSearchResult[] {
  const db = getDb();
  const sanitized = sanitizeFtsQuery(query);

  if (!sanitized) {
    return [];
  }

  const hasMessagesFts = tableExists(db, "messages_fts");
  const hasSummariesFts = tableExists(db, "summaries_fts");

  const results: LcmSearchResult[] = [];

  // Search messages
  if (hasMessagesFts) {
    const messageResults = db.prepare(`
      SELECT 'message' as type, conversation_id, content, rank
      FROM messages_fts
      WHERE messages_fts MATCH ?
      ORDER BY rank
      LIMIT 50
    `).all(sanitized) as LcmSearchResult[];
    results.push(...messageResults);
  } else {
    const likePattern = `%${sanitized}%`;
    const messageResults = db.prepare(`
      SELECT 'message' as type, conversation_id, content, 0 as rank
      FROM messages
      WHERE content LIKE ?
      LIMIT 50
    `).all(likePattern) as LcmSearchResult[];
    results.push(...messageResults);
  }

  // Search summaries
  if (hasSummariesFts) {
    const summaryResults = db.prepare(`
      SELECT 'summary' as type, conversation_id, content, rank
      FROM summaries_fts
      WHERE summaries_fts MATCH ?
      ORDER BY rank
      LIMIT 50
    `).all(sanitized) as LcmSearchResult[];
    results.push(...summaryResults);
  } else {
    const likePattern = `%${sanitized}%`;
    const summaryResults = db.prepare(`
      SELECT 'summary' as type, conversation_id, content, 0 as rank
      FROM summaries
      WHERE content LIKE ?
      LIMIT 50
    `).all(likePattern) as LcmSearchResult[];
    results.push(...summaryResults);
  }

  return results;
}
