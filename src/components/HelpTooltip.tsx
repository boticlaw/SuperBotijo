"use client";

import { useState, useRef, ReactNode } from "react";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  /** Title shown in the tooltip */
  title: string;
  /** Description/explanation text */
  description: string;
  /** Optional: position preference */
  position?: "top" | "bottom" | "left" | "right";
  /** Optional: show help icon badge (for section headers) */
  showIcon?: boolean;
  /** Optional: custom trigger element (replaces default icon) */
  trigger?: ReactNode;
  /** Optional: additional className for the trigger */
  className?: string;
}

/**
 * HelpTooltip - Contextual help component
 *
 * UX Guidelines applied:
 * - Touch target: 44x44px minimum for icon trigger
 * - Focus states: visible for keyboard navigation
 * - Hover feedback: smooth transitions (150-200ms)
 * - Accessibility: aria-labels, keyboard accessible
 */
export function HelpTooltip({
  title,
  description,
  position = "top",
  showIcon = true,
  trigger,
  className = "",
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const getPositionStyles = () => {
    switch (position) {
      case "top":
        return {
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: "8px",
        };
      case "bottom":
        return {
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginTop: "8px",
        };
      case "left":
        return {
          right: "100%",
          top: "50%",
          transform: "translateY(-50%)",
          marginRight: "8px",
        };
      case "right":
        return {
          left: "100%",
          top: "50%",
          transform: "translateY(-50%)",
          marginLeft: "8px",
        };
    }
  };

  const getArrowStyles = () => {
    const arrowSize = "6px";
    const baseStyles = {
      position: "absolute" as const,
      width: 0,
      height: 0,
      borderStyle: "solid" as const,
    };

    switch (position) {
      case "top":
        return {
          ...baseStyles,
          bottom: `-${arrowSize}`,
          left: "50%",
          transform: "translateX(-50%)",
          borderWidth: `${arrowSize} ${arrowSize} 0 ${arrowSize}`,
          borderColor: "var(--surface-elevated) transparent transparent transparent",
        };
      case "bottom":
        return {
          ...baseStyles,
          top: `-${arrowSize}`,
          left: "50%",
          transform: "translateX(-50%)",
          borderWidth: `0 ${arrowSize} ${arrowSize} ${arrowSize}`,
          borderColor: "transparent transparent var(--surface-elevated) transparent",
        };
      case "left":
        return {
          ...baseStyles,
          right: `-${arrowSize}`,
          top: "50%",
          transform: "translateY(-50%)",
          borderWidth: `${arrowSize} 0 ${arrowSize} ${arrowSize}`,
          borderColor: "transparent transparent transparent var(--surface-elevated)",
        };
      case "right":
        return {
          ...baseStyles,
          left: `-${arrowSize}`,
          top: "50%",
          transform: "translateY(-50%)",
          borderWidth: `${arrowSize} ${arrowSize} ${arrowSize} 0`,
          borderColor: "transparent var(--surface-elevated) transparent transparent",
        };
    }
  };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      style={{ cursor: "help" }}
    >
      {trigger || (showIcon && (
        <button
          type="button"
          aria-label={`Help: ${title}`}
          className="help-trigger"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            minWidth: "44px",
            minHeight: "44px",
            padding: "12px",
            background: "transparent",
            border: "none",
            cursor: "help",
            color: "var(--text-muted)",
            transition: "color 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <HelpCircle
            style={{
              width: "16px",
              height: "16px",
            }}
          />
        </button>
      ))}

      {isVisible && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 100,
            ...getPositionStyles(),
            backgroundColor: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px 16px",
            maxWidth: "280px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            opacity: isVisible ? 1 : 0,
            transition: "opacity 150ms ease",
          }}
        >
          {/* Arrow */}
          <div style={getArrowStyles()} />

          {/* Title */}
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "6px",
            }}
          >
            {title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: "12px",
              lineHeight: "1.5",
              color: "var(--text-secondary)",
            }}
          >
            {description}
          </div>
        </div>
      )}
    </div>
  );
}
