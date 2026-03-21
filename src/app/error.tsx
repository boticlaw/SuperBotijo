"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("[Error Boundary]", error);
  }, [error]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div 
        className="max-w-md w-full rounded-xl p-8 text-center"
        style={{ 
          backgroundColor: "var(--card)", 
          border: "1px solid var(--border)" 
        }}
      >
        <div 
          className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ backgroundColor: "var(--error-bg)" }}
        >
          <AlertTriangle 
            className="w-8 h-8" 
            style={{ color: "var(--error)" }}
          />
        </div>

        <h1 
          className="text-xl font-bold mb-2"
          style={{ 
            color: "var(--text-primary)",
            fontFamily: "var(--font-heading)"
          }}
        >
          {t("errors.error.title")}
        </h1>

        <p 
          className="text-sm mb-6"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("errors.error.description")}
        </p>

        {error.digest && (
          <p 
            className="text-xs mb-4 font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {t("errors.error.errorId", { id: error.digest })}
          </p>
        )}

        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors"
          style={{ 
            backgroundColor: "var(--accent)",
            color: "white"
          }}
        >
          <RefreshCw className="w-4 h-4" />
          {t("errors.error.retry")}
        </button>
      </div>
    </div>
  );
}
