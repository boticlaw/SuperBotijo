"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  FileText,
  Layers,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";
import type {
  LcmConversation,
  LcmMessage,
  LcmSummary,
  LcmSearchResult,
} from "@/lib/lcm-store";

// ============================================================================
// Props
// ============================================================================

interface LcmMemoryTabProps {
  lcmAvailable: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const MESSAGES_PAGE_SIZE = 50;
const CONTENT_TRUNCATE_LENGTH = 500;
const SEARCH_DEBOUNCE_MS = 300;

// ============================================================================
// Role badge colors
// ============================================================================

const ROLE_STYLES: Record<string, { border: string; bg: string; label: string }> = {
  system: {
    border: "var(--text-muted)",
    bg: "transparent",
    label: "var(--text-muted)",
  },
  user: {
    border: "var(--accent)",
    bg: "rgba(59, 130, 246, 0.05)",
    label: "var(--accent)",
  },
  assistant: {
    border: "var(--border)",
    bg: "var(--card)",
    label: "var(--text-primary)",
  },
  tool: {
    border: "var(--text-muted)",
    bg: "var(--surface, var(--card))",
    label: "var(--text-muted)",
  },
};

// ============================================================================
// Component
// ============================================================================

export function LcmMemoryTab({ lcmAvailable }: LcmMemoryTabProps) {
  const { t } = useI18n();

  // -- State --
  const [conversations, setConversations] = useState<LcmConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<LcmMessage[]>([]);
  const [messageTotal, setMessageTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [summaries, setSummaries] = useState<LcmSummary[]>([]);
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LcmSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState({
    conversations: false,
    messages: false,
    summaries: false,
  });

  // -- Refs --
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ========================================================================
  // Data loading
  // ========================================================================

  const loadConversations = useCallback(async () => {
    setLoading((prev) => ({ ...prev, conversations: true }));
    try {
      const res = await fetch("/api/memory/lcm");
      if (!res.ok) {
        setConversations([]);
        return;
      }
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error("[LcmMemoryTab] Error loading conversations:", err);
      setConversations([]);
    } finally {
      setLoading((prev) => ({ ...prev, conversations: false }));
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string, offset = 0) => {
      setLoading((prev) => ({ ...prev, messages: true }));
      try {
        const res = await fetch(
          `/api/memory/lcm/conversations/${encodeURIComponent(conversationId)}?offset=${offset}&limit=${MESSAGES_PAGE_SIZE}`
        );
        if (!res.ok) {
          if (offset === 0) setMessages([]);
          return;
        }
        const data = await res.json();
        if (offset === 0) {
          setMessages(data.messages || []);
        } else {
          setMessages((prev) => [...prev, ...(data.messages || [])]);
        }
        setMessageTotal(data.total || 0);
        setHasMore(data.hasMore || false);
      } catch (err) {
        console.error("[LcmMemoryTab] Error loading messages:", err);
        if (offset === 0) setMessages([]);
      } finally {
        setLoading((prev) => ({ ...prev, messages: false }));
      }
    },
    []
  );

  const loadSummaries = useCallback(async (conversationId: string) => {
    setLoading((prev) => ({ ...prev, summaries: true }));
    try {
      const res = await fetch(
        `/api/memory/lcm/summaries?conversationId=${encodeURIComponent(conversationId)}`
      );
      if (!res.ok) {
        setSummaries([]);
        return;
      }
      const data = await res.json();
      setSummaries(data.summaries || []);
    } catch (err) {
      console.error("[LcmMemoryTab] Error loading summaries:", err);
      setSummaries([]);
    } finally {
      setLoading((prev) => ({ ...prev, summaries: false }));
    }
  }, []);

  // ========================================================================
  // Search (debounced)
  // ========================================================================

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/memory/lcm/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) {
        setSearchResults([]);
        return;
      }
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error("[LcmMemoryTab] Error searching:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [performSearch]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
  }, []);

  // ========================================================================
  // Conversation selection
  // ========================================================================

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedConversation(conversationId);
      setMessages([]);
      setMessageTotal(0);
      setHasMore(false);
      setSummaries([]);
      setExpandedSummaries(new Set());
      setExpandedMessages(new Set());
      clearSearch();
      loadMessages(conversationId, 0);
      loadSummaries(conversationId);
    },
    [loadMessages, loadSummaries, clearSearch]
  );

  const handleLoadMore = useCallback(() => {
    if (selectedConversation && hasMore) {
      loadMessages(selectedConversation, messages.length);
    }
  }, [selectedConversation, hasMore, messages.length, loadMessages]);

  // ========================================================================
  // Summary toggle
  // ========================================================================

  const toggleSummary = useCallback((summaryId: string) => {
    setExpandedSummaries((prev) => {
      const next = new Set(prev);
      if (next.has(summaryId)) {
        next.delete(summaryId);
      } else {
        next.add(summaryId);
      }
      return next;
    });
  }, []);

  const toggleMessage = useCallback((messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  // ========================================================================
  // Effects
  // ========================================================================

  useEffect(() => {
    if (lcmAvailable) {
      loadConversations();
    }
  }, [lcmAvailable, loadConversations]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // ========================================================================
  // Derived state
  // ========================================================================

  const isSearchActive = searchQuery.trim().length > 0;
  const selectedConvData = conversations.find(
    (c) => c.conversation_id === selectedConversation
  );

  // ========================================================================
  // Render helpers
  // ========================================================================

  const renderConversationItem = (conv: LcmConversation) => {
    const isSelected = selectedConversation === conv.conversation_id;
    const title = conv.title || conv.conversation_id.slice(0, 8);

    return (
      <button
        key={conv.conversation_id}
        onClick={() => handleSelectConversation(conv.conversation_id)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          padding: "10px 12px",
          background: isSelected ? "var(--accent-soft)" : "transparent",
          borderTop: "none",
          borderRight: "none",
          borderBottom: "none",
          borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = "var(--border)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <MessageSquare
          size={16}
          style={{
            flexShrink: 0,
            marginTop: "2px",
            color: isSelected ? "var(--accent)" : "var(--text-muted)",
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: isSelected ? 600 : 400,
              color: isSelected ? "var(--accent)" : "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "3px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              {t("memory.lcm.conversations.messageCount", {
                count: conv.message_count,
              })}
            </span>
            {conv.active === 1 ? (
              <span
                style={{
                  fontSize: "10px",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  color: "var(--success)",
                  fontWeight: 500,
                }}
              >
                {t("memory.lcm.conversations.active")}
              </span>
            ) : (
              <span
                style={{
                  fontSize: "10px",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(107, 114, 128, 0.15)",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                }}
              >
                {t("memory.lcm.conversations.archived")}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const renderMessage = (msg: LcmMessage) => {
    const roleStyle = ROLE_STYLES[msg.role] || ROLE_STYLES.assistant;
    const isExpanded = expandedMessages.has(msg.message_id);
    const isTruncated =
      msg.content.length > CONTENT_TRUNCATE_LENGTH;
    const displayContent =
      isTruncated && !isExpanded
        ? msg.content.slice(0, CONTENT_TRUNCATE_LENGTH) + "..."
        : msg.content;
    const roleKey = `memory.lcm.messages.role.${msg.role}` as const;

    return (
      <div
        key={msg.message_id}
        style={{
          padding: "10px 14px",
          borderLeft: `3px solid ${roleStyle.border}`,
          backgroundColor: roleStyle.bg,
          borderRadius: "0 6px 6px 0",
          marginBottom: "6px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "6px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: roleStyle.label,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t(roleKey as unknown as string)}
          </span>
          {msg.token_count > 0 && (
            <span
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                backgroundColor: "var(--border)",
                padding: "1px 5px",
                borderRadius: "3px",
              }}
            >
              {msg.token_count} tokens
            </span>
          )}
          <span
            style={{
              fontSize: "10px",
              color: "var(--text-muted)",
              marginLeft: "auto",
            }}
          >
            #{msg.seq}
          </span>
        </div>

        <div
          style={{
            fontSize: "13px",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            fontFamily: msg.role === "tool" ? "monospace" : "var(--font-body)",
            fontStyle: msg.role === "system" ? "italic" : "normal",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {displayContent}
        </div>

        {isTruncated && (
          <button
            onClick={() => toggleMessage(msg.message_id)}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: "12px",
              padding: "4px 0",
              marginTop: "4px",
            }}
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    );
  };

  const renderSearchResult = (result: LcmSearchResult, index: number) => {
    const convTitle =
      conversations.find((c) => c.conversation_id === result.conversation_id)
        ?.title || result.conversation_id.slice(0, 8);
    const labelKey =
      result.type === "message"
        ? "memory.lcm.search.messageResult"
        : "memory.lcm.search.summaryResult";
    const Icon = result.type === "message" ? MessageSquare : FileText;

    return (
      <button
        key={`${result.type}-${result.conversation_id}-${index}`}
        onClick={() => handleSelectConversation(result.conversation_id)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          padding: "10px 12px",
          background: "transparent",
          borderTop: "none",
          borderRight: "none",
          borderBottom: "none",
          borderLeft: "3px solid transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--border)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Icon
          size={14}
          style={{ flexShrink: 0, marginTop: "2px", color: "var(--text-muted)" }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginBottom: "3px",
            }}
          >
            {t(labelKey, { conversation: convTitle })}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.4,
            }}
          >
            {result.content.slice(0, 200)}
          </div>
        </div>
      </button>
    );
  };

  const renderSummary = (summary: LcmSummary) => {
    const isExpanded = expandedSummaries.has(summary.summary_id);

    return (
      <div
        key={summary.summary_id}
        style={{
          border: "1px solid var(--border)",
          borderRadius: "6px",
          marginBottom: "6px",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => toggleSummary(summary.summary_id)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            background: "var(--card-elevated, var(--card))",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {isExpanded ? (
            <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
          )}
          <span
            style={{
              fontSize: "11px",
              padding: "1px 6px",
              borderRadius: "4px",
              backgroundColor:
                summary.kind === "leaf"
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(59, 130, 246, 0.15)",
              color:
                summary.kind === "leaf" ? "var(--success)" : "var(--accent)",
              fontWeight: 500,
            }}
          >
            {summary.kind}
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            {t("memory.lcm.summaries.depth", { depth: summary.depth })}
          </span>
          {summary.descendant_count > 0 && (
            <span
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
              }}
            >
              {t("memory.lcm.summaries.descendants", {
                count: summary.descendant_count,
              })}
            </span>
          )}
          {summary.token_count > 0 && (
            <span
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                marginLeft: "auto",
              }}
            >
              {summary.token_count} tokens
            </span>
          )}
        </button>

        {isExpanded && (
          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                lineHeight: 1.6,
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {summary.content}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========================================================================
  // Main render
  // ========================================================================

  if (!lcmAvailable) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-muted)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Layers
            size={48}
            style={{ margin: "0 auto 12px", opacity: 0.3 }}
          />
          <p>{t("memory.lcm.status.unavailable")}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* ================================================================== */}
      {/* Sidebar — Conversation list + Search                               */}
      {/* ================================================================== */}
      <aside
        style={{
          width: "300px",
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--surface, var(--card))",
        }}
      >
        {/* Search */}
        <div style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "6px 10px",
            }}
          >
            <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t("memory.lcm.search.placeholder")}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "13px",
                fontFamily: "var(--font-body)",
              }}
            />
            {isSearchActive && (
              <button
                onClick={clearSearch}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: "11px",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {isSearchActive ? (
            // Search results
            <div>
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {isSearching
                  ? t("memory.lcm.status.loading")
                  : t("memory.lcm.search.resultsCount", {
                      count: searchResults.length,
                    })}
              </div>
              {searchResults.length === 0 && !isSearching ? (
                <div
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                >
                  {t("memory.lcm.search.noResults")}
                </div>
              ) : (
                searchResults.map((result, idx) =>
                  renderSearchResult(result, idx)
                )
              )}
            </div>
          ) : (
            // Conversation list
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  {t("memory.lcm.conversations.title")}
                </span>
                <button
                  onClick={loadConversations}
                  title={t("common.refresh")}
                  style={{
                    padding: "3px 5px",
                    borderRadius: "4px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                  }}
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              {loading.conversations ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px 16px",
                    color: "var(--text-muted)",
                  }}
                >
                  <Loader2
                    size={20}
                    className="animate-spin"
                    style={{ marginRight: "8px" }}
                  />
                  {t("memory.lcm.status.loading")}
                </div>
              ) : conversations.length === 0 ? (
                <div
                  style={{
                    padding: "32px 16px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                >
                  {t("memory.lcm.conversations.empty")}
                </div>
              ) : (
                conversations.map((conv) => renderConversationItem(conv))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ================================================================== */}
      {/* Detail Panel — Messages + Summaries                                */}
      {/* ================================================================== */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: "var(--bg)",
        }}
      >
        {selectedConversation && selectedConvData ? (
          <>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <MessageSquare
                size={16}
                style={{ color: "var(--accent)" }}
              />
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {selectedConvData.title || selectedConvData.conversation_id.slice(0, 8)}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                }}
              >
                {t("memory.lcm.conversations.messageCount", {
                  count: messageTotal,
                })}
              </span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {loading.messages && messages.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "48px 16px",
                    color: "var(--text-muted)",
                  }}
                >
                  <Loader2
                    size={20}
                    className="animate-spin"
                    style={{ marginRight: "8px" }}
                  />
                  {t("memory.lcm.messages.loading")}
                </div>
              ) : messages.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                >
                  {t("memory.lcm.messages.empty")}
                </div>
              ) : (
                <>
                  {messages.map((msg) => renderMessage(msg))}

                  {/* Load more */}
                  {hasMore && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: "12px 0",
                      }}
                    >
                      <button
                        onClick={handleLoadMore}
                        disabled={loading.messages}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 16px",
                          borderRadius: "6px",
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          cursor: loading.messages ? "wait" : "pointer",
                          fontSize: "12px",
                        }}
                      >
                        {loading.messages ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            {t("memory.lcm.status.loading")}
                          </>
                        ) : (
                          t("memory.lcm.messages.loadMore")
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Summaries */}
            {summaries.length > 0 && (
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  maxHeight: "300px",
                  overflowY: "auto",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--border)",
                    position: "sticky",
                    top: 0,
                    backgroundColor: "var(--bg)",
                    zIndex: 1,
                  }}
                >
                  <Layers
                    size={14}
                    style={{ color: "var(--accent)" }}
                  />
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {t("memory.lcm.summaries.title")}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      backgroundColor: "var(--border)",
                      color: "var(--text-muted)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      fontWeight: 500,
                    }}
                  >
                    {summaries.length}
                  </span>
                </div>
                <div style={{ padding: "8px 16px" }}>
                  {summaries.map((summary) => renderSummary(summary))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* No conversation selected */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <MessageSquare
                size={48}
                style={{ margin: "0 auto 12px", opacity: 0.3 }}
              />
              <p style={{ fontSize: "14px" }}>
                {t("memory.lcm.conversations.title")}
              </p>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>
                {t("memory.lcm.conversations.empty")}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
