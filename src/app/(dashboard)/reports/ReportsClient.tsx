"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FileBarChart, FileText, RefreshCw, Clock, HardDrive, Download, Share2, Plus, Loader2 } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/i18n/provider";
import type { ReportItem } from "@/operations/reports-ops";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsClient({ initialReports }: { initialReports: ReportItem[] }) {
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sharingPath, setSharingPath] = useState<string | null>(null);
  const reportsControllerRef = useRef<AbortController | null>(null);
  const contentControllerRef = useRef<AbortController | null>(null);
  const { t } = useI18n();
  const { showSuccess, showError } = useToast();

  const loadReports = useCallback(async () => {
    reportsControllerRef.current?.abort();
    const controller = new AbortController();
    reportsControllerRef.current = controller;
    try {
      setIsLoading(true);
      const res = await fetch("/api/reports", { signal: controller.signal });
      if (!res.ok) throw new Error(t("reports.page.errors.loadReports"));
      const data = await res.json();
      setReports(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error(err);
      showError(t("reports.page.errors.loadReports"));
    } finally {
      setIsLoading(false);
      if (reportsControllerRef.current === controller) {
        reportsControllerRef.current = null;
      }
    }
  }, [showError, t]);

  const loadContent = useCallback(async (path: string) => {
    contentControllerRef.current?.abort();
    const controller = new AbortController();
    contentControllerRef.current = controller;
    try {
      setIsLoadingContent(true);
      const res = await fetch(`/api/reports?path=${encodeURIComponent(path)}`, { signal: controller.signal });
      if (!res.ok) throw new Error(t("reports.page.errors.loadReport"));
      const data = await res.json();
      setContent(data.content);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error(err);
      setContent(`# ${t("reports.page.preview.errorTitle")}\n\n${t("reports.page.errors.loadReportContent")}`);
    } finally {
      setIsLoadingContent(false);
      if (contentControllerRef.current === controller) {
        contentControllerRef.current = null;
      }
    }
  }, [t]);

  const handleSelect = useCallback(
    (report: ReportItem) => {
      setSelectedPath(report.path);
      loadContent(report.path);
    },
    [loadContent]
  );

  const handleGenerate = useCallback(
    async (type: "weekly" | "monthly") => {
      setIsGenerating(true);
      try {
        const now = new Date();
        const name = `${type}-report-${now.toISOString().split("T")[0]}`;
        const res = await fetch("/api/reports/generated", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type, period: type }),
        });
        if (res.ok) {
          showSuccess(t("reports.page.toast.generated", { type: t(`reports.page.period.${type}`) }));
          loadReports();
        } else {
          showError(t("reports.page.errors.generate"));
        }
      } catch (err) {
        console.error(err);
        showError(t("reports.page.errors.generate"));
      } finally {
        setIsGenerating(false);
      }
    },
    [loadReports, showError, showSuccess, t]
  );

  const handleExport = useCallback((reportPath: string) => {
    const id = reportPath.split("/").pop()?.replace(".md", "") || reportPath;
    window.open(`/api/reports/${id}/pdf`, "_blank");
  }, []);

  const handleShare = useCallback(
    async (reportPath: string) => {
      const id = reportPath.split("/").pop()?.replace(".md", "") || reportPath;
      setSharingPath(reportPath);
      try {
        const res = await fetch(`/api/reports/${id}/share`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          await navigator.clipboard.writeText(data.shareUrl);
          showSuccess(t("reports.page.toast.linkCopied"));
        } else {
          showError(t("reports.page.errors.share"));
        }
      } catch (err) {
        console.error(err);
        showError(t("reports.page.errors.share"));
      } finally {
        setSharingPath(null);
      }
    },
    [showError, showSuccess, t]
  );

  useEffect(() => {
    return () => {
      reportsControllerRef.current?.abort();
      contentControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (reports.length > 0 && !selectedPath) {
      handleSelect(reports[0]);
    }
  }, [reports, selectedPath, handleSelect]);

  return (
    <div className="h-screen flex flex-col">
      <div
        className="flex items-center justify-between p-3 md:p-4"
        style={{
          backgroundColor: "var(--card)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <FileBarChart className="w-5 h-5 md:w-6 md:h-6" style={{ color: "var(--accent)" }} />
          <div>
            <h1
              className="text-lg md:text-xl font-bold"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {t("reports.page.title")}
            </h1>
            <p className="text-xs md:text-sm hidden sm:block" style={{ color: "var(--text-secondary)" }}>
              {t("reports.page.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => handleGenerate("weekly")}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: "var(--accent)",
                color: "white",
                opacity: isGenerating ? 0.5 : 1,
              }}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {t("reports.page.period.weekly")}
            </button>
            <button
              onClick={() => handleGenerate("monthly")}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {t("reports.page.period.monthly")}
            </button>
          </div>
          <button
            onClick={loadReports}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
            title={t("reports.page.actions.refresh")}
            aria-label={t("reports.page.actions.refresh")}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div
          className="w-full md:w-80 lg:w-96 overflow-y-auto flex-shrink-0"
          style={{
            backgroundColor: "var(--card)",
            borderRight: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              {isLoading ? t("common.loading") : t("reports.page.count", { count: reports.length })}
            </h2>
          </div>

          {!isLoading && reports.length === 0 && (
            <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>
              <FileBarChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t("reports.page.empty.title")}</p>
              <p className="text-xs mt-1">{t("reports.page.empty.hint")}</p>
            </div>
          )}

          <div className="p-2 space-y-2">
            {reports.map((report) => (
              <div key={report.path} className="relative">
                <button
                  onClick={() => handleSelect(report)}
                  className="w-full text-left rounded-lg p-3 transition-all"
                  style={{
                    backgroundColor:
                      selectedPath === report.path ? "var(--accent)" : "var(--card-elevated, var(--background))",
                    border: `1px solid ${selectedPath === report.path ? "var(--accent)" : "var(--border)"}`,
                    cursor: "pointer",
                    paddingRight: "70px",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedPath !== report.path) {
                      e.currentTarget.style.borderColor = "var(--accent)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedPath !== report.path) {
                      e.currentTarget.style.borderColor = "var(--border)";
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <FileText
                      className="w-5 h-5 mt-0.5 flex-shrink-0"
                      style={{
                        color: selectedPath === report.path ? "var(--text-primary)" : "var(--accent)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-medium text-sm truncate"
                        style={{
                          color: "var(--text-primary)",
                        }}
                      >
                        {report.title}
                      </p>
                      <div
                        className="flex items-center gap-3 mt-1 text-xs"
                        style={{
                          color: selectedPath === report.path ? "var(--text-primary)" : "var(--text-muted)",
                          opacity: selectedPath === report.path ? 0.8 : 1,
                        }}
                      >
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(report.modified)}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatSize(report.size)}
                        </span>
                      </div>
                      <span
                        className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor:
                            selectedPath === report.path ? "rgba(255,255,255,0.15)" : "var(--background)",
                          color:
                            selectedPath === report.path ? "var(--text-primary)" : "var(--text-secondary)",
                        }}
                      >
                        {report.type}
                      </span>
                    </div>
                  </div>
                </button>
                <div className="absolute top-3 right-2 flex items-center gap-1" style={{ opacity: 0.7 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(report.path);
                    }}
                    className="p-1.5 rounded transition-all hover:opacity-100"
                    style={{
                      color: selectedPath === report.path ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                    title={t("reports.page.actions.export")}
                    aria-label={t("reports.page.actions.export")}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(report.path);
                    }}
                    disabled={sharingPath === report.path}
                    className="p-1.5 rounded transition-all hover:opacity-100"
                    style={{
                      color: selectedPath === report.path ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                    title={t("reports.page.actions.share")}
                    aria-label={t("reports.page.actions.share")}
                  >
                    {sharingPath === report.path ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 min-h-0" style={{ backgroundColor: "var(--background)" }}>
          {selectedPath ? (
            isLoadingContent ? (
              <div
                className="flex items-center justify-center h-full"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("reports.page.preview.loading")}
              </div>
            ) : (
              <MarkdownPreview content={content} />
            )
          ) : (
            <div
              className="flex items-center justify-center h-full"
              style={{ color: "var(--text-muted)" }}
            >
              <div className="text-center">
                <FileBarChart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">{t("reports.page.preview.select")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
