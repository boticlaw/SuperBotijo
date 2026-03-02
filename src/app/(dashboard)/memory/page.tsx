"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, Edit3, RefreshCw, Brain, Network, Cloud } from "lucide-react";
import { FileTree, FileNode } from "@/components/FileTree";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { KnowledgeGraphComponent } from "@/components/KnowledgeGraph";
import { MemoryWordCloud } from "@/components/MemoryWordCloud";
import type { KnowledgeGraph } from "@/lib/memory-parser";
import type { WordFrequency } from "@/app/api/memories/word-cloud/route";

type MainTab = "editor" | "graph" | "wordcloud";
type ViewMode = "edit" | "preview";

interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

export default function MemoryPage() {
  const [mainTab, setMainTab] = useState<MainTab>("editor");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [graphData, setGraphData] = useState<KnowledgeGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [wordCloudData, setWordCloudData] = useState<WordFrequency[]>([]);
  const [wordCloudLoading, setWordCloudLoading] = useState(false);

  const hasUnsavedChanges = content !== originalContent;

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

  useEffect(() => {
    if (mainTab === "graph" && !graphData) {
      setGraphLoading(true);
      fetch("/api/knowledge-graph")
        .then((res) => res.json())
        .then((data) => setGraphData(data))
        .catch(console.error)
        .finally(() => setGraphLoading(false));
    }
  }, [mainTab, graphData]);

  useEffect(() => {
    if (mainTab === "wordcloud" && wordCloudData.length === 0) {
      setWordCloudLoading(true);
      fetch("/api/memories/word-cloud?source=all")
        .then((res) => res.json())
        .then((data) => setWordCloudData(data.words || []))
        .catch(console.error)
        .finally(() => setWordCloudLoading(false));
    }
  }, [mainTab, wordCloudData.length]);

  const loadFileTree = useCallback(async (workspace: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/files?workspace=${encodeURIComponent(workspace)}`);
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError("Failed to load file tree");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFile = useCallback(async (workspace: string, path: string) => {
    try {
      setError(null);
      const res = await fetch(
        `/api/files?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}`
      );
      if (!res.ok) throw new Error("Failed to load file");
      const data = await res.json();
      setContent(data.content);
      setOriginalContent(data.content);
    } catch (err) {
      setError("Failed to load file");
      console.error(err);
    }
  }, []);

  const saveFile = useCallback(async () => {
    if (!selectedWorkspace || !selectedPath) return;
    const res = await fetch("/api/files", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: selectedWorkspace, path: selectedPath, content }),
    });
    if (!res.ok) throw new Error("Failed to save file");
    setOriginalContent(content);
  }, [selectedWorkspace, selectedPath, content]);

  const handleSelectFile = useCallback(
    async (path: string) => {
      if (hasUnsavedChanges) {
        const confirmed = window.confirm("You have unsaved changes. Discard them?");
        if (!confirmed) return;
      }
      setSelectedPath(path);
      if (selectedWorkspace) await loadFile(selectedWorkspace, path);
    },
    [hasUnsavedChanges, selectedWorkspace, loadFile]
  );

  const handleWorkspaceSelect = (workspaceId: string) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmed) return;
    }
    setSelectedWorkspace(workspaceId);
    setSelectedPath(null);
    setContent("");
    setOriginalContent("");
  };

  useEffect(() => {
    if (selectedWorkspace) loadFileTree(selectedWorkspace);
  }, [selectedWorkspace, loadFileTree]);

  useEffect(() => {
    if (files.length > 0 && !selectedPath) {
      const memoryMd = files.find((f) => f.name === "MEMORY.md" && f.type === "file");
      const firstFile = memoryMd || files.find((f) => f.type === "file");
      if (firstFile) handleSelectFile(firstFile.path);
    }
  }, [files, selectedPath, handleSelectFile]);

  const selectedWorkspaceData = workspaces.find((w) => w.id === selectedWorkspace);

  const handleWordClick = useCallback((word: string) => {
    window.open(`/memory?q=${encodeURIComponent(word)}`, "_blank");
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "24px 24px 16px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
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
              Memory
            </h1>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>
              Knowledge base del agente
            </p>
          </div>

          <div
            style={{
              display: "flex",
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "4px",
            }}
          >
            <button
              onClick={() => setMainTab("editor")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "6px",
                backgroundColor: mainTab === "editor" ? "var(--accent)" : "transparent",
                color: mainTab === "editor" ? "var(--bg)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <Edit3 size={14} />
              Editor
            </button>
            <button
              onClick={() => setMainTab("graph")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "6px",
                backgroundColor: mainTab === "graph" ? "var(--accent)" : "transparent",
                color: mainTab === "graph" ? "var(--bg)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <Network size={14} />
              Graph
            </button>
            <button
              onClick={() => setMainTab("wordcloud")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "6px",
                backgroundColor: mainTab === "wordcloud" ? "var(--accent)" : "transparent",
                color: mainTab === "wordcloud" ? "var(--bg)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <Cloud size={14} />
              Word Cloud
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, borderTop: "1px solid var(--border)" }}>
        {mainTab === "editor" ? (
          <div style={{ display: "flex", height: "100%" }}>
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
                Workspaces
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
                      border: "none",
                      borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "18px", lineHeight: 1 }}>{workspace.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? "var(--accent)" : "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {workspace.name}
                      </div>
                      {workspace.agentName && (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {workspace.agentName}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </aside>

            <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {selectedWorkspace && selectedWorkspaceData ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 16px",
                      borderBottom: "1px solid var(--border)",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Brain style={{ width: "16px", color: "var(--accent)" }} />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {selectedWorkspaceData.name}
                      </span>
                      {selectedPath && (
                        <>
                          <span style={{ color: "var(--text-muted)" }}>/</span>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{selectedPath}</span>
                        </>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        onClick={() => selectedWorkspace && loadFileTree(selectedWorkspace)}
                        title="Refresh"
                        style={{
                          padding: "5px 7px",
                          borderRadius: "6px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                        }}
                      >
                        <RefreshCw size={14} />
                      </button>

                      <div style={{ display: "flex", background: "var(--bg)", borderRadius: "6px", padding: "3px" }}>
                        <button
                          onClick={() => setViewMode("preview")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 10px",
                            borderRadius: "4px",
                            backgroundColor: viewMode === "preview" ? "var(--accent)" : "transparent",
                            color: viewMode === "preview" ? "var(--bg)" : "var(--text-muted)",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          <Eye size={13} />
                          Preview
                        </button>
                        <button
                          onClick={() => setViewMode("edit")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 10px",
                            borderRadius: "4px",
                            backgroundColor: viewMode === "edit" ? "var(--accent)" : "transparent",
                            color: viewMode === "edit" ? "var(--bg)" : "var(--text-muted)",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          <Edit3 size={13} />
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                    <div style={{ width: "230px", flexShrink: 0, borderRight: "1px solid var(--border)", overflowY: "auto" }}>
                      {isLoading ? (
                        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                          Loading...
                        </div>
                      ) : (
                        <FileTree files={files} selectedPath={selectedPath} onSelect={handleSelectFile} />
                      )}
                    </div>

                    <div style={{ flex: 1, backgroundColor: "var(--bg)", overflow: "hidden" }}>
                      {selectedPath ? (
                        viewMode === "edit" ? (
                          <MarkdownEditor
                            content={content}
                            onChange={setContent}
                            onSave={saveFile}
                            hasUnsavedChanges={hasUnsavedChanges}
                          />
                        ) : (
                          <div style={{ overflow: "auto", height: "100%" }}>
                            <MarkdownPreview content={content} />
                          </div>
                        )
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                          <div style={{ textAlign: "center" }}>
                            <Brain style={{ width: "64px", height: "64px", margin: "0 auto 16px", opacity: 0.3 }} />
                            <p>Selecciona un archivo</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                  Selecciona un workspace
                </div>
              )}
            </main>
          </div>
        ) : mainTab === "graph" ? (
          graphLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
              <RefreshCw size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : graphData && graphData.entities.length > 0 ? (
            <div style={{ flex: 1, minHeight: 0, width: "100%", height: "100%" }}>
              <KnowledgeGraphComponent data={graphData} />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
              <div style={{ textAlign: "center" }}>
                <Network size={64} style={{ opacity: 0.3, marginBottom: "16px" }} />
                <p>No entities found in memory</p>
                <p style={{ fontSize: "12px", marginTop: "8px" }}>Run the agent to populate memory</p>
              </div>
            </div>
          )
        ) : (
          <div style={{ height: "100%", padding: "24px" }}>
            <div style={{ height: "100%", backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px" }}>
              {wordCloudLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                  <RefreshCw size={24} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <MemoryWordCloud words={wordCloudData} onWordClick={handleWordClick} />
              )}
            </div>
          </div>
        )}
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
