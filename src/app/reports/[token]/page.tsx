"use client";

import { useEffect, useState } from "react";
import { FileBarChart, AlertCircle, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";

interface ReportStats {
  totalActivities: number;
  successRate: number;
  totalTokens: number;
  totalCost: number;
  topModels: Array<{ name: string; count: number; cost: number }>;
  topAgents: Array<{ name: string; count: number }>;
}

interface ReportData {
  period: { start: string; end: string };
  stats: ReportStats;
  highlights: string[];
  generatedAt: string;
}

interface Report {
  id: string;
  name: string;
  type: string;
  period: { start: string; end: string };
  data: ReportData;
  shareExpiresAt?: string;
}

export default function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { t, locale } = useI18n();
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      const { token } = await params;
      try {
        const res = await fetch(`/api/reports/shared?token=${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError(t("reports.shared.notFound"));
          } else {
            setError(t("reports.shared.loadError"));
          }
          return;
        }
        const data = await res.json();
        setReport(data.report);
      } catch {
        setError(t("reports.shared.loadError"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [params, t]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#FF3B30" }} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#ef4444" }}>
        <div style={{ textAlign: "center" }}>
          <AlertCircle size={48} style={{ marginBottom: "16px" }} />
          <p style={{ fontSize: "18px" }}>{error || t("reports.shared.fallback")}</p>
        </div>
      </div>
    );
  }

  const { stats, highlights } = report.data;

  const formatDateTime = (value: Date | number | string) => {
    return new Intl.DateTimeFormat(locale, { 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit",
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(value));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "40px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ borderBottom: "2px solid #FF3B30", paddingBottom: "20px", marginBottom: "30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <FileBarChart size={32} style={{ color: "#FF3B30" }} />
            <h1 style={{ fontSize: "28px", fontWeight: 700 }}>{report.name}</h1>
          </div>
          <p style={{ color: "#888", fontSize: "14px" }}>
            {report.period.start} — {report.period.end}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "30px" }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "#FF3B30" }}>{stats.totalActivities}</div>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>{t("reports.shared.totalActivities")}</div>
          </div>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "#10b981" }}>{stats.successRate}%</div>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>{t("reports.shared.successRate")}</div>
          </div>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "#3b82f6" }}>{(stats.totalTokens / 1000000).toFixed(2)}M</div>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>{t("reports.shared.tokensUsed")}</div>
          </div>
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "#f59e0b" }}>${stats.totalCost.toFixed(2)}</div>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>{t("reports.shared.totalCost")}</div>
          </div>
        </div>

        <div style={{ marginBottom: "30px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>{t("reports.shared.highlights")}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {highlights.map((h, i) => (
              <div
                key={i}
                style={{
                  background: "#1a1a1a",
                  borderLeft: "3px solid #10b981",
                  padding: "12px 16px",
                  borderRadius: "0 8px 8px 0",
                }}
              >
                {h}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "30px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>{t("reports.shared.topModels")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
            {stats.topModels.map((m, i) => (
              <div
                key={i}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ color: "#888", fontSize: "12px" }}>{m.count} {t("reports.shared.requests")}</div>
                </div>
                <div style={{ color: "#f59e0b", fontWeight: 600 }}>${m.cost.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px solid #2a2a2a", textAlign: "center", color: "#666", fontSize: "12px" }}>
          {t("reports.shared.generatedBy", { date: formatDateTime(report.data.generatedAt) })}
          {report.shareExpiresAt && (
            <span style={{ marginLeft: "16px" }}>
              {t("reports.shared.linkExpires", { date: formatDateTime(report.shareExpiresAt) })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
