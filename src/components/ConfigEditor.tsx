"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Lock,
  Unlock,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface ConfigSection {
  editable: boolean;
  data: Record<string, unknown>;
}

interface ConfigResponse {
  sections: {
    meta: ConfigSection;
    env: ConfigSection;
    auth: ConfigSection;
    models: ConfigSection;
    wizard: ConfigSection;
  };
  raw: string;
}

interface BackupInfo {
  hasBackup: boolean;
  backup: {
    timestamp: string;
    size: number;
    file: string;
  } | null;
}

function formatTimestamp(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ConfigSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl p-4" style={{ backgroundColor: "var(--card)" }}>
          <div className="h-6 w-32 rounded mb-4" style={{ backgroundColor: "var(--card-elevated)" }} />
          <div className="space-y-2">
            <div className="h-4 w-full rounded" style={{ backgroundColor: "var(--card-elevated)" }} />
            <div className="h-4 w-3/4 rounded" style={{ backgroundColor: "var(--card-elevated)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ConfigSectionCardProps {
  name: string;
  section: ConfigSection;
  expanded: boolean;
  onToggle: () => void;
  localChanges: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
  t: (key: string) => string;
}

function ConfigSectionCard({
  name,
  section,
  expanded,
  onToggle,
  localChanges,
  onChange,
  t,
}: ConfigSectionCardProps) {
  const mergedData = { ...section.data, ...localChanges };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          )}
          <span className="font-medium capitalize" style={{ color: "var(--text-primary)" }}>
            {name}
          </span>
          {section.editable ? (
            <Unlock className="w-4 h-4 text-success" />
          ) : (
            <Lock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          )}
        </div>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {section.editable ? t("config.editable") : t("config.readOnly")}
        </span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t" style={{ borderColor: "var(--border)" }}>
          <ConfigDataViewer
            data={mergedData}
            editable={section.editable}
            path={name}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

interface ConfigDataViewerProps {
  data: unknown;
  editable: boolean;
  path: string;
  onChange: (path: string, value: unknown) => void;
  depth?: number;
}

function ConfigDataViewer({ data, editable, path, onChange, depth = 0 }: ConfigDataViewerProps) {
  if (data === null || data === undefined) {
    return (
      <span className="text-sm font-mono italic" style={{ color: "var(--text-muted)" }}>
        null
      </span>
    );
  }

  if (typeof data === "boolean") {
    if (editable) {
      return (
        <select
          value={String(data)}
          onChange={(e) => onChange(path, e.target.value === "true")}
          className="px-2 py-1 rounded text-sm font-mono"
          style={{
            backgroundColor: "var(--card-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    return (
      <span className="text-sm font-mono text-info">{String(data)}</span>
    );
  }

  if (typeof data === "number") {
    if (editable) {
      return (
        <input
          type="number"
          value={data}
          onChange={(e) => onChange(path, parseFloat(e.target.value) || 0)}
          className="px-2 py-1 rounded text-sm font-mono w-32"
          style={{
            backgroundColor: "var(--card-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
      );
    }
    return (
      <span className="text-sm font-mono text-purple-400">{data}</span>
    );
  }

  if (typeof data === "string") {
    const isMasked = data.includes("••••");
    const isLong = data.length > 50;

    if (editable && !isMasked) {
      return (
        <input
          type="text"
          value={data}
          onChange={(e) => onChange(path, e.target.value)}
          className={`px-2 py-1 rounded text-sm font-mono ${isLong ? "w-full" : "w-64"}`}
          style={{
            backgroundColor: "var(--card-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
      );
    }

    return (
      <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
        &quot;{data}&quot;
        {isMasked && <Lock className="inline w-3 h-3 ml-1" style={{ color: "var(--text-muted)" }} />}
      </span>
    );
  }

  if (Array.isArray(data)) {
    return (
      <div className="ml-4">
        <span style={{ color: "var(--text-muted)" }}>[</span>
        <div className="ml-4 space-y-1">
          {data.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-sm font-mono min-w-[30px]" style={{ color: "var(--text-muted)" }}>
                {index}:
              </span>
              <ConfigDataViewer
                data={item}
                editable={editable}
                path={`${path}[${index}]`}
                onChange={onChange}
                depth={depth + 1}
              />
            </div>
          ))}
        </div>
        <span style={{ color: "var(--text-muted)" }}>]</span>
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);

    if (entries.length === 0) {
      return (
        <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          {"{}"}
        </span>
      );
    }

    return (
      <div className={`space-y-2 ${depth > 0 ? "ml-4" : ""}`}>
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 flex-wrap">
            <span
              className="text-sm font-mono min-w-[120px] md:min-w-[180px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {key}:
            </span>
            <ConfigDataViewer
              data={value}
              editable={editable}
              path={`${path}.${key}`}
              onChange={onChange}
              depth={depth + 1}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
      {String(data)}
    </span>
  );
}

export function ConfigEditor() {
  const { t } = useI18n();
  const { showSuccess, showError } = useToast();
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["env"]);
  const [localChanges, setLocalChanges] = useState<Record<string, Record<string, unknown>>>({});
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error("Failed to fetch config:", error);
      showError("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const fetchBackupInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/config/restore");
      const data = await res.json();
      setBackupInfo(data);
    } catch (error) {
      console.error("Failed to fetch backup info:", error);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchBackupInfo();
  }, [fetchConfig, fetchBackupInfo]);

  const hasChanges = Object.keys(localChanges).some((section) =>
    Object.keys(localChanges[section] || {}).length > 0
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handleChange = (path: string, value: unknown) => {
    const parts = path.split(".");
    const section = parts[0];
    const fieldPath = parts.slice(1);

    setLocalChanges((prev) => {
      const sectionChanges = { ...(prev[section] || {}) };
      let current: Record<string, unknown> = sectionChanges;

      for (let i = 0; i < fieldPath.length - 1; i++) {
        const key = fieldPath[i];
        if (!current[key] || typeof current[key] !== "object") {
          current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
      }

      if (fieldPath.length > 0) {
        current[fieldPath[fieldPath.length - 1]] = value;
      }

      return {
        ...prev,
        [section]: sectionChanges,
      };
    });
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    try {
      const results = [];

      for (const [section, updates] of Object.entries(localChanges)) {
        if (Object.keys(updates).length === 0) continue;

        const res = await fetch("/api/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, updates }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.details?.join(", ") || "Failed to save");
        }

        results.push({ section, data });
      }

      setLocalChanges({});
      showSuccess("Configuration saved successfully");
      fetchConfig();
      fetchBackupInfo();
    } catch (error) {
      console.error("Failed to save config:", error);
      showError(error instanceof Error ? error.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleResetClick = () => {
    setShowRestoreConfirm(true);
  };

  const handleRestoreConfirm = async () => {
    setShowRestoreConfirm(false);
    setRestoring(true);
    try {
      const res = await fetch("/api/config/restore", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to restore");
      }

      setLocalChanges({});
      showSuccess("Configuration saved successfully");
      fetchConfig();
      fetchBackupInfo();
    } catch (error) {
      console.error("Failed to restore config:", error);
      showError(error instanceof Error ? error.message : "Failed to restore configuration");
    } finally {
      setRestoring(false);
    }
  };

  const handleDiscard = () => {
    setLocalChanges({});
    showSuccess("Changes discarded");
  };

  if (loading) return <ConfigSkeleton />;

  if (!config) {
    return (
      <div
        className="p-8 text-center rounded-xl"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <X className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--error)" }} />
        <p className="mb-4" style={{ color: "var(--text-primary)" }}>
          Failed to load configuration
        </p>
        <button
          onClick={fetchConfig}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="p-4 rounded-lg flex items-start gap-3"
        style={{
          backgroundColor: "rgba(234, 179, 8, 0.1)",
          border: "1px solid rgba(234, 179, 8, 0.3)",
        }}
      >
        <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-warning">{t("config.warningTitle")}</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("config.warningDescription")}
          </p>
        </div>
      </div>

      {backupInfo?.hasBackup && (
        <div
          className="p-3 rounded-lg flex items-center justify-between text-sm"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <span style={{ color: "var(--text-secondary)" }}>
            Last backup: {formatTimestamp(backupInfo.backup!.timestamp)} (
            {formatBytes(backupInfo.backup!.size)})
          </span>
        </div>
      )}

      {Object.entries(config.sections).map(([key, section]) => (
        <ConfigSectionCard
          key={key}
          name={key}
          section={section}
          expanded={expandedSections.includes(key)}
          onToggle={() => toggleSection(key)}
          localChanges={localChanges[key] || {}}
          onChange={handleChange}
          t={t}
        />
      ))}

      <div
        className="flex flex-wrap gap-3 pt-4 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-success transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t("config.saving") : t("config.saveChanges")}
        </button>

        <button
          onClick={handleResetClick}
          disabled={restoring || !backupInfo?.hasBackup}
          className="flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        >
          {restoring ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          {restoring ? t("config.saving") : t("config.restoreBackup")}
        </button>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title={t("config.restoreBackup")}
        message={t("config.restoreConfirm")}
        confirmLabel={t("config.restoreBackup")}
        cancelLabel={t("common.cancel")}
        variant="warning"
        isLoading={restoring}
        onConfirm={handleRestoreConfirm}
        onCancel={() => setShowRestoreConfirm(false)}
      />

        {hasChanges && (
          <button
            onClick={handleDiscard}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <X className="w-4 h-4" />
            Discard Changes
          </button>
        )}
      </div>
    </div>
  );
}
