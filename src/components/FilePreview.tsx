"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  X,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";

const PdfViewer = dynamic(
  () => import("@/components/PdfViewer").then((mod) => mod.PdfViewer),
  { ssr: false }
);

interface FilePreviewProps {
  workspace: string;
  path: string;
  name: string;
  onClose: () => void;
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function isImageFile(ext: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(ext);
}

function isMarkdown(ext: string): boolean {
  return ext === "md" || ext === "mdx";
}

function isCodeFile(ext: string): boolean {
  return [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "py",
    "css",
    "html",
    "yaml",
    "yml",
    "sh",
    "bash",
    "sql",
    "xml",
    "toml",
  ].includes(ext);
}

function isHtmlFile(ext: string): boolean {
  return ext === "html" || ext === "htm";
}

function isPdfFile(ext: string): boolean {
  return ext === "pdf";
}

export function FilePreview({ workspace, path, name, onClose }: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const ext = getFileExtension(name);
  const isImage = isImageFile(ext);
  const isMd = isMarkdown(ext);
  const isCode = isCodeFile(ext);
  const isHtml = isHtmlFile(ext);
  const isPdf = isPdfFile(ext);
  const [loading, setLoading] = useState(!isImage && !isPdf);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isImage || isPdf) {
      return;
    }

    fetch(`/api/browse?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}&content=true`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load file");
        return res.json();
      })
      .then((data) => {
        setContent(data.content);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [workspace, path, isImage, isPdf]);

  const handleDownload = () => {
    const blob = new Blob([content || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenInNewTab = () => {
    if (!content) {
      return;
    }
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
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
    >
      <div
        className="rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <FileText
              className="w-5 h-5"
              style={{ color: "var(--text-secondary)" }}
            />
            <span
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {name}
            </span>
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: "var(--background)",
                color: "var(--text-muted)",
              }}
            >
              {ext.toUpperCase() || "FILE"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {content && (
              <>
                {isHtml && (
                  <button
                    onClick={handleOpenInNewTab}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--border)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                  title="Copy content"
                >
                  {copied ? (
                    <Check
                      className="w-5 h-5"
                      style={{ color: "var(--accent)" }}
                    />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                  title="Download file"
                >
                  <Download className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2
                className="w-8 h-8 animate-spin"
                style={{ color: "var(--accent)" }}
              />
            </div>
          )}

          {error && (
            <div
              className="flex flex-col items-center justify-center h-full"
              style={{ color: "var(--accent)" }}
            >
              <AlertCircle className="w-12 h-12 mb-4" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && isImage && (
            <div className="flex items-center justify-center h-full">
              <div className="relative w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- Keep native img for direct file preview URL */}
                <img
                  src={`/api/browse?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}&raw=true`}
                  alt={name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain rounded-lg"
                  onError={() => setError("Failed to load image")}
                />
              </div>
            </div>
          )}

          {!loading && !error && isPdf && (
            <PdfViewer
              url={`/api/browse?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}&raw=true`}
              fileName={name}
            />
          )}

          {!loading && !error && isMd && content && (
            <MarkdownPreview content={content} withContainer={false} />
          )}

          {!loading && !error && isHtml && content && (
            <div className="h-full min-h-[60vh] rounded-lg overflow-hidden" style={{ backgroundColor: "#fff" }}>
              <iframe
                title={`${name} preview`}
                srcDoc={content}
                sandbox="allow-forms allow-modals allow-popups allow-scripts"
                className="w-full h-full"
                style={{ border: "none" }}
              />
            </div>
          )}

          {!loading && !error && !isHtml && isCode && content && (
            <pre
              className="p-4 rounded-lg overflow-x-auto"
              style={{ backgroundColor: "var(--background)" }}
            >
              <code
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {content}
              </code>
            </pre>
          )}

          {!loading && !error && !isImage && !isPdf && !isMd && !isCode && content && (
            <pre
              className="p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap"
              style={{
                backgroundColor: "var(--background)",
                color: "var(--text-secondary)",
              }}
            >
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
