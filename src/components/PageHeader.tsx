"use client";

import { ReactNode } from "react";
import { HelpTooltip } from "@/components/HelpTooltip";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional icon to display before title */
  icon?: ReactNode;
  /** Optional help tooltip content */
  helpTitle?: string;
  helpDescription?: string;
  /** Optional right-side actions */
  actions?: ReactNode;
}

/**
 * PageHeader - Consistent page header with optional help tooltip
 *
 * UX Guidelines applied:
 * - Clear visual hierarchy (title > subtitle)
 * - Help is discoverable but not intrusive
 * - Consistent spacing and typography across pages
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  helpTitle,
  helpDescription,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon && (
            <span style={{ color: "var(--accent)", marginTop: "4px" }}>
              {icon}
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-2xl md:text-3xl font-bold"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-primary)",
                  letterSpacing: "-1.5px",
                }}
              >
                {title}
              </h1>
              {helpTitle && helpDescription && (
                <HelpTooltip
                  title={helpTitle}
                  description={helpDescription}
                  position="right"
                />
              )}
            </div>
            {subtitle && (
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                  marginTop: "4px",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
