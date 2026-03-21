"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  User,
  Bot,
  Wrench,
  FileText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  type: "user" | "assistant" | "tool_use" | "tool_result" | "system";
  role?: string;
  content: string;
  timestamp: string;
  model?: string;
  toolName?: string;
}

interface TranscriptViewerProps {
  sessionKey: string;
  onClose?: () => void;
}

type MessageFilter = "all" | "user" | "assistant" | "tool_use" | "tool_result";

export function TranscriptViewer({ sessionKey, onClose }: TranscriptViewerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<MessageFilter>("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTranscript = async () => {
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}/transcript`);
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (error) {
        console.error("Failed to fetch transcript:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTranscript();
  }, [sessionKey]);

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Type filter
      if (filterType !== "all" && msg.type !== filterType) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !msg.content.toLowerCase().includes(query) &&
          !(msg.toolName?.toLowerCase().includes(query))
        ) {
          return false;
        }
      }

      return true;
    });
  }, [messages, filterType, searchQuery]);

  const handleNext = () => {
    if (currentIndex < filteredMessages.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentIndex(0); // Reset to first result
  };

  const handleExport = () => {
    const data = JSON.stringify(filteredMessages, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${sessionKey.replace(/\//g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeConfig = {
    user: { icon: User, color: "var(--accent)", bgColor: "rgba(255, 59, 48, 0.1)" },
    assistant: { icon: Bot, color: "#60a5fa", bgColor: "rgba(96, 165, 250, 0.1)" },
    tool_use: { icon: Wrench, color: "#a78bfa", bgColor: "rgba(167, 139, 250, 0.1)" },
    tool_result: { icon: FileText, color: "#4ade80", bgColor: "rgba(74, 222, 128, 0.1)" },
    system: { icon: Bot, color: "var(--text-muted)", bgColor: "var(--surface-elevated)" },
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        Loading transcript...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        No transcript available
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          padding: "1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FileText style={{ width: "18px", height: "18px", color: "var(--accent)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Transcript</span>
          <span
            style={{
              padding: "0.125rem 0.5rem",
              backgroundColor: "var(--surface-elevated)",
              borderRadius: "9999px",
              fontSize: "0.625rem",
              color: "var(--text-muted)",
            }}
          >
            {filteredMessages.length} / {messages.length}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={handleExport}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.375rem 0.75rem",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
            }}
          >
            <Download style={{ width: "12px", height: "12px" }} />
            Export
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: "0.25rem",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X style={{ width: "16px", height: "16px" }} />
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            backgroundColor: "var(--surface-elevated)",
            borderRadius: "0.5rem",
          }}
        >
          <Search style={{ width: "14px", height: "14px", color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search in transcript..."
            value={searchQuery}
            onChange={handleSearch}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              fontSize: "0.875rem",
              color: "var(--text-primary)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                padding: "0.125rem",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X style={{ width: "12px", height: "12px", color: "var(--text-muted)" }} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            marginTop: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.375rem 0.75rem",
            backgroundColor: showFilters ? "var(--surface-elevated)" : "transparent",
            border: "1px solid var(--border)",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
          }}
        >
          <Filter style={{ width: "12px", height: "12px" }} />
          Filters
          {filterType !== "all" && (
            <span
              style={{
                padding: "0.125rem 0.375rem",
                backgroundColor: "var(--accent)",
                color: "white",
                borderRadius: "9999px",
                fontSize: "0.625rem",
              }}
            >
              1
            </span>
          )}
        </button>

        {/* Filters panel */}
        {showFilters && (
          <div
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem",
              backgroundColor: "var(--surface-elevated)",
              borderRadius: "0.5rem",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 500,
                marginBottom: "0.375rem",
                color: "var(--text-secondary)",
              }}
            >
              Message Type
            </label>
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
              {(["all", "user", "assistant", "tool_use", "tool_result"] as MessageFilter[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setFilterType(type);
                    setCurrentIndex(0);
                  }}
                  style={{
                    padding: "0.25rem 0.625rem",
                    backgroundColor: filterType === type ? "var(--accent)" : "transparent",
                    color: filterType === type ? "white" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                    fontSize: "0.6875rem",
                    textTransform: "capitalize",
                  }}
                >
                  {type.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div
        style={{
          padding: "0.75rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.375rem 0.75rem",
            backgroundColor: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "0.375rem",
            cursor: currentIndex === 0 ? "not-allowed" : "pointer",
            opacity: currentIndex === 0 ? 0.5 : 1,
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
          }}
        >
          <ChevronLeft style={{ width: "12px", height: "12px" }} />
          Prev
        </button>

        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {currentIndex + 1} of {filteredMessages.length}
        </span>

        <button
          onClick={handleNext}
          disabled={currentIndex === filteredMessages.length - 1}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.375rem 0.75rem",
            backgroundColor: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "0.375rem",
            cursor: currentIndex === filteredMessages.length - 1 ? "not-allowed" : "pointer",
            opacity: currentIndex === filteredMessages.length - 1 ? 0.5 : 1,
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
          }}
        >
          Next
          <ChevronRight style={{ width: "12px", height: "12px" }} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        style={{ flex: 1, overflowY: "auto", padding: "1rem" }}
      >
        {filteredMessages.map((msg, index) => {
          const config = typeConfig[msg.type];
          const Icon = config.icon;

          return (
            <div
              key={msg.id}
              data-message-index={index}
              onClick={() => setCurrentIndex(index)}
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                backgroundColor:
                  index === currentIndex
                    ? "var(--card-elevated)"
                    : "var(--surface-elevated)",
                borderRadius: "0.5rem",
                border:
                  index === currentIndex
                    ? "1px solid var(--accent)"
                    : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <div
                  style={{
                    padding: "0.375rem",
                    borderRadius: "0.375rem",
                    backgroundColor: config.bgColor,
                  }}
                >
                  <Icon style={{ width: "14px", height: "14px", color: config.color }} />
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    color: config.color,
                  }}
                >
                  {msg.type.replace("_", " ")}
                </span>
                {msg.toolName && (
                  <span
                    style={{
                      fontSize: "0.625rem",
                      padding: "0.125rem 0.375rem",
                      backgroundColor: "var(--surface)",
                      borderRadius: "0.25rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    {msg.toolName}
                  </span>
                )}
                {msg.model && (
                  <span
                    style={{
                      fontSize: "0.625rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    {msg.model}
                  </span>
                )}
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.625rem",
                    color: "var(--text-muted)",
                  }}
                >
                  {formatDistanceToNow(new Date(msg.timestamp))}
                </span>
              </div>

              <div
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
