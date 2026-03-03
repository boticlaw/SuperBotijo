"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { KanbanBoard, TaskModal } from "@/components/kanban";
import type { KanbanTask, KanbanColumn } from "@/lib/kanban-db";

export default function KanbanPage() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("#3b82f6");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [columnsRes, tasksRes] = await Promise.all([
        fetch("/api/kanban/columns"),
        fetch("/api/kanban/tasks"),
      ]);

      if (!columnsRes.ok || !tasksRes.ok) {
        throw new Error("Failed to fetch kanban data");
      }

      const columnsData = await columnsRes.json();
      const tasksData = await tasksRes.json();

      setColumns(columnsData.columns || []);
      setTasks(tasksData.tasks || []);
    } catch (err) {
      console.error("Failed to fetch kanban data:", err);
      setError(err instanceof Error ? err.message : "Failed to load kanban board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTaskClick = useCallback((task: KanbanTask) => {
    setEditingTask(task);
    setIsModalOpen(true);
  }, []);

  const handleAddTask = useCallback((columnId: string) => {
    setEditingTask(null);
    setIsModalOpen(true);
  }, []);

  const handleSaveTask = useCallback(async (taskData: Partial<KanbanTask>) => {
    try {
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
      }

      setIsModalOpen(false);
      setEditingTask(null);
      fetchData();
    } catch (err) {
      console.error("Failed to save task:", err);
      throw err;
    }
  }, [editingTask, fetchData]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete task");
      }

      fetchData();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }, [fetchData]);

  const handleMoveTask = useCallback(async (taskId: string, targetColumnId: string, targetOrder?: number) => {
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetColumnId, targetOrder }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to move task");
      }

      fetchData();
    } catch (err) {
      console.error("Failed to move task:", err);
    }
  }, [fetchData]);

  const handleAddColumn = useCallback(async () => {
    if (!newColumnName.trim()) return;

    try {
      const res = await fetch("/api/kanban/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newColumnName.trim(),
          color: newColumnColor,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create column");
      }

      setNewColumnName("");
      setNewColumnColor("#3b82f6");
      setAddColumnModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Failed to create column:", err);
    }
  }, [newColumnName, newColumnColor, fetchData]);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--accent)" }} />
          <span style={{ color: "var(--text-secondary)" }}>Loading kanban board...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--error)" }}
        >
          <AlertCircle className="h-5 w-5" style={{ color: "var(--error)" }} />
          <span style={{ color: "var(--error)" }}>{error}</span>
          <button
            onClick={fetchData}
            className="rounded-lg px-3 py-1 text-sm font-medium"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 md:p-6">
      <KanbanBoard
        columns={columns}
        tasks={tasks}
        onTaskClick={handleTaskClick}
        onAddTask={handleAddTask}
        onAddColumn={() => setAddColumnModalOpen(true)}
        onMoveTask={handleMoveTask}
      />

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        columns={columns}
        editingTask={editingTask}
      />

      {/* Add Column Modal */}
      {addColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setAddColumnModalOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Add New Column
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Column Name
                </label>
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Enter column name..."
                  className="w-full rounded-lg border px-4 py-3 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Color
                </label>
                <input
                  type="color"
                  value={newColumnColor}
                  onChange={(e) => setNewColumnColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setAddColumnModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddColumn}
                disabled={!newColumnName.trim()}
                className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                Create Column
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
