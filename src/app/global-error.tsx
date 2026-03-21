"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

type Messages = Record<string, unknown>;
const DICTIONARY: Record<string, Messages> = { en, es };

function getByPath(obj: Messages, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (typeof acc === "object" && acc !== null && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function interpolate(text: string, values?: Record<string, string | number>) {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function detectLocale(): string {
  if (typeof window === "undefined") return "en";
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith("superbotijo-locale="))
    ?.split("=")[1];
  if (cookie === "en" || cookie === "es") return cookie;
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

function getT(locale: string) {
  const messages = DICTIONARY[locale] || DICTIONARY.en;
  return (key: string, values?: Record<string, string | number>) => {
    const raw = getByPath(messages, key) ?? getByPath(DICTIONARY.en, key) ?? key;
    return typeof raw === "string" ? interpolate(raw, values) : key;
  };
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  const locale = typeof window !== "undefined" ? detectLocale() : "en";
  const t = getT(locale);

  return (
    <html lang={locale}>
      <body style={{ 
        margin: 0, 
        padding: 0, 
        backgroundColor: "#0C0C0C",
        color: "#FFFFFF",
        fontFamily: "system-ui, sans-serif"
      }}>
        <div 
          style={{ 
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px"
          }}
        >
          <div 
            style={{
              maxWidth: "400px",
              width: "100%",
              textAlign: "center",
              padding: "32px",
              borderRadius: "16px",
              backgroundColor: "#1A1A1A",
              border: "1px solid #2A2A2A"
            }}
          >
            <div 
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 24px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255, 69, 58, 0.125)"
              }}
            >
              <AlertTriangle 
                style={{ 
                  width: "32px", 
                  height: "32px",
                  color: "#FF453A"
                }}
              />
            </div>

            <h1 
              style={{
                fontSize: "20px",
                fontWeight: 700,
                marginBottom: "8px",
                letterSpacing: "-0.02em"
              }}
            >
              {t("errors.globalError.title")}
            </h1>

            <p 
              style={{
                color: "#8A8A8A",
                marginBottom: "24px",
                fontSize: "14px"
              }}
            >
              {t("errors.globalError.description")}
            </p>

            {error.digest && (
              <p 
                style={{
                  fontSize: "12px",
                  color: "#525252",
                  marginBottom: "16px",
                  fontFamily: "monospace"
                }}
              >
                {t("errors.globalError.errorId", { id: error.digest })}
              </p>
            )}

            <button
              onClick={() => reset()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                borderRadius: "8px",
                fontWeight: 600,
                backgroundColor: "#FF3B30",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              <RefreshCw style={{ width: "16px", height: "16px" }} />
              {t("errors.globalError.reload")}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
