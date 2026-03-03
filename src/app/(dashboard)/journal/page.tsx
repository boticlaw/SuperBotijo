"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { OperationsJournalEntry, CreateJournalEntryInput, UpdateJournalEntryInput } from "@/lib/mission-types";
import { JournalTimeline, JournalEditorModal, JournalFilters } from "@/components/journal";
import { Plus, AlertCircle, Target,
  LayoutGrid,
  Briefcase,
  Rocket } from "lucide-react";

interface JournalResponse {
  entries: OperationsJournalEntry[];
  total: number;
  limit: number;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<OperationsJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OperationsJournalEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("limit", "50");

      const response = await fetch(`/api/journal?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch journal entries");
      }

      const data: JournalResponse = await response.json();
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entries");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSave = async (data: CreateJournalEntryInput | UpdateJournalEntryInput) => {
    setIsSaving(true);
    setError("");

    try {
      if (editingEntry) {
        // Update existing entry
        const response = await fetch(`/api/journal/${editingEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to update entry");
        }
      } else {
        // Create new entry
        const response = await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to create entry");
        }
      }

      await fetchEntries();
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) {
      return;
    }

    try {
      const response = await fetch(`/api/journal/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete entry");
      }

      await fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
    }
  };

  const handleEdit = (entry: OperationsJournalEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
          >
            Operations Journal
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Track and document your daily operations
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="w-4 h-4" />
          New Entry
        </button>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-sm"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--error)" }}
        >
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <JournalFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onClear={() => {
          setStartDate("");
          setEndDate("");
        }}
      />

      {entries.length === 0 && !isLoading ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-lg font-medium mb-2" style={{ color: "var(--text-primary)" }}>
            No entries yet
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Start documenting your operations journey
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="w-4 h-4" />
            Create First Entry
          </button>
        </div>
      ) : (
        <JournalTimeline
          entries={entries}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      )}

      <JournalEditorModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        entry={editingEntry}
        isSaving={isSaving}
      />

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
            href="/mission"
            className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface-elevated)" }}
          >
            <Target className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Mission
            </span>
          </Link>
          <Link
            href="/kanban"
            className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface-elevated)" }}
          >
            <LayoutGrid className="h-4 w-4" style={{ color: "var(--info)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Kanban
            </span>
          </Link>
          <Link
            href="/projects"
            className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface-elevated)" }}
          >
            <Briefcase className="h-4 w-4" style={{ color: "var(--success)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Projects
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
