"use client";

import { useState, useEffect } from "react";
import { X, Plus, MessageSquare, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/provider";
import type {
  KanbanColumn as KanbanColumnType,
  KanbanTask as KanbanTaskType,
  KanbanLabel,
  TaskComment,
} from "@/lib/kanban-db";

const LABEL_COLORS = [
  "#ef4444", "#f97316", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f59e0b", "#fbbf24", "#a855f7",
  "#06b6d4", "#14b8ae", "#6366f1",
  "#8b5cf6", "#d97706",
];

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<KanbanTaskType>) => void;
  onDelete: (taskId: string) => void;
  columns: KanbanColumnType[];
  editingTask: KanbanTaskType | null;
  onCommentsUpdated?: () => void;
}

interface StructuredCommentMetadata {
  commentType?: string;
  evidence?: string;
  nextAction?: string;
}

const COMMENT_TEMPLATE_KEYS = ["progress", "blocked", "waiting", "handoff", "done", "note"] as const;

type StructuredCommentType = (typeof COMMENT_TEMPLATE_KEYS)[number];

const PRIORITIES = [
  { value: "low", label: "Low", color: "var(--text-muted)" },
  { value: "medium", label: "Medium", color: "var(--info)" },
  { value: "high", label: "High", color: "var(--warning)" },
  { value: "critical", label: "Critical", color: "var(--error)" },
];

