"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import {
  Target,
  ArrowLeft,
  Save,
  RotateCcw,
  Plus,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Zap,
  BarChart3,
  LayoutGrid,
  Briefcase,
  BookOpen,
  Rocket,
} from "lucide-react";

const MAX_STATEMENT_LENGTH = 1000;
const MAX_GOALS_COUNT = 20;
const MAX_VALUES_COUNT = 10;

// Types for scored tasks
type PriorityLevel = "high" | "medium" | "low";

interface ScoredTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee: string | null;
  labels: { name: string; color: string }[];
  order: number;
  projectId: string | null;
  created_at: string;
  updated_at: string;
  score: number;
  priorityLevel: PriorityLevel;
  matchedKeywords: string[];
}

interface PromptResponse {
  prompt: string;
  mission: {
    statement: string;
    goals: string[];
    values: string[];
  } | null;
  tasks: ScoredTask[];
  summary: {
    totalTasks: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };
}

export default function MissionPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [statement, setStatement] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [newValue, setNewValue] = useState("");

  // Prompt state
  const [promptQuery, setPromptQuery] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptResults, setPromptResults] = useState<ScoredTask[] | null>(null);
  const [promptSummary, setPromptSummary] = useState<PromptResponse["summary"] | null>(null);

  // Fetch mission on mount
  useEffect(() => {
    const fetchMission = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/mission");
        if (!res.ok) {
          throw new Error("Failed to fetch mission");
        }

        const data = await res.json();
        if (data.mission) {
          setStatement(data.mission.statement || "");
          setGoals(data.mission.goals || []);
          setValues(data.mission.values || []);
        }
      } catch (err) {
        console.error("Failed to fetch mission:", err);
        setError(err instanceof Error ? err.message : "Failed to load mission");
      } finally {
        setLoading(false);
      }
    };

    fetchMission();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const res = await fetch("/api/mission", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement,
          goals: goals.filter((g) => g.trim()),
          values: values.filter((v) => v.trim()),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save mission");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save mission:", err);
      setError(err instanceof Error ? err.message : "Failed to save mission");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(t("mission.confirmReset"))) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const res = await fetch("/api/mission", {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset mission");
      }

      const data = await res.json();
      if (data.mission) {
        setStatement(data.mission.statement || "");
        setGoals(data.mission.goals || []);
        setValues(data.mission.values || []);
      }
    } catch (err) {
      console.error("Failed to reset mission:", err);
      setError(err instanceof Error ? err.message : "Failed to reset mission");
    } finally {
      setSaving(false);
    }
  };

  const handlePromptSubmit = async () => {
    try {
      setPromptLoading(true);
      setError(null);

      const res = await fetch("/api/mission/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptQuery }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get task recommendations");
      }

      const data: PromptResponse = await res.json();
      setPromptResults(data.tasks);
      setPromptSummary(data.summary);
    } catch (err) {
      console.error("Failed to get task recommendations:", err);
      setError(err instanceof Error ? err.message : "Failed to get task recommendations");
    } finally {
      setPromptLoading(false);
    }
  };

  const addGoal = () => {
    if (newGoal.trim() && goals.length < MAX_GOALS_COUNT) {
      setGoals([...goals, newGoal.trim()]);
      setNewGoal("");
    }
  };

  const removeGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const addValue = () => {
    if (newValue.trim() && values.length < MAX_VALUES_COUNT) {
      setValues([...values, newValue.trim()]);
      setNewValue("");
    }
  };

  const removeValue = (index: number) => {
    setValues(values.filter((_, i) => i !== index));
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--accent)" }} />
          <span style={{ color: "var(--text-secondary)" }}>{t("mission.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/"
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            <Target className="inline-block w-6 h-6 mr-2 mb-0.5" style={{ color: "var(--accent)" }} />
            {t("mission.title")}
          </h1>
        </div>
        <p className="text-sm ml-12" style={{ color: "var(--text-muted)" }}>
          {t("mission.subtitle")}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          className="mb-4 flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--error)" }}
        >
          <AlertCircle className="h-5 w-5" style={{ color: "var(--error)" }} />
          <span style={{ color: "var(--error)" }}>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Success Alert */}
      {saveSuccess && (
        <div
          className="mb-4 flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--success)" }}
        >
          <CheckCircle2 className="h-5 w-5" style={{ color: "var(--success)" }} />
          <span style={{ color: "var(--success)" }}>{t("mission.savedSuccess")}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Panel */}
        <div
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Statement Section */}
          <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {t("mission.statement")}
            </label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              maxLength={MAX_STATEMENT_LENGTH}
              placeholder={t("mission.statementPlaceholder")}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none resize-none"
              style={{
                backgroundColor: "var(--card-elevated)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
                minHeight: "120px",
              }}
            />
            <div className="flex justify-end mt-1">
              <span
                className="text-xs"
                style={{
                  color: statement.length > MAX_STATEMENT_LENGTH * 0.9
                    ? "var(--error)"
                    : "var(--text-muted)",
                }}
              >
                {statement.length}/{MAX_STATEMENT_LENGTH}
              </span>
            </div>
          </div>

          {/* Goals Section */}
          <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <label
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {t("mission.goals")} ({goals.length}/{MAX_GOALS_COUNT})
              </label>
            </div>

            {/* Goals List */}
            <div className="space-y-2 mb-3">
              {goals.map((goal, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 rounded-lg group"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                  <span
                    className="flex-1 text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {goal}
                  </span>
                  <button
                    onClick={() => removeGoal(index)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                    style={{ color: "var(--error)" }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Goal Input */}
            {goals.length < MAX_GOALS_COUNT && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGoal()}
                  placeholder={t("mission.goalsPlaceholder")}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  onClick={addGoal}
                  disabled={!newGoal.trim()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "white",
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {t("mission.addGoal")}
                </button>
              </div>
            )}
          </div>

          {/* Values Section */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <label
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {t("mission.values")} ({values.length}/{MAX_VALUES_COUNT})
              </label>
            </div>

            {/* Values Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {values.map((value, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium group"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {value}
                  <button
                    onClick={() => removeValue(index)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--error)" }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add Value Input */}
            {values.length < MAX_VALUES_COUNT && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addValue()}
                  placeholder={t("mission.valuesPlaceholder")}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  onClick={addValue}
                  disabled={!newValue.trim()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {t("mission.addValue")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions Card */}
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              {t("mission.actions")}
            </h3>

            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                style={{
                  backgroundColor: "var(--success)",
                  color: "white",
                }}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("mission.saving")}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {t("mission.saveMission")}
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <RotateCcw className="h-4 w-4" />
                {t("mission.resetDefault")}
              </button>

              <button
                onClick={() => router.push("/")}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                {t("mission.backToDashboard")}
              </button>
            </div>
          </div>

          {/* Tips Card */}
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              💡 {t("mission.tips.statement").split(" ")[0]}
            </h3>
            <ul className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <li>• {t("mission.tips.statement")}</li>
              <li>• {t("mission.tips.goals")}</li>
              <li>• {t("mission.tips.values")}</li>
              <li>• {t("mission.tips.review")}</li>
            </ul>
          </div>

          {/* Ask Mission Control Card */}
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "var(--accent)" }} />
              {t("mission.askMissionControl")}
            </h3>

            <div className="space-y-3">
              <input
                type="text"
                value={promptQuery}
                onChange={(e) => setPromptQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePromptSubmit()}
                placeholder={t("mission.promptPlaceholder")}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />

              <button
                onClick={handlePromptSubmit}
                disabled={promptLoading}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "white",
                }}
              >
                {promptLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("mission.analyzing")}
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    {t("mission.getRecommendations")}
                  </>
                )}
              </button>

              {/* Results */}
              {promptResults && promptResults.length > 0 && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                  {/* Summary */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      {t("mission.topRecommendations")}
                    </span>
                    <div className="flex gap-1">
                      {promptSummary && (
                        <>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: "var(--error)", color: "white" }}
                          >
                            {promptSummary.highPriority} {t("mission.high")}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: "var(--info)", color: "white" }}
                          >
                            {promptSummary.mediumPriority} {t("mission.medium")}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: "var(--text-muted)", color: "white" }}
                          >
                            {promptSummary.lowPriority} {t("mission.low")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Task List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {promptResults.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-lg"
                        style={{
                          backgroundColor: "var(--card-elevated)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span
                            className="text-sm font-medium flex-1"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {task.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              task.priorityLevel === "high"
                                ? "bg-red-500 text-white"
                                : task.priorityLevel === "medium"
                                ? "bg-blue-500 text-white"
                                : "bg-gray-500 text-white"
                            }`}
                          >
                            {task.score}
                          </span>
                        </div>
                        {task.matchedKeywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {task.matchedKeywords.slice(0, 3).map((kw, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-xs"
                                style={{
                                  backgroundColor: "var(--accent)",
                                  color: "white",
                                  opacity: 0.8,
                                }}
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {promptResults && promptResults.length === 0 && (
                <div
                  className="mt-4 pt-4 border-t text-center"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  <p className="text-sm">{t("mission.noTasksMatch")}</p>
                  <p className="text-xs mt-1">{t("mission.addGoalsValues")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links to Mission Control */}
      <div
        className="mt-6 rounded-xl p-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <h3
          className="mb-3 text-sm font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          Mission Control
        </h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Link
            href="/kanban"
            className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface-elevated)" }}
          >
            <LayoutGrid className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Kanban
            </span>
          </Link>
          <Link
            href="/projects"
            className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface-elevated)" }}
          >
            <Briefcase className="h-4 w-4" style={{ color: "var(--info)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Projects
            </span>
          </Link>
          <Link
            href="/journal"
            className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface-elevated)" }}
          >
            <BookOpen className="h-4 w-4" style={{ color: "var(--success)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Journal
            </span>
          </Link>
          <Link
            href="/autonomy"
            className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface-elevated)" }}
          >
            <Rocket className="h-4 w-4" style={{ color: "var(--warning)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Autonomy
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
