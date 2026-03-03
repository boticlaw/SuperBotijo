"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import type { KanbanTask } from "@/lib/kanban-db";
import type { Project } from "@/lib/mission-types";

interface ProjectWithStats extends Project {
  taskCount: number;
  progress: number;
}

interface OrphanTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReassigned: () => void;
}

export function OrphanTasksModal({
  isOpen,
  onClose,
  onReassigned,
}: OrphanTasksModalProps) {
  const [orphanTasks, setOrphanTasks] = useState<KanbanTask[]>([]);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch orphan tasks and projects on open
  useEffect(() => {
    if (!isOpen) return;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch tasks without project
        const tasksRes = await fetch("/api/kanban/tasks?projectId=null");
        if (!tasksRes.ok) throw new Error("Failed to fetch orphan tasks");
        const tasksData = await tasksRes.json();
        setOrphanTasks(tasksData.tasks || []);

        // Fetch projects for dropdown
        const projectsRes = await fetch("/api/projects");
        if (!projectsRes.ok) throw new Error("Failed to fetch projects");
        const projectsData = await projectsRes.json();
        setProjects(projectsData.projects || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    setSelectedTasks(new Set());
    setTargetProjectId("");
  }, [isOpen]);

  function toggleTask(taskId: string) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedTasks.size === orphanTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(orphanTasks.map((t) => t.id)));
    }
  }

  async function handleReassign() {
    if (selectedTasks.size === 0 || !targetProjectId) return;

    setReassigning(true);
    setError(null);

    try {
      // Update each selected task
      const updatePromises = Array.from(selectedTasks).map((taskId) =>
        fetch(`/api/kanban/tasks/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: targetProjectId }),
        })
      );

      const results = await Promise.all(updatePromises);
      const failed = results.filter((r) => !r.ok);

      if (failed.length > 0) {
        throw new Error(`Failed to reassign ${failed.length} tasks`);
      }

      onReassigned();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reassign tasks");
    } finally {
      setReassigning(false);
    }
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
        className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" style={{ color: "var(--warning)" }} />
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Unassigned Tasks
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
              <span className="ml-2" style={{ color: "var(--text-secondary)" }}>
                Loading tasks...
              </span>
            </div>
          ) : orphanTasks.length === 0 ? (
            <div className="text-center py-8">
              <p style={{ color: "var(--text-secondary)" }}>
                All tasks are assigned to projects. Great job!
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
                {orphanTasks.length} task{orphanTasks.length !== 1 ? "s" : ""} without a project.
                Select tasks and assign them to a project.
              </p>

              {/* Task List */}
              <div
                className="mb-4 rounded-lg border overflow-hidden"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Select All Header */}
                <div
                  className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-white/5"
                  style={{ backgroundColor: "var(--card-elevated)" }}
                  onClick={toggleAll}
                >
                  <input
                    type="checkbox"
                    checked={selectedTasks.size === orphanTasks.length && orphanTasks.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Select All ({selectedTasks.size}/{orphanTasks.length})
                  </span>
                </div>

                {/* Tasks */}
                <div className="max-h-48 overflow-y-auto">
                  {orphanTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-white/5"
                      style={{ borderTop: "1px solid var(--border)" }}
                      onClick={() => toggleTask(task.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTasks.has(task.id)}
                        onChange={() => toggleTask(task.id)}
                        className="rounded"
                      />
                      <span
                        className="text-sm truncate flex-1"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {task.title}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-muted)" }}
                      >
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Project Selector */}
              <div className="mb-4">
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Assign to Project
                </label>
                <select
                  value={targetProjectId}
                  onChange={(e) => setTargetProjectId(e.target.value)}
                  className="w-full rounded-lg border px-4 py-3 text-sm outline-none cursor-pointer"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.taskCount} tasks)
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-sm mb-4" style={{ color: "var(--error)" }}>
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {orphanTasks.length > 0 && (
          <div
            className="flex justify-end gap-2 px-6 py-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <button
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
              onClick={handleReassign}
              disabled={selectedTasks.size === 0 || !targetProjectId || reassigning}
              className="rounded-lg px-4 py-2 text-sm font-bold transition-all disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent)",
                color: "white",
                cursor:
                  selectedTasks.size === 0 || !targetProjectId || reassigning
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {reassigning ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reassigning...
                </span>
              ) : (
                `Reassign ${selectedTasks.size} Task${selectedTasks.size !== 1 ? "s" : ""}`
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