function parseCommentMetadata(metadata: TaskComment["metadata"]): StructuredCommentMetadata {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const commentType = typeof metadata.commentType === "string" ? metadata.commentType : undefined;
  const evidence = typeof metadata.evidence === "string" ? metadata.evidence : undefined;
  const nextAction = typeof metadata.nextAction === "string" ? metadata.nextAction : undefined;

  return {
    commentType,
    evidence,
    nextAction,
  };
}

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  columns,
  editingTask,
  onCommentsUpdated,
}: TaskModalProps) {
  const { t, formatDateTime } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<KanbanTaskType["priority"]>("medium");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("backlog");
  const [labels, setLabels] = useState<KanbanLabel[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentType, setCommentType] = useState<StructuredCommentType>("note");
  const [commentContent, setCommentContent] = useState("");
  const [commentEvidence, setCommentEvidence] = useState("");
  const [commentNextAction, setCommentNextAction] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentSubmitError, setCommentSubmitError] = useState<string | null>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || "");
      setPriority(editingTask.priority);
      setAssignee(editingTask.assignee || "");
      setStatus(editingTask.status);
      setLabels(editingTask.labels || []);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssignee("");
      setStatus("backlog");
      setLabels([]);
    }
    setError(null);
    setShowLabelPicker(false);
    setCommentType("note");
    setCommentContent("");
    setCommentEvidence("");
    setCommentNextAction("");
    setActiveTemplate(null);
    setCommentSubmitError(null);
    setCommentsError(null);
  }, [editingTask, isOpen]);

  useEffect(() => {
    async function fetchComments(taskId: string) {
      try {
        setIsCommentsLoading(true);
        setCommentsError(null);

        const response = await fetch(`/api/kanban/tasks/${taskId}/comments?limit=100`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to load comments");
        }

        const data = await response.json() as { comments?: TaskComment[] };
        setComments(data.comments || []);
      } catch (err) {
        setCommentsError(err instanceof Error ? err.message : "Failed to load comments");
      } finally {
        setIsCommentsLoading(false);
      }
    }

    if (isOpen && editingTask) {
      fetchComments(editingTask.id);
      return;
    }

    setComments([]);
  }, [isOpen, editingTask]);

  function applyTemplate(template: StructuredCommentType) {
    setCommentType(template);
    setActiveTemplate(template);
    setCommentContent(t(`kanban.comments.templates.${template}.content`));
    setCommentEvidence(t(`kanban.comments.templates.${template}.evidence`));
    setCommentNextAction(t(`kanban.comments.templates.${template}.nextAction`));
    setCommentSubmitError(null);
  }

  async function refreshComments() {
    if (!editingTask) {
      return;
    }

    try {
      const response = await fetch(`/api/kanban/tasks/${editingTask.id}/comments?limit=100`);
      if (!response.ok) {
        return;
      }

      const data = await response.json() as { comments?: TaskComment[] };
      setComments(data.comments || []);
      onCommentsUpdated?.();
    } catch {
      // Ignore refresh errors after a successful write.
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();

    if (!editingTask) {
      return;
    }

    if (!commentContent.trim()) {
      setCommentSubmitError(t("kanban.comments.validation.contentRequired"));
      return;
    }

    try {
      setIsPostingComment(true);
      setCommentSubmitError(null);

      const response = await fetch(`/api/kanban/tasks/${editingTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: commentType,
          content: commentContent,
          evidence: commentEvidence,
          nextAction: commentNextAction,
          template: activeTemplate,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(t("kanban.comments.errors.rateLimited"));
        }

        if (response.status === 400) {
          throw new Error(t("kanban.comments.errors.invalidPayload"));
        }

        throw new Error(t("kanban.comments.errors.postFailed"));
      }

      setCommentContent("");
      setCommentEvidence("");
      setCommentNextAction("");
      setCommentType("note");
      setActiveTemplate(null);
      await refreshComments();
    } catch (err) {
      setCommentSubmitError(err instanceof Error ? err.message : t("kanban.comments.errors.postFailed"));
    } finally {
      setIsPostingComment(false);
    }
  }

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
  }

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

          {editingTask && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t("kanban.comments.title")}
                </h3>
              </div>

              <div
                className="max-h-60 space-y-2 overflow-y-auto rounded-lg border p-3"
                style={{ backgroundColor: "var(--card-elevated)", borderColor: "var(--border)" }}
              >
                {isCommentsLoading && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {t("kanban.comments.loading")}
                  </p>
                )}

                {commentsError && (
                  <p className="text-xs" style={{ color: "var(--error)" }}>
                    {t("kanban.comments.errors.loadFailed")}
                  </p>
                )}

                {!isCommentsLoading && !commentsError && comments.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {t("kanban.comments.empty")}
                  </p>
                )}

                {!isCommentsLoading && !commentsError && comments.map((comment) => {
                  const metadata = parseCommentMetadata(comment.metadata);
                  const structuredType = COMMENT_TEMPLATE_KEYS.includes(metadata.commentType as StructuredCommentType)
                    ? metadata.commentType as StructuredCommentType
                    : "note";
                  const authorLabel = comment.authorId
                    ? t(`kanban.comments.authorWithId.${comment.authorType}`, { id: comment.authorId })
                    : t(`kanban.comments.author.${comment.authorType}`);

                  return (
                    <article
                      key={comment.id}
                      className="rounded-md border p-2"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{authorLabel}</span>
                        <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: "var(--card-elevated)" }}>
                          {t(`kanban.comments.types.${structuredType}`)}
                        </span>
                        <time>{formatDateTime(comment.createdAt)}</time>
                      </div>

                      <p className="mt-2 text-sm" style={{ color: "var(--text-primary)" }}>
                        {comment.body}
                      </p>

                      {(metadata.evidence || metadata.nextAction) && (
                        <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                          {metadata.evidence && (
                            <p style={{ color: "var(--text-secondary)" }}>
                              <strong>{t("kanban.comments.evidenceLabel")}: </strong>
                              {metadata.evidence}
                            </p>
                          )}
                          {metadata.nextAction && (
                            <p style={{ color: "var(--text-secondary)" }}>
                              <strong>{t("kanban.comments.nextActionLabel")}: </strong>
                              {metadata.nextAction}
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <form onSubmit={handleSubmitComment} className="space-y-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {t("kanban.comments.form.type")}
                    </label>
                    <select
                      value={commentType}
                      onChange={(e) => setCommentType(e.target.value as StructuredCommentType)}
                      className="w-full rounded-lg border px-2 py-2 text-xs outline-none"
                      style={{ backgroundColor: "var(--card-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    >
                      {COMMENT_TEMPLATE_KEYS.map((type) => (
                        <option key={type} value={type}>{t(`kanban.comments.types.${type}`)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {t("kanban.comments.form.templates")}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {COMMENT_TEMPLATE_KEYS.map((template) => (
                        <button
                          key={template}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className="rounded border px-2 py-1 text-[11px]"
                          style={{
                            borderColor: activeTemplate === template ? "var(--accent)" : "var(--border)",
                            color: activeTemplate === template ? "var(--accent)" : "var(--text-muted)",
                          }}
                        >
                          {t(`kanban.comments.templates.${template}.label`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    {t("kanban.comments.form.content")}
                  </label>
                  <textarea
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border px-2 py-2 text-sm outline-none"
                    style={{ backgroundColor: "var(--card-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    placeholder={t("kanban.comments.form.contentPlaceholder")}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {t("kanban.comments.form.evidence")}
                    </label>
                    <input
                      value={commentEvidence}
                      onChange={(e) => setCommentEvidence(e.target.value)}
                      className="w-full rounded-lg border px-2 py-2 text-xs outline-none"
                      style={{ backgroundColor: "var(--card-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      placeholder={t("kanban.comments.form.evidencePlaceholder")}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {t("kanban.comments.form.nextAction")}
                    </label>
                    <input
                      value={commentNextAction}
                      onChange={(e) => setCommentNextAction(e.target.value)}
                      className="w-full rounded-lg border px-2 py-2 text-xs outline-none"
                      style={{ backgroundColor: "var(--card-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      placeholder={t("kanban.comments.form.nextActionPlaceholder")}
                    />
                  </div>
                </div>

                {commentSubmitError && (
                  <p className="text-xs" style={{ color: "var(--error)" }}>
                    {commentSubmitError}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isPostingComment}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent)", color: "white" }}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {isPostingComment ? t("kanban.comments.form.submitting") : t("kanban.comments.form.submit")}
                  </button>
                </div>
              </form>
            </div>
          )}

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
