"use client";

import { useEffect, useState } from "react";
import {
  GitBranch,
  GitCommit,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Terminal,
  X,
  Loader2,
  FolderGit2,
} from "lucide-react";

import { RepoStatus } from "@/operations/git-ops";

interface OutputModal {
  title: string;
  content: string;
  loading: boolean;
}

interface GitClientProps {
  initialRepos: RepoStatus[];
}

export default function GitClient({ initialRepos }: GitClientProps) {
  const [repos, setRepos] = useState<RepoStatus[]>(initialRepos);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [outputModal, setOutputModal] = useState<OutputModal | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadRepos = async () => {
    try {
      const res = await fetch("/api/git");
      const data = await res.json();
      setRepos(data.repos || []);
    } catch {
      setRepos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (initialRepos.length === 0) {
      setLoading(true);
      loadRepos();
    }
  }, [initialRepos.length]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRepos();
  };

  const runAction = async (repo: RepoStatus, action: "status" | "pull" | "log" | "diff") => {
    const key = `${repo.name}-${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setOutputModal({ title: `${repo.name}: git ${action}`, content: "", loading: true });

    try {
      const res = await fetch("/api/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repo.path, action }),
      });
      const data = await res.json();
      setOutputModal({
        title: `${repo.name}: git ${action}`,
        content: data.output || data.error || "No output",
        loading: false,
      });
    } catch {
      setOutputModal({ title: `${repo.name}: git ${action}`, content: "Request failed", loading: false });
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const dirtyRepos = repos.filter((r) => r.isDirty);
  const cleanRepos = repos.filter((r) => !r.isDirty);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
          >
            Git Dashboard
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {repos.length} repositories · {dirtyRepos.length} with changes
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "var(--card)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : repos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          <FolderGit2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No git repos found in workspace</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...dirtyRepos, ...cleanRepos].map((repo) => (
            <div
              key={repo.path}
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: "var(--card)",
                border: `1px solid ${repo.isDirty ? "rgba(251,191,36,0.3)" : "var(--border)"}`,
              }}
            >
              <div
                className="flex items-center gap-3 px-5 py-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                  <FolderGit2
                    className="w-5 h-5"
                    style={{ color: repo.isDirty ? "#fbbf24" : "var(--success)" }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className="font-bold"
                      style={{ color: "var(--text-primary)", fontFamily: "monospace" }}
                    >
                      {repo.name}
                    </h3>
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: "var(--card-elevated)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <GitBranch className="w-3 h-3" />
                      {repo.branch}
                    </div>
                    {repo.ahead > 0 && (
                      <span className="flex items-center gap-0.5 text-xs" style={{ color: "var(--success)" }}>
                        <ArrowUp className="w-3 h-3" /> {repo.ahead} ahead
                      </span>
                    )}
                    {repo.behind > 0 && (
                      <span
                        className="flex items-center gap-0.5 text-xs"
                        style={{ color: "var(--warning, #f59e0b)" }}
                      >
                        <ArrowDown className="w-3 h-3" /> {repo.behind} behind
                      </span>
                    )}
                    {!repo.isDirty && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--success)" }}>
                        <CheckCircle className="w-3 h-3" /> clean
                      </span>
                    )}
                    {repo.isDirty && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#fbbf24" }}>
                        <AlertCircle className="w-3 h-3" />{" "}
                        {repo.staged.length + repo.unstaged.length + repo.untracked.length} changes
                      </span>
                    )}
                  </div>
                  {repo.lastCommit && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <GitCommit className="w-3 h-3" />
                      <code style={{ color: "var(--accent)" }}>{repo.lastCommit.hash}</code>
                      <span>
                        {repo.lastCommit.message.slice(0, 60)}
                        {repo.lastCommit.message.length > 60 ? "…" : ""}
                      </span>
                      <span>·</span>
                      <span>{repo.lastCommit.date}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  {[
                    { action: "status" as const, label: "status" },
                    { action: "log" as const, label: "log" },
                    { action: "diff" as const, label: "diff" },
                    { action: "pull" as const, label: "pull" },
                  ].map(({ action, label }) => (
                    <button
                      key={action}
                      onClick={() => runAction(repo, action)}
                      disabled={actionLoading[`${repo.name}-${action}`]}
                      style={{
                        padding: "0.25rem 0.625rem",
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                        backgroundColor: "var(--card-elevated)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      {actionLoading[`${repo.name}-${action}`] ? "…" : label}
                    </button>
                  ))}
                </div>
              </div>

              {repo.isDirty && (
                <div
                  className="px-5 py-3 grid grid-cols-3 gap-4"
                  style={{ backgroundColor: "rgba(251,191,36,0.04)" }}
                >
                  {repo.staged.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold mb-1" style={{ color: "var(--success)" }}>
                        Staged ({repo.staged.length})
                      </div>
                      <div className="space-y-0.5">
                        {repo.staged.slice(0, 5).map((f) => (
                          <div
                            key={f}
                            className="text-xs font-mono truncate"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {f}
                          </div>
                        ))}
                        {repo.staged.length > 5 && (
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            +{repo.staged.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {repo.unstaged.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold mb-1" style={{ color: "#fbbf24" }}>
                        Modified ({repo.unstaged.length})
                      </div>
                      <div className="space-y-0.5">
                        {repo.unstaged.slice(0, 5).map((f) => (
                          <div
                            key={f}
                            className="text-xs font-mono truncate"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {f}
                          </div>
                        ))}
                        {repo.unstaged.length > 5 && (
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            +{repo.unstaged.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {repo.untracked.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                        Untracked ({repo.untracked.length})
                      </div>
                      <div className="space-y-0.5">
                        {repo.untracked.slice(0, 5).map((f) => (
                          <div
                            key={f}
                            className="text-xs font-mono truncate"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {f}
                          </div>
                        ))}
                        {repo.untracked.length > 5 && (
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            +{repo.untracked.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {outputModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "95vw",
              maxWidth: "700px",
              height: "65vh",
              backgroundColor: "#0d1117",
              borderRadius: "1rem",
              border: "1px solid #30363d",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.875rem 1rem",
                borderBottom: "1px solid #30363d",
                flexShrink: 0,
              }}
            >
              <Terminal className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span
                style={{ color: "#c9d1d9", fontFamily: "monospace", fontSize: "0.875rem", flex: 1 }}
              >
                {outputModal.title}
              </span>
              <button
                onClick={() => setOutputModal(null)}
                style={{
                  padding: "0.375rem",
                  borderRadius: "0.375rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#8b949e",
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
              {outputModal.loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
                </div>
              ) : (
                <pre
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    color: "#c9d1d9",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                  }}
                >
                  {outputModal.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
