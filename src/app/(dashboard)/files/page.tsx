"use client";

import { useState, useEffect, useCallback } from "react";
import { List, Grid3X3, Box, RefreshCw, AlertCircle, Loader2, Filter, X } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FileBrowser } from "@/components/FileBrowser";
import { FileTree3D } from "@/components/files-3d/FileTree3D";
import { useI18n } from "@/i18n/provider";
import type { FileNode3D } from "@/app/api/files/tree-3d/route";

interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

const FILE_TYPES = [
  { ext: "ts", label: "TypeScript", color: "#3178c6" },
  { ext: "tsx", label: "TSX", color: "#3178c6" },
  { ext: "js", label: "JavaScript", color: "#f7df1e" },
  { ext: "jsx", label: "JSX", color: "#61dafb" },
  { ext: "json", label: "JSON", color: "#292929" },
  { ext: "md", label: "Markdown", color: "#083fa1" },
  { ext: "css", label: "CSS", color: "#264de4" },
  { ext: "py", label: "Python", color: "#3572A5" },
  { ext: "go", label: "Go", color: "#00ADD8" },
];

export default function FilesPage() {
  const { t } = useI18n();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [is3DView, setIs3DView] = useState(false);

  const [tree3D, setTree3D] = useState<FileNode3D[]>([]);
  const [tree3DLoading, setTree3DLoading] = useState(false);
  const [tree3DError, setTree3DError] = useState<string | null>(null);
  const [selected3DNode, setSelected3DNode] = useState<FileNode3D | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/files/workspaces")
      .then((res) => res.json())
      .then((data) => {
        setWorkspaces(data.workspaces || []);
        if (data.workspaces.length > 0) {
          setSelectedWorkspace(data.workspaces[0].id);
        }
      })
      .catch(() => setWorkspaces([]));
  }, []);

  const fetchTree3D = useCallback(async () => {
    if (!selectedWorkspace) return;
    setTree3DLoading(true);
    setTree3DError(null);
    try {
      const res = await fetch(`/api/files/tree-3d?workspace=${selectedWorkspace}`);
      if (!res.ok) throw new Error("Failed to load tree");
      const data = await res.json();
      setTree3D(data.tree || []);
    } catch (err) {
      setTree3DError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTree3DLoading(false);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (is3DView) {
      fetchTree3D();
    }
  }, [is3DView, fetchTree3D]);

  const handleWorkspaceSelect = (workspaceId: string) => {
    setSelectedWorkspace(workspaceId);
    setCurrentPath("");
  };

  const handle3DNodeClick = useCallback((node: FileNode3D) => {
    setSelected3DNode(node);
  }, []);

  const toggleType = (ext: string) => {
    setSelectedTypes((prev) =>
      prev.includes(ext) ? prev.filter((t) => t !== ext) : [...prev, ext]
    );
  };

  const filter = selectedTypes.length > 0 ? { types: selectedTypes } : undefined;

  const selectedWorkspaceData = workspaces.find((w) => w.id === selectedWorkspace);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0" }}>
      <div style={{ padding: "24px 24px 16px 24px" }}>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "-1px",
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          {t("files.title")}
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>
          {t("files.subtitle")}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          borderTop: "1px solid var(--border)",
        }}
      >
        <aside
          style={{
            width: "220px",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            padding: "16px 0",
            backgroundColor: "var(--surface, var(--card))",
          }}
        >
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              padding: "0 16px 8px",
              textTransform: "uppercase",
            }}
          >
            {t("common.workspaces")}
          </p>

          {workspaces.map((workspace) => {
            const isSelected = selectedWorkspace === workspace.id;
            return (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceSelect(workspace.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 16px",
                  background: isSelected ? "var(--accent-soft)" : "transparent",
                  borderTop: "none",
                  borderRight: "none",
                  borderBottom: "none",
                  borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 120ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "var(--surface-hover, rgba(255,255,255,0.05))";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>{workspace.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "13px",
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? "var(--accent)" : "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {workspace.name}
                  </div>
                  {workspace.agentName && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {workspace.agentName}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </aside>

        <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {selectedWorkspace && selectedWorkspaceData ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: "var(--surface, var(--card))",
                  flexShrink: 0,
                  gap: "12px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!is3DView && (
                    <Breadcrumbs
                      path={currentPath}
                      onNavigate={setCurrentPath}
                      prefix={selectedWorkspaceData.name}
                    />
                  )}
                  {is3DView && (
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      3D View: {selectedWorkspaceData.name}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  {!is3DView && (
                    <>
                      <button
                        onClick={() => setViewMode("list")}
                        title="Vista lista"
                        style={{
                          padding: "5px 7px",
                          borderRadius: "6px",
                          border: "none",
                          cursor: "pointer",
                          backgroundColor: viewMode === "list" ? "var(--accent)" : "transparent",
                          color: viewMode === "list" ? "var(--bg, #111)" : "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 120ms ease",
                        }}
                      >
                        <List size={15} />
                      </button>
                      <button
                        onClick={() => setViewMode("grid")}
                        title="Vista iconos"
                        style={{
                          padding: "5px 7px",
                          borderRadius: "6px",
                          border: "none",
                          cursor: "pointer",
                          backgroundColor: viewMode === "grid" ? "var(--accent)" : "transparent",
                          color: viewMode === "grid" ? "var(--bg, #111)" : "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 120ms ease",
                        }}
                      >
                        <Grid3X3 size={15} />
                      </button>
                    </>
                  )}
                  <div style={{ width: "1px", height: "20px", backgroundColor: "var(--border)", margin: "0 4px" }} />
                  <button
                    onClick={() => {
                      setIs3DView(!is3DView);
                      setSelected3DNode(null);
                    }}
                    title={is3DView ? "Vista 2D" : "Vista 3D"}
                    style={{
                      padding: "5px 7px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: is3DView ? "var(--accent)" : "transparent",
                      color: is3DView ? "var(--bg, #111)" : "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 120ms ease",
                    }}
                  >
                    <Box size={15} />
                  </button>
                  {is3DView && (
                    <>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        title="Filters"
                        style={{
                          padding: "5px 7px",
                          borderRadius: "6px",
                          border: "none",
                          cursor: "pointer",
                          backgroundColor: showFilters ? "var(--accent-soft)" : "transparent",
                          color: showFilters ? "var(--accent)" : "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 120ms ease",
                        }}
                      >
                        <Filter size={15} />
                      </button>
                      <button
                        onClick={fetchTree3D}
                        disabled={tree3DLoading}
                        title="Refresh"
                        style={{
                          padding: "5px 7px",
                          borderRadius: "6px",
                          border: "none",
                          cursor: tree3DLoading ? "wait" : "pointer",
                          backgroundColor: "transparent",
                          color: "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 120ms ease",
                        }}
                      >
                        <RefreshCw size={15} className={tree3DLoading ? "animate-spin" : ""} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, padding: "0", position: "relative" }}>
                {!is3DView ? (
                  <FileBrowser
                    workspace={selectedWorkspace}
                    path={currentPath}
                    onNavigate={setCurrentPath}
                    viewMode={viewMode}
                  />
                ) : tree3DLoading ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "var(--text-muted)",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <Loader2 size={32} className="animate-spin" style={{ marginBottom: "12px" }} />
                      <p>Building 3D tree...</p>
                    </div>
                  </div>
                ) : tree3DError ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "var(--error)",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <AlertCircle size={32} style={{ marginBottom: "12px" }} />
                      <p>{tree3DError}</p>
                    </div>
                  </div>
                ) : (
                  <FileTree3D tree={tree3D} onNodeClick={handle3DNodeClick} filter={filter} />
                )}

                {is3DView && showFilters && (
                  <div
                    style={{
                      position: "absolute",
                      top: "16px",
                      left: "16px",
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "12px",
                      zIndex: 10,
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>
                      File Types
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxWidth: "200px" }}>
                      {FILE_TYPES.map((type) => (
                        <button
                          key={type.ext}
                          onClick={() => toggleType(type.ext)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            backgroundColor: selectedTypes.includes(type.ext) ? type.color : "transparent",
                            border: `1px solid ${type.color}`,
                            borderRadius: "4px",
                            color: selectedTypes.includes(type.ext) ? "#fff" : type.color,
                            cursor: "pointer",
                            fontSize: "10px",
                          }}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                    {selectedTypes.length > 0 && (
                      <button
                        onClick={() => setSelectedTypes([])}
                        style={{
                          marginTop: "8px",
                          padding: "4px 8px",
                          backgroundColor: "transparent",
                          border: "1px solid var(--border)",
                          borderRadius: "4px",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          fontSize: "10px",
                          width: "100%",
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}

                {is3DView && selected3DNode && (
                  <div
                    style={{
                      position: "absolute",
                      right: "16px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "280px",
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                      zIndex: 10,
                    }}
                  >
                    <div
                      style={{
                        padding: "16px",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "4px",
                            backgroundColor: selected3DNode.color,
                          }}
                        />
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {selected3DNode.name}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelected3DNode(null)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div style={{ padding: "16px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                        <div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Type</div>
                          <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                            {selected3DNode.type === "directory" ? "Directory" : selected3DNode.extension.toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Size</div>
                          <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                            {selected3DNode.type === "directory"
                              ? `${selected3DNode.children?.length || 0} items`
                              : `${(selected3DNode.size / 1024).toFixed(1)} KB`}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: "12px" }}>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Path</div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            fontFamily: "monospace",
                            wordBreak: "break-all",
                          }}
                        >
                          {selected3DNode.path}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Last Modified</div>
                        <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                          {new Date(selected3DNode.lastModified).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              Selecciona un workspace para explorar sus archivos
            </div>
          )}
        </main>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
