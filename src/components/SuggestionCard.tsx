"use client";

import { ReactNode } from "react";
import {
  Lightbulb,
  AlertTriangle,
  Info,
  DollarSign,
  Check,
  X,
  ExternalLink,
  Settings,
} from "lucide-react";
import type { Suggestion } from "@/lib/suggestions-engine";
import { useI18n } from "@/i18n/provider";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApply?: (id: string) => void;
  onDismiss?: (id: string) => void;
  isApplying?: boolean;
  isDismissing?: boolean;
}

const TYPE_ICONS: Record<string, ReactNode> = {
  optimization: <Lightbulb size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
  cost: <DollarSign size={18} />,
};

const TYPE_COLORS: Record<string, string> = {
  optimization: "var(--accent)",
  warning: "var(--warning, #f59e0b)",
  info: "var(--info, #3b82f6)",
  cost: "var(--success, #10b981)",
};

const IMPACT_COLORS: Record<string, string> = {
  high: "var(--error)",
  medium: "var(--warning, #f59e0b)",
  low: "var(--text-muted)",
};

export function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  isApplying,
  isDismissing,
}: SuggestionCardProps) {
  const { t } = useI18n();
  
  const color = TYPE_COLORS[suggestion.type] || "var(--text-primary)";
  const icon = TYPE_ICONS[suggestion.type] || <Info size={18} />;

  // Use translation keys if available, fallback to static text
  const title = suggestion.titleKey ? t(suggestion.titleKey, suggestion.titleParams) : suggestion.title;
  const description = suggestion.descriptionKey ? t(suggestion.descriptionKey, suggestion.descriptionParams) : suggestion.description;
  const actionLabel = suggestion.action?.labelKey ? t(suggestion.action.labelKey) : suggestion.action?.label || "Apply";

  const handleApply = () => {
    if (onApply && !isApplying) {
      onApply(suggestion.id);
    }
  };

  const handleDismiss = () => {
    if (onDismiss && !isDismissing) {
      onDismiss(suggestion.id);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "8px",
        overflow: "hidden",
        transition: "all 150ms ease",
      }}
    >
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div
            style={{
              flexShrink: 0,
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: `${color}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
            }}
          >
            {icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {title}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "2px 6px",
                  backgroundColor: `${IMPACT_COLORS[suggestion.impact]}20`,
                  color: IMPACT_COLORS[suggestion.impact],
                  borderRadius: "4px",
                }}
              >
                {suggestion.impact}
              </span>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {description}
            </p>

            {suggestion.metadata && Object.keys(suggestion.metadata).length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginTop: "8px",
                }}
              >
                {Object.entries(suggestion.metadata).slice(0, 3).map(([key, value]) => (
                  <span
                    key={key}
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      backgroundColor: "var(--surface-hover)",
                      borderRadius: "4px",
                      color: "var(--text-muted)",
                    }}
                  >
                    {key}: {typeof value === "number" ? value.toFixed(2) : value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            {new Date(suggestion.createdAt).toLocaleDateString()}
          </span>

          <div style={{ display: "flex", gap: "8px" }}>
            {suggestion.action && (
              <button
                onClick={handleApply}
                disabled={isApplying}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  backgroundColor: "var(--accent)",
                  border: "none",
                  borderRadius: "6px",
                  color: "var(--bg)",
                  cursor: isApplying ? "wait" : "pointer",
                  fontSize: "12px",
                  fontWeight: 500,
                  opacity: isApplying ? 0.6 : 1,
                }}
              >
                {isApplying ? (
                  t("common.loading")
                ) : (
                  <>
                    {suggestion.action?.type === "link" ? (
                      <>
                        <ExternalLink size={12} />
                        {actionLabel}
                      </>
                    ) : suggestion.action?.type === "config" ? (
                      <>
                        <Settings size={12} />
                        {actionLabel}
                      </>
                    ) : (
                      <>
                        <Check size={12} />
                        {actionLabel}
                      </>
                    )}
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleDismiss}
              disabled={isDismissing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                backgroundColor: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                color: "var(--text-muted)",
                cursor: isDismissing ? "wait" : "pointer",
                fontSize: "12px",
              }}
            >
              {isDismissing ? (
                t("common.loading")
              ) : (
                <>
                  <X size={12} />
                  {t("common.dismiss")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
