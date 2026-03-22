"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal, Play, Square, Trash2, Download, Circle, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";

interface LogLine {
  line: string;
  ts: string;
  id: number;
}

export interface Service {
  name: string;
  backend: "systemd" | "pm2";
  label: string;
}

function getLineColor(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes("error") || lower.includes("err]") || lower.includes("exception"))
    return "#f87171";
  if (lower.includes("warn") || lower.includes("warning")) return "#fbbf24";
  if (lower.includes("info") || lower.includes("[info]")) return "#60a5fa";
  if (lower.includes("success") || lower.includes("✓") || lower.includes("ready"))
    return "#4ade80";
  if (lower.startsWith("[stream]")) return "#a78bfa";
  return "#c9d1d9";
}

export default function LogsClient({ initialServices }: { initialServices: Service[] }) {
  const { t } = useI18n();
  const [services, setServices] = useState<Service[]>(initialServices);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(
    initialServices.length > 0 ? initialServices[0] : null
  );
  const [lines, setLines] = useState<LogLine[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch("/api/system/services");
        if (!res.ok) throw new Error("Failed to fetch services");
        const data = await res.json();
        setServices(data.services || []);
        if (data.services && data.services.length > 0 && !selectedService) {
          setSelectedService(data.services[0]);
        }
      } catch (err) {
        console.error("Failed to load services:", err);
        setError("Could not load services");
        setServices([]);
      } finally {
        setLoading(false);
      }
    }
    
    if (initialServices.length === 0) {
      setLoading(true);
      fetchServices();
    }
  }, [initialServices.length, selectedService]);

  const startStream = () => {
    if (!selectedService || esRef.current) return;

    setLines([]);
    setStreaming(true);

    const es = new EventSource(
      `/api/logs/stream?service=${encodeURIComponent(selectedService.name)}&backend=${encodeURIComponent(selectedService.backend)}`
    );

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLines((prev) => {
          const newLine = { line: data.line, ts: data.ts, id: ++idRef.current };
          const updated = [...prev, newLine];
          return updated.length > 2000 ? updated.slice(-2000) : updated;
        });
      } catch {}
    };

    es.onerror = () => {
      setStreaming(false);
      es.close();
    };

    esRef.current = es;
  };

  const stopStream = () => {
    esRef.current?.close();
    esRef.current = null;
    setStreaming(false);
  };

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const handleClear = () => setLines([]);

  const handleDownload = () => {
    const text = lines.map((l) => `[${l.ts}] ${l.line}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedService?.name || "service"}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLines = filter
    ? lines.filter((l) => l.line.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0" }}>
      <div style={{ padding: "1.5rem 1.5rem 1rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "0.25rem",
          }}
        >
          {t("logs.title")}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          {t("logs.subtitle")}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)" }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span style={{ fontSize: "0.8rem" }}>{t("logs.discoveringServices")}</span>
          </div>
        ) : error ? (
          <div style={{ color: "var(--error)", fontSize: "0.8rem" }}>{error}</div>
        ) : services.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{t("logs.noServicesFound")}</div>
        ) : (
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
            {services.map((svc) => (
              <button
                key={`${svc.name}-${svc.backend}`}
                onClick={() => {
                  setSelectedService(svc);
                  stopStream();
                  setLines([]);
                }}
                style={{
                  padding: "0.375rem 0.875rem",
                  borderRadius: "9999px",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  border: "1px solid",
                  cursor: "pointer",
                  backgroundColor:
                    selectedService?.name === svc.name
                      ? "rgba(255,59,48,0.15)"
                      : "var(--card-elevated)",
                  color:
                    selectedService?.name === svc.name
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                  borderColor:
                    selectedService?.name === svc.name
                      ? "rgba(255,59,48,0.4)"
                      : "var(--border)",
                }}
              >
                {svc.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            placeholder={t("logs.filterLogs")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "0.375rem 0.75rem",
              backgroundColor: "var(--card-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              color: "var(--text-primary)",
              fontSize: "0.8rem",
              outline: "none",
              width: "12rem",
            }}
          />

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={t("logs.auto")}
            style={{
              padding: "0.375rem 0.625rem",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              backgroundColor: autoScroll ? "rgba(74,222,128,0.1)" : "var(--card-elevated)",
              color: autoScroll ? "#4ade80" : "var(--text-muted)",
              border: "1px solid",
              borderColor: autoScroll ? "rgba(74,222,128,0.3)" : "var(--border)",
              cursor: "pointer",
            }}
          >
            {t("logs.auto")}
          </button>

          <button
            onClick={handleClear}
            title={t("logs.clear")}
            style={{
              padding: "0.375rem 0.625rem",
              borderRadius: "0.5rem",
              background: "var(--card-elevated)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDownload}
            title={t("logs.download")}
            style={{
              padding: "0.375rem 0.625rem",
              borderRadius: "0.5rem",
              background: "var(--card-elevated)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={streaming ? stopStream : startStream}
            disabled={!selectedService || loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: streaming ? "rgba(239,68,68,0.15)" : "rgba(74,222,128,0.15)",
              color: streaming ? "#f87171" : "#4ade80",
              border: "1px solid",
              borderColor: streaming ? "rgba(239,68,68,0.3)" : "rgba(74,222,128,0.3)",
              cursor: !selectedService || loading ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
              opacity: !selectedService || loading ? 0.5 : 1,
            }}
          >
            {streaming ? (
              <>
                <Square className="w-3.5 h-3.5" />
                {t("logs.stop")}
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                {t("logs.stream")}
              </>
            )}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.375rem 1.5rem",
          backgroundColor: "#0d1117",
          borderBottom: "1px solid #30363d",
          fontSize: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <Circle
            className="w-2 h-2"
            style={{
              fill: streaming ? "#4ade80" : "#6b7280",
              color: streaming ? "#4ade80" : "#6b7280",
            }}
          />
          <span style={{ color: streaming ? "#4ade80" : "#6b7280" }}>
            {streaming ? t("logs.live") : t("logs.stopped")}
          </span>
        </div>
        {selectedService && (
          <span style={{ color: "#8b949e" }}>
            {selectedService.label} · {selectedService.backend}
          </span>
        )}
        <span style={{ color: "#8b949e", marginLeft: "auto" }}>
          {filteredLines.length} {t("logs.lines")}{filter && ` (${t("logs.filtered", { count: lines.length })})`}
        </span>
      </div>

      <div
        ref={logRef}
        onScroll={() => {
          if (logRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = logRef.current;
            setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
          }
        }}
        style={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "#0d1117",
          padding: "1rem 1.5rem",
          fontFamily: "monospace",
          fontSize: "0.8rem",
          lineHeight: 1.6,
        }}
      >
        {loading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#8b949e",
            }}
          >
            <Loader2 className="w-12 h-12 mb-3 animate-spin opacity-30" />
            <p>{t("logs.discoveringServices")}</p>
          </div>
        ) : filteredLines.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#8b949e",
            }}
          >
            <Terminal className="w-12 h-12 mb-3 opacity-30" />
            <p>{streaming ? t("logs.waiting") : t("logs.clickToStream")}</p>
          </div>
        ) : (
          filteredLines.map((l) => (
            <div key={l.id} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <span
                style={{
                  color: "#484f58",
                  flexShrink: 0,
                  fontSize: "0.7rem",
                  paddingTop: "0.1rem",
                }}
              >
                {new Date(l.ts).toLocaleTimeString()}
              </span>
              <span style={{ color: getLineColor(l.line), wordBreak: "break-all" }}>{l.line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
