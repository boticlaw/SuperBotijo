"use client";

import { useState } from "react";
import { Grid3X3, List } from "lucide-react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FileBrowser } from "@/components/FileBrowser";
import { useI18n } from "@/i18n/provider";

export interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

export default function FilesClient({
  initialWorkspaces,
}: {
  initialWorkspaces: Workspace[];
}) {
  const { t } = useI18n();
  const [workspaces] = useState<Workspace[]>(initialWorkspaces);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(
    initialWorkspaces.length > 0 ? initialWorkspaces[0].id : null
  );
  const [currentPath, setCurrentPath] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const handleWorkspaceSelect = (workspaceId: string) => {
    setSelectedWorkspace(workspaceId);
    setCurrentPath("");
  };

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
                  <Breadcrumbs
                    path={currentPath}
                    onNavigate={setCurrentPath}
                    prefix={selectedWorkspaceData.name}
                  />
                </div>

                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
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
                </div>
              </div>

              <div style={{ flex: 1, padding: "0", position: "relative" }}>
                <FileBrowser
                  workspace={selectedWorkspace}
                  path={currentPath}
                  onNavigate={setCurrentPath}
                  viewMode={viewMode}
                />
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
    </div>
  );
}
