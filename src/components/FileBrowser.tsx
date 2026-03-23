"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Folder,
  FileText,
  FileCode,
  FileJson,
  Image,
  File,
  Loader2,
  AlertCircle,
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FolderPlus,
  FilePlus,
  X,
  Save,
  Eye,
  Code2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useI18n } from "@/i18n/provider";
import { FilePreview } from "./FilePreview";
import { MarkdownPreview } from "./MarkdownPreview";
import { useToast } from "./Toast";

// Lazy-load Monaco editor to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface FileEntry {
  name: string;
  type: "file" | "folder";
  size: number;
  modified: string;
}

interface FileBrowserProps {
  workspace: string;
  path: string;
  onNavigate: (path: string) => void;
  viewMode?: "grid" | "list";
}

function getFileIcon(name: string, type: string) {
  if (type === "folder") return Folder;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["ts", "tsx", "js", "jsx", "py", "sh", "bash"].includes(ext)) return FileCode;
  if (["json", "yaml", "yml", "toml"].includes(ext)) return FileJson;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(ext)) return Image;
  if (["md", "mdx", "txt", "log"].includes(ext)) return FileText;
  return File;
}

function getFileColor(name: string, type: string): string {
  if (type === "folder") return "#F59E0B";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["ts", "tsx"].includes(ext)) return "#60A5FA";
  if (["js", "jsx"].includes(ext)) return "#FCD34D";
  if (["json"].includes(ext)) return "#4ADE80";
  if (["py"].includes(ext)) return "#93C5FD";
  if (["md", "mdx"].includes(ext)) return "var(--text-secondary)";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "#C084FC";
  return "var(--text-secondary)";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function getMonacoLanguage(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", mdx: "markdown", py: "python",
    sh: "shell", bash: "shell", yaml: "yaml", yml: "yaml",
    toml: "toml", css: "css", html: "html", sql: "sql",
    txt: "plaintext", log: "plaintext",
  };
  return map[ext] || "plaintext";
}

function isEditable(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const editableExts = ["ts", "tsx", "js", "jsx", "json", "md", "mdx", "txt", "py", "sh", "yaml", "yml", "toml", "css", "html", "sql", "log", "env"];
  return editableExts.includes(ext) || !name.includes(".");
}

function isMarkdownFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ext === "md" || ext === "mdx";
}

function isHtmlFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ext === "html" || ext === "htm";
}

// ─── Monaco Editor Modal ───────────────────────────────────────────────────────
interface EditorModalProps {
  workspace: string;
  filePath: string;
  fileName: string;
  initialViewMode?: "edit" | "preview";
  onClose: () => void;
}

