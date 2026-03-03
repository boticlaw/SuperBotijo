"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Target,
  LayoutGrid,
  BookOpen,
  Rocket,
} from "lucide-react";
import type { Project, Milestone } from "@/lib/mission-types";

interface ProjectWithStats extends Project {
  taskCount: number;
  completedTasks: number;
  progress: number;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error("Failed to fetch projects");
      }

      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/kanban?project=${projectId}`);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "var(--success)";
    if (progress >= 50) return "var(--info)";
    if (progress >= 25) return "var(--warning)";
    return "var(--text-muted)";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { icon: CheckCircle, color: "var(--success)", label: "Active" };
      case "completed":
        return { icon: CheckCircle, color: "var(--success)", label: "Completed" };
      case "paused":
        return { icon: Clock, color: "var(--warning)", label: "Paused" };
      case "archived":
        return { icon: AlertTriangle, color: "var(--text-muted)", label: "Archived" };
      default:
        return { icon: Clock, color: "var(--text-muted)", label: status };
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--accent)" }} />
          <span style={{ color: "var(--text-secondary)" }}>Loading projects...</span>
        </div>
      </div>
    );
  }

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
            onClick={fetchProjects}
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
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Projects
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Organize tasks into projects with milestones
            </p>
          </div>
          <button
            onClick={() => router.push("/kanban")}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--accent)",
              color: "white",
            }}
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-xl p-8"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <Briefcase
            className="h-12 w-12 mb-4"
            style={{ color: "var(--text-muted)" }}
          />
          <p
            className="mb-2 text-lg font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            No projects yet
          </p>
          <p
            className="mb-4 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Create projects to organize your tasks
          </p>
          <button
            onClick={() => router.push("/kanban")}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Go to Kanban
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const StatusIcon = getStatusBadge(project.status).icon;
            const statusBadge = getStatusBadge(project.status);

            return (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                className="cursor-pointer rounded-xl p-4 transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <h3
                      className="font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {project.name}
                    </h3>
                    {project.description && (
                      <p
                        className="mt-1 text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {project.description}
                      </p>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                    style={{
                      backgroundColor: `${statusBadge.color}20`,
                      color: statusBadge.color,
                    }}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusBadge.label}
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-muted)" }}>
                      {project.completedTasks} / {project.taskCount} tasks
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {Math.round(project.progress)}%
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--surface-elevated)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${project.progress}%`,
                        backgroundColor: getProgressColor(project.progress),
                      }}
                    />
                  </div>
                </div>

                {/* Milestones */}
                {project.milestones && project.milestones.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: "var(--text-muted)" }}>
                      {project.milestones.filter((m: Milestone) => m.completed).length}/{project.milestones.length} milestones
                    </span>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {project.taskCount} tasks
                  </span>
                  <ExternalLink
                    className="h-4 w-4"
                    style={{ color: "var(--text-muted)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

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
