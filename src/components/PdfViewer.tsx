"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Loader2, AlertCircle, Maximize, Minimize } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  fileName: string;
}

export function PdfViewer({ url, fileName }: PdfViewerProps) {
  const { t } = useI18n();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("PDF load error:", err);
    setError("Failed to load PDF");
    setLoading(false);
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages || 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 2.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full"
      style={isFullscreen ? { backgroundColor: "var(--card)" } : undefined}
    >
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="p-1.5 rounded transition-colors disabled:opacity-40"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = "var(--border)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span
            className="text-sm min-w-[80px] text-center"
            style={{ color: "var(--text-secondary)" }}
          >
            {numPages ? `${currentPage} / ${numPages}` : "—"}
          </span>
          <button
            onClick={goToNextPage}
            disabled={!numPages || currentPage >= numPages}
            className="p-1.5 rounded transition-colors disabled:opacity-40"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = "var(--border)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-1.5 rounded transition-colors disabled:opacity-40"
            style={{ color: "var(--text-secondary)" }}
            title="Zoom out"
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = "var(--border)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span
            className="text-xs min-w-[50px] text-center"
            style={{ color: "var(--text-muted)" }}
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 2.0}
            className="p-1.5 rounded transition-colors disabled:opacity-40"
            style={{ color: "var(--text-secondary)" }}
            title="Zoom in"
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = "var(--border)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1.5 rounded transition-colors"
            style={{ color: "var(--text-secondary)" }}
            title="Reset zoom"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--border)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div style={{ width: "1px", height: "16px", backgroundColor: "var(--border)", margin: "0 4px" }} />
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded transition-colors"
            style={{ color: "var(--text-secondary)" }}
            title={isFullscreen ? t("files.pdf.exitFullscreen") : t("files.pdf.fullscreen")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--border)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
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
            style={{ color: "var(--error)" }}
          >
            <AlertCircle className="w-12 h-12 mb-4" />
            <p>{error}</p>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          error=""
        >
          {!loading && !error && (
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="mx-auto"
            />
          )}
        </Document>
      </div>
    </div>
  );
}
