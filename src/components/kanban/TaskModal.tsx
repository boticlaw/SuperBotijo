"use client";

import { useState, useEffect } from "react";
import { X, Plus, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";
import type { KanbanColumn as KanbanColumnType, KanbanTask as KanbanTaskType, KanbanLabel } from "@/lib/kanban-db";
import type { Project } from "@/lib/mission-types";

const LABEL_COLORS = [
  "#ef4444", "#f97316", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f59e0b", "#fbbf24", "#a855f7",
  "#06b6d4", "#14b8ae", "#6366f1",
  "#8b5cf6", "#d97706",
];

interface ProjectWithStats extends Project {
  taskCount: number;
  progress: number;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<KanbanTaskType>) => void;
  onDelete: (taskId: string) => void;
  columns: KanbanColumnType[];
  editingTask: KanbanTaskType | null;
}

const PRIORITIES = [
  { value: "low", label: "Low", color: "var(--text-muted)" },
  { value: "medium", label: "Medium", color: "var(--info)" },
  { value: "high", label: "High", color: "var(--warning)" },
  { value: "critical", label: "Critical", color: "var(--error)" },
];

export function TaskModal({ isOpen, onClose, onSave, onDelete, columns, editingTask }: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<KanbanTaskType["priority"]>("medium");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("backlog");
  const [labels, setLabels] = useState<KanbanLabel[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  // Initialize form when modal opens
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || "");
      setPriority(editingTask.priority);
      setAssignee(editingTask.assignee || "");
      setStatus(editingTask.status);
      setLabels(editingTask.labels || []);
      setProjectId(editingTask.projectId);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssignee("");
      setStatus("backlog");
      setLabels([]);
      setProjectId(null);
    }
    setError(null);
    setShowLabelPicker(false);
  }, [editingTask, isOpen]);

  // Fetch projects on mount
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      }
    }
    fetchProjects();
  }, []);

  if (!isOpen) return;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const taskData = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assignee: assignee.trim() || null,
        status,
        labels,
        projectId,
      };

      if (editingTask) {
        // Update existing task
        const res = await fetch(`/api/kanban/tasks/${editingTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update task");
        }

        onSave({ ...editingTask, ...taskData });
      } else {
        // Create new task
        const res = await fetch("/api/kanban/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create task");
        }

        const { task } = await res.json();
        onSave(task);
        setStatus(task.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setIsSaving(false);
    }
  };

  function handleDelete() {
    if (!editingTask) return;
    if (!confirm("Are you sure you want to delete this task?")) return;

    onDelete(editingTask.id);
    onClose();
  }

  function addLabel() {
    if (!newLabelName.trim()) return;

    const newLabel: KanbanLabel = {
      name: newLabelName.trim(),
      color: newLabelColor,
    };

    setLabels((prev) => [...prev, newLabel]);
    setNewLabelName("");
    setShowLabelPicker(false);
  }

  function removeLabel(index: number) {
    setLabels((prev) => prev.filter((_, i) => i !== index));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl mx-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {editingTask ? "Edit Task" : "New Task"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Task title..."
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-offset-0"
              style={{
                backgroundColor: "var(--card-elevated)",
                borderColor: error ? "var(--error)" : "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            {error && <p className="text-sm mt-1" style={{ color: "var(--error)" }}>{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none resize-none"
              style={{
                backgroundColor: "var(--card-elevated)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Status (Column) */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none cursor-pointer"
              style={{
                backgroundColor: "var(--card-elevated)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Priority
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value as KanbanTaskType["priority"])}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all"
                  style={{
                    backgroundColor:
                      priority === p.value
                        ? `${p.color}20`
                        : "var(--card-elevated)",
                    borderColor:
                      priority === p.value ? p.color : "var(--border)",
                    color: priority === p.value ? p.color : "var(--text-secondary)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Assignee
            </label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Enter name..."
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none"
              style={{
                backgroundColor: "var(--card-elevated)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              <FolderOpen className="inline-block h-4 w-4 mr-1" style={{ color: "var(--text-muted)" }} />
              Project
            </label>
            <select
              value={projectId || ""}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none cursor-pointer"
              style={{
                backgroundColor: "var(--card-elevated)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">No Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Labels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Labels
              </label>
              <button
                type="button"
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{
                  color: "var(--accent)",
              }}
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>

            {/* Current labels */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {labels.map((label, index) => (
                  <span
                    key={`${label.name}-${index}`}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${label.color}20`,
                      color: label.color,
                    }}
                  >
                    {label.name}
                    <button
                      type="button"
                      onClick={() => removeLabel(index)}
                      className="ml-1 hover:opacity-100"
                      style={{ color: label.color }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Label picker dropdown */}
            {showLabelPicker && (
              <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--card-elevated)", borderColor: "var(--border)" }}>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Label name..."
                    className="flex-1 rounded border px-2 py-1 text-xs outline-none"
                    style={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div className="flex gap-1">
                  {LABEL_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewLabelColor(color)}
                      className="w-6 h-6 rounded-full border-2 transition-transform"
                      style={{
                        backgroundColor: color,
                        transform: newLabelColor === color ? "scale(1.2)" : "scale(1)",
                        border: newLabelColor === color ? "2px solid white" : "2px solid transparent",
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addLabel}
                  disabled={!newLabelName.trim()}
                  className="w-full rounded border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--accent)",
                    borderColor: "var(--accent)",
                    color: "white",
                    cursor: newLabelName.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Add Label
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            {editingTask && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{
              color: "var(--error)",
              backgroundColor: "var(--error-bg)",
            }}
              >
                Delete
              </button>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{
              color: "var(--text-muted)",
              backgroundColor: "transparent",
            }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg px-4 py-2 text-sm font-bold transition-all disabled:opacity-50"
                style={{
              backgroundColor: "var(--accent)",
              color: "white",
              cursor: isSaving ? "not-allowed" : "pointer",
            }}
              >
                {isSaving ? "Saving..." : editingTask ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
