"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
  withContainer?: boolean;
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="max-w-none" style={{ color: "var(--text-secondary)" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 1rem" }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: "1.25rem 0 0.75rem" }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", margin: "1rem 0 0.5rem" }}>
              {children}
            </h3>
          ),
          p: ({ children }) => <p style={{ margin: "0 0 0.75rem", lineHeight: 1.7 }}>{children}</p>,
          ul: ({ children }) => <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.25rem", listStyle: "disc" }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: "0 0 0.75rem", paddingLeft: "1.25rem", listStyle: "decimal" }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: "0.25rem" }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: "3px solid var(--accent)",
                paddingLeft: "0.875rem",
                margin: "0 0 0.75rem",
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const language = className?.replace("language-", "") || "";
            const codeValue = String(children).replace(/\n$/, "");
            const isBlock = Boolean(language) || codeValue.includes("\n");

            if (isBlock) {
              return (
                <SyntaxHighlighter
                  language={language || "text"}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    background: "transparent",
                    fontSize: "0.84rem",
                    lineHeight: 1.65,
                  }}
                  codeTagProps={{
                    style: {
                      fontFamily: "var(--font-jetbrains), 'JetBrains Mono', 'Fira Code', monospace",
                    },
                  }}
                >
                  {codeValue}
                </SyntaxHighlighter>
              );
            }

            return (
              <code
                style={{
                  backgroundColor: "var(--background)",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "0.25rem",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre
              style={{
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                padding: "0.875rem",
                overflowX: "auto",
                margin: "0 0 0.875rem",
                color: "var(--text-primary)",
              }}
            >
              {children}
            </pre>
          ),
          hr: () => <hr style={{ borderColor: "var(--border)", margin: "1rem 0" }} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownPreview({ content, withContainer = true }: MarkdownPreviewProps) {
  if (!withContainer) {
    return <MarkdownBody content={content} />;
  }

  return (
    <div
      className="h-full overflow-auto p-6"
      style={{ backgroundColor: "var(--card)" }}
    >
      <MarkdownBody content={content} />
    </div>
  );
}
