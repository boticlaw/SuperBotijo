"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, RotateCcw, Save, X, RefreshCw, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/Toast";

interface ModelPricingEntry {
  id: string;
  name: string;
  alias?: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  contextWindow: number;
  cacheReadPricePerMillion?: number;
  cacheWritePricePerMillion?: number;
  isCustomized: boolean;
  defaults?: {
    inputPricePerMillion?: number;
    outputPricePerMillion?: number;
    cacheReadPricePerMillion?: number;
    cacheWritePricePerMillion?: number;
  };
}

interface PricingResponse {
  models: ModelPricingEntry[];
}

interface LocalChanges {
  [modelId: string]: {
    inputPricePerMillion?: number;
    outputPricePerMillion?: number;
    cacheReadPricePerMillion?: number;
    cacheWritePricePerMillion?: number;
  };
}

function PricingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl p-4" style={{ backgroundColor: "var(--card)" }}>
          <div className="h-6 w-40 rounded mb-4" style={{ backgroundColor: "var(--card-elevated)" }} />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 w-full rounded" style={{ backgroundColor: "var(--card-elevated)" }} />
            <div className="h-10 w-full rounded" style={{ backgroundColor: "var(--card-elevated)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface PriceInputProps {
  label: string;
  value: number;
  defaultValue?: number;
  onChange: (value: number) => void;
  hasOverride: boolean;
  showDefault?: boolean;
}

function PriceInput({ label, value, defaultValue, onChange, hasOverride, showDefault = true }: PriceInputProps) {
  const isDifferent = defaultValue !== undefined && value !== defaultValue;
  const formattedDefault = defaultValue !== undefined ? `$${defaultValue.toFixed(4)}` : null;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>
            $
          </span>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={value.toFixed(4)}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-full pl-5 pr-2 py-2 rounded-lg text-sm font-mono"
            style={{
              backgroundColor: "var(--card-elevated)",
              border: isDifferent ? "2px solid var(--accent)" : "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        {hasOverride && isDifferent && showDefault && (
          <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
            default: {formattedDefault}
          </span>
        )}
      </div>
    </div>
  );
}

interface ModelCardProps {
  model: ModelPricingEntry;
  localChanges: LocalChanges[string];
  onChange: (field: string, value: number) => void;
  t: (key: string) => string;
}

