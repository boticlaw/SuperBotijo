"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles, ChevronRight, ChevronDown } from "lucide-react";
import { SuggestionCard } from "./SuggestionCard";
import type { Suggestion } from "@/lib/suggestions-engine";
import { useI18n } from "@/i18n/provider";

interface SuggestionsPanelProps {
  compact?: boolean;
  maxItems?: number;
}

export function SuggestionsPanel({ compact = false, maxItems = 3 }: SuggestionsPanelProps) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/suggestions");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const regenerateSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/suggestions?regenerate=true");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("Failed to regenerate suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleApply = useCallback(
    async (id: string) => {
      setApplyingId(id);
      try {
        const res = await fetch(`/api/suggestions/${id}/apply`, { method: "POST" });
        const data = await res.json();
        
        if (data.success) {
          setSuggestions((prev) => prev.filter((s) => s.id !== id));
          
          if (data.action?.type === "link" && data.action.target) {
            window.location.href = data.action.target;
          }
        }
      } catch (error) {
        console.error("Failed to apply suggestion:", error);
      } finally {
        setApplyingId(null);
      }
    },
    []
  );

  const handleDismiss = useCallback(async (id: string) => {
    setDismissingId(id);
    try {
      const res = await fetch(`/api/suggestions/${id}/dismiss`, { method: "POST" });
      const data = await res.json();
      
      if (data.success) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (error) {
      console.error("Failed to dismiss suggestion:", error);
    } finally {
      setDismissingId(null);
    }
  }, []);

  const displayedSuggestions = suggestions.slice(0, isExpanded ? suggestions.length : maxItems);
  const hasMore = suggestions.length > maxItems;

  if (suggestions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              backgroundColor: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {t("dashboard.smartSuggestions")}
            </div>
            {!isLoading && suggestions.length > 0 && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {t("common.showing", { count: suggestions.length })}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={regenerateSuggestions}
          disabled={isLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            backgroundColor: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-muted)",
            cursor: isLoading ? "wait" : "pointer",
            fontSize: "12px",
          }}
          title="Regenerate suggestions"
        >
          <RefreshCw size={14} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
            {t("suggestions.analyzing")}
          </div>
        ) : (
          <>
            {displayedSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onApply={handleApply}
                onDismiss={handleDismiss}
                isApplying={applyingId === suggestion.id}
                isDismissing={dismissingId === suggestion.id}
              />
            ))}

            {hasMore && !isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "transparent",
                  border: "1px dashed var(--border)",
                  borderRadius: "6px",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                <ChevronRight size={14} />
                Show {suggestions.length - maxItems} more suggestions
              </button>
            )}

            {isExpanded && hasMore && (
              <button
                onClick={() => setIsExpanded(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "transparent",
                  border: "1px dashed var(--border)",
                  borderRadius: "6px",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                <ChevronDown size={14} />
                Show less
              </button>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