function EditorModal({ workspace, filePath, fileName, initialViewMode = "preview", onClose }: EditorModalProps) {
  const { t } = useI18n();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">(initialViewMode);
  const previewIsHtml = isHtmlFile(fileName);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const dialogTitleId = `editor-dialog-title-${fileName.replace(/[^a-zA-Z0-9]/g, "-")}`;

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/browse?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(filePath)}&content=true`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) {
          throw new Error(t("files.browser.editor.errors.load"));
        }
        return r.json();
      })
      .then((data) => {
        setContent(data.content || "");
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(t("files.browser.editor.errors.load"));
        setLoading(false);
      });
    return () => controller.abort();
  }, [workspace, filePath, t]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, path: filePath, content }),
      });
      if (!res.ok) throw new Error(t("files.browser.editor.errors.save"));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t("files.browser.editor.errors.save"));
    } finally {
      setSaving(false);
    }
  }, [workspace, filePath, content, t]);

  const handleOpenPreviewInNewTab = useCallback(() => {
    const htmlBlob = new Blob([content], { type: "text/html;charset=utf-8" });
    const previewUrl = URL.createObjectURL(htmlBlob);
    const newWindow = window.open(previewUrl, "_blank", "noopener,noreferrer");
    if (newWindow) {
      setTimeout(() => {
        URL.revokeObjectURL(previewUrl);
      }, 15000);
      return;
    }
    URL.revokeObjectURL(previewUrl);
  }, [content]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, handleClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      style={{
      position: "fixed", inset: 0, zIndex: 1000,
      backgroundColor: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
      }}
    >
      <div style={{
        width: "95vw", maxWidth: "1200px", height: "90vh",
        backgroundColor: "var(--card)",
        borderRadius: "1rem",
        border: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "1rem",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <FileCode className="w-5 h-5" style={{ color: "var(--accent)" }} />
          <span id={dialogTitleId} style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: "0.9rem", flex: 1 }}>
            {fileName}
          </span>

          {/* View mode toggle */}
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button
              onClick={() => setViewMode("edit")}
              aria-label={t("files.browser.editor.edit")}
              style={{
                padding: "0.375rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem",
                backgroundColor: viewMode === "edit" ? "var(--accent)" : "var(--card-elevated)",
                color: viewMode === "edit" ? "#000" : "var(--text-secondary)",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem",
              }}
            >
              <Code2 className="w-3.5 h-3.5" /> {t("files.browser.editor.edit")}
            </button>
            <button
              onClick={() => setViewMode("preview")}
              aria-label={t("files.browser.editor.preview")}
              style={{
                padding: "0.375rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem",
                backgroundColor: viewMode === "preview" ? "var(--accent)" : "var(--card-elevated)",
                color: viewMode === "preview" ? "#000" : "var(--text-secondary)",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem",
              }}
            >
              <Eye className="w-3.5 h-3.5" /> {t("files.browser.editor.preview")}
            </button>
          </div>

          {viewMode === "preview" && previewIsHtml && (
            <button
              onClick={handleOpenPreviewInNewTab}
              title={t("files.browser.editor.openNewTab")}
              aria-label={t("files.browser.editor.openNewTab")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.375rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--card-elevated)",
                color: "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            aria-label={t("files.browser.editor.save")}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 1rem", borderRadius: "0.5rem",
              backgroundColor: saved ? "var(--success)" : "var(--accent)",
              color: "#000", border: "none", cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 600, fontSize: "0.875rem", opacity: saving ? 0.7 : 1,
            }}
          >
            <Save className="w-4 h-4" />
            {saved ? t("files.browser.editor.saved") : saving ? t("files.browser.editor.saving") : t("files.browser.editor.save")}
          </button>

          <button
            ref={closeButtonRef}
            onClick={handleClose}
            aria-label={t("common.close")}
            style={{ padding: "0.5rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error bar */}
        {error && (
          <div style={{ padding: "0.5rem 1rem", backgroundColor: "rgba(239,68,68,0.1)", color: "var(--error)", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Editor */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : viewMode === "edit" ? (
            <MonacoEditor
              value={content}
              onChange={(val) => setContent(val || "")}
              language={getMonacoLanguage(fileName)}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                wordWrap: "on",
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                renderWhitespace: "selection",
                tabSize: 2,
                automaticLayout: true,
              }}
            />
          ) : viewMode === "preview" && isMarkdownFile(fileName) ? (
            <div style={{ height: "100%", overflow: "auto", padding: "1.5rem" }}>
              <MarkdownPreview content={content} withContainer={false} />
            </div>
          ) : viewMode === "preview" && previewIsHtml ? (
            <div style={{ height: "100%", backgroundColor: "#fff" }}>
              <iframe
                title={t("files.browser.editor.iframeTitle", { name: fileName })}
                srcDoc={content}
                sandbox="allow-forms allow-modals allow-popups allow-scripts"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          ) : (
            <div style={{ height: "100%", overflow: "auto", padding: "1.5rem" }}>
              <pre style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.875rem" }}>
                {content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main FileBrowser Component ────────────────────────────────────────────────
export function FileBrowser({ workspace, path, onNavigate, viewMode = "list" }: FileBrowserProps) {
  const { t } = useI18n();
  const { showError } = useToast();
  const [items, setItems] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ workspace: string; path: string; name: string } | null>(null);
  const [editorFile, setEditorFile] = useState<{ workspace: string; path: string; name: string; initialViewMode?: "edit" | "preview" } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadItemsControllerRef = useRef<AbortController | null>(null);

  const loadItems = useCallback(() => {
    loadItemsControllerRef.current?.abort();
    const controller = new AbortController();
    loadItemsControllerRef.current = controller;
    setLoading(true);
    setError(null);
    fetch(`/api/browse?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(t("files.browser.errors.loadDirectory"));
        return res.json();
      })
      .then((data) => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      })
      .finally(() => {
        if (loadItemsControllerRef.current === controller) {
          loadItemsControllerRef.current = null;
        }
      });
  }, [workspace, path, t]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    return () => {
      loadItemsControllerRef.current?.abort();
    };
  }, []);

  const handleItemClick = (item: FileEntry, openMode: "preview" | "edit" = "preview") => {
    if (item.type === "folder") {
      const newPath = path ? `${path}/${item.name}` : item.name;
      onNavigate(newPath);
    } else {
      const filePath = path ? `${path}/${item.name}` : item.name;
      if (isEditable(item.name)) {
        setEditorFile({
          workspace,
          path: filePath,
          name: item.name,
          initialViewMode: openMode,
        });
      } else {
        setPreviewFile({ workspace, path: filePath, name: item.name });
      }
    }
  };

  const handleItemDoubleClick = (item: FileEntry) => {
    handleItemClick(item, "edit");
  };

  // Upload handler
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("workspace", workspace);
      formData.append("path", path);
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }
      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error(t("files.browser.errors.upload"));
      loadItems();
    } catch (e) {
      console.error("Upload error:", e);
      showError(t("files.browser.errors.upload"));
    } finally {
      setUploading(false);
    }
  };

  // Download handler
  const handleDownload = (item: FileEntry) => {
    const filePath = path ? `${path}/${item.name}` : item.name;
    const url = `/api/files/download?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(filePath)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = item.name;
    a.click();
  };

  // Delete handler
  const handleDelete = async (item: FileEntry) => {
    const filePath = path ? `${path}/${item.name}` : item.name;
    try {
      const res = await fetch("/api/files/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, path: filePath }),
      });
      if (!res.ok) {
        const data = await res.json();
        showError(data.error || t("files.browser.errors.delete"));
      } else {
        loadItems();
      }
    } catch {
      showError(t("files.browser.errors.delete"));
    } finally {
      setConfirmDelete(null);
    }
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, path, name: newFolderName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showError(data.error || t("files.browser.errors.createFolder"));
        return;
      }
      setNewFolderName("");
      setShowNewFolder(false);
      loadItems();
    } catch {
      showError(t("files.browser.errors.createFolder"));
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    const filePath = path ? `${path}/${newFileName.trim()}` : newFileName.trim();
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, path: filePath, content: "" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showError(data.error || t("files.browser.errors.createFile"));
        return;
      }
      setNewFileName("");
      setShowNewFile(false);
      loadItems();
      setEditorFile({ workspace, path: filePath, name: newFileName.trim(), initialViewMode: "edit" });
    } catch {
      showError(t("files.browser.errors.createFile"));
    }
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--accent)" }}>
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.5rem 1rem",
        borderBottom: "1px solid var(--border)",
        flexWrap: "wrap",
      }}>
        {/* Upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title={t("files.browser.actions.upload")}
          aria-label={t("files.browser.actions.upload")}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            padding: "0.375rem 0.75rem", borderRadius: "0.5rem",
            backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)",
            border: "1px solid var(--border)", cursor: "pointer", fontSize: "0.8rem",
          }}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {t("files.browser.actions.upload")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleUpload(e.target.files)}
        />

        {/* New Folder */}
        <button
          onClick={() => setShowNewFolder(true)}
          title={t("files.browser.actions.newFolder")}
          aria-label={t("files.browser.actions.newFolder")}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            padding: "0.375rem 0.75rem", borderRadius: "0.5rem",
            backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)",
            border: "1px solid var(--border)", cursor: "pointer", fontSize: "0.8rem",
          }}
        >
          <FolderPlus className="w-3.5 h-3.5" /> {t("files.browser.actions.newFolder")}
        </button>

        {/* New File */}
        <button
          onClick={() => setShowNewFile(true)}
          title={t("files.browser.actions.newFile")}
          aria-label={t("files.browser.actions.newFile")}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            padding: "0.375rem 0.75rem", borderRadius: "0.5rem",
            backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)",
            border: "1px solid var(--border)", cursor: "pointer", fontSize: "0.8rem",
          }}
        >
          <FilePlus className="w-3.5 h-3.5" /> {t("files.browser.actions.newFile")}
        </button>

        <button
          onClick={loadItems}
          title={t("common.refresh")}
          aria-label={t("common.refresh")}
          style={{
            display: "flex", alignItems: "center",
            padding: "0.375rem", borderRadius: "0.5rem",
            backgroundColor: "transparent", color: "var(--text-muted)",
            border: "none", cursor: "pointer", marginLeft: "auto",
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New Folder input */}
      {showNewFolder && (
        <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", backgroundColor: "var(--card-elevated)" }}>
          <Folder className="w-4 h-4 mt-1.5" style={{ color: "#F59E0B", flexShrink: 0 }} />
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
            placeholder={t("files.browser.folderPlaceholder")}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "0.9rem" }}
          />
          <button onClick={handleCreateFolder} style={{ padding: "0.25rem 0.75rem", borderRadius: "0.375rem", background: "var(--accent)", color: "#000", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>{t("common.create")}</button>
          <button onClick={() => setShowNewFolder(false)} aria-label={t("common.cancel")} style={{ padding: "0.25rem", borderRadius: "0.375rem", background: "none", color: "var(--text-muted)", border: "none", cursor: "pointer" }}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* New File input */}
      {showNewFile && (
        <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", backgroundColor: "var(--card-elevated)" }}>
          <File className="w-4 h-4 mt-1.5" style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          <input
            autoFocus
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFile(); if (e.key === "Escape") setShowNewFile(false); }}
            placeholder={t("files.browser.filePlaceholder")}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "0.9rem" }}
          />
          <button onClick={handleCreateFile} style={{ padding: "0.25rem 0.75rem", borderRadius: "0.375rem", background: "var(--accent)", color: "#000", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>{t("common.create")}</button>
          <button onClick={() => setShowNewFile(false)} aria-label={t("common.cancel")} style={{ padding: "0.25rem", borderRadius: "0.375rem", background: "none", color: "var(--text-muted)", border: "none", cursor: "pointer" }}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          flex: 1,
          outline: dragging ? "2px dashed var(--accent)" : "none",
          outlineOffset: "-2px",
          transition: "outline 0.2s",
          minHeight: "100px",
        }}
      >
        {items.length === 0 && !dragging && (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--text-secondary)" }}>
            <FolderOpen className="w-16 h-16 mb-4 opacity-50" />
            <p>{t("files.browser.empty.title")}</p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>{t("files.browser.empty.hint")}</p>
          </div>
        )}

        {dragging && (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--accent)" }}>
            <Upload className="w-16 h-16 mb-4" />
            <p>{t("files.browser.dropzone")}</p>
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && items.length > 0 && !dragging && (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)" }}>
            <div
              className="hidden md:grid grid-cols-12 gap-4 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium"
              style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}
            >
              <div className="col-span-6">{t("files.browser.columns.name")}</div>
              <div className="col-span-2">{t("files.browser.columns.size")}</div>
              <div className="col-span-3">{t("files.browser.columns.modified")}</div>
              <div className="col-span-1"></div>
            </div>

            {items.map((item) => {
              const Icon = getFileIcon(item.name, item.type);
              const iconColor = getFileColor(item.name, item.type);
              return (
                <div
                  key={item.name}
                  className="flex md:grid md:grid-cols-12 gap-2 md:gap-4 px-3 md:px-6 py-2.5 md:py-3 cursor-pointer transition-colors hover:opacity-80 group"
                  style={{ borderBottom: "1px solid var(--border)", position: "relative" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--background)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  {/* Name */}
                    <div
                      className="md:col-span-6 flex items-center gap-2 md:gap-3 min-w-0 flex-1"
                      onClick={() => handleItemClick(item)}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                    >
                    <Icon className="w-4 h-4 md:w-5 md:h-5 shrink-0" style={{ color: iconColor }} />
                    <span className="truncate text-sm md:text-base" style={{ color: "var(--text-primary)" }}>
                      {item.name}
                    </span>
                    {isEditable(item.name) && item.type === "file" && (
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", opacity: 0 }} className="group-hover:opacity-100">
                        {t("files.browser.hints.doubleClickEdit")}
                      </span>
                    )}
                  </div>

                  {/* Size */}
                  <div className="md:col-span-2 text-xs md:text-sm flex items-center" style={{ color: "var(--text-secondary)" }}
                    onClick={() => handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                  >
                    {item.type === "folder" ? "—" : formatFileSize(item.size)}
                  </div>

                  {/* Modified */}
                  <div
                    className="hidden md:col-span-3 md:text-sm md:flex items-center"
                    style={{ color: "var(--text-secondary)" }}
                    onClick={() => handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                  >
                    {new Date(item.modified).toLocaleString()}
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.type === "file" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                        title={t("files.browser.actions.download")}
                        aria-label={t("files.browser.actions.download")}
                        style={{ padding: "0.25rem", borderRadius: "0.25rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(item); }}
                        title={t("common.delete")}
                        aria-label={t("common.delete")}
                        style={{ padding: "0.25rem", borderRadius: "0.25rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                      >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Grid View */}
        {viewMode === "grid" && items.length > 0 && !dragging && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4 p-4">
            {items.map((item) => {
              const Icon = getFileIcon(item.name, item.type);
              const iconColor = getFileColor(item.name, item.type);

              return (
                <div
                  key={item.name}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  className="flex flex-col items-center p-3 md:p-4 rounded-xl cursor-pointer transition-all group relative"
                  style={{ backgroundColor: "var(--card)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--background)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--card)"; }}
                >
                  <Icon className="w-10 h-10 md:w-12 md:h-12 mb-2 md:mb-3 group-hover:scale-110 transition-transform" style={{ color: iconColor }} />
                  <span className="text-xs md:text-sm text-center truncate w-full" style={{ color: "var(--text-primary)" }} title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-[10px] md:text-xs mt-0.5 md:mt-1" style={{ color: "var(--text-muted)" }}>
                    {item.type === "folder" ? t("files.browser.folder") : formatFileSize(item.size)}
                  </span>
                  {isEditable(item.name) && item.type === "file" && (
                    <span
                      className="text-[10px] mt-1 transition-opacity opacity-0 group-hover:opacity-100"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t("files.browser.hints.doubleClickEdit")}
                    </span>
                  )}

                  {/* Quick action buttons on hover */}
                  <div style={{
                    position: "absolute", top: "0.25rem", right: "0.25rem",
                    display: "flex", gap: "0.125rem",
                    opacity: 0,
                  }} className="group-hover:!opacity-100">
                    {item.type === "file" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                        aria-label={t("files.browser.actions.download")}
                        title={t("files.browser.actions.download")}
                        style={{ padding: "0.2rem", borderRadius: "0.25rem", background: "var(--card-elevated)", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(item); }}
                      aria-label={t("common.delete")}
                      title={t("common.delete")}
                      style={{ padding: "0.2rem", borderRadius: "0.25rem", background: "var(--card-elevated)", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirmDelete)}
        title={
          confirmDelete?.type === "folder"
            ? t("files.browser.deleteDialog.titleFolder")
            : t("files.browser.deleteDialog.titleFile")
        }
        message={
          confirmDelete
            ? t(
              confirmDelete.type === "folder"
                ? "files.browser.deleteDialog.messageFolder"
                : "files.browser.deleteDialog.messageFile",
              { name: confirmDelete.name }
            )
            : ""
        }
        cancelLabel={t("common.cancel")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            void handleDelete(confirmDelete);
          }
        }}
      />

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          workspace={previewFile.workspace}
          path={previewFile.path}
          name={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Monaco Editor Modal */}
      {editorFile && (
        <EditorModal
          workspace={editorFile.workspace}
          filePath={editorFile.path}
          fileName={editorFile.name}
          initialViewMode={editorFile.initialViewMode}
          onClose={() => { setEditorFile(null); loadItems(); }}
        />
      )}
    </>
  );
}