function ModelCard({ model, localChanges, onChange, t }: ModelCardProps) {
  const hasCache = model.cacheReadPricePerMillion !== undefined || model.cacheWritePricePerMillion !== undefined;
  const currentInput = localChanges?.inputPricePerMillion ?? model.inputPricePerMillion;
  const currentOutput = localChanges?.outputPricePerMillion ?? model.outputPricePerMillion;
  const currentCacheRead = localChanges?.cacheReadPricePerMillion ?? model.cacheReadPricePerMillion;
  const currentCacheWrite = localChanges?.cacheWritePricePerMillion ?? model.cacheWritePricePerMillion;

  const hasLocalChanges = localChanges !== undefined && Object.keys(localChanges).length > 0;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--card)",
        border: model.isCustomized ? "2px solid var(--accent)" : "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>
            {model.name}
          </h3>
          {model.alias && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-muted)" }}
            >
              {model.alias}
            </span>
          )}
          {model.isCustomized && (
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-accent text-white"
            >
              Customized
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {(model.contextWindow / 1000).toFixed(0)}k {t("pricing.context")}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PriceInput
          label={t("pricing.inputPrice")}
          value={currentInput}
          defaultValue={model.defaults?.inputPricePerMillion}
          onChange={(v) => onChange("inputPricePerMillion", v)}
          hasOverride={model.isCustomized || hasLocalChanges}
        />
        <PriceInput
          label={t("pricing.outputPrice")}
          value={currentOutput}
          defaultValue={model.defaults?.outputPricePerMillion}
          onChange={(v) => onChange("outputPricePerMillion", v)}
          hasOverride={model.isCustomized || hasLocalChanges}
        />
      </div>

      {hasCache && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          {model.cacheReadPricePerMillion !== undefined && (
            <PriceInput
              label={t("pricing.cacheReadPrice")}
              value={currentCacheRead ?? 0}
              defaultValue={model.defaults?.cacheReadPricePerMillion}
              onChange={(v) => onChange("cacheReadPricePerMillion", v)}
              hasOverride={model.isCustomized || hasLocalChanges}
            />
          )}
          {model.cacheWritePricePerMillion !== undefined && (
            <PriceInput
              label={t("pricing.cacheWritePrice")}
              value={currentCacheWrite ?? 0}
              defaultValue={model.defaults?.cacheWritePricePerMillion}
              onChange={(v) => onChange("cacheWritePricePerMillion", v)}
              hasOverride={model.isCustomized || hasLocalChanges}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, isLoading }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        className="relative rounded-xl p-6 max-w-md w-full"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: "var(--card-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm bg-error text-white"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset All"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PricingEditor() {
  const { t } = useI18n();
  const { showSuccess, showError } = useToast();
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [localChanges, setLocalChanges] = useState<LocalChanges>({});
  const [showResetDialog, setShowResetDialog] = useState(false);

  const fetchPricing = useCallback(async () => {
    try {
      const res = await fetch("/api/pricing");
      const data = await res.json();
      setPricing(data);
    } catch (error) {
      console.error("Failed to fetch pricing:", error);
      showError(t("pricing.loadError"));
    } finally {
      setLoading(false);
    }
  }, [showError, t]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const hasChanges = Object.keys(localChanges).some((modelId) => {
    const changes = localChanges[modelId];
    return changes && Object.keys(changes).length > 0;
  });

  const handleChange = (modelId: string, field: string, value: number) => {
    setLocalChanges((prev) => {
      const modelChanges = { ...(prev[modelId] || {}) };
      modelChanges[field as keyof typeof modelChanges] = value;
      return {
        ...prev,
        [modelId]: modelChanges,
      };
    });
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    try {
      const overrides = Object.entries(localChanges).map(([modelId, changes]) => ({
        id: modelId,
        ...changes,
      }));

      const res = await fetch("/api/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save pricing");
      }

      setLocalChanges({});
      showSuccess(t("pricing.saved"));
      fetchPricing();
    } catch (error) {
      console.error("Failed to save pricing:", error);
      showError(t("pricing.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/pricing", { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset pricing");
      }

      setLocalChanges({});
      showSuccess(t("pricing.resetSuccess"));
      fetchPricing();
    } catch (error) {
      console.error("Failed to reset pricing:", error);
      showError(t("pricing.resetError"));
    } finally {
      setResetting(false);
      setShowResetDialog(false);
    }
  };

  const handleDiscard = () => {
    setLocalChanges({});
    showSuccess(t("pricing.discardSuccess"));
  };

  if (loading) return <PricingSkeleton />;

  if (!pricing) {
    return (
      <div
        className="p-8 text-center rounded-xl"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <X className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--error)" }} />
        <p className="mb-4" style={{ color: "var(--text-primary)" }}>
          Failed to load pricing data
        </p>
        <button
          onClick={fetchPricing}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const customizedCount = pricing.models.filter((m) => m.isCustomized).length;

  return (
    <div className="space-y-4">
      <div
        className="p-4 rounded-lg flex items-start gap-3"
        style={{
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
        }}
      >
        <DollarSign className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-info">{t("pricing.title")}</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("pricing.description")}
          </p>
        </div>
      </div>

      {pricing.models.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          localChanges={localChanges[model.id]}
          onChange={(field, value) => handleChange(model.id, field, value)}
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t("pricing.saving") : t("pricing.saveChanges")}
        </button>

        <button
          onClick={() => setShowResetDialog(true)}
          disabled={resetting || customizedCount === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        >
          {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          {t("pricing.resetAll")}
        </button>

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

      <ConfirmDialog
        isOpen={showResetDialog}
        title="Reset All Pricing?"
        message="This will remove all custom pricing overrides and revert to default values. This action cannot be undone."
        onConfirm={handleReset}
        onCancel={() => setShowResetDialog(false)}
        isLoading={resetting}
      />
    </div>
  );
}
