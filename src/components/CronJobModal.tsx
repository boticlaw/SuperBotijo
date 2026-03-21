"use client";

import { useState, useEffect } from "react";
import { X, Calendar, ChevronDown, Zap } from "lucide-react";
import { cronToHuman, getNextRuns, isValidCron, CRON_PRESETS } from "@/lib/cron-parser";
import type { CronJob } from "./CronJobCard";

interface CronJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: Partial<CronJob>) => void;
  editingJob?: CronJob | null;
}

const TIMEZONES = [
  "UTC", "Europe/Madrid", "America/New_York", "America/Chicago",
  "America/Denver", "America/Los_Angeles", "Europe/London",
  "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Singapore", "Australia/Sydney",
];

// Visual builder modes
type FrequencyMode = "every-minutes" | "hourly" | "daily" | "weekly" | "monthly" | "custom";

const FREQUENCY_MODES: Array<{ id: FrequencyMode; label: string; emoji: string }> = [
  { id: "every-minutes", label: "Every N minutes", emoji: "⏱️" },
  { id: "hourly", label: "Hourly", emoji: "🕐" },
  { id: "daily", label: "Daily", emoji: "☀️" },
  { id: "weekly", label: "Weekly", emoji: "📅" },
  { id: "monthly", label: "Monthly", emoji: "🗓️" },
  { id: "custom", label: "Custom cron", emoji: "⚙️" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

// Template presets
const TEMPLATES = [
  { label: "Daily backup at 3 AM", cron: "0 3 * * *" },
  { label: "Weekday morning report (9 AM)", cron: "0 9 * * 1-5" },
  { label: "Hourly health check", cron: "0 * * * *" },
  { label: "Every 15 minutes", cron: "*/15 * * * *" },
  { label: "Weekly cleanup (Sunday midnight)", cron: "0 0 * * 0" },
  { label: "First of month report", cron: "0 8 1 * *" },
  { label: "Every 5 minutes", cron: "*/5 * * * *" },
  { label: "Twice daily (9 AM & 9 PM)", cron: "0 9,21 * * *" },
];

function buildCron(mode: FrequencyMode, opts: Record<string, number | number[]>): string {
  switch (mode) {
    case "every-minutes":
      return `*/${opts.minutes || 5} * * * *`;
    case "hourly":
      return `${opts.minute || 0} * * * *`;
    case "daily":
      return `${opts.minute || 0} ${opts.hour || 9} * * *`;
    case "weekly": {
      const days = Array.isArray(opts.days) && opts.days.length > 0 ? opts.days.join(",") : "1";
      return `${opts.minute || 0} ${opts.hour || 9} * * ${days}`;
    }
    case "monthly":
      return `${opts.minute || 0} ${opts.hour || 9} ${opts.day || 1} * *`;
    default:
      return "0 9 * * *";
  }
}

export function CronJobModal({ isOpen, onClose, onSave, editingJob }: CronJobModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [schedule, setSchedule] = useState("0 9 * * *");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>("daily");
  const [showPresets, setShowPresets] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Visual builder state
  const [everyMinutes, setEveryMinutes] = useState(15);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]); // Monday
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState(1);

  useEffect(() => {
    if (isOpen) {
      if (editingJob) {
        setName(editingJob.name);
        setDescription(editingJob.description);
        setMessage(editingJob.message || "");
        setSchedule(typeof editingJob.schedule === "string" ? editingJob.schedule : String(editingJob.schedule));
        setTimezone(editingJob.timezone);
        setFrequencyMode("custom");
      } else {
        setName("");
        setDescription("");
        setMessage("");
        setSchedule("0 9 * * *");
        setTimezone("Europe/Madrid");
        setFrequencyMode("daily");
      }
      setErrors({});
    }
  }, [isOpen, editingJob]);

  // Update schedule when visual builder changes
  useEffect(() => {
    if (frequencyMode === "custom") return;
    const newSchedule = buildCron(frequencyMode, {
      minutes: everyMinutes,
      minute: selectedMinute,
      hour: selectedHour,
      days: selectedDays,
      day: selectedDayOfMonth,
    });
    setSchedule(newSchedule);
  }, [frequencyMode, everyMinutes, selectedHour, selectedMinute, selectedDays, selectedDayOfMonth]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!schedule.trim()) newErrors.schedule = "Schedule is required";
    else if (!isValidCron(schedule)) newErrors.schedule = "Invalid cron expression";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    try {
      await onSave({
        id: editingJob?.id,
        name: name.trim(),
        description: description.trim(),
        message: message.trim(),
        schedule: schedule.trim(),
        timezone,
        enabled: editingJob?.enabled ?? true,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const nextRuns = isValidCron(schedule) ? getNextRuns(schedule, 5) : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl mx-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {editingJob ? "✏️ Edit Cron Job" : "➕ Create Cron Job"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Job Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: "" })); }}
              placeholder="e.g., Daily Backup"
              style={{
                width: "100%", padding: "0.75rem 1rem",
                backgroundColor: "var(--card-elevated)",
                border: `1px solid ${errors.name ? "var(--error)" : "var(--border)"}`,
                borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none",
                fontSize: "0.9rem",
              }}
            />
            {errors.name && <p className="mt-1 text-sm" style={{ color: "var(--error)" }}>{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this job"
              rows={2}
              style={{
                width: "100%", padding: "0.75rem 1rem",
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none",
                fontSize: "0.9rem", resize: "none",
              }}
            />
          </div>

          {/* Message - What the task executes */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Task Message {editingJob && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(what the task executes)</span>}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="The prompt/instruction sent to the agent when this task runs"
              rows={4}
              style={{
                width: "100%", padding: "0.75rem 1rem",
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none",
                fontSize: "0.85rem", resize: "vertical",
                fontFamily: "monospace",
              }}
            />
          </div>

          {/* Frequency Builder */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
              Frequency
            </label>

            {/* Mode selector */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
              {FREQUENCY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setFrequencyMode(mode.id)}
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: "9999px",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    border: "1px solid",
                    cursor: "pointer",
                    backgroundColor: frequencyMode === mode.id ? "rgba(255,59,48,0.15)" : "var(--card-elevated)",
                    color: frequencyMode === mode.id ? "var(--accent)" : "var(--text-secondary)",
                    borderColor: frequencyMode === mode.id ? "rgba(255,59,48,0.4)" : "var(--border)",
                    transition: "all 0.15s",
                  }}
                >
                  {mode.emoji} {mode.label}
                </button>
              ))}
            </div>

            {/* Visual controls per mode */}
            {frequencyMode === "every-minutes" && (
              <div style={{ padding: "1rem", backgroundColor: "var(--card-elevated)", borderRadius: "0.75rem" }}>
                <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>Every</label>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <input
                    type="range" min={1} max={60} value={everyMinutes}
                    onChange={(e) => setEveryMinutes(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontWeight: 700, color: "var(--accent)", minWidth: "4rem", textAlign: "center" }}>
                    {everyMinutes} min
                  </span>
                </div>
              </div>
            )}

            {frequencyMode === "hourly" && (
              <div style={{ padding: "1rem", backgroundColor: "var(--card-elevated)", borderRadius: "0.75rem" }}>
                <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>At minute</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {MINUTES.map((m) => (
                    <button key={m} type="button" onClick={() => setSelectedMinute(m)}
                      style={{
                        padding: "0.375rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.85rem",
                        backgroundColor: selectedMinute === m ? "var(--accent)" : "var(--card)",
                        color: selectedMinute === m ? "#000" : "var(--text-secondary)",
                        border: "1px solid var(--border)", cursor: "pointer",
                      }}>
                      :{String(m).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(frequencyMode === "daily" || frequencyMode === "weekly" || frequencyMode === "monthly") && (
              <div style={{ padding: "1rem", backgroundColor: "var(--card-elevated)", borderRadius: "0.75rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>At time</label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select value={selectedHour} onChange={(e) => setSelectedHour(Number(e.target.value))}
                      style={{ padding: "0.5rem 0.75rem", backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none" }}>
                      {HOURS.map((h) => (
                        <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                      ))}
                    </select>
                    <span style={{ color: "var(--text-muted)" }}>:</span>
                    <select value={selectedMinute} onChange={(e) => setSelectedMinute(Number(e.target.value))}
                      style={{ padding: "0.5rem 0.75rem", backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none" }}>
                      {MINUTES.map((m) => (
                        <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {frequencyMode === "weekly" && (
                  <div>
                    <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>On days</label>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      {WEEKDAYS.map((day, i) => (
                        <button key={day} type="button" onClick={() => toggleDay(i)}
                          style={{
                            flex: 1, padding: "0.5rem 0", borderRadius: "0.5rem", fontSize: "0.75rem",
                            fontWeight: selectedDays.includes(i) ? 700 : 400,
                            backgroundColor: selectedDays.includes(i) ? "var(--accent)" : "var(--card)",
                            color: selectedDays.includes(i) ? "#000" : "var(--text-secondary)",
                            border: "1px solid var(--border)", cursor: "pointer",
                          }}>
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {frequencyMode === "monthly" && (
                  <div>
                    <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>On day of month</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input
                        type="range" min={1} max={28} value={selectedDayOfMonth}
                        onChange={(e) => setSelectedDayOfMonth(Number(e.target.value))}
                        style={{ flex: 1, accentColor: "var(--accent)" }}
                      />
                      <span style={{ fontWeight: 700, color: "var(--accent)", minWidth: "3rem", textAlign: "center" }}>
                        Day {selectedDayOfMonth}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom cron input */}
            {frequencyMode === "custom" && (
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => { setSchedule(e.target.value); if (errors.schedule) setErrors((p) => ({ ...p, schedule: "" })); }}
                  placeholder="* * * * *"
                  style={{
                    width: "100%", padding: "0.75rem 1rem",
                    paddingRight: "6rem",
                    backgroundColor: "var(--card-elevated)",
                    border: `1px solid ${errors.schedule ? "var(--error)" : "var(--border)"}`,
                    borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none",
                    fontFamily: "monospace", fontSize: "0.9rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPresets(!showPresets)}
                  style={{
                    position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)",
                    padding: "0.375rem 0.625rem", fontSize: "0.75rem",
                    backgroundColor: "var(--card)", color: "var(--text-secondary)",
                    border: "1px solid var(--border)", borderRadius: "0.375rem", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "0.25rem",
                  }}
                >
                  Presets <ChevronDown className={`w-3 h-3 transition-transform ${showPresets ? "rotate-180" : ""}`} />
                </button>

                {showPresets && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, marginTop: "0.5rem",
                    backgroundColor: "var(--card)", border: "1px solid var(--border)",
                    borderRadius: "0.75rem", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    zIndex: 20, maxHeight: "16rem", overflowY: "auto",
                  }}>
                    {CRON_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => { setSchedule(preset.value); setShowPresets(false); }}
                        style={{
                          width: "100%", padding: "0.625rem 1rem",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: "none", borderTop: "none", borderLeft: "none", borderRight: "none",
                          cursor: "pointer", textAlign: "left",
                          borderBottom: "1px solid var(--border)",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--card-elevated)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <span style={{ color: "var(--text-primary)", fontSize: "0.875rem" }}>{preset.label}</span>
                        <code style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{preset.value}</code>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {errors.schedule && <p className="mt-1 text-sm" style={{ color: "var(--error)" }}>{errors.schedule}</p>}

            {/* Generated cron expression display */}
            <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "var(--card-elevated)", borderRadius: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <code style={{ fontFamily: "monospace", fontSize: "1rem", color: "var(--accent)", fontWeight: 700 }}>
                {schedule}
              </code>
              {isValidCron(schedule) && (
                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  → {cronToHuman(schedule)}
                </span>
              )}
            </div>
          </div>

          {/* Templates */}
          <div>
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer",
                fontSize: "0.875rem", fontWeight: 500,
              }}
            >
              <Zap className="w-4 h-4" />
              Templates
              <ChevronDown className={`w-4 h-4 transition-transform ${showTemplates ? "rotate-180" : ""}`} />
            </button>

            {showTemplates && (
              <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.cron}
                    type="button"
                    onClick={() => { setSchedule(t.cron); setFrequencyMode("custom"); setShowTemplates(false); }}
                    style={{
                      padding: "0.375rem 0.875rem",
                      borderRadius: "9999px",
                      fontSize: "0.8rem",
                      backgroundColor: "var(--card-elevated)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{
                width: "100%", padding: "0.75rem 1rem",
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none", cursor: "pointer",
              }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Preview Next Runs */}
          {nextRuns.length > 0 && (
            <div style={{ padding: "1rem", backgroundColor: "var(--card-elevated)", borderRadius: "0.75rem", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4" style={{ color: "#C084FC" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Preview: Next 5 executions
                </span>
              </div>
              <div className="space-y-2">
                {nextRuns.map((run, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span style={{
                      width: "1.5rem", height: "1.5rem", borderRadius: "9999px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      backgroundColor: "rgba(192,132,252,0.15)", color: "#C084FC",
                      fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    {run.toLocaleString("es-ES", {
                      weekday: "short", year: "numeric", month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit", hour12: false,
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "0.5rem 1.25rem", borderRadius: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: "0.625rem 1.5rem",
                backgroundColor: "var(--accent)", color: "#000",
                borderRadius: "0.5rem", border: "none", cursor: isSaving ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: "0.9rem", opacity: isSaving ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: "0.5rem",
              }}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>{editingJob ? "Update Job" : "Create Job"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
