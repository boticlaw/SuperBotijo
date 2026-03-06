"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { OperationsJournalEntry, CreateJournalEntryInput, UpdateJournalEntryInput } from "@/lib/mission-types";
import { X, Plus, Trash2, Save } from "lucide-react";

interface JournalEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateJournalEntryInput | UpdateJournalEntryInput) => Promise<void>;
  entry?: OperationsJournalEntry | null;
  isSaving?: boolean;
}

interface JournalFormProps {
  onClose: () => void;
  onSave: (data: CreateJournalEntryInput | UpdateJournalEntryInput) => Promise<void>;
  entry?: OperationsJournalEntry | null;
  isSaving?: boolean;
}

function getInitialState(entry?: OperationsJournalEntry | null) {
  if (entry) {
    return {
      date: entry.date,
      narrative: entry.narrative,
      highlights: entry.highlights || [],
    };
  }
  return {
    date: new Date().toISOString().split("T")[0],
    narrative: "",
    highlights: [] as string[],
  };
}

function JournalForm({ onClose, onSave, entry, isSaving }: JournalFormProps) {
  const initialState = useMemo(() => getInitialState(entry), [entry]);
  const [date, setDate] = useState(initialState.date);
  const [narrative, setNarrative] = useState(initialState.narrative);
  const [highlights, setHighlights] = useState<string[]>(initialState.highlights);
  const [newHighlight, setNewHighlight] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!date) {
      setError("Date is required");
      return;
    }

    if (!narrative) {
      setError("Narrative is required");
      return;
    }

    if (narrative.length < 10) {
      setError("Narrative must be at least 10 characters");
      return;
    }

    if (narrative.length > 5000) {
      setError("Narrative must be 5000 characters or less");
      return;
    }

    if (highlights.length > 10) {
      setError("Highlights must have at most 10 items");
      return;
    }

    try {
      const data = entry
        ? { date, narrative, highlights }
        : { date, narrative, highlights };

      await onSave(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    }
  };

  const handleAddHighlight = () => {
    if (newHighlight.trim() && highlights.length < 10) {
      setHighlights([...highlights, newHighlight.trim()]);
      setNewHighlight("");
    }
  };

  const handleRemoveHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--error)" }}
        >
          {error}
        </div>
      )}

      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--text-secondary)" }}
        >
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: "var(--card-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--text-secondary)" }}
        >
          Narrative <span style={{ color: "var(--error)" }}>*</span>
        </label>
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={6}
          placeholder="Describe your operations today..."
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{
            backgroundColor: "var(--card-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {narrative.length}/5000 characters (minimum 10)
        </p>
      </div>

      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--text-secondary)" }}
        >
          Highlights <span className="text-xs font-normal">(optional, max 10)</span>
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newHighlight}
            onChange={(e) => setNewHighlight(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddHighlight())}
            placeholder="Add a highlight..."
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: "var(--card-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            disabled={highlights.length >= 10}
          />
          <button
            type="button"
            onClick={handleAddHighlight}
            disabled={!newHighlight.trim() || highlights.length >= 10}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {highlights.map((highlight, index) => (
              <span
                key={index}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text-primary)",
                }}
              >
                {highlight}
                <button
                  type="button"
                  onClick={() => handleRemoveHighlight(index)}
                  className="hover:opacity-75"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--card-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Entry"}
        </button>
      </div>
    </form>
  );
}

export function JournalEditorModal({
  isOpen,
  onClose,
  onSave,
  entry,
  isSaving,
}: JournalEditorModalProps) {
  // Track opens to generate unique key for form reset
  const [openCount, setOpenCount] = useState(0);
  const prevIsOpenRef = useRef(isOpen);

  // Update counter when modal opens (transitions from closed to open)
  // This is intentional: we need to reset the form when modal opens
  // eslint-disable-next-line react-compiler/react-compiler
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setOpenCount((c) => c + 1);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Key changes when modal opens, forcing form to remount with fresh state
  const formKey = `${openCount}-${entry?.id || "new"}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {entry ? "Edit Entry" : "New Journal Entry"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:bg-opacity-10"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <JournalForm
          key={formKey}
          onClose={onClose}
          onSave={onSave}
          entry={entry}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
