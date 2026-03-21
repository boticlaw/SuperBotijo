"use client";

import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div 
        className="max-w-md w-full text-center p-8 rounded-2xl"
        style={{ 
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)"
        }}
      >
        <div 
          className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--warning-soft)" }}
        >
          <FileQuestion 
            className="w-8 h-8" 
            style={{ color: "var(--warning)" }}
          />
        </div>

        <h1 
          className="text-2xl font-bold mb-2"
          style={{ 
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)"
          }}
        >
          {t("errors.notFound.title")}
        </h1>

        <p 
          className="mb-8"
          style={{ color: "var(--text-muted)" }}
        >
          {t("errors.notFound.description")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-colors"
            style={{ 
              backgroundColor: "var(--accent)",
              color: "white"
            }}
          >
            <Home className="w-4 h-4" />
            {t("errors.notFound.goHome")}
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)"
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            {t("errors.notFound.goBack")}
          </button>
        </div>
      </div>
    </div>
  );
}
